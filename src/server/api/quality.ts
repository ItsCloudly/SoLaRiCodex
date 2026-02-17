import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { qualityProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export const qualityRoutes = new Hono();

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAllowedQualities(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Get all quality profiles
qualityRoutes.get('/', async (c) => {
  const results = await db.select().from(qualityProfiles);
  
  // Parse JSON strings
  const parsed = results.map(p => ({
    ...p,
    allowedQualities: parseAllowedQualities(p.allowedQualities),
  }));
  
  return c.json(parsed);
});

// Get profile by ID
qualityRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid quality profile id' }, 400);

  const result = await db.select().from(qualityProfiles).where(eq(qualityProfiles.id, id)).limit(1);
  
  if (!result[0]) return c.json({ error: 'Quality profile not found' }, 404);
  
  return c.json({
    ...result[0],
    allowedQualities: parseAllowedQualities(result[0].allowedQualities),
  });
});

// Add quality profile
const addQualitySchema = z.object({
  name: z.string(),
  mediaType: z.enum(['movie', 'tv', 'music']),
  allowedQualities: z.array(z.string()),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
  preferred: z.string().optional(),
});

qualityRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const data = addQualitySchema.parse(body);
  
  const result = await db.insert(qualityProfiles).values({
    name: data.name,
    mediaType: data.mediaType,
    allowedQualities: JSON.stringify(data.allowedQualities),
    minSize: data.minSize,
    maxSize: data.maxSize,
    preferred: data.preferred,
  }).returning({ id: qualityProfiles.id });
  
  return c.json({ id: result[0].id, message: 'Quality profile created' }, 201);
});

// Update quality profile
qualityRoutes.put('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid quality profile id' }, 400);

  const body = await c.req.json();
  
  const data = addQualitySchema.partial().parse(body);
  
  await db.update(qualityProfiles)
    .set({
      ...data,
      allowedQualities: data.allowedQualities ? JSON.stringify(data.allowedQualities) : undefined,
    })
    .where(eq(qualityProfiles.id, id));
  
  return c.json({ message: 'Quality profile updated' });
});

// Delete quality profile
qualityRoutes.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid quality profile id' }, 400);
  
  await db.delete(qualityProfiles).where(eq(qualityProfiles.id, id));
  
  return c.json({ message: 'Quality profile deleted' });
});
