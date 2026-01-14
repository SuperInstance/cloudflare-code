/**
 * Basic Usage Examples for ClaudeFlare Code Review
 */

import { CodeReview, quickReview, ReviewEngine } from '../src/index.js';

// ============================================================================
// Example 1: Quick Review
// ============================================================================

async function example1_quickReview() {
  console.log('Example 1: Quick Review\n');

  const result = await quickReview('./examples/sample-code.ts');

  console.log(`Review Score: ${result.review.metrics.score}/100`);
  console.log(`Issues Found: ${result.review.issues.length}`);
  console.log(`Duration: ${result.review.duration}ms`);

  // Print issues
  for (const issue of result.review.issues) {
    console.log(`\n[${issue.severity.toUpperCase()}] ${issue.title}`);
    console.log(`  Line: ${issue.location.line}`);
    console.log(`  Description: ${issue.description}`);
    if (issue.suggestion) {
      console.log(`  Suggestion: ${issue.suggestion}`);
    }
  }
}

// ============================================================================
// Example 2: Custom Configuration
// ============================================================================

async function example2_customConfig() {
  console.log('\nExample 2: Custom Configuration\n');

  const review = new CodeReview();

  const result = await review.reviewFile('./examples/sample-code.ts', {
    includeQuality: true,
    includeSecurity: true,
    includePerformance: true,
    includeStyle: false,
    includePractices: true,
    options: {
      minSeverity: 'warning',
      maxIssues: 50,
    },
  });

  console.log(`Security Issues: ${result.security.issues.length}`);
  console.log(`Quality Score: ${result.quality.maintainabilityIndex}`);
  console.log(`Performance Issues: ${result.performance.bottlenecks.length}`);
}

// ============================================================================
// Example 3: Multiple Files
// ============================================================================

async function example3_multipleFiles() {
  console.log('\nExample 3: Multiple Files\n');

  const review = new CodeReview();

  const results = await review.reviewFiles([
    './examples/sample-code.ts',
    './examples/another-file.ts',
  ]);

  for (const [file, result] of results.entries()) {
    console.log(`\n${file}:`);
    console.log(`  Score: ${result.review.metrics.score}/100`);
    console.log(`  Issues: ${result.review.issues.length}`);
  }
}

// ============================================================================
// Example 4: Security-Focused Review
// ============================================================================

async function example4_securityReview() {
  console.log('\nExample 4: Security-Focused Review\n');

  const review = new CodeReview();

  const result = await review.reviewFile('./examples/sample-code.ts', {
    includeQuality: false,
    includeSecurity: true,
    includePerformance: false,
    includeStyle: false,
    includePractices: false,
  });

  console.log(`Security Issues Found: ${result.security.issues.length}`);

  // Group by severity
  const bySeverity = result.security.issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nBreakdown by Severity:');
  for (const [severity, count] of Object.entries(bySeverity)) {
    console.log(`  ${severity}: ${count}`);
  }

  // Group by category
  const byCategory = result.security.issues.reduce((acc, issue) => {
    const category = issue.metadata?.owasp || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nBreakdown by OWASP Category:');
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${count}`);
  }
}

// ============================================================================
// Example 5: Generate Report
// ============================================================================

async function example5_generateReport() {
  console.log('\nExample 5: Generate Report\n');

  const { promises: fs } = await import('fs');

  const review = new CodeReview();

  const result = await review.reviewFile('./examples/sample-code.ts');

  // Generate JSON report
  const jsonReport = JSON.stringify(result, null, 2);
  await fs.writeFile('review-report.json', jsonReport);
  console.log('JSON report saved to review-report.json');

  // Generate markdown report
  const { TemplateManager } = await import('../src/review/template-manager.js');
  const templateManager = new TemplateManager();

  const markdownReport = await templateManager.renderMarkdownReport({
    summary: result.review.summary,
    issues: result.review.issues,
    metrics: result.review.metrics,
  });

  await fs.writeFile('review-report.md', markdownReport);
  console.log('Markdown report saved to review-report.md');

  // Generate HTML report
  const htmlReport = await templateManager.renderHtmlReport({
    summary: result.review.summary,
    issues: result.review.issues,
    metrics: result.review.metrics,
  });

  await fs.writeFile('review-report.html', htmlReport);
  console.log('HTML report saved to review-report.html');
}

// ============================================================================
// Example 6: CI/CD Integration
// ============================================================================

async function example6_cicdIntegration() {
  console.log('\nExample 6: CI/CD Integration\n');

  const review = new CodeReview();

  const result = await review.reviewFile('./examples/sample-code.ts');

  // Check if review meets quality gates
  const minScore = 70;
  const maxCriticalIssues = 0;

  const criticalIssues = result.review.issues.filter(
    (i) => i.severity === 'error' || i.category === 'security'
  );

  const passesQualityGate =
    result.review.metrics.score >= minScore && criticalIssues.length <= maxCriticalIssues;

  if (passesQualityGate) {
    console.log('✓ Quality gate passed');
    console.log(`  Score: ${result.review.metrics.score} >= ${minScore}`);
    console.log(`  Critical Issues: ${criticalIssues.length} <= ${maxCriticalIssues}`);
  } else {
    console.log('✗ Quality gate failed');
    console.log(`  Score: ${result.review.metrics.score} < ${minScore}`);
    console.log(`  Critical Issues: ${criticalIssues.length} > ${maxCriticalIssues}`);
    process.exit(1);
  }
}

// ============================================================================
// Example 7: Custom Rules
// ============================================================================

async function example7_customRules() {
  console.log('\nExample 7: Custom Rules\n');

  const { RuleRegistry } = await import('../src/review/rule-registry.js');
  const registry = new RuleRegistry();

  // Register a custom rule
  registry.register({
    id: 'custom-no-todo',
    name: 'No TODO Comments',
    category: 'best-practices' as const,
    severity: 'warning' as const,
    description: 'Files should not contain TODO comments',
    languages: ['typescript' as const, 'javascript' as const],
    enabled: true,
    execute: async (filePath, content) => {
      const lines = content.split('\n');
      const issues: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (/TODO|FIXME/i.test(lines[i])) {
          issues.push({
            ruleId: 'custom-no-todo',
            message: 'TODO comment found',
            location: { line: i + 1, column: 1 },
            severity: 'warning' as const,
            category: 'best-practices' as const,
          });
        }
      }

      return issues;
    },
  });

  console.log('Custom rule registered');
  console.log(`Total rules: ${registry.getAllRuleIds().length}`);
}

// ============================================================================
// Example 8: Metrics Analysis
// ============================================================================

async function example8_metricsAnalysis() {
  console.log('\nExample 8: Metrics Analysis\n');

  const { MetricsCalculator } = await import('../src/metrics/calculator.js');
  const calculator = new MetricsCalculator();

  const { promises: fs } = await import('fs');
  const content = await fs.readFile('./examples/sample-code.ts', 'utf-8');

  const metrics = await calculator.calculateCodeMetrics('./examples/sample-code.ts', content, {
    path: './examples/sample-code.ts',
    language: 'typescript',
    size: Buffer.byteLength(content, 'utf8'),
    lines: content.split('\n').length,
  });

  console.log('Code Metrics:');
  console.log(`  Lines of Code: ${metrics.linesOfCode}`);
  console.log(`  Lines of Comments: ${metrics.linesOfComments}`);
  console.log(`  Comment Ratio: ${metrics.commentRatio.toFixed(1)}%`);
  console.log(`  Complexity: ${metrics.complexity}`);
  console.log(`  Maintainability Index: ${metrics.maintainabilityIndex}`);
  console.log(`  Technical Debt Ratio: ${metrics.technicalDebtRatio}%`);
  console.log(`  Code Duplication: ${metrics.codeDuplication}%`);
  console.log(`  Documentation Coverage: ${metrics.documentationCoverage}%`);
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  try {
    await example1_quickReview();
    await example2_customConfig();
    await example3_multipleFiles();
    await example4_securityReview();
    await example5_generateReport();
    await example6_cicdIntegration();
    await example7_customRules();
    await example8_metricsAnalysis();

    console.log('\n✓ All examples completed successfully');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
