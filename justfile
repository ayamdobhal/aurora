# Build and deploy theme + extensions to spicetify, then apply (default)
default: deploy

# Build and deploy theme + extensions to spicetify, then apply
deploy: build
    bash scripts/deploy.sh

# Compile TypeScript extensions to JS only
build:
    bash scripts/build.sh

# Watch for source changes and auto-deploy (requires fswatch)
watch:
    fswatch -o theme/ src/ | xargs -n1 -I{} just deploy

# Type-check without building
check:
    tsc --noEmit

# Open spicetify config
config:
    spicetify config

# Restore spotify to vanilla
restore:
    spicetify restore
