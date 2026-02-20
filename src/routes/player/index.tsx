import { MediaPlayerPanel, useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { Card } from '~/components/ui';

export default function PlayerPage() {
  const mediaPlayer = useMediaPlayer();

  return (
    <>

      <div class="player-page">
        <header class="cinematic-page-header">
          <div class="header-title">
            <h1 class="cinematic-title">Nexus Player</h1>
            <p class="cinematic-subtitle">Media playback and controls</p>
          </div>
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
    </>

  );
}
