import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { downloads } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { parseIdParam } from './utils';

export const downloadsRoutes = new Hono();

// Get all downloads
downloadsRoutes.get('/', async (c) => {
  const results = await db
    .select()
    .from(downloads)
    .orderBy(desc(downloads.addedAt));
  
  return c.json(results);
});

// Get active downloads
downloadsRoutes.get('/active', async (c) => {
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
  
  const removed = await db.delete(downloads)
    .where(eq(downloads.id, id))
    .returning({ id: downloads.id });

  if (removed.length === 0) return c.json({ error: 'Download not found' }, 404);
  
  return c.json({ message: 'Download removed' });
});
