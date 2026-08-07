# Termdeck repository rules

## Granitic checkpoints

Treat every Git commit as a precise, durable checkpoint.

1. A commit contains exactly one coherent change and the tests or documentation required to prove it.
2. Run `npm run check` immediately before committing; do not create broken, partial, placeholder, or `WIP` commits.
3. Use a precise imperative Conventional Commit subject. Avoid vague subjects such as `misc`, `updates`, or `cleanup`.
4. Preserve unrelated user changes and keep generated `dist/` artifacts and local state out of Git.
5. Keep code, broad mechanical formatting, dependency churn, and release operations separate unless they are inseparable from the same invariant.
6. Never bump a version, create a tag, publish a package, edit a Homebrew formula, or create a GitHub release without explicit maintainer authorization.
7. Record completed but unreleased work under the changelog's `Unreleased` section.

Before each commit, review the staged diff as a standalone checkpoint and verify that reverting it would not undo unrelated behavior.
