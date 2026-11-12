import { VideoMetadata } from './types';
import { formatDuration, decodeHtmlEntities } from './utils';

export interface ImportedTrack {
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  searchQuery: string;
  coverArt?: string;
  spotifyTrackId?: string;
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

  const playlistTitle = decodeHtmlEntities(entity.title || entity.name || 'Spotify Playlist').trim();
  const rawCoverArt = entity.coverArt?.sources?.[0]?.url || entity.images?.[0]?.url || '';
  const highResCover = rawCoverArt ? rawCoverArt.replace('00001e02', '0000b273').replace('00004851', '0000b273') : '';

  const rawTracks = entity.trackList || entity.tracks || [];
  const tracks: ImportedTrack[] = [];

  for (const item of rawTracks) {
    const trackName = decodeHtmlEntities(item.title || item.name || '').trim();
    const artistName = decodeHtmlEntities(item.subtitle || item.artists?.map((a: any) => a.name).join(', ') || 'Artist').trim();
    const spotifyTrackId = item.uri ? item.uri.replace('spotify:track:', '') : undefined;
    const trackCover = type === 'album' ? highResCover : undefined;

    if (trackName) {
      tracks.push({
        title: trackName,
        artist: artistName,
        album: type === 'album' ? playlistTitle : undefined,
        durationMs: item.duration,
        searchQuery: `${artistName} - ${trackName} audio`,
        coverArt: trackCover,
        spotifyTrackId,
      });
    }
  }

  // If this is a Spotify playlist with >= 100 tracks, paginate beyond the embed 100 track cap
  // using Spotify's internal Pathfinder GraphQL endpoint with the anonymous session token
  const accessToken = nextData?.props?.pageProps?.state?.settings?.session?.accessToken;

  if (type === 'playlist' && tracks.length >= 100 && accessToken) {
    try {
      let offset = tracks.length;
      let totalCount: number | null = null;
      const MAX_BATCH_TRACKS = 2000; // Sensible upper limit for batch imports

      while (offset < MAX_BATCH_TRACKS) {
        const variables = JSON.stringify({
          uri: `spotify:playlist:${id}`,
          offset,
          limit: 100,
          enableWatchFeedEntrypoint: false,
        });
        const extensions = JSON.stringify({
          persistedQuery: {
            version: 1,
            sha256Hash: 'a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4',
          },
        });

        const queryUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=fetchPlaylist&variables=${encodeURIComponent(
          variables
        )}&extensions=${encodeURIComponent(extensions)}`;

        const qRes = await fetch(queryUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'app-platform': 'WebPlayer',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!qRes.ok) break;

        const qData = await qRes.json();
        const content = qData?.data?.playlistV2?.content;
        if (!content || !Array.isArray(content.items) || content.items.length === 0) {
          break;
        }

        if (typeof content.totalCount === 'number') {
          totalCount = content.totalCount;
        }

        for (const item of content.items) {
          const trackData = item?.itemV2?.data;
          if (!trackData || !trackData.name) continue;

          const trackName = decodeHtmlEntities(trackData.name || '').trim();
          const artistName = decodeHtmlEntities(
            trackData.artists?.items?.map((a: any) => a?.profile?.name).filter(Boolean).join(', ') || 'Artist'
          ).trim();
          const albumName = decodeHtmlEntities(trackData.albumOfTrack?.name || '').trim();
          const spotifyTrackId = trackData.uri ? trackData.uri.replace('spotify:track:', '') : undefined;
          const durationMs = trackData.trackDuration?.totalMilliseconds;

          let trackCover: string | undefined;
          const sources = trackData.albumOfTrack?.coverArt?.sources;
          if (Array.isArray(sources) && sources.length > 0) {
            const maxSource = sources.find((s: any) => s.width === 640) || sources[sources.length - 1] || sources[0];
            if (maxSource?.url) {
              trackCover = maxSource.url.replace('00001e02', '0000b273').replace('00004851', '0000b273');
            }
          }

          if (trackName) {
            tracks.push({
              title: trackName,
              artist: artistName,
              album: albumName || playlistTitle,
              durationMs,
              searchQuery: `${artistName} - ${trackName} audio`,
              coverArt: trackCover,
              spotifyTrackId,
            });
          }
        }

        offset += content.items.length;
        if (totalCount !== null && tracks.length >= totalCount) {
          break;
        }
      }
    } catch (paginationErr) {
      console.warn('Failed to fetch additional paginated Spotify tracks:', paginationErr);
    }
  }

  if (tracks.length === 0 && type === 'track') {
    // Single track case: extract full 640x640 visual identity image
    const title = decodeHtmlEntities(entity.title || entity.name || '').trim();
    const artist = decodeHtmlEntities(
      entity.artists?.map((a: any) => a.name).join(', ') || entity.subtitle || 'Artist'
    ).trim();
    
    let singleTrackCover = highResCover;
    if (entity.visualIdentity?.image && Array.isArray(entity.visualIdentity.image)) {
      const img640 = entity.visualIdentity.image.find((i: any) => i.maxWidth === 640);
      singleTrackCover = img640?.url || entity.visualIdentity.image[0]?.url || singleTrackCover;
    }

    if (title) {
      tracks.push({
        title,
        artist,
        durationMs: entity.duration,
        searchQuery: `${artist} - ${title} audio`,
        coverArt: singleTrackCover,
        spotifyTrackId: id,
      });
    }
  }

  return {
    title: playlistTitle,
    type: 'spotify',
    coverArt: highResCover || rawCoverArt,
    tracks,
  };
}

/**
 * Fetch tracks from a public Apple Music playlist or album link
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
  let playlistTitle = 'Apple Music Playlist';
  let coverArt = '';
  const tracks: ImportedTrack[] = [];

  // Strategy 1: serialized-server-data (Provides exact playlist written title and high-precision track list)
  const serverDataMatch = html.match(/id=["']serialized-server-data["'][^>]*>([^<]+)<\/script>/);
  if (serverDataMatch) {
    try {
      const data = JSON.parse(serverDataMatch[1]);
      const root = data?.data?.['0']?.data;
      if (root?.sections && Array.isArray(root.sections)) {
        for (const s of root.sections) {
          // Playlist / Album Header Section
          if (s.items && s.items.length === 1 && s.items[0]?.title && (!playlistTitle || playlistTitle === 'Apple Music Playlist')) {
            playlistTitle = decodeHtmlEntities(s.items[0].title).trim();
            const artworkUrl = s.items[0]?.artwork?.dictionary?.url;
            if (artworkUrl && !coverArt) {
              coverArt = artworkUrl.replace('{w}', '1200').replace('{h}', '1200').replace('{f}', 'jpg');
            }
          }

          // Track List Section
          if (s.items && s.items.length > 1) {
            for (const item of s.items) {
              // Ensure we only process actual playable songs and filter out artist profiles or related playlists
              const kind = item.contentDescriptor?.kind;
              if (kind && kind !== 'song') continue;
              if (item.layoutStyle?.kind && item.layoutStyle.kind !== 'playlistTrackList' && item.layoutStyle.kind !== 'trackLockup') continue;
              if (!item.duration && !item.playAction && kind !== 'song') continue;

              const title = decodeHtmlEntities(item.title || item.name || '').trim();
              const artist = decodeHtmlEntities(
                item.artistName ||
                item.subtitleLinks?.map((a: any) => a.title).join(', ') ||
                'Artist'
              ).trim();

              const albumName = item.tertiaryLinks?.[0]?.title ? decodeHtmlEntities(item.tertiaryLinks[0].title).trim() : undefined;
              let trackCover = '';
              const rawArt = item.artwork?.dictionary?.url;
              if (rawArt) {
                trackCover = rawArt.replace('{w}', '1200').replace('{h}', '1200').replace('{f}', 'jpg');
              }

              if (title) {
                tracks.push({
                  title,
                  artist,
                  album: albumName,
                  durationMs: item.duration,
                  searchQuery: `${artist} - ${title} audio`,
                  coverArt: trackCover || coverArt,
                });
              }
            }
          }
        }
      }
    } catch {}
  }

  // Strategy 2: ld+json fallback
  if (tracks.length === 0) {
    const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (scripts) {
      for (const s of scripts) {
        try {
          const jsonText = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const json = JSON.parse(jsonText);

          if (json['@type'] === 'MusicPlaylist' || json['@type'] === 'MusicAlbum') {
            if (json.name) playlistTitle = decodeHtmlEntities(json.name).trim();
            if (json.image) coverArt = json.image;

            const trackItems = json.track?.numberOfItems ? json.track.itemListElement : json.track || [];
            for (const t of trackItems) {
              const item = t.item || t;
              const title = decodeHtmlEntities(item.name || '').trim();
              const artist = decodeHtmlEntities(item.byArtist?.name || json.byArtist?.name || 'Artist').trim();

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
  }

  // Strategy 3: og:title fallback for playlist title
  if (!playlistTitle || playlistTitle === 'Apple Music Playlist') {
    const ogTitleMatch = html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      const cleanOg = decodeHtmlEntities(ogTitleMatch[1])
        .replace(/\s+on Apple Music\s*$/i, '')
        .replace(/\s*-\s*Playlist\s*-\s*Apple Music\s*$/i, '')
        .replace(/\s*-\s*Album\s*-\s*Apple Music\s*$/i, '')
        .replace(/\s*-\s*Apple Music\s*$/i, '')
        .trim();
      if (cleanOg) playlistTitle = cleanOg;
    }
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
      thumbnail: t.coverArt || imported.coverArt || `https://i.ytimg.com/vi/default/hqdefault.jpg`,
      duration: t.durationMs ? Math.round(t.durationMs / 1000) : 0,
      durationFormatted: t.durationMs ? formatDuration(Math.round(t.durationMs / 1000)) : 'Audio',
      songTitle: t.title,
      artist: t.artist,
      album: t.album || imported.title,
      originalCoverArt: t.coverArt,
      spotifyTrackId: t.spotifyTrackId,
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
    album: imported.title,
    originalCoverArt: imported.coverArt,
  };
}

/**
 * Resolves the original high-resolution studio square cover art for any track
 * Prioritizes direct Spotify/Apple Music artwork, then Spotify oEmbed (640x640),
 * and falls back to official iTunes Search API (1200x1200).
 */
export async function resolveOriginalCoverArt(track: VideoMetadata): Promise<string | undefined> {
  // 1. Direct high-res artwork if already resolved
  if (track.originalCoverArt) {
    return track.originalCoverArt;
  }

  // 2. Spotify track oEmbed resolution (upgrades to 640x640)
  if (track.spotifyTrackId) {
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${track.spotifyTrackId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.thumbnail_url) {
          return json.thumbnail_url.replace('00001e02', '0000b273').replace('00004851', '0000b273');
        }
      }
    } catch {}
  }

  // 3. Apple Music / iTunes Store Catalog API (1200x1200 lossless studio art)
  const artistName = track.artist || track.uploader || '';
  const trackName = track.songTitle || (artistName && track.title.includes(' - ') ? track.title.split(' - ').slice(1).join(' - ') : track.title);
  const cleanQuery = `${artistName} ${trackName}`.trim();

  if (cleanQuery) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=music&limit=1`);
      if (res.ok) {
        const json = await res.json();
        if (json.results && json.results[0]?.artworkUrl100) {
          return json.results[0].artworkUrl100.replace('100x100bb', '1200x1200bb');
        }
      }
    } catch {}
  }

  return undefined;
}
