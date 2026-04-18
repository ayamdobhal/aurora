# aurora

A [Spicetify](https://spicetify.app) theme + extension bundle. Glassy translucent UI, dynamic color theming from album art, a custom right panel, a lyrics view with a 5-line focus, a command palette, and keyboard shortcuts.

## Features

- **Dynamic theming** — accent colors are extracted from the current album art and applied across the UI.
- **Glass UI** — translucent surfaces with backdrop blur, album art drifting behind everything.
- **Custom right panel** — Queue, Recent, and Friends tabs with a full player (controls, seek, volume) docked up top. Queue rows are drag-reorderable.
- **Lyrics view** — a 5-line focus view sourced from AMLL (word-level), lrclib, or Spotify, in that order. Click a line to seek.
- **Command palette** — `Cmd/Ctrl + K` opens a search modal backed by Spotify's GraphQL search.
- **Keyboard shortcuts** — see `F1` in-app.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `F1` | Help |
| `F2` | Toggle lyrics view |
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + 1/2/3` | Switch right-panel tab |
| `Cmd/Ctrl + Shift + A` | Jump to artist of current track |
| `Cmd/Ctrl + Shift + B` | Jump to album of current track |
| `[` / `]` | Nudge lyrics timing ±50ms |

## Install

Requires [Spicetify](https://spicetify.app) and [just](https://github.com/casey/just). TypeScript is expected on PATH (the flake provides it; otherwise install globally).

```sh
git clone git@github.com:ayamdobhal/aurora.git
cd aurora
just deploy
```

`just deploy` compiles the TypeScript extensions, copies the theme to your Spicetify config, and applies it.

### With Nix

```sh
nix develop
just deploy
```

## Usage

```sh
just            # build + deploy + apply (default)
just build      # compile TS only
just deploy     # build, copy to spicetify, apply
just watch      # fswatch-based auto-deploy on src/ or theme/ changes
just check      # tsc --noEmit
just restore    # revert Spotify to vanilla
```

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
