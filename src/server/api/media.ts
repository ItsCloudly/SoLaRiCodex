import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { createReadStream, type Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { db } from '../db/connection';
import { albums, artists, downloads, episodes, media, movies, series, settings, tracks } from '../db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { parseIdParam } from './utils';

export const mediaRoutes = new Hono();
const require = createRequire(import.meta.url);

async function findExistingMediaId(type: 'movie' | 'tv' | 'music', title: string): Promise<number | null> {
  const trimmed = title.trim();

  const existing = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.type, type), sql`lower(${media.title}) = lower(${trimmed})`))
    .limit(1);

  return existing[0]?.id ?? null;
}

interface TmdbTvExternalIds {
  tvdb_id?: number | null;
}

interface TmdbTvDetailsSeason {
  season_number?: number | null;
  episode_count?: number | null;
  air_date?: string | null;
}

interface TmdbTvDetails {
  seasons?: TmdbTvDetailsSeason[];
}

interface TmdbSearchResponse<T> {
  results?: T[];
}

interface TmdbTvSearchResult {
  id: number;
  name?: string | null;
  original_name?: string | null;
  first_air_date?: string | null;
}

interface TmdbTvSeasonEpisode {
  episode_number?: number | null;
  air_date?: string | null;
  name?: string | null;
  overview?: string | null;
}

interface TmdbTvSeasonDetails {
  season_number?: number | null;
  episodes?: TmdbTvSeasonEpisode[];
}

interface EpisodeSeed {
  season: number;
  episode: number;
  airDate?: string;
  title?: string;
  overview?: string;
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const EPISODE_INSERT_CHUNK_SIZE = 100;
const SERIES_FILESYSTEM_SYNC_COOLDOWN_MS = 15000;
const LIBRARY_FILESYSTEM_SYNC_COOLDOWN_MS = 15000;
const MAX_SCANNED_DIRECTORIES_PER_SYNC = 12000;
const MAX_SCANNED_FILES_PER_SYNC = 120000;
const VIDEO_FILE_EXTENSIONS = new Set([
  '.3gp', '.asf', '.avi', '.flv', '.m2ts', '.m4v', '.mkv', '.mov', '.mp4',
  '.mpeg', '.mpg', '.mts', '.ogm', '.ogv', '.ts', '.vob', '.webm', '.wmv',
]);
const AUDIO_FILE_EXTENSIONS = new Set([
  '.aac', '.aiff', '.alac', '.ape', '.flac', '.m4a', '.mp3', '.ogg', '.opus',
  '.wav', '.wma',
]);
const PLAYABLE_VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv']);
const PLAYABLE_AUDIO_EXTENSIONS = new Set(['.mp3', '.flac']);
const IMAGE_FILE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const ALBUM_ARTWORK_PRIORITY_NAMES = [
  'cover',
  'folder',
  'front',
  'album',
  'artwork',
  'albumart',
];
const PLAYBACK_PROGRESS_SETTING_KEY = 'player.playback.progress.v1';
const PLAYBACK_PROGRESS_MAX_ITEMS = 800;
const MKV_COMPAT_STREAM_START_TIMEOUT_MS = 15_000;
const seriesFilesystemSyncCache = new Map<number, number>();
let lastMoviesFilesystemSyncAt = 0;
let lastMusicFilesystemSyncAt = 0;
let ffmpegStaticBinaryPath: string | null = null;
let ffmpegBinaryPathCache: string | null | undefined;

try {
  const resolvedStaticPath = require('ffmpeg-static');
  if (typeof resolvedStaticPath === 'string' && resolvedStaticPath.trim().length > 0) {
    ffmpegStaticBinaryPath = resolvedStaticPath.trim();
  }
} catch {
  ffmpegStaticBinaryPath = null;
}

interface ScannedMediaFile {
  fullPath: string;
  directoryPath: string;
  fileName: string;
  normalizedCandidate: string;
}

type PlaybackMediaKind = 'movie' | 'episode' | 'track';

interface PlaybackProgressEntry {
  mediaKind: PlaybackMediaKind;
  mediaId: number;
  positionSeconds: number;
  durationSeconds?: number;
  updatedAt: number;
}

interface DurationCacheEntry {
  durationSeconds: number;
  expiresAt: number;
}

const mediaDurationCache = new Map<string, DurationCacheEntry>();
const MEDIA_DURATION_CACHE_TTL_MS = 1000 * 60 * 30;

async function getSettingValue(key: string): Promise<string | null> {
  const result = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  const raw = result[0]?.value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getTmdbApiKey(): Promise<string | null> {
  return getSettingValue('apis.tmdb.apiKey');
}

async function setSettingJsonValue(key: string, payload: unknown): Promise<void> {
  const serialized = JSON.stringify(payload);
  await db.insert(settings)
    .values({
      key,
      value: serialized,
      type: 'json',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: serialized,
        type: 'json',
        updatedAt: new Date(),
      },
    })
    .run();
}

function isPlaybackMediaKind(value: string): value is PlaybackMediaKind {
  return value === 'movie' || value === 'episode' || value === 'track';
}

function buildPlaybackProgressKey(mediaKind: PlaybackMediaKind, mediaId: number): string {
  return `${mediaKind}:${mediaId}`;
}

function normalizePlaybackProgressEntry(raw: unknown): PlaybackProgressEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<PlaybackProgressEntry>;
  const mediaKind = String(candidate.mediaKind || '');
  if (!isPlaybackMediaKind(mediaKind)) return null;

  const mediaId = candidate.mediaId;
  if (typeof mediaId !== 'number' || !Number.isInteger(mediaId) || mediaId <= 0) return null;

  const positionSeconds = candidate.positionSeconds;
  if (typeof positionSeconds !== 'number' || !Number.isFinite(positionSeconds) || positionSeconds < 0) return null;

  const durationSeconds = candidate.durationSeconds;
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) return null;

  const updatedAt = candidate.updatedAt;
  if (typeof updatedAt !== 'number' || !Number.isInteger(updatedAt) || updatedAt <= 0) return null;

  return {
    mediaKind,
    mediaId,
    positionSeconds,
    durationSeconds,
    updatedAt,
  };
}

async function readPlaybackProgressMap(): Promise<Record<string, PlaybackProgressEntry>> {
  const raw = await getSettingValue(PLAYBACK_PROGRESS_SETTING_KEY);
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object') return {};
  const output: Record<string, PlaybackProgressEntry> = {};

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const normalized = normalizePlaybackProgressEntry(value);
    if (!normalized) continue;
    output[key] = normalized;
  }

  return output;
}

async function writePlaybackProgressMap(progressMap: Record<string, PlaybackProgressEntry>): Promise<void> {
  const sortedEntries = Object.entries(progressMap)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, PLAYBACK_PROGRESS_MAX_ITEMS);

  const trimmedMap = Object.fromEntries(sortedEntries);
  await setSettingJsonValue(PLAYBACK_PROGRESS_SETTING_KEY, trimmedMap);
}

async function fetchTmdbJson<T>(
  path: string,
  apiKey: string,
  queryParams: Record<string, string> = {},
): Promise<T> {
  const endpoint = new URL(`${TMDB_BASE_URL}/${path}`);
  endpoint.searchParams.set('api_key', apiKey);

  for (const [key, value] of Object.entries(queryParams)) {
    endpoint.searchParams.set(key, value);
  }

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`TMDB responded with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function toIntegerOrNull(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value)) return null;
  return value;
}

function deriveYear(dateValue: string | null | undefined): number | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear();
}

function normalizeTitleForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedContainsAllTokens(
  normalizedCandidate: string,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) return true;
  const queryTokens = normalizedQuery
    .split(' ')
    .filter((token) => token.length >= 2);
  if (queryTokens.length === 0) return true;

  const candidateTokens = Array.from(new Set(
    normalizedCandidate
      .split(' ')
      .filter((token) => token.length > 0),
  ));

  for (const token of queryTokens) {
    const matched = candidateTokens.some((candidateToken) => (
      candidateToken === token
      || (
        token.length >= 3
        && (
          candidateToken.includes(token)
          || token.includes(candidateToken)
        )
      )
    ));

    if (!matched) return false;
  }
  return true;
}

function resolveConfiguredPath(rawPath: string): string {
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(process.cwd(), rawPath);
}

function parseEpisodeMarkersFromFileName(fileName: string): Array<{ season: number; episode: number }> {
  const markers: Array<{ season: number; episode: number }> = [];
  const seenKeys = new Set<string>();

  const addMarker = (season: number, episode: number) => {
    if (!Number.isInteger(season) || !Number.isInteger(episode)) return;
    if (season < 0 || episode <= 0) return;
    const key = `${season}:${episode}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    markers.push({ season, episode });
  };

  const multiEpisodePattern = /\bS(\d{1,2})E(\d{1,2}(?:E\d{1,2})*)\b/gi;
  for (const match of fileName.matchAll(multiEpisodePattern)) {
    const season = Number.parseInt(match[1], 10);
    const episodeParts = match[2].split('E');
    for (const part of episodeParts) {
      const episode = Number.parseInt(part, 10);
      addMarker(season, episode);
    }
  }

  const xPattern = /\b(\d{1,2})x(\d{1,2})\b/gi;
  for (const match of fileName.matchAll(xPattern)) {
    addMarker(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10));
  }

  return markers;
}

function isEpisodeDownloadedValue(value: unknown): boolean {
  return value === true || value === 1;
}

async function collectMediaFiles(
  rootPath: string,
  allowedExtensions: Set<string>,
): Promise<ScannedMediaFile[]> {
  const scannedFiles: ScannedMediaFile[] = [];
  const directoriesToScan: string[] = [rootPath];
  let scannedDirectories = 0;

  while (directoriesToScan.length > 0) {
    if (scannedDirectories >= MAX_SCANNED_DIRECTORIES_PER_SYNC) break;
    if (scannedFiles.length >= MAX_SCANNED_FILES_PER_SYNC) break;

    const currentDirectory = directoriesToScan.pop();
    if (!currentDirectory) continue;

    let entries: Array<Dirent<string>>;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      continue;
    }

    scannedDirectories += 1;

    for (const entry of entries) {
      const entryName = String(entry.name);
      const absolutePath = path.join(currentDirectory, entryName);

      if (entry.isDirectory()) {
        if (entryName.startsWith('.')) continue;
        directoriesToScan.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entryName).toLowerCase();
      if (!allowedExtensions.has(extension)) continue;

      scannedFiles.push({
        fullPath: absolutePath,
        directoryPath: currentDirectory,
        fileName: entryName,
        normalizedCandidate: normalizeTitleForMatch(`${currentDirectory} ${entryName}`),
      });

      if (scannedFiles.length >= MAX_SCANNED_FILES_PER_SYNC) break;
    }
  }

  return scannedFiles;
}

async function collectSeriesEpisodeFileMatches(
  rootPath: string,
  seriesTitle: string,
): Promise<Map<string, string>> {
  const normalizedTitle = normalizeTitleForMatch(seriesTitle);
  if (normalizedTitle.length === 0) return new Map();

  const matches = new Map<string, string>();
  const scannedVideoFiles = await collectMediaFiles(rootPath, VIDEO_FILE_EXTENSIONS);

  for (const scannedFile of scannedVideoFiles) {
    if (!scannedFile.normalizedCandidate.includes(normalizedTitle)) continue;

    const episodeMarkers = parseEpisodeMarkersFromFileName(scannedFile.fileName);
    for (const marker of episodeMarkers) {
        const key = `${marker.season}:${marker.episode}`;
        if (!matches.has(key)) {
          matches.set(key, scannedFile.fullPath);
        }
    }
  }

  return matches;
}

function scoreTmdbSeriesCandidate(
  requestedTitle: string,
  requestedYear: number | null,
  candidate: TmdbTvSearchResult,
): number {
  const normalizedRequested = normalizeTitleForMatch(requestedTitle);
  const candidateTitle = normalizeTitleForMatch(candidate.name || candidate.original_name || '');
  if (candidateTitle.length === 0) return -1;

  let score = 0;
  if (candidateTitle === normalizedRequested) {
    score += 120;
  } else if (
    candidateTitle.includes(normalizedRequested)
    || normalizedRequested.includes(candidateTitle)
  ) {
    score += 60;
  }

  const candidateYear = deriveYear(candidate.first_air_date);
  if (requestedYear !== null && candidateYear !== null && requestedYear === candidateYear) {
    score += 40;
  }

  return score;
}

async function resolveTmdbSeriesIdByTitle(
  title: string,
  releaseDate?: string | null,
): Promise<number | null> {
  const tmdbApiKey = await getTmdbApiKey();
  if (!tmdbApiKey) return null;

  const query = title.trim();
  if (query.length === 0) return null;

  try {
    const payload = await fetchTmdbJson<TmdbSearchResponse<TmdbTvSearchResult>>(
      'search/tv',
      tmdbApiKey,
      {
        query,
        include_adult: 'false',
        language: 'en-US',
        page: '1',
      },
    );

    const candidates = (payload.results || []).slice(0, 10);
    if (candidates.length === 0) return null;

    const requestedYear = deriveYear(releaseDate || null);
    const best = candidates
      .map((candidate) => ({ candidate, score: scoreTmdbSeriesCandidate(query, requestedYear, candidate) }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 0) return null;
    return typeof best.candidate.id === 'number' ? best.candidate.id : null;
  } catch {
    return null;
  }
}

function buildEpisodeSeedsFromTmdbSeasons(seasons: TmdbTvDetailsSeason[] | undefined): EpisodeSeed[] {
  if (!Array.isArray(seasons) || seasons.length === 0) return [];

  const seeds: EpisodeSeed[] = [];

  for (const seasonInfo of seasons) {
    const seasonNumber = toIntegerOrNull(seasonInfo.season_number);
    const episodeCount = toIntegerOrNull(seasonInfo.episode_count);

    if (seasonNumber === null || seasonNumber < 0) continue;
    if (episodeCount === null || episodeCount <= 0) continue;

    for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber += 1) {
      seeds.push({
        season: seasonNumber,
        episode: episodeNumber,
        airDate: seasonInfo.air_date || undefined,
        title: `Episode ${episodeNumber}`,
      });
    }
  }

  return seeds;
}

async function buildEpisodeSeedsFromTmdbSeasonDetails(
  tmdbId: number,
  seasons: TmdbTvDetailsSeason[] | undefined,
  apiKey: string,
): Promise<EpisodeSeed[]> {
  if (!Array.isArray(seasons) || seasons.length === 0) return [];

  const seeds: EpisodeSeed[] = [];
  const seen = new Set<string>();

  for (const seasonInfo of seasons) {
    const seasonNumber = toIntegerOrNull(seasonInfo.season_number);
    if (seasonNumber === null || seasonNumber < 0) continue;

    try {
      const seasonDetails = await fetchTmdbJson<TmdbTvSeasonDetails>(
        `tv/${tmdbId}/season/${seasonNumber}`,
        apiKey,
        { language: 'en-US' },
      );

      const detailSeasonNumber = toIntegerOrNull(seasonDetails.season_number) ?? seasonNumber;
      const detailEpisodes = Array.isArray(seasonDetails.episodes) ? seasonDetails.episodes : [];

      if (detailEpisodes.length > 0) {
        for (const detailEpisode of detailEpisodes) {
          const episodeNumber = toIntegerOrNull(detailEpisode.episode_number);
          if (episodeNumber === null || episodeNumber <= 0) continue;

          const key = `${detailSeasonNumber}:${episodeNumber}`;
          if (seen.has(key)) continue;
          seen.add(key);

          seeds.push({
            season: detailSeasonNumber,
            episode: episodeNumber,
            airDate: detailEpisode.air_date || seasonInfo.air_date || undefined,
            title: detailEpisode.name?.trim() || `Episode ${episodeNumber}`,
            overview: detailEpisode.overview?.trim() || undefined,
          });
        }
      } else {
        const fallbackEpisodeCount = toIntegerOrNull(seasonInfo.episode_count);
        if (fallbackEpisodeCount !== null && fallbackEpisodeCount > 0) {
          for (let episodeNumber = 1; episodeNumber <= fallbackEpisodeCount; episodeNumber += 1) {
            const key = `${seasonNumber}:${episodeNumber}`;
            if (seen.has(key)) continue;
            seen.add(key);

            seeds.push({
              season: seasonNumber,
              episode: episodeNumber,
              airDate: seasonInfo.air_date || undefined,
              title: `Episode ${episodeNumber}`,
            });
          }
        }
      }
    } catch {
      const fallbackEpisodeCount = toIntegerOrNull(seasonInfo.episode_count);
      if (fallbackEpisodeCount === null || fallbackEpisodeCount <= 0) continue;

      for (let episodeNumber = 1; episodeNumber <= fallbackEpisodeCount; episodeNumber += 1) {
        const key = `${seasonNumber}:${episodeNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);

        seeds.push({
          season: seasonNumber,
          episode: episodeNumber,
          airDate: seasonInfo.air_date || undefined,
          title: `Episode ${episodeNumber}`,
        });
      }
    }
  }

  return seeds.sort((a, b) => a.season - b.season || a.episode - b.episode);
}

async function resolveTmdbSeriesMetadata(
  tmdbId: number,
  fallbackTvdbId?: number,
): Promise<{ tvdbId?: number; episodeSeeds: EpisodeSeed[] }> {
  const tmdbApiKey = await getTmdbApiKey();
  if (!tmdbApiKey) {
    return {
      tvdbId: fallbackTvdbId,
      episodeSeeds: [],
    };
  }

  const [externalIdsResult, detailsResult] = await Promise.allSettled([
    fetchTmdbJson<TmdbTvExternalIds>(`tv/${tmdbId}/external_ids`, tmdbApiKey),
    fetchTmdbJson<TmdbTvDetails>(`tv/${tmdbId}`, tmdbApiKey, { language: 'en-US' }),
  ]);

  let resolvedTvdbId = fallbackTvdbId;
  if (externalIdsResult.status === 'fulfilled') {
    const parsedTvdbId = toIntegerOrNull(externalIdsResult.value.tvdb_id);
    if (parsedTvdbId !== null && parsedTvdbId > 0) {
      resolvedTvdbId = parsedTvdbId;
    }
  }

  let episodeSeeds: EpisodeSeed[] = [];
  if (detailsResult.status === 'fulfilled') {
    episodeSeeds = await buildEpisodeSeedsFromTmdbSeasonDetails(
      tmdbId,
      detailsResult.value.seasons,
      tmdbApiKey,
    );

    if (episodeSeeds.length === 0) {
      episodeSeeds = buildEpisodeSeedsFromTmdbSeasons(detailsResult.value.seasons);
    }
  }

  return {
    tvdbId: resolvedTvdbId,
    episodeSeeds,
  };
}

async function insertEpisodeSeeds(seriesId: number, episodeSeeds: EpisodeSeed[]): Promise<number> {
  if (episodeSeeds.length === 0) return 0;

  const existing = await db
    .select({
      season: episodes.season,
      episode: episodes.episode,
    })
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId));

  const existingKeys = new Set(existing.map((row) => `${row.season}:${row.episode}`));
  const seedsToInsert = episodeSeeds.filter((seed) => !existingKeys.has(`${seed.season}:${seed.episode}`));
  if (seedsToInsert.length === 0) return 0;

  let insertedCount = 0;
  for (let index = 0; index < seedsToInsert.length; index += EPISODE_INSERT_CHUNK_SIZE) {
    const chunk = seedsToInsert.slice(index, index + EPISODE_INSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db.insert(episodes).values(chunk.map((seed) => ({
      seriesId,
      season: seed.season,
      episode: seed.episode,
      airDate: seed.airDate,
      title: seed.title,
      overview: seed.overview,
      downloaded: false,
    }))).run();
    insertedCount += chunk.length;
  }

  return insertedCount;
}

async function backfillSeriesEpisodesFromTmdb(
  seriesId: number,
  title: string,
  releaseDate: string | null | undefined,
  fallbackTvdbId: number | null | undefined,
): Promise<{ insertedCount: number; resolvedTvdbId: number | null }> {
  const tmdbId = await resolveTmdbSeriesIdByTitle(title, releaseDate);
  if (tmdbId === null) {
    return { insertedCount: 0, resolvedTvdbId: fallbackTvdbId ?? null };
  }

  const metadata = await resolveTmdbSeriesMetadata(tmdbId, fallbackTvdbId ?? undefined);
  const insertedCount = await insertEpisodeSeeds(seriesId, metadata.episodeSeeds);
  const resolvedTvdbId = metadata.tvdbId ?? fallbackTvdbId ?? null;

  if (resolvedTvdbId !== null && resolvedTvdbId > 0 && resolvedTvdbId !== (fallbackTvdbId ?? null)) {
    await db.update(series)
      .set({ tvdbId: resolvedTvdbId })
      .where(eq(series.id, seriesId))
      .run();
  }

  return { insertedCount, resolvedTvdbId };
}

async function syncSeriesEpisodesFromFilesystem(
  seriesRecordId: number,
  seriesTitle: string,
  seriesPath?: string | null,
): Promise<{ updatedCount: number }> {
  const now = Date.now();
  const lastSyncedAt = seriesFilesystemSyncCache.get(seriesRecordId) || 0;
  if (now - lastSyncedAt < SERIES_FILESYSTEM_SYNC_COOLDOWN_MS) {
    return { updatedCount: 0 };
  }
  seriesFilesystemSyncCache.set(seriesRecordId, now);

  const configuredTvPath = await getSettingValue('media.tv.path');
  const rootCandidates = [seriesPath || null, configuredTvPath || null]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => resolveConfiguredPath(value.trim()));

  const uniqueRoots = Array.from(new Set(rootCandidates));
  if (uniqueRoots.length === 0) return { updatedCount: 0 };

  const fileMatches = new Map<string, string>();
  for (const rootPath of uniqueRoots) {
    const matchesForRoot = await collectSeriesEpisodeFileMatches(rootPath, seriesTitle);
    for (const [key, matchedPath] of matchesForRoot.entries()) {
      if (!fileMatches.has(key)) {
        fileMatches.set(key, matchedPath);
      }
    }
  }

  const existingEpisodes = await db
    .select({
      id: episodes.id,
      season: episodes.season,
      episode: episodes.episode,
      downloaded: episodes.downloaded,
      filePath: episodes.filePath,
    })
    .from(episodes)
    .where(eq(episodes.seriesId, seriesRecordId));

  let updatedCount = 0;
  for (const row of existingEpisodes) {
    const key = `${row.season}:${row.episode}`;
    const matchedPath = fileMatches.get(key);
    if (matchedPath) {
      const hasLocalAvailability = isEpisodeDownloadedValue(row.downloaded);
      const hasMatchingPath = typeof row.filePath === 'string' && row.filePath.trim() === matchedPath;
      if (hasLocalAvailability && hasMatchingPath) continue;

      await db.update(episodes)
        .set({
          downloaded: true,
          filePath: matchedPath,
        })
        .where(eq(episodes.id, row.id))
        .run();
      updatedCount += 1;
      continue;
    }

    const hasLocalAvailability = isEpisodeDownloadedValue(row.downloaded);
    const hasStoredPath = typeof row.filePath === 'string' && row.filePath.trim().length > 0;
    if (!hasLocalAvailability && !hasStoredPath) continue;

    await db.update(episodes)
      .set({
        downloaded: false,
        filePath: null,
      })
      .where(eq(episodes.id, row.id))
      .run();
    updatedCount += 1;
  }

  return { updatedCount };
}

function parseLeadingTrackNumber(fileName: string): number | null {
  const stem = path.parse(fileName).name;
  const match = stem.match(/^\s*(\d{1,2})(?:\D|$)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function cleanMusicNameSegment(value: string): string {
  return value
    .replace(/[_]+/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\{[^}]*}/g, ' ')
    .replace(/\((?:19|20)\d{2}\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTrackTitleFromFileName(fileName: string): string {
  const stem = path.parse(fileName).name;
  const withoutLeadingNumber = stem
    .replace(/^\s*\d{1,3}\s*(?:[-._)\]]+|\s)\s*/, '')
    .trim();
  const cleaned = cleanMusicNameSegment(withoutLeadingNumber);
  return cleaned.length > 0 ? cleaned : stem.trim();
}

function extractYearFromDirectoryName(value: string): number | null {
  const match = value.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null;
  return parsed;
}

function splitDirectorySegments(relativeDirectoryPath: string): string[] {
  return relativeDirectoryPath
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.');
}

function inferArtistAndAlbumForDirectory(
  musicRootPath: string,
  directoryPath: string,
): { artistCandidates: string[]; albumTitle: string | null; releaseYear: number | null } {
  const relativePath = path.relative(musicRootPath, directoryPath);
  const segments = splitDirectorySegments(relativePath);
  const fallbackLeaf = path.basename(directoryPath);
  const leafRaw = segments[segments.length - 1] || fallbackLeaf;
  const leafClean = cleanMusicNameSegment(leafRaw);

  const hyphenMatch = leafClean.match(/^(.+?)\s+-\s+(.+)$/);
  const leafArtist = hyphenMatch ? cleanMusicNameSegment(hyphenMatch[1]) : '';
  const leafAlbum = hyphenMatch ? cleanMusicNameSegment(hyphenMatch[2]) : leafClean;

  const parentSegment = segments.length > 1 ? cleanMusicNameSegment(segments[segments.length - 2]) : '';
  const firstSegment = segments.length > 0 ? cleanMusicNameSegment(segments[0]) : '';

  const artistCandidates = [leafArtist, parentSegment, firstSegment]
    .filter((candidate) => candidate.length > 0)
    .filter((candidate, index, all) => all.findIndex((item) => item.toLowerCase() === candidate.toLowerCase()) === index);

  const albumTitle = leafAlbum.length > 0 ? leafAlbum : null;
  return {
    artistCandidates,
    albumTitle,
    releaseYear: extractYearFromDirectoryName(leafRaw),
  };
}

function scoreArtistCandidate(normalizedArtist: string, normalizedCandidate: string): number {
  if (normalizedArtist.length === 0 || normalizedCandidate.length === 0) return -1;
  if (normalizedArtist === normalizedCandidate) return 120;
  if (
    normalizedArtist.includes(normalizedCandidate)
    || normalizedCandidate.includes(normalizedArtist)
  ) {
    return 90;
  }

  const artistTokens = new Set(normalizedArtist.split(' ').filter((token) => token.length > 0));
  const candidateTokens = normalizedCandidate.split(' ').filter((token) => token.length > 0);
  let overlap = 0;
  for (const token of candidateTokens) {
    if (artistTokens.has(token)) overlap += 1;
  }

  return overlap > 0 ? overlap * 15 : -1;
}

function findBestMatchingArtist(
  artistCandidates: string[],
  artistRows: Array<{ artistId: number; title: string }>,
): { artistId: number; title: string } | null {
  let bestMatch: { artistId: number; title: string } | null = null;
  let bestScore = -1;

  for (const candidate of artistCandidates) {
    const normalizedCandidate = normalizeTitleForMatch(candidate);
    if (normalizedCandidate.length === 0) continue;

    for (const row of artistRows) {
      const normalizedArtistTitle = normalizeTitleForMatch(row.title);
      const score = scoreArtistCandidate(normalizedArtistTitle, normalizedCandidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = row;
      }
    }
  }

  // Require at least a strong partial match to avoid attaching files to wrong artists.
  return bestScore >= 90 ? bestMatch : null;
}

interface ExistingTrackForSync {
  trackId: number;
  mediaId: number;
  trackNumber: number | null;
  title: string;
  downloaded: unknown;
  filePath: string | null;
}

function findExistingTrackForScannedFile(
  file: ScannedMediaFile,
  existingTracks: ExistingTrackForSync[],
): ExistingTrackForSync | null {
  const trackNumber = parseLeadingTrackNumber(file.fileName);
  if (trackNumber !== null) {
    const byNumber = existingTracks.find((track) => track.trackNumber === trackNumber);
    if (byNumber) return byNumber;
  }

  const inferredTitle = parseTrackTitleFromFileName(file.fileName);
  const normalizedInferredTitle = normalizeTitleForMatch(inferredTitle);
  if (normalizedInferredTitle.length === 0) return null;

  return existingTracks.find((track) => {
    const normalizedExistingTitle = normalizeTitleForMatch(track.title);
    if (normalizedExistingTitle.length === 0) return false;
    return (
      normalizedExistingTitle === normalizedInferredTitle
      || normalizedExistingTitle.includes(normalizedInferredTitle)
      || normalizedInferredTitle.includes(normalizedExistingTitle)
    );
  }) || null;
}

async function seedMusicLibraryRowsFromFilesystem(
  musicRootPath: string,
  scannedAudioFiles: ScannedMediaFile[],
): Promise<{ createdAlbums: number; createdTracks: number; updatedTracks: number }> {
  if (scannedAudioFiles.length === 0) {
    return { createdAlbums: 0, createdTracks: 0, updatedTracks: 0 };
  }

  const artistRows = await db
    .select({
      artistId: artists.id,
      title: media.title,
    })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id));

  if (artistRows.length === 0) {
    return { createdAlbums: 0, createdTracks: 0, updatedTracks: 0 };
  }

  const albumRows = await db
    .select({
      albumId: albums.id,
      artistId: albums.artistId,
      title: media.title,
    })
    .from(albums)
    .innerJoin(media, eq(albums.mediaId, media.id));

  const trackRows = await db
    .select({
      trackId: tracks.id,
      mediaId: tracks.mediaId,
      albumId: tracks.albumId,
      trackNumber: tracks.trackNumber,
      title: media.title,
      downloaded: tracks.downloaded,
      filePath: tracks.filePath,
    })
    .from(tracks)
    .innerJoin(media, eq(tracks.mediaId, media.id));

  const albumIdByKey = new Map<string, number>();
  for (const row of albumRows) {
    const normalizedAlbumTitle = normalizeTitleForMatch(row.title);
    if (normalizedAlbumTitle.length === 0) continue;
    albumIdByKey.set(`${row.artistId}:${normalizedAlbumTitle}`, row.albumId);
  }

  const tracksByAlbumId = new Map<number, ExistingTrackForSync[]>();
  for (const row of trackRows) {
    const existing = tracksByAlbumId.get(row.albumId);
    const mappedRow: ExistingTrackForSync = {
      trackId: row.trackId,
      mediaId: row.mediaId,
      trackNumber: typeof row.trackNumber === 'number' ? row.trackNumber : null,
      title: row.title,
      downloaded: row.downloaded,
      filePath: row.filePath,
    };
    if (existing) {
      existing.push(mappedRow);
    } else {
      tracksByAlbumId.set(row.albumId, [mappedRow]);
    }
  }

  const filesByDirectory = new Map<string, ScannedMediaFile[]>();
  for (const file of scannedAudioFiles) {
    const existing = filesByDirectory.get(file.directoryPath);
    if (existing) {
      existing.push(file);
    } else {
      filesByDirectory.set(file.directoryPath, [file]);
    }
  }

  let createdAlbums = 0;
  let createdTracks = 0;
  let updatedTracks = 0;

  for (const [directoryPath, albumFiles] of filesByDirectory.entries()) {
    if (albumFiles.length === 0) continue;

    const inferred = inferArtistAndAlbumForDirectory(musicRootPath, directoryPath);
    if (!inferred.albumTitle) continue;

    const matchedArtist = findBestMatchingArtist(inferred.artistCandidates, artistRows);
    if (!matchedArtist) continue;

    const normalizedAlbumTitle = normalizeTitleForMatch(inferred.albumTitle);
    if (normalizedAlbumTitle.length === 0) continue;

    const albumKey = `${matchedArtist.artistId}:${normalizedAlbumTitle}`;
    let albumId = albumIdByKey.get(albumKey);

    if (!albumId) {
      const mediaInsert = await db.insert(media).values({
        type: 'music',
        title: inferred.albumTitle,
      }).returning({ id: media.id });
      const albumMediaId = mediaInsert[0]?.id;
      if (!albumMediaId) continue;

      const releaseDate = typeof inferred.releaseYear === 'number'
        ? `${String(inferred.releaseYear)}-01-01`
        : undefined;

      const albumInsert = await db.insert(albums).values({
        artistId: matchedArtist.artistId,
        mediaId: albumMediaId,
        releaseDate,
        status: 'downloaded',
        path: directoryPath,
      }).returning({ id: albums.id });

      albumId = albumInsert[0]?.id;
      if (!albumId) continue;
      albumIdByKey.set(albumKey, albumId);
      tracksByAlbumId.set(albumId, []);
      createdAlbums += 1;
    }

    const existingAlbumTracks = tracksByAlbumId.get(albumId) || [];
    for (const file of albumFiles) {
      const matchedTrack = findExistingTrackForScannedFile(file, existingAlbumTracks);
      if (matchedTrack) {
        const hasDownloadedFlag = isEpisodeDownloadedValue(matchedTrack.downloaded);
        const hasMatchingPath = typeof matchedTrack.filePath === 'string' && matchedTrack.filePath.trim() === file.fullPath;
        if (!hasDownloadedFlag || !hasMatchingPath) {
          await db.update(tracks)
            .set({
              downloaded: true,
              filePath: file.fullPath,
            })
            .where(eq(tracks.id, matchedTrack.trackId))
            .run();
          matchedTrack.downloaded = true;
          matchedTrack.filePath = file.fullPath;
          updatedTracks += 1;
        }
        continue;
      }

      const inferredTrackTitle = parseTrackTitleFromFileName(file.fileName);
      const trackMediaInsert = await db.insert(media).values({
        type: 'music',
        title: inferredTrackTitle,
      }).returning({ id: media.id });
      const trackMediaId = trackMediaInsert[0]?.id;
      if (!trackMediaId) continue;

      const trackInsert = await db.insert(tracks).values({
        albumId,
        mediaId: trackMediaId,
        trackNumber: parseLeadingTrackNumber(file.fileName) ?? undefined,
        downloaded: true,
        filePath: file.fullPath,
      }).returning({ id: tracks.id });

      const trackId = trackInsert[0]?.id;
      if (!trackId) continue;

      const createdTrack: ExistingTrackForSync = {
        trackId,
        mediaId: trackMediaId,
        trackNumber: parseLeadingTrackNumber(file.fileName),
        title: inferredTrackTitle,
        downloaded: true,
        filePath: file.fullPath,
      };
      existingAlbumTracks.push(createdTrack);
      tracksByAlbumId.set(albumId, existingAlbumTracks);
      createdTracks += 1;
    }
  }

  return { createdAlbums, createdTracks, updatedTracks };
}

function findMatchingAudioFileForTrack(
  trackNumber: number | null,
  trackTitle: string,
  albumFiles: ScannedMediaFile[],
): ScannedMediaFile | null {
  if (trackNumber !== null) {
    const numberedFile = albumFiles.find((file) => parseLeadingTrackNumber(file.fileName) === trackNumber);
    if (numberedFile) return numberedFile;
  }

  const normalizedTrackTitle = normalizeTitleForMatch(trackTitle);
  if (normalizedTrackTitle.length > 0) {
    const titleMatchedFile = albumFiles.find((file) => {
      const normalizedFileStem = normalizeTitleForMatch(path.parse(file.fileName).name);
      if (normalizedFileStem.length === 0) return false;
      return (
        normalizedFileStem.includes(normalizedTrackTitle)
        || normalizedTrackTitle.includes(normalizedFileStem)
      );
    });
    if (titleMatchedFile) return titleMatchedFile;
  }

  return null;
}

async function syncMoviesFromFilesystem(): Promise<{ updatedCount: number }> {
  const now = Date.now();
  if (now - lastMoviesFilesystemSyncAt < LIBRARY_FILESYSTEM_SYNC_COOLDOWN_MS) {
    return { updatedCount: 0 };
  }
  lastMoviesFilesystemSyncAt = now;

  const configuredMoviesPath = await getSettingValue('media.movies.path');
  if (!configuredMoviesPath) return { updatedCount: 0 };

  const moviesRootPath = resolveConfiguredPath(configuredMoviesPath);
  const scannedMovieFiles = await collectMediaFiles(moviesRootPath, VIDEO_FILE_EXTENSIONS);

  const movieRows = await db
    .select({
      movieId: movies.id,
      title: media.title,
      status: movies.status,
      path: movies.path,
    })
    .from(movies)
    .innerJoin(media, eq(movies.mediaId, media.id));

  let updatedCount = 0;
  for (const movieRow of movieRows) {
    const normalizedTitle = normalizeTitleForMatch(movieRow.title);
    if (normalizedTitle.length === 0) continue;

    const matchedFile = scannedMovieFiles.find((file) => file.normalizedCandidate.includes(normalizedTitle));
    if (matchedFile) {
      const nextPath = matchedFile.directoryPath;
      if (movieRow.status === 'downloaded' && movieRow.path === nextPath) continue;

      await db.update(movies)
        .set({
          status: 'downloaded',
          path: nextPath,
        })
        .where(eq(movies.id, movieRow.movieId))
        .run();
      updatedCount += 1;
      continue;
    }

    if (movieRow.status !== 'downloaded') continue;

    await db.update(movies)
      .set({
        status: 'wanted',
        path: null,
      })
      .where(eq(movies.id, movieRow.movieId))
      .run();
    updatedCount += 1;
  }

  return { updatedCount };
}

async function syncMusicFromFilesystem(): Promise<{ updatedArtists: number; updatedAlbums: number; updatedTracks: number }> {
  const now = Date.now();
  if (now - lastMusicFilesystemSyncAt < LIBRARY_FILESYSTEM_SYNC_COOLDOWN_MS) {
    return { updatedArtists: 0, updatedAlbums: 0, updatedTracks: 0 };
  }
  lastMusicFilesystemSyncAt = now;

  const configuredMusicPath = await getSettingValue('media.music.path');
  if (!configuredMusicPath) {
    return { updatedArtists: 0, updatedAlbums: 0, updatedTracks: 0 };
  }

  const musicRootPath = resolveConfiguredPath(configuredMusicPath);
  const scannedAudioFiles = await collectMediaFiles(musicRootPath, AUDIO_FILE_EXTENSIONS);
  const seededRows = await seedMusicLibraryRowsFromFilesystem(musicRootPath, scannedAudioFiles);

  const artistRows = await db
    .select({
      artistId: artists.id,
      title: media.title,
      status: artists.status,
      path: artists.path,
    })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id));

  const albumRows = await db
    .select({
      albumId: albums.id,
      artistId: albums.artistId,
      albumTitle: media.title,
      status: albums.status,
      path: albums.path,
    })
    .from(albums)
    .innerJoin(media, eq(albums.mediaId, media.id));

  const trackRows = await db
    .select({
      trackId: tracks.id,
      albumId: tracks.albumId,
      trackNumber: tracks.trackNumber,
      trackTitle: media.title,
      downloaded: tracks.downloaded,
      filePath: tracks.filePath,
    })
    .from(tracks)
    .innerJoin(media, eq(tracks.mediaId, media.id));

  const artistTitleById = new Map<number, string>();
  for (const artistRow of artistRows) {
    artistTitleById.set(artistRow.artistId, artistRow.title);
  }

  const filesByDirectory = new Map<string, ScannedMediaFile[]>();
  for (const audioFile of scannedAudioFiles) {
    const existing = filesByDirectory.get(audioFile.directoryPath);
    if (existing) {
      existing.push(audioFile);
    } else {
      filesByDirectory.set(audioFile.directoryPath, [audioFile]);
    }
  }

  const albumDirectoryById = new Map<number, string>();
  const downloadedAlbumArtistIds = new Set<number>();
  const preferredArtistPathById = new Map<number, string>();

  let updatedAlbums = seededRows.createdAlbums;
  for (const albumRow of albumRows) {
    const artistTitle = artistTitleById.get(albumRow.artistId) || '';
    const normalizedAlbumTitle = normalizeTitleForMatch(albumRow.albumTitle);
    const normalizedArtistTitle = normalizeTitleForMatch(artistTitle);
    if (normalizedAlbumTitle.length === 0) continue;

    const primaryMatches = scannedAudioFiles.filter((file) => (
      normalizedContainsAllTokens(file.normalizedCandidate, normalizedAlbumTitle)
      && (
        normalizedArtistTitle.length === 0
        || normalizedContainsAllTokens(file.normalizedCandidate, normalizedArtistTitle)
      )
    ));

    const fallbackMatches = primaryMatches.length > 0
      ? primaryMatches
      : scannedAudioFiles.filter((file) => (
        normalizedContainsAllTokens(file.normalizedCandidate, normalizedAlbumTitle)
      ));

    if (fallbackMatches.length === 0) {
      if (albumRow.status === 'downloaded' || (typeof albumRow.path === 'string' && albumRow.path.trim().length > 0)) {
        await db.update(albums)
          .set({
            status: 'wanted',
            path: null,
          })
          .where(eq(albums.id, albumRow.albumId))
          .run();
        updatedAlbums += 1;
      }
      continue;
    }

    const directoryHitCounts = new Map<string, number>();
    for (const match of fallbackMatches) {
      directoryHitCounts.set(match.directoryPath, (directoryHitCounts.get(match.directoryPath) || 0) + 1);
    }

    const preferredDirectory = Array.from(directoryHitCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (!preferredDirectory) continue;

    albumDirectoryById.set(albumRow.albumId, preferredDirectory);
    downloadedAlbumArtistIds.add(albumRow.artistId);
    if (!preferredArtistPathById.has(albumRow.artistId)) {
      preferredArtistPathById.set(albumRow.artistId, path.dirname(preferredDirectory));
    }

    if (albumRow.status === 'downloaded' && albumRow.path === preferredDirectory) continue;

    await db.update(albums)
      .set({
        status: 'downloaded',
        path: preferredDirectory,
      })
      .where(eq(albums.id, albumRow.albumId))
      .run();
    updatedAlbums += 1;
  }

  let updatedTracks = seededRows.createdTracks + seededRows.updatedTracks;
  for (const trackRow of trackRows) {
    const albumDirectory = albumDirectoryById.get(trackRow.albumId);
    if (!albumDirectory) {
      const alreadyDownloaded = isEpisodeDownloadedValue(trackRow.downloaded);
      const hasStoredPath = typeof trackRow.filePath === 'string' && trackRow.filePath.trim().length > 0;
      if (!alreadyDownloaded && !hasStoredPath) continue;

      await db.update(tracks)
        .set({
          downloaded: false,
          filePath: null,
        })
        .where(eq(tracks.id, trackRow.trackId))
        .run();
      updatedTracks += 1;
      continue;
    }

    const albumFiles = filesByDirectory.get(albumDirectory) || [];
    if (albumFiles.length === 0) {
      const alreadyDownloaded = isEpisodeDownloadedValue(trackRow.downloaded);
      const hasStoredPath = typeof trackRow.filePath === 'string' && trackRow.filePath.trim().length > 0;
      if (!alreadyDownloaded && !hasStoredPath) continue;

      await db.update(tracks)
        .set({
          downloaded: false,
          filePath: null,
        })
        .where(eq(tracks.id, trackRow.trackId))
        .run();
      updatedTracks += 1;
      continue;
    }

    const trackNumber = typeof trackRow.trackNumber === 'number' ? trackRow.trackNumber : null;
    const matchedFile = findMatchingAudioFileForTrack(trackNumber, trackRow.trackTitle, albumFiles);
    if (!matchedFile) {
      const alreadyDownloaded = isEpisodeDownloadedValue(trackRow.downloaded);
      const hasStoredPath = typeof trackRow.filePath === 'string' && trackRow.filePath.trim().length > 0;
      if (!alreadyDownloaded && !hasStoredPath) continue;

      await db.update(tracks)
        .set({
          downloaded: false,
          filePath: null,
        })
        .where(eq(tracks.id, trackRow.trackId))
        .run();
      updatedTracks += 1;
      continue;
    }

    const alreadyDownloaded = isEpisodeDownloadedValue(trackRow.downloaded);
    const hasMatchingPath = typeof trackRow.filePath === 'string' && trackRow.filePath.trim() === matchedFile.fullPath;
    if (alreadyDownloaded && hasMatchingPath) continue;

    await db.update(tracks)
      .set({
        downloaded: true,
        filePath: matchedFile.fullPath,
      })
      .where(eq(tracks.id, trackRow.trackId))
      .run();
    updatedTracks += 1;
  }

  let updatedArtists = 0;
  for (const artistRow of artistRows) {
    if (!downloadedAlbumArtistIds.has(artistRow.artistId)) {
      if (artistRow.status !== 'downloaded') continue;

      await db.update(artists)
        .set({
          status: 'wanted',
          path: null,
        })
        .where(eq(artists.id, artistRow.artistId))
        .run();
      updatedArtists += 1;
      continue;
    }

    const preferredPath = preferredArtistPathById.get(artistRow.artistId);
    const hasMatchingPath = typeof preferredPath === 'string' && preferredPath.length > 0 && artistRow.path === preferredPath;
    if (artistRow.status === 'downloaded' && (hasMatchingPath || !preferredPath)) continue;

    await db.update(artists)
      .set({
        status: 'downloaded',
        path: preferredPath || artistRow.path || undefined,
      })
      .where(eq(artists.id, artistRow.artistId))
      .run();
    updatedArtists += 1;
  }

  return { updatedArtists, updatedAlbums, updatedTracks };
}

function getContentTypeForMediaFile(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.mp4':
      return 'video/mp4';
    case '.mkv':
      return 'video/x-matroska';
    case '.mp3':
      return 'audio/mpeg';
    case '.flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}

function getContentTypeForImageFile(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function isAbsoluteOrRelativeFilePath(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function isExistingFile(filePath: string): Promise<boolean> {
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile();
  } catch {
    return false;
  }
}

async function isExistingDirectory(directoryPath: string): Promise<boolean> {
  try {
    const directoryStats = await stat(directoryPath);
    return directoryStats.isDirectory();
  } catch {
    return false;
  }
}

function scoreArtworkFileName(fileName: string): number {
  const stem = path.parse(fileName).name.toLowerCase();
  if (!stem) return 0;

  for (let index = 0; index < ALBUM_ARTWORK_PRIORITY_NAMES.length; index += 1) {
    if (stem === ALBUM_ARTWORK_PRIORITY_NAMES[index]) {
      return 100 - (index * 8);
    }
  }

  if (stem.includes('cover')) return 70;
  if (stem.includes('front')) return 64;
  if (stem.includes('folder')) return 62;
  if (stem.includes('art')) return 55;
  return 20;
}

async function findAlbumArtworkFile(directoryPath: string): Promise<string | null> {
  let entries: Array<Dirent<string>>;
  try {
    entries = await readdir(directoryPath, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return null;
  }

  const imageFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => String(entry.name))
    .filter((name) => IMAGE_FILE_EXTENSIONS.has(path.extname(name).toLowerCase()));

  if (imageFiles.length === 0) return null;

  const bestMatch = imageFiles
    .map((name) => ({ name, score: scoreArtworkFileName(name) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0];

  if (!bestMatch) return null;
  return path.join(directoryPath, bestMatch.name);
}

async function resolveAlbumArtworkFileByMediaId(mediaId: number): Promise<string | null> {
  const albumResult = await db
    .select({ path: albums.path })
    .from(albums)
    .where(eq(albums.mediaId, mediaId))
    .limit(1);

  const rawAlbumPath = albumResult[0]?.path;
  if (!isAbsoluteOrRelativeFilePath(rawAlbumPath)) return null;

  const albumDirectory = resolveConfiguredPath(rawAlbumPath.trim());
  if (!(await isExistingDirectory(albumDirectory))) return null;

  const artworkPath = await findAlbumArtworkFile(albumDirectory);
  if (!artworkPath) return null;
  if (!(await isExistingFile(artworkPath))) return null;
  return artworkPath;
}

function isPlayableFile(filePath: string, allowedExtensions: Set<string>): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return allowedExtensions.has(extension);
}

function sanitizeFileSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

interface ProcessRunResult {
  success: boolean;
  stderr: string;
}

async function runProcessCommand(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<ProcessRunResult> {
  return new Promise((resolve) => {
    let settled = false;
    let stderrOutput = '';

    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const settle = (result: ProcessRunResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timeoutHandle = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // no-op
      }
      settle({ success: false, stderr: 'Timed out while running external command.' });
    }, timeoutMs);

    child.stderr?.on('data', (chunk) => {
      if (stderrOutput.length >= 3000) return;
      stderrOutput += String(chunk);
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      settle({ success: false, stderr: error instanceof Error ? error.message : 'Command execution failed.' });
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const cleaned = stderrOutput.trim();
      settle({ success: code === 0, stderr: cleaned });
    });
  });
}

async function resolveFfmpegBinaryPath(): Promise<string | null> {
  if (ffmpegBinaryPathCache !== undefined) {
    return ffmpegBinaryPathCache;
  }

  const candidates = [
    process.env.SOLARI_FFMPEG_PATH,
    process.env.FFMPEG_PATH,
    ffmpegStaticBinaryPath,
    'ffmpeg',
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  for (const candidate of candidates) {
    const result = await runProcessCommand(candidate, ['-version'], 10_000);
    if (result.success) {
      ffmpegBinaryPathCache = candidate;
      return candidate;
    }
  }

  ffmpegBinaryPathCache = null;
  return null;
}

function parseDurationSecondsFromFfmpegOutput(stderrOutput: string): number | null {
  const match = stderrOutput.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!match) return null;
  const hours = Number.parseInt(match[1] || '0', 10);
  const minutes = Number.parseInt(match[2] || '0', 10);
  const seconds = Number.parseFloat(match[3] || '0');
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  const total = (hours * 3600) + (minutes * 60) + seconds;
  if (!Number.isFinite(total) || total <= 0) return null;
  return total;
}

async function probeMediaDurationSeconds(filePath: string): Promise<number | null> {
  const ffmpegBinary = await resolveFfmpegBinaryPath();
  if (!ffmpegBinary) return null;

  let fileStats: Awaited<ReturnType<typeof stat>>;
  try {
    fileStats = await stat(filePath);
  } catch {
    return null;
  }
  if (!fileStats.isFile()) return null;

  const cacheKey = `${filePath}|${fileStats.size}|${Math.floor(fileStats.mtimeMs)}`;
  const cached = mediaDurationCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.durationSeconds;
  }

  const probe = await runProcessCommand(
    ffmpegBinary,
    [
      '-hide_banner',
      '-nostdin',
      '-i', filePath,
    ],
    10_000,
  );

  const parsedDuration = parseDurationSecondsFromFfmpegOutput(probe.stderr);
  if (typeof parsedDuration === 'number' && parsedDuration > 0) {
    mediaDurationCache.set(cacheKey, {
      durationSeconds: parsedDuration,
      expiresAt: now + MEDIA_DURATION_CACHE_TTL_MS,
    });
    return parsedDuration;
  }

  return null;
}

function isMkvFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.mkv';
}

async function startFfmpegCompatibilityStream(
  c: Context,
  ffmpegBinary: string,
  filePath: string,
  args: string[],
): Promise<{ response?: Response; error?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let didStartStreaming = false;
    let stderrOutput = '';

    const settle = (result: { response?: Response; error?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = spawn(ffmpegBinary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const streamOutput = new PassThrough();
    const requestSignal = c.req.raw.signal;

    const cleanup = () => {
      if (requestSignal) {
        requestSignal.removeEventListener('abort', handleAbort);
      }
      clearTimeout(startupTimeoutHandle);
    };

    const terminateChild = () => {
      if (child.killed) return;
      try {
        child.kill('SIGKILL');
      } catch {
        // no-op
      }
    };

    const handleAbort = () => {
      terminateChild();
      streamOutput.end();
    };

    if (requestSignal) {
      if (requestSignal.aborted) {
        settle({ error: 'Playback request was aborted.' });
        return;
      }
      requestSignal.addEventListener('abort', handleAbort, { once: true });
    }

    const startupTimeoutHandle = setTimeout(() => {
      if (didStartStreaming) return;
      terminateChild();
      cleanup();
      settle({ error: 'Compatibility stream startup timed out.' });
    }, MKV_COMPAT_STREAM_START_TIMEOUT_MS);

    child.stderr?.on('data', (chunk) => {
      if (stderrOutput.length >= 4000) return;
      stderrOutput += String(chunk);
    });

    child.on('error', (error) => {
      streamOutput.end();
      cleanup();
      if (didStartStreaming) return;
      const message = error instanceof Error ? error.message : 'Failed to start compatibility stream.';
      settle({ error: message });
    });

    child.on('close', (code) => {
      streamOutput.end();
      cleanup();
      if (didStartStreaming) return;
      const ffmpegError = stderrOutput.trim();
      const message = ffmpegError.length > 0
        ? ffmpegError
        : `Compatibility stream exited before playback started (code ${String(code ?? 'unknown')}).`;
      settle({ error: message });
    });

    child.stdout?.once('data', (firstChunk) => {
      didStartStreaming = true;
      cleanup();

      streamOutput.write(firstChunk);
      child.stdout?.pipe(streamOutput);

      const headers = new Headers({
        'Cache-Control': 'no-store',
        'Content-Type': 'video/mp4',
        'X-Content-Type-Options': 'nosniff',
      });
      const webStream = Readable.toWeb(streamOutput) as ReadableStream;
      settle({ response: new Response(webStream, { status: 200, headers }) });
    });

    if (!child.stdout) {
      terminateChild();
      cleanup();
      settle({ error: 'Compatibility stream unavailable (no output stream).' });
    }

    console.info(`[playback] Starting MKV compatibility stream for ${filePath}`);
  });
}

async function buildMkvCompatibilityStreamResponse(c: Context, filePath: string): Promise<Response> {
  const ffmpegBinary = await resolveFfmpegBinaryPath();
  if (!ffmpegBinary) {
    return c.json({ error: 'MKV compatibility stream unavailable: ffmpeg is not configured.' }, 500);
  }

  const requestedStartRaw = c.req.query('start');
  const parsedRequestedStart = requestedStartRaw ? Number.parseFloat(requestedStartRaw) : 0;
  const startSeconds = Number.isFinite(parsedRequestedStart) && parsedRequestedStart > 0
    ? parsedRequestedStart
    : 0;
  const inputArgs = startSeconds > 0
    ? ['-ss', String(startSeconds), '-i', filePath]
    : ['-i', filePath];

  const outputArgs = [
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-dn',
    '-sn',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1',
  ];

  const copyVideoArgs = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    ...inputArgs,
    '-c:v', 'copy',
    ...outputArgs,
  ];

  const copyVideoAttempt = await startFfmpegCompatibilityStream(c, ffmpegBinary, filePath, copyVideoArgs);
  if (copyVideoAttempt.response) return copyVideoAttempt.response;

  const transcodeVideoAttempt = await startFfmpegCompatibilityStream(c, ffmpegBinary, filePath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    ...inputArgs,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    ...outputArgs,
  ]);
  if (transcodeVideoAttempt.response) return transcodeVideoAttempt.response;

  console.warn(
    `[playback] MKV compatibility streaming failed for ${filePath}. ` +
    `copy attempt: ${copyVideoAttempt.error || 'unknown'}; transcode attempt: ${transcodeVideoAttempt.error || 'unknown'}`,
  );

  return c.json({
    error: 'Could not start MKV compatibility stream. Try "Open in system player".',
  }, 500);
}

async function findPlayableFileInDirectory(
  directoryPath: string,
  allowedExtensions: Set<string>,
  titleHint: string,
): Promise<string | null> {
  const normalizedTitleHint = normalizeTitleForMatch(titleHint);
  let entries: Array<Dirent<string>>;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return null;
  }

  const directFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directoryPath, String(entry.name)))
    .filter((candidatePath) => isPlayableFile(candidatePath, allowedExtensions));

  const exactHintMatch = directFiles.find((candidatePath) => (
    normalizedTitleHint.length > 0
      && normalizeTitleForMatch(path.basename(candidatePath)).includes(normalizedTitleHint)
  ));
  if (exactHintMatch) return exactHintMatch;

  if (directFiles.length > 0) return directFiles[0];

  const scannedFiles = await collectMediaFiles(directoryPath, allowedExtensions);
  if (scannedFiles.length === 0) return null;

  const hintedMatch = scannedFiles.find((candidate) => (
    normalizedTitleHint.length > 0 && candidate.normalizedCandidate.includes(normalizedTitleHint)
  ));
  if (hintedMatch) return hintedMatch.fullPath;

  return scannedFiles[0]?.fullPath || null;
}

async function resolveMoviePlaybackFile(mediaId: number): Promise<string | null> {
  const movieResult = await db
    .select({
      title: media.title,
      storedPath: movies.path,
    })
    .from(movies)
    .innerJoin(media, eq(movies.mediaId, media.id))
    .where(eq(media.id, mediaId))
    .limit(1);

  const movieRow = movieResult[0];
  if (!movieRow) return null;

  const titleHint = movieRow.title || '';
  if (isAbsoluteOrRelativeFilePath(movieRow.storedPath)) {
    const resolvedPath = resolveConfiguredPath(movieRow.storedPath.trim());
    if (await isExistingFile(resolvedPath) && isPlayableFile(resolvedPath, PLAYABLE_VIDEO_EXTENSIONS)) {
      return resolvedPath;
    }

    if (await isExistingDirectory(resolvedPath)) {
      const matchedFromDirectory = await findPlayableFileInDirectory(
        resolvedPath,
        PLAYABLE_VIDEO_EXTENSIONS,
        titleHint,
      );
      if (matchedFromDirectory) return matchedFromDirectory;
    }
  }

  const configuredMoviesPath = await getSettingValue('media.movies.path');
  if (!configuredMoviesPath) return null;

  const moviesRootPath = resolveConfiguredPath(configuredMoviesPath);
  if (!(await isExistingDirectory(moviesRootPath))) return null;

  const scannedFiles = await collectMediaFiles(moviesRootPath, PLAYABLE_VIDEO_EXTENSIONS);
  if (scannedFiles.length === 0) return null;

  const normalizedTitle = normalizeTitleForMatch(titleHint);
  const matched = scannedFiles.find((candidate) => (
    normalizedTitle.length > 0 && candidate.normalizedCandidate.includes(normalizedTitle)
  ));

  return matched?.fullPath || null;
}

async function resolveEpisodePlaybackFile(episodeId: number): Promise<string | null> {
  const result = await db
    .select({
      filePath: episodes.filePath,
    })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  const rawPath = result[0]?.filePath;
  if (!isAbsoluteOrRelativeFilePath(rawPath)) return null;

  const resolvedPath = resolveConfiguredPath(rawPath.trim());
  if (!(await isExistingFile(resolvedPath))) return null;
  if (!isPlayableFile(resolvedPath, PLAYABLE_VIDEO_EXTENSIONS)) return null;
  return resolvedPath;
}

async function resolveTrackPlaybackFile(trackId: number): Promise<string | null> {
  const result = await db
    .select({
      filePath: tracks.filePath,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  const rawPath = result[0]?.filePath;
  if (!isAbsoluteOrRelativeFilePath(rawPath)) return null;

  const resolvedPath = resolveConfiguredPath(rawPath.trim());
  if (!(await isExistingFile(resolvedPath))) return null;
  if (!isPlayableFile(resolvedPath, PLAYABLE_AUDIO_EXTENSIONS)) return null;
  return resolvedPath;
}

function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const normalizedHeader = rangeHeader.trim();
  if (!normalizedHeader.toLowerCase().startsWith('bytes=')) return null;

  // Some clients send multiple ranges (e.g. "bytes=0-1, 10-11"). We serve the first range.
  const firstRangeSpec = normalizedHeader.slice(6).split(',')[0]?.trim();
  if (!firstRangeSpec) return null;

  const separatorIndex = firstRangeSpec.indexOf('-');
  if (separatorIndex < 0) return null;

  const startValue = firstRangeSpec.slice(0, separatorIndex).trim();
  const endValue = firstRangeSpec.slice(separatorIndex + 1).trim();
  if (startValue.length === 0 && endValue.length === 0) return null;

  if (startValue.length === 0) {
    const suffixLength = Number.parseInt(endValue, 10);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(0, fileSize - suffixLength);
    return { start, end: fileSize - 1 };
  }

  const parsedStart = Number.parseInt(startValue, 10);
  if (!Number.isInteger(parsedStart) || parsedStart < 0 || parsedStart >= fileSize) return null;

  if (endValue.length === 0) {
    return { start: parsedStart, end: fileSize - 1 };
  }

  const parsedEnd = Number.parseInt(endValue, 10);
  if (!Number.isInteger(parsedEnd) || parsedEnd < parsedStart) return null;

  return { start: parsedStart, end: Math.min(parsedEnd, fileSize - 1) };
}

async function buildPlaybackStreamResponse(
  c: Context,
  filePath: string,
): Promise<Response> {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    return c.json({ error: 'Playback target is not a file' }, 404);
  }

  const fileSize = fileStats.size;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Content-Type': getContentTypeForMediaFile(filePath),
    'X-Content-Type-Options': 'nosniff',
  });

  const rangeHeader = c.req.header('range');
  if (rangeHeader && rangeHeader.trim().length > 0) {
    const parsedRange = parseRangeHeader(rangeHeader, fileSize);
    if (!parsedRange) {
      headers.set('Content-Range', `bytes */${fileSize}`);
      return new Response(null, { status: 416, headers });
    }

    const { start, end } = parsedRange;
    const contentLength = end - start + 1;
    headers.set('Content-Length', String(contentLength));
    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);

    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new Response(webStream, { status: 206, headers });
  }

  headers.set('Content-Length', String(fileSize));
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return new Response(webStream, { status: 200, headers });
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
  tmdbId: z.number().int().positive().optional(),
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

const playbackProgressUpdateSchema = z.object({
  mediaKind: z.enum(['movie', 'episode', 'track']),
  mediaId: z.number().int().positive(),
  positionSeconds: z.number().finite().min(0),
  durationSeconds: z.number().finite().min(0).optional(),
  completed: z.boolean().optional(),
});

// Get all movies
mediaRoutes.get('/movies', async (c) => {
  try {
    await syncMoviesFromFilesystem();
  } catch {
    // Filesystem sync should never block movie listing responses.
  }

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
  try {
    await syncMoviesFromFilesystem();
  } catch {
    // Keep movie details resilient even if filesystem sync fails.
  }

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

  let episodesResult = await db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesRecordId))
    .orderBy(episodes.season, episodes.episode);

  let resolvedTvdbId = seriesPayload.tvdbId ?? null;
  if (episodesResult.length === 0) {
    try {
      const backfillResult = await backfillSeriesEpisodesFromTmdb(
        seriesRecordId,
        seriesPayload.title,
        seriesPayload.releaseDate,
        seriesPayload.tvdbId,
      );

      resolvedTvdbId = backfillResult.resolvedTvdbId;
      if (backfillResult.insertedCount > 0) {
        episodesResult = await db
          .select()
          .from(episodes)
          .where(eq(episodes.seriesId, seriesRecordId))
          .orderBy(episodes.season, episodes.episode);
      }
    } catch {
      // Keep this endpoint resilient; fallback to stored data.
    }
  }

  try {
    const filesystemSync = await syncSeriesEpisodesFromFilesystem(
      seriesRecordId,
      seriesPayload.title,
      seriesPayload.path,
    );
    if (filesystemSync.updatedCount > 0) {
      episodesResult = await db
        .select()
        .from(episodes)
        .where(eq(episodes.seriesId, seriesRecordId))
        .orderBy(episodes.season, episodes.episode);
    }
  } catch {
    // Filesystem sync should never break TV details rendering.
  }

  return c.json({
    ...seriesPayload,
    tvdbId: resolvedTvdbId,
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

  const created = db.transaction((tx) => {
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

    const seriesResult = tx.insert(series).values({
      mediaId: createdMediaId,
      releaseDate: data.releaseDate,
      tvdbId: data.tvdbId,
      qualityProfileId: data.qualityProfileId,
      status: 'wanted',
    }).returning({ id: series.id }).get();

    if (!seriesResult) throw new Error('Failed to create series row');

    return {
      mediaId: createdMediaId,
      seriesRecordId: seriesResult.id,
    };
  });

  if (typeof data.tmdbId === 'number') {
    try {
      const tmdbMetadata = await resolveTmdbSeriesMetadata(data.tmdbId, data.tvdbId);

      if (typeof tmdbMetadata.tvdbId === 'number' && tmdbMetadata.tvdbId > 0) {
        await db.update(series)
          .set({ tvdbId: tmdbMetadata.tvdbId })
          .where(eq(series.id, created.seriesRecordId))
          .run();
      }

      await insertEpisodeSeeds(created.seriesRecordId, tmdbMetadata.episodeSeeds);
    } catch {
      // Keep series creation resilient even when TMDB enrichment fails.
    }
  }

  return c.json({ id: created.mediaId, message: 'Series added' }, 201);
});

// Get all artists
mediaRoutes.get('/music/artists', async (c) => {
  try {
    await syncMusicFromFilesystem();
  } catch {
    // Filesystem sync should never block artist listing responses.
  }

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
  try {
    await syncMusicFromFilesystem();
  } catch {
    // Keep artist details resilient even if filesystem sync fails.
  }

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
  try {
    await syncMusicFromFilesystem();
  } catch {
    // Keep album details resilient even if filesystem sync fails.
  }

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
    .select({
      id: tracks.id,
      trackNumber: tracks.trackNumber,
      duration: tracks.duration,
      downloaded: tracks.downloaded,
      filePath: tracks.filePath,
      title: media.title,
    })
    .from(tracks)
    .innerJoin(media, eq(tracks.mediaId, media.id))
    .where(eq(tracks.albumId, albumRecordId))
    .orderBy(tracks.trackNumber);

  return c.json({
    ...albumPayload,
    tracks: tracksResult,
  });
});

// Get locally playable media options for player queue additions
mediaRoutes.get('/playback/library', async (c) => {
  interface PlaybackLibraryItem {
    id: string;
    mediaId: number;
    mediaType: 'video' | 'audio';
    mediaKind: 'movie' | 'episode' | 'track';
    title: string;
    subtitle?: string;
    streamUrl: string;
    artworkUrl?: string;
  }

  try {
    await Promise.all([
      syncMoviesFromFilesystem(),
      syncMusicFromFilesystem(),
    ]);
  } catch {
    // Keep playback library listing resilient even if filesystem sync fails.
  }

  const formatSeasonEpisodeCode = (seasonNumber: number, episodeNumber: number): string => {
    const safeSeason = Math.max(0, seasonNumber);
    const safeEpisode = Math.max(0, episodeNumber);
    return `S${String(safeSeason).padStart(2, '0')}E${String(safeEpisode).padStart(2, '0')}`;
  };

  const movieRows = await db
    .select({
      mediaId: media.id,
      title: media.title,
      releaseDate: movies.releaseDate,
    })
    .from(movies)
    .innerJoin(media, eq(movies.mediaId, media.id))
    .where(eq(movies.status, 'downloaded'))
    .orderBy(media.title);

  const seriesRows = await db
    .select({
      seriesId: series.id,
      title: media.title,
    })
    .from(series)
    .innerJoin(media, eq(series.mediaId, media.id));

  const seriesTitles = new Map<number, string>();
  for (const row of seriesRows) {
    seriesTitles.set(row.seriesId, row.title);
  }

  const episodeRows = await db
    .select({
      id: episodes.id,
      seriesId: episodes.seriesId,
      season: episodes.season,
      episode: episodes.episode,
      title: episodes.title,
      filePath: episodes.filePath,
    })
    .from(episodes)
    .where(eq(episodes.downloaded, true))
    .orderBy(episodes.seriesId, episodes.season, episodes.episode);

  const artistRows = await db
    .select({
      artistId: artists.id,
      title: media.title,
    })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id));

  const artistTitles = new Map<number, string>();
  for (const row of artistRows) {
    artistTitles.set(row.artistId, row.title);
  }

  const albumRows = await db
    .select({
      albumId: albums.id,
      albumMediaId: albums.mediaId,
      artistId: albums.artistId,
      title: media.title,
    })
    .from(albums)
    .innerJoin(media, eq(albums.mediaId, media.id));

  const albumMeta = new Map<number, { title: string; artistId: number; albumMediaId: number }>();
  for (const row of albumRows) {
    albumMeta.set(row.albumId, {
      title: row.title,
      artistId: row.artistId,
      albumMediaId: row.albumMediaId,
    });
  }

  const trackRows = await db
    .select({
      id: tracks.id,
      albumId: tracks.albumId,
      trackNumber: tracks.trackNumber,
      title: media.title,
      filePath: tracks.filePath,
    })
    .from(tracks)
    .innerJoin(media, eq(tracks.mediaId, media.id))
    .where(eq(tracks.downloaded, true))
    .orderBy(tracks.albumId, tracks.trackNumber, media.title);

  const items: PlaybackLibraryItem[] = [];

  for (const row of movieRows) {
    items.push({
      id: `movie-${row.mediaId}`,
      mediaId: row.mediaId,
      mediaType: 'video',
      mediaKind: 'movie',
      title: row.title,
      subtitle: row.releaseDate || undefined,
      streamUrl: `/api/media/playback/video-compat/movie/${row.mediaId}`,
    });
  }

  for (const row of episodeRows) {
    if (!isAbsoluteOrRelativeFilePath(row.filePath)) continue;
    const extension = path.extname(row.filePath).toLowerCase();
    if (!PLAYABLE_VIDEO_EXTENSIONS.has(extension)) continue;

    const code = formatSeasonEpisodeCode(row.season, row.episode);
    const episodeTitle = row.title?.trim() || `Episode ${row.episode}`;
    items.push({
      id: `episode-${row.id}`,
      mediaId: row.id,
      mediaType: 'video',
      mediaKind: 'episode',
      title: `${code} - ${episodeTitle}`,
      subtitle: seriesTitles.get(row.seriesId) || 'TV Series',
      streamUrl: `/api/media/playback/video-compat/episode/${row.id}`,
    });
  }

  for (const row of trackRows) {
    if (!isAbsoluteOrRelativeFilePath(row.filePath)) continue;
    const extension = path.extname(row.filePath).toLowerCase();
    if (!PLAYABLE_AUDIO_EXTENSIONS.has(extension)) continue;

    const album = albumMeta.get(row.albumId);
    const artistTitle = album ? artistTitles.get(album.artistId) : undefined;
    const trackLabel = row.title?.trim() || (
      typeof row.trackNumber === 'number'
        ? `Track ${row.trackNumber}`
        : `Track ${row.id}`
    );
    items.push({
      id: `track-${row.id}`,
      mediaId: row.id,
      mediaType: 'audio',
      mediaKind: 'track',
      title: trackLabel,
      subtitle: album
        ? `${artistTitle || 'Artist'} - ${album.title}`
        : artistTitle || undefined,
      streamUrl: `/api/media/playback/audio/track/${row.id}`,
      artworkUrl: album ? `/api/media/playback/artwork/album/${album.albumMediaId}` : undefined,
    });
  }

  return c.json({ items });
});

// Stream album artwork (if available) for audio player
mediaRoutes.get('/playback/artwork/album/:id', async (c) => {
  const mediaId = parseIdParam(c.req.param('id'));
  if (mediaId === null) return c.json({ error: 'Invalid album id' }, 400);

  try {
    const artworkFilePath = await resolveAlbumArtworkFileByMediaId(mediaId);
    if (!artworkFilePath) return c.json({ error: 'No album artwork found' }, 404);

    const artworkStats = await stat(artworkFilePath);
    if (!artworkStats.isFile()) return c.json({ error: 'No album artwork found' }, 404);

    const headers = new Headers({
      'Content-Type': getContentTypeForImageFile(artworkFilePath),
      'Content-Length': String(artworkStats.size),
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });

    const nodeStream = createReadStream(artworkFilePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new Response(webStream, { status: 200, headers });
  } catch {
    return c.json({ error: 'Failed to load album artwork' }, 500);
  }
});

// Get playback resume progress for a media item
mediaRoutes.get('/playback/progress/:kind/:id', async (c) => {
  const kind = c.req.param('kind');
  const mediaId = parseIdParam(c.req.param('id'));
  if (!isPlaybackMediaKind(kind)) return c.json({ error: 'Invalid media kind' }, 400);
  if (mediaId === null) return c.json({ error: 'Invalid media id' }, 400);

  try {
    const progressMap = await readPlaybackProgressMap();
    const entry = progressMap[buildPlaybackProgressKey(kind, mediaId)] || null;
    let inferredDurationSeconds: number | null = null;

    if (kind === 'movie' || kind === 'episode') {
      const needsDuration = !entry || typeof entry.durationSeconds !== 'number' || entry.durationSeconds <= 0;
      if (needsDuration) {
        const filePath = kind === 'movie'
          ? await resolveMoviePlaybackFile(mediaId)
          : await resolveEpisodePlaybackFile(mediaId);
        if (filePath) {
          inferredDurationSeconds = await probeMediaDurationSeconds(filePath);
        }
      }
    }

    return c.json({ entry, inferredDurationSeconds });
  } catch {
    return c.json({ entry: null, inferredDurationSeconds: null });
  }
});

// Update playback resume progress for a media item
mediaRoutes.put('/playback/progress', async (c) => {
  const body = await c.req.json();
  const data = playbackProgressUpdateSchema.parse(body);
  const now = Date.now();
  const progressKey = buildPlaybackProgressKey(data.mediaKind, data.mediaId);
  const progressMap = await readPlaybackProgressMap();
  const existingEntry = progressMap[progressKey];
  const existingDuration = typeof existingEntry?.durationSeconds === 'number' && existingEntry.durationSeconds > 0
    ? existingEntry.durationSeconds
    : undefined;
  const normalizedExistingDuration = (
    data.mediaKind !== 'track'
    && typeof existingDuration === 'number'
    && existingDuration < 120
  )
    ? undefined
    : existingDuration;

  const incomingDuration = typeof data.durationSeconds === 'number' && data.durationSeconds > 0
    ? data.durationSeconds
    : undefined;
  const reliableIncomingDuration = incomingDuration !== undefined && (
    data.mediaKind === 'track' || incomingDuration >= 120
  );

  let durationSeconds: number | undefined = reliableIncomingDuration
    ? incomingDuration
    : normalizedExistingDuration;

  // Compatibility streams can occasionally report short bogus durations (e.g. ~60s).
  // For long-form video, keep the larger existing duration instead of shrinking aggressively.
  if (
    data.mediaKind !== 'track'
    && reliableIncomingDuration
    && typeof normalizedExistingDuration === 'number'
    && incomingDuration! < Math.max(120, normalizedExistingDuration * 0.6)
  ) {
    durationSeconds = normalizedExistingDuration;
  }

  const positionSeconds = durationSeconds !== undefined
    ? Math.max(0, Math.min(data.positionSeconds, durationSeconds))
    : Math.max(0, data.positionSeconds);
  const isNearEnd = durationSeconds !== undefined && positionSeconds >= Math.max(0, durationSeconds - 3);
  const shouldClear = Boolean(data.completed) || isNearEnd;

  if (shouldClear) {
    if (progressMap[progressKey]) {
      delete progressMap[progressKey];
      await writePlaybackProgressMap(progressMap);
    }
    return c.json({ cleared: true, entry: null });
  }

  if (positionSeconds < 1) {
    return c.json({ cleared: false, entry: null });
  }

  const entry: PlaybackProgressEntry = {
    mediaKind: data.mediaKind,
    mediaId: data.mediaId,
    positionSeconds,
    durationSeconds,
    updatedAt: now,
  };

  progressMap[progressKey] = entry;
  await writePlaybackProgressMap(progressMap);
  return c.json({ cleared: false, entry });
});

// Stream movie playback
mediaRoutes.get('/playback/video/movie/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid movie id' }, 400);

  try {
    const filePath = await resolveMoviePlaybackFile(id);
    if (!filePath) return c.json({ error: 'No playable movie file found' }, 404);
    if (isMkvFile(filePath)) {
      return await buildMkvCompatibilityStreamResponse(c, filePath);
    }
    return await buildPlaybackStreamResponse(c, filePath);
  } catch {
    return c.json({ error: 'Failed to stream movie' }, 500);
  }
});

// Stream episode playback
mediaRoutes.get('/playback/video/episode/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid episode id' }, 400);

  try {
    const filePath = await resolveEpisodePlaybackFile(id);
    if (!filePath) return c.json({ error: 'No playable episode file found' }, 404);
    if (isMkvFile(filePath)) {
      return await buildMkvCompatibilityStreamResponse(c, filePath);
    }
    return await buildPlaybackStreamResponse(c, filePath);
  } catch {
    return c.json({ error: 'Failed to stream episode' }, 500);
  }
});

// Explicit MKV compatibility stream route for movie playback
mediaRoutes.get('/playback/video-compat/movie/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid movie id' }, 400);

  try {
    const filePath = await resolveMoviePlaybackFile(id);
    if (!filePath) return c.json({ error: 'No playable movie file found' }, 404);
    if (!isMkvFile(filePath)) {
      return await buildPlaybackStreamResponse(c, filePath);
    }
    return await buildMkvCompatibilityStreamResponse(c, filePath);
  } catch {
    return c.json({ error: 'Failed to stream movie compatibility playback' }, 500);
  }
});

// Explicit MKV compatibility stream route for episode playback
mediaRoutes.get('/playback/video-compat/episode/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid episode id' }, 400);

  try {
    const filePath = await resolveEpisodePlaybackFile(id);
    if (!filePath) return c.json({ error: 'No playable episode file found' }, 404);
    if (!isMkvFile(filePath)) {
      return await buildPlaybackStreamResponse(c, filePath);
    }
    return await buildMkvCompatibilityStreamResponse(c, filePath);
  } catch {
    return c.json({ error: 'Failed to stream episode compatibility playback' }, 500);
  }
});

async function openFileInSystemPlayer(filePath: string): Promise<{ ok: boolean; error?: string }> {
  const platform = process.platform;
  let command = '';
  let args: string[] = [];

  if (platform === 'win32') {
    const escapedPath = filePath.replace(/'/g, "''");
    command = 'powershell.exe';
    args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `Start-Process -LiteralPath '${escapedPath}'`,
    ];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [filePath];
  } else {
    command = 'xdg-open';
    args = [filePath];
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });

      child.once('error', (error) => {
        const message = error instanceof Error ? error.message : 'Failed to launch system player.';
        settle({ ok: false, error: message });
      });
      child.once('spawn', () => {
        child.unref();
        settle({ ok: true });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to launch system player.';
      settle({ ok: false, error: message });
    }
  });
}

// Open current media file in system player as manual playback fallback
mediaRoutes.post('/playback/open-external/:kind/:id', async (c) => {
  const kind = c.req.param('kind');
  const id = parseIdParam(c.req.param('id'));
  if (!isPlaybackMediaKind(kind)) return c.json({ error: 'Invalid media kind' }, 400);
  if (id === null) return c.json({ error: 'Invalid media id' }, 400);

  let filePath: string | null = null;
  if (kind === 'movie') filePath = await resolveMoviePlaybackFile(id);
  if (kind === 'episode') filePath = await resolveEpisodePlaybackFile(id);
  if (kind === 'track') filePath = await resolveTrackPlaybackFile(id);
  if (!filePath) return c.json({ error: 'No playable file found' }, 404);

  const launchResult = await openFileInSystemPlayer(filePath);
  if (!launchResult.ok) {
    return c.json({ error: launchResult.error || 'Failed to open media in system player' }, 500);
  }

  return c.json({ ok: true });
});

// Stream track playback
mediaRoutes.get('/playback/audio/track/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id === null) return c.json({ error: 'Invalid track id' }, 400);

  try {
    const filePath = await resolveTrackPlaybackFile(id);
    if (!filePath) return c.json({ error: 'No playable track file found' }, 404);
    return await buildPlaybackStreamResponse(c, filePath);
  } catch {
    return c.json({ error: 'Failed to stream track' }, 500);
  }
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
