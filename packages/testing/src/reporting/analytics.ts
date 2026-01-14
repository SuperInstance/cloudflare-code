/**
 * Test Reporting - Analytics, reports, and CI/CD integration
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type {
  Reporter,
  TestMetadata,
  TestResult,
  SuiteMetadata,
  SuiteResult,
  RunResult,
  TestError,
  CIConfig,
  CIIntegration,
} from '../types/index.js';

// ============================================================================
// Console Reporter
// ============================================================================

export class ConsoleReporter implements Reporter {
  name = 'console';

  private indent = 0;

  onTestStart(metadata: TestMetadata): void {
    const indent = '  '.repeat(this.indent);
    console.log(`${indent}◐ ${metadata.name}`);
  }

  onTestResult(result: TestResult): void {
    const indent = '  '.repeat(this.indent);

    switch (result.status) {
      case 'passed':
        console.log(`${indent}✔ ${result.metadata.name} (${result.duration.elapsed}ms)`);
        break;
      case 'failed':
        console.log(`${indent}✖ ${result.metadata.name} (${result.duration.elapsed}ms)`);
        if (result.error) {
          console.log(`${indent}  ${result.error.message}`);
        }
        break;
      case 'skipped':
        console.log(`${indent}⊝ ${result.metadata.name}`);
        break;
      case 'flaky':
        console.log(`${indent}⚠ ${result.metadata.name} (${result.duration.elapsed}ms) - FLAKY (${result.attempts} attempts)`);
        break;
    }
  }

  onSuiteStart(metadata: SuiteMetadata): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 ${metadata.name}`);
    console.log(`${'='.repeat(60)}`);
    this.indent++;
  }

  onSuiteResult(result: SuiteResult): void {
    this.indent--;
  }

  onRunStart(suites: SuiteMetadata[]): void {
    console.log('\n🚀 Starting test run...');
    console.log(`Found ${suites.length} test suite(s)\n`);
  }

  onRunEnd(results: RunResult): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Test Results');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total:  ${results.stats.total}`);
    console.log(`Passed: ${results.stats.passed} ✓`);
    console.log(`Failed: ${results.stats.failed} ✖`);
    console.log(`Skipped: ${results.stats.skipped} ⊝`);
    if (results.stats.flaky > 0) {
      console.log(`Flaky: ${results.stats.flaky} ⚠`);
    }
    console.log(`Duration: ${results.duration.elapsed}ms`);
    console.log(`${'='.repeat(60)}\n`);
  }

  onError(error: Error): void {
    console.error('Error:', error.message);
  }
}

// ============================================================================
// HTML Reporter
// ============================================================================>

export class HTMLReporter implements Reporter {
  name = 'html';
  private results: RunResult | null = null;

  constructor(private outputDir: string = './test-results') {}

  async onRunEnd(results: RunResult): Promise<void> {
    this.results = results;

    // Ensure output directory exists
    await mkdir(this.outputDir, { recursive: true });

    // Generate HTML report
    const html = this.generateHTML(results);
    const outputPath = join(this.outputDir, 'index.html');
    await writeFile(outputPath, html, 'utf-8');

    console.log(`\n📄 HTML report generated: ${outputPath}`);
  }

  private generateHTML(results: RunResult): string {
    const stats = results.stats;
    const passRate = ((stats.passed / stats.total) * 100).toFixed(1);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ClaudeFlare</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .header .timestamp {
      color: #666;
      font-size: 14px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stat-card .label {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }

    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
    }

    .stat-card.passed .value { color: #10b981; }
    .stat-card.failed .value { color: #ef4444; }
    .stat-card.skipped .value { color: #f59e0b; }
    .stat-card.duration .value { color: #6366f1; }

    .progress-bar {
      background: #e5e7eb;
      height: 30px;
      border-radius: 15px;
      overflow: hidden;
      display: flex;
      margin-bottom: 20px;
    }

    .progress-bar .passed {
      background: #10b981;
    }

    .progress-bar .failed {
      background: #ef4444;
    }

    .progress-bar .skipped {
      background: #f59e0b;
    }

    .suite {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }

    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e5e7eb;
    }

    .suite-header h2 {
      font-size: 20px;
    }

    .suite-status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }

    .suite-status.passed {
      background: #d1fae5;
      color: #065f46;
    }

    .suite-status.failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .test {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .test.passed {
      background: #f0fdf4;
      border-left: 3px solid #10b981;
    }

    .test.failed {
      background: #fef2f2;
      border-left: 3px solid #ef4444;
    }

    .test.skipped {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
    }

    .test.flaky {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
    }

    .test-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .test-icon {
      font-size: 18px;
    }

    .test-name {
      font-weight: 500;
    }

    .test-duration {
      font-size: 14px;
      color: #666;
    }

    .test-error {
      margin-top: 10px;
      padding: 10px;
      background: #fef2f2;
      border-radius: 4px;
      font-size: 14px;
      color: #991b1b;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge.flaky {
      background: #fef3c7;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Test Report</h1>
      <p class="timestamp">Generated: ${new Date().toISOString()}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card passed">
        <div class="label">Passed</div>
        <div class="value">${stats.passed}</div>
      </div>
      <div class="stat-card failed">
        <div class="label">Failed</div>
        <div class="value">${stats.failed}</div>
      </div>
      <div class="stat-card skipped">
        <div class="label">Skipped</div>
        <div class="value">${stats.skipped}</div>
      </div>
      <div class="stat-card duration">
        <div class="label">Duration</div>
        <div class="value">${results.duration.elapsed}ms</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="passed" style="width: ${passRate}%"></div>
      ${stats.failed > 0 ? `<div class="failed" style="width: ${((stats.failed / stats.total) * 100).toFixed(1)}%"></div>` : ''}
      ${stats.skipped > 0 ? `<div class="skipped" style="width: ${((stats.skipped / stats.total) * 100).toFixed(1)}%"></div>` : ''}
    </div>

    ${results.suites.map(suite => this.generateSuiteHTML(suite)).join('')}
  </div>
</body>
</html>`;
  }

  private generateSuiteHTML(suite: SuiteResult): string {
    const statusClass = suite.status;
    const failedTests = suite.tests.filter(t => t.status === 'failed');

    return `
    <div class="suite">
      <div class="suite-header">
        <h2>${suite.metadata.name}</h2>
        <span class="suite-status ${statusClass}">${suite.status.toUpperCase()}</span>
      </div>
      ${suite.tests.map(test => this.generateTestHTML(test)).join('')}
    </div>`;
  }

  private generateTestHTML(test: TestResult): string {
    const statusClass = test.status;
    const icon = test.status === 'passed' ? '✔' : test.status === 'failed' ? '✖' : test.status === 'skipped' ? '⊝' : '⚠';

    return `
    <div class="test ${statusClass}">
      <div class="test-info">
        <span class="test-icon">${icon}</span>
        <span class="test-name">${test.metadata.name}</span>
        ${test.flaky ? '<span class="badge flaky">FLAKY</span>' : ''}
      </div>
      <span class="test-duration">${test.duration.elapsed}ms</span>
      ${test.error ? `<div class="test-error">${test.error.message}</div>` : ''}
    </div>`;
  }
}

// ============================================================================
// JUnit XML Reporter
// ============================================================================

export class JUnitReporter implements Reporter {
  name = 'junit';

  constructor(private outputDir: string = './test-results') {}

  async onRunEnd(results: RunResult): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });

    const xml = this.generateJUnitXML(results);
    const outputPath = join(this.outputDir, 'junit.xml');
    await writeFile(outputPath, xml, 'utf-8');

    console.log(`📄 JUnit XML report generated: ${outputPath}`);
  }

  private generateJUnitXML(results: RunResult): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="ClaudeFlare Tests" tests="${results.stats.total}" failures="${results.stats.failed}" skipped="${results.stats.skipped}" time="${(results.duration.elapsed / 1000).toFixed(3)}">\n`;

    for (const suite of results.suites) {
      const suiteTime = suite.tests.reduce((sum, t) => sum + t.duration.elapsed, 0) / 1000;

      xml += `  <testsuite name="${this.escapeXML(suite.metadata.name)}" tests="${suite.tests.length}" failures="${suite.tests.filter(t => t.status === 'failed').length}" skipped="${suite.tests.filter(t => t.status === 'skipped').length}" time="${suiteTime.toFixed(3)}">\n`;

      for (const test of suite.tests) {
        const testTime = test.duration.elapsed / 1000;

        xml += `    <testcase name="${this.escapeXML(test.metadata.name classname="${this.escapeXML(test.metadata.fullName)}" time="${testTime.toFixed(3)}"`;

        if (test.status === 'skipped') {
          xml += '>\n';
          xml += '      <skipped/>\n';
          xml += '    </testcase>\n';
        } else if (test.status === 'failed' && test.error) {
          xml += '>\n';
          xml += `      <failure message="${this.escapeXML(test.error.message)}">\n`;
          if (test.error.stack) {
            xml += `        ${this.escapeXML(test.error.stack)}\n`;
          }
          xml += '      </failure>\n';
          xml += '    </testcase>\n';
        } else {
          xml += '/>\n';
        }
      }

      xml += '  </testsuite>\n';
    }

    xml += '</testsuites>';
    return xml;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// ============================================================================
// Coverage Reporter
// ============================================================================

export interface CoverageData {
  files: Record<string, {
    lines: { covered: number; total: number };
    branches: { covered: number; total: number };
    functions: { covered: number; total: number };
    statements: { covered: number; total: number };
  }>;
}

export class CoverageReporter implements Reporter {
  name = 'coverage';
  private coverage: CoverageData = { files: {} };

  constructor(private outputDir: string = './coverage') {}

  setCoverage(coverage: CoverageData): void {
    this.coverage = coverage;
  }

  async onRunEnd(results: RunResult): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });

    const totals = this.calculateTotals();
    const summary = this.generateSummary(totals);
    const lcov = this.generateLCOV();

    await writeFile(join(this.outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
    await writeFile(join(this.outputDir, 'lcov.info'), lcov);

    console.log(`📄 Coverage reports generated in ${this.outputDir}`);
  }

  private calculateTotals(): {
    lines: { covered: number; total: number; percentage: number };
    branches: { covered: number; total: number; percentage: number };
    functions: { covered: number; total: number; percentage: number };
    statements: { covered: number; total: number; percentage: number };
  } {
    let linesCovered = 0;
    let linesTotal = 0;
    let branchesCovered = 0;
    let branchesTotal = 0;
    let functionsCovered = 0;
    let functionsTotal = 0;
    let statementsCovered = 0;
    let statementsTotal = 0;

    for (const file of Object.values(this.coverage.files)) {
      linesCovered += file.lines.covered;
      linesTotal += file.lines.total;
      branchesCovered += file.branches.covered;
      branchesTotal += file.branches.total;
      functionsCovered += file.functions.covered;
      functionsTotal += file.functions.total;
      statementsCovered += file.statements.covered;
      statementsTotal += file.statements.total;
    }

    return {
      lines: {
        covered: linesCovered,
        total: linesTotal,
        percentage: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0,
      },
      branches: {
        covered: branchesCovered,
        total: branchesTotal,
        percentage: branchesTotal > 0 ? (branchesCovered / branchesTotal) * 100 : 0,
      },
      functions: {
        covered: functionsCovered,
        total: functionsTotal,
        percentage: functionsTotal > 0 ? (functionsCovered / functionsTotal) * 100 : 0,
      },
      statements: {
        covered: statementsCovered,
        total: statementsTotal,
        percentage: statementsTotal > 0 ? (statementsCovered / statementsTotal) * 100 : 0,
      },
    };
  }

  private generateSummary(totals: ReturnType<CoverageReporter['calculateTotals']>): Record<string, unknown> {
    return {
      total: {
        lines: { pct: totals.lines.percentage },
        branches: { pct: totals.branches.percentage },
        functions: { pct: totals.functions.percentage },
        statements: { pct: totals.statements.percentage },
      },
    };
  }

  private generateLCOV(): string {
    let lcov = '';

    for (const [filePath, file] of Object.entries(this.coverage.files)) {
      lcov += `SF:${filePath}\n`;

      // Add line coverage
      for (let i = 1; i <= file.lines.total; i++) {
        lcov += `DA:${i},${i <= file.lines.covered ? '1' : '0'}\n`;
      }

      lcov += `LF:${file.lines.total}\n`;
      lcov += `LH:${file.lines.covered}\n`;
      lcov += `end_of_record\n`;
    }

    return lcov;
  }
}

// ============================================================================
// Flaky Test Detector
// ============================================================================

export interface FlakyTestHistory {
  testName: string;
  runs: Array<{
    timestamp: number;
    status: string;
    attempts: number;
    duration: number;
  }>;
}

export class FlakyTestDetector implements Reporter {
  name = 'flaky-detector';
  private history = new Map<string, FlakyTestHistory>();
  private historyFile = './test-results/flaky-history.json';

  constructor() {}

  async init(): Promise<void> {
    try {
      const data = await readFile(this.historyFile, 'utf-8');
      const parsed = JSON.parse(data);
      for (const [testName, history] of Object.entries(parsed)) {
        this.history.set(testName, history as FlakyTestHistory);
      }
    } catch {
      // No history file exists yet
    }
  }

  onTestResult(result: TestResult): void {
    const testId = result.metadata.fullName;

    if (!this.history.has(testId)) {
      this.history.set(testId, {
        testName: testId,
        runs: [],
      });
    }

    const history = this.history.get(testId)!;
    history.runs.push({
      timestamp: Date.now(),
      status: result.status,
      attempts: result.attempts,
      duration: result.duration.elapsed,
    });

    // Keep only last 100 runs
    if (history.runs.length > 100) {
      history.runs = history.runs.slice(-100);
    }
  }

  async onRunEnd(results: RunResult): Promise<void> {
    await this.saveHistory();
    this.reportFlakyTests();
  }

  private async saveHistory(): Promise<void> {
    const data = Object.fromEntries(this.history);
    await writeFile(this.historyFile, JSON.stringify(data, null, 2));
  }

  private reportFlakyTests(): void {
    const flakyTests: Array<{
      testName: string;
      totalRuns: number;
      flakyRuns: number;
      flakyRate: number;
      avgAttempts: number;
    }> = [];

    for (const [testId, history] of this.history) {
      const flakyRuns = history.runs.filter(r => r.attempts > 1);
      if (flakyRuns.length > 0) {
        const avgAttempts =
          flakyRuns.reduce((sum, r) => sum + r.attempts, 0) / flakyRuns.length;

        flakyTests.push({
          testName: testId,
          totalRuns: history.runs.length,
          flakyRuns: flakyRuns.length,
          flakyRate: (flakyRuns.length / history.runs.length) * 100,
          avgAttempts,
        });
      }
    }

    if (flakyTests.length > 0) {
      console.log('\n⚠ Flaky Tests Detected:');
      console.log('='.repeat(60));

      for (const test of flakyTests.sort((a, b) => b.flakyRate - a.flakyRate)) {
        console.log(`\n${test.testName}`);
        console.log(`  Flaky Rate: ${test.flakyRate.toFixed(1)}%`);
        console.log(`  Avg Attempts: ${test.avgAttempts.toFixed(2)}`);
      }

      console.log('\n' + '='.repeat(60));
    }
  }

  getFlakyTests(): FlakyTestHistory[] {
    return Array.from(this.history.values()).filter(h =>
      h.runs.some(r => r.attempts > 1)
    );
  }
}

// ============================================================================
// Trend Analysis
// ============================================================================

export interface TrendData {
  timestamp: number;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export class TrendAnalyzer implements Reporter {
  name = 'trend-analyzer';
  private trends: TrendData[] = [];
  private trendsFile = './test-results/trends.json';

  async init(): Promise<void> {
    try {
      const data = await readFile(this.trendsFile, 'utf-8');
      this.trends = JSON.parse(data);
    } catch {
      // No trends file exists yet
    }
  }

  async onRunEnd(results: RunResult): Promise<void> {
    const trend: TrendData = {
      timestamp: Date.now(),
      duration: results.duration.elapsed,
      total: results.stats.total,
      passed: results.stats.passed,
      failed: results.stats.failed,
      skipped: results.stats.skipped,
    };

    this.trends.push(trend);

    // Keep only last 100 runs
    if (this.trends.length > 100) {
      this.trends = this.trends.slice(-100);
    }

    await this.saveTrends();
    this.reportTrends();
  }

  private async saveTrends(): Promise<void> {
    await writeFile(this.trendsFile, JSON.stringify(this.trends, null, 2));
  }

  private reportTrends(): void {
    if (this.trends.length < 2) {
      return;
    }

    const latest = this.trends[this.trends.length - 1];
    const previous = this.trends[this.trends.length - 2];

    console.log('\n📈 Trend Analysis:');
    console.log('='.repeat(60));

    const durationChange = ((latest.duration - previous.duration) / previous.duration) * 100;
    const failedChange = latest.failed - previous.failed;
    const passRateChange =
      ((latest.passed / latest.total) - (previous.passed / previous.total)) * 100;

    console.log(`Duration: ${durationChange >= 0 ? '+' : ''}${durationChange.toFixed(1)}%`);
    console.log(`Failed: ${failedChange >= 0 ? '+' : ''}${failedChange}`);
    console.log(`Pass Rate: ${passRateChange >= 0 ? '+' : ''}${passRateChange.toFixed(1)}%`);

    console.log('='.repeat(60));
  }

  getTrends(): TrendData[] {
    return [...this.trends];
  }
}

// ============================================================================
// CI/CD Integration
// ============================================================================

export class GitHubIntegration implements CIIntegration {
  detect(): boolean {
    return !!process.env.GITHUB_ACTIONS;
  }

  getConfig(): CIConfig | null {
    if (!this.detect()) {
      return null;
    }

    return {
      provider: 'github',
      token: process.env.GITHUB_TOKEN,
      apiUrl: process.env.GITHUB_API_URL,
      runId: process.env.GITHUB_RUN_ID,
      jobId: process.env.GITHUB_JOB,
    };
  }

  async uploadResults(results: RunResult): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      return;
    }

    // In production, you would use GitHub Actions API to upload results
    console.log('GitHub Actions detected. Results will be available in the Actions log.');
  }

  async uploadCoverage(coverage: unknown): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      return;
    }

    // In production, you would use a service like Codecov or Coveralls
    console.log('GitHub Actions detected. Consider integrating with Codecov for coverage reporting.');
  }

  async commentOnPR(comment: string): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      return;
    }

    // In production, you would use GitHub API to comment on PR
    console.log('PR comment would be posted:', comment);
  }
}

// ============================================================================
// Reporter Factory
// ============================================================================

export function createReporter(type: 'console' | 'html' | 'junit' | 'coverage' | 'flaky' | 'trend', options?: any): Reporter {
  switch (type) {
    case 'console':
      return new ConsoleReporter();
    case 'html':
      return new HTMLReporter(options?.outputDir);
    case 'junit':
      return new JUnitReporter(options?.outputDir);
    case 'coverage':
      return new CoverageReporter(options?.outputDir);
    case 'flaky':
      return new FlakyTestDetector();
    case 'trend':
      return new TrendAnalyzer();
    default:
      throw new Error(`Unknown reporter type: ${type}`);
  }
}

export function createCIIntegration(): CIIntegration | null {
  const github = new GitHubIntegration();
  if (github.detect()) {
    return github;
  }

  // Add more CI providers as needed
  return null;
}

// Helper function for reading files
async function readFile(path: string, encoding: BufferEncoding): Promise<string> {
  const { readFile: rf } = await import('fs/promises');
  return rf(path, encoding);
}
