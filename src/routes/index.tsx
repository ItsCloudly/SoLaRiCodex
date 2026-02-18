import { createAsync, useNavigate } from '@solidjs/router';
import { createMemo, createSignal } from 'solid-js';
import MainLayout from '~/components/layout/MainLayout';
import { Badge, Button, Card, CardHeader, CardTitle } from '~/components/ui';
import { Activity, Download, Film, Music, Search, Tv } from 'lucide-solid';
import { fetchJson } from '~/lib/api';
import type { Stats } from '~/types';

const fetchStats = () => fetchJson<Stats>('/api/stats');
const fetchHealth = () => fetchJson<{ status: string; timestamp: string }>('/api/health');

export default function Dashboard() {
  const navigate = useNavigate();
  const statsResult = createAsync(fetchStats);
  const healthResult = createAsync(fetchHealth);
  const [showApiResponse, setShowApiResponse] = createSignal(false);

  const stats = () => statsResult()?.data;
  const statsError = () => statsResult()?.error;
  const health = () => healthResult()?.data;

  const apiStatus = () => {
    if (healthResult()?.error) return 'error';
    if (health()?.status === 'ok') return 'connected';
    return 'loading';
  };

  const statusCounts = createMemo(() => {
    const rows = stats()?.downloads.byStatus || [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.status, row.count);
    }
    return {
      queued: counts.get('queued') || 0,
      downloading: counts.get('downloading') || 0,
      paused: counts.get('paused') || 0,
      completed: counts.get('completed') || 0,
      failed: counts.get('failed') || 0,
    };
  });

  const totalLibraryItems = createMemo(() => stats()?.library.total || 0);
  const activeDownloads = createMemo(() => stats()?.downloads.active || []);
  const shareOfLibrary = (value: number) => {
    const total = totalLibraryItems();
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <MainLayout>
      <div class="dashboard">
        <header class="dashboard-header">
          <h1 class="section-title">System Overview</h1>
          <div class="header-actions">
            <button
              type="button"
              class="timestamp api-status-toggle"
              onClick={() => setShowApiResponse((current) => !current)}
              aria-expanded={showApiResponse()}
            >
              API Status: {apiStatus()} {showApiResponse() ? '(hide)' : '(click for details)'}
            </button>
          </div>
        </header>

        {statsError() && (
          <Card>
            <CardHeader>
              <CardTitle>Stats Error</CardTitle>
            </CardHeader>
            <p>{statsError()}</p>
          </Card>
        )}

        {showApiResponse() && health() && (
          <Card>
            <CardHeader>
              <CardTitle>API Response</CardTitle>
            </CardHeader>
            <pre>{JSON.stringify(health(), null, 2)}</pre>
          </Card>
        )}

        <div class="stats-grid">
          <Card class="stat-card">
            <div class="stat-icon movies">
              <Film size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats()?.library.movies ?? 0}</div>
              <div class="stat-label">Movies</div>
            </div>
          </Card>

          <Card class="stat-card">
            <div class="stat-icon tv">
              <Tv size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats()?.library.tv ?? 0}</div>
              <div class="stat-label">TV Series</div>
            </div>
          </Card>

          <Card class="stat-card">
            <div class="stat-icon music">
              <Music size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats()?.library.music ?? 0}</div>
              <div class="stat-label">Albums</div>
            </div>
          </Card>

          <Card class="stat-card">
            <div class="stat-icon downloads">
              <Download size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats()?.downloads.active.length ?? 0}</div>
              <div class="stat-label">Active Downloads</div>
            </div>
          </Card>

          <Card class="stat-card stat-card-total">
            <div class="stat-icon">
              <Activity size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">{totalLibraryItems()}</div>
              <div class="stat-label">Total Library Items</div>
            </div>
          </Card>
        </div>

        <div class="dashboard-main-grid">
          <Card class="dashboard-panel">
            <CardHeader>
              <CardTitle>Library Mix</CardTitle>
            </CardHeader>
            <div class="library-mix-list">
              <div class="library-mix-row">
                <span>Movies</span>
                <span>{stats()?.library.movies ?? 0} ({shareOfLibrary(stats()?.library.movies ?? 0)}%)</span>
              </div>
              <div class="library-mix-bar"><span style={{ width: `${shareOfLibrary(stats()?.library.movies ?? 0)}%` }} /></div>
              <div class="library-mix-row">
                <span>TV Series</span>
                <span>{stats()?.library.tv ?? 0} ({shareOfLibrary(stats()?.library.tv ?? 0)}%)</span>
              </div>
              <div class="library-mix-bar"><span style={{ width: `${shareOfLibrary(stats()?.library.tv ?? 0)}%` }} /></div>
              <div class="library-mix-row">
                <span>Albums</span>
                <span>{stats()?.library.music ?? 0} ({shareOfLibrary(stats()?.library.music ?? 0)}%)</span>
              </div>
              <div class="library-mix-bar"><span style={{ width: `${shareOfLibrary(stats()?.library.music ?? 0)}%` }} /></div>
            </div>
          </Card>

          <Card class="dashboard-panel">
            <CardHeader>
              <CardTitle>Download Pulse</CardTitle>
            </CardHeader>
            <div class="dashboard-status-chips">
              <Badge variant="info">Queued: {statusCounts().queued}</Badge>
              <Badge variant="info">Downloading: {statusCounts().downloading}</Badge>
              <Badge variant="warning">Paused: {statusCounts().paused}</Badge>
              <Badge variant="success">Completed: {statusCounts().completed}</Badge>
              <Badge variant="error">Failed: {statusCounts().failed}</Badge>
            </div>

            <div class="overview-active-list">
              {activeDownloads().length === 0 ? (
                <p class="header-subtitle">No active downloads right now.</p>
              ) : (
                activeDownloads().slice(0, 6).map((download) => (
                  <div class="overview-active-item">
                    <span>{download.title}</span>
                    <span>{download.status}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card class="dashboard-panel dashboard-actions-panel">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div class="dashboard-actions-grid">
              <Button variant="secondary" onClick={() => void navigate('/search')}>
                <Search size={16} />
                Discover Media
              </Button>
              <Button variant="secondary" onClick={() => void navigate('/activity')}>
                <Download size={16} />
                Open Activity
              </Button>
              <Button variant="secondary" onClick={() => void navigate('/player')}>
                <Music size={16} />
                Open Player
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
