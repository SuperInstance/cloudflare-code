const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.js',
  flexsearch: {
    codeblocks: false
  },
  defaultShowCopyCode: true,
  readingTime: true,
})

module.exports = withNextra({
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  }
})
