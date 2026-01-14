# ClaudeFlare CLI Command Reference

Complete reference for all ClaudeFlare CLI commands.

## Table of Contents

- [Project Commands](#project-commands)
- [Development Commands](#development-commands)
- [Build Commands](#build-commands)
- [Deployment Commands](#deployment-commands)
- [Configuration Commands](#configuration-commands)
- [Resource Commands](#resource-commands)
- [Monitoring Commands](#monitoring-commands)
- [Utility Commands](#utility-commands)

---

## Project Commands

### `claudeflare init`

Initialize a new ClaudeFlare project.

```bash
claudeflare init [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--name` | `-n` | string | - | Project name |
| `--description` | `-d` | string | - | Project description |
| `--template` | `-t` | string | - | Template (minimal, standard, full, api, webhook) |
| `--directory` | - | path | - | Directory to create project in |
| `--force` | `-f` | boolean | false | Overwrite existing directory |
| `--no-install` | - | boolean | false | Skip installing dependencies |
| `--no-git` | - | boolean | false | Skip git initialization |
| `--no-config` | - | boolean | false | Skip creating config file |

**Examples:**

```bash
# Interactive mode
claudeflare init

# Quick start
claudeflare init --name my-app --template standard

# Full configuration
claudeflare init \
  --name my-app \
  --description "My awesome app" \
  --template full \
  --directory ./apps/my-app \
  --install \
  --git
```

### `claudeflare new`

Create a new resource (worker, route, middleware, etc.).

```bash
claudeflare new <type> <name> [options]
```

**Types:**

- `worker` - Create a new Cloudflare Worker
- `route` - Create a new route handler
- `middleware` - Create middleware
- `controller` - Create a controller
- `service` - Create a service
- `model` - Create a data model

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--type` | `-t` | string | - | Resource type |
| `--name` | `-n` | string | - | Resource name |
| `--path` | `-p` | path | - | Custom path for the resource |

**Examples:**

```bash
# Create a worker
claudeflare new worker auth-worker

# Create a route
claudeflare new route users

# Create middleware
claudeflare new middleware authentication

# Create with custom path
claudeflare new service api --path src/services
```

---

## Development Commands

### `claudeflare dev`

Start local development server with hot reload.

```bash
claudeflare dev [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--port` | `-p` | number | 8788 | Port to run dev server on |
| `--host` | `-h` | string | localhost | Host to bind to |
| `--no-proxy` | - | boolean | false | Disable proxy to Cloudflare Workers |
| `--open` | `-o` | boolean | false | Open browser automatically |
| `--https` | - | boolean | false | Use HTTPS |
| `--no-watch` | - | boolean | false | Disable file watching |
| `--environment` | `-e` | string | - | Environment to use |

**Examples:**

```bash
# Start dev server
claudeflare dev

# Custom port
claudeflare dev --port 3000

# With browser open
claudeflare dev --open

# Without file watching
claudeflare dev --no-watch
```

### `claudeflare run`

Run worker locally (alias for dev).

```bash
claudeflare run [options]
```

**Options:** Same as `claudeflare dev`

---

## Build Commands

### `claudeflare build`

Build for production.

```bash
claudeflare build [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--no-minify` | - | boolean | false | Disable minification |
| `--no-sourcemap` | - | boolean | false | Disable sourcemaps |
| `--analyze` | `-a` | boolean | false | Analyze bundle |
| `--output` | `-o` | path | - | Output file path |
| `--environment` | `-e` | string | - | Environment to use |
| `--watch` | `-w` | boolean | false | Watch mode |

**Examples:**

```bash
# Build for production
claudeflare build

# Without minification
claudeflare build --no-minify

# With bundle analysis
claudeflare build --analyze

# Watch mode
claudeflare build --watch
```

---

## Deployment Commands

### `claudeflare deploy`

Deploy to Cloudflare Workers.

```bash
claudeflare deploy [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--environment` | `-e` | string | preview | Environment (preview, production, development) |
| `--name` | `-n` | string | - | Worker name |
| `--var` | - | string[] | - | Environment variables (KEY=VALUE) |
| `--secret` | - | string[] | - | Secrets |
| `--kv-namespace` | - | string[] | - | KV namespace bindings |
| `--r2-bucket` | - | string[] | - | R2 bucket bindings |
| `--dry-run` | - | boolean | false | Validate without deploying |
| `--force` | `-f` | boolean | false | Skip confirmation prompts |

**Examples:**

```bash
# Deploy to preview
claudeflare deploy

# Deploy to production
claudeflare deploy --environment production

# With custom variable
claudeflare deploy --var API_URL=https://api.example.com

# Dry run
claudeflare deploy --dry-run

# Force deploy
claudeflare deploy --force
```

### `claudeflare rollback`

Rollback a deployment.

```bash
claudeflare rollback [version] [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--environment` | `-e` | string | - | Environment to rollback |
| `--force` | `-f` | boolean | false | Skip confirmation |

**Examples:**

```bash
# Rollback to specific version
claudeflare rollback v1.2.3

# Rollback production
claudeflare rollback v1.2.3 --environment production
```

---

## Configuration Commands

### `claudeflare config`

Manage configuration.

```bash
claudeflare config <command> [options]
```

**Subcommands:**

- `list` - List all configuration values
- `get <key>` - Get a configuration value
- `set <key> <value>` - Set a configuration value
- `validate` - Validate configuration

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

### `claudeflare env`

Manage environment variables.

```bash
claudeflare env <command> [options]
```

**Subcommands:**

- `list` - List all environment variables
- `get <key>` - Get an environment variable
- `set <key> <value>` - Set an environment variable
- `remove <key>` - Remove an environment variable

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--environment` | `-e` | string | - | Environment to use |

**Examples:**

```bash
# List variables
claudeflare env list

# Set variable
claudeflare env set API_URL https://api.example.com

# Get variable
claudeflare env get API_URL

# Remove variable
claudeflare env remove API_URL

# Production environment
claudeflare env list --environment production
```

### `claudeflare secrets`

Manage Cloudflare Workers secrets.

```bash
claudeflare secrets <command> [options]
```

**Subcommands:**

- `list` - List all secrets
- `put <key>` - Set a secret
- `remove <key>` - Remove a secret

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--environment` | `-e` | string | - | Environment to use |

**Examples:**

```bash
# List secrets
claudeflare secrets list

# Set secret
claudeflare secrets put API_KEY

# Remove secret
claudeflare secrets remove API_KEY
```

---

## Resource Commands

### `claudeflare add`

Add a package or feature to your project.

```bash
claudeflare add <package> [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--dev` | `-D` | boolean | false | Add as dev dependency |
| `--exact` | `-E` | boolean | false | Install exact version |

**Examples:**

```bash
# Add production dependency
claudeflare add hono

# Add dev dependency
claudeflare add typescript --dev

# Add exact version
claudeflare add zod@3.22.4 --exact
```

### `claudeflare remove`

Remove a package from your project.

```bash
claudeflare remove <package> [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--force` | `-f` | boolean | false | Skip confirmation |

**Examples:**

```bash
# Remove package
claudeflare remove lodash

# Force remove
claudeflare remove lodash --force
```

---

## Monitoring Commands

### `claudeflare logs`

View worker logs.

```bash
claudeflare logs [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--format` | `-f` | string | pretty | Log format (json, pretty) |
| `--filter` | - | string | - | Filter logs |
| `--status` | `-s` | string | - | Filter by status |
| `--count` | `-n` | number | 100 | Number of logs to show |

**Examples:**

```bash
# Show recent logs
claudeflare logs

# JSON format
claudeflare logs --format json

# Filter errors
claudeflare logs --status error

# Show last 50 logs
claudeflare logs --count 50
```

### `claudeflare tail`

Tail worker logs in real-time.

```bash
claudeflare tail [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--format` | `-f` | string | pretty | Log format (json, pretty) |
| `--filter` | - | string | - | Filter logs |
| `--status` | `-s` | string | - | Filter by status |

**Examples:**

```bash
# Tail logs
claudeflare tail

# JSON format
claudeflare tail --format json

# Filter errors
claudeflare tail --status error
```

### `claudeflare status`

Show project and deployment status.

```bash
claudeflare status [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--environment` | `-e` | string | - | Environment to check |

### `claudeflare analytics`

Show deployment analytics.

```bash
claudeflare analytics [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--format` | `-f` | string | table | Output format (table, json) |
| `--days` | `-d` | number | 30 | Number of days to analyze |

---

## Utility Commands

### `claudeflare doctor`

Diagnose and fix issues.

```bash
claudeflare doctor [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--fix` | `-f` | boolean | false | Automatically fix issues |
| `--verbose` | `-v` | boolean | false | Verbose output |

**Examples:**

```bash
# Run diagnostics
claudeflare doctor

# Auto-fix issues
claudeflare doctor --fix

# Verbose output
claudeflare doctor --verbose
```

### `claudeflare test`

Run tests.

```bash
claudeflare test [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--watch` | `-w` | boolean | false | Watch mode |
| `--coverage` | `-c` | boolean | false | Generate coverage report |
| `--ui` | - | boolean | false | Run with UI |
| `--pattern` | `-p` | string | - | Test file pattern |

**Examples:**

```bash
# Run tests
claudeflare test

# Watch mode
claudeflare test --watch

# With coverage
claudeflare test --coverage

# With UI
claudeflare test --ui
```

### `claudeflare version`

Show version information.

```bash
claudeflare version [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--verbose` | `-v` | boolean | false | Verbose output |

### `claudeflare upgrade`

Upgrade the CLI to the latest version.

```bash
claudeflare upgrade [options]
```

**Options:**

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--check` | `-c` | boolean | false | Check for updates only |

### `claudeflare docs`

Open documentation in browser.

```bash
claudeflare docs [topic]
```

**Examples:**

```bash
# Open main docs
claudeflare docs

# Open specific topic
claudeflare docs deployment
```

### `claudeflare completion`

Generate shell completion script.

```bash
claudeflare completion <shell>
```

**Shells:**

- `bash` - Bash completion
- `zsh` - Zsh completion
- `fish` - Fish completion

**Examples:**

```bash
# Generate bash completion
claudeflare completion bash > /etc/bash_completion.d/claudeflare

# Generate zsh completion
claudeflare completion zsh > ~/.zfunc/_claudeflare

# Generate fish completion
claudeflare completion fish > ~/.config/fish/completions/claudeflare.fish
```

---

## Global Options

These options can be used with any command:

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--debug` | `-d` | boolean | false | Enable debug mode |
| `--quiet` | `-q` | boolean | false | Suppress non-error messages |
| `--no-colors` | - | boolean | false | Disable colored output |
| `--config` | `-c` | path | - | Path to configuration file |

**Examples:**

```bash
# Enable debug mode
claudeflare --debug deploy

# Quiet mode
claudeflare --quiet build

# No colors
claudeflare --no-colors logs

# Custom config
claudeflare --config ./custom.config.ts dev
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation error |
| 3 | Authentication error |
| 4 | Network error |
| 5 | Build error |
| 6 | Deployment error |
| 7 | Test failure |
| 130 | User interrupted (Ctrl+C) |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLAUDEFLARE_CONFIG` | Path to config file |
| `CLAUDEFLARE_DISABLE_COLORS` | Disable colored output |
| `CLAUDEFLARE_DEBUG` | Enable debug mode |
| `CLAUDEFLARE_QUIET` | Enable quiet mode |
