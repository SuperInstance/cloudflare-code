# ClaudeFlare Packages

This directory contains the active packages for the ClaudeFlare platform - a Cloudflare-native AI development platform.

## Active Packages (27)

Core packages for Chat-to-Deploy functionality:

### Core Framework
- **agent-framework** (244K) - Multi-agent orchestration and coordination
- **state-machine** (216K) - Workflow orchestration and state management
- **api-gateway-v3** (296K) - API gateway with composition and streaming

### Development Tools
- **cli** (508K) - Command-line interface for development and deployment
- **codegen** (344K) - AI-powered code generation and scaffolding

### Data & Storage
- **db** (308K) - Database migrations for Cloudflare D1
- **storage** (380K) - Multi-cloud storage abstraction (R2, S3, GCS, Azure)

### Security
- **security** (208K) - Security middleware, headers, protection, and scanning

### Operations
- **deployment** (340K) - Deployment automation (zero-downtime, blue-green, canary)

### Shared Utilities
- **shared** (160K) - Shared TypeScript types and utilities

## Package Statistics

**Total Active Packages**: 27 (down from 1,487 - 98.2% reduction)

**Total Lines of Code**: ~3,354,000 lines (active packages only)

**Archive Size**: 100+ packages archived to `packages/archived/`

## Quick Start

### Installing Packages

```bash
# Install all packages
npm install

# Install a specific package
npm install @claudeflare/cli
```

### Building Packages

```bash
# Build all packages
npm run build

# Build a specific package
cd packages/cli && npm run build
```

### Running Tests

```bash
# Test all packages
npm test

# Test a specific package
cd packages/security && npm test
```

## Package Descriptions

### agent-framework
Advanced Agent Framework and Coordination for the ClaudeFlare distributed AI coding platform.

**Features:**
- Multi-agent orchestration
- Agent communication and messaging
- Task management and dependencies
- Agent lifecycle management
- Collaboration patterns

### api-gateway-v3
Next-Generation API Gateway with composition, streaming, edge optimization, and GraphQL federation.

**Features:**
- API composition and orchestration
- Streaming support (SSE, WebSocket)
- Edge optimization
- Real-time analytics
- GraphQL federation

### cli
Command-line interface for ClaudeFlare - A distributed AI coding platform on Cloudflare Workers.

**Features:**
- Project initialization
- Development server
- Build and deploy commands
- Configuration management
- Interactive prompts

### codegen
AI-powered code generation package for the ClaudeFlare distributed AI coding platform.

**Features:**
- Code synthesis from natural language
- Boilerplate generation
- API client generation
- SDK generation
- Schema generation
- Test generation
- Documentation generation

### db
Database migration and schema management system for ClaudeFlare D1 databases.

**Features:**
- Migration framework
- Schema management
- Rollback support
- Data seeding
- Migration testing
- Schema diff tools

### deployment
Production deployment automation system with zero-downtime, blue-green, and canary deployments.

**Features:**
- Zero-downtime deployment
- Blue-green deployment
- Canary deployment
- Smoke testing
- Deployment verification
- Continuous delivery

### security
Comprehensive security middleware and vulnerability scanning for ClaudeFlare.

**Features:**
- Security middleware
- Security headers (CSP, HSTS, etc.)
- Protection (XSS, CSRF)
- Secret scanning
- Dependency scanning
- Rate limiting

### shared
Shared TypeScript type definitions and utilities for ClaudeFlare platform.

**Features:**
- Common types
- Utility functions
- Constants
- Validation schemas

### state-machine
Advanced state machine and workflow orchestration for ClaudeFlare.

**Features:**
- Type-safe state machine
- Hierarchical states
- Parallel states
- State persistence
- Transition hooks
- State visualization
- Comprehensive testing

### storage
Storage abstraction layer for ClaudeFlare - Multi-backend file management with CDN, encryption, and analytics.

**Features:**
- Multi-storage backend support (R2, S3, GCS, Azure, Local)
- Advanced file management
- Bucket management
- CDN integration
- Encryption
- Versioning
- Analytics

## Documentation

Package documentation has been moved to: `/docs/packages/`

### Available Documentation Files
- `CLI_FILES_SUMMARY.txt` - CLI package file structure
- `OPTIMIZATION_*.md` - Optimization progress reports
- `PACKAGE_CONSOLIDATION_WEEK2.md` - Week 2 consolidation plan

## Archived Packages

Packages that are no longer maintained are in: `packages/archived/`

See the archived directory for details on deprecated packages.

### Recently Archived
- **security-core** (archived 2025-01-22) - Comprehensive security framework
  - Reason: Duplicate functionality with `security` package
  - Note: Merge deferred due to type conflicts - see consolidation plan

## Development Workflow

### Adding a New Package

1. Create package directory: `packages/my-package/`
2. Initialize: `npm init` or copy from template
3. Add to `packages/package.json` workspaces
4. Update this README

### Updating Dependencies

```bash
# Update all packages
npm update

# Update specific package
cd packages/my-package && npm update
```

## Monorepo Configuration

This is a npm workspaces monorepo. The root `package.json` defines:

```json
{
  "workspaces": [
    "agent-framework",
    "api-gateway-v3",
    "cli",
    "codegen",
    "db",
    "deployment",
    "security",
    "shared",
    "state-machine",
    "storage"
  ]
}
```

## Scripts

Available npm scripts from the root:

- `npm run build` - Build all packages
- `npm run test` - Test all packages
- `npm run lint` - Lint all packages
- `npm run typecheck` - Type check all packages
- `npm run clean` - Clean all build artifacts

## Contributing

When contributing to packages:

1. Follow the existing code style
2. Add tests for new features
3. Update TypeScript types
4. Update package documentation
5. Run `npm run typecheck` before committing

## Versioning

Packages follow semantic versioning (SemVer):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## License

All packages are licensed under MIT unless otherwise specified in their package.json.

## Support

For issues, questions, or contributions:

- GitHub Issues: Report bugs and request features
- Documentation: See `/docs/` for detailed documentation
- Discord: Join the community for discussions

---

*Last Updated: 2025-01-22*
*Total Reduction: 98.2% (1,487 → 27 packages)*
*Archive: 100+ packages in `packages/archived/`*
