import { createAsync, useNavigate } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Badge } from '~/components/ui';
import { Film, Plus, Search, Filter } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

import moviesTitleAsset from '../../../buttons_assets/generated/transparent/movies_title_1771671611181.png';
import addButtonAsset from '../../../buttons_assets/generated/transparent/add_button_1771671540967.png';
import filterButtonAsset from '../../../buttons_assets/generated/transparent/filter_button_2d_1771672880924.png';
import searchBarAsset from '../../../buttons_assets/generated/transparent/search_bar_asset_2d_1771672842516.png';
import panelBackgroundAsset from '../../../buttons_assets/generated/transparent/panel_background_2d_1771672912476.png';

const fetchMovies = () => fetchJson<any[]>('/api/media/movies');

export default function Movies() {
  const moviesResult = createAsync(fetchMovies);
  const navigate = useNavigate();

  const movies = () => moviesResult()?.data ?? [];
  const error = () => moviesResult()?.error;
  const openMovieSearch = () => void navigate('/search?category=movies');
  const openMovieDetails = (movieId: number) => void navigate(`/movies/${movieId}`);

  return (
    <MainLayout>
      <div class="movies-page">
        <header class="page-header">
          <div class="header-wide-panel">
            <div class="header-title" style="align-items: flex-end;">
              <img src={moviesTitleAsset} alt="Movies" class="hero-image-title" />
            </div>

            <div class="header-actions">
              <div class="search-box playful-search-box" style={`background-image: url(${searchBarAsset});`}>
                <Search size={18} />
                <input type="text" placeholder="Search movies..." class="input" />
              </div>
              <button class="hero-action-button" title="Filter" aria-label="Filter" style="margin-right: 0.5rem;">
                <img src={filterButtonAsset} alt="Filter" />
              </button>

              <button class="hero-action-button" onClick={openMovieSearch} title="Add Movie" aria-label="Add Movie">
                <img src={addButtonAsset} alt="Add Movie" />
              </button>
            </div>
          </div>
        </header>

        {error() && (
          <Card>
            <p>Failed to load movies: {error()}</p>
          </Card>
        )}

        <div class="movies-grid">
          {movies().length === 0 ? (
            <div class="empty-state playful-panel">
              <h3>No movies yet</h3>
              <p>Start building your library by adding movies</p>
              <button class="hero-action-button" onClick={openMovieSearch} title="Add Your First Movie" aria-label="Add Your First Movie" style="transform: scale(1.2); margin-top: 1rem;">
                <img src={addButtonAsset} alt="Add Your First Movie" />
              </button>
            </div>
          ) : (
            movies().map((movie: any) => (
              <Card class="movie-card" key={movie.id} onClick={() => openMovieDetails(movie.id)}>
                <div class="movie-poster">
                  {movie.posterPath ? (
                    <img src={movie.posterPath} alt={movie.title} />
                  ) : (
                    <div class="poster-placeholder">
                      <Film size={48} />
                    </div>
                  )}
                  <div class="movie-overlay">
                    <Badge variant={movie.status === 'downloaded' ? 'success' : 'warning'}>
                      {movie.status}
                    </Badge>
                  </div>
                </div>

                <div class="movie-info">
                  <h3 class="movie-title">{movie.title}</h3>
                  <p class="movie-meta">
                    {movie.releaseDate && new Date(movie.releaseDate).getFullYear()}
                    {movie.runtime && ` - ${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`}
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
