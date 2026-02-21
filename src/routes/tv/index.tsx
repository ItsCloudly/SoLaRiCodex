import { createAsync, useNavigate } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Badge } from '~/components/ui';
import { Tv, Plus, Search, Filter } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

import tvShowsTitleAsset from '../../../buttons_assets/generated/transparent/tv_shows_title_1771671476027.png';
import addButtonAsset from '../../../buttons_assets/generated/transparent/add_button_1771671540967.png';
import filterButtonAsset from '../../../buttons_assets/generated/transparent/filter_button_2d_1771672880924.png';
import searchBarAsset from '../../../buttons_assets/generated/transparent/search_bar_asset_2d_1771672842516.png';
import panelBackgroundAsset from '../../../buttons_assets/generated/transparent/panel_background_2d_1771672912476.png';

const fetchSeries = () => fetchJson<any[]>('/api/media/tv');

export default function TVShows() {
  const seriesResult = createAsync(fetchSeries);
  const navigate = useNavigate();

  const series = () => seriesResult()?.data ?? [];
  const error = () => seriesResult()?.error;
  const openTvSearch = () => void navigate('/search?category=tv');
  const openTvDetails = (seriesId: number) => void navigate(`/tv/${seriesId}`);

  return (
    <MainLayout>
      <div class="tv-page">
        <header class="page-header">
          <div class="header-wide-panel">
            <div class="header-title" style="align-items: flex-end;">
              <img src={tvShowsTitleAsset} alt="TV Shows" class="hero-image-title" />
            </div>

            <div class="header-actions">
              <div class="search-box playful-search-box" style={`background-image: url(${searchBarAsset});`}>
                <Search size={18} />
                <input type="text" placeholder="Search TV shows..." class="input" />
              </div>

              <button class="hero-action-button" title="Filter" aria-label="Filter" style="margin-right: 0.5rem;">
                <img src={filterButtonAsset} alt="Filter" />
              </button>

              <button class="hero-action-button" onClick={openTvSearch} title="Add Series" aria-label="Add Series">
                <img src={addButtonAsset} alt="Add Series" />
              </button>
            </div>
          </div>
        </header>

        {error() && (
          <Card>
            <p>Failed to load TV series: {error()}</p>
          </Card>
        )}

        <div class="series-grid">
          {series().length === 0 ? (
            <div class="empty-state playful-panel">
              <h3>No TV shows yet</h3>
              <p>Start building your library by adding TV series</p>
              <button class="hero-action-button" onClick={openTvSearch} title="Add Your First Series" aria-label="Add Your First Series" style="transform: scale(1.2); margin-top: 1rem;">
                <img src={addButtonAsset} alt="Add Your First Series" />
              </button>
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
    </MainLayout>
  );
}
