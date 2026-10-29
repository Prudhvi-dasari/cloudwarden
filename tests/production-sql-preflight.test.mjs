import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('..', import.meta.url)
const preflight = readFileSync(new URL('supabase/testing/production-sql-preflight.sql', root), 'utf8')
const verify = readFileSync(new URL('supabase/testing/production-sql-verify.sql', root), 'utf8')
const operations = readFileSync(new URL('docs/production-readiness/production-operations.md', root), 'utf8')

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
}

function statements(sql) {
  return stripComments(sql)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}

test('the preflight is a single read-only statement with explicit results', () => {
  const body = statements(preflight)
  assert.equal(body.length, 1)
  assert.match(body[0], /^with\b/i)
  assert.doesNotMatch(body[0], /^(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/i)
  assert.match(preflight, /\bPASS\b/)
  assert.match(preflight, /\bFAIL\b/)
  assert.match(preflight, /\bREVIEW\b/)
  assert.match(preflight, /function_reserve_transfer_file/)
  assert.match(preflight, /function_claim_download_slot/)
  assert.match(preflight, /function_release_download_slot/)
  assert.match(preflight, /Absent\. Expected before/)
})

test('verification checks signatures, privileges, the platform cap, and a rolled-back slot probe', () => {
  const signature = 'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamp with time zone,text)'
  assert.equal(signature.split(',').length, 16)
  assert.match(verify, new RegExp(signature.replace(/[()]/g, '\\$&')))
  assert.match(verify, /platform_limit constant bigint := 1000000000000/)
  assert.match(verify, /itransfer-platform-v1/)
  assert.match(verify, /transfers_share_occupied_idx/)
  assert.match(verify, /VERIFY_BEHAVIOR_PASS/)
  assert.match(verify, /DOWNLOAD_LIMIT/)
  assert.match(verify, /foreign_key_violation/)
  for (const statement of statements(verify)) {
    assert.doesNotMatch(statement, /^(drop|alter|grant|revoke|truncate)\b/i)
  }
  assert.doesNotMatch(stripComments(verify), /\bdrop\s+function\b/i)
  const behavior = verify.slice(verify.indexOf('do $$'))
  assert.match(behavior, /insert into public\.transfers/i)
  assert.match(behavior, /raise exception 'VERIFY_BEHAVIOR_PASS/)
})

test('the runbook keeps backup, preflight, migration, verification, deploy, limiter, and smoke in that order', () => {
  const runbook = operations.slice(operations.indexOf('### Rollout and rollback runbook'))
  const steps = [
    'Backup and recovery readiness',
    'production-sql-preflight.sql',
    '20261022193000_reserve_transfer_file.sql',
    '20261023004500_platform_storage_cap_and_download_slot.sql',
    'production-sql-verify.sql',
    'Compatible Pages deployment',
    'Serving-deployment limiter verification',
    'Smoke tests',
  ]
  let cursor = 0
  for (const step of steps) {
    const at = runbook.indexOf(step, cursor)
    assert.ok(at > cursor, step)
    cursor = at
  }
  assert.match(runbook, /Before the new Pages version serves/)
  assert.match(runbook, /After the new Pages version serves/)
  assert.match(runbook, /while the new deployment is still serving/)
  assert.match(runbook, /RECORD_FAILED/)
})
