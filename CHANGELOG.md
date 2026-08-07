# Changelog

Termdeck and its themes follow [Semantic Versioning](https://semver.org/). Application releases and theme releases are tracked independently.

## [Unreleased]

### Termdeck

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

[0.3.0]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.3.0
[0.2.0]: https://github.com/iCosiSenpai/termdeck/releases/tag/v0.2.0
[0.1.0]: https://github.com/iCosiSenpai/termdeck/commit/f7dc075
