import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Input } from '~/components/ui';
import { Search, Film, Tv, Music, ArrowRight } from 'lucide-solid';
import { createSignal } from 'solid-js';

const categories = [
  { id: 'movies', label: 'Movies', icon: Film, color: 'var(--accent-primary)', description: 'Search for movies to add to your library' },
  { id: 'tv', label: 'TV Shows', icon: Tv, color: 'var(--accent-secondary)', description: 'Search for TV series and episodes' },
  { id: 'music', label: 'Music', icon: Music, color: 'var(--success)', description: 'Search for artists and albums' },
];

export default function SearchPage() {
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(false);

  const handleSearch = async () => {
    if (!query() || !selectedCategory()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/search/${selectedCategory()}?q=${encodeURIComponent(query())}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div class="search-page">
        <header class="page-header">
          <Search size={28} class="header-icon" />
          <h1 class="section-title">Search</h1>
        </header>

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
                }}
              >
                {'<- Back'}
              </button>
              
              <div class="search-input-wrapper">
                <Search size={20} />
                <Input
                  placeholder={`Search ${categories.find(c => c.id === selectedCategory())?.label.toLowerCase()}...`}
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

              {results().map((result: any) => (
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
                    <p>{result.overview || result.description}</p>
                    
                    <div class="result-actions">
                      <Button variant="primary" size="sm">Add to Library</Button>
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

