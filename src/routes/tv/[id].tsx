import { createAsync, useNavigate, useParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal } from 'solid-js';
import { Calendar, Hash, Play, Tv, FolderOpen, Plus } from 'lucide-solid';
import { useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { Badge, Button, Card, CardHeader, CardTitle, Input } from '~/components/ui';
import { fetchJson, requestJson } from '~/lib/api';

interface TvEpisode {
  id: number;
  season: number;
  episode: number;
  airDate?: string | null;
  title?: string | null;
  overview?: string | null;
  downloaded?: boolean | number | null;
  filePath?: string | null;
}

interface TvSeriesDetails {
  id: number;
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  status: 'continuing' | 'ended' | 'wanted' | 'downloaded' | 'archived';
  path?: string | null;
  tvdbId?: number | null;
  episodes: TvEpisode[];
}

interface SeasonGroup {
  season: number;
  episodes: TvEpisode[];
  totalCount: number;
  downloadedCount: number;
}

interface JackettIndexerFilter {
  id: number;
  name: string;
  priority: number;
  searchModes: string[];
  supportedParams: string[];
  categoryCount: number;
}

interface JackettCategoryFilter {
  id: number;
  name: string;
  indexerIds: number[];
}

interface JackettFiltersResponse {
  indexers: JackettIndexerFilter[];
  categories: JackettCategoryFilter[];
  qualityCategories: JackettCategoryFilter[];
  languageCategories: JackettCategoryFilter[];
  supportsLanguageParam: boolean;
  languageCodes: string[];
  warnings: string[];
}

interface JackettReleaseResult {
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

interface JackettSearchFailure {
  indexerId: number;
  indexerName: string;
  message: string;
}

interface JackettSearchResponse {
  query: string;
  results: JackettReleaseResult[];
  failures: JackettSearchFailure[];
  total: number;
}

function isEpisodeDownloaded(value: TvEpisode['downloaded']): boolean {
  return value === true || value === 1;
}

function formatSize(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || bytes <= 0) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPublishDate(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleString();
}

function formatReleaseYear(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return String(parsed.getUTCFullYear());
}

function formatAirDate(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleDateString();
}

function formatSeasonCode(seasonNumber: number): string {
  return `S${String(Math.max(0, seasonNumber)).padStart(2, '0')}`;
}

function formatEpisodeCode(seasonNumber: number, episodeNumber: number): string {
  return `${formatSeasonCode(seasonNumber)}E${String(Math.max(0, episodeNumber)).padStart(2, '0')}`;
}

function parseSeasonNumber(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function resolveStatusVariant(status: TvSeriesDetails['status']): 'default' | 'success' | 'warning' | 'info' {
  if (status === 'downloaded') return 'success';
  if (status === 'continuing') return 'info';
  if (status === 'ended' || status === 'archived') return 'default';
  return 'warning';
}

export default function TvDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const mediaPlayer = useMediaPlayer();
  const seriesResult = createAsync(() => fetchJson<TvSeriesDetails>(`/api/media/tv/${params.id}`));

  const series = () => seriesResult()?.data;
  const loadError = () => seriesResult()?.error;
  const [initializedSeriesId, setInitializedSeriesId] = createSignal<number | null>(null);
  const [seriesOverride, setSeriesOverride] = createSignal<Partial<TvSeriesDetails>>({});
  const seriesData = () => {
    const base = series();
    return base ? { ...base, ...seriesOverride() } : undefined;
  };

  const groupedSeasons = createMemo<SeasonGroup[]>(() => {
    const currentSeries = series();
    const episodes = currentSeries?.episodes || [];
    if (episodes.length === 0) return [];

    const bySeason = new Map<number, TvEpisode[]>();

    for (const episode of episodes) {
      if (!bySeason.has(episode.season)) {
        bySeason.set(episode.season, []);
      }
      bySeason.get(episode.season)?.push(episode);
    }

    return Array.from(bySeason.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([seasonNumber, seasonEpisodes]) => {
        const sortedEpisodes = [...seasonEpisodes].sort((a, b) => a.episode - b.episode);
        const downloadedCount = sortedEpisodes.filter((episode) => isEpisodeDownloaded(episode.downloaded)).length;

        return {
          season: seasonNumber,
          episodes: sortedEpisodes,
          totalCount: sortedEpisodes.length,
          downloadedCount,
        };
      });
  });

  const totalDownloadedEpisodes = createMemo(() => (
    groupedSeasons().reduce((count, seasonGroup) => count + seasonGroup.downloadedCount, 0)
  ));

  const [releaseQuery, setReleaseQuery] = createSignal('');
  const [selectedSeasonNumber, setSelectedSeasonNumber] = createSignal('');
  const [expandedSeasonNumber, setExpandedSeasonNumber] = createSignal<number | null>(null);
  const [activeSeasonSearch, setActiveSeasonSearch] = createSignal<number | null>(null);

  const [loadingFilters, setLoadingFilters] = createSignal(false);
  const [searchingReleases, setSearchingReleases] = createSignal(false);
  const [sendingToDelugeId, setSendingToDelugeId] = createSignal<string | null>(null);
  const [jackettFilters, setJackettFilters] = createSignal<JackettFiltersResponse | null>(null);
  const [selectedIndexerIds, setSelectedIndexerIds] = createSignal<number[]>([]);
  const [selectedQualityCategoryIds, setSelectedQualityCategoryIds] = createSignal<number[]>([]);
  const [selectedLanguageCategoryIds, setSelectedLanguageCategoryIds] = createSignal<number[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = createSignal('');
  const [jackettResults, setJackettResults] = createSignal<JackettReleaseResult[]>([]);
  const [jackettFailures, setJackettFailures] = createSignal<JackettSearchFailure[]>([]);
  const [jackettMessage, setJackettMessage] = createSignal<string | null>(null);
  const [jackettError, setJackettError] = createSignal<string | null>(null);
  const [playbackError, setPlaybackError] = createSignal<string | null>(null);
  const [manualPath, setManualPath] = createSignal('');
  const [locatingPath, setLocatingPath] = createSignal(false);
  const [locateMessage, setLocateMessage] = createSignal<string | null>(null);
  const [locateError, setLocateError] = createSignal<string | null>(null);
  const [showLocalPanel, setShowLocalPanel] = createSignal(false);

  createEffect(() => {
    const currentSeries = series();
    if (!currentSeries) return;
    if (initializedSeriesId() === currentSeries.id) return;

    const firstSeason = groupedSeasons()[0]?.season;

    setInitializedSeriesId(currentSeries.id);
    setSeriesOverride({});
    setReleaseQuery(currentSeries.title);
    setSelectedSeasonNumber(typeof firstSeason === 'number' ? String(firstSeason) : '');
    setExpandedSeasonNumber(null);
    setActiveSeasonSearch(null);
    setJackettResults([]);
    setJackettFailures([]);
    setJackettMessage(null);
    setJackettError(null);
    setPlaybackError(null);
    setManualPath(currentSeries.path || '');
    setLocateMessage(null);
    setLocateError(null);
    setShowLocalPanel(false);
  });

  createEffect(() => {
    const seasonGroups = groupedSeasons();
    if (seasonGroups.length === 0) return;

    const availableSeasons = new Set(seasonGroups.map((seasonGroup) => seasonGroup.season));
    const selectedSeasonRaw = selectedSeasonNumber().trim();
    if (selectedSeasonRaw.length > 0) {
      const selectedSeason = parseSeasonNumber(selectedSeasonRaw);
      if (selectedSeason === null || !availableSeasons.has(selectedSeason)) {
        setSelectedSeasonNumber(String(seasonGroups[0].season));
      }
    }

    const expandedSeason = expandedSeasonNumber();
    if (expandedSeason !== null && !availableSeasons.has(expandedSeason)) {
      setExpandedSeasonNumber(null);
    }
  });

  const updateIdSelection = (
    current: number[],
    id: number,
    checked: boolean,
  ): number[] => {
    if (checked) {
      return current.includes(id) ? current : [...current, id];
    }
    return current.filter((value) => value !== id);
  };

  const buildSeasonPlaylistItems = (seasonGroup: SeasonGroup) => {
    const currentSeries = series();
    if (!currentSeries) return [];

    return seasonGroup.episodes
      .filter((episode) => isEpisodeDownloaded(episode.downloaded))
      .map((episode) => ({
        id: `episode-${episode.id}`,
        mediaId: episode.id,
        mediaKind: 'episode' as const,
        mediaType: 'video' as const,
        title: `${formatEpisodeCode(episode.season, episode.episode)} - ${episode.title || `Episode ${episode.episode}`}`,
        subtitle: currentSeries.title,
        streamUrl: `/api/media/playback/video-compat/episode/${episode.id}`,
      }));
  };

  const playSeason = (seasonGroup: SeasonGroup) => {
    const playlist = buildSeasonPlaylistItems(seasonGroup);
    if (playlist.length === 0) {
      setPlaybackError('No downloaded episodes available in this season yet.');
      return;
    }

    setPlaybackError(null);
    mediaPlayer.openPlaylist(playlist, 0);
    void navigate('/player');
  };

  const playEpisode = (seasonGroup: SeasonGroup, episode: TvEpisode) => {
    if (!isEpisodeDownloaded(episode.downloaded)) {
      setPlaybackError('This episode is not available locally yet.');
      return;
    }

    const playlist = buildSeasonPlaylistItems(seasonGroup);
    const startIndex = playlist.findIndex((item) => item.id === `episode-${episode.id}`);
    if (playlist.length === 0 || startIndex < 0) {
      setPlaybackError('No playable local file found for this episode.');
      return;
    }

    setPlaybackError(null);
    mediaPlayer.openPlaylist(playlist, startIndex);
    void navigate('/player');
  };

  const loadIndexerFilters = async () => {
    setLoadingFilters(true);
    setJackettError(null);
    setJackettMessage(null);
    setJackettResults([]);
    setJackettFailures([]);

    const response = await requestJson<JackettFiltersResponse>('/api/search/jackett/filters?category=tv');
    if (response.error) {
      setJackettFilters(null);
      setSelectedIndexerIds([]);
      setSelectedQualityCategoryIds([]);
      setSelectedLanguageCategoryIds([]);
      setSelectedLanguageCode('');
      setJackettError(response.error);
      setLoadingFilters(false);
      return;
    }

    if (!response.data) {
      setJackettFilters(null);
      setSelectedIndexerIds([]);
      setSelectedQualityCategoryIds([]);
      setSelectedLanguageCategoryIds([]);
      setSelectedLanguageCode('');
      setJackettError('No filter data returned from Jackett');
      setLoadingFilters(false);
      return;
    }

    setJackettFilters(response.data);
    setSelectedIndexerIds(response.data.indexers.map((indexerOption) => indexerOption.id));
    setSelectedQualityCategoryIds([]);
    setSelectedLanguageCategoryIds([]);
    setSelectedLanguageCode('');

    if (response.data.warnings.length > 0) {
      setJackettMessage(`Some indexers reported issues: ${response.data.warnings.join(' | ')}`);
    } else {
      setJackettMessage('Indexer filters loaded.');
    }

    if (response.data.indexers.length === 0) {
      setJackettError('No enabled Jackett indexers available for TV');
    }

    setLoadingFilters(false);
  };

  const resolveSearchQuery = (
    showTitle: string,
    forcedSeasonNumber?: number,
  ): string => {
    const seasonNumber = typeof forcedSeasonNumber === 'number'
      ? forcedSeasonNumber
      : parseSeasonNumber(selectedSeasonNumber());

    if (typeof seasonNumber === 'number') {
      return `${showTitle} ${formatSeasonCode(seasonNumber)}`.trim();
    }

    const manualQuery = releaseQuery().trim();
    if (manualQuery.length > 0) return manualQuery;
    return showTitle;
  };

  const searchReleases = async (forcedSeasonNumber?: number) => {
    const currentSeries = series();
    if (!currentSeries) return;

    if (selectedIndexerIds().length === 0) {
      setJackettError('Select at least one indexer');
      return;
    }

    const query = resolveSearchQuery(currentSeries.title, forcedSeasonNumber);
    if (!query) {
      setJackettError('Enter a release query before searching');
      return;
    }

    if (typeof forcedSeasonNumber === 'number') {
      setSelectedSeasonNumber(String(forcedSeasonNumber));
      setExpandedSeasonNumber(forcedSeasonNumber);
      setReleaseQuery(query);
      setActiveSeasonSearch(forcedSeasonNumber);
    } else {
      setActiveSeasonSearch(null);
    }

    setSearchingReleases(true);
    setJackettError(null);
    setJackettMessage(null);
    setJackettResults([]);
    setJackettFailures([]);

    const categoryIds = Array.from(new Set([
      ...selectedQualityCategoryIds(),
      ...selectedLanguageCategoryIds(),
    ]));
    const language = selectedLanguageCode().trim().toLowerCase();

    const payload: Record<string, unknown> = {
      category: 'tv',
      query,
      indexerIds: selectedIndexerIds(),
      categoryIds,
      language: language.length > 0 ? language : undefined,
    };

    if (typeof currentSeries.tvdbId === 'number') {
      payload.tvdbId = currentSeries.tvdbId;
    }

    const response = await requestJson<JackettSearchResponse>('/api/search/jackett', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.error) {
      setJackettError(response.error);
      setSearchingReleases(false);
      setActiveSeasonSearch(null);
      return;
    }

    if (!response.data) {
      setJackettError('No response data received from Jackett search');
      setSearchingReleases(false);
      setActiveSeasonSearch(null);
      return;
    }

    setJackettResults(response.data.results || []);
    setJackettFailures(response.data.failures || []);

    if ((response.data.results || []).length === 0) {
      setJackettMessage(`No releases found for "${query}".`);
    } else {
      setJackettMessage(`Found ${response.data.total} release${response.data.total === 1 ? '' : 's'} for "${query}".`);
    }

    setSearchingReleases(false);
    setActiveSeasonSearch(null);
  };

  const sendReleaseToDeluge = async (release: JackettReleaseResult) => {
    const currentSeries = series();
    if (!currentSeries) return;

    if (!release.downloadUrl) {
      setJackettError('This release does not include a downloadable torrent or magnet URL');
      return;
    }

    setSendingToDelugeId(release.id);
    setJackettError(null);

    const response = await requestJson<{ id: number; message: string }>('/api/deluge/add-torrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: release.title,
        mediaType: 'tv',
        mediaId: currentSeries.id,
        indexerId: release.indexerId > 0 ? release.indexerId : undefined,
        sourceUrl: release.downloadUrl,
        quality: release.categories[0] || undefined,
        size: release.size || undefined,
      }),
    });

    if (response.error) {
      setJackettError(response.error);
      setSendingToDelugeId(null);
      return;
    }

    setJackettMessage(`Sent to Deluge: ${release.title}`);
    setSendingToDelugeId(null);
  };

  const handleLocatePath = async () => {
    const currentSeries = seriesData();
    if (!currentSeries) return;

    const pathValue = manualPath().trim();
    if (!pathValue) {
      setLocateError('Enter a folder path before linking.');
      return;
    }

    setLocatingPath(true);
    setLocateError(null);
    setLocateMessage(null);

    const response = await requestJson<{ message: string; updatedEpisodes?: number }>(`/api/media/tv/${currentSeries.id}/locate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathValue }),
    });

    if (response.error) {
      setLocateError(response.error);
      setLocatingPath(false);
      return;
    }

    const updatedEpisodes = response.data?.updatedEpisodes;
    const message = response.data?.message || 'Series path linked.';
    setLocateMessage(typeof updatedEpisodes === 'number'
      ? `${message} Updated ${updatedEpisodes} episode${updatedEpisodes === 1 ? '' : 's'}.`
      : message);
    setSeriesOverride({ path: pathValue });
    setLocatingPath(false);
  };

  return (
    <>

      <div class="movie-details-page">
        <header class="cinematic-page-header">
          <button class="back-button" onClick={() => void navigate('/tv')}>
            {'<- Back to TV Shows'}
          </button>
          <h1 class="cinematic-title" style={{ "font-size": "1.5rem", "margin-bottom": 0 }}>Dossier</h1>
        </header>

        {loadError() && (
          <Card>
            <p>Failed to load TV show details: {loadError()}</p>
          </Card>
        )}

        {seriesData() && (
          <>
            <Card class="movie-details-card">
              <div class="movie-details-layout">
                <div class="movie-details-poster">
                  {seriesData()?.posterPath ? (
                    <img src={seriesData()?.posterPath || ''} alt={seriesData()?.title || 'TV show poster'} />
                  ) : (
                    <div class="poster-placeholder">
                      <Tv size={64} />
                    </div>
                  )}
                </div>

                <div class="movie-details-content">
                  <div class="movie-details-title-row">
                    <h2 class="movie-details-title">{seriesData()?.title}</h2>
                    <div class="movie-details-title-actions">
                      <Badge variant={resolveStatusVariant(seriesData()?.status || 'wanted')}>
                        {seriesData()?.status}
                      </Badge>
                    </div>
                  </div>

                  {seriesData()?.originalTitle && seriesData()?.originalTitle !== seriesData()?.title && (
                    <p class="movie-details-original-title">Original title: {seriesData()?.originalTitle}</p>
                  )}

                  <p class="movie-details-overview">
                    {seriesData()?.overview || 'No overview is available for this TV show yet.'}
                  </p>

                  <div class="movie-details-meta">
                    <span class="meta-item">
                      <Calendar size={14} />
                      Year: {formatReleaseYear(seriesData()?.releaseDate)}
                    </span>
                    <span class="meta-item">
                      <Hash size={14} />
                      TVDB: {seriesData()?.tvdbId ?? 'n/a'}
                    </span>
                    <span class="meta-item">
                      <Tv size={14} />
                      Seasons: {groupedSeasons().length}
                    </span>
                    <span class="meta-item">
                      <Hash size={14} />
                      Episodes: {seriesData()?.episodes.length ?? 0}
                    </span>
                    <span class="meta-item">
                      <Hash size={14} />
                      Downloaded: {totalDownloadedEpisodes()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {showLocalPanel() && (
              <Card class="local-media-card">
                <CardHeader>
                  <CardTitle>Local Series Folder</CardTitle>
                </CardHeader>

                <div class="local-media-form">
                  <div class="form-group">
                    <label>Folder Path</label>
                    <Input
                      value={manualPath()}
                      onInput={setManualPath}
                      placeholder="e.g. D:\\Media\\TV\\The Expanse"
                    />
                  </div>

                  <div class="local-media-actions">
                    <Button
                      variant="secondary"
                      onClick={handleLocatePath}
                      disabled={locatingPath()}
                    >
                      <FolderOpen size={14} />
                      {locatingPath() ? 'Linking...' : 'Link Local Folder'}
                    </Button>
                  </div>

                  {locateError() && <p class="inline-feedback error">{locateError()}</p>}
                  {locateMessage() && <p class="inline-feedback success">{locateMessage()}</p>}
                </div>
              </Card>
            )}

            <Card class="tv-seasons-card">
              <CardHeader>
                <CardTitle>Seasons & Episodes</CardTitle>
              </CardHeader>

              {playbackError() && <p class="inline-feedback error">{playbackError()}</p>}

              {groupedSeasons().length === 0 ? (
                <p class="jackett-empty">No episode metadata is available yet for this series.</p>
              ) : (
                <div class="tv-seasons-list">
                  {groupedSeasons().map((seasonGroup) => (
                    <Card class="tv-season-card" key={`season-${seasonGroup.season}`}>
                      <div class="tv-season-header">
                        <div>
                          <h3 class="tv-season-title">
                            {seasonGroup.season === 0 ? 'Specials' : `Season ${seasonGroup.season}`}{' '}
                            <span class="tv-season-code">({formatSeasonCode(seasonGroup.season)})</span>
                          </h3>
                          <p class="tv-season-subtitle">
                            {seasonGroup.totalCount} episode{seasonGroup.totalCount === 1 ? '' : 's'} | downloaded {seasonGroup.downloadedCount}
                          </p>
                        </div>

                        <div class="tv-season-actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => playSeason(seasonGroup)}
                            disabled={seasonGroup.downloadedCount === 0}
                          >
                            <Play size={14} />
                            Play Season
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLocalPanel(true)}
                          >
                            <Plus size={14} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void searchReleases(seasonGroup.season)}
                            disabled={searchingReleases() || loadingFilters() || selectedIndexerIds().length === 0}
                          >
                            {searchingReleases() && activeSeasonSearch() === seasonGroup.season
                              ? 'Searching...'
                              : `Search ${formatSeasonCode(seasonGroup.season)}`}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedSeasonNumber((current) => (
                              current === seasonGroup.season ? null : seasonGroup.season
                            ))}
                          >
                            {expandedSeasonNumber() === seasonGroup.season ? 'Hide Episodes' : 'View Episodes'}
                          </Button>
                        </div>
                      </div>

                      {expandedSeasonNumber() === seasonGroup.season && (
                        <div class="tv-episodes-list">
                          {seasonGroup.episodes.map((episode) => (
                            <div class="tv-episode-row">
                              <span class="tv-episode-code">
                                {formatEpisodeCode(seasonGroup.season, episode.episode)}
                              </span>
                              <span class="tv-episode-title">
                                {episode.title || `Episode ${episode.episode}`}
                              </span>
                              <span class="tv-episode-meta">
                                Air date: {formatAirDate(episode.airDate)}
                              </span>
                              <Badge variant={isEpisodeDownloaded(episode.downloaded) ? 'success' : 'warning'}>
                                {isEpisodeDownloaded(episode.downloaded) ? 'available locally' : 'wanted'}
                              </Badge>
                              {isEpisodeDownloaded(episode.downloaded) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => playEpisode(seasonGroup, episode)}
                                >
                                  <Play size={13} />
                                  Play
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card class="jackett-panel movie-jackett-panel">
              <CardHeader>
                <CardTitle>Release Search</CardTitle>
              </CardHeader>

              <div class="movie-release-query">
                <label>Release Query</label>
                <Input value={releaseQuery()} onInput={setReleaseQuery} placeholder="Series title or release keywords" />
              </div>

              <div class="movie-release-query">
                <label>Season Quick Search (optional)</label>
                {groupedSeasons().length === 0 ? (
                  <Input
                    value={selectedSeasonNumber()}
                    onInput={setSelectedSeasonNumber}
                    placeholder="e.g. 1 for Season 1 (uses S01 query)"
                  />
                ) : (
                  <select
                    class="input"
                    value={selectedSeasonNumber()}
                    onChange={(event) => setSelectedSeasonNumber(event.currentTarget.value)}
                  >
                    <option value="">Manual query only</option>
                    {groupedSeasons().map((seasonGroup) => (
                      <option value={String(seasonGroup.season)}>
                        {seasonGroup.season === 0 ? 'Specials' : `Season ${seasonGroup.season}`} ({formatSeasonCode(seasonGroup.season)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div class="jackett-actions">
                <Button variant="secondary" onClick={loadIndexerFilters} disabled={loadingFilters()}>
                  {loadingFilters() ? 'Loading Filters...' : 'Load Indexer Filters'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void searchReleases()}
                  disabled={searchingReleases() || loadingFilters() || selectedIndexerIds().length === 0}
                >
                  {searchingReleases() ? 'Searching Releases...' : 'Search Releases'}
                </Button>
              </div>

              {jackettError() && <p class="inline-feedback error">{jackettError()}</p>}
              {jackettMessage() && <p class="inline-feedback success">{jackettMessage()}</p>}

              {jackettFilters() && (
                <div class="jackett-filters">
                  <div class="jackett-filter-group">
                    <label>Indexers</label>
                    <div class="jackett-options">
                      {jackettFilters()?.indexers.map((indexerOption) => (
                        <label class="jackett-option">
                          <input
                            type="checkbox"
                            checked={selectedIndexerIds().includes(indexerOption.id)}
                            onChange={(event) => setSelectedIndexerIds((current) => (
                              updateIdSelection(current, indexerOption.id, event.currentTarget.checked)
                            ))}
                          />
                          <span>{indexerOption.name}</span>
                          <span class="jackett-option-meta">
                            {indexerOption.searchModes.join(', ') || 'search'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div class="jackett-filter-group">
                    <label>Quality Filters</label>
                    {jackettFilters()?.qualityCategories.length === 0 ? (
                      <p class="jackett-empty">No quality filters were exposed by current indexers.</p>
                    ) : (
                      <div class="jackett-options compact">
                        {jackettFilters()?.qualityCategories.map((categoryOption) => (
                          <label class="jackett-option">
                            <input
                              type="checkbox"
                              checked={selectedQualityCategoryIds().includes(categoryOption.id)}
                              onChange={(event) => setSelectedQualityCategoryIds((current) => (
                                updateIdSelection(current, categoryOption.id, event.currentTarget.checked)
                              ))}
                            />
                            <span>{categoryOption.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div class="jackett-filter-group">
                    <label>Language Filters</label>
                    {jackettFilters()?.languageCategories.length === 0 ? (
                      <p class="jackett-empty">No language categories were exposed by current indexers.</p>
                    ) : (
                      <div class="jackett-options compact">
                        {jackettFilters()?.languageCategories.map((categoryOption) => (
                          <label class="jackett-option">
                            <input
                              type="checkbox"
                              checked={selectedLanguageCategoryIds().includes(categoryOption.id)}
                              onChange={(event) => setSelectedLanguageCategoryIds((current) => (
                                updateIdSelection(current, categoryOption.id, event.currentTarget.checked)
                              ))}
                            />
                            <span>{categoryOption.name}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {jackettFilters()?.supportsLanguageParam && (
                      <div class="jackett-language-param">
                        <label>Language Code (lang)</label>
                        <Input
                          value={selectedLanguageCode()}
                          onInput={setSelectedLanguageCode}
                          placeholder={`e.g. ${jackettFilters()?.languageCodes.join(', ')}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {jackettResults().length > 0 && (
                <div class="jackett-results-list">
                  {jackettResults().map((release) => (
                    <Card class="jackett-release-card" key={release.id}>
                      <div class="jackett-release-main">
                        <h4 class="jackett-release-title">{release.title}</h4>
                        <p class="jackett-release-meta">
                          <span>{release.indexerName}</span>
                          <span>Seeders: {release.seeders ?? 'n/a'}</span>
                          <span>Size: {formatSize(release.size)}</span>
                          <span>Published: {formatPublishDate(release.publishDate)}</span>
                        </p>
                        {release.categories.length > 0 && (
                          <p class="jackett-release-categories">{release.categories.join(', ')}</p>
                        )}
                      </div>
                      <div class="jackett-release-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void sendReleaseToDeluge(release)}
                          disabled={!release.downloadUrl || sendingToDelugeId() === release.id}
                        >
                          {sendingToDelugeId() === release.id ? 'Sending...' : 'Send to Deluge'}
                        </Button>
                        {release.downloadUrl && (
                          <a href={release.downloadUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        )}
                        {release.infoUrl && (
                          <a href={release.infoUrl} target="_blank" rel="noreferrer">
                            Details
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {jackettFailures().length > 0 && (
                <div class="jackett-failures">
                  <p class="inline-feedback error">Indexer errors:</p>
                  {jackettFailures().map((failure) => (
                    <p class="jackett-failure-line">
                      {failure.indexerName}: {failure.message}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </>

  );
}
