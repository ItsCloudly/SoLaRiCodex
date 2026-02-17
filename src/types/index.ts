// Type definitions for SoLaRi

export interface Media {
  id: number;
  type: 'movie' | 'tv' | 'music';
  title: string;
  originalTitle?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Movie {
  id: number;
  mediaId: number;
  releaseDate?: string;
  runtime?: number;
  tmdbId?: number;
  imdbId?: string;
  status: 'wanted' | 'downloaded' | 'archived';
  qualityProfileId?: number;
  path?: string;
}

export interface Series {
  id: number;
  mediaId: number;
  releaseDate?: string;
  status: 'continuing' | 'ended' | 'wanted' | 'downloaded' | 'archived';
  qualityProfileId?: number;
  path?: string;
  tvdbId?: number;
}

export interface Episode {
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

export interface Artist {
  id: number;
  mediaId: number;
  musicBrainzId?: string;
  genre?: string;
  status: 'wanted' | 'downloaded' | 'archived';
  path?: string;
}

export interface Album {
  id: number;
  artistId: number;
  mediaId: number;
  musicBrainzId?: string;
  releaseDate?: string;
  status: 'wanted' | 'downloaded' | 'archived';
  qualityProfileId?: number;
  path?: string;
}

export interface Track {
  id: number;
  albumId: number;
  mediaId: number;
  musicBrainzId?: string;
  trackNumber?: number;
  duration?: number;
  downloaded: boolean;
  qualityProfileId?: number;
  filePath?: string;
}

export interface QualityProfile {
  id: number;
  name: string;
  mediaType: 'movie' | 'tv' | 'music';
  allowedQualities: string[];
  minSize?: number;
  maxSize?: number;
  preferred?: string;
  createdAt: Date;
}

export interface Indexer {
  id: number;
  name: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  mediaTypes: string[];
  priority: number;
  createdAt: Date;
}

export interface Download {
  id: number;
  mediaType: 'movie' | 'tv' | 'music';
  mediaId?: number;
  indexerId?: number;
  title: string;
  torrentHash?: string;
  status: 'queued' | 'downloading' | 'paused' | 'seeding' | 'completed' | 'failed';
  progress: number;
  speed?: number;
  eta?: number;
  filePath?: string;
  quality?: string;
  size?: number;
  addedAt: Date;
  completedAt?: Date;
  delugeId?: string;
  errorMessage?: string;
}

export interface DiscordSettings {
  id: number;
  webhookUrl?: string;
  enabled: boolean;
  onDownloadStarted: boolean;
  onDownloadCompleted: boolean;
  onDownloadFailed: boolean;
}

export interface Stats {
  library: {
    movies: number;
    tv: number;
    music: number;
    total: number;
  };
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
