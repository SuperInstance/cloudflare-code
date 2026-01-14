/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.claudeflare.dev',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.claudeflare.dev',
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.API_URL + '/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
