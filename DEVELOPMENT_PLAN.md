# SoLaRi Development Plan

### Project Overview
**Name:** SoLaRi (Sonarr + Lidarr + Radarr Integration)
**Description:** Unified media management client combining movies, TV, and music in a single application
**Architecture:** Full rewrite with modern web stack

### Technology Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | SolidJS + SolidStart | High performance, fine-grained reactivity |
| Backend | Bun + Hono | Fast runtime, lightweight API framework |
| Database | SQLite + Drizzle ORM | Embedded, low-maintenance, Bun-compatible |
| Config | YAML/JSON (system) + SQLite (media) | Versionable + relational data |
| Deployment | Native executables | Cross-platform binaries via Bun |

### Database Schema (Drizzle)

#### Core Tables
```sql
-- Media items (abstract base)
media (id, type, title, originalTitle, overview, posterPath, backdropPath, createdAt, updatedAt)

-- Movies
movies (mediaId, releaseDate, runtime, tmdbId, imdbId, status, qualityProfileId, path)

-- TV Shows
series (mediaId, releaseDate, status, qualityProfileId, path, tvdbId)
episodes (seriesId, season, episode, airDate, title, overview, downloaded, qualityProfileId)

-- Music
artists (mediaId, musicBrainzId, genre, status, path)
albums (artistId, mediaId, musicBrainzId, releaseDate, status, qualityProfileId, path)
tracks (albumId, mediaId, musicBrainzId, trackNumber, duration, downloaded, qualityProfileId)

-- Download Queue
downloads (id, mediaType, mediaId, indexerId, title, torrentHash, status, progress, speed, eta, filePath, quality, addedAt, completedAt, delugeId)

-- Quality Profiles
qualityProfiles (id, name, mediaType, allowedQualities, minSize, maxSize, preferred)

-- Indexers
indexers (id, name, baseUrl, apiKey, enabled, mediaTypes)

-- Settings
settings (key, value, type)

-- Discord Notifications
discordSettings (webhookUrl, enabledEvents)
```

### File System Structure
```
soLaRi/
├── src/
│   ├── routes/                    # SolidStart file-based routes
│   │   ├── index.tsx             # Dashboard
│   │   ├── movies/               # Movies section
│   │   │   ├── index.tsx        # Library view
│   │   │   ├── [id].tsx         # Movie detail
│   │   │   └── add.tsx          # Add movie
│   │   ├── tv/                   # TV section
│   │   │   ├── index.tsx        # Series library
│   │   │   ├── [id].tsx         # Series detail
│   │   │   └── [id]/season/[season].tsx  # Season view
│   │   ├── music/                # Music section
│   │   │   ├── index.tsx        # Artists library
│   │   │   ├── artist/[id].tsx  # Artist detail
│   │   │   └── album/[id].tsx   # Album detail
│   │   ├── search/               # Category-first search
│   │   │   ├── index.tsx        # Category selection
│   │   │   ├── movies.tsx       # Movie search results
│   │   │   ├── tv.tsx           # TV search results
│   │   │   └── music.tsx        # Music search results
│   │   ├── activity/             # Download queue
│   │   │   └── index.tsx
│   │   └── settings/             # Configuration pages
│   │       ├── index.tsx        # General settings
│   │       ├── indexers.tsx     # Jackett configuration
│   │       ├── download-client.tsx  # Deluge configuration
│   │       ├── quality.tsx      # Quality profiles
│   │       ├── file-management.tsx # Naming/organization
│   │       └── notifications.tsx  # Discord settings
│   ├── components/
│   │   ├── ui/                   # Primitives (Button, Input, Card, etc.)
│   │   ├── media/                # Media-specific components
│   │   │   ├── MediaCard.tsx
│   │   │   ├── MediaGrid.tsx
│   │   │   ├── QualityBadge.tsx
│   │   │   └── Poster.tsx
│   │   ├── activity/             # Queue components
│   │   │   ├── DownloadCard.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── StatusBadge.tsx
│   │   └── layout/               # Layout components
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── MainLayout.tsx
│   ├── server/
│   │   ├── api/                  # Hono endpoints
│   │   │   ├── media.ts         # Media CRUD
│   │   │   ├── search.ts        # Search (via Jackett)
│   │   │   ├── downloads.ts     # Queue management
│   │   │   ├── indexers.ts      # Indexer config
│   │   │   ├── deluge.ts        # Download client actions
│   │   │   ├── quality.ts       # Quality profiles
│   │   │   ├── settings.ts      # App settings
│   │   │   └── stats.ts         # Dashboard aggregation
│   │   ├── services/
│   │   │   ├── media/           # Business logic
│   │   │   │   ├── movies.ts
│   │   │   │   ├── tv.ts
│   │   │   │   └── music.ts
│   │   │   ├── indexer/         # Jackett client
│   │   │   │   └── jackett.ts
│   │   │   ├── download/        # Deluge client
│   │   │   │   └── deluge.ts
│   │   │   ├── file/            # File operations
│   │   │   │   ├── namer.ts     # Filename generation
│   │   │   │   ├── organizer.ts # Folder creation
│   │   │   │   └── hardlink.ts  # Hardlink creation
│   │   │   └── notification/    # Discord notifications
│   │   │       └── discord.ts
│   │   ├── external/            # External API clients
│   │   │   ├── tmdb.ts          # TMDB API
│   │   │   ├── omdb.ts          # OMDb API
│   │   │   └── musicbrainz.ts   # MusicBrainz API
│   │   ├── db/                  # Database setup
│   │   │   ├── schema.ts        # Drizzle schema
│   │   │   ├── connection.ts    # SQLite connection
│   │   │   └── queries.ts       # Query helpers
│   │   └── middleware.ts        # Hono middleware
│   ├── lib/                     # Shared utilities
│   │   ├── quality.ts           # Quality profile logic
│   │   ├── validation.ts        # Request validation
│   │   └── helpers.ts           # Common helpers
│   ├── config/                  # Config handling
│   │   ├── index.ts             # Config loader
│   │   └── defaults.yaml        # Default config
│   ├── styles/                  # Global styles
│   └── types/                   # TypeScript types
├── config/                      # User config directory
│   ├── config.yaml              # Main config (created if missing)
│   └── quality-profiles.yaml   # Quality profiles
├── drizzle/                     # Database migrations
├── data/                        # SQLite database location
├── media/                       # Downloaded media (configurable)
│   ├── movies/
│   ├── tv/
│   └── music/
├── public/                      # Static assets
├── entry-server.tsx             # SolidStart entry
├── entry-client.tsx             # Client entry
├── app.tsx                      # Root component
├── package.json
├── tsconfig.json
└── README.md
```

### Implementation Phases

#### Phase 1: Foundation (Setup)
- [ ] Initialize SolidStart project with TypeScript
- [ ] Install dependencies (Hono, Drizzle, Better-SQLite3, js-yaml, solid-js)
- [ ] Set up project structure
- [ ] Configure TypeScript paths
- [ ] Create base README

#### Phase 2: Database Layer
- [ ] Set up Drizzle with Better-SQLite3
- [ ] Define all database schemas
- [ ] Create migration system
- [ ] Implement query helpers
- [ ] Seed initial quality profiles

#### Phase 3: Configuration System
- [ ] Create YAML config loader
- [ ] Define default config structure
- [ ] Implement config validation
- [ ] Create settings API endpoints
- [ ] Build settings UI pages

#### Phase 4: External API Clients
- [ ] Implement TMDB client (movies, TV)
- [ ] Implement MusicBrainz client (artists, albums, tracks)
- [ ] Implement OMDb client (ratings)
- [ ] Add rate limiting and caching
- [ ] Create service layer for metadata fetching

#### Phase 5: Jackett Integration
- [ ] Implement Jackett API client
- [ ] Create indexer management service
- [ ] Build search API (query all indexers)
- [ ] Implement result filtering/sorting
- [ ] Add indexer configuration UI

#### Phase 6: Deluge Integration
- [ ] Implement Deluge RPC client
- [ ] Create download service (add, remove, pause, resume)
- [ ] Implement queue monitoring
- [ ] Build download status tracking
- [ ] Add Deluge configuration UI

#### Phase 7: Quality Profiles
- [ ] Define quality formats (resolution, codec, source)
- [ ] Create profile management service
- [ ] Implement quality matching logic
- [ ] Build quality profile UI
- [ ] Add per-media quality selection

#### Phase 8: File Management
- [ ] Implement filename generation (with quality indicators)
- [ ] Create folder structure builder
- [ ] Add hardlink support
- [ ] Implement post-download processing
- [ ] Build file management settings UI

#### Phase 9: Core Media APIs
- [ ] Movies API (list, get, add, update, delete)
- [ ] TV API (list, get, add, update, delete, seasons, episodes)
- [ ] Music API (artists, albums, tracks)
- [ ] Add metadata sync with external APIs

#### Phase 10: Search Flow
- [ ] Build category selection UI
- [ ] Implement search APIs per media type
- [ ] Create search result pages
- [ ] Add "Add to library" from search
- [ ] Implement quality profile selection on add

#### Phase 11: Activity Queue
- [ ] Build download queue API
- [ ] Create queue UI with progress bars
- [ ] Add status indicators (downloading, paused, seeding, error)
- [ ] Implement pause/resume/cancel actions
- [ ] Add filtering and sorting

#### Phase 12: Dashboard
- [ ] Build stats aggregation API
- [ ] Create dashboard overview cards
- [ ] Add recent downloads section
- [ ] Show storage usage by media type
- [ ] Display upcoming releases

#### Phase 13: Notifications
- [ ] Implement Discord webhook client
- [ ] Define notification events
- [ ] Create notification settings UI
- [ ] Add notification preferences per event type

#### Phase 14: Core UI Layout
- [ ] Build responsive sidebar navigation
- [ ] Create main layout wrapper
- [ ] Implement header with search
- [ ] Add dark/light theme support
- [ ] Create base UI components (Button, Input, Card, etc.)

#### Phase 15: Movies Section
- [ ] Build movie library grid
- [ ] Create movie detail page
- [ ] Add movie add page with search
- [ ] Implement poster/backdrop display
- [ ] Show cast, crew, ratings

#### Phase 16: TV Section
- [ ] Build TV series library grid
- [ ] Create series detail page
- [ ] Add season view with episodes
- [ ] Implement episode status indicators
- [ ] Show air dates and status

#### Phase 17: Music Section
- [ ] Build artist library view
- [ ] Create artist detail page
- [ ] Add album detail page
- [ ] Implement track listing
- [ ] Show discography

#### Phase 18: Settings Pages
- [ ] General settings page
- [ ] Indexer configuration page
- [ ] Download client configuration page
- [ ] Quality profiles management page
- [ ] File management settings page
- [ ] Notifications settings page

#### Phase 19: Polish & Testing
- [ ] Add error boundaries
- [ ] Implement loading states
- [ ] Add form validation
- [ ] Create unit tests for services
- [ ] Add integration tests for APIs
- [ ] Test file operations

#### Phase 20: Deployment
- [ ] Configure Bun bundling
- [ ] Create native executables for Windows/Linux/Mac
- [ ] Write installation docs
- [ ] Create configuration guide
- [ ] Add Docker support (optional)

### Filename Format Examples
```
Movies:    Inception (2010) [1080p BluRay x265 HDR].mkv
TV:        The Office/Season 03/The Office - S03E05 [1080p WEB-DL].mkv
Music:     Pink Floyd/The Dark Side of the Moon (1973) [FLAC]/01 - Speak to Me.flac
```

### API Endpoints (Hono)

```
GET    /api/stats                    - Dashboard statistics
GET    /api/settings                 - Get settings
PUT    /api/settings                 - Update settings

# Media
GET    /api/media/movies             - List movies
GET    /api/media/movies/:id         - Get movie details
POST   /api/media/movies             - Add movie
PUT    /api/media/movies/:id         - Update movie
DELETE /api/media/movies/:id         - Delete movie

GET    /api/media/tv                 - List TV series
GET    /api/media/tv/:id             - Get series details
GET    /api/media/tv/:id/season/:s   - Get season episodes
POST   /api/media/tv                 - Add TV series
PUT    /api/media/tv/:id             - Update series
DELETE /api/media/tv/:id             - Delete series

GET    /api/media/music/artists      - List artists
GET    /api/media/music/artists/:id  - Get artist details
GET    /api/media/music/albums/:id   - Get album details
POST   /api/media/music/artists      - Add artist
DELETE /api/media/music/artists/:id  - Delete artist

# Search
GET    /api/search/movies?q=query    - Search movies (via Jackett + TMDB)
GET    /api/search/tv?q=query        - Search TV (via Jackett + TMDB)
GET    /api/search/music?q=query     - Search music (via Jackett + MusicBrainz)

# Downloads
GET    /api/downloads                - Get download queue
POST   /api/downloads                - Add download
POST   /api/downloads/:id/pause      - Pause download
POST   /api/downloads/:id/resume    - Resume download
DELETE /api/downloads/:id            - Remove download

# Indexers
GET    /api/indexers                 - List indexers
POST   /api/indexers                 - Add indexer
PUT    /api/indexers/:id             - Update indexer
DELETE /api/indexers/:id             - Delete indexer
GET    /api/indexers/:id/test        - Test indexer connection

# Quality Profiles
GET    /api/quality-profiles         - List quality profiles
POST   /api/quality-profiles         - Create profile
PUT    /api/quality-profiles/:id     - Update profile
DELETE /api/quality-profiles/:id     - Delete profile

# Deluge Client
GET    /api/deluge/status            - Get Deluge status
POST   /api/deluge/add-torrent       - Add torrent to Deluge
POST   /api/deluge/:hash/pause       - Pause torrent
POST   /api/deluge/:hash/resume      - Resume torrent
DELETE /api/deluge/:hash             - Remove torrent

# Notifications
GET    /api/discord/settings         - Get Discord settings
PUT    /api/discord/settings         - Update Discord settings
POST   /api/discord/test             - Test Discord webhook
```

### Configuration Structure (config.yaml)

```yaml
server:
  port: 3000
  host: "0.0.0.0"

database:
  path: "./data/solari.db"

media:
  movies:
    path: "./media/movies"
    enabled: true
  tv:
    path: "./media/tv"
    enabled: true
  music:
    path: "./media/music"
    enabled: true

jackett:
  baseUrl: "http://localhost:9117"
  apiKey: ""

deluge:
  host: "localhost"
  port: 58846
  password: ""

apis:
  tmdb:
    apiKey: ""
  omdb:
    apiKey: ""
  musicbrainz:
    baseUrl: "https://musicbrainz.org"

fileManagement:
  renameOnComplete: true
  createFolders: true
  useHardlinks: true
  folderStructure:
    movies: "{Title} ({Year})"
    tv: "{SeriesName}/Season {SeasonNumber:02}"
    music: "{ArtistName}/{AlbumName} ({ReleaseYear})"

notifications:
  discord:
    enabled: false
    webhookUrl: ""
    events:
      onDownloadStarted: false
      onDownloadCompleted: true
      onDownloadFailed: true
```

### Quality Profile Schema (quality-profiles.yaml)

```yaml
profiles:
  - id: "movie-4k"
    name: "Movies - 4K Quality"
    mediaType: "movie"
    allowedQualities:
      - "2160p BluRay x265 HDR"
      - "2160p BluRay x265 DV"
      - "2160p WEB-DL x265"
    minSizeGB: 15
    maxSizeGB: 80
    preferred: "2160p BluRay x265 HDR"

  - id: "movie-1080p"
    name: "Movies - 1080p Quality"
    mediaType: "movie"
    allowedQualities:
      - "1080p BluRay x264"
      - "1080p BluRay x265"
      - "1080p WEB-DL x264"
      - "1080p WEBRip x264"
    minSizeGB: 4
    maxSizeGB: 20
    preferred: "1080p BluRay x264"

  - id: "tv-1080p"
    name: "TV - 1080p Quality"
    mediaType: "tv"
    allowedQualities:
      - "1080p WEB-DL x264"
      - "1080p WEBRip x264"
      - "1080p HDTV x264"
    minSizeGB: 1
    maxSizeGB: 5
    preferred: "1080p WEB-DL x264"

  - id: "music-flac"
    name: "Music - FLAC Lossless"
    mediaType: "music"
    allowedQualities:
      - "FLAC"
      - "FLAC 24bit"
    minSizeMB: 100
    maxSizeMB: 1000
    preferred: "FLAC 24bit"

  - id: "music-mp3"
    name: "Music - MP3 Quality"
    mediaType: "music"
    allowedQualities:
      - "MP3 320kbps"
      - "MP3 V0"
    minSizeMB: 50
    maxSizeMB: 300
    preferred: "MP3 320kbps"
```

### Key Features Summary

| Feature | Status | Priority |
|---------|--------|----------|
| Unified library view (Movies/TV/Music) | Planned | High |
| Category-first search | Planned | High |
| Combined activity queue | Planned | High |
| Dashboard & stats | Planned | High |
| Jackett integration | Planned | High |
| Deluge integration | Planned | High |
| Auto-renaming with quality indicators | Planned | Medium |
| Folder organization | Planned | Medium |
| Hardlink support | Planned | Medium |
| Advanced quality profiles | Planned | Medium |
| Discord notifications | Planned | Medium |
| TMDB metadata | Planned | High |
| MusicBrainz metadata | Planned | High |
| OMDb ratings | Planned | Low |

### Development Notes

- **Manual-only operation:** No automatic grabbing or monitoring - user must manually add content
- **Single-user focus:** No authentication required for local network use
- **On-demand background tasks:** No built-in scheduler - all operations triggered via API
- **Native executable target:** Use Bun's bundling capabilities for Windows/Linux/Mac builds
- **Hybrid config:** System settings in YAML/JSON (versionable), media data in SQLite (relational)
