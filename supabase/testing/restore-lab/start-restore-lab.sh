#!/bin/sh
# Start, stop, or show status for sendtoanyone-restore-lab.
# Ports 55521-55524 are published on 127.0.0.1 only, through the guarded proxy.
# Does not delete volumes and does not run db reset, db push, or a restore.
# Does not stop, remove, prune, reconfigure, or reset supabase_*_prudhvi
# or itransfer-local-stack containers, networks, or volumes.
set -eu
set -o pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)
cd "$ROOT"
ACTION=${1:-start}

if [ "$ACTION" != "start" ] && [ "$ACTION" != "stop" ] && [ "$ACTION" != "status" ]; then
  echo "Usage: start-restore-lab.sh [start|stop|status]" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  if [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
    PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
    export PATH
  fi
fi

unset DOCKER_HOST
unset SUPABASE_EXPERIMENTAL_STACK

PROJECT=sendtoanyone-restore-lab
NETWORK=sendtoanyone-restore-lab
FOREIGN_NETWORK=itransfer-local-network
ISOLATED_NETWORK=itransfer-isolated
if [ "$NETWORK" = "$FOREIGN_NETWORK" ] || [ "$NETWORK" = "$ISOLATED_NETWORK" ] || [ "$PROJECT" = "itransfer-local-stack" ] || [ "$PROJECT" = "prudhvi" ]; then
  echo "Refusing to use the prudhvi or itransfer-local-stack resources." >&2
  exit 1
fi

REAL_DOCKER_SOCK=/var/run/docker.sock
if [ ! -S "$REAL_DOCKER_SOCK" ]; then
  REAL_DOCKER_SOCK="${HOME}/.docker/run/docker.sock"
fi
if [ ! -S "$REAL_DOCKER_SOCK" ]; then
  echo "Docker socket was not found. The restore lab was not changed." >&2
  exit 1
fi

PROXY_SOCK=$(mktemp -u /tmp/restore-lab.XXXXXX.sock)
node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" \
  --listen "$PROXY_SOCK" \
  --upstream "$REAL_DOCKER_SOCK" \
  --allow-project "$PROJECT" &
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
export DOCKER_HOST="unix://${PROXY_SOCK}"

# The CLI stop command prunes every stopped container. Shutdown stops only
# allowlisted restore-lab containers and does not prune or remove volumes.
stop_restore_lab() {
  raw=$(docker ps -a --filter label=com.supabase.cli.project="$PROJECT" --format '{{.Names}}')
  names=$(printf '%s\n' "$raw" | node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" --restore-lab-stop-names)
  if [ -z "$names" ]; then
    echo "No sendtoanyone-restore-lab containers are present."
    return 0
  fi
  for name in $names; do
    project=$(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "$name")
    if [ "$project" != "$PROJECT" ]; then
      echo "Refusing to stop $name." >&2
      return 1
    fi
  done
  docker stop $names >/dev/null
}

if [ "$ACTION" = "stop" ]; then
  stop_restore_lab
  exit 0
fi

if [ "$ACTION" = "status" ]; then
  supabase --workdir supabase/testing/restore-lab status
  exit 0
fi

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker network create \
    --driver bridge \
    --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
    "$NETWORK"
fi

BINDING=$(docker network inspect -f '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}' "$NETWORK")
if [ "$BINDING" != "127.0.0.1" ]; then
  echo "Network $NETWORK does not set host_binding_ipv4=127.0.0.1 (found: ${BINDING:-empty})." >&2
  echo "Leave that network in place. Do not remove itransfer-local-network or itransfer-isolated." >&2
  exit 1
fi

NETWORK_ID=$(docker network inspect -f '{{.Id}}' "$NETWORK")

# CLI 2.121.0 prunes when this project's containers already exist.
# Remove only verified stopped restore-lab containers, without volumes.
remove_stopped_restore_containers() {
  raw=$(docker ps -a --filter label=com.supabase.cli.project="$PROJECT" --format '{{.Names}}	{{.Status}}	{{.Label "com.supabase.cli.project"}}')
  names=$(printf '%s\n' "$raw" | node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" --restore-lab-remove-stopped-names)
  if [ -z "$names" ]; then
    return 0
  fi
  for name in $names; do
    project=$(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "$name")
    state=$(docker inspect -f '{{.State.Status}}' "$name")
    if [ "$project" != "$PROJECT" ]; then
      echo "Refusing to remove $name." >&2
      return 1
    fi
    case "$state" in
      exited|created|dead) ;;
      *)
        echo "Refusing to remove $name while it is $state." >&2
        return 1
        ;;
    esac
  done
  docker rm $names >/dev/null
}

remove_stopped_restore_containers

set +e
supabase --workdir supabase/testing/restore-lab start --network-id "$NETWORK_ID"
start_status=$?
set -e

exposed=$(node --input-type=module <<'EOF'
import { execFileSync } from 'node:child_process';
import { endpointHost, isPermittedLoopback } from './supabase/testing/local-stack/loopback-publish.mjs';
const ports = [55520, 55521, 55522, 55523, 55524, 55527, 55529, 55583];
const lines = [];
for (const port of ports) {
  let out = '';
  try {
    out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  } catch {
    continue;
  }
  for (const line of out.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const host = endpointHost(line);
    if (!isPermittedLoopback(host)) lines.push(line.trim());
  }
}
process.stdout.write(lines.join('\n'));
EOF
)

if [ -n "$exposed" ]; then
  echo "Restore-lab ports are not limited to loopback. Stopping this project only." >&2
  echo "$exposed" >&2
  stop_restore_lab >/dev/null
  exit 1
fi

if [ "$start_status" -ne 0 ]; then
  exit "$start_status"
fi

echo "Restore-lab listeners for 55521-55524 are limited to loopback."
