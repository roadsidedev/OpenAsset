import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextra from 'nextra'

const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
  if (!url.startsWith('http')) {
    return `https://${url}`
  }
  return url
}

const withNextra = nextra({
  contentDirBasePath: '/docs',
  search: {
    codeblocks: false,
  },
  defaultShowCopyCode: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Pin the Turbopack workspace root to this app — without it Turbopack
  // walks up and locks onto an unrelated lockfile (C:\Users\USER\...), which
  // degrades module resolution and cache hits.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    // Icon barrel imports (25+ files) — granular per-icon modules instead of
    // pulling the phosphor index into every chunk. Not in Next's default list.
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  async rewrites() {
    const apiUrl = getApiUrl()
    return {
      beforeFiles: [
        {
          source: '/doc',
          destination: '/docs',
        },
        {
          source: '/doc/:path*',
          destination: '/docs/:path*',
        },
        {
          source: '/api/v1/:path*',
          destination: `${apiUrl}/:path*`,
        },
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ],
    }
  },
}

export default withNextra(nextConfig)
