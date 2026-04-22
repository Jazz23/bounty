#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env.local to get AGENT_IMAGE
set -a
. "$SCRIPT_DIR/.env.local"
set +a

if [ -z "$AGENT_IMAGE" ]; then
  echo "AGENT_IMAGE is not set in .env.local"
  exit 1
fi

docker run --rm \
  --env-file "$SCRIPT_DIR/.env.local" \
  -v "$SCRIPT_DIR/src:/app/src" \
  -v "$SCRIPT_DIR/node_modules:/app/node_modules" \
  -v "$SCRIPT_DIR/package.json:/app/package.json" \
  "$AGENT_IMAGE" "$@"
