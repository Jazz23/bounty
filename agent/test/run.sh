#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
. "$AGENT_DIR/.env.local"
set +a

IMAGE="${AGENT_IMAGE:-bounty-agent:dev}"

if ! docker image inspect "$IMAGE" > /dev/null 2>&1; then
  echo "Building $IMAGE..."
  docker build -f "$SCRIPT_DIR/Dockerfile.dev" -t "$IMAGE" "$AGENT_DIR"
fi

docker run --rm \
  --env-file "$AGENT_DIR/.env.local" \
  -v "$AGENT_DIR/src:/app/src" \
  "$IMAGE" "$@"
