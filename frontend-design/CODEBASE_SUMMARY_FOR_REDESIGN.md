# SoLaRi — Codebase Summary for UI/UX Redesign Planning

> **Purpose of this document:** Give any model (or human designer) every piece of information it needs to plan and execute a complete UI/UX redesign of the SoLaRi frontend — without needing to read the source code itself.

---

## Table of Contents

1. [Project Identity & Purpose](#1-project-identity--purpose)
2. [Technology Stack & Build Pipeline](#2-technology-stack--build-pipeline)
3. [File & Directory Structure](#3-file--directory-structure)
4. [Application Architecture](#4-application-architecture)
5. [Routing & Navigation Map](#5-routing--navigation-map)
6. [Page-by-Page UI Inventory](#6-page-by-page-ui-inventory)
7. [Component Library](#7-component-library)
8. [Media Player System (Critical — Do Not Break)](#8-media-player-system)
9. [Design Tokens & Current Styling Architecture](#9-design-tokens--current-styling-architecture)
10. [Theme System](#10-theme-system)
11. [Data Flow & API Surface](#11-data-flow--api-surface)
12. [TypeScript Domain Models](#12-typescript-domain-models)
13. [Database Schema (What Shapes the UI)](#13-database-schema)
14. [External Integrations That Affect UI](#14-external-integrations-that-affect-ui)
15. [CSS Class Name Contract](#15-css-class-name-contract)
16. [Responsive Breakpoints](#16-responsive-breakpoints)
17. [Accessibility Status](#17-accessibility-status)
18. [Constraints & Non-Negotiables for Redesign](#18-constraints--non-negotiables)
19. [Known UX Gaps & Opportunities](#19-known-ux-gaps--opportunities)
20. [Recommended Redesign Strategy](#20-recommended-redesign-strategy)

---

## 1. Project Identity & Purpose

**SoLaRi** is a self-hosted, unified media management client for **movies**, **TV series**, and **music**. Think of it as a personal "Sonarr + Radarr + Lidarr" in a single application with a built-in media player.

**Core user workflows:**
1. **Library browsing** — View all movies, TV shows, and music artists/albums in the collection.
2. **Media discovery & acquisition** — Search TMDB/MusicBrainz for titles → add to library → search Jackett indexers for releases → send torrents to Deluge for download.
3. **Download monitoring** — Track active/completed/failed downloads in a queue view.
4. **Playback** — Play video (movies, episodes) and audio (music tracks) directly in the browser, with playlist support, lyrics display, subtitle selection, and playback progress persistence.
5. **Settings management** — Configure paths, API keys, Deluge/Jackett connections, Discord notifications.
6. **Local file linking** — Point existing media folders at library entries so the app discovers and links them automatically.

**Target audience:** Technical self-hosters running a home media server (single-user or household).

---

## 2. Technology Stack & Build Pipeline

| Layer | Technology | Version/Notes |
|-------|-----------|---------------|
| **Framework** | SolidJS | ^1.9.3 — Fine-grained reactive UI |
| **Meta-framework** | SolidStart | ^1.0.10 — SSR, file-based routing |
| **Build tool** | Vinxi | ^0.5.7 (wraps Vite) |
| **Routing** | @solidjs/router | ^0.14.10 — `<FileRoutes />` auto-routes |
| **Server API** | Hono | ^4.6.12 — runs inside SolidStart via catch-all route |
| **Database** | better-sqlite3 + Drizzle ORM | SQLite, local file `./data/solari.db` |
| **Icons** | lucide-solid | ^0.563.0 — All icons come from this |
| **Styling** | Plain CSS + SCSS variables | No CSS-in-JS, no Tailwind, no CSS modules |
| **Fonts** | Google Fonts (Outfit, JetBrains Mono) | Loaded in SSR entry + CSS @import |
| **Data fetching** | SolidJS `createAsync` + custom `fetchJson`/`requestJson` | No TanStack Query in active use despite being a dependency |
| **Validation** | Zod | ^3.23.8 — Server-side request validation |
| **Config** | YAML file (`config/config.yaml`) | Managed by `src/config/index.ts` |
| **Deployment** | Node.js server (preset: `node-server`, port 3000) | |

### Build Commands
```
npm run dev        # Development server (Vinxi)
npm run build      # Production build (vinxi build)
npm run start      # Start production server
npm run typecheck  # tsc --noEmit
```

### Vite/SCSS Configuration
`app.config.ts` prepends `src/styles/variables.scss` to every SCSS file via `additionalData`. This means SCSS variables/mixins defined there are globally available. However, the actual page styles are **plain CSS files**, not SCSS — the SCSS file only defines CSS custom properties inside `:root`.

---

## 3. File & Directory Structure

```
src/
├── app.tsx                          # Root <Router> with <MediaPlayerProvider> wrapper
├── entry-client.tsx                 # Client hydration mount
├── entry-server.tsx                 # SSR handler, <html> shell, font links
├── config/
│   └── index.ts                     # Server-side YAML config loader (SoLaRiConfig type)
├── lib/
│   └── api.ts                       # Client-side fetch helpers (fetchJson, requestJson, getApiUrl)
├── types/
│   └── index.ts                     # Shared domain interfaces (Media, Movie, Series, Episode, etc.)
├── components/
│   ├── layout/
│   │   └── MainLayout.tsx           # Shell: sidebar + topbar + content area
│   ├── player/
│   │   └── MediaPlayerProvider.tsx   # ~1900 lines — full player logic + UI (SENSITIVE)
│   └── ui/
│       ├── index.tsx                # Card, Button, Badge, Progress, Input + re-exports
│       ├── ThemeProvider.tsx         # Theme context (light/dark), localStorage persistence
│       └── ThemeToggle.tsx           # Animated sun/moon toggle button
├── routes/
│   ├── index.tsx                    # Dashboard (/) — stats, library mix, quick actions
│   ├── api/
│   │   └── [...path].ts            # Catch-all proxy → Hono API
│   ├── movies/
│   │   ├── index.tsx               # Movie library grid
│   │   └── [id].tsx                # Movie detail + Jackett search + local linking (~670 lines)
│   ├── tv/
│   │   ├── index.tsx               # TV series library grid
│   │   └── [id].tsx                # Series detail + seasons/episodes + search (~940 lines)
│   ├── music/
│   │   ├── index.tsx               # Artist library grid
│   │   └── [id].tsx                # Artist detail + albums/tracks + MusicBrainz records (~1170 lines)
│   ├── player/
│   │   └── index.tsx               # Player page (thin wrapper around MediaPlayerPanel)
│   ├── search/
│   │   └── index.tsx               # Universal search: category select → TMDB/MB search → Jackett → Deluge (~860 lines)
│   ├── activity/
│   │   └── index.tsx               # Download queue (active, completed, failed sections)
│   └── settings/
│       └── index.tsx               # Tabbed settings (general, media, indexers, download, notifications, advanced)
├── server/
│   ├── api/
│   │   ├── index.ts                # Hono app root (mounts all sub-routes)
│   │   ├── media.ts                # ~4400 lines — the behemoth (CRUD, playback streaming, lyrics, subtitles, ffmpeg, filesystem sync)
│   │   ├── search.ts               # TMDB/MusicBrainz search + Jackett filter/search orchestration
│   │   ├── deluge.ts               # Deluge WebUI JSON-RPC proxy
│   │   ├── downloads.ts            # Download CRUD + status updates
│   │   ├── stats.ts                # Dashboard statistics aggregation
│   │   ├── settings.ts             # Settings CRUD
│   │   ├── indexers.ts             # Indexer management
│   │   ├── quality.ts              # Quality profile management
│   │   └── utils.ts                # Shared server utilities
│   └── db/
│       ├── connection.ts           # Drizzle + better-sqlite3 connection singleton
│       └── schema.ts               # All table definitions (Drizzle schema)
└── styles/
    ├── variables.scss              # Design tokens (CSS custom properties inside :root)
    ├── global.css                  # Reset, base styles, dark mode tokens, ambient BG, animations
    ├── components.css              # Buttons, cards, inputs, badges, progress, nav links
    ├── layout.css                  # Layout shell, sidebar, topbar, grids, ALL page-specific styles (~1700 lines)
    └── player.css                  # Media player styles (~1230 lines)
```

---

## 4. Application Architecture

### Rendering Model
- **SSR with client hydration** — SolidStart renders on server, hydrates on client.
- All routes under `src/routes/` are file-based routes auto-discovered by `<FileRoutes />`.
- The `/api/[...path].ts` catch-all intercepts API requests and proxies them to the Hono app running in the same process.

### Component Hierarchy
```
<html> (entry-server.tsx — fonts, meta)
  └── <StartClient> / <StartServer>
       └── <Router root={...}>
            └── <MediaPlayerProvider>           ← Wraps entire app (context)
                 └── <ErrorBoundary>
                      └── <Suspense>
                           └── <FileRoutes />   ← Each page renders:
                                └── <MainLayout>  ← sidebar + topbar + content
                                     └── <ThemeProvider>
                                          └── Page content
```

**Important architectural note:** `<MediaPlayerProvider>` sits ABOVE `<MainLayout>` (at the Router root level), meaning the player context is available on every page. But `<ThemeProvider>` sits INSIDE `<MainLayout>`. This means:
- Theme is NOT available in the ErrorBoundary fallback or the MediaPlayerProvider itself.
- Every page individually wraps itself in `<MainLayout>`.

### State Management
- **No global store** — All state is managed via:
  - SolidJS signals (`createSignal`) local to each page/component.
  - SolidJS context (`createContext`) for MediaPlayer and Theme.
  - `createAsync` for server data fetching (wrapped `fetch` calls).
  - `localStorage` for theme preference, player volume, muted state, preferred audio language.

---

## 5. Routing & Navigation Map

| Path | Page Component | Nav Label | Nav Icon | Description |
|------|---------------|-----------|----------|-------------|
| `/` | `Dashboard` | Overview | `Home` | Stats cards, library mix, download pulse, quick actions |
| `/movies` | `Movies` | Films | `Film` | Grid of movie cards with poster/status overlay |
| `/movies/:id` | `MovieDetailsPage` | — | — | Detail card + Jackett release search panel + local file linking |
| `/tv` | `TVShows` | Series | `Tv` | Grid of series cards |
| `/tv/:id` | `TvDetailsPage` | — | — | Series detail + season accordion + episode list + search |
| `/music` | `MusicPage` | Music | `Music` | Grid of artist cards |
| `/music/:id` | `ArtistDetailsPage` | — | — | Artist detail + albums/tracks + MusicBrainz records + search |
| `/player` | `PlayerPage` | Player | `MonitorPlay` | Thin wrapper — shows `<MediaPlayerPanel>` or empty state |
| `/search` | `SearchPage` | Discover | `Search` | Category picker → TMDB/MB search → add to library → Jackett search → Deluge |
| `/activity` | `ActivityPage` | Queue | `Activity` | Active/completed/failed download sections with auto-refresh |
| `/settings` | `SettingsPage` | Config | `Settings` | Tabbed form (general, media, indexers, download, notifications, advanced) |

### Sidebar Navigation
Defined as a static array in `MainLayout.tsx`:
```
navItems = [
  { href: "/",        icon: Home,        label: "Overview" },
  { href: "/movies",  icon: Film,        label: "Films" },
  { href: "/tv",      icon: Tv,          label: "Series" },
  { href: "/music",   icon: Music,       label: "Music" },
  { href: "/player",  icon: MonitorPlay,  label: "Player" },
  { href: "/search",  icon: Search,      label: "Discover" },
  { href: "/activity", icon: Activity,    label: "Queue" },
  { href: "/settings", icon: Settings,    label: "Config" },
]
```

---

## 6. Page-by-Page UI Inventory

### 6.1 Dashboard (`/`)

**Layout:** Full-width content area inside MainLayout.

**Sections:**
1. **Header** — "System Overview" title + clickable API status badge (expands to show raw JSON).
2. **Stats Grid** (5 cards in a grid):
   - Movies count (Film icon, indigo accent)
   - TV Series count (Tv icon, teal accent)
   - Albums count (Music icon, pink accent)
   - Active Downloads count (Download icon, orange accent)
   - Total Library Items (Activity icon, spans wider)
3. **Dashboard Main Grid** (3-panel grid):
   - **Library Mix** — Three horizontal bars showing Movies/TV/Music proportion percentages.
   - **Download Pulse** — Badge chips for each status (queued, downloading, paused, completed, failed) + list of up to 6 active downloads.
   - **Quick Actions** — Three secondary buttons: Discover Media, Open Activity, Open Player.

**CSS classes used:** `.dashboard`, `.dashboard-header`, `.stats-grid`, `.stat-card`, `.stat-icon`, `.stat-icon.movies|tv|music|downloads`, `.stat-content`, `.stat-value`, `.stat-label`, `.stat-card-total`, `.dashboard-main-grid`, `.dashboard-panel`, `.dashboard-actions-panel`, `.library-mix-list`, `.library-mix-row`, `.library-mix-bar`, `.dashboard-status-chips`, `.overview-active-list`, `.overview-active-item`, `.dashboard-actions-grid`, `.api-status-toggle`.

**Data:** `GET /api/stats` → `Stats` type; `GET /api/health` → `{ status, timestamp }`.

---

### 6.2 Movies Library (`/movies`)

**Layout:** Page header + responsive grid of poster cards.

**Sections:**
1. **Header** — Film icon + "Movies" title + subtitle ("N titles in library") + search box + filter button (non-functional placeholder) + "Add Movie" primary button (navigates to `/search?category=movies`).
2. **Movies Grid** — Cards with poster image (or placeholder icon), status badge overlay, title, year + runtime text.
3. **Empty State** — Large icon + message + "Add Your First Movie" button.

**Interactions:** Clicking a card navigates to `/movies/:id`. Search input is present but not wired to filtering logic (placeholder).

**CSS classes:** `.movies-page`, `.page-header`, `.header-title`, `.header-icon`, `.header-subtitle`, `.header-actions`, `.search-box`, `.movies-grid`, `.movie-card`, `.movie-poster`, `.poster-placeholder`, `.movie-overlay`, `.movie-info`, `.movie-title`, `.movie-meta`, `.empty-state`.

---

### 6.3 Movie Detail (`/movies/:id`)

**Layout:** Back button + detail card + optional local panel + Jackett search panel.

**Sections:**
1. **Header** — Back button + "Movie Details" title.
2. **Detail Card** — Two-column: poster (left) + info (right).
   - Poster image or placeholder.
   - Title + status badge + "Play Movie" button (if downloaded/has local path).
   - Original title (if different).
   - Overview text.
   - Meta items with icons: Year, Runtime, TMDB ID, IMDb ID.
   - "+" button to expand local panel.
3. **Local File Panel** (collapsible) — Path input + "Link Local Folder" button + feedback messages.
4. **Jackett Release Search Panel** — Release query input + Load Filters button + Search button.
   - **Filter groups** (shown after loading): Indexers (checkboxes with search modes), Quality filters (checkboxes), Language filters (checkboxes + optional language code input).
   - **Results list** — Cards with title, indexer name, seeders, size, publish date, categories + "Send to Deluge" button + Open/Details links.
   - **Failure list** — Error messages per indexer.

**Data:** `GET /api/media/movies/:id` → movie detail object. Various POST endpoints for Jackett search and Deluge send.

**CSS classes:** `.movie-details-page`, `.movie-details-header`, `.back-button`, `.movie-details-card`, `.movie-details-layout`, `.movie-details-poster`, `.movie-details-content`, `.movie-details-title-row`, `.movie-details-title-actions`, `.movie-details-title`, `.movie-details-original-title`, `.movie-details-overview`, `.movie-details-meta`, `.meta-item`, `.local-media-card`, `.local-media-form`, `.local-media-actions`, `.jackett-panel`, `.movie-jackett-panel`, `.movie-release-query`, `.jackett-actions`, `.jackett-filters`, `.jackett-filter-group`, `.jackett-options`, `.jackett-options.compact`, `.jackett-option`, `.jackett-option-meta`, `.jackett-results-list`, `.jackett-release-card`, `.jackett-release-main`, `.jackett-release-title`, `.jackett-release-meta`, `.jackett-release-categories`, `.jackett-release-actions`, `.jackett-failures`, `.jackett-failure-line`, `.inline-feedback`, `.inline-feedback.error`, `.inline-feedback.success`, `.jackett-language-param`, `.jackett-empty`.

---

### 6.4 TV Library (`/tv`)

**Layout:** Mirrors movies — header + grid of series cards.

**Sections:** Same pattern as Movies but with TV-specific status variants (`continuing`, `ended`, `wanted`, `downloaded`, `archived`).

**CSS classes:** `.tv-page`, `.series-grid`, `.series-card`, `.series-poster`, `.series-overlay`, `.series-info`, `.series-title`, `.series-meta`.

---

### 6.5 TV Detail (`/tv/:id`)

**Layout:** Similar to Movie Detail but adds season/episode management.

**Unique sections:**
1. **Series Detail Card** — Same layout as movie but with TV-specific fields.
2. **Season Accordion** — Expandable season groups, each showing:
   - Season header with season number, episode count, downloaded count.
   - Episode list: rows with season/episode code, title, downloaded status badge, air date.
   - "Play Season" and "Play Episode" actions.
   - Per-season search option.
3. **Jackett Panel** — Same pattern as movie detail.
4. **Local File Panel** — Same pattern, but syncs episodes from filesystem.

**CSS classes (additional):** `.tv-seasons-card`, `.tv-season-card`, `.tv-season-header`, `.tv-season-title`, `.tv-season-subtitle`, `.tv-season-actions`, `.tv-season-code`, `.tv-episode-code`, `.tv-episodes-list`, `.tv-episode-row`, `.tv-episode-title`, `.tv-episode-meta`.

---

### 6.6 Music Library (`/music`)

**Layout:** Header + grid of artist cards (circular/rounded image style).

**CSS classes:** `.music-page`, `.artists-grid`, `.artist-card`, `.artist-image`, `.image-placeholder`, `.artist-info`, `.artist-name`, `.artist-genre`.

---

### 6.7 Artist Detail (`/music/:id`)

**Layout:** The most complex detail page.

**Unique sections:**
1. **Artist Detail Card** — Poster + name, genre, MusicBrainz ID, status.
2. **Library Albums Section** — Expandable album cards, each showing:
   - Album header (title, year, status badge, "Play Album" button).
   - Track list: rows with track number, title, downloaded indicator, play action.
3. **MusicBrainz Release Groups** — Categorized sections (Albums, EPs, Singles, Other), each group having records that can be expanded for Jackett search.
4. **Jackett Panel** — Same shared pattern.
5. **Local File Panel** — Syncs albums/tracks from filesystem.

**CSS classes (additional):** `.music-library-card`, `.music-library-albums`, `.music-library-album-card`, `.music-library-album-header`, `.music-library-album-meta`, `.music-library-album-actions`, `.music-library-tracks`, `.music-library-track-row`, `.music-library-track-number`, `.music-library-track-title`, `.artist-record-groups`, `.artist-record-group`, `.artist-record-group-title`, `.record-search-results`.

---

### 6.8 Player (`/player`)

**Layout:** Thin wrapper. Shows `<MediaPlayerPanel />` if a media item is loaded, otherwise shows an empty state card.

The actual player UI is rendered by `MediaPlayerProvider.tsx` (see Section 8).

**CSS classes:** `.player-page`, `.player-empty-card`.

---

### 6.9 Search (`/search`)

**Layout:** Two-phase interface.

**Phase 1 — Category Selection:**
- Three large category cards in a grid: Movies (Film), TV Shows (Tv), Music (Music).
- Each card has icon, label, description, and arrow indicator.

**Phase 2 — Search Interface (after category selected):**
1. **Search Bar** — Back button + search input + "Search" primary button.
2. **Search Results** — Cards with poster, title, overview/genre, action buttons.
   - If not in library: "Add to Library" button.
   - If in library: "In Library" badge + "Find Releases" button.
3. **Jackett Panel** (after clicking Find Releases) — Full Jackett search experience:
   - Music: additional "Record Selection (MusicBrainz)" dropdown for selecting specific album/EP/single.
   - Indexer/quality/language filters.
   - Results list with "Send to Deluge" actions.

**CSS classes:** `.search-page`, `.category-selection`, `.categories-grid`, `.category-card`, `.category-icon`, `.category-label`, `.category-description`, `.category-arrow`, `.search-interface`, `.search-bar`, `.search-input-wrapper`, `.search-input`, `.search-results`, `.no-results`, `.result-card`, `.result-poster`, `.result-info`, `.result-actions`, `.jackett-panel`, `.jackett-panel-header`, `.jackett-panel-subtitle`, `.jackett-filter-group`, `.jackett-options`, etc.

---

### 6.10 Activity (`/activity`)

**Layout:** Three-section vertical grid with auto-refresh (5-second interval).

**Sections:**
1. **Active Downloads** — Cards with title, status badge (icon + text), quality, size, progress bar, progress percentage, speed, ETA. Action buttons: pause/resume, cancel.
2. **Completed Downloads** — Compact cards with title, "Completed" badge, completion date. Limited to 10 items.
3. **Failed Downloads** — Compact cards with title, "Failed" badge, error message.

**CSS classes:** `.activity-page`, `.activity-grid`, `.activity-section`, `.activity-section-active`, `.activity-section-completed`, `.activity-section-failed`, `.downloads-list`, `.downloads-list.compact`, `.download-item`, `.download-item.compact`, `.download-header`, `.download-title`, `.download-actions`, `.download-meta`, `.download-progress`, `.progress-stats`.

---

### 6.11 Settings (`/settings`)

**Layout:** Two-column: left nav tabs + right content area.

**Tabs (6):**
1. **General** (Settings icon) — Server port, host, database path.
2. **Media** (Film icon) — Movie/TV/Music paths, rename-on-complete, use-hardlinks checkboxes.
3. **Indexers** (Search icon) — Jackett URL, API key, "Test Connection" button + feedback.
4. **Download** (Download icon) — Deluge host, port, password, per-media-type labels.
5. **Notifications** (Bell icon) — Discord enabled toggle, webhook URL, notification event checkboxes.
6. **Advanced** (Terminal icon) — MusicBrainz base URL/user agent, TMDB API key, OMDb API key.

Global "Save Settings" button at the bottom.

**CSS classes:** `.settings-page`, `.settings-layout`, `.settings-nav`, `.settings-tab`, `.settings-tab.active`, `.settings-content`, `.settings-form`, `.form-group`, `.form-group.checkbox`, `.settings-actions`, `.settings-inline-actions`.

---

## 7. Component Library

### 7.1 Shared UI Components (`src/components/ui/index.tsx`)

| Component | Props | CSS Class | Notes |
|-----------|-------|-----------|-------|
| `Card` | `children, class?, onClick?` | `.card` + optional class | Glass morphism background, hover lift effect |
| `CardHeader` | `children` | `.card-header` | Flex row with bottom border |
| `CardTitle` | `children` | `.card-title` | `<h3>` with 1.125rem weight 700 |
| `Button` | `children, variant?, size?, onClick?, disabled?, type?, class?` | `.btn .btn-{variant} .btn-{size}` | Variants: `primary` (indigo), `secondary` (teal), `ghost` (transparent). Sizes: `sm`, `md` (default), `lg` |
| `Badge` | `children, variant?` | `.badge .badge-{variant}` | Variants: `default`, `success`, `warning`, `error`, `info`. Pill-shaped |
| `Progress` | `value, max?` | `.progress > .progress-bar` | Gradient bar with shimmer animation |
| `Input` | `type?, placeholder?, value?, onInput?, class?` | `.input` | Focus glow ring, also used for `<select>` |

### 7.2 Theme Components

| Component | Description |
|-----------|-------------|
| `ThemeProvider` | Context provider. Reads `localStorage('solari-theme-mode')`, falls back to system preference. Sets `data-theme` attribute on `<html>`. |
| `ThemeToggle` | Pill-shaped toggle button with sun/moon icons. Animated track + thumb. Labels: "Linen" (light) / "Noir" (dark). |
| `useTheme()` | Hook returning `{ theme, toggleTheme, setTheme, isDark, label }`. |

### 7.3 Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `MainLayout` | `src/components/layout/MainLayout.tsx` | The app shell. Fixed sidebar (left) + main content area (right) with topbar. Wraps children in `<ThemeProvider>`. |

**MainLayout structure:**
```
.layout.atlas-layout
├── aside.sidebar.atlas-sidebar
│   ├── .sidebar-header.atlas-brand
│   │   ├── .logo  →  [SoLaRi]
│   │   └── .logo-subtitle  →  "Editorial Media Desk"
│   ├── nav.sidebar-nav
│   │   └── A.nav-link (×8)
│   └── .sidebar-footer
│       └── .status-indicator  →  "Curation online"
└── main.main-content.atlas-main
    ├── header.atlas-topbar
    │   ├── p.atlas-kicker  →  "SoLaRi"
    │   └── .atlas-topbar-actions
    │       ├── <ThemeToggle />
    │       └── p.atlas-route  →  current pathname
    └── .atlas-content
        └── {children}
```

---

## 8. Media Player System

> ⚠️ **This is the most complex and sensitive part of the codebase. ~1900 lines of logic. Any redesign must preserve all behavior — only change styling and DOM structure carefully.**

### 8.1 Architecture

`MediaPlayerProvider.tsx` exports:
- `MediaPlayerProvider` — Context provider component (wraps entire app in `app.tsx`).
- `MediaPlayerPanel` — The actual player UI component (rendered when a media item is loaded).
- `useMediaPlayer()` — Hook for accessing player controls from any page.

### 8.2 Context API (`useMediaPlayer()`)

| Method/Signal | Type | Description |
|--------------|------|-------------|
| `isOpen` | `Accessor<boolean>` | Whether the player is active |
| `queue` | `Accessor<PlayerQueueItem[]>` | Current playlist |
| `currentItem` | `Accessor<PlayerQueueItem \| null>` | Currently playing item |
| `currentIndex` | `Accessor<number>` | Index in queue |
| `playToken` | `Accessor<number>` | Increments on each play action (used for change detection) |
| `playbackError` | `Accessor<string \| null>` | Current error message |
| `openItem(item)` | Function | Play a single item |
| `openPlaylist(items, startIndex?)` | Function | Load playlist and start |
| `appendToQueue(item)` | Function | Add to end of playlist |
| `moveQueueItem(from, to)` | Function | Drag-reorder |
| `playAt(index)` | Function | Jump to playlist index |
| `playNext()` / `playPrevious()` | Function | Navigation |
| `close()` | Function | Close player |
| `setPlaybackError(msg)` | Function | Set error |

### 8.3 Player Queue Item Shape

```typescript
interface PlayerQueueItem {
  id: string | number;
  mediaId: number;
  mediaType: 'audio' | 'video';
  mediaKind: 'movie' | 'episode' | 'track';
  title: string;
  subtitle?: string;
  streamUrl: string;
  artworkUrl?: string;  // Music album art
}
```

### 8.4 Player Modes

1. **Video Mode** (`mediaType === 'video'`):
   - Full video stage with `<video>` element.
   - Fullscreen support with auto-hiding overlay controls.
   - Audio track selection (multi-language via ffmpeg probe).
   - Subtitle track selection (embedded, external files, OpenSubtitles online).
   - MKV compatibility streaming (transcodes via ffmpeg on-the-fly).
   - Progress persistence to server.
   - Resume playback prompt.
   - "Open in system player" fallback.

2. **Audio Mode** (`mediaType === 'audio'`):
   - Two/three column layout: artwork card (left) + panel (right).
   - Album artwork display (fetched from server based on album directory).
   - Now-playing caption (title + subtitle derived from metadata).
   - Transport controls (progress bar + buttons).
   - Right-side panel with toggle between: **Playlist** / **Lyrics**.

### 8.5 Player Sub-Features

- **Playlist**: Drag-to-reorder (native drag/drop), active item highlight, "Add to Playlist" modal with library search.
- **Lyrics**: Synced LRC display with active-line highlighting + auto-scroll, fetched from LRCLIB. Falls back to plain lyrics. Visual hierarchy: active line (large, bright), adjacent lines (medium), far lines (small, dim).
- **Progress Persistence**: Saves position/duration to server-side settings on pause, time update throttle, and beforeunload. Restores on re-open with "Resumed at X:XX" notice.
- **Volume**: Range slider with mute toggle. Persisted in localStorage.
- **Track Selectors**: Dropdowns for audio stream and subtitle track selection (video mode only).

### 8.6 Player CSS Classes (Partial — there are ~150 player-specific classes)

Key structural classes:
- `.media-player-shell` (`.audio-mode` | `.video-mode`)
- `.media-player-main`
- `.media-player-head`, `.media-player-titles`, `.media-player-kicker`, `.media-player-subtitle`
- `.media-player-audio-layout`, `.media-player-audio-stage`, `.media-player-audio-card`
- `.media-player-audio-artwork`, `.media-player-audio-artwork-fallback`
- `.media-player-audio-caption`, `.media-player-audio-transport`
- `.media-player-video-stage`, `.media-player-video`
- `.media-player-overlay-controls`, `.media-player-overlay-controls.visible`
- `.media-player-progress-wrap`, `.media-player-progress` (range input)
- `.media-player-controls`, `.media-player-buttons`, `.media-player-volume`
- `.media-player-control-button`, `.media-player-control-button.prominent`
- `.media-player-icon-button`
- `.media-player-playlist-block`, `.media-player-playlist-card`
- `.media-player-playlist-list`, `.media-player-playlist-item` (`.active`, `.dragging`, `.drag-over`)
- `.media-player-playlist-index`, `.media-player-drag-handle`, `.media-player-playlist-labels`
- `.media-player-panel-toggle`, `.media-player-panel-toggle-button` (`.active`)
- `.media-player-lyrics-panel`, `.media-player-lyrics-stage`
- `.media-player-lyrics-line` (`.active`, `.previous`, `.next-primary`, `.near`, `.upcoming`, `.far`)
- `.media-player-lyrics-empty`
- `.media-player-resume-note`
- `.media-player-track-selectors`, `.media-player-track-select`
- `.media-player-error`, `.media-player-error-wrap`
- `.media-player-add-button`
- `.media-player-modal-backdrop`, `.media-player-modal`, `.media-player-modal-header`
- `.media-player-library-results`, `.media-player-library-item`, `.media-player-library-item-labels`
- `.media-player-playlist-empty`, `.media-player-playlist-feedback`

---

## 9. Design Tokens & Current Styling Architecture

### 9.1 Token System (CSS Custom Properties)

Defined in both `variables.scss` and `global.css` (with `global.css` being the authoritative runtime source since it includes both light and dark mode values).

**Color Palette (Light):**
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#fafafa` | Page background |
| `--bg-secondary` | `#ffffff` | Card backgrounds, inputs |
| `--bg-tertiary` | `#f5f5f7` | Subtle backgrounds, hover states |
| `--bg-elevated` | `#ffffff` | Elevated surfaces |
| `--accent-primary` | `#5856d6` | Indigo — primary actions, active nav |
| `--accent-primary-dim` | `#4a48c4` | Darker indigo for hover/active |
| `--accent-primary-glow` | `rgba(88,86,214,0.15)` | Glow/focus rings |
| `--accent-secondary` | `#32ade6` | Teal — secondary buttons |
| `--accent-secondary-dim` | `#2a9fd4` | Darker teal |
| `--success` | `#34c759` | |
| `--warning` | `#ff9f0a` | |
| `--error` | `#ff3b30` | |
| `--info` | `#5ac8fa` | |
| `--text-primary` | `#1d1d1f` | Main text |
| `--text-secondary` | `#6e6e73` | Subtitles, meta |
| `--text-muted` | `#aeaeb2` | Placeholders |
| `--text-accent` | `#5856d6` | Accent-colored text |

**Color Palette (Dark — via `html[data-theme="dark"]`):**
| Token | Value |
|-------|-------|
| `--bg-primary` | `#000000` |
| `--bg-secondary` | `#0d0d0d` |
| `--bg-tertiary` | `#1c1c1e` |
| `--bg-elevated` | `#2c2c2e` |
| `--accent-primary` | `#7b79e7` |
| `--text-primary` | `#f5f5f7` |
| `--text-secondary` | `#a1a1a6` |
| `--text-muted` | `#636366` |

**Typography:**
| Token | Value |
|-------|-------|
| `--font-display` | `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif` |
| `--font-body` | `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace` |

**Spacing (8pt grid):** `--space-xs` (4px) through `--space-3xl` (64px).

**Border Radius:** `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (16px), `--radius-xl` (20px), `--radius-full` (9999px).

**Shadows:** `--shadow-xs` through `--shadow-xl`, plus `--shadow-glow` (indigo) and `--shadow-glow-cyan` (teal), `--shadow-card`.

**Glass/Frosted:** `--glass-bg` (72% white), `--glass-bg-heavy` (88%), `--glass-border`, `--glass-blur` (blur 20px + saturate 180%), `--glass-blur-heavy`.

**Transitions:** `--transition-fast` (150ms), `--transition-medium` (300ms), `--transition-slow` (500ms), `--transition-theme` (400ms), `--transition-spring` (500ms with bounce curve).

### 9.2 CSS File Responsibilities

| File | Lines | Scope |
|------|-------|-------|
| `global.css` | ~310 | Reset, `:root` tokens (light + dark), base typography, ambient background (radial gradient orbs), scrollbar, selection, focus, utility classes, theme transition layer, keyframe animations, reduced-motion query |
| `components.css` | ~290 | `.btn`, `.card`, `.input`, `.badge`, `.progress`, `.nav-link`, `.section-title` |
| `layout.css` | ~1700 | `.layout`, `.sidebar`, `.atlas-topbar`, `.theme-toggle`, ALL page-specific classes (dashboard, movies, tv, music, search, activity, settings, detail pages, Jackett panels), responsive media queries |
| `player.css` | ~1230 | All `.media-player-*` classes, responsive player queries |

### 9.3 Visual Identity

Current design language: **"Luma" — Apple-inspired minimalism.**
- Near-white/deep-black backgrounds with glass morphism (backdrop-filter blur).
- Cards with subtle borders and lift-on-hover.
- Indigo primary accent + teal secondary.
- Outfit font (geometric, clean) for all text.
- Ambient background: two soft radial gradient orbs (indigo + teal) behind content.
- Smooth 400ms theme transitions on all interactive elements.
- Animations: `lumaFadeIn`, `lumaFadeInScale`, `lumaSlideUp`, `lumaPulse`, `lumaShimmer`.

---

## 10. Theme System

### How It Works
1. `ThemeProvider` reads `localStorage('solari-theme-mode')` on mount.
2. Falls back to `prefers-color-scheme` media query, then defaults to `'light'`.
3. Sets `data-theme="light"` or `data-theme="dark"` on `<html>`.
4. All dark mode styles are scoped under `html[data-theme="dark"]` selector in CSS.
5. `color-scheme: light` / `color-scheme: dark` is set on `:root` for native form elements.

### What Changes Between Themes
- All CSS custom properties (colors, shadows, glass backgrounds, scrollbar colors).
- Some components have explicit dark-mode overrides (badges, nav active state, settings tab active, inputs hover).
- Theme transition is CSS-driven (400ms ease on background, color, border-color, box-shadow).

---

## 11. Data Flow & API Surface

### Client-Side Data Fetching Pattern

All pages use this pattern:
```typescript
const fetchSomeData = () => fetchJson<SomeType>('/api/some-endpoint');
const result = createAsync(fetchSomeData);
const data = () => result()?.data ?? defaultValue;
const error = () => result()?.error;
```

`fetchJson<T>` and `requestJson<T>` (from `src/lib/api.ts`) return `ApiResult<T>`:
```typescript
interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}
```

### API Endpoints Used by the Frontend

| Method | Path | Used By | Purpose |
|--------|------|---------|---------|
| GET | `/api/health` | Dashboard | Health check |
| GET | `/api/stats` | Dashboard | Library counts, download stats |
| GET | `/api/media/movies` | Movies page | List all movies |
| GET | `/api/media/movies/:id` | Movie detail | Single movie with full metadata |
| POST | `/api/media/movies` | Search page | Add movie to library |
| POST | `/api/media/movies/:id/locate` | Movie detail | Link local folder |
| GET | `/api/media/tv` | TV page | List all series |
| GET | `/api/media/tv/:id` | TV detail | Series with episodes |
| POST | `/api/media/tv` | Search page | Add series to library |
| POST | `/api/media/tv/:id/locate` | TV detail | Link local folder, sync episodes |
| GET | `/api/media/music/artists` | Music page | List all artists |
| GET | `/api/media/music/artists/:id` | Artist detail | Artist with albums |
| POST | `/api/media/music/artists` | Search page | Add artist to library |
| POST | `/api/media/music/artists/:id/locate` | Artist detail | Link local folder, sync albums/tracks |
| GET | `/api/media/music/albums/:id` | Artist detail | Album with tracks |
| GET | `/api/search/movies?q=` | Search page | TMDB movie search |
| GET | `/api/search/tv?q=` | Search page | TMDB TV search |
| GET | `/api/search/music?q=` | Search page | MusicBrainz artist search |
| GET | `/api/search/music/release-groups?artistId=` | Search/Artist detail | MusicBrainz release groups |
| POST | `/api/search/jackett/filters?category=` | Search/Detail pages | Load available Jackett indexers & filters |
| POST | `/api/search/jackett` | Search/Detail pages | Execute Jackett search |
| POST | `/api/deluge/add` | Search/Detail pages | Send torrent to Deluge |
| GET | `/api/downloads` | Activity page | List all downloads |
| PATCH | `/api/downloads/:id` | Activity page | Pause/resume |
| DELETE | `/api/downloads/:id` | Activity page | Cancel download |
| GET | `/api/settings` | Settings page | Load all settings |
| PUT | `/api/settings` | Settings page | Save settings |
| GET | `/api/discord/settings` | Settings page | Load Discord config |
| PUT | `/api/discord/settings` | Settings page | Save Discord config |
| POST | `/api/search/jackett/test` | Settings page | Test Jackett connection |
| GET | `/api/media/playback/library` | Player | Get playable items for "Add to Playlist" |
| POST | `/api/media/playback/progress` | Player | Save/load playback progress |
| GET | `/api/media/playback/progress/:kind/:id` | Player | Get saved progress for item |
| GET | `/api/media/stream/movie/:id` | Player | Stream movie file (supports Range) |
| GET | `/api/media/stream/episode/:id` | Player | Stream episode file |
| GET | `/api/media/stream/track/:id` | Player | Stream music track |
| GET | `/api/media/stream/movie/:id/compat` | Player | MKV → MP4 live transcode stream |
| GET | `/api/media/stream/episode/:id/compat` | Player | MKV → MP4 live transcode stream |
| GET | `/api/media/playback/:kind/:id/options` | Player | Probe audio/subtitle tracks |
| GET | `/api/media/playback/:kind/:id/subtitle/:trackId` | Player | Serve subtitle track as VTT |
| GET | `/api/media/music/albums/:id/artwork` | Player | Serve album artwork image |
| GET | `/api/media/music/tracks/:id/lyrics` | Player | Fetch/cache synced lyrics |
| GET | `/api/media/music/tracks/:id/metadata` | Player | Track title/artist/album from DB |
| POST | `/api/media/playback/:kind/:id/external` | Player | Open in system player |

---

## 12. TypeScript Domain Models

```typescript
// Core entity shared by all media types
interface Media {
  id: number;
  type: 'movie' | 'tv' | 'music';
  title: string;
  originalTitle?: string;
  overview?: string;
  posterPath?: string;       // TMDB image URL
  backdropPath?: string;     // TMDB image URL
  createdAt: Date;
  updatedAt: Date;
}

interface Movie {
  id: number;
  mediaId: number;
  releaseDate?: string;
  runtime?: number;          // minutes
  tmdbId?: number;
  imdbId?: string;
  status: 'wanted' | 'downloaded' | 'archived';
  qualityProfileId?: number;
  path?: string;             // local filesystem path
}

interface Series {
  id: number;
  mediaId: number;
  releaseDate?: string;
  status: 'continuing' | 'ended' | 'wanted' | 'downloaded' | 'archived';
  qualityProfileId?: number;
  path?: string;
  tvdbId?: number;
}

interface Episode {
  id: number;
  seriesId: number;
  season: number;
  episode: number;
  airDate?: string;
  title?: string;
  overview?: string;
  downloaded: boolean;
  qualityProfileId?: number;
  filePath?: string;
}

interface Artist {
  id: number;
  mediaId: number;
  musicBrainzId?: string;
  genre?: string;
  status: 'wanted' | 'downloaded' | 'archived';
  path?: string;
}

interface Album {
  id: number;
  artistId: number;
  mediaId: number;
  musicBrainzId?: string;
  releaseDate?: string;
  status: 'wanted' | 'downloaded' | 'archived';
  qualityProfileId?: number;
  path?: string;
}

interface Track {
  id: number;
  albumId: number;
  mediaId: number;
  musicBrainzId?: string;
  trackNumber?: number;
  duration?: number;         // seconds
  downloaded: boolean;
  qualityProfileId?: number;
  filePath?: string;
}

interface Download {
  id: number;
  mediaType: 'movie' | 'tv' | 'music';
  mediaId?: number;
  indexerId?: number;
  title: string;
  torrentHash?: string;
  status: 'queued' | 'downloading' | 'paused' | 'seeding' | 'completed' | 'failed';
  progress: number;          // 0-100
  speed?: number;            // bytes/s
  eta?: number;              // seconds
  filePath?: string;
  quality?: string;
  size?: number;             // bytes
  addedAt: Date;
  completedAt?: Date;
  delugeId?: string;
  errorMessage?: string;
}

interface Stats {
  library: { movies: number; tv: number; music: number; total: number };
  downloads: {
    byStatus: { status: string; count: number }[];
    active: Download[];
  };
  storage: {
    movies: { used: number; count: number };
    tv: { used: number; count: number };
    music: { used: number; count: number };
  };
  timestamp: string;
}
```

---

## 13. Database Schema

Tables (Drizzle/SQLite):

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `media` | id, type, title, originalTitle, overview, posterPath, backdropPath, timestamps | Base table — all media types reference this |
| `movies` | id, mediaId→media, releaseDate, runtime, tmdbId, imdbId, status, path | |
| `series` | id, mediaId→media, releaseDate, status, path, tvdbId | |
| `episodes` | id, seriesId→series, season, episode, airDate, title, overview, downloaded, filePath | |
| `artists` | id, mediaId→media, musicBrainzId, genre, status, path | |
| `albums` | id, artistId→artists, mediaId→media, musicBrainzId, releaseDate, status, path | |
| `tracks` | id, albumId→albums, mediaId→media, musicBrainzId, trackNumber, duration, downloaded, filePath | |
| `track_lyrics` | id, trackId→tracks, provider, sourceId, syncedLrc, plainLyrics | Cached lyrics from LRCLIB |
| `quality_profiles` | id, name, mediaType, allowedQualities (JSON), minSize, maxSize, preferred | |
| `indexers` | id, name, baseUrl, apiKey, enabled, mediaTypes (JSON), priority | |
| `downloads` | id, mediaType, mediaId, indexerId, title, torrentHash, status, progress, speed, eta, filePath, quality, size, delugeId, errorMessage, timestamps | |
| `settings` | key (PK), value, type | Key-value store. Also stores playback progress as JSON. |
| `discord_settings` | id, webhookUrl, enabled, event booleans | |

---

## 14. External Integrations That Affect UI

| Service | Used For | UI Impact |
|---------|----------|-----------|
| **TMDB** | Movie/TV search, metadata, poster images | Search results show TMDB posters and overviews. Poster URLs are stored and displayed in library grids. |
| **MusicBrainz** | Artist/album/track search, release group discovery | Artist search results, release group categorization (albums/EPs/singles/other) in artist detail. |
| **Jackett** | Torrent indexer aggregation | Complex filter UI (indexer checkboxes, quality/language categories), release result cards with seeders/size/etc. |
| **Deluge** | Torrent download management | "Send to Deluge" buttons, download status tracking, pause/resume/cancel actions. |
| **LRCLIB** | Synced lyrics | Lyrics panel in player with time-synced highlighting. |
| **OpenSubtitles** | Online subtitle search | Subtitle track dropdown options in video player. |
| **ffmpeg/ffprobe** | Media probing, MKV transcoding, subtitle extraction | Audio/subtitle track selectors, compatibility streaming fallback for MKV files. |
| **Discord** | Notifications | Settings toggle + webhook URL input + event checkboxes. |
| **Google Fonts** | Outfit + JetBrains Mono | Loaded via `<link>` in SSR entry and CSS `@import`. |

---

## 15. CSS Class Name Contract

> **CRITICAL for redesign:** The JSX in every route and component uses explicit CSS class names (strings in `class=` attributes). There are NO CSS modules, NO CSS-in-JS, NO utility classes. All styling is via globally-scoped class names defined in the four CSS files.

**You MUST preserve the class names used in JSX** if you want a non-breaking redesign (CSS-only changes). If you change JSX structure, update CSS selectors accordingly.

### Complete Class Name Inventory by Category

**Layout shell:** `.layout`, `.atlas-layout`, `.sidebar`, `.atlas-sidebar`, `.sidebar-header`, `.atlas-brand`, `.logo`, `.logo-bracket`, `.logo-text`, `.logo-subtitle`, `.sidebar-nav`, `.sidebar-footer`, `.status-indicator`, `.status-dot`, `.status-dot.online`, `.status-text`, `.main-content`, `.atlas-main`, `.atlas-topbar`, `.atlas-topbar-actions`, `.atlas-kicker`, `.atlas-route`, `.atlas-content`.

**Theme toggle:** `.theme-toggle`, `.theme-toggle-track`, `.theme-toggle-thumb`, `.theme-toggle-icons`, `.theme-toggle-icon`, `.theme-toggle-icon-sun`, `.theme-toggle-icon-moon`, `.theme-toggle-label`.

**Shared page structure:** `.section-title`, `.page-header`, `.header-title`, `.header-icon`, `.header-subtitle`, `.header-actions`, `.search-box`, `.back-button`, `.empty-state`, `.inline-feedback`, `.inline-feedback.error`, `.inline-feedback.success`.

**Dashboard:** `.dashboard`, `.dashboard-header`, `.stats-grid`, `.stat-card`, `.stat-icon`, `.stat-content`, `.stat-value`, `.stat-label`, `.stat-card-total`, `.dashboard-main-grid`, `.dashboard-panel`, `.dashboard-actions-panel`, `.library-mix-list`, `.library-mix-row`, `.library-mix-bar`, `.dashboard-status-chips`, `.overview-active-list`, `.overview-active-item`, `.dashboard-actions-grid`, `.api-status-toggle`.

**Media grids:** `.movies-page`, `.movies-grid`, `.movie-card`, `.movie-poster`, `.movie-overlay`, `.movie-info`, `.movie-title`, `.movie-meta`, `.tv-page`, `.series-grid`, `.series-card`, `.series-poster`, `.series-overlay`, `.series-info`, `.series-title`, `.series-meta`, `.music-page`, `.artists-grid`, `.artist-card`, `.artist-image`, `.image-placeholder`, `.artist-info`, `.artist-name`, `.artist-genre`, `.poster-placeholder`.

**Movie/TV detail:** `.movie-details-page`, `.movie-details-header`, `.movie-details-card`, `.movie-details-layout`, `.movie-details-poster`, `.movie-details-content`, `.movie-details-title-row`, `.movie-details-title-actions`, `.movie-details-title`, `.movie-details-original-title`, `.movie-details-overview`, `.movie-details-meta`, `.local-media-card`, `.local-media-form`, `.local-media-actions`.

**TV-specific detail:** `.tv-seasons-card`, `.tv-season-card`, `.tv-season-header`, `.tv-season-title`, `.tv-season-subtitle`, `.tv-season-actions`, `.tv-season-code`, `.tv-episode-code`, `.tv-episodes-list`, `.tv-episode-row`, `.tv-episode-title`, `.tv-episode-meta`.

**Music-specific detail:** `.music-library-card`, `.music-library-albums`, `.music-library-album-card`, `.music-library-album-header`, `.music-library-album-meta`, `.music-library-album-actions`, `.music-library-tracks`, `.music-library-track-row`, `.music-library-track-number`, `.music-library-track-title`, `.artist-record-groups`, `.artist-record-group`, `.artist-record-group-title`, `.record-search-results`.

**Search:** `.search-page`, `.category-selection`, `.categories-grid`, `.category-card`, `.category-icon`, `.category-label`, `.category-description`, `.category-arrow`, `.search-interface`, `.search-bar`, `.search-input-wrapper`, `.search-input`, `.search-results`, `.no-results`, `.result-card`, `.result-poster`, `.result-info`, `.result-actions`.

**Jackett shared:** `.jackett-panel`, `.movie-jackett-panel`, `.jackett-panel-header`, `.jackett-panel-subtitle`, `.jackett-filters`, `.jackett-filter-group`, `.jackett-options`, `.jackett-options.compact`, `.jackett-option`, `.jackett-option-meta`, `.jackett-actions`, `.jackett-results-list`, `.jackett-release-card`, `.jackett-release-main`, `.jackett-release-title`, `.jackett-release-meta`, `.jackett-release-categories`, `.jackett-release-actions`, `.jackett-failures`, `.jackett-failure-line`, `.jackett-empty`, `.jackett-language-param`, `.movie-release-query`.

**Activity:** `.activity-page`, `.activity-grid`, `.activity-section`, `.activity-section-active`, `.activity-section-completed`, `.activity-section-failed`, `.downloads-list`, `.downloads-list.compact`, `.download-item`, `.download-item.compact`, `.download-header`, `.download-title`, `.download-actions`, `.download-meta`, `.download-progress`, `.progress-stats`.

**Settings:** `.settings-page`, `.settings-layout`, `.settings-nav`, `.settings-tab`, `.settings-content`, `.settings-form`, `.form-group`, `.form-group.checkbox`, `.settings-actions`, `.settings-inline-actions`.

**Player:** (See Section 8.6 for the full ~70 structural player classes.)

---

## 16. Responsive Breakpoints

Three breakpoints are currently defined:

| Breakpoint | Trigger | Key Changes |
|------------|---------|-------------|
| `≤1200px` | Tablet landscape | Stats grid → 3 columns, dashboard grid → single column, settings stacks vertically, movie detail poster/content stack |
| `≤940px` | Tablet portrait | Sidebar collapses to icon-only (64px wide, labels hidden), topbar padding reduces |
| `≤760px` | Mobile | Grids → 2 columns, search results stack vertically, settings nav becomes horizontal scroll, download items become column layout, activity grid stacks |
| `≤780px` | Player mobile | Player layout adapts: audio card stacks, artwork shrinks, buttons/controls compact |

Additional player breakpoints:
- `≥1680px` → Audio layout uses 3 columns (artwork + card + playlist wider).
- `1420px–1679px` → Audio layout 2 columns with wider cards.
- `1180px–1419px` → Audio layout 2 columns standard.
- `<1180px` → Audio layout single column stack.

---

## 17. Accessibility Status

**Current state: Minimal.**

- ✅ `aria-label` on theme toggle and some player buttons.
- ✅ `aria-pressed` on theme toggle.
- ✅ `aria-expanded` on API status toggle.
- ✅ `aria-hidden` on decorative icons in theme toggle.
- ✅ Global `:focus-visible` outline (2px solid accent).
- ✅ `prefers-reduced-motion` media query (disables all animations).
- ⚠️ No `aria-label` on most icon-only buttons (player controls, sidebar nav icons on mobile).
- ⚠️ No skip-to-content link.
- ⚠️ No ARIA landmarks (nav, main, etc.) beyond semantic HTML.
- ⚠️ No `role` attributes on interactive card elements (cards with `onClick` are `<div>` not `<button>`).
- ⚠️ Color contrast for muted text in dark mode may not meet WCAG AA (e.g., `#636366` on `#000000` = 4.1:1, borderline for small text).
- ⚠️ The sidebar collapse to icon-only mode hides labels entirely (CSS `display: none` on spans), no tooltip fallback.
- ⚠️ Drag-and-drop playlist reordering has no keyboard alternative.

---

## 18. Constraints & Non-Negotiables for Redesign

### Must Preserve
1. **All MediaPlayerProvider logic** — ~1900 lines of player state management, playback, progress persistence, lyrics, subtitles, ffmpeg integration. Change CSS only; DOM structure changes require extreme care.
2. **Route structure** — File-based routing means paths are fixed to the directory structure.
3. **API contract** — All `fetchJson`/`requestJson` calls and their expected response shapes.
4. **Icon library** — `lucide-solid` is the only icon source. All icons used are from this package.
5. **SolidJS reactivity model** — `createSignal`, `createAsync`, `createEffect`, `createMemo`, `Show`, `For` — these are framework primitives, not swappable.
6. **Theme mechanism** — `data-theme` attribute on `<html>`, CSS custom properties, `useTheme()` hook.

### Safe to Change
1. **All CSS files** — Completely rewritable as long as class names match JSX usage (or JSX is updated simultaneously).
2. **Design tokens** — All CSS custom property values.
3. **Fonts** — Can replace Outfit/JetBrains Mono with anything.
4. **Layout structure in MainLayout** — Sidebar, topbar, content area arrangement. Can redesign the shell.
5. **UI component implementations** — Card, Button, Badge, etc. can be restyled or restructured.
6. **Page layouts** — Grid configurations, section ordering, card designs within pages.
7. **Color palette** — Fully replaceable.
8. **Animation/motion** — Keyframes, transitions, easing curves.
9. **Ambient visual effects** — Background orbs, glass morphism, etc.

### Risky to Change (Extra Care)
1. **Class names in MediaPlayerProvider.tsx JSX** — There are ~70+ class names referenced. If you rename any, update `player.css` simultaneously.
2. **Detail page JSX structure** (movies/[id], tv/[id], music/[id]) — These are 670–1170 lines with complex conditional rendering and tight coupling between signals and UI. Structural changes need careful testing.
3. **Search page flow** — The two-phase (category → search → Jackett) flow has interleaved state management.

---

## 19. Known UX Gaps & Opportunities

### Functional Gaps
1. **Search filtering on library pages** — Search inputs exist on Movies/TV/Music pages but don't actually filter the grid. Purely decorative.
2. **Filter button** — Present on library pages but non-functional.
3. **Quality profiles** — CRUD API exists but there's NO UI for managing quality profiles.
4. **Indexer management** — CRUD API exists but there's NO UI for managing indexers (only Jackett URL/key in settings).
5. **No sorting** — Library grids have no sort controls (by title, date, status, etc.).
6. **No pagination** — All media loads at once. Will be slow with large libraries.
7. **No loading skeletons** — Pages show nothing while data loads (Suspense fallback is empty).
8. **No toast/notification system** — Success/error feedback uses inline `<p>` elements, not toasts.
9. **No breadcrumbs** — Detail pages have a back button but no breadcrumb trail.
10. **No keyboard shortcuts** — Player has basic keyboard handling (space/arrow keys) but no app-wide shortcuts.

### Design Gaps
1. **Inconsistent poster aspect ratios** — Movie posters are 2:3, but artist images should ideally be square/circular.
2. **Dense detail pages** — Movie/TV/Music detail pages are very long vertical scrolls with no visual anchoring or section navigation.
3. **Jackett panel repetition** — The exact same Jackett filter/results UI is duplicated across Search, Movie detail, TV detail, and Music detail with copy-pasted code. A shared component would reduce inconsistency.
4. **Settings page is basic** — Tab content is simple form fields. No visual hierarchy or grouped sections.
5. **Activity page lacks visual progress** — Progress bars are small; no visual indication of overall queue health.
6. **No onboarding/first-run experience** — Empty states exist but there's no guided setup flow.
7. **Player page is a pass-through** — `/player` just renders `<MediaPlayerPanel>` with no additional chrome or player-specific navigation.

### UX Opportunities
1. **Mini player / persistent player bar** — Currently the player only exists on the `/player` page. A persistent mini player bar (like Spotify's bottom bar) would let users control playback while browsing.
2. **Contextual actions** — Right-click or long-press menus on media cards for quick actions (play, search releases, delete).
3. **Dashboard customization** — The dashboard is static. Widgets or a configurable layout would add value.
4. **Batch operations** — Select multiple items for bulk status changes, deletion, or Jackett search.
5. **Visual search filters** — Genre chips, year range sliders, status toggles for library browsing.
6. **Recently played / continue watching** — Leverage the playback progress data to show a "Continue" section.
7. **Notification center** — An in-app notification panel for download events (instead of only Discord).

---

## 20. Recommended Redesign Strategy

### Approach Options

**Option A: CSS-Only Redesign (Lowest Risk)**
- Rewrite all four CSS files.
- Change design tokens, colors, fonts, layout grids, animations.
- No JSX changes needed.
- Fastest to implement.
- Cannot fix structural UX issues (only visual).

**Option B: CSS + Layout Shell Redesign (Medium Risk)**
- Rewrite CSS files + modify `MainLayout.tsx`.
- Restructure sidebar, topbar, add persistent mini player bar.
- Update page wrappers for new layout requirements.
- Moderate structural changes.

**Option C: Full Redesign (High Scope)**
- Rewrite CSS files + refactor page JSX.
- Extract shared components (JackettPanel, MediaGrid, DetailPageShell).
- Add missing UI features (search filtering, sorting, loading states, toasts).
- Move ThemeProvider to `app.tsx` (wrap entire tree).
- Add persistent mini player.
- Redesign player UI within MediaPlayerPanel (keep logic, restructure JSX + CSS).
- Highest impact, highest effort.

### Recommended Sequence (for any option)

1. **Define the new design system** — Tokens (colors, spacing, radius, shadows, fonts), component specs, layout grid spec.
2. **Redesign the shell first** — MainLayout (sidebar + topbar + content area) sets the visual tone for everything.
3. **Redesign shared components** — Card, Button, Badge, Progress, Input, ThemeToggle.
4. **Redesign simple pages** — Dashboard, Activity, Settings (smallest, most contained).
5. **Redesign library grids** — Movies, TV, Music index pages (shared patterns).
6. **Redesign detail pages** — Movies → TV → Music (increasing complexity).
7. **Redesign search** — Complex multi-phase UI.
8. **Redesign player** — Most complex, most fragile. Do last.
9. **Visual QA across all pages and both themes.**
10. **Accessibility audit and fixes.**

---

*This document was generated by auditing every source file in the SoLaRi codebase. It should contain everything a model needs to plan a comprehensive UI/UX redesign without reading the source code directly.*