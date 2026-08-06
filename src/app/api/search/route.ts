import { NextRequest, NextResponse } from 'next/server';
import { searchYouTube } from '@/lib/ytdlp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { query } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ success: false, error: 'Search query is required.' }, { status: 400 });
    }

    const results = await searchYouTube(query.trim(), 5);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search YouTube.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
