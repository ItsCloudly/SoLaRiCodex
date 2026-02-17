import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Input, Badge } from '~/components/ui';
import { Search, Film, Tv, Music, ArrowRight, Check } from 'lucide-solid';
import { createSignal } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { requestJson } from '~/lib/api';

type Category = 'movies' | 'tv' | 'music';

interface SearchResultItem {
  id: string;
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  year?: number | null;
  genre?: string | null;
  inLibrary: boolean;
  source: 'tmdb';
  tmdbId?: number;
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

const categories = [
  { id: 'movies', label: 'Movies', icon: Film, color: 'var(--accent-primary)', description: 'Search TMDB for movies to add to your library' },
  { id: 'tv', label: 'TV Shows', icon: Tv, color: 'var(--accent-secondary)', description: 'Search TMDB for TV series and episodes' },
  { id: 'music', label: 'Music', icon: Music, color: 'var(--success)', description: 'Search TMDB people (Sound) for artists' },
] as const;

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

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialCategory = (() => {
    const category = searchParams.category;
    return category === 'movies' || category === 'tv' || category === 'music'
      ? category
      : null;
  })();

  const [selectedCategory, setSelectedCategory] = createSignal<Category | null>(initialCategory);
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<SearchResultItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [addingId, setAddingId] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [infoMessage, setInfoMessage] = createSignal<string | null>(null);

  const [selectedJackettItem, setSelectedJackettItem] = createSignal<SearchResultItem | null>(null);
  const [jackettFilters, setJackettFilters] = createSignal<JackettFiltersResponse | null>(null);
  const [selectedIndexerIds, setSelectedIndexerIds] = createSignal<number[]>([]);
  const [selectedQualityCategoryIds, setSelectedQualityCategoryIds] = createSignal<number[]>([]);
  const [selectedLanguageCategoryIds, setSelectedLanguageCategoryIds] = createSignal<number[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = createSignal('');
  const [loadingJackettFilters, setLoadingJackettFilters] = createSignal(false);
  const [jackettSearching, setJackettSearching] = createSignal(false);
  const [sendingToDelugeId, setSendingToDelugeId] = createSignal<string | null>(null);
  const [jackettResults, setJackettResults] = createSignal<JackettReleaseResult[]>([]);
  const [jackettFailures, setJackettFailures] = createSignal<JackettSearchFailure[]>([]);
  const [jackettMessage, setJackettMessage] = createSignal<string | null>(null);
  const [jackettError, setJackettError] = createSignal<string | null>(null);

  const resetJackettState = () => {
    setSelectedJackettItem(null);
    setJackettFilters(null);
    setSelectedIndexerIds([]);
    setSelectedQualityCategoryIds([]);
    setSelectedLanguageCategoryIds([]);
    setSelectedLanguageCode('');
    setJackettResults([]);
    setJackettFailures([]);
    setJackettMessage(null);
    setJackettError(null);
    setLoadingJackettFilters(false);
    setJackettSearching(false);
    setSendingToDelugeId(null);
  };

  const handleSearch = async () => {
    const category = selectedCategory();
    if (!query() || !category) return;

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    resetJackettState();

    const response = await requestJson<{ results: SearchResultItem[]; message?: string }>(
      `/api/search/${category}?q=${encodeURIComponent(query())}`,
    );

    if (response.error) {
      setResults([]);
      setErrorMessage(response.error);
      setLoading(false);
      return;
    }

    setResults(response.data?.results || []);
    if (response.data?.message) {
      setInfoMessage(response.data.message);
    }

    if ((response.data?.results || []).length === 0) {
      setInfoMessage('No TMDB matches found for this query.');
    }

    setLoading(false);
  };

  const addToLibrary = async (result: SearchResultItem) => {
    const category = selectedCategory();
    if (!category || result.inLibrary) return;

    setAddingId(result.id);
    setErrorMessage(null);
    setInfoMessage(null);

    let endpoint = '/api/media/movies';
    let payload: Record<string, unknown> = {
      title: result.title,
      overview: result.overview || undefined,
      posterPath: result.posterPath || undefined,
      backdropPath: result.backdropPath || undefined,
      releaseDate: result.releaseDate || undefined,
    };

    if (category === 'movies' && typeof result.tmdbId === 'number') {
      payload.tmdbId = result.tmdbId;
    }

    if (category === 'tv') {
      endpoint = '/api/media/tv';
    }

    if (category === 'music') {
      endpoint = '/api/media/music/artists';
      payload = {
        title: result.title,
        overview: result.overview || undefined,
        posterPath: result.posterPath || undefined,
        genre: result.genre || undefined,
      };
    }

    const response = await requestJson<{ id: number; message: string }>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.error) {
      if (response.status === 409) {
        setResults((prev) => prev.map((item) => (
          item.id === result.id
            ? { ...item, inLibrary: true }
            : item
        )));
        setInfoMessage(`${result.title} is already in your library.`);
      } else {
        setErrorMessage(response.error);
      }
      setAddingId(null);
      return;
    }

    setResults((prev) => prev.map((item) => (
      item.id === result.id
        ? { ...item, inLibrary: true }
        : item
    )));

    if (selectedJackettItem()?.id === result.id) {
      setSelectedJackettItem((prev) => (prev ? { ...prev, inLibrary: true } : prev));
    }

    setInfoMessage(`${result.title} added to library. You can now search Jackett releases.`);
    setAddingId(null);
  };

  const loadJackettFilters = async (category: Category) => {
    setLoadingJackettFilters(true);
    setJackettError(null);
    setJackettMessage(null);

    const response = await requestJson<JackettFiltersResponse>(
      `/api/search/jackett/filters?category=${encodeURIComponent(category)}`,
    );

    if (response.error) {
      setJackettFilters(null);
      setSelectedIndexerIds([]);
      setSelectedQualityCategoryIds([]);
      setSelectedLanguageCategoryIds([]);
      setSelectedLanguageCode('');
      setJackettError(response.error);
      setLoadingJackettFilters(false);
      return;
    }

    const data = response.data;
    if (!data) {
      setJackettFilters(null);
      setSelectedIndexerIds([]);
      setSelectedQualityCategoryIds([]);
      setSelectedLanguageCategoryIds([]);
      setSelectedLanguageCode('');
      setJackettError('No filter data returned from Jackett');
      setLoadingJackettFilters(false);
      return;
    }

    setJackettFilters(data);
    setSelectedIndexerIds(data.indexers.map((indexerOption) => indexerOption.id));
    setSelectedQualityCategoryIds([]);
    setSelectedLanguageCategoryIds([]);
    setSelectedLanguageCode('');

    if (data.warnings.length > 0) {
      setJackettMessage(`Some indexers reported issues: ${data.warnings.join(' | ')}`);
    }

    if (data.indexers.length === 0) {
      setJackettError('No enabled Jackett indexers available for this media type');
    }

    setLoadingJackettFilters(false);
  };

  const prepareJackettSearch = async (result: SearchResultItem) => {
    const category = selectedCategory();
    if (!category) return;

    setSelectedJackettItem(result);
    setJackettResults([]);
    setJackettFailures([]);
    await loadJackettFilters(category);
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

  const handleJackettSearch = async () => {
    const category = selectedCategory();
    const selectedItem = selectedJackettItem();

    if (!category || !selectedItem) return;
    if (selectedIndexerIds().length === 0) {
      setJackettError('Select at least one indexer before searching');
      return;
    }

    setJackettSearching(true);
    setJackettError(null);
    setJackettMessage(null);
    setJackettResults([]);
    setJackettFailures([]);

    const categoryIds = Array.from(new Set([
      ...selectedQualityCategoryIds(),
      ...selectedLanguageCategoryIds(),
    ]));
    const language = selectedLanguageCode().trim().toLowerCase();

    const response = await requestJson<JackettSearchResponse>('/api/search/jackett', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        query: selectedItem.title,
        tmdbId: selectedItem.tmdbId,
        indexerIds: selectedIndexerIds(),
        categoryIds,
        language: language.length > 0 ? language : undefined,
      }),
    });

    if (response.error) {
      setJackettError(response.error);
      setJackettSearching(false);
      return;
    }

    const data = response.data;
    if (!data) {
      setJackettError('No response data received from Jackett search');
      setJackettSearching(false);
      return;
    }

    setJackettResults(data.results || []);
    setJackettFailures(data.failures || []);

    if ((data.results || []).length === 0) {
      setJackettMessage('No releases found for this media item with the selected filters.');
    } else {
      setJackettMessage(`Found ${data.total} release${data.total === 1 ? '' : 's'}.`);
    }

    setJackettSearching(false);
  };

  const sendReleaseToDeluge = async (release: JackettReleaseResult) => {
    const category = selectedCategory();
    if (!category) return;

    if (!release.downloadUrl) {
      setJackettError('This release does not include a downloadable torrent or magnet URL');
      return;
    }

    const mediaType = category === 'movies'
      ? 'movie'
      : category === 'tv'
        ? 'tv'
        : 'music';

    setSendingToDelugeId(release.id);
    setJackettError(null);

    const response = await requestJson<{ id: number; message: string }>('/api/deluge/add-torrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: release.title,
        mediaType,
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

  return (
    <MainLayout>
      <div class="search-page">
        <header class="page-header">
          <Search size={28} class="header-icon" />
          <h1 class="section-title">Search</h1>
        </header>

        {errorMessage() && (
          <Card>
            <p>{errorMessage()}</p>
          </Card>
        )}

        {infoMessage() && (
          <Card>
            <p>{infoMessage()}</p>
          </Card>
        )}

        {!selectedCategory() ? (
          <div class="category-selection">
            <p class="selection-hint">Select a category to start searching</p>

            <div class="categories-grid">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Card
                    key={cat.id}
                    class="category-card"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setQuery('');
                      setResults([]);
                      setErrorMessage(null);
                      setInfoMessage(null);
                      resetJackettState();
                    }}
                  >
                    <div class="category-icon" style={{ color: cat.color }}>
                      <Icon size={48} />
                    </div>
                    <h3 class="category-label">{cat.label}</h3>
                    <p class="category-description">{cat.description}</p>

                    <div class="category-arrow">
                      <ArrowRight size={20} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div class="search-interface">
            <div class="search-bar">
              <button
                class="back-button"
                onClick={() => {
                  setSelectedCategory(null);
                  setQuery('');
                  setResults([]);
                  setErrorMessage(null);
                  setInfoMessage(null);
                  resetJackettState();
                }}
              >
                {'<- Back'}
              </button>

              <div class="search-input-wrapper">
                <Search size={20} />
                <Input
                  placeholder={`Search ${categories.find((c) => c.id === selectedCategory())?.label.toLowerCase()} in TMDB...`}
                  value={query()}
                  onInput={setQuery}
                  class="search-input"
                />
                <Button
                  variant="primary"
                  onClick={handleSearch}
                  disabled={loading() || !query()}
                >
                  {loading() ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            <div class="search-results">
              {results().length === 0 && !loading() && query() && (
                <div class="no-results">
                  <Search size={48} />
                  <p>No results found for "{query()}"</p>
                </div>
              )}

              {results().map((result) => (
                <Card class="result-card" key={result.id}>
                  <div class="result-poster">
                    {result.posterPath ? (
                      <img src={result.posterPath} alt={result.title} />
                    ) : (
                      <div class="poster-placeholder">
                        {selectedCategory() === 'movies' && <Film size={32} />}
                        {selectedCategory() === 'tv' && <Tv size={32} />}
                        {selectedCategory() === 'music' && <Music size={32} />}
                      </div>
                    )}
                  </div>

                  <div class="result-info">
                    <h3>{result.title}</h3>
                    <p>{result.overview || result.genre || 'No description available.'}</p>

                    <div class="result-actions">
                      {result.inLibrary ? (
                        <>
                          <Badge variant="success">
                            <Check size={14} />
                            In Library
                          </Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void prepareJackettSearch(result)}
                            disabled={loadingJackettFilters() && selectedJackettItem()?.id === result.id}
                          >
                            {loadingJackettFilters() && selectedJackettItem()?.id === result.id ? 'Loading Filters...' : 'Find Releases'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void addToLibrary(result)}
                          disabled={addingId() === result.id}
                        >
                          {addingId() === result.id ? 'Adding...' : 'Add to Library'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {selectedJackettItem() && (
              <Card class="jackett-panel">
                <div class="jackett-panel-header">
                  <h3 class="card-title">Jackett Release Search</h3>
                  <p class="jackett-panel-subtitle">
                    Selected: <strong>{selectedJackettItem()?.title}</strong>
                  </p>
                </div>

                {loadingJackettFilters() && <p>Loading indexer filter options...</p>}
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

                    <div class="jackett-actions">
                      <Button
                        variant="primary"
                        onClick={handleJackettSearch}
                        disabled={jackettSearching() || selectedIndexerIds().length === 0}
                      >
                        {jackettSearching() ? 'Searching Indexers...' : 'Search Jackett Releases'}
                      </Button>
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
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
