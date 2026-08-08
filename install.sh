#!/bin/sh
set -eu

REPOSITORY="iCosiSenpai/termdeck"
VERSION="${TERMDECK_VERSION:-v0.6.0}"
DATA_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_DIR="${TERMDECK_INSTALL_DIR:-$DATA_ROOT/termdeck}"
BIN_DIR="${TERMDECK_BIN_DIR:-$HOME/.local/bin}"
ARCHIVE_URL="https://github.com/$REPOSITORY/archive/refs/tags/$VERSION.tar.gz"

say() {
  printf '\033[36mtermdeck\033[0m %s\n' "$1"
}

fail() {
  printf '\033[31mtermdeck:\033[0m %s\n' "$1" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"
command -v node >/dev/null 2>&1 || fail "Node.js 20 or newer is required (https://nodejs.org)"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js 20 or newer is required; found $(node --version)"

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/termdeck.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT INT TERM

say "downloading $VERSION"
curl --fail --silent --show-error --location "$ARCHIVE_URL" -o "$STAGE/termdeck.tar.gz"
tar -xzf "$STAGE/termdeck.tar.gz" -C "$STAGE"
SOURCE_DIR="$STAGE/termdeck-${VERSION#v}"
[ -d "$SOURCE_DIR" ] || fail "the release archive has an unexpected layout"

mkdir -p "$DATA_ROOT" "$BIN_DIR"
if [ -e "$INSTALL_DIR" ]; then
  BACKUP_DIR="$INSTALL_DIR.previous-$(date +%Y%m%d%H%M%S)"
  mv "$INSTALL_DIR" "$BACKUP_DIR"
  say "previous installation saved at $BACKUP_DIR"
fi
mv "$SOURCE_DIR" "$INSTALL_DIR"
ln -sfn "$INSTALL_DIR/bin/termdeck.js" "$BIN_DIR/termdeck"

say "installed $VERSION"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) printf '\nAdd this line to your shell profile, then restart the shell:\n  export PATH="%s:$PATH"\n' "$BIN_DIR" ;;
esac
printf '\nLaunch the control center with:\n  \033[1mtermdeck\033[0m\n'
