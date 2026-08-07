#!/bin/sh

set -eu

if ! command -v kiro-cli >/dev/null 2>&1; then
  echo "Kiro CLI is required: https://kiro.dev/docs/cli/" >&2
  exit 127
fi

if ! kiro-cli whoami >/dev/null 2>&1; then
  echo "Kiro authentication is required. Run 'kiro-cli login' first." >&2
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

project_root=$(git rev-parse --show-toplevel)
review_dir="${project_root}/.build/kiro-review"
mkdir -p "$review_dir"
find "$review_dir" -type f \( -name 'checkpoint.*' -o -name 'response.*' \) -mtime +0 -delete 2>/dev/null || true
review_file=$(mktemp "${review_dir}/checkpoint.XXXXXX")
review_output=$(mktemp "${review_dir}/response.XXXXXX")
cleanup() {
  rm -f "$review_file" "$review_output"
  rmdir "$review_dir" 2>/dev/null || true
}
trap cleanup 0
trap 'cleanup; exit 129' 1
trap 'cleanup; exit 130' 2
trap 'cleanup; exit 143' 15

if [ "$review_mode" = "staged" ]; then
  git diff --cached --no-ext-diff --unified=80 > "$review_file"
else
  git diff --no-ext-diff --unified=80 "$review_base" HEAD > "$review_file"
fi

review_prompt="Review ${review_label}. Read the exact Git diff from ${review_file}. The canonical npm run check command passed immediately before this review. Follow AGENTS.md and your reviewer instructions."

set +e
echo "Kiro is reviewing ${review_label}; the verified report will print when complete..."
NO_COLOR=1 KIRO_LOG_NO_COLOR=1 kiro-cli chat \
  --agent termdeck-reviewer \
  --no-interactive \
  --effort max \
  --trust-tools=read \
  "$review_prompt" < /dev/null > "$review_output"
review_status=$?
set -e

cat "$review_output"

if [ "$review_status" -eq 0 ] && grep -Fq "REVIEW_INPUT_ERROR:" "$review_output"; then
  echo "Kiro could not read the review input." >&2
  review_status=3
fi
if [ "$review_status" -eq 0 ] && ! grep -Fq "REVIEWED_DIFF: ${review_file}" "$review_output"; then
  echo "Kiro did not confirm the diff it reviewed." >&2
  review_status=3
fi

trap - 0 1 2 15
cleanup
exit "$review_status"
