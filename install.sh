#!/usr/bin/env bash
# aurora — one-shot installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.sh | bash

set -euo pipefail

RELEASE_URL="https://github.com/ayamdobhal/aurora/releases/latest/download/aurora.zip"
THEME_NAME="aurora"
SPICETIFY_DIR="$HOME/.config/spicetify"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"
}

need spicetify "Install from https://spicetify.app"
need curl      "Install curl and retry"
need unzip     "Install unzip and retry"

[ -d "$SPICETIFY_DIR" ] || die "Spicetify config not found at $SPICETIFY_DIR. Run 'spicetify' once first."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

info "Downloading latest aurora release"
curl -fsSL -o "$TMP/aurora.zip" "$RELEASE_URL"

info "Extracting"
unzip -q "$TMP/aurora.zip" -d "$TMP/aurora"

info "Copying theme to $SPICETIFY_DIR/Themes/$THEME_NAME"
mkdir -p "$SPICETIFY_DIR/Themes"
rm -rf "$SPICETIFY_DIR/Themes/$THEME_NAME"
cp -r "$TMP/aurora/theme" "$SPICETIFY_DIR/Themes/$THEME_NAME"

info "Copying extensions to $SPICETIFY_DIR/Extensions"
mkdir -p "$SPICETIFY_DIR/Extensions"
for ext in "$TMP/aurora/extensions/"*.js; do
  cp "$ext" "$SPICETIFY_DIR/Extensions/"
done

info "Configuring spicetify"
spicetify config current_theme "$THEME_NAME" >/dev/null

EXTENSIONS=""
for ext in "$TMP/aurora/extensions/"*.js; do
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
