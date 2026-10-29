# Restore lab

This is a disposable local Supabase project named `sendtoanyone-restore-lab`. It is separate from `itransfer-local-stack` and from the `supabase_*_prudhvi` stack. It has its own containers, the Docker network `sendtoanyone-restore-lab`, and its own volumes.

The CLI workdir is this directory. Its config is `supabase/testing/restore-lab/supabase/config.toml`. That nested `supabase/` directory is where the CLI stops, so `supabase start` here does not read `supabase/migrations/` from the repository. `[db.migrations] enabled` is false, `[db.seed] enabled` is false, and `supabase/migrations/` in this project is empty. Do not copy the repository migrations here. Do not link this project to the remote database.

Nothing below has been executed. Docker was not started for this package, and the backup has not been imported.

## Ports

| Service | Loopback binding |
| --- | --- |
| API | `127.0.0.1:55521` |
| Database | `127.0.0.1:55522` |
| Studio | `127.0.0.1:55523` |
| Local SMTP | `127.0.0.1:55524` |

`npm run supabase:restore-lab:start` runs `start-restore-lab.sh`. The script creates the bridge `sendtoanyone-restore-lab` with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` when that network is missing. It does not create, delete, or attach to `itransfer-isolated` or `itransfer-local-network`.

Every Docker command in the start, status, stop, and restore scripts goes through `loopback-publish.mjs` with `--allow-project sendtoanyone-restore-lab`. Container creates still have an empty `HostIp` rewritten to `127.0.0.1`. The proxy keeps the existing refusals: `supabase_*_prudhvi`, the prudhvi project label, `itransfer-local-network`, network deletes, volume deletes, container deletes that request volumes, and every prune. In this mode it also refuses `itransfer-local-stack`, `itransfer-isolated`, and any `supabase_*` name that is not this project. A home-directory path such as `/Users/prudhvi` is still not treated as the prudhvi project.

`npm run supabase:restore-lab:stop` does not call `supabase stop`. It stops only containers labeled `com.supabase.cli.project=sendtoanyone-restore-lab` whose names match `supabase_*_sendtoanyone-restore-lab`. It does not remove containers, networks, or volumes. The database volume remains. A later start removes only those stopped restore-lab containers, and `docker rm` has no `-v`, so the volume remains then too.

If any of ports `55520`, `55521`, `55522`, `55523`, `55524`, `55527`, `55529`, or `55583` is listening on a host other than `127.0.0.1` or `[::1]`, startup stops this project only and exits.

## Start

From the repository root, after Docker is running:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
npm run supabase:restore-lab:start
```

Confirm the four required listeners are loopback:

```bash
lsof -nP -iTCP:55521 -sTCP:LISTEN
lsof -nP -iTCP:55522 -sTCP:LISTEN
lsof -nP -iTCP:55523 -sTCP:LISTEN
lsof -nP -iTCP:55524 -sTCP:LISTEN
```

Each listen line should show `127.0.0.1`. Leave `supabase_*_prudhvi` and any `itransfer-local-stack` containers as they are. Do not prune.

`npm run supabase:restore-lab:status` prints the local URL and keys for this lab. Do not paste them into a remote command.

## Restore

The backup directory is `~/secure-backups/sendtoanyone-20261023-123933/`. Its `SHA256SUMS.txt` lists `roles.sql`, `schema.sql`, and `data.sql`. The dump header in `data.sql` says PostgreSQL 17.6, and this lab's `major_version` is 17. `roles.sql` alters the standard local roles. `schema.sql` creates `public.transfers`. `data.sql` copies `"public"."transfers"`.

Do not run this until the four listeners above are `127.0.0.1`. The command checks the checksums, refuses a database URL that is not `127.0.0.1:55522/postgres`, then replays the three files. Each file is one transaction with `ON_ERROR_STOP=1`. A failure rolls that file back and the script does not start the next file.

```bash
RESTORE_LAB_CONFIRM=sendtoanyone-restore-lab npm run supabase:restore-lab:restore
```

That command runs these steps, in order:

```bash
shasum -a 256 -c "$HOME/secure-backups/sendtoanyone-20261023-123933/SHA256SUMS.txt"
psql "<local 127.0.0.1:55522/postgres URL from status>" --single-transaction -v ON_ERROR_STOP=1 \
  -f "$HOME/secure-backups/sendtoanyone-20261023-123933/roles.sql"
psql "<same local URL>" --single-transaction -v ON_ERROR_STOP=1 \
  -f "$HOME/secure-backups/sendtoanyone-20261023-123933/schema.sql"
psql "<same local URL>" --single-transaction -v ON_ERROR_STOP=1 \
  -f "$HOME/secure-backups/sendtoanyone-20261023-123933/data.sql"
psql "<same local URL>" -v ON_ERROR_STOP=1 \
  -f supabase/testing/restore-lab/check-transfers.sql
```

The status URL stays inside the script. Do not point `psql` at `55422`, `54322`, or a `supabase.co` host. Do not apply `supabase/migrations/` after the import. This lab is for the logical backup, not for rebuilding the app from migration history.

The check prints `transfers_table` as `PASS` or `FAIL`, then `transfers_rows` as the restored count. If the table is absent, the count statement stops the script.

## Stop

```bash
npm run supabase:restore-lab:stop
```

The containers exit. The restore-lab volume is kept. Do not run `docker volume rm`, `docker rm -v`, or a prune. A prune can remove the exited `supabase_edge_runtime_prudhvi` container.
