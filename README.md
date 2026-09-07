# aurora

A [Spicetify](https://spicetify.app) theme + extension bundle. Glassy translucent UI, dynamic color theming from album art, a custom right panel, a lyrics view with a 5-line focus, a command palette, and keyboard shortcuts.

## Screenshots
<img width="2056" height="1329" alt="image" src="https://github.com/user-attachments/assets/3bf60b49-b76e-47ec-a6fb-c3ed1365bdd7" />
<img width="2056" height="1329" alt="image" src="https://github.com/user-attachments/assets/1072535e-a8bb-4e6e-bc84-b13c2ccf194e" />



## Features

- **Dynamic theming** — dominant album-art colors, contrast-aware controls and synchronized artwork/palette crossfades. Respects reduced motion.
- **Glass UI** — translucent surfaces with backdrop blur, album art drifting behind everything.
- **Custom right panel** — Queue, Recent, Friends and Devices with a full player. Both sidebar widths are adjustable from their invisible inner edges. Queue rows are drag-reorderable; sidebar selection persists.
- **Lyrics view** — shared main/miniplayer lyrics from AMLL (word-level), lrclib and Spotify. Open from the player button or F2. Choose a source, retry, and save timing adjustments per track. Click a line to seek; manual scrolling pauses following until “Back to current line.”
- **Inline Jam** — collapsible session view above Friends, with participants, invite-link copying and host/guest controls. Devices links to the same view. End/leave/remove actions ask for confirmation within the card. Availability follows the installed Spotify client/account.
- **Focus mode** — player button or F3 opens lyrics with minimal chrome, playback controls and an explicit exit. Escape restores the previous view.
- **Remembered setup** — sidebar, miniplayer tab/expansion, preferred lyrics source and up to 200 per-track timing offsets persist locally.
- **Command palette** — `Cmd/Ctrl + K` opens a search modal backed by Spotify's GraphQL search.
- **Keyboard shortcuts** — see `F1` in-app.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `F1` | Help |
| `F2` | Toggle lyrics view |
| `F3` | Toggle focus mode; Escape exits |
| `F8` (Windows) | Restore/hide native window title bar |
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + 1/2/3/4` | Switch right-panel tab |
| `Cmd/Ctrl + Shift + A` | Jump to artist of current track |
| `Cmd/Ctrl + Shift + B` | Jump to album of current track |
| `[` / `]` | Nudge lyrics timing ±50ms |

## Install

All paths require [Spicetify](https://spicetify.app) to be installed and run at least once.

### One-liner — macOS / Linux

Requires `curl` and `tar` on PATH. No Node or build tools needed — extensions are pre-built and shipped in the release archive.

```sh
curl -fsSL https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.sh | bash
```

### One-liner — Windows (PowerShell)

Requires PowerShell 5+ (built into Windows 10/11). No extra tooling needed.

```powershell
iwr -useb https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.ps1 | iex
```

Both scripts download the latest release, copy the theme and extensions into your Spicetify config, and apply.

### Manual (no just, no nix)

Requires `typescript` and `esbuild` on PATH (`npm i -g typescript esbuild`).

```sh
git clone https://github.com/ayamdobhal/aurora.git
cd aurora
bash scripts/build.sh
bash scripts/deploy.sh
```

### With just

Requires [just](https://github.com/casey/just) plus the manual-install prerequisites above.

```sh
just deploy
```

### With Nix

The flake provides all build tooling, so only `nix` is needed on the host.

```sh
nix develop
just deploy
```

## Development

```sh
just            # build + deploy + apply (default)
just build      # compile TS only
just deploy     # build, copy to spicetify, apply
just watch      # fswatch-based auto-deploy on src/ or theme/ changes
just check      # tsc --noEmit
just restore    # revert Spotify to vanilla
```

Local deployment records Aurora's extension names in
`Themes/aurora/.aurora-extensions`. Later deployments prune only names from
that record; the first deployment after upgrading preserves existing entries
whose ownership is unknown. `SPICETIFY_DIR` can override the default deployment
directory (`~/.config/spicetify`).

## Layout

```
src/              TypeScript sources — one file per extension
  layout.ts         main-view lyrics slot + banner fade
  dynamic-theme.ts  album-art → accent color extraction
  right-panel.ts    custom right panel (player + tabs)
  lyrics.ts         lyrics fetch + sync + render
  command-palette.ts Cmd+K search modal
  shortcuts.ts      global keybindings + help modal
  top-bar.ts        top-bar tweaks
theme/            Spicetify theme (color.ini + user.css)
scripts/          build.sh, deploy.sh
flake.nix         Nix dev shell
```

## Caveats

- Built and tested against a specific Spotify desktop build. Spotify's internal class names are hashed and change across releases; selectors may break.
- Friend activity relies on `Spicetify.Platform.BuddyFeedAPI.presenceView.getBuddyFeed()` which isn't present on every build.

## Regression checks

Drag the inner edge of either sidebar to resize it. Spotify remembers the
library width; Aurora remembers the player width and fits it to the available
window space. No extra controls are added. The player edge also supports arrow
keys when focused and double-click to reset its width.

Artwork accents use separate fill and readable foreground colors. Content
surfaces, selected menus and sticky headers retain contrast over bright covers.
The lyrics toggle sits beside Spotify's native listening-activity button.

`npm run test:visual` checks sanitized control fixtures in Chromium across seven
palettes and rest/hover/pressed/keyboard-focus states. Install a Playwright
Chromium browser with `npx playwright install chromium`, or set `CHROME_PATH`
to an installed Chrome executable. The check also covers sticky surfaces,
selected chips and native feedback visibility; its screenshot goes to
`reports/phase-1/control-fixture.png`.

Use Node 22. Install pinned tooling with `npm ci`, then run `npm test` and
`npm run build`. CI runs these on pushes and pull requests, and releases also
require them to pass. The tests exercise the production resolvers against
synthetic DOMs: fallback anchors, hidden-sidebar placement, lyrics scoping,
fiber cycles, webpack fallback, late mounting, reinjection and observer teardown.
They also exercise the bundled search, right-panel, lyrics and miniplayer
extensions with mocked Spotify APIs, including out-of-order responses, tab
restoration, dynamic theme synchronization and recents pagination. Deployment
fixtures check that cleanup preserves unrelated extensions.
These fixtures test our behavior; they cannot discover future Spotify changes.

For the installed Spotify build, launch its desktop executable with
`--remote-debugging-port=9228 --remote-debugging-address=127.0.0.1` after fully
quitting it, then run `npm run compat`. On macOS:

```sh
open -a Spotify --args --remote-debugging-port=9228 --remote-debugging-address=127.0.0.1
npm run compat
```

The live probe attaches through Playwright CDP, runs the same resolvers, checks
core Spicetify function availability and writes `reports/compat-latest.json`.
It does not click controls, make Spotify API requests or record credentials,
track names or page content. Keep the debugging endpoint local; quit and reopen
Spotify normally to close it. Override the endpoint with `SPOTIFY_CDP` if needed.

Exit codes: **0** required checks passed, **1** required contract missing,
**2** probe unavailable or Spicetify not loaded. `not-observed` means a conditional
control wasn't mounted (for example lyrics or video), not that the feature works.
A vanilla client lacks Spicetify's DOM rewriting too: missing anchors on that
client must not be interpreted as proven theme regressions.

Run the live probe after applying Spicetify to each new Spotify version.
This first pass does not yet verify rendered theme appearance, API response
shapes, playback behavior, or every route; it is not a whole-app compatibility
certification. Hosted CI cannot see your authenticated desktop installation.
Automatic update monitoring and visual baselines are separate follow-up work.

References: [Playwright CDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp),
[Spicetify API wrapper](https://spicetify.app/docs/development/api-wrapper).


On Windows, Aurora requests a compact native title bar and hides its controls.
F8 restores the bar; Alt+F4 remains available to close the window. This uses the
same internal container-control endpoint documented by
[No Controls](https://github.com/ohitstom/spicetify-extensions/tree/main/noControls).
It applies at startup and after debounced resize/fullscreen events, without a
continuous polling loop. macOS/Linux are unchanged. If the endpoint rejects the
request, Aurora leaves the native controls visible. Native Windows behavior
requires verification on the installed Spotify build.

The visual suite also checks Mix key notation against native badge colors (including regenerated class names), lyrics toolbar hover/focus auto-hide and reduced motion, and main/PiP play-button accent contrast. For Spotify-update checks, open a populated playlist **Mix** view before running `npm run compat`: the read-only probe checks key badge structure and contrast. `not-observed` means no populated key badge was available to inspect.
