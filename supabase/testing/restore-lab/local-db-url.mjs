import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  process.stderr.write('Refusing to read a database URL without a local status file.\n')
  process.exit(1)
}

const raw = readFileSync(file, 'utf8')
const line = raw.split(/\n/).find((item) => item.startsWith('DB_URL='))
if (!line) {
  process.stderr.write('DB_URL was not in the local restore-lab status.\n')
  process.exit(1)
}

let value = line.slice('DB_URL='.length).trim()
if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)

let url
try {
  url = new URL(value)
} catch {
  process.stderr.write('Refusing a database URL that is not postgresql://…@127.0.0.1:55522/postgres.\n')
  process.exit(1)
}

const local = (url.protocol === 'postgresql:' || url.protocol === 'postgres:')
  && url.hostname === '127.0.0.1'
  && url.port === '55522'
  && url.pathname === '/postgres'
  && !value.includes('supabase.co')

if (!local) {
  process.stderr.write('Refusing a database URL that is not postgresql://…@127.0.0.1:55522/postgres.\n')
  process.exit(1)
}

process.stdout.write(value)
