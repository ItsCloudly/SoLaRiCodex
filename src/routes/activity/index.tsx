import { createAsync } from '@solidjs/router';
import { createEffect, createSignal, onMount } from 'solid-js';
import MainLayout from '~/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, Badge, Progress, Button } from '~/components/ui';
import { Activity, Pause, Play, X, Download, Clock, HardDrive } from 'lucide-solid';
import { fetchJson, requestJson } from '~/lib/api';

const fetchDownloads = () => fetchJson<any[]>('/api/downloads');

export default function ActivityPage() {
  const downloadsResult = createAsync(fetchDownloads);

  const [downloads, setDownloads] = createSignal<any[]>([]);
  const [loadErrorMessage, setLoadErrorMessage] = createSignal<string | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [activeActionId, setActiveActionId] = createSignal<number | null>(null);

  createEffect(() => {
    const payload = downloadsResult();
    if (payload?.data) {
      setDownloads(payload.data);
      setLoadErrorMessage(null);
    } else if (payload?.error) {
      setLoadErrorMessage(payload.error);
    }
  });

  const refreshDownloads = async () => {
    const payload = await fetchDownloads();
    if (payload.error) {
      setLoadErrorMessage(payload.error);
      return;
    }

    if (payload.data) {
      setDownloads(payload.data);
      setLoadErrorMessage(null);
    }
  };

  onMount(() => {
    const interval = setInterval(() => {
      void refreshDownloads();
    }, 5000);

    return () => clearInterval(interval);
  });

  const loadError = () => loadErrorMessage() || downloadsResult()?.error;

  const activeDownloads = () => downloads().filter((d: any) => ['downloading', 'queued', 'paused'].includes(d.status));
  const completedDownloads = () => downloads().filter((d: any) => d.status === 'completed');
  const failedDownloads = () => downloads().filter((d: any) => d.status === 'failed');

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

  async function togglePause(download: any) {
    setActionError(null);
    setActiveActionId(download.id);

    const nextStatus = download.status === 'paused' ? 'downloading' : 'paused';
    const result = await requestJson<{ message: string }>(`/api/downloads/${download.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (result.error) {
      setActionError(result.error);
      setActiveActionId(null);
      return;
    }

    setDownloads((prev) => prev.map((item) => (
      item.id === download.id
        ? { ...item, status: nextStatus }
        : item
    )));
    setActiveActionId(null);
  }

  async function cancelDownload(download: any) {
    setActionError(null);
    setActiveActionId(download.id);

    const result = await requestJson<{ message: string }>(`/api/downloads/${download.id}`, {
      method: 'DELETE',
    });

    if (result.error) {
      setActionError(result.error);
      setActiveActionId(null);
      return;
    }

    setDownloads((prev) => prev.filter((item) => item.id !== download.id));
    setActiveActionId(null);
  }

  return (
    <MainLayout>
      <div class="activity-page">
        <header class="page-header">
          <Activity size={28} class="header-icon" />
          <h1 class="section-title">Activity</h1>
        </header>

        {loadError() && (
          <Card>
            <p>Failed to load downloads: {loadError()}</p>
          </Card>
        )}

        {actionError() && (
          <Card>
            <p>Action failed: {actionError()}</p>
          </Card>
        )}

        <div class="activity-grid">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void togglePause(download)}
                          disabled={activeActionId() === download.id}
                        >
                          {download.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void cancelDownload(download)}
                          disabled={activeActionId() === download.id}
                        >
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
  return `${formatSize(bytesPerSecond)}/s`;
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
