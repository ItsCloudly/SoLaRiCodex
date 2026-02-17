import { createAsync } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, CardHeader, CardTitle } from '~/components/ui';
import { Film, Tv, Music, Download } from 'lucide-solid';
import { fetchJson } from '~/lib/api';
import type { Stats } from '~/types';

const fetchStats = () => fetchJson<Stats>('/api/stats');
const fetchHealth = () => fetchJson<{ status: string; timestamp: string }>('/api/health');

export default function Dashboard() {
  const statsResult = createAsync(fetchStats);
  const healthResult = createAsync(fetchHealth);

  const stats = () => statsResult()?.data;
  const statsError = () => statsResult()?.error;
  const health = () => healthResult()?.data;

  const apiStatus = () => {
    if (healthResult()?.error) return 'error';
    if (health()?.status === 'ok') return 'connected';
    return 'loading';
  };

  return (
    <MainLayout>
      <div class="dashboard">
        <header class="dashboard-header">
          <h1 class="section-title">System Overview</h1>
          <div class="header-actions">
            <span class="timestamp">API Status: {apiStatus()}</span>
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

        {health() && (
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
        </div>
      </div>
    </MainLayout>
  );
}
