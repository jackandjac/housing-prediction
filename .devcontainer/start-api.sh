#!/usr/bin/env bash
# Runs on every Codespace start: starts all services and makes the portal reachable for interviewers.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is not set. Add it as a Codespaces secret for this repository, then rebuild the Codespace." >&2
  exit 1
fi

bash "$ROOT/scripts/start-all.sh"

# Only the portal is made public; the backends stay private (the portal calls them on localhost).
if [[ -n "${CODESPACE_NAME:-}" ]]; then
  if gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" > /dev/null 2>&1; then
    echo "Port 3000 is public"
  else
    echo "Could not make port 3000 public automatically; set it in the PORTS tab (right-click > Port Visibility > Public)."
  fi
  echo "Portal: https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi
