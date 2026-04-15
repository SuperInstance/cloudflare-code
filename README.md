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

---

## 📐 Detailed Architecture

### Monorepo Structure (Post-Streamlining)

```
cocapn/
├── src/
│   ├── worker.ts              # Cloudflare Worker entry point
│   ├── index.ts               # App bootstrap
│   ├── auth.ts                # Authentication service
│   ├── stem-router.ts         # STEM learning assistant router
│   ├── stem-service.ts        # STEM AI service
│   ├── types.ts               # Shared TypeScript types
│   ├── durable/
│   │   ├── coordinator-agent.ts   # Durable Object: agent coordination
│   │   ├── agent-orchestrator.ts  # Durable Object: task orchestration
│   │   └── vector-index.ts        # Durable Object: vector search index
│   ├── agents/
│   │   ├── agent-manager.ts       # Agent registry & lifecycle
│   │   ├── deploy-agent.ts        # Deployment automation agent
│   │   ├── api-agent.ts           # API generation agent
│   │   ├── ui-agent.ts            # UI generation agent
│   │   ├── database-agent.ts      # Database schema agent
│   │   ├── security-agent.ts      # Security hardening agent
│   │   └── ... (20+ specialized agents)
│   ├── services/
│   │   ├── chat-to-deploy-service.ts  # Core chat-to-deploy pipeline
│   │   ├── code-review-service.ts     # AI-powered code review
│   │   ├── auth-service.ts            # JWT auth with D1
│   │   ├── cache-service.ts           # KV caching layer
│   │   ├── security-testing-service.ts # Automated security scans
│   │   └── testing-service.ts         # Test generation & execution
│   ├── routes/
│   │   ├── auth-routes.ts        # /api/auth/*
│   │   ├── dev-routes.ts         # /api/dev/*
│   │   └── testing-routes.ts     # /api/testing/*
│   ├── components/              # Hybrid IDE React components
│   │   ├── hybrid-ide.tsx        # Main IDE layout
│   │   ├── editor-panel.tsx      # Code editor panel
│   │   ├── terminal-panel.tsx    # Integrated terminal
│   │   ├── file-tree.tsx         # File browser
│   │   ├── chat-interface.tsx    # AI chat panel
│   │   ├── preview-panel.tsx     # Live preview iframe
│   │   ├── stem-panel.tsx        # STEM learning assistant
│   │   └── stem-learning-assistant.tsx
│   └── middleware/
│       ├── auth-middleware.ts    # JWT verification
│       └── compression.ts       # Response compression
├── packages/                  # Internal packages
│   ├── codegen/               # AI code generation engine
│   │   ├── src/llm/            # LLM provider abstraction
│   │   ├── src/templates/      # Code templates
│   │   ├── src/schema/         # Schema generation
│   │   ├── src/boilerplate/     # Project scaffolding
│   │   └── src/synthesis/      # Code synthesis & merging
│   ├── api-gateway-v3/        # API gateway with caching
│   ├── agent-framework/       # Agent orchestration framework
│   ├── deployment/            # Zero-downtime deployment
│   ├── state-machine/         # Durable Objects state machine
│   ├── db/                    # D1 database abstraction
│   ├── security/              # Security headers & scanning
│   ├── shared/                # Shared types & utilities
│   └── cli/                   # Developer CLI tool
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── e2e/                   # End-to-end tests
│   ├── sessions/              # Session management tests
│   ├── metrics/               # Metrics & monitoring tests
│   ├── router/                # Smart router tests
│   ├── performance/           # Performance benchmarks
│   └── smoke/                 # Smoke tests
├── wrangler.toml              # Cloudflare Workers config
└── dashboards/                # Grafana monitoring dashboards
```

### Processing Pipeline

```
User Prompt ("Build me a REST API")
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                    Chat-to-Deploy Pipeline                 │
│                                                           │
│  ┌────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │  Intent     │───▶│  Agent       │───▶│  Code         │ │
│  │  Analysis   │    │  Selection   │    │  Generation   │ │
│  └────────────┘    └──────────────┘    └───────┬───────┘ │
│                                                │          │
│  ┌────────────┐    ┌──────────────┐    ┌───────▼───────┐ │
│  │  Deploy     │◀───│  Security    │◀───│  Code Review  │ │
│  │  to Workers │    │  Scan        │    │  & Testing    │ │
│  └──────┬─────┘    └──────────────┘    └───────────────┘ │
│         │                                                  │
│         ▼                                                  │
│  🚀 https://my-api.cocapn.workers.dev                     │
│     (Live in <60 seconds)                                  │
└───────────────────────────────────────────────────────────┘
```

### Agent System

Cocapn uses a multi-agent architecture where specialized AI agents collaborate:

| Agent | Role | LLM Provider |
|-------|------|-------------|
| **api-agent** | REST/GraphQL API generation | Manus, Grok |
| **ui-agent** | React component & page generation | Manus, Minimax |
| **database-agent** | Schema design & migration generation | Manus, Z.ai |
| **deploy-agent** | Wrangler config & deployment automation | Z.ai |
| **security-agent** | Security headers, input validation, auth | Grok |
| **code-review-agent** | Linting, type checking, best practices | Manus |
| **testing-agent** | Unit & integration test generation | Minimax |
| **performance-agent** | Optimization & performance profiling | Grok |

### Multi-Provider AI Routing

```typescript
// Smart router selects optimal LLM per task type
const providers = {
  fast: ['grok', 'z.ai'],        // Quick responses, simple tasks
  creative: ['manus', 'minimax'], // Code generation, complex tasks
  reasoning: ['grok', 'manus'],   // Architecture, debugging
};
```

---

## 🚀 Deployment Guide

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier works)
- API keys for at least one LLM provider

### Quick Deploy

```bash
# Clone and install
git clone https://github.com/your-org/cocapn.git
cd cocapn
npm install

# Setup Wrangler
npx wrangler login

# Configure environment
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your settings

# Deploy
npm run deploy
```

### Environment Configuration

```bash
# wrangler.toml - key variables
[vars]
ENVIRONMENT = "production"
ALLOWED_EMAIL = "your@email.com"

# Secrets (set via CLI)
npx wrangler secret put MANUS_API_KEY
npx wrangler secret put GROK_API_KEY
npx wrangler secret put JWT_SECRET
```

### Deployment Strategies

The `packages/deployment` package provides:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Blue-Green** | Two parallel deployments with instant switch | Zero-downtime updates |
| **Canary** | Gradual traffic shifting (1% → 10% → 100%) | Risk mitigation |
| **Rollback** | Instant rollback to previous version | Failed deployment recovery |
| **Verification** | Automated smoke tests before traffic shift | Quality assurance |

---

<img src="callsign1.jpg" width="128" alt="callsign">
