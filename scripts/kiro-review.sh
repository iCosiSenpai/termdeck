#!/bin/sh

set -eu

if ! command -v kiro-cli >/dev/null 2>&1; then
  echo "Kiro CLI is required: https://kiro.dev/docs/cli/" >&2
  exit 127
fi

if [ -z "${KIRO_API_KEY:-}" ]; then
  echo "KIRO_API_KEY is required for the non-interactive Kiro review." >&2
  echo "Create it in Kiro account settings and export it only in your local shell." >&2
  exit 2
fi

review_mode="commit"
review_base="${1:-HEAD^}"

if [ "${1:-}" = "--staged" ] || { [ "$#" -eq 0 ] && ! git diff --cached --quiet; }; then
  review_mode="staged"
elif ! git rev-parse --verify "${review_base}^{commit}" >/dev/null 2>&1; then
  echo "Unknown review base: ${review_base}" >&2
  exit 2
fi

if [ "$review_mode" = "staged" ]; then
  if git diff --cached --quiet; then
    echo "There are no staged changes to review." >&2
    exit 2
  fi
  review_label="staged changes"
else
  if git diff --quiet "$review_base" HEAD; then
    echo "There are no changes between ${review_base} and HEAD." >&2
    exit 2
  fi
  review_label="${review_base}..HEAD"
fi

echo "Running the canonical Termdeck checks before Kiro reviews ${review_label}..."
npm run check

review_prompt="Review the ${review_label} Git diff received on standard input. The canonical npm run check command passed immediately before this review. Follow AGENTS.md and your reviewer instructions."

if [ "$review_mode" = "staged" ]; then
  git diff --cached --no-ext-diff --unified=80 | kiro-cli chat \
    --agent termdeck-reviewer \
    --no-interactive \
    --trust-tools=read \
    "$review_prompt"
else
  git diff --no-ext-diff --unified=80 "$review_base" HEAD | kiro-cli chat \
    --agent termdeck-reviewer \
    --no-interactive \
    --trust-tools=read \
    "$review_prompt"
fi
