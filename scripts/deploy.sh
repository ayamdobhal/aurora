#!/usr/bin/env bash
set -euo pipefail

SPICETIFY_DIR="${SPICETIFY_DIR:-$HOME/.config/spicetify}"
THEME_NAME="aurora"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Only a previous Aurora deployment can establish ownership. Never infer it
# from the global extension list: that also includes unrelated extensions.
MANIFEST="$SPICETIFY_DIR/Themes/$THEME_NAME/.aurora-extensions"
PREVIOUS_EXTENSIONS=""
if [ -f "$MANIFEST" ]; then
  PREVIOUS_EXTENSIONS="$(cat "$MANIFEST")"
fi
mkdir -p "$SPICETIFY_DIR/Themes" "$SPICETIFY_DIR/Extensions"

echo "Deploying theme..."
rm -rf "$SPICETIFY_DIR/Themes/$THEME_NAME"
cp -r "$PROJECT_DIR/theme" "$SPICETIFY_DIR/Themes/$THEME_NAME"

echo "Deploying extensions..."
for ext in "$PROJECT_DIR/extensions"/*.js; do
  [ -f "$ext" ] || continue
  cp "$ext" "$SPICETIFY_DIR/Extensions/"
  echo "  Copied $(basename "$ext")"
done

echo "Applying spicetify config..."
spicetify config current_theme "$THEME_NAME"

# Prune only names recorded by our previous deployment.
while IFS= read -r ext; do
  case "$ext" in
    ""|*/*|*\\*|*"|"*) continue ;;
    *.js) ;;
    *) continue ;;
  esac
  if [ ! -f "$PROJECT_DIR/extensions/$ext" ]; then
    echo "  Removing stale Aurora extension: $ext"
    spicetify config extensions "$ext-"
  fi
done <<< "$PREVIOUS_EXTENSIONS"

# Collect extension names from current extensions/ dir
EXTENSIONS=""
for ext in "$PROJECT_DIR/extensions"/*.js; do
  [ -f "$ext" ] || continue
  name="$(basename "$ext")"
  if [ -z "$EXTENSIONS" ]; then
    EXTENSIONS="$name"
  else
    EXTENSIONS="$EXTENSIONS|$name"
  fi
done

if [ -n "$EXTENSIONS" ]; then
  spicetify config extensions "$EXTENSIONS"
fi

# Persist ownership after configuration succeeds.
: > "$MANIFEST"
for ext in "$PROJECT_DIR/extensions"/*.js; do
  [ -f "$ext" ] || continue
  basename "$ext" >> "$MANIFEST"
done

spicetify apply

echo "Done!"
