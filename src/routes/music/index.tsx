import { createAsync, useNavigate } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button } from '~/components/ui';
import { Music, Plus, Search, Filter, Disc } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

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
          <div class="header-title">
            <Music size={28} class="header-icon" />
            <div>
              <h1 class="section-title">Music</h1>
              <p class="header-subtitle">{artists().length} artists in library</p>
            </div>
          </div>

          <div class="header-actions">
            <div class="search-box">
              <Search size={18} />
              <input type="text" placeholder="Search artists..." class="input" />
            </div>

            <Button variant="ghost">
              <Filter size={18} />
              Filter
            </Button>

            <Button variant="primary" onClick={openMusicSearch}>
              <Plus size={18} />
              Add Artist
            </Button>
          </div>
        </header>

        {error() && (
          <Card>
            <p>Failed to load artists: {error()}</p>
          </Card>
        )}

        <div class="artists-grid">
          {artists().length === 0 ? (
            <div class="empty-state">
              <Disc size={64} />
              <h3>No music yet</h3>
              <p>Start building your library by adding artists</p>
              <Button variant="primary" size="lg" onClick={openMusicSearch}>
                <Plus size={20} />
                Add Your First Artist
              </Button>
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
