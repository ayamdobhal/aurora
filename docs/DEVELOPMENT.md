# Developing Aurora

## Build and deploy

Use Node.js 22+ and install the pinned dependencies before building. The release archives already contain bundled extensions; end users do not need Node.js.

```sh
npm ci
npm test
npm run check
npm run build
npm exec -- bash scripts/deploy.sh
```

Deployment copies the theme and extensions into the Spicetify config and applies them, which can restart Spotify. `SPICETIFY_DIR` overrides the default deployment directory. Aurora records its extension names in `Themes/aurora/.aurora-extensions`; subsequent deployments prune only entries from that record, preserving unrelated extensions.

The optional Nix shell supplies build tools. Install the project dependencies inside it too:

```sh
nix develop
npm ci
just deploy
```

With build tools on PATH, `just build`, `just check`, `just deploy` and `just restore` wrap the scripts. `just watch` needs `fswatch` and redeploys when sources or styles change.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/layout.ts` | Native layout integration, lyrics slot, resizing and focus mode |
| `src/dynamic-theme.ts` | Dominant artwork color extraction, readable accents and crossfades |
| `src/right-panel.ts` | Player, queue, recents, friends and device interactions |
| `src/lyrics.ts`, `src/miniplayer.ts` | Main and floating player views |
| `src/command-palette.ts`, `src/shortcuts.ts` | Search and global keyboard controls |
| `src/lib/lyrics-service.ts` | Concurrent providers, normalization, precision ranking and bounded cache |
| `src/lib/lyrics-view.ts` | Shared lyric renderer, timing controls and follow state |
| `src/lib/jam.ts`, `src/lib/qr.ts` | Native session adapter and local QR generation |
| `src/lib/artwork.ts` | Deduplicated, decoded artwork updates with stale-load guards |
| `src/lib/resolvers.ts` | Native selectors, injection lifecycle and compatibility anchors |
| `src/lib/preferences.ts`, `src/lib/accessibility.ts` | Shared settings and keyboard primitives |
| `theme/` | Color scheme and stylesheet |
| `tests/`, `scripts/` | Regression fixtures, build/deploy and compatibility tools |

Each top-level TypeScript file builds to an independent IIFE in `extensions/`. Shared runtime stores live on the main window so separately bundled consumers can deduplicate lyric requests and agree on preferences. The miniplayer renders in its own document but uses the main player's services.

Auto lyrics launches all three providers and compares their bounded results: word timing, line timing, plain text, then instrumental. Ties retain AMLL/lrclib/Spotify priority. Explicit provider selection calls only that provider. Positive results have a ten-minute cache; missing results expire sooner, and failures are not cached. Obsolete results cannot replace a newer view. Requests still shared by other views are not cancelled merely because one view closes.

Keep native integrations behind capability checks and preserve confirmed state during pending operations. Spotify's internal APIs and generated classes can change between releases. Avoid broad selectors, speculative mutation calls or silent failures. For Jam tests, use fixtures for creation, invites, removal and ending sessions; do not alter an active listening session to exercise an error path.

## Tests

```sh
npm test
npm run build
npx playwright install chromium
npm run test:visual
```

`npm test` runs the bundled components in synthetic DOMs with mocked Spotify APIs. Coverage includes preferences, keyboard behavior, lyrics ranking/races/timeouts, QR decoding, artwork loading, panel remounts, device transfer failures, queue operations, installer ownership and Windows chrome fallbacks.

The visual suite renders sanitized fixtures in Chromium: native and custom control contrast across seven palettes, hover/pressed/focus states, Mix key badges, hidden lyrics toolbar interaction, sidebar resize hit targets, and player/miniplayer geometry at several sizes. Set `CHROME_PATH` to an installed Chrome executable to use it instead of Playwright's browser. Screenshots and live reports go into ignored `reports/` directories.

CI runs unit tests and builds, plus the Windows installer fixture in Windows PowerShell 5.1. The release workflow also exercises the installer under PowerShell. Visual tests run separately with a browser; they do not establish compatibility with every Spotify experiment or Windows GPU configuration.

## Live compatibility checks

Fully quit Spotify, then launch its desktop executable with a loopback debugging endpoint. On macOS:

```sh
open -a Spotify --args --remote-debugging-port=9228 --remote-debugging-address=127.0.0.1
npm run compat
```

The probe attaches through Playwright CDP and checks production resolvers, required API functions, artwork geometry and Mix key notation contrast. Open a populated playlist Mix view to exercise the key check. It does not click controls, call Spotify APIs, or record credentials, track names or page text. Results are written to `reports/compat-latest.json`.

Use `SPOTIFY_CDP` to override the endpoint. Keep it local, and quit/reopen Spotify normally when finished.

- Exit **0**: required checks passed.
- Exit **1**: an observed contract or contrast check failed.
- Exit **2**: the probe is unavailable or Spicetify is not loaded.
- **not-observed**: a conditional surface is absent; this is not evidence that it works.

Re-run after Spotify updates. Tests cannot predict future markup or API changes; account-dependent and platform-dependent flows still need live checks. The [audit and roadmap](UI-UX-ROADMAP.md) record known validation limits.

## Releases

The release workflow packages `theme/`, bundled `extensions/` and `BUILD.txt` into `aurora.tar.gz` and `aurora.zip`. Both installers consume the latest published build and report its source revision. Tested pushes to `main` publish commit-tagged builds; version tags publish named releases with the matching changelog section.

Before a versioned release, pull remote changes/tags, update the changelog, verify unit/build/visual checks, and push logical commits. Push the version tag after the main-branch build completes, then verify the published assets and latest-release designation. Never replace an existing release tag to correct a later fix.

QR dependency license notices are retained in the generated player bundle. README screenshots live in `docs/images/`; capture actual UI and avoid publishing active invite URLs or QR codes.
