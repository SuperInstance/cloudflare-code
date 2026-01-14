/**
 * Basic SAST Scan Example
 * Demonstrates how to perform static code analysis
 */

import { SASTScanner } from '../src/sast/scanner';
import { Logger } from '../src/utils/logger';
import { Severity } from '../src/types';

async function main() {
  // Create logger
  const logger = Logger.createDefault('sast-scan-001');

  // Create SAST scanner
  const scanner = new SASTScanner(logger);

  // Add custom rule
  scanner.addCustomRule({
    id: 'CUSTOM_CONSOLE_LOG',
    name: 'No Console Log in Production',
    description: 'Detects console.log statements that should be removed',
    category: 'code-quality',
    severity: Severity.LOW,
    enabled: true,
    languages: ['javascript', 'typescript'],
    patterns: [
      {
        type: 'regex',
        pattern: /console\.(log|debug|info)\(/gi,
        confidence: 70,
      },
    ],
  });

  // Perform scan
  console.log('Starting SAST scan...');
  const result = await scanner.scanDirectory(process.cwd(), {
    maxFiles: 1000,
    severityThreshold: Severity.LOW,
    excludePaths: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.ts',
    ],
  });

  // Output results
  console.log('\n=== Scan Results ===');
  console.log(`Status: ${result.status}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Files scanned: ${result.stats.filesScanned}`);
  console.log(`Lines scanned: ${result.stats.linesScanned}`);
  console.log(`\nVulnerabilities found: ${result.stats.total}`);
  console.log(`- Critical: ${result.stats.critical}`);
  console.log(`- High: ${result.stats.high}`);
  console.log(`- Medium: ${result.stats.medium}`);
  console.log(`- Low: ${result.stats.low}`);
  console.log(`- Info: ${result.stats.info}`);

  // Show findings
  if (result.findings.length > 0) {
    console.log('\n=== Top Findings ===');
    const sortedFindings = result.findings
      .sort((a, b) => b.severity.score - a.severity.score)
      .slice(0, 10);

    for (const finding of sortedFindings) {
      console.log(`\n[${finding.severity.level.toUpperCase()}] ${finding.title}`);
      console.log(`  File: ${finding.file}:${finding.line}`);
      console.log(`  Description: ${finding.description}`);
      console.log(`  Remediation: ${finding.remediation}`);
    }
  }

  // Write results to file
  const fs = await import('fs/promises');
  await fs.writeFile(
    'sast-results.json',
    JSON.stringify(result, null, 2)
  );
  console.log('\nResults saved to sast-results.json');
}

main().catch(console.error);
