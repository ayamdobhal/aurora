# Changelog

## v0.1.7 — 2026-04-21

### Added
- **Miniplayer** — floating detachable window via the Document Picture-in-Picture API, themed by our `user.css` (stylesheets cloned into the PIP document). Compact player (art, title/artist, seek, transport) plus an expandable panel with Lyrics and Queue tabs. Layout flips from portrait (art on top) to landscape (art on left) based on the PIP window's current aspect ratio. Inline close button; falls back to Spotify's native miniplayer on builds without `documentPictureInPicture`.
- **Devices tab** — 4th tab in the right panel lists Spotify Connect devices with their type (computer / phone / speaker). Active device is highlighted with an accent dot; click any device to transfer playback. Probes `ConnectAggregatorAPI` / `ConnectAPI` / `RemoteDeviceAPI` defensively since method signatures drift across builds.
- `Ctrl/⌘ + 4` switches to the Devices tab.
- `Ctrl/⌘ + Shift + M` opens Marketplace (toasts when the custom app isn't installed in the Spicetify config).

### Changed
- Video mode is auto-disabled — any time Spotify enters a music-video view, the extension clicks "Switch to audio" on the next DOM mutation or song change.
- Album art stays square in both the right-panel player and the miniplayer regardless of window size, zoom, or orientation. Switched from `aspect-ratio + max-height` (which depends on browser re-derive behavior) to a `container-type: size` wrap sized via `100cqmin`.
- Right-panel layout no longer clips to the right at certain zoom levels — `.crp-player` has `min-width: 0` and the cover row is `minmax(0, 1fr)` instead of falling back to min-content.
- Seek bar in the right-panel player now shares the volume slider's recessed "skeleton" track treatment.
- Like and miniplayer buttons now align on the same horizontal row in the player (left/right of the track text).

### Fixed
- Explicit badge "E" glyph reads against its wrapper (forced black instead of wrapper-color-on-wrapper-color).
- Primary play button icon no longer blends into the accent fill (forced black on `.e-10180-icon` inside `buttonPrimary`).
- Selected filter chip labels (e.g. "All", genre pills) are legible — `encore-inverted-light-set` was rendering text in the pill's own fill on this build.
- Marketplace nav link in the top bar gets the same translucent glassy treatment as the other nav buttons.

### Internal
- New `src/miniplayer.ts` — self-contained PIP window with lrclib lyrics fetch, queue rendering, state sync to `Spicetify.Player`, and lifecycle wired via `pagehide`.
- New resolvers in `src/lib/resolvers.ts`: `getSwitchToAudioButton`, `getMiniplayerButton` — both with `data-testid` → aria-label fallback chains.
- `Spicetify.Config.custom_apps` added to `spicetify.d.ts` for marketplace-availability checking.

## v0.1.6 — 2026-04-20

### Added
- Recent tab is now truly paginated — first 30 items on mount, next 30 as you scroll, live refresh via Spotify's `PlayHistoryAPI` / `RecentlyPlayedAPI` `update` events. No more full-history payload in memory.

### Changed
- Lyrics view uses container queries + `ch`-based wrap: active and inactive lines share identical wrap points, so a line that fits on one row at rest stays one row when it becomes active — no mid-playback layout jump. Font sizes now scale with the actual panel width.
- Right-panel player album art stays square at any panel aspect ratio (was getting stretched by the grid row).

### Fixed
- Right panel no longer renders blank — the resolver was matching Spotify's inner hidden `<aside>` via the "Now playing" aria-label instead of the outer `.Root__right-sidebar` grid cell, so the panel was being mounted inside a `display: none` subtree.
- Recent tab updates again after the refactor — the `(offset, limit)` signature was a cache slicer that returned partial data against an unpopulated cache; no-args `getContents()` is what actually triggers cache population and wire fetches.
- Recent list no longer shrinks below the loaded count when the response includes non-track items (podcasts / episodes); the normalize window now reads past the raw-slice boundary until it accumulates the requested count of actual tracks.

### Internal
- New `src/lib/resolvers.ts` — single-resolver pattern centralizing every Spotify-DOM anchor and React-internal lookup with `data-testid` → `aria-*` → class fallback chains. Future Spotify class-name churn is a one-file patch instead of a hunt across extensions.
- Polling loops for panel re-injection (layout, right panel, top-bar friend-button clone) replaced with `MutationObserver`s — responsive on the next frame instead of up to 500 ms after a React wipe.

## v0.1.5 — 2026-04-20

### Fixed
- Tightened the custom right-panel replacement so Spotify's native sidebar mount is hidden without overbroad descendant selectors.
- Scoped the lyrics takeover to the main-view lyrics route so reused lyrics containers elsewhere don't trigger the custom slot.
- Limited scrollbar hiding to Aurora-owned surfaces instead of suppressing scrollbars app-wide.

### Changed
- Right-panel player layout now keeps the track details centered even with the like button present.
- Album art in the right-panel player now scales with the available panel space instead of staying capped at a fixed size.
- Volume slider now keeps the remaining range visible with a recessed track beneath the accent fill.

## v0.1.4 — 2026-04-19

### Added
- **Queue split**: the Queue tab now shows user-queued "Play next" items first, then a quiet uppercase `Next up` divider, then the context's auto-up-next tail — mirroring Spotify's own layout.
- **Clear queue** pill on the right of the tab bar. Appears only while the Queue tab is active and you've actually queued something; one click empties user-queued items.
- **Like / unlike** button in the right-panel player section. Syncs with library changes from other surfaces (now-playing-bar, context menus, other clients) via `LibraryAPI` update events.
- **Recent playtime**: Recent tab subline shows relative time — `just now`, `5m ago`, `3h ago`, `yesterday`, `5d ago`, `2w ago`, and so on.

### Performance
- All list rows (queue, recent, friends) now use event delegation — one handler per container instead of 6+ per row. At a few hundred rows the old wiring was attaching ~1200 listeners per refresh; that's what made tab switching feel laggy.
- `content-visibility: auto` on rows so the browser skips offscreen layout/paint.

### Fixed
- Top nav / search bar now stacks above horizontally-scrolling shelves in the main view (was being overlapped).
- Recent searches dropdown is translucent with a 30px backdrop blur — previously the search pill's own backdrop-filter was swallowing the inner blur.

## v0.1.3 — 2026-04-18

- Fix top-nav stacking so horizontally-scrolling main-view shelves no longer bleed above the search bar.
- Translucent `Recent searches` dropdown with 30px backdrop blur; strips the wrapper's own blur while the dropdown is open so the album art can actually come through.

## v0.1.2 — 2026-04-18

- Heart / like button in the right-panel player row, syncing with `Spicetify.Platform.LibraryAPI`.

## v0.1.1 — 2026-04-18

- Windows installer (`install.ps1`) using PowerShell's built-in `Expand-Archive` — no extra tooling needed.
- Switched the Unix installer from `.zip` → `.tar.gz` (`tar` ships on every Unix; `unzip` often doesn't on minimal distros).
- Release workflow now ships both `aurora.tar.gz` and `aurora.zip`.

## v0.1.0 — 2026-04-18

Initial release.

- Dynamic color theming extracted from album art.
- Glassy translucent UI with backdrop blur.
- Custom right panel — Queue / Recent / Friends tabs with a full player up top; queue rows are drag-reorderable.
- Lyrics view with 5-line focus, sourced from AMLL (word-level), lrclib, or Spotify in that order.
- `Cmd/Ctrl + K` command palette backed by Spotify's GraphQL search.
- Keyboard shortcuts (see `F1` in-app).
- One-liner installers for macOS/Linux (`install.sh`) and Windows (`install.ps1`).
- GitHub Actions release pipeline — tags matching `v*` produce prebuilt archives.
