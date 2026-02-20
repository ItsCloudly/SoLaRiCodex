import { createAsync, useNavigate } from '@solidjs/router';
import { createMemo, createSignal } from 'solid-js';
import { Badge, Button, Card, CardHeader, CardTitle } from '~/components/ui';
import { Activity, Download, Film, Music, Search, Tv, Database, Zap, HardDrive } from 'lucide-solid';
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
    if (healthResult()?.error) return 'Offline';
    if (health()?.status === 'ok') return 'Online';
    return 'Connecting...';
  };

  const statusCounts = createMemo(() => {
    const rows = stats()?.downloads?.byStatus || [];
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

  const totalLibraryItems = createMemo(() => stats()?.library?.total || 0);
  const activeDownloads = createMemo(() => stats()?.downloads?.active || []);
  const shareOfLibrary = (value: number) => {
    const total = totalLibraryItems();
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <>

      <div class="cinematic-dashboard">
        <header class="cinematic-page-header">
          <div>
            <h1 class="cinematic-title">Command Center</h1>
            <p class="cinematic-subtitle">Your media empire, at a glance.</p>
          </div>
          <div class="header-actions">
            <button
              type="button"
              class="api-status-toggle"
              onClick={() => setShowApiResponse((current) => !current)}
              aria-expanded={showApiResponse()}
            >
              <Database size={14} class="header-icon" />
              Nexus {apiStatus()} {showApiResponse() ? '[-]' : '[+]'}
            </button>
          </div>
        </header>

        {statsError() && (
          <Card class="mb-4">
            <CardHeader>
              <CardTitle>System Error</CardTitle>
            </CardHeader>
            <p class="text-error">{statsError()}</p>
          </Card>
        )}

        {showApiResponse() && health() && (
          <Card class="mb-4">
            <CardHeader>
              <CardTitle>Telemetry Data</CardTitle>
            </CardHeader>
            <pre style={{ "background": "rgba(0,0,0,0.5)", "color": "var(--accent-primary)", "padding": "1rem", "border": "1px solid var(--border-primary)", "border-radius": "8px" }}>
              {JSON.stringify(health(), null, 2)}
            </pre>
          </Card>
        )}

        <div class="bento-grid">
          {/* Main Total Stat (2x1) */}
          <div class="bento-card span-2">
            <div class="bento-header">
              <HardDrive size={20} class="bento-icon" />
              <span class="bento-header-title">Nexus Vault</span>
            </div>
            <div class="bento-stat-large">{totalLibraryItems()}</div>
            <div class="bento-stat-label">Total Assimilated Assets</div>
          </div>

          {/* Individual MediaType Stats */}
          <div class="bento-card">
            <div class="bento-header">
              <Film size={20} class="bento-icon" />
              <span class="bento-header-title">Cinema</span>
            </div>
            <div class="bento-stat-large">{stats()?.library?.movies ?? 0}</div>
            <div class="bento-stat-label">Films</div>
          </div>

          <div class="bento-card">
            <div class="bento-header">
              <Tv size={20} class="bento-icon" />
              <span class="bento-header-title">Series</span>
            </div>
            <div class="bento-stat-large">{stats()?.library?.tv ?? 0}</div>
            <div class="bento-stat-label">Shows</div>
          </div>

          <div class="bento-card">
            <div class="bento-header">
              <Music size={20} class="bento-icon" />
              <span class="bento-header-title">Audio</span>
            </div>
            <div class="bento-stat-large">{stats()?.library?.music ?? 0}</div>
            <div class="bento-stat-label">Albums</div>
          </div>

          <div class="bento-card">
            <div class="bento-header">
              <Download size={20} class="bento-icon" />
              <span class="bento-header-title">Queue</span>
            </div>
            <div class="bento-stat-large">{activeDownloads().length}</div>
            <div class="bento-stat-label">Active Transfers</div>
          </div>

          {/* Library Composition (2x2) */}
          <div class="bento-card span-2 row-2">
            <div class="bento-header">
              <Activity size={20} class="bento-icon" />
              <span class="bento-header-title">Vault Composition</span>
            </div>

            <div class="library-metrics">
              <div class="cinematic-mix-row">
                <span>Cinematic</span>
                <span>{stats()?.library?.movies ?? 0} ({shareOfLibrary(stats()?.library?.movies ?? 0)}%)</span>
              </div>
              <div class="cinematic-mix-bar"><span style={{ width: `${shareOfLibrary(stats()?.library?.movies ?? 0)}%` }} /></div>

              <div class="cinematic-mix-row">
                <span>Episodic</span>
                <span>{stats()?.library?.tv ?? 0} ({shareOfLibrary(stats()?.library?.tv ?? 0)}%)</span>
              </div>
              <div class="cinematic-mix-bar"><span style={{ width: `${shareOfLibrary(stats()?.library?.tv ?? 0)}%` }} /></div>

              <div class="cinematic-mix-row">
                <span>Aural</span>
                <span>{stats()?.library?.music ?? 0} ({shareOfLibrary(stats()?.library?.music ?? 0)}%)</span>
              </div>
              <div class="cinematic-mix-bar"><span style={{ width: `${shareOfLibrary(stats()?.library?.music ?? 0)}%` }} /></div>
            </div>

            <div class="bento-actions mt-auto">
              <Button class="btn-primary" onClick={() => void navigate('/search')}>
                <Search size={16} /> Locate Media
              </Button>
            </div>
          </div>

          {/* Download Pulse (2x2) */}
          <div class="bento-card span-2 row-2">
            <div class="bento-header">
              <Zap size={20} class="bento-icon" />
              <span class="bento-header-title">Transfer Pulse</span>
            </div>

            <div class="cinematic-status-pills">
              <Badge variant="info">Q: {statusCounts().queued}</Badge>
              <Badge variant="info">DL: {statusCounts().downloading}</Badge>
              <Badge variant="warning">PAUSED: {statusCounts().paused}</Badge>
              <Badge variant="success">DONE: {statusCounts().completed}</Badge>
              {statusCounts().failed > 0 && <Badge variant="error">ERR: {statusCounts().failed}</Badge>}
            </div>

            <div class="pulse-list">
              {activeDownloads().length === 0 ? (
                <div class="empty-state" style={{ "padding": "2rem 0" }}>
                  <p>All frequencies quiet. No active transfers.</p>
                </div>
              ) : (
                activeDownloads().slice(0, 4).map((download) => (
                  <div class="pulse-item">
                    <span class="pulse-item-title">{download.title}</span>
                    <span class="pulse-item-status">{download.status}</span>
                  </div>
                ))
              )}
            </div>

            <div class="bento-actions mt-auto">
              <Button variant="secondary" onClick={() => void navigate('/activity')}>
                <Activity size={16} /> System Logs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>

  );
}
