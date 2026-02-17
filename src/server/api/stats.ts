import { Hono } from 'hono';
import { db } from '../db/connection';
import { movies, series, albums, downloads } from '../db/schema';
import { count, sql } from 'drizzle-orm';

export const statsRoutes = new Hono();

statsRoutes.get('/', async (c) => {
  try {
    // Get counts
    const movieCount = await db.select({ count: count() }).from(movies);
    const tvCount = await db.select({ count: count() }).from(series);
    const musicCount = await db.select({ count: count() }).from(albums);
    
    // Get download stats
    const downloadStats = await db.select({
      status: downloads.status,
      count: count(),
    }).from(downloads).groupBy(downloads.status);
    
    // Get active downloads
    const activeDownloads = await db.select().from(downloads)
      .where(sql`${downloads.status} IN ('downloading', 'queued', 'paused')`)
      .orderBy(downloads.addedAt)
      .limit(10);
    
    // Calculate storage (placeholder - would need file system access)
    const storage = {
      movies: { used: 0, count: movieCount[0]?.count || 0 },
      tv: { used: 0, count: tvCount[0]?.count || 0 },
      music: { used: 0, count: musicCount[0]?.count || 0 },
    };
    
    return c.json({
      library: {
        movies: movieCount[0]?.count || 0,
        tv: tvCount[0]?.count || 0,
        music: musicCount[0]?.count || 0,
        total: (movieCount[0]?.count || 0) + (tvCount[0]?.count || 0) + (musicCount[0]?.count || 0),
      },
      downloads: {
        byStatus: downloadStats,
        active: activeDownloads,
      },
      storage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});
