#!/bin/sh
set -e

echo "[entrypoint] Generating runtime config"

API_BASE="${API_BASE:-http://localhost:8000}"

sed "s|__API_BASE__|$API_BASE|g" \
    /app/build/client/config.template.json \
    > /app/build/client/config.json

echo "[entrypoint] Using API_BASE = $API_BASE"

# KLUCZOWE:
exec "$@"
