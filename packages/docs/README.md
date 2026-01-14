# ClaudeFlare Documentation

Welcome to the ClaudeFlare documentation portal. This is a Next.js 14 + Nextra based documentation site.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Export static site
npm run export
```

## Project Structure

```
packages/docs/
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── ApiExplorer.tsx    # Interactive API explorer
│   ├── FeatureCards.tsx   # Feature showcase cards
│   └── MetricsDashboard.tsx # Real-time metrics
├── content/               # MDX documentation pages
│   ├── getting-started/  # Getting started guides
│   ├── api-reference/    # API documentation
│   ├── sdks/             # SDK references
│   ├── guides/           # How-to guides
│   └── architecture/     # Architecture docs
├── lib/                   # Utility functions
├── styles/               # Global styles
├── next.config.js        # Next.js configuration
├── theme.config.js       # Nextra theme config
└── package.json          # Dependencies
```

## Adding Documentation

1. Create `.mdx` files in the `content/` directory
2. Add frontmatter with title and description
3. Use MDX components for rich content
4. Update `_meta.json` for sidebar navigation

## Components

### Nextra Components

- `<Callout type="info|warning|error|success">`
- `<Tabs>` and `<Tab>`
- Code blocks with syntax highlighting
- Inline code with backticks

### Custom Components

- `<ApiExplorer />` - Interactive API testing
- `<FeatureCards />` - Feature showcase
- `<MetricsDashboard />` - Real-time metrics

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run build
wrangler pages publish .next
```

## More Information

- [Next.js Docs](https://nextjs.org/docs)
- [Nextra Docs](https://nextra.site)
- [MDX Docs](https://mdxjs.com)
