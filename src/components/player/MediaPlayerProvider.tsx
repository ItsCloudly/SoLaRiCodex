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
  untrack,
  useContext,
} from 'solid-js';
import { Disc3, Expand, GripVertical, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-solid';
import Hls from 'hls.js';
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

interface TrackLyricsPayload {
  provider: string;
  sourceId: string | null;
  syncedLrc: string | null;
  plainLyrics: string | null;
  updatedAt: number;
}

interface TrackLyricsResponse {
  status: 'ok';
  source: 'cache' | 'remote' | 'miss';
  lyrics: TrackLyricsPayload | null;
}

interface TrackMetadataResponse {
  trackId: number;
  title: string;
  artist: string | null;
  album: string | null;
}

interface VideoAudioTrackOption {
  id: string;
  source: 'embedded';
  streamIndex: number;
  language: string | null;
  title: string | null;
  codec: string | null;
  channels: number | null;
  default: boolean;
  label: string;
}

interface VideoSubtitleTrackOption {
  id: string;
  source: 'embedded' | 'external' | 'online';
  streamIndex: number | null;
  fileName: string | null;
  onlineToken?: string | null;
  language: string | null;
  title: string | null;
  codec: string | null;
  default: boolean;
  label: string;
}

interface VideoOptionsResponse {
  kind: 'movie' | 'episode';
  id: number;
  hasCompatibilityStream: boolean;
  audioTracks: VideoAudioTrackOption[];
  subtitleTracks: VideoSubtitleTrackOption[];
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
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  playAt: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  close: () => void;
  setPlaybackError: (message: string | null) => void;
}

const PLAYER_VOLUME_STORAGE_KEY = 'solari-player-volume';
const PLAYER_MUTED_STORAGE_KEY = 'solari-player-muted';
const PLAYER_PREFERRED_AUDIO_LANGUAGE_STORAGE_KEY = 'solari-player-preferred-audio-language';

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

function parseLrc(lyrics: string): Array<{ timeMs: number; text: string }> {
  const lines = lyrics.split(/\r?\n/);
  const entries: Array<{ timeMs: number; text: string }> = [];
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    timestampRegex.lastIndex = 0;
    const timestamps: number[] = [];
    let match = timestampRegex.exec(line);
    while (match) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const millisRaw = match[3] ? match[3].padEnd(3, '0') : '0';
      const millis = Number.parseInt(millisRaw, 10);
      if (Number.isFinite(minutes) && Number.isFinite(seconds) && Number.isFinite(millis)) {
        timestamps.push((minutes * 60 + seconds) * 1000 + millis);
      }
      match = timestampRegex.exec(line);
    }

    if (timestamps.length === 0) continue;
    const text = line.replace(timestampRegex, '').trim();
    if (!text) continue;

    for (const timeMs of timestamps) {
      entries.push({ timeMs, text });
    }
  }

  return entries.sort((a, b) => a.timeMs - b.timeMs);
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
  const [lastHandledPlayToken, setLastHandledPlayToken] = createSignal<number | null>(null);
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
  const [isVideoCompatibilityStream, setIsVideoCompatibilityStream] = createSignal(false);
  const [compatibilitySeekBaseSeconds, setCompatibilitySeekBaseSeconds] = createSignal(0);
  const [showLibraryPicker, setShowLibraryPicker] = createSignal(false);
  const [draggingIndex, setDraggingIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);
  const [audioPanelMode, setAudioPanelMode] = createSignal<'playlist' | 'lyrics'>('playlist');
  const [lyricsState, setLyricsState] = createSignal<{
    trackId: number | null;
    status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
    syncedLrc: string | null;
    plainLyrics: string | null;
    error: string | null;
  }>({
    trackId: null,
    status: 'idle',
    syncedLrc: null,
    plainLyrics: null,
    error: null,
  });
  const [lastScrolledLyricIndex, setLastScrolledLyricIndex] = createSignal<number | null>(null);
  const [trackMetadata, setTrackMetadata] = createSignal<{
    trackId: number | null;
    title: string | null;
    artist: string | null;
    album: string | null;
  }>({
    trackId: null,
    title: null,
    artist: null,
    album: null,
  });
  let hlsInstance: Hls | null = null;
  const [videoAudioTracks, setVideoAudioTracks] = createSignal<VideoAudioTrackOption[]>([]);
  const [videoSubtitleTracks, setVideoSubtitleTracks] = createSignal<VideoSubtitleTrackOption[]>([]);
  const [selectedVideoAudioStreamIndex, setSelectedVideoAudioStreamIndex] = createSignal<number | null>(null);
  const [selectedVideoSubtitleTrackId, setSelectedVideoSubtitleTrackId] = createSignal<string | null>(null);
  const [selectedVideoSubtitleSrc, setSelectedVideoSubtitleSrc] = createSignal<string | null>(null);
  const [preferredAudioLanguage, setPreferredAudioLanguage] = createSignal<string | null>(null);

  // Subtitle Customization State
  const [showSubtitleSettings, setShowSubtitleSettings] = createSignal(false);
  const [subtitleFontFamily, setSubtitleFontFamily] = createSignal('var(--font-body)');
  const [subtitleColor, setSubtitleColor] = createSignal('#ffffff');
  const [subtitleOpacity, setSubtitleOpacity] = createSignal(1);

  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let videoStageRef: HTMLDivElement | undefined;
  let controlsHideTimeout: ReturnType<typeof setTimeout> | undefined;
  let lyricsListRef: HTMLDivElement | undefined;
  let lyricsScrollAnimationFrame: number | null = null;
  let lyricsScrollTargetTop = 0;

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
  const currentTrackId = createMemo(() => {
    const item = player.currentItem();
    return item?.mediaKind === 'track' ? item.mediaId : null;
  });
  const showInlineControls = createMemo(() => !isVideoMode() || !isFullscreen());
  const selectedVideoSubtitleTrack = createMemo(() => {
    const selectedId = selectedVideoSubtitleTrackId();
    if (!selectedId) return null;
    return videoSubtitleTracks().find((track) => track.id === selectedId) || null;
  });
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
  const lyricsLines = createMemo(() => parseLrc(lyricsState().syncedLrc ?? ''));
  const audioDisplayTitle = createMemo(() => {
    const item = player.currentItem();
    if (item?.mediaKind !== 'track') return item?.title || '';
    return trackMetadata().title || item.title;
  });
  const audioDisplaySubtitle = createMemo(() => {
    const item = player.currentItem();
    if (item?.mediaKind !== 'track') return item?.subtitle || '';
    const meta = trackMetadata();
    if (meta.artist && meta.album) return `${meta.artist} - ${meta.album}`;
    if (meta.artist) return meta.artist;
    if (meta.album) return meta.album;
    return item.subtitle || '';
  });
  const activeLyricIndex = createMemo(() => {
    if (lyricsState().status !== 'ready') return -1;
    const lines = lyricsLines();
    if (lines.length === 0) return -1;
    const currentMs = currentSeconds() * 1000;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (currentMs >= lines[index].timeMs) {
        return index;
      }
    }
    return 0;
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

  const cancelLyricsScrollAnimation = () => {
    if (lyricsScrollAnimationFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(lyricsScrollAnimationFrame);
      lyricsScrollAnimationFrame = null;
    }
  };

  const ensureLyricsScrollRunner = () => {
    if (typeof window === 'undefined') return;
    const list = lyricsListRef;
    if (!list) return;
    if (lyricsScrollAnimationFrame !== null) return;

    const step = () => {
      const activeList = lyricsListRef;
      if (!activeList) {
        lyricsScrollAnimationFrame = null;
        return;
      }

      const delta = lyricsScrollTargetTop - activeList.scrollTop;
      if (Math.abs(delta) < 0.6) {
        activeList.scrollTop = lyricsScrollTargetTop;
        lyricsScrollAnimationFrame = null;
        return;
      }

      // Smooth pursuit to avoid jumpy restarts between fast lyric transitions.
      activeList.scrollTop += delta * 0.038;
      lyricsScrollAnimationFrame = window.requestAnimationFrame(step);
    };

    lyricsScrollAnimationFrame = window.requestAnimationFrame(step);
  };

  const scrollLyricsToActiveLine = (activeIndex: number) => {
    if (typeof window === 'undefined') return;
    const list = lyricsListRef;
    if (!list) return;
    const target = list.querySelector(`[data-lyric-index="${activeIndex}"]`) as HTMLElement | null;
    if (!target) return;

    const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
    const targetTop = target.offsetTop - ((list.clientHeight - target.clientHeight) / 2);
    const destination = clamp(targetTop, 0, maxScroll);
    lyricsScrollTargetTop = destination;
    ensureLyricsScrollRunner();
  };

  const getLyricLineRoleClass = (lineIndex: number): string => {
    const activeIndex = activeLyricIndex();
    if (activeIndex < 0) {
      if (lineIndex === 0) return 'next-primary';
      if (lineIndex > 0 && lineIndex <= 4) return 'upcoming';
      return 'far';
    }
    const offset = lineIndex - activeIndex;
    if (offset === 0) return 'active';
    if (offset === -1) return 'previous';
    if (offset === 1) return 'next-primary';
    if (offset > 1 && offset <= 5) return 'upcoming';
    if (offset < -1 && offset >= -3) return 'near';
    return 'far';
  };

  const normalizeLanguageCode = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'eng' || normalized === 'en') return 'en';
    if (normalized === 'ita' || normalized === 'it') return 'it';
    return normalized;
  };

  const buildVideoPlaybackUrl = (item: PlayerQueueItem, options?: { start?: number }): string => {
    if (typeof window === 'undefined') return item.streamUrl;
    if (item.streamUrl.startsWith('http://') || item.streamUrl.startsWith('https://')) {
      return item.streamUrl;
    }
    const streamUrl = new URL(item.streamUrl, window.location.origin);
    const selectedAudio = selectedVideoAudioStreamIndex();
    if (Number.isInteger(selectedAudio) && selectedAudio !== null) {
      streamUrl.searchParams.set('audio', String(selectedAudio));
    } else {
      streamUrl.searchParams.delete('audio');
    }

    const start = options?.start;
    if (typeof start === 'number' && Number.isFinite(start) && start > 0.05) {
      streamUrl.searchParams.set('start', String(start));
    } else {
      streamUrl.searchParams.delete('start');
    }

    return `${streamUrl.pathname}${streamUrl.search}`;
  };

  const buildSubtitleTrackSrc = (item: PlayerQueueItem, track: VideoSubtitleTrackOption): string | null => {
    if (typeof window === 'undefined') return null;
    if (item.mediaType !== 'video') return null;
    if (item.mediaKind !== 'movie' && item.mediaKind !== 'episode') return null;

    const url = new URL(
      `/api/media/playback/subtitles/${item.mediaKind}/${item.mediaId}`,
      window.location.origin,
    );
    url.searchParams.set('source', track.source);
    if (track.source === 'embedded' && typeof track.streamIndex === 'number') {
      url.searchParams.set('stream', String(track.streamIndex));
    }
    if (track.source === 'external' && track.fileName) {
      url.searchParams.set('file', track.fileName);
    }
    if (track.source === 'online' && track.onlineToken) {
      url.searchParams.set('token', track.onlineToken);
    }
    url.searchParams.set('t', String(Date.now()));
    return `${url.pathname}${url.search}`;
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

  const loadLyricsForTrack = async (trackId: number) => {
    const current = lyricsState();
    if (current.status === 'loading' && current.trackId === trackId) return;
    setLyricsState({
      trackId,
      status: 'loading',
      syncedLrc: null,
      plainLyrics: null,
      error: null,
    });

    const response = await requestJson<TrackLyricsResponse>(`/api/media/music/tracks/${trackId}/lyrics`);
    if (response.error || !response.data) {
      setLyricsState({
        trackId,
        status: 'error',
        syncedLrc: null,
        plainLyrics: null,
        error: response.error || 'Failed to load lyrics',
      });
      return;
    }

    const payload = response.data.lyrics;
    const syncedLrc = payload?.syncedLrc ?? null;
    const plainLyrics = payload?.plainLyrics ?? null;

    if (!syncedLrc && !plainLyrics) {
      setLyricsState({
        trackId,
        status: 'empty',
        syncedLrc: null,
        plainLyrics: null,
        error: null,
      });
      return;
    }

    setLyricsState({
      trackId,
      status: 'ready',
      syncedLrc,
      plainLyrics,
      error: null,
    });
  };

  const loadTrackMetadata = async (trackId: number) => {
    const response = await requestJson<TrackMetadataResponse>(`/api/media/music/tracks/${trackId}/meta`);
    if (response.error || !response.data) {
      return;
    }

    if (currentTrackId() !== trackId) return;
    setTrackMetadata({
      trackId,
      title: response.data.title || null,
      artist: response.data.artist || null,
      album: response.data.album || null,
    });
  };

  const loadVideoPlaybackOptions = async (item: PlayerQueueItem) => {
    if (item.mediaType !== 'video') return;
    if (item.mediaKind !== 'movie' && item.mediaKind !== 'episode') return;
    if (item.streamUrl.startsWith('http://') || item.streamUrl.startsWith('https://')) {
      // It's a remote live stream (like sports), so no local metadata exists.
      setVideoAudioTracks([]);
      setVideoSubtitleTracks([]);
      setSelectedVideoAudioStreamIndex(null);
      setSelectedVideoSubtitleTrackId(null);
      setSelectedVideoSubtitleSrc(null);
      setIsVideoCompatibilityStream(false);
      return;
    }

    const response = await requestJson<VideoOptionsResponse>(`/api/media/playback/video-options/${item.mediaKind}/${item.mediaId}`);
    if (response.error || !response.data) {
      setVideoAudioTracks([]);
      setVideoSubtitleTracks([]);
      setSelectedVideoAudioStreamIndex(null);
      setSelectedVideoSubtitleTrackId(null);
      setSelectedVideoSubtitleSrc(null);
      return;
    }

    const audioTracks = response.data.audioTracks || [];
    const subtitleTracks = response.data.subtitleTracks || [];
    setVideoAudioTracks(audioTracks);
    setVideoSubtitleTracks(subtitleTracks);

    const preferredLanguage = normalizeLanguageCode(preferredAudioLanguage());
    const languageMatch = preferredLanguage
      ? audioTracks.find((track) => normalizeLanguageCode(track.language) === preferredLanguage)
      : null;
    const defaultTrack = languageMatch
      || audioTracks.find((track) => track.default)
      || audioTracks[0]
      || null;

    setSelectedVideoAudioStreamIndex(defaultTrack ? defaultTrack.streamIndex : null);
    setSelectedVideoSubtitleTrackId(null);
    setSelectedVideoSubtitleSrc(null);
    setIsVideoCompatibilityStream(response.data.hasCompatibilityStream || false);
  };

  const persistProgress = async (options?: { force?: boolean; completed?: boolean }) => {
    const item = player.currentItem();
    const mediaElement = getActiveElement();
    if (!item || !mediaElement) return;
    if (item.mediaKind === 'track') return;

    const currentTime = Number.isFinite(mediaElement.currentTime) ? mediaElement.currentTime : 0;
    const absoluteCurrentTime = (
      item.mediaType === 'video' && isVideoCompatibilityStream()
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
      if (item?.mediaType === 'video' && isVideoCompatibilityStream()) {
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

  const openLibraryPicker = () => {
    setShowLibraryPicker(true);
    void loadPlaybackLibrary();
  };

  const closeLibraryPicker = () => {
    setShowLibraryPicker(false);
    setLibraryQuery('');
    setPlaylistFeedback(null);
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

  const seekByCompatibilityRestart = async (targetSeconds: number) => {
    const item = player.currentItem();
    const mediaElement = getActiveElement();
    if (!item || !mediaElement || item.mediaType !== 'video' || !isVideoCompatibilityStream()) return;

    const duration = durationSeconds();
    const clampedTarget = clamp(targetSeconds, 0, duration > 0 ? duration : targetSeconds);
    const wasPlaying = !mediaElement.paused;
    const playbackUrl = buildVideoPlaybackUrl(item, { start: clampedTarget });

    setAutoplayRequested(wasPlaying);
    setResumeSeconds(null);
    setDidApplyResume(true);
    setCompatibilitySeekBaseSeconds(clampedTarget);
    mediaElement.src = playbackUrl;
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
      item?.mediaType === 'video' && isVideoCompatibilityStream()
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
    if (item?.mediaType === 'video' && isVideoCompatibilityStream()) {
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
      item?.mediaType === 'video' && isVideoCompatibilityStream()
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
      />
      <span>{formatDuration(durationSeconds())}</span>
    </div>
  );

  const renderVideoTrackSelectors = () => {
    const item = player.currentItem();
    if (!item || item.mediaType !== 'video') return null;

    return (
      <div class="media-player-track-selectors" style={{ "position": "relative" }}>
        <label class="media-player-track-select" style={{ "display": "flex", "align-items": "center", "gap": "0.5rem", "font-weight": "bold" }}>
          <span>Audio</span>
          <select
            class="input"
            style={{ "padding": "0.4rem 0.8rem", "font-size": "0.9rem" }}
            value={selectedVideoAudioStreamIndex() === null ? '' : String(selectedVideoAudioStreamIndex())}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              const nextStream = raw ? Number.parseInt(raw, 10) : NaN;
              if (!Number.isFinite(nextStream)) {
                setSelectedVideoAudioStreamIndex(null);
                return;
              }
              const selectedTrack = videoAudioTracks().find((track) => track.streamIndex === nextStream);
              if (selectedTrack?.language) {
                setPreferredAudioLanguage(normalizeLanguageCode(selectedTrack.language));
              }
              setSelectedVideoAudioStreamIndex(nextStream);
            }}
          >
            {videoAudioTracks().map((track) => (
              <option value={String(track.streamIndex)}>{track.label}</option>
            ))}
          </select>
        </label>
        <label class="media-player-track-select" style={{ "display": "flex", "align-items": "center", "gap": "0.5rem", "font-weight": "bold" }}>
          <span>Subtitles</span>
          <select
            class="input"
            style={{ "padding": "0.4rem 0.8rem", "font-size": "0.9rem" }}
            value={selectedVideoSubtitleTrackId() || ''}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              setSelectedVideoSubtitleTrackId(raw.length > 0 ? raw : null);
            }}
          >
            <option value="">Off</option>
            {videoSubtitleTracks().map((track) => (
              <option value={track.id}>{track.label}</option>
            ))}
          </select>
        </label>

        <Show when={selectedVideoSubtitleTrackId()}>
          <button
            type="button"
            class="btn btn-sm"
            onClick={() => setShowSubtitleSettings(!showSubtitleSettings())}
            style={{ "margin-left": "0.5rem" }}
          >
            ⚙️ Style
          </button>
        </Show>

        <Show when={showSubtitleSettings() && selectedVideoSubtitleTrackId()}>
          <div
            class="card"
            style={{
              "position": "absolute",
              "bottom": "110%",
              "right": "0",
              "width": "260px",
              "z-index": "100",
              "display": "flex",
              "flex-direction": "column",
              "gap": "1rem",
              "padding": "1rem"
            }}
          >
            <div style={{ "display": "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "0.5rem" }}>
              <strong style={{ "font-family": "var(--font-display)", "color": "var(--accent-primary)" }}>Subtitle Style</strong>
              <button class="btn-ghost" onClick={() => setShowSubtitleSettings(false)} style={{ "cursor": "pointer", "border": "none", "background": "transparent" }}>
                <X size={16} />
              </button>
            </div>

            <label style={{ "display": "flex", "flex-direction": "column", "gap": "0.3rem", "font-weight": "bold", "font-size": "0.9rem" }}>
              Font Family
              <select class="input" style={{ "padding": "0.4rem", "font-size": "0.9rem" }} value={subtitleFontFamily()} onChange={(e) => setSubtitleFontFamily(e.currentTarget.value)}>
                <option value="var(--font-body)">Chewy (Bubbly)</option>
                <option value="var(--font-mono)">Comic Neue (Hand)</option>
                <option value="var(--font-display)">Shrikhand (Chunky)</option>
                <option value="sans-serif">Standard Sans</option>
              </select>
            </label>

            <label style={{ "display": "flex", "flex-direction": "column", "gap": "0.3rem", "font-weight": "bold", "font-size": "0.9rem" }}>
              Color
              <input type="color" class="input" style={{ "padding": "0.2rem", "height": "40px", "cursor": "pointer" }} value={subtitleColor()} onInput={(e) => setSubtitleColor(e.currentTarget.value)} />
            </label>

            <label style={{ "display": "flex", "flex-direction": "column", "gap": "0.3rem", "font-weight": "bold", "font-size": "0.9rem" }}>
              Opacity ({Math.round(subtitleOpacity() * 100)}%)
              <input type="range" class="input" min="0.1" max="1" step="0.1" value={subtitleOpacity()} onInput={(e) => setSubtitleOpacity(e.currentTarget.valueAsNumber)} />
            </label>
          </div>
        </Show>
      </div>
    );
  };

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
      <Show when={mode === 'inline' && player.currentItem()?.mediaType === 'video'}>
        {renderVideoTrackSelectors()}
      </Show>
    </div>
  );

  const renderPlaylistList = () => (
    <>
      <div class="media-player-playlist-list">
        {player.queue().map((item, index) => (
          <button
            type="button"
            class={`media-player-playlist-item ${index === player.currentIndex() ? 'active' : ''} ${draggingIndex() === index ? 'dragging' : ''} ${dragOverIndex() === index ? 'drag-over' : ''}`}
            onClick={() => void jumpToIndex(index)}
            onDragOver={(event) => {
              event.preventDefault();
              if (dragOverIndex() !== index) {
                setDragOverIndex(index);
              }
            }}
            onDragLeave={() => {
              if (dragOverIndex() === index) {
                setDragOverIndex(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer?.getData('application/x-solari-queue-index')
                || event.dataTransfer?.getData('text/plain');
              const fromIndex = raw ? Number.parseInt(raw, 10) : NaN;
              if (!Number.isFinite(fromIndex)) return;
              if (fromIndex === index) return;
              player.moveQueueItem(fromIndex, index);
              setDraggingIndex(null);
              setDragOverIndex(null);
            }}
          >
            <span
              class="media-player-drag-handle"
              draggable={true}
              aria-label="Drag to reorder"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => {
                event.stopPropagation();
                setDraggingIndex(index);
                setDragOverIndex(null);
                event.dataTransfer?.setData('text/plain', String(index));
                event.dataTransfer?.setDragImage(event.currentTarget, 8, 8);
                event.dataTransfer?.setData('application/x-solari-queue-index', String(index));
              }}
              onDragEnd={() => {
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
            >
              <GripVertical size={12} strokeWidth={1.6} />
            </span>
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
      <div class="media-player-playlist-footer">
        <button
          type="button"
          class="media-player-add-button"
          onClick={openLibraryPicker}
        >
          Add more +
        </button>
      </div>
      <Show when={playlistFeedback()}>
        <p class="media-player-playlist-feedback">{playlistFeedback()}</p>
      </Show>
    </>
  );

  const renderLyricsPanel = () => (
    <div class="media-player-lyrics-panel">
      <Show
        when={lyricsState().status === 'ready' && lyricsLines().length > 0}
        fallback={(
          <div class="media-player-lyrics-empty">
            <Show when={lyricsState().status === 'loading'}>
              <span>Loading synced lyrics...</span>
            </Show>
            <Show when={lyricsState().status === 'empty'}>
              <span>No synced lyrics found.</span>
            </Show>
            <Show when={lyricsState().status === 'ready' && lyricsLines().length === 0}>
              <span>No synced lyrics found.</span>
            </Show>
            <Show when={lyricsState().status === 'error'}>
              <span>{lyricsState().error || 'Lyrics unavailable.'}</span>
            </Show>
            <Show when={lyricsState().status === 'idle'}>
              <span>Tap Lyrics to load synced lines.</span>
            </Show>
          </div>
        )}
      >
        <div class="media-player-lyrics-stage" ref={lyricsListRef} aria-live="polite">
          {lyricsLines().map((line, index) => (
            <p
              class={`media-player-lyrics-line ${getLyricLineRoleClass(index)}`}
              data-lyric-index={index}
            >
              {line.text}
            </p>
          ))}
        </div>
      </Show>
    </div>
  );

  const renderAudioPanel = () => (
    <section class="media-player-playlist-block side">
      <div class="media-player-playlist-head">
        <div class="media-player-playlist-title">
          <h4>{audioPanelMode() === 'lyrics' ? 'Lyrics' : 'Current Playlist'}</h4>
          <Show when={audioPanelMode() === 'playlist'}>
            <span>{player.queue().length} item{player.queue().length === 1 ? '' : 's'}</span>
          </Show>
        </div>
        <Show when={currentTrackId() !== null}>
          <div class="media-player-panel-toggle" role="group" aria-label="Playlist or lyrics">
            <button
              type="button"
              class={`media-player-panel-toggle-button ${audioPanelMode() === 'playlist' ? 'active' : ''}`}
              aria-pressed={audioPanelMode() === 'playlist'}
              onClick={() => setAudioPanelMode('playlist')}
            >
              Playlist
            </button>
            <button
              type="button"
              class={`media-player-panel-toggle-button ${audioPanelMode() === 'lyrics' ? 'active' : ''}`}
              aria-pressed={audioPanelMode() === 'lyrics'}
              onClick={() => setAudioPanelMode('lyrics')}
            >
              Lyrics
            </button>
          </div>
        </Show>
      </div>
      <Show when={audioPanelMode() === 'lyrics'} fallback={renderPlaylistList()}>
        {renderLyricsPanel()}
      </Show>
    </section>
  );

  const renderPlaylistSection = (mode: 'default' | 'side' = 'default') => (
    <section class={`media-player-playlist-block ${mode === 'side' ? 'side' : ''}`}>
      <div class="media-player-playlist-head">
        <h4>Current Playlist</h4>
        <span>{player.queue().length} item{player.queue().length === 1 ? '' : 's'}</span>
      </div>
      {renderPlaylistList()}
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

    const storedPreferredAudioLanguage = window.localStorage.getItem(PLAYER_PREFERRED_AUDIO_LANGUAGE_STORAGE_KEY);
    if (storedPreferredAudioLanguage) {
      setPreferredAudioLanguage(storedPreferredAudioLanguage);
    }

    const storedSubFont = window.localStorage.getItem('solari-sub-font');
    if (storedSubFont) setSubtitleFontFamily(storedSubFont);

    const storedSubColor = window.localStorage.getItem('solari-sub-color');
    if (storedSubColor) setSubtitleColor(storedSubColor);

    const storedSubOpacity = window.localStorage.getItem('solari-sub-opacity');
    if (storedSubOpacity && !Number.isNaN(Number.parseFloat(storedSubOpacity))) {
      setSubtitleOpacity(Number.parseFloat(storedSubOpacity));
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
      cancelLyricsScrollAnimation();
    });
  });

  createEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PLAYER_VOLUME_STORAGE_KEY, String(volume()));
    window.localStorage.setItem(PLAYER_MUTED_STORAGE_KEY, String(muted()));
    const preferredLanguage = preferredAudioLanguage();
    if (preferredLanguage) {
      window.localStorage.setItem(PLAYER_PREFERRED_AUDIO_LANGUAGE_STORAGE_KEY, preferredLanguage);
    } else {
      window.localStorage.removeItem(PLAYER_PREFERRED_AUDIO_LANGUAGE_STORAGE_KEY);
    }
  });

  createEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('solari-sub-font', subtitleFontFamily());
    window.localStorage.setItem('solari-sub-color', subtitleColor());
    window.localStorage.setItem('solari-sub-opacity', String(subtitleOpacity()));
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
    const shouldAutoplay = lastHandledPlayToken() !== token;
    setLastHandledPlayToken(token);
    setAutoplayRequested(shouldAutoplay);
    void loadProgressForCurrent();
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

        // Handle HLS streams for non-Apple browsers
        const targetSrc = item.mediaType === 'video' ? buildVideoPlaybackUrl(item) : item.streamUrl;

        if (targetSrc.includes('.m3u8') && Hls.isSupported() && item.mediaType === 'video') {
          if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
          }
          hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });
          hlsInstance.loadSource(targetSrc);
          hlsInstance.attachMedia(mediaElement);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            syncElementVolume();
            mediaElement.play().catch(e => console.warn('HLS autoplay blocked:', e));
          });
        } else {
          // Standard MP4 / WebM / Native Apple HLS
          if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
          }
          mediaElement.src = targetSrc;
          mediaElement.currentTime = 0;
          mediaElement.load();
          syncElementVolume();
        }
      };

      hydrateActiveElement();
    });

    onCleanup(() => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
    });

    void token;
  });

  createEffect(() => {
    const trackId = currentTrackId();
    if (!trackId) {
      setTrackMetadata({
        trackId: null,
        title: null,
        artist: null,
        album: null,
      });
      setLyricsState({
        trackId: null,
        status: 'idle',
        syncedLrc: null,
        plainLyrics: null,
        error: null,
      });
      setAudioPanelMode('playlist');
      setLastScrolledLyricIndex(null);
      return;
    }

    if (lyricsState().trackId !== trackId) {
      setLyricsState({
        trackId,
        status: 'idle',
        syncedLrc: null,
        plainLyrics: null,
        error: null,
      });
      setLastScrolledLyricIndex(null);
    }

    if (trackMetadata().trackId !== trackId) {
      setTrackMetadata({
        trackId,
        title: null,
        artist: null,
        album: null,
      });
      void loadTrackMetadata(trackId);
    }
  });

  createEffect(() => {
    if (audioPanelMode() !== 'lyrics') return;
    const trackId = currentTrackId();
    if (!trackId) return;
    if (lyricsState().trackId !== trackId || lyricsState().status === 'idle') {
      void loadLyricsForTrack(trackId);
    }
  });

  createEffect(() => {
    if (audioPanelMode() !== 'lyrics') {
      setLastScrolledLyricIndex(null);
      cancelLyricsScrollAnimation();
      return;
    }
    const activeIndex = activeLyricIndex();
    if (activeIndex < 0 || activeIndex === lastScrolledLyricIndex()) return;
    setLastScrolledLyricIndex(activeIndex);
    queueMicrotask(() => {
      scrollLyricsToActiveLine(activeIndex);
    });
  });

  createEffect(() => {
    const trackId = currentTrackId();
    if (!trackId) return;
    if (trackMetadata().trackId !== trackId) return;
    if (trackMetadata().title) return;
    void loadTrackMetadata(trackId);
  });

  createEffect(() => {
    const item = player.currentItem();
    if (!item || item.mediaType !== 'video' || (item.mediaKind !== 'movie' && item.mediaKind !== 'episode')) {
      setVideoAudioTracks([]);
      setVideoSubtitleTracks([]);
      setSelectedVideoAudioStreamIndex(null);
      setSelectedVideoSubtitleTrackId(null);
      setSelectedVideoSubtitleSrc(null);
      return;
    }
    void loadVideoPlaybackOptions(item);
  });

  createEffect(() => {
    const item = player.currentItem();
    const subtitleTrack = selectedVideoSubtitleTrack();
    if (!item || !subtitleTrack || item.mediaType !== 'video') {
      setSelectedVideoSubtitleSrc(null);
      return;
    }
    const src = buildSubtitleTrackSrc(item, subtitleTrack);
    setSelectedVideoSubtitleSrc(src);
  });

  createEffect(() => {
    const item = player.currentItem();
    if (!item || item.mediaType !== 'video') return;
    if (!isVideoCompatibilityStream()) return;
    const selectedAudio = selectedVideoAudioStreamIndex();
    if (selectedAudio === null) return;
    if (!videoRef) return;
    if (Number.isFinite(videoRef.currentTime)) {
      const stableCurrentSeconds = untrack(currentSeconds);
      void seekByCompatibilityRestart(stableCurrentSeconds);
    }
  });

  return (
    <Show when={player.isOpen() && player.currentItem()}>
      <div
        ref={panelRef}
        class={`media-player-shell ${player.currentItem()?.mediaType === 'audio' ? 'audio-mode' : 'video-mode'}`}
      >
        <div class="media-player-main">
          <div class="media-player-head">
            <Show when={player.currentItem()?.mediaType !== 'audio'}>
              <div class="media-player-titles">
                <p class="media-player-kicker">Now Watching</p>
                <h3>{player.currentItem()?.title}</h3>
                <Show when={player.currentItem()?.subtitle}>
                  <p class="media-player-subtitle">{player.currentItem()?.subtitle}</p>
                </Show>
              </div>
            </Show>

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
                <div class="media-player-audio-card">
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
                      alt={`${audioDisplaySubtitle() || audioDisplayTitle() || 'Album'} artwork`}
                      onError={() => setArtworkLoadFailed(true)}
                    />
                  </Show>
                  <div class="media-player-audio-caption">
                    <h4>{audioDisplayTitle()}</h4>
                    <Show when={audioDisplaySubtitle()}>
                      <p>{audioDisplaySubtitle()}</p>
                    </Show>
                    <div class="media-player-audio-transport">
                      {renderProgress('inline')}
                      {renderControls('inline')}
                    </div>
                  </div>
                </div>
              </div>
              <Show when={showPlaylist()}>
                <div class="media-player-playlist-card">
                  {renderAudioPanel()}
                </div>
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
              style={{
                "--sub-font": subtitleFontFamily(),
                "--sub-color": subtitleColor(),
                "--sub-opacity": subtitleOpacity()
              }}
            >
              <style>{`
                .media-player-video-stage video::cue {
                  font-family: var(--sub-font, var(--font-body));
                  color: var(--sub-color, #ffffff);
                  background-color: rgba(0, 0, 0, var(--sub-opacity, 1));
                  text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;
                  font-size: 1.5rem;
                }
              `}</style>
              <video
                ref={videoRef}
                class="media-player-video"
                preload="metadata"
                src={player.currentItem()?.mediaType === 'video' ? buildVideoPlaybackUrl(player.currentItem()!) : player.currentItem()?.streamUrl}
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
              >
                <Show when={selectedVideoSubtitleSrc()}>
                  <track
                    kind="subtitles"
                    src={selectedVideoSubtitleSrc() || ''}
                    srclang={selectedVideoSubtitleTrack()?.language || 'en'}
                    label={selectedVideoSubtitleTrack()?.label || 'Subtitle'}
                    default={true}
                  />
                </Show>
              </video>

              <Show when={isFullscreen()}>
                <div class={`media-player-overlay-controls ${showFullscreenControls() ? 'visible' : ''}`}>
                  {renderProgress('overlay')}
                  {renderControls('overlay')}
                </div>
              </Show>
            </div>
          </Show>

          <Show when={showInlineControls() && player.currentItem()?.mediaType === 'video'}>
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
          <Show when={showLibraryPicker()}>
            <div class="media-player-modal-backdrop" onClick={closeLibraryPicker}>
              <div class="media-player-modal" onClick={(event) => event.stopPropagation()}>
                <div class="media-player-modal-header">
                  <h4>Add to Playlist</h4>
                  <button type="button" class="media-player-icon-button" onClick={closeLibraryPicker}>
                    <X size={14} />
                  </button>
                </div>
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
                <Show when={libraryError()}>
                  <p class="media-player-error">{libraryError()}</p>
                </Show>
                <Show when={!isLoadingLibrary() && filteredLibraryItems().length === 0}>
                  <p class="media-player-playlist-empty">No matching tracks found.</p>
                </Show>
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
                <Show when={playlistFeedback()}>
                  <p class="media-player-playlist-feedback">{playlistFeedback()}</p>
                </Show>
              </div>
            </div>
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

  const moveQueueItem = (fromIndex: number, toIndex: number) => {
    const currentQueue = queue();
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= currentQueue.length || toIndex >= currentQueue.length) return;
    if (fromIndex === toIndex) return;

    const nextQueue = [...currentQueue];
    const [moved] = nextQueue.splice(fromIndex, 1);
    nextQueue.splice(toIndex, 0, moved);
    setQueue(nextQueue);

    const active = currentIndex();
    if (active === fromIndex) {
      setCurrentIndex(toIndex);
      return;
    }

    if (fromIndex < active && toIndex >= active) {
      setCurrentIndex(active - 1);
      return;
    }

    if (fromIndex > active && toIndex <= active) {
      setCurrentIndex(active + 1);
    }
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
    moveQueueItem,
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
