#!/usr/bin/env tsx

/**
 * ClaudeFlare Deployment Metrics Collector
 * Collects and analyzes deployment metrics for pipeline analytics
 */

import { execSync } from 'child_process';
import { readFile, writeFile, readdirSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';

interface DeploymentMetrics {
  deploymentId: string;
  version: string;
  environment: string;
  timestamp: Date;
  duration: number;
  status: 'success' | 'failed' | 'rolled_back';
  strategy: string;
  commitSha?: string;
  actor?: string;
  runId?: string;

  // Performance metrics
  buildTime?: number;
  deployTime?: number;
  healthCheckTime?: number;

  // Quality metrics
  testCoverage?: number;
  testResults?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  lintErrors?: number;
  typeErrors?: number;

  // Security metrics
  securityVulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  // Resource metrics
  bundleSize?: number;
  memoryUsage?: number;
  cpuTime?: number;

  // Health metrics
  errorRate?: number;
  avgLatency?: number;
  p95Latency?: number;
  p99Latency?: number;
  uptime?: number;

  // Custom metrics
  customMetrics?: Record<string, string | number | boolean>;
}

interface PipelineAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  deployments: {
    total: number;
    successful: number;
    failed: number;
    rolledBack: number;
    successRate: number;
  };
  performance: {
    avgDeploymentTime: number;
    p50DeploymentTime: number;
    p95DeploymentTime: number;
    p99DeploymentTime: number;
    avgBuildTime: number;
    avgHealthCheckTime: number;
  };
  quality: {
    avgTestCoverage: number;
    avgTestPassRate: number;
    totalLintErrors: number;
    totalTypeErrors: number;
  };
  security: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
  };
  trends: {
    deploymentFrequency: number; // deployments per day
    changeFailureRate: number; // percentage of deployments that failed or rolled back
    meanTimeToRestore: number; // average time to restore service after failure (minutes)
  };
  environments: {
    [key: string]: {
      deployments: number;
      successRate: number;
      avgDuration: number;
    };
  };
}

class MetricsCollector {
  private metricsDir: string;
  private data: DeploymentMetrics[] = [];

  constructor(metricsDir: string = '.deployment-metrics') {
    this.metricsDir = metricsDir;
  }

  /**
   * Load all deployment metrics
   */
  async loadMetrics(): Promise<void> {
    if (!existsSync(this.metricsDir)) {
      console.warn(`⚠️  Metrics directory not found: ${this.metricsDir}`);
      return;
    }

    const files = readdirSync(this.metricsDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      try {
        const filePath = join(this.metricsDir, file);
        const content = readFile(filePath, 'utf-8');
        const metrics = JSON.parse(content);

        // Convert timestamp strings to Date objects
        if (typeof metrics.timestamp === 'string') {
          metrics.timestamp = new Date(metrics.timestamp);
        }

        this.data.push(metrics);
      } catch (error) {
        console.warn(`⚠️  Failed to load metrics from ${file}: ${error}`);
      }
    }

    console.log(`📊 Loaded ${this.data.length} deployment metrics`);
  }

  /**
   * Collect current deployment metrics
   */
  async collectCurrentDeployment(config: {
    deploymentId: string;
    version: string;
    environment: string;
    strategy: string;
    startTime: Date;
    endTime: Date;
    status: 'success' | 'failed' | 'rolled_back';
  }): Promise<DeploymentMetrics> {
    const metrics: DeploymentMetrics = {
      deploymentId: config.deploymentId,
      version: config.version,
      environment: config.environment,
      timestamp: config.endTime,
      duration: config.endTime.getTime() - config.startTime.getTime(),
      status: config.status,
      strategy: config.strategy,
      commitSha: process.env.GITHUB_SHA,
      actor: process.env.GITHUB_ACTOR,
      runId: process.env.GITHUB_RUN_ID,
    };

    // Collect build metrics
    metrics.buildTime = await this.getBuildTime();

    // Collect test metrics
    metrics.testResults = await this.getTestResults();
    metrics.testCoverage = await this.getTestCoverage();

    // Collect lint metrics
    metrics.lintErrors = await this.getLintErrors();
    metrics.typeErrors = await this.getTypeErrors();

    // Collect security metrics
    metrics.securityVulnerabilities = await this.getSecurityVulnerabilities();

    // Collect bundle metrics
    metrics.bundleSize = await this.getBundleSize();

    // Collect runtime metrics if available
    if (config.status === 'success') {
      const runtimeMetrics = await this.getRuntimeMetrics(config.environment);
      metrics.errorRate = runtimeMetrics.errorRate;
      metrics.avgLatency = runtimeMetrics.avgLatency;
      metrics.p95Latency = runtimeMetrics.p95Latency;
      metrics.p99Latency = runtimeMetrics.p99Latency;
      metrics.memoryUsage = runtimeMetrics.memoryUsage;
      metrics.cpuTime = runtimeMetrics.cpuTime;
    }

    return metrics;
  }

  /**
   * Save deployment metrics
   */
  async saveMetrics(metrics: DeploymentMetrics): Promise<void> {
    if (!existsSync(this.metricsDir)) {
      execSync(`mkdir -p ${this.metricsDir}`, { stdio: 'pipe' });
    }

    const filename = `deployment-${Date.now()}.json`;
    const filepath = join(this.metricsDir, filename);

    await writeFile(filepath, JSON.stringify(metrics, null, 2));
    console.log(`📄 Metrics saved to ${filepath}`);
  }

  /**
   * Generate pipeline analytics
   */
  generateAnalytics(period: { start: Date; end: Date }): PipelineAnalytics {
    const filteredData = this.data.filter(
      m => m.timestamp >= period.start && m.timestamp <= period.end
    );

    if (filteredData.length === 0) {
      throw new Error('No deployment data found for the specified period');
    }

    const deployments = {
      total: filteredData.length,
      successful: filteredData.filter(m => m.status === 'success').length,
      failed: filteredData.filter(m => m.status === 'failed').length,
      rolledBack: filteredData.filter(m => m.status === 'rolled_back').length,
      successRate: 0,
    };

    deployments.successRate = (deployments.successful / deployments.total) * 100;

    const durations = filteredData.map(m => m.duration);
    durations.sort((a, b) => a - b);

    const performance = {
      avgDeploymentTime: this.average(durations),
      p50DeploymentTime: this.percentile(durations, 50),
      p95DeploymentTime: this.percentile(durations, 95),
      p99DeploymentTime: this.percentile(durations, 99),
      avgBuildTime: this.average(filteredData.map(m => m.buildTime).filter(Boolean) as number[]),
      avgHealthCheckTime: this.average(filteredData.map(m => m.healthCheckTime).filter(Boolean) as number[]),
    };

    const quality = {
      avgTestCoverage: this.average(filteredData.map(m => m.testCoverage).filter(Boolean) as number[]),
      avgTestPassRate: this.average(
        filteredData
          .filter(m => m.testResults)
          .map(m => (m.testResults!.passed / m.testResults!.total) * 100)
      ),
      totalLintErrors: filteredData.reduce((sum, m) => sum + (m.lintErrors || 0), 0),
      totalTypeErrors: filteredData.reduce((sum, m) => sum + (m.typeErrors || 0), 0),
    };

    const security = {
      totalVulnerabilities: filteredData.reduce(
        (sum, m) =>
          sum +
          (m.securityVulnerabilities?.critical || 0) +
          (m.securityVulnerabilities?.high || 0) +
          (m.securityVulnerabilities?.medium || 0) +
          (m.securityVulnerabilities?.low || 0),
        0
      ),
      criticalVulnerabilities: filteredData.reduce((sum, m) => sum + (m.securityVulnerabilities?.critical || 0), 0),
      highVulnerabilities: filteredData.reduce((sum, m) => sum + (m.securityVulnerabilities?.high || 0), 0),
      mediumVulnerabilities: filteredData.reduce((sum, m) => sum + (m.securityVulnerabilities?.medium || 0), 0),
      lowVulnerabilities: filteredData.reduce((sum, m) => sum + (m.securityVulnerabilities?.low || 0), 0),
    };

    const periodDays = Math.max(1, (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));
    const trends = {
      deploymentFrequency: deployments.total / periodDays,
      changeFailureRate: ((deployments.failed + deployments.rolledBack) / deployments.total) * 100,
      meanTimeToRestore: this.calculateMeanTimeToRestore(filteredData),
    };

    const environments: { [key: string]: any } = {};
    for (const metrics of filteredData) {
      if (!environments[metrics.environment]) {
        environments[metrics.environment] = {
          deployments: 0,
          successRate: 0,
          totalDuration: 0,
        };
      }
      environments[metrics.environment].deployments++;
      environments[metrics.environment].totalDuration += metrics.duration;
    }

    for (const env in environments) {
      const envData = environments[env];
      const envMetrics = filteredData.filter(m => m.environment === env);
      envData.successRate = (envMetrics.filter(m => m.status === 'success').length / envData.deployments) * 100;
      envData.avgDuration = envData.totalDuration / envData.deployments;
    }

    return {
      period,
      deployments,
      performance,
      quality,
      security,
      trends,
      environments,
    };
  }

  /**
   * Print analytics report
   */
  printAnalyticsReport(analytics: PipelineAnalytics): void {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          ClaudeFlare Pipeline Analytics Report             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Period: ${analytics.period.start.toISOString()} to ${analytics.period.end.toISOString()}`);
    console.log('');

    // Deployments
    console.log('📦 Deployments:');
    console.log(`   Total:          ${analytics.deployments.total}`);
    console.log(`   Successful:     ${analytics.deployments.successful} (${analytics.deployments.successRate.toFixed(1)}%)`);
    console.log(`   Failed:         ${analytics.deployments.failed}`);
    console.log(`   Rolled Back:    ${analytics.deployments.rolledBack}`);
    console.log('');

    // Performance
    console.log('⚡ Performance:');
    console.log(`   Avg Deploy Time:  ${(analytics.performance.avgDeploymentTime / 1000).toFixed(2)}s`);
    console.log(`   P50 Deploy Time:  ${(analytics.performance.p50DeploymentTime / 1000).toFixed(2)}s`);
    console.log(`   P95 Deploy Time:  ${(analytics.performance.p95DeploymentTime / 1000).toFixed(2)}s`);
    console.log(`   P99 Deploy Time:  ${(analytics.performance.p99DeploymentTime / 1000).toFixed(2)}s`);
    console.log(`   Avg Build Time:   ${(analytics.performance.avgBuildTime / 1000).toFixed(2)}s`);
    console.log('');

    // Quality
    console.log('✨ Quality:');
    console.log(`   Avg Test Coverage:  ${analytics.quality.avgTestCoverage.toFixed(1)}%`);
    console.log(`   Avg Test Pass Rate: ${analytics.quality.avgTestPassRate.toFixed(1)}%`);
    console.log(`   Total Lint Errors:  ${analytics.quality.totalLintErrors}`);
    console.log(`   Total Type Errors:  ${analytics.quality.totalTypeErrors}`);
    console.log('');

    // Security
    console.log('🔒 Security:');
    console.log(`   Total Vulnerabilities:    ${analytics.security.totalVulnerabilities}`);
    console.log(`   Critical:                 ${analytics.security.criticalVulnerabilities}`);
    console.log(`   High:                     ${analytics.security.highVulnerabilities}`);
    console.log(`   Medium:                   ${analytics.security.mediumVulnerabilities}`);
    console.log(`   Low:                      ${analytics.security.lowVulnerabilities}`);
    console.log('');

    // Trends
    console.log('📈 Trends:');
    console.log(`   Deployment Frequency:  ${analytics.trends.deploymentFrequency.toFixed(2)}/day`);
    console.log(`   Change Failure Rate:   ${analytics.trends.changeFailureRate.toFixed(1)}%`);
    console.log(`   MTTR:                  ${analytics.trends.meanTimeToRestore.toFixed(1)}min`);
    console.log('');

    // Environments
    console.log('🌍 Environments:');
    for (const [env, data] of Object.entries(analytics.environments)) {
      console.log(`   ${env}:`);
      console.log(`     Deployments:   ${data.deployments}`);
      console.log(`     Success Rate:  ${data.successRate.toFixed(1)}%`);
      console.log(`     Avg Duration:  ${(data.avgDuration / 1000).toFixed(2)}s`);
    }
    console.log('');
  }

  /**
   * Get build time from package.json
   */
  private async getBuildTime(): Promise<number> {
    try {
      const buildStart = process.env.BUILD_START_TIME;
      const buildEnd = process.env.BUILD_END_TIME;

      if (buildStart && buildEnd) {
        return parseInt(buildEnd) - parseInt(buildStart);
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get test results from coverage report
   */
  private async getTestResults(): Promise<{ total: number; passed: number; failed: number; skipped: number } | undefined> {
    try {
      const coverageFile = join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (!existsSync(coverageFile)) {
        return undefined;
      }

      const coverage = JSON.parse(readFile(coverageFile, 'utf-8'));
      return {
        total: coverage.total?.lines?.total || 0,
        passed: coverage.total?.lines?.covered || 0,
        failed: 0,
        skipped: 0,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get test coverage percentage
   */
  private async getTestCoverage(): Promise<number | undefined> {
    try {
      const coverageFile = join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (!existsSync(coverageFile)) {
        return undefined;
      }

      const coverage = JSON.parse(readFile(coverageFile, 'utf-8'));
      return coverage.total?.lines?.pct || 0;
    } catch {
      return undefined;
    }
  }

  /**
   * Get lint errors
   */
  private async getLintErrors(): Promise<number> {
    try {
      const eslintReport = join(process.cwd(), 'eslint-report.json');
      if (!existsSync(eslintReport)) {
        return 0;
      }

      const report = JSON.parse(readFile(eslintReport, 'utf-8'));
      return report.length || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get type errors
   */
  private async getTypeErrors(): Promise<number> {
    try {
      const tscOutput = execSync('npm run typecheck 2>&1 | grep -c "error TS" || echo 0', {
        shell: '/bin/bash',
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      return parseInt(tscOutput.trim());
    } catch {
      return 0;
    }
  }

  /**
   * Get security vulnerabilities
   */
  private async getSecurityVulnerabilities(): Promise<{
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | undefined> {
    try {
      const auditReport = join(process.cwd(), 'npm-audit-report.json');
      if (!existsSync(auditReport)) {
        return undefined;
      }

      const report = JSON.parse(readFile(auditReport, 'utf-8'));
      const vulnerabilities = report.vulnerabilities || {};

      return {
        critical: vulnerabilities.critical?.length || 0,
        high: vulnerabilities.high?.length || 0,
        medium: vulnerabilities.moderate?.length || 0,
        low: vulnerabilities.low?.length || 0,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get bundle size
   */
  private async getBundleSize(): Promise<number | undefined> {
    try {
      const distPath = join(process.cwd(), 'dist', 'worker.js');
      if (!existsSync(distPath)) {
        return undefined;
      }

      const stats = execSync(`du -b ${distPath}`, { encoding: 'utf-8', stdio: 'pipe' });
      return parseInt(stats.trim().split('\t')[0]);
    } catch {
      return undefined;
    }
  }

  /**
   * Get runtime metrics from deployed worker
   */
  private async getRuntimeMetrics(environment: string): Promise<{
    errorRate: number | undefined;
    avgLatency: number | undefined;
    p95Latency: number | undefined;
    p99Latency: number | undefined;
    memoryUsage: number | undefined;
    cpuTime: number | undefined;
  }> {
    const url = this.getEnvironmentUrl(environment);

    try {
      const response = await fetch(`${url}/metrics`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          errorRate: data.errorRate,
          avgLatency: data.avgLatency,
          p95Latency: data.p95Latency,
          p99Latency: data.p99Latency,
          memoryUsage: data.memoryUsage,
          cpuTime: data.cpuTime,
        };
      }
    } catch {
      // Metrics not available
    }

    return {
      errorRate: undefined,
      avgLatency: undefined,
      p95Latency: undefined,
      p99Latency: undefined,
      memoryUsage: undefined,
      cpuTime: undefined,
    };
  }

  /**
   * Get environment URL
   */
  private getEnvironmentUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return 'https://claudeflare.workers.dev';
      case 'staging':
        return 'https://staging.claudeflare.workers.dev';
      case 'development':
        return 'http://localhost:8787';
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
  }

  /**
   * Calculate mean time to restore
   */
  private calculateMeanTimeToRestore(metrics: DeploymentMetrics[]): number {
    const failures = metrics.filter(m => m.status === 'failed' || m.status === 'rolled_back');

    if (failures.length === 0) {
      return 0;
    }

    // Simplified MTTR calculation
    // In practice, you'd track the time from failure to successful deployment
    return 30; // Default 30 minutes
  }

  /**
   * Calculate average
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
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
function parseArgs(): {
  action: 'collect' | 'analyze' | 'report';
  environment?: string;
  deploymentId?: string;
  version?: string;
  strategy?: string;
  startTime?: Date;
  endTime?: Date;
  period?: number; // days
  outputFile?: string;
} {
  const args = process.argv.slice(2);
  const config: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case 'collect':
        config.action = 'collect';
        break;
      case 'analyze':
        config.action = 'analyze';
        break;
      case 'report':
        config.action = 'report';
        break;
      case '--environment':
      case '-e':
        config.environment = nextArg;
        i++;
        break;
      case '--deployment-id':
        config.deploymentId = nextArg;
        i++;
        break;
      case '--version':
        config.version = nextArg;
        i++;
        break;
      case '--strategy':
        config.strategy = nextArg;
        i++;
        break;
      case '--period':
      case '-p':
        config.period = parseInt(nextArg || '7', 10);
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

  if (!config.action) {
    config.action = 'report';
  }

  if (config.period) {
    const end = new Date();
    const start = new Date(end.getTime() - config.period * 24 * 60 * 60 * 1000);
    config.startTime = start;
    config.endTime = end;
  } else {
    config.period = 7;
    config.startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    config.endTime = new Date();
  }

  return config;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ClaudeFlare Deployment Metrics Collector

Usage: tsx scripts/deployment-metrics.ts <action> [options]

Actions:
  collect    Collect metrics for current deployment
  analyze    Generate analytics from historical data
  report     Generate and display analytics report

Options:
  -e, --environment <env>    Deployment environment
      --deployment-id <id>   Deployment ID
      --version <version>    Deployment version
      --strategy <strategy>  Deployment strategy
  -p, --period <days>        Period to analyze in days [default: 7]
  -o, --output <path>        Save output to file
  -h, --help                 Show this help message

Examples:
  tsx scripts/deployment-metrics.ts collect -e production --version v1.0.0
  tsx scripts/deployment-metrics.ts analyze -p 30
  tsx scripts/deployment-metrics.ts report -p 7 -o analytics.json
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const collector = new MetricsCollector();

    await collector.loadMetrics();

    if (args.action === 'collect') {
      const startTime = args.startTime || new Date();
      const endTime = new Date();

      const metrics = await collector.collectCurrentDeployment({
        deploymentId: args.deploymentId || `deployment-${Date.now()}`,
        version: args.version || 'latest',
        environment: args.environment || 'production',
        strategy: args.strategy || 'full',
        startTime,
        endTime,
        status: 'success',
      });

      await collector.saveMetrics(metrics);

      if (args.outputFile) {
        await writeFile(args.outputFile, JSON.stringify(metrics, null, 2));
        console.log(`📄 Metrics saved to ${args.outputFile}`);
      }
    } else if (args.action === 'analyze' || args.action === 'report') {
      const analytics = collector.generateAnalytics({
        start: args.startTime!,
        end: args.endTime!,
      });

      if (args.outputFile) {
        await writeFile(args.outputFile, JSON.stringify(analytics, null, 2));
        console.log(`📄 Analytics saved to ${args.outputFile}`);
      }

      if (args.action === 'report') {
        collector.printAnalyticsReport(analytics);
      }
    }
  } catch (error) {
    console.error('❌ Metrics collection failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MetricsCollector, DeploymentMetrics, PipelineAnalytics };
