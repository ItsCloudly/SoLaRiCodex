import { createAsync } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Badge } from '~/components/ui';
import { Music, Plus, Search, Filter, Disc } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

const fetchArtists = () => fetchJson<any[]>('/api/media/music/artists');

export default function MusicPage() {
  const artistsResult = createAsync(fetchArtists);

  const artists = () => artistsResult()?.data ?? [];
  const error = () => artistsResult()?.error;

  return (
    <MainLayout>
      <div class="music-page">
        <header class="page-header">
          <Music size={28} class="header-icon" />
          <div>
            <h1 class="section-title">Music</h1>
            <p class="header-subtitle">{artists().length} artists in library</p>
          </div>
        </header>

        <div class="header-actions">
          <div class="search-box">
            <Search size={18} />
            <input type="text" placeholder="Search artists..." class="input" />
          </div>

          <Button variant="ghost">
            <Filter size={18} />
            Filter
          </Button>

          <Button variant="primary">
            <Plus size={18} />
            Add Artist
          </Button>
        </div>

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
              <Button variant="primary" size="lg">
                <Plus size={20} />
                Add Your First Artist
              </Button>
            </div>
          ) : (
            artists().map((artist: any) => (
              <Card class="artist-card" key={artist.id}>
                <div class="artist-image">
                  {artist.posterPath ? (
                    <img src={artist.posterPath} alt={artist.title} />
                  ) : (
                    <div class="image-placeholder">
                      <Music size={48} />
                    </div>
                  )}
                  <div class="artist-overlay">
                    <Badge variant={artist.status === 'downloaded' ? 'success' : 'warning'}>
                      {artist.status}
                    </Badge>
                  </div>
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
