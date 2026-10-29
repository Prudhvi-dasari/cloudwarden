# Isolated iTransfer Supabase stack

This directory is a separate Supabase CLI project. It is not the repository's `supabase/` project, and it does not contain the eight migrations in `supabase/migrations/`.

The CLI project root is this directory. Its config and migration folder are:

- `supabase/testing/local-stack/supabase/config.toml`
- `supabase/testing/local-stack/supabase/migrations/`

That nested `supabase/` directory is what makes `--workdir supabase/testing/local-stack` stop here. A config placed directly in this folder would still be ignored, and a command run from the repository root would keep using `supabase/config.toml`.

`supabase/testing/itransfer-local.sql` stays outside this migration folder. Do not copy it here and do not copy the repository migrations here.

Nothing in these npm scripts starts the stack by itself:

```bash
npm run supabase:isolated:start
npm run supabase:isolated:status
npm run supabase:isolated:stop
```

The `supabase` command was not installed when this workdir was added. Docker was not on `PATH` either. Install both before the first start. Do not run `supabase start`, `supabase db reset`, or `supabase db push` from the repository root.

## Ports

| Service | Loopback URL |
| --- | --- |
| API | `http://127.0.0.1:55421` |
| Database | `127.0.0.1:55422` |
| Studio | `http://127.0.0.1:55423` |

These ports are intentionally different from the repository config, which uses `54321` and `54322`. Homebrew Postgres on this machine was listening on `5432`.

Auth redirects are limited to `http://127.0.0.1:5173`. Studio's API URL is `http://127.0.0.1`. Realtime is set to IPv4. Local mail listens on port `55424`.

`npm run supabase:isolated:start` runs `supabase/testing/local-stack/start-isolated.sh`. That script creates the Docker bridge `itransfer-isolated` with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` when it is missing, then starts the CLI with `--network-id` set to that network. Supabase CLI 2.121.0 (`supabase-go`) still creates containers through the Docker API with an empty `HostIp`, which means `0.0.0.0`. `config.toml` has no bind field. Do not invent a bind key. `db.network_restrictions` stays disabled because that section can target a linked remote project.

The bridge option does not keep the ports on loopback on Docker Desktop for Mac 29.8.2. A start on 23 October 2026 joined `itransfer-isolated`, then `lsof` showed `com.docker` listening on `*:55421`, `*:55422`, `*:55423`, and `*:55424`. The script stopped that project. Volumes were kept.

The start script unsets `SUPABASE_EXPERIMENTAL_STACK` so the experimental stack owner cannot address the prudhvi containers, then sets `DOCKER_HOST` only for the classic Supabase CLI process. That socket is a local proxy, `loopback-publish.mjs`, which rewrites every `HostIp` on container create and leaves the host port the CLI chose:

| Service | Host binding |
| --- | --- |
| API | `127.0.0.1:55421` |
| Database | `127.0.0.1:55422` |
| Studio | `127.0.0.1:55423` |
| Local SMTP | `127.0.0.1:55424` |
| Shadow database, when the CLI publishes it | `127.0.0.1:55420` |
| Pooler, analytics, and edge inspector are disabled | `127.0.0.1:55429`, `127.0.0.1:55427`, and `127.0.0.1:55483` only if a later CLI version publishes them |

An empty host, `0.0.0.0`, `::`, or `[::]` becomes `127.0.0.1`. An explicit `::1` stays `::1`. The proxy does not add a second `[::1]` publish, because Docker treats two binds of the same container port as a conflict. The Mac failure was the wildcard `*` listener. Any other host port the CLI publishes on that create is rewritten the same way.

The proxy refuses any request whose path or body names a `supabase_*_prudhvi` container, the prudhvi project label, or `itransfer-local-network`. It also refuses network deletes, volume deletes, and every prune call, including a project-filtered container prune and a delete of `itransfer-isolated`.

`npm run supabase:isolated:stop` does not call `supabase stop`. CLI 2.121.0 follows that command with `POST /containers/prune` and no project filter. The proxy still refuses that request, because an unfiltered prune would remove the exited `supabase_edge_runtime_prudhvi` container. Shutdown lists containers labeled `com.supabase.cli.project=itransfer-local-stack`, keeps only names matching `supabase_*_itransfer-local-stack`, checks the label again, and runs `docker stop` on that list. It does not remove containers, volumes, or networks. Running it again is a successful no-op.

If `lsof` then shows any of ports `55420`, `55421`, `55422`, `55423`, `55424`, `55427`, `55429`, or `55483` listening on a host other than `127.0.0.1` or `[::1]`, the script stops `itransfer-local-stack` only and exits. The database volume is kept. `itransfer-local-network` holds the separate `supabase_*_prudhvi` containers. This project does not use that network and does not stop those containers. MinIO is separate: the Homebrew binary listens on `127.0.0.1:9000` and `[::1]:9000`, with bucket `itransfer-local`.

## Manual Docker check

This check was run on 23 October 2026. `lsof` showed only:

```text
TCP 127.0.0.1:55421 (LISTEN)
TCP 127.0.0.1:55422 (LISTEN)
TCP 127.0.0.1:55423 (LISTEN)
TCP 127.0.0.1:55424 (LISTEN)
```

Port `55420` was not published. The container inspect for Kong, the database, Studio, and Inbucket stored `HostIp` `127.0.0.1` on network `itransfer-isolated`. Auth health returned HTTP 200. The database `data_directory` was `/var/lib/postgresql/data` through host port `55422`. `supabase_migrations.schema_migrations` and `public.group_posts` were absent. The restored volume already had `public.transfers` and `reserve_transfer_file`. `20261023004500_platform_storage_cap_and_download_slot.sql` was applied to that local database only, adding `claim_download_slot` and `release_download_slot`.

`tests/isolated-live.test.mjs` and `tests/isolated-auth.test.mjs` passed with `ITRANSFER_E2E=1`, one file at a time. The prudhvi containers, `itransfer-local-network`, and all five volumes were unchanged. Stop left the isolated containers exited and the listeners closed. `npm run supabase:isolated:stop` then exited 1 because that version of the command called `supabase stop`, and the CLI asked to prune containers. The proxy refused. That refusal keeps the exited `supabase_edge_runtime_prudhvi` container. Do not prune. Shutdown now stops the allowlisted containers directly. A later run of the same stack exited 0, released `55421`–`55424`, and a second stop also exited 0. With the stopped containers still present, two later `npm run supabase:isolated:start` runs each exited 0 and listened only on `127.0.0.1:55421` through `127.0.0.1:55424`. Both following stops exited 0. The volumes and the prudhvi containers stayed in place.

Repeat the check with these steps:

1. Note the running `supabase_*_prudhvi` containers and leave them running. Do not stop them, and do not remove `itransfer-local-network` or any volume.
2. Run `npm run supabase:isolated:start`. The script unsets `SUPABASE_EXPERIMENTAL_STACK`. Before the CLI starts, it removes stopped containers whose name is `supabase_*_itransfer-local-stack` and whose label is `com.supabase.cli.project=itransfer-local-stack`. `docker rm` has no `-v`, so volumes and networks stay. Running containers are left in place. A mismatched label or a `supabase_*_prudhvi` name aborts startup before anything is removed.
3. Confirm `lsof -nP -iTCP:55421 -sTCP:LISTEN` and the same command for `55422`, `55423`, and `55424` show `127.0.0.1` only. A `*` or `[::]` listener means the script should have stopped this project. If it did not, stop with `npm run supabase:isolated:stop` and do not continue.
4. Confirm the prudhvi containers from step 1 are still running and their ports are still `54321`–`54327`.
5. Run the live tests only after that loopback check passes. Do not reset volumes. Apply SQL only to `127.0.0.1:55422`.
6. Stop with `npm run supabase:isolated:stop`. The command exits 0 after `docker stop` of the allowlisted containers. It does not prune.

## Safe startup

1. Copy `env/isolated.example` to `env/isolated/.env`.
2. Start this project only through `npm run supabase:isolated:start`. Stopped containers left by the previous isolated run are removed without their volumes before the CLI starts. CLI 2.121.0 otherwise enters `DockerRemoveAll` and sends an unfiltered container prune, which the proxy still refuses.
3. Run `npm run supabase:isolated:status` and copy the local API URL, publishable key, and service-role key into `env/isolated/.env`. Do not copy a remote key.
4. Apply only the standalone fixture, using the database URL from that status output:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:55422/postgres" \
  -f supabase/testing/itransfer-local.sql
```

The local database password is the CLI default unless `status` prints a different URL. Do not point `psql` at the remote database.

5. Start MinIO on loopback and create the non-production bucket named in the env file:

```bash
docker run --rm -d --name itransfer-minio \
  -p 127.0.0.1:9000:9000 \
  -e MINIO_ROOT_USER=local-access \
  -e MINIO_ROOT_PASSWORD=local-secret \
  minio/minio server /data
```

Create the bucket `itransfer-local` with those same local credentials. Put the matching endpoint, region, account, access key, secret, and bucket in `env/isolated/.env`.

6. Start the app with `npm run dev:isolated`.

Required names in `env/isolated/.env`:

- `SUPABASE_URL=http://127.0.0.1:55421`
- `VITE_SUPABASE_URL=http://127.0.0.1:55421`
- `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_R2_ENDPOINT=http://127.0.0.1:9000`
- `CLOUDFLARE_R2_REGION=us-east-1`
- `CLOUDFLARE_R2_BUCKET=itransfer-local`
- `APP_URL=http://127.0.0.1:5173`

Leave `RESEND_API_KEY` unset. `CLEANUP_SECRET` may be set only to a `local-` prefixed test value so `/api/r2?action=cleanup` uses the same `x-cleanup-secret` check as production. Do not paste the production secret. Stop the stack with `npm run supabase:isolated:stop`.

## Repeatable local run

On this machine the Docker client is inside Docker.app until that app is running, so `supabase` needs it on `PATH`:

```bash
open -a Docker
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
npm run supabase:isolated:start
```

Confirm `npm run supabase:isolated:status` shows API `127.0.0.1:55421` and database `127.0.0.1:55422` before copying those local keys into `env/isolated/.env`. The database process inside the container reports port 5432; the host port is still 55422. Do not apply SQL until the client URL is that host port and `data_directory` is `/var/lib/postgresql/data`.

The isolated CLI migration folder stays empty. After the first start, apply the fixture and then the reservation function to that local database only:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:55422/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/testing/itransfer-local.sql \
  -f supabase/migrations/20261022193000_reserve_transfer_file.sql
```

`minio/minio` is no longer pullable from Docker Hub here. Run the Homebrew `minio` binary on loopback instead of `brew services`, with the local access key and secret from `env/isolated.example`, and create the bucket `itransfer-local`.

Port 5173 may already be the ordinary `npm run dev` server. That server answers `/api/r2` with `LOCAL_API_DISABLED`. Start the isolated app on 5174 when 5173 is taken:

```bash
ITRANSFER_ISOLATED=1 ./node_modules/.bin/vite --host 127.0.0.1 --port 5174 --strictPort
```

Create a local account with the isolated Auth API (`POST http://127.0.0.1:55421/auth/v1/signup`). Confirmations are off in this stack, so the response includes a session. Delete that user afterward with the local admin API. Do not use a production account.

`tests/isolated-live.test.mjs` and `tests/isolated-auth.test.mjs` talk to these local services only when `ITRANSFER_E2E=1` is set, and they refuse any non-loopback URL. `node --test tests/*.mjs` skips them otherwise. Cleanup goes through the isolated Vite route with the local `CLEANUP_SECRET`. A missing or wrong `x-cleanup-secret` header is rejected. The production secret stays out of this environment.

Stop MinIO, then run `npm run supabase:isolated:stop`. That stops the local containers. It does not touch the remote project. Do not run `supabase db reset` or `supabase db push` from the repository root.
