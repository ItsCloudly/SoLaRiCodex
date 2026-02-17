import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { downloads } from '../db/schema';
import { count, desc, eq, or } from 'drizzle-orm';

export const delugeRoutes = new Hono();

const addTorrentSchema = z.object({
  title: z.string().trim().min(1),
  mediaType: z.enum(['movie', 'tv', 'music']),
  mediaId: z.number().int().positive().optional(),
  indexerId: z.number().int().positive().optional(),
  torrentHash: z.string().trim().min(1).optional(),
  delugeId: z.string().trim().min(1).optional(),
  quality: z.string().trim().optional(),
  size: z.number().positive().optional(),
});

function byTorrentIdentifier(hash: string) {
  return or(eq(downloads.torrentHash, hash), eq(downloads.delugeId, hash));
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
    mode: 'internal-queue',
    message: 'Deluge client is not configured; using internal queue controls',
    byStatus,
    active,
  });
});

// Add torrent
delugeRoutes.post('/add-torrent', async (c) => {
  const body = await c.req.json();
  const data = addTorrentSchema.parse(body);

  const result = await db.insert(downloads).values({
    mediaType: data.mediaType,
    mediaId: data.mediaId,
    indexerId: data.indexerId,
    title: data.title,
    torrentHash: data.torrentHash,
    delugeId: data.delugeId,
    quality: data.quality,
    size: data.size,
    status: 'queued',
    progress: 0,
  }).returning({ id: downloads.id });

  return c.json({ id: result[0].id, message: 'Torrent queued' }, 201);
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
