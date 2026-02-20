import { createAsync, useNavigate, useParams } from '@solidjs/router';
import { createEffect, createSignal } from 'solid-js';
import { Film, Calendar, Clock, Hash, Play, FolderOpen, Plus } from 'lucide-solid';
import { useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { Badge, Button, Card, CardHeader, CardTitle, Input } from '~/components/ui';
import { fetchJson, requestJson } from '~/lib/api';

interface MovieDetails {
  id: number;
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  runtime?: number | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  status: 'wanted' | 'downloaded' | 'archived';
  path?: string | null;
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

function formatRuntime(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || minutes <= 0) return 'n/a';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatReleaseYear(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return String(parsed.getUTCFullYear());
}

export default function MovieDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const mediaPlayer = useMediaPlayer();
  const movieResult = createAsync(() => fetchJson<MovieDetails>(`/api/media/movies/${params.id}`));

  const movie = () => movieResult()?.data;
  const loadError = () => movieResult()?.error;
  const [initializedMovieId, setInitializedMovieId] = createSignal<number | null>(null);
  const [movieOverride, setMovieOverride] = createSignal<Partial<MovieDetails>>({});
  const movieData = () => {
    const base = movie();
    return base ? { ...base, ...movieOverride() } : undefined;
  };
  const hasLocalPath = () => {
    const current = movieData();
    return typeof current?.path === 'string' && current.path.trim().length > 0;
  };

  const [releaseQuery, setReleaseQuery] = createSignal('');
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
    const currentMovie = movie();
    if (!currentMovie) return;
    if (initializedMovieId() === currentMovie.id) return;

    setInitializedMovieId(currentMovie.id);
    setMovieOverride({});
    setReleaseQuery((previous) => (previous.trim().length === 0 ? currentMovie.title : previous));
    setManualPath(currentMovie.path || '');
    setPlaybackError(null);
    setLocateMessage(null);
    setLocateError(null);
    setShowLocalPanel(false);
  });

  const playMovie = () => {
    const currentMovie = movieData();
    if (!currentMovie) return;
    const hasLocalPath = typeof currentMovie.path === 'string' && currentMovie.path.trim().length > 0;
    if (currentMovie.status !== 'downloaded' && !hasLocalPath) {
      setPlaybackError('This movie is not marked as downloaded yet.');
      return;
    }

    setPlaybackError(null);
    mediaPlayer.openItem({
      id: `movie-${currentMovie.id}`,
      mediaId: currentMovie.id,
      mediaKind: 'movie',
      mediaType: 'video',
      title: currentMovie.title,
      subtitle: currentMovie.releaseDate || undefined,
      streamUrl: `/api/media/playback/video-compat/movie/${currentMovie.id}`,
    });
    void navigate('/player');
  };

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

  const loadIndexerFilters = async () => {
    setLoadingFilters(true);
    setJackettError(null);
    setJackettMessage(null);
    setJackettResults([]);
    setJackettFailures([]);

    const response = await requestJson<JackettFiltersResponse>('/api/search/jackett/filters?category=movies');
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
      setJackettError('No enabled Jackett indexers available for movies');
    }

    setLoadingFilters(false);
  };

  const searchReleases = async () => {
    const currentMovie = movie();
    if (!currentMovie) return;

    const query = releaseQuery().trim();
    if (!query) {
      setJackettError('Enter a release query before searching');
      return;
    }

    if (selectedIndexerIds().length === 0) {
      setJackettError('Select at least one indexer');
      return;
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
      category: 'movies',
      query,
      indexerIds: selectedIndexerIds(),
      categoryIds,
      language: language.length > 0 ? language : undefined,
    };

    if (typeof currentMovie.tmdbId === 'number') payload.tmdbId = currentMovie.tmdbId;
    if (typeof currentMovie.imdbId === 'string' && currentMovie.imdbId.length > 0) {
      payload.imdbId = currentMovie.imdbId;
    }

    const response = await requestJson<JackettSearchResponse>('/api/search/jackett', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.error) {
      setJackettError(response.error);
      setSearchingReleases(false);
      return;
    }

    if (!response.data) {
      setJackettError('No response data received from Jackett search');
      setSearchingReleases(false);
      return;
    }

    setJackettResults(response.data.results || []);
    setJackettFailures(response.data.failures || []);

    if ((response.data.results || []).length === 0) {
      setJackettMessage('No releases found for this movie with the selected filters.');
    } else {
      setJackettMessage(`Found ${response.data.total} release${response.data.total === 1 ? '' : 's'}.`);
    }

    setSearchingReleases(false);
  };

  const sendReleaseToDeluge = async (release: JackettReleaseResult) => {
    const currentMovie = movieData();
    if (!currentMovie) return;

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
        mediaType: 'movie',
        mediaId: currentMovie.id,
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
    const currentMovie = movieData();
    if (!currentMovie) return;

    const pathValue = manualPath().trim();
    if (!pathValue) {
      setLocateError('Enter a folder or file path before linking.');
      return;
    }

    setLocatingPath(true);
    setLocateError(null);
    setLocateMessage(null);

    const response = await requestJson<{ message: string }>(`/api/media/movies/${currentMovie.id}/locate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathValue }),
    });

    if (response.error) {
      setLocateError(response.error);
      setLocatingPath(false);
      return;
    }

    setLocateMessage(response.data?.message || 'Movie path linked.');
    setMovieOverride({
      status: 'downloaded',
      path: pathValue,
    });
    setLocatingPath(false);
  };

  return (
    <>

      <div class="movie-details-page">
        <header class="cinematic-page-header">
          <button class="back-button" onClick={() => void navigate('/movies')}>
            {'<- Back to Movies'}
          </button>
          <h1 class="cinematic-title" style={{ "font-size": "1.5rem", "margin-bottom": 0 }}>Dossier</h1>
        </header>

        {loadError() && (
          <Card>
            <p>Failed to load movie details: {loadError()}</p>
          </Card>
        )}

        {movie() && (
          <>
            <Card class="movie-details-card">
              <div class="movie-details-layout">
                <div class="movie-details-poster">
                  {movieData()?.posterPath ? (
                    <img src={movieData()?.posterPath || ''} alt={movieData()?.title || 'Movie poster'} />
                  ) : (
                    <div class="poster-placeholder">
                      <Film size={64} />
                    </div>
                  )}
                </div>

                <div class="movie-details-content">
                  <div class="movie-details-title-row">
                    <h2 class="movie-details-title">{movieData()?.title}</h2>
                    <div class="movie-details-title-actions">
                      <Badge variant={movieData()?.status === 'downloaded' ? 'success' : 'warning'}>
                        {movieData()?.status}
                      </Badge>
                      {(movieData()?.status === 'downloaded' || hasLocalPath()) && (
                        <Button variant="secondary" size="sm" onClick={playMovie}>
                          <Play size={14} />
                          Play Movie
                        </Button>
                      )}
                    </div>
                  </div>

                  {playbackError() && <p class="inline-feedback error">{playbackError()}</p>}

                  {movieData()?.originalTitle && movieData()?.originalTitle !== movieData()?.title && (
                    <p class="movie-details-original-title">Original title: {movieData()?.originalTitle}</p>
                  )}

                  <p class="movie-details-overview">
                    {movieData()?.overview || 'No overview is available for this movie yet.'}
                  </p>

                  <div class="movie-details-meta">
                    <span class="meta-item">
                      <Calendar size={14} />
                      Year: {formatReleaseYear(movieData()?.releaseDate)}
                    </span>
                    <span class="meta-item">
                      <Clock size={14} />
                      Runtime: {formatRuntime(movieData()?.runtime)}
                    </span>
                    <span class="meta-item">
                      <Hash size={14} />
                      TMDB: {movieData()?.tmdbId ?? 'n/a'}
                    </span>
                    <span class="meta-item">
                      <Hash size={14} />
                      IMDb: {movieData()?.imdbId || 'n/a'}
                    </span>
                  </div>

                  <div class="local-media-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLocalPanel((current) => !current)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {showLocalPanel() && (
              <Card class="local-media-card">
                <CardHeader>
                  <CardTitle>Local File Location</CardTitle>
                </CardHeader>

                <div class="local-media-form">
                  <div class="form-group">
                    <label>Folder or File Path</label>
                    <Input
                      value={manualPath()}
                      onInput={setManualPath}
                      placeholder="e.g. D:\\Media\\Movies\\The Matrix (1999)"
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

            <Card class="jackett-panel movie-jackett-panel">
              <CardHeader>
                <CardTitle>Release Search</CardTitle>
              </CardHeader>

              <div class="movie-release-query">
                <label>Release Query</label>
                <Input value={releaseQuery()} onInput={setReleaseQuery} placeholder="Movie title or release keywords" />
              </div>

              <div class="jackett-actions">
                <Button variant="secondary" onClick={loadIndexerFilters} disabled={loadingFilters()}>
                  {loadingFilters() ? 'Loading Filters...' : 'Load Indexer Filters'}
                </Button>
                <Button
                  variant="primary"
                  onClick={searchReleases}
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
