import MainLayout from '~/components/layout/MainLayout';
import { MediaPlayerPanel, useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { Card } from '~/components/ui';

export default function PlayerPage() {
  const mediaPlayer = useMediaPlayer();

  return (
    <MainLayout>
      <div class="player-page">
        <header class="movie-details-header">
          <h1 class="section-title">Player</h1>
        </header>

        {mediaPlayer.currentItem() ? (
          <MediaPlayerPanel />
        ) : (
          <Card class="player-empty-card">
            <h3>No Media Selected</h3>
            <p>Select a downloaded movie, episode, or track from its details page, then it will open here.</p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
