import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CONFIG_DIR = './config';
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

export interface SoLaRiConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    path: string;
  };
  media: {
    movies: { path: string; enabled: boolean };
    tv: { path: string; enabled: boolean };
    music: { path: string; enabled: boolean };
  };
  jackett: {
    baseUrl: string;
    apiKey: string;
  };
  deluge: {
    host: string;
    port: number;
    password: string;
  };
  apis: {
    tmdb: { apiKey: string };
    omdb: { apiKey: string };
    musicbrainz: {
      baseUrl: string;
      userAgent: string;
    };
  };
  fileManagement: {
    renameOnComplete: boolean;
    createFolders: boolean;
    useHardlinks: boolean;
    folderStructure: {
      movies: string;
      tv: string;
      music: string;
    };
  };
  notifications: {
    discord: {
      enabled: boolean;
      webhookUrl: string;
      events: {
        onDownloadStarted: boolean;
        onDownloadCompleted: boolean;
        onDownloadFailed: boolean;
      };
    };
  };
}

const defaultConfig: SoLaRiConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  database: {
    path: './data/solari.db',
  },
  media: {
    movies: {
      path: './media/movies',
      enabled: true,
    },
    tv: {
      path: './media/tv',
      enabled: true,
    },
    music: {
      path: './media/music',
      enabled: true,
    },
  },
  jackett: {
    baseUrl: 'http://localhost:9117',
    apiKey: '',
  },
  deluge: {
    host: 'localhost',
    port: 8112,
    password: '',
  },
  apis: {
    tmdb: {
      apiKey: '',
    },
    omdb: {
      apiKey: '',
    },
    musicbrainz: {
      baseUrl: 'https://musicbrainz.org',
      userAgent: 'SoLaRi/1.0 (admin@localhost)',
    },
  },
  fileManagement: {
    renameOnComplete: true,
    createFolders: true,
    useHardlinks: true,
    folderStructure: {
      movies: '{Title} ({Year})',
      tv: '{SeriesName}/Season {SeasonNumber:02}',
      music: '{ArtistName}/{AlbumName} ({ReleaseYear})',
    },
  },
  notifications: {
    discord: {
      enabled: false,
      webhookUrl: '',
      events: {
        onDownloadStarted: false,
        onDownloadCompleted: true,
        onDownloadFailed: true,
      },
    },
  },
};

export function loadConfig(): SoLaRiConfig {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  // Create default config if it doesn't exist
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  
  // Load and parse config
  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const parsed = yaml.load(content) as Partial<SoLaRiConfig>;
  
  // Merge with defaults
  return mergeConfig(defaultConfig, parsed);
}

export function saveConfig(config: SoLaRiConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
  });
  
  fs.writeFileSync(CONFIG_FILE, yamlContent, 'utf-8');
}

function mergeConfig(defaults: SoLaRiConfig, overrides: Partial<SoLaRiConfig>): SoLaRiConfig {
  return {
    ...defaults,
    ...overrides,
    server: { ...defaults.server, ...overrides.server },
    database: { ...defaults.database, ...overrides.database },
    media: {
      movies: { ...defaults.media.movies, ...overrides.media?.movies },
      tv: { ...defaults.media.tv, ...overrides.media?.tv },
      music: { ...defaults.media.music, ...overrides.media?.music },
    },
    jackett: { ...defaults.jackett, ...overrides.jackett },
    deluge: { ...defaults.deluge, ...overrides.deluge },
    apis: {
      tmdb: { ...defaults.apis.tmdb, ...overrides.apis?.tmdb },
      omdb: { ...defaults.apis.omdb, ...overrides.apis?.omdb },
      musicbrainz: { ...defaults.apis.musicbrainz, ...overrides.apis?.musicbrainz },
    },
    fileManagement: {
      ...defaults.fileManagement,
      ...overrides.fileManagement,
      folderStructure: {
        ...defaults.fileManagement.folderStructure,
        ...overrides.fileManagement?.folderStructure,
      },
    },
    notifications: {
      discord: {
        ...defaults.notifications.discord,
        ...overrides.notifications?.discord,
        events: {
          ...defaults.notifications.discord.events,
          ...overrides.notifications?.discord?.events,
        },
      },
    },
  };
}

// Singleton config instance
let configInstance: SoLaRiConfig | null = null;

export function getConfig(): SoLaRiConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function reloadConfig(): SoLaRiConfig {
  configInstance = loadConfig();
  return configInstance;
}
