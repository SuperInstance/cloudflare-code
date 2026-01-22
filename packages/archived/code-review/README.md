# @claudeflare/code-review

Automated code review and analysis platform for the ClaudeFlare distributed AI coding platform.

## Features

- 🔍 **Automated PR Reviews**: Review pull requests with automated comments and scoring
- 🔒 **Security Scanning**: OWASP Top 10 coverage, secret detection, vulnerability scanning
- ⚡ **Performance Analysis**: Detect bottlenecks, memory leaks, and inefficient patterns
- 📊 **Quality Metrics**: Cyclomatic complexity, maintainability index, technical debt tracking
- 🎨 **Style Checking**: Enforce consistent code style and formatting
- ✨ **Best Practices**: SOLID principles, DRY, KISS, YAGNI enforcement
- 📈 **Metrics Dashboard**: Track code quality trends over time

## Installation

```bash
npm install @claudeflare/code-review
```

## Quick Start

### JavaScript/TypeScript API

```typescript
import { CodeReview, quickReview } from '@claudeflare/code-review';

// Quick review
const result = await quickReview('./src/index.ts');

console.log(`Score: ${result.review.metrics.score}/100`);
console.log(`Issues: ${result.review.issues.length}`);
```

### CLI

```bash
# Review a file
claudeflare-review review src/index.ts

# Review multiple files
claudeflare-review review src/**/*.ts

# Security scan
claudeflare-review scan ./src --secrets --vulnerabilities

# Quality analysis
claudeflare-review quality src/**/*.ts
```

## Usage Examples

### Basic Review

```typescript
import { CodeReview } from '@claudeflare/code-review';

const review = new CodeReview();

const result = await review.reviewFile('./src/index.ts', {
  includeQuality: true,
  includeSecurity: true,
  includePerformance: true,
  includeStyle: true,
  includePractices: true,
});
```

### Security-Focused Review

```typescript
const result = await review.reviewFile('./src/index.ts', {
  includeSecurity: true,
  includeQuality: false,
  includePerformance: false,
  includeStyle: false,
  includePractices: false,
});

// Access security issues
for (const issue of result.security.issues) {
  console.log(`[${issue.severity}] ${issue.title}`);
  console.log(`  OWASP: ${issue.owasp}`);
  console.log(`  Risk Score: ${issue.riskScore}`);
}
```

### Generate Reports

```typescript
import { TemplateManager } from '@claudeflare/code-review';

const templateManager = new TemplateManager();

// Markdown report
const markdown = await templateManager.renderMarkdownReport({
  summary: result.review.summary,
  issues: result.review.issues,
  metrics: result.review.metrics,
});

// HTML report
const html = await templateManager.renderHtmlReport({
  summary: result.review.summary,
  issues: result.review.issues,
  metrics: result.review.metrics,
});
```

### CI/CD Integration

```typescript
const result = await review.reviewFile('./src/index.ts');

// Quality gates
const minScore = 70;
const maxCriticalIssues = 0;

const criticalIssues = result.review.issues.filter(
  i => i.severity === 'error' || i.category === 'security'
);

if (result.review.metrics.score < minScore || criticalIssues.length > maxCriticalIssues) {
  console.error('Quality gate failed');
  process.exit(1);
}
```

## API Reference

### CodeReview

Main class for performing code reviews.

#### Methods

- `reviewFile(filePath, config)` - Review a single file
- `reviewFiles(filePaths, config)` - Review multiple files
- `reviewContent(filePath, content, language, config)` - Review code content
- `clearCache()` - Clear review cache
- `getStats()` - Get engine statistics

### ReviewEngine

Core review engine for analyzing code.

#### Methods

- `reviewFile(filePath, options)` - Review a file
- `reviewFiles(filePaths, options)` - Review multiple files
- `reviewPullRequest(pr, context, options)` - Review a pull request
- `calculateScore(summary)` - Calculate quality score

### QualityAnalyzer

Analyze code quality metrics.

#### Methods

- `analyzeFile(filePath, content, fileInfo)` - Analyze file quality
- `analyzeComplexity(ast, content, fileInfo)` - Calculate complexity metrics
- `detectCodeSmells(ast, content, fileInfo)` - Detect code smells
- `detectDuplications(content, filePath)` - Find code duplication

### SecurityScanner

Scan for security vulnerabilities.

#### Methods

- `scanFile(filePath, content, fileInfo)` - Scan file for issues
- `scanSecrets(filePath, content)` - Scan for secrets
- `scanVulnerabilities(filePath, content, fileInfo)` - Scan for vulnerabilities
- `scanOWASP(filePath, content, fileInfo)` - OWASP Top 10 scan

### PerformanceAnalyzer

Analyze performance issues.

#### Methods

- `analyzeFile(filePath, content, fileInfo)` - Analyze performance
- `detectPerformanceIssues(filePath, content, fileInfo)` - Detect issues
- `identifyBottlenecks(content, fileInfo)` - Identify bottlenecks

### StyleChecker

Check code style and formatting.

#### Methods

- `checkFile(filePath, content, fileInfo)` - Check file style
- `checkLineLength(filePath, content)` - Check line length
- `checkIndentation(filePath, content)` - Check indentation
- `checkNamingConventions(filePath, content, fileInfo)` - Check naming

### PracticesEnforcer

Enforce coding best practices.

#### Methods

- `enforceFile(filePath, content, fileInfo)` - Enforce practices
- `checkSOLID(filePath, content, fileInfo)` - Check SOLID principles
- `checkDRY(filePath, content, fileInfo)` - Check DRY principle
- `checkErrorHandling(filePath, content, fileInfo)` - Check error handling

### MetricsCalculator

Calculate code metrics.

#### Methods

- `calculateCodeMetrics(filePath, content, fileInfo)` - Calculate metrics
- `calculateFileMetrics(filePath, content, fileInfo)` - File metrics
- `calculateReviewMetrics(issues, files, lines)` - Review metrics
- `calculateTrend(filePath, metric)` - Calculate trends

## Configuration

### Review Options

```typescript
interface ReviewOptions {
  includeCategories?: Category[];
  excludeCategories?: Category[];
  minSeverity?: 'error' | 'warning' | 'info' | 'hint';
  maxIssues?: number;
  timeout?: number;
  parallel?: boolean;
  cacheResults?: boolean;
}
```

### Quality Analyzer Options

```typescript
interface QualityAnalyzerOptions {
  maxComplexity?: number;
  maxCognitiveComplexity?: number;
  maxNestingDepth?: number;
  maxParameters?: number;
  minMaintainabilityIndex?: number;
  duplicationThreshold?: number;
}
```

### Security Scanner Options

```typescript
interface SecurityScannerOptions {
  enableSecretScanning?: boolean;
  enableDependencyScanning?: boolean;
  enableVulnerabilityScanning?: boolean;
  secretPatterns?: RegExp[];
  customRules?: SecurityRule[];
}
```

## Supported Languages

- TypeScript
- JavaScript
- Python
- Go
- Rust
- Java
- C++
- C#
- Ruby
- PHP

## Rules Reference

### Security Rules

| Rule ID | Description | Severity | OWASP |
|---------|-------------|----------|-------|
| `security-hardcoded-secret` | Hardcoded secrets detected | Error | A01 |
| `security-sql-injection` | SQL injection vulnerability | Error | A03 |
| `security-xss` | Cross-site scripting | Error | A03 |
| `security-insecure-random` | Insecure random generation | Warning | A02 |

### Performance Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| `performance-nested-loop` | Deeply nested loops | Warning |
| `performance-inefficient-regex` | Inefficient regex pattern | Warning |
| `performance-memory-leak` | Potential memory leak | Warning |

### Quality Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| `quality-complex-function` | High complexity function | Warning |
| `quality-long-function` | Function too long | Info |
| `quality-deep-nesting` | Deep nesting detected | Warning |

### Style Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| `style-naming-convention` | Naming convention violation | Info |
| `style-trailing-whitespace` | Trailing whitespace | Hint |
| `style-line-length` | Line too long | Info |

### Best Practice Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| `practices-console-log` | Console statement found | Warning |
| `practices-todo-comment` | TODO comment found | Info |
| `practices-empty-catch` | Empty catch block | Warning |

## CI/CD Integration

### GitHub Actions

```yaml
name: Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx claudeflare-review review src/**/*.ts --format markdown --output review-report.md
      - uses: actions/upload-artifact@v3
        with:
          name: review-report
          path: review-report.md
```

### GitLab CI

```yaml
code_review:
  stage: test
  script:
    - npm install
    - npx claudeflare-review review src/**/*.ts --format json --output review-report.json
  artifacts:
    paths:
      - review-report.json
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © ClaudeFlare

## Support

- Documentation: [docs.claudeflare.dev](https://docs.claudeflare.dev)
- Issues: [github.com/claudeflare/code-review/issues](https://github.com/claudeflare/code-review/issues)
- Discord: [discord.gg/claudeflare](https://discord.gg/claudeflare)
