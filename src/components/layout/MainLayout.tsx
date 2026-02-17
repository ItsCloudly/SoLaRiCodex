import { JSX } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { Film, Tv, Music, Search, Activity, Settings, Home } from 'lucide-solid';
import '~/styles/global.css';
import '~/styles/components.css';
import '~/styles/layout.css';

interface LayoutProps {
  children: JSX.Element;
}

const navItems = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/movies', icon: Film, label: 'Movies' },
  { href: '/tv', icon: Tv, label: 'TV Shows' },
  { href: '/music', icon: Music, label: 'Music' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/activity', icon: Activity, label: 'Activity' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function MainLayout(props: LayoutProps) {
  const location = useLocation();

  return (
    <div class="layout">
      {/* Sidebar */}
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-bracket">[</span>
            <span class="logo-text">SoLaRi</span>
            <span class="logo-bracket">]</span>
          </div>
          <div class="logo-subtitle">MEDIA_SYSTEM_V1.0</div>
        </div>

        <nav class="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            
            return (
              <A
                href={item.href}
                class={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </A>
            );
          })}
        </nav>

        <div class="sidebar-footer">
          <div class="status-indicator">
            <span class="status-dot online"></span>
            <span class="status-text">SYSTEM ONLINE</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main class="main-content">
        {props.children}
      </main>
    </div>
  );
}
