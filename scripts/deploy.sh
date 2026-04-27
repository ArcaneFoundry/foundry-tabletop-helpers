#!/usr/bin/env bash

set -euo pipefail

REMOTE="${REMOTE:-root@foundry.digitalframeworks.org}"
REMOTE_DIR="${REMOTE_DIR:-/var/foundrydata/Data/modules/foundry-tabletop-helpers}"

npm run build

ssh "$REMOTE" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete dist/ "$REMOTE:$REMOTE_DIR/"
ssh "$REMOTE" "chown -R foundry:foundry '$REMOTE_DIR'"

echo "✓ Deployed foundry-tabletop-helpers."
