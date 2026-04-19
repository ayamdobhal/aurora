import {
  getMainView,
  getMainViewBanner,
  getSpotifyLyricsContainer,
  maintainInjection,
  onSubtreeMutation,
} from "./lib/resolvers";

(async function layout() {
  while (!Spicetify?.Player || !Spicetify?.Platform?.History) {
    await new Promise((r) => setTimeout(r, 100));
  }

  function syncPlaybackState(): void {
    const isPaused = Spicetify.Player.data?.isPaused ?? true;
    document.body.classList.toggle("playback-paused", isPaused);
  }

  Spicetify.Player.addEventListener("onplaypause", syncPlaybackState);
  syncPlaybackState();

  // Keep #lyrics-slot mounted inside the main view. React re-renders can
  // wipe our subtree at any time; maintainInjection re-mounts on the next
  // frame via a MutationObserver instead of busy-polling.
  maintainInjection({
    target: getMainView,
    exists: () => document.getElementById("lyrics-slot"),
    mount: (mainView) => {
      const slot = document.createElement("div");
      slot.id = "lyrics-slot";
      mainView.appendChild(slot);
    },
  });

  // Fade artist/album/profile banner on scroll. OverlayScrollbars virtualizes
  // the main-view scroll so CSS scroll-timeline can't see it. Listen to ALL
  // scroll events via capture phase; whichever element actually scrolls, we
  // use its scrollTop to compute header opacity. Banner lookup delegates to
  // resolvers (heuristic over inline bg-image styles near the top).
  function applyHeaderFade(scrollEl: HTMLElement): void {
    const banner = getMainViewBanner();
    if (!banner) return;
    const range = Math.max(1, window.innerHeight * 0.4);
    const opacity = Math.max(0, 1 - (scrollEl.scrollTop || 0) / range);
    banner.style.setProperty("opacity", String(opacity), "important");
  }
  document.addEventListener(
    "scroll",
    (e) => {
      const target = e.target as HTMLElement | Document | null;
      if (!target || !(target instanceof HTMLElement)) return;
      applyHeaderFade(target);
    },
    true,
  );

  // Detect Spotify's own lyrics view mounted inside the main view rather
  // than matching URL — /lyrics redirects on this build, so pathname never
  // matches. A subtree observer catches mount/unmount, plus we still hook
  // History.listen for the case where a navigation precedes the DOM change.
  function updateLyricsRoute(): void {
    document.body.classList.toggle(
      "on-lyrics-route",
      !!getSpotifyLyricsContainer(),
    );
  }
  updateLyricsRoute();
  onSubtreeMutation(document.body, updateLyricsRoute);
  Spicetify.Platform.History.listen?.(updateLyricsRoute);
})();
