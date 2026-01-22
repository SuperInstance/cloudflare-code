/**
 * Template Manager - Manages review comment and report templates
 */

// @ts-nocheck - Template processing with type inference issues
import { Issue, PullRequestInfo, Severity, Category } from '../types/index.js';

// ============================================================================
// Template Types
// ============================================================================

interface Template {
  name: string;
  content: string;
  variables: string[];
}

interface CommentTemplate {
  severity: Severity;
  category: Category;
  template: string;
}

// ============================================================================
// Template Manager
// ============================================================================

export class TemplateManager {
  private commentTemplates: Map<string, CommentTemplate> = new Map();
  private reportTemplates: Map<string, Template> = new Map();

  constructor() {
    this.initializeCommentTemplates();
    this.initializeReportTemplates();
  }

  // ========================================================================
  // Comment Templates
  // ========================================================================

  /**
   * Render a review comment for an issue
   */
  async renderComment(issue: Issue, pr: PullRequestInfo): Promise<string> {
    const template = this.getCommentTemplate(issue.severity, issue.category);
    return this.interpolateTemplate(template, {
      issue,
      pr,
      author: pr.author,
      file: issue.location.path,
      line: issue.location.line,
      code: issue.code || '',
      suggestion: issue.suggestion || '',
    });
  }

  /**
   * Get template for issue severity and category
   */
  private getCommentTemplate(severity: Severity, category: Category): string {
    const key = `${severity}-${category}`;
    const template = this.commentTemplates.get(key);

    if (template) {
      return template.template;
    }

    // Default templates by severity
    const defaultTemplates: Record<Severity, string> = {
      error: `### 🚨 Error

**{issue.title}**

{issue.description}

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

{suggestion}

*Automated review comment by ClaudeFlare*`,
      warning: `### ⚠️ Warning

**{issue.title}**

{issue.description}

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

{suggestion}

*Automated review comment by ClaudeFlare*`,
      info: `### ℹ️ Info

**{issue.title}**

{issue.description}

**Location:** \`{file}:{line}\`

{suggestion}

*Automated review comment by ClaudeFlare*`,
      hint: `### 💡 Suggestion

**{issue.title}**

{issue.description}

**Location:** \`{file}:{line}\`

{suggestion}

*Automated review comment by ClaudeFlare*`,
    };

    return defaultTemplates[severity];
  }

  /**
   * Initialize comment templates
   */
  private initializeCommentTemplates(): void {
    // Security templates
    this.registerCommentTemplate('error', 'security',
      `### 🔒 Security Issue

**{issue.title}**

{issue.description}

**Risk Level:** Critical
**CWE:** {issue.metadata.cwe}
**OWASP:** {issue.metadata.owasp}

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

**Recommended Fix:**
{suggestion}

Please address this security issue before merging.

*Automated security review by ClaudeFlare*`);

    this.registerCommentTemplate('warning', 'security',
      `### 🔒 Security Concern

**{issue.title}**

{issue.description}

**Risk Level:** Medium

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

**Suggested Fix:**
{suggestion}

*Automated security review by ClaudeFlare*`);

    // Performance templates
    this.registerCommentTemplate('warning', 'performance',
      `### ⚡ Performance Issue

**{issue.title}**

{issue.description}

**Expected Impact:** {issue.metadata.impact}

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

**Optimization Suggestion:**
{suggestion}

*Automated performance review by ClaudeFlare*`);

    // Quality templates
    this.registerCommentTemplate('warning', 'quality',
      `### 📊 Code Quality

**{issue.title}**

{issue.description}

**Complexity:** {issue.metadata.complexity}
**Maintainability Impact:** High

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

**Refactoring Suggestion:**
{suggestion}

*Automated quality review by ClaudeFlare*`);

    // Best practices templates
    this.registerCommentTemplate('info', 'best-practices',
      `### ✨ Best Practice

**{issue.title}**

{issue.description}

**Principle:** {issue.metadata.principle}

**Location:** \`{file}:{line}\`

{suggestion}

*Automated best practices review by ClaudeFlare*`);

    // Style templates
    this.registerCommentTemplate('hint', 'style',
      `### 🎨 Style Suggestion

**{issue.title}**

{issue.description}

**Location:** \`{file}:{line}\`

\`\`\`
{code}
\`\`\`

{suggestion}

*Automated style review by ClaudeFlare*`);
  }

  /**
   * Register a comment template
   */
  private registerCommentTemplate(severity: Severity, category: Category, template: string): void {
    const key = `${severity}-${category}`;
    this.commentTemplates.set(key, { severity, category, template });
  }

  // ========================================================================
  // Report Templates
  // ========================================================================

  /**
   * Render a summary report
   */
  async renderSummaryReport(data: {
    pr: PullRequestInfo;
    totalIssues: number;
    bySeverity: Record<Severity, number>;
    score: number;
    recommendations: string[];
  }): Promise<string> {
    const template = this.reportTemplates.get('summary');
    if (!template) {
      return this.getDefaultSummaryReport(data);
    }

    return this.interpolateTemplate(template.content, data);
  }

  /**
   * Render a markdown report
   */
  async renderMarkdownReport(data: {
    pr?: PullRequestInfo;
    summary: any;
    issues: Issue[];
    metrics: any;
  }): Promise<string> {
    const sections: string[] = [];

    // Header
    sections.push('# Code Review Report\n');
    sections.push(`**Generated:** ${new Date().toISOString()}\n`);

    if (data.pr) {
      sections.push(`**PR:** #${data.pr.number} - ${data.pr.title}\n`);
      sections.push(`**Author:** ${data.pr.author}\n`);
      sections.push(`**Branch:** ${data.pr.sourceBranch} → ${data.pr.targetBranch}\n`);
    }

    sections.push('---\n');

    // Summary
    sections.push('## Summary\n');
    sections.push(`- **Total Issues:** ${data.summary.total}\n`);
    sections.push(`- **Files Changed:** ${Object.keys(data.summary.byFile).length}\n`);
    sections.push(`- **Review Score:** ${data.metrics.score}/100\n`);

    // Severity breakdown
    sections.push('\n### Severity Breakdown\n');
    for (const [severity, count] of Object.entries(data.summary.bySeverity)) {
      if (count > 0) {
        const emoji = this.getSeverityEmoji(severity as Severity);
        sections.push(`- ${emoji} **${severity}:** ${count}\n`);
      }
    }

    // Category breakdown
    sections.push('\n### Category Breakdown\n');
    for (const [category, count] of Object.entries(data.summary.byCategory)) {
      if (count > 0) {
        const emoji = this.getCategoryEmoji(category as Category);
        sections.push(`- ${emoji} **${category}:** ${count}\n`);
      }
    }

    // Issues by file
    sections.push('\n## Issues by File\n');
    for (const [file, count] of Object.entries(data.summary.byFile)) {
      if (count > 0) {
        sections.push(`### ${file}\n`);
        const fileIssues = data.issues.filter((i) => i.location.path === file);
        for (const issue of fileIssues) {
          const emoji = this.getSeverityEmoji(issue.severity);
          sections.push(`\n${emoji} **${issue.title}** (line ${issue.location.line})\n`);
          sections.push(`${issue.description}\n`);
          if (issue.suggestion) {
            sections.push(`> 💡 ${issue.suggestion}\n`);
          }
        }
      }
    }

    return sections.join('\n');
  }

  /**
   * Render HTML report
   */
  async renderHtmlReport(data: {
    pr?: PullRequestInfo;
    summary: any;
    issues: Issue[];
    metrics: any;
  }): Promise<string> {
    const html: string[] = [];

    html.push('<!DOCTYPE html>');
    html.push('<html lang="en">');
    html.push('<head>');
    html.push('  <meta charset="UTF-8">');
    html.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    html.push('  <title>Code Review Report - ClaudeFlare</title>');
    html.push('  <style>');
    html.push(this.getHtmlStyles());
    html.push('  </style>');
    html.push('</head>');
    html.push('<body>');
    html.push('  <div class="container">');

    // Header
    html.push('    <header>');
    html.push('      <h1>🔍 Code Review Report</h1>');
    html.push(`      <p class="timestamp">Generated: ${new Date().toISOString()}</p>`);
    html.push('    </header>');

    if (data.pr) {
      html.push('    <div class="pr-info">');
      html.push(`      <h2>PR #${data.pr.number}: ${data.pr.title}</h2>`);
      html.push(`      <p><strong>Author:</strong> ${data.pr.author}</p>`);
      html.push(`      <p><strong>Branch:</strong> ${data.pr.sourceBranch} → ${data.pr.targetBranch}</p>`);
      html.push('    </div>');
    }

    // Summary cards
    html.push('    <div class="summary">');
    html.push('      <div class="card">');
    html.push(`        <div class="card-value">${data.summary.total}</div>`);
    html.push('        <div class="card-label">Total Issues</div>');
    html.push('      </div>');
    html.push('      <div class="card">');
    html.push(`        <div class="card-value score-${Math.floor(data.metrics.score / 10) * 10}">${data.metrics.score}</div>`);
    html.push('        <div class="card-label">Review Score</div>');
    html.push('      </div>');
    html.push('      <div class="card">');
    html.push(`        <div class="card-value">${Object.keys(data.summary.byFile).length}</div>`);
    html.push('        <div class="card-label">Files Affected</div>');
    html.push('      </div>');
    html.push('    </div>');

    // Severity breakdown
    html.push('    <div class="section">');
    html.push('      <h2>Severity Breakdown</h2>');
    html.push('      <div class="severity-list">');
    for (const [severity, count] of Object.entries(data.summary.bySeverity)) {
      if (count > 0) {
        html.push(`        <div class="severity-item severity-${severity}">`);
        html.push(`          <span class="severity-icon">${this.getSeverityEmoji(severity as Severity)}</span>`);
        html.push(`          <span class="severity-name">${severity}</span>`);
        html.push(`          <span class="severity-count">${count}</span>`);
        html.push('        </div>');
      }
    }
    html.push('      </div>');
    html.push('    </div>');

    // Issues list
    html.push('    <div class="section">');
    html.push('      <h2>Issues</h2>');
    for (const issue of data.issues) {
      html.push('      <div class="issue">');
      html.push(`        <div class="issue-header severity-${issue.severity}">`);
      html.push(`          <span class="issue-icon">${this.getSeverityEmoji(issue.severity)}</span>`);
      html.push(`          <span class="issue-title">${issue.title}</span>`);
      html.push(`          <span class="issue-location">${issue.location.path}:${issue.location.line}</span>`);
      html.push('        </div>');
      html.push(`        <div class="issue-description">${issue.description}</div>`);
      if (issue.suggestion) {
        html.push(`        <div class="issue-suggestion">💡 ${issue.suggestion}</div>`);
      }
      html.push('      </div>');
    }
    html.push('    </div>');

    html.push('  </div>');
    html.push('</body>');
    html.push('</html>');

    return html.join('\n');
  }

  /**
   * Initialize report templates
   */
  private initializeReportTemplates(): void {
    // Summary template
    this.reportTemplates.set('summary', {
      name: 'Summary Report',
      content: `# Code Review Summary

**PR:** #{pr.number} - {pr.title}
**Author:** {pr.author}
**Branch:** {pr.sourceBranch} → {pr.targetBranch}

## Results

- **Total Issues:** {totalIssues}
- **Review Score:** {score}/100

## Severity Breakdown
{#each bySeverity}
- **{key}:** {value}
{/each}

## Recommendations
{#each recommendations}
- {this}
{/each}`,
      variables: ['pr', 'totalIssues', 'bySeverity', 'score', 'recommendations'],
    });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: Severity): string {
    const emojis: Record<Severity, string> = {
      error: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
      hint: '💡',
    };
    return emojis[severity];
  }

  /**
   * Get category emoji
   */
  private getCategoryEmoji(category: Category): string {
    const emojis: Record<Category, string> = {
      security: '🔒',
      performance: '⚡',
      quality: '📊',
      style: '🎨',
      'best-practices': '✨',
      documentation: '📝',
      testing: '🧪',
      maintainability: '🔧',
      complexity: '🧮',
      duplication: '📋',
    };
    return emojis[category];
  }

  /**
   * Get default summary report
   */
  private getDefaultSummaryReport(data: {
    pr: PullRequestInfo;
    totalIssues: number;
    bySeverity: Record<Severity, number>;
    score: number;
    recommendations: string[];
  }): string {
    const sections: string[] = [];

    sections.push('# Code Review Summary\n');
    sections.push(`**PR:** #${data.pr.number} - ${data.pr.title}\n`);
    sections.push(`**Author:** ${data.pr.author}\n`);
    sections.push(`**Review Score:** ${data.score}/100\n`);

    sections.push('\n## Severity Breakdown\n');
    for (const [severity, count] of Object.entries(data.bySeverity)) {
      if (count > 0) {
        sections.push(`- **${severity}:** ${count}\n`);
      }
    }

    if (data.recommendations.length > 0) {
      sections.push('\n## Recommendations\n');
      for (const rec of data.recommendations) {
        sections.push(`- ${rec}\n`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Get HTML styles
   */
  private getHtmlStyles(): string {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  padding: 20px;
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
}

header h1 {
  font-size: 2em;
  margin-bottom: 10px;
}

.timestamp {
  opacity: 0.9;
  font-size: 0.9em;
}

.pr-info {
  padding: 20px 30px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  padding: 30px;
}

.card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.card-value {
  font-size: 3em;
  font-weight: bold;
  margin-bottom: 10px;
}

.card-value.score-0, .card-value.score-10, .card-value.score-20, .card-value.score-30 {
  color: #dc3545;
}

.card-value.score-40, .card-value.score-50, .card-value.score-60 {
  color: #ffc107;
}

.card-value.score-70, .card-value.score-80, .card-value.score-90, .card-value.score-100 {
  color: #28a745;
}

.card-label {
  color: #6c757d;
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.section {
  padding: 30px;
  border-top: 1px solid #e9ecef;
}

.section h2 {
  margin-bottom: 20px;
  color: #495057;
}

.severity-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.severity-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: #f8f9fa;
  border-radius: 20px;
  border: 2px solid #e9ecef;
}

.severity-item.severity-error {
  border-color: #dc3545;
  background: #ffe6e6;
}

.severity-item.severity-warning {
  border-color: #ffc107;
  background: #fff3cd;
}

.severity-item.severity-info {
  border-color: #17a2b8;
  background: #d1ecf1;
}

.severity-count {
  font-weight: bold;
  font-size: 1.2em;
}

.issue {
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: #f8f9fa;
}

.issue-icon {
  font-size: 1.5em;
}

.issue-title {
  flex: 1;
  font-weight: 600;
}

.issue-location {
  color: #6c757d;
  font-size: 0.9em;
  font-family: monospace;
}

.issue-description {
  padding: 15px;
  color: #495057;
}

.issue-suggestion {
  padding: 15px;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  color: #004085;
}

@media (max-width: 768px) {
  .summary {
    grid-template-columns: 1fr;
  }

  .issue-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
    `.trim();
  }
}
