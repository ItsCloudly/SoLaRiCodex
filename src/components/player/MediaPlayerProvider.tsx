import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
  useContext,
} from 'solid-js';
import { Disc3, Expand, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-solid';
import { requestJson } from '~/lib/api';

export type PlayerMediaType = 'video' | 'audio';
export type PlayerMediaKind = 'movie' | 'episode' | 'track';

export interface PlayerQueueItem {
  id: string;
  mediaId: number;
  mediaType: PlayerMediaType;
  mediaKind: PlayerMediaKind;
  title: string;
  subtitle?: string;
  streamUrl: string;
  artworkUrl?: string;
}

interface PlaybackProgressEntry {
  mediaKind: PlayerMediaKind;
  mediaId: number;
  positionSeconds: number;
  durationSeconds?: number;
  updatedAt: number;
}

interface PlaybackProgressResponse {
  entry: PlaybackProgressEntry | null;
  inferredDurationSeconds?: number | null;
}

interface PlaybackLibraryResponse {
  items: PlayerQueueItem[];
}

interface MediaPlayerContextValue {
  isOpen: Accessor<boolean>;
  queue: Accessor<PlayerQueueItem[]>;
  currentItem: Accessor<PlayerQueueItem | null>;
  currentIndex: Accessor<number>;
  playToken: Accessor<number>;
  playbackError: Accessor<string | null>;
  openItem: (item: PlayerQueueItem) => void;
  openPlaylist: (items: PlayerQueueItem[], startIndex?: number) => void;
  appendToQueue: (item: PlayerQueueItem) => boolean;
  playAt: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  close: () => void;
  setPlaybackError: (message: string | null) => void;
}

const PLAYER_VOLUME_STORAGE_KEY = 'solari-player-volume';
const PLAYER_MUTED_STORAGE_KEY = 'solari-player-muted';

const MediaPlayerContext = createContext<MediaPlayerContextValue>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const safeSeconds = Math.floor(seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function MediaPlayerPanel() {
  const player = useMediaPlayer();

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [durationSeconds, setDurationSeconds] = createSignal(0);
  const [currentSeconds, setCurrentSeconds] = createSignal(0);
  const [volume, setVolume] = createSignal(0.85);
  const [muted, setMuted] = createSignal(false);
  const [resumeSeconds, setResumeSeconds] = createSignal<number | null>(null);
  const [savedDurationSeconds, setSavedDurationSeconds] = createSignal<number | null>(null);
  const [didApplyResume, setDidApplyResume] = createSignal(false);
  const [lastPersistedKey, setLastPersistedKey] = createSignal<string | null>(null);
  const [lastPersistedSecond, setLastPersistedSecond] = createSignal(0);
  const [autoplayRequested, setAutoplayRequested] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [showFullscreenControls, setShowFullscreenControls] = createSignal(true);
  const [isScrubbing, setIsScrubbing] = createSignal(false);
  const [scrubSeconds, setScrubSeconds] = createSignal(0);
  const [libraryItems, setLibraryItems] = createSignal<PlayerQueueItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = createSignal(false);
  const [libraryError, setLibraryError] = createSignal<string | null>(null);
  const [libraryQuery, setLibraryQuery] = createSignal('');
  const [playlistFeedback, setPlaylistFeedback] = createSignal<string | null>(null);
  const [artworkLoadFailed, setArtworkLoadFailed] = createSignal(false);
  const [isOpeningExternal, setIsOpeningExternal] = createSignal(false);
  const [compatibilitySeekBaseSeconds, setCompatibilitySeekBaseSeconds] = createSignal(0);

  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let videoStageRef: HTMLDivElement | undefined;
  let controlsHideTimeout: ReturnType<typeof setTimeout> | undefined;

  const getActiveElement = (): HTMLMediaElement | null => {
    const item = player.currentItem();
    if (!item) return null;
    return item.mediaType === 'video' ? videoRef || null : audioRef || null;
  };

  const hasPrevious = createMemo(() => player.currentIndex() > 0);
  const hasNext = createMemo(() => player.currentIndex() < player.queue().length - 1);
  const isVideoMode = createMemo(() => player.currentItem()?.mediaType === 'video');
  const currentPlaylistKind = createMemo<PlayerMediaKind | null>(() => {
    const mediaKind = player.currentItem()?.mediaKind;
    if (mediaKind === 'episode' || mediaKind === 'track') return mediaKind;
    return null;
  });
  const showPlaylist = createMemo(() => currentPlaylistKind() !== null);
  const playlistKindLabel = createMemo(() => (
    currentPlaylistKind() === 'episode' ? 'shows' : 'music'
  ));
  const showInlineControls = createMemo(() => !isVideoMode() || !isFullscreen());
  const filteredLibraryItems = createMemo(() => {
    const query = libraryQuery().trim().toLowerCase();
    const allowedKind = currentPlaylistKind();
    const queuedIds = new Set(player.queue().map((item) => item.id));
    let available = libraryItems().filter((item) => !queuedIds.has(item.id));
    if (allowedKind) {
      available = available.filter((item) => item.mediaKind === allowedKind);
    }

    if (query.length === 0) return available.slice(0, 80);
    return available
      .filter((item) => `${item.title} ${item.subtitle || ''}`.toLowerCase().includes(query))
      .slice(0, 80);
  });
  const progressPercent = createMemo(() => {
    const duration = durationSeconds();
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    const position = isScrubbing() ? scrubSeconds() : currentSeconds();
    return clamp((position / duration) * 100, 0, 100);
  });

  const syncElementVolume = () => {
    const mediaElement = getActiveElement();
    if (!mediaElement) return;
    mediaElement.volume = clamp(volume(), 0, 1);
    mediaElement.muted = muted();
  };

  const clearControlsHideTimeout = () => {
    if (controlsHideTimeout) {
      clearTimeout(controlsHideTimeout);
      controlsHideTimeout = undefined;
    }
  };

  const scheduleFullscreenControlsHide = (delayMs = 1300) => {
    clearControlsHideTimeout();
    controlsHideTimeout = setTimeout(() => {
      if (isFullscreen()) {
        setShowFullscreenControls(false);
      }
    }, delayMs);
  };

  const revealFullscreenControls = () => {
    if (!isFullscreen()) return;
    setShowFullscreenControls(true);
    scheduleFullscreenControlsHide();
  };

  const loadPlaybackLibrary = async () => {
    setIsLoadingLibrary(true);
    setLibraryError(null);

    const response = await requestJson<PlaybackLibraryResponse>('/api/media/playback/library');
    if (response.error || !response.data) {
      setLibraryItems([]);
      setLibraryError(response.error || 'Failed to load local library items.');
      setIsLoadingLibrary(false);
      return;
    }

    const items = response.data.items || [];
    setLibraryItems(items);
    setIsLoadingLibrary(false);
  };

  const persistProgress = async (options?: { force?: boolean; completed?: boolean }) => {
    const item = player.currentItem();
    const mediaElement = getActiveElement();
    if (!item || !mediaElement) return;
    if (item.mediaKind === 'track') return;

    const currentTime = Number.isFinite(mediaElement.currentTime) ? mediaElement.currentTime : 0;
    const absoluteCurrentTime = (
      item.mediaType === 'video' && isCompatibilityVideoUrl(item.streamUrl)
    )
      ? currentTime + compatibilitySeekBaseSeconds()
      : currentTime;
    const detectedDuration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : 0;
    const knownSavedDuration = savedDurationSeconds() || 0;
    const isUnreliableShortVideoDuration = (
      item.mediaType === 'video'
      && detectedDuration > 0
      && detectedDuration < 120
      && knownSavedDuration >= 300
    );
    const duration = isUnreliableShortVideoDuration
      ? knownSavedDuration
      : detectedDuration;
    const completed = options?.completed || (duration > 0 && absoluteCurrentTime >= Math.max(0, duration - 3));
    const progressKey = `${item.mediaKind}:${item.mediaId}`;

    if (!options?.force && lastPersistedKey() === progressKey && Math.abs(absoluteCurrentTime - lastPersistedSecond()) < 5) {
      return;
    }

    if (absoluteCurrentTime < 1 && !completed) return;

    const response = await requestJson<{ entry?: PlaybackProgressEntry | null; cleared?: boolean }>('/api/media/playback/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaKind: item.mediaKind,
        mediaId: item.mediaId,
        positionSeconds: absoluteCurrentTime,
        durationSeconds: duration > 0 ? duration : undefined,
        completed,
      }),
    });

    if (response.error) return;
    setLastPersistedKey(progressKey);
    setLastPersistedSecond(absoluteCurrentTime);
  };

  const loadProgressForCurrent = async () => {
    const item = player.currentItem();
    if (!item) return;
    if (item.mediaKind === 'track') {
      setResumeSeconds(null);
      return;
    }
    const requestKey = `${item.mediaKind}:${item.mediaId}`;

    const response = await requestJson<PlaybackProgressResponse>(`/api/media/playback/progress/${item.mediaKind}/${item.mediaId}`);
    const activeItem = player.currentItem();
    const activeKey = activeItem ? `${activeItem.mediaKind}:${activeItem.mediaId}` : null;
    if (!activeKey || activeKey !== requestKey) return;

    if (response.error || !response.data?.entry) {
      setResumeSeconds(null);
      const inferred = response.data?.inferredDurationSeconds;
      setSavedDurationSeconds(typeof inferred === 'number' && inferred > 0 ? inferred : null);
      return;
    }

    const savedSeconds = response.data.entry.positionSeconds;
    if (!Number.isFinite(savedSeconds) || savedSeconds < 3) {
      setResumeSeconds(null);
      setSavedDurationSeconds(
        typeof response.data.entry.durationSeconds === 'number' && response.data.entry.durationSeconds > 0
          ? response.data.entry.durationSeconds
          : null,
      );
      return;
    }

    setSavedDurationSeconds(
      typeof response.data.entry.durationSeconds === 'number' && response.data.entry.durationSeconds > 0
        ? response.data.entry.durationSeconds
        : (typeof response.data.inferredDurationSeconds === 'number' && response.data.inferredDurationSeconds > 0
          ? response.data.inferredDurationSeconds
          : null),
    );
    setResumeSeconds(savedSeconds);
  };

  const clearStoredProgressForCurrent = async () => {
    const item = player.currentItem();
    const mediaElement = getActiveElement();
    if (!item) return;

    const duration = mediaElement && Number.isFinite(mediaElement.duration) ? mediaElement.duration : 0;

    await requestJson<{ cleared?: boolean }>('/api/media/playback/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaKind: item.mediaKind,
        mediaId: item.mediaId,
        positionSeconds: 0,
        durationSeconds: duration > 0 ? duration : undefined,
        completed: true,
      }),
    });
  };

  const startOver = async () => {
    const mediaElement = getActiveElement();
    const item = player.currentItem();
    if (mediaElement) {
      if (item?.mediaType === 'video' && isCompatibilityVideoUrl(item.streamUrl)) {
        await seekByCompatibilityRestart(0);
      } else {
        mediaElement.currentTime = 0;
      }
      setCurrentSeconds(0);
    }

    setCompatibilitySeekBaseSeconds(0);
    setResumeSeconds(null);
    setDidApplyResume(true);
    await clearStoredProgressForCurrent();
  };

  const closePlayer = async () => {
    await persistProgress({ force: true });
    player.close();
  };

  const goPrevious = () => {
    void persistProgress({ force: true });
    player.playPrevious();
  };

  const goNext = () => {
    void persistProgress({ force: true });
    player.playNext();
  };

  const jumpToIndex = (index: number) => {
    void persistProgress({ force: true });
    player.playAt(index);
  };

  const addLibraryItemToPlaylist = (item: PlayerQueueItem) => {
    const appended = player.appendToQueue(item);
    if (!appended) {
      setPlaylistFeedback(`Already in playlist: ${item.title}`);
      return;
    }

    setPlaylistFeedback(`Added: ${item.title}`);
  };

  const playCurrent = async () => {
    const mediaElement = getActiveElement();
    if (!mediaElement) return;

    try {
      await mediaElement.play();
      player.setPlaybackError(null);
      setIsPlaying(true);
    } catch {
      const duration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : 0;
      const atTail = duration > 0 && mediaElement.currentTime >= Math.max(0, duration - 2);

      if (atTail) {
        mediaElement.currentTime = 0;
        setCurrentSeconds(0);
        try {
          await mediaElement.play();
          player.setPlaybackError(null);
          setIsPlaying(true);
          return;
        } catch {
          // fallback to visible error below
        }
      }

      setIsPlaying(false);
      player.setPlaybackError('Could not start playback. Try pressing Play again, or the file codec may be unsupported.');
    }
  };

  const pauseCurrent = () => {
    const mediaElement = getActiveElement();
    if (!mediaElement) return;
    mediaElement.pause();
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    if (isPlaying()) {
      pauseCurrent();
      return;
    }
    void playCurrent();
  };

  const toggleFullscreen = async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setShowFullscreenControls(true);
        clearControlsHideTimeout();
        return;
      }

      const target = videoStageRef || videoRef;
      if (!target || !target.requestFullscreen) return;
      await target.requestFullscreen();
      setShowFullscreenControls(true);
      scheduleFullscreenControlsHide(1700);
    } catch {
      player.setPlaybackError('Fullscreen is not available in this browser context.');
    }
  };

  const handleVideoStageMouseMove = (event: MouseEvent) => {
    if (!isFullscreen() || !videoStageRef) return;
    const bounds = videoStageRef.getBoundingClientRect();
    const distanceToBottom = bounds.bottom - event.clientY;
    if (distanceToBottom <= 150) {
      revealFullscreenControls();
    }
  };

  const handleVideoStageMouseLeave = () => {
    if (!isFullscreen()) return;
    scheduleFullscreenControlsHide(280);
  };

  const isCompatibilityVideoUrl = (url: string): boolean => (
    url.includes('/api/media/playback/video-compat/')
  );

  const seekByCompatibilityRestart = async (targetSeconds: number) => {
    const item = player.currentItem();
    const mediaElement = getActiveElement();
    if (!item || !mediaElement || item.mediaType !== 'video' || !isCompatibilityVideoUrl(item.streamUrl)) return;

    const duration = durationSeconds();
    const clampedTarget = clamp(targetSeconds, 0, duration > 0 ? duration : targetSeconds);
    const wasPlaying = !mediaElement.paused;
    const streamUrl = new URL(item.streamUrl, window.location.origin);
    if (clampedTarget > 0.05) {
      streamUrl.searchParams.set('start', String(clampedTarget));
    } else {
      streamUrl.searchParams.delete('start');
    }

    setAutoplayRequested(wasPlaying);
    setResumeSeconds(null);
    setDidApplyResume(true);
    setCompatibilitySeekBaseSeconds(clampedTarget);
    mediaElement.src = streamUrl.pathname + streamUrl.search;
    mediaElement.currentTime = 0;
    mediaElement.load();
    setCurrentSeconds(clampedTarget);
  };

  const seekBySeconds = (deltaSeconds: number) => {
    const mediaElement = getActiveElement();
    if (!mediaElement) return;

    const duration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : durationSeconds() || Infinity;
    const item = player.currentItem();
    const baseCurrent = (
      item?.mediaType === 'video' && isCompatibilityVideoUrl(item.streamUrl)
    )
      ? currentSeconds()
      : mediaElement.currentTime;
    const nextPosition = clamp(baseCurrent + deltaSeconds, 0, duration);
    seekToSeconds(nextPosition);
  };

  const seekToSeconds = (nextSeconds: number) => {
    if (!Number.isFinite(nextSeconds)) return;
    const mediaElement = getActiveElement();
    if (!mediaElement) return;

    const duration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : durationSeconds();
    const clamped = clamp(nextSeconds, 0, duration > 0 ? duration : nextSeconds);
    const item = player.currentItem();
    if (item?.mediaType === 'video' && isCompatibilityVideoUrl(item.streamUrl)) {
      void seekByCompatibilityRestart(clamped);
      return;
    }
    mediaElement.currentTime = clamped;
    setCurrentSeconds(clamped);
  };

  const handleLoadedMetadata = (event: Event) => {
    const mediaElement = event.currentTarget as HTMLMediaElement;
    const detectedDuration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : 0;
    const knownSavedDuration = savedDurationSeconds() || 0;
    const shouldPreferSavedDuration = (
      player.currentItem()?.mediaType === 'video'
      && knownSavedDuration > 0
      && (detectedDuration <= 0 || detectedDuration < Math.max(120, knownSavedDuration * 0.6))
    );
    const effectiveDuration = shouldPreferSavedDuration ? knownSavedDuration : detectedDuration;
    setDurationSeconds(effectiveDuration);

    const savedResumeSeconds = resumeSeconds();
    if (!didApplyResume() && typeof savedResumeSeconds === 'number' && savedResumeSeconds > 2) {
      const isNearEnd = effectiveDuration > 0 && savedResumeSeconds >= Math.max(0, effectiveDuration - 20);
      const isBeyondDuration = effectiveDuration > 0 && savedResumeSeconds > effectiveDuration + 1;
      const resumeWouldBeInvalid = isNearEnd || isBeyondDuration;

      if (resumeWouldBeInvalid) {
        mediaElement.currentTime = 0;
        setResumeSeconds(null);
        setDidApplyResume(true);
        setCurrentSeconds(0);
        void clearStoredProgressForCurrent();
        syncElementVolume();
        return;
      }

      const resumeTarget = clamp(
        savedResumeSeconds,
        0,
        effectiveDuration > 2 ? Math.max(0, effectiveDuration - 2) : savedResumeSeconds,
      );
      mediaElement.currentTime = resumeTarget;
      setDidApplyResume(true);
      setCurrentSeconds(resumeTarget);
    } else {
      setCurrentSeconds((mediaElement.currentTime || 0) + compatibilitySeekBaseSeconds());
    }

    syncElementVolume();
  };

  const handleCanPlay = () => {
    if (!autoplayRequested()) return;
    setAutoplayRequested(false);
    void playCurrent();
  };

  const handleTimeUpdate = (event: Event) => {
    const mediaElement = event.currentTarget as HTMLMediaElement;
    const item = player.currentItem();
    const absoluteSeconds = (
      item?.mediaType === 'video' && isCompatibilityVideoUrl(item.streamUrl)
    )
      ? (mediaElement.currentTime || 0) + compatibilitySeekBaseSeconds()
      : (mediaElement.currentTime || 0);
    setCurrentSeconds(absoluteSeconds);
    void persistProgress();
  };

  const handleEnded = () => {
    void persistProgress({ force: true, completed: true });
    if (hasNext()) {
      player.playNext();
      return;
    }
    setIsPlaying(false);
  };

  const handleMediaError = () => {
    player.setPlaybackError('Playback failed after compatibility mode. Try "Open in system player".');
    setIsPlaying(false);
    setAutoplayRequested(false);
  };

  const openCurrentInExternalPlayer = async () => {
    const item = player.currentItem();
    if (!item || isOpeningExternal()) return;

    setIsOpeningExternal(true);
    const response = await requestJson<{ ok?: boolean }>(
      `/api/media/playback/open-external/${item.mediaKind}/${item.mediaId}`,
      { method: 'POST' },
    );
    setIsOpeningExternal(false);

    if (response.error) {
      player.setPlaybackError(`Playback failed in browser, and external open failed: ${response.error}`);
      return;
    }

    player.setPlaybackError(null);
  };

  const renderProgress = (mode: 'inline' | 'overlay' = 'inline') => (
    <div class={`media-player-progress-wrap ${mode === 'overlay' ? 'overlay' : ''}`}>
      <span>{formatDuration(isScrubbing() ? scrubSeconds() : currentSeconds())}</span>
      <input
        class="media-player-progress"
        type="range"
        min="0"
        max={durationSeconds() > 0 ? durationSeconds() : 0}
        step="0.1"
        value={isScrubbing() ? scrubSeconds() : currentSeconds()}
        style={{ '--progress': `${progressPercent()}%` }}
        onPointerDown={() => {
          setIsScrubbing(true);
          setScrubSeconds(currentSeconds());
        }}
        onInput={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isFinite(nextValue)) {
            setScrubSeconds(nextValue);
          }
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isFinite(nextValue)) {
            seekToSeconds(nextValue);
          }
          setIsScrubbing(false);
        }}
        onPointerUp={() => setIsScrubbing(false)}
        onBlur={() => setIsScrubbing(false)}
      />
      <span>{formatDuration(durationSeconds())}</span>
    </div>
  );

  const renderControls = (mode: 'inline' | 'overlay' = 'inline') => (
    <div class={`media-player-controls ${mode === 'overlay' ? 'overlay' : ''}`}>
      <div class="media-player-buttons">
        <button
          type="button"
          class="media-player-control-button"
          onClick={() => void goPrevious()}
          disabled={!hasPrevious()}
          aria-label="Previous item"
        >
          <SkipBack size={17} />
        </button>
        <button type="button" class="media-player-control-button" onClick={() => seekBySeconds(-5)} aria-label="Back 5 seconds">
          -5s
        </button>
        <button
          type="button"
          class="media-player-control-button prominent"
          onClick={togglePlayPause}
          aria-label={isPlaying() ? 'Pause' : 'Play'}
        >
          {isPlaying() ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button type="button" class="media-player-control-button" onClick={() => seekBySeconds(5)} aria-label="Forward 5 seconds">
          +5s
        </button>
        <button
          type="button"
          class="media-player-control-button"
          onClick={() => void goNext()}
          disabled={!hasNext()}
          aria-label="Next item"
        >
          <SkipForward size={17} />
        </button>
      </div>

      <div class="media-player-volume">
        <button
          type="button"
          class="media-player-control-button"
          aria-label={muted() ? 'Unmute' : 'Mute'}
          onClick={() => setMuted((value) => !value)}
        >
          {muted() ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume()}
          onInput={(event) => {
            setVolume(clamp(event.currentTarget.valueAsNumber, 0, 1));
            if (muted() && event.currentTarget.valueAsNumber > 0) {
              setMuted(false);
            }
          }}
        />
      </div>
    </div>
  );

  const renderPlaylistSection = (mode: 'default' | 'side' = 'default') => (
    <section class={`media-player-playlist-block ${mode === 'side' ? 'side' : ''}`}>
      <div class="media-player-playlist-head">
        <h4>Current Playlist</h4>
        <span>{player.queue().length} item{player.queue().length === 1 ? '' : 's'}</span>
      </div>
      <div class="media-player-playlist-list">
        {player.queue().map((item, index) => (
          <button
            type="button"
            class={`media-player-playlist-item ${index === player.currentIndex() ? 'active' : ''}`}
            onClick={() => void jumpToIndex(index)}
          >
            <span class="media-player-playlist-index">{String(index + 1).padStart(2, '0')}</span>
            <span class="media-player-playlist-labels">
              <span>{item.title}</span>
              <Show when={item.subtitle}>
                <small>{item.subtitle}</small>
              </Show>
              <Show when={index === player.currentIndex()}>
                <small class="media-player-playlist-status">Now Playing</small>
              </Show>
              <Show when={index === player.currentIndex() + 1}>
                <small class="media-player-playlist-status">Up Next</small>
              </Show>
            </span>
          </button>
        ))}
      </div>

      <div class="media-player-playlist-add">
        <div class="media-player-playlist-search-row">
          <input
            id="playlist-library-search"
            class="input"
            type="search"
            value={libraryQuery()}
            onInput={(event) => setLibraryQuery(event.currentTarget.value)}
            placeholder={`Search ${playlistKindLabel()}...`}
          />
          <button
            type="button"
            class="media-player-icon-button"
            onClick={() => void loadPlaybackLibrary()}
            disabled={isLoadingLibrary()}
          >
            {isLoadingLibrary() ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <Show when={!isLoadingLibrary() && filteredLibraryItems().length > 0}>
          <div class="media-player-library-results">
            {filteredLibraryItems().map((item) => (
              <div class="media-player-library-item">
                <div class="media-player-library-item-labels">
                  <span>{item.title}</span>
                  <Show when={item.subtitle}>
                    <small>{item.subtitle}</small>
                  </Show>
                </div>
                <button
                  type="button"
                  class="media-player-icon-button"
                  onClick={() => addLibraryItemToPlaylist(item)}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </Show>
        <Show when={libraryError()}>
          <p class="media-player-error">{libraryError()}</p>
        </Show>
        <Show when={playlistFeedback()}>
          <p class="media-player-playlist-feedback">{playlistFeedback()}</p>
        </Show>
      </div>
    </section>
  );

  onMount(() => {
    if (typeof window === 'undefined') return;

    const storedVolume = Number.parseFloat(window.localStorage.getItem(PLAYER_VOLUME_STORAGE_KEY) || '');
    if (Number.isFinite(storedVolume)) {
      setVolume(clamp(storedVolume, 0, 1));
    }

    const storedMuted = window.localStorage.getItem(PLAYER_MUTED_STORAGE_KEY);
    if (storedMuted === 'true') {
      setMuted(true);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!player.isOpen()) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
      if (isTypingTarget) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekBySeconds(-5);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekBySeconds(5);
      }
    };
    const handleBeforeUnload = () => {
      void persistProgress({ force: true });
    };
    const handleFullscreenChange = () => {
      const fullscreenActive = Boolean(document.fullscreenElement)
        && document.fullscreenElement === (videoStageRef || null);
      setIsFullscreen(fullscreenActive);
      setShowFullscreenControls(true);
      if (fullscreenActive) {
        scheduleFullscreenControlsHide(1700);
      } else {
        clearControlsHideTimeout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearControlsHideTimeout();
    });
  });

  createEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PLAYER_VOLUME_STORAGE_KEY, String(volume()));
    window.localStorage.setItem(PLAYER_MUTED_STORAGE_KEY, String(muted()));
  });

  createEffect(() => {
    syncElementVolume();
  });

  createEffect(() => {
    if (!player.isOpen()) {
      setPlaylistFeedback(null);
      return;
    }
    void loadPlaybackLibrary();
  });

  createEffect(() => {
    const open = player.isOpen();
    const item = player.currentItem();
    const token = player.playToken();
    if (!open || !item) return;

    setResumeSeconds(null);
    setSavedDurationSeconds(null);
    setDidApplyResume(false);
    setLastPersistedKey(null);
    setLastPersistedSecond(0);
    setAutoplayRequested(true);
    void loadProgressForCurrent();

    void token;
  });

  createEffect(() => {
    const currentItem = player.currentItem();
    void currentItem?.id;
    setArtworkLoadFailed(false);
  });

  createEffect(() => {
    const open = player.isOpen();
    const item = player.currentItem();
    const token = player.playToken();
    if (!open || !item) return;

    const expectedItemId = item.id;
    queueMicrotask(() => {
      const hydrateActiveElement = (retriesLeft = 8) => {
        if (player.currentItem()?.id !== expectedItemId) return;
        const mediaElement = getActiveElement();
        if (!mediaElement) {
          if (retriesLeft > 0) {
            setTimeout(() => hydrateActiveElement(retriesLeft - 1), 16);
          }
          return;
        }

        player.setPlaybackError(null);
        setDurationSeconds(0);
        setCurrentSeconds(0);
        setCompatibilitySeekBaseSeconds(0);
        setIsPlaying(false);

        // Ensure we always switch to the newly selected stream before load().
        mediaElement.src = item.streamUrl;
        mediaElement.currentTime = 0;
        mediaElement.load();
        syncElementVolume();
      };

      hydrateActiveElement();
    });

    void token;
  });

  return (
    <Show when={player.isOpen() && player.currentItem()}>
      <div
        ref={panelRef}
        class={`media-player-shell ${player.currentItem()?.mediaType === 'audio' ? 'audio-mode' : 'video-mode'}`}
      >
        <div class="media-player-main">
          <div class="media-player-head">
            <div class="media-player-titles">
              <p class="media-player-kicker">{player.currentItem()?.mediaType === 'audio' ? 'Now Playing' : 'Now Watching'}</p>
              <h3>{player.currentItem()?.title}</h3>
              <Show when={player.currentItem()?.subtitle}>
                <p class="media-player-subtitle">{player.currentItem()?.subtitle}</p>
              </Show>
            </div>

            <div class="media-player-head-actions">
              <Show when={player.currentItem()?.mediaType === 'video'}>
                <button
                  type="button"
                  class="media-player-icon-button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={isFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen() ? <Minimize2 size={16} /> : <Expand size={16} />}
                </button>
              </Show>
              <button type="button" class="media-player-icon-button" onClick={() => void closePlayer()} aria-label="Close player">
                <X size={16} />
              </button>
            </div>
          </div>

          <Show when={typeof resumeSeconds() === 'number' && didApplyResume()}>
            <div class="media-player-resume-note">
              <span>Resumed at {formatDuration(resumeSeconds() || 0)}</span>
              <button type="button" onClick={() => void startOver()}>Start over</button>
            </div>
          </Show>

          <Show when={player.currentItem()?.mediaType === 'audio'}>
            <div class="media-player-audio-layout">
              <div class="media-player-audio-stage">
                <Show
                  when={player.currentItem()?.artworkUrl && !artworkLoadFailed()}
                  fallback={(
                    <div class="media-player-audio-artwork media-player-audio-artwork-fallback" aria-hidden="true">
                      <Disc3 size={54} />
                    </div>
                  )}
                >
                  <img
                    class="media-player-audio-artwork"
                    src={player.currentItem()?.artworkUrl || ''}
                    alt={`${player.currentItem()?.subtitle || player.currentItem()?.title || 'Album'} artwork`}
                    onError={() => setArtworkLoadFailed(true)}
                  />
                </Show>
              </div>
              <Show when={showPlaylist()}>
                {renderPlaylistSection('side')}
              </Show>
            </div>
          </Show>

          <Show
            when={player.currentItem()?.mediaType === 'video'}
            fallback={(
              <audio
                ref={audioRef}
                preload="metadata"
                src={player.currentItem()?.streamUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                  setIsPlaying(false);
                  void persistProgress({ force: true });
                }}
                onEnded={handleEnded}
                onError={handleMediaError}
              />
            )}
          >
            <div
              ref={videoStageRef}
              class={`media-player-video-stage ${isFullscreen() ? 'is-fullscreen' : ''}`}
              onMouseMove={handleVideoStageMouseMove}
              onMouseLeave={handleVideoStageMouseLeave}
            >
              <video
                ref={videoRef}
                class="media-player-video"
                preload="metadata"
                src={player.currentItem()?.streamUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                  setIsPlaying(false);
                  void persistProgress({ force: true });
                }}
                onEnded={handleEnded}
                onError={handleMediaError}
              />

              <Show when={isFullscreen()}>
                <div class={`media-player-overlay-controls ${showFullscreenControls() ? 'visible' : ''}`}>
                  {renderProgress('overlay')}
                  {renderControls('overlay')}
                </div>
              </Show>
            </div>
          </Show>

          <Show when={showInlineControls()}>
            {renderProgress('inline')}
            {renderControls('inline')}
          </Show>

          <Show when={player.playbackError()}>
            <div class="media-player-error-wrap">
              <p class="media-player-error">{player.playbackError()}</p>
              <Show when={player.currentItem()?.mediaType === 'video'}>
                <button
                  type="button"
                  class="media-player-icon-button"
                  onClick={() => void openCurrentInExternalPlayer()}
                  disabled={isOpeningExternal()}
                >
                  {isOpeningExternal() ? 'Opening...' : 'Open in system player'}
                </button>
              </Show>
            </div>
          </Show>

          <Show when={showPlaylist() && player.currentItem()?.mediaType !== 'audio'}>
            {renderPlaylistSection()}
          </Show>
        </div>
      </div>
    </Show>
  );
}

export function MediaPlayerProvider(props: { children: JSX.Element }) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [queue, setQueue] = createSignal<PlayerQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [playToken, setPlayToken] = createSignal(0);
  const [playbackError, setPlaybackError] = createSignal<string | null>(null);

  const currentItem = createMemo(() => queue()[currentIndex()] || null);

  const openPlaylist = (items: PlayerQueueItem[], startIndex = 0) => {
    if (items.length === 0) return;
    const boundedStartIndex = clamp(Math.floor(startIndex), 0, items.length - 1);
    setQueue(items);
    setCurrentIndex(boundedStartIndex);
    setIsOpen(true);
    setPlaybackError(null);
    setPlayToken((value) => value + 1);
  };

  const openItem = (item: PlayerQueueItem) => {
    openPlaylist([item], 0);
  };

  const appendToQueue = (item: PlayerQueueItem): boolean => {
    const currentQueue = queue();
    if (currentQueue.some((queuedItem) => queuedItem.id === item.id)) {
      return false;
    }

    setQueue([...currentQueue, item]);
    return true;
  };

  const playAt = (index: number) => {
    const currentQueue = queue();
    if (index < 0 || index >= currentQueue.length) return;
    setCurrentIndex(index);
    setIsOpen(true);
    setPlaybackError(null);
    setPlayToken((value) => value + 1);
  };

  const playNext = () => {
    const nextIndex = currentIndex() + 1;
    if (nextIndex >= queue().length) return;
    playAt(nextIndex);
  };

  const playPrevious = () => {
    const previousIndex = currentIndex() - 1;
    if (previousIndex < 0) return;
    playAt(previousIndex);
  };

  const close = () => {
    setIsOpen(false);
    setQueue([]);
    setCurrentIndex(0);
    setPlaybackError(null);
    setPlayToken((value) => value + 1);
  };

  const contextValue: MediaPlayerContextValue = {
    isOpen,
    queue,
    currentItem,
    currentIndex,
    playToken,
    playbackError,
    openItem,
    openPlaylist,
    appendToQueue,
    playAt,
    playNext,
    playPrevious,
    close,
    setPlaybackError,
  };

  return (
    <MediaPlayerContext.Provider value={contextValue}>
      {props.children}
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer(): MediaPlayerContextValue {
  const context = useContext(MediaPlayerContext);
  if (!context) {
    throw new Error('useMediaPlayer must be used inside MediaPlayerProvider');
  }
  return context;
}
