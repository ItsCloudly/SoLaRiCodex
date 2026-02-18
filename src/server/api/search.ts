import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/connection';
import { artists, indexers, media, movies, series, settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  buildJackettTorznabEndpoint,
  describeFetchError,
  readHttpErrorDetail,
  readTorznabError,
} from './utils';

export const searchRoutes = new Hono();

type SearchCategory = 'movies' | 'tv' | 'music';
type StoredMediaType = 'movie' | 'tv' | 'music';

interface SearchResult {
  id: string;
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  year?: number | null;
  genre?: string | null;
  inLibrary: boolean;
  source: 'tmdb' | 'musicbrainz';
  tmdbId?: number;
  musicBrainzId?: string;
}

interface TmdbSearchResponse<T> {
  results: T[];
}

interface TmdbMovieResult {
  id: number;
  title: string;
  original_title?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
}

interface TmdbTvResult {
  id: number;
  name: string;
  original_name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
}

interface TmdbMovieExternalIds {
  imdb_id?: string | null;
}

interface TmdbTvExternalIds {
  imdb_id?: string | null;
  tvdb_id?: number | null;
}

interface ResolvedIndexer {
  id: number;
  name: string;
  baseUrl: string;
  apiKey?: string;
  priority: number;
}

interface JackettCategory {
  id: number;
  name: string;
}

interface JackettFilterCategoryOption {
  id: number;
  name: string;
  indexerIds: number[];
  label: string;
}

interface JackettSearchSupport {
  available: boolean;
  supportedParams: string[];
}

interface JackettCaps {
  categories: JackettCategory[];
  search: JackettSearchSupport;
  tvSearch: JackettSearchSupport;
  movieSearch: JackettSearchSupport;
  musicSearch: JackettSearchSupport;
}

interface JackettRelease {
  id: string;
  title: string;
  indexerId: number;
  indexerName: string;
  downloadUrl?: string | null;
  infoUrl?: string | null;
  guid?: string | null;
  size?: number | null;
  seeders?: number | null;
  peers?: number | null;
  publishDate?: string | null;
  categories: string[];
}

interface JackettFailure {
  indexerId: number;
  indexerName: string;
  message: string;
}

interface MusicBrainzArtist {
  id: string;
  name: string;
  disambiguation?: string;
  country?: string;
  tags?: Array<{
    name?: string;
    count?: number;
  }>;
  'life-span'?: {
    begin?: string;
    end?: string;
    ended?: boolean;
  };
}

interface MusicBrainzArtistSearchResponse {
  artists: MusicBrainzArtist[];
}

interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  disambiguation?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'first-release-date'?: string;
}

interface MusicBrainzReleaseGroupResponse {
  'release-groups': MusicBrainzReleaseGroup[];
}

const searchCategorySchema = z.enum(['movies', 'tv', 'music']);
const musicReleaseGroupsQuerySchema = z.object({
  artistId: z.string().trim().min(1),
});

const jackettSearchSchema = z.object({
  category: searchCategorySchema,
  query: z.string().trim().min(1),
  tmdbId: z.number().int().positive().optional(),
  imdbId: z.string().trim().optional(),
  tvdbId: z.number().int().positive().optional(),
  language: z.string().trim().min(2).max(16).optional(),
  indexerIds: z.array(z.number().int()).optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
});

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const JACKETT_CAPS_CACHE_MS = 5 * 60 * 1000;
const jackettCapsCache = new Map<string, { expiresAt: number; caps: JackettCaps }>();
const commonLanguageCodes = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh', 'multi'];
const DEFAULT_MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org';
const DEFAULT_MUSICBRAINZ_USER_AGENT = 'SoLaRi/1.0 (admin@localhost)';

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function toStoredMediaType(category: SearchCategory): StoredMediaType {
  if (category === 'movies') return 'movie';
  if (category === 'tv') return 'tv';
  return 'music';
}

function buildTmdbImage(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${path}`;
}

function readSearchQuery(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getSettingValue(key: string): Promise<string | null> {
  const result = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  const value = result[0]?.value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getTmdbApiKey(): Promise<string | null> {
  return getSettingValue('apis.tmdb.apiKey');
}

async function resolveMusicBrainzConfig(): Promise<{ baseUrl: string; userAgent: string }> {
  const baseUrl = await getSettingValue('apis.musicbrainz.baseUrl') || DEFAULT_MUSICBRAINZ_BASE_URL;
  const userAgent = await getSettingValue('apis.musicbrainz.userAgent') || DEFAULT_MUSICBRAINZ_USER_AGENT;

  return { baseUrl, userAgent };
}

function buildMusicBrainzEndpoint(baseUrl: string, path: string, params: Record<string, string>): URL {
  const withScheme = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : `https://${baseUrl}`;

  const base = new URL(withScheme);
  const cleanBasePath = base.pathname.replace(/\/+$/, '');

  // Accept both `https://musicbrainz.org` and `https://musicbrainz.org/ws/2/`.
  if (cleanBasePath.length === 0 || cleanBasePath === '/') {
    base.pathname = '/ws/2/';
  } else if (/\/ws\/2$/i.test(cleanBasePath)) {
    base.pathname = `${cleanBasePath}/`;
  } else {
    base.pathname = `${cleanBasePath}/ws/2/`;
  }

  const resourcePath = path
    .trim()
    .replace(/^\/+/, '')
    .replace(/^ws\/2\/?/i, '');

  const endpoint = new URL(resourcePath, base);
  for (const [key, value] of Object.entries(params)) {
    endpoint.searchParams.set(key, value);
  }
  endpoint.searchParams.set('fmt', 'json');
  return endpoint;
}

async function fetchMusicBrainzJson<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const config = await resolveMusicBrainzConfig();
  const endpoint = buildMusicBrainzEndpoint(config.baseUrl, path, params);

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': config.userAgent,
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz responded with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function parseMediaTypes(value: string): StoredMediaType[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredMediaType => (
      item === 'movie' || item === 'tv' || item === 'music'
    ));
  } catch {
    return [];
  }
}

async function getEffectiveIndexers(category: SearchCategory): Promise<ResolvedIndexer[]> {
  const mediaType = toStoredMediaType(category);
  const configured = await db.select().from(indexers);

  const enabled = configured
    .filter((indexer) => Boolean(indexer.enabled))
    .filter((indexer) => parseMediaTypes(indexer.mediaTypes).includes(mediaType))
    .map((indexer) => ({
      id: indexer.id,
      name: indexer.name,
      baseUrl: indexer.baseUrl,
      apiKey: indexer.apiKey || undefined,
      priority: indexer.priority ?? 100,
    }))
    .sort((a, b) => a.priority - b.priority || a.id - b.id);

  if (enabled.length > 0) return enabled;

  const fallbackBaseUrl = await getSettingValue('jackett.baseUrl');
  if (!fallbackBaseUrl) return [];

  const fallbackApiKey = await getSettingValue('jackett.apiKey');
  return [{
    id: 0,
    name: 'Default Jackett',
    baseUrl: fallbackBaseUrl,
    apiKey: fallbackApiKey || undefined,
    priority: 1000,
  }];
}

async function fetchTmdbJson<T>(
  path: string,
  apiKey: string,
  queryParams: Record<string, string>,
): Promise<T> {
  const endpoint = new URL(`https://api.themoviedb.org/3/${path}`);
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

function deriveYear(dateValue: string | null | undefined): number | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

async function markLibraryMatches(category: SearchCategory, results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;

  if (category === 'movies') {
    const existing = await db
      .select({
        title: media.title,
        tmdbId: movies.tmdbId,
      })
      .from(movies)
      .innerJoin(media, eq(movies.mediaId, media.id));

    const titleSet = new Set(existing.map((entry) => normalizeTitle(entry.title)));
    const tmdbIdSet = new Set(existing.map((entry) => entry.tmdbId).filter((value): value is number => typeof value === 'number'));

    return results.map((result) => ({
      ...result,
      inLibrary: (
        (typeof result.tmdbId === 'number' && tmdbIdSet.has(result.tmdbId))
        || titleSet.has(normalizeTitle(result.title))
      ),
    }));
  }

  if (category === 'tv') {
    const existing = await db
      .select({ title: media.title })
      .from(series)
      .innerJoin(media, eq(series.mediaId, media.id));

    const titleSet = new Set(existing.map((entry) => normalizeTitle(entry.title)));
    return results.map((result) => ({
      ...result,
      inLibrary: titleSet.has(normalizeTitle(result.title)),
    }));
  }

  const existing = await db
    .select({ title: media.title })
    .from(artists)
    .innerJoin(media, eq(artists.mediaId, media.id));

  const titleSet = new Set(existing.map((entry) => normalizeTitle(entry.title)));
  return results.map((result) => ({
    ...result,
    inLibrary: titleSet.has(normalizeTitle(result.title)),
  }));
}

async function searchMoviesInTmdb(query: string, apiKey: string): Promise<SearchResult[]> {
  const payload = await fetchTmdbJson<TmdbSearchResponse<TmdbMovieResult>>(
    'search/movie',
    apiKey,
    {
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    },
  );

  return payload.results.slice(0, 20).map((movie) => ({
    id: `tmdb:movie:${movie.id}`,
    title: movie.title || movie.original_title || 'Untitled',
    overview: movie.overview || null,
    posterPath: buildTmdbImage(movie.poster_path),
    backdropPath: buildTmdbImage(movie.backdrop_path),
    releaseDate: movie.release_date || null,
    year: deriveYear(movie.release_date),
    inLibrary: false,
    source: 'tmdb',
    tmdbId: movie.id,
  }));
}

async function searchTvInTmdb(query: string, apiKey: string): Promise<SearchResult[]> {
  const payload = await fetchTmdbJson<TmdbSearchResponse<TmdbTvResult>>(
    'search/tv',
    apiKey,
    {
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    },
  );

  return payload.results.slice(0, 20).map((show) => ({
    id: `tmdb:tv:${show.id}`,
    title: show.name || show.original_name || 'Untitled',
    overview: show.overview || null,
    posterPath: buildTmdbImage(show.poster_path),
    backdropPath: buildTmdbImage(show.backdrop_path),
    releaseDate: show.first_air_date || null,
    year: deriveYear(show.first_air_date),
    inLibrary: false,
    source: 'tmdb',
    tmdbId: show.id,
  }));
}

function describeArtist(artist: MusicBrainzArtist): string | null {
  const parts: string[] = [];
  if (artist.disambiguation) parts.push(artist.disambiguation);
  if (artist.country) parts.push(`Country: ${artist.country}`);

  const life = artist['life-span'];
  const begin = life?.begin?.trim();
  const end = life?.end?.trim();
  if (begin && end) {
    parts.push(`Active: ${begin} to ${end}`);
  } else if (begin) {
    parts.push(`Active since ${begin}`);
  }

  if (parts.length === 0) return null;
  return parts.join(' | ');
}

function bestArtistTag(artist: MusicBrainzArtist): string | null {
  if (!Array.isArray(artist.tags) || artist.tags.length === 0) return null;

  const sorted = [...artist.tags]
    .filter((tag) => typeof tag.name === 'string' && tag.name.trim().length > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return sorted[0]?.name?.trim() || null;
}

async function searchArtistsInMusicBrainz(query: string): Promise<SearchResult[]> {
  const payload = await fetchMusicBrainzJson<MusicBrainzArtistSearchResponse>(
    'artist',
    {
      query,
      limit: '20',
      offset: '0',
    },
  );

  return (payload.artists || [])
    .filter((artist) => typeof artist.id === 'string' && artist.id.length > 0)
    .map((artist) => ({
      id: `musicbrainz:artist:${artist.id}`,
      title: artist.name || 'Unknown Artist',
      overview: describeArtist(artist),
      genre: bestArtistTag(artist) || undefined,
      releaseDate: artist['life-span']?.begin || null,
      year: deriveYear(artist['life-span']?.begin),
      inLibrary: false,
      source: 'musicbrainz',
      musicBrainzId: artist.id,
    }));
}

async function fetchArtistReleaseGroups(artistId: string): Promise<MusicBrainzReleaseGroup[]> {
  const payload = await fetchMusicBrainzJson<MusicBrainzReleaseGroupResponse>(
    'release-group',
    {
      artist: artistId,
      limit: '100',
      offset: '0',
    },
  );

  return (payload['release-groups'] || [])
    .filter((releaseGroup) => (
      typeof releaseGroup.id === 'string'
      && releaseGroup.id.length > 0
      && typeof releaseGroup.title === 'string'
      && releaseGroup.title.trim().length > 0
    ))
    .sort((a, b) => {
      const dateA = a['first-release-date'] ? Date.parse(a['first-release-date']) : 0;
      const dateB = b['first-release-date'] ? Date.parse(b['first-release-date']) : 0;
      if (dateA !== dateB) return dateB - dateA;
      return a.title.localeCompare(b.title);
    });
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseXmlAttributes(fragment: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;

  for (const match of fragment.matchAll(attributePattern)) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
  }

  return attributes;
}

function parseSupportedParams(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function parseSearchSupport(xml: string, tagName: string): JackettSearchSupport {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)\\/?>`, 'i');
  const match = xml.match(pattern);
  if (!match) {
    return { available: false, supportedParams: [] };
  }

  const attributes = parseXmlAttributes(match[1]);
  const available = (attributes.available || '').toLowerCase() === 'yes';
  const supportedParams = parseSupportedParams(attributes.supportedParams || attributes.supportedparams);
  return { available, supportedParams };
}

function toKeyFragments(value: string): string {
  return value.toLowerCase().replace(/[\s/_-]+/g, '');
}

function findQualityLabel(name: string): string | null {
  const key = toKeyFragments(name);

  if (key.includes('2160') || key.includes('4k') || key.includes('uhd')) return '2160p / 4K';
  if (key.includes('1080')) return '1080p';
  if (key.includes('720')) return '720p';
  if (key.includes('480') || key.includes('sd')) return 'SD';
  if (key.includes('remux')) return 'Remux';
  if (key.includes('bluray') || key.includes('bdrip')) return 'BluRay';
  if (key.includes('webdl') || key.includes('webrip')) return 'WEB';
  if (key.includes('x265') || key.includes('h265') || key.includes('hevc')) return 'H.265 / HEVC';
  if (key.includes('x264') || key.includes('h264')) return 'H.264';
  return null;
}

function findLanguageLabel(name: string): string | null {
  const lower = name.toLowerCase();
  const hasWord = (pattern: string): boolean => new RegExp(`\\b(?:${pattern})\\b`, 'i').test(lower);

  if (hasWord('multi|multilang')) return 'Multi-language';
  if (hasWord('english|eng')) return 'English';
  if (hasWord('german|deutsch|ger')) return 'German';
  if (hasWord('french|francais|fre')) return 'French';
  if (hasWord('spanish|espanol|spa')) return 'Spanish';
  if (hasWord('italian|ita')) return 'Italian';
  if (hasWord('dutch|nederlands')) return 'Dutch';
  if (hasWord('russian|rus')) return 'Russian';
  if (hasWord('japanese|jpn')) return 'Japanese';
  if (hasWord('korean|kor')) return 'Korean';
  if (hasWord('chinese|mandarin|cantonese|chi')) return 'Chinese';
  if (hasWord('portuguese|portugues|por')) return 'Portuguese';
  if (hasWord('hindi|hin')) return 'Hindi';
  if (hasWord('arabic|ara')) return 'Arabic';
  return null;
}

function toClassifiedFilterOptions(
  categories: Array<{ id: number; name: string; indexerIds: number[] }>,
  classifier: (name: string) => string | null,
): JackettFilterCategoryOption[] {
  return categories
    .map((categoryOption) => {
      const label = classifier(categoryOption.name);
      if (!label) return null;
      return {
        id: categoryOption.id,
        name: categoryOption.name,
        indexerIds: categoryOption.indexerIds,
        label,
      };
    })
    .filter((item): item is JackettFilterCategoryOption => item !== null)
    .sort((a, b) => a.label.localeCompare(b.label) || a.id - b.id);
}

function parseJackettCaps(xml: string): JackettCaps {
  const categoryMap = new Map<number, string>();
  const categoryPattern = /<category\b([^>]*)\/?>/gi;

  for (const match of xml.matchAll(categoryPattern)) {
    const attributes = parseXmlAttributes(match[1]);
    const id = Number.parseInt(attributes.id || '', 10);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!attributes.name) continue;
    categoryMap.set(id, attributes.name);
  }

  return {
    categories: Array.from(categoryMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id),
    search: parseSearchSupport(xml, 'search'),
    tvSearch: parseSearchSupport(xml, 'tv-search'),
    movieSearch: parseSearchSupport(xml, 'movie-search'),
    musicSearch: parseSearchSupport(xml, 'music-search'),
  };
}

async function fetchJackettCaps(indexerConfig: ResolvedIndexer): Promise<JackettCaps> {
  const endpoint = buildJackettTorznabEndpoint(indexerConfig.baseUrl);
  endpoint.searchParams.set('t', 'caps');
  if (indexerConfig.apiKey) {
    endpoint.searchParams.set('apikey', indexerConfig.apiKey);
  }

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const detail = await readHttpErrorDetail(response);
    throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
  }

  const xml = await response.text();
  const torznabError = readTorznabError(xml);
  if (torznabError) {
    throw new Error(`Torznab error: ${torznabError}`);
  }
  return parseJackettCaps(xml);
}

async function getJackettCaps(indexerConfig: ResolvedIndexer): Promise<JackettCaps> {
  const cacheKey = `${indexerConfig.baseUrl}|${indexerConfig.apiKey || ''}`;
  const now = Date.now();
  const cached = jackettCapsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.caps;
  }

  const caps = await fetchJackettCaps(indexerConfig);
  jackettCapsCache.set(cacheKey, {
    caps,
    expiresAt: now + JACKETT_CAPS_CACHE_MS,
  });
  return caps;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readTagText(xml: string, tagName: string): string | null {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<${escapedTag}>([\\s\\S]*?)<\\/${escapedTag}>`, 'i');
  const match = xml.match(pattern);
  if (!match) return null;
  return decodeXmlEntities(match[1].trim());
}

function readAllTagText(xml: string, tagName: string): string[] {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<${escapedTag}>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');

  const values: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    const value = decodeXmlEntities(match[1].trim());
    if (value.length > 0) values.push(value);
  }
  return values;
}

function parseTorznabAttributes(itemXml: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /<torznab:attr\b([^>]*)\/?>/gi;

  for (const match of itemXml.matchAll(pattern)) {
    const rawAttributes = parseXmlAttributes(match[1]);
    const name = (rawAttributes.name || '').toLowerCase();
    const value = rawAttributes.value || '';
    if (name.length === 0) continue;
    attributes[name] = value;
  }

  return attributes;
}

function parseEnclosureUrl(itemXml: string): string | null {
  const enclosureMatch = itemXml.match(/<enclosure\b([^>]*)\/?>/i);
  if (!enclosureMatch) return null;
  const attributes = parseXmlAttributes(enclosureMatch[1]);
  return attributes.url || null;
}

function parseJackettItems(xml: string, indexerConfig: ResolvedIndexer): JackettRelease[] {
  const results: JackettRelease[] = [];
  const itemPattern = /<item\b[\s\S]*?<\/item>/gi;

  for (const itemMatch of xml.matchAll(itemPattern)) {
    const itemXml = itemMatch[0];
    const attributes = parseTorznabAttributes(itemXml);
    const title = readTagText(itemXml, 'title');
    if (!title) continue;

    const enclosureUrl = parseEnclosureUrl(itemXml);
    const linkUrl = readTagText(itemXml, 'link');
    // Prefer magnet links when available because Deluge can always consume them,
    // while HTTP enclosure/download URLs can fail in remote or containerized setups.
    const downloadUrl = attributes.magneturl || attributes.downloadurl || enclosureUrl || linkUrl || null;
    const infoUrl = readTagText(itemXml, 'comments') || linkUrl || null;
    const guid = readTagText(itemXml, 'guid') || downloadUrl || `${indexerConfig.id}:${title}`;
    const publishedAt = readTagText(itemXml, 'pubDate');
    const publishDate = publishedAt ? new Date(publishedAt) : null;
    const categoryNames = readAllTagText(itemXml, 'category');

    const size = parseNumber(readTagText(itemXml, 'size') || attributes.size);
    const seeders = parseNumber(attributes.seeders);
    const peers = parseNumber(attributes.peers);

    results.push({
      id: `${indexerConfig.id}:${guid}`,
      title,
      indexerId: indexerConfig.id,
      indexerName: indexerConfig.name,
      downloadUrl,
      infoUrl,
      guid,
      size,
      seeders,
      peers,
      publishDate: publishDate && !Number.isNaN(publishDate.getTime()) ? publishDate.toISOString() : null,
      categories: Array.from(new Set(categoryNames)),
    });
  }

  return results;
}

function hasSupportedParam(supportedParams: string[], param: string): boolean {
  if (supportedParams.length === 0) return true;
  return supportedParams.includes(param.toLowerCase());
}

function withSearchTerm(
  params: URLSearchParams,
  supportedParams: string[],
  query: string,
  tmdbId: number | undefined,
  imdbId: string | undefined,
  tvdbId: number | undefined,
  category: SearchCategory,
): string | null {
  if (category === 'movies') {
    if (typeof tmdbId === 'number' && hasSupportedParam(supportedParams, 'tmdbid')) {
      params.set('tmdbid', String(tmdbId));
      return null;
    }

    if (imdbId && hasSupportedParam(supportedParams, 'imdbid')) {
      params.set('imdbid', imdbId);
      return null;
    }
  }

  if (category === 'tv') {
    if (typeof tvdbId === 'number' && hasSupportedParam(supportedParams, 'tvdbid')) {
      params.set('tvdbid', String(tvdbId));
      return null;
    }

    if (imdbId && hasSupportedParam(supportedParams, 'imdbid')) {
      params.set('imdbid', imdbId);
      return null;
    }
  }

  if (hasSupportedParam(supportedParams, 'q')) {
    params.set('q', query);
    return null;
  }

  return 'Indexer does not support q or usable ID parameters for this media type';
}

function chooseSearchType(category: SearchCategory, caps: JackettCaps): { t: string; supportedParams: string[] } | null {
  if (category === 'movies') {
    if (caps.movieSearch.available) return { t: 'movie', supportedParams: caps.movieSearch.supportedParams };
    if (caps.search.available) return { t: 'search', supportedParams: caps.search.supportedParams };
    return null;
  }

  if (category === 'tv') {
    if (caps.tvSearch.available) return { t: 'tvsearch', supportedParams: caps.tvSearch.supportedParams };
    if (caps.search.available) return { t: 'search', supportedParams: caps.search.supportedParams };
    return null;
  }

  if (caps.musicSearch.available) return { t: 'music', supportedParams: caps.musicSearch.supportedParams };
  if (caps.search.available) return { t: 'search', supportedParams: caps.search.supportedParams };
  return null;
}

async function enrichIdentifiersFromTmdb(
  category: SearchCategory,
  tmdbId: number | undefined,
  imdbId: string | undefined,
  tvdbId: number | undefined,
): Promise<{ imdbId?: string; tvdbId?: number }> {
  if (typeof tmdbId !== 'number') {
    return { imdbId, tvdbId };
  }

  const tmdbApiKey = await getTmdbApiKey();
  if (!tmdbApiKey) {
    return { imdbId, tvdbId };
  }

  try {
    if (category === 'movies') {
      const externalIds = await fetchTmdbJson<TmdbMovieExternalIds>(
        `movie/${tmdbId}/external_ids`,
        tmdbApiKey,
        {},
      );

      return {
        imdbId: imdbId || externalIds.imdb_id || undefined,
        tvdbId,
      };
    }

    if (category === 'tv') {
      const externalIds = await fetchTmdbJson<TmdbTvExternalIds>(
        `tv/${tmdbId}/external_ids`,
        tmdbApiKey,
        {},
      );

      return {
        imdbId: imdbId || externalIds.imdb_id || undefined,
        tvdbId: tvdbId || externalIds.tvdb_id || undefined,
      };
    }

    return { imdbId, tvdbId };
  } catch {
    return { imdbId, tvdbId };
  }
}

searchRoutes.get('/movies', async (c) => {
  const query = readSearchQuery(c.req.query('q'));
  if (!query) return c.json({ error: 'Query parameter required' }, 400);

  const apiKey = await getTmdbApiKey();
  if (!apiKey) {
    return c.json({ error: 'TMDB API key not configured. Set it in Settings > Advanced > TMDB API Key.' }, 400);
  }

  try {
    const tmdbResults = await searchMoviesInTmdb(query, apiKey);
    const results = await markLibraryMatches('movies', tmdbResults);
    return c.json({
      query,
      results,
      message: 'Results are from TMDB and marked if already in your library',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TMDB search failed';
    return c.json({ error: message }, 502);
  }
});

searchRoutes.get('/tv', async (c) => {
  const query = readSearchQuery(c.req.query('q'));
  if (!query) return c.json({ error: 'Query parameter required' }, 400);

  const apiKey = await getTmdbApiKey();
  if (!apiKey) {
    return c.json({ error: 'TMDB API key not configured. Set it in Settings > Advanced > TMDB API Key.' }, 400);
  }

  try {
    const tmdbResults = await searchTvInTmdb(query, apiKey);
    const results = await markLibraryMatches('tv', tmdbResults);
    return c.json({
      query,
      results,
      message: 'Results are from TMDB and marked if already in your library',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TMDB search failed';
    return c.json({ error: message }, 502);
  }
});

searchRoutes.get('/music', async (c) => {
  const query = readSearchQuery(c.req.query('q'));
  if (!query) return c.json({ error: 'Query parameter required' }, 400);

  try {
    const artistResults = await searchArtistsInMusicBrainz(query);
    const results = await markLibraryMatches('music', artistResults);
    return c.json({
      query,
      results,
      message: 'Results are from MusicBrainz artist search and marked if already in your library',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MusicBrainz search failed';
    return c.json({ error: message }, 502);
  }
});

searchRoutes.get('/music/releases', async (c) => {
  const parsed = musicReleaseGroupsQuerySchema.safeParse({
    artistId: c.req.query('artistId'),
  });

  if (!parsed.success) {
    return c.json({ error: 'artistId query parameter is required' }, 400);
  }

  try {
    const releases = await fetchArtistReleaseGroups(parsed.data.artistId);
    return c.json({ artistId: parsed.data.artistId, releases });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MusicBrainz release lookup failed';
    return c.json({ error: message }, 502);
  }
});

searchRoutes.get('/jackett/filters', async (c) => {
  const parsedCategory = searchCategorySchema.safeParse(c.req.query('category'));
  if (!parsedCategory.success) {
    return c.json({ error: 'Valid category query parameter is required (movies|tv|music)' }, 400);
  }

  const category = parsedCategory.data;
  const resolvedIndexers = await getEffectiveIndexers(category);
  if (resolvedIndexers.length === 0) {
    return c.json({
      indexers: [],
      categories: [],
      qualityCategories: [],
      languageCategories: [],
      supportsLanguageParam: false,
      languageCodes: [],
      warnings: ['No enabled Jackett indexers found for this media type'],
    });
  }

  const capsResults = await Promise.all(resolvedIndexers.map(async (indexerConfig) => {
    try {
      const caps = await getJackettCaps(indexerConfig);
      return { indexerConfig, caps, error: null as string | null };
    } catch (error) {
      const message = describeFetchError(error);
      return { indexerConfig, caps: null as JackettCaps | null, error: message };
    }
  }));

  const categoryMap = new Map<number, { id: number; name: string; indexerIds: number[] }>();
  const warnings: string[] = [];

  const indexerFilters = capsResults
    .filter((result) => result.caps)
    .map((result) => {
      const caps = result.caps as JackettCaps;
      for (const categoryOption of caps.categories) {
        const existing = categoryMap.get(categoryOption.id);
        if (existing) {
          if (!existing.indexerIds.includes(result.indexerConfig.id)) {
            existing.indexerIds.push(result.indexerConfig.id);
          }
        } else {
          categoryMap.set(categoryOption.id, {
            id: categoryOption.id,
            name: categoryOption.name,
            indexerIds: [result.indexerConfig.id],
          });
        }
      }

      const searchModes: string[] = [];
      if (caps.search.available) searchModes.push('search');
      if (caps.movieSearch.available) searchModes.push('movie');
      if (caps.tvSearch.available) searchModes.push('tvsearch');
      if (caps.musicSearch.available) searchModes.push('music');

      const supportedParams = Array.from(new Set([
        ...caps.search.supportedParams,
        ...caps.movieSearch.supportedParams,
        ...caps.tvSearch.supportedParams,
        ...caps.musicSearch.supportedParams,
      ])).sort();

      return {
        id: result.indexerConfig.id,
        name: result.indexerConfig.name,
        priority: result.indexerConfig.priority,
        searchModes,
        supportedParams,
        categoryCount: caps.categories.length,
      };
    });

  for (const result of capsResults) {
    if (result.error) {
      warnings.push(`${result.indexerConfig.name}: ${result.error}`);
    }
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) => a.id - b.id);
  const qualityCategories = toClassifiedFilterOptions(categories, findQualityLabel);
  const languageCategories = toClassifiedFilterOptions(categories, findLanguageLabel);
  const supportsLanguageParam = indexerFilters.some((indexerOption) => (
    indexerOption.supportedParams.includes('lang') || indexerOption.supportedParams.includes('language')
  ));

  return c.json({
    indexers: indexerFilters,
    categories,
    qualityCategories,
    languageCategories,
    supportsLanguageParam,
    languageCodes: supportsLanguageParam ? commonLanguageCodes : [],
    warnings,
  });
});

searchRoutes.post('/jackett', async (c) => {
  const body = await c.req.json();
  const parsed = jackettSearchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid Jackett search payload', details: parsed.error.issues }, 400);
  }

  const data = parsed.data;
  const language = data.language?.trim().toLowerCase();
  const selectedIndexerIds = new Set(data.indexerIds || []);
  const selectedCategoryIds = (data.categoryIds || []).filter((id, index, source) => source.indexOf(id) === index);

  const allIndexers = await getEffectiveIndexers(data.category);
  const activeIndexers = selectedIndexerIds.size > 0
    ? allIndexers.filter((indexerConfig) => selectedIndexerIds.has(indexerConfig.id))
    : allIndexers;

  if (activeIndexers.length === 0) {
    return c.json({ error: 'No matching enabled indexers for this search' }, 400);
  }

  const identifiers = await enrichIdentifiersFromTmdb(
    data.category,
    data.tmdbId,
    data.imdbId,
    data.tvdbId,
  );

  const failures: JackettFailure[] = [];
  const resultGroups = await Promise.all(activeIndexers.map(async (indexerConfig) => {
    try {
      const caps = await getJackettCaps(indexerConfig);
      const searchType = chooseSearchType(data.category, caps);
      if (!searchType) {
        throw new Error('Indexer does not support this media search type');
      }

      const endpoint = buildJackettTorznabEndpoint(indexerConfig.baseUrl);
      endpoint.searchParams.set('t', searchType.t);
      if (indexerConfig.apiKey) {
        endpoint.searchParams.set('apikey', indexerConfig.apiKey);
      }

      const queryError = withSearchTerm(
        endpoint.searchParams,
        searchType.supportedParams,
        data.query,
        data.tmdbId,
        identifiers.imdbId,
        identifiers.tvdbId,
        data.category,
      );
      if (queryError) {
        throw new Error(queryError);
      }

      if (language && language.length > 0) {
        if (hasSupportedParam(searchType.supportedParams, 'lang')) {
          endpoint.searchParams.set('lang', language);
        } else if (hasSupportedParam(searchType.supportedParams, 'language')) {
          endpoint.searchParams.set('language', language);
        }
      }

      if (selectedCategoryIds.length > 0) {
        const availableCategories = new Set(caps.categories.map((category) => category.id));
        const matchedCategoryIds = selectedCategoryIds.filter((id) => availableCategories.has(id));
        if (matchedCategoryIds.length === 0) {
          return [] as JackettRelease[];
        }
        endpoint.searchParams.set('cat', matchedCategoryIds.join(','));
      }

      const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const detail = await readHttpErrorDetail(response);
        throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
      }

      const xml = await response.text();
      const torznabError = readTorznabError(xml);
      if (torznabError) {
        throw new Error(`Torznab error: ${torznabError}`);
      }
      return parseJackettItems(xml, indexerConfig);
    } catch (error) {
      failures.push({
        indexerId: indexerConfig.id,
        indexerName: indexerConfig.name,
        message: describeFetchError(error),
      });
      return [] as JackettRelease[];
    }
  }));

  const releases = resultGroups
    .flat()
    .sort((a, b) => {
      const seedA = a.seeders ?? -1;
      const seedB = b.seeders ?? -1;
      if (seedA !== seedB) return seedB - seedA;

      const dateA = a.publishDate ? Date.parse(a.publishDate) : 0;
      const dateB = b.publishDate ? Date.parse(b.publishDate) : 0;
      return dateB - dateA;
    });

  return c.json({
    query: data.query,
    results: releases,
    failures,
    total: releases.length,
    identifiers: {
      tmdbId: data.tmdbId || null,
      imdbId: identifiers.imdbId || null,
      tvdbId: identifiers.tvdbId || null,
    },
  });
});
