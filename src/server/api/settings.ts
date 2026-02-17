import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { settings, discordSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

export const settingsRoutes = new Hono();
type SettingType = 'string' | 'number' | 'boolean' | 'json';

function parseSettingValue(raw: string, type: SettingType | null): unknown {
  if (type === 'json') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (type === 'number') return Number(raw);
  if (type === 'boolean') return raw === 'true';
  return raw;
}

// Get all settings
settingsRoutes.get('/', async (c) => {
  const results = await db.select().from(settings);
  
  const parsed: Record<string, unknown> = {};
  for (const s of results) {
    parsed[s.key] = parseSettingValue(s.value, s.type as SettingType | null);
  }
  
  return c.json(parsed);
});

// Update settings
const updateSettingsSchema = z.record(z.string(), z.any());

settingsRoutes.put('/', async (c) => {
  const body = await c.req.json();
  const data = updateSettingsSchema.parse(body);
  
  for (const [key, value] of Object.entries(data)) {
    let type: SettingType = 'string';
    let stringValue = String(value);
    
    if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    } else if (typeof value === 'object') {
      type = 'json';
      stringValue = JSON.stringify(value);
    }
    
    await db.insert(settings)
      .values({ key, value: stringValue, type })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: stringValue, type, updatedAt: new Date() },
      });
  }
  
  return c.json({ message: 'Settings updated' });
});

// Get Discord settings
settingsRoutes.get('/notifications/discord', async (c) => {
  const result = await db.select().from(discordSettings).limit(1);
  return c.json(result[0] || null);
});

// Update Discord settings
const discordSchema = z.object({
  webhookUrl: z.string().optional(),
  enabled: z.boolean().optional(),
  onDownloadStarted: z.boolean().optional(),
  onDownloadCompleted: z.boolean().optional(),
  onDownloadFailed: z.boolean().optional(),
});

settingsRoutes.put('/notifications/discord', async (c) => {
  const body = await c.req.json();
  const data = discordSchema.parse(body);
  
  const existing = await db.select().from(discordSettings).limit(1);
  
  if (existing[0]) {
    await db.update(discordSettings)
      .set(data)
      .where(eq(discordSettings.id, existing[0].id));
  } else {
    await db.insert(discordSettings).values(data);
  }
  
  return c.json({ message: 'Discord settings updated' });
});

// Get setting by key
settingsRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  
  if (!result[0]) return c.json({ error: 'Setting not found' }, 404);
  
  const s = result[0];
  const value = parseSettingValue(s.value, s.type as SettingType | null);
  
  return c.json({ key: s.key, value, type: s.type });
});
