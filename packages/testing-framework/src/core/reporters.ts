import { TestReport, SuiteReport, TestResult, TestStats } from './types';
import { Logger } from './logger';

/**
 * Test reporter interface
 */
export interface TestReporter {
  generate(report: TestReport): Promise<void>;
  generateSuite(suite: SuiteReport): Promise<void>;
}

/**
 * Console reporter implementation
 */
export class ConsoleReporter implements TestReporter {
  private logger: Logger;
  private options: ConsoleReporterOptions;

  constructor(options: ConsoleReporterOptions = {}) {
    this.logger = new Logger({ name: 'ConsoleReporter' });
    this.options = {
      colors: true,
      timestamps: true,
      verbose: false,
      progressBar: true,
      ...options
    };
  }

  async generate(report: TestReport): Promise<void> {
    this.logger.executionSummary(
      report.stats.total,
      report.stats.passed,
      report.stats.failed,
      report.stats.skipped,
      report.duration
    );

    if (this.options.verbose) {
      this.logDetailedResults(report.results);
    }
  }

  async generateSuite(suite: SuiteReport): Promise<void> {
    this.logger.suiteComplete(suite.suite, suite.duration, suite.stats);
  }

  /**
   * Log detailed test results
   */
  private logDetailedResults(results: TestResult[]): void {
    for (const result of results) {
      const status = result.status === 'pass' ? '✓' : '✗';
      const duration = result.duration > 1000 ? `${(result.duration / 1000).toFixed(2)}s` : `${result.duration}ms`;

      if (this.options.timestamps) {
        const timestamp = new Date(result.startTime).toISOString();
        console.log(`${timestamp} [${status}] ${result.test} - ${duration}`);
      } else {
        console.log(`${status} ${result.test} - ${duration}`);
      }

      if (result.error) {
        console.log(`  Error: ${result.error.message}`);
        if (result.error.stack) {
          console.log(`  Stack: ${result.error.stack}`);
        }
      }

      if (result.assertions && this.options.verbose) {
        const failedAssertions = result.assertions.filter(a => a.status === 'fail');
        if (failedAssertions.length > 0) {
          console.log(`  Failed assertions: ${failedAssertions.length}`);
          failedAssertions.forEach(assertion => {
            console.log(`    - ${assertion.message}`);
          });
        }
      }
    }
  }
}

/**
 * JSON reporter implementation
 */
export class JsonReporter implements TestReporter {
  private output: string;
  private options: JsonReporterOptions;

  constructor(output: string = 'test-results/report.json', options: JsonReporterOptions = {}) {
    this.output = output;
    this.options = {
      pretty: true,
      includeLogs: false,
      includeCoverage: true,
      ...options
    };
  }

  async generate(report: TestReport): Promise<void> {
    const jsonReport = this.buildJsonReport(report);

    import('fs').then(fs => {
      const content = this.options.pretty ? JSON.stringify(jsonReport, null, 2) : JSON.stringify(jsonReport);
      fs.writeFileSync(this.output, content);
    });
  }

  async generateSuite(suite: SuiteReport): Promise<void> {
    const jsonSuite = {
      suite: suite.suite,
      stats: suite.stats,
      results: suite.results,
      duration: suite.duration,
      timestamp: suite.timestamp
    };

    import('fs').then(fs => {
      const content = this.options.pretty ? JSON.stringify(jsonSuite, null, 2) : JSON.stringify(jsonSuite);
      const suiteOutput = this.output.replace('.json', `-${suite.suite}.json`);
      fs.writeFileSync(suiteOutput, content);
    });
  }

  /**
   * Build JSON report object
   */
  private buildJsonReport(report: TestReport): any {
    return {
      stats: report.stats,
      results: report.results,
      duration: report.duration,
      environment: report.environment,
      timestamp: report.timestamp,
      ...this.options.includeCoverage && {
        coverage: report.results[0]?.coverage || null
      }
    };
  }
}

/**
 * JUnit reporter implementation
 */
export class JUnitReporter implements TestReporter {
  private output: string;
  private options: JUnitReporterOptions;

  constructor(output: string = 'test-results/junit.xml', options: JUnitReporterOptions = {}) {
    this.output = output;
    this.options = {
      timestampFormat: 'yyyy-MM-dd HH:mm:ss',
      includeSuiteName: true,
      includeTimestamps: true,
      ...options
    };
  }

  async generate(report: TestReport): Promise<void> {
    const xml = this.generateJUnitXml(report);

    import('fs').then(fs => {
      fs.writeFileSync(this.output, xml);
    });
  }

  async generateSuite(suite: SuiteReport): Promise<void> {
    const xml = this.generateJUnitXml(suite);

    import('fs').then(fs => {
      const suiteOutput = this.output.replace('.xml', `-${suite.suite}.xml`);
      fs.writeFileSync(suiteOutput, xml);
    });
  }

  /**
   * Generate JUnit XML
   */
  private generateJUnitXml(report: TestReport | SuiteReport): string {
    const isSuite = 'suite' in report;
    const timestamp = new Date(report.timestamp).toISOString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites>\n`;

    if (isSuite) {
      const suite = report as SuiteReport;
      xml += `  <testsuite name="${suite.suite}" tests="${suite.stats.total}" failures="${suite.stats.failed}" errors="${suite.stats.error}" skipped="${suite.stats.skipped}" time="${(suite.duration / 1000).toFixed(3)}">\n`;

      for (const result of suite.results) {
        xml += this.generateTestCaseXml(result, timestamp);
      }
    } else {
      const testReport = report as TestReport;
      xml += `  <testsuite name="all-tests" tests="${testReport.stats.total}" failures="${testReport.stats.failed}" errors="${testReport.stats.error}" skipped="${testReport.stats.skipped}" time="${(testReport.duration / 1000).toFixed(3)}">\n`;

      for (const result of testReport.results) {
        xml += this.generateTestCaseXml(result, timestamp);
      }
    }

    xml += `</testsuites>\n`;
    return xml;
  }

  /**
   * Generate test case XML
   */
  private generateTestCaseXml(result: TestResult, timestamp: string): string {
    const className = result.suite;
    const testName = result.test;
    const duration = (result.duration / 1000).toFixed(3);

    let xml = `    <testcase classname="${className}" name="${testName}" time="${duration}">\n`;

    if (result.status === 'fail' && result.error) {
      xml += `      <failure message="${this.escapeXml(result.error.message)}">${this.escapeXml(result.error.stack || '')}</failure>\n`;
    }

    if (result.status === 'error' && result.error) {
      xml += `      <error message="${this.escapeXml(result.error.message)}">${this.escapeXml(result.error.stack || '')}</error>\n`;
    }

    if (result.status === 'skipped') {
      xml += `      <skipped/>\n`;
    }

    xml += `    </testcase>\n`;
    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

/**
 * HTML reporter implementation
 */
export class HtmlReporter implements TestReporter {
  private output: string;
  private options: HtmlReporterOptions;

  constructor(output: string = 'test-results/report.html', options: HtmlReporterOptions = {}) {
    this.output = output;
    this.options = {
      theme: 'light',
      includeCharts: true,
      includeCoverage: true,
      customCss: '',
      ...options
    };
  }

  async generate(report: TestReport): Promise<void> {
    const html = this.generateHtmlReport(report);

    import('fs').then(fs => {
      fs.writeFileSync(this.output, html);
    });
  }

  async generateSuite(suite: SuiteReport): Promise<void> {
    const html = this.generateHtmlReport(suite);

    import('fs').then(fs => {
      const suiteOutput = this.output.replace('.html', `-${suite.suite}.html`);
      fs.writeFileSync(suiteOutput, html);
    });
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: TestReport | SuiteReport): string {
    const isSuite = 'suite' in report;
    const stats = isSuite ? (report as SuiteReport).stats : (report as TestReport).stats;
    const results = isSuite ? (report as SuiteReport).results : (report as TestReport).results;
    const duration = isSuite ? (report as SuiteReport).duration : (report as TestReport).duration;

    const timestamp = new Date(report.timestamp).toISOString();
    const passRate = (stats.passed / stats.total * 100).toFixed(1);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report</title>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Test Report</h1>
            <div class="stats">
                <div class="stat">
                    <span class="stat-value">${stats.total}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat ${this.getStatusClass(stats.passed, stats.total)}">
                    <span class="stat-value">${stats.passed}</span>
                    <span class="stat-label">Passed</span>
                </div>
                <div class="stat fail">
                    <span class="stat-value">${stats.failed}</span>
                    <span class="stat-label">Failed</span>
                </div>
                <div class="stat error">
                    <span class="stat-value">${stats.error}</span>
                    <span class="stat-label">Error</span>
                </div>
                <div class="stat skipped">
                    <span class="stat-value">${stats.skipped}</span>
                    <span class="stat-label">Skipped</span>
                </div>
            </div>
            <div class="info">
                <span>Duration: ${(duration / 1000).toFixed(2)}s</span>
                <span>Pass Rate: ${passRate}%</span>
                <span>Generated: ${timestamp}</span>
            </div>
        </header>

        <main>
            ${this.generateCharts(stats)}
            ${this.generateResultsTable(results)}
        </main>
    </div>
    <script>
        ${this.generateJavaScript()}
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: ${this.options.theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
            color: ${this.options.theme === 'dark' ? '#ffffff' : '#333333'};
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: ${this.options.theme === 'dark' ? '#2d2d2d' : '#ffffff'};
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 30px;
        }

        header {
            border-bottom: 2px solid ${this.options.theme === 'dark' ? '#444' : '#e0e0e0'};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        h1 {
            margin: 0;
            color: ${this.options.theme === 'dark' ? '#ffffff' : '#333333'};
        }

        .stats {
            display: flex;
            gap: 20px;
            margin: 20px 0;
            flex-wrap: wrap;
        }

        .stat {
            background-color: ${this.options.theme === 'dark' ? '#3a3a3a' : '#f0f0f0'};
            padding: 15px 20px;
            border-radius: 6px;
            text-align: center;
            min-width: 100px;
        }

        .stat-value {
            display: block;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .stat-label {
            font-size: 14px;
            color: ${this.options.theme === 'dark' ? '#cccccc' : '#666666'};
        }

        .stat.pass {
            background-color: ${this.options.theme === 'dark' ? '#2d5a2d' : '#e8f5e8'};
        }

        .stat.fail {
            background-color: ${this.options.theme === 'dark' ? '#5a2d2d' : '#f5e8e8'};
        }

        .stat.error {
            background-color: ${this.options.theme === 'dark' ? '#5a5a2d' : '#f8f0e8'};
        }

        .stat.skipped {
            background-color: ${this.options.theme === 'dark' ? '#3a3a3a' : '#f0f0f0'};
        }

        .info {
            display: flex;
            gap: 20px;
            font-size: 14px;
            color: ${this.options.theme === 'dark' ? '#cccccc' : '#666666'};
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid ${this.options.theme === 'dark' ? '#444' : '#e0e0e0'};
        }

        th {
            background-color: ${this.options.theme === 'dark' ? '#3a3a3a' : '#f0f0f0'};
            font-weight: 600;
            color: ${this.options.theme === 'dark' ? '#ffffff' : '#333333'};
        }

        tr:hover {
            background-color: ${this.options.theme === 'dark' ? '#333333' : '#f8f8f8'};
        }

        .status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .status.pass {
            background-color: #4caf50;
            color: white;
        }

        .status.fail {
            background-color: #f44336;
            color: white;
        }

        .status.error {
            background-color: #ff9800;
            color: white;
        }

        .status.skipped {
            background-color: #9e9e9e;
            color: white;
        }

        .duration {
            font-family: 'Courier New', monospace;
            color: ${this.options.theme === 'dark' ? '#cccccc' : '#666666'};
        }

        .error-message {
            color: #f44336;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-width: 600px;
            overflow-x: auto;
        }

        ${this.options.customCss}
    `;
  }

  /**
   * Generate charts HTML
   */
  private generateCharts(stats: TestStats): string {
    if (!this.options.includeCharts) {
      return '';
    }

    const passed = stats.passed;
    const failed = stats.failed;
    const skipped = stats.skipped;
    const error = stats.error;

    return `
    <div class="charts">
        <div class="chart-container">
            <canvas id="pieChart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="barChart"></canvas>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    `;
  }

  /**
   * Generate results table
   */
  private generateResultsTable(results: TestResult[]): string {
    let table = `
    <table>
        <thead>
            <tr>
                <th>Test</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Suite</th>
                <th>Error</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (const result of results) {
      const statusClass = result.status;
      const duration = result.duration > 1000 ? `${(result.duration / 1000).toFixed(2)}s` : `${result.duration}ms`;
      const errorMessage = result.error ? `<div class="error-message">${result.error.message}</div>` : '';

      table += `
        <tr>
            <td>${result.test}</td>
            <td><span class="status ${statusClass}">${result.status}</span></td>
            <td class="duration">${duration}</td>
            <td>${result.suite}</td>
            <td>${errorMessage}</td>
        </tr>
      `;
    }

    table += `
        </tbody>
    </table>
    `;

    return table;
  }

  /**
   * Get status class for styling
   */
  private getStatusClass(value: number, total: number): string {
    const percentage = (value / total) * 100;
    if (percentage >= 90) return 'pass';
    if (percentage >= 70) return 'warn';
    return 'fail';
  }

  /**
   * Generate JavaScript for charts
   */
  private generateJavaScript(): string {
    return `
        // Initialize charts
        const ctx1 = document.getElementById('pieChart');
        const ctx2 = document.getElementById('barChart');

        if (ctx1) {
            new Chart(ctx1, {
                type: 'pie',
                data: {
                    labels: ['Passed', 'Failed', 'Error', 'Skipped'],
                    datasets: [{
                        data: [${stats.passed}, ${stats.failed}, ${stats.error}, ${stats.skipped}],
                        backgroundColor: ['#4caf50', '#f44336', '#ff9800', '#9e9e9e']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        if (ctx2) {
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: ['Passed', 'Failed', 'Error', 'Skipped'],
                    datasets: [{
                        label: 'Test Results',
                        data: [${stats.passed}, ${stats.failed}, ${stats.error}, ${stats.skipped}],
                        backgroundColor: ['#4caf50', '#f44336', '#ff9800', '#9e9e9e']
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    `;
  }
}

/**
 * Reporter option interfaces
 */
export interface ConsoleReporterOptions {
  colors?: boolean;
  timestamps?: boolean;
  verbose?: boolean;
  progressBar?: boolean;
}

export interface JsonReporterOptions {
  pretty?: boolean;
  includeLogs?: boolean;
  includeCoverage?: boolean;
}

export interface JUnitReporterOptions {
  timestampFormat?: string;
  includeSuiteName?: boolean;
  includeTimestamps?: boolean;
}

export interface HtmlReporterOptions {
  theme?: 'light' | 'dark';
  includeCharts?: boolean;
  includeCoverage?: boolean;
  customCss?: string;
}