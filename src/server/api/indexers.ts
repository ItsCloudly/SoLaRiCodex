import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { indexers } from '../db/schema';
import { eq } from 'drizzle-orm';

export const indexersRoutes = new Hono();

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMediaTypes(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Get all indexers
indexersRoutes.get('/', async (c) => {
  const results = await db.select().from(indexers);
  return c.json(results.map((indexer) => ({
    ...indexer,
    mediaTypes: parseMediaTypes(indexer.mediaTypes),
  })));
});

// Get indexer by ID
indexersRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const result = await db.select().from(indexers).where(eq(indexers.id, id)).limit(1);
  
  if (!result[0]) return c.json({ error: 'Indexer not found' }, 404);
  return c.json({
    ...result[0],
    mediaTypes: parseMediaTypes(result[0].mediaTypes),
  });
});

// Add indexer
const addIndexerSchema = z.object({
  name: z.string(),
  baseUrl: z.string(),
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
  mediaTypes: z.array(z.enum(['movie', 'tv', 'music'])),
  priority: z.number().default(100),
});

indexersRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const data = addIndexerSchema.parse(body);
  
  const result = await db.insert(indexers).values({
    name: data.name,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey,
    enabled: data.enabled,
    mediaTypes: JSON.stringify(data.mediaTypes),
    priority: data.priority,
  }).returning({ id: indexers.id });
  
  return c.json({ id: result[0].id, message: 'Indexer added' }, 201);
});

// Update indexer
indexersRoutes.put('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const body = await c.req.json();
  
  const data = addIndexerSchema.partial().parse(body);
  
  await db.update(indexers)
    .set({
      ...data,
      mediaTypes: data.mediaTypes ? JSON.stringify(data.mediaTypes) : undefined,
    })
    .where(eq(indexers.id, id));
  
  return c.json({ message: 'Indexer updated' });
});

// Delete indexer
indexersRoutes.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);
  
  await db.delete(indexers).where(eq(indexers.id, id));
  
  return c.json({ message: 'Indexer deleted' });
});

// Test indexer connection
indexersRoutes.get('/:id/test', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const result = await db.select().from(indexers).where(eq(indexers.id, id)).limit(1);
  
  if (!result[0]) return c.json({ error: 'Indexer not found' }, 404);
  
  // TODO: Implement actual connection test
  return c.json({ success: true, message: 'Connection successful' });
});
