import { createAsync } from '@solidjs/router';
import MainLayout from '~/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, Badge, Progress, Button } from '~/components/ui';
import { Activity, Pause, Play, X, Download, Clock, HardDrive } from 'lucide-solid';
import { getApiUrl } from '~/lib/api';

const fetchDownloads = async () => {
  try {
    const res = await fetch(getApiUrl('/api/downloads'));
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export default function ActivityPage() {
  const downloads = createAsync(fetchDownloads);

  const activeDownloads = () => downloads()?.filter((d: any) => ['downloading', 'queued', 'paused'].includes(d.status)) || [];
  const completedDownloads = () => downloads()?.filter((d: any) => d.status === 'completed') || [];
  const failedDownloads = () => downloads()?.filter((d: any) => d.status === 'failed') || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading': return <Activity size={16} />;
      case 'paused': return <Pause size={16} />;
      case 'completed': return <Download size={16} />;
      case 'failed': return <X size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'downloading': return 'info';
      case 'paused': return 'warning';
      case 'completed': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <MainLayout>
      <div class="activity-page">
        <header class="page-header">
          <Activity size={28} class="header-icon" />
          <h1 class="section-title">Activity</h1>
        </header>

        <div class="activity-grid">
          {/* Active Downloads */}
          <Card class="activity-section">
            <CardHeader>
              <CardTitle>Active Downloads</CardTitle>
              <Badge variant="info">{activeDownloads().length} active</Badge>
            </CardHeader>

            <div class="downloads-list">
              {activeDownloads().length === 0 ? (
                <div class="empty-state">
                  <Activity size={48} />
                  <p>No active downloads</p>
                </div>
              ) : (
activeDownloads().map((download: any) => (
                  <div class="download-item">
                    <div class="download-header">
                      <div class="download-title">{download.title}</div>
                      <div class="download-actions">
                        <Button variant="ghost" size="sm">
                          {download.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <X size={16} />
                        </Button>
                      </div>
                    </div>

                    <div class="download-meta">
                      <Badge variant={getStatusVariant(download.status)}>
                        {getStatusIcon(download.status)}
                        {download.status}
                      </Badge>
                      <span class="meta-item">{download.quality}</span>
                      <span class="meta-item">{formatSize(download.size)}</span>
                    </div>

                    <div class="download-progress">
                      <Progress value={download.progress || 0} />
                      <div class="progress-stats">
                        <span>{download.progress?.toFixed(1)}%</span>
                        <span>{formatSpeed(download.speed)}</span>
                        <span>ETA: {formatETA(download.eta)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Completed */}
          <Card class="activity-section">
            <CardHeader>
              <CardTitle>Completed</CardTitle>
              <Badge variant="success">{completedDownloads().length}</Badge>
            </CardHeader>

            <div class="downloads-list compact">
              {completedDownloads().length === 0 ? (
                <div class="empty-state">
                  <Download size={32} />
                  <p>No completed downloads</p>
                </div>
              ) : (
completedDownloads().slice(0, 10).map((download: any) => (
                  <div class="download-item compact">
                    <div class="download-title">{download.title}</div>
                    <div class="download-meta">
                      <Badge variant="success">Completed</Badge>
                      <span class="meta-item">{formatDate(download.completedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Failed */}
          <Card class="activity-section">
            <CardHeader>
              <CardTitle>Failed</CardTitle>
              <Badge variant="error">{failedDownloads().length}</Badge>
            </CardHeader>

            <div class="downloads-list compact">
              {failedDownloads().length === 0 ? (
                <div class="empty-state">
                  <HardDrive size={32} />
                  <p>No failed downloads</p>
                </div>
              ) : (
failedDownloads().map((download: any) => (
                  <div class="download-item compact">
                    <div class="download-title">{download.title}</div>
                    <div class="download-meta">
                      <Badge variant="error">Failed</Badge>
                      <span class="meta-item error">{download.errorMessage}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond) return '0 B/s';
  return formatSize(bytesPerSecond) + '/s';
}

function formatETA(seconds: number | undefined): string {
  if (!seconds) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(date: string | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString();
}
