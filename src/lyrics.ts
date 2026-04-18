(async function lyrics() {
  while (
    !Spicetify?.Player?.addEventListener ||
    !Spicetify?.CosmosAsync ||
    !Spicetify?.Player?.data
  ) {
    await new Promise((r) => setTimeout(r, 100));
  }

  type LineWord = { time: number; endTime: number; text: string };
  type SyncedLine = {
    time: number;
    text: string;
    words: LineWord[] | null;
    bgWords: LineWord[] | null;
  };
  type Lyrics =
    | { type: "synced"; lines: SyncedLine[] }
    | { type: "unsynced"; text: string }
    | { type: "none" };

  // Nudge lyrics timing — negative makes lyrics appear earlier, positive later.
  // Mutable via window.__lyricsOffsetMs so shortcuts.ts can nudge it live.
  const w = window as unknown as { __lyricsOffsetMs?: number };
  if (typeof w.__lyricsOffsetMs !== "number") w.__lyricsOffsetMs = 0;

  const cache = new Map<string, Lyrics>();
  let currentUri: string | null = null;
  let progressTimer: number | null = null;
  let activeIdx = -1;

  function getAccurateProgress(): number {
    const data = Spicetify.Player.data;
    let base: number;
    if (
      data?.position_as_of_timestamp != null &&
      data.timestamp != null
    ) {
      base = data.isPaused
        ? data.position_as_of_timestamp
        : data.position_as_of_timestamp + (Date.now() - data.timestamp);
    } else {
      base = Spicetify.Player.getProgress();
    }
    return base + (w.__lyricsOffsetMs ?? 0);
  }

  function toHttpUrl(url: string | undefined): string | null {
    if (!url) return null;
    if (url.startsWith("spotify:image:")) {
      return "https://i.scdn.co/image/" + url.slice("spotify:image:".length);
    }
    return url;
  }

  function escapeHtml(s: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return s.replace(/[&<>"']/g, (c) => map[c]);
  }

  function parseLrc(lrc: string): SyncedLine[] {
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
    return lines;
  }

  function parseTtmlTime(s: string | null): number {
    if (!s) return 0;
    const str = s.trim();
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
          result.push({ time: t, endTime: e, text: el.textContent || "" });
        }
      }
    }
    return result;
  }

  function parseTtml(xml: string): SyncedLine[] {
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
            words.push({ time: t, endTime: e, text: spanText });
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
    return lines;
  }

  async function fetchFromAMLL(uri: string): Promise<Lyrics | null> {
    const trackId = uri.split(":")[2];
    if (!trackId) return null;
    try {
      const url = `https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/spotify-lyrics/${trackId}.ttml`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const xml = await res.text();
      const lines = parseTtml(xml);
      if (lines.length === 0) return null;
      return { type: "synced", lines };
    } catch {
      return null;
    }
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
      const res = await fetch(`https://lrclib.net/api/get?${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.syncedLyrics) {
        return { type: "synced", lines: parseLrc(data.syncedLyrics) };
      }
      if (data.plainLyrics) {
        return { type: "unsynced", text: data.plainLyrics };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function fetchFromSpotify(uri: string): Promise<Lyrics | null> {
    try {
      const trackId = uri.split(":")[2];
      const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`;
      const res = await Spicetify.CosmosAsync.get(url, null, {
        "app-platform": "WebPlayer",
      });
      if (!res?.lyrics?.lines?.length) return null;
      const { syncType, lines } = res.lyrics;
      if (syncType === "LINE_SYNCED") {
        return {
          type: "synced",
          lines: (lines as { startTimeMs: string; words: string }[]).map(
            (l) => ({
              time: parseInt(l.startTimeMs, 10) / 1000,
              text: l.words,
              words: null,
              bgWords: null,
            }),
          ),
        };
      }
      return {
        type: "unsynced",
        text: (lines as { words: string }[]).map((l) => l.words).join("\n"),
      };
    } catch {
      return null;
    }
  }

  async function getLyrics(track: Track): Promise<Lyrics> {
    const uri = track.uri;
    const cached = cache.get(uri);
    if (cached) return cached;

    const meta = track.metadata || {};
    const name = meta.title || track.name;
    const artist = meta.artist_name;
    const album = meta.album_title;
    const duration =
      track.duration?.milliseconds || parseInt(meta.duration ?? "0", 10) || 0;

    let result: Lyrics | null = await fetchFromAMLL(uri);
    if (!result) result = await fetchFromLrclib(name, artist, album, duration);
    if (!result) result = await fetchFromSpotify(uri);

    const final: Lyrics = result ?? { type: "none" };
    cache.set(uri, final);
    return final;
  }

  function renderSynced(lines: SyncedLine[]): string {
    const inner = lines
      .map((l, i) => {
        if (l.words) {
          const mainHtml = l.words
            .map(
              (w, wi) =>
                `<span class="lyric-word" data-widx="${wi}">${escapeHtml(w.text)}</span>`,
            )
            .join("");
          let bgHtml = "";
          if (l.bgWords && l.bgWords.length > 0) {
            const bgInner = l.bgWords
              .map(
                (w, wi) =>
                  `<span class="lyric-word bg" data-bgwidx="${wi}">${escapeHtml(w.text)}</span>`,
              )
              .join("");
            bgHtml = ` <span class="lyric-bg">${bgInner}</span>`;
          }
          return `<div class="lyric-line enhanced" data-idx="${i}">${mainHtml || "&#9834;"}${bgHtml}</div>`;
        }
        return `<div class="lyric-line" data-idx="${i}">${escapeHtml(l.text) || "&#9834;"}</div>`;
      })
      .join("");
    return `<div class="lyrics-synced">${inner}</div>`;
  }

  function renderUnsynced(text: string): string {
    const inner = text
      .split("\n")
      .map((l) => `<div class="lyric-line-plain">${escapeHtml(l)}</div>`)
      .join("");
    return `<div class="lyrics-unsynced">${inner}</div>`;
  }

  function renderVinyl(): string {
    const track = Spicetify.Player.data?.item;
    const meta = track?.metadata || {};
    const art = toHttpUrl(meta.image_large_url || meta.image_url) || "";
    return `
      <div class="lyrics-vinyl">
        <div class="vinyl-disc" style="background-image: url('${art}');"></div>
        <div class="vinyl-message">Lyrics not available</div>
      </div>
    `;
  }

  function startProgressTracking(slot: HTMLElement, lines: SyncedLine[]): void {
    stopProgressTracking();
    activeIdx = -1;

    const tick = (): void => {
      const progressMs = getAccurateProgress();
      const progressSec = progressMs / 1000;

      let newIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= progressSec) newIdx = i;
        else break;
      }

      const container = slot.querySelector<HTMLElement>(".lyrics-synced");
      if (!container) {
        progressTimer = requestAnimationFrame(tick);
        return;
      }

      if (newIdx !== activeIdx) {
        activeIdx = newIdx;
        container.querySelectorAll<HTMLElement>(".lyric-line").forEach((el) => {
          const idx = parseInt(el.dataset.idx ?? "-1", 10);
          el.classList.toggle("active", idx === activeIdx);
          el.classList.toggle("past", idx < activeIdx);
          if (idx !== activeIdx) {
            // Reset non-active words: future = -20%, past = 120%
            const wp = idx < activeIdx ? "120%" : "-20%";
            el.querySelectorAll<HTMLElement>(".lyric-word").forEach((w) =>
              w.style.setProperty("--word-progress", wp),
            );
          }
        });
        const active = container.querySelector<HTMLElement>(".lyric-line.active");
        if (active) active.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      if (activeIdx >= 0) {
        const line = lines[activeIdx];
        const activeEl = container.querySelector<HTMLElement>(".lyric-line.active");
        if (activeEl) {
          const applyWords = (wordList: LineWord[], selector: string): void => {
            const els = activeEl.querySelectorAll<HTMLElement>(selector);
            wordList.forEach((w, wi) => {
              const el = els[wi];
              if (!el) return;
              const dur = Math.max(0.05, w.endTime - w.time);
              const local = Math.max(0, Math.min(1, (progressSec - w.time) / dur));
              const gradPos = -20 + 140 * local;
              el.style.setProperty("--word-progress", `${gradPos}%`);
            });
          };
          if (line.words) applyWords(line.words, ".lyric-word:not(.bg)");
          if (line.bgWords) applyWords(line.bgWords, ".lyric-word.bg");
        }
      }

      progressTimer = requestAnimationFrame(tick);
    };

    progressTimer = requestAnimationFrame(tick);
  }

  function stopProgressTracking(): void {
    if (progressTimer != null) cancelAnimationFrame(progressTimer);
    progressTimer = null;
    activeIdx = -1;
  }

  async function render(): Promise<void> {
    const slot = document.getElementById("lyrics-slot");
    if (!slot) return;

    const track = Spicetify.Player.data?.item;
    if (!track) {
      slot.innerHTML = "";
      stopProgressTracking();
      return;
    }

    if (track.uri === currentUri) return;
    currentUri = track.uri;

    stopProgressTracking();
    slot.innerHTML = '<div class="lyrics-loading">Loading…</div>';

    const lyrics = await getLyrics(track);
    if (track.uri !== currentUri) return;

    if (lyrics.type === "synced") {
      slot.innerHTML = renderSynced(lyrics.lines);
      const container = slot.querySelector<HTMLElement>(".lyrics-synced");
      if (container) {
        container.addEventListener("click", (e) => {
          const target = (e.target as HTMLElement).closest<HTMLElement>(
            ".lyric-line",
          );
          if (!target) return;
          const idx = parseInt(target.dataset.idx ?? "-1", 10);
          if (idx < 0 || !lyrics.lines[idx]) return;
          const ms = Math.round(lyrics.lines[idx].time * 1000);
          Spicetify.Player.seek(ms);
        });
      }
      startProgressTracking(slot, lyrics.lines);
    } else if (lyrics.type === "unsynced") {
      slot.innerHTML = renderUnsynced(lyrics.text);
    } else {
      slot.innerHTML = renderVinyl();
    }
  }

  const waitForSlot = window.setInterval(() => {
    if (document.getElementById("lyrics-slot")) {
      window.clearInterval(waitForSlot);
      Spicetify.Player.addEventListener("songchange", render);
      render();

      // Slot may get wiped by React re-renders; layout.ts re-injects empty.
      // When that happens, force a re-render so lyrics content returns.
      window.setInterval(() => {
        const slot = document.getElementById("lyrics-slot");
        if (
          slot &&
          slot.innerHTML === "" &&
          Spicetify.Player.data?.item
        ) {
          currentUri = null;
          render();
        }
      }, 1000);
    }
  }, 250);
})();
