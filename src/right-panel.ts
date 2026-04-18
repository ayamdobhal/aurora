(async function rightPanel() {
  while (!Spicetify?.Player?.addEventListener || !Spicetify?.Player?.data) {
    await new Promise((r) => setTimeout(r, 100));
  }

  type TabId = "queue" | "recent" | "friends";

  // Spotify's own icon glyphs live on Spicetify.SVGIcons as inner SVG content.
  // Wrap in a <svg> and use as innerHTML. Fallbacks in FALLBACK_ICONS cover
  // the unlikely case that a particular key is missing on this Spicetify build.
  const FALLBACK_ICONS: Record<string, string> = {
    play: '<path d="M3 1.5v13l11-6.5z"/>',
    pause:
      '<path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/>',
    "skip-back":
      '<path d="M3.3 1a.7.7 0 0 1 .7.7v5.4l8.4-5.6a1 1 0 0 1 1.6.8v11.4a1 1 0 0 1-1.6.8L4 8.9v5.4a.7.7 0 1 1-1.4 0V1.7a.7.7 0 0 1 .7-.7z"/>',
    "skip-forward":
      '<path d="M12.7 1a.7.7 0 0 0-.7.7v5.4L3.6 1.5A1 1 0 0 0 2 2.3v11.4a1 1 0 0 0 1.6.8L12 8.9v5.4a.7.7 0 1 0 1.4 0V1.7a.7.7 0 0 0-.7-.7z"/>',
    shuffle:
      '<path d="M13.1 2.3l2.6 2.3-2.6 2.3V5.5h-1.3c-.8 0-1.5.4-2 1L8.5 8 7.4 6.8l1.3-1.6c.7-.9 1.8-1.4 3-1.4h1.4V2.3zM2 3.7h1.9c1.2 0 2.3.5 3 1.4L13 12a2.4 2.4 0 0 0 2 1h1.3V14.7l-2.6 2.3-2.6-2.3V14h-1.3c-1.2 0-2.3-.5-3-1.4L3 5.1c-.3-.4-.7-.6-1.1-.6H2V3.7z"/>',
    repeat:
      '<path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/>',
    "repeat-once":
      '<path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/><path d="M8 7V5.5L6.5 6v.5L7 6.5V9H8V7z"/>',
    volume:
      '<path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65L5.031 12H2.25A2.25 2.25 0 0 1 0 9.75v-3.5A2.25 2.25 0 0 1 2.25 4h2.781L8.99.2a.75.75 0 0 1 .75.65zm2.325 2.85a5 5 0 0 1 0 8.6l-.75-1.3a3.5 3.5 0 0 0 0-6l.75-1.3z"/>',
    "volume-off":
      '<path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65L5.031 12H2.25A2.25 2.25 0 0 1 0 9.75v-3.5A2.25 2.25 0 0 1 2.25 4h2.781L8.99.2a.75.75 0 0 1 .75.65zM12 6.04l1.5 1.5 1.46-1.5L16 7.04l-1.5 1.5 1.5 1.46-1.04 1.04L13.5 9.54 12 11l-1.04-1.04 1.5-1.46-1.5-1.5L12 6.04z"/>',
    heart:
      '<path d="M1.69 2A4.58 4.58 0 0 1 8 2.023 4.58 4.58 0 0 1 11.88.817h.002a4.58 4.58 0 0 1 3.782 3.65v.003a4.82 4.82 0 0 1-1.63 4.521l-.023.02-6.003 5.553a.75.75 0 0 1-1.019.001L1.011 9.008l-.005-.005a4.82 4.82 0 0 1-.688-6.341A4.58 4.58 0 0 1 1.69 2zm3.356.418a3.08 3.08 0 0 0-3.668 2.155 3.32 3.32 0 0 0 .481 2.69L8 13.203l5.976-5.526a3.32 3.32 0 0 0 1.11-3.11 3.08 3.08 0 0 0-2.542-2.448 3.08 3.08 0 0 0-3.392 1.775.75.75 0 0 1-1.33.018 3.08 3.08 0 0 0-2.776-1.494z"/>',
    "heart-active":
      '<path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z"/>',
    x:
      '<path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z"/>',
  };

  function icon(name: string): string {
    const inner = Spicetify.SVGIcons?.[name] ?? FALLBACK_ICONS[name] ?? "";
    return `<svg viewBox="0 0 16 16" fill="currentColor">${inner}</svg>`;
  }

  function fmtTime(ms: number): string {
    if (!isFinite(ms) || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
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

  let panelEl: HTMLElement | null = null;
  let activeTab: TabId = "queue";
  let rafId: number | null = null;
  let seeking = false;

  function build(): HTMLElement {
    const el = document.createElement("div");
    el.id = "custom-right-panel";
    el.innerHTML = `
      <div class="crp-player">
        <a class="crp-context" href="#"><span class="crp-context-label">Playing from</span> <span class="crp-context-name"></span></a>
        <div class="crp-cover"></div>
        <div class="crp-track-info">
          <div class="crp-track-text">
            <a class="crp-track-name crp-link"></a>
            <a class="crp-track-artist crp-link"></a>
            <a class="crp-track-album crp-link"></a>
          </div>
          <button class="crp-btn crp-like" title="Save to Liked Songs">${icon("heart")}</button>
        </div>
        <div class="crp-seek">
          <span class="crp-time-elapsed">0:00</span>
          <div class="crp-seek-bar"><div class="crp-seek-fill"></div><div class="crp-seek-thumb"></div></div>
          <span class="crp-time-total">0:00</span>
        </div>
        <div class="crp-controls">
          <button class="crp-btn crp-shuffle" title="Shuffle">${icon("shuffle")}</button>
          <button class="crp-btn crp-prev" title="Previous">${icon("skip-back")}</button>
          <button class="crp-btn crp-play-pause crp-primary" title="Play/Pause">${icon("play")}</button>
          <button class="crp-btn crp-next" title="Next">${icon("skip-forward")}</button>
          <button class="crp-btn crp-repeat" title="Repeat">${icon("repeat")}</button>
        </div>
        <div class="crp-volume">
          <button class="crp-btn crp-vol-icon" title="Mute">${icon("volume")}</button>
          <div class="crp-vol-bar"><div class="crp-vol-fill"></div><div class="crp-vol-thumb"></div></div>
          <span class="crp-vol-pct">100%</span>
        </div>
      </div>
      <div class="crp-tabs">
        <div class="crp-tab-bar" data-active="queue" data-user-queued="0">
          <button class="crp-tab active" data-tab="queue">Queue</button>
          <button class="crp-tab" data-tab="recent">Recent</button>
          <button class="crp-tab" data-tab="friends">Friends</button>
          <button class="crp-tab-action crp-clear-queue" title="Clear queue">${icon("x")}<span>Clear queue</span></button>
        </div>
        <div class="crp-tab-content">
          <div class="crp-tab-pane active" data-pane="queue"><div class="crp-list crp-queue-list"></div></div>
          <div class="crp-tab-pane" data-pane="recent"><div class="crp-list crp-recent-list"></div></div>
          <div class="crp-tab-pane" data-pane="friends"><div class="crp-list crp-friends-list"></div></div>
        </div>
      </div>
    `;
    wireControls(el);
    wireTabs(el);
    wireLinkNavigation(el);
    return el;
  }

  // Delegated handler: any <a class="crp-link" href="/..."> inside the panel
  // navigates via Spotify's router instead of doing a browser hop.
  function wireLinkNavigation(root: HTMLElement): void {
    root.addEventListener(
      "click",
      (e) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
          "a.crp-link",
        );
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || !href.startsWith("/")) return;
        e.preventDefault();
        e.stopPropagation();
        Spicetify.Platform.History.push(href);
      },
      true,
    );
  }

  function wireControls(root: HTMLElement): void {
    root
      .querySelector(".crp-play-pause")
      ?.addEventListener("click", () => Spicetify.Player.togglePlay());
    root
      .querySelector(".crp-prev")
      ?.addEventListener("click", () => Spicetify.Player.back());
    root
      .querySelector(".crp-next")
      ?.addEventListener("click", () => Spicetify.Player.next());
    root
      .querySelector(".crp-shuffle")
      ?.addEventListener("click", () => {
        Spicetify.Player.toggleShuffle();
        syncShuffleRepeat();
      });
    root
      .querySelector(".crp-repeat")
      ?.addEventListener("click", () => {
        const cur = Spicetify.Player.getRepeat();
        const next = ((cur + 1) % 3) as 0 | 1 | 2;
        Spicetify.Player.setRepeat(next);
        syncShuffleRepeat();
      });
    root
      .querySelector(".crp-vol-icon")
      ?.addEventListener("click", () => {
        Spicetify.Player.toggleMute();
        syncVolume();
      });
    root
      .querySelector(".crp-like")
      ?.addEventListener("click", toggleLike);

    const seekBar = root.querySelector<HTMLElement>(".crp-seek-bar");
    if (seekBar) {
      const seekFromEvent = (e: MouseEvent): number => {
        const rect = seekBar.getBoundingClientRect();
        const frac = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / rect.width),
        );
        const dur = Spicetify.Player.getDuration();
        return frac * dur;
      };
      seekBar.addEventListener("mousedown", (e) => {
        seeking = true;
        const ms = seekFromEvent(e);
        updateSeekUI(ms, Spicetify.Player.getDuration());
        const onMove = (ev: MouseEvent): void => {
          updateSeekUI(seekFromEvent(ev), Spicetify.Player.getDuration());
        };
        const onUp = (ev: MouseEvent): void => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          Spicetify.Player.seek(Math.round(seekFromEvent(ev)));
          seeking = false;
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }

    const volBar = root.querySelector<HTMLElement>(".crp-vol-bar");
    if (volBar) {
      const volFromEvent = (e: MouseEvent): number => {
        const rect = volBar.getBoundingClientRect();
        return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      };
      volBar.addEventListener("mousedown", (e) => {
        const v = volFromEvent(e);
        Spicetify.Player.setVolume(v);
        updateVolumeUI(v);
        const onMove = (ev: MouseEvent): void => {
          const vv = volFromEvent(ev);
          Spicetify.Player.setVolume(vv);
          updateVolumeUI(vv);
        };
        const onUp = (): void => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }
  }

  function wireTabs(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>(".crp-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tab as TabId | undefined;
        if (id) setActiveTab(id);
      });
    });
    root
      .querySelector(".crp-clear-queue")
      ?.addEventListener("click", clearQueue);
  }

  const TAB_ORDER: Record<TabId, number> = { queue: 0, recent: 1, friends: 2 };
  let lastTabIdx = 0;

  function setActiveTab(id: TabId): void {
    if (!panelEl) return;
    const prevIdx = lastTabIdx;
    const newIdx = TAB_ORDER[id];
    activeTab = id;
    lastTabIdx = newIdx;
    panelEl.querySelectorAll<HTMLElement>(".crp-tab").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === id);
    });
    // Pane slide direction: newer tab (right) → slide in from right;
    // older tab (left) → slide in from left. Re-applying the animation
    // class requires removing + forcing reflow so the same animation can
    // restart on repeat clicks.
    panelEl.querySelectorAll<HTMLElement>(".crp-tab-pane").forEach((el) => {
      el.classList.remove("crp-slide-right", "crp-slide-left");
      const isActive = el.dataset.pane === id;
      el.classList.toggle("active", isActive);
      if (isActive) {
        void el.offsetWidth;
        el.classList.add(newIdx >= prevIdx ? "crp-slide-right" : "crp-slide-left");
      }
    });
    const bar = panelEl.querySelector<HTMLElement>(".crp-tab-bar");
    if (bar) bar.dataset.active = id;
    // Kick a background refresh — diff cache + probe cache make this cheap.
    if (id === "recent") refreshRecent();
    else if (id === "friends") refreshFriends();
  }

  // ==================== Sync from Player state ====================

  function setLink(
    el: HTMLAnchorElement | null,
    text: string,
    uri: string | undefined,
  ): void {
    if (!el) return;
    el.textContent = text;
    if (uri) {
      const path = uri.replace(/^spotify:/, "/").replace(/:/g, "/");
      el.setAttribute("href", path);
    } else {
      el.removeAttribute("href");
    }
  }

  function syncTrackInfo(): void {
    if (!panelEl) return;
    const track = Spicetify.Player.data?.item;
    const meta = track?.metadata || {};
    const cover = toHttpUrl(meta.image_large_url || meta.image_url) || "";
    const name = meta.title || track?.name || "";
    const artist = meta.artist_name || "";
    const album = meta.album_title || "";
    const coverEl = panelEl.querySelector<HTMLElement>(".crp-cover");
    if (coverEl) coverEl.style.backgroundImage = cover ? `url('${cover}')` : "";
    setLink(
      panelEl.querySelector<HTMLAnchorElement>(".crp-track-name"),
      name,
      track?.uri,
    );
    setLink(
      panelEl.querySelector<HTMLAnchorElement>(".crp-track-artist"),
      artist,
      meta.artist_uri,
    );
    setLink(
      panelEl.querySelector<HTMLAnchorElement>(".crp-track-album"),
      album,
      meta.album_uri,
    );
    syncContext();
  }

  function syncContext(): void {
    if (!panelEl) return;
    const data = Spicetify.Player.data as unknown as {
      context?: { uri?: string; metadata?: { context_description?: string } };
      item?: { metadata?: Record<string, string | undefined> };
    };
    const meta = data?.item?.metadata;
    const name =
      data?.context?.metadata?.context_description ||
      meta?.context_description ||
      "";
    const uri = data?.context?.uri || meta?.context_uri || "";
    const link = panelEl.querySelector<HTMLAnchorElement>(".crp-context");
    const nameEl = panelEl.querySelector<HTMLElement>(".crp-context-name");
    if (!link || !nameEl) return;
    if (!name) {
      link.style.display = "none";
      return;
    }
    link.style.display = "";
    nameEl.textContent = name;
    if (uri) {
      const path = uri.replace(/^spotify:/, "/").replace(/:/g, "/");
      link.setAttribute("href", path);
      link.onclick = (e) => {
        e.preventDefault();
        Spicetify.Platform.History.push(path);
      };
    } else {
      link.removeAttribute("href");
      link.onclick = null;
    }
  }

  function syncPlayPause(): void {
    if (!panelEl) return;
    const btn = panelEl.querySelector<HTMLElement>(".crp-play-pause");
    if (!btn) return;
    const paused = Spicetify.Player.data?.isPaused ?? true;
    btn.innerHTML = icon(paused ? "play" : "pause");
  }

  // Spicetify.Platform.LibraryAPI shape varies across builds; probe the
  // common signatures. `contains` may return boolean | boolean[] depending
  // on whether a single URI or array was passed.
  type LibraryAPI = {
    contains?: (
      ...uris: Array<string | string[]>
    ) => Promise<boolean | boolean[]>;
    add?: (arg: { uris: string[] }) => Promise<unknown>;
    remove?: (arg: { uris: string[] }) => Promise<unknown>;
    getEvents?: () => {
      addListener?: (name: string, fn: () => void) => void;
    };
  };

  function libraryApi(): LibraryAPI | undefined {
    return (Spicetify.Platform as unknown as { LibraryAPI?: LibraryAPI })
      ?.LibraryAPI;
  }

  async function isLiked(uri: string): Promise<boolean> {
    const api = libraryApi();
    if (!api?.contains) return false;
    try {
      const res = await api.contains(uri);
      return Array.isArray(res) ? !!res[0] : !!res;
    } catch {
      return false;
    }
  }

  async function syncLikeState(): Promise<void> {
    if (!panelEl) return;
    const btn = panelEl.querySelector<HTMLElement>(".crp-like");
    const uri = Spicetify.Player.data?.item?.uri;
    if (!btn) return;
    if (!uri || !uri.startsWith("spotify:track:")) {
      btn.classList.remove("active");
      btn.innerHTML = icon("heart");
      btn.setAttribute("title", "Save to Liked Songs");
      return;
    }
    const liked = await isLiked(uri);
    btn.classList.toggle("active", liked);
    btn.innerHTML = icon(liked ? "heart-active" : "heart");
    btn.setAttribute(
      "title",
      liked ? "Remove from Liked Songs" : "Save to Liked Songs",
    );
  }

  async function toggleLike(): Promise<void> {
    const uri = Spicetify.Player.data?.item?.uri;
    if (!uri || !uri.startsWith("spotify:track:")) return;
    const api = libraryApi();
    if (!api) return;
    const liked = await isLiked(uri);
    try {
      if (liked) await api.remove?.({ uris: [uri] });
      else await api.add?.({ uris: [uri] });
    } catch {
      // failure just leaves the icon stale until next sync
    }
    await syncLikeState();
  }

  // Spicetify's getShuffle/getRepeat may be absent on some builds — fall back
  // to Player.data fields.
  function readShuffle(): boolean {
    try {
      return !!Spicetify.Player.getShuffle();
    } catch {
      return !!Spicetify.Player.data?.shuffle;
    }
  }
  function readRepeat(): 0 | 1 | 2 {
    try {
      return Spicetify.Player.getRepeat();
    } catch {
      return (Spicetify.Player.data?.repeat ?? 0) as 0 | 1 | 2;
    }
  }

  function syncShuffleRepeat(): void {
    if (!panelEl) return;
    const sh = panelEl.querySelector<HTMLElement>(".crp-shuffle");
    if (sh) sh.classList.toggle("active", readShuffle());
    const rp = panelEl.querySelector<HTMLElement>(".crp-repeat");
    if (rp) {
      const mode = readRepeat();
      rp.classList.toggle("active", mode !== 0);
      rp.innerHTML = icon(mode === 2 ? "repeat-once" : "repeat");
    }
  }

  function syncVolume(): void {
    if (!panelEl) return;
    const v = Spicetify.Player.getVolume();
    updateVolumeUI(v);
    const ic = panelEl.querySelector<HTMLElement>(".crp-vol-icon");
    if (ic) {
      const muted = (() => {
        try {
          return Spicetify.Player.getMute();
        } catch {
          return false;
        }
      })();
      ic.innerHTML = icon(muted || v === 0 ? "volume-off" : "volume");
    }
  }

  function updateVolumeUI(v: number): void {
    if (!panelEl) return;
    const fill = panelEl.querySelector<HTMLElement>(".crp-vol-fill");
    const thumb = panelEl.querySelector<HTMLElement>(".crp-vol-thumb");
    const pct = panelEl.querySelector<HTMLElement>(".crp-vol-pct");
    const pctStr = `${Math.round(v * 100)}%`;
    if (fill) fill.style.width = pctStr;
    if (thumb) thumb.style.left = pctStr;
    if (pct) pct.textContent = pctStr;
  }

  function updateSeekUI(progressMs: number, durationMs: number): void {
    if (!panelEl) return;
    const fill = panelEl.querySelector<HTMLElement>(".crp-seek-fill");
    const thumb = panelEl.querySelector<HTMLElement>(".crp-seek-thumb");
    const el = panelEl.querySelector<HTMLElement>(".crp-time-elapsed");
    const tot = panelEl.querySelector<HTMLElement>(".crp-time-total");
    const pct = durationMs > 0 ? Math.max(0, Math.min(1, progressMs / durationMs)) : 0;
    if (fill) fill.style.width = `${pct * 100}%`;
    if (thumb) thumb.style.left = `${pct * 100}%`;
    if (el) el.textContent = fmtTime(progressMs);
    if (tot) tot.textContent = fmtTime(durationMs);
  }

  function getAccurateProgress(): number {
    const data = Spicetify.Player.data;
    if (data?.position_as_of_timestamp != null && data.timestamp != null) {
      return data.isPaused
        ? data.position_as_of_timestamp
        : data.position_as_of_timestamp + (Date.now() - data.timestamp);
    }
    return Spicetify.Player.getProgress();
  }

  function startProgressLoop(): void {
    if (rafId != null) cancelAnimationFrame(rafId);
    const tick = (): void => {
      if (!seeking) {
        const dur = Spicetify.Player.getDuration();
        updateSeekUI(getAccurateProgress(), dur);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  // ==================== Queue tab ====================

  interface QueueTrack {
    uri: string;
    uid: string;
    name: string;
    artist: string;
    artistUri: string;
    album: string;
    albumUri: string;
    art: string;
  }

  // Build an <a> that navigates via Spicetify's router (intercepted by panel-
  // level click handler). Falls back to a plain span if no URI.
  function linkHtml(uri: string | undefined, text: string, extraClass = ""): string {
    const safe = escapeHtml(text);
    const cls = ["crp-link", extraClass].filter(Boolean).join(" ");
    if (!uri) return `<span class="${extraClass}">${safe}</span>`;
    const path = uri.replace(/^spotify:/, "/").replace(/:/g, "/");
    return `<a class="${cls}" href="${path}">${safe}</a>`;
  }

  function normalizeQueueItem(item: unknown): QueueTrack | null {
    const any = item as Record<string, unknown>;
    const src =
      (any.contextTrack as Record<string, unknown>) ||
      (any.track as Record<string, unknown>) ||
      any;
    const uri = (src.uri as string) || (any.uri as string) || "";
    if (!uri || !uri.startsWith("spotify:track:")) return null;
    const uid = (any.uid as string) || (src.uid as string) || "";
    const meta =
      (src.metadata as Record<string, string | undefined>) ||
      (any.metadata as Record<string, string | undefined>) ||
      {};
    return {
      uri,
      uid,
      name: meta.title || meta.track_title || (src.name as string) || uri,
      artist: meta.artist_name || "",
      artistUri: meta.artist_uri || "",
      album: meta.album_title || "",
      albumUri: meta.album_uri || "",
      art: toHttpUrl(meta.image_small_url || meta.image_url) || "",
    };
  }

  // Tracks the count of user-added "Play next" items, separate from the
  // context's auto-generated up-next. Used to hide Clear queue when there's
  // nothing the user has queued up themselves.
  let userQueuedCount = 0;

  async function fetchQueue(): Promise<QueueTrack[]> {
    const platform = Spicetify.Platform as unknown as {
      PlayerAPI?: { getQueue?: () => Promise<unknown> };
    };
    const api = platform?.PlayerAPI;
    let raw: unknown[] = [];
    let queued = 0;
    if (api?.getQueue) {
      try {
        const s = (await api.getQueue()) as Record<string, unknown>;
        // On this build: `queued` = user "Play next" items (each carries
        // `provider: "queue"`), `nextUp` = context auto-up-next tail.
        // Concatenate in playback order; older builds expose the same as
        // `nextTracks`, so fall back to it if present.
        const userQ = Array.isArray(s?.queued) ? (s.queued as unknown[]) : [];
        const nextUp = Array.isArray(s?.nextUp) ? (s.nextUp as unknown[]) : [];
        queued = userQ.length;
        if (userQ.length || nextUp.length) {
          raw = userQ.concat(nextUp);
        } else if (Array.isArray(s?.nextTracks)) {
          raw = s.nextTracks as unknown[];
        } else if (
          Array.isArray((s?.queue as Record<string, unknown>)?.nextTracks)
        ) {
          raw = (s.queue as Record<string, unknown>).nextTracks as unknown[];
        }
      } catch {
        // ignore
      }
    }
    if (raw.length === 0) {
      const g = (Spicetify as unknown as {
        Queue?: {
          nextTracks?: unknown[];
          _queue?: { nextTracks?: unknown[] };
        };
      }).Queue;
      const fallback = g?.nextTracks || g?._queue?.nextTracks || [];
      if (Array.isArray(fallback)) raw = fallback;
    }
    userQueuedCount = queued;
    const out: QueueTrack[] = [];
    for (const item of raw) {
      const n = normalizeQueueItem(item);
      if (n) out.push(n);
    }
    return out;
  }

  let cachedQueue: QueueTrack[] = [];

  function renderQueueRow(t: QueueTrack, i: number): string {
    const artist = t.artist ? linkHtml(t.artistUri, t.artist) : "";
    const album = t.album ? linkHtml(t.albumUri, t.album) : "";
    const sub = [artist, album].filter(Boolean).join(" · ");
    return `
      <div class="crp-list-row crp-queue-row" data-idx="${i}" draggable="true">
        <div class="crp-drag-handle" aria-hidden="true">&#x2261;</div>
        <div class="crp-list-art" style="background-image: url('${t.art}');"></div>
        <div class="crp-list-info">
          ${linkHtml(t.uri, t.name, "crp-list-name")}
          <span class="crp-list-sub">${sub}</span>
        </div>
        <div class="crp-row-actions">
          <button class="crp-row-btn" data-action="remove" title="Remove from queue">&times;</button>
        </div>
      </div>`;
  }

  function renderQueue(list: QueueTrack[]): void {
    if (!panelEl) return;
    const container = panelEl.querySelector<HTMLElement>(".crp-queue-list");
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML = '<div class="crp-empty">Queue is empty</div>';
      return;
    }
    // Split at userQueuedCount: items before are user "Play next", items
    // after are context auto-up-next. Mirrors Spotify's own layout with a
    // "Next up" label between the two groups. Data-idx is the absolute
    // index into cachedQueue regardless of which group the row is in, so
    // click/remove/reorder handlers keep working.
    const split = Math.min(userQueuedCount, list.length);
    const user = list.slice(0, split).map((t, i) => renderQueueRow(t, i));
    const auto = list
      .slice(split)
      .map((t, i) => renderQueueRow(t, split + i));
    const divider =
      user.length > 0 && auto.length > 0
        ? '<div class="crp-queue-divider">Next up</div>'
        : "";
    container.innerHTML = user.join("") + divider + auto.join("");
  }

  function clearDropIndicators(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>(
      ".crp-drop-before, .crp-drop-after",
    ).forEach((el) => {
      el.classList.remove("crp-drop-before", "crp-drop-after");
    });
  }

  // Container-level delegation — wire once per panel inject, not per render.
  // With hundreds of rows, attaching 6+ listeners per row on every refresh
  // was the main source of tab-switch/scroll lag.
  function wireQueueDelegation(container: HTMLElement): void {
    const rowOf = (e: Event): HTMLElement | null =>
      (e.target as HTMLElement).closest<HTMLElement>(".crp-queue-row");

    container.addEventListener("click", (e) => {
      const row = rowOf(e);
      if (!row) return;
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>(".crp-row-btn");
      if (btn) {
        e.stopPropagation();
        const idx = parseInt(row.dataset.idx ?? "-1", 10);
        if (btn.dataset.action === "remove") removeFromQueue(idx);
        return;
      }
      if (target.closest(".crp-drag-handle")) return;
      if (target.closest("a.crp-link")) return;
      const idx = parseInt(row.dataset.idx ?? "-1", 10);
      const t = cachedQueue[idx];
      if (t) Spicetify.Player.playUri(t.uri);
    });

    container.addEventListener("dragstart", (e) => {
      const row = rowOf(e);
      if (!row) return;
      const idx = parseInt(row.dataset.idx ?? "-1", 10);
      if (idx < 0) return;
      (e as DragEvent).dataTransfer?.setData("text/plain", String(idx));
      const dt = (e as DragEvent).dataTransfer;
      if (dt) dt.effectAllowed = "move";
      row.classList.add("crp-dragging");
    });

    container.addEventListener("dragend", (e) => {
      const row = rowOf(e);
      if (row) row.classList.remove("crp-dragging");
      clearDropIndicators(container);
    });

    container.addEventListener("dragover", (e) => {
      const row = rowOf(e);
      if (!row) return;
      e.preventDefault();
      const dt = (e as DragEvent).dataTransfer;
      if (dt) dt.dropEffect = "move";
      const rect = row.getBoundingClientRect();
      const before = (e as DragEvent).clientY < rect.top + rect.height / 2;
      // Only touch the row that's actually under the cursor
      if (!row.classList.contains(before ? "crp-drop-before" : "crp-drop-after")) {
        clearDropIndicators(container);
        row.classList.toggle("crp-drop-before", before);
        row.classList.toggle("crp-drop-after", !before);
      }
    });

    container.addEventListener("drop", (e) => {
      const row = rowOf(e);
      if (!row) return;
      e.preventDefault();
      const fromIdx = parseInt(
        (e as DragEvent).dataTransfer?.getData("text/plain") ?? "-1",
        10,
      );
      const targetIdx = parseInt(row.dataset.idx ?? "-1", 10);
      const dropBefore = row.classList.contains("crp-drop-before");
      clearDropIndicators(container);
      if (fromIdx < 0 || targetIdx < 0 || fromIdx === targetIdx) return;
      const insertIdx = dropBefore ? targetIdx : targetIdx + 1;
      if (insertIdx === fromIdx || insertIdx === fromIdx + 1) return;
      const source = cachedQueue[fromIdx];
      if (!source) return;
      const beforeItem = cachedQueue[insertIdx] ?? null;
      moveToPosition(source, beforeItem);
    });
  }

  function playerApi(): {
    removeFromQueue?: (tracks: unknown[]) => Promise<unknown>;
    reorderQueue?: (
      tracks: unknown[],
      opts: unknown,
    ) => Promise<unknown>;
    clearQueue?: () => Promise<unknown>;
  } | undefined {
    return (Spicetify.Platform as unknown as {
      PlayerAPI?: {
        removeFromQueue?: (tracks: unknown[]) => Promise<unknown>;
        reorderQueue?: (
          tracks: unknown[],
          opts: unknown,
        ) => Promise<unknown>;
        clearQueue?: () => Promise<unknown>;
      };
    })?.PlayerAPI;
  }

  async function clearQueue(): Promise<void> {
    const api = playerApi();
    if (!api) return;
    try {
      if (api.clearQueue) {
        await api.clearQueue();
      } else if (api.removeFromQueue && cachedQueue.length > 0) {
        // Fallback for builds without clearQueue — remove everything in bulk.
        await api.removeFromQueue(
          cachedQueue.map((t) => ({ uri: t.uri, uid: t.uid })),
        );
      }
      await refreshQueue(true);
    } catch {
      // swallow — next refresh corrects state
    }
  }

  async function removeFromQueue(idx: number): Promise<void> {
    const item = cachedQueue[idx];
    const api = playerApi();
    if (!item || !api?.removeFromQueue) return;
    try {
      await api.removeFromQueue([{ uri: item.uri, uid: item.uid }]);
      await refreshQueue(true);
    } catch {
      // swallow — row just stays in place; next refresh corrects state
    }
  }

  async function moveToPosition(
    source: QueueTrack,
    before: QueueTrack | null,
  ): Promise<void> {
    const api = playerApi();
    if (!api?.reorderQueue) return;
    const srcTrack = { uri: source.uri, uid: source.uid };
    try {
      if (before) {
        await api.reorderQueue([srcTrack], {
          before: { uri: before.uri, uid: before.uid },
        });
      } else {
        // Inserting at end — pass `after` referencing the current last item.
        const last = cachedQueue[cachedQueue.length - 1];
        if (!last || last.uid === source.uid) return;
        await api.reorderQueue([srcTrack], {
          after: { uri: last.uri, uid: last.uid },
        });
      }
      await refreshQueue(true);
    } catch {
      // swallow — next refresh realigns the visible order
    }
  }

  let lastQueueKey = "";
  async function refreshQueue(force = false): Promise<void> {
    const list = await fetchQueue();
    const key = list.map((t) => t.uid || t.uri).join("|");
    // Always sync the user-queued count — even when the visible list
    // hasn't changed, the user-queued split may have (e.g. they added or
    // removed a single already-present track).
    if (panelEl) {
      const bar = panelEl.querySelector<HTMLElement>(".crp-tab-bar");
      if (bar) bar.dataset.userQueued = String(userQueuedCount);
    }
    if (!force && key === lastQueueKey) return;
    lastQueueKey = key;
    cachedQueue = list;
    renderQueue(list);
  }

  // ==================== Recent tab ====================

  interface RecentItem {
    uri: string;
    name: string;
    artist: string;
    artistUri: string;
    album: string;
    albumUri: string;
    art: string;
    // ms epoch of last play. Zero when the API response didn't include
    // a parseable timestamp on this build.
    playedAt: number;
  }

  function parseTimestamp(v: unknown): number {
    if (typeof v === "number" && isFinite(v)) {
      // Heuristic: values below year 2001 as seconds-since-epoch are
      // essentially unreachable here; treat small numbers as seconds.
      return v < 1e12 ? v * 1000 : v;
    }
    if (typeof v === "string") {
      const n = Date.parse(v);
      if (!isNaN(n)) return n;
    }
    return 0;
  }

  // Relative time for Recent rows. User spec: 1h ago, 23h ago,
  // yesterday, 5d ago, etc.
  function relTime(ms: number): string {
    if (!ms) return "";
    const diff = Date.now() - ms;
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 2) return "yesterday";
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  function extractArtUrl(sources: unknown): string {
    if (!Array.isArray(sources)) return "";
    for (const s of sources) {
      const url = (s as { url?: string })?.url;
      if (url) return url;
    }
    return "";
  }

  function normalizeRecentItem(raw: unknown): RecentItem | null {
    const any = raw as Record<string, unknown>;
    // Wrappers vary: {item: {...}}, {track: {...}}, or bare item
    const t =
      (any.item as Record<string, unknown>) ||
      (any.track as Record<string, unknown>) ||
      any;
    const uri = (t?.uri as string) || (any.uri as string) || "";
    // Only tracks — Recent tab mirrors Queue (songs with artist + album subline).
    if (!uri || !uri.startsWith("spotify:track:")) return null;
    const name =
      (t?.name as string) ||
      ((t?.metadata as { title?: string })?.title ?? "") ||
      uri;
    // Artist — this build uses `contributors` (array of {uri, name}); older
    // shapes use `artists` (with optional `profile`) or flat metadata fields.
    let artist = "";
    let artistUri = "";
    const artistLike = (t?.contributors ??
      t?.artists) as
      | Array<{ name?: string; uri?: string; profile?: { name?: string } }>
      | undefined;
    if (Array.isArray(artistLike) && artistLike.length > 0) {
      artist = artistLike
        .map((a) => a?.name ?? a?.profile?.name ?? "")
        .filter(Boolean)
        .join(", ");
      artistUri = artistLike[0]?.uri ?? "";
    }
    if (!artist) {
      const meta = t?.metadata as Record<string, string | undefined> | undefined;
      artist = meta?.artist_name ?? "";
      artistUri = meta?.artist_uri ?? "";
    }
    // Album intentionally omitted — RecentsAPI doesn't include usable album
    // URIs and the name-only subline isn't worth the visual noise.
    const album = "";
    const albumUri = "";
    // Album art: a few known locations
    const coverSources =
      (t?.album as { images?: unknown[]; coverArt?: { sources?: unknown } })
        ?.images ||
      (t?.album as { coverArt?: { sources?: unknown } })?.coverArt?.sources ||
      (t?.albumOfTrack as { coverArt?: { sources?: unknown } })?.coverArt
        ?.sources ||
      (t?.images as unknown);
    let art = extractArtUrl(coverSources);
    if (!art) {
      const meta = t?.metadata as Record<string, string | undefined> | undefined;
      art = meta?.image_small_url || meta?.image_url || "";
    }
    // Play timestamp. Different Spicetify builds expose this under
    // different keys — probe the common ones on both the wrapper and the
    // track, accepting either ms-epoch numbers or ISO strings. On this
    // build it's `addedAt: { timestamp: <ms> }`; older shapes store it
    // flat, so we probe both.
    const ts = any?.addedAt as { timestamp?: unknown } | undefined;
    const tsCandidates: unknown[] = [
      ts?.timestamp,
      any?.playedAt,
      any?.played_at,
      any?.addedAt,
      any?.added_at,
      any?.lastPlayedAt,
      any?.timestamp,
      t?.playedAt,
      t?.played_at,
      t?.lastPlayedAt,
      t?.timestamp,
    ];
    let playedAt = 0;
    for (const c of tsCandidates) {
      const n = parseTimestamp(c);
      if (n) {
        playedAt = n;
        break;
      }
    }
    return {
      uri,
      name,
      artist,
      artistUri,
      album,
      albumUri,
      art: toHttpUrl(art) || "",
      playedAt,
    };
  }

  async function tryOne(
    fn: () => Promise<unknown> | undefined,
  ): Promise<unknown> {
    const res = await fn();
    if (res == null) return null;
    const hasAnyArray = Object.values(res as object).some(Array.isArray);
    const isSubscription =
      !Array.isArray(res) &&
      ((res as { _emitter?: unknown })._emitter ||
        typeof (res as { cancel?: unknown }).cancel === "function");
    if (!hasAnyArray && isSubscription) return null;
    return res;
  }

  async function probeAttempts(
    attempts: Array<[string, () => Promise<unknown> | undefined]>,
  ): Promise<{ hit: string; fn: () => Promise<unknown> | undefined; raw: unknown } | null> {
    for (const [label, fn] of attempts) {
      try {
        const res = await tryOne(fn);
        if (res == null) continue;
        return { hit: label, fn, raw: res };
      } catch {
        // try next attempt
      }
    }
    return null;
  }

  type AnyApi = Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>;

  function apiOf(name: string): AnyApi | undefined {
    return (Spicetify.Platform as unknown as Record<string, unknown>)[name] as
      | AnyApi
      | undefined;
  }

  const RECENT_METHODS = [
    "getContents", // RecentsAPI
    "getRecentlyPlayed",
    "getRecents",
    "getItems",
    "getContextualItems",
    "getHistory",
    "getPlayHistory",
    "getState",
    "fetch",
  ];

  // Cache the winning probe so we don't re-run ~15 failing attempts each poll.
  let recentWinner: { label: string; fn: () => Promise<unknown> | undefined } | null = null;
  let friendsWinner: { label: string; fn: () => Promise<unknown> | undefined } | null = null;

  async function fetchRecent(): Promise<RecentItem[]> {
    const apiNames = ["RecentsAPI", "PlayHistoryAPI", "RecentlyPlayedAPI"];
    const attempts: Array<[string, () => Promise<unknown> | undefined]> = [];
    for (const n of apiNames) {
      const a = apiOf(n);
      if (!a) continue;
      for (const m of RECENT_METHODS) {
        if (typeof a[m] === "function") {
          // Try no-args variant first, then with limit
          attempts.push([`${n}.${m}()`, () => a[m]?.()]);
          attempts.push([`${n}.${m}(30)`, () => a[m]?.(30)]);
          attempts.push([`${n}.${m}({limit:30})`, () => a[m]?.({ limit: 30 })]);
        }
      }
    }

    let raw: unknown = null;
    if (recentWinner) {
      try {
        raw = await tryOne(recentWinner.fn);
      } catch {
        recentWinner = null;
      }
    }
    if (raw == null) {
      const hit = await probeAttempts(attempts);
      if (!hit) return [];
      recentWinner = { label: hit.hit, fn: hit.fn };
      raw = hit.raw;
    }

    const arr = pickArray(raw);
    if (!arr || arr.length === 0) return [];
    const out: RecentItem[] = [];
    for (const item of arr) {
      const n = normalizeRecentItem(item);
      if (n) out.push(n);
    }
    return out;
  }

  // Finds the first array we can identify in a common wrapper shape. Handles
  // nested Spotify "list page" responses where `items` is itself a paginated
  // container ({items: [...], totalCount}).
  function pickArray(res: unknown): unknown[] | null {
    if (Array.isArray(res)) return res as unknown[];
    if (!res || typeof res !== "object") return null;
    const o = res as Record<string, unknown>;
    const candidateKeys = [
      "items",
      "contents",
      "events",
      "tracks",
      "recents",
      "friends",
      "buddies",
      "activities",
    ];
    for (const k of candidateKeys) {
      const v = o[k];
      if (Array.isArray(v)) return v as unknown[];
      if (v && typeof v === "object") {
        const inner = pickArray(v);
        if (inner && inner.length > 0) return inner;
      }
    }
    // Wrapped under data/state/body (HTTP response envelope)
    for (const wrap of ["data", "state", "result", "body", "payload"]) {
      const w = o[wrap];
      if (w && typeof w === "object") {
        const inner = pickArray(w);
        if (inner) return inner;
      }
    }
    return null;
  }

  function renderSimpleList(
    container: HTMLElement,
    items: Array<{
      uri: string;
      name: string;
      artist: string;
      artistUri?: string;
      album?: string;
      albumUri?: string;
      art: string;
      // Plain-text extra segment appended to the subline (e.g. "5m ago").
      subExtra?: string;
    }>,
    emptyMsg: string,
  ): void {
    if (items.length === 0) {
      container.innerHTML = `<div class="crp-empty">${escapeHtml(emptyMsg)}</div>`;
      return;
    }
    container.innerHTML = items
      .map((t, i) => {
        const artist = t.artist ? linkHtml(t.artistUri, t.artist) : "";
        const album = t.album ? linkHtml(t.albumUri, t.album) : "";
        const extra = t.subExtra ? escapeHtml(t.subExtra) : "";
        const sub = [artist, album, extra].filter(Boolean).join(" · ");
        return `
        <div class="crp-list-row" data-idx="${i}" data-uri="${escapeHtml(t.uri)}">
          <div class="crp-list-art" style="background-image: url('${t.art}');"></div>
          <div class="crp-list-info">
            ${linkHtml(t.uri, t.name, "crp-list-name")}
            <span class="crp-list-sub">${sub}</span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // One-time delegated click handler for a Recent/simple list container.
  // Link clicks inside the row navigate; row background plays the track.
  function wireSimpleListDelegation(container: HTMLElement): void {
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("a.crp-link")) return;
      const row = target.closest<HTMLElement>(".crp-list-row");
      const uri = row?.dataset.uri;
      if (uri) Spicetify.Player.playUri(uri);
    });
  }

  let lastRecentKey = "";
  async function refreshRecent(force = false): Promise<void> {
    if (!panelEl) return;
    const container = panelEl.querySelector<HTMLElement>(".crp-recent-list");
    if (!container) return;
    const list = await fetchRecent();
    const key = list.map((t) => t.uri).join("|");
    if (!force && key === lastRecentKey) return;
    lastRecentKey = key;
    const rows = list.map((t) => ({ ...t, subExtra: relTime(t.playedAt) }));
    renderSimpleList(container, rows, "No recent tracks");
  }

  // ==================== Friends tab ====================

  interface FriendActivity {
    userName: string;
    userUri: string;
    avatarUrl: string;
    trackUri: string;
    trackName: string;
    artist: string;
    artistUri: string;
    album: string;
    albumUri: string;
    context: string;
    contextUri: string;
    timestamp: number;
    isPlaying: boolean;
  }

  function timeAgo(ms: number): string {
    if (!ms) return "";
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Top-level BuddyFeedAPI.fetchFriendActivity* methods are skipped — they
  // throw (undefined[0]) or return subscription handles with no payload.
  // Rely on sub-object state-readers (presenceView.getBuddyFeed) instead.
  const FRIENDS_METHODS = [
    "getBuddyFeed",
    "getBuddies",
    "getFriends",
    "getFriendActivity",
    "getItems",
    "getState",
    "fetch",
  ];

  async function fetchFriends(): Promise<FriendActivity[]> {
    const apiNames = ["BuddyFeedAPI", "SocialConnectAPI"];
    const buddy = apiOf("BuddyFeedAPI") as Record<string, unknown> | undefined;
    const attempts: Array<[string, () => Promise<unknown> | undefined]> = [];

    // Sub-object state-readers first — presenceView.getBuddyFeed() is the
    // confirmed winner on this build; others are cheap if-present probes.
    for (const prop of ["presenceView", "presence2", "batchAPI"]) {
      const obj = buddy?.[prop] as Record<string, unknown> | undefined;
      if (!obj) continue;
      for (const m of [
        "getBuddyFeed",
        "getFriendActivity",
        "getState",
        "getData",
        "getItems",
        "getCurrentState",
        "fetch",
        "read",
      ]) {
        if (typeof obj[m] === "function") {
          attempts.push([
            `BuddyFeedAPI.${prop}.${m}()`,
            () => (obj[m] as (...a: unknown[]) => Promise<unknown>)?.(),
          ]);
        }
      }
    }
    // Top-level API methods as fallback
    for (const n of apiNames) {
      const a = apiOf(n);
      if (!a) continue;
      for (const m of FRIENDS_METHODS) {
        if (typeof a[m] === "function") {
          attempts.push([`${n}.${m}()`, () => a[m]?.()]);
        }
      }
    }
    // Deliberately skipping subscribeToBuddyActivity and
    // fetchFriendActivityWithSubscriptions(cb) — they either duplicate an
    // already-active subscription (no callback fires) or URL-encode our
    // callback as a user-id path segment (404s).

    let rawRes: unknown = null;
    if (friendsWinner) {
      try {
        rawRes = await tryOne(friendsWinner.fn);
      } catch {
        friendsWinner = null;
      }
    }
    if (rawRes == null) {
      const hit = await probeAttempts(attempts);
      if (!hit) return [];
      friendsWinner = { label: hit.hit, fn: hit.fn };
      rawRes = hit.raw;
    }

    const raw = pickArray(rawRes);
    if (!raw || raw.length === 0) return [];

    const out: FriendActivity[] = [];
    for (const entry of raw) {
      const f = entry as Record<string, unknown>;
      const user = (f?.user as Record<string, unknown>) || {};
      const track = (f?.track as Record<string, unknown>) || {};
      const album = (track?.album as Record<string, unknown>) || {};
      const context = (f?.context as Record<string, unknown>) ||
        (track?.context as Record<string, unknown>) ||
        {};
      const timestamp = (f?.timestamp as number) ?? 0;
      const artistObj = track?.artist as { name?: string; uri?: string } | undefined;
      const artistsArr = track?.artists as Array<{ name?: string; uri?: string }> | undefined;
      const artistName = artistObj?.name ||
        (artistsArr?.map((a) => a?.name ?? "").filter(Boolean).join(", ") ?? "");
      const artistUri = artistObj?.uri || artistsArr?.[0]?.uri || "";
      out.push({
        userName:
          (user?.name as string) ||
          (user?.displayName as string) ||
          "Unknown",
        userUri: (user?.uri as string) || "",
        avatarUrl: toHttpUrl((user?.imageUrl as string) || "") || "",
        trackUri: (track?.uri as string) || "",
        trackName: (track?.name as string) || "",
        artist: artistName,
        artistUri,
        album: (album?.name as string) || "",
        albumUri: (album?.uri as string) || "",
        context: (context?.name as string) || (album?.name as string) || "",
        contextUri: (context?.uri as string) || (album?.uri as string) || "",
        timestamp,
        isPlaying: timestamp === 0 || Date.now() - timestamp < 30000,
      });
    }
    out.reverse();
    return out;
  }

  function renderFriends(list: FriendActivity[]): void {
    if (!panelEl) return;
    const container = panelEl.querySelector<HTMLElement>(".crp-friends-list");
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML =
        '<div class="crp-empty">No friend activity</div>';
      return;
    }
    container.innerHTML = list
      .map((f, i) => {
        const track = linkHtml(f.trackUri, f.trackName);
        const artist = f.artist ? linkHtml(f.artistUri, f.artist) : "";
        const context = f.context ? linkHtml(f.contextUri, f.context) : "";
        const userName = linkHtml(f.userUri, f.userName, "crp-friend-name");
        const trackLine = [track, artist].filter(Boolean).join(" · ");
        const meta = f.isPlaying ? "listening now" : escapeHtml(timeAgo(f.timestamp));
        const contextLine = context ? `${meta} · ${context}` : meta;
        return `
        <div class="crp-friend-row" data-idx="${i}" data-uri="${escapeHtml(f.trackUri)}">
          <div class="crp-friend-avatar"${f.avatarUrl ? ` style="background-image: url('${f.avatarUrl}');"` : ""}>
            ${f.isPlaying ? '<span class="crp-friend-dot"></span>' : ""}
          </div>
          <div class="crp-friend-info">
            ${userName}
            <div class="crp-friend-track">${trackLine}</div>
            <div class="crp-friend-context">${contextLine}</div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function wireFriendsDelegation(container: HTMLElement): void {
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("a.crp-link")) return;
      const row = target.closest<HTMLElement>(".crp-friend-row");
      const uri = row?.dataset.uri;
      if (uri) Spicetify.Player.playUri(uri);
    });
  }

  let lastFriendsKey = "";
  async function refreshFriends(force = false): Promise<void> {
    const list = await fetchFriends();
    const key = list
      .map((f) => `${f.userUri}:${f.trackUri}:${f.timestamp}`)
      .join("|");
    if (!force && key === lastFriendsKey) return;
    lastFriendsKey = key;
    renderFriends(list);
  }

  // ==================== Injection ====================

  function inject(): void {
    if (document.getElementById("custom-right-panel")) return;
    const sidebar = document.querySelector<HTMLElement>(".Root__right-sidebar");
    if (!sidebar) return;
    panelEl = build();
    sidebar.appendChild(panelEl);
    // Wire list-container event delegation once per panel lifetime. With
    // hundreds of rows, per-row listeners would add up fast — all row
    // interactions below go through these single handlers.
    const queueList = panelEl.querySelector<HTMLElement>(".crp-queue-list");
    const recentList = panelEl.querySelector<HTMLElement>(".crp-recent-list");
    const friendsList = panelEl.querySelector<HTMLElement>(".crp-friends-list");
    if (queueList) wireQueueDelegation(queueList);
    if (recentList) wireSimpleListDelegation(recentList);
    if (friendsList) wireFriendsDelegation(friendsList);
    syncTrackInfo();
    syncPlayPause();
    syncShuffleRepeat();
    syncVolume();
    syncLikeState();
    setActiveTab(activeTab);
    // Re-populate tabs after re-inject (React may wipe our subtree).
    lastQueueKey = "";
    lastRecentKey = "";
    lastFriendsKey = "";
    refreshQueue(true);
    refreshRecent(true);
    refreshFriends(true);
  }

  // Spotify React may wipe the sidebar tree; re-inject when that happens.
  window.setInterval(() => {
    const existing = document.getElementById("custom-right-panel");
    if (!existing) {
      inject();
    } else if (!existing.isConnected) {
      panelEl = null;
      inject();
    }
  }, 500);

  inject();

  Spicetify.Player.addEventListener("songchange", () => {
    syncTrackInfo();
    syncLikeState();
    refreshQueue();
    refreshRecent();
    // Spotify's recents can lag the songchange event by a couple seconds —
    // retry so the just-finished track lands in the list.
    window.setTimeout(() => refreshRecent(true), 2000);
  });
  Spicetify.Player.addEventListener("onplaypause", syncPlayPause);

  // Pick up likes/unlikes from other surfaces (now-playing-bar, context menu,
  // other clients). If the library events API isn't present, fall back to
  // the post-toggle re-sync we already do.
  libraryApi()?.getEvents?.()?.addListener?.("update", syncLikeState);
  startProgressLoop();
  refreshQueue();
  refreshRecent();
  refreshFriends();
  window.setInterval(refreshQueue, 2000);
  window.setInterval(refreshRecent, 30000);
  window.setInterval(refreshFriends, 30000);

  // Spicetify's onshuffleupdate/onrepeatupdate events are unreliable — poll
  // instead. Also catches volume changes from external sources (media keys).
  let lastShuffle: boolean | null = null;
  let lastRepeat: number | null = null;
  let lastVolume = -1;
  window.setInterval(() => {
    const sh = readShuffle();
    const rp = readRepeat();
    if (sh !== lastShuffle || rp !== lastRepeat) {
      lastShuffle = sh;
      lastRepeat = rp;
      syncShuffleRepeat();
    }
    const v = Spicetify.Player.getVolume();
    if (Math.abs(v - lastVolume) > 0.005) {
      lastVolume = v;
      syncVolume();
    }
  }, 500);

  document.addEventListener("crp-switch-tab", (e: Event) => {
    const detail = (e as CustomEvent).detail as TabId | undefined;
    if (detail) setActiveTab(detail);
  });

})();
