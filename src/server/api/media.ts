import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { media, movies, series, artists, albums, episodes, tracks } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export const mediaRoutes = new Hono();

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Get all movies
mediaRoutes.get('/movies', async (c) => {
  const results = await db
    .select({
      id: media.id,
      title: media.title,
      originalTitle: media.originalTitle,
      overview: media.overview,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      releaseDate: movies.releaseDate,
      runtime: movies.runtime,
      status: movies.status,
      path: movies.path,
    })
    .from(movies)
    .innerJoin(media, eq(movies.mediaId, media.id))
    .orderBy(desc(media.createdAt));
  
  return c.json(results);
});

// Get movie by ID
mediaRoutes.get('/movies/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid movie id' }, 400);

  const result = await db
    .select({
      id: media.id,
      title: media.title,
      originalTitle: media.originalTitle,
      overview: media.overview,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      releaseDate: movies.releaseDate,
      runtime: movies.runtime,
      tmdbId: movies.tmdbId,
      imdbId: movies.imdbId,
      status: movies.status,
      path: movies.path,
    })
    .from(movies)
    .innerJoin(media, eq(movies.mediaId, media.id))
    .where(eq(media.id, id))
    .limit(1);
  
  if (!result[0]) return c.json({ error: 'Movie not found' }, 404);
  return c.json(result[0]);
});

// Add movie
const addMovieSchema = z.object({
  title: z.string(),
  originalTitle: z.string().optional(),
  overview: z.string().optional(),
  posterPath: z.string().optional(),
  backdropPath: z.string().optional(),
  releaseDate: z.string().optional(),
  runtime: z.number().optional(),
  tmdbId: z.number().optional(),
  imdbId: z.string().optional(),
  qualityProfileId: z.number().optional(),
});

mediaRoutes.post('/movies', async (c) => {
  const body = await c.req.json();
  const data = addMovieSchema.parse(body);
  
  const mediaResult = await db.insert(media).values({
    type: 'movie',
    title: data.title,
    originalTitle: data.originalTitle,
    overview: data.overview,
    posterPath: data.posterPath,
    backdropPath: data.backdropPath,
  }).returning({ id: media.id });
  
  const mediaId = mediaResult[0].id;
  
  await db.insert(movies).values({
    mediaId,
    releaseDate: data.releaseDate,
    runtime: data.runtime,
    tmdbId: data.tmdbId,
    imdbId: data.imdbId,
    qualityProfileId: data.qualityProfileId,
    status: 'wanted',
  });
  
  return c.json({ id: mediaId, message: 'Movie added' }, 201);
});

// Get all TV series
mediaRoutes.get('/tv', async (c) => {
  const results = await db
    .select({
      id: media.id,
      title: media.title,
      originalTitle: media.originalTitle,
      overview: media.overview,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      releaseDate: series.releaseDate,
      status: series.status,
      path: series.path,
      tvdbId: series.tvdbId,
    })
    .from(series)
    .innerJoin(media, eq(series.mediaId, media.id))
    .orderBy(desc(media.createdAt));
  
  return c.json(results);
});

// Get series by ID with episodes
mediaRoutes.get('/tv/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid series id' }, 400);
  
  const seriesResult = await db
    .select({
      id: media.id,
      seriesRecordId: series.id,
      title: media.title,
      originalTitle: media.originalTitle,
      overview: media.overview,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      releaseDate: series.releaseDate,
      status: series.status,
      path: series.path,
      tvdbId: series.tvdbId,
    })
    .from(series)
    .innerJoin(media, eq(series.mediaId, media.id))
    .where(eq(media.id, id))
    .limit(1);
  
  if (!seriesResult[0]) return c.json({ error: 'Series not found' }, 404);
  
  const { seriesRecordId, ...seriesPayload } = seriesResult[0];

  const episodesResult = await db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesRecordId))
    .orderBy(episodes.season, episodes.episode);
  
  return c.json({
    ...seriesPayload,
    episodes: episodesResult,
  });
});

// Get all artists
mediaRoutes.get('/music/artists', async (c) => {
  const results = await db
    .select({
      id: media.id,
      title: media.title,
      posterPath: media.posterPath,
      genre: artists.genre,
      status: artists.status,
      path: artists.path,
    })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id))
    .orderBy(media.title);
  
  return c.json(results);
});

// Get artist with albums
mediaRoutes.get('/music/artists/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid artist id' }, 400);
  
  const artistResult = await db
    .select({
      id: media.id,
      artistRecordId: artists.id,
      title: media.title,
      overview: media.overview,
      posterPath: media.posterPath,
      genre: artists.genre,
      status: artists.status,
      path: artists.path,
      musicBrainzId: artists.musicBrainzId,
    })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id))
    .where(eq(media.id, id))
    .limit(1);
  
  if (!artistResult[0]) return c.json({ error: 'Artist not found' }, 404);

  const { artistRecordId, ...artistPayload } = artistResult[0];
  
  const albumsResult = await db
    .select({
      id: media.id,
      title: media.title,
      posterPath: media.posterPath,
      releaseDate: albums.releaseDate,
      status: albums.status,
    })
    .from(albums)
    .innerJoin(media, eq(albums.mediaId, media.id))
    .where(eq(albums.artistId, artistRecordId))
    .orderBy(desc(albums.releaseDate));
  
  return c.json({
    ...artistPayload,
    albums: albumsResult,
  });
});

// Get album with tracks
mediaRoutes.get('/music/albums/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid album id' }, 400);
  
  const albumResult = await db
    .select({
      id: media.id,
      albumRecordId: albums.id,
      title: media.title,
      overview: media.overview,
      posterPath: media.posterPath,
      releaseDate: albums.releaseDate,
      status: albums.status,
      path: albums.path,
      musicBrainzId: albums.musicBrainzId,
    })
    .from(albums)
    .innerJoin(media, eq(albums.mediaId, media.id))
    .where(eq(media.id, id))
    .limit(1);
  
  if (!albumResult[0]) return c.json({ error: 'Album not found' }, 404);

  const { albumRecordId, ...albumPayload } = albumResult[0];
  
  const tracksResult = await db
    .select()
    .from(tracks)
    .where(eq(tracks.albumId, albumRecordId))
    .orderBy(tracks.trackNumber);
  
  return c.json({
    ...albumPayload,
    tracks: tracksResult,
  });
});

// Delete media
mediaRoutes.delete('/:type/:id', async (c) => {
  const type = c.req.param('type');
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid media id' }, 400);
  if (!['movie', 'tv', 'music'].includes(type)) {
    return c.json({ error: 'Invalid media type' }, 400);
  }
  
  await db.delete(media).where(eq(media.id, id));
  
  return c.json({ message: `${type} deleted` });
});
