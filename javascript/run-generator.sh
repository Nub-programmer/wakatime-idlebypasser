#!/usr/bin/env bash
# Supervisor loop to keep the generator running. Restart on exit.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GENERATOR="$SCRIPT_DIR/random-js-generator.js"
cd "$PROJECT_ROOT"
while true; do
  echo "[$(date +'%F %T')] Starting generator: $GENERATOR"
  node "$GENERATOR" || echo "[$(date +'%F %T')] Generator exited with code $? — restarting in 1s"
  sleep 1
done
