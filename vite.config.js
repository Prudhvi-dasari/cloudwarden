import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleR2Request } from './functions/lib/r2Engine.js'
import { handlePaymentRequest } from './functions/lib/dodo.js'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function localApi(env) {
  return {
    name: 'itransfer-r2-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const isR2 = req.url?.startsWith('/api/r2')
        const isPay = req.url?.startsWith('/api/payment')
        if (!isR2 && !isPay) return next()
        try {
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] || 'application/json' },
            body,
          })
          const response = isPay
            ? await handlePaymentRequest({ request, env })
            : await handleR2Request({ request, env })
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      localApi(env),
    ],
  }
})
