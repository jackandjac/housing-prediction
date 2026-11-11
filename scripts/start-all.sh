#!/usr/bin/env bash
# Start all four services in the background, wait until each is healthy, and print the URLs.
#
#   scripts/start-all.sh            # production mode: builds the portal and runs `next start`
#   PORTAL_MODE=dev scripts/start-all.sh
#   scripts/start-all.sh stop       # stop everything started by this script
#
# Ports can be overridden: ML_PORT (8000), ESTIMATOR_PORT (8001), MARKET_PORT (8080), PORTAL_PORT (3000).
# Requires MONGODB_URI (Codespaces injects it; on a Mac it is read from the Keychain via with-secrets.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="${LOG_DIR:-/tmp/housing-logs}"
PIDS="$LOGS/pids"
ML_PORT="${ML_PORT:-8000}"
ESTIMATOR_PORT="${ESTIMATOR_PORT:-8001}"
MARKET_PORT="${MARKET_PORT:-8080}"
PORTAL_PORT="${PORTAL_PORT:-3000}"
PORTAL_MODE="${PORTAL_MODE:-prod}"
mkdir -p "$LOGS" "$PIDS"

stop() {
  for f in "$PIDS"/*.pid; do
    [[ -e "$f" ]] || continue
    pid="$(cat "$f")"
    # Each service runs in its own session; kill the whole group (npm -> next, etc.).
    kill -- "-$pid" 2> /dev/null || { pkill -P "$pid" 2> /dev/null; kill "$pid" 2> /dev/null; } || true
    rm -f "$f"
  done
  echo "stopped"
}

if [[ "${1:-}" == "stop" ]]; then
  stop
  exit 0
fi

if [[ -z "${MONGODB_URI:-}" ]]; then
  exec "$ROOT/scripts/with-secrets.sh" "$0" "$@"
fi

py() { # pick the service venv if present (local dev), else the system python (Codespaces/CI)
  if [[ -x "$ROOT/$1/.venv/bin/python" ]]; then echo "$ROOT/$1/.venv/bin/python"; else command -v python3 || command -v python; fi
}

start() { # name, workdir, command...
  local name="$1" dir="$2"
  shift 2
  if [[ -e "$PIDS/$name.pid" ]] && kill -0 "$(cat "$PIDS/$name.pid")" 2> /dev/null; then
    echo "$name already running"
    return
  fi
  # setsid (Linux) puts the service in its own process group so `stop` can kill npm/next together.
  local detach=()
  command -v setsid > /dev/null 2>&1 && detach=(setsid)
  (cd "$dir" && ${detach[@]+"${detach[@]}"} nohup "$@" > "$LOGS/$name.log" 2>&1 < /dev/null & echo $! > "$PIDS/$name.pid")
}

wait_for() { # name, url, seconds
  for _ in $(seq 1 "$3"); do
    if curl -fs "$2" > /dev/null 2>&1; then
      echo "✓ $1 ready"
      return 0
    fi
    sleep 1
  done
  echo "✗ $1 did not become healthy; last log lines:" >&2
  tail -n 20 "$LOGS/$1.log" >&2 || true
  return 1
}

JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}java"
JAR="$ROOT/market-api/target/market-api.jar"
if [[ ! -f "$JAR" ]]; then
  echo "building market-api jar..."
  (cd "$ROOT/market-api" && ./mvnw -q -B -DskipTests package)
fi

start ml-api "$ROOT/ml-api" "$(py ml-api)" -m uvicorn app.main:create_app --factory --host 0.0.0.0 --port "$ML_PORT"
start estimator-api "$ROOT/estimator-api" env ML_API_URL="http://127.0.0.1:$ML_PORT" \
  "$(py estimator-api)" -m uvicorn app.main:create_app --factory --host 0.0.0.0 --port "$ESTIMATOR_PORT"
start market-api "$ROOT/market-api" env ML_API_URL="http://127.0.0.1:$ML_PORT" PORT="$MARKET_PORT" \
  MARKET_DATASET_PATH="$ROOT/data/House_Price_Dataset.csv" "$JAVA_BIN" -jar "$JAR"

export ESTIMATOR_API_URL="http://127.0.0.1:$ESTIMATOR_PORT" MARKET_API_URL="http://127.0.0.1:$MARKET_PORT" \
  ML_API_URL="http://127.0.0.1:$ML_PORT"
if [[ "$PORTAL_MODE" == "dev" ]]; then
  start portal "$ROOT/portal" npx next dev -p "$PORTAL_PORT"
else
  if [[ ! -d "$ROOT/portal/.next" || "${REBUILD:-0}" == "1" ]]; then
    echo "building portal..."
    (cd "$ROOT/portal" && npx next build > "$LOGS/portal-build.log" 2>&1) || { tail -n 40 "$LOGS/portal-build.log" >&2; exit 1; }
  fi
  start portal "$ROOT/portal" npx next start -p "$PORTAL_PORT"
fi

wait_for ml-api "http://127.0.0.1:$ML_PORT/health" 60
wait_for estimator-api "http://127.0.0.1:$ESTIMATOR_PORT/health" 60
wait_for market-api "http://127.0.0.1:$MARKET_PORT/actuator/health" 90
wait_for portal "http://127.0.0.1:$PORTAL_PORT/" 120

echo
echo "Portal:         http://localhost:$PORTAL_PORT"
echo "ML API docs:    http://localhost:$ML_PORT/docs"
echo "Estimator docs: http://localhost:$ESTIMATOR_PORT/docs"
echo "Market docs:    http://localhost:$MARKET_PORT/swagger-ui.html"
echo "Logs:           $LOGS"
