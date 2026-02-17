import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { albums, artists, downloads, episodes, media, movies, series, tracks } from '../db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { parseIdParam } from './utils';

export const mediaRoutes = new Hono();

async function findExistingMediaId(type: 'movie' | 'tv' | 'music', title: string): Promise<number | null> {
  const trimmed = title.trim();

  const existing = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.type, type), sql`lower(${media.title}) = lower(${trimmed})`))
    .limit(1);

  return existing[0]?.id ?? null;
}

const addMovieSchema = z.object({
  title: z.string().trim().min(1),
  originalTitle: z.string().trim().min(1).optional(),
  overview: z.string().trim().optional(),
  posterPath: z.string().trim().optional(),
  backdropPath: z.string().trim().optional(),
  releaseDate: z.string().trim().optional(),
  runtime: z.number().int().positive().optional(),
  tmdbId: z.number().int().positive().optional(),
  imdbId: z.string().trim().optional(),
  qualityProfileId: z.number().int().positive().optional(),
});

const addSeriesSchema = z.object({
  title: z.string().trim().min(1),
  originalTitle: z.string().trim().min(1).optional(),
  overview: z.string().trim().optional(),
  posterPath: z.string().trim().optional(),
  backdropPath: z.string().trim().optional(),
  releaseDate: z.string().trim().optional(),
  tvdbId: z.number().int().positive().optional(),
  qualityProfileId: z.number().int().positive().optional(),
});

const addArtistSchema = z.object({
  title: z.string().trim().min(1),
  overview: z.string().trim().optional(),
  posterPath: z.string().trim().optional(),
  genre: z.string().trim().optional(),
  musicBrainzId: z.string().trim().optional(),
  qualityProfileId: z.number().int().positive().optional(),
});

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
  const id = parseIdParam(c.req.param('id'));
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
mediaRoutes.post('/movies', async (c) => {
  const body = await c.req.json();
  const data = addMovieSchema.parse(body);

  const existingId = await findExistingMediaId('movie', data.title);
  if (existingId !== null) {
    return c.json({ error: 'Movie already exists', id: existingId }, 409);
  }

  const mediaId = db.transaction((tx) => {
    const mediaResult = tx.insert(media).values({
      type: 'movie',
      title: data.title,
      originalTitle: data.originalTitle,
      overview: data.overview,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
    }).returning({ id: media.id }).get();

    if (!mediaResult) throw new Error('Failed to create movie media row');
    const createdMediaId = mediaResult.id;

    tx.insert(movies).values({
      mediaId: createdMediaId,
      releaseDate: data.releaseDate,
      runtime: data.runtime,
      tmdbId: data.tmdbId,
      imdbId: data.imdbId,
      qualityProfileId: data.qualityProfileId,
      status: 'wanted',
    }).run();

    return createdMediaId;
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
  const id = parseIdParam(c.req.param('id'));
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

// Add series
mediaRoutes.post('/tv', async (c) => {
  const body = await c.req.json();
  const data = addSeriesSchema.parse(body);

  const existingId = await findExistingMediaId('tv', data.title);
  if (existingId !== null) {
    return c.json({ error: 'Series already exists', id: existingId }, 409);
  }

  const mediaId = db.transaction((tx) => {
    const mediaResult = tx.insert(media).values({
      type: 'tv',
      title: data.title,
      originalTitle: data.originalTitle,
      overview: data.overview,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
    }).returning({ id: media.id }).get();

    if (!mediaResult) throw new Error('Failed to create series media row');
    const createdMediaId = mediaResult.id;

    tx.insert(series).values({
      mediaId: createdMediaId,
      releaseDate: data.releaseDate,
      tvdbId: data.tvdbId,
      qualityProfileId: data.qualityProfileId,
      status: 'wanted',
    }).run();

    return createdMediaId;
  });

  return c.json({ id: mediaId, message: 'Series added' }, 201);
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

// Add artist
mediaRoutes.post('/music/artists', async (c) => {
  const body = await c.req.json();
  const data = addArtistSchema.parse(body);

  const existingId = await findExistingMediaId('music', data.title);
  if (existingId !== null) {
    return c.json({ error: 'Artist already exists', id: existingId }, 409);
  }

  const mediaId = db.transaction((tx) => {
    const mediaResult = tx.insert(media).values({
      type: 'music',
      title: data.title,
      overview: data.overview,
      posterPath: data.posterPath,
    }).returning({ id: media.id }).get();

    if (!mediaResult) throw new Error('Failed to create artist media row');
    const createdMediaId = mediaResult.id;

    tx.insert(artists).values({
      mediaId: createdMediaId,
      genre: data.genre,
      musicBrainzId: data.musicBrainzId,
      status: 'wanted',
    }).run();

    return createdMediaId;
  });

  return c.json({ id: mediaId, message: 'Artist added' }, 201);
});

// Get artist with albums
mediaRoutes.get('/music/artists/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
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
  const id = parseIdParam(c.req.param('id'));
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
  const id = parseIdParam(c.req.param('id'));

  if (id === null) return c.json({ error: 'Invalid media id' }, 400);
  if (!['movie', 'tv', 'music'].includes(type)) {
    return c.json({ error: 'Invalid media type' }, 400);
  }

  const mediaRecord = await db
    .select({ id: media.id, type: media.type })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);

  if (!mediaRecord[0] || mediaRecord[0].type !== type) {
    return c.json({ error: `${type} not found` }, 404);
  }

  db.transaction((tx) => {
    tx.delete(downloads).where(eq(downloads.mediaId, id)).run();

    if (type === 'movie') {
      tx.delete(movies).where(eq(movies.mediaId, id)).run();
    }

    if (type === 'tv') {
      const matchingSeries = tx
        .select({ id: series.id })
        .from(series)
        .where(eq(series.mediaId, id))
        .all();

      const seriesIds = matchingSeries.map((record) => record.id);
      if (seriesIds.length > 0) {
        tx.delete(episodes).where(inArray(episodes.seriesId, seriesIds)).run();
      }

      tx.delete(series).where(eq(series.mediaId, id)).run();
    }

    if (type === 'music') {
      const matchingArtists = tx
        .select({ id: artists.id })
        .from(artists)
        .where(eq(artists.mediaId, id))
        .get();

      if (matchingArtists) {
        const artistId = matchingArtists.id;

        const artistAlbums = tx
          .select({ id: albums.id, mediaId: albums.mediaId })
          .from(albums)
          .where(eq(albums.artistId, artistId))
          .all();

        const albumIds = artistAlbums.map((record) => record.id);
        const albumMediaIds = artistAlbums.map((record) => record.mediaId);

        if (albumIds.length > 0) {
          const albumTracks = tx
            .select({ mediaId: tracks.mediaId })
            .from(tracks)
            .where(inArray(tracks.albumId, albumIds))
            .all();

          const trackMediaIds = albumTracks.map((record) => record.mediaId);

          tx.delete(tracks).where(inArray(tracks.albumId, albumIds)).run();

          if (trackMediaIds.length > 0) {
            tx.delete(downloads).where(inArray(downloads.mediaId, trackMediaIds)).run();
            tx.delete(media).where(inArray(media.id, trackMediaIds)).run();
          }

          tx.delete(albums).where(eq(albums.artistId, artistId)).run();

          if (albumMediaIds.length > 0) {
            tx.delete(downloads).where(inArray(downloads.mediaId, albumMediaIds)).run();
            tx.delete(media).where(inArray(media.id, albumMediaIds)).run();
          }
        }

        tx.delete(artists).where(eq(artists.id, artistId)).run();
      } else {
        const matchingAlbums = tx
          .select({ id: albums.id })
          .from(albums)
          .where(eq(albums.mediaId, id))
          .get();

        if (matchingAlbums) {
          const albumId = matchingAlbums.id;
          const albumTracks = tx
            .select({ mediaId: tracks.mediaId })
            .from(tracks)
            .where(eq(tracks.albumId, albumId))
            .all();

          const trackMediaIds = albumTracks.map((record) => record.mediaId);

          tx.delete(tracks).where(eq(tracks.albumId, albumId)).run();

          if (trackMediaIds.length > 0) {
            tx.delete(downloads).where(inArray(downloads.mediaId, trackMediaIds)).run();
            tx.delete(media).where(inArray(media.id, trackMediaIds)).run();
          }

          tx.delete(albums).where(eq(albums.id, albumId)).run();
        } else {
          tx.delete(tracks).where(eq(tracks.mediaId, id)).run();
        }
      }
    }

    tx.delete(media).where(eq(media.id, id)).run();
  });

  return c.json({ message: `${type} deleted` });
});
