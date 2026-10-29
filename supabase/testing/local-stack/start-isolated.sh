#!/bin/sh
# Start or stop the isolated Supabase stack.
# Host ports are published on 127.0.0.1 only.
# Does not delete volumes and does not run db reset or db push.
# Does not stop, reconfigure, or delete the prudhvi Supabase containers,
# itransfer-local-network, or their volumes.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)
cd "$ROOT"
ACTION=${1:-start}

if [ "$ACTION" != "start" ] && [ "$ACTION" != "stop" ]; then
  echo "Usage: start-isolated.sh [start|stop]" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  if [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
    PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
    export PATH
  fi
fi

# A parent DOCKER_HOST must not redirect the network commands. The Supabase
# CLI receives its own DOCKER_HOST further down.
unset DOCKER_HOST
# The experimental stack owner addresses other local projects. This command
# stays on the classic CLI for itransfer-local-stack.
unset SUPABASE_EXPERIMENTAL_STACK

NETWORK=itransfer-isolated
FOREIGN_NETWORK=itransfer-local-network
if [ "$NETWORK" = "$FOREIGN_NETWORK" ]; then
  echo "Refusing to use $FOREIGN_NETWORK." >&2
  exit 1
fi

REAL_DOCKER_SOCK=/var/run/docker.sock
if [ ! -S "$REAL_DOCKER_SOCK" ]; then
  REAL_DOCKER_SOCK="${HOME}/.docker/run/docker.sock"
fi
if [ ! -S "$REAL_DOCKER_SOCK" ]; then
  echo "Docker socket was not found. The isolated stack was not changed." >&2
  exit 1
fi

# supabase stop in CLI 2.121.0 prunes every stopped container after the
# project stop. That unfiltered prune is refused. Shutdown stops only
# allowlisted itransfer-local-stack containers and does not prune.
stop_isolated_project() {
  raw=$(docker ps -a --filter label=com.supabase.cli.project=itransfer-local-stack --format '{{.Names}}')
  names=$(printf '%s\n' "$raw" | node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" --stop-names)
  if [ -z "$names" ]; then
    echo "No itransfer-local-stack containers are present."
    return 0
  fi
  for name in $names; do
    project=$(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "$name")
    if [ "$project" != "itransfer-local-stack" ]; then
      echo "Refusing to stop $name." >&2
      return 1
    fi
  done
  docker stop $names >/dev/null
}

if [ "$ACTION" = "stop" ]; then
  stop_isolated_project
  exit 0
fi

PROXY_SOCK=$(mktemp -u "${TMPDIR:-/tmp}/itransfer-isolated-docker.XXXXXX.sock")
node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" \
  --listen "$PROXY_SOCK" \
  --upstream "$REAL_DOCKER_SOCK" &
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

# Network setup uses the normal docker CLI. The proxy is only for the CLI
# process that creates this project's containers.
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker network create \
    --driver bridge \
    --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
    "$NETWORK"
fi

BINDING=$(docker network inspect -f '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}' "$NETWORK")
if [ "$BINDING" != "127.0.0.1" ]; then
  echo "Network $NETWORK does not set host_binding_ipv4=127.0.0.1 (found: ${BINDING:-empty})." >&2
  echo "Leave that network in place. Do not remove itransfer-local-network." >&2
  exit 1
fi

NETWORK_ID=$(docker network inspect -f '{{.Id}}' "$NETWORK")

# CLI 2.121.0 enters DockerRemoveAll when this project's containers already
# exist. That path prunes every stopped container on the machine, which the
# proxy refuses. Remove only verified stopped itransfer-local-stack containers
# first, without volumes, so startup does not take that path.
remove_stopped_isolated_containers() {
  raw=$(docker ps -a --filter label=com.supabase.cli.project=itransfer-local-stack --format '{{.Names}}	{{.Status}}	{{.Label "com.supabase.cli.project"}}')
  names=$(printf '%s\n' "$raw" | node "$ROOT/supabase/testing/local-stack/loopback-publish.mjs" --remove-stopped-names)
  if [ -z "$names" ]; then
    return 0
  fi
  for name in $names; do
    project=$(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "$name")
    state=$(docker inspect -f '{{.State.Status}}' "$name")
    if [ "$project" != "itransfer-local-stack" ]; then
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

remove_stopped_isolated_containers

# supabase-go publishes ports with an empty HostIp. The proxy rewrites those
# creates to 127.0.0.1. DOCKER_HOST applies to this CLI process alone.
set +e
DOCKER_HOST="unix://${PROXY_SOCK}" \
  supabase --workdir supabase/testing/local-stack start --network-id "$NETWORK_ID"
start_status=$?
set -e

# Stop this project only. The name allowlist keeps the stop on itransfer-local-stack.
exposed=$(node --input-type=module <<'EOF'
import { execFileSync } from 'node:child_process';
import { endpointHost, isPermittedLoopback } from './supabase/testing/local-stack/loopback-publish.mjs';
const ports = [55420, 55421, 55422, 55423, 55424, 55427, 55429, 55483];
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
  echo "Isolated Supabase ports are not limited to loopback. Stopping this project only." >&2
  echo "$exposed" >&2
  stop_isolated_project >/dev/null
  exit 1
fi

if [ "$start_status" -ne 0 ]; then
  exit "$start_status"
fi

echo "Isolated Supabase listeners are limited to loopback."
