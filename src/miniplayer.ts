import { mountLyricsView } from "./lib/lyrics-view";
import { preferences, savePreferences } from "./lib/preferences";
import { wireSlider, syncTabs } from "./lib/accessibility";
// Custom miniplayer powered by the Document Picture-in-Picture API.
// `documentPictureInPicture.requestWindow(...)` returns a real, OS-level
// detachable window that the user can drag anywhere — unlike Spotify's own
// built-in miniplayer, this one's DOM is ours, so we can mount our own
// track info + controls + Lyrics/Queue tabs inside it and theme it with
// our user.css by cloning <link> and <style> nodes into its head.
//
// The PIP window runs in the same JS realm as the parent (it's a child
// document of our renderer). Event handlers we attach in PIP DOM can call
// `Spicetify.Player.*` directly via closure — no postMessage plumbing.
//
// Fallback: if the host Electron build is too old for documentPIP, we
// click Spotify's native miniplayer button instead of showing nothing.

import { setTextIfChanged } from "./lib/dom";
import { getMiniplayerButton } from "./lib/resolvers";

(async function miniplayer() {
  while (!Spicetify?.Player?.addEventListener || !Spicetify?.Player?.data) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // ==================== Icons / formatting ====================

  const FALLBACK_ICONS: Record<string, string> = {
    play: '<path d="M3 1.5v13l11-6.5z"/>',
    pause:
      '<path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/>',
    "skip-back":
      '<path d="M3.3 1a.7.7 0 0 1 .7.7v5.4l8.4-5.6a1 1 0 0 1 1.6.8v11.4a1 1 0 0 1-1.6.8L4 8.9v5.4a.7.7 0 1 1-1.4 0V1.7a.7.7 0 0 1 .7-.7z"/>',
    "skip-forward":
      '<path d="M12.7 1a.7.7 0 0 0-.7.7v5.4L3.6 1.5A1 1 0 0 0 2 2.3v11.4a1 1 0 0 0 1.6.8L12 8.9v5.4a.7.7 0 1 0 1.4 0V1.7a.7.7 0 0 0-.7-.7z"/>',
    "chevron-down":
      '<path d="M14 5.5l-6 6-6-6 1-1 5 5 5-5z"/>',
    "chevron-up":
      '<path d="M14 10.5l-6-6-6 6 1 1 5-5 5 5z"/>',
    x:
      '<path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z"/>',
  };

  function icon(name: string): string {
    const inner = Spicetify.SVGIcons?.[name] ?? FALLBACK_ICONS[name] ?? "";
    return `<svg viewBox="0 0 16 16" fill="currentColor">${inner}</svg>`;
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

  function fmtTime(ms: number): string {
    if (!isFinite(ms) || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  // ==================== PIP window state ====================

  type DocPiP = {
    requestWindow(init: { width: number; height: number }): Promise<Window>;
  };

  let pipWin: Window | null = null;
  let opening = false;
  let themeObserver: MutationObserver | null = null;
  let pipRoot: HTMLElement | null = null;
  let rafId: number | null = null;
  let seeking = false;
  let activeTab: "lyrics" | "queue" = preferences().miniTab;
  // Panel expanded state persists across PIP open/close in memory so a
  // user who prefers the compact-only view doesn't have to re-collapse
  // every time they reopen the miniplayer.
  let panelExpanded = preferences().miniExpanded;
  let lyricsView: ReturnType<typeof mountLyricsView> | null = null;

  function isOpen(): boolean {
    return !!pipWin && !pipWin.closed;
  }

  // ==================== Open / close ====================

  async function openPip(): Promise<void> {
    // @ts-expect-error — documentPictureInPicture is not in standard lib.dom.
    const docPiP = window.documentPictureInPicture as DocPiP | undefined;
    if (!docPiP || typeof docPiP.requestWindow !== "function") {
      // Fall back to Spotify's native miniplayer — still a real window,
      // just not themeable and no Lyrics/Queue tabs.
      getMiniplayerButton()?.click();
      return;
    }

    if (opening || isOpen()) return;
    opening = true;
    try {
      pipWin = await docPiP.requestWindow({ width: 360, height: 560 });
    } catch {
      getMiniplayerButton()?.click();
      return;
    } finally {
      opening = false;
    }

    // Clone relevant <link rel="stylesheet"> and every <style> element from
    // the parent into the PIP head. This pulls in our user.css (theme +
    // miniplayer styles) along with Spotify's own encore styles. Copying
    // nodes — instead of re-declaring rules — means any future theme tweak
    // is automatically picked up on the next PIP open.
    for (const el of Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style'),
    )) {
      pipWin.document.head.appendChild(el.cloneNode(true));
    }

    // Dynamic theme values are inline on the parent root, not in stylesheets.
    const syncTheme = (): void => {
      if (!pipWin) return;
      const source = document.documentElement.style;
      const target = pipWin.document.documentElement.style;
      for (const name of Array.from(target)) {
        if (name.startsWith("--") && !source.getPropertyValue(name))
          target.removeProperty(name);
      }
      for (const name of Array.from(source)) {
        if (name.startsWith("--"))
          target.setProperty(name, source.getPropertyValue(name), source.getPropertyPriority(name));
      }
      pipWin.document.body.classList.toggle("playback-paused", Spicetify.Player.data?.isPaused ?? true);
    };
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

    pipWin.document.documentElement.lang = "en";
    pipWin.document.title = "Miniplayer";
    // Give the PIP document body our theme's base (dark bg + blur) by
    // reusing the `encore-dark-theme` class hook Spotify uses, plus our
    // miniplayer root class. body element is a fresh one in PIP, so we
    // set it up explicitly rather than cloning the parent body.
    pipWin.document.body.className = "encore-dark-theme mp-pip-body";
    pipWin.document.body.style.margin = "0";
    pipWin.document.body.style.background = "rgba(20, 20, 20, 0.85)";
    syncTheme();
    pipWin.document.body.innerHTML = buildHtml();
    pipRoot = pipWin.document.body.querySelector<HTMLElement>("#mini-player");

    if (pipRoot) {
      wireControls(pipRoot);
      wireTabs(pipRoot);
      syncAll();
      setActiveTab(activeTab);
      startProgressLoop();
    }

    // Cleanup on user close (clicking the OS close button or closing via
    // the API). pagehide beats unload for PIP windows since the spec
    // fires pagehide on normal close.
    pipWin.addEventListener("pagehide", onPipClosed);
  }

  function onPipClosed(): void {
    stopProgressLoop();
    themeObserver?.disconnect();
    themeObserver = null;
    seeking = false;
    pipWin = null;
    pipRoot = null;
    lyricsView?.dispose(); lyricsView = null;
  }

  function closePip(): void {
    if (!pipWin) return;
    try {
      pipWin.close();
    } catch {
      // already closed — pagehide will have fired
    }
    onPipClosed();
  }

  function toggle(): void {
    if (isOpen()) closePip();
    else void openPip();
  }

  // ==================== HTML template ====================

  function buildHtml(): string {
    const expandedClass = panelExpanded ? "expanded" : "collapsed";
    // Icon reads as the *action* the button will take:
    // collapsed → chevron-down (expand down to reveal the panel below)
    // expanded  → chevron-up   (collapse up, hide the panel below)
    const chevron = panelExpanded ? "chevron-up" : "chevron-down";
    return `
      <div id="mini-player" class="mini-player ${expandedClass}">
        <button class="mp-close" aria-label="Close miniplayer">${icon("x")}</button>
        <div class="mp-compact">
          <div class="mp-art-wrap"><div class="mp-art"></div></div>
          <div class="mp-compact-right">
            <div class="mp-info">
              <div class="mp-title"></div>
              <div class="mp-artist"></div>
            </div>
            <div class="mp-seek">
              <span class="mp-time-elapsed">0:00</span>
              <div class="mp-seek-bar"><div class="mp-seek-fill"></div><div class="mp-seek-thumb"></div></div>
              <span class="mp-time-total">0:00</span>
            </div>
            <div class="mp-controls">
              <button class="mp-btn mp-prev" aria-label="Previous">${icon("skip-back")}</button>
              <button class="mp-btn mp-play-pause mp-primary" aria-label="Play/Pause">${icon("play")}</button>
              <button class="mp-btn mp-next" aria-label="Next">${icon("skip-forward")}</button>
            </div>
          </div>
          <button class="mp-toggle-panel" aria-label="Toggle tabs panel">${icon(chevron)}</button>
        </div>
        <div class="mp-panel">
          <div class="mp-tab-bar">
            <button class="mp-tab active" data-tab="lyrics">Lyrics</button>
            <button class="mp-tab" data-tab="queue">Queue</button>
          </div>
          <div class="mp-tab-content">
            <div class="mp-tab-pane active" data-pane="lyrics"></div>
            <div class="mp-tab-pane" data-pane="queue"></div>
          </div>
        </div>
      </div>
    `;
  }

  function togglePanel(): void {
    if (!pipRoot) return;
    panelExpanded = !panelExpanded;
    savePreferences({miniExpanded: panelExpanded});
    lyricsView?.refresh();
    pipRoot.classList.toggle("expanded", panelExpanded);
    pipRoot.classList.toggle("collapsed", !panelExpanded);
    const btn = pipRoot.querySelector<HTMLElement>(".mp-toggle-panel");
    if (btn) {
      btn.setAttribute("aria-expanded", String(panelExpanded));
      btn.innerHTML = icon(panelExpanded ? "chevron-up" : "chevron-down");
    }
    // Expanding loads the currently active tab's content if it hasn't
    // been rendered yet (e.g., first expand after open).
    if (panelExpanded) {
      if (activeTab === "lyrics") refreshLyrics();
      else refreshQueue();
    }
  }

  // ==================== Wiring ====================

  function wireControls(el: HTMLElement): void {
    el.querySelector(".mp-play-pause")?.addEventListener("click", () =>
      Spicetify.Player.togglePlay(),
    );
    el.querySelector(".mp-prev")?.addEventListener("click", () =>
      Spicetify.Player.back(),
    );
    el.querySelector(".mp-next")?.addEventListener("click", () =>
      Spicetify.Player.next(),
    );
    el.querySelector(".mp-toggle-panel")?.addEventListener("click", togglePanel);
    el.querySelector(".mp-close")?.addEventListener("click", closePip);

    const seekBar = el.querySelector<HTMLElement>(".mp-seek-bar");
    wireSlider(seekBar, "Playback position", () => Spicetify.Player.getProgress(), () => Spicetify.Player.getDuration(), n => {Spicetify.Player.seek(n); syncSeek();}, 5000);
    if (seekBar) {
      const seekFromEvent = (ev: MouseEvent): number => {
        const rect = seekBar.getBoundingClientRect();
        const frac = Math.max(
          0,
          Math.min(1, (ev.clientX - rect.left) / rect.width),
        );
        return frac * Spicetify.Player.getDuration();
      };
      // MouseMove/up must bind on the PIP document, not the parent — the
      // drag happens inside the PIP window. pipWin is captured via closure.
      seekBar.addEventListener("mousedown", (ev) => {
        seeking = true;
        updateSeekUI(seekFromEvent(ev), Spicetify.Player.getDuration());
        const doc = pipWin?.document ?? document;
        const onMove = (m: MouseEvent): void => {
          updateSeekUI(seekFromEvent(m), Spicetify.Player.getDuration());
        };
        const onUp = (m: MouseEvent): void => {
          doc.removeEventListener("mousemove", onMove);
          doc.removeEventListener("mouseup", onUp);
          Spicetify.Player.seek(Math.round(seekFromEvent(m)));
          seeking = false;
        };
        doc.addEventListener("mousemove", onMove);
        doc.addEventListener("mouseup", onUp);
      });
    }
  }

  function wireTabs(el: HTMLElement): void {
    el.querySelectorAll<HTMLElement>(".mp-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tab as "lyrics" | "queue" | undefined;
        if (id) setActiveTab(id);
      });
    });
  }

  function setActiveTab(id: "lyrics" | "queue"): void {
    if (!pipRoot) return;
    activeTab = id;
    savePreferences({miniTab: id});
    syncTabs(pipRoot, "mp", id);
    lyricsView?.refresh();
    pipRoot.querySelectorAll<HTMLElement>(".mp-tab").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === id);
    });
    pipRoot.querySelectorAll<HTMLElement>(".mp-tab-pane").forEach((el) => {
      el.classList.toggle("active", el.dataset.pane === id);
    });
    if (id === "lyrics") refreshLyrics();
    else refreshQueue();
  }

  // ==================== Sync from Spicetify.Player ====================

  function syncAll(): void {
    syncTrackInfo();
    syncPlayPause();
    syncSeek();
  }

  function syncTrackInfo(): void {
    if (!pipRoot) return;
    const track = Spicetify.Player.data?.item;
    const meta = track?.metadata || {};
    const cover = toHttpUrl(meta.image_large_url || meta.image_url) || "";
    const title = meta.title || track?.name || "";
    const artist = meta.artist_name || "";
    const artEl = pipRoot.querySelector<HTMLElement>(".mp-art");
    if (artEl) artEl.style.backgroundImage = cover ? `url('${cover}')` : "";
    const titleEl = pipRoot.querySelector<HTMLElement>(".mp-title");
    if (titleEl) titleEl.textContent = title;
    const artistEl = pipRoot.querySelector<HTMLElement>(".mp-artist");
    if (artistEl) artistEl.textContent = artist;
  }

  function syncPlayPause(): void {
    if (!pipRoot) return;
    const btn = pipRoot.querySelector<HTMLElement>(".mp-play-pause");
    if (!btn) return;
    const paused = Spicetify.Player.data?.isPaused ?? true;
    btn.innerHTML = icon(paused ? "play" : "pause");
    pipWin?.document.body.classList.toggle("playback-paused", paused);
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

  function updateSeekUI(posMs: number, durMs: number): void {
    if (!pipRoot) return;
    const pct = durMs > 0 ? Math.max(0, Math.min(1, posMs / durMs)) : 0;
    const fill = pipRoot.querySelector<HTMLElement>(".mp-seek-fill");
    const thumb = pipRoot.querySelector<HTMLElement>(".mp-seek-thumb");
    const elapsed = pipRoot.querySelector<HTMLElement>(".mp-time-elapsed");
    const total = pipRoot.querySelector<HTMLElement>(".mp-time-total");
    if (fill) fill.style.width = `${pct * 100}%`;
    if (thumb) thumb.style.left = `${pct * 100}%`;
    setTextIfChanged(elapsed, fmtTime(posMs));
    setTextIfChanged(total, fmtTime(durMs));
  }

  function syncSeek(): void {
    updateSeekUI(getAccurateProgress(), Spicetify.Player.getDuration());
  }

  function startProgressLoop(): void {
    if (rafId != null) return;
    const tick = (): void => {
      if (!seeking) syncSeek();
      rafId = null;
      if (isOpen() && !Spicetify.Player.data?.isPaused) rafId = (pipWin ?? window).requestAnimationFrame(tick);
    };
    rafId = (pipWin ?? window).requestAnimationFrame(tick);
  }

  function stopProgressLoop(): void {
    if (rafId != null) (pipWin ?? window).cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ==================== Lyrics tab ====================

  function refreshLyrics(): void {
    const pane = pipRoot?.querySelector<HTMLElement>('.mp-tab-pane[data-pane="lyrics"]');
    if (!pane) return;
    if (!lyricsView) lyricsView = mountLyricsView(pane, () => isOpen() && panelExpanded && activeTab === 'lyrics');
    else { void lyricsView.render(); lyricsView.refresh(); }
  }

  // ==================== Queue tab ====================

  type QueueTrack = { uri: string; name: string; artist: string; art: string };

  async function fetchQueue(): Promise<QueueTrack[]> {
    const platform = Spicetify.Platform as unknown as {
      PlayerAPI?: { getQueue?: () => Promise<unknown> };
    };
    const api = platform?.PlayerAPI;
    let raw: unknown[] = [];
    if (api?.getQueue) {
      try {
        const s = (await api.getQueue()) as Record<string, unknown>;
        const userQ = Array.isArray(s?.queued) ? (s.queued as unknown[]) : [];
        const nextUp = Array.isArray(s?.nextUp) ? (s.nextUp as unknown[]) : [];
        if (userQ.length || nextUp.length) raw = userQ.concat(nextUp);
        else if (Array.isArray(s?.nextTracks))
          raw = s.nextTracks as unknown[];
      } catch {
        // ignore
      }
    }
    const out: QueueTrack[] = [];
    for (const item of raw) {
      const n = normalizeQueueItem(item);
      if (n) out.push(n);
    }
    return out;
  }

  function normalizeQueueItem(item: unknown): QueueTrack | null {
    if (!item || typeof item !== "object") return null;
    const it = item as Record<string, unknown>;
    const contextTrack = (it.contextTrack as Record<string, unknown>) || it;
    const uri = (contextTrack.uri as string) || (it.uri as string) || "";
    if (!uri || !uri.startsWith("spotify:track:")) return null;
    const meta =
      ((contextTrack.metadata as Record<string, string>) ||
        (it.metadata as Record<string, string>) ||
        {}) as Record<string, string>;
    const name = meta.title || (it.name as string) || "";
    const artist = meta.artist_name || "";
    const art = toHttpUrl(meta.image_small_url || meta.image_url) || "";
    return { uri, name, artist, art };
  }

  async function refreshQueue(): Promise<void> {
    if (!pipRoot) return;
    const pane = pipRoot.querySelector<HTMLElement>('.mp-tab-pane[data-pane="queue"]');
    if (!pane) return;
    const list = await fetchQueue();
    if (!pipRoot?.contains(pane)) return;
    if (list.length === 0) {
      pane.innerHTML = '<div class="mp-empty">Queue is empty</div>';
      return;
    }
    pane.innerHTML = `<div class="mp-queue-list">${list
      .map(
        (t) => `
          <div class="mp-queue-row">
            <div class="mp-queue-art" style="background-image: url('${t.art}');"></div>
            <div class="mp-queue-info">
              <div class="mp-queue-name">${escapeHtml(t.name)}</div>
              <div class="mp-queue-sub">${escapeHtml(t.artist)}</div>
            </div>
          </div>`,
      )
      .join("")}</div>`;
  }

  // ==================== Player subscriptions ====================

  Spicetify.Player.addEventListener("songchange", () => {
    if (!isOpen()) return;
    syncTrackInfo();
    syncSeek();
    if (activeTab === "lyrics") refreshLyrics();
    else refreshQueue();
  });

  Spicetify.Player.addEventListener("onplaypause", () => {
    if (isOpen()) { syncPlayPause(); syncSeek(); startProgressLoop(); }
  });

  Spicetify.Player.addEventListener("onprogress", () => {if (isOpen() && !seeking) syncSeek();});

  // ==================== External toggle ====================

  document.addEventListener("toggle-miniplayer", toggle);
})();
