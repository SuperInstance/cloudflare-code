# @claudeflare/dependency-analyzer CLI Guide

## Installation

```bash
npm install -g @claudeflare/dependency-analyzer
```

## Commands

### `analyze`

Perform complete dependency analysis.

```bash
dep-analyzer analyze [options]
```

**Options:**
- `-p, --path <path>` - Project path (default: current directory)
- `-o, --output <file>` - Output file path
- `-f, --format <format>` - Output format: json, markdown, html (default: markdown)
- `--no-circular` - Skip circular dependency detection
- `--no-unused` - Skip unused dependency detection
- `--no-security` - Skip security scanning
- `--no-license` - Skip license analysis

**Example:**
```bash
dep-analyzer analyze -p ./my-project -o report.md -f markdown
```

### `circular`

Detect circular dependencies.

```bash
dep-analyzer circular [options]
```

**Options:**
- `-p, --path <path>` - Project path
- `--max-depth <number>` - Maximum cycle depth (default: 10)

**Example:**
```bash
dep-analyzer circular --max-depth 15
```

### `unused`

Find unused dependencies and code.

```bash
dep-analyzer unused [options]
```

**Options:**
- `-p, --path <path>` - Project path
- `--include-exports` - Include unused exports

**Example:**
```bash
dep-analyzer unused --include-exports
```

### `updates`

Check for dependency updates.

```bash
dep-analyzer updates [options]
```

**Options:**
- `-p, --path <path>` - Project path
- `--type <type>` - Filter by type: major, minor, patch

**Example:**
```bash
dep-analyzer updates --type major
```

### `license`

Analyze package licenses.

```bash
dep-analyzer license [options]
```

**Options:**
- `-p, --path <path>` - Project path

**Example:**
```bash
dep-analyzer license
```

### `security`

Scan for security vulnerabilities.

```bash
dep-analyzer security [options]
```

**Options:**
- `-p, --path <path>` - Project path
- `--severity <severities>` - Comma-separated severities (default: critical,high,moderate)

**Example:**
```bash
dep-analyzer security --severity critical,high
```

### `optimize`

Analyze and optimize dependencies.

```bash
dep-analyzer optimize [options]
```

**Options:**
- `-p, --path <path>` - Project path

**Example:**
```bash
dep-analyzer optimize
```

### `graph`

Visualize dependency graph.

```bash
dep-analyzer graph [options]
```

**Options:**
- `-p, --path <path>` - Project path
- `-f, --format <format>` - Output format: dot, json, mermaid (default: json)
- `-o, --output <file>` - Output file

**Example:**
```bash
dep-analyzer graph -f dot -o dependencies.dot
```

## Configuration File

Create a `dep-analyzer.config.json` in your project root:

```json
{
  "projectPath": "./",
  "packageManager": "npm",
  "include": ["src/**/*.ts", "lib/**/*.ts"],
  "exclude": ["node_modules/**", "dist/**"],
  "rules": {
    "circular": {
      "enabled": true,
      "maxDepth": 10,
      "ignorePatterns": ["\\.test\\.ts$"]
    },
    "unused": {
      "enabled": true,
      "includeExports": true,
      "ignorePatterns": ["index\\.ts$"]
    },
    "security": {
      "enabled": true,
      "severity": ["high", "critical"]
    },
    "license": {
      "enabled": true,
      "allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"]
    }
  }
}
```

## Examples

### Complete Analysis

```bash
dep-analyzer analyze -p ./my-app -o report.html -f html
```

### Find Only Circular Dependencies

```bash
dep-analyzer circular -p ./my-app
```

### Check for Major Updates

```bash
dep-analyzer updates --type major
```

### Security Scan

```bash
dep-analyzer security --severity critical,high
```

### Generate Graph

```bash
dep-analyzer graph -f mermaid -o graph.mmd
```

## Exit Codes

- `0` - Success
- `1` - Error occurred

## Output Formats

### JSON

Machine-readable format with all analysis data.

### Markdown

Human-readable report with formatting.

### HTML

Interactive report with styling and visualizations.

### DOT

Graphviz DOT format for graph visualization.

### Mermaid

Mermaid.js format for documentation embedding.
