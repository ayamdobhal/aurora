import { preferences, type Provider } from "./preferences";
export type LineWord = { time: number; endTime: number; text: string };
export type SyncedLine = {
    time: number;
    text: string;
    words: LineWord[] | null;
    bgWords: LineWord[] | null;
  };
export type Lyrics =
    | { type: "synced"; lines: SyncedLine[] }
    | { type: "unsynced"; text: string }
    | { type: "none" } | { type: "instrumental" } | { type: "error" };

  export function parseLrc(lrc: string): SyncedLine[] {
    const lines: SyncedLine[] = [];
    const wordPattern = /<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g;
    for (const raw of lrc.split("\n")) {
      const lineMatch = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (!lineMatch) continue;
      const time =
        parseInt(lineMatch[1], 10) * 60 + parseFloat(lineMatch[2]);
      const rest = lineMatch[3];

      const words: LineWord[] = [];
      let m: RegExpExecArray | null;
      wordPattern.lastIndex = 0;
      while ((m = wordPattern.exec(rest)) !== null) {
        const t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
        words.push({ time: t, endTime: t + 0.3, text: m[3] });
      }
      // Fix enhanced LRC endTimes: each word ends when the next begins
      for (let k = 0; k < words.length - 1; k++) {
        words[k].endTime = words[k + 1].time;
      }

      if (words.length > 0) {
        lines.push({
          time,
          text: rest.replace(/<[^>]+>/g, "").trim(),
          words,
          bgWords: null,
        });
      } else {
        lines.push({ time, text: rest.trim(), words: null, bgWords: null });
      }
    }
    return lines.filter(l => Number.isFinite(l.time) && l.time >= 0).sort((a,b) => a.time-b.time);
  }

  function parseTtmlTime(s: string | null): number {
    if (!s) return 0;
    const str = s.trim();
    if (str.endsWith("ms")) return parseFloat(str) / 1000;
    if (str.endsWith("s")) return parseFloat(str.slice(0, -1));
    const parts = str.split(":");
    if (parts.length === 3) {
      return (
        parseInt(parts[0], 10) * 3600 +
        parseInt(parts[1], 10) * 60 +
        parseFloat(parts[2])
      );
    }
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(str);
  }

  function extractWords(parent: Element): LineWord[] {
    const result: LineWord[] = [];
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent || "";
        if (result.length > 0) result[result.length - 1].text += t;
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).tagName.toLowerCase() === "span"
      ) {
        const el = node as Element;
        const role = el.getAttribute("ttm:role") || el.getAttribute("role");
        if (role) continue;
        const sBegin = el.getAttribute("begin");
        const sEnd = el.getAttribute("end");
        if (sBegin) {
          const t = parseTtmlTime(sBegin);
          const e = sEnd ? parseTtmlTime(sEnd) : t + 0.3;
          if (Number.isFinite(t) && t >= 0) result.push({ time: t, endTime: Number.isFinite(e) && e > t ? e : t + .3, text: el.textContent || "" });
        }
      }
    }
    return result;
  }

  export function parseTtml(xml: string): SyncedLine[] {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return [];
    const lines: SyncedLine[] = [];
    doc.querySelectorAll("p").forEach((p) => {
      const pBegin = p.getAttribute("begin");
      if (!pBegin) return;
      const words: LineWord[] = [];
      let bgWords: LineWord[] = [];
      let fullText = "";
      for (const node of Array.from(p.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent || "";
          fullText += t;
          if (words.length > 0) words[words.length - 1].text += t;
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as Element).tagName.toLowerCase() === "span"
        ) {
          const el = node as Element;
          const role = el.getAttribute("ttm:role") || el.getAttribute("role");
          if (role === "x-bg") {
            bgWords = extractWords(el);
            continue;
          }
          if (role) continue;
          const sBegin = el.getAttribute("begin");
          const sEnd = el.getAttribute("end");
          const spanText = el.textContent || "";
          fullText += spanText;
          if (sBegin) {
            const t = parseTtmlTime(sBegin);
            const e = sEnd ? parseTtmlTime(sEnd) : t + 0.3;
            if (Number.isFinite(t) && t >= 0) words.push({ time: t, endTime: Number.isFinite(e) && e > t ? e : t + .3, text: spanText });
          }
        }
      }
      lines.push({
        time: parseTtmlTime(pBegin),
        text: fullText.trim(),
        words: words.length > 0 ? words : null,
        bgWords: bgWords.length > 0 ? bgWords : null,
      });
    });
    lines.sort((a, b) => a.time - b.time);
    return lines.filter(l => Number.isFinite(l.time) && l.time >= 0).sort((a,b) => a.time-b.time);
  }

  async function fetchFromAMLL(uri: string): Promise<Lyrics | null> {
    const trackId = uri.split(":")[2];
    if (!trackId) return null;
    try {
      const url = `https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/spotify-lyrics/${trackId}.ttml`;
      const res = await timedFetch(url);
      if (!res.ok) { if (res.status && res.status !== 404) throw Error("Provider failed"); return null; }
      const xml = await res.text();
      const lines = parseTtml(xml);
      if (lines.length === 0) return null;
      return { type: "synced", lines };
    } catch (error) { throw error; }
  }

  async function fetchFromLrclib(
    name: string | undefined,
    artist: string | undefined,
    album: string | undefined,
    durationMs: number,
  ): Promise<Lyrics | null> {
    if (!name || !artist) return null;
    const params = new URLSearchParams({
      track_name: name,
      artist_name: artist,
      album_name: album || "",
      duration: String(Math.round((durationMs || 0) / 1000)),
    });
    try {
      const res = await timedFetch(`https://lrclib.net/api/get?${params}`);
      if (!res.ok) { if (res.status && res.status !== 404) throw Error("Provider failed"); return null; }
      const data = await res.json();
      if (data.instrumental === true) return { type: "instrumental" };
      if (data.syncedLyrics) {
        const lines = parseLrc(data.syncedLyrics);
        if (lines.length) return { type: "synced", lines };
      }
      if (data.plainLyrics) {
        return { type: "unsynced", text: data.plainLyrics };
      }
      return null;
    } catch (error) { throw error; }
  }

  type SpotifyLyricsResponse = {
    lyrics?: { syncType?: string; lines?: { startTimeMs: string; words: string }[] };
  };
  type SpotifyLyricsRequest = {
    withHost(host: string): SpotifyLyricsRequest;
    withPath(path: string): SpotifyLyricsRequest;
    withQueryParameters(query: Record<string, string>): SpotifyLyricsRequest;
    withHeaders(headers: { key: string; value: string }[]): SpotifyLyricsRequest;
    send(): Promise<{ body: SpotifyLyricsResponse }>;
  };
  async function fetchFromSpotify(uri: string): Promise<Lyrics | null> {
    try {
      const trackId = uri.split(":")[2];
      const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`;
      // Spotify 1.3 no longer resolves this HTTPS endpoint through Cosmos.
      // Its request builder supplies the current session's auth and market.
      const builder = (Spicetify.Platform as unknown as {
        RequestBuilder?: { build(): SpotifyLyricsRequest };
      }).RequestBuilder;
      const res = builder?.build
        ? (await withTimeout(builder.build()
            .withHost('https://spclient.wg.spotify.com')
            .withPath(`/color-lyrics/v2/track/${trackId}`)
            .withQueryParameters({ format: 'json' })
            .withHeaders([{ key: 'app-platform', value: 'WebPlayer' }])
            .send())).body
        : await withTimeout(Spicetify.CosmosAsync.get(url, null, {
            "app-platform": "WebPlayer",
          }));
      if (!res?.lyrics?.lines?.length) return null;
      const { syncType, lines } = res.lyrics;
      if (syncType === "LINE_SYNCED") {
        return {
          type: "synced",
          lines: (lines as { startTimeMs: string; words: string }[]).filter(l => typeof l.words === 'string' && Number.isFinite(Number(l.startTimeMs)) && Number(l.startTimeMs) >= 0).map(
            (l) => ({
              time: parseInt(l.startTimeMs, 10) / 1000,
              text: l.words,
              words: null,
              bgWords: null,
            }),
          ).sort((a,b) => a.time-b.time),
        };
      }
      return {
        type: "unsynced",
        text: (lines as { words: string }[]).map((l) => l.words).join("\n"),
      };
    } catch (error) { throw error; }
  }


function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(Error('Provider timed out')), 10000);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
async function timedFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try { return await fetch(url, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
export type LyricsResult = { lyrics: Lyrics; provider: Provider };
type Store = { cache: Map<string, { value: LyricsResult; until: number }>; pending: Map<string, Promise<LyricsResult>> };
const host = window as unknown as { __auroraLyrics?: Store };
function store(): Store { return host.__auroraLyrics ??= { cache: new Map(), pending: new Map() }; }
function precision(lyrics: Lyrics): number {
  if (lyrics.type === 'synced' && lyrics.lines.length) {
    return lyrics.lines.some(line => line.words?.some(word => Number.isFinite(word.time) && word.endTime > word.time && word.text.trim())) ? 4 : 3;
  }
  if (lyrics.type === 'unsynced' && lyrics.text.trim()) return 2;
  return lyrics.type === 'instrumental' ? 1 : 0;
}
export function requestLyrics(track: Track, provider = preferences().provider, retry = false): Promise<LyricsResult> {
  const shared = store(), key = `${track.uri}:${provider}`;
  if (!retry) {
    const cached = shared.cache.get(key);
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
    const pending = shared.pending.get(key); if (pending) return pending;
  }
  const request = (async (): Promise<LyricsResult> => {
    if (!track.uri.startsWith('spotify:track:')) return { lyrics: { type: 'none' }, provider };
    const meta = track.metadata || {};
    const providers: Exclude<Provider, 'auto'>[] = provider === 'auto' ? ['amll','spotify','lrclib'] : [provider];
    // Launch every selected provider immediately; completion order never decides quality.
    const results = await Promise.allSettled(providers.map(async source => {
      const lyrics = await withTimeout(source === 'amll' ? fetchFromAMLL(track.uri) : source === 'spotify' ? fetchFromSpotify(track.uri)
        : fetchFromLrclib(meta.title || track.name, meta.artist_name, meta.album_title, track.duration?.milliseconds || Number(meta.duration) || 0));
      return { lyrics, provider: source };
    }));
    let best: LyricsResult | null = null, score = 0;
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.lyrics) continue;
      const rank = precision(result.value.lyrics);
      // Provider order is only a deterministic tie-breaker (AMLL, Spotify, lrclib).
      if (rank > score) { best = {lyrics: result.value.lyrics, provider: result.value.provider}; score = rank; }
    }
    return best ?? { lyrics: { type: results.some(r => r.status === 'rejected') ? 'error' : 'none' }, provider };
  })();
  shared.pending.set(key, request);
  void request.then(value => {
    if (shared.pending.get(key) !== request) return;
    shared.pending.delete(key);
    if (value.lyrics.type === 'error') return;
    shared.cache.delete(key);
    shared.cache.set(key, { value, until: Date.now() + (value.lyrics.type === 'none' ? 30000 : 600000) });
    if (shared.cache.size > 128) shared.cache.delete(shared.cache.keys().next().value!);
  });
  return request;
}
export function playbackProgress(): number {
  const d = Spicetify.Player.data;
  const ms = d?.position_as_of_timestamp != null && d.timestamp != null
    ? d.position_as_of_timestamp + (d.isPaused ? 0 : Math.max(0, Date.now() - d.timestamp)) : Spicetify.Player.getProgress();
  return Math.max(0, Math.min(Spicetify.Player.getDuration() || Infinity, ms));
}

export function invalidateLyrics(uri: string): void {
  for (const key of store().cache.keys()) if (key.startsWith(`${uri}:`)) store().cache.delete(key);
  for (const key of store().pending.keys()) if (key.startsWith(`${uri}:`)) store().pending.delete(key);
}
