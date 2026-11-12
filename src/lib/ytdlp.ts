import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { BinaryHealth, DownloadProgress, VideoMetadata } from './types';
import { formatDuration } from './utils';

const CANDIDATE_PATHS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/opt/local/bin',
  process.env.PATH || ''
];

export function findExecutable(name: string): string | null {
  try {
    const whichResult = execSync(`which ${name}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      return whichResult;
    }
  } catch {}

  const searchDirs = CANDIDATE_PATHS.flatMap(p => p.split(path.delimiter)).filter(Boolean);

  for (const dir of searchDirs) {
    const fullPath = path.join(dir, name);
    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return fullPath;
      } catch {}
    }
  }

  return null;
}

export function getBinaryHealth(): BinaryHealth {
  const ytdlpPath = findExecutable('yt-dlp');
  const ffmpegPath = findExecutable('ffmpeg');

  let ytdlpVersion: string | undefined;
  let ffmpegVersion: string | undefined;

  if (ytdlpPath) {
    try {
      ytdlpVersion = execSync(`"${ytdlpPath}" --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      ytdlpVersion = 'Installed';
    }
  }

  if (ffmpegPath) {
    try {
      const output = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const match = output.match(/ffmpeg version ([^\s]+)/i);
      ffmpegVersion = match ? match[1] : 'Installed';
    } catch {
      ffmpegVersion = 'Installed';
    }
  }

  return {
    ytdlpInstalled: !!ytdlpPath,
    ytdlpVersion,
    ytdlpPath: ytdlpPath || undefined,
    ffmpegInstalled: !!ffmpegPath,
    ffmpegVersion,
    ffmpegPath: ffmpegPath || undefined,
    recommendedCommand: 'brew install yt-dlp ffmpeg',
  };
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const ytdlpPath = findExecutable('yt-dlp');
  if (!ytdlpPath) {
    throw new Error('yt-dlp is not installed on the system.');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      '--geo-bypass',
      url
    ];

    const child = spawn(ytdlpPath, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to fetch video information. ${stderrData || 'Invalid video URL.'}`));
      }

      try {
        const json = JSON.parse(stdoutData);
        const duration = json.duration || 0;
        
        let thumbnail = json.thumbnail || '';
        if (json.thumbnails && json.thumbnails.length > 0) {
          const sorted = [...json.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
          thumbnail = sorted[0]?.url || thumbnail;
        }

        resolve({
          id: json.id || '',
          url: json.webpage_url || url,
          title: json.title || 'YouTube Audio',
          uploader: json.uploader || json.channel || 'Unknown Artist',
          thumbnail,
          duration,
          durationFormatted: formatDuration(duration),
          description: json.description ? json.description.substring(0, 200) + '...' : undefined,
        });
      } catch (err) {
        reject(new Error(`Error parsing video info: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`yt-dlp execution error: ${err.message}`));
    });
  });
}

export async function getPlaylistMetadata(url: string): Promise<VideoMetadata> {
  const ytdlpPath = findExecutable('yt-dlp');
  if (!ytdlpPath) {
    throw new Error('yt-dlp is not installed on the system.');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      '--flat-playlist',
      '--geo-bypass',
      url
    ];

    const child = spawn(ytdlpPath, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to fetch playlist information. ${stderrData || 'Invalid playlist URL.'}`));
      }

      try {
        const lines = stdoutData.trim().split('\n').filter(Boolean);
        const playlistItems: VideoMetadata[] = [];
        let playlistTitle = 'YouTube Playlist';

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.playlist_title) {
              playlistTitle = json.playlist_title;
            }

            const videoId = json.id || json.url;
            const webpageUrl = json.webpage_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

            if (webpageUrl && json.title) {
              playlistItems.push({
                id: videoId,
                url: webpageUrl,
                title: json.title,
                uploader: json.uploader || json.channel || 'Artist',
                thumbnail: json.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: json.duration || 0,
                durationFormatted: formatDuration(json.duration || 0),
              });
            }
          } catch {}
        }

        if (playlistItems.length === 0) {
          throw new Error('No playable tracks found in playlist.');
        }

        const firstItem = playlistItems[0];

        resolve({
          id: firstItem.id,
          url,
          title: playlistTitle,
          uploader: `${playlistItems.length} Tracks`,
          thumbnail: firstItem.thumbnail,
          duration: 0,
          durationFormatted: `${playlistItems.length} songs`,
          isPlaylist: true,
          playlistTitle,
          playlistItems,
        });
      } catch (err) {
        reject(new Error(`Error parsing playlist details: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`yt-dlp playlist execution error: ${err.message}`));
    });
  });
}

export async function searchYouTube(query: string, limit = 5): Promise<VideoMetadata[]> {
  const ytdlpPath = findExecutable('yt-dlp');
  if (!ytdlpPath) {
    throw new Error('yt-dlp is not installed on the system.');
  }

  return new Promise((resolve, reject) => {
    const searchQuery = `ytsearch${limit}:${query}`;
    const args = [
      '--dump-json',
      '--no-warnings',
      '--flat-playlist',
      '--geo-bypass',
      searchQuery
    ];

    const child = spawn(ytdlpPath, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Search failed: ${stderrData || 'No results found.'}`));
      }

      try {
        const lines = stdoutData.trim().split('\n').filter(Boolean);
        const results: VideoMetadata[] = [];

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const duration = json.duration || 0;
            const videoId = json.id || json.url;
            const webpageUrl = json.webpage_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

            if (webpageUrl && json.title) {
              results.push({
                id: videoId,
                url: webpageUrl,
                title: json.title,
                uploader: json.uploader || json.channel || 'Artist',
                thumbnail: json.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration,
                durationFormatted: formatDuration(duration),
              });
            }
          } catch {}
        }

        resolve(results);
      } catch (err) {
        reject(new Error(`Failed to parse search results: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`yt-dlp search error: ${err.message}`));
    });
  });
}

/**
 * Clean track title for search matching
 */
function cleanSongTitle(title: string): string {
  return title
    .replace(/\(feat\.[^)]+\)/gi, '')
    .replace(/\[feat\.[^\]]+\]/gi, '')
    .replace(/\(remastered[^)]*\)/gi, '')
    .replace(/-\s*remastered.*/gi, '')
    .replace(/\(deluxe[^)]*\)/gi, '')
    .replace(/-\s*deluxe.*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * High-Precision Track Matcher Algorithm with Duration Verification and Channel Scoring
 */
export async function findBestTrackMatch(
  artist: string,
  rawTitle: string,
  expectedDurationSec = 0
): Promise<VideoMetadata | null> {
  const cleanTitle = cleanSongTitle(rawTitle);
  const cleanArtist = artist.trim();
  const searchString = `${cleanArtist} ${cleanTitle} audio`;

  try {
    const candidates = await searchYouTube(searchString, 6);
    if (!candidates || candidates.length === 0) return null;

    let bestCandidate = candidates[0];
    let minScore = Infinity;

    const lowerTitle = cleanTitle.toLowerCase();
    const lowerArtist = cleanArtist.toLowerCase();

    for (const item of candidates) {
      const itemTitle = item.title.toLowerCase();
      const itemUploader = item.uploader.toLowerCase();
      let score = 0;

      // 1. Topic Channel / Official Artist Bonus (-100 pts)
      if (itemUploader.includes('- topic') || itemUploader.includes(lowerArtist)) {
        score -= 100;
      }

      // 2. Official Audio / Visualizer / Lyric Video Bonus (-50 pts)
      if (itemTitle.includes('official audio') || itemTitle.includes('audio') || itemTitle.includes('visualizer') || itemTitle.includes('lyric')) {
        score -= 50;
      }

      // 3. Penalty for Full Albums / Compilations / Loops (+1000 pts)
      if (
        itemTitle.includes('full album') ||
        itemTitle.includes('compilation') ||
        itemTitle.includes('10 hour') ||
        itemTitle.includes('1 hour') ||
        itemTitle.includes('mix') ||
        itemTitle.includes('playlist')
      ) {
        score += 1000;
      }

      // 4. Penalty for Live Bootlegs / Covers / Reactions (+300 pts)
      if (itemTitle.includes('live') && !lowerTitle.includes('live')) score += 300;
      if (itemTitle.includes('cover') && !lowerTitle.includes('cover')) score += 300;
      if (itemTitle.includes('reaction')) score += 400;

      // 5. Strict Duration Matching (± 5 Seconds Bonus / Penalty)
      if (expectedDurationSec > 0 && item.duration > 0) {
        const delta = Math.abs(item.duration - expectedDurationSec);
        if (delta <= 5) {
          score -= 100; // Exact match bonus!
        } else if (delta <= 15) {
          score += delta * 5;
        } else {
          score += delta * 20; // Heavy penalty for large duration mismatches
        }
      }

      if (score < minScore) {
        minScore = score;
        bestCandidate = item;
      }
    }

    return bestCandidate;
  } catch (err) {
    console.error(`Error matching track ${cleanArtist} - ${cleanTitle}:`, err);
    return null;
  }
}

function mapAudioQuality(quality: string): string {
  switch (quality) {
    case '320': return '0';
    case '256': return '2';
    case '192': return '4';
    case '128': return '5';
    default: return '0';
  }
}

export async function downloadAudio(
  url: string,
  quality: string,
  outputTemplate: string,
  onProgress: (progress: Partial<DownloadProgress>) => void
): Promise<string> {
  const ytdlpPath = findExecutable('yt-dlp');
  const ffmpegPath = findExecutable('ffmpeg');

  if (!ytdlpPath) {
    throw new Error('yt-dlp binary is missing on this system.');
  }

  if (!ffmpegPath) {
    throw new Error('FFmpeg binary is missing on this system.');
  }

  const audioQualityArg = mapAudioQuality(quality);
  const ffmpegDir = path.dirname(ffmpegPath);

  const primaryArgs = [
    '--newline',
    '--no-playlist',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', audioQualityArg,
    '--embed-thumbnail',
    '--convert-thumbnails', 'jpg',
    '--postprocessor-args', 'ThumbnailsConvertor:-vf crop=ih:ih',
    '--add-metadata',
    '--geo-bypass',
    '--ffmpeg-location', ffmpegDir,
    '-o', outputTemplate,
    url
  ];

  try {
    return await runYtDlpSpawn(ytdlpPath, primaryArgs, onProgress);
  } catch (primaryErr) {
    console.warn('Primary download with thumbnail crop failed, attempting fallback download...', primaryErr);

    const fallbackArgs = [
      '--newline',
      '--no-playlist',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', audioQualityArg,
      '--add-metadata',
      '--geo-bypass',
      '--ffmpeg-location', ffmpegDir,
      '-o', outputTemplate,
      url
    ];

    onProgress({
      stage: 'downloading',
      percent: 10,
      statusText: 'Retrying audio download in high-res mode...'
    });

    return await runYtDlpSpawn(ytdlpPath, fallbackArgs, onProgress);
  }
}

function runYtDlpSpawn(
  ytdlpPath: string,
  args: string[],
  onProgress: (progress: Partial<DownloadProgress>) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args);
    let stderrText = '';

    onProgress({
      stage: 'downloading',
      percent: 0,
      statusText: 'Connecting to YouTube servers...'
    });

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      stderrText += text;
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const percentMatch = trimmed.match(/\[download\]\s+([\d\.]+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1]);
          const speed = percentMatch[3];
          const eta = percentMatch[4];

          onProgress({
            stage: 'downloading',
            percent,
            speed,
            eta,
            statusText: `Downloading audio stream... (${percent.toFixed(1)}%)`
          });
          continue;
        }

        const finishedDownloadMatch = trimmed.match(/\[download\]\s+100%\s+of/i);
        if (finishedDownloadMatch) {
          onProgress({
            stage: 'converting',
            percent: 95,
            statusText: 'Download complete. Converting MP3 with FFmpeg...'
          });
          continue;
        }

        if (trimmed.includes('[EmbedThumbnail]') || trimmed.includes('[Metadata]')) {
          onProgress({
            stage: 'converting',
            percent: 98,
            statusText: 'Finalizing 1:1 square cover art & ID3 tags...'
          });
        }
      }
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('close', (code) => {
      if (code === 0) {
        onProgress({
          stage: 'completed',
          percent: 100,
          statusText: 'MP3 Conversion Successful!'
        });
        resolve(args[args.length - 2]);
      } else {
        const lastErr = stderrText.split('\n').filter(l => l.includes('ERROR')).pop() || `Exit code ${code}`;
        reject(new Error(lastErr));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`yt-dlp process error: ${err.message}`));
    });
  });
}

export interface EmbedOptions {
  coverArtUrl?: string;
  title?: string;
  artist?: string;
  album?: string;
}

/**
 * Losslessly embeds original high-resolution square album cover art and clean ID3v2 tags into the MP3 file using FFmpeg
 */
export async function embedCoverArtAndMetadata(
  mp3Path: string,
  options: EmbedOptions
): Promise<void> {
  const ffmpegPath = findExecutable('ffmpeg');
  if (!ffmpegPath || !fs.existsSync(mp3Path)) {
    return;
  }

  const { coverArtUrl, title, artist, album } = options;
  if (!coverArtUrl && !title && !artist && !album) {
    return;
  }

  let tempCoverPath: string | null = null;
  try {
    if (coverArtUrl) {
      try {
        const res = await fetch(coverArtUrl);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          tempCoverPath = `${mp3Path}.temp_cover.jpg`;
          fs.writeFileSync(tempCoverPath, buffer);
        }
      } catch (err) {
        console.warn('Failed to download cover art from URL:', coverArtUrl, err);
      }
    }

    const tempTaggedPath = `${mp3Path}.tagged.mp3`;
    const ffmpegArgs: string[] = ['-y', '-i', mp3Path];

    if (tempCoverPath && fs.existsSync(tempCoverPath)) {
      ffmpegArgs.push('-i', tempCoverPath);
      ffmpegArgs.push('-map', '0:a', '-map', '1:0');
      ffmpegArgs.push('-c', 'copy');
      ffmpegArgs.push('-id3v2_version', '3');
      ffmpegArgs.push('-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    } else {
      ffmpegArgs.push('-c', 'copy');
      ffmpegArgs.push('-id3v2_version', '3');
    }

    if (title) ffmpegArgs.push('-metadata', `title=${title}`);
    if (artist) ffmpegArgs.push('-metadata', `artist=${artist}`);
    if (album) ffmpegArgs.push('-metadata', `album=${album}`);

    ffmpegArgs.push(tempTaggedPath);

    await new Promise<void>((resolve) => {
      const child = spawn(ffmpegPath, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempTaggedPath)) {
          fs.copyFileSync(tempTaggedPath, mp3Path);
          try {
            fs.unlinkSync(tempTaggedPath);
          } catch {}
        } else {
          try {
            if (fs.existsSync(tempTaggedPath)) fs.unlinkSync(tempTaggedPath);
          } catch {}
          console.warn('FFmpeg embedding note:', stderr);
        }
        resolve();
      });
      child.on('error', (err) => {
        console.warn('FFmpeg process error:', err);
        resolve();
      });
    });
  } catch (err) {
    console.warn('embedCoverArtAndMetadata error:', err);
  } finally {
    if (tempCoverPath && fs.existsSync(tempCoverPath)) {
      try {
        fs.unlinkSync(tempCoverPath);
      } catch {}
    }
  }
}
