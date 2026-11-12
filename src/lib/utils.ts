import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates YouTube URL and extracts video ID or playlist ID
 */
export function parseYouTubeUrl(url: string): { isValid: boolean; videoId?: string; playlistId?: string; cleanUrl?: string; isPlaylist?: boolean } {
  if (!url || typeof url !== 'string') {
    return { isValid: false };
  }

  const trimmed = url.trim();

  // Check Playlist URL
  const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch && playlistMatch[1]) {
    const playlistId = playlistMatch[1];
    return {
      isValid: true,
      playlistId,
      isPlaylist: true,
      cleanUrl: `https://www.youtube.com/playlist?list=${playlistId}`
    };
  }
  
  // Video URL Patterns
  const patterns = [
    /(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      return {
        isValid: true,
        videoId,
        isPlaylist: false,
        cleanUrl: `https://www.youtube.com/watch?v=${videoId}`
      };
    }
  }

  return { isValid: false };
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedMins = mins.toString().padStart(2, '0');
  const formattedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const formattedHrs = hrs.toString().padStart(2, '0');
    return `${formattedHrs}:${formattedMins}:${formattedSecs}`;
  }

  return `${formattedMins}:${formattedSecs}`;
}

export function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return 'audio';
  
  return decodeHtmlEntities(filename)
    // Replace colons, forward slashes, and backslashes with clean separator
    .replace(/[/\\:]/g, ' - ')
    // Remove characters that are illegal across filesystems: * ? " < > |
    .replace(/[*?"<>|]/g, '')
    // Remove non-printable control characters
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    // Collapse multiple consecutive spaces or hyphens
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    // Trim surrounding spaces, dots, and hyphens
    .trim()
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .substring(0, 150) || 'audio';
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
