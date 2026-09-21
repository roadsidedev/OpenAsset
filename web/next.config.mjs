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
  async redirects() {
    // Docs IA restructure (Learn / Use / Build / Curate / Security):
    // every pre-restructure URL permanently redirects to its new home.
    return [
      { source: '/docs/choose-your-path', destination: '/docs', permanent: true },
      { source: '/docs/how-market-works', destination: '/docs/learn/how-market-works', permanent: true },
      { source: '/docs/scope-and-risks', destination: '/docs/security/scope-and-risks', permanent: true },
      { source: '/docs/guides/borrow', destination: '/docs/use/borrow', permanent: true },
      { source: '/docs/guides/create-market', destination: '/docs/curate/create-market', permanent: true },
      { source: '/docs/guides/developer-quickstart', destination: '/docs/build/quickstart', permanent: true },
      { source: '/docs/guides/developer', destination: '/docs/build/developer-guide', permanent: true },
      { source: '/docs/guides/adapters', destination: '/docs/build/adapters', permanent: true },
      { source: '/docs/guides/register-adapter', destination: '/docs/build/register-adapter', permanent: true },
      { source: '/docs/guides/rwa-market', destination: '/docs/curate/rwa-markets', permanent: true },
      { source: '/docs/guides/liquidation', destination: '/docs/curate/liquidation', permanent: true },
      { source: '/docs/guides/reference-adapters', destination: '/docs/build/reference-adapters', permanent: true },
      { source: '/docs/guides/developer-feedback', destination: '/docs/build/developer-feedback', permanent: true },
      { source: '/docs/protocol/overview', destination: '/docs/learn/overview', permanent: true },
      { source: '/docs/protocol/design-philosophy', destination: '/docs/learn/design-philosophy', permanent: true },
      { source: '/docs/protocol/core-contracts', destination: '/docs/learn/core-contracts', permanent: true },
      { source: '/docs/protocol/adapter-system', destination: '/docs/build/adapter-system', permanent: true },
      { source: '/docs/protocol/trust-model', destination: '/docs/security/trust-model', permanent: true },
      { source: '/docs/protocol/adapter-registry', destination: '/docs/build/adapter-registry', permanent: true },
      { source: '/docs/protocol/validation-matrix', destination: '/docs/curate/validation-matrix', permanent: true },
      { source: '/docs/protocol/circuit-breaker', destination: '/docs/learn/circuit-breaker', permanent: true },
      { source: '/docs/protocol/loan-lifecycle', destination: '/docs/learn/loan-lifecycle', permanent: true },
      { source: '/docs/protocol/oracles', destination: '/docs/learn/oracles', permanent: true },
      { source: '/docs/protocol/liquidations', destination: '/docs/learn/liquidations', permanent: true },
      { source: '/docs/protocol/positions', destination: '/docs/learn/positions', permanent: true },
      { source: '/docs/protocol/rwa', destination: '/docs/curate/rwa-markets', permanent: true },
      { source: '/docs/protocol/lending-assets', destination: '/docs/learn/lending-assets', permanent: true },
      { source: '/docs/protocol/multi-chain', destination: '/docs/curate/multi-chain', permanent: true },
      { source: '/docs/protocol/compliance', destination: '/docs/curate/compliance', permanent: true },
      { source: '/docs/protocol/security', destination: '/docs/security/model', permanent: true },
      { source: '/docs/protocol/data-models', destination: '/docs/learn/data-models', permanent: true },
      { source: '/docs/reference/security-checklist', destination: '/docs/security/checklist', permanent: true },
      { source: '/docs/reference/deferred', destination: '/docs/security/deferred', permanent: true },
      { source: '/docs/reference/glossary', destination: '/docs/learn/glossary', permanent: true },
    ]
  },
}

export default withNextra(nextConfig)
