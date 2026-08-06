export type DownloadQuality = '320' | '256' | '192' | '128';

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  uploader: string;
  thumbnail: string;
  duration: number; // in seconds
  durationFormatted: string;
  description?: string;
  isPlaylist?: boolean;
  playlistTitle?: string;
  playlistItems?: VideoMetadata[];
}

export type DownloadStage = 'idle' | 'fetching_info' | 'downloading' | 'converting' | 'completed' | 'error';

export interface DownloadProgress {
  id: string;
  url: string;
  quality: DownloadQuality;
  stage: DownloadStage;
  percent: number;
  speed?: string;
  eta?: string;
  statusText?: string;
  error?: string;
  fileId?: string;
  fileName?: string;
  metadata?: VideoMetadata;
  // Batch Progress details
  isBatch?: boolean;
  currentTrackIndex?: number;
  totalTracks?: number;
  currentTrackTitle?: string;
  completedFiles?: { fileId: string; fileName: string; title: string }[];
  zipFileId?: string;
  zipFileName?: string;
}

export interface BinaryHealth {
  ytdlpInstalled: boolean;
  ytdlpVersion?: string;
  ytdlpPath?: string;
  ffmpegInstalled: boolean;
  ffmpegVersion?: string;
  ffmpegPath?: string;
  recommendedCommand: string;
}

export interface DownloadHistoryItem {
  id: string;
  url: string;
  title: string;
  uploader: string;
  thumbnail: string;
  durationFormatted: string;
  quality: DownloadQuality;
  downloadedAt: number;
  fileId?: string;
  isBatch?: boolean;
}
