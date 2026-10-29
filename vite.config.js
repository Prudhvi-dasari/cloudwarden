import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dispatchLocalViteRequest, loadIsolatedEnv } from './functions/lib/localIsolation.js'
import { resolve } from 'node:path'

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function localApi({ isolated, env }) {
  return {
    name: 'itransfer-r2-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const isR2 = req.url?.startsWith('/api/r2')
        const isPay = req.url?.startsWith('/api/payment')
        if (!isR2 && !isPay) return next()
        try {
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
          const headers = { 'content-type': req.headers['content-type'] || 'application/json' }
          if (req.headers.authorization) headers.authorization = req.headers.authorization
          if (req.headers.cookie) headers.cookie = req.headers.cookie
          if (req.headers['webhook-id']) headers['webhook-id'] = req.headers['webhook-id']
          if (req.headers['webhook-signature']) headers['webhook-signature'] = req.headers['webhook-signature']
          if (req.headers['webhook-timestamp']) headers['webhook-timestamp'] = req.headers['webhook-timestamp']
          if (req.headers['x-transfer-password']) headers['x-transfer-password'] = req.headers['x-transfer-password']
          if (req.headers['x-cleanup-secret']) headers['x-cleanup-secret'] = req.headers['x-cleanup-secret']
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
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
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
