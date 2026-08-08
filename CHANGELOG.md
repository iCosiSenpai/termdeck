# Changelog

Termdeck and its themes follow [Semantic Versioning](https://semver.org/). Application releases and theme releases are tracked independently.

## [Unreleased]

## [0.5.5] - 2026-08-08

### Termdeck

- Made the Special Editions' parity with Core themes a rule `npm run check` enforces rather than a property that happened to hold: Ghostty colour surfaces, the dock icon, the managed block, publication to Ghostty's theme list, and all seven export targets are asserted identical across categories. Verified by injecting a `category === "core"` branch into each of the four and confirming every one is caught.

## [0.5.0] - 2026-08-08

### Termdeck

- Gave the theme every surface Ghostty colours, not only the classic sixteen: the character under the block cursor, the split divider, and both search highlights, which until now stayed black-on-golden-yellow under all eight themes.
- Let the theme paint Ghostty's own macOS dock icon with `--icon`: the ghost in the theme's accent, the screen as a gradient from its background up to its selection tone. Opt-in, remembered between applies, removed by `--no-icon` or `termdeck uninstall`, and written only where macOS can act on it.
- Added `termdeck install-themes`, which publishes the catalog to Ghostty's own theme directory so `ghostty +list-themes` lists all eight and `theme = Termdeck Tokyo Midnight` resolves without Termdeck in the loop. Published files are prefixed, because Ghostty ships 463 themes and searches the reader's directory first.
- Made Ghostty validate the managed block before the reader's configuration is opened: only a block `ghostty +validate-config` accepts is merged, and a rejection arrives as Ghostty's own diagnostic with nothing written and nothing to undo. Problems elsewhere in the file are reported, never repaired — validating the merged file would have blamed Termdeck for an unrelated mistake and undone a good change to atone for it.
- Stopped reporting a plain success when Ghostty is not installed: `termdeck apply` still writes the managed block, then says the file will go unread and names the export that reaches the terminal you are actually using. The Control Center says the same in its status row and on the destination line, and neither spawns a reload for a terminal that is not there.
- Made the Ghostty bundle location overridable with `TERMDECK_GHOSTTY_APP`, so an installation outside `/Applications` is recognised.

## [0.4.0] - 2026-08-07

### Termdeck

- Rebuilt the Control Center around stating each thing once: removed the duplicated Terminal Profile heading, the second release version, the wallpaper note that was true of every theme, the two self-evident column titles, and the selection echo in the status row.
- Moved the profile selector into the pane it changes and made the Live Preview answer to it: the title bar appears as a tab strip, as bare window buttons, or not at all, the content indents by the profile's padding, and the cursor is drawn as the block, bar, or hollow block the profile asks for.
- Left opacity and blur stated as numbers instead of faked, because a terminal cannot be translucent inside another terminal and every theme background already sits within a few percent of the deck behind it.
- Gave the catalog the three colours that actually differ between themes — the accent, its green, and its magenta — in place of the bright grey and red slots that looked alike in all eight, tinted each row by the theme it names, and painted the selection as a chip in that theme's own background.
- Grew the Live Preview into the space the terminal actually has, up to a full listing with the sixteen ANSI slots painted on the theme's own background, and guaranteed the window closes its border at every size.
- Made the status row answer what is applied to Ghostty, and invite the first apply when nothing is.
- Named the configuration file Enter would rewrite inside the deck, so no managed file is changed before its path has been shown.
- Led the footer with the action, moved the power keys to the `?` guide on narrow terminals, and put the catalog filter query and its match count directly above the results they produced.
- Kept every theme name readable at every terminal size by sizing the catalog on width alone, instead of squeezing it whenever the terminal was merely short.
- Credited each Special Edition's rights holder in the theme pane instead of repeating the property its description already names.
- Documented that Ghostty is the only terminal Termdeck configures automatically, and gave each of the other six the one step that installs its exported package.
- Added a background update check on launch: the Control Center alerts when a newer Termdeck release is published or the applied theme has fallen behind the catalog, and installs or re-applies nothing until the alert is confirmed.
- Added `termdeck update` with a confirmation prompt, an unattended `--yes`, an opt-out through `TERMDECK_NO_UPDATE_CHECK`, and an upgrade command chosen from how the copy was installed instead of assumed.
- Upgraded Ghostty, WezTerm, and Kitty exports to complete visual configurations with wallpaper assets and selected working-profile effects.
- Replaced the iTerm2 color-only file with a live Dynamic Profile carrying artwork, transparency, blur, cursor, and ANSI colors.
- Added native Apple Terminal and Warp theme packages, including terminal-specific wallpaper handling.
- Expanded Alacritty output with its supported opacity, macOS blur, padding, decorations, and cursor options while explicitly excluding unsupported background images and panes.
- Added a source-of-truth capability registry and `termdeck capabilities` command.
- Added reliable Ghostty reload through its native macOS scripting action after applying a theme.
- Renamed the ambiguous Control Center mode selector to Terminal Profile and added an in-context description of its visual effects.
- Stopped all terminal profiles from overriding the user's font size; Ghostty now keeps its stock or user-configured value.
- Added the original Termdeck stacked-terminal icon, a transparent GitHub asset, and a universal Unicode mark in the Control Center header.
- Established granitic commit rules for durable, atomic checkpoints and release isolation.
- Made artwork provenance mandatory catalog metadata and added an automatically verified wallpaper notice for future themes.
- Parsed and validated the theme catalog once per process and shared it as immutable data instead of re-reading every theme file on each lookup.
- Measured Control Center text in terminal columns and degraded its palette to 256-colour, 16-colour, and monochrome terminals instead of assuming truecolor.
- Rebuilt the Control Center from pure panels composed into one row per terminal line, so the catalog, live preview, and controls can no longer draw over each other on small terminals.
- Added a scrolling viewport with hidden-item indicators to the theme catalog, keeping the selection on screen and the controls intact as the deck grows.
- Generated the footer hints and the keyboard guide from a single keymap, and framed the guide as a proper modal.
- Repainted only the Control Center rows that actually changed, inside a synchronized terminal frame, instead of clearing and redrawing the entire screen on every keystroke.
- Coalesced terminal resize events into a single redraw so dragging a window no longer floods the terminal with full repaints.
- Guaranteed the Control Center restores the cursor, the main screen, and terminal echo on SIGHUP, SIGINT, SIGTERM, an abrupt exit, or a failed repaint, and exits with the conventional signal status.
- Replaced the Live Preview swatch grid with a miniature terminal window rendered in the selected theme's own background, foreground, cursor, and palette, sized to the space available and falling back to swatches where colour is unavailable.
- Added `/` to filter the catalog by name, slug, description, or category while browsing, with live match counts, an explained empty result, and `Esc` to clear.
- Made the Control Center announce what it is doing before applying or exporting blocks the terminal, and report every export target instead of claiming success when some packages failed.
- Made the Control Center's random key always land on a different theme, sharing one selection rule with `termdeck random` and no longer failing on a single-theme catalog.
- Made command output follow the environment: styling is dropped when stdout is redirected or `NO_COLOR` is set, `FORCE_COLOR` restores it, and colour blocks degrade to shades instead of escape sequences.

### Theme releases

| Theme | Version | Category | Release notes |
| --- | --- | --- | --- |
| Chrome Moon | 1.0.0 | Special | Initial *Cyberpunk: Edgerunners* fan-edition palette and Lucy-and-David lunar wallpaper |

## [0.3.0] - 2026-08-07

### Termdeck

- Split the dashboard catalog into **Core Collection** and **Special Editions**.
- Added independent SemVer metadata for every theme.
- Added theme-version persistence to the managed Ghostty state.
- Added release, repository, and author metadata to the Control Center.
- Added `termdeck version` with canonical release and project links.
- Added original wallpapers for every Core Theme.
- Added deterministic, theme-aware terminal screenshot generation.
- Rebuilt the README as a complete visual product page and gallery.

### Theme releases

| Theme | Version | Category | Release notes |
| --- | --- | --- | --- |
| Nordic Aurora | 1.0.0 | Core | Initial palette and Arctic observatory wallpaper |
| Cyber Circuit | 1.0.0 | Core | Initial palette and circuit-city wallpaper |
| Tokyo Midnight | 1.0.0 | Core | Initial palette and rainy rooftop wallpaper |
| Velvet Dusk | 1.0.0 | Core | Initial palette and twilight observatory wallpaper |
| Ember Forge | 1.0.0 | Core | Initial palette and basalt forge wallpaper |
| Carbon Mono | 1.0.0 | Core | Initial palette and graphite architecture wallpaper |
| Resonant Rover | 1.0.0 | Special | Initial fan-edition palette and Male Rover wallpaper |

## [0.2.0] - 2026-08-07

- Added the full-screen Termdeck Control Center.
- Added keyboard navigation, visual palette preview, profile selection, and bulk export.
- Added Homebrew tap and curl fallback distribution.

## [0.1.0] - 2026-08-07

- Initial Ghostty theme engine.
- Added seven palettes, four working profiles, safe config management, and five export targets.

[0.5.5]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.5.5
[0.5.0]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.5.0
[0.4.0]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.4.0
[0.3.0]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.3.0
[0.2.0]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.2.0
[0.1.0]: https://github.com/iCosiSenpai/termdeck/commit/f7dc075
