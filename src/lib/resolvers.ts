// Single source of truth for every Spotify-DOM anchor and React-internal lookup.
//
// Philosophy: Spotify's desktop client hashes its class names (`.abc123__def`)
// and reshuffles its webpack chunks on every release. If every extension keeps
// its own selectors inlined, a single Spotify update fans out to N files. We
// centralize here so a breakage is exactly one file to patch.
//
// Preference hierarchy inside each resolver:
//   1. data-testid — Spotify's QA pipeline depends on these, so they churn
//      far less than hashed classes
//   2. aria-label / role — semantic, preserved across redesigns
//   3. hashed class — last resort, documented to be fragile
//   4. fiber walk / webpack cache — structural escape hatch when the DOM
//      has no stable attribute (use sparingly — these scan the whole tree)
//
// Toggle DEBUG to log which branch of each fallback chain actually hit.

const DEBUG = false;

type ResolverMethod = "testid" | "aria" | "class" | "fiber" | "webpack";

function logResolved(name: string, method: ResolverMethod, el: unknown): void {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.debug(`[resolvers] ${name} via ${method}`, el);
}

function qs<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selector);
}

// ============================================================================
// React fiber access
// ============================================================================

// React attaches its fiber node to each host element under a key like
// `__reactFiber$<random>`. The suffix changes per React build, so match by
// prefix. Given a DOM element, return the fiber node or null.
export function fiberOf(el: Element): unknown {
  for (const key in el) {
    if (key.startsWith("__reactFiber$")) {
      return (el as unknown as Record<string, unknown>)[key];
    }
  }
  return null;
}

// Walk up a fiber tree via `.return` looking for a node matching the predicate.
// Useful when you have *some* stable DOM element and need to find a specific
// Spotify component instance by displayName or prop signature (resilient to
// class-name churn since it matches on shape, not styling).
export function walkFiberUp<T = unknown>(
  el: Element,
  match: (node: unknown) => boolean,
  maxDepth = 100,
): T | null {
  let node = fiberOf(el) as Record<string, unknown> | null;
  let depth = 0;
  while (node && depth++ < maxDepth) {
    try {
      if (match(node)) return node as T;
    } catch {
      // predicate threw — keep walking
    }
    node = node.return as Record<string, unknown> | null;
  }
  return null;
}

// ============================================================================
// Webpack module cache access
// ============================================================================

// Find a module in Spotify's webpack cache via a structural predicate.
// Prefers Spicetify's built-in `find` helper when available; falls back to a
// manual scan for older Spicetify builds.
//
// Write predicates against *prop shape*, not chunk ID — chunk IDs reshuffle
// every Spotify release, prop shapes almost never do.
export function findModule<T = unknown>(
  predicate: (m: unknown) => boolean,
): T | null {
  const wp = Spicetify?.Webpack;
  if (wp?.find) {
    try {
      const found = wp.find(predicate);
      if (found) {
        logResolved("findModule", "webpack", found);
        return found as T;
      }
    } catch {
      // fall through to manual scan
    }
  }
  const cache = wp?.moduleCache;
  if (!cache) return null;
  for (const id in cache) {
    const entry = cache[id];
    const exp = entry?.exports;
    try {
      if (exp && predicate(exp)) return exp as T;
      if (exp && typeof exp === "object") {
        for (const k in exp as Record<string, unknown>) {
          const sub = (exp as Record<string, unknown>)[k];
          if (sub && predicate(sub)) return sub as T;
        }
      }
    } catch {
      // some modules throw on enumeration — skip
    }
  }
  return null;
}

// Find a module that exports all of the named props. Handy for locating
// Spotify's own `TrackRow`, `PlayButton`, `ContextMenu` etc. without caring
// where in the bundle they live.
export function findModuleByProps<T = unknown>(...props: string[]): T | null {
  const wp = Spicetify?.Webpack;
  if (wp?.findByProps) {
    try {
      const found = wp.findByProps(...props);
      if (found) return found as T;
    } catch {
      // fall through
    }
  }
  return findModule<T>((m) => {
    if (!m || typeof m !== "object") return false;
    return props.every((p) => p in (m as Record<string, unknown>));
  });
}

// ============================================================================
// MutationObserver-based helpers
// ============================================================================

interface WaitForOptions {
  timeoutMs?: number;
  root?: Node;
}

// Resolve as soon as `resolver()` returns a non-null value. Backed by a
// MutationObserver so we don't burn CPU polling at startup. Used to block
// extension bootstrap until a required Spotify anchor has mounted.
export function waitFor<T>(
  resolver: () => T | null,
  opts: WaitForOptions = {},
): Promise<T | null> {
  const { timeoutMs = 30000, root = document.body } = opts;
  const existing = resolver();
  if (existing) return Promise.resolve(existing);
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const settle = (val: T | null): void => {
      if (settled) return;
      settled = true;
      obs.disconnect();
      window.clearTimeout(timer);
      resolve(val);
    };
    const obs = new MutationObserver(() => {
      const v = resolver();
      if (v) settle(v);
    });
    obs.observe(root, { childList: true, subtree: true });
    const timer = window.setTimeout(() => settle(null), timeoutMs);
  });
}

interface MaintainInjectionOptions {
  // Where we want to live (e.g. getRightSidebar).
  target: () => HTMLElement | null;
  // Already-injected instance check (e.g. () => document.getElementById("x")).
  exists: () => HTMLElement | null;
  // Perform the injection given the parent found by `target`.
  mount: (parent: HTMLElement) => void;
}

// Keeps a user-injected element alive. On startup and on every DOM change
// (rAF-throttled), re-mounts the element if it's missing or disconnected.
// Replaces setInterval polling loops that re-inject when React's re-renders
// wipe our subtree. Returns a teardown fn.
export function maintainInjection(opts: MaintainInjectionOptions): () => void {
  let rafPending = false;
  const run = (): void => {
    const cur = opts.exists();
    if (cur && cur.isConnected) return;
    const parent = opts.target();
    if (!parent) return;
    opts.mount(parent);
  };
  // Initial attempt. If target isn't mounted yet, the observer picks it up.
  run();
  const obs = new MutationObserver(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      run();
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  return () => obs.disconnect();
}

// Invoke `cb` whenever the subtree under `root` mutates. rAF-throttled to one
// call per frame at most. Useful when a module wants to react to "anything
// relevant may have changed" without hand-crafting per-target observers.
export function onSubtreeMutation(
  root: Node,
  cb: () => void,
  opts: MutationObserverInit = { childList: true, subtree: true },
): () => void {
  let rafPending = false;
  const obs = new MutationObserver(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      cb();
    });
  });
  obs.observe(root, opts);
  return () => obs.disconnect();
}

// ============================================================================
// Named Spotify-DOM resolvers
// ============================================================================

// The main view container that holds routed page content (home, search,
// playlists, lyrics, etc). Stable anchor — used to detect the lyrics route
// and to append our `#lyrics-slot`.
export function getMainView(): HTMLElement | null {
  const byTestId = qs<HTMLElement>('[data-testid="main"]');
  if (byTestId) {
    logResolved("getMainView", "testid", byTestId);
    return byTestId;
  }
  const byClass = qs<HTMLElement>(".Root__main-view");
  if (byClass) {
    logResolved("getMainView", "class", byClass);
    return byClass;
  }
  return null;
}

// The OUTER right-sidebar grid cell. Our custom panel mounts as a *sibling*
// of Spotify's NowPlayingView <aside> (that inner aside is hidden by
// user.css — `.Root__right-sidebar aside { display: none }`). Critically,
// we must NOT return the inner <aside> here — if we did, our panel would
// be appended inside a hidden parent and render blank.
//
// No aria fallback: the inner aside carries the "Now playing view" aria
// label, so any `[aria-label*="Now playing"]` selector matches the hidden
// subtree, not the outer container we actually want.
export function getRightSidebar(): HTMLElement | null {
  const byTestId = qs<HTMLElement>('[data-testid="right-sidebar"]');
  if (byTestId) {
    logResolved("getRightSidebar", "testid", byTestId);
    return byTestId;
  }
  const byClass = qs<HTMLElement>(".Root__right-sidebar");
  if (byClass) {
    logResolved("getRightSidebar", "class", byClass);
    return byClass;
  }
  return null;
}

// Spotify's own lyrics component, when mounted inside the main view. Used to
// detect the "on lyrics route" state (the /lyrics URL redirects on some
// builds, so we can't go by pathname alone).
export function getSpotifyLyricsContainer(): HTMLElement | null {
  const main = getMainView();
  if (!main) return null;
  const byTestId = qs<HTMLElement>('[data-testid*="lyrics" i]', main);
  if (byTestId) {
    logResolved("getSpotifyLyricsContainer", "testid", byTestId);
    return byTestId;
  }
  const byClass = qs<HTMLElement>(".lyrics-lyrics-container", main);
  if (byClass) {
    logResolved("getSpotifyLyricsContainer", "class", byClass);
    return byClass;
  }
  return null;
}

// The header banner painted with inline background-image on artist / album /
// profile pages. No stable testid — this is a heuristic: inline bg-image
// style, near the top of the scroll container, wide+tall enough to plausibly
// be a banner. Kept in resolvers so the heuristic lives in one place if it
// ever needs patching.
export function getMainViewBanner(): HTMLElement | null {
  const main = getMainView();
  if (!main) return null;
  const candidates = main.querySelectorAll<HTMLElement>(
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

// The "Switch to audio" toggle Spotify renders while a music video is playing.
// Only mounted in video mode, so presence of this button is itself a signal
// that we should click it (forcing audio-only playback). Selectors drift per
// build: testids vary, so we also match by aria-label across locales.
export function getSwitchToAudioButton(): HTMLButtonElement | null {
  const attempts: Array<[string, ResolverMethod]> = [
    ['button[data-testid="audio-video-switcher-audio"]', "testid"],
    ['button[data-testid*="switch-to-audio" i]', "testid"],
    ['button[data-testid*="audio-switcher" i]', "testid"],
    ['button[aria-label="Switch to audio" i]', "aria"],
    ['button[aria-label*="switch to audio" i]', "aria"],
  ];
  for (const [sel, method] of attempts) {
    const el = qs<HTMLButtonElement>(sel);
    if (el) {
      logResolved("getSwitchToAudioButton", method, el);
      return el;
    }
  }
  return null;
}

// Spotify's native miniplayer trigger — the button that opens the
// always-on-top OS-level miniplayer window. Lives inside the now-playing
// bar, which our theme hides via `display: none`, but the button is still
// present in the DOM so a programmatic click still fires. Fallback chain
// covers testid variants, exact aria, localized/partial aria.
export function getMiniplayerButton(): HTMLButtonElement | null {
  const attempts: Array<[string, ResolverMethod]> = [
    ['button[data-testid="mini-player-button"]', "testid"],
    ['button[data-testid*="miniplayer" i]', "testid"],
    ['button[data-testid*="mini-player" i]', "testid"],
    ['button[aria-label="Open Miniplayer" i]', "aria"],
    ['button[aria-label*="miniplayer" i]', "aria"],
    ['button[aria-label*="mini player" i]', "aria"],
  ];
  for (const [sel, method] of attempts) {
    const el = qs<HTMLButtonElement>(sel);
    if (el) {
      logResolved("getMiniplayerButton", method, el);
      return el;
    }
  }
  return null;
}

// The top-bar Friend Activity toggle button — we swap this in-place for our
// lyrics toggle. Fallback chain: stable testid → exact English aria → partial
// aria match (other locales) → case-insensitive contains.
export function getFriendActivityButton(): HTMLButtonElement | null {
  const attempts: Array<[string, ResolverMethod]> = [
    ['button[data-testid="buddy-feed-toggle"]', "testid"],
    ['button[aria-label="Friend Activity" i]', "aria"],
    ['button[aria-label*="Friend Activity" i]', "aria"],
    ['button[aria-label*="friend" i]', "aria"],
  ];
  for (const [sel, method] of attempts) {
    const el = qs<HTMLButtonElement>(sel);
    if (el) {
      logResolved("getFriendActivityButton", method, el);
      return el;
    }
  }
  return null;
}
