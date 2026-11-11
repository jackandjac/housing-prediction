#!/usr/bin/env bash
# Run a command with MONGODB_URI set, without the value ever being printed or written to disk.
#
#   scripts/with-secrets.sh pytest
#   scripts/with-secrets.sh docker compose up
#
# Uses MONGODB_URI from the environment if already set (Codespaces injects it from the
# repo's Codespaces secret); otherwise reads it from the macOS Keychain entry created with:
#   security add-generic-password -a "$USER" -s housing-prediction/MONGODB_URI -w
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 2
fi

if [[ -z "${MONGODB_URI:-}" ]] && command -v security > /dev/null 2>&1; then
  MONGODB_URI="$(security find-generic-password -a "$USER" -s housing-prediction/MONGODB_URI -w 2> /dev/null || true)"
fi

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is not set and no Keychain entry 'housing-prediction/MONGODB_URI' was found." >&2
  exit 1
fi

export MONGODB_URI
exec "$@"
