/**
 * Docker API proxy for the isolated Supabase stack.
 *
 * Supabase CLI 2.121.0 (supabase-go) creates containers with
 * HostConfig.PortBindings and an empty HostIp. That publishes 0.0.0.0.
 * The bridge option com.docker.network.bridge.host_binding_ipv4=127.0.0.1
 * is supposed to fill that address in. Docker Desktop 29.8.2 on macOS still
 * forwards those ports on every host interface.
 *
 * An explicit HostIp of 127.0.0.1 is the publish Docker Desktop keeps on
 * loopback. This proxy sets that field on container creates. It does not add
 * a second [::1] binding: Docker treats two binds of one container port as a
 * conflict, and the failure seen here was the wildcard listener, not a missing
 * IPv6 loopback listener. An explicit ::1 host is left as ::1.
 *
 * The proxy is used only through DOCKER_HOST for one project's CLI process.
 * It rejects any request that names a supabase_*_prudhvi container, the
 * prudhvi project label, or itransfer-local-network. A home-directory path
 * such as /Users/prudhvi is not that project. It also rejects network
 * deletes, volume deletes, container deletes that include volumes, and
 * every prune.
 *
 * --allow-project sendtoanyone-restore-lab keeps those refusals and also
 * refuses itransfer-local-stack, itransfer-isolated, and any supabase_*
 * name that is not the restore lab.
 */
import http from 'node:http'
import net from 'node:net'
import { readFileSync, unlinkSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const FOREIGN_MARK = /itransfer-local-network|supabase_[a-z0-9_]+_prudhvi|com\.supabase\.cli\.project["=: ]+prudhvi/i

export const RESTORE_LAB_PROJECT = 'sendtoanyone-restore-lab'

export function endpointHost(line) {
  const endpoint = String(line || '').trim().split(/\s+/).find((part) => /:\d+$/.test(part))
  if (!endpoint) return ''
  return endpoint.replace(/:\d+$/, '')
}

export function isPermittedLoopback(host) {
  return host === '127.0.0.1' || host === '[::1]'
}

const ISOLATED_CONTAINER = /^supabase_[a-z0-9_]+_itransfer-local-stack$/

export function isolatedStopNames(names) {
  const allowed = []
  const seen = new Set()
  for (const raw of names) {
    const name = String(raw ?? '').trim().replace(/^\//, '')
    if (!name) continue
    if (!ISOLATED_CONTAINER.test(name)) {
      throw new Error(`Refusing to stop ${name}. Shutdown only stops itransfer-local-stack containers.`)
    }
    if (seen.has(name)) continue
    seen.add(name)
    allowed.push(name)
  }
  return allowed
}

export function isStoppedContainerStatus(status) {
  return /^(exited|created|dead)\b/i.test(String(status ?? '').trim())
}

export function parseStoppedContainerLine(line) {
  const parts = String(line ?? '').split('\t')
  if (parts.length !== 3 || parts.some((part) => part.trim() === '')) {
    throw new Error('Refusing a container record that is not name, status, and project.')
  }
  return { name: parts[0].trim(), status: parts[1].trim(), project: parts[2].trim() }
}

const RESTORE_LAB_CONTAINER = /^supabase_[a-z0-9_]+_sendtoanyone-restore-lab$/

function refusedRestoreLabName(name, project) {
  return project === 'prudhvi'
    || project === 'itransfer-local-stack'
    || project === 'itransfer-local-network'
    || /_prudhvi$/.test(name)
    || /_itransfer-local-stack$/.test(name)
    || name === 'itransfer-local-network'
}

export function restoreLabStopNames(names) {
  const allowed = []
  const seen = new Set()
  for (const raw of names) {
    const name = String(raw ?? '').trim().replace(/^\//, '')
    if (!name) continue
    if (refusedRestoreLabName(name, '')) {
      throw new Error(`Refusing to stop ${name}. Restore-lab shutdown does not touch prudhvi or itransfer-local-stack.`)
    }
    if (!RESTORE_LAB_CONTAINER.test(name)) {
      throw new Error(`Refusing to stop ${name}. Shutdown only stops sendtoanyone-restore-lab containers.`)
    }
    if (seen.has(name)) continue
    seen.add(name)
    allowed.push(name)
  }
  return allowed
}

export function restoreLabStoppedContainerNames(records) {
  const removable = []
  const seen = new Set()
  for (const record of records) {
    const name = String(record?.name ?? '').trim().replace(/^\//, '')
    const project = String(record?.project ?? '').trim()
    const status = String(record?.status ?? '').trim()
    if (!name && !project && !status) continue
    if (refusedRestoreLabName(name, project)) {
      throw new Error(`Refusing to remove ${name || project}. Restore-lab cleanup does not touch prudhvi or itransfer-local-stack.`)
    }
    const nameOk = RESTORE_LAB_CONTAINER.test(name)
    const projectOk = project === RESTORE_LAB_PROJECT
    if (!nameOk || !projectOk) {
      throw new Error(`Refusing to remove ${name || '(unnamed)'}. The container name and project label do not match.`)
    }
    if (!status) {
      throw new Error(`Refusing to remove ${name}. Its status is missing.`)
    }
    if (!isStoppedContainerStatus(status)) continue
    if (seen.has(name)) continue
    seen.add(name)
    removable.push(name)
  }
  return removable
}

export function isolatedStoppedContainerNames(records) {
  const removable = []
  const seen = new Set()
  for (const record of records) {
    const name = String(record?.name ?? '').trim().replace(/^\//, '')
    const project = String(record?.project ?? '').trim()
    const status = String(record?.status ?? '').trim()
    if (!name && !project && !status) continue
    if (project === 'prudhvi' || /_prudhvi$/.test(name) || name === 'itransfer-local-network' || project === 'itransfer-local-network') {
      throw new Error(`Refusing to remove ${name || project}. Startup cleanup does not touch the prudhvi project.`)
    }
    const nameOk = ISOLATED_CONTAINER.test(name)
    const projectOk = project === 'itransfer-local-stack'
    if (!nameOk || !projectOk) {
      throw new Error(`Refusing to remove ${name || '(unnamed)'}. The container name and project label do not match.`)
    }
    if (!status) {
      throw new Error(`Refusing to remove ${name}. Its status is missing.`)
    }
    if (!isStoppedContainerStatus(status)) continue
    if (seen.has(name)) continue
    seen.add(name)
    removable.push(name)
  }
  return removable
}

export function loopbackHost(ip) {
  const value = String(ip ?? '').trim().toLowerCase()
  if (value === '::1' || value === '[::1]') return '::1'
  return '127.0.0.1'
}

export function rewritePortBindings(body) {
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(body).toString('utf8') || '{}')
  } catch {
    return Buffer.from(body)
  }
  const bindings = parsed?.HostConfig?.PortBindings
  if (!bindings || typeof bindings !== 'object') return Buffer.from(JSON.stringify(parsed))
  for (const entries of Object.values(bindings)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue
      entry.HostIp = loopbackHost(entry.HostIp)
    }
  }
  return Buffer.from(JSON.stringify(parsed))
}

function restoreLabGuard(text, allowProject) {
  if (!allowProject) return null
  if (allowProject !== RESTORE_LAB_PROJECT) {
    return {
      action: 'reject',
      status: 403,
      message: 'Refusing an unknown project allowlist.',
    }
  }
  if (text.includes('itransfer-local-stack') || text.includes('itransfer-isolated')) {
    return {
      action: 'reject',
      status: 403,
      message: 'Refusing a request that names itransfer-local-stack or itransfer-isolated. This proxy is limited to sendtoanyone-restore-lab.',
    }
  }
  const names = text.match(/supabase_[a-z0-9_]+_[a-z0-9-]+/gi) || []
  for (const name of names) {
    if (!name.toLowerCase().endsWith(`_${RESTORE_LAB_PROJECT}`)) {
      return {
        action: 'reject',
        status: 403,
        message: `Refusing ${name}. This proxy is limited to sendtoanyone-restore-lab.`,
      }
    }
  }
  const label = /com\.supabase\.cli\.project["=: ]+([A-Za-z0-9-]+)/i.exec(text)
  if (label && label[1] !== RESTORE_LAB_PROJECT) {
    return {
      action: 'reject',
      status: 403,
      message: `Refusing project label ${label[1]}. This proxy is limited to sendtoanyone-restore-lab.`,
    }
  }
  return null
}

export function classifyDockerRequest(method, target, body, options = {}) {
  const upper = String(method || 'GET').toUpperCase()
  const url = String(target || '/')
  const text = `${upper}\n${url}\n${Buffer.from(body || '').toString('utf8')}`
  if (FOREIGN_MARK.test(text)) {
    return {
      action: 'reject',
      status: 403,
      message: 'Refusing a request that names the prudhvi Supabase containers or itransfer-local-network.',
    }
  }
  const path = url.split('?')[0]
  const query = url.split('?')[1] || ''
  if (upper === 'DELETE' && /\/(networks|volumes)\//.test(path)) {
    return {
      action: 'reject',
      status: 403,
      message: 'Refusing to delete a Docker network or volume.',
    }
  }
  if (upper === 'POST' && /\/(networks|volumes|containers)\/prune$/.test(path)) {
    return {
      action: 'reject',
      status: 403,
      message: 'Refusing to prune Docker networks, volumes, or containers.',
    }
  }
  if (upper === 'DELETE' && /\/containers\//.test(path) && /(?:^|&)v=(?:1|true)(?:&|$)/i.test(query)) {
    return {
      action: 'reject',
      status: 403,
      message: 'Refusing to delete a container with its volumes.',
    }
  }
  const guarded = restoreLabGuard(text, options.allowProject || '')
  if (guarded) return guarded
  if (upper === 'POST' && /\/containers\/create$/.test(path)) {
    const rewritten = rewritePortBindings(body || Buffer.alloc(0))
    return { action: 'rewrite', body: rewritten }
  }
  return { action: 'forward', body: Buffer.from(body || '') }
}

function mentionsForeign(value) {
  return FOREIGN_MARK.test(String(value || ''))
}

export function startLoopbackProxy({ listenPath, upstreamPath, allowProject = '' }) {
  const server = http.createServer((request, response) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const decision = classifyDockerRequest(request.method, request.url, Buffer.concat(chunks), { allowProject })
      if (decision.action === 'reject') {
        response.writeHead(decision.status, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ message: decision.message }))
        return
      }
      const headers = { ...request.headers, host: 'localhost' }
      if (decision.action === 'rewrite') headers['content-length'] = String(decision.body.length)
      const upstream = http.request({
        socketPath: upstreamPath,
        path: request.url,
        method: request.method,
        headers,
      }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
        upstreamResponse.pipe(response)
      })
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ message: 'The isolated Docker proxy could not reach the Docker socket.' }))
      })
      upstream.end(decision.body)
    })
  })

  server.on('upgrade', (request, socket, head) => {
    const decision = classifyDockerRequest(request.method, request.url, Buffer.alloc(0), { allowProject })
    if (decision.action === 'reject' || mentionsForeign(request.url)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
      return
    }
    const upstream = net.connect(upstreamPath)
    const fail = () => {
      socket.destroy()
      upstream.destroy()
    }
    upstream.on('error', fail)
    socket.on('error', fail)
    upstream.on('connect', () => {
      const lines = [`${request.method} ${request.url} HTTP/1.1`]
      for (const [name, value] of Object.entries(request.headers)) {
        if (value == null) continue
        lines.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`)
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`)
      if (head?.length) upstream.write(head)
      socket.pipe(upstream)
      upstream.pipe(socket)
    })
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    try { unlinkSync(listenPath) } catch { /* absent */ }
    server.listen(listenPath, () => resolve({
      close() {
        server.close()
        try { unlinkSync(listenPath) } catch { /* already gone */ }
      },
    }))
  })
}

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? '' : (process.argv[index + 1] || '')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--stop-names')) {
    try {
      const names = isolatedStopNames(readFileSync(0, 'utf8').split(/\s+/))
      process.stdout.write(names.length ? `${names.join('\n')}\n` : '')
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exit(1)
    }
    process.exit(0)
  }
  if (process.argv.includes('--remove-stopped-names')) {
    try {
      const records = readFileSync(0, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map(parseStoppedContainerLine)
      const names = isolatedStoppedContainerNames(records)
      process.stdout.write(names.length ? `${names.join('\n')}\n` : '')
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exit(1)
    }
    process.exit(0)
  }
  if (process.argv.includes('--restore-lab-stop-names')) {
    try {
      const names = restoreLabStopNames(readFileSync(0, 'utf8').split(/\s+/))
      process.stdout.write(names.length ? `${names.join('\n')}\n` : '')
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exit(1)
    }
    process.exit(0)
  }
  if (process.argv.includes('--restore-lab-remove-stopped-names')) {
    try {
      const records = readFileSync(0, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map(parseStoppedContainerLine)
      const names = restoreLabStoppedContainerNames(records)
      process.stdout.write(names.length ? `${names.join('\n')}\n` : '')
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exit(1)
    }
    process.exit(0)
  }
  const listenPath = argValue('--listen')
  const upstreamPath = argValue('--upstream')
  const allowProject = argValue('--allow-project')
  if (!listenPath || !upstreamPath) {
    process.stderr.write('usage: loopback-publish.mjs --listen <socket> --upstream <docker.sock>\n')
    process.exit(1)
  }
  startLoopbackProxy({ listenPath, upstreamPath, allowProject }).catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  })
}
