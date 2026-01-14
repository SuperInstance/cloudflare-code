# @claudeflare/dependency-analyzer

Comprehensive dependency analysis and management package for the ClaudeFlare distributed AI coding platform.

## Features

- **Dependency Graph Visualization**: Construct and visualize complex dependency relationships
- **Circular Dependency Detection**: Identify and analyze circular dependencies in your codebase
- **Unused Dependency Detection**: Find unused imports, exports, and dependencies
- **Dependency Updates**: Check for updates and analyze compatibility
- **License Analysis**: Detect, validate, and enforce license compliance
- **Security Scanning**: Scan for vulnerabilities and security advisories
- **Dependency Optimization**: Analyze bundle size and optimize dependencies

## Installation

```bash
npm install @claudeflare/dependency-analyzer
```

## CLI Usage

```bash
# Analyze dependencies
dep-analyzer analyze

# Detect circular dependencies
dep-analyzer circular

# Find unused code
dep-analyzer unused

# Check for updates
dep-analyzer updates

# Analyze licenses
dep-analyzer license

# Security scan
dep-analyzer security

# Optimize dependencies
dep-analyzer optimize
```

## Programmatic Usage

```typescript
import { DependencyAnalyzer } from '@claudeflare/dependency-analyzer';

const analyzer = new DependencyAnalyzer({
  projectPath: '/path/to/project',
  packageManager: 'npm'
});

// Analyze dependencies
const graph = await analyzer.buildGraph();
const cycles = await analyzer.detectCircularDependencies();
const unused = await analyzer.detectUnused();
```

## Configuration

Create a `dep-analyzer.config.json` in your project root:

```json
{
  "projectPath": "./",
  "packageManager": "npm",
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules/**", "dist/**"],
  "rules": {
    "circular": {
      "enabled": true,
      "maxDepth": 10
    },
    "unused": {
      "enabled": true,
      "includeExports": true
    },
    "security": {
      "enabled": true,
      "severity": ["high", "critical"]
    }
  }
}
```

## License

MIT
