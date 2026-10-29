import { readFileSync } from 'node:fs'
import path from 'node:path'

const backup = process.argv[2]
if (!backup) {
  process.stderr.write('Refusing to check sums without a backup directory.\n')
  process.exit(1)
}

const root = path.resolve(backup)
if (path.basename(root) !== 'sendtoanyone-20261023-123933') {
  process.stderr.write('Refusing a backup directory whose name is not sendtoanyone-20261023-123933.\n')
  process.exit(1)
}

const sums = readFileSync(path.join(root, 'SHA256SUMS.txt'), 'utf8')
const required = ['roles.sql', 'schema.sql', 'data.sql']
const seen = new Set()
for (const line of sums.split(/\n/)) {
  if (!line.trim()) continue
  const match = line.match(/^[a-f0-9]{64}  (.+)$/)
  if (!match) {
    process.stderr.write('SHA256SUMS.txt has a line this restore does not accept.\n')
    process.exit(1)
  }
  const resolved = path.resolve(match[1])
  if (resolved !== path.join(root, path.basename(resolved))) {
    process.stderr.write('A checksum path is outside the backup directory.\n')
    process.exit(1)
  }
  seen.add(path.basename(resolved))
}

for (const name of required) {
  if (!seen.has(name)) {
    process.stderr.write(`SHA256SUMS.txt does not list ${name}.\n`)
    process.exit(1)
  }
}
