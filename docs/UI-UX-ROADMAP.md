# Aurora UI/UX audit and phased roadmap

Audit date: 7 September 2026. The original audit made no production changes. All five implementation phases are now complete in the working tree; validation and remaining platform-specific acceptance limits are recorded below.

## Direction

Keep Aurora's artwork-led background, minimal chrome, and integrated player/sidebar. Make controls and text reliably readable before adding more features. Preserve the current four sidebar tabs; give Jam a home within Friends and a shortcut within Devices.

Accepted scope includes shared lyrics, persistent preferences, focus mode, artwork transitions, lyrics controls, better loading/error states, Jam, and the visual/interaction fixes below.

## What was inspected

Live macOS Spotify 1.2.98.301 with Spicetify 2.44.0, on space 10, plus the extension sources and stylesheet. Native window screenshots are saved locally in `reports/ui-audit/` (gitignored because they contain personal library/activity information).

| Surface | Inspection performed | Evidence filenames |
| --- | --- | --- |
| Home | Cards, hover controls, top navigation, expanded/collapsed library, narrow window | `22-narrow-home.png` |
| Liked Songs | Header, play action, genre selection/reset, sort menu, row hover, scrolled sticky headings | `06-liked-scrolled.png`, `24-sort-selected.png` |
| Playlist | Header, tracks, native action menu including Start a Jam | `07-playlist-menu.png` |
| Artist and album | Header controls, popular tracks, discography/cards, album list | `08-artist.png`, `09-album.png` |
| Native Search | Query submission, results, categories, saved indicators | `10-search.png` |
| Browse and category | Genre tiles, Made For You, hovered card play action | `11-browse.png`, `12-made-for-you.png` |
| What's New | Empty state and informational banner | `13-whats-new.png` |
| Profile and Settings | Profile cards, account menu, settings controls/text | `23-profile.png`, `14-settings.png` |
| Podcasts | Browse, episode detail, show page | `25-podcasts.png`, `26-episode.png`, `27-show.png` |
| Sidebar | Queue, Recent, populated Friends, Devices, queue context menu | `15-lyrics-devices.png`, `22-narrow-home.png`; DOM/source inspection |
| Main lyrics | Loaded lyrics, focus mask, discoverability | `15-lyrics-devices.png` |
| Help and command palette | Open/close, search, arrow selection, help Tab focus | `16-help.png`, `17-command-palette.png` |
| Miniplayer | Lyrics/Queue tabs, expanded/collapsed portrait and landscape | `18-` through `21-` screenshots |

The main window was inspected at approximately 1858×1155 and 1004×730 CSS pixels. Miniplayer was inspected at 360×560 and approximately 366×260. Actual native window sizing was used; initial CDP-emulated screenshots had rendering artifacts and are excluded from layout findings.

This is broad representative coverage, not a claim that every Spotify experiment or account-dependent state was tested. Still to exercise during implementation: active Jam host/guest flows, device transfer failure, offline/provider failures, full library grid/folder/filter combinations, playlist editing dialogs, episode/video playback and transcripts, Marketplace, Windows chrome, other locales, and a full artwork palette matrix. Playback remained paused on the original track during this audit; track-transition and manual-follow behavior below also rely on source inspection.

## Findings and proposed fixes

Priority: P1 = address first because a control, state, or important text is hard to use; P2 = consistency/usability improvement. Evidence is explicitly marked live or source-derived.

| ID | Priority / evidence | Finding | Proposed fix |
| --- | --- | --- | --- |
| UI-01 | P1, live + source | Native primary play glyphs are almost invisible across playlist, album, artist, Search, and episode headers. Liked Songs measured `rgb(25,86,163)` on `rgb(23,76,146)`, about **1.17:1** contrast. | Replace version-specific icon overrides with scoped, stable control selectors; derive a contrasting on-accent foreground. Cover nested SVG paths and hover/pressed states. |
| UI-02 | P1, live + source | Selected sort entries use dark blue text on a dark menu: `rgb(23,76,146)` on `rgb(26,26,26)`, about **2.06:1**. Active device text and shortcut key labels have the same dark-accent problem. | Separate accent used as a fill from accent used as text. Selected text must remain readable and also use a checkmark/shape. |
| UI-03 | P1, live + source | Bright regions of the artwork wash out secondary text in lists, Search, Settings, podcast descriptions, and the sidebar. | Give content panes a bounded dark scrim and stronger secondary text. Keep artwork visible in the surrounding background; give menus/dialogs an explicit elevated surface. |
| UI-04 | P1, live + source | Scrolled track rows show through behind sticky column labels. Header computes to transparent with blur; blur alone does not establish a readable surface. | Apply a sufficiently opaque sticky-header surface and correct stacking/border treatment, including the condensed title/play header. |
| UI-05 | P1, live + source | The topbar lyrics button is absent. Spotify now exposes “Listening activity”; Aurora searches for old “Friend Activity” selectors. The native activity button produces no useful visible panel under the current layout. | Add a reliable Aurora lyrics entry with accessible name/pressed state. Resolve current native controls without broadly matching unrelated buttons; retain a reachable native social/Jam flow. |
| UI-06 | P1, live + source | Jam exists in the native playlist menu but is missing from Aurora's Friends/Devices experience. | Add the Jam entry and capability-aware native integration described below. |
| UI-07 | P1, source; visible feedback risk | CSS globally hides native notification/toast and Connect containers. Several custom operations swallow failures. Users can miss feedback and native flows may be concealed. | Narrow the hide rules to replaced chrome. Preserve/restyle native feedback and required Connect/Jam surfaces; provide concise custom operation feedback where Aurora owns the action. Verify actual portal locations. |
| UI-08 | P1, live + source | F1 help has no dialog semantics; Tab moves focus behind it. Palette results lack listbox/option semantics, and custom context menus only handle Escape. | Shared dialog focus management: initial focus, trap, Escape, restore focus. Add palette active-descendant semantics and keyboard context-menu navigation. |
| UI-09 | P1, source | Seek/volume bars and clickable rows rely on mouse interaction; custom tabs do not expose tab selection semantics. | Use native range controls or complete slider keyboard/value semantics. Add tablist/tabpanel behavior and keyboard activation for rows and device choices. Include visible focus on every owned control. |
| UI-10 | P2, live + source | Devices labels the active output “Playing” while the player is paused. Transfer selection is optimistic without an explicit pending/error state. | Distinguish selected output from playback state. Show Connecting, Connected/Paused/Playing, and failed transfer with retry; restore confirmed state after failures. |
| UI-11 | P2, live + source | Main lyrics use dark accent/fading over variable artwork and are less readable than miniplayer lyrics. There is no visible provider/timing control. | Use readable current/past/upcoming lyric tokens; keep the active line crisp. Add compact provider, offset, reset and retry controls to both views. |
| UI-12 | P2, source | Main and miniplayer have separate lyrics fetching/rendering logic; main supports word timing while miniplayer uses lrclib. Timing nudges are a global in-memory value; automatic line changes scroll without a user-reading mode. | Shared normalized lyrics service and playback timeline, per-track offsets, suspend follow on intentional user scroll, explicit return to current line. |
| UI-13 | P2, live design observation | At 1004 CSS pixels wide, the sidebar remains about 420 pixels wide, leaving about 480 for main content. The layout does not overflow, but the player dominates. | Use responsive sidebar width and a shorter player at constrained heights. Ensure tabs/actions fit before adding Jam; avoid a fifth tab. |
| UI-14 | P2, live + source | Native and custom hover/selected surfaces differ; owned scrollbars are hidden while native page scrollbars remain visible. Selected genre chips still work, but their old class-specific override no longer applies. | Define a consistent state system for rest, hover, pressed, selected, focus, disabled and pending. Provide a restrained visible-on-interaction scrollbar with keyboard scroll support; preserve distinct native category tile colors. |
| UI-15 | P2, source | Artwork/background and palette updates are separate, and a background-image transition is not a controlled crossfade. Motion does not have an explicit reduced-motion policy. | Decode next artwork, crossfade two layers, synchronize palette interpolation, cancel obsolete transitions, and respect reduced motion. |
| UI-16 | P2, source | Sidebar choice and miniplayer expansion do not persist across client restarts; lyric offsets cannot be kept per track. | Versioned preferences with safe defaults, validated reads and bounded per-track storage. Preserve existing miniplayer tab behavior. |
| UI-17 | P2, source | Empty, unavailable and failed results can collapse into “No friend activity” / “No devices available” / absent lyrics. Lyrics animation loops continue scheduling when useful work is absent. | Explicit asynchronous states, retry, stale-data handling and capability fallback. Pause unnecessary work while hidden/paused and resume accurately. |

### Color/state design

Create Aurora-owned tokens for content/elevated/sticky surfaces, primary/secondary/disabled text, accent fill, text-on-accent, readable accent text, border, focus ring, hover/selected overlay, and success/error. Map Spotify variables deliberately at the integration boundary rather than recoloring every semantic role with one hue.

Use 4.5:1 as the target for normal essential text and 3:1 for large text and meaningful control graphics. Compute contrast against the composited surface, not an uncomposited translucent CSS value. Decorative glow and deliberately faded off-focus lyrics can be quieter, but never use them as the only source of essential information.

Audit fixtures should cover black/white/gray artwork, saturated blue/red/green, very bright artwork, missing/broken artwork, long titles, explicit badges and disabled controls. Test all owned control states plus native play buttons, chips, sort menus, Settings toggles, saved indicators, and sticky headers. Avoid replacing `e-10180` with another build number as the fix.

### Jam design

Friends gets a compact **Jam** section above activity: an idle “Start a Jam” action, or an active-session summary and “Open Jam” action where supported. Devices gets a “Listen together” shortcut to the same flow below the current output. Keep existing tabs and shortcut numbers intact.

First prove a stable native launcher and the visibility of its overlay/session controls on this Spotify build. Prefer Spotify's native invite, QR, join, leave/end and participant controls; only expose session metadata when there is a reliable capability. Do not depend on undocumented method names guessed from Platform keys or translated text alone. If integration is unavailable, provide an explanatory state and an actionable native fallback rather than a dead button.

Spotify documents desktop Start a Jam in track/playlist menus and requires Premium to host. Account restrictions should come from the native capability/flow, not a hardcoded assumption. Source: [Spotify: Start or join a Jam](https://support.spotify.com/na-en/article/jam/).

No Jam was started and no invitation was sent during the audit. Host/guest/expired-session behavior remains an integration acceptance check. Native Start a Jam may itself create a session; do not treat it as a harmless preview in automated tests.

## Phased delivery

Each phase should be a separate reviewable change, with focused automated tests and a live check. Introduce regression coverage alongside behavior, not in a final cleanup phase.

### Phase 1 — Restore readability and native compatibility

Scope: UI-01–05, visual portions of UI-07, UI-14, and the lyric contrast portion of UI-11.

- Add shared color/surface tokens and contrast-aware accent roles in `src/dynamic-theme.ts` and `theme/user.css`.
- Scope transparency/hide rules; repair play glyphs, selected menu text, active device text, help labels and sticky headers.
- Restore an accessible topbar lyrics entry through `src/top-bar.ts` and `src/lib/resolvers.ts`.
- Add visible focus treatment immediately; do not postpone basic readability for new features.
- Added scope: resize both sidebars by dragging their inner edges, with no visible handles, tooltips or extra controls. Preserve native library resizing and persistence; own the player width because Spotify can unmount its native handle. Store the preferred player width, adapt it to available space, and support keyboard adjustment/cancel/reset.

Exit checks: all measured failures above meet the chosen contrast targets; topbar lyrics opens/closes correctly; sticky headers remain readable while scrolling; menus/toasts remain visible; no unintended change to Browse tile colors. Test palette math/fallbacks and resolver variants; add controlled browser fixtures using current native markup and SVG nesting.

### Phase 2 — Sidebar, Jam, interaction and feedback

Depends on Phase 1 surfaces and native visibility fixes. Scope: UI-06–10, UI-13 and non-lyrics UI-17.

- Prove native Jam launch/overlay integration, then add Friends and Devices entry points.
- Give Friends, Devices, Recent and Queue distinct loading, empty, unavailable, failed and refreshing states; retain usable stale data when appropriate.
- Correct paused/active device labels and provide pending transfer feedback with rollback/retry.
- Complete dialog/palette/context-menu keyboard behavior, sliders, tab semantics and row activation.
- Adjust sidebar width/player height for smaller windows; keep actions visible without tab overflow.

Exit checks: start/open Jam reaches visible native UI on a supported account; unsupported capability is actionable; session controls remain reachable. Mock Jam capability/session variants, failed transfers, out-of-order refreshes, focus restoration, keyboard sliders/tabs and pagination. Run an explicitly coordinated live Jam session for host/guest checks. Existing queue mutation and remount tests must keep passing.

### Phase 3 — One lyrics engine and useful lyrics controls

Depends on Phase 1 tokens and Phase 2 accessible control patterns. Scope: UI-11, UI-12 and lyrics UI-17.

- Extract provider adapters and a shared normalized line/word model used by main and miniplayer. Preserve AMLL word timing and existing fallbacks; add equivalent supported fallbacks to miniplayer.
- Share fetch/cache/request cancellation and timeline selection; let each window own its rendering and visibility lifecycle.
- Add Auto/provider selection, retry, timing adjustment/reset and clear loading/instrumental/unavailable/error states.
- Separate follow-current from user-reading mode. Manual scroll suspends follow; “Back to current line” resumes. Click-to-seek works in both views.
- Stop unnecessary animation work while hidden/paused; correctly resync after seek, track change and miniplayer reopen.

Exit checks: the same track/provider/offset produces matching timing in both windows. Test malformed/empty/instrumental lyrics, provider failure, rapid track changes, cache eviction, stale responses, word boundaries, seek offsets, manual scroll vs programmatic scroll, and cleanup. Include a live word-timed track and a fallback-only track.

### Phase 4 — Remember the listening setup

Depends on Phase 3's track identity and timing model. Scope: UI-16 and persistence aspects of accepted enhancements.

- Add a small versioned settings store shared by extensions.
- Persist sidebar tab, miniplayer expansion/tab, and bounded per-track offsets. Define provider preference scope explicitly: default Auto, global preferred provider, optional per-track override only if needed.
- Restore preferences without overriding a user's action during initialization; invalid/unavailable selections fall back safely. Add reset controls near the relevant setting.

Exit checks: preferences survive Spotify restart and agree between windows; offsets never leak to another track. Test corrupt data, schema migration, unavailable saved provider, storage failure and bounded history. Do not persist short-lived loading/error or Jam session state as if it were durable.

### Phase 5 — Focus mode and transitions

Depends on stable layout, lyrics and settings. Scope: accepted focus mode, UI-15 and final motion/layout polish.

- Add deliberate focus-mode entry from lyrics/player and shortcut help. Hide library/sidebar while retaining accessible play/pause, seek, lyrics controls and an obvious way out.
- Reveal subtle controls on hover **and keyboard focus**. Escape exits; returning restores prior layout/tab state. Transient focus mode should not unexpectedly reopen after restart.
- Crossfade decoded artwork layers and interpolate the palette together. Keep contrast valid during transitions and use the latest-track result when skipping rapidly.
- Respect reduced motion for background, lyrics, tabs and dialogs. Ensure blur/crossfade work remains bounded.

Exit checks: enter/exit from expanded and collapsed layouts, keyboard-only use, narrow windows, PiP open/close, rapid skips and missing artwork. Test transition cancellation and focus/layout restoration; inspect frame stability and idle work on the live client.

## Validation and release checklist

- Retain the existing test suite and run `npm test`, `npm run check`, `npm run build` for implementation phases; run `npm run compat` against the intended live client using the repository's documented setup.
- Build deterministic visual fixtures for colors, states, dialogs and responsive layout. Use sanitized fixture data; do not commit personal live screenshots. DOM-only tests cannot validate actual compositing/contrast.
- Maintain a compact live route checklist from the coverage table. Repeat relevant routes after each phase, with a full pass before the final release.
- Exercise empty/error/disabled/pending states through test doubles; avoid changing a real account just to force a visual state.
- Verify native toast/Connect/Jam visibility separately from Aurora component tests. Add compatibility coverage for alternate native selectors and ensure optional features fail visibly and gracefully.
- Finish the untested surfaces listed above, especially Windows, active Jam, provider failures, video/episode playback and library/dialog variants, before describing the release as fully audited.

## Implementation and verification — 8 September 2026

All five phases are implemented. The phase descriptions above retain the original acceptance goals; this record distinguishes completed checks from live scenarios still requiring another account/platform.

| Phase | Delivered |
| --- | --- |
| 1 | Contrast-aware accent roles, elevated/sticky surfaces, current native selectors, topbar/player lyrics entries, invisible sidebar resizing with persistence and keyboard support. Dominant album-art color remains intentional. |
| 2 | Inline Jam, sidebar loading/empty/error/retry states, guarded refreshes, confirmed device state during transfer, keyboard dialogs/tabs/sliders/rows/context menus and action feedback. |
| 3 | Shared provider/cache/timeline and renderer for main/PiP, word timing, source/retry controls, per-track offset/reset, manual-follow suspension, bounded waits, stale-response guards and idle animation cleanup. |
| 4 | Validated local preferences shared between bundles/windows: sidebar, PiP tab/expansion, provider and bounded per-track offsets. Session/focus state is transient. |
| 5 | Focus entry/exit with route/focus restoration, decoded artwork crossfade and palette interpolation, stale-transition guards, neutral broken-art fallback and reduced motion. |

**Jam design revision:** at the user's request, replaced the initial native-panel launcher with a collapsible Aurora view directly above Friends. Devices selects/expands that view. Shows participants and host status; copies the cached Spotify invite URL only on click; offers host remove/end or guest leave with inline confirmation. Uses the method signatures inspected on the installed client, with capability checks and retryable failures. No native Open Jam button remains. QR display and arbitrary join-link parsing are not implemented.

**Automated verification:** 66 tests pass; TypeScript check and all eight extension builds pass. Chrome visual fixtures pass 28 palette/control combinations, selected menus, feedback surfaces, invisible edge hit testing/dragging, minimum-width tabs and PiP lyrics containment at 360×560, 366×260 and 282×334. Mocks cover Jam initialization races, host/guest action selection, confirmation, failed creation/end and clipboard failure; device failures and out-of-order refresh; provider failure/body timeout, malformed timing, stale cache, follow/seek offsets; focus/dialog restoration; transition cancellation and reduced motion.

**Live verification:** existing two-person host Jam renders inline with correct participants/output and remains above Friends. Devices opens it. Player lyrics entry, main lyrics tools, Focus entry/Escape restoration, help focus and shared PiP fallback lyrics were inspected. The live PiP check exposed an absolute/relative positioning regression that let auto-scroll move the whole player; the corrected containment and compact controls now have rendered regression fixtures. Live resolver/geometry compatibility checks pass; video-switch control was not observed. Native screenshots remain local under `reports/phases/`.

**Listening-session constraint:** no test clicked playback/seek/device transfer or sent an invite, removed a participant, or ended/created a Jam. Initially deferred the final restart to avoid disruption. The user subsequently authorized restarting this client because playback is on their PC. Restarted Spotify normally with the final bundles/styles; visually verified the inline two-person Jam, player controls and lyrics after restart. Remote playback remained active.

**Remaining acceptance limits:** live guest/host mutations, account restrictions, expired sessions, Windows/native titlebar, other locales, episode/video/transcript playback and the previously listed library/dialog variants need separate verification. Current tests establish Aurora behavior against mocks and the inspected macOS build, not compatibility with every Spotify experiment. Provider requests are deduplicated and bounded; obsolete results are ignored rather than aborting requests still shared by another view.


### Button styling revision

Jam and lyrics controls now use artwork-tinted glass, soft accent glow, deliberate primary/quiet action hierarchy, hover/press/focus feedback and reduced-motion support. The main lyrics toolbar has a shared glass surface. Per user preference the topbar lyrics entry is retired; player entry and F2 remain. The updated suite contains 65 tests (the retired topbar tests were consolidated into one removal/preservation regression), with the same rendered layout/state checks passing.

### Mix and player regression follow-up

Fixed transparent Mix key notation caused by the inherited background token; native key fills are preserved. Lyrics controls now auto-hide except on toolbar hover/keyboard focus (always visible on touch-only devices). Main/PiP transport uses the same accent fill/on-accent pair as Jam. Rendered tests cover three native key colors, regenerated badge class fallback, toolbar hover/focus/fade/reduced motion, and both player primary buttons at rest/hover across seven palettes. The read-only live compatibility probe checks populated Mix key cells independently of generated classes and passed on the installed client.

### Accent balance follow-up

With bounded dark surfaces in place, selected native filter chips and sidebar/PiP tabs again use the album fill plus contrasting foreground. Current-track titles, focus rings and relevant hover states use the readable accent variant. Body copy remains neutral and Mix key colors stay native. Palette fixtures now include selected chip fill/foreground checks across all seven palettes.
