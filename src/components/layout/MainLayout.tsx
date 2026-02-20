import { JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import {
  Film,
  Tv,
  Music,
  Search,
  Activity,
  Settings,
  Home,
  MonitorPlay,
} from "lucide-solid";
import { ThemeProvider } from "~/components/ui/ThemeProvider";
import ThemeToggle from "~/components/ui/ThemeToggle";
import "~/styles/global.css";
import "~/styles/components.css";
import "~/styles/layout.css";

interface LayoutProps {
  children: JSX.Element;
}

const navItems = [
  { href: "/", icon: Home, label: "Overview" },
  { href: "/movies", icon: Film, label: "Films" },
  { href: "/tv", icon: Tv, label: "Series" },
  { href: "/music", icon: Music, label: "Music" },
  { href: "/player", icon: MonitorPlay, label: "Player" },
  { href: "/search", icon: Search, label: "Discover" },
  { href: "/activity", icon: Activity, label: "Queue" },
  { href: "/settings", icon: Settings, label: "Config" },
];

export default function MainLayout(props: LayoutProps) {
  const location = useLocation();

  return (
    <ThemeProvider>
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
              const isActive =
                location.pathname === item.href ||
                (item.href !== "/" && location.pathname.startsWith(item.href));

              return (
                <A
                  href={item.href}
                  class={`nav-link ${isActive ? "active" : ""}`}
                >
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
              <ThemeToggle />
              <p class="atlas-route">
                {location.pathname === "/" ? "/overview" : location.pathname}
              </p>
            </div>
          </header>
          <div class="atlas-content">{props.children}</div>
        </main>
      </div>
    </ThemeProvider>
  );
}
