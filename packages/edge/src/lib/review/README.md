# Code Review and Analysis System

A comprehensive automated code review system for ClaudeFlare, providing static analysis, security scanning, quality checking, and performance analysis for 20+ programming languages.

## Features

### 🔍 Static Code Analysis
- AST-based parsing for 20+ programming languages
- Extract code structure, functions, classes, imports/exports
- Calculate complexity metrics (cyclomatic, cognitive)
- Detect code smells and anti-patterns
- Analyze code duplication

### 🔒 Security Vulnerability Scanning
- SQL injection detection
- XSS vulnerability detection
- CSRF protection checks
- Hardcoded secrets detection (API keys, passwords, tokens)
- Insecure cryptography detection
- Authentication/authorization issues
- OWASP Top 10 coverage
- CWE mapping

### 📊 Code Quality Analysis
- Cyclomatic complexity analysis
- Cognitive complexity analysis
- Maintainability index calculation
- Code duplication detection
- Code smell identification
- Naming convention checking
- Documentation coverage analysis

### ⚡ Performance Analysis
- N+1 query detection
- Memory leak detection
- Inefficient algorithm detection
- Synchronous operation detection
- DOM manipulation issues
- Async operation analysis
- Bundle size analysis

### ✅ Best Practices Checking
- Language-specific patterns
- Framework conventions (React, Vue, Angular, etc.)
- Error handling patterns
- Testing coverage analysis
- Git history patterns

### 📝 Report Generation
- Multiple output formats:
  - Console output with colors
  - JSON reports
  - HTML reports with interactive UI
  - Markdown reports
  - JUnit XML for CI/CD
  - SARIF for tool integration

### 🔄 GitHub Integration
- Automatic PR review
- Comment on issues
- Review approval/rejection
- Diff-based analysis
- Multi-file support

## Installation

```bash
npm install @claudeflare/edge
```

## Quick Start

### Basic Usage

```typescript
import { reviewCode } from '@claudeflare/review';

const files = [
  {
    path: 'src/index.ts',
    content: `
const password = "hardcoded_password";

function queryUser(id: string) {
  db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}
    `,
  },
];

const result = await reviewCode(files, {
  reportFormat: 'console',
});

console.log(result.formatted);
```

### Advanced Usage

```typescript
import { createCodeReviewSystem } from '@claudeflare/review';

const system = createCodeReviewSystem();

const result = await system.reviewCode(
  [
    { path: 'src/api.ts', content: code },
  ],
  {
    options: {
      includeSecurity: true,
      includePerformance: true,
      includeQuality: true,
      includeBestPractices: true,
      categories: ['security', 'performance', 'quality'],
      severities: ['critical', 'high', 'medium'],
    },
    reportFormat: 'html',
    onProgress: (progress) => {
      console.log(`Progress: ${progress.progress}%`);
    },
  }
);
```

### GitHub PR Integration

```typescript
import { createCodeReviewSystem } from '@claudeflare/review';
import { createGitHubClient } from '@claudeflare/github';

const system = createCodeReviewSystem();
const githubClient = createGitHubClient(config);

system.setGitHubClient(githubClient);

const result = await system.reviewPullRequest(
  'owner',
  'repo',
  123,
  {
    integration: {
      github: {
        enabled: true,
        autoComment: true,
        minSeverity: 'high',
      },
    },
  }
);
```

## API Reference

### Main Functions

#### `reviewCode(files, config?)`
Review code files and generate a report.

**Parameters:**
- `files`: Array of `{ path: string, content: string }`
- `config`: `CodeReviewConfig`
  - `options`: Analysis options
  - `reportFormat`: Output format ('console' | 'json' | 'html' | 'markdown' | 'junit' | 'sarif')
  - `onProgress`: Progress callback

**Returns:** `CodeReviewResult`

#### `createCodeReviewSystem()`
Create a reusable code review system instance.

**Returns:** `CodeReviewSystem`

### Individual Components

#### StaticAnalyzer
```typescript
import { createStaticAnalyzer } from '@claudeflare/review';

const analyzer = createStaticAnalyzer();
const report = await analyzer.analyzeFile(parsedFile, options);
```

#### SecurityScanner
```typescript
import { createSecurityScanner } from '@claudeflare/review';

const scanner = createSecurityScanner();
const report = await scanner.scanFile(content, filePath, language);
```

#### QualityChecker
```typescript
import { createQualityChecker } from '@claudeflare/review';

const checker = createQualityChecker();
const result = await checker.checkQuality(content, filePath, language);
```

#### RuleEngine
```typescript
import { createRuleEngine } from '@claudeflare/review';

const engine = createRuleEngine({
  enabledRules: ['security/sql-injection', 'quality/long-function'],
  disabledRules: ['quality/console-log'],
});

const results = await engine.runRules(content, filePath, language);
```

#### PerformanceAnalyzer
```typescript
import { createPerformanceAnalyzer } from '@claudeflare/review';

const analyzer = createPerformanceAnalyzer();
const result = await analyzer.analyzePerformance(content, filePath, language);
```

#### ReportGenerator
```typescript
import { createReportGenerator } from '@claudeflare/review';

const generator = createReportGenerator();
const report = generator.generateFileReport(reviewReport, {
  format: 'html',
  includeDetails: true,
  includeSuggestions: true,
});
```

## Configuration

### Review Options

```typescript
interface ReviewOptions {
  // Analysis scope
  categories?: IssueCategory[];
  severities?: Severity[];
  languages?: SupportedLanguage[];

  // Analysis depth
  includeSecurity?: boolean;
  includePerformance?: boolean;
  includeQuality?: boolean;
  includeBestPractices?: boolean;

  // Rule configuration
  enabledRules?: string[];
  disabledRules?: string[];
  ruleConfig?: Record<string, RuleConfig>;

  // Performance
  maxFileSize?: number;
  maxFiles?: number;
  parallelism?: number;

  // Output
  includeSuggestions?: boolean;
  includeContext?: boolean;
  includeFixes?: boolean;
}
```

### Quality Thresholds

```typescript
const checker = createQualityChecker({
  maxCyclomaticComplexity: 15,
  maxCognitiveComplexity: 15,
  maxFunctionLength: 50,
  maxParameterCount: 5,
  maxNestingDepth: 4,
  maxClassLength: 300,
  maxFileLength: 500,
  maxDuplicationPercentage: 10,
  minDocumentationCoverage: 20,
  minMaintainabilityIndex: 50,
});
```

## Report Formats

### Console Output
```
================================================================================
CODE REVIEW REPORT: src/index.ts
================================================================================
Overall Score: 🟡 65/100
Language: typescript
Lines of Code: 42

--------------------------------------------------------------------------------
SUMMARY
--------------------------------------------------------------------------------
Total Issues: 5
  Critical: 1
  High: 2
  Medium: 1
  Low: 1
  Info: 0
```

### JSON Output
```json
{
  "file": "src/index.ts",
  "score": 65,
  "issues": [...],
  "metrics": {...},
  "summary": {...}
}
```

### HTML Output
Interactive HTML report with:
- Visual score display
- Color-coded issues
- Expandable details
- Code snippets
- Suggestions

### Markdown Output
```markdown
# Code Review Report

**File:** src/index.ts
**Score:** 65/100

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | 5 |
| Critical | 1 |
```

## Rules

### Security Rules
- SQL injection detection
- XSS vulnerability detection
- CSRF protection checks
- Hardcoded secrets detection
- Weak cryptography detection
- Insecure random number generation
- Authentication bypass detection

### Performance Rules
- N+1 query detection
- Nested loops
- Synchronous file I/O
- Inefficient array operations
- DOM manipulation in loops
- Unnecessary re-renders

### Quality Rules
- Long function detection
- Long parameter list
- Deep nesting
- Magic numbers
- Dead code
- Console log statements
- TODO comments

### Best Practices Rules
- Missing error handling
- No-var rule
- Should-be-const detection
- No-eval rule
- Empty catch blocks
- Missing strict mode

## Supported Languages

- TypeScript
- JavaScript
- Python
- Java
- Go
- Rust
- C++
- C
- C#
- PHP
- Ruby
- Swift
- Kotlin
- Scala
- Markdown
- JSON
- YAML
- TOML
- XML
- HTML
- CSS
- Shell
- SQL

## Integration Examples

### GitHub Actions

```yaml
name: Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Code Review
        uses: claudeflare/action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          format: 'sarif'
          output: 'review-results.sarif'
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v1
        with:
          sarif_file: 'review-results.sarif'
```

### GitLab CI

```yaml
code_review:
  stage: test
  script:
    - npx @claudeflare/review --format=json --output=review.json
  artifacts:
    reports:
      codequality: review.json
```

### VS Code Extension

```typescript
import { reviewCode } from '@claudeflare/review';

const editor = vscode.window.activeTextEditor;
if (editor) {
  const document = editor.document;
  const result = await reviewCode([{
    path: document.fileName,
    content: document.getText(),
  }]);

  // Display diagnostics
  const diagnostics = result.multiFileReport.issues.map(issue =>
    new vscode.Diagnostic(
      new vscode.Range(
        new vscode.Position(issue.line - 1, 0),
        new vscode.Position(issue.line - 1, 100)
      ),
      issue.message,
      vscode.DiagnosticSeverity.Warning
    )
  );

  vscode.languages.createDiagnosticCollection('review').set(
    document.uri,
    diagnostics
  );
}
```

## Performance

- **Small files** (< 1KB): < 10ms
- **Medium files** (< 100KB): < 100ms
- **Large files** (< 1MB): < 1s
- **Parallel processing**: Supports configurable parallelism

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE for details.

## Credits

Built with ❤️ by the ClaudeFlare team
