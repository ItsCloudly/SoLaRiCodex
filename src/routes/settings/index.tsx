import MainLayout from '~/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, Button, Input } from '~/components/ui';
import { Settings, Server, HardDrive, Bell, Shield, Save } from 'lucide-solid';
import { createSignal } from 'solid-js';

const settingsTabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'media', label: 'Media', icon: HardDrive },
  { id: 'indexers', label: 'Indexers', icon: Server },
  { id: 'download', label: 'Download Client', icon: Server },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'advanced', label: 'Advanced', icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = createSignal('general');
  const [saving, setSaving] = createSignal(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Implement save
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
  };

  return (
    <MainLayout>
      <div class="settings-page">
        <header class="page-header">
          <Settings size={28} class="header-icon" />
          <h1 class="section-title">Settings</h1>
        </header>

        <div class="settings-layout">
          {/* Sidebar */}
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

          {/* Content */}
          <div class="settings-content">
            {activeTab() === 'general' && (
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>

                <div class="settings-form">
                  <div class="form-group">
                    <label>Server Port</label>
                    <Input type="number" value="3000" />
                  </div>

                  <div class="form-group">
                    <label>Host</label>
                    <Input value="0.0.0.0" />
                  </div>

                  <div class="form-group">
                    <label>Database Path</label>
                    <Input value="./data/solari.db" />
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
                    <Input value="./media/movies" />
                  </div>

                  <div class="form-group">
                    <label>TV Shows Path</label>
                    <Input value="./media/tv" />
                  </div>

                  <div class="form-group">
                    <label>Music Path</label>
                    <Input value="./media/music" />
                  </div>

                  <div class="form-group checkbox">
                    <input type="checkbox" id="rename" checked />
                    <label for="rename">Rename files on completion</label>
                  </div>

                  <div class="form-group checkbox">
                    <input type="checkbox" id="hardlinks" checked />
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
                    <Input value="http://localhost:9117" placeholder="http://localhost:9117" />
                  </div>

                  <div class="form-group">
                    <label>API Key</label>
                    <Input type="password" placeholder="Enter Jackett API key" />
                  </div>

                  <Button variant="secondary">Test Connection</Button>
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
                    <Input value="localhost" />
                  </div>

                  <div class="form-group">
                    <label>Port</label>
                    <Input type="number" value="58846" />
                  </div>

                  <div class="form-group">
                    <label>Password</label>
                    <Input type="password" placeholder="Enter Deluge password" />
                  </div>

                  <Button variant="secondary">Test Connection</Button>
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
                    <input type="checkbox" id="discord-enabled" />
                    <label for="discord-enabled">Enable Discord notifications</label>
                  </div>

                  <div class="form-group">
                    <label>Webhook URL</label>
                    <Input placeholder="https://discord.com/api/webhooks/..." />
                  </div>

                  <div class="form-group checkbox">
                    <input type="checkbox" id="notify-started" />
                    <label for="notify-started">Notify on download started</label>
                  </div>

                  <div class="form-group checkbox">
                    <input type="checkbox" id="notify-completed" checked />
                    <label for="notify-completed">Notify on download completed</label>
                  </div>

                  <div class="form-group checkbox">
                    <input type="checkbox" id="notify-failed" checked />
                    <label for="notify-failed">Notify on download failed</label>
                  </div>

                  <Button variant="secondary">Test Webhook</Button>
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
                    <Input placeholder="Enter TMDB API key" />
                  </div>

                  <div class="form-group">
                    <label>OMDb API Key</label>
                    <Input placeholder="Enter OMDb API key" />
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
