#!/usr/bin/env bash
# Starts the ML API in the background (logs: /tmp/ml-api.log) and waits until it is healthy.
# Runs on every Codespace start; safe to run again by hand.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8000}"
LOG=/tmp/ml-api.log

if curl -fs "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
  echo "ML API already running on port ${PORT}"
else
  cd "$ROOT/ml-api"
  # setsid + nohup: keep the server alive after this start hook exits.
  setsid nohup python -m uvicorn app.main:create_app --factory \
    --host 0.0.0.0 --port "$PORT" --workers 1 > "$LOG" 2>&1 < /dev/null &

  for _ in $(seq 1 60); do
    curl -fs "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1 && break
    sleep 1
  done
  if ! curl -fs "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
    echo "ML API did not become healthy; see $LOG" >&2
    tail -n 30 "$LOG" >&2 || true
    exit 1
  fi
  echo "ML API started on port ${PORT} (logs: $LOG)"
fi

# Make the port reachable without a GitHub login, for interviewers. Best effort:
# if this is refused, set it by hand in the PORTS tab (right-click > Port Visibility > Public).
if [[ -n "${CODESPACE_NAME:-}" ]]; then
  if gh codespace ports visibility "${PORT}:public" -c "$CODESPACE_NAME" > /dev/null 2>&1; then
    echo "Port ${PORT} is public"
  else
    echo "Could not make port ${PORT} public automatically; set it in the PORTS tab."
  fi
  echo "Swagger: https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}/docs"
fi
