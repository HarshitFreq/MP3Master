import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { parseYouTubeUrl, sanitizeFilename } from '@/lib/utils';
import { downloadAudio, findBestTrackMatch } from '@/lib/ytdlp';
import { DownloadProgress, VideoMetadata } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { items, quality = '320', playlistTitle = 'Playlist' } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No tracks provided for batch download.' }, { status: 400 });
    }

    const downloadsDir = path.join(process.cwd(), 'tmp', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const batchId = crypto.randomUUID();
    const batchFolder = path.join(downloadsDir, `batch_${batchId}`);
    if (!fs.existsSync(batchFolder)) {
      fs.mkdirSync(batchFolder, { recursive: true });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: DownloadProgress) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {}
        };

        const totalTracks = items.length;
        const completedFiles: { fileId: string; fileName: string; title: string; fullPath: string }[] = [];

        try {
          for (let i = 0; i < totalTracks; i++) {
            const trackItem: VideoMetadata = items[i];
            let targetUrl = '';
            
            const parsed = parseYouTubeUrl(trackItem.url);
            if (parsed.isValid && parsed.cleanUrl) {
              targetUrl = parsed.cleanUrl;
            } else {
              // High-precision Spotify / Apple Music track matching on YouTube
              sendEvent({
                id: batchId,
                url: '',
                quality,
                stage: 'fetching_info',
                percent: (i / totalTracks) * 100,
                isBatch: true,
                currentTrackIndex: i + 1,
                totalTracks,
                currentTrackTitle: trackItem.title,
                statusText: `[Track ${i + 1}/${totalTracks}] Finding exact match for "${trackItem.title}"...`,
                completedFiles,
              });

              try {
                const artist = trackItem.uploader || '';
                const title = trackItem.title || '';
                const expectedSec = trackItem.duration || 0;

                const bestMatch = await findBestTrackMatch(artist, title, expectedSec);
                if (bestMatch && bestMatch.url) {
                  targetUrl = bestMatch.url;
                }
              } catch (searchErr) {
                console.error(`Match failed for track ${trackItem.title}:`, searchErr);
              }
            }

            if (!targetUrl) continue;

            const padIndex = String(i + 1).padStart(2, '0');
            const videoTitle = trackItem.title || `Track ${i + 1}`;
            const cleanTitleName = sanitizeFilename(videoTitle);
            const fileName = `${padIndex}. ${cleanTitleName}.mp3`;

            const fileId = crypto.randomUUID();
            const tempFileTemplate = path.join(downloadsDir, `${fileId}.%(ext)s`);
            const finalMp3Path = path.join(downloadsDir, `${fileId}.mp3`);
            const cleanNamedPath = path.join(batchFolder, fileName);

            const basePercent = (i / totalTracks) * 100;

            sendEvent({
              id: batchId,
              url: targetUrl,
              quality,
              stage: 'downloading',
              percent: basePercent,
              isBatch: true,
              currentTrackIndex: i + 1,
              totalTracks,
              currentTrackTitle: videoTitle,
              statusText: `[Track ${i + 1}/${totalTracks}] Downloading: ${videoTitle}`,
              completedFiles,
            });

            try {
              await downloadAudio(targetUrl, quality, tempFileTemplate, (progressUpdate) => {
                const trackPercent = (progressUpdate.percent || 0) / totalTracks;
                const overallPercent = Math.min(99, basePercent + trackPercent);

                sendEvent({
                  id: batchId,
                  url: targetUrl,
                  quality,
                  stage: progressUpdate.stage || 'downloading',
                  percent: overallPercent,
                  speed: progressUpdate.speed,
                  eta: progressUpdate.eta,
                  isBatch: true,
                  currentTrackIndex: i + 1,
                  totalTracks,
                  currentTrackTitle: videoTitle,
                  statusText: `[Track ${i + 1}/${totalTracks}] ${progressUpdate.statusText || 'Converting...'}`,
                  completedFiles,
                });
              });

              let sourcePath = finalMp3Path;
              if (!fs.existsSync(sourcePath)) {
                const files = fs.readdirSync(downloadsDir);
                const matched = files.find(f => f.startsWith(fileId) && f.endsWith('.mp3'));
                if (matched) {
                  sourcePath = path.join(downloadsDir, matched);
                }
              }

              if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, cleanNamedPath);
                completedFiles.push({
                  fileId,
                  fileName,
                  title: videoTitle,
                  fullPath: cleanNamedPath,
                });
              }
            } catch (trackError) {
              console.error(`Error processing track ${videoTitle}:`, trackError);
            }
          }

          // Package ZIP archive
          let zipFileId: string | undefined;
          let zipFileName: string | undefined;

          if (completedFiles.length > 1) {
            zipFileId = crypto.randomUUID();
            zipFileName = `${sanitizeFilename(playlistTitle)}.zip`;
            const zipPath = path.join(downloadsDir, `${zipFileId}.zip`);

            try {
              execSync(`cd "${batchFolder}" && zip -j "${zipPath}" *.mp3`, { stdio: ['pipe', 'pipe', 'ignore'] });
            } catch (zipErr) {
              console.error('Error packaging ZIP archive:', zipErr);
            }
          }

          // Clean up batch temporary folder
          try {
            fs.rmSync(batchFolder, { recursive: true, force: true });
          } catch {}

          sendEvent({
            id: batchId,
            url: '',
            quality,
            stage: 'completed',
            percent: 100,
            isBatch: true,
            totalTracks,
            statusText: `Batch conversion complete! ${completedFiles.length}/${totalTracks} tracks processed.`,
            completedFiles: completedFiles.map(f => ({ fileId: f.fileId, fileName: f.fileName, title: f.title })),
            zipFileId,
            zipFileName,
          });

          controller.close();
        } catch (error) {
          sendEvent({
            id: batchId,
            url: '',
            quality,
            stage: 'error',
            percent: 0,
            error: error instanceof Error ? error.message : 'Batch processing error',
            statusText: 'Batch download encountered an error.',
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Batch endpoint error' }, { status: 500 });
  }
}
