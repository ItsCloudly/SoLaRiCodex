import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { indexers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { parseIdParam } from './utils';

export const indexersRoutes = new Hono();

function parseMediaTypes(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const addIndexerSchema = z.object({
  name: z.string().trim().min(1),
  baseUrl: z.string().trim().min(1),
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
  mediaTypes: z.array(z.enum(['movie', 'tv', 'music'])),
  priority: z.number().default(100),
});

const testConnectionSchema = z.object({
  baseUrl: z.string().trim().min(1),
  apiKey: z.string().optional(),
});

interface TestConnectionResult {
  success: boolean;
  message: string;
  status: 200 | 502;
}

async function testIndexerConnection(baseUrl: string, apiKey?: string): Promise<TestConnectionResult> {
  try {
    const normalizedBaseUrl = baseUrl.endsWith('/')
      ? baseUrl
      : `${baseUrl}/`;
    const endpoint = new URL('api/v2.0/indexers/all/results/torznab/api', normalizedBaseUrl);
    endpoint.searchParams.set('t', 'caps');
    if (apiKey && apiKey.trim().length > 0) {
      endpoint.searchParams.set('apikey', apiKey.trim());
    }

    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return {
        success: false,
        message: `Indexer responded with HTTP ${response.status}`,
        status: 502,
      };
    }

    return { success: true, message: 'Connection successful', status: 200 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return { success: false, message, status: 502 };
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
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const result = await db.select().from(indexers).where(eq(indexers.id, id)).limit(1);

  if (!result[0]) return c.json({ error: 'Indexer not found' }, 404);
  return c.json({
    ...result[0],
    mediaTypes: parseMediaTypes(result[0].mediaTypes),
  });
});

// Add indexer
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
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const body = await c.req.json();
  const data = addIndexerSchema.partial().parse(body);

  const updated = await db.update(indexers)
    .set({
      ...data,
      mediaTypes: data.mediaTypes ? JSON.stringify(data.mediaTypes) : undefined,
    })
    .where(eq(indexers.id, id))
    .returning({ id: indexers.id });

  if (updated.length === 0) return c.json({ error: 'Indexer not found' }, 404);

  return c.json({ message: 'Indexer updated' });
});

// Delete indexer
indexersRoutes.delete('/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const removed = await db.delete(indexers)
    .where(eq(indexers.id, id))
    .returning({ id: indexers.id });

  if (removed.length === 0) return c.json({ error: 'Indexer not found' }, 404);

  return c.json({ message: 'Indexer deleted' });
});

// Test ad-hoc indexer connection
indexersRoutes.post('/test', async (c) => {
  const body = await c.req.json();
  const data = testConnectionSchema.parse(body);

  const result = await testIndexerConnection(data.baseUrl, data.apiKey);
  return c.json({ success: result.success, message: result.message }, result.status);
});

// Test indexer connection
indexersRoutes.get('/:id/test', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid indexer id' }, 400);

  const result = await db.select().from(indexers).where(eq(indexers.id, id)).limit(1);
  if (!result[0]) return c.json({ error: 'Indexer not found' }, 404);

  const indexer = result[0];
  const connectionResult = await testIndexerConnection(indexer.baseUrl, indexer.apiKey ?? undefined);
  return c.json(
    { success: connectionResult.success, message: connectionResult.message },
    connectionResult.status,
  );
});
