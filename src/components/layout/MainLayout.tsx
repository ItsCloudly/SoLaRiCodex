import { JSX } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import '~/styles/global.css';
import '~/styles/components.css';
import '~/styles/layout.css';
import homeTaskbarAsset from '../../../buttons_assets/extracted/taskbar_home_button_cutout.webp';
import moviesTaskbarAsset from '../../../buttons_assets/extracted/taskbar_movies_button_cutout.webp';
import tvTaskbarAsset from '../../../buttons_assets/extracted/taskbar_TV_button_cutout.webp';
import musicTaskbarAsset from '../../../buttons_assets/extracted/taskbar_Music_button_cutout.webp';
import playerTaskbarAsset from '../../../buttons_assets/extracted/taskbar_player_button_cutout.webp';
import searchTaskbarAsset from '../../../buttons_assets/extracted/taskbar_search_button_cutout.webp';
import settingsTaskbarAsset from '../../../buttons_assets/extracted/taskbar_settings_button_cutout.webp';
import sportsTaskbarAsset from '../../../buttons_assets/extracted/taskbar_sports_button_cutout.webp';

interface LayoutProps {
  children: JSX.Element;
}

const navItems = [
  { href: '/', iconSrc: homeTaskbarAsset, label: 'Home' },
  { href: '/movies', iconSrc: moviesTaskbarAsset, label: 'Movies' },
  { href: '/tv', iconSrc: tvTaskbarAsset, label: 'TV' },
  { href: '/music', iconSrc: musicTaskbarAsset, label: 'Music' },
  { href: '/sports', iconSrc: sportsTaskbarAsset, label: 'Sports' },
  { href: '/player', iconSrc: playerTaskbarAsset, label: 'Player' },
  { href: '/search', iconSrc: searchTaskbarAsset, label: 'Search' },
  { href: '/settings', iconSrc: settingsTaskbarAsset, label: 'Settings' },
];

export default function MainLayout(props: LayoutProps) {
  const location = useLocation();

  return (
    <div class="play-shell">
      <main class="play-main">
        <div class="atlas-content">{props.children}</div>
      </main>

      <nav class="taskbar-nav" aria-label="Main navigation">
        <div class="taskbar-track">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));

            return (
              <A
                href={item.href}
                class={`taskbar-link ${isActive ? 'active' : ''}`}
                aria-label={item.label}
                title={item.label}
              >
                <img class="taskbar-icon-image" src={item.iconSrc} alt="" />
                <span class="sr-only">{item.label}</span>
              </A>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
