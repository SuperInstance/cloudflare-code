# ClaudeFlare CLI

Command-line interface for ClaudeFlare - A distributed AI coding platform on Cloudflare Workers.

## Installation

### Global Installation

```bash
npm install -g @claudeflare/cli
```

### Local Installation

```bash
npm install --save-dev @claudeflare/cli
```

## Quick Start

```bash
# Initialize a new project
claudeflare init

# Start development server
claudeflare dev

# Deploy to Cloudflare
claudeflare deploy
```

## Commands

### `claudeflare init`

Initialize a new ClaudeFlare project.

```bash
claudeflare init [options]
```

**Options:**

- `-n, --name <string>` - Project name
- `-d, --description <string>` - Project description
- `-t, --template <string>` - Template to use (basic, api, fullstack)
- `--directory <path>` - Directory to create project in
- `-f, --force` - Overwrite existing directory
- `--no-install` - Skip installing dependencies
- `--no-git` - Skip git initialization
- `--debug` - Enable debug output

**Examples:**

```bash
# Interactive project creation
claudeflare init

# Quick start with defaults
claudeflare init --name my-app --template api

# Create in specific directory
claudeflare init --name my-app --directory ./projects/my-app
```

### `claudeflare dev`

Start local development server with hot reload.

```bash
claudeflare dev [options]
```

**Options:**

- `-p, --port <number>` - Port to run dev server on (default: 8788)
- `-h, --host <string>` - Host to bind to (default: localhost)
- `--no-proxy` - Disable proxy to Cloudflare Workers
- `-o, --open` - Open browser automatically
- `--https` - Use HTTPS
- `--no-watch` - Disable file watching
- `-e, --environment <name>` - Environment to use
- `--debug` - Enable debug output

**Examples:**

```bash
# Start dev server
claudeflare dev

# Start on custom port
claudeflare dev --port 3000

# Start with browser open
claudeflare dev --open
```

### `claudeflare build`

Build for production.

```bash
claudeflare build [options]
```

**Options:**

- `--no-minify` - Disable minification
- `--no-sourcemap` - Disable sourcemaps
- `-a, --analyze` - Analyze bundle
- `-o, --output <path>` - Output file path
- `-e, --environment <name>` - Environment to use
- `--debug` - Enable debug output

**Examples:**

```bash
# Build for production
claudeflare build

# Build without minification
claudeflare build --no-minify

# Build with bundle analysis
claudeflare build --analyze
```

### `claudeflare deploy`

Deploy to Cloudflare Workers.

```bash
claudeflare deploy [options]
```

**Options:**

- `-e, --environment <name>` - Environment to deploy to (default: preview)
- `-n, --name <string>` - Worker name
- `--var <key=value>` - Environment variable (can be used multiple times)
- `--secret <key=value>` - Secret (can be used multiple times)
- `--kv-namespace <binding:id>` - KV namespace binding (can be used multiple times)
- `--r2-bucket <binding:bucket>` - R2 bucket binding (can be used multiple times)
- `--dry-run` - Validate without deploying
- `-f, --force` - Skip confirmation prompts
- `--debug` - Enable debug output

**Examples:**

```bash
# Deploy to preview
claudeflare deploy

# Deploy to production
claudeflare deploy --environment production

# Deploy with custom variable
claudeflare deploy --var API_URL=https://api.example.com

# Dry run to validate
claudeflare deploy --dry-run
```

### `claudeflare test`

Run tests.

```bash
claudeflare test [options]
```

**Options:**

- `-w, --watch` - Watch mode
- `-c, --coverage` - Generate coverage report
- `--ui` - Run with UI
- `-p, --pattern <pattern>` - Test file pattern
- `-e, --environment <name>` - Environment to use (default: test)
- `--debug` - Enable debug output

**Examples:**

```bash
# Run tests once
claudeflare test

# Run in watch mode
claudeflare test --watch

# Run with coverage
claudeflare test --coverage

# Run specific tests
claudeflare test --pattern ".*unit.*"
```

### `claudeflare logs`

Tail worker logs.

```bash
claudeflare logs [options]
```

**Options:**

- `-f, --format <format>` - Log format (json, pretty) (default: pretty)
- `--filter <filter>` - Filter logs
- `-s, --status <status>` - Filter by status (success, error, canceled)
- `-e, --environment <name>` - Environment to use
- `--debug` - Enable debug output

**Examples:**

```bash
# Tail all logs
claudeflare logs

# Filter errors only
claudeflare logs --status error

# JSON format
claudeflare logs --format json
```

### `claudeflare config`

Manage configuration.

```bash
claudeflare config [command] [options]
```

**Subcommands:**

- `list` - List all configuration values
- `set <key> <value>` - Set a configuration value
- `get <key>` - Get a configuration value
- `validate` - Validate configuration

**Options:**

- `-e, --environment <name>` - Environment to use

**Examples:**

```bash
# List all config
claudeflare config list

# Get specific value
claudeflare config get dev.port

# Set value
claudeflare config set dev.port 3000

# Validate config
claudeflare config validate
```

### `claudeflare doctor`

Diagnose and fix issues.

```bash
claudeflare doctor [options]
```

**Options:**

- `-f, --fix` - Automatically fix issues
- `-v, --verbose` - Verbose output
- `--debug` - Enable debug output

**Examples:**

```bash
# Run diagnostics
claudeflare doctor

# Auto-fix issues
claudeflare doctor --fix

# Verbose output
claudeflare doctor --verbose
```

### `claudeflare version`

Show version information.

```bash
claudeflare version [options]
```

**Options:**

- `-v, --verbose` - Verbose output

## Configuration

ClaudeFlare uses a `claudeflare.config.ts` file for configuration:

```typescript
import { defineConfig } from '@claudeflare/cli';

export default defineConfig({
  name: 'my-app',
  version: '0.1.0',
  description: 'My ClaudeFlare application',

  worker: {
    name: 'my-worker',
    main: 'src/index.ts',
    compatibility_date: '2024-01-01',
  },

  build: {
    input: 'src/index.ts',
    output: 'dist/worker.js',
    minify: true,
    sourcemap: true,
  },

  dev: {
    port: 8788,
    host: 'localhost',
    proxy: true,
    open: false,
  },

  deploy: {
    environment: 'preview',
    workers: {
      name: 'my-worker',
    },
  },

  monitoring: {
    enabled: true,
    metrics: true,
    traces: true,
    logs: true,
  },
});
```

## Project Structure

A typical ClaudeFlare project:

```
my-app/
├── src/
│   └── index.ts           # Worker entry point
├── claudeflare.config.ts  # ClaudeFlare configuration
├── wrangler.toml          # Cloudflare Workers configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variables

Create a `.env` file in your project root:

```bash
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Application
ENVIRONMENT=development
LOG_LEVEL=debug
```

## Troubleshooting

### Build fails with "Module not found"

Ensure all dependencies are installed:

```bash
npm install
```

### Wrangler not found

Install Wrangler globally:

```bash
npm install -g wrangler
```

### Authentication errors

Login to Cloudflare:

```bash
wrangler login
```

### Port already in use

Use a different port:

```bash
claudeflare dev --port 3000
```

## Advanced Usage

### Custom Templates

Create your own project templates by extending the template system.

### Hot Reload

The dev server automatically rebuilds when files change. Disable with:

```bash
claudeflare dev --no-watch
```

### Multiple Environments

Configure multiple environments in your config:

```typescript
export default defineConfig({
  env: {
    development: {
      API_URL: 'http://localhost:3000',
    },
    production: {
      API_URL: 'https://api.example.com',
    },
  },
});
```

### CI/CD Integration

```bash
# Build
claudeflare build

# Test
claudeflare test

# Deploy to staging
claudeflare deploy --environment staging

# Deploy to production
claudeflare deploy --environment production --force
```

## Support

- Documentation: https://github.com/claudeflare/claudeflare
- Issues: https://github.com/claudeflare/claudeflare/issues
- Discord: https://discord.gg/claudeflare

## License

MIT
