import { VideoMetadata } from './types';
import { formatDuration } from './utils';

export interface ImportedTrack {
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  searchQuery: string;
}

export interface ImportedPlaylist {
  title: string;
  type: 'spotify' | 'applemusic';
  coverArt?: string;
  tracks: ImportedTrack[];
}

/**
 * Checks if a string is a Spotify or Apple Music URL
 */
export function isExternalMusicUrl(url: string): { isExternal: boolean; platform?: 'spotify' | 'applemusic'; type?: 'playlist' | 'album' | 'track' } {
  if (!url || typeof url !== 'string') return { isExternal: false };

  const trimmed = url.trim();

  // Spotify pattern
  if (trimmed.includes('spotify.com')) {
    if (trimmed.includes('/playlist/')) return { isExternal: true, platform: 'spotify', type: 'playlist' };
    if (trimmed.includes('/album/')) return { isExternal: true, platform: 'spotify', type: 'album' };
    if (trimmed.includes('/track/')) return { isExternal: true, platform: 'spotify', type: 'track' };
    return { isExternal: true, platform: 'spotify', type: 'playlist' };
  }

  // Apple Music pattern
  if (trimmed.includes('music.apple.com')) {
    if (trimmed.includes('/playlist/')) return { isExternal: true, platform: 'applemusic', type: 'playlist' };
    if (trimmed.includes('/album/')) return { isExternal: true, platform: 'applemusic', type: 'album' };
    return { isExternal: true, platform: 'applemusic', type: 'playlist' };
  }

  return { isExternal: false };
}

/**
 * Fetch tracks from a public Spotify playlist, album, or track link via Embed HTML JSON payload
 */
export async function fetchSpotifyTracks(url: string): Promise<ImportedPlaylist> {
  const match = url.match(/\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error('Invalid Spotify link format.');
  }

  const type = match[1];
  const id = match[2];
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Unable to load Spotify metadata (HTTP ${res.status}). Ensure the playlist is public.`);
  }

  const html = await res.text();
  const nextDataMatch = html.match(/id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);

  if (!nextDataMatch || !nextDataMatch[1]) {
    throw new Error('Could not parse Spotify embed data.');
  }

  const nextData = JSON.parse(nextDataMatch[1]);
  const entity = nextData?.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error('No entity data found in Spotify response.');
  }

  const playlistTitle = entity.title || entity.name || 'Spotify Playlist';
  const coverArt = entity.coverArt?.sources?.[0]?.url || entity.images?.[0]?.url || '';

  const rawTracks = entity.trackList || entity.tracks || [];
  const tracks: ImportedTrack[] = [];

  for (const item of rawTracks) {
    const trackName = item.title || item.name;
    const artistName = item.subtitle || item.artists?.map((a: any) => a.name).join(', ') || 'Artist';
    if (trackName) {
      tracks.push({
        title: trackName,
        artist: artistName,
        durationMs: item.duration,
        searchQuery: `${artistName} - ${trackName} audio`,
      });
    }
  }

  if (tracks.length === 0 && type === 'track') {
    // Single track case
    const title = entity.title || entity.name;
    const artist = entity.subtitle || entity.artists?.[0]?.name || 'Artist';
    if (title) {
      tracks.push({
        title,
        artist,
        searchQuery: `${artist} - ${title} audio`,
      });
    }
  }

  return {
    title: playlistTitle,
    type: 'spotify',
    coverArt,
    tracks,
  };
}

/**
 * Fetch tracks from a public Apple Music playlist or album link via JSON-LD metadata
 */
export async function fetchAppleMusicTracks(url: string): Promise<ImportedPlaylist> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Unable to load Apple Music page (HTTP ${res.status}).`);
  }

  const html = await res.text();
  const ldJsonMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/g);

  let playlistTitle = 'Apple Music Playlist';
  let coverArt = '';
  const tracks: ImportedTrack[] = [];

  if (ldJsonMatch) {
    for (const tag of ldJsonMatch) {
      try {
        const jsonText = tag.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
        const json = JSON.parse(jsonText);

        if (json['@type'] === 'MusicPlaylist' || json['@type'] === 'MusicAlbum') {
          playlistTitle = json.name || playlistTitle;
          coverArt = json.image || coverArt;

          const trackItems = json.track?.numberOfItems ? json.track.itemListElement : json.track || [];
          for (const t of trackItems) {
            const item = t.item || t;
            const title = item.name;
            const artist = item.byArtist?.name || json.byArtist?.name || 'Artist';

            if (title) {
              tracks.push({
                title,
                artist,
                searchQuery: `${artist} - ${title} audio`,
              });
            }
          }
        }
      } catch {}
    }
  }

  // Fallback title parsing if LD-JSON missed
  if (tracks.length === 0) {
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (titleMatch) playlistTitle = titleMatch[1];
  }

  return {
    title: playlistTitle,
    type: 'applemusic',
    coverArt,
    tracks,
  };
}

/**
 * Converts imported playlist tracks into MP3Master VideoMetadata items by matching YouTube URLs
 */
export async function convertImportedPlaylistToVideoMetadata(
  imported: ImportedPlaylist
): Promise<VideoMetadata> {
  const playlistItems: VideoMetadata[] = imported.tracks.map((t, idx) => {
    // Generate YouTube search clean query for each track
    const cleanSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(t.searchQuery)}`;
    return {
      id: `imported-${idx}`,
      url: cleanSearchUrl, // Will be searched & matched at download time or search preview
      title: `${t.artist} - ${t.title}`,
      uploader: t.artist,
      thumbnail: imported.coverArt || `https://i.ytimg.com/vi/default/hqdefault.jpg`,
      duration: t.durationMs ? Math.round(t.durationMs / 1000) : 0,
      durationFormatted: t.durationMs ? formatDuration(Math.round(t.durationMs / 1000)) : 'Audio',
    };
  });

  const firstItem = playlistItems[0] || {
    id: 'imported-0',
    url: '',
    title: imported.title,
    uploader: imported.type === 'spotify' ? 'Spotify Playlist' : 'Apple Music Playlist',
    thumbnail: imported.coverArt || '',
    duration: 0,
    durationFormatted: `${playlistItems.length} songs`,
  };

  return {
    id: firstItem.id,
    url: '',
    title: imported.title,
    uploader: `${imported.tracks.length} tracks • ${imported.type === 'spotify' ? 'Spotify' : 'Apple Music'}`,
    thumbnail: imported.coverArt || firstItem.thumbnail,
    duration: 0,
    durationFormatted: `${playlistItems.length} songs`,
    isPlaylist: true,
    playlistTitle: imported.title,
    playlistItems,
  };
}
