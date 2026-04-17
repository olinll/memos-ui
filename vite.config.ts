import { defineConfig, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { request } from 'node:http'
import { URL } from 'node:url'

const BACKEND = 'http://10.0.0.11:5230'

/**
 * Manual proxy middleware for /file/ paths.
 * Vite's built-in proxy doesn't catch short prefixes before SPA fallback,
 * so we pipe the request ourselves at the earliest middleware stage.
 */
function backendProxy(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith('/file/')) return next()

    const target = new URL(url, BACKEND)
    const proxyReq = request(
      target,
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )
    proxyReq.on('error', () => { res.writeHead(502); res.end() })
    req.pipe(proxyReq)
  }
}

export default defineConfig({
  plugins: [
    {
      name: 'file-proxy',
      configureServer(server) {
        // Return a function → runs AFTER Vite internal middleware is installed
        // But we need BEFORE. So we use server.middlewares.use directly here.
        server.middlewares.use(backendProxy())
      },
    },
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
})
