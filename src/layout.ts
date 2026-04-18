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

  function injectLyricsSlot(): void {
    if (document.getElementById("lyrics-slot")) return;
    const mainView = document.querySelector(".Root__main-view");
    if (!mainView) return;
    const slot = document.createElement("div");
    slot.id = "lyrics-slot";
    mainView.appendChild(slot);
  }

  window.setInterval(injectLyricsSlot, 500);
  injectLyricsSlot();

  // Fade artist/album/profile banner on scroll. OverlayScrollbars virtualizes
  // the main-view scroll so CSS scroll-timeline can't see it. Listen to ALL
  // scroll events via capture phase; whichever element actually scrolls, we
  // use its scrollTop to compute header opacity.
  // The artist page paints its banner onto a hashed-class div with inline
  // background-image — not on .main-entityHeader-container. Find any element
  // inside the main view (not sidebars) that has an inline bg image, is wide
  // enough to be a banner, and sits near the top of the scroll container.
  function findBanner(): HTMLElement | null {
    const mainView = document.querySelector<HTMLElement>(".Root__main-view");
    if (!mainView) return null;
    const candidates = mainView.querySelectorAll<HTMLElement>(
      '[style*="background-image"]',
    );
    for (const el of candidates) {
      const style = el.getAttribute("style") || "";
      if (!/url\(/i.test(style)) continue;
      if (/placeholder|gradient/i.test(style)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width >= 200 && rect.height >= 100 && rect.top < 400) {
        return el;
      }
    }
    return null;
  }

  function applyHeaderFade(scrollEl: HTMLElement): void {
    const banner = findBanner();
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

  // Detect Spotify's own lyrics view component rather than matching URL —
  // /lyrics redirects on this build, so pathname never matches. When Spotify
  // renders .lyrics-lyrics-container anywhere, treat as lyrics mode and let
  // CSS hide its content so #lyrics-slot takes over.
  function updateLyricsRoute(): void {
    const onLyrics = !!document.querySelector(".lyrics-lyrics-container");
    document.body.classList.toggle("on-lyrics-route", onLyrics);
  }
  updateLyricsRoute();
  window.setInterval(updateLyricsRoute, 200);
  Spicetify.Platform.History.listen?.(updateLyricsRoute);
})();
