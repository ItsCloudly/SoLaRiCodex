import { createAsync, useNavigate } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import MainLayout from '~/components/layout/MainLayout';
import { useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { fetchJson } from '~/lib/api';
import moviesButtonAsset from '../../buttons_assets/extracted/movies_button_cutout.webp';
import tvShowsButtonAsset from '../../buttons_assets/extracted/tv_shows_button_cutout.webp';
import activeDownloadsButtonAsset from '../../buttons_assets/extracted/active_downloads_button_cutout.webp';
import searchButtonAsset from '../../buttons_assets/extracted/search_button_cutout.webp';
import quickPreviewFrameStarAsset from '../../buttons_assets/extracted/quick_preview_frame_cutout.webp';
import quickPreviewFrameHeartAsset from '../../buttons_assets/extracted/quick_preview_frame_2_cutout.webp';

interface PlaybackRecentVideoItem {
  id: string;
  mediaId: number;
  mediaType: 'video';
  mediaKind: 'movie' | 'episode';
  title: string;
  subtitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  streamUrl: string;
  progressPercent?: number;
  updatedAt: number;
}

interface PlaybackRecentResponse {
  items: PlaybackRecentVideoItem[];
}

const fetchRecentPlayback = () => fetchJson<PlaybackRecentResponse>('/api/media/playback/recent?limit=6');

export default function Dashboard() {
  const navigate = useNavigate();
  const mediaPlayer = useMediaPlayer();
  const recentResult = createAsync(fetchRecentPlayback);
  const recentError = () => recentResult()?.error;
  const previewItems = createMemo(() => (recentResult()?.data?.items || []).slice(0, 2));

  const openPreviewInPlayer = (item: PlaybackRecentVideoItem) => {
    mediaPlayer.openItem({
      id: item.id,
      mediaId: item.mediaId,
      mediaKind: item.mediaKind,
      mediaType: 'video',
      title: item.title,
      subtitle: item.subtitle,
      streamUrl: item.streamUrl,
      artworkUrl: item.posterPath || undefined,
    });
    void navigate('/player');
  };

  const previewFrameFor = (index: number) => (index % 2 === 0 ? quickPreviewFrameStarAsset : quickPreviewFrameHeartAsset);

  return (
    <MainLayout>
      <div class="dashboard playful-dashboard">
        <section class="dashboard-hero-stage">
          <div class="playful-main-hub">
            <button class="hero-badge-button hero-badge-movies" onClick={() => void navigate('/movies')} aria-label="Open Movies">
              <img src={moviesButtonAsset} alt="" />
              <span class="sr-only">Open Movies</span>
            </button>
            <button class="hero-badge-button hero-badge-tv" onClick={() => void navigate('/tv')} aria-label="Open TV Shows">
              <img src={tvShowsButtonAsset} alt="" />
              <span class="sr-only">Open TV Shows</span>
            </button>
            <button class="hero-badge-button hero-badge-downloads" onClick={() => void navigate('/activity')} aria-label="Open Active Downloads">
              <img src={activeDownloadsButtonAsset} alt="" />
              <span class="sr-only">Open Active Downloads</span>
            </button>
            <button class="hero-badge-button hero-badge-search" onClick={() => void navigate('/search')} aria-label="Open Search">
              <img src={searchButtonAsset} alt="" />
              <span class="sr-only">Open Search</span>
            </button>

            <div class="live-preview-grid">
              {previewItems().map((item, index) => (
                <button
                  class={`live-preview-card ${index === 0 ? 'left' : 'right'}`}
                  onClick={() => openPreviewInPlayer(item)}
                  aria-label={`Play ${item.title}`}
                >
                  <img class="live-preview-frame" src={previewFrameFor(index)} alt="" />
                  <div class="live-preview-media-shell">
                    <video
                      class="live-preview-video"
                      src={item.streamUrl}
                      autoplay
                      muted
                      loop
                      playsinline
                      preload="metadata"
                      poster={item.backdropPath || item.posterPath || undefined}
                    />
                  </div>
                  <div class="live-preview-overlay">
                    <p>{item.subtitle || 'Recently watched'}</p>
                    <h3>{item.title}</h3>
                    <span>{typeof item.progressPercent === 'number' ? `${item.progressPercent}% watched` : 'Resume now'}</span>
                  </div>
                </button>
              ))}

              <Show when={previewItems().length === 0}>
                <div class="live-preview-card fallback left">
                  <img class="live-preview-frame" src={quickPreviewFrameStarAsset} alt="" />
                  <div class="live-preview-media-shell fallback-media" />
                  <div class="live-preview-overlay">
                    <p>Waiting for history</p>
                    <h3>Watch something to unlock live previews</h3>
                    <span>Playback previews show up here</span>
                  </div>
                </div>
              </Show>

              <Show when={previewItems().length < 2}>
                <div class="live-preview-card fallback right">
                  <img class="live-preview-frame" src={quickPreviewFrameHeartAsset} alt="" />
                  <div class="live-preview-media-shell fallback-media" />
                  <div class="live-preview-overlay">
                    <p>Waiting for history</p>
                    <h3>Watch something to unlock live previews</h3>
                    <span>Playback previews show up here</span>
                  </div>
                </div>
              </Show>
            </div>

            <Show when={recentError()}>
              <div class="hero-inline-error" role="status">{recentError()}</div>
            </Show>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
