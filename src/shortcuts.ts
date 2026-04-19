(async function shortcuts() {
  while (!Spicetify?.Player || !Spicetify?.Platform?.History) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const OFFSET_STEP_MS = 50;
  const TOAST_MS = 1500;

  const w = window as unknown as { __lyricsOffsetMs?: number };
  if (typeof w.__lyricsOffsetMs !== "number") w.__lyricsOffsetMs = 0;


  // ==================== Help modal ====================

  const BINDINGS: Array<{ keys: string; desc: string }> = [
    { keys: "F1", desc: "Show this help" },
    { keys: "F2", desc: "Toggle lyrics view" },
    { keys: "Ctrl/⌘ + K", desc: "Command palette" },
    { keys: "Ctrl/⌘ + 1 / 2 / 3", desc: "Switch right-panel tab" },
    { keys: "Ctrl/⌘ + Shift + A", desc: "Go to artist of current track" },
    { keys: "Ctrl/⌘ + Shift + B", desc: "Go to album of current track" },
    { keys: "[ / ]", desc: "Nudge lyrics timing by ±50ms" },
    { keys: "Space", desc: "Play / pause (native)" },
    { keys: "Ctrl/⌘ + ← / →", desc: "Prev / next track (native)" },
    { keys: "Ctrl/⌘ + ↑ / ↓", desc: "Volume (native)" },
    { keys: "Ctrl/⌘ + Shift + ← / →", desc: "Seek (native)" },
    { keys: "Ctrl/⌘ + L", desc: "Like track (native)" },
    { keys: "Ctrl/⌘ + R", desc: "Toggle repeat (native)" },
    { keys: "Ctrl/⌘ + S", desc: "Toggle shuffle (native)" },
  ];

  let helpEl: HTMLElement | null = null;

  function buildHelp(): void {
    helpEl = document.createElement("div");
    helpEl.id = "shortcut-help";
    helpEl.className = "shortcut-help hidden";
    const rows = BINDINGS.map(
      (b) =>
        `<div class="shortcut-row"><span class="shortcut-keys">${b.keys}</span><span class="shortcut-desc">${b.desc}</span></div>`,
    ).join("");
    helpEl.innerHTML = `
      <div class="shortcut-backdrop"></div>
      <div class="shortcut-modal">
        <div class="shortcut-title">Keyboard shortcuts</div>
        <div class="shortcut-list">${rows}</div>
        <div class="shortcut-hint">F1 or Esc to close</div>
      </div>
    `;
    document.body.appendChild(helpEl);
    helpEl
      .querySelector<HTMLElement>(".shortcut-backdrop")
      ?.addEventListener("click", hideHelp);
  }

  function showHelp(): void {
    helpEl?.classList.remove("hidden");
  }
  function hideHelp(): void {
    helpEl?.classList.add("hidden");
  }
  function toggleHelp(): void {
    if (!helpEl) return;
    if (helpEl.classList.contains("hidden")) showHelp();
    else hideHelp();
  }
  function isHelpOpen(): boolean {
    return !!helpEl && !helpEl.classList.contains("hidden");
  }

  // ==================== Toast ====================

  let toastEl: HTMLElement | null = null;
  let toastTimer: number | null = null;

  function showToast(msg: string): void {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "shortcut-toast";
      toastEl.className = "shortcut-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("visible");
    if (toastTimer != null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl?.classList.remove("visible");
    }, TOAST_MS);
  }

  // ==================== Actions ====================

  function uriToPath(uri: string): string {
    return uri.replace(/^spotify:/, "/").replace(/:/g, "/");
  }

  function hasMainViewLyrics(): boolean {
    return !!document.querySelector(".Root__main-view .lyrics-lyrics-container");
  }

  function toggleLyrics(): void {
    // Detect via DOM (instant) rather than body class (up to 200ms poll lag)
    const onLyrics = hasMainViewLyrics();
    if (onLyrics) {
      // Spotify's push("/lyrics") may create multiple history entries (the
      // push + an internal redirect), so one back() leaves us on the middle
      // entry which still renders lyrics. Keep going back until the container
      // is actually gone, capped at 3 tries.
      const tryBack = (remaining: number): void => {
        if (!hasMainViewLyrics()) return;
        if (remaining <= 0) {
          // Fallback if back chain didn't exit
          Spicetify.Platform.History.push("/");
          return;
        }
        window.history.back();
        window.setTimeout(() => tryBack(remaining - 1), 120);
      };
      tryBack(3);
    } else {
      Spicetify.Platform.History.push("/lyrics");
    }
  }

  function jumpToArtist(): void {
    const uri = Spicetify.Player.data?.item?.metadata?.artist_uri;
    if (!uri) {
      showToast("No artist for current track");
      return;
    }
    Spicetify.Platform.History.push(uriToPath(uri));
  }

  function jumpToAlbum(): void {
    const uri = Spicetify.Player.data?.item?.metadata?.album_uri;
    if (!uri) {
      showToast("No album for current track");
      return;
    }
    Spicetify.Platform.History.push(uriToPath(uri));
  }

  function nudgeOffset(deltaMs: number): void {
    w.__lyricsOffsetMs = (w.__lyricsOffsetMs ?? 0) + deltaMs;
    const val = w.__lyricsOffsetMs;
    const sign = val > 0 ? "+" : "";
    showToast(`Lyrics offset: ${sign}${val}ms`);
  }

  // ==================== Dispatch ====================

  function shouldIgnoreEvent(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (t.isContentEditable) return true;
    // Command palette input is an <input>, caught above, but double-guard:
    const palette = document.getElementById("command-palette");
    if (palette && !palette.classList.contains("hidden")) return true;
    return false;
  }

  document.addEventListener(
    "keydown",
    (e) => {
      // Esc closes help even while in inputs (nothing else listens for it here)
      if (e.key === "Escape" && isHelpOpen()) {
        e.preventDefault();
        hideHelp();
        return;
      }

      if (shouldIgnoreEvent(e)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "F1") {
        e.preventDefault();
        toggleHelp();
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        toggleLyrics();
        return;
      }

      if (mod && e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "a") {
          e.preventDefault();
          jumpToArtist();
          return;
        }
        if (k === "b") {
          e.preventDefault();
          jumpToAlbum();
          return;
        }
      }

      if (mod && !e.shiftKey && !e.altKey) {
        const tabForKey: Record<string, "queue" | "recent" | "friends"> = {
          "1": "queue",
          "2": "recent",
          "3": "friends",
        };
        const tab = tabForKey[e.key];
        if (tab) {
          e.preventDefault();
          document.dispatchEvent(
            new CustomEvent("crp-switch-tab", { detail: tab }),
          );
          return;
        }
      }

      // Bare bracket keys — no mod, no shift. Don't swallow Ctrl+[ etc.
      if (!mod && !e.shiftKey && !e.altKey) {
        if (e.key === "[") {
          e.preventDefault();
          nudgeOffset(-OFFSET_STEP_MS);
          return;
        }
        if (e.key === "]") {
          e.preventDefault();
          nudgeOffset(OFFSET_STEP_MS);
          return;
        }
      }
    },
    true,
  );

  buildHelp();

  document.addEventListener("toggle-lyrics", toggleLyrics);
})();
