import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { downloads, settings } from '../db/schema';
import { count, desc, eq, or } from 'drizzle-orm';

export const delugeRoutes = new Hono();

const addTorrentSchema = z.object({
  title: z.string().trim().min(1),
  mediaType: z.enum(['movie', 'tv', 'music']),
  mediaId: z.number().int().positive().optional(),
  indexerId: z.number().int().positive().optional(),
  sourceUrl: z.string().trim().min(1).refine(
    (value) => value.startsWith('magnet:') || /^https?:\/\//i.test(value),
    'sourceUrl must be a magnet link or HTTP(S) URL',
  ).optional(),
  torrentHash: z.string().trim().min(1).optional(),
  delugeId: z.string().trim().min(1).optional(),
  quality: z.string().trim().optional(),
  size: z.number().positive().optional(),
});

function byTorrentIdentifier(hash: string) {
  return or(eq(downloads.torrentHash, hash), eq(downloads.delugeId, hash));
}

async function getSettingValue(key: string): Promise<string | null> {
  const result = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  const raw = result[0]?.value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/_session_id=[^;]+/i);
  return match ? match[0] : null;
}

function normalizeDelugeEndpoint(host: string, port: number): string {
  const withScheme = /^https?:\/\//i.test(host)
    ? host
    : `http://${host}`;

  const url = new URL(withScheme);
  url.port = String(port);

  const cleanPath = url.pathname.replace(/\/+$/, '');
  if (cleanPath.length === 0) {
    url.pathname = '/json';
  } else if (!cleanPath.endsWith('/json')) {
    url.pathname = `${cleanPath}/json`;
  } else {
    url.pathname = cleanPath;
  }

  return url.toString();
}

async function resolveDelugeConnectionConfig(): Promise<{ host: string; port: number; password: string }> {
  const host = await getSettingValue('deluge.host');
  const portRaw = await getSettingValue('deluge.port');
  const password = await getSettingValue('deluge.password');

  if (!host) {
    throw new Error('Deluge host is not configured in Settings > Download Client');
  }

  if (!password) {
    throw new Error('Deluge password is not configured in Settings > Download Client');
  }

  const parsedPort = portRaw ? Number.parseInt(portRaw, 10) : 8112;
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error('Deluge port is invalid in Settings > Download Client');
  }

  return {
    host,
    port: parsedPort,
    password,
  };
}

interface DelugeSession {
  endpoint: string;
  cookie: string | null;
  requestId: number;
}

interface DelugeRpcError {
  message?: string;
  code?: number;
}

interface DelugeRpcResponse<T> {
  result: T;
  error: DelugeRpcError | null;
  id: number;
}

async function callDelugeRpc<T>(session: DelugeSession, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(session.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    },
    body: JSON.stringify({
      method,
      params,
      id: ++session.requestId,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const setCookieHeader = response.headers.get('set-cookie');
  const sessionCookie = extractSessionCookie(setCookieHeader);
  if (sessionCookie) {
    session.cookie = sessionCookie;
  }

  if (!response.ok) {
    throw new Error(`Deluge RPC HTTP ${response.status}`);
  }

  const payload = await response.json() as DelugeRpcResponse<T>;
  if (payload.error) {
    throw new Error(payload.error.message || `Deluge RPC error for ${method}`);
  }

  return payload.result;
}

async function ensureDelugeConnected(session: DelugeSession): Promise<void> {
  try {
    const connected = await callDelugeRpc<boolean>(session, 'web.connected', []);
    if (connected) return;

    const hosts = await callDelugeRpc<Array<[string, string, number, string]>>(session, 'web.get_hosts', []);
    const preferredHost = hosts.find((entry) => entry[3] === 'Online') || hosts[0];

    if (preferredHost) {
      await callDelugeRpc<boolean>(session, 'web.connect', [preferredHost[0]]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('unknown method')) {
      return;
    }
    throw error;
  }
}

function isMagnetLink(url: string): boolean {
  return url.toLowerCase().startsWith('magnet:');
}

function extractTorrentHash(url: string): string | null {
  if (isMagnetLink(url)) {
    const magnetMatch = url.match(/btih:([A-Za-z0-9]+)/i);
    if (magnetMatch?.[1]) {
      return magnetMatch[1].toLowerCase();
    }
  }
  return null;
}

async function tryAddToDelugeEndpoint(
  endpoint: string,
  password: string,
  sourceUrl: string,
): Promise<{ delugeId: string | null; torrentHash: string | null }> {
  const session: DelugeSession = {
    endpoint,
    cookie: null,
    requestId: 0,
  };

  const authenticated = await callDelugeRpc<boolean>(session, 'auth.login', [password]);
  if (!authenticated) {
    throw new Error('Deluge authentication failed');
  }

  await ensureDelugeConnected(session);

  let delugeId: string | null = null;
  if (isMagnetLink(sourceUrl)) {
    delugeId = await callDelugeRpc<string | null>(session, 'core.add_torrent_magnet', [sourceUrl, {}]);
  } else {
    delugeId = await callDelugeRpc<string | null>(session, 'core.add_torrent_url', [sourceUrl, {}]);
  }

  if (delugeId === null || delugeId === undefined || String(delugeId).trim().length === 0) {
    throw new Error('Deluge did not return a torrent identifier');
  }

  const torrentHash = extractTorrentHash(sourceUrl) || String(delugeId).trim();
  return {
    delugeId: String(delugeId).trim(),
    torrentHash,
  };
}

async function addToDeluge(sourceUrl: string): Promise<{ delugeId: string | null; torrentHash: string | null }> {
  const config = await resolveDelugeConnectionConfig();
  const endpoints = config.port === 8112
    ? [normalizeDelugeEndpoint(config.host, config.port)]
    : [
      normalizeDelugeEndpoint(config.host, config.port),
      normalizeDelugeEndpoint(config.host, 8112),
    ];

  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      return await tryAddToDelugeEndpoint(endpoint, config.password, sourceUrl);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Failed to connect to Deluge');
}

// Get Deluge status
delugeRoutes.get('/status', async (c) => {
  const byStatus = await db
    .select({
      status: downloads.status,
      count: count(),
    })
    .from(downloads)
    .groupBy(downloads.status);

  const active = await db
    .select({
      id: downloads.id,
      title: downloads.title,
      status: downloads.status,
      progress: downloads.progress,
      speed: downloads.speed,
      eta: downloads.eta,
      torrentHash: downloads.torrentHash,
      delugeId: downloads.delugeId,
    })
    .from(downloads)
    .where(or(
      eq(downloads.status, 'queued'),
      eq(downloads.status, 'downloading'),
      eq(downloads.status, 'paused'),
      eq(downloads.status, 'seeding'),
    ))
    .orderBy(desc(downloads.addedAt))
    .limit(25);

  return c.json({
    connected: false,
    mode: 'deluge-rpc',
    byStatus,
    active,
  });
});

// Add torrent
delugeRoutes.post('/add-torrent', async (c) => {
  const body = await c.req.json();
  const data = addTorrentSchema.parse(body);

  let delugeId = data.delugeId;
  let torrentHash = data.torrentHash;

  if (data.sourceUrl) {
    try {
      const delugeResult = await addToDeluge(data.sourceUrl);
      delugeId = delugeId || delugeResult.delugeId || undefined;
      torrentHash = torrentHash || delugeResult.torrentHash || undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send torrent to Deluge';
      if (message.includes('not configured') || message.includes('invalid')) {
        return c.json({ error: message }, 400);
      }
      return c.json({ error: message }, 502);
    }
  }

  const result = await db.insert(downloads).values({
    mediaType: data.mediaType,
    mediaId: data.mediaId,
    indexerId: data.indexerId,
    title: data.title,
    torrentHash,
    delugeId,
    quality: data.quality,
    size: data.size,
    status: 'queued',
    progress: 0,
  }).returning({ id: downloads.id });

  return c.json({
    id: result[0].id,
    message: data.sourceUrl ? 'Torrent sent to Deluge and queued' : 'Torrent queued',
  }, 201);
});

// Pause torrent
delugeRoutes.post('/:hash/pause', async (c) => {
  const hash = c.req.param('hash').trim();
  if (!hash) return c.json({ error: 'Invalid torrent hash' }, 400);

  const updated = await db.update(downloads)
    .set({ status: 'paused' })
    .where(byTorrentIdentifier(hash))
    .returning({ id: downloads.id });

  if (updated.length === 0) return c.json({ error: 'Torrent not found' }, 404);

  return c.json({ message: 'Torrent paused' });
});

// Resume torrent
delugeRoutes.post('/:hash/resume', async (c) => {
  const hash = c.req.param('hash').trim();
  if (!hash) return c.json({ error: 'Invalid torrent hash' }, 400);

  const updated = await db.update(downloads)
    .set({ status: 'downloading' })
    .where(byTorrentIdentifier(hash))
    .returning({ id: downloads.id });

  if (updated.length === 0) return c.json({ error: 'Torrent not found' }, 404);

  return c.json({ message: 'Torrent resumed' });
});

// Remove torrent
delugeRoutes.delete('/:hash', async (c) => {
  const hash = c.req.param('hash').trim();
  if (!hash) return c.json({ error: 'Invalid torrent hash' }, 400);

  const removed = await db.delete(downloads)
    .where(byTorrentIdentifier(hash))
    .returning({ id: downloads.id });

  if (removed.length === 0) return c.json({ error: 'Torrent not found' }, 404);

  return c.json({ message: 'Torrent removed' });
});
