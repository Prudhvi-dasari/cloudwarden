import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dispatchLocalViteRequest, loadIsolatedEnv } from './functions/lib/localIsolation.js'
import { injectPricingGeo } from './functions/lib/pricingGeo.js'
import { resolve } from 'node:path'

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function requestHeaders(req) {
  const headers = { 'content-type': req.headers['content-type'] || 'application/json' }
  if (req.headers.authorization) headers.authorization = req.headers.authorization
  if (req.headers.cookie) headers.cookie = req.headers.cookie
  if (req.headers['webhook-id']) headers['webhook-id'] = req.headers['webhook-id']
  if (req.headers['webhook-signature']) headers['webhook-signature'] = req.headers['webhook-signature']
  if (req.headers['webhook-timestamp']) headers['webhook-timestamp'] = req.headers['webhook-timestamp']
  if (req.headers['x-transfer-password']) headers['x-transfer-password'] = req.headers['x-transfer-password']
  if (req.headers['x-cleanup-secret']) headers['x-cleanup-secret'] = req.headers['x-cleanup-secret']
  if (req.headers['cf-ipcountry']) headers['cf-ipcountry'] = req.headers['cf-ipcountry']
  return headers
}

async function sendApi(res, response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

function pricingGeoHtml() {
  return {
    name: 'sta-pricing-geo',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const accept = req.headers.accept || ''
        if (!accept.includes('text/html')) return next()
        const country = req.headers['cf-ipcountry'] || ''
        const chunks = []
        const write = res.write.bind(res)
        const end = res.end.bind(res)
        res.write = (chunk, encoding, callback) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'))
          if (typeof encoding === 'function') encoding()
          else if (typeof callback === 'function') callback()
          return true
        }
        res.end = (chunk, encoding, callback) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'))
          }
          const done = typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : callback
          const raw = Buffer.concat(chunks)
          const type = String(res.getHeader('content-type') || '')
          const body = (type.includes('text/html') || raw.includes('<html'))
            ? Buffer.from(injectPricingGeo(raw.toString('utf8'), country))
            : raw
          try { res.setHeader('content-length', body.length) } catch { /* already flushed */ }
          res.write = write
          res.end = end
          return end(body, done)
        }
        next()
      })
    },
  }
}

function localApi({ isolated, env }) {
  return {
    name: 'itransfer-r2-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        const isGeo = path === '/api/geo'
        const isOffers = path === '/api/payment' && req.method === 'GET' && /(?:^|[?&])action=(?:offers|health)(?:&|$)/.test(req.url || '')
        const isR2 = req.url?.startsWith('/api/r2')
        const isPay = req.url?.startsWith('/api/payment')
        if (!isR2 && !isPay && !isGeo) return next()
        try {
          const headers = requestHeaders(req)
          if (isGeo || (isOffers && !isolated)) {
            const request = new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers })
            const response = isGeo
              ? await (await import('./functions/api/geo.js')).onRequest({ request })
              : await (await import('./functions/lib/dodo.js')).handlePaymentRequest({ request, env: {} })
            await sendApi(res, response)
            return
          }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
          const request = new Request(`http://127.0.0.1${req.url}`, {
            method: req.method,
            headers,
            body,
          })
          const response = await dispatchLocalViteRequest({
            request,
            isolated,
            env,
            kind: isPay ? 'payment' : 'r2',
          })
          await sendApi(res, response)
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig(({ command }) => {
  const isolated = command === 'serve' && process.env.ITRANSFER_ISOLATED === '1'
  const env = isolated ? loadIsolatedEnv(process.cwd()) : {}
  return {
    ...(isolated ? { envDir: resolve(process.cwd(), 'env/isolated') } : {}),
    plugins: [
      pricingGeoHtml(),
      react(),
      tailwindcss(),
      localApi({ isolated, env }),
    ],
    build: {
      rollupOptions: {
        output: {
          // New URL prefix so a poisoned edge cache of the previous asset names is not reused.
          entryFileNames: 'assets/[name]-[hash]-b.js',
          chunkFileNames: 'assets/[name]-[hash]-b.js',
          assetFileNames: 'assets/[name]-[hash]-b[extname]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('peerjs')) {
                return 'vendor-p2p';
              }
            }
          },
        },
      },
    },
  }
})
