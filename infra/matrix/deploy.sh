#!/usr/bin/env bash
# Run from the private bundle directory on your Linux host. Never curl | sh.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for command in node docker; do
  command -v "$command" >/dev/null || { echo "Install Node.js 20+ and Docker with Compose first." >&2; exit 1; }
done
[[ -f .env && -f generated/homeserver.yaml ]] || { echo "Run configure.mjs with your hostname first." >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
# Quiet validation avoids printing interpolated database credentials.
docker compose config --quiet
echo "Starting persistent Synapse/PostgreSQL and HTTPS proxy. DNS must already point here."
docker compose up -d --wait --wait-timeout 300
server=$(node --input-type=module -e 'import {readFileSync} from "node:fs";const env=readFileSync(".env","utf8");const match=env.match(/^MATRIX_SERVER_NAME=([a-zA-Z0-9.-]+)$/m);if(!match)process.exit(1);process.stdout.write(match[1]);')
node check.mjs "https://${server}"
echo "Next: create test accounts with docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
echo "Back up the database, media and signing key before inviting users."
