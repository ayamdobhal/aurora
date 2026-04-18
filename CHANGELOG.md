# Changelog

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
