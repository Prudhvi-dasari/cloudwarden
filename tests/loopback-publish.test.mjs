import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import {
  classifyDockerRequest,
  endpointHost,
  isPermittedLoopback,
  isolatedStopNames,
  isolatedStoppedContainerNames,
  parseStoppedContainerLine,
  restoreLabStopNames,
  restoreLabStoppedContainerNames,
  startLoopbackProxy,
} from '../supabase/testing/local-stack/loopback-publish.mjs'

const createBody = (hostIp, network = 'itransfer-isolated') => Buffer.from(JSON.stringify({
  Labels: { 'com.supabase.cli.project': 'itransfer-local-stack' },
  HostConfig: {
    NetworkMode: network,
    PortBindings: {
      '8000/tcp': [{ HostIp: hostIp, HostPort: '55421' }],
      '5432/tcp': [{ HostPort: '55422' }],
    },
  },
}))

test('container creates for the isolated stack publish on 127.0.0.1', () => {
  const decision = classifyDockerRequest(
    'POST',
    '/v1.43/containers/create?name=supabase_kong_itransfer-local-stack',
    createBody(''),
  )
  assert.equal(decision.action, 'rewrite')
  const body = JSON.parse(decision.body.toString('utf8'))
  assert.equal(body.HostConfig.PortBindings['8000/tcp'][0].HostIp, '127.0.0.1')
  assert.equal(body.HostConfig.PortBindings['8000/tcp'][0].HostPort, '55421')
  assert.equal(body.HostConfig.PortBindings['5432/tcp'][0].HostIp, '127.0.0.1')
  assert.equal(body.HostConfig.PortBindings['5432/tcp'][0].HostPort, '55422')
})

test('a wildcard or IPv6 any-address publish is rewritten to IPv4 loopback', () => {
  for (const host of ['0.0.0.0', '::', '[::]']) {
    const decision = classifyDockerRequest('POST', '/containers/create', createBody(host))
    const body = JSON.parse(decision.body.toString('utf8'))
    assert.equal(body.HostConfig.PortBindings['8000/tcp'][0].HostIp, '127.0.0.1')
  }
  const ipv6 = classifyDockerRequest('POST', '/containers/create', createBody('::1'))
  const body = JSON.parse(ipv6.body.toString('utf8'))
  assert.equal(body.HostConfig.PortBindings['8000/tcp'][0].HostIp, '::1')
})

test('a home-directory path is not treated as the prudhvi project', () => {
  const body = Buffer.from(JSON.stringify({
    HostConfig: {
      Binds: ['/Users/prudhvi/supabase/snippets:/etc/snippets:ro'],
      PortBindings: { '3000/tcp': [{ HostIp: '', HostPort: '55423' }] },
    },
  }))
  const decision = classifyDockerRequest('POST', '/containers/create?name=supabase_studio_itransfer-local-stack', body)
  assert.equal(decision.action, 'rewrite')
  const parsed = JSON.parse(decision.body.toString('utf8'))
  assert.equal(parsed.HostConfig.PortBindings['3000/tcp'][0].HostIp, '127.0.0.1')
})

test('a prudhvi container with an underscored service name is refused', () => {
  const named = classifyDockerRequest('POST', '/containers/supabase_edge_runtime_prudhvi/stop', Buffer.alloc(0))
  assert.equal(named.action, 'reject')
  assert.equal(named.status, 403)
})

test('requests that name the prudhvi stack or its network are refused', () => {
  const named = classifyDockerRequest('POST', '/containers/supabase_db_prudhvi/stop', Buffer.alloc(0))
  assert.equal(named.action, 'reject')
  assert.equal(named.status, 403)
  const networked = classifyDockerRequest(
    'POST',
    '/v1.43/networks/itransfer-local-network/disconnect',
    Buffer.from('{}'),
  )
  assert.equal(networked.action, 'reject')
  const created = classifyDockerRequest(
    'POST',
    '/containers/create?name=supabase_db_prudhvi',
    createBody('0.0.0.0', 'itransfer-local-network'),
  )
  assert.equal(created.action, 'reject')
})

test('network and volume deletes are refused, including the isolated network', () => {
  assert.equal(classifyDockerRequest('DELETE', '/networks/itransfer-isolated', Buffer.alloc(0)).action, 'reject')
  assert.equal(classifyDockerRequest('DELETE', '/volumes/supabase_itransfer-local-stack', Buffer.alloc(0)).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/containers/prune', Buffer.alloc(0)).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/volumes/prune', Buffer.alloc(0)).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/networks/prune', Buffer.alloc(0)).action, 'reject')
  const filtered = '/v1.43/containers/prune?filters=%7B%22label%22%3A%5B%22com.supabase.cli.project%3Ditransfer-local-stack%22%5D%7D'
  assert.equal(classifyDockerRequest('POST', filtered, Buffer.alloc(0)).action, 'reject')
})

test('shutdown names only this project and can be repeated', () => {
  const names = [
    'supabase_db_itransfer-local-stack',
    'supabase_kong_itransfer-local-stack',
    'supabase_pg_meta_itransfer-local-stack',
    '',
    'supabase_db_itransfer-local-stack',
  ]
  const once = isolatedStopNames(names)
  const twice = isolatedStopNames(once)
  assert.deepEqual(once, [
    'supabase_db_itransfer-local-stack',
    'supabase_kong_itransfer-local-stack',
    'supabase_pg_meta_itransfer-local-stack',
  ])
  assert.deepEqual(twice, once)
  assert.deepEqual(isolatedStopNames([]), [])
  assert.deepEqual(isolatedStopNames(['', '   ']), [])
  for (const unsafe of ['supabase_db_prudhvi', 'supabase_edge_runtime_prudhvi', 'itransfer-local-network', 'supabase_db_other']) {
    assert.throws(() => isolatedStopNames([unsafe]), /Refusing to stop/)
    assert.throws(() => isolatedStopNames(['supabase_kong_itransfer-local-stack', unsafe]), /Refusing to stop/)
  }
})

test('startup removes only stopped itransfer-local-stack containers', () => {
  const stopped = [
    { name: 'supabase_db_itransfer-local-stack', status: 'Exited (0) 4 minutes ago', project: 'itransfer-local-stack' },
    { name: 'supabase_kong_itransfer-local-stack', status: 'exited', project: 'itransfer-local-stack' },
    { name: 'supabase_db_itransfer-local-stack', status: 'Dead', project: 'itransfer-local-stack' },
  ]
  const once = isolatedStoppedContainerNames(stopped)
  assert.deepEqual(once, [
    'supabase_db_itransfer-local-stack',
    'supabase_kong_itransfer-local-stack',
  ])
  assert.deepEqual(isolatedStoppedContainerNames(stopped), once)
  assert.deepEqual(isolatedStoppedContainerNames([
    { name: 'supabase_db_itransfer-local-stack', status: 'Up 2 minutes (healthy)', project: 'itransfer-local-stack' },
    { name: 'supabase_auth_itransfer-local-stack', status: 'Created', project: 'itransfer-local-stack' },
  ]), ['supabase_auth_itransfer-local-stack'])
  assert.deepEqual(isolatedStoppedContainerNames([]), [])
  assert.throws(
    () => isolatedStoppedContainerNames([
      { name: 'supabase_db_itransfer-local-stack', status: 'Exited (0)', project: 'other-project' },
    ]),
    /do not match/,
  )
  assert.throws(
    () => isolatedStoppedContainerNames([
      { name: 'supabase_db_itransfer-local-stack', status: 'Exited (0)', project: 'prudhvi' },
    ]),
    /prudhvi project/,
  )
  assert.throws(
    () => isolatedStoppedContainerNames([
      { name: 'supabase_edge_runtime_prudhvi', status: 'Exited (15) 10 hours ago', project: 'prudhvi' },
    ]),
    /prudhvi project/,
  )
  assert.throws(
    () => isolatedStoppedContainerNames([
      { name: 'supabase_db_itransfer-local-stack', status: 'Exited (0)', project: 'itransfer-local-stack' },
      { name: 'supabase_db_prudhvi', status: 'Up 14 minutes', project: 'prudhvi' },
    ]),
    /prudhvi project/,
  )
  assert.throws(
    () => parseStoppedContainerLine('supabase_db_itransfer-local-stack Exited (0) itransfer-local-stack'),
    /not name, status, and project/,
  )
  const parsed = parseStoppedContainerLine('supabase_studio_itransfer-local-stack\tExited (143) 4 minutes ago\titransfer-local-stack')
  assert.deepEqual(isolatedStoppedContainerNames([parsed]), ['supabase_studio_itransfer-local-stack'])
})

test('ordinary inspect calls are forwarded unchanged', () => {
  const body = Buffer.from('{}')
  const decision = classifyDockerRequest('GET', '/containers/json?all=1', body)
  assert.equal(decision.action, 'forward')
  assert.equal(decision.body.toString('utf8'), '{}')
})

test('the proxy rewrites a create and does not open a TCP port', async () => {
  const dir = mkdtempSync(path.join('/tmp', 'it-loop-'))
  const upstreamPath = path.join(dir, 'upstream.sock')
  const listenPath = path.join(dir, 'proxy.sock')
  let seen = ''
  let proxy
  const upstream = http.createServer((request, response) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      seen = Buffer.concat(chunks).toString('utf8')
      response.writeHead(201, { 'content-type': 'application/json' })
      response.end('{"Id":"abc"}')
    })
  })
  try {
  await new Promise((resolve) => upstream.listen(upstreamPath, resolve))
  proxy = await startLoopbackProxy({ listenPath, upstreamPath })
    const result = await new Promise((resolve, reject) => {
      const request = http.request({
        socketPath: listenPath,
        path: '/v1.43/containers/create?name=supabase_db_itransfer-local-stack',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }, (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
      })
      request.on('error', reject)
      request.end(createBody(''))
    })
    assert.equal(result.status, 201)
    assert.equal(JSON.parse(seen).HostConfig.PortBindings['8000/tcp'][0].HostIp, '127.0.0.1')
    const refused = await new Promise((resolve, reject) => {
      const request = http.request({
        socketPath: listenPath,
        path: '/networks/itransfer-local-network',
        method: 'DELETE',
      }, (response) => {
        response.resume()
        response.on('end', () => resolve(response.statusCode))
      })
      request.on('error', reject)
      request.end()
    })
    assert.equal(refused, 403)
  } finally {
    proxy?.close()
    upstream.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('lsof listen lines accept only loopback addresses', () => {
  const loopback = 'com.docke 27525 prudhvi  124u  IPv4 0xa532f6146132df67      0t0  TCP 127.0.0.1:55421 (LISTEN)'
  assert.equal(endpointHost(loopback), '127.0.0.1')
  assert.equal(isPermittedLoopback(endpointHost(loopback)), true)
  assert.equal(endpointHost('com.docke 1 user 3u IPv6 0x1 0t0 TCP *:55421 (LISTEN)'), '*')
  assert.equal(isPermittedLoopback('*'), false)
  assert.equal(isPermittedLoopback('[::1]'), true)
  assert.equal(isPermittedLoopback('[::]'), false)
  assert.equal(isPermittedLoopback('0.0.0.0'), false)
})

test('restore-lab mode rewrites its own publishes and refuses the other projects', () => {
  const allow = { allowProject: 'sendtoanyone-restore-lab' }
  const created = classifyDockerRequest(
    'POST',
    '/v1.43/containers/create?name=supabase_db_sendtoanyone-restore-lab',
    Buffer.from(JSON.stringify({
      Labels: { 'com.supabase.cli.project': 'sendtoanyone-restore-lab' },
      HostConfig: {
        NetworkMode: 'sendtoanyone-restore-lab',
        PortBindings: {
          '8000/tcp': [{ HostIp: '', HostPort: '55521' }],
          '5432/tcp': [{ HostPort: '55522' }],
        },
      },
    })),
    allow,
  )
  assert.equal(created.action, 'rewrite')
  const body = JSON.parse(created.body.toString('utf8'))
  assert.equal(body.HostConfig.PortBindings['8000/tcp'][0].HostIp, '127.0.0.1')
  assert.equal(body.HostConfig.PortBindings['8000/tcp'][0].HostPort, '55521')
  assert.equal(body.HostConfig.PortBindings['5432/tcp'][0].HostIp, '127.0.0.1')
  assert.equal(body.HostConfig.PortBindings['5432/tcp'][0].HostPort, '55522')

  const home = Buffer.from(JSON.stringify({
    Labels: { 'com.supabase.cli.project': 'sendtoanyone-restore-lab' },
    HostConfig: {
      Binds: ['/Users/prudhvi/supabase/snippets:/etc/snippets:ro'],
      PortBindings: { '3000/tcp': [{ HostIp: '', HostPort: '55523' }] },
    },
  }))
  const rewritten = classifyDockerRequest(
    'POST',
    '/containers/create?name=supabase_studio_sendtoanyone-restore-lab',
    home,
    allow,
  )
  assert.equal(rewritten.action, 'rewrite')

  assert.equal(classifyDockerRequest('POST', '/containers/supabase_db_itransfer-local-stack/stop', Buffer.alloc(0), allow).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/networks/itransfer-isolated/connect', Buffer.from('{}'), allow).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/containers/supabase_edge_runtime_prudhvi/stop', Buffer.alloc(0), allow).action, 'reject')
  assert.equal(classifyDockerRequest('DELETE', '/volumes/supabase_db_sendtoanyone-restore-lab', Buffer.alloc(0), allow).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/containers/prune', Buffer.alloc(0), allow).action, 'reject')
  assert.equal(classifyDockerRequest('DELETE', '/containers/supabase_db_sendtoanyone-restore-lab?v=1', Buffer.alloc(0), allow).action, 'reject')
  assert.equal(classifyDockerRequest('GET', '/containers/json', Buffer.alloc(0), { allowProject: 'prudhvi' }).action, 'reject')
  assert.equal(classifyDockerRequest('POST', '/containers/supabase_db_sendtoanyone-restore-lab/stop', Buffer.alloc(0), allow).action, 'forward')
})

test('restore-lab shutdown and startup removal stay on that project', () => {
  assert.deepEqual(restoreLabStopNames([
    'supabase_db_sendtoanyone-restore-lab',
    'supabase_kong_sendtoanyone-restore-lab',
    'supabase_db_sendtoanyone-restore-lab',
  ]), [
    'supabase_db_sendtoanyone-restore-lab',
    'supabase_kong_sendtoanyone-restore-lab',
  ])
  for (const unsafe of ['supabase_db_prudhvi', 'supabase_edge_runtime_prudhvi', 'supabase_db_itransfer-local-stack', 'itransfer-local-network']) {
    assert.throws(() => restoreLabStopNames([unsafe]), /does not touch prudhvi or itransfer-local-stack/)
  }
  assert.deepEqual(restoreLabStoppedContainerNames([
    { name: 'supabase_db_sendtoanyone-restore-lab', status: 'Exited (0) 1 minute ago', project: 'sendtoanyone-restore-lab' },
    { name: 'supabase_kong_sendtoanyone-restore-lab', status: 'Up 2 minutes', project: 'sendtoanyone-restore-lab' },
  ]), ['supabase_db_sendtoanyone-restore-lab'])
  assert.throws(
    () => restoreLabStoppedContainerNames([
      { name: 'supabase_db_sendtoanyone-restore-lab', status: 'Exited (0)', project: 'itransfer-local-stack' },
    ]),
    /does not touch prudhvi or itransfer-local-stack/,
  )
  assert.throws(
    () => restoreLabStoppedContainerNames([
      { name: 'supabase_edge_runtime_prudhvi', status: 'Exited (15)', project: 'prudhvi' },
    ]),
    /does not touch prudhvi or itransfer-local-stack/,
  )
})

test('the start script keeps the isolated network and the prudhvi stack apart', () => {
  const script = readFileSync(new URL('../supabase/testing/local-stack/start-isolated.sh', import.meta.url), 'utf8')
  assert.match(script, /NETWORK=itransfer-isolated/)
  assert.match(script, /FOREIGN_NETWORK=itransfer-local-network/)
  assert.match(script, /unset SUPABASE_EXPERIMENTAL_STACK/)
  assert.match(script, /loopback-publish\.mjs/)
  assert.equal(script.includes('DOCKER_HOST="unix://${PROXY_SOCK}"'), true)
  assert.match(script, /--stop-names/)
  assert.match(script, /--remove-stopped-names/)
  assert.match(script, /docker rm \$names/)
  assert.match(script, /label=com\.supabase\.cli\.project=itransfer-local-stack/)
  assert.doesNotMatch(script, /supabase --workdir supabase\/testing\/local-stack stop/)
  assert.doesNotMatch(script, /containers\/prune|--no-backup|--all|docker rm -v|docker rm --volumes/)
  assert.equal(/\bdocker\s+volume\b|\bdocker\s+network\s+rm\b|\bsupabase\s+db\s+reset\b|\bsupabase\s+stack\b/.test(script), false)
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts['supabase:isolated:stop'], 'sh supabase/testing/local-stack/start-isolated.sh stop')
})
