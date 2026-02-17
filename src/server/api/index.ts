import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { statsRoutes } from './stats';
import { mediaRoutes } from './media';
import { searchRoutes } from './search';
import { downloadsRoutes } from './downloads';
import { indexersRoutes } from './indexers';
import { qualityRoutes } from './quality';
import { settingsRoutes } from './settings';
import { delugeRoutes } from './deluge';
import { ZodError } from 'zod';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));

// Mount routes
app.route('/stats', statsRoutes);
app.route('/media', mediaRoutes);
app.route('/search', searchRoutes);
app.route('/downloads', downloadsRoutes);
app.route('/indexers', indexersRoutes);
app.route('/quality-profiles', qualityRoutes);
app.route('/settings', settingsRoutes);
app.route('/deluge', delugeRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return c.json({ error: 'Invalid request payload', details: error.issues }, 400);
  }

  console.error('API error:', error);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
