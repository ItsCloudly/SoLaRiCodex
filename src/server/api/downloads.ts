import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { downloads, settings } from '../db/schema';
import { desc, eq, or } from 'drizzle-orm';
import { parseIdParam } from './utils';

export const downloadsRoutes = new Hono();

type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'seeding' | 'completed' | 'failed';

interface DelugeSession {
  endpoint: string;
  cookie: string | null;
  requestId: number;
}

interface DelugeRpcError {
  message?: string;
}

interface DelugeRpcResponse<T> {
  result: T;
  error: DelugeRpcError | null;
  id: number;
}

interface DelugeTorrentStatus {
  state?: unknown;
  progress?: unknown;
  download_payload_rate?: unknown;
  eta?: unknown;
  is_finished?: unknown;
}

interface DelugeConnectionConfig {
  host: string;
  port: number;
  password: string;
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

async function resolveDelugeConnectionConfig(): Promise<DelugeConnectionConfig | null> {
  const host = await getSettingValue('deluge.host');
  const portRaw = await getSettingValue('deluge.port');
  const password = await getSettingValue('deluge.password');

  if (!host || !password) return null;

  const parsedPort = portRaw ? Number.parseInt(portRaw, 10) : 8112;
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) return null;

  return {
    host,
    port: parsedPort,
    password,
  };
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

  const sessionCookie = extractSessionCookie(response.headers.get('set-cookie'));
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

function delugeEndpoints(config: DelugeConnectionConfig): string[] {
  return config.port === 8112
    ? [normalizeDelugeEndpoint(config.host, config.port)]
    : [
      normalizeDelugeEndpoint(config.host, config.port),
      normalizeDelugeEndpoint(config.host, 8112),
    ];
}

async function withDelugeSession<T>(
  config: DelugeConnectionConfig,
  operation: (session: DelugeSession) => Promise<T>,
): Promise<T> {
  let lastError: unknown = null;
  for (const endpoint of delugeEndpoints(config)) {
    try {
      const session: DelugeSession = {
        endpoint,
        cookie: null,
        requestId: 0,
      };

      const authenticated = await callDelugeRpc<boolean>(session, 'auth.login', [config.password]);
      if (!authenticated) {
        throw new Error('Deluge authentication failed');
      }

      await ensureDelugeConnected(session);
      return await operation(session);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Failed to connect to Deluge');
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function mapDelugeStateToStatus(stateRaw: unknown, isFinishedRaw: unknown): DownloadStatus {
  const isFinished = isFinishedRaw === true;
  const state = typeof stateRaw === 'string' ? stateRaw.toLowerCase() : '';

  if (isFinished || state.includes('finished')) return 'completed';
  if (state.includes('error')) return 'failed';
  if (state.includes('paused')) return 'paused';
  if (state.includes('seeding')) return 'seeding';
  if (state.includes('download') || state.includes('check') || state.includes('move') || state.includes('allocat')) {
    return 'downloading';
  }
  if (state.includes('queue')) return 'queued';
  return 'queued';
}

function normalizeProgress(progressRaw: unknown, fallbackProgress: number | null, status: DownloadStatus): number {
  if (status === 'completed') return 100;

  const rawValue = toFiniteNumber(progressRaw);
  const normalized = rawValue ?? fallbackProgress ?? 0;
  return Math.min(100, Math.max(0, normalized));
}

function normalizeEta(etaRaw: unknown, status: DownloadStatus): number | null {
  if (status === 'completed') return 0;

  const eta = toFiniteNumber(etaRaw);
  if (eta === null || eta < 0) return null;

  // Deluge can emit very large values to represent "unknown ETA".
  if (eta > 60 * 60 * 24 * 365) return null;

  return Math.round(eta);
}

function toLookupKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

async function syncDownloadsFromDeluge(): Promise<void> {
  const tracked = await db
    .select({
      id: downloads.id,
      status: downloads.status,
      progress: downloads.progress,
      speed: downloads.speed,
      eta: downloads.eta,
      completedAt: downloads.completedAt,
      delugeId: downloads.delugeId,
      torrentHash: downloads.torrentHash,
    })
    .from(downloads)
    .where(or(
      eq(downloads.status, 'queued'),
      eq(downloads.status, 'downloading'),
      eq(downloads.status, 'paused'),
      eq(downloads.status, 'seeding'),
    ));

  if (tracked.length === 0) return;

  const config = await resolveDelugeConnectionConfig();
  if (!config) return;

  let delugeTorrents: Record<string, DelugeTorrentStatus>;
  try {
    delugeTorrents = await withDelugeSession(config, (session) => (
      callDelugeRpc<Record<string, DelugeTorrentStatus>>(
        session,
        'core.get_torrents_status',
        [{}, ['state', 'progress', 'download_payload_rate', 'eta', 'is_finished']],
      )
    ));
  } catch {
    return;
  }

  const torrentsByHash = new Map<string, DelugeTorrentStatus>();
  for (const [hash, torrent] of Object.entries(delugeTorrents)) {
    const key = toLookupKey(hash);
    if (!key) continue;
    torrentsByHash.set(key, torrent);
  }

  for (const item of tracked) {
    const hashCandidates = [toLookupKey(item.delugeId), toLookupKey(item.torrentHash)]
      .filter((value): value is string => value !== null);
    if (hashCandidates.length === 0) continue;

    const torrent = hashCandidates
      .map((key) => torrentsByHash.get(key))
      .find((entry): entry is DelugeTorrentStatus => entry !== undefined);
    if (!torrent) continue;

    const nextStatus = mapDelugeStateToStatus(torrent.state, torrent.is_finished);
    const nextProgress = normalizeProgress(torrent.progress, item.progress, nextStatus);
    const nextSpeedRaw = toFiniteNumber(torrent.download_payload_rate);
    const nextSpeed = nextSpeedRaw !== null ? Math.max(0, nextSpeedRaw) : 0;
    const nextEta = normalizeEta(torrent.eta, nextStatus);

    const update: {
      status?: DownloadStatus;
      progress?: number;
      speed?: number;
      eta?: number | null;
      completedAt?: Date;
    } = {};

    if (item.status !== nextStatus) {
      update.status = nextStatus;
    }

    const currentProgress = item.progress ?? 0;
    if (Math.abs(currentProgress - nextProgress) >= 0.1) {
      update.progress = nextProgress;
    }

    const currentSpeed = item.speed ?? 0;
    if (Math.abs(currentSpeed - nextSpeed) >= 1) {
      update.speed = nextSpeed;
    }

    const currentEta = item.eta ?? null;
    if (currentEta !== nextEta) {
      update.eta = nextEta;
    }

    if (nextStatus === 'completed' && !item.completedAt) {
      update.completedAt = new Date();
    }

    if (Object.keys(update).length === 0) {
      continue;
    }

    await db.update(downloads)
      .set(update)
      .where(eq(downloads.id, item.id));
  }
}

// Get all downloads
downloadsRoutes.get('/', async (c) => {
  try {
    await syncDownloadsFromDeluge();
  } catch {
    // Keep API responsive even when Deluge is unavailable.
  }

  const results = await db
    .select()
    .from(downloads)
    .orderBy(desc(downloads.addedAt));
  
  return c.json(results);
});

// Get active downloads
downloadsRoutes.get('/active', async (c) => {
  try {
    await syncDownloadsFromDeluge();
  } catch {
    // Keep API responsive even when Deluge is unavailable.
  }

  const results = await db
    .select()
    .from(downloads)
    .where(eq(downloads.status, 'downloading'))
    .orderBy(desc(downloads.addedAt));
  
  return c.json(results);
});

// Add download
const addDownloadSchema = z.object({
  mediaType: z.enum(['movie', 'tv', 'music']),
  mediaId: z.number().optional(),
  indexerId: z.number().optional(),
  title: z.string(),
  torrentHash: z.string().optional(),
  quality: z.string().optional(),
  size: z.number().optional(),
});

const updateDownloadSchema = z.object({
  status: z.enum(['queued', 'downloading', 'paused', 'seeding', 'completed', 'failed']).optional(),
  progress: z.number().min(0).max(100).optional(),
  speed: z.number().optional(),
  eta: z.number().optional(),
  filePath: z.string().optional(),
  quality: z.string().optional(),
  size: z.number().optional(),
  completedAt: z.string().datetime().optional(),
  delugeId: z.string().optional(),
  errorMessage: z.string().optional(),
});

downloadsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const data = addDownloadSchema.parse(body);
  
  const result = await db.insert(downloads).values({
    mediaType: data.mediaType,
    mediaId: data.mediaId,
    indexerId: data.indexerId,
    title: data.title,
    torrentHash: data.torrentHash,
    quality: data.quality,
    size: data.size,
    status: 'queued',
    progress: 0,
  }).returning({ id: downloads.id });
  
  return c.json({ id: result[0].id, message: 'Download added to queue' }, 201);
});

// Update download progress
downloadsRoutes.patch('/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid download id' }, 400);

  const body = await c.req.json();
  const data = updateDownloadSchema.parse(body);

  const existing = await db
    .select({
      id: downloads.id,
      delugeId: downloads.delugeId,
      torrentHash: downloads.torrentHash,
    })
    .from(downloads)
    .where(eq(downloads.id, id))
    .limit(1);

  if (existing.length === 0) return c.json({ error: 'Download not found' }, 404);

  const torrentIdentifier = toLookupKey(existing[0].delugeId) || toLookupKey(existing[0].torrentHash);
  if (torrentIdentifier && data.status && (data.status === 'paused' || data.status === 'downloading')) {
    const config = await resolveDelugeConnectionConfig();
    if (!config) {
      return c.json({ error: 'Deluge is not configured in Settings > Download Client' }, 400);
    }

    try {
      await withDelugeSession(config, async (session) => {
        if (data.status === 'paused') {
          await callDelugeRpc<unknown>(session, 'core.pause_torrent', [[torrentIdentifier]]);
        } else {
          await callDelugeRpc<unknown>(session, 'core.resume_torrent', [[torrentIdentifier]]);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update torrent state in Deluge';
      return c.json({ error: message }, 502);
    }
  }

  const updated = await db.update(downloads)
    .set({
      ...data,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    })
    .where(eq(downloads.id, id))
    .returning({ id: downloads.id });

  if (updated.length === 0) return c.json({ error: 'Download not found' }, 404);
  
  return c.json({ message: 'Download updated' });
});

// Delete download
downloadsRoutes.delete('/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid download id' }, 400);

  const existing = await db
    .select({
      id: downloads.id,
      delugeId: downloads.delugeId,
      torrentHash: downloads.torrentHash,
    })
    .from(downloads)
    .where(eq(downloads.id, id))
    .limit(1);

  if (existing.length === 0) return c.json({ error: 'Download not found' }, 404);

  const torrentIdentifier = toLookupKey(existing[0].delugeId) || toLookupKey(existing[0].torrentHash);
  if (torrentIdentifier) {
    const config = await resolveDelugeConnectionConfig();
    if (!config) {
      return c.json({ error: 'Deluge is not configured in Settings > Download Client' }, 400);
    }

    try {
      await withDelugeSession(config, async (session) => {
        await callDelugeRpc<unknown>(session, 'core.remove_torrent', [torrentIdentifier, false]);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove torrent from Deluge';
      return c.json({ error: message }, 502);
    }
  }

  const removed = await db.delete(downloads)
    .where(eq(downloads.id, id))
    .returning({ id: downloads.id });
  
  return c.json({ message: 'Download removed' });
});
