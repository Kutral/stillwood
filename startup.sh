#!/bin/sh
# Stillwood dev server restart contract.
# Idempotent: exits 0 if the app already answers on :8080, otherwise starts it.
set -eu
cd "$(dirname "$0")"
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>"$(pwd)/dev-server.log" 2>&1 &
