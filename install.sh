#!/usr/bin/env bash
# aurora — one-shot installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.sh | bash

set -euo pipefail

REPO="https://github.com/ayamdobhal/aurora.git"
THEME_NAME="aurora"
SPICETIFY_DIR="$HOME/.config/spicetify"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"
}

need spicetify "Install from https://spicetify.app"
need git       "Install git and retry"
need npx       "Install Node.js (bundles npx): https://nodejs.org"

[ -d "$SPICETIFY_DIR" ] || die "Spicetify config not found at $SPICETIFY_DIR. Run 'spicetify' once first."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

info "Cloning aurora"
git clone --depth=1 --quiet "$REPO" "$TMP/aurora"
cd "$TMP/aurora"

info "Building extensions"
mkdir -p extensions
for src in src/*.ts; do
  name="$(basename "$src" .ts)"
  [[ "$name" == *.d ]] && continue
  npx -y esbuild "$src" \
    --bundle \
    --format=iife \
    --target=es2020 \
    --outfile="extensions/$name.js" \
    --log-level=warning >/dev/null
done

info "Copying theme to $SPICETIFY_DIR/Themes/$THEME_NAME"
mkdir -p "$SPICETIFY_DIR/Themes"
rm -rf "$SPICETIFY_DIR/Themes/$THEME_NAME"
cp -r theme "$SPICETIFY_DIR/Themes/$THEME_NAME"

info "Copying extensions to $SPICETIFY_DIR/Extensions"
mkdir -p "$SPICETIFY_DIR/Extensions"
for ext in extensions/*.js; do
  cp "$ext" "$SPICETIFY_DIR/Extensions/"
done

info "Configuring spicetify"
spicetify config current_theme "$THEME_NAME" >/dev/null

EXTENSIONS=""
for ext in extensions/*.js; do
  name="$(basename "$ext")"
  if [ -z "$EXTENSIONS" ]; then
    EXTENSIONS="$name"
  else
    EXTENSIONS="$EXTENSIONS|$name"
  fi
done
[ -n "$EXTENSIONS" ] && spicetify config extensions "$EXTENSIONS" >/dev/null

info "Applying"
spicetify apply

info "Done. aurora is installed."
