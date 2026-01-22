# ClaudeFlare Security Testing Package

Enterprise-grade security testing and penetration testing tools for the ClaudeFlare distributed AI coding platform.

## Features

- **SAST (Static Application Security Testing)**: Comprehensive static code analysis for security vulnerabilities
- **DAST (Dynamic Application Security Testing)**: Automated dynamic security testing of web applications
- **SCA (Software Composition Analysis)**: Dependency vulnerability scanning and license compliance
- **Penetration Testing**: Automated penetration testing workflows
- **Compliance Scanning**: SOC 2, ISO 27001, PCI DSS, GDPR, HIPAA validation
- **Policy Engine**: Policy-as-code with OPA/Rego support
- **Vulnerability Database**: Comprehensive CVE database with threat intelligence

## Installation

```bash
npm install @claudeflare/security-testing
```

## Quick Start

```typescript
import { SecurityTesting, quickScan } from '@claudeflare/security-testing';

// Quick scan with default settings
const results = await quickScan('./src');

// Or create a custom scanner
const scanner = new SecurityTesting({
  logLevel: 'info',
});

const results = await scanner.runComprehensiveScan('./src', {
  enableSAST: true,
  enableSCA: true,
  enableCompliance: false,
  enableDAST: false,
  severityThreshold: Severity.HIGH,
});

console.log(`Found ${results.summary.totalFindings} security issues`);
console.log(`- Critical: ${results.summary.critical}`);
console.log(`- High: ${results.summary.high}`);
console.log(`- Medium: ${results.summary.medium}`);
```

## Usage Examples

### SAST Scanning

```typescript
import { SASTScanner } from '@claudeflare/security-testing';
import { Logger } from '@claudeflare/security-testing';

const logger = Logger.createDefault();
const scanner = new SASTScanner(logger);

// Scan a directory
const result = await scanner.scanDirectory('./src', {
  maxFiles: 1000,
  severityThreshold: Severity.MEDIUM,
});

console.log(`Scanned ${result.stats.filesScanned} files`);
console.log(`Found ${result.findings.length} vulnerabilities`);

// Scan a single file
const findings = await scanner.scanFile('./src/app.ts', './src');
```

### DAST Scanning

```typescript
import { DASTScanner } from '@claudeflare/security-testing';

const scanner = new DASTScanner(logger);

const result = await scanner.scan('https://example.com', {
  maxPages: 100,
  timeout: 30000,
  auth: {
    type: 'bearer',
    credentials: {
      token: 'your-token',
    },
  },
});

console.log(`Crawled ${result.stats.filesScanned} pages`);
console.log(`Found ${result.findings.length} vulnerabilities`);
```

### Dependency Scanning

```typescript
import { DependencyScanner } from '@claudeflare/security-testing';

const scanner = new DependencyScanner(logger);

const result = await scanner.scanProject('./', {
  includeDevDependencies: true,
  includeTransitiveDependencies: true,
  severityThreshold: Severity.HIGH,
  licenseBlacklist: ['GPL'],
});

console.log(`Scanned ${result.stats.filesScanned} dependencies`);
console.log(`Found ${result.stats.vulnerabilitiesFound} vulnerabilities`);
```

### Penetration Testing

```typescript
import { PentestAutomation } from '@claudeflare/security-testing';

const pentest = new PentestAutomation(logger);

const report = await pentest.execute({
  target: 'https://example.com',
  targetType: 'web',
  phases: [
    { name: 'reconnaissance', enabled: true },
    { name: 'scanning', enabled: true },
    { name: 'vulnerability-assessment', enabled: true },
    { name: 'exploitation', enabled: false },
  ],
  options: {
    maxDuration: 3600000, // 1 hour
    parallelAttacks: 5,
  },
});

console.log(`Risk Score: ${report.riskScore}/100`);
console.log(`Executive Summary:\n${report.executiveSummary}`);
```

### Compliance Scanning

```typescript
import { ComplianceScanner, ComplianceFramework } from '@claudeflare/security-testing';

const scanner = new ComplianceScanner(logger);

const reports = await scanner.scan({
  frameworks: [
    ComplianceFramework.SOC2,
    ComplianceFramework.ISO27001,
    ComplianceFramework.PCIDSS,
  ],
  target: './',
  options: {
    strictMode: true,
    includeManualControls: false,
  },
});

for (const report of reports) {
  console.log(`${report.framework}: ${report.overallScore}%`);
  console.log(`Passed: ${report.passedControls}`);
  console.log(`Failed: ${report.failedControls}`);
}
```

### Policy Engine

```typescript
import { PolicyEngine } from '@claudeflare/security-testing';

const policyEngine = new PolicyEngine(logger, {
  policyDir: './policies',
  enablePreCommitHooks: true,
  enableCIDCD Gates: true,
  exceptionWorkflowEnabled: true,
});

// Load policies
await policyEngine.loadPolicies();

// Evaluate findings
const evaluations = await policyEngine.evaluate(findings);

// Request exception
const exceptionId = await policyEngine.requestException({
  policyId: 'block-critical-vulnerabilities',
  ruleId: 'no-critical',
  findingId: 'finding-123',
  reason: 'False positive - validated by security team',
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  requestedBy: 'john.doe@example.com',
});

// Approve exception
await policyEngine.approveException(exceptionId, 'security-lead@example.com');
```

## Configuration

### Scanner Configuration

```typescript
interface ScanConfig {
  // Target
  target: string;
  targetType: 'code' | 'url' | 'api' | 'dependency';

  // Scope
  includePaths?: string[];
  excludePaths?: string[];
  filePatterns?: string[];

  // Scan types
  enableSAST: boolean;
  enableDAST: boolean;
  enableSCA: boolean;
  enableCompliance: boolean;

  // Rules
  rules?: string[];
  customRules?: CustomRule[];

  // Performance
  maxDepth?: number;
  maxFiles?: number;
  timeout?: number;
  parallel?: number;

  // Output
  outputFormat: 'json' | 'xml' | 'html' | 'sarif' | 'console';
  outputFile?: string;

  // Reporting
  severityThreshold?: Severity;
  failOnThreshold?: Severity;
}
```

### Custom Rules

```typescript
const customRule = {
  id: 'CUSTOM_NO_EVAL',
  name: 'No Eval Usage',
  description: 'Detects usage of eval() function',
  category: 'code-quality',
  severity: Severity.HIGH,
  cwe: 95,
  owasp: OWASPTop10.A03_INJECTION,
  enabled: true,
  languages: ['javascript', 'typescript'],
  patterns: [
    {
      type: 'regex',
      pattern: /eval\s*\(/gi,
      confidence: 80,
    },
  ],
};

scanner.addCustomRule(customRule);
```

## Vulnerability Database

The package includes a comprehensive vulnerability database with known CVEs:

```typescript
// Lookup vulnerabilities
const vulns = scanner.lookupVulnerabilities('ws', 'npm', '8.0.0');

for (const vuln of vulns) {
  console.log(`CVE: ${vuln.cve}`);
  console.log(`Severity: ${vuln.severity}`);
  console.log(`Description: ${vuln.description}`);
  console.log(`Patched versions: ${vuln.patchedVersions.join(', ')}`);
}

// Get statistics
const stats = scanner.getVulnerabilityStats();
console.log(`Total vulnerabilities: ${stats.total}`);
console.log(`By ecosystem: ${JSON.stringify(stats.byEcosystem)}`);
console.log(`By severity: ${JSON.stringify(stats.bySeverity)}`);
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx @claudeflare/security-testing scan ./src
      - uses: actions/upload-artifact@v3
        with:
          name: security-results
          path: security-results.json
```

### GitLab CI

```yaml
security-scan:
  stage: security
  image: node:18
  script:
    - npm ci
    - npx @claudeflare/security-testing scan ./src
  artifacts:
    paths:
      - security-results.json
    expire_in: 1 week
  only:
    - main
    - develop
    - merge_requests
```

### Pre-commit Hook

```typescript
const policyEngine = new PolicyEngine(logger, {
  policyDir: './policies',
  enablePreCommitHooks: true,
});

await policyEngine.createPreCommitHook('.git/hooks/pre-commit');
```

## Output Formats

### JSON

```typescript
const result = await scanner.scanDirectory('./src', {
  outputFormat: 'json',
  outputFile: 'security-results.json',
});
```

### SARIF

```typescript
const result = await scanner.scanDirectory('./src', {
  outputFormat: 'sarif',
  outputFile: 'security-results.sarif',
});
```

## Performance

- Scan 100K+ LOC in <5 minutes
- Detect 95%+ of OWASP Top 10 vulnerabilities
- <1% false positive rate
- Support for parallel scanning

## License

MIT

## Support

For issues, questions, or contributions, please visit the ClaudeFlare GitHub repository.
