import { Hono } from 'hono';
import { db } from '../db/connection';
import { artists, media, movies, series } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export const searchRoutes = new Hono();

type SearchCategory = 'movies' | 'tv' | 'music';

interface SearchResult {
  id: number | string;
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  releaseDate?: string | null;
  genre?: string | null;
  inLibrary: boolean;
  source: 'library' | 'manual';
}

function readSearchQuery(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function createManualResult(category: SearchCategory, query: string): SearchResult {
  return {
    id: `manual:${category}:${query.toLowerCase()}`,
    title: query,
    overview: `Manual entry for ${query}`,
    inLibrary: false,
    source: 'manual',
  };
}

function makeLikePattern(query: string): string {
  return `%${query.toLowerCase()}%`;
}

function withManualResult(category: SearchCategory, query: string, items: SearchResult[]): SearchResult[] {
  const hasExactMatch = items.some((item) => item.title.trim().toLowerCase() === query.toLowerCase());
  return hasExactMatch ? items : [createManualResult(category, query), ...items];
}

// Search movies
searchRoutes.get('/movies', async (c) => {
  const query = readSearchQuery(c.req.query('q'));
  if (!query) return c.json({ error: 'Query parameter required' }, 400);

  const pattern = makeLikePattern(query);
  const matches = await db
    .select({
      id: media.id,
      title: media.title,
      overview: media.overview,
      posterPath: media.posterPath,
      releaseDate: movies.releaseDate,
    })
    .from(movies)
    .innerJoin(media, eq(movies.mediaId, media.id))
    .where(sql`lower(${media.title}) like ${pattern} OR lower(coalesce(${media.originalTitle}, '')) like ${pattern}`)
    .limit(25);

  const results = withManualResult('movies', query, matches.map((item) => ({
    ...item,
    inLibrary: true,
    source: 'library' as const,
  })));

  return c.json({
    query,
    results,
    message: 'Results include local library matches and a manual add option',
  });
});

// Search TV
searchRoutes.get('/tv', async (c) => {
  const query = readSearchQuery(c.req.query('q'));
  if (!query) return c.json({ error: 'Query parameter required' }, 400);

  const pattern = makeLikePattern(query);
  const matches = await db
    .select({
      id: media.id,
      title: media.title,
      overview: media.overview,
      posterPath: media.posterPath,
      releaseDate: series.releaseDate,
    })
    .from(series)
    .innerJoin(media, eq(series.mediaId, media.id))
    .where(sql`lower(${media.title}) like ${pattern} OR lower(coalesce(${media.originalTitle}, '')) like ${pattern}`)
    .limit(25);

  const results = withManualResult('tv', query, matches.map((item) => ({
    ...item,
    inLibrary: true,
    source: 'library' as const,
  })));

  return c.json({
    query,
    results,
    message: 'Results include local library matches and a manual add option',
  });
});

// Search music
searchRoutes.get('/music', async (c) => {
  const query = readSearchQuery(c.req.query('q'));
  if (!query) return c.json({ error: 'Query parameter required' }, 400);

  const pattern = makeLikePattern(query);
  const matches = await db
    .select({
      id: media.id,
      title: media.title,
      overview: media.overview,
      posterPath: media.posterPath,
      genre: artists.genre,
    })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id))
    .where(sql`lower(${media.title}) like ${pattern}`)
    .limit(25);

  const results = withManualResult('music', query, matches.map((item) => ({
    ...item,
    inLibrary: true,
    source: 'library' as const,
  })));

  return c.json({
    query,
    results,
    message: 'Results include local library matches and a manual add option',
  });
});
