import {
  getFriendActivityButton,
  onSubtreeMutation,
} from "./lib/resolvers";

(async function topBar() {
  while (!Spicetify?.Player) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const MARK_ATTR = "data-lyrics-btn";

  function lyricsIconInner(): string {
    return (
      Spicetify.SVGIcons?.["lyrics"] ??
      '<path d="M13.426 2.574a2.831 2.831 0 0 0-4.797 1.55l3.247 3.247a2.831 2.831 0 0 0 1.55-4.797zM10.5 8.118l-2.619-2.62A63303.13 63303.13 0 0 0 4.74 9.075L2.065 12.12a1.287 1.287 0 0 0 1.816 1.816l3.06-2.688 3.56-3.129zM7.12 4.094a4.331 4.331 0 1 1 4.786 4.786l-3.974 3.492-3.06 2.688a2.787 2.787 0 0 1-3.933-3.933l2.676-3.045 3.505-3.988z"/>'
    );
  }

  function onClickToggle(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent("toggle-lyrics"));
  }

  function swapButton(btn: HTMLButtonElement): void {
    // Clone to drop React-managed listeners, then mount the clone in place.
    const clone = btn.cloneNode(true) as HTMLButtonElement;
    clone.setAttribute(MARK_ATTR, "1");
    clone.setAttribute("aria-label", "Toggle lyrics");
    clone.setAttribute("title", "Toggle lyrics (F2)");

    // Preserve the original <svg>'s attributes (width/height/class) so the
    // icon sits at the exact size Spotify uses for sibling buttons. Replace
    // only its inner path content, and force the viewBox to match our path.
    const existingSvg = clone.querySelector("svg");
    if (existingSvg) {
      existingSvg.setAttribute("viewBox", "0 0 16 16");
      existingSvg.innerHTML = lyricsIconInner();
    } else {
      clone.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">${lyricsIconInner()}</svg>`;
    }

    clone.addEventListener("click", onClickToggle);
    btn.replaceWith(clone);
    syncActive(clone);
  }

  function syncActive(btn: HTMLElement): void {
    const active = document.body.classList.contains("on-lyrics-route");
    btn.classList.toggle("lyrics-btn-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function ensureSwapped(): void {
    const existing = document.querySelector<HTMLElement>(`[${MARK_ATTR}="1"]`);
    if (existing && existing.isConnected) {
      syncActive(existing);
      return;
    }
    const btn = getFriendActivityButton();
    if (btn) swapButton(btn);
  }

  // Spotify re-renders the top bar — watch for any DOM change (rAF-throttled)
  // and re-swap when our clone disappears. Replaces the old 500ms polling.
  ensureSwapped();
  onSubtreeMutation(document.body, ensureSwapped);

  // Narrow observer for body class changes — active state depends on the
  // `on-lyrics-route` class that layout.ts toggles. Distinct from the
  // subtree observer above; attribute mutations wouldn't fire on childList.
  const classObs = new MutationObserver(() => {
    const el = document.querySelector<HTMLElement>(`[${MARK_ATTR}="1"]`);
    if (el) syncActive(el);
  });
  classObs.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
})();
