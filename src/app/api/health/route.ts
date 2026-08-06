import { NextResponse } from 'next/server';
import { getBinaryHealth } from '@/lib/ytdlp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = getBinaryHealth();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        ytdlpInstalled: false,
        ffmpegInstalled: false,
        recommendedCommand: 'brew install yt-dlp ffmpeg',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
