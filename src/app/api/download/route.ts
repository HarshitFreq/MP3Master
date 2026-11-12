import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { parseYouTubeUrl, sanitizeFilename } from '@/lib/utils';
import { downloadAudio, getVideoMetadata, embedCoverArtAndMetadata } from '@/lib/ytdlp';
import { resolveOriginalCoverArt } from '@/lib/musicImporter';
import { DownloadProgress, VideoMetadata } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, quality = '320', metadata: incomingMetadata } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    const { isValid, cleanUrl } = parseYouTubeUrl(url);
    if (!isValid || !cleanUrl) {
      return NextResponse.json({ success: false, error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Ensure temp downloads directory exists
    const downloadsDir = path.join(process.cwd(), 'tmp', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const fileId = crypto.randomUUID();
    const tempFileTemplate = path.join(downloadsDir, `${fileId}.%(ext)s`);
    const finalMp3Path = path.join(downloadsDir, `${fileId}.mp3`);

    // Set up Server-Sent Events stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: DownloadProgress) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            // Stream closed by client
          }
        };

        try {
          // Step 1: Fetch Metadata
          sendEvent({
            id: fileId,
            url: cleanUrl,
            quality,
            stage: 'fetching_info',
            percent: 0,
            statusText: 'Fetching video metadata & preparing audio encoder...'
          });

          let metadata: VideoMetadata | undefined = incomingMetadata;
          if (!metadata) {
            try {
              metadata = await getVideoMetadata(cleanUrl);
            } catch (e) {
              // Non-fatal if metadata fails, use default title
            }
          }

          const videoTitle = metadata?.title || 'audio';
          const fileName = `${sanitizeFilename(videoTitle)}.mp3`;

          // Step 2: Download & Convert with yt-dlp & FFmpeg
          await downloadAudio(cleanUrl, quality, tempFileTemplate, (progressUpdate) => {
            sendEvent({
              id: fileId,
              url: cleanUrl,
              quality,
              stage: progressUpdate.stage || 'downloading',
              percent: progressUpdate.percent || 0,
              speed: progressUpdate.speed,
              eta: progressUpdate.eta,
              statusText: progressUpdate.statusText,
              metadata
            });
          });

          // Step 3: Embed high-res studio cover art & ID3 tags
          let targetPath = finalMp3Path;
          if (!fs.existsSync(targetPath)) {
            const files = fs.readdirSync(downloadsDir);
            const matchedFile = files.find(f => f.startsWith(fileId) && f.endsWith('.mp3'));
            if (matchedFile) {
              targetPath = path.join(downloadsDir, matchedFile);
            }
          }

          if (fs.existsSync(targetPath)) {
            try {
              let coverUrl = metadata?.originalCoverArt;
              if (!coverUrl && metadata) {
                coverUrl = await resolveOriginalCoverArt(metadata);
              }

              const cleanSongTitle = metadata?.songTitle || (metadata?.artist && metadata?.title?.includes(' - ') ? metadata.title.split(' - ').slice(1).join(' - ') : metadata?.title);
              const cleanArtist = metadata?.artist || metadata?.uploader || 'Artist';

              await embedCoverArtAndMetadata(targetPath, {
                coverArtUrl: coverUrl,
                title: cleanSongTitle,
                artist: cleanArtist,
                album: metadata?.album || (cleanSongTitle ? `${cleanSongTitle} - Single` : undefined),
              });
            } catch (embedErr) {
              console.warn('Cover embedding warning:', embedErr);
            }

            sendEvent({
              id: fileId,
              url: cleanUrl,
              quality,
              stage: 'completed',
              percent: 100,
              fileId,
              fileName,
              statusText: 'Audio download & MP3 conversion finished successfully!',
              metadata
            });
          } else {
            throw new Error('Converted MP3 file was not found after processing.');
          }

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
          sendEvent({
            id: fileId,
            url: cleanUrl,
            quality,
            stage: 'error',
            percent: 0,
            error: errorMessage,
            statusText: `Error: ${errorMessage}`
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
