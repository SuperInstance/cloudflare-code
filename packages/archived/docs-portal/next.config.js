/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },

  // Image optimization
  images: {
    domains:['claudeflare.com', 'cdn.claudeflare.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Rewrites for API proxy if needed
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'https://api.claudeflare.com/v1/:path*',
      },
    ];
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ];
  },

  // Webpack configuration for Monaco Editor
  webpack: (config) => {
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mdx'];
    return config;
  },
};

module.exports = nextConfig;
