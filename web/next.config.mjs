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
