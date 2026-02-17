import { createAsync } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Badge } from '~/components/ui';
import { Tv, Plus, Search, Filter } from 'lucide-solid';
import { getApiUrl } from '~/lib/api';

const fetchSeries = async () => {
  try {
    const res = await fetch(getApiUrl('/api/media/tv'));
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export default function TVShows() {
  const series = createAsync(fetchSeries);

  return (
    <MainLayout>
      <div class="tv-page">
        {/* Header */}
        <header class="page-header">
          <div class="header-title">
            <Tv size={28} class="header-icon" />
            <div>
              <h1 class="section-title">TV Shows</h1>
              <p class="header-subtitle">{series()?.length || 0} series in library</p>
            </div>
          </div>
          
          <div class="header-actions">
            <div class="search-box">
              <Search size={18} />
              <input type="text" placeholder="Search TV shows..." class="input" />
            </div>
            
            <Button variant="ghost">
              <Filter size={18} />
              Filter
            </Button>
            
            <Button variant="primary">
              <Plus size={18} />
              Add Series
            </Button>
          </div>
        </header>

        {/* Series Grid */}
        <div class="series-grid">
          {series()?.length === 0 ? (
            <div class="empty-state">
              <Tv size={64} />
              <h3>No TV shows yet</h3>
              <p>Start building your library by adding TV series</p>
              <Button variant="primary" size="lg">
                <Plus size={20} />
                Add Your First Series
              </Button>
            </div>
          ) : (
            series()?.map((show: any) => (
              <Card class="series-card" key={show.id}>
                <div class="series-poster">
                  {show.posterPath ? (
                    <img src={show.posterPath} alt={show.title} />
                  ) : (
                    <div class="poster-placeholder">
                      <Tv size={48} />
                    </div>
                  )}
                  <div class="series-overlay">
                    <Badge variant={show.status === 'downloaded' ? 'success' : show.status === 'continuing' ? 'info' : 'warning'}>
                      {show.status}
                    </Badge>
                  </div>
                </div>
                
                <div class="series-info">
                  <h3 class="series-title">{show.title}</h3>
                  <p class="series-meta">
                    {show.releaseDate && new Date(show.releaseDate).getFullYear()}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
