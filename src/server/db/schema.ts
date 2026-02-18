import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Base media table
export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['movie', 'tv', 'music'] }).notNull(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  overview: text('overview'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Movies
export const movies = sqliteTable('movies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaId: integer('media_id').references(() => media.id).notNull(),
  releaseDate: text('release_date'),
  runtime: integer('runtime'),
  tmdbId: integer('tmdb_id'),
  imdbId: text('imdb_id'),
  status: text('status', { enum: ['wanted', 'downloaded', 'archived'] }).default('wanted'),
  qualityProfileId: integer('quality_profile_id').references(() => qualityProfiles.id),
  path: text('path'),
});

// TV Series
export const series = sqliteTable('series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaId: integer('media_id').references(() => media.id).notNull(),
  releaseDate: text('release_date'),
  status: text('status', { enum: ['continuing', 'ended', 'wanted', 'downloaded', 'archived'] }).default('wanted'),
  qualityProfileId: integer('quality_profile_id').references(() => qualityProfiles.id),
  path: text('path'),
  tvdbId: integer('tvdb_id'),
});

// TV Episodes
export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seriesId: integer('series_id').references(() => series.id).notNull(),
  season: integer('season').notNull(),
  episode: integer('episode').notNull(),
  airDate: text('air_date'),
  title: text('title'),
  overview: text('overview'),
  downloaded: integer('downloaded', { mode: 'boolean' }).default(false),
  qualityProfileId: integer('quality_profile_id').references(() => qualityProfiles.id),
  filePath: text('file_path'),
});

// Music Artists
export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaId: integer('media_id').references(() => media.id).notNull(),
  musicBrainzId: text('musicbrainz_id'),
  genre: text('genre'),
  status: text('status', { enum: ['wanted', 'downloaded', 'archived'] }).default('wanted'),
  path: text('path'),
});

// Music Albums
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  artistId: integer('artist_id').references(() => artists.id).notNull(),
  mediaId: integer('media_id').references(() => media.id).notNull(),
  musicBrainzId: text('musicbrainz_id'),
  releaseDate: text('release_date'),
  status: text('status', { enum: ['wanted', 'downloaded', 'archived'] }).default('wanted'),
  qualityProfileId: integer('quality_profile_id').references(() => qualityProfiles.id),
  path: text('path'),
});

// Music Tracks
export const tracks = sqliteTable('tracks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  albumId: integer('album_id').references(() => albums.id).notNull(),
  mediaId: integer('media_id').references(() => media.id).notNull(),
  musicBrainzId: text('musicbrainz_id'),
  trackNumber: integer('track_number'),
  duration: integer('duration'),
  downloaded: integer('downloaded', { mode: 'boolean' }).default(false),
  qualityProfileId: integer('quality_profile_id').references(() => qualityProfiles.id),
  filePath: text('file_path'),
});

// Track Lyrics
export const trackLyrics = sqliteTable('track_lyrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trackId: integer('track_id').references(() => tracks.id).notNull(),
  provider: text('provider').notNull(),
  sourceId: text('source_id'),
  syncedLrc: text('synced_lrc'),
  plainLyrics: text('plain_lyrics'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Quality Profiles
export const qualityProfiles = sqliteTable('quality_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  mediaType: text('media_type', { enum: ['movie', 'tv', 'music'] }).notNull(),
  allowedQualities: text('allowed_qualities').notNull(), // JSON array
  minSize: real('min_size'),
  maxSize: real('max_size'),
  preferred: text('preferred'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Indexers
export const indexers = sqliteTable('indexers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  mediaTypes: text('media_types').notNull(), // JSON array
  priority: integer('priority').default(100),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Downloads
export const downloads = sqliteTable('downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaType: text('media_type', { enum: ['movie', 'tv', 'music'] }).notNull(),
  mediaId: integer('media_id').references(() => media.id),
  indexerId: integer('indexer_id').references(() => indexers.id),
  title: text('title').notNull(),
  torrentHash: text('torrent_hash'),
  status: text('status', { enum: ['queued', 'downloading', 'paused', 'seeding', 'completed', 'failed'] }).default('queued'),
  progress: real('progress').default(0),
  speed: real('speed'),
  eta: integer('eta'),
  filePath: text('file_path'),
  quality: text('quality'),
  size: real('size'),
  addedAt: integer('added_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  delugeId: text('deluge_id'),
  errorMessage: text('error_message'),
});

// Settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  type: text('type', { enum: ['string', 'number', 'boolean', 'json'] }).default('string'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Discord Notifications
export const discordSettings = sqliteTable('discord_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  webhookUrl: text('webhook_url'),
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  onDownloadStarted: integer('on_download_started', { mode: 'boolean' }).default(false),
  onDownloadCompleted: integer('on_download_completed', { mode: 'boolean' }).default(true),
  onDownloadFailed: integer('on_download_failed', { mode: 'boolean' }).default(true),
});
