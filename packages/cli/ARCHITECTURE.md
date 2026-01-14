# ClaudeFlare CLI Architecture

## Overview

The ClaudeFlare CLI is a comprehensive command-line tool for developing, testing, and deploying Cloudflare Workers applications. Built with TypeScript and Commander.js, it provides a delightful developer experience with interactive prompts, colorful output, and intelligent defaults.

## Project Structure

```
packages/cli/
├── src/
│   ├── cli.ts                  # Main CLI entry point
│   ├── index.ts                # Package exports
│   ├── types/                  # Type definitions
│   │   └── index.ts
│   ├── config/                 # Configuration management
│   │   ├── loader.ts           # Config loading and validation
│   │   ├── wrangler.ts         # Wrangler config generation
│   │   └── index.ts
│   ├── utils/                  # Utility functions
│   │   ├── logger.ts           # Logging with colors
│   │   ├── spinner.ts          # Loading spinners
│   │   ├── progress.ts         # Progress bars
│   │   ├── prompts.ts          # Interactive prompts
│   │   ├── tables.ts           # Table formatting
│   │   ├── errors.ts           # Error handling
│   │   ├── dev-server.ts       # Dev server implementation
│   │   ├── wrangler.ts         # Wrangler CLI integration
│   │   ├── shim.ts             # Polyfills
│   │   └── index.ts
│   ├── commands/               # CLI commands
│   │   ├── init.ts             # Project initialization
│   │   ├── dev.ts              # Development server
│   │   ├── build.ts            # Build command
│   │   ├── deploy.ts           # Deployment
│   │   ├── test.ts             # Test runner
│   │   ├── logs.ts             # Log tailing
│   │   ├── config.ts           # Config management
│   │   ├── doctor.ts           # Diagnostics
│   │   ├── version.ts          # Version info
│   │   └── index.ts
│   └── templates/              # Project templates
├── package.json
├── tsconfig.json
├── README.md
└── .npmignore
```

## Key Components

### 1. CLI Entry Point (`cli.ts`)

The main entry point that:
- Parses command-line arguments using Commander.js
- Registers all commands
- Sets global options (debug, quiet, colors)
- Handles version display

### 2. Type System (`types/`)

Comprehensive TypeScript types for:
- Configuration schemas
- Deployment results
- Log entries
- Health checks
- Bundle analysis
- Validation using Zod

### 3. Configuration Management (`config/`)

**loader.ts:**
- Loads `claudeflare.config.ts`
- Validates with Zod schemas
- Merges with defaults
- Supports environment-specific configs

**wrangler.ts:**
- Generates `wrangler.toml` from ClaudeFlare config
- Reads existing Wrangler config
- Merges configurations

### 4. Utilities (`utils/`)

**logger.ts:**
- Colored console output using chalk
- Timestamp support
- Multiple log levels (info, success, warn, error, debug)
- Special formatting (boxed messages, lists, key-value)

**spinner.ts:**
- Ora wrapper for loading spinners
- Success/fail/warn states
- Elapsed time tracking

**progress.ts:**
- cli-progress wrapper for progress bars
- Batch processing support
- Custom formatting

**prompts.ts:**
- Inquirer wrapper for interactive prompts
- Input, confirm, list, checkbox, password
- Multi-step workflows

**tables.ts:**
- Table formatting using `table` package
- Status tables
- Deployment summaries
- Comparison views

**errors.ts:**
- Custom error classes
- Error handling with suggestions
- Debug mode support

**dev-server.ts:**
- Express-based dev server
- Proxy to Wrangler dev server
- Hot reload with chokidar
- Browser auto-open

**wrangler.ts:**
- Wrangler CLI execution
- Authentication checks
- Deployment management
- Log tailing

### 5. Commands (`commands/`)

**init.ts:**
- Interactive project creation
- Template system
- Dependency installation
- Git initialization

**dev.ts:**
- Development server startup
- Wrangler dev integration
- File watching and hot reload
- Environment management

**build.ts:**
- Production builds
- Size validation
- Bundle analysis

**deploy.ts:**
- Cloudflare deployment
- Environment management
- Secret handling
- Confirmation prompts

**test.ts:**
- Test runner integration
- Watch mode
- Coverage reports

**logs.ts:**
- Real-time log tailing
- Filtering and formatting
- JSON/pretty output

**config.ts:**
- Config viewing and editing
- Validation
- Environment switching

**doctor.ts:**
- System diagnostics
- Dependency checks
- Auto-fix capabilities

## Design Patterns

### 1. Command Pattern

Each command is a separate module that:
- Exports an async function
- Takes typed options
- Returns void or throws errors

### 2. Error Handling

- Custom error classes with suggestions
- Consistent error formatting
- Debug mode for stack traces
- Graceful degradation

### 3. Configuration

- Hierarchical config system
- Environment-specific overrides
- Schema validation
- Type-safe access

### 4. Progress Indicators

- Spinners for async operations
- Progress bars for batches
- Real-time status updates

### 5. User Experience

- Colorized output
- Interactive prompts
- Helpful error messages
- Auto-completion support

## Extension Points

### Adding New Commands

1. Create command file in `src/commands/`
2. Export async function with options
3. Register in `cli.ts`
4. Add tests

### Adding Templates

1. Create template in `templates/`
2. Register in `init.ts`
3. Add documentation

### Adding Utilities

1. Create utility in `src/utils/`
2. Export from `index.ts`
3. Add tests

## Dependencies

### Core
- **commander**: CLI framework
- **chalk**: Terminal colors
- **inquirer**: Interactive prompts
- **ora**: Loading spinners
- **cli-progress**: Progress bars
- **chokidar**: File watching
- **express**: HTTP server
- **http-proxy-middleware**: Proxy middleware
- **zod**: Schema validation

### Dev
- **typescript**: Type checking
- **vitest**: Testing
- **esbuild**: Bundling

## Testing

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Building

```bash
# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck
```

## Performance

- Lazy loading of dependencies
- Efficient file watching
- Parallel operations where possible
- Minimal bundle size

## Security

- No unsafe eval
- Input validation
- Secure secret handling
- Dependency auditing

## Future Enhancements

- Plugin system
- Custom hooks
- Configuration presets
- CI/CD integrations
- Web dashboard
- Team collaboration features
