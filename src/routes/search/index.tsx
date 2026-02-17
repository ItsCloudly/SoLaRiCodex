import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Input, Badge } from '~/components/ui';
import { Search, Film, Tv, Music, ArrowRight, Check } from 'lucide-solid';
import { createSignal } from 'solid-js';
import { requestJson } from '~/lib/api';

type Category = 'movies' | 'tv' | 'music';

interface SearchResultItem {
  id: number | string;
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  releaseDate?: string | null;
  genre?: string | null;
  inLibrary: boolean;
  source: 'library' | 'manual';
}

const categories = [
  { id: 'movies', label: 'Movies', icon: Film, color: 'var(--accent-primary)', description: 'Search for movies to add to your library' },
  { id: 'tv', label: 'TV Shows', icon: Tv, color: 'var(--accent-secondary)', description: 'Search for TV series and episodes' },
  { id: 'music', label: 'Music', icon: Music, color: 'var(--success)', description: 'Search for artists and albums' },
] as const;

export default function SearchPage() {
  const [selectedCategory, setSelectedCategory] = createSignal<Category | null>(null);
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<SearchResultItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [addingId, setAddingId] = createSignal<number | string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [infoMessage, setInfoMessage] = createSignal<string | null>(null);

  const handleSearch = async () => {
    const category = selectedCategory();
    if (!query() || !category) return;

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

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
      releaseDate: result.releaseDate || undefined,
    };

    if (category === 'tv') {
      endpoint = '/api/media/tv';
    }

    if (category === 'music') {
      endpoint = '/api/media/music/artists';
      payload = {
        title: result.title,
        overview: result.overview || undefined,
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
            ? { ...item, inLibrary: true, source: 'library' }
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
        ? { ...item, inLibrary: true, source: 'library' }
        : item
    )));
    setInfoMessage(`${result.title} added to library.`);
    setAddingId(null);
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
                    onClick={() => setSelectedCategory(cat.id)}
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
                }}
              >
                {'<- Back'}
              </button>

              <div class="search-input-wrapper">
                <Search size={20} />
                <Input
                  placeholder={`Search ${categories.find((c) => c.id === selectedCategory())?.label.toLowerCase()}...`}
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
                <Card class="result-card" key={String(result.id)}>
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
                        <Badge variant="success">
                          <Check size={14} />
                          In Library
                        </Badge>
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
          </div>
        )}
      </div>
    </MainLayout>
  );
}
