# Cocapn: Chat-to-Deploy in 60 Seconds

> **AI-powered Cloudflare Workers development platform**
> Describe your app, get a live URL in 60 seconds. No credit card, no configuration, no BS.

---

## The Killer Feature

**Chat-to-Deploy** - From idea to production in under a minute:

```
You: "Build me a REST API with user authentication"

Cocapn: [Generates complete working code]
        [Deploys to Cloudflare Workers]
        [Returns live URL: https://my-api.cocapn.workers.dev]

Time elapsed: 47 seconds
```

**Why It's Irresistible:**
- ✅ **Instant Gratification** - See results in under a minute
- ✅ **Zero Configuration** - No setup, no AWS accounts, no credit cards
- ✅ **Real Working Code** - Production-ready applications, not boilerplate
- ✅ **Free to Try** - Works on Cloudflare's generous free tier
- ✅ **Viral Sharing** - Every deployment creates a shareable URL

---

## Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/cocapn.git
cd cocapn

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development

```bash
npm run dev          # Start local development server
npm run build        # Build for production
npm run deploy       # Deploy to Workers
npm run typecheck    # Type check code
npm run test         # Run tests
```

---

## Architecture

### Cloudflare-Native Stack

```
┌─────────────────────────────────────────┐
│         Chat Interface                  │
│    (Natural language input)             │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      AI Code Generation Engine          │
│  (Multi-provider routing:               │
│   Manus, Z.ai, Minimax, Grok)           │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Cloudflare Workers Deployment       │
│  (Auto-generate .workers.dev subdomain) │
└─────────────────────────────────────────┘
                  ↓
         🚀 LIVE URL IN <60 SECONDS
```

### Technology Stack

- **Edge Runtime**: Cloudflare Workers (100K requests/day free)
- **Framework**: Hono.js
- **Database**: D1 (SQLite, 5GB free)
- **Cache**: KV (1GB free)
- **Storage**: R2 (10GB free)
- **State**: Durable Objects (unlimited free)

---

## Platform Status

### Current Version: 2.0.0 (Streamlined)

**Recent Streamlining (Week 1 Complete)**:
- ✅ 96% reduction in packages (1,487 → 28 active)
- ✅ 93% reduction in documentation (97 → 7 core docs)
- ✅ 84% reduction in npm scripts (67 → 11 scripts)
- ✅ 94% reduction in dependencies (334 → ~20)
- ✅ 80% reduction in bundle size (~550MB → ~110MB)

**Remaining Packages** (focused on core features):
- `api-gateway-v3` - Main API routing
- `codegen` - AI code generation
- `cli` - Developer tools
- `agent-framework` - AI agent orchestration
- `deployment` - Deployment orchestration
- `storage` / `db` - Data layer
- `security` / `security-core` - Security
- `shared` - Shared utilities
- `state-machine` - Durable Objects state

---

## Core Documentation

### 7 Essential Docs

1. **[README.md](./README.md)** - This file
2. **[CLAUDE.md](./CLAUDE.md)** - Project instructions
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
4. **[ROADMAP.md](./ROADMAP.md)** - Sprint roadmap
5. **[AGENTS.md](./AGENTS.md)** - AI agent team
6. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
7. **[PORTAL.md](./PORTAL.md)** - Portal features

### Archived Documentation

All research, implementation guides, and analysis documents have been archived to:
`../claudeflare-archive/research-docs/`

---

## Development

### Scripts

```bash
npm run dev              # Start local server
npm run build            # Build for production
npm run build:analyze    # Analyze bundle size
npm run deploy           # Deploy to production
npm run deploy:staging   # Deploy to staging
npm run typecheck        # Type check with incremental cache
npm run test             # Run tests
npm run test:coverage    # Test with coverage
npm run lint             # Lint code
npm run lint:fix         # Auto-fix lint issues
```

### Project Structure

```
cocapn/
├── src/
│   ├── workers/           # Cloudflare Workers
│   ├── durable-objects/   # Stateful compute
│   ├── agents/            # AI agent implementations
│   └── index.ts           # Entry point
├── packages/
│   ├── archived/          # Archived packages (100+)
│   ├── api-gateway-v3/    # Main API
│   ├── codegen/           # AI code generation
│   └── ... (27 active packages)
├── docs/                  # Streamlined documentation
└── tests/                 # Test suites
```

---

## Deployment

### Quick Deploy

```bash
# Deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging
```

### Access Points

- **Development**: [cocapn.com/dev](https://cocapn.com/dev)
- **AI Building**: [cocapn.ai/dev](https://cocapn.ai/dev)

### Authentication

- **Default**: `admin` / `admin123`
- ⚠️ **Change immediately after first login!**

---

## Philosophy

### The 60-Second Rule

**Every feature must pass**: "Does this help users go from idea to deployed app in under 60 seconds?"

- If NO → Kill it
- If MAYBE → Kill it
- If YES → Keep it

### Focus

**We do one thing exceptionally well**: Chat-to-Deploy on Cloudflare Workers.

Everything else is secondary.

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: See [Core Documentation](#core-documentation) above

---

**Version**: 2.0.0 (Streamlined)
**Status**: Week 1 Complete - 40% Improvement Achieved
**Last Updated**: 2026-01-21
