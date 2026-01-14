# ClaudeFlare Project Structure

## Root Configuration

```
claudeflare/
├── package.json              # Monorepo root configuration
├── tsconfig.json            # Root TypeScript configuration
├── wrangler.toml            # Cloudflare Workers deployment config
├── turbo.json               # Turborepo pipeline configuration
├── .gitignore               # Git ignore rules (Workers/D1/R2 optimized)
├── .eslintrc.js             # ESLint configuration (Workers-compatible)
├── .prettierrc              # Prettier formatting rules
├── .husky/                  # Git hooks
│   └── pre-commit          # Pre-commit validation
├── .lintstagedrc.json       # Lint-staged configuration
├── .env.example             # Environment variables template
├── LICENSE                  # MIT License
├── README.md                # Project documentation
└── scripts/                 # Build and deployment scripts
    ├── deploy.sh           # Deployment script
    └── check-bundle-size.js # Bundle size validation
```

## Packages

### `/packages/edge` - Cloudflare Workers (TypeScript)

```
packages/edge/
├── package.json             # Edge package dependencies
├── tsconfig.json           # Edge TypeScript config
├── jest.config.js          # Test configuration
├── src/
│   ├── index.ts           # Entry point (itty-router)
│   ├── types/             # Type definitions
│   ├── routes/            # API route handlers
│   ├── middleware/        # Request/response middleware
│   ├── lib/              # Utility libraries
│   ├── workers/          # Worker-specific code
│   └── durable-objects/  # Durable Object classes
└── tests/
    ├── setup.ts          # Test configuration
    └── *.test.ts         # Unit tests
```

**Key Files:**
- `src/index.ts`: Main Worker fetch handler
- `src/types/index.ts`: Worker-specific types
- `src/lib/kv.ts`: KV namespace utilities
- `src/lib/r2.ts`: R2 bucket operations

**Dependencies:**
- `itty-router`: Lightweight routing
- `@cloudflare/workers-types`: TypeScript bindings
- `esbuild`: Fast bundling

### `/packages/desktop` - Go WebRTC Proxy

```
packages/desktop/
├── go.mod                 # Go module definition
├── Makefile              # Build automation
├── cmd/
│   └── desktop/
│       └── main.go      # Application entry point
└── pkg/
    ├── webrtc/
    │   └── manager.go   # WebRTC peer connection management
    └── signaling/
        └── server.go    # WebRTC signaling server
```

**Key Files:**
- `cmd/desktop/main.go`: HTTP server with WebRTC endpoints
- `pkg/webrtc/manager.go`: Peer connection state management
- `pkg/signaling/server.go`: SDP offer/answer handling

**Dependencies:**
- `github.com/pion/webrtc/v3`: WebRTC implementation
- `github.com/gin-gonic/gin`: HTTP framework

### `/packages/shared` - Shared Types and Utilities

```
packages/shared/
├── package.json           # Shared package configuration
├── tsconfig.json         # Shared TypeScript config
└── src/
    ├── index.ts         # Package entry point
    ├── types/           # Shared type definitions
    │   ├── index.ts    # Core types (User, Agent, Error, etc.)
    │   ├── providers.ts # AI provider types
    │   ├── metrics.ts  # Cost analytics types
    │   ├── storage.ts  # Storage interface types
    │   ├── validation.ts # Validation schemas
    │   └── utils.ts    # Utility types
    ├── utils/           # Shared utilities
    │   └── index.ts    # Helper functions
    └── constants/       # Shared constants
        └── index.ts    # App-wide constants
```

**Key Types:**
- `User`, `Agent`: Domain entities
- `AIProvider`, `AIModel`: Provider abstraction
- `CostMetrics`, `TokenUsage`: Analytics types
- `WebRTCSession`, `DocumentChunk`: Communication types

## Infrastructure

### `/infra` - Infrastructure as Code

```
infra/
├── tf/                  # Terraform configurations
└── ansible/            # Ansible playbooks (if needed)
```

### `/docs` - Documentation

```
docs/
├── architecture/        # System architecture docs
├── api/                # API documentation
└── deployment/         # Deployment guides
```

## GitHub Workflows

```
.github/workflows/
├── ci.yml                        # Continuous Integration
├── deploy-staging.yml           # Staging deployment
└── deploy-production.yml        # Production deployment
```

## File Purposes

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Monorepo configuration, scripts, dependencies |
| `tsconfig.json` | TypeScript compiler options (strict mode) |
| `wrangler.toml` | Cloudflare Workers deployment config |
| `turbo.json` | Turborepo pipeline caching |
| `.gitignore` | Git exclusions (Workers, D1, R2) |
| `.eslintrc.js` | Code linting rules |
| `.prettierrc` | Code formatting rules |

### Entry Points

| File | Purpose |
|------|---------|
| `packages/edge/src/index.ts` | Cloudflare Workers entry point |
| `packages/desktop/cmd/desktop/main.go` | Desktop proxy entry point |
| `packages/shared/src/index.ts` | Shared library entry point |

### Build Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run check-bundle-size` | Verify Workers 3MB limit |

## Bundle Size Breakdown

The Workers free tier has a **3MB** limit. Current allocation:

```
Total Bundle: 3MB limit
├── Edge Runtime: ~500KB estimated
├── Dependencies: ~1MB estimated
├── Application Code: ~500KB estimated
└── Buffer: ~1MB for growth
```

## Monorepo Benefits

1. **Shared Types**: Single source of truth for data structures
2. **Code Reuse**: Utilities shared across edge and desktop
3. **Independent Deployment**: Edge and desktop can deploy separately
4. **Type Safety**: TypeScript strict mode across all packages
5. **Efficient Builds**: Turborepo caching and parallel builds

## Development Workflow

```bash
# Initial setup
npm install
cp .env.example .env

# Development
npm run dev                    # Start Workers locally
npm run desktop:dev            # Start Go proxy

# Testing
npm test                       # Run all tests
npm run test:coverage         # Run with coverage

# Building
npm run build                 # Build all packages
npm run check-bundle-size     # Verify size limits

# Deployment
npm run deploy:staging        # Deploy to staging
npm run deploy:production     # Deploy to production
```

## Key Constraints

1. **Bundle Size**: Must stay under 3MB for Workers free tier
2. **Cold Starts**: Keep initialization fast
3. **Memory**: 128MB limit per Durable Object
4. **CPU Time**: 10ms CPU limit per request (free tier)
5. **No File System**: Workers cannot write to disk

## Optimization Strategies

1. **Tree-shaking**: Remove unused code with esbuild
2. **Code Splitting**: Load code per route
3. **Minification**: Aggressive minification
4. **Dependency Review**: Use minimal packages
5. **Lazy Loading**: Load heavy code on-demand
