import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    if (!fileId || !/^[a-zA-Z0-9-]+$/.test(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const downloadsDir = path.join(process.cwd(), 'tmp', 'downloads');
    const mp3Path = path.join(downloadsDir, `${fileId}.mp3`);
    const zipPath = path.join(downloadsDir, `${fileId}.zip`);

    let filePath = '';
    let contentType = 'audio/mpeg';
    let defaultExt = '.mp3';

    if (fs.existsSync(zipPath)) {
      filePath = zipPath;
      contentType = 'application/zip';
      defaultExt = '.zip';
    } else if (fs.existsSync(mp3Path)) {
      filePath = mp3Path;
      contentType = 'audio/mpeg';
      defaultExt = '.mp3';
    } else {
      return NextResponse.json({ error: 'File not found or expired.' }, { status: 404 });
    }

    const customFilename = req.nextUrl.searchParams.get('filename') || `download-${fileId.substring(0, 8)}${defaultExt}`;
    const fileStat = fs.statSync(filePath);
    const nodeStream = fs.createReadStream(filePath);

    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        nodeStream.on('end', () => {
          controller.close();
          // Auto cleanup
          setTimeout(() => {
            if (fs.existsSync(filePath)) {
              fs.unlink(filePath, () => {});
            }
          }, 1000);
        });

        nodeStream.on('error', (err) => {
          controller.error(err);
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
          }
        });
      },
      cancel() {
        nodeStream.destroy();
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, () => {});
        }
      }
    });

    const encodedFilename = encodeURIComponent(customFilename);

    return new Response(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Content-Disposition': `attachment; filename="${customFilename.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to serve file' },
      { status: 500 }
    );
  }
}
