import { createAsync, useNavigate } from '@solidjs/router';
import { Card, Button, Badge } from '~/components/ui';
import { Tv, Plus, Search, Filter } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

const fetchSeries = () => fetchJson<any[]>('/api/media/tv');

export default function TVShows() {
  const seriesResult = createAsync(fetchSeries);
  const navigate = useNavigate();

  const series = () => seriesResult()?.data ?? [];
  const error = () => seriesResult()?.error;
  const openTvSearch = () => void navigate('/search?category=tv');
  const openTvDetails = (seriesId: number) => void navigate(`/tv/${seriesId}`);

  return (
    <>

      <div class="tv-page">
        <header class="cinematic-page-header">
          <div class="header-title">
            <Tv size={28} class="header-icon" />
            <div>
              <h1 class="cinematic-title">Series</h1>
              <p class="cinematic-subtitle">{series().length} series in vault</p>
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

            <Button variant="primary" onClick={openTvSearch}>
              <Plus size={18} />
              Add Series
            </Button>
          </div>
        </header>

        {error() && (
          <Card>
            <p>Failed to load TV series: {error()}</p>
          </Card>
        )}

        <div class="series-grid">
          {series().length === 0 ? (
            <div class="empty-state">
              <Tv size={64} />
              <h3>No TV shows yet</h3>
              <p>Start building your library by adding TV series</p>
              <Button variant="primary" size="lg" onClick={openTvSearch}>
                <Plus size={20} />
                Add Your First Series
              </Button>
            </div>
          ) : (
            series().map((show: any) => (
              <Card class="series-card" key={show.id} onClick={() => openTvDetails(show.id)}>
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
    </>

  );
}
