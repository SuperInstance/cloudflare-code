# ClaudeFlare Quick Start Guide

## Prerequisites

- Node.js >= 20.0.0
- Go >= 1.21
- Cloudflare account (free tier)
- Wrangler CLI

## Installation

```bash
# 1. Clone and navigate
git clone <repo-url>
cd claudeflare

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your Cloudflare credentials

# 4. Login to Cloudflare
wrangler login

# 5. Initialize resources (first time only)
wrangler d1 create claudeflare-db
wrangler r2 bucket create claudeflare-assets
wrangler kv namespace create claudeflare-kv

# 6. Update wrangler.toml with resource IDs
```

## Development

```bash
# Start Workers development server
npm run dev

# Start desktop proxy (separate terminal)
npm run desktop:dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Building

```bash
# Build for production
npm run build

# Check bundle size (must be < 3MB)
npm run check-bundle-size

# Analyze bundle
npm run analyze-bundle
```

## Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Verify deployment
npm run verify:deployment
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/edge/src/index.ts` | Workers entry point |
| `packages/desktop/cmd/desktop/main.go` | Desktop entry point |
| `packages/shared/src/types/` | Shared types |
| `wrangler.toml` | Deployment config |
| `package.json` | Dependencies & scripts |

## Environment Variables

Required in `.env`:
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Workers permissions
- `CLOUDFLARE_D1_DATABASE_ID` - D1 database ID
- `CLOUDFLARE_KV_NAMESPACE_ID` - KV namespace ID
- `CLOUDFLARE_R2_BUCKET_NAME` - R2 bucket name

## Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Smoke tests
npm run test:smoke

# Coverage
npm run test:coverage
```

## Useful Commands

```bash
# Tail Workers logs
npm run tail

# View bundle analysis
npm run analyze-bundle

# Format code
npm run format

# Clean build artifacts
npm run clean
```

## Troubleshooting

### Bundle size exceeds 3MB
```bash
npm run analyze-bundle
# Review the visualization and remove unused dependencies
```

### Tests failing
```bash
npm run clean
npm install
npm test
```

### Deployment fails
```bash
# Check environment variables
cat .env

# Verify Cloudflare authentication
wrangler whoami

# Check resource IDs in wrangler.toml
```

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Edge API  │────▶│   Desktop   │
│  (Client)   │     │  (Workers)  │     │  (Go Proxy) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  AI Layer   │
                    │ (Multi-Cloud)│
                    └─────────────┘
```

## Next Steps

1. Review `PROJECT_STRUCTURE.md` for detailed architecture
2. Read `README.md` for full documentation
3. Check `INITIALIZATION_SUMMARY.md` for what's been set up
4. Start building in `packages/edge/src/`

## Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Architecture: `PROJECT_STRUCTURE.md`

---

**Ready to build!** The development environment is fully configured and optimized for the Cloudflare Workers free tier.
