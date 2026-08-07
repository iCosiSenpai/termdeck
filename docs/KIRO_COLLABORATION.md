# Codex + Kiro collaboration

Termdeck uses Codex for implementation and Kiro as an independent reviewer and specification partner. Both agents inherit the repository rules from the root [`AGENTS.md`](../AGENTS.md); Git commits remain the handoff boundary.

## Roles

| Role | Primary responsibility | Repository access |
| --- | --- | --- |
| Codex | Implement, test, document, and create granitic checkpoints | Normal workspace access |
| Kiro IDE | Explore requirements, specifications, and diagnostics | Use a separate worktree if it will edit |
| `termdeck-reviewer` | Review staged changes or completed checkpoints | Read-only; no shell, writes, MCP, or subagents |

Kiro automatically discovers the workspace agent in `.kiro/agents/` when started from the repository root. In Kiro IDE, select `termdeck-reviewer` from the agent selector. For an interactive CLI review session:

```sh
kiro-cli --agent termdeck-reviewer
```

## Review a checkpoint

Kiro headless mode requires a local `KIRO_API_KEY`. Create the key in Kiro account settings and export it from your shell; never commit it or place it in a project file.

Stage one coherent change, then review it before committing:

```sh
git add <coherent-files>
npm run review:kiro -- --staged
```

With no staged changes, the command reviews the latest commit against `HEAD^`:

```sh
npm run review:kiro
```

Pass an explicit base to review a wider checkpoint range:

```sh
npm run review:kiro -- origin/main
```

The wrapper always runs `npm run check` first. Kiro receives the resulting diff on standard input and may inspect repository files, but its agent policy prevents modifications and command execution.

## Parallel work

Do not let Codex and Kiro edit the same working tree concurrently. Give each writer its own branch and Git worktree, keep tasks non-overlapping, and integrate only complete, tested commits. A read-only `termdeck-reviewer` session is safe against the active working tree because it cannot write.

## Handoff contract

1. Define one bounded change and its acceptance criteria.
2. Implement it in one working tree.
3. Stage only the coherent diff and run the Kiro review.
4. Resolve actionable findings and run the canonical checks again.
5. Commit with a precise Conventional Commit subject.
6. Keep version bumps, tags, Homebrew changes, publishing, and GitHub releases in separately authorized release work.
