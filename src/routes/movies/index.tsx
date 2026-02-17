import { createAsync, useNavigate } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, Button, Badge } from '~/components/ui';
import { Film, Plus, Search, Filter } from 'lucide-solid';
import { fetchJson } from '~/lib/api';

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
          <div class="header-title">
            <Film size={28} class="header-icon" />
            <div>
              <h1 class="section-title">Movies</h1>
              <p class="header-subtitle">{movies().length} titles in library</p>
            </div>
          </div>

          <div class="header-actions">
            <div class="search-box">
              <Search size={18} />
              <input type="text" placeholder="Search movies..." class="input" />
            </div>
            <Button variant="ghost">
              <Filter size={18} />
              Filter
            </Button>

            <Button variant="primary" onClick={openMovieSearch}>
              <Plus size={18} />
              Add Movie
            </Button>
          </div>
        </header>

        {error() && (
          <Card>
            <p>Failed to load movies: {error()}</p>
          </Card>
        )}

        <div class="movies-grid">
          {movies().length === 0 ? (
            <div class="empty-state">
              <Film size={64} />
              <h3>No movies yet</h3>
              <p>Start building your library by adding movies</p>
              <Button variant="primary" size="lg" onClick={openMovieSearch}>
                <Plus size={20} />
                Add Your First Movie
              </Button>
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
