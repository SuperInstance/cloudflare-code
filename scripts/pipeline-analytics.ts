#!/usr/bin/env tsx

/**
 * ClaudeFlare Pipeline Analytics Dashboard
 * Generates comprehensive analytics and reports for CI/CD pipelines
 */

import { readFile, writeFile, readdirSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';

interface AnalyticsConfig {
  metricsDir: string;
  period: number; // days
  outputFormat: 'console' | 'json' | 'html';
  outputFile?: string;
}

interface PipelineDashboardData {
  overview: {
    period: { start: Date; end: Date };
    totalDeployments: number;
    successRate: number;
    avgDeploymentTime: number;
    deploymentFrequency: number;
  };
  environments: {
    [key: string]: {
      deployments: number;
      successRate: number;
      avgDuration: number;
      lastDeployment: Date;
    };
  };
  trends: {
    deploymentFrequency: number[];
    successRate: number[];
    deploymentTime: number[];
    labels: string[];
  };
  quality: {
    avgTestCoverage: number;
    avgTestPassRate: number;
    totalLintErrors: number;
    totalTypeErrors: number;
    coverageTrend: number[];
  };
  security: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    vulnerabilityTrend: number[];
  };
  performance: {
    avgBuildTime: number;
    avgDeployTime: number;
    p95DeploymentTime: number;
    errorRate: number;
    latency: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  recommendations: string[];
}

class PipelineAnalyticsDashboard {
  private config: AnalyticsConfig;
  private data: any[] = [];

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  /**
   * Generate dashboard
   */
  async generate(): Promise<PipelineDashboardData> {
    console.log('📊 Generating ClaudeFlare Pipeline Analytics Dashboard');
    console.log('');

    // Load metrics data
    await this.loadMetrics();

    if (this.data.length === 0) {
      console.warn('⚠️  No metrics data found');
      throw new Error('No metrics data available');
    }

    // Filter by period
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - this.config.period * 24 * 60 * 60 * 1000);

    const filteredData = this.data.filter(
      m => new Date(m.timestamp) >= startDate && new Date(m.timestamp) <= endDate
    );

    if (filteredData.length === 0) {
      console.warn('⚠️  No data found for the specified period');
      throw new Error('No data available for the specified period');
    }

    console.log(`📈 Analyzing ${filteredData.length} deployments from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log('');

    // Generate dashboard data
    const dashboard: PipelineDashboardData = {
      overview: this.generateOverview(filteredData, startDate, endDate),
      environments: this.analyzeEnvironments(filteredData),
      trends: this.generateTrends(filteredData, startDate, endDate),
      quality: this.analyzeQuality(filteredData),
      security: this.analyzeSecurity(filteredData),
      performance: this.analyzePerformance(filteredData),
      recommendations: this.generateRecommendations(filteredData),
    };

    // Output dashboard
    if (this.config.outputFormat === 'console') {
      this.printDashboard(dashboard);
    } else if (this.config.outputFormat === 'json') {
      const output = JSON.stringify(dashboard, null, 2);
      if (this.config.outputFile) {
        await writeFile(this.config.outputFile, output);
        console.log(`📄 Dashboard saved to ${this.config.outputFile}`);
      } else {
        console.log(output);
      }
    } else if (this.config.outputFormat === 'html') {
      const html = this.generateHTML(dashboard);
      if (this.config.outputFile) {
        await writeFile(this.config.outputFile, html);
        console.log(`📄 Dashboard saved to ${this.config.outputFile}`);
      } else {
        console.log(html);
      }
    }

    return dashboard;
  }

  /**
   * Load metrics from files
   */
  private async loadMetrics(): Promise<void> {
    if (!existsSync(this.config.metricsDir)) {
      console.warn(`⚠️  Metrics directory not found: ${this.config.metricsDir}`);
      return;
    }

    const files = readdirSync(this.config.metricsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const filePath = join(this.config.metricsDir, file);
        const content = readFile(filePath, 'utf-8');
        const metrics = JSON.parse(content);
        this.data.push(metrics);
      } catch (error) {
        console.warn(`⚠️  Failed to load metrics from ${file}: ${error}`);
      }
    }

    console.log(`📊 Loaded ${this.data.length} deployment metrics`);
  }

  /**
   * Generate overview
   */
  private generateOverview(data: any[], startDate: Date, endDate: Date) {
    const totalDeployments = data.length;
    const successfulDeployments = data.filter(m => m.status === 'success').length;
    const successRate = (successfulDeployments / totalDeployments) * 100;
    const avgDeploymentTime = data.reduce((sum, m) => sum + (m.duration || 0), 0) / totalDeployments;
    const periodDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const deploymentFrequency = totalDeployments / periodDays;

    return {
      period: { start: startDate, end: endDate },
      totalDeployments,
      successRate,
      avgDeploymentTime,
      deploymentFrequency,
    };
  }

  /**
   * Analyze environments
   */
  private analyzeEnvironments(data: any[]) {
    const environments: any = {};

    for (const metrics of data) {
      const env = metrics.environment;
      if (!environments[env]) {
        environments[env] = {
          deployments: 0,
          successful: 0,
          totalDuration: 0,
          lastDeployment: new Date(0),
        };
      }

      environments[env].deployments++;
      if (metrics.status === 'success') {
        environments[env].successful++;
      }
      environments[env].totalDuration += metrics.duration || 0;

      const deploymentDate = new Date(metrics.timestamp);
      if (deploymentDate > environments[env].lastDeployment) {
        environments[env].lastDeployment = deploymentDate;
      }
    }

    // Calculate derived metrics
    for (const env in environments) {
      const envData = environments[env];
      envData.successRate = (envData.successful / envData.deployments) * 100;
      envData.avgDuration = envData.totalDuration / envData.deployments;
    }

    return environments;
  }

  /**
   * Generate trends
   */
  private generateTrends(data: any[], startDate: Date, endDate: Date) {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const bucketSize = Math.max(1, Math.floor(days / 10)); // 10 data points

    const deploymentFrequency: number[] = [];
    const successRate: number[] = [];
    const deploymentTime: number[] = [];
    const labels: string[] = [];

    for (let i = 0; i < days; i += bucketSize) {
      const bucketStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const bucketEnd = new Date(bucketStart.getTime() + bucketSize * 24 * 60 * 60 * 1000);

      const bucketData = data.filter(
        m => {
          const date = new Date(m.timestamp);
          return date >= bucketStart && date < bucketEnd;
        }
      );

      const deployments = bucketData.length;
      const successful = bucketData.filter(m => m.status === 'success').length;
      const avgTime = deployments > 0
        ? bucketData.reduce((sum, m) => sum + (m.duration || 0), 0) / deployments
        : 0;

      deploymentFrequency.push(deployments / bucketSize);
      successRate.push(deployments > 0 ? (successful / deployments) * 100 : 0);
      deploymentTime.push(avgTime);
      labels.push(bucketStart.toISOString().split('T')[0]);
    }

    return { deploymentFrequency, successRate, deploymentTime, labels };
  }

  /**
   * Analyze quality metrics
   */
  private analyzeQuality(data: any[]) {
    const coverageData = data
      .filter(m => m.testCoverage)
      .map(m => m.testCoverage);

    const avgTestCoverage = coverageData.length > 0
      ? coverageData.reduce((a, b) => a + b, 0) / coverageData.length
      : 0;

    const passRateData = data
      .filter(m => m.testResults)
      .map(m => (m.testResults.passed / m.testResults.total) * 100);

    const avgTestPassRate = passRateData.length > 0
      ? passRateData.reduce((a, b) => a + b, 0) / passRateData.length
      : 0;

    const totalLintErrors = data.reduce((sum, m) => sum + (m.lintErrors || 0), 0);
    const totalTypeErrors = data.reduce((sum, m) => sum + (m.typeErrors || 0), 0);

    const coverageTrend = this.calculateTrend(data, 'testCoverage');

    return {
      avgTestCoverage,
      avgTestPassRate,
      totalLintErrors,
      totalTypeErrors,
      coverageTrend,
    };
  }

  /**
   * Analyze security metrics
   */
  private analyzeSecurity(data: any[]) {
    const totalVulnerabilities = data.reduce((sum, m) => {
      if (!m.securityVulnerabilities) return sum;
      return sum +
        (m.securityVulnerabilities.critical || 0) +
        (m.securityVulnerabilities.high || 0) +
        (m.securityVulnerabilities.medium || 0) +
        (m.securityVulnerabilities.low || 0);
    }, 0);

    const criticalVulnerabilities = data.reduce((sum, m) => {
      return sum + (m.securityVulnerabilities?.critical || 0);
    }, 0);

    const vulnerabilityTrend = this.calculateTrend(data, 'securityVulnerabilities', 'total');

    return {
      totalVulnerabilities,
      criticalVulnerabilities,
      vulnerabilityTrend,
    };
  }

  /**
   * Analyze performance metrics
   */
  private analyzePerformance(data: any[]) {
    const buildTimes = data.filter(m => m.buildTime).map(m => m.buildTime);
    const avgBuildTime = buildTimes.length > 0
      ? buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length
      : 0;

    const deployTimes = data.filter(m => m.deployTime).map(m => m.deployTime);
    const avgDeployTime = deployTimes.length > 0
      ? deployTimes.reduce((a, b) => a + b, 0) / deployTimes.length
      : 0;

    const durations = data.map(m => m.duration || 0).sort((a, b) => a - b);
    const p95DeploymentTime = this.percentile(durations, 95);

    const errorRates = data.filter(m => m.errorRate).map(m => m.errorRate);
    const errorRate = errorRates.length > 0
      ? errorRates.reduce((a, b) => a + b, 0) / errorRates.length
      : 0;

    const latencies = data.filter(m => m.avgLatency).map(m => m.avgLatency);
    const p50Latency = latencies.length > 0 ? this.percentile(latencies, 50) : 0;
    const p95Latency = latencies.length > 0 ? this.percentile(latencies, 95) : 0;
    const p99Latency = latencies.length > 0 ? this.percentile(latencies, 99) : 0;

    return {
      avgBuildTime,
      avgDeployTime,
      p95DeploymentTime,
      errorRate,
      latency: {
        avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        p50: p50Latency,
        p95: p95Latency,
        p99: p99Latency,
      },
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(data: any[]): string[] {
    const recommendations: string[] = [];

    const successRate = (data.filter(m => m.status === 'success').length / data.length) * 100;
    if (successRate < 95) {
      recommendations.push('⚠️  Deployment success rate is below 95%. Review failed deployments and improve testing.');
    }

    const avgCoverage = data
      .filter(m => m.testCoverage)
      .reduce((sum, m) => sum + m.testCoverage, 0) /
      data.filter(m => m.testCoverage).length;

    if (avgCoverage < 80) {
      recommendations.push('📝 Test coverage is below 80%. Add more tests to improve code quality.');
    }

    const criticalVulns = data.reduce((sum, m) =>
      sum + (m.securityVulnerabilities?.critical || 0), 0);

    if (criticalVulns > 0) {
      recommendations.push('🔒 Critical security vulnerabilities found. Address them immediately.');
    }

    const avgDuration = data.reduce((sum, m) => sum + (m.duration || 0), 0) / data.length;
    if (avgDuration > 300000) { // 5 minutes
      recommendations.push('⚡ Deployment time is above 5 minutes. Optimize build and deployment process.');
    }

    const lintErrors = data.reduce((sum, m) => sum + (m.lintErrors || 0), 0);
    if (lintErrors > 100) {
      recommendations.push('🧹 High number of lint errors. Run lint --fix and address code quality issues.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All metrics look good! Keep up the great work.');
    }

    return recommendations;
  }

  /**
   * Print dashboard to console
   */
  private printDashboard(dashboard: PipelineDashboardData): void {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          ClaudeFlare Pipeline Analytics Dashboard          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📅 Period: ${dashboard.overview.period.start.toISOString()} to ${dashboard.overview.period.end.toISOString()}`);
    console.log('');

    // Overview
    console.log('📊 Overview:');
    console.log(`   Total Deployments:    ${dashboard.overview.totalDeployments}`);
    console.log(`   Success Rate:         ${dashboard.overview.successRate.toFixed(1)}%`);
    console.log(`   Avg Deployment Time:  ${(dashboard.overview.avgDeploymentTime / 1000).toFixed(2)}s`);
    console.log(`   Deployment Frequency: ${dashboard.overview.deploymentFrequency.toFixed(2)}/day`);
    console.log('');

    // Environments
    console.log('🌍 Environments:');
    for (const [env, data] of Object.entries(dashboard.environments)) {
      console.log(`   ${env}:`);
      console.log(`     Deployments:   ${data.deployments}`);
      console.log(`     Success Rate:  ${data.successRate.toFixed(1)}%`);
      console.log(`     Avg Duration:  ${(data.avgDuration / 1000).toFixed(2)}s`);
      console.log(`     Last Deploy:   ${data.lastDeployment.toISOString()}`);
    }
    console.log('');

    // Quality
    console.log('✨ Quality Metrics:');
    console.log(`   Avg Test Coverage:  ${dashboard.quality.avgTestCoverage.toFixed(1)}%`);
    console.log(`   Avg Test Pass Rate: ${dashboard.quality.avgTestPassRate.toFixed(1)}%`);
    console.log(`   Total Lint Errors:  ${dashboard.quality.totalLintErrors}`);
    console.log(`   Total Type Errors:  ${dashboard.quality.totalTypeErrors}`);
    console.log('');

    // Security
    console.log('🔒 Security:');
    console.log(`   Total Vulnerabilities:    ${dashboard.security.totalVulnerabilities}`);
    console.log(`   Critical Vulnerabilities: ${dashboard.security.criticalVulnerabilities}`);
    console.log('');

    // Performance
    console.log('⚡ Performance:');
    console.log(`   Avg Build Time:       ${(dashboard.performance.avgBuildTime / 1000).toFixed(2)}s`);
    console.log(`   Avg Deploy Time:      ${(dashboard.performance.avgDeployTime / 1000).toFixed(2)}s`);
    console.log(`   P95 Deploy Time:      ${(dashboard.performance.p95DeploymentTime / 1000).toFixed(2)}s`);
    console.log(`   Error Rate:           ${dashboard.performance.errorRate.toFixed(2)}%`);
    console.log(`   Avg Latency:          ${dashboard.performance.latency.avg.toFixed(0)}ms`);
    console.log(`   P95 Latency:          ${dashboard.performance.latency.p95.toFixed(0)}ms`);
    console.log('');

    // Recommendations
    console.log('💡 Recommendations:');
    for (const recommendation of dashboard.recommendations) {
      console.log(`   ${recommendation}`);
    }
    console.log('');
  }

  /**
   * Generate HTML dashboard
   */
  private generateHTML(dashboard: PipelineDashboardData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>ClaudeFlare Pipeline Analytics</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #0066cc; }
    .metric-label { color: #666; font-size: 14px; margin-bottom: 5px; }
    .metric-value { color: #333; font-size: 32px; font-weight: bold; }
    .recommendation { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .env-card { background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 ClaudeFlare Pipeline Analytics Dashboard</h1>
    <p>Period: ${dashboard.overview.period.start.toISOString()} to ${dashboard.overview.period.end.toISOString()}</p>

    <h2>Overview</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Total Deployments</div>
        <div class="metric-value">${dashboard.overview.totalDeployments}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value">${dashboard.overview.successRate.toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Deployment Time</div>
        <div class="metric-value">${(dashboard.overview.avgDeploymentTime / 1000).toFixed(2)}s</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Deployment Frequency</div>
        <div class="metric-value">${dashboard.overview.deploymentFrequency.toFixed(2)}/day</div>
      </div>
    </div>

    <h2>Environments</h2>
    ${Object.entries(dashboard.environments).map(([env, data]) => `
      <div class="env-card">
        <strong>${env}</strong>
        <div>Deployments: ${data.deployments} | Success Rate: ${data.successRate.toFixed(1)}% | Avg Duration: ${(data.avgDuration / 1000).toFixed(2)}s</div>
      </div>
    `).join('')}

    <h2>Quality Metrics</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Avg Test Coverage</div>
        <div class="metric-value">${dashboard.quality.avgTestCoverage.toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Test Pass Rate</div>
        <div class="metric-value">${dashboard.quality.avgTestPassRate.toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Lint Errors</div>
        <div class="metric-value">${dashboard.quality.totalLintErrors}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Type Errors</div>
        <div class="metric-value">${dashboard.quality.totalTypeErrors}</div>
      </div>
    </div>

    <h2>Security</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Total Vulnerabilities</div>
        <div class="metric-value">${dashboard.security.totalVulnerabilities}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Critical Vulnerabilities</div>
        <div class="metric-value" style="color: ${dashboard.security.criticalVulnerabilities > 0 ? '#dc3545' : '#28a745'}">${dashboard.security.criticalVulnerabilities}</div>
      </div>
    </div>

    <h2>Performance</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Avg Build Time</div>
        <div class="metric-value">${(dashboard.performance.avgBuildTime / 1000).toFixed(2)}s</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Deploy Time</div>
        <div class="metric-value">${(dashboard.performance.avgDeployTime / 1000).toFixed(2)}s</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Error Rate</div>
        <div class="metric-value">${dashboard.performance.errorRate.toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">P95 Latency</div>
        <div class="metric-value">${dashboard.performance.latency.p95.toFixed(0)}ms</div>
      </div>
    </div>

    <h2>Recommendations</h2>
    ${dashboard.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
  </div>
</body>
</html>
    `;
  }

  /**
   * Calculate trend for a metric
   */
  private calculateTrend(data: any[], field: string, subfield?: string): number[] {
    const windowSize = Math.max(3, Math.floor(data.length / 10));
    const trend: number[] = [];

    for (let i = 0; i < data.length; i += windowSize) {
      const window = data.slice(i, i + windowSize);
      const values = window
        .map(m => subfield ? m[field]?.[subfield] : m[field])
        .filter(v => v !== undefined);

      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        trend.push(avg);
      }
    }

    return trend;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedNumbers: number[], p: number): number {
    if (sortedNumbers.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedNumbers.length) - 1;
    return sortedNumbers[index] || 0;
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(): AnalyticsConfig {
  const args = process.argv.slice(2);
  const config: Partial<AnalyticsConfig> = {
    metricsDir: '.deployment-metrics',
    period: 7,
    outputFormat: 'console',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--metrics-dir':
      case '-m':
        config.metricsDir = nextArg;
        i++;
        break;
      case '--period':
      case '-p':
        config.period = parseInt(nextArg || '7', 10);
        i++;
        break;
      case '--format':
      case '-f':
        config.outputFormat = (nextArg || 'console') as AnalyticsConfig['outputFormat'];
        i++;
        break;
      case '--output':
      case '-o':
        config.outputFile = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config as AnalyticsConfig;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ClaudeFlare Pipeline Analytics Dashboard

Usage: tsx scripts/pipeline-analytics.ts [options]

Options:
  -m, --metrics-dir <path>   Metrics directory path [default: .deployment-metrics]
  -p, --period <days>        Analysis period in days [default: 7]
  -f, --format <format>      Output format (console, json, html) [default: console]
  -o, --output <path>        Output file path
  -h, --help                 Show this help message

Examples:
  tsx scripts/pipeline-analytics.ts
  tsx scripts/pipeline-analytics.ts -p 30 -f html -o dashboard.html
  tsx scripts/pipeline-analytics.ts --period 14 --format json --output analytics.json
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    const dashboard = new PipelineAnalyticsDashboard(config);
    await dashboard.generate();
  } catch (error) {
    console.error('❌ Failed to generate dashboard:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PipelineAnalyticsDashboard, PipelineDashboardData };
