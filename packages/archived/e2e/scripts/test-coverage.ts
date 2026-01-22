#!/usr/bin/env tsx
/**
 * Test Coverage Analysis Script
 *
 * Analyzes test coverage and generates detailed reports
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CoverageData {
  total: {
    lines?: { total: number; covered: number; pct: number; skipped: number };
    statements?: { total: number; covered: number; pct: number; skipped: number };
    functions?: { total: number; covered: number; pct: number; skipped: number };
    branches?: { total: number; covered: number; pct: number; skipped: number };
  };
  [key: string]: any;
}

interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface CoverageReport {
  overall: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  files: FileCoverage[];
  uncoveredFiles: string[];
  lowCoverageFiles: FileCoverage[];
  passed: boolean;
}

interface FileCoverage {
  file: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncoveredLines: number[];
  uncoveredBranches: number[];
}

class CoverageAnalyzer {
  private coverageDir: string;
  private thresholds: CoverageThresholds;

  constructor(thresholds?: Partial<CoverageThresholds>) {
    this.coverageDir = join(__dirname, '../coverage');
    this.thresholds = {
      statements: thresholds?.statements || 90,
      branches: thresholds?.branches || 85,
      functions: thresholds?.functions || 90,
      lines: thresholds?.lines || 90
    };
  }

  async analyze(): Promise<CoverageReport> {
    console.log('📊 Analyzing test coverage...');

    const coverageFile = join(this.coverageDir, 'coverage-summary.json');

    try {
      const coverageData: CoverageData = JSON.parse(readFileSync(coverageFile, 'utf-8'));

      const overall = {
        statements: this.roundToTwo(coverageData.total?.statements?.pct || 0),
        branches: this.roundToTwo(coverageData.total?.branches?.pct || 0),
        functions: this.roundToTwo(coverageData.total?.functions?.pct || 0),
        lines: this.roundToTwo(coverageData.total?.lines?.pct || 0)
      };

      const files = this.extractFileCoverage(coverageData);
      const uncoveredFiles = this.findUncoveredFiles(files);
      const lowCoverageFiles = this.findLowCoverageFiles(files);

      const passed = this.checkThresholds(overall);

      return {
        overall,
        files,
        uncoveredFiles,
        lowCoverageFiles,
        passed
      };
    } catch (error: any) {
      console.error('❌ Error reading coverage data:', error.message);
      throw error;
    }
  }

  private extractFileCoverage(coverageData: CoverageData): FileCoverage[] {
    const files: FileCoverage[] = [];

    for (const [filePath, data] of Object.entries(coverageData)) {
      if (filePath === 'total') continue;

      const fileData = data as any;

      // Skip test files and config files
      if (filePath.includes('.spec.') || filePath.includes('.test.') || filePath.includes('node_modules')) {
        continue;
      }

      files.push({
        file: filePath,
        statements: this.roundToTwo(fileData.s?.pct || 0),
        branches: this.roundToTwo(fileData.b?.pct || 0),
        functions: this.roundToTwo(fileData.f?.pct || 0),
        lines: this.roundToTwo(fileData.l?.pct || 0),
        uncoveredLines: fileData.l?.skip || [],
        uncoveredBranches: fileData.b?.skip || []
      });
    }

    return files.sort((a, b) => a.lines - b.lines);
  }

  private findUncoveredFiles(files: FileCoverage[]): string[] {
    return files
      .filter(f => f.lines === 0)
      .map(f => f.file);
  }

  private findLowCoverageFiles(files: FileCoverage[]): FileCoverage[] {
    return files.filter(f =>
      f.lines < this.thresholds.lines ||
      f.statements < this.thresholds.statements ||
      f.functions < this.thresholds.functions
    );
  }

  private checkThresholds(overall: CoverageReport['overall']): boolean {
    return (
      overall.lines >= this.thresholds.lines &&
      overall.statements >= this.thresholds.statements &&
      overall.branches >= this.thresholds.branches &&
      overall.functions >= this.thresholds.functions
    );
  }

  private roundToTwo(num: number): number {
    return Math.round(num * 100) / 100;
  }

  printReport(report: CoverageReport): void {
    console.log('\n📊 Coverage Report');
    console.log('═'.repeat(80));

    console.log('\n🎯 Overall Coverage:');
    console.log(`   Statements: ${this.formatPercentage(report.overall.statements)} ${this.getStatusIcon(report.overall.statements, this.thresholds.statements)}`);
    console.log(`   Branches:   ${this.formatPercentage(report.overall.branches)} ${this.getStatusIcon(report.overall.branches, this.thresholds.branches)}`);
    console.log(`   Functions:  ${this.formatPercentage(report.overall.functions)} ${this.getStatusIcon(report.overall.functions, this.thresholds.functions)}`);
    console.log(`   Lines:      ${this.formatPercentage(report.overall.lines)} ${this.getStatusIcon(report.overall.lines, this.thresholds.lines)}`);

    if (report.uncoveredFiles.length > 0) {
      console.log('\n❌ Uncovered Files:');
      report.uncoveredFiles.forEach(file => console.log(`   - ${file}`));
    }

    if (report.lowCoverageFiles.length > 0) {
      console.log('\n⚠️  Low Coverage Files (<90%):');
      report.lowCoverageFiles.forEach(file => {
        console.log(`   - ${file.file}: ${this.formatPercentage(file.lines)}`);
      });
    }

    console.log('\n' + '═'.repeat(80));

    if (report.passed) {
      console.log('\n✅ Coverage check passed!');
    } else {
      console.log('\n❌ Coverage check failed!');
      console.log('\nRequired thresholds:');
      console.log(`   Statements: ≥${this.thresholds.statements}%`);
      console.log(`   Branches:   ≥${this.thresholds.branches}%`);
      console.log(`   Functions:  ≥${this.thresholds.functions}%`);
      console.log(`   Lines:      ≥${this.thresholds.lines}%`);
    }
  }

  private formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`.padStart(7);
  }

  private getStatusIcon(actual: number, threshold: number): string {
    if (actual >= threshold) return '✅';
    if (actual >= threshold - 5) return '⚠️';
    return '❌';
  }

  async generateDetailedReport(report: CoverageReport): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Coverage Report - ClaudeFlare</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header .status { font-size: 24px; margin-top: 10px; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .metric-card .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
    .metric-card .label { color: #666; font-size: 14px; }
    .metric-card.high .value { color: #10b981; }
    .metric-card.medium .value { color: #f59e0b; }
    .metric-card.low .value { color: #ef4444; }
    .table-container {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
      margin-bottom: 20px;
    }
    .table-header {
      background: #f9fafb;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    .table-header h2 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 12px 20px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .progress-bar {
      width: 100px;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      transition: width 0.3s;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-high { background: #d1fae5; color: #065f46; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Test Coverage Report</h1>
      <div class="status">${report.passed ? '✅ Coverage Passed' : '❌ Coverage Failed'}</div>
    </div>

    <div class="metrics">
      <div class="metric-card ${this.getMetricClass(report.overall.statements, this.thresholds.statements)}">
        <div class="label">Statements</div>
        <div class="value">${report.overall.statements.toFixed(1)}%</div>
        <div class="badge ${this.getBadgeClass(report.overall.statements, this.thresholds.statements)}">Target: ${this.thresholds.statements}%</div>
      </div>
      <div class="metric-card ${this.getMetricClass(report.overall.branches, this.thresholds.branches)}">
        <div class="label">Branches</div>
        <div class="value">${report.overall.branches.toFixed(1)}%</div>
        <div class="badge ${this.getBadgeClass(report.overall.branches, this.thresholds.branches)}">Target: ${this.thresholds.branches}%</div>
      </div>
      <div class="metric-card ${this.getMetricClass(report.overall.functions, this.thresholds.functions)}">
        <div class="label">Functions</div>
        <div class="value">${report.overall.functions.toFixed(1)}%</div>
        <div class="badge ${this.getBadgeClass(report.overall.functions, this.thresholds.functions)}">Target: ${this.thresholds.functions}%</div>
      </div>
      <div class="metric-card ${this.getMetricClass(report.overall.lines, this.thresholds.lines)}">
        <div class="label">Lines</div>
        <div class="value">${report.overall.lines.toFixed(1)}%</div>
        <div class="badge ${this.getBadgeClass(report.overall.lines, this.thresholds.lines)}">Target: ${this.thresholds.lines}%</div>
      </div>
    </div>

    ${report.lowCoverageFiles.length > 0 ? `
    <div class="table-container">
      <div class="table-header">
        <h2>⚠️ Low Coverage Files</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Statements</th>
            <th>Branches</th>
            <th>Functions</th>
            <th>Lines</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          ${report.lowCoverageFiles.map(file => `
            <tr>
              <td>${file.file}</td>
              <td>${file.statements.toFixed(1)}%</td>
              <td>${file.branches.toFixed(1)}%</td>
              <td>${file.functions.toFixed(1)}%</td>
              <td>${file.lines.toFixed(1)}%</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill ${this.getProgressClass(file.lines, this.thresholds.lines)}" style="width: ${file.lines}%"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="table-container">
      <div class="table-header">
        <h2>📁 All Files</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Statements</th>
            <th>Branches</th>
            <th>Functions</th>
            <th>Lines</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          ${report.files.slice(0, 100).map(file => `
            <tr>
              <td>${file.file}</td>
              <td>${file.statements.toFixed(1)}%</td>
              <td>${file.branches.toFixed(1)}%</td>
              <td>${file.functions.toFixed(1)}%</td>
              <td>${file.lines.toFixed(1)}%</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill ${this.getProgressClass(file.lines, this.thresholds.lines)}" style="width: ${file.lines}%"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${report.uncoveredFiles.length > 0 ? `
    <div class="table-container">
      <div class="table-header">
        <h2>❌ Uncovered Files</h2>
      </div>
      <table>
        <tbody>
          ${report.uncoveredFiles.map(file => `
            <tr>
              <td>${file}</td>
              <td><span class="badge badge-low">0% coverage</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  </div>
</body>
</html>
    `;

    const outputPath = join(__dirname, '../reports/coverage-report.html');
    writeFileSync(outputPath, html);
    console.log(`\n✅ Detailed report generated: ${outputPath}`);
  }

  private getMetricClass(actual: number, threshold: number): string {
    if (actual >= threshold) return 'high';
    if (actual >= threshold - 5) return 'medium';
    return 'low';
  }

  private getBadgeClass(actual: number, threshold: number): string {
    if (actual >= threshold) return 'badge-high';
    if (actual >= threshold - 5) return 'badge-medium';
    return 'badge-low';
  }

  private getProgressClass(actual: number, threshold: number): string {
    if (actual >= threshold) return 'background: #10b981;';
    if (actual >= threshold - 5) return 'background: #f59e0b;';
    return 'background: #ef4444;';
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const report = args.includes('--report');

  const thresholds: Partial<CoverageThresholds> = {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90
  };

  const analyzer = new CoverageAnalyzer(thresholds);
  const coverageReport = await analyzer.analyze();

  analyzer.printReport(coverageReport);

  if (report) {
    await analyzer.generateDetailedReport(coverageReport);
  }

  if (checkOnly && !coverageReport.passed) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error analyzing coverage:', error);
  process.exit(1);
});
