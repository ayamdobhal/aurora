export type PreviewTrack = { uri: string; name: string; artist: string; duration: number; playable: boolean };
export type ContentsPreview = { tracks: PreviewTrack[]; total: number };

// Keep the native response boundary small: unsupported contracts become a retryable preview error.
export async function loadSearchPreview(type: 'album' | 'playlist', uri: string, offset = 0, limit = 12): Promise<ContentsPreview> {
  let items: any[], total: number;
  if (type === 'album') {
    const g = Spicetify.GraphQL;
    if (!g?.Request || !g.Definitions?.queryAlbumTracks) throw Error('Preview unavailable');
    const result = await g.Request(g.Definitions.queryAlbumTracks, { uri, offset, limit });
    const tracks = result?.data?.albumUnion?.tracksV2;
    if (!Array.isArray(tracks?.items)) throw Error('Preview unavailable');
    items = tracks.items.map((entry: any) => entry.track);
    total = tracks.totalCount ?? (offset + items.length);
  } else {
    const api = (Spicetify.Platform as any).PlaylistAPI;
    if (!api?.getContents) throw Error('Preview unavailable');
    const result = await api.getContents(uri, { offset, limit });
    if (!Array.isArray(result?.items)) throw Error('Preview unavailable');
    items = result.items; total = result.totalLength ?? result.totalCount ?? (offset + items.length);
  }
  return { total, tracks: items.filter(t => t && typeof t.uri === 'string' && t.uri.startsWith('spotify:track:')).slice(0,limit).map(t => ({
    uri: t.uri, name: typeof t.name === 'string' ? t.name : 'Untitled track',
    artist: (Array.isArray(t.artists) ? t.artists : t.artists?.items ?? []).map((a: any) => a.name ?? a.profile?.name ?? '').filter(Boolean).join(', '),
    duration: t.duration?.totalMilliseconds ?? t.duration?.milliseconds ?? 0,
    playable: t.isPlayable !== false && t.playability?.playable !== false,
  })) };
}

// Queue whole collections, never just the twelve tracks shown in the preview.
export async function searchQueueTracks(type: 'track' | 'album' | 'playlist', uri: string): Promise<Array<{uri: string}>> {
  if (type === 'track') return [{uri}];
  const tracks: Array<{uri: string}> = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await loadSearchPreview(type, uri, offset, 100);
    tracks.push(...page.tracks.filter(t => t.playable).map(t => ({uri:t.uri})));
    if (offset + 100 >= page.total) return tracks;
  }
  throw Error('Collection too large');
}
