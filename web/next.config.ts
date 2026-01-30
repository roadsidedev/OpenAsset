import type { NextConfig } from "next";

const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  if (!url.startsWith('http')) {
    return `https://${url}`;
  }
  return url;
};

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = getApiUrl();
    return {
      beforeFiles: [
        {
          source: '/api/v1/:path*',
          destination: `${apiUrl}/:path*`,
        },
        // Legacy paths without /v1
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
