#!/usr/bin/env bash
set -euo pipefail

SPICETIFY_DIR="$HOME/.config/spicetify"
THEME_NAME="aurora"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

# `spicetify config extensions X|Y` is additive — it never removes entries
# whose source files we've deleted. Explicitly prune stale names from the
# current config before re-adding so the list stays in sync with extensions/.
CONFIG_FILE="$HOME/.config/spicetify/config-xpui.ini"
if [ -f "$CONFIG_FILE" ]; then
  current=$(grep -E "^extensions\s*=" "$CONFIG_FILE" | sed -E 's/^extensions\s*=\s*//')
  IFS='|' read -ra CURR <<< "$current"
  for ext in "${CURR[@]}"; do
    ext="$(echo "$ext" | tr -d '[:space:]')"
    [ -z "$ext" ] && continue
    if [ ! -f "$PROJECT_DIR/extensions/$ext" ]; then
      echo "  Removing stale extension: $ext"
      spicetify config extensions "$ext-" >/dev/null 2>&1 || true
    fi
  done
fi

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

spicetify apply

echo "Done!"
