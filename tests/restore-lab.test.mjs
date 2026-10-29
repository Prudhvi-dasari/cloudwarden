import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = new URL('..', import.meta.url)
const read = (name) => readFileSync(new URL(name, root), 'utf8')
const start = read('supabase/testing/restore-lab/start-restore-lab.sh')
const restore = read('supabase/testing/restore-lab/restore-backup.sh')
const config = read('supabase/testing/restore-lab/supabase/config.toml')
const check = read('supabase/testing/restore-lab/check-transfers.sql')
const pkg = JSON.parse(read('package.json'))

test('the restore lab is a separate project on loopback ports 55521-55524', () => {
  assert.match(config, /project_id = "sendtoanyone-restore-lab"/)
  assert.match(config, /port = 55521/)
  assert.match(config, /port = 55522/)
  assert.match(config, /port = 55523/)
  assert.match(config, /port = 55524/)
  assert.match(config, /\[db\.migrations\]\nenabled = false/)
  assert.match(config, /\[db\.seed\]\nenabled = false/)
  assert.match(config, /schema_paths = \[\]/)
  assert.doesNotMatch(config, /itransfer-local-stack|giyeepztahdbsejsozog|supabase\.co/)
  assert.equal(read('supabase/testing/restore-lab/supabase/migrations/.gitkeep'), '')
  assert.match(start, /--allow-project "\$PROJECT"/)
  assert.match(start, /NETWORK=sendtoanyone-restore-lab/)
  assert.match(start, /--restore-lab-stop-names/)
  assert.match(start, /--restore-lab-remove-stopped-names/)
  assert.match(start, /docker rm \$names/)
  assert.match(start, /55521, 55522, 55523, 55524/)
  assert.doesNotMatch(start, /supabase stop|supabase db reset|supabase db push|docker rm -v|docker rm --volumes|docker volume|docker network rm|containers\/prune|restore-backup\.sh/)
  assert.equal(pkg.scripts['supabase:restore-lab:start'], 'sh supabase/testing/restore-lab/start-restore-lab.sh')
  assert.equal(pkg.scripts['supabase:restore-lab:stop'], 'sh supabase/testing/restore-lab/start-restore-lab.sh stop')
})

test('the restore replays roles, schema, and data with fail-fast transactions', () => {
  const roles = restore.indexOf('replay "$BACKUP/roles.sql"')
  const schema = restore.indexOf('replay "$BACKUP/schema.sql"')
  const data = restore.indexOf('replay "$BACKUP/data.sql"')
  const checkAt = restore.indexOf('check-transfers.sql')
  assert.ok(roles > 0 && schema > roles && data > schema && checkAt > data)
  assert.match(restore, /--single-transaction -v ON_ERROR_STOP=1/)
  assert.match(restore, /RESTORE_LAB_CONFIRM:-}/)
  assert.match(restore, /sendtoanyone-20261023-123933/)
  assert.match(restore, /shasum -a 256 -c/)
  assert.match(restore, /--allow-project sendtoanyone-restore-lab/)
  assert.doesNotMatch(restore, /supabase start|supabase db reset|supabase db push|supabase\.co|docker rm|docker volume/)
  const statements = check
    .replace(/--.*$/gm, '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  assert.equal(statements.length, 2)
  assert.match(statements[0], /^select\b/i)
  assert.match(statements[1], /^select count\(\*\)::bigint as transfers_rows/i)
  assert.doesNotMatch(check, /\b(insert|update|delete|drop|alter|create|grant|truncate)\b/i)
})

test('checksum paths must stay inside this backup directory', () => {
  const script = fileURLToPath(new URL('supabase/testing/restore-lab/backup-sums.mjs', root))
  const dir = mkdtempSync(path.join('/tmp', 'restore-sums-'))
  const backup = path.join(dir, 'sendtoanyone-20261023-123933')
  const outside = path.join(dir, 'roles.sql')
  try {
    spawnSync('mkdir', [backup])
    writeFileSync(path.join(backup, 'SHA256SUMS.txt'), `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ${path.join(backup, 'roles.sql')}\nbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  ${path.join(backup, 'schema.sql')}\ncccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc  ${path.join(backup, 'data.sql')}\n`)
    const ok = spawnSync(process.execPath, [script, backup], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    writeFileSync(path.join(backup, 'SHA256SUMS.txt'), `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ${outside}\n`)
    const escaped = spawnSync(process.execPath, [script, backup], { encoding: 'utf8' })
    assert.notEqual(escaped.status, 0)
    assert.match(escaped.stderr, /outside the backup directory/)
    const real = path.join(process.env.HOME, 'secure-backups/sendtoanyone-20261023-123933')
    const actual = spawnSync(process.execPath, [script, real], { encoding: 'utf8' })
    assert.equal(actual.status, 0, actual.stderr)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the database URL helper accepts only the restore-lab loopback database', () => {
  const script = fileURLToPath(new URL('supabase/testing/restore-lab/local-db-url.mjs', root))
  const dir = mkdtempSync(path.join('/tmp', 'restore-url-'))
  const file = path.join(dir, 'status.env')
  try {
    writeFileSync(file, 'DB_URL="postgresql://postgres:local-only@127.0.0.1:55522/postgres"\n')
    const ok = spawnSync(process.execPath, [script, file], { encoding: 'utf8' })
    assert.equal(ok.status, 0)
    assert.equal(ok.stdout, 'postgresql://postgres:local-only@127.0.0.1:55522/postgres')
    writeFileSync(file, 'DB_URL="postgresql://postgres:local-only@db.example.supabase.co:5432/postgres"\n')
    const remote = spawnSync(process.execPath, [script, file], { encoding: 'utf8' })
    assert.notEqual(remote.status, 0)
    assert.equal(remote.stdout, '')
    assert.match(remote.stderr, /127\.0\.0\.1:55522/)
    writeFileSync(file, 'DB_URL="postgresql://postgres:local-only@127.0.0.1:55422/postgres"\n')
    const isolated = spawnSync(process.execPath, [script, file], { encoding: 'utf8' })
    assert.notEqual(isolated.status, 0)
    assert.equal(isolated.stdout, '')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
