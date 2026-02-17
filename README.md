# SoLaRi

**SoLaRi** is a unified media management client that combines movies, TV shows, and music into a single, elegant application. Built with modern web technologies and a distinctive retro-futuristic industrial design.

## Features

- **Unified Library**: Manage movies, TV series, and music albums in one place
- **Category-First Search**: Search across all media types with an intuitive interface
- **Download Queue**: Monitor and manage active downloads with real-time progress
- **Quality Profiles**: Advanced quality settings for each media type
- **Jackett Integration**: Search across multiple indexers
- **Deluge Integration**: Direct download client control
- **Discord Notifications**: Stay informed about download events
- **File Management**: Automatic renaming, folder organization, and hardlink support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS + SolidStart |
| Backend | Bun + Hono |
| Database | SQLite + Drizzle ORM |
| Styling | CSS Variables + Scoped JSX |

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- Jackett (for indexer management)
- Deluge (for downloads)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/solari.git
cd solari

# Install dependencies
npm install

# Set up the database
npm run db:generate
npm run db:migrate

# Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Configuration

Configuration files are stored in the `config/` directory:

- `config.yaml` - Main application settings
- `quality-profiles.yaml` - Quality profile definitions

The configuration will be created automatically on first run with sensible defaults.

## Project Structure

```
soLaRi/
├── src/
│   ├── routes/           # SolidStart file-based routes
│   ├── components/       # UI components
│   ├── server/           # Backend API and services
│   │   ├── api/          # Hono REST endpoints
│   │   ├── services/     # Business logic
│   │   ├── external/     # External API clients
│   │   └── db/           # Database schema and connection
│   ├── config/           # Configuration handling
│   └── styles/           # Global CSS and component styles
├── config/               # User configuration files
├── drizzle/              # Database migrations
└── data/                 # SQLite database
```

## Design Philosophy

SoLaRi features a **retro-futuristic industrial** aesthetic inspired by vintage sci-fi interfaces:

- Deep charcoal backgrounds with amber/orange accents (vintage terminal)
- Electric cyan secondary color
- Scanline overlay effects
- JetBrains Mono for technical elements
- Space Grotesk for headers
- DM Sans for body text

## API Endpoints

```
GET    /api/stats                    - Dashboard statistics
GET    /api/media/movies             - List movies
GET    /api/media/movies/:id         - Get movie details
POST   /api/media/movies             - Add movie
GET    /api/media/tv                 - List TV series
GET    /api/media/tv/:id             - Get series details
GET    /api/media/music/artists      - List artists
GET    /api/media/music/artists/:id  - Get artist details
GET    /api/search/movies?q=query    - Search movies
GET    /api/search/tv?q=query        - Search TV
GET    /api/search/music?q=query     - Search music
GET    /api/downloads                - Get download queue
POST   /api/downloads                - Add download
GET    /api/indexers                 - List indexers
POST   /api/indexers                 - Add indexer
GET    /api/quality-profiles         - List quality profiles
GET    /api/settings                 - Get settings
PUT    /api/settings                 - Update settings
```

## Roadmap

- [x] Project setup and database schema
- [x] Core UI layout and design system
- [x] Dashboard with statistics
- [x] Movies, TV, and Music library views
- [x] Search interface
- [x] Activity/download queue
- [x] Settings pages
- [ ] Jackett integration
- [ ] Deluge integration
- [ ] TMDB/MusicBrainz metadata
- [ ] File management (renaming, hardlinks)
- [ ] Discord notifications
- [ ] Native executable builds

## License

MIT
