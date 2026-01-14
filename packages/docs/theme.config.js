/** @type {import('nextra-theme-docs').ThemeConfig} */
const themeConfig = {
  project: {
    link: 'https://github.com/your-org/claudeflare',
  },
  docsRepositoryBase: 'https://github.com/your-org/claudeflare/tree/main/packages/docs',
  titleSuffix: ' – ClaudeFlare Docs',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – ClaudeFlare'
    }
  },
  navigation: {
    prev: true,
    next: true
  },
  footer: {
    text: 'ClaudeFlare Documentation - Distributed AI Coding Platform'
  },
  sidebar: {
    autoCollapse: true,
    defaultMenuCollapseLevel: 2,
    toggleButton: true
  },
  toc: {
    backToTop: true,
    float: true,
    extraContent: (
      <style>
        {`
          .nextra-toc-footer {
            display: none !important;
          }
        `}
      </style>
    )
  },
  chat: {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    ),
    link: 'https://discord.gg/claudeflare'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  logo: (
    <>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <span className="mx-2 font-extrabold hidden md:inline select-none">
        ClaudeFlare
      </span>
    </>
  ),
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="ClaudeFlare - Distributed AI coding platform with multi-cloud orchestration" />
      <meta name="og:description" content="Distributed AI coding platform with multi-cloud orchestration" />
      <meta name="og:title" content="ClaudeFlare Documentation" />
      <meta name="og:image" content="https://docs.claudeflare.com/og.png" />
    </>
  ),
  darkMode: true,
  primaryHue: 220,
  direction: 'ltr'
}

module.exports = themeConfig
