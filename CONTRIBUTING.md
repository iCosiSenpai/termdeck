# Contributing to Termdeck

New palettes, exporters, accessibility improvements, and terminal-specific profiles are welcome.

1. Fork and clone the repository.
2. Create a theme JSON file or a focused code change.
3. Run `npm run check`.
4. Include a screenshot or ANSI preview when proposing visual changes.

Themes must include 16 ANSI colors, use six-digit hex values, and remain readable against their background. Artwork must be original or carry an explicit redistributable license; include its provenance in the pull request and in an adjacent notice file.

Please keep generated exports out of commits. They belong in the ignored `dist/` directory.

## Granitic commits

Every commit is a durable, reproducible checkpoint—not a progress snapshot.

- One commit must establish one coherent invariant: a feature with its tests, a focused fix with its regression, or a documentation-only decision.
- The tree must pass `npm run check` before every commit. Never commit knowingly broken, partial, or placeholder behavior.
- Commit messages use an imperative Conventional Commit prefix (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`) and describe the checkpoint precisely; `WIP`, `misc`, and omnibus commits are not accepted.
- Generated exports, local state, unrelated formatting, version bumps, release notes, and publishing operations must not hitchhike on a feature commit.
- A release checkpoint is always separate and requires explicit maintainer authorization. Feature work must remain under `Unreleased` until then.

If a commit cannot be reverted independently without also undoing unrelated behavior, split it before submission.
