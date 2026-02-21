import { createAsync, useNavigate } from '@solidjs/router';
import { Show, createSignal, For } from 'solid-js';
import MainLayout from '~/components/layout/MainLayout';
import { useMediaPlayer } from '~/components/player/MediaPlayerProvider';
import { fetchJson } from '~/lib/api';

import sportsTitleAsset from '../../../buttons_assets/generated/transparent/sports_title_temp.png';
import filterButtonAsset from '../../../buttons_assets/generated/transparent/filter_button_2d_1771672880924.png';
import panelBackgroundAsset from '../../../buttons_assets/generated/transparent/panel_background_2d_1771672912476.png';
import searchBarAsset from '../../../buttons_assets/generated/transparent/search_bar_asset_2d_1771672842516.png';
import { Search, Loader2 } from 'lucide-solid';
import { Card, Badge } from '~/components/ui';

interface SportStreamEvent {
    title: string;
    sport: string;
    teams: [string, string] | [];
    thumbnail: string | null;
    is_live: boolean;
    viewer_count: number;
    streamwest_url: string;
    embed_url: string | null;
    stream: string | null;
    error?: string | null;
}

const fetchLiveSports = async (force: boolean) => {
    return fetchJson<SportStreamEvent[]>(`/api/sports/live${force ? '?refresh=true' : ''}`);
};

export default function SportsDashboard() {
    const navigate = useNavigate();
    const mediaPlayer = useMediaPlayer();
    const [forceRefresh, setForceRefresh] = createSignal(false);
    const sportsResult = createAsync(() => fetchLiveSports(forceRefresh()));
    const [filterQuery, setFilterQuery] = createSignal('');

    const handleRefresh = () => {
        setForceRefresh(true);
        // Reset back to false after a moment so subsequent normal navigations use cache
        setTimeout(() => setForceRefresh(false), 500);
    };

    const events = () => sportsResult()?.data || [];
    const isLoading = () => sportsResult() === undefined;
    const hasError = () => sportsResult()?.error != null;

    const playableEvents = () => events().filter((e) => e.stream != null);
    const filteredEvents = () =>
        playableEvents().filter(
            (e) =>
                e.title.toLowerCase().includes(filterQuery().toLowerCase()) ||
                e.sport.toLowerCase().includes(filterQuery().toLowerCase())
        );

    const openStream = (event: SportStreamEvent) => {
        if (!event.stream) return;

        mediaPlayer.openItem({
            id: `sports-${Date.now()}`,
            mediaId: 999999, // Magic ID to avoid conflicting with local DB items
            mediaType: 'video',
            mediaKind: 'episode', // Pretend it's an episode to unlock full screen video controls
            title: event.title,
            subtitle: `${event.sport} • ${event.viewer_count} Viewers`,
            streamUrl: event.stream,
            artworkUrl: event.thumbnail || undefined,
        });
        void navigate('/player');
    };

    return (
        <MainLayout>
            <div class="movies-page">
                <header class="page-header">
                    <div class="header-wide-panel">
                        <div class="header-title" style="align-items: flex-end;">
                            {/* Temporarily fallback text for unrendered asset */}
                            <h1 style="font-size: 3rem; margin: 0; color: white; text-shadow: 2px 2px 0 #000;">Live Sports</h1>
                        </div>

                        <div class="header-actions">
                            <div class="search-box playful-search-box" style={`background-image: url(${searchBarAsset});`}>
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Filter matches..."
                                    class="input"
                                    value={filterQuery()}
                                    onInput={(e) => setFilterQuery(e.currentTarget.value)}
                                />
                            </div>
                            <button class="hero-action-button" title="Refresh" aria-label="Refresh" onClick={handleRefresh} disabled={isLoading()} style={isLoading() ? "opacity: 0.5;" : ""}>
                                <img src={filterButtonAsset} alt="Refresh" />
                            </button>
                        </div>
                    </div>
                </header>

                <Show when={isLoading()}>
                    <div style="display: flex; justify-content: center; padding: 4rem; color: white;">
                        <Loader2 class="animate-spin" size={48} />
                        <h2 style="margin-left: 1rem;">Scraping Live Feeds (Takes ~10s)...</h2>
                    </div>
                </Show>

                <Show when={hasError()}>
                    <div class="empty-state playful-panel" style="background: rgba(255,0,0,0.2);">
                        <h3>Crawler Offline</h3>
                        <p>{sportsResult()?.error}</p>
                    </div>
                </Show>

                <Show when={!isLoading() && !hasError()}>
                    <div class="movies-grid">
                        <For each={filteredEvents()}>
                            {(match) => (
                                <Card class="movie-card" onClick={() => openStream(match)}>
                                    <div class="movie-poster" style="aspect-ratio: 16/9; margin-bottom: 0;">
                                        {match.thumbnail ? (
                                            <img src={match.thumbnail} alt={match.title} />
                                        ) : (
                                            <div class="poster-placeholder">
                                                No Image
                                            </div>
                                        )}
                                        <div class="movie-overlay">
                                            <Show when={match.is_live}>
                                                <Badge variant="warning">
                                                    LIVE
                                                </Badge>
                                            </Show>
                                        </div>
                                    </div>
                                    <div class="movie-info" style="color: black; padding: 0.8rem;">
                                        <h3 class="movie-title" style="font-size: 1.1rem; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            {match.title}
                                        </h3>
                                        <p class="movie-meta" style="font-size: 0.9rem; font-weight: bold;">
                                            {match.sport} • 👁️ {match.viewer_count}
                                        </p>
                                    </div>
                                </Card>
                            )}
                        </For>

                        <Show when={filteredEvents().length === 0 && !isLoading()}>
                            <div class="empty-state playful-panel" style="grid-column: 1 / -1;">
                                <h3>No live streams found</h3>
                                <p>Wait for a match to start or check back later.</p>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </MainLayout>
    );
}
