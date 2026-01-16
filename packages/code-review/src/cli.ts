#!/usr/bin/env node

/**
 * ClaudeFlare Code Review CLI
 */

// @ts-nocheck - External dependencies (commander) and CLI-specific code
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeReview, quickReview } from './index.js';

const program = new Command();

// ============================================================================
// CLI Configuration
// ============================================================================

program
  .name('claudeflare-review')
  .description('ClaudeFlare automated code review and analysis')
  .version('0.1.0');

// ============================================================================
// Commands
// ============================================================================

program
  .command('review')
  .description('Review code files')
  .argument('<files...>', 'files to review')
  .option('-o, --output <file>', 'output file (JSON, Markdown, or HTML)')
  .option('-f, --format <format>', 'output format (json, markdown, html)', 'json')
  .option('--no-quality', 'skip quality analysis')
  .option('--no-security', 'skip security analysis')
  .option('--no-performance', 'skip performance analysis')
  .option('--no-style', 'skip style analysis')
  .option('--no-practices', 'skip best practices analysis')
  .option('--severity <level>', 'minimum severity level (error, warning, info, hint)', 'info')
  .action(async (files: string[], options) => {
    const review = new CodeReview();

    console.log(`\n🔍 ClaudeFlare Code Review`);
    console.log(`Analyzing ${files.length} file(s)...\n`);

    const results: any[] = [];

    for (const file of files) {
      try {
        const result = await review.reviewFile(file, {
          includeQuality: options.quality,
          includeSecurity: options.security,
          includePerformance: options.performance,
          includeStyle: options.style,
          includePractices: options.practices,
          options: {
            minSeverity: options.severity as any,
          },
        });

        results.push(result);

        // Print summary
        console.log(`\n✓ ${file}`);
        console.log(`  Issues: ${result.review.issues.length}`);
        console.log(`  Score: ${result.review.metrics.score}/100`);
        console.log(`  Time: ${result.review.duration}ms`);
      } catch (error: any) {
        console.error(`\n✗ ${file}: ${error.message}`);
      }
    }

    // Generate output
    if (options.output) {
      await generateOutput(results, options.output, options.format);
      console.log(`\n✓ Report saved to ${options.output}`);
    }

    // Print overall summary
    const totalIssues = results.reduce((sum, r) => sum + r.review.issues.length, 0);
    const avgScore = results.reduce((sum, r) => sum + r.review.metrics.score, 0) / results.length;

    console.log(`\n📊 Summary:`);
    console.log(`  Total Issues: ${totalIssues}`);
    console.log(`  Average Score: ${avgScore.toFixed(1)}/100`);
    console.log(`\n`);
  });

program
  .command('scan')
  .description('Scan for security issues')
  .argument('<path>', 'file or directory to scan')
  .option('-o, --output <file>', 'output file (JSON)')
  .option('--secrets', 'scan for secrets')
  .option('--vulnerabilities', 'scan for vulnerabilities')
  .option('--dependencies', 'scan dependencies')
  .action(async (targetPath: string, options) => {
    const { SecurityScanner } = await import('./security/scanner.js');
    const scanner = new SecurityScanner();

    console.log(`\n🔒 Security Scan`);
    console.log(`Scanning ${targetPath}...\n`);

    const stat = await fs.stat(targetPath);
    let files: string[] = [];

    if (stat.isDirectory()) {
      // Recursively find files
      files = await findFiles(targetPath);
    } else {
      files = [targetPath];
    }

    const allIssues: any[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileInfo = {
          path: file,
          language: 'typescript' as any, // Would detect
          size: Buffer.byteLength(content, 'utf8'),
          lines: content.split('\n').length,
        };

        if (options.secrets) {
          const secrets = await scanner.scanSecrets(file, content);
          console.log(`  ${file}: ${secrets.length} secret(s) found`);
        }

        if (options.vulnerabilities) {
          const report = await scanner.scanFile(file, content, fileInfo);
          allIssues.push(...report.issues);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (options.dependencies) {
      const dependencies = await scanner.scanDependencies(process.cwd());
      console.log(`\n  Dependencies: ${dependencies.length} vulnerability(ies) found`);
    }

    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(allIssues, null, 2));
      console.log(`\n✓ Report saved to ${options.output}`);
    }

    console.log(`\n✓ Scan complete: ${allIssues.length} issue(s) found\n`);
  });

program
  .command('quality')
  .description('Analyze code quality')
  .argument('<files...>', 'files to analyze')
  .option('-o, --output <file>', 'output file (JSON)')
  .action(async (files: string[], options) => {
    const { QualityAnalyzer } = await import('./quality/analyzer.js');
    const analyzer = new QualityAnalyzer();

    console.log(`\n📊 Quality Analysis`);
    console.log(`Analyzing ${files.length} file(s)...\n`);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileInfo = {
          path: file,
          language: 'typescript' as any,
          size: Buffer.byteLength(content, 'utf8'),
          lines: content.split('\n').length,
        };

        const metrics = await analyzer.analyzeFile(file, content, fileInfo);

        console.log(`\n${file}:`);
        console.log(`  Maintainability Index: ${metrics.maintainabilityIndex}`);
        console.log(`  Technical Debt: ${metrics.technicalDebt}`);
        console.log(`  Code Duplication: ${metrics.codeDuplication}%`);
        console.log(`  Complexity: ${metrics.complexity.complexity.toFixed(1)}`);
      } catch (error: any) {
        console.error(`\n✗ ${file}: ${error.message}`);
      }
    }

    console.log(`\n✓ Analysis complete\n`);
  });

program
  .command('metrics')
  .description('Calculate code metrics')
  .argument('<files...>', 'files to analyze')
  .option('-o, --output <file>', 'output file (JSON)')
  .option('--historical', 'include historical trends')
  .action(async (files: string[], options) => {
    const { MetricsCalculator } = await import('./metrics/calculator.js');
    const calculator = new MetricsCalculator();

    console.log(`\n📈 Code Metrics`);
    console.log(`Calculating metrics for ${files.length} file(s)...\n`);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileInfo = {
          path: file,
          language: 'typescript' as any,
          size: Buffer.byteLength(content, 'utf8'),
          lines: content.split('\n').length,
        };

        const metrics = await calculator.calculateCodeMetrics(file, content, fileInfo);

        console.log(`\n${file}:`);
        console.log(`  Lines of Code: ${metrics.linesOfCode}`);
        console.log(`  Lines of Comments: ${metrics.linesOfComments}`);
        console.log(`  Comment Ratio: ${metrics.commentRatio.toFixed(1)}%`);
        console.log(`  Complexity: ${metrics.complexity}`);
        console.log(`  Maintainability Index: ${metrics.maintainabilityIndex}`);
      } catch (error: any) {
        console.error(`\n✗ ${file}: ${error.message}`);
      }
    }

    console.log(`\n✓ Metrics calculated\n`);
  });

// ============================================================================
// Helper Functions
// ============================================================================

async function findFiles(dir: string, extensions: string[] = ['.ts', '.js', '.py', '.go', '.rs', '.java']): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and other common directories
      if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
        files.push(...await findFiles(fullPath, extensions));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function generateOutput(results: any[], outputFile: string, format: string): Promise<void> {
  const outputDir = path.dirname(outputFile);
  await fs.mkdir(outputDir, { recursive: true });

  if (format === 'json') {
    await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
  } else if (format === 'markdown') {
    const markdown = generateMarkdownReport(results);
    await fs.writeFile(outputFile, markdown);
  } else if (format === 'html') {
    const html = await generateHtmlReport(results);
    await fs.writeFile(outputFile, html);
  } else {
    throw new Error(`Unknown format: ${format}`);
  }
}

function generateMarkdownReport(results: any[]): string {
  const sections: string[] = [];

  sections.push('# Code Review Report\n');
  sections.push(`**Generated:** ${new Date().toISOString()}\n`);
  sections.push(`**Files Reviewed:** ${results.length}\n`);

  // Summary
  const totalIssues = results.reduce((sum, r) => sum + r.review.issues.length, 0);
  const avgScore = results.reduce((sum, r) => sum + r.review.metrics.score, 0) / results.length;

  sections.push('## Summary\n');
  sections.push(`- **Total Issues:** ${totalIssues}\n`);
  sections.push(`- **Average Score:** ${avgScore.toFixed(1)}/100\n`);

  // Severity breakdown
  const bySeverity: any = { error: 0, warning: 0, info: 0, hint: 0 };
  for (const result of results) {
    for (const issue of result.review.issues) {
      bySeverity[issue.severity]++;
    }
  }

  sections.push('\n### Severity Breakdown\n');
  for (const [severity, count] of Object.entries(bySeverity)) {
    if (count > 0) {
      const emoji = { error: '🚨', warning: '⚠️', info: 'ℹ️', hint: '💡' }[severity as keyof typeof emoji];
      sections.push(`- ${emoji} **${severity}:** ${count}\n`);
    }
  }

  // File results
  sections.push('\n## Files\n');

  for (const result of results) {
    const file = result.context.workingDirectory;
    sections.push(`### ${file}\n`);
    sections.push(`**Score:** ${result.review.metrics.score}/100\n`);
    sections.push(`**Issues:** ${result.review.issues.length}\n`);

    if (result.review.issues.length > 0) {
      sections.push('\n#### Issues:\n');
      for (const issue of result.review.issues.slice(0, 10)) {
        const emoji = { error: '🚨', warning: '⚠️', info: 'ℹ️', hint: '💡' }[issue.severity];
        sections.push(`\n${emoji} **${issue.title}** (line ${issue.location.line})\n`);
        sections.push(`${issue.description}\n`);
        if (issue.suggestion) {
          sections.push(`> 💡 ${issue.suggestion}\n`);
        }
      }

      if (result.review.issues.length > 10) {
        sections.push(`\n_*${result.review.issues.length - 10} more issues*_\n`);
      }
    }

    sections.push('\n---\n');
  }

  return sections.join('\n');
}

async function generateHtmlReport(results: any[]): Promise<string> {
  // Import TemplateManager for HTML generation
  const { TemplateManager } = await import('./review/template-manager.js');
  const templateManager = new TemplateManager();

  // Aggregate all issues
  const allIssues = results.flatMap((r) => r.review.issues);
  const summary = {
    total: allIssues.length,
    bySeverity: allIssues.reduce((acc: any, issue: any) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {}),
    byCategory: allIssues.reduce((acc: any, issue: any) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {}),
    byFile: allIssues.reduce((acc: any, issue: any) => {
      acc[issue.location.path] = (acc[issue.location.path] || 0) + 1;
      return acc;
    }, {}),
  };

  const metrics = results.reduce(
    (acc: any, r: any) => ({
      filesScanned: acc.filesScanned + 1,
      linesAnalyzed: acc.linesAnalyzed + (r.review?.metrics?.linesAnalyzed || 0),
      issuesFound: acc.issuesFound + (r.review?.issues?.length || 0),
      issuesFixed: 0,
      coverage: 100,
      score: (acc.score + (r.review?.metrics?.score || 0)) / (results.length || 1),
    }),
    { filesScanned: 0, linesAnalyzed: 0, issuesFound: 0, issuesFixed: 0, coverage: 100, score: 0 }
  );

  return templateManager.renderHtmlReport({
    summary,
    issues: allIssues,
    metrics,
  });
}

// ============================================================================
// Run CLI
// ============================================================================

program.parseAsync(process.argv).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
