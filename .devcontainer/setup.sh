#!/usr/bin/env bash
# One-time Codespace setup: dependencies for all services, Java jar and portal production build.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pip install --user -r ml-api/requirements-dev.txt -r estimator-api/requirements-dev.txt
(cd portal && npm ci && npx next build)
(cd market-api && ./mvnw -q -B -DskipTests package)
echo "setup complete"
