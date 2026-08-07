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
- Established granitic commit rules for durable, atomic checkpoints and release isolation.

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
