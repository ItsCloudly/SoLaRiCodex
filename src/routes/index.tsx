import { createSignal, onMount } from 'solid-js';
import MainLayout from '~/components/layout/MainLayout';
import { Card, CardHeader, CardTitle } from '~/components/ui';
import { Film, Tv, Music, Download } from 'lucide-solid';

export default function Dashboard() {
  const [apiStatus, setApiStatus] = createSignal<string>('loading');
  const [apiData, setApiData] = createSignal<any>(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setApiStatus('connected');
        setApiData(data);
      } else {
        setApiStatus('error');
      }
    } catch (e) {
      setApiStatus('error');
    }
  });

  return (
    <MainLayout>
      <div class="dashboard">
        <header class="dashboard-header">
          <h1 class="section-title">System Overview</h1>
          <div class="header-actions">
            <span class="timestamp">
              API Status: {apiStatus()}
            </span>
          </div>
        </header>

        {apiData() && (
          <Card>
            <CardHeader>
              <CardTitle>API Response</CardTitle>
            </CardHeader>
            <pre>{JSON.stringify(apiData(), null, 2)}</pre>
          </Card>
        )}

        {/* Stats Grid */}
        <div class="stats-grid">
          <Card class="stat-card">
            <div class="stat-icon movies">
              <Film size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">0</div>
              <div class="stat-label">Movies</div>
            </div>
          </Card>

          <Card class="stat-card">
            <div class="stat-icon tv">
              <Tv size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">0</div>
              <div class="stat-label">TV Series</div>
            </div>
          </Card>

          <Card class="stat-card">
            <div class="stat-icon music">
              <Music size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">0</div>
              <div class="stat-label">Albums</div>
            </div>
          </Card>

          <Card class="stat-card">
            <div class="stat-icon downloads">
              <Download size={24} />
            </div>
            <div class="stat-content">
              <div class="stat-value">0</div>
              <div class="stat-label">Active Downloads</div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
