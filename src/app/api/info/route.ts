import { NextRequest, NextResponse } from 'next/server';
import { parseYouTubeUrl } from '@/lib/utils';
import { getVideoMetadata, getPlaylistMetadata } from '@/lib/ytdlp';
import { isExternalMusicUrl, fetchSpotifyTracks, fetchAppleMusicTracks, convertImportedPlaylistToVideoMetadata } from '@/lib/musicImporter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required.' }, { status: 400 });
    }

    // Check if URL is Spotify or Apple Music link
    const external = isExternalMusicUrl(url);
    if (external.isExternal && external.platform) {
      let imported;
      if (external.platform === 'spotify') {
        imported = await fetchSpotifyTracks(url);
      } else {
        imported = await fetchAppleMusicTracks(url);
      }

      const metadata = await convertImportedPlaylistToVideoMetadata(imported);
      return NextResponse.json({ success: true, metadata });
    }

    // Otherwise YouTube video / playlist
    const { isValid, cleanUrl, isPlaylist } = parseYouTubeUrl(url);
    if (!isValid || !cleanUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid link. Please enter a valid YouTube, Spotify, or Apple Music URL.' },
        { status: 400 }
      );
    }

    if (isPlaylist) {
      const metadata = await getPlaylistMetadata(cleanUrl);
      return NextResponse.json({ success: true, metadata });
    }

    const metadata = await getVideoMetadata(cleanUrl);
    return NextResponse.json({ success: true, metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch media details.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
