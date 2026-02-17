import MainLayout from '~/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, Button, Input } from '~/components/ui';
import { Settings, Server, HardDrive, Bell, Shield, Save } from 'lucide-solid';
import { createSignal, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { requestJson } from '~/lib/api';

const settingsTabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'media', label: 'Media', icon: HardDrive },
  { id: 'indexers', label: 'Indexers', icon: Server },
  { id: 'download', label: 'Download Client', icon: Server },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'advanced', label: 'Advanced', icon: Shield },
] as const;

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = createSignal('general');
  const [saving, setSaving] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const [form, setForm] = createStore({
    serverPort: '3000',
    host: '0.0.0.0',
    databasePath: './data/solari.db',
    moviesPath: './media/movies',
    tvPath: './media/tv',
    musicPath: './media/music',
    renameOnComplete: true,
    useHardlinks: true,
    jackettUrl: 'http://localhost:9117',
    jackettApiKey: '',
    delugeHost: 'localhost',
    delugePort: '58846',
    delugePassword: '',
    discordEnabled: false,
    discordWebhookUrl: '',
    notifyStarted: false,
    notifyCompleted: true,
    notifyFailed: true,
    tmdbApiKey: '',
    omdbApiKey: '',
  });

  onMount(async () => {
    const settingsResponse = await requestJson<Record<string, unknown>>('/api/settings');
    if (settingsResponse.data) {
      const settings = settingsResponse.data;
      setForm({
        serverPort: String(settings['server.port'] ?? form.serverPort),
        host: asString(settings['server.host'], form.host),
        databasePath: asString(settings['database.path'], form.databasePath),
        moviesPath: asString(settings['media.movies.path'], form.moviesPath),
        tvPath: asString(settings['media.tv.path'], form.tvPath),
        musicPath: asString(settings['media.music.path'], form.musicPath),
        renameOnComplete: asBoolean(settings['fileManagement.renameOnComplete'], form.renameOnComplete),
        useHardlinks: asBoolean(settings['fileManagement.useHardlinks'], form.useHardlinks),
        jackettUrl: asString(settings['jackett.baseUrl'], form.jackettUrl),
        jackettApiKey: asString(settings['jackett.apiKey'], form.jackettApiKey),
        delugeHost: asString(settings['deluge.host'], form.delugeHost),
        delugePort: String(settings['deluge.port'] ?? form.delugePort),
        delugePassword: asString(settings['deluge.password'], form.delugePassword),
        tmdbApiKey: asString(settings['apis.tmdb.apiKey'], form.tmdbApiKey),
        omdbApiKey: asString(settings['apis.omdb.apiKey'], form.omdbApiKey),
      });
    }

    const discordResponse = await requestJson<{
      webhookUrl?: string;
      enabled?: boolean;
      onDownloadStarted?: boolean;
      onDownloadCompleted?: boolean;
      onDownloadFailed?: boolean;
    } | null>('/api/settings/notifications/discord');

    if (discordResponse.data) {
      setForm({
        discordEnabled: discordResponse.data.enabled ?? form.discordEnabled,
        discordWebhookUrl: discordResponse.data.webhookUrl ?? form.discordWebhookUrl,
        notifyStarted: discordResponse.data.onDownloadStarted ?? form.notifyStarted,
        notifyCompleted: discordResponse.data.onDownloadCompleted ?? form.notifyCompleted,
        notifyFailed: discordResponse.data.onDownloadFailed ?? form.notifyFailed,
      });
    }

    if (settingsResponse.error || discordResponse.error) {
      setErrorMessage(settingsResponse.error || discordResponse.error || 'Failed to load settings');
    }

    setLoading(false);
  });

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const settingsPayload = {
      'server.port': Number.parseInt(form.serverPort, 10) || 3000,
      'server.host': form.host,
      'database.path': form.databasePath,
      'media.movies.path': form.moviesPath,
      'media.tv.path': form.tvPath,
      'media.music.path': form.musicPath,
      'fileManagement.renameOnComplete': form.renameOnComplete,
      'fileManagement.useHardlinks': form.useHardlinks,
      'jackett.baseUrl': form.jackettUrl,
      'jackett.apiKey': form.jackettApiKey,
      'deluge.host': form.delugeHost,
      'deluge.port': Number.parseInt(form.delugePort, 10) || 58846,
      'deluge.password': form.delugePassword,
      'apis.tmdb.apiKey': form.tmdbApiKey,
      'apis.omdb.apiKey': form.omdbApiKey,
    };

    const settingsResponse = await requestJson<{ message: string }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsPayload),
    });

    if (settingsResponse.error) {
      setErrorMessage(settingsResponse.error);
      setSaving(false);
      return;
    }

    const discordResponse = await requestJson<{ message: string }>('/api/settings/notifications/discord', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: form.discordWebhookUrl,
        enabled: form.discordEnabled,
        onDownloadStarted: form.notifyStarted,
        onDownloadCompleted: form.notifyCompleted,
        onDownloadFailed: form.notifyFailed,
      }),
    });

    if (discordResponse.error) {
      setErrorMessage(discordResponse.error);
      setSaving(false);
      return;
    }

    setStatusMessage('Settings saved');
    setSaving(false);
  };

  return (
    <MainLayout>
      <div class="settings-page">
        <header class="page-header">
          <Settings size={28} class="header-icon" />
          <h1 class="section-title">Settings</h1>
        </header>

        {loading() && <p>Loading settings...</p>}
        {errorMessage() && <p>{errorMessage()}</p>}
        {statusMessage() && <p>{statusMessage()}</p>}

        <div class="settings-layout">
          <nav class="settings-nav">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  class={`settings-tab ${activeTab() === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div class="settings-content">
            {activeTab() === 'general' && (
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group">
                    <label>Server Port</label>
                    <Input type="number" value={form.serverPort} onInput={(value) => setForm('serverPort', value)} />
                  </div>

                  <div class="form-group">
                    <label>Host</label>
                    <Input value={form.host} onInput={(value) => setForm('host', value)} />
                  </div>

                  <div class="form-group">
                    <label>Database Path</label>
                    <Input value={form.databasePath} onInput={(value) => setForm('databasePath', value)} />
                  </div>
                </div>
              </Card>
            )}

            {activeTab() === 'media' && (
              <Card>
                <CardHeader>
                  <CardTitle>Media Settings</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group">
                    <label>Movies Path</label>
                    <Input value={form.moviesPath} onInput={(value) => setForm('moviesPath', value)} />
                  </div>

                  <div class="form-group">
                    <label>TV Shows Path</label>
                    <Input value={form.tvPath} onInput={(value) => setForm('tvPath', value)} />
                  </div>

                  <div class="form-group">
                    <label>Music Path</label>
                    <Input value={form.musicPath} onInput={(value) => setForm('musicPath', value)} />
                  </div>

                  <div class="form-group checkbox">
                    <input
                      type="checkbox"
                      id="rename"
                      checked={form.renameOnComplete}
                      onChange={(event) => setForm('renameOnComplete', event.currentTarget.checked)}
                    />
                    <label for="rename">Rename files on completion</label>
                  </div>

                  <div class="form-group checkbox">
                    <input
                      type="checkbox"
                      id="hardlinks"
                      checked={form.useHardlinks}
                      onChange={(event) => setForm('useHardlinks', event.currentTarget.checked)}
                    />
                    <label for="hardlinks">Use hardlinks</label>
                  </div>
                </div>
              </Card>
            )}

            {activeTab() === 'indexers' && (
              <Card>
                <CardHeader>
                  <CardTitle>Jackett Configuration</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group">
                    <label>Jackett URL</label>
                    <Input
                      value={form.jackettUrl}
                      onInput={(value) => setForm('jackettUrl', value)}
                      placeholder="http://localhost:9117"
                    />
                  </div>

                  <div class="form-group">
                    <label>API Key</label>
                    <Input
                      type="password"
                      value={form.jackettApiKey}
                      onInput={(value) => setForm('jackettApiKey', value)}
                      placeholder="Enter Jackett API key"
                    />
                  </div>
                </div>
              </Card>
            )}

            {activeTab() === 'download' && (
              <Card>
                <CardHeader>
                  <CardTitle>Deluge Configuration</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group">
                    <label>Host</label>
                    <Input value={form.delugeHost} onInput={(value) => setForm('delugeHost', value)} />
                  </div>

                  <div class="form-group">
                    <label>Port</label>
                    <Input type="number" value={form.delugePort} onInput={(value) => setForm('delugePort', value)} />
                  </div>

                  <div class="form-group">
                    <label>Password</label>
                    <Input
                      type="password"
                      value={form.delugePassword}
                      onInput={(value) => setForm('delugePassword', value)}
                      placeholder="Enter Deluge password"
                    />
                  </div>
                </div>
              </Card>
            )}

            {activeTab() === 'notifications' && (
              <Card>
                <CardHeader>
                  <CardTitle>Discord Notifications</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group checkbox">
                    <input
                      type="checkbox"
                      id="discord-enabled"
                      checked={form.discordEnabled}
                      onChange={(event) => setForm('discordEnabled', event.currentTarget.checked)}
                    />
                    <label for="discord-enabled">Enable Discord notifications</label>
                  </div>

                  <div class="form-group">
                    <label>Webhook URL</label>
                    <Input
                      value={form.discordWebhookUrl}
                      onInput={(value) => setForm('discordWebhookUrl', value)}
                      placeholder="https://discord.com/api/webhooks/..."
                    />
                  </div>

                  <div class="form-group checkbox">
                    <input
                      type="checkbox"
                      id="notify-started"
                      checked={form.notifyStarted}
                      onChange={(event) => setForm('notifyStarted', event.currentTarget.checked)}
                    />
                    <label for="notify-started">Notify on download started</label>
                  </div>

                  <div class="form-group checkbox">
                    <input
                      type="checkbox"
                      id="notify-completed"
                      checked={form.notifyCompleted}
                      onChange={(event) => setForm('notifyCompleted', event.currentTarget.checked)}
                    />
                    <label for="notify-completed">Notify on download completed</label>
                  </div>

                  <div class="form-group checkbox">
                    <input
                      type="checkbox"
                      id="notify-failed"
                      checked={form.notifyFailed}
                      onChange={(event) => setForm('notifyFailed', event.currentTarget.checked)}
                    />
                    <label for="notify-failed">Notify on download failed</label>
                  </div>
                </div>
              </Card>
            )}

            {activeTab() === 'advanced' && (
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group">
                    <label>TMDB API Key</label>
                    <Input
                      value={form.tmdbApiKey}
                      onInput={(value) => setForm('tmdbApiKey', value)}
                      placeholder="Enter TMDB API key"
                    />
                  </div>

                  <div class="form-group">
                    <label>OMDb API Key</label>
                    <Input
                      value={form.omdbApiKey}
                      onInput={(value) => setForm('omdbApiKey', value)}
                      placeholder="Enter OMDb API key"
                    />
                  </div>
                </div>
              </Card>
            )}

            <div class="settings-actions">
              <Button variant="primary" size="lg" onClick={handleSave} disabled={saving()}>
                <Save size={18} />
                {saving() ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
