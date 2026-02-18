import { JSX, createEffect, createSignal, onMount } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { Film, Tv, Music, Search, Activity, Settings, Home, Sun, MoonStar, MonitorPlay } from 'lucide-solid';
import '~/styles/global.css';
import '~/styles/components.css';
import '~/styles/layout.css';

interface LayoutProps {
  children: JSX.Element;
}

const navItems = [
  { href: '/', icon: Home, label: 'Overview' },
  { href: '/movies', icon: Film, label: 'Films' },
  { href: '/tv', icon: Tv, label: 'Series' },
  { href: '/music', icon: Music, label: 'Music' },
  { href: '/player', icon: MonitorPlay, label: 'Player' },
  { href: '/search', icon: Search, label: 'Discover' },
  { href: '/activity', icon: Activity, label: 'Queue' },
  { href: '/settings', icon: Settings, label: 'Config' },
];

type ThemeMode = 'light' | 'dark';
const THEME_STORAGE_KEY = 'solari-theme-mode';

export default function MainLayout(props: LayoutProps) {
  const location = useLocation();
  const [theme, setTheme] = createSignal<ThemeMode>('light');

  const applyTheme = (mode: ThemeMode) => {
    document.documentElement.setAttribute('data-theme', mode);
  };

  onMount(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: ThemeMode = stored === 'dark' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  });

  createEffect(() => {
    const currentTheme = theme();
    if (typeof document === 'undefined') return;
    applyTheme(currentTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  });

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <div class="layout atlas-layout">
      <aside class="sidebar atlas-sidebar">
        <div class="sidebar-header atlas-brand">
          <div class="logo">
            <span class="logo-bracket">{`[`}</span>
            <span class="logo-text">SoLaRi</span>
            <span class="logo-bracket">{`]`}</span>
          </div>
          <div class="logo-subtitle">Editorial Media Desk</div>
        </div>

        <nav class="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));

            return (
              <A href={item.href} class={`nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} />
                <span>{item.label}</span>
              </A>
            );
          })}
        </nav>

        <div class="sidebar-footer">
          <div class="status-indicator">
            <span class="status-dot online" />
            <span class="status-text">Curation online</span>
          </div>
        </div>
      </aside>

      <main class="main-content atlas-main">
        <header class="atlas-topbar">
          <p class="atlas-kicker">SoLaRi</p>
          <div class="atlas-topbar-actions">
            <button
              type="button"
              class="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme() === 'light' ? 'dark' : 'light'} mode`}
              aria-pressed={theme() === 'dark'}
            >
              <span class="theme-toggle-icon theme-toggle-icon-sun">
                <Sun size={14} />
              </span>
              <span class="theme-toggle-label">{theme() === 'light' ? 'Linen' : 'Noir'}</span>
              <span class="theme-toggle-icon theme-toggle-icon-moon">
                <MoonStar size={14} />
              </span>
            </button>
            <p class="atlas-route">{location.pathname === '/' ? '/overview' : location.pathname}</p>
          </div>
        </header>
        <div class="atlas-content">{props.children}</div>
      </main>
    </div>
  );
}
