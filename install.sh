#!/usr/bin/env bash
# aurora — one-shot installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ayamdobhal/aurora/main/install.sh | bash

set -euo pipefail

RELEASE_URL="https://github.com/ayamdobhal/aurora/releases/latest/download/aurora.tar.gz"
THEME_NAME="aurora"
SPICETIFY_DIR=""

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"
}

need spicetify "Install from https://spicetify.app"
need curl      "Install curl and retry"
need tar       "Install tar and retry"

CONFIG_FILE="$(spicetify -c)"
[ -f "$CONFIG_FILE" ] || die "Spicetify config not found: $CONFIG_FILE. Run spicetify once first."
SPICETIFY_DIR="$(dirname "$CONFIG_FILE")"

[ -d "$SPICETIFY_DIR" ] || die "Spicetify config not found at $SPICETIFY_DIR. Run 'spicetify' once first."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

info "Downloading latest aurora release"
curl -fsSL -o "$TMP/aurora.tar.gz" "$RELEASE_URL"

info "Extracting"
mkdir -p "$TMP/aurora"
tar -xzf "$TMP/aurora.tar.gz" -C "$TMP/aurora"

[ -s "$TMP/aurora/theme/user.css" ] && [ -f "$TMP/aurora/theme/color.ini" ] || die "Downloaded archive has no valid Aurora theme"
[ -s "$TMP/aurora/BUILD.txt" ] || die "Downloaded archive has no build revision; retry after the new release finishes"
set -- "$TMP/aurora/extensions/"*.js
[ -f "$1" ] || die "Downloaded archive has no built extensions"
REVISION="$(cat "$TMP/aurora/BUILD.txt")"
info "Installing Aurora revision $REVISION"
MANIFEST="$SPICETIFY_DIR/Themes/$THEME_NAME/.aurora-extensions"
PREVIOUS_EXTENSIONS=""
[ ! -f "$MANIFEST" ] || PREVIOUS_EXTENSIONS="$(cat "$MANIFEST")"

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

while IFS= read -r ext; do
  case "$ext" in
    ""|*/*|*\\*|*"|"*) continue ;;
    *.js) ;;
    *) continue ;;
  esac
  if [ ! -f "$TMP/aurora/extensions/$ext" ]; then
    spicetify config extensions "$ext-" >/dev/null
  fi
done <<< "$PREVIOUS_EXTENSIONS"
printf '%s\n' "$EXTENSIONS" | tr '|' '\n' > "$MANIFEST"

info "Applying"
spicetify apply

cp "$TMP/aurora/BUILD.txt" "$SPICETIFY_DIR/Themes/$THEME_NAME/.aurora-build"
info "Done. Aurora $REVISION is installed."
