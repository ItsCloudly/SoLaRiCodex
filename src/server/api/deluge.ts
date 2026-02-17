import { Hono } from 'hono';

export const delugeRoutes = new Hono();

// Get Deluge status
delugeRoutes.get('/status', async (c) => {
  // TODO: Implement Deluge connection
  return c.json({
    connected: false,
    message: 'Deluge integration not yet implemented',
  });
});

// Add torrent
delugeRoutes.post('/add-torrent', async (c) => {
  const body = await c.req.json();
  // TODO: Implement torrent addition
  return c.json({ message: 'Torrent addition not yet implemented' }, 501);
});

// Pause torrent
delugeRoutes.post('/:hash/pause', async (c) => {
  const hash = c.req.param('hash');
  // TODO: Implement pause
  return c.json({ message: 'Pause not yet implemented' }, 501);
});

// Resume torrent
delugeRoutes.post('/:hash/resume', async (c) => {
  const hash = c.req.param('hash');
  // TODO: Implement resume
  return c.json({ message: 'Resume not yet implemented' }, 501);
});

// Remove torrent
delugeRoutes.delete('/:hash', async (c) => {
  const hash = c.req.param('hash');
  // TODO: Implement removal
  return c.json({ message: 'Removal not yet implemented' }, 501);
});
