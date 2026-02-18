import { createAsync, useNavigate, useParams } from '@solidjs/router';
import { createEffect, createSignal } from 'solid-js';
import { Calendar, Disc, Hash, Music, Play } from 'lucide-solid';
import MainLayout from '~/components/layout/MainLayout';
import { useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { Badge, Button, Card, CardHeader, CardTitle, Input } from '~/components/ui';
import { fetchJson, requestJson } from '~/lib/api';

interface ArtistAlbum {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  status: 'wanted' | 'downloaded' | 'archived';
}

interface AlbumTrack {
  id: number;
  trackNumber?: number | null;
  duration?: number | null;
  downloaded?: boolean | number | null;
  filePath?: string | null;
  title?: string | null;
}

interface AlbumDetailsResponse {
  id: number;
  title: string;
  tracks: AlbumTrack[];
}

interface ArtistDetails {
  id: number;
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  genre?: string | null;
  status: 'wanted' | 'downloaded' | 'archived';
  path?: string | null;
  musicBrainzId?: string | null;
  albums: ArtistAlbum[];
}

interface MusicReleaseGroup {
  id: string;
  title: string;
  disambiguation?: string | null;
  primaryType?: string | null;
  secondaryTypes: string[];
  firstReleaseDate?: string | null;
}

interface MusicReleaseGroupsResponse {
  artistId: string;
  releases: Array<{
    id: string;
    title: string;
    disambiguation?: string;
    'primary-type'?: string;
    'secondary-types'?: string[];
    'first-release-date'?: string;
  }>;
}

type ReleaseGroupCategoryKey = 'albums' | 'eps' | 'singles' | 'other';

interface ReleaseGroupCategory {
  key: ReleaseGroupCategoryKey;
  title: string;
  groups: MusicReleaseGroup[];
}

interface JackettIndexerFilter {
  id: number;
  name: string;
  priority: number;
  searchModes: string[];
  supportedParams: string[];
  categoryCount: number;
}

interface JackettCategoryFilter {
  id: number;
  name: string;
  indexerIds: number[];
}

interface JackettFiltersResponse {
  indexers: JackettIndexerFilter[];
  categories: JackettCategoryFilter[];
  qualityCategories: JackettCategoryFilter[];
  languageCategories: JackettCategoryFilter[];
  supportsLanguageParam: boolean;
  languageCodes: string[];
  warnings: string[];
}

interface JackettReleaseResult {
  id: string;
  title: string;
  indexerId: number;
  indexerName: string;
  downloadUrl?: string | null;
  infoUrl?: string | null;
  guid?: string | null;
  size?: number | null;
  seeders?: number | null;
  peers?: number | null;
  publishDate?: string | null;
  categories: string[];
}

interface JackettSearchFailure {
  indexerId: number;
  indexerName: string;
  message: string;
}

interface JackettSearchResponse {
  query: string;
  results: JackettReleaseResult[];
  failures: JackettSearchFailure[];
  total: number;
}

function formatSize(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || bytes <= 0) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPublishDate(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleString();
}

function formatYear(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return String(parsed.getUTCFullYear());
}

function formatReleaseGroupLabel(group: MusicReleaseGroup): string {
  const year = formatYear(group.firstReleaseDate || null);
  const types = [group.primaryType || null, ...(group.secondaryTypes || [])]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const parts = [
    year !== 'n/a' ? year : null,
    ...types,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (parts.length === 0) return group.title;
  return `${group.title} (${parts.join(' • ')})`;
}

function classifyReleaseGroup(group: MusicReleaseGroup): ReleaseGroupCategoryKey {
  const primaryType = (group.primaryType || '').trim().toLowerCase();
  const secondaryTypes = (group.secondaryTypes || []).map((value) => value.trim().toLowerCase());

  if (primaryType === 'album' || secondaryTypes.includes('album')) return 'albums';
  if (primaryType === 'ep' || secondaryTypes.includes('ep')) return 'eps';
  if (primaryType === 'single' || secondaryTypes.includes('single')) return 'singles';
  return 'other';
}

function groupReleaseGroupsByCategory(groups: MusicReleaseGroup[]): ReleaseGroupCategory[] {
  const grouped: Record<ReleaseGroupCategoryKey, MusicReleaseGroup[]> = {
    albums: [],
    eps: [],
    singles: [],
    other: [],
  };

  groups.forEach((group) => {
    grouped[classifyReleaseGroup(group)].push(group);
  });

  const categories: ReleaseGroupCategory[] = [
    { key: 'albums', title: 'Albums', groups: grouped.albums },
    { key: 'eps', title: 'EPs', groups: grouped.eps },
    { key: 'singles', title: 'Singles', groups: grouped.singles },
    { key: 'other', title: 'Other', groups: grouped.other },
  ];

  return categories.filter((category) => category.groups.length > 0);
}

function isDownloadedFlag(value: unknown): boolean {
  return value === true || value === 1;
}

function hasLocalTrackFile(track: AlbumTrack): boolean {
  return typeof track.filePath === 'string' && track.filePath.trim().length > 0;
}

export default function ArtistDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const mediaPlayer = useMediaPlayer();
  const artistResult = createAsync(() => fetchJson<ArtistDetails>(`/api/media/music/artists/${params.id}`));

  const artist = () => artistResult()?.data;
  const loadError = () => artistResult()?.error;

  const [initializedArtistId, setInitializedArtistId] = createSignal<number | null>(null);
  const [loadingFilters, setLoadingFilters] = createSignal(false);
  const [loadingReleaseGroups, setLoadingReleaseGroups] = createSignal(false);
  const [searchingReleases, setSearchingReleases] = createSignal(false);
  const [sendingToDelugeId, setSendingToDelugeId] = createSignal<string | null>(null);

  const [releaseGroups, setReleaseGroups] = createSignal<MusicReleaseGroup[]>([]);
  const [selectedReleaseGroupId, setSelectedReleaseGroupId] = createSignal('');
  const [releaseQuery, setReleaseQuery] = createSignal('');

  const [jackettFilters, setJackettFilters] = createSignal<JackettFiltersResponse | null>(null);
  const [selectedIndexerIds, setSelectedIndexerIds] = createSignal<number[]>([]);
  const [selectedQualityCategoryIds, setSelectedQualityCategoryIds] = createSignal<number[]>([]);
  const [selectedLanguageCategoryIds, setSelectedLanguageCategoryIds] = createSignal<number[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = createSignal('');
  const [jackettResults, setJackettResults] = createSignal<JackettReleaseResult[]>([]);
  const [jackettFailures, setJackettFailures] = createSignal<JackettSearchFailure[]>([]);
  const [jackettMessage, setJackettMessage] = createSignal<string | null>(null);
  const [jackettError, setJackettError] = createSignal<string | null>(null);
  const [searchResultsContext, setSearchResultsContext] = createSignal<'manual' | 'record' | null>(null);
  const [activeRecordSearchId, setActiveRecordSearchId] = createSignal<string | null>(null);
  const [expandedRecordId, setExpandedRecordId] = createSignal<string | null>(null);
  const [libraryError, setLibraryError] = createSignal<string | null>(null);
  const [libraryLoadingAlbumId, setLibraryLoadingAlbumId] = createSignal<number | null>(null);
  const [expandedLibraryAlbumId, setExpandedLibraryAlbumId] = createSignal<number | null>(null);
  const [albumTracksById, setAlbumTracksById] = createSignal<Record<number, AlbumTrack[]>>({});
  const groupedReleaseGroups = () => groupReleaseGroupsByCategory(releaseGroups());

  createEffect(() => {
    const currentArtist = artist();
    if (!currentArtist) return;
    if (initializedArtistId() === currentArtist.id) return;

    setInitializedArtistId(currentArtist.id);
    setReleaseQuery(currentArtist.title);
    setJackettMessage(null);
    setJackettError(null);
    setJackettResults([]);
    setJackettFailures([]);
    setReleaseGroups([]);
    setSelectedReleaseGroupId('');
    setSearchResultsContext(null);
    setActiveRecordSearchId(null);
    setExpandedRecordId(null);
    setLibraryError(null);
    setLibraryLoadingAlbumId(null);
    setExpandedLibraryAlbumId(null);
    setAlbumTracksById({});

    void loadIndexerFilters();
    void loadArtistReleaseGroups(currentArtist.musicBrainzId, currentArtist.title);
  });

  const fetchAlbumTracks = async (albumId: number): Promise<AlbumTrack[] | null> => {
    const cached = albumTracksById()[albumId];
    if (Array.isArray(cached)) return cached;

    setLibraryLoadingAlbumId(albumId);
    setLibraryError(null);
    const response = await requestJson<AlbumDetailsResponse>(`/api/media/music/albums/${albumId}`);
    setLibraryLoadingAlbumId(null);

    if (response.error || !response.data) {
      setLibraryError(response.error || 'Failed to load album tracks');
      return null;
    }

    const tracks = [...(response.data.tracks || [])].sort((a, b) => {
      const aTrack = typeof a.trackNumber === 'number' ? a.trackNumber : Number.MAX_SAFE_INTEGER;
      const bTrack = typeof b.trackNumber === 'number' ? b.trackNumber : Number.MAX_SAFE_INTEGER;
      return aTrack - bTrack;
    });

    setAlbumTracksById((current) => ({
      ...current,
      [albumId]: tracks,
    }));
    return tracks;
  };

  const buildAlbumPlaylist = (
    album: ArtistAlbum,
    albumTracks: AlbumTrack[],
  ) => {
    const currentArtist = artist();
    if (!currentArtist) return [];

    return albumTracks
      .filter((track) => isDownloadedFlag(track.downloaded) || hasLocalTrackFile(track))
      .map((track, index) => ({
        id: `track-${track.id}`,
        mediaId: track.id,
        mediaKind: 'track' as const,
        mediaType: 'audio' as const,
        title: track.title?.trim() || `Track ${typeof track.trackNumber === 'number' ? track.trackNumber : index + 1}`,
        subtitle: `${currentArtist.title} - ${album.title}`,
        streamUrl: `/api/media/playback/audio/track/${track.id}`,
        artworkUrl: `/api/media/playback/artwork/album/${album.id}`,
      }));
  };

  const playAlbum = async (album: ArtistAlbum, preferredTrackId?: number) => {
    const tracks = await fetchAlbumTracks(album.id);
    if (!tracks) return;

    const playlist = buildAlbumPlaylist(album, tracks);
    if (playlist.length === 0) {
      setLibraryError('No locally available tracks were detected for this album.');
      return;
    }

    const startIndex = typeof preferredTrackId === 'number'
      ? playlist.findIndex((item) => item.id === `track-${preferredTrackId}`)
      : 0;

    setLibraryError(null);
    mediaPlayer.openPlaylist(playlist, startIndex >= 0 ? startIndex : 0);
    void navigate('/player');
  };

  const toggleAlbumTracks = async (album: ArtistAlbum) => {
    if (expandedLibraryAlbumId() === album.id) {
      setExpandedLibraryAlbumId(null);
      return;
    }

    setExpandedLibraryAlbumId(album.id);
    await fetchAlbumTracks(album.id);
  };

  const updateIdSelection = (
    current: number[],
    id: number,
    checked: boolean,
  ): number[] => {
    if (checked) {
      return current.includes(id) ? current : [...current, id];
    }
    return current.filter((value) => value !== id);
  };

  const loadIndexerFilters = async () => {
    setLoadingFilters(true);
    setJackettError(null);
    setJackettMessage(null);

    const response = await requestJson<JackettFiltersResponse>('/api/search/jackett/filters?category=music');
    if (response.error) {
      setJackettFilters(null);
      setSelectedIndexerIds([]);
      setSelectedQualityCategoryIds([]);
      setSelectedLanguageCategoryIds([]);
      setSelectedLanguageCode('');
      setJackettError(response.error);
      setLoadingFilters(false);
      return;
    }

    if (!response.data) {
      setJackettFilters(null);
      setSelectedIndexerIds([]);
      setSelectedQualityCategoryIds([]);
      setSelectedLanguageCategoryIds([]);
      setSelectedLanguageCode('');
      setJackettError('No filter data returned from Jackett');
      setLoadingFilters(false);
      return;
    }

    setJackettFilters(response.data);
    setSelectedIndexerIds(response.data.indexers.map((indexerOption) => indexerOption.id));
    setSelectedQualityCategoryIds([]);
    setSelectedLanguageCategoryIds([]);
    setSelectedLanguageCode('');

    if (response.data.warnings.length > 0) {
      setJackettMessage(`Some indexers reported issues: ${response.data.warnings.join(' | ')}`);
    } else {
      setJackettMessage('Indexer filters loaded.');
    }

    if (response.data.indexers.length === 0) {
      setJackettError('No enabled Jackett indexers available for music');
    }

    setLoadingFilters(false);
  };

  const loadArtistReleaseGroups = async (musicBrainzId: string | null | undefined, artistTitle: string) => {
    setLoadingReleaseGroups(true);
    setReleaseGroups([]);
    setSelectedReleaseGroupId('');
    setSearchResultsContext(null);
    setActiveRecordSearchId(null);
    setExpandedRecordId(null);

    if (!musicBrainzId) {
      setJackettMessage('No MusicBrainz ID on this artist yet. You can still search indexers by artist name.');
      setLoadingReleaseGroups(false);
      return;
    }

    const response = await requestJson<MusicReleaseGroupsResponse>(
      `/api/search/music/releases?artistId=${encodeURIComponent(musicBrainzId)}`,
    );

    if (response.error) {
      setJackettError(response.error);
      setLoadingReleaseGroups(false);
      return;
    }

    const groups = (response.data?.releases || []).map((release) => ({
      id: release.id,
      title: release.title,
      disambiguation: release.disambiguation || null,
      primaryType: release['primary-type'] || null,
      secondaryTypes: release['secondary-types'] || [],
      firstReleaseDate: release['first-release-date'] || null,
    }));

    setReleaseGroups(groups);
    if (groups.length > 0) {
      setSelectedReleaseGroupId('');
      setReleaseQuery(artistTitle);
    } else {
      setReleaseQuery(artistTitle);
      setJackettMessage('No records found in MusicBrainz for this artist. Searching by artist name only.');
    }

    setLoadingReleaseGroups(false);
  };

  const setReleaseGroupAndQuery = (groupId: string) => {
    const currentArtist = artist();
    if (!currentArtist) return;

    setSelectedReleaseGroupId(groupId);
    setExpandedRecordId(null);
    setActiveRecordSearchId(null);
    if (!groupId) {
      setReleaseQuery(currentArtist.title);
      return;
    }

    const group = releaseGroups().find((item) => item.id === groupId);
    if (!group) return;
    setReleaseQuery(`${currentArtist.title} ${group.title}`);
  };

  const searchReleases = async (
    forcedQuery?: string,
    context: 'manual' | 'record' = 'manual',
    recordId?: string,
  ) => {
    if (searchingReleases()) return;

    const currentArtist = artist();
    if (!currentArtist) return;
    setSearchResultsContext(context);
    setActiveRecordSearchId(context === 'record' ? (recordId || null) : null);
    if (context === 'manual') {
      setExpandedRecordId(null);
    }

    const query = (forcedQuery ?? releaseQuery()).trim();
    if (!query) {
      setJackettError('Enter a release query before searching');
      return;
    }

    if (selectedIndexerIds().length === 0) {
      setJackettError('Select at least one indexer');
      return;
    }

    setSearchingReleases(true);
    setJackettError(null);
    setJackettMessage(null);
    setJackettResults([]);
    setJackettFailures([]);

    const categoryIds = Array.from(new Set([
      ...selectedQualityCategoryIds(),
      ...selectedLanguageCategoryIds(),
    ]));
    const language = selectedLanguageCode().trim().toLowerCase();

    const response = await requestJson<JackettSearchResponse>('/api/search/jackett', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'music',
        query,
        indexerIds: selectedIndexerIds(),
        categoryIds,
        language: language.length > 0 ? language : undefined,
      }),
    });

    if (response.error) {
      setJackettError(response.error);
      setSearchingReleases(false);
      return;
    }

    if (!response.data) {
      setJackettError('No response data received from Jackett search');
      setSearchingReleases(false);
      return;
    }

    setJackettResults(response.data.results || []);
    setJackettFailures(response.data.failures || []);

    if ((response.data.results || []).length === 0) {
      setJackettMessage(`No releases found for "${query}".`);
    } else {
      setJackettMessage(`Found ${response.data.total} release${response.data.total === 1 ? '' : 's'} for "${query}".`);
    }

    setSearchingReleases(false);
  };

  const searchForRecord = async (group: MusicReleaseGroup) => {
    const currentArtist = artist();
    if (!currentArtist) return;

    const query = `${currentArtist.title} ${group.title}`.trim();
    setSelectedReleaseGroupId(group.id);
    setReleaseQuery(query);
    setExpandedRecordId(group.id);
    scrollToRecordResults(group.id);
    await searchReleases(query, 'record', group.id);
  };

  const scrollToRecordResults = (recordId: string, retries = 8) => {
    if (typeof window === 'undefined') return;

    const targetId = `record-results-${recordId}`;
    const tryScroll = (remaining: number) => {
      const element = window.document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (remaining <= 0) return;
      window.setTimeout(() => tryScroll(remaining - 1), 80);
    };

    window.setTimeout(() => tryScroll(retries), 0);
  };

  const handleRecordAction = async (group: MusicReleaseGroup) => {
    if (searchingReleases()) return;

    const hasRecordResultsForGroup =
      searchResultsContext() === 'record' && activeRecordSearchId() === group.id;
    const isExpanded = expandedRecordId() === group.id && hasRecordResultsForGroup;

    if (isExpanded) {
      setExpandedRecordId(null);
      return;
    }

    if (hasRecordResultsForGroup) {
      setExpandedRecordId(group.id);
      scrollToRecordResults(group.id);
      return;
    }

    await searchForRecord(group);
  };

  const sendReleaseToDeluge = async (release: JackettReleaseResult) => {
    const currentArtist = artist();
    if (!currentArtist) return;

    if (!release.downloadUrl) {
      setJackettError('This release does not include a downloadable torrent or magnet URL');
      return;
    }

    setSendingToDelugeId(release.id);
    setJackettError(null);

    const response = await requestJson<{ id: number; message: string }>('/api/deluge/add-torrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: release.title,
        mediaType: 'music',
        mediaId: currentArtist.id,
        indexerId: release.indexerId > 0 ? release.indexerId : undefined,
        sourceUrl: release.downloadUrl,
        quality: release.categories[0] || undefined,
        size: release.size || undefined,
      }),
    });

    if (response.error) {
      setJackettError(response.error);
      setSendingToDelugeId(null);
      return;
    }

    setJackettMessage(`Sent to Deluge: ${release.title}`);
    setSendingToDelugeId(null);
  };

  return (
    <MainLayout>
      <div class="movie-details-page">
        <header class="movie-details-header">
          <button class="back-button" onClick={() => void navigate('/music')}>
            {'<- Back to Music'}
          </button>
          <h1 class="section-title">Artist Details</h1>
        </header>

        {loadError() && (
          <Card>
            <p>Failed to load artist details: {loadError()}</p>
          </Card>
        )}

        {artist() && (
          <>
            <Card class="movie-details-card">
              <div class="movie-details-layout">
                <div class="movie-details-poster">
                  {artist()?.posterPath ? (
                    <img src={artist()?.posterPath || ''} alt={artist()?.title || 'Artist artwork'} />
                  ) : (
                    <div class="poster-placeholder">
                      <Music size={64} />
                    </div>
                  )}
                </div>

                <div class="movie-details-content">
                  <div class="movie-details-title-row">
                    <h2 class="movie-details-title">{artist()?.title}</h2>
                    <Badge variant={artist()?.status === 'downloaded' ? 'success' : 'warning'}>
                      {artist()?.status}
                    </Badge>
                  </div>

                  <p class="movie-details-overview">
                    {artist()?.overview || 'No artist overview is available yet.'}
                  </p>

                  <div class="movie-details-meta">
                    <span class="meta-item">
                      <Disc size={14} />
                      Records in library: {artist()?.albums.length ?? 0}
                    </span>
                    <span class="meta-item">
                      <Calendar size={14} />
                      Genre: {artist()?.genre || 'n/a'}
                    </span>
                    <span class="meta-item">
                      <Hash size={14} />
                      MBID: {artist()?.musicBrainzId || 'n/a'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card class="music-library-card">
              <CardHeader>
                <CardTitle>Library Albums</CardTitle>
              </CardHeader>

              {libraryError() && <p class="inline-feedback error">{libraryError()}</p>}

              {artist()?.albums.length === 0 ? (
                <p class="jackett-empty">No albums are stored under this artist yet.</p>
              ) : (
                <div class="music-library-albums">
                  {artist()?.albums.map((album) => (
                    <Card class="music-library-album-card" key={`album-${album.id}`}>
                      <div class="music-library-album-header">
                        <div class="music-library-album-meta">
                          <h3>{album.title}</h3>
                          <p>Release: {formatYear(album.releaseDate || null)}</p>
                        </div>
                        <div class="music-library-album-actions">
                          <Badge variant={album.status === 'downloaded' ? 'success' : 'warning'}>
                            {album.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void toggleAlbumTracks(album)}
                            disabled={libraryLoadingAlbumId() === album.id}
                          >
                            {expandedLibraryAlbumId() === album.id ? 'Hide Tracks' : 'View Tracks'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void playAlbum(album)}
                            disabled={libraryLoadingAlbumId() === album.id}
                          >
                            <Play size={13} />
                            Play Album
                          </Button>
                        </div>
                      </div>

                      {expandedLibraryAlbumId() === album.id && (
                        <div class="music-library-tracks">
                          {(albumTracksById()[album.id] || []).length === 0 ? (
                            <p class="jackett-empty">No tracks found for this album yet.</p>
                          ) : (
                            (albumTracksById()[album.id] || []).map((track, index) => (
                              <div class="music-library-track-row">
                                <span class="music-library-track-number">
                                  {typeof track.trackNumber === 'number' ? String(track.trackNumber).padStart(2, '0') : String(index + 1).padStart(2, '0')}
                                </span>
                                <span class="music-library-track-title">
                                  {track.title?.trim() || `Track ${index + 1}`}
                                </span>
                                <Badge variant={isDownloadedFlag(track.downloaded) || hasLocalTrackFile(track) ? 'success' : 'warning'}>
                                  {isDownloadedFlag(track.downloaded) || hasLocalTrackFile(track) ? 'available locally' : 'wanted'}
                                </Badge>
                                {(isDownloadedFlag(track.downloaded) || hasLocalTrackFile(track)) && (
                                  <Button variant="ghost" size="sm" onClick={() => void playAlbum(album, track.id)}>
                                    <Play size={12} />
                                    Play
                                  </Button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card class="jackett-panel movie-jackett-panel">
              <CardHeader>
                <CardTitle>Artist Records</CardTitle>
              </CardHeader>

              {loadingReleaseGroups() && <p>Loading records from MusicBrainz...</p>}

              {!loadingReleaseGroups() && releaseGroups().length === 0 && (
                <p class="jackett-empty">No records available from MusicBrainz for this artist.</p>
              )}

              {!loadingReleaseGroups() && releaseGroups().length > 0 && (
                <div class="artist-record-groups">
                  {groupedReleaseGroups().map((category) => (
                    <section class="artist-record-group">
                      <h3 class="artist-record-group-title">
                        {category.title}
                        <span>{category.groups.length}</span>
                      </h3>

                      <div class="jackett-results-list">
                        {category.groups.map((group) => (
                          <Card class="jackett-release-card" key={group.id}>
                            <div class="jackett-release-main">
                              <h4 class="jackett-release-title">{group.title}</h4>
                              <p class="jackett-release-meta">
                                <span>{group.primaryType || 'Release group'}</span>
                                <span>Year: {formatYear(group.firstReleaseDate || null)}</span>
                                {group.secondaryTypes.length > 0 && <span>{group.secondaryTypes.join(', ')}</span>}
                              </p>
                              {group.disambiguation && (
                                <p class="jackett-release-categories">{group.disambiguation}</p>
                              )}
                            </div>
                            <div class="jackett-release-actions">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void handleRecordAction(group)}
                                disabled={searchingReleases() && activeRecordSearchId() === group.id}
                              >
                                {searchingReleases() && activeRecordSearchId() === group.id
                                  ? 'Searching...'
                                  : (
                                    searchResultsContext() === 'record'
                                    && activeRecordSearchId() === group.id
                                    && expandedRecordId() === group.id
                                  )
                                    ? 'Hide Results'
                                    : (
                                      searchResultsContext() === 'record'
                                      && activeRecordSearchId() === group.id
                                    )
                                      ? 'Show Results'
                                      : 'Search This Record'}
                              </Button>
                            </div>

                            {searchResultsContext() === 'record'
                              && activeRecordSearchId() === group.id
                              && expandedRecordId() === group.id && (
                              <div class="record-search-results" id={`record-results-${group.id}`}>
                                {searchingReleases() && (
                                  <p class="jackett-empty">Searching indexers for this record...</p>
                                )}

                                {!searchingReleases() && jackettError() && (
                                  <p class="inline-feedback error">{jackettError()}</p>
                                )}

                                {!searchingReleases() && jackettMessage() && (
                                  <p class="inline-feedback success">{jackettMessage()}</p>
                                )}

                                {!searchingReleases() && jackettResults().length > 0 && (
                                  <div class="jackett-results-list">
                                    {jackettResults().map((release) => (
                                      <Card class="jackett-release-card" key={release.id}>
                                        <div class="jackett-release-main">
                                          <h4 class="jackett-release-title">{release.title}</h4>
                                          <p class="jackett-release-meta">
                                            <span>{release.indexerName}</span>
                                            <span>Seeders: {release.seeders ?? 'n/a'}</span>
                                            <span>Size: {formatSize(release.size)}</span>
                                            <span>Published: {formatPublishDate(release.publishDate)}</span>
                                          </p>
                                          {release.categories.length > 0 && (
                                            <p class="jackett-release-categories">{release.categories.join(', ')}</p>
                                          )}
                                        </div>
                                        <div class="jackett-release-actions">
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => void sendReleaseToDeluge(release)}
                                            disabled={!release.downloadUrl || sendingToDelugeId() === release.id}
                                          >
                                            {sendingToDelugeId() === release.id ? 'Sending...' : 'Send to Deluge'}
                                          </Button>
                                          {release.downloadUrl && (
                                            <a href={release.downloadUrl} target="_blank" rel="noreferrer">
                                              Open
                                            </a>
                                          )}
                                          {release.infoUrl && (
                                            <a href={release.infoUrl} target="_blank" rel="noreferrer">
                                              Details
                                            </a>
                                          )}
                                        </div>
                                      </Card>
                                    ))}
                                  </div>
                                )}

                                {!searchingReleases() && jackettFailures().length > 0 && (
                                  <div class="jackett-failures">
                                    <p class="inline-feedback error">Indexer errors:</p>
                                    {jackettFailures().map((failure) => (
                                      <p class="jackett-failure-line">
                                        {failure.indexerName}: {failure.message}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </Card>

            <Card class="jackett-panel movie-jackett-panel">
              <CardHeader>
                <CardTitle>Indexer Release Search</CardTitle>
              </CardHeader>

              <div class="movie-release-query">
                <label>Release Query</label>
                <Input value={releaseQuery()} onInput={setReleaseQuery} placeholder="Artist and record title" />
              </div>

              {releaseGroups().length > 0 && (
                <div class="movie-release-query">
                  <label>Record (optional quick-select)</label>
                  <select
                    class="input"
                    value={selectedReleaseGroupId()}
                    onChange={(event) => setReleaseGroupAndQuery(event.currentTarget.value)}
                  >
                    <option value="">Artist only</option>
                    {groupedReleaseGroups().map((category) => (
                      <optgroup label={`${category.title} (${category.groups.length})`}>
                        {category.groups.map((group) => (
                          <option value={group.id}>{formatReleaseGroupLabel(group)}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              <div class="jackett-actions">
                <Button variant="secondary" onClick={loadIndexerFilters} disabled={loadingFilters()}>
                  {loadingFilters() ? 'Loading Filters...' : 'Reload Indexer Filters'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void searchReleases(undefined, 'manual')}
                  disabled={searchingReleases() || loadingFilters() || selectedIndexerIds().length === 0}
                >
                  {searchingReleases() ? 'Searching Releases...' : 'Search Releases'}
                </Button>
              </div>

              {jackettError() && <p class="inline-feedback error">{jackettError()}</p>}
              {jackettMessage() && <p class="inline-feedback success">{jackettMessage()}</p>}

              {jackettFilters() && (
                <div class="jackett-filters">
                  <div class="jackett-filter-group">
                    <label>Indexers</label>
                    <div class="jackett-options">
                      {jackettFilters()?.indexers.map((indexerOption) => (
                        <label class="jackett-option">
                          <input
                            type="checkbox"
                            checked={selectedIndexerIds().includes(indexerOption.id)}
                            onChange={(event) => setSelectedIndexerIds((current) => (
                              updateIdSelection(current, indexerOption.id, event.currentTarget.checked)
                            ))}
                          />
                          <span>{indexerOption.name}</span>
                          <span class="jackett-option-meta">
                            {indexerOption.searchModes.join(', ') || 'search'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div class="jackett-filter-group">
                    <label>Quality Filters</label>
                    {jackettFilters()?.qualityCategories.length === 0 ? (
                      <p class="jackett-empty">No quality filters were exposed by current indexers.</p>
                    ) : (
                      <div class="jackett-options compact">
                        {jackettFilters()?.qualityCategories.map((categoryOption) => (
                          <label class="jackett-option">
                            <input
                              type="checkbox"
                              checked={selectedQualityCategoryIds().includes(categoryOption.id)}
                              onChange={(event) => setSelectedQualityCategoryIds((current) => (
                                updateIdSelection(current, categoryOption.id, event.currentTarget.checked)
                              ))}
                            />
                            <span>{categoryOption.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div class="jackett-filter-group">
                    <label>Language Filters</label>
                    {jackettFilters()?.languageCategories.length === 0 ? (
                      <p class="jackett-empty">No language categories were exposed by current indexers.</p>
                    ) : (
                      <div class="jackett-options compact">
                        {jackettFilters()?.languageCategories.map((categoryOption) => (
                          <label class="jackett-option">
                            <input
                              type="checkbox"
                              checked={selectedLanguageCategoryIds().includes(categoryOption.id)}
                              onChange={(event) => setSelectedLanguageCategoryIds((current) => (
                                updateIdSelection(current, categoryOption.id, event.currentTarget.checked)
                              ))}
                            />
                            <span>{categoryOption.name}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {jackettFilters()?.supportsLanguageParam && (
                      <div class="jackett-language-param">
                        <label>Language Code (lang)</label>
                        <Input
                          value={selectedLanguageCode()}
                          onInput={setSelectedLanguageCode}
                          placeholder={`e.g. ${jackettFilters()?.languageCodes.join(', ')}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {searchResultsContext() !== 'record' && jackettResults().length > 0 && (
                <div class="jackett-results-list">
                  {jackettResults().map((release) => (
                    <Card class="jackett-release-card" key={release.id}>
                      <div class="jackett-release-main">
                        <h4 class="jackett-release-title">{release.title}</h4>
                        <p class="jackett-release-meta">
                          <span>{release.indexerName}</span>
                          <span>Seeders: {release.seeders ?? 'n/a'}</span>
                          <span>Size: {formatSize(release.size)}</span>
                          <span>Published: {formatPublishDate(release.publishDate)}</span>
                        </p>
                        {release.categories.length > 0 && (
                          <p class="jackett-release-categories">{release.categories.join(', ')}</p>
                        )}
                      </div>
                      <div class="jackett-release-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void sendReleaseToDeluge(release)}
                          disabled={!release.downloadUrl || sendingToDelugeId() === release.id}
                        >
                          {sendingToDelugeId() === release.id ? 'Sending...' : 'Send to Deluge'}
                        </Button>
                        {release.downloadUrl && (
                          <a href={release.downloadUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        )}
                        {release.infoUrl && (
                          <a href={release.infoUrl} target="_blank" rel="noreferrer">
                            Details
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {searchResultsContext() !== 'record' && jackettFailures().length > 0 && (
                <div class="jackett-failures">
                  <p class="inline-feedback error">Indexer errors:</p>
                  {jackettFailures().map((failure) => (
                    <p class="jackett-failure-line">
                      {failure.indexerName}: {failure.message}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}

