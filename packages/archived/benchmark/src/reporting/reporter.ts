/**
 * Performance Reporter
 * Multiple output format support (HTML, JSON, Markdown, CSV)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import stringify from 'csv-stringify/sync';
import type {
  ReportConfig,
  ReportData,
  GeneratedReport,
  BenchmarkSuite,
  ComparisonReport
} from '../types/index.js';
import { formatNanoseconds, formatOpsPerSecond, formatBytes } from '../utils/system.js';

/**
 * Performance reporter for generating benchmark reports
 */
export class PerformanceReporter {
  private config: ReportConfig;

  constructor(config: ReportConfig) {
    this.config = config;
  }

  /**
   * Generate reports in configured formats
   */
  async generate(data: ReportData): Promise<GeneratedReport> {
    const reports: GeneratedReport = {
      files: [],
      format: this.config.format.join(','),
      generatedAt: Date.now(),
      size: 0
    };

    // Ensure output directory exists
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Generate reports in each configured format
    for (const format of this.config.format) {
      switch (format) {
        case 'json':
          reports.files.push(...await this.generateJsonReport(data));
          break;
        case 'html':
          reports.files.push(...await this.generateHtmlReport(data));
          break;
        case 'markdown':
          reports.files.push(...await this.generateMarkdownReport(data));
          break;
        case 'csv':
          reports.files.push(...await this.generateCsvReport(data));
          break;
      }
    }

    // Calculate total size
    reports.size = reports.files.reduce((sum, file) => {
      if (existsSync(file)) {
        const stats = require('fs').statSync(file);
        return sum + stats.size;
      }
      return sum;
    }, 0);

    return reports;
  }

  /**
   * Generate JSON report
   */
  private async generateJsonReport(data: ReportData): Promise<string[]> {
    const files: string[] = [];

    // Main report
    const mainReport = join(this.config.outputDir, `${this.config.name || 'report'}.json`);
    writeFileSync(mainReport, JSON.stringify(data, null, 2));
    files.push(mainReport);

    // Comparison report if available
    if (this.config.includeComparison && data.comparison) {
      const comparisonReport = join(this.config.outputDir, 'comparison.json');
      writeFileSync(comparisonReport, JSON.stringify(data.comparison, null, 2));
      files.push(comparisonReport);
    }

    return files;
  }

  /**
   * Generate HTML report
   */
  private async generateHtmlReport(data: ReportData): Promise<string[]> {
    const files: string[] = [];
    const htmlReport = join(this.config.outputDir, `${this.config.name || 'report'}.html`);

    const html = this.generateHtmlContent(data);
    writeFileSync(htmlReport, html);
    files.push(htmlReport);

    return files;
  }

  /**
   * Generate HTML content
   */
  private generateHtmlContent(data: ReportData): string {
    const theme = this.config.theme || 'light';
    const customCss = this.config.customCss || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.suite.name} - Benchmark Report</title>
    <style>
        ${this.getHtmlStyles(theme, customCss)}
    </style>
</head>
<body class="${theme}">
    <div class="container">
        <header>
            <h1>${data.suite.name}</h1>
            <p class="timestamp">Generated: ${new Date().toISOString()}</p>
        </header>

        ${this.generateSummarySection(data.suite)}

        ${this.generateResultsSection(data.suite)}

        ${this.config.includeComparison && data.comparison ? this.generateComparisonSection(data.comparison) : ''}

        ${this.generateMetadataSection(data.suite)}
    </div>

    <script>
        ${this.getHtmlScripts()}
    </script>
</body>
</html>`;
  }

  /**
   * Get HTML styles
   */
  private getHtmlStyles(theme: string, customCss: string): string {
    const baseStyles = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        h1 {
            color: #007bff;
            margin-bottom: 10px;
        }

        h2 {
            color: #007bff;
            margin-top: 30px;
            margin-bottom: 15px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }

        h3 {
            color: #555;
            margin-top: 20px;
            margin-bottom: 10px;
        }

        .timestamp {
            color: #666;
            font-size: 0.9em;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }

        .summary-card label {
            display: block;
            font-size: 0.85em;
            color: #666;
            margin-bottom: 5px;
        }

        .summary-card .value {
            font-size: 1.5em;
            font-weight: bold;
            color: #007bff;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
        }

        tr:hover {
            background: #f8f9fa;
        }

        .status-success {
            color: #28a745;
        }

        .status-failed {
            color: #dc3545;
        }

        .status-improved {
            color: #28a745;
        }

        .status-regressed {
            color: #dc3545;
        }

        .status-no-change {
            color: #6c757d;
        }

        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }

        .badge-success {
            background: #d4edda;
            color: #155724;
        }

        .badge-danger {
            background: #f8d7da;
            color: #721c24;
        }

        .badge-warning {
            background: #fff3cd;
            color: #856404;
        }

        .chart {
            margin: 20px 0;
        }

        .metadata {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }

        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }

        .metadata-item label {
            display: block;
            font-size: 0.85em;
            color: #666;
            margin-bottom: 5px;
        }

        .dark body {
            background: #1e1e1e;
            color: #e0e0e0;
        }

        .dark header {
            border-bottom-color: #4a9eff;
        }

        .dark h1, .dark h2 {
            color: #4a9eff;
        }

        .dark .summary-card {
            background: #2d2d2d;
            border-left-color: #4a9eff;
        }

        .dark th {
            background: #2d2d2d;
        }

        .dark tr:hover {
            background: #2d2d2d;
        }

        .dark .metadata {
            background: #2d2d2d;
        }
    `;

    return baseStyles + customCss;
  }

  /**
   * Get HTML scripts
   */
  private getHtmlScripts(): string {
    return `
        // Add interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Add sorting to tables
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {
                const headers = table.querySelectorAll('th');
                headers.forEach((header, index) => {
                    header.style.cursor = 'pointer';
                    header.addEventListener('click', () => {
                        sortTable(table, index);
                    });
                });
            });
        });

        function sortTable(table, columnIndex) {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const sorted = rows.sort((a, b) => {
                const aValue = a.cells[columnIndex].textContent;
                const bValue = b.cells[columnIndex].textContent;
                return aValue.localeCompare(bValue);
            });
            tbody.innerHTML = '';
            sorted.forEach(row => tbody.appendChild(row));
        }
    `;
  }

  /**
   * Generate summary section
   */
  private generateSummarySection(suite: BenchmarkSuite): string {
    return `
        <section class="summary">
            <div class="summary-card">
                <label>Total Benchmarks</label>
                <div class="value">${suite.statistics.totalBenchmarks}</div>
            </div>
            <div class="summary-card">
                <label>Successful</label>
                <div class="value status-success">${suite.statistics.successful}</div>
            </div>
            <div class="summary-card">
                <label>Failed</label>
                <div class="value ${suite.statistics.failed > 0 ? 'status-failed' : ''}">${suite.statistics.failed}</div>
            </div>
            <div class="summary-card">
                <label>Duration</label>
                <div class="value">${suite.metadata.duration.toFixed(2)}ms</div>
            </div>
        </section>
    `;
  }

  /**
   * Generate results section
   */
  private generateResultsSection(suite: BenchmarkSuite): string {
    const rows = suite.results.map(result => `
        <tr>
            <td>${result.name}</td>
            <td>${formatNanoseconds(result.mean)}</td>
            <td>${result.ops.toFixed(0)}</td>
            <td>${formatNanoseconds(result.min)}</td>
            <td>${formatNanoseconds(result.max)}</td>
            <td>${formatNanoseconds(result.median)}</td>
            <td>${result.rsd.toFixed(2)}%</td>
            <td>${result.significant ?
                '<span class="badge badge-success">Yes</span>' :
                '<span class="badge badge-warning">No</span>'}</td>
        </tr>
    `).join('');

    return `
        <section>
            <h2>Benchmark Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Mean</th>
                        <th>Ops/sec</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Median</th>
                        <th>RSD</th>
                        <th>Significant</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </section>
    `;
  }

  /**
   * Generate comparison section
   */
  private generateComparisonSection(comparison: ComparisonReport): string {
    const rows = comparison.comparisons.map(comp => {
      const verdictClass = comp.verdict === 'improved' ? 'status-improved' :
                          comp.verdict === 'regressed' ? 'status-regressed' :
                          'status-no-change';

      return `
        <tr>
            <td>${comp.name}</td>
            <td>${formatNanoseconds(comp.baseline.mean)}</td>
            <td>${formatNanoseconds(comp.current.mean)}</td>
            <td class="${verdictClass}">${comp.difference.relative.toFixed(2)}%</td>
            <td>${comp.difference.speedup.toFixed(2)}x</td>
            <td>${comp.significance.significant ? 'Yes' : 'No'}</td>
            <td class="${verdictClass}">${comp.verdict}</td>
        </tr>
      `;
    }).join('');

    return `
        <section>
            <h2>Comparison Report</h2>
            <p><strong>Overall Verdict:</strong> <span class="badge badge-${comparison.summary.overallVerdict === 'improved' ? 'success' : comparison.summary.overallVerdict === 'regressed' ? 'danger' : 'warning'}">${comparison.summary.overallVerdict}</span></p>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Baseline</th>
                        <th>Current</th>
                        <th>Difference</th>
                        <th>Speedup</th>
                        <th>Significant</th>
                        <th>Verdict</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </section>
    `;
  }

  /**
   * Generate metadata section
   */
  private generateMetadataSection(suite: BenchmarkSuite): string {
    const metadata = suite.metadata;
    const system = metadata.system;

    return `
        <section class="metadata">
            <h2>System Information</h2>
            <div class="metadata-grid">
                <div class="metadata-item">
                    <label>CPU</label>
                    <div>${system.cpuModel}</div>
                </div>
                <div class="metadata-item">
                    <label>Cores</label>
                    <div>${system.cpuCores}</div>
                </div>
                <div class="metadata-item">
                    <label>Memory</label>
                    <div>${formatBytes(system.totalMemory)}</div>
                </div>
                <div class="metadata-item">
                    <label>Platform</label>
                    <div>${system.platform} ${system.arch}</div>
                </div>
                <div class="metadata-item">
                    <label>Node Version</label>
                    <div>${system.nodeVersion}</div>
                </div>
                <div class="metadata-item">
                    <label>V8 Version</label>
                    <div>${system.v8Version}</div>
                </div>
            </div>
        </section>
    `;
  }

  /**
   * Generate Markdown report
   */
  private async generateMarkdownReport(data: ReportData): Promise<string[]> {
    const files: string[] = [];
    const mdReport = join(this.config.outputDir, `${this.config.name || 'report'}.md`);

    const markdown = this.generateMarkdownContent(data);
    writeFileSync(mdReport, markdown);
    files.push(mdReport);

    return files;
  }

  /**
   * Generate Markdown content
   */
  private generateMarkdownContent(data: ReportData): string {
    const suite = data.suite;
    let md = `# ${suite.name}\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Summary
    md += `## Summary\n\n`;
    md += `- **Total Benchmarks:** ${suite.statistics.totalBenchmarks}\n`;
    md += `- **Successful:** ${suite.statistics.successful}\n`;
    md += `- **Failed:** ${suite.statistics.failed}\n`;
    md += `- **Duration:** ${suite.metadata.duration.toFixed(2)}ms\n\n`;

    // Results table
    md += `## Results\n\n`;
    md += `| Name | Mean | Ops/sec | Min | Max | Median | RSD |\n`;
    md += `|------|------|---------|-----|-----|--------|-----|\n`;

    for (const result of suite.results) {
      md += `| ${result.name} | ${formatNanoseconds(result.mean)} | ${result.ops.toFixed(0)} | ${formatNanoseconds(result.min)} | ${formatNanoseconds(result.max)} | ${formatNanoseconds(result.median)} | ${result.rsd.toFixed(2)}% |\n`;
    }

    // System info
    md += `\n## System Information\n\n`;
    const system = suite.metadata.system;
    md += `- **CPU:** ${system.cpuModel}\n`;
    md += `- **Cores:** ${system.cpuCores}\n`;
    md += `- **Memory:** ${formatBytes(system.totalMemory)}\n`;
    md += `- **Platform:** ${system.platform} ${system.arch}\n`;
    md += `- **Node:** ${system.nodeVersion}\n`;
    md += `- **V8:** ${system.v8Version}\n`;

    return md;
  }

  /**
   * Generate CSV report
   */
  private async generateCsvReport(data: ReportData): Promise<string[]> {
    const files: string[] = [];
    const csvReport = join(this.config.outputDir, `${this.config.name || 'report'}.csv`);

    const csv = this.generateCsvContent(data);
    writeFileSync(csvReport, csv);
    files.push(csvReport);

    return files;
  }

  /**
   * Generate CSV content
   */
  private generateCsvContent(data: ReportData): string {
    const suite = data.suite;
    const rows = suite.results.map(result => ({
      name: result.name,
      mean: result.mean,
      ops: result.ops,
      min: result.min,
      max: result.max,
      median: result.median,
      rsd: result.rsd,
      significant: result.significant
    }));

    return stringify(rows, {
      header: true,
      columns: {
        name: 'Name',
        mean: 'Mean (ns)',
        ops: 'Ops/sec',
        min: 'Min (ns)',
        max: 'Max (ns)',
        median: 'Median (ns)',
        rsd: 'RSD (%)',
        significant: 'Significant'
      }
    });
  }
}

/**
 * Convenience function to generate a report
 */
export async function generateReport(
  data: ReportData,
  config: ReportConfig
): Promise<GeneratedReport> {
  const reporter = new PerformanceReporter(config);
  return reporter.generate(data);
}

/**
 * Generate HTML report
 */
export async function generateHtmlReport(
  data: ReportData,
  outputPath: string
): Promise<void> {
  const reporter = new PerformanceReporter({
    name: 'report',
    format: ['html'],
    outputDir: outputPath
  });
  await reporter.generate(data);
}

/**
 * Generate JSON report
 */
export async function generateJsonReport(
  data: ReportData,
  outputPath: string
): Promise<void> {
  const reporter = new PerformanceReporter({
    name: 'report',
    format: ['json'],
    outputDir: outputPath
  });
  await reporter.generate(data);
}
