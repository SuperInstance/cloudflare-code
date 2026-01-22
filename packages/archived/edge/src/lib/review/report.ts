/**
 * Report Generator
 *
 * Generates comprehensive code review reports in multiple formats:
 * - Console output
 * - HTML reports
 * - JSON reports
 * - Markdown reports
 * - JUnit XML
 * - SARIF (Static Analysis Results Interchange Format)
 */

import type {
  CodeReviewReport,
  MultiFileReviewReport,
  CodeIssue,
  ReviewSummary,
  SecurityReport,
  PerformanceProfile,
} from './types';

// ============================================================================
// Report Formats
// ============================================================================

/**
 * Report format type
 */
export type ReportFormat =
  | 'console'
  | 'json'
  | 'html'
  | 'markdown'
  | 'junit'
  | 'sarif';

/**
 * Report options
 */
export interface ReportOptions {
  format: ReportFormat;
  includeDetails?: boolean;
  includeSuggestions?: boolean;
  includeCode?: boolean;
  groupBy?: 'file' | 'severity' | 'category';
  sortBy?: 'severity' | 'line' | 'category';
  minSeverity?: string;
  outputFile?: string;
}

// ============================================================================
// Report Generator
// ============================================================================

/**
 * Report generator
 */
export class ReportGenerator {
  /**
   * Generate report for a single file
   */
  generateFileReport(
    report: CodeReviewReport,
    options: ReportOptions = { format: 'console' }
  ): string {
    switch (options.format) {
      case 'console':
        return this.generateConsoleReport(report, options);
      case 'json':
        return this.generateJsonReport(report, options);
      case 'html':
        return this.generateHtmlReport(report, options);
      case 'markdown':
        return this.generateMarkdownReport(report, options);
      case 'junit':
        return this.generateJUnitReport(report, options);
      case 'sarif':
        return this.generateSarifReport(report, options);
      default:
        throw new Error(`Unknown format: ${options.format}`);
    }
  }

  /**
   * Generate report for multiple files
   */
  generateMultiFileReport(
    report: MultiFileReviewReport,
    options: ReportOptions = { format: 'console' }
  ): string {
    switch (options.format) {
      case 'console':
        return this.generateMultiFileConsoleReport(report, options);
      case 'json':
        return this.generateMultiFileJsonReport(report, options);
      case 'html':
        return this.generateMultiFileHtmlReport(report, options);
      case 'markdown':
        return this.generateMultiFileMarkdownReport(report, options);
      case 'junit':
        return this.generateMultiFileJUnitReport(report, options);
      case 'sarif':
        return this.generateMultiFileSarifReport(report, options);
      default:
        throw new Error(`Unknown format: ${options.format}`);
    }
  }

  // ========================================================================
  // Console Reports
  // ========================================================================

  /**
   * Generate console report for single file
   */
  private generateConsoleReport(report: CodeReviewReport, options: ReportOptions): string {
    const lines: string[] = [];

    // Header
    lines.push('\n' + '='.repeat(80));
    lines.push(`CODE REVIEW REPORT: ${report.file}`);
    lines.push('='.repeat(80));

    // Score
    lines.push(`\nOverall Score: ${this.getScoreDisplay(report.score)}`);
    lines.push(`Language: ${report.language}`);
    lines.push(`Lines of Code: ${report.metrics.linesOfCode}`);

    // Summary
    lines.push('\n' + '-'.repeat(80));
    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Total Issues: ${report.summary.totalIssues}`);
    lines.push(`  Critical: ${report.summary.criticalIssues}`);
    lines.push(`  High: ${report.summary.highIssues}`);
    lines.push(`  Medium: ${report.summary.mediumIssues}`);
    lines.push(`  Low: ${report.summary.lowIssues}`);
    lines.push(`  Info: ${report.summary.infoIssues}`);

    // Scores by category
    lines.push('\nCategory Scores:');
    lines.push(`  Security: ${report.summary.securityScore}/100`);
    lines.push(`  Performance: ${report.summary.performanceScore}/100`);
    lines.push(`  Quality: ${report.summary.qualityScore}/100`);
    lines.push(`  Maintainability: ${report.summary.maintainabilityScore}/100`);

    // Issues
    if (report.issues.length > 0) {
      lines.push('\n' + '-'.repeat(80));
      lines.push('ISSUES');
      lines.push('-'.repeat(80));

      const sortedIssues = this.sortIssues(report.issues, options.sortBy);
      const filteredIssues = this.filterBySeverity(sortedIssues, options.minSeverity);

      for (const issue of filteredIssues) {
        lines.push(`\n${this.getSeverityIcon(issue.severity)} ${issue.message}`);
        lines.push(`  File: ${issue.file}:${issue.line}`);
        lines.push(`  Rule: ${issue.rule}`);
        lines.push(`  Category: ${issue.category}`);

        if (options.includeCode && issue.code) {
          lines.push(`  Code: ${issue.code}`);
        }

        if (options.includeDetails && issue.description) {
          lines.push(`  Description: ${issue.description}`);
        }

        if (options.includeSuggestions && issue.suggestion) {
          lines.push(`  Suggestion: ${issue.suggestion}`);
        }

        if (issue.references && issue.references.length > 0) {
          lines.push(`  References: ${issue.references.join(', ')}`);
        }
      }
    } else {
      lines.push('\n✓ No issues found!');
    }

    // Recommendations
    if (report.summary.recommendations.length > 0) {
      lines.push('\n' + '-'.repeat(80));
      lines.push('RECOMMENDATIONS');
      lines.push('-'.repeat(80));
      for (const rec of report.summary.recommendations) {
        lines.push(`  • ${rec}`);
      }
    }

    // Strengths
    if (report.summary.strengths.length > 0) {
      lines.push('\n' + '-'.repeat(80));
      lines.push('STRENGTHS');
      lines.push('-'.repeat(80));
      for (const strength of report.summary.strengths) {
        lines.push(`  ✓ ${strength}`);
      }
    }

    // Weaknesses
    if (report.summary.weaknesses.length > 0) {
      lines.push('\n' + '-'.repeat(80));
      lines.push('AREAS FOR IMPROVEMENT');
      lines.push('-'.repeat(80));
      for (const weakness of report.summary.weaknesses) {
        lines.push(`  ! ${weakness}`);
      }
    }

    lines.push('\n' + '='.repeat(80) + '\n');

    return lines.join('\n');
  }

  /**
   * Generate console report for multiple files
   */
  private generateMultiFileConsoleReport(report: MultiFileReviewReport, options: ReportOptions): string {
    const lines: string[] = [];

    // Header
    lines.push('\n' + '='.repeat(80));
    lines.push(`MULTI-FILE CODE REVIEW REPORT`);
    lines.push(`Repository: ${report.repository}`);
    lines.push(`Branch: ${report.branch}`);
    if (report.commit) {
      lines.push(`Commit: ${report.commit}`);
    }
    lines.push('='.repeat(80));

    // Overall Score
    lines.push(`\nOverall Score: ${this.getScoreDisplay(report.overallScore)}`);
    lines.push(`Files Analyzed: ${report.files.length}`);
    lines.push(`Total Issues: ${report.issues.length}`);

    // Overall Summary
    lines.push('\n' + '-'.repeat(80));
    lines.push('OVERALL SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Critical: ${report.overallSummary.criticalIssues}`);
    lines.push(`High: ${report.overallSummary.highIssues}`);
    lines.push(`Medium: ${report.overallSummary.mediumIssues}`);
    lines.push(`Low: ${report.overallSummary.lowIssues}`);
    lines.push(`Info: ${report.overallSummary.infoIssues}`);

    // Top problematic files
    if (report.overallMetrics.mostProblematicFiles.length > 0) {
      lines.push('\n' + '-'.repeat(80));
      lines.push('MOST PROBLEMATIC FILES');
      lines.push('-'.repeat(80));
      for (const file of report.overallMetrics.mostProblematicFiles.slice(0, 10)) {
        lines.push(`  ${file.file}`);
        lines.push(`    Score: ${file.score}/100, Issues: ${file.issueCount}`);
      }
    }

    // Individual file reports
    for (const fileReport of report.files) {
      lines.push('\n' + this.generateConsoleReport(fileReport, options));
    }

    return lines.join('\n');
  }

  // ========================================================================
  // JSON Reports
  // ========================================================================

  /**
   * Generate JSON report
   */
  private generateJsonReport(report: CodeReviewReport, options: ReportOptions): string {
    const filteredReport = options.minSeverity
      ? {
          ...report,
          issues: this.filterBySeverity(report.issues, options.minSeverity),
        }
      : report;

    return JSON.stringify(filteredReport, null, 2);
  }

  /**
   * Generate multi-file JSON report
   */
  private generateMultiFileJsonReport(report: MultiFileReviewReport, options: ReportOptions): string {
    const filteredReport = options.minSeverity
      ? {
          ...report,
          issues: this.filterBySeverity(report.issues, options.minSeverity),
          files: report.files.map(f => ({
            ...f,
            issues: this.filterBySeverity(f.issues, options.minSeverity),
          })),
        }
      : report;

    return JSON.stringify(filteredReport, null, 2);
  }

  // ========================================================================
  // HTML Reports
  // ========================================================================

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: CodeReviewReport, options: ReportOptions): string {
    const issues = this.filterBySeverity(report.issues, options.minSeverity);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report - ${report.file}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { margin-bottom: 10px; }
    .score { font-size: 48px; font-weight: bold; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-card h3 { margin-bottom: 10px; color: #667eea; }
    .summary-card .value { font-size: 32px; font-weight: bold; }
    .issues { margin-bottom: 30px; }
    .issue { background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ccc; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .issue.critical { border-left-color: #e53e3e; }
    .issue.high { border-left-color: #dd6b20; }
    .issue.medium { border-left-color: #d69e2e; }
    .issue.low { border-left-color: #38a169; }
    .issue.info { border-left-color: #3182ce; }
    .issue-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
    .issue-message { font-weight: 600; font-size: 16px; }
    .issue-location { color: #718096; font-size: 14px; }
    .issue-code { background: #f7fafc; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; margin: 10px 0; overflow-x: auto; }
    .issue-suggestion { background: #ebf8ff; padding: 10px; border-radius: 4px; border-left: 3px solid #3182ce; margin: 10px 0; }
    .severity-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .severity-badge.critical { background: #fed7d7; color: #742a2a; }
    .severity-badge.high { background: #feebc8; color: #7c2d12; }
    .severity-badge.medium { background: #fefcbf; color: #744210; }
    .severity-badge.low { background: #c6f6d5; color: #22543d; }
    .severity-badge.info { background: #bee3f8; color: #2a4365; }
    .recommendations { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .recommendations ul { list-style: none; padding: 0; }
    .recommendations li { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .recommendations li:before { content: "•"; color: #667eea; font-weight: bold; margin-right: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Code Review Report</h1>
      <p>${report.file}</p>
      <div class="score">${report.score}/100</div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <h3>Total Issues</h3>
        <div class="value">${report.summary.totalIssues}</div>
      </div>
      <div class="summary-card">
        <h3>Critical</h3>
        <div class="value" style="color: #e53e3e">${report.summary.criticalIssues}</div>
      </div>
      <div class="summary-card">
        <h3>High</h3>
        <div class="value" style="color: #dd6b20">${report.summary.highIssues}</div>
      </div>
      <div class="summary-card">
        <h3>Medium</h3>
        <div class="value" style="color: #d69e2e">${report.summary.mediumIssues}</div>
      </div>
      <div class="summary-card">
        <h3>Maintainability</h3>
        <div class="value">${Math.round(report.metrics.maintainabilityIndex)}</div>
      </div>
    </div>

    ${issues.length > 0 ? `
    <div class="issues">
      <h2 style="margin-bottom: 20px;">Issues Found</h2>
      ${this.sortIssues(issues, options.sortBy).map(issue => `
        <div class="issue ${issue.severity}">
          <div class="issue-header">
            <div class="issue-message">${this.escapeHtml(issue.message)}</div>
            <span class="severity-badge ${issue.severity}">${issue.severity}</span>
          </div>
          <div class="issue-location">${issue.file}:${issue.line}</div>
          ${options.includeCode && issue.code ? `<div class="issue-code">${this.escapeHtml(issue.code)}</div>` : ''}
          ${options.includeSuggestions && issue.suggestion ? `<div class="issue-suggestion"><strong>Suggestion:</strong> ${this.escapeHtml(issue.suggestion)}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : '<p style="text-align: center; font-size: 18px; margin: 40px 0;">✓ No issues found!</p>'}

    ${report.summary.recommendations.length > 0 ? `
    <div class="recommendations">
      <h2 style="margin-bottom: 20px;">Recommendations</h2>
      <ul>
        ${report.summary.recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Generate multi-file HTML report
   */
  private generateMultiFileHtmlReport(report: MultiFileReviewReport, options: ReportOptions): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report - ${report.repository}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f7fafc; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { margin-bottom: 10px; }
    .score { font-size: 64px; font-weight: bold; }
    .files-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
    .file-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .file-card h3 { margin-bottom: 10px; word-break: break-all; }
    .file-score { font-size: 36px; font-weight: bold; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Code Review Report</h1>
      <p>${report.repository} - ${report.branch}</p>
      <div class="score">${report.overallScore}/100</div>
    </div>

    <div class="files-grid">
      ${report.files.map(file => `
        <div class="file-card">
          <h3>${file.file}</h3>
          <div class="file-score">${file.score}/100</div>
          <p>Issues: ${file.issues.length}</p>
          <p>Language: ${file.language}</p>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
  }

  // ========================================================================
  // Markdown Reports
  // ========================================================================

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(report: CodeReviewReport, options: ReportOptions): string {
    const issues = this.filterBySeverity(report.issues, options.minSeverity);
    const lines: string[] = [];

    lines.push(`# Code Review Report`);
    lines.push(`\n**File:** ${report.file}`);
    lines.push(`**Language:** ${report.language}`);
    lines.push(`**Score:** ${report.score}/100`);
    lines.push(`**Lines of Code:** ${report.metrics.linesOfCode}`);

    lines.push(`\n## Summary`);
    lines.push(`\n| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Issues | ${report.summary.totalIssues} |`);
    lines.push(`| Critical | ${report.summary.criticalIssues} |`);
    lines.push(`| High | ${report.summary.highIssues} |`);
    lines.push(`| Medium | ${report.summary.mediumIssues} |`);
    lines.push(`| Low | ${report.summary.lowIssues} |`);
    lines.push(`| Info | ${report.summary.infoIssues} |`);

    lines.push(`\n## Scores`);
    lines.push(`\n- **Security:** ${report.summary.securityScore}/100`);
    lines.push(`- **Performance:** ${report.summary.performanceScore}/100`);
    lines.push(`- **Quality:** ${report.summary.qualityScore}/100`);
    lines.push(`- **Maintainability:** ${report.summary.maintainabilityScore}/100`);

    if (issues.length > 0) {
      lines.push(`\n## Issues`);
      lines.push(`\n${this.sortIssues(issues, options.sortBy).map((issue, i) => {
        let md = `\n### ${i + 1}. ${issue.message}\n\n`;
        md += `- **Severity:** ${issue.severity}\n`;
        md += `- **Location:** ${issue.file}:${issue.line}\n`;
        md += `- **Rule:** ${issue.rule}\n`;
        md += `- **Category:** ${issue.category}\n`;

        if (options.includeCode && issue.code) {
          md += `\n\`\`\`\n${issue.code}\n\`\`\`\n`;
        }

        if (options.includeDetails && issue.description) {
          md += `\n**Description:** ${issue.description}\n`;
        }

        if (options.includeSuggestions && issue.suggestion) {
          md += `\n**Suggestion:** ${issue.suggestion}\n`;
        }

        return md;
      }).join('\n')}`);
    }

    if (report.summary.recommendations.length > 0) {
      lines.push(`\n## Recommendations`);
      lines.push(`\n${report.summary.recommendations.map(r => `- ${r}`).join('\n')}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate multi-file Markdown report
   */
  private generateMultiFileMarkdownReport(report: MultiFileReviewReport, options: ReportOptions): string {
    const lines: string[] = [];

    lines.push(`# Code Review Report`);
    lines.push(`\n**Repository:** ${report.repository}`);
    lines.push(`**Branch:** ${report.branch}`);
    if (report.commit) {
      lines.push(`**Commit:** ${report.commit}`);
    }
    lines.push(`\n**Overall Score:** ${report.overallScore}/100`);
    lines.push(`**Files Analyzed:** ${report.files.length}`);
    lines.push(`**Total Issues:** ${report.issues.length}`);

    lines.push(`\n## Summary`);
    lines.push(`\n| Severity | Count |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Critical | ${report.overallSummary.criticalIssues} |`);
    lines.push(`| High | ${report.overallSummary.highIssues} |`);
    lines.push(`| Medium | ${report.overallSummary.mediumIssues} |`);
    lines.push(`| Low | ${report.overallSummary.lowIssues} |`);
    lines.push(`| Info | ${report.overallSummary.infoIssues} |`);

    lines.push(`\n## Files`);
    lines.push(`\n| File | Score | Issues | Language |`);
    lines.push(`|------|-------|--------|----------|`);
    for (const file of report.files) {
      lines.push(`| ${file.file} | ${file.score}/100 | ${file.issues.length} | ${file.language} |`);
    }

    return lines.join('\n');
  }

  // ========================================================================
  // JUnit Reports
  // ========================================================================

  /**
   * Generate JUnit XML report
   */
  private generateJUnitReport(report: CodeReviewReport, options: ReportOptions): string {
    const issues = this.filterBySeverity(report.issues, options.minSeverity);

    const testCases = issues.map(issue => {
      const failure = issue.severity !== 'info' ? `      <failure message="${this.escapeXml(issue.message)}" type="${issue.category}">${this.escapeXml(issue.description || issue.message)}</failure>\n` : '';
      return `    <testcase name="${this.escapeXml(issue.rule)}" classname="${this.escapeXml(issue.category)}" time="0">
${failure}    </testcase>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Code Review" tests="${issues.length}" failures="${issues.filter(i => i.severity !== 'info').length}">
  <testsuite name="${this.escapeXml(report.file)}" tests="${issues.length}" failures="${issues.filter(i => i.severity !== 'info').length}" time="0">
${testCases}
  </testsuite>
</testsuites>`;
  }

  /**
   * Generate multi-file JUnit XML report
   */
  private generateMultiFileJUnitReport(report: MultiFileReviewReport, options: ReportOptions): string {
    const testSuites = report.files.map(file => this.generateJUnitReport(file, options)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Code Review" tests="${report.issues.length}" failures="${report.issues.filter(i => i.severity !== 'info').length}">
${testSuites}
</testsuites>`;
  }

  // ========================================================================
  // SARIF Reports
  // ========================================================================

  /**
   * Generate SARIF report
   */
  private generateSarifReport(report: CodeReviewReport, options: ReportOptions): string {
    const sarifReport = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'ClaudeFlare Code Review',
              version: '1.0.0',
              informationUri: 'https://github.com/claudeflare/review',
            },
          },
          results: report.issues.map(issue => ({
            ruleId: issue.rule,
            level: this.getSeverityLevel(issue.severity),
            message: {
              text: issue.message,
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: issue.file,
                  },
                  region: {
                    startLine: issue.line,
                    startColumn: issue.column || 1,
                    endLine: issue.endLine || issue.line,
                    endColumn: issue.endColumn || (issue.column || 1),
                  },
                },
              },
            ],
          })),
        },
      ],
    };

    return JSON.stringify(sarifReport, null, 2);
  }

  /**
   * Generate multi-file SARIF report
   */
  private generateMultiFileSarifReport(report: MultiFileReviewReport, options: ReportOptions): string {
    return this.generateSarifReport(report.files[0] || report, options);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Sort issues
   */
  private sortIssues(issues: CodeIssue[], sortBy?: string): CodeIssue[] {
    const sorted = [...issues];

    switch (sortBy) {
      case 'severity':
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return sorted.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
      case 'line':
        return sorted.sort((a, b) => a.line - b.line);
      case 'category':
        return sorted.sort((a, b) => a.category.localeCompare(b.category));
      default:
        return sorted;
    }
  }

  /**
   * Filter issues by severity
   */
  private filterBySeverity(issues: CodeIssue[], minSeverity?: string): CodeIssue[] {
    if (!minSeverity) return issues;

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const minLevel = severityOrder[minSeverity as keyof typeof severityOrder] ?? 4;

    return issues.filter(issue => {
      const level = severityOrder[issue.severity];
      return level <= minLevel;
    });
  }

  /**
   * Get score display with color
   */
  private getScoreDisplay(score: number): string {
    if (score >= 80) return `🟢 ${score}/100`;
    if (score >= 60) return `🟡 ${score}/100`;
    if (score >= 40) return `🟠 ${score}/100`;
    return `🔴 ${score}/100`;
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '💡';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  }

  /**
   * Get SARIF level from severity
   */
  private getSeverityLevel(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
      case 'info':
        return 'note';
      default:
        return 'note';
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => escapeMap[m]);
  }

  /**
   * Escape XML
   */
  private escapeXml(text: string): string {
    return this.escapeHtml(text).replace(/'/g, '&apos;');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a report generator instance
 */
export function createReportGenerator(): ReportGenerator {
  return new ReportGenerator();
}
