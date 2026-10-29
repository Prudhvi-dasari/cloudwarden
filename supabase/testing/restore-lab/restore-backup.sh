#!/bin/sh
# Replay the 23 October 2026 logical backup into the local restore lab.
# Does not start the Supabase containers, apply repository migrations, or contact production.
# Each SQL file runs in one transaction and stops on the first error.
# The next file does not run after a failure.
set -eu
set -o pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)
cd "$ROOT"

if [ "${RESTORE_LAB_CONFIRM:-}" != "sendtoanyone-restore-lab" ]; then
  echo "Refusing to restore. Start the lab, confirm 127.0.0.1:55522, then set RESTORE_LAB_CONFIRM=sendtoanyone-restore-lab." >&2
  exit 1
fi

BACKUP=${RESTORE_BACKUP_DIR:-"$HOME/secure-backups/sendtoanyone-20261023-123933"}
case "$BACKUP" in
  */) BACKUP=${BACKUP%/} ;;
esac
if [ "$(basename "$BACKUP")" != "sendtoanyone-20261023-123933" ]; then
  echo "Refusing a backup directory whose name is not sendtoanyone-20261023-123933." >&2
  exit 1
fi

for file in roles.sql schema.sql data.sql SHA256SUMS.txt; do
  if [ ! -f "$BACKUP/$file" ]; then
    echo "Missing $file in the backup directory." >&2
    exit 1
  fi
done

node "$ROOT/supabase/testing/restore-lab/backup-sums.mjs" "$BACKUP"

echo "Checking backup checksums"
shasum -a 256 -c "$BACKUP/SHA256SUMS.txt"

node --input-type=module <<'EOF'
import { execFileSync } from 'node:child_process'
import { endpointHost, isPermittedLoopback } from './supabase/testing/local-stack/loopback-publish.mjs'
const ports = [55521, 55522, 55523, 55524]
for (const port of ports) {
  let out = ''
  try {
    out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  } catch {
    process.stderr.write(`Refusing to restore. Nothing is listening on 127.0.0.1:${port}.\n`)
    process.exit(1)
  }
  const listeners = out.split('\n').slice(1).map((line) => line.trim()).filter(Boolean)
  if (listeners.length === 0) {
    process.stderr.write(`Refusing to restore. Nothing is listening on 127.0.0.1:${port}.\n`)
    process.exit(1)
  }
  for (const line of listeners) {
    if (!isPermittedLoopback(endpointHost(line))) {
      process.stderr.write(`Refusing to restore. Port ${port} is not limited to loopback.\n`)
      process.exit(1)
    }
  }
}
EOF

if ! command -v docker >/dev/null 2>&1; then
  if [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
    PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
    export PATH
  fi
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. The restore was not started." >&2
  exit 1
fi

unset DOCKER_HOST
unset SUPABASE_EXPERIMENTAL_STACK
REAL_DOCKER_SOCK=/var/run/docker.sock
if [ ! -S "$REAL_DOCKER_SOCK" ]; then
  REAL_DOCKER_SOCK="${HOME}/.docker/run/docker.sock"
fi
if [ ! -S "$REAL_DOCKER_SOCK" ]; then
  echo "Docker socket was not found. The restore was not started." >&2
  exit 1
fi

PROXY_SOCK=$(mktemp -u /tmp/restore-lab.XXXXXX.sock)
node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" \
  --listen "$PROXY_SOCK" \
  --upstream "$REAL_DOCKER_SOCK" \
  --allow-project sendtoanyone-restore-lab &
PROXY_PID=$!
i=0
while [ ! -S "$PROXY_SOCK" ]; do
  i=$((i + 1))
  if [ "$i" -gt 50 ]; then
    kill "$PROXY_PID" >/dev/null 2>&1 || true
    echo "The loopback Docker proxy did not start." >&2
    exit 1
  fi
  sleep 0.1
done
cleanup_proxy() {
  kill "$PROXY_PID" >/dev/null 2>&1 || true
  rm -f "$PROXY_SOCK"
}
trap cleanup_proxy EXIT INT TERM

status_file=$(mktemp /tmp/restore-lab-status.XXXXXX)
chmod 600 "$status_file"
cleanup_status() {
  rm -f "$status_file"
}
trap 'cleanup_proxy; cleanup_status' EXIT INT TERM
DOCKER_HOST="unix://${PROXY_SOCK}" supabase --workdir supabase/testing/restore-lab status -o env > "$status_file"
DB_URL=$(node "$ROOT/supabase/testing/restore-lab/local-db-url.mjs" "$status_file")
cleanup_status
cleanup_proxy
trap - EXIT INT TERM
unset DOCKER_HOST

replay() {
  echo "Replaying $(basename "$1")"
  psql "$DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f "$1"
}

replay "$BACKUP/roles.sql"
replay "$BACKUP/schema.sql"
replay "$BACKUP/data.sql"

echo "Checking public.transfers"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/testing/restore-lab/check-transfers.sql"
unset DB_URL
