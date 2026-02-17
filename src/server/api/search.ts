import { Hono } from 'hono';

export const searchRoutes = new Hono();

// Search movies via Jackett
searchRoutes.get('/movies', async (c) => {
  const query = c.req.query('q');
  
  if (!query) {
    return c.json({ error: 'Query parameter required' }, 400);
  }
  
  // TODO: Implement Jackett search
  return c.json({
    query,
    results: [],
    message: 'Jackett search not yet implemented',
  });
});

// Search TV via Jackett
searchRoutes.get('/tv', async (c) => {
  const query = c.req.query('q');
  
  if (!query) {
    return c.json({ error: 'Query parameter required' }, 400);
  }
  
  // TODO: Implement Jackett search
  return c.json({
    query,
    results: [],
    message: 'Jackett search not yet implemented',
  });
});

// Search music via Jackett
searchRoutes.get('/music', async (c) => {
  const query = c.req.query('q');
  
  if (!query) {
    return c.json({ error: 'Query parameter required' }, 400);
  }
  
  // TODO: Implement Jackett search
  return c.json({
    query,
    results: [],
    message: 'Jackett search not yet implemented',
  });
});
