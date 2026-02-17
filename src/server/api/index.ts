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

export default app;
