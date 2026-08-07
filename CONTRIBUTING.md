# Contributing to Termdeck

New palettes, exporters, accessibility improvements, and terminal-specific profiles are welcome.

1. Fork and clone the repository.
2. Create a theme JSON file or a focused code change.
3. Run `npm run check`.
4. Include a screenshot or ANSI preview when proposing visual changes.

Themes must include 16 ANSI colors, use six-digit hex values, and remain readable against their background. Artwork must be original or carry an explicit redistributable license; include its provenance in the pull request and in an adjacent notice file.

Please keep generated exports out of commits. They belong in the ignored `dist/` directory.
