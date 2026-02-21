import { createAsync, useNavigate } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button } from '~/components/ui';
import { Music, Plus, Search, Filter, Disc } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

import musicTitleAsset from '../../../buttons_assets/generated/transparent/music_title_1771671512664.png';
import addButtonAsset from '../../../buttons_assets/generated/transparent/add_button_1771671540967.png';
import filterButtonAsset from '../../../buttons_assets/generated/transparent/filter_button_2d_1771672880924.png';
import searchBarAsset from '../../../buttons_assets/generated/transparent/search_bar_asset_2d_1771672842516.png';
import panelBackgroundAsset from '../../../buttons_assets/generated/transparent/panel_background_2d_1771672912476.png';

const fetchArtists = () => fetchJson<any[]>('/api/media/music/artists');

export default function MusicPage() {
  const artistsResult = createAsync(fetchArtists);
  const navigate = useNavigate();

  const artists = () => artistsResult()?.data ?? [];
  const error = () => artistsResult()?.error;
  const openMusicSearch = () => void navigate('/search?category=music');

  return (
    <MainLayout>
      <div class="music-page">
        <header class="page-header">
          <div class="header-wide-panel">
            <div class="header-title" style="align-items: flex-end;">
              <img src={musicTitleAsset} alt="Music" class="hero-image-title" />
            </div>

            <div class="header-actions">
              <div class="search-box playful-search-box" style={`background-image: url(${searchBarAsset});`}>
                <Search size={18} />
                <input type="text" placeholder="Search artists..." class="input" />
              </div>

              <button class="hero-action-button" title="Filter" aria-label="Filter" style="margin-right: 0.5rem;">
                <img src={filterButtonAsset} alt="Filter" />
              </button>

              <button class="hero-action-button" onClick={openMusicSearch} title="Add Artist" aria-label="Add Artist">
                <img src={addButtonAsset} alt="Add Artist" />
              </button>
            </div>
          </div>
        </header>

        {error() && (
          <Card>
            <p>Failed to load artists: {error()}</p>
          </Card>
        )}

        <div class="artists-grid">
          {artists().length === 0 ? (
            <div class="empty-state playful-panel">
              <h3>No music yet</h3>
              <p>Start building your library by adding artists</p>
              <button class="hero-action-button" onClick={openMusicSearch} title="Add Your First Artist" aria-label="Add Your First Artist" style="transform: scale(1.2); margin-top: 1rem;">
                <img src={addButtonAsset} alt="Add Your First Artist" />
              </button>
            </div>
          ) : (
            artists().map((artist: any) => (
              <Card
                class="artist-card"
                key={artist.id}
                onClick={() => void navigate(`/music/${artist.id}`)}
              >
                <div class="artist-image">
                  {artist.posterPath ? (
                    <img src={artist.posterPath} alt={artist.title} />
                  ) : (
                    <div class="image-placeholder">
                      <Music size={48} />
                    </div>
                  )}
                </div>

                <div class="artist-info">
                  <h3 class="artist-name">{artist.title}</h3>
                  <p class="artist-genre">{artist.genre || 'Unknown Genre'}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
