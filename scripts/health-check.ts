#!/usr/bin/env tsx

/**
 * ClaudeFlare Health Check Script
 * Performs comprehensive health checks for deployments:
 * - HTTP endpoint health
 * - Response time metrics
 * - Error rate monitoring
 * - Dependency health
 * - Resource availability
 */

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

interface HealthCheckConfig {
  environment: 'development' | 'staging' | 'production';
  url?: string;
  timeout: number;
  retries: number;
  threshold: number; // Success rate threshold (0-100)
  duration: number; // Total check duration in seconds
  interval: number; // Check interval in seconds
  verbose: boolean;
  outputFile?: string;
}

interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

interface HealthReport {
  environment: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  results: HealthCheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    successRate: number;
  };
  metrics: {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    totalRequests: number;
    successfulRequests: number;
  };
}

const DEFAULT_CONFIG: Omit<HealthCheckConfig, 'environment'> = {
  timeout: 10000,
  retries: 3,
  threshold: 99,
  duration: 60,
  interval: 5,
  verbose: true,
};

class HealthChecker {
  private config: HealthCheckConfig;
  private results: HealthCheckResult[] = [];
  private responseTimes: number[] = [];
  private startTime: Date = new Date();

  constructor(config: HealthCheckConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute complete health check suite
   */
  async run(): Promise<HealthReport> {
    console.log('🏥 Starting ClaudeFlare Health Checks');
    console.log(`   Environment: ${this.config.environment}`);
    console.log(`   Duration: ${this.config.duration}s`);
    console.log(`   Threshold: ${this.config.threshold}%`);
    console.log('');

    try {
      // Get deployment URL
      const url = this.config.url || this.getDeploymentUrl();
      console.log(`📍 Target URL: ${url}\n`);

      // Run basic health check
      await this.checkEndpointHealth(url);

      // Run continuous monitoring if duration > 0
      if (this.config.duration > 0) {
        await this.monitorEndpoint(url);
      }

      // Check dependencies
      await this.checkDependencies();

      // Check resources
      await this.checkResources();

      // Check metrics endpoint
      await this.checkMetricsEndpoint(url);

      const endTime = new Date();
      const report = this.generateReport(endTime);

      this.printSummary(report);

      if (this.config.outputFile) {
        await this.saveReport(report);
      }

      // Exit with error code if unhealthy
      if (report.overallStatus === 'unhealthy') {
        process.exit(1);
      }

      return report;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check endpoint health
   */
  private async checkEndpointHealth(url: string): Promise<void> {
    console.log('🔍 Checking endpoint health...');

    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.retries) {
      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          headers: {
            'User-Agent': 'ClaudeFlare-HealthCheck/1.0',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        const duration = Date.now() - startTime;
        this.responseTimes.push(duration);

        if (response.ok) {
          const data = await response.json();

          this.results.push({
            name: 'Endpoint Health',
            status: 'pass',
            duration,
            message: `Endpoint is healthy`,
            details: data,
            timestamp: new Date(),
          });

          console.log(`✅ Endpoint healthy (${duration}ms)`);
          console.log(`   Status: ${data.status || 'OK'}`);
          console.log(`   Version: ${data.version || 'unknown'}\n`);
          return;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts < this.config.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 5000);
          console.warn(`⚠️  Attempt ${attempts} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    this.results.push({
      name: 'Endpoint Health',
      status: 'fail',
      duration: Date.now() - startTime,
      message: `Endpoint health check failed after ${attempts} attempts`,
      details: { error: lastError?.message },
      timestamp: new Date(),
    });

    throw new Error(`Endpoint health check failed: ${lastError?.message}`);
  }

  /**
   * Monitor endpoint continuously
   */
  private async monitorEndpoint(url: string): Promise<void> {
    console.log(`📊 Monitoring endpoint for ${this.config.duration}s...`);

    const iterations = Math.floor(this.config.duration / this.config.interval);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(this.config.timeout),
        });

        const duration = Date.now() - startTime;
        this.responseTimes.push(duration);

        if (response.ok) {
          successCount++;
          if (this.config.verbose) {
            console.log(`✅ Check ${i + 1}/${iterations}: OK (${duration}ms)`);
          }
        } else {
          failCount++;
          console.warn(`⚠️  Check ${i + 1}/${iterations}: HTTP ${response.status}`);
        }
      } catch (error) {
        failCount++;
        console.warn(`⚠️  Check ${i + 1}/${iterations}: ${error}`);
      }

      // Wait before next check
      if (i < iterations - 1) {
        await this.sleep(this.config.interval * 1000);
      }
    }

    const successRate = (successCount / iterations) * 100;

    this.results.push({
      name: 'Continuous Monitoring',
      status: successRate >= this.config.threshold ? 'pass' : 'fail',
      duration: this.config.duration * 1000,
      message: `Success rate: ${successRate.toFixed(2)}%`,
      details: {
        totalChecks: iterations,
        successful: successCount,
        failed: failCount,
        successRate: `${successRate.toFixed(2)}%`,
        threshold: `${this.config.threshold}%`,
      },
      timestamp: new Date(),
    });

    console.log(`\n📈 Monitoring Results:`);
    console.log(`   Total Checks: ${iterations}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Success Rate: ${successRate.toFixed(2)}%\n`);
  }

  /**
   * Check dependencies
   */
  private async checkDependencies(): Promise<void> {
    console.log('🔗 Checking dependencies...');

    const checks = [
      { name: 'KV Namespace', check: () => this.checkKVBinding() },
      { name: 'R2 Bucket', check: () => this.checkR2Binding() },
      { name: 'D1 Database', check: () => this.checkD1Binding() },
      { name: 'Durable Objects', check: () => this.checkDurableObjectsBinding() },
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, check } of checks) {
      try {
        await check();
        passed++;
        console.log(`✅ ${name}: OK`);
      } catch (error) {
        failed++;
        console.warn(`⚠️  ${name}: ${error}`);
      }
    }

    this.results.push({
      name: 'Dependencies',
      status: failed === 0 ? 'pass' : 'warn',
      duration: 0,
      message: `${passed}/${checks.length} dependencies healthy`,
      details: { passed, failed, total: checks.length },
      timestamp: new Date(),
    });

    console.log('');
  }

  /**
   * Check KV binding
   */
  private async checkKVBinding(): Promise<void> {
    const url = this.config.url || this.getDeploymentUrl();
    const response = await fetch(`${url}/health/kv`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error('KV health check failed');
    }
  }

  /**
   * Check R2 binding
   */
  private async checkR2Binding(): Promise<void> {
    const url = this.config.url || this.getDeploymentUrl();
    const response = await fetch(`${url}/health/r2`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error('R2 health check failed');
    }
  }

  /**
   * Check D1 binding
   */
  private async checkD1Binding(): Promise<void> {
    const url = this.config.url || this.getDeploymentUrl();
    const response = await fetch(`${url}/health/d1`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error('D1 health check failed');
    }
  }

  /**
   * Check Durable Objects binding
   */
  private async checkDurableObjectsBinding(): Promise<void> {
    const url = this.config.url || this.getDeploymentUrl();
    const response = await fetch(`${url}/health/durable-objects`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error('Durable Objects health check failed');
    }
  }

  /**
   * Check resources
   */
  private async checkResources(): Promise<void> {
    console.log('📦 Checking resources...');

    // Check CPU time
    const cpuCheck = await this.checkCPUTime();
    console.log(`   CPU Time: ${cpuCheck.message}`);

    // Check memory usage
    const memoryCheck = await this.checkMemoryUsage();
    console.log(`   Memory: ${memoryCheck.message}`);

    this.results.push({
      name: 'Resources',
      status: cpuCheck.status === 'pass' && memoryCheck.status === 'pass' ? 'pass' : 'warn',
      duration: 0,
      message: 'Resource checks completed',
      details: { cpu: cpuCheck.details, memory: memoryCheck.details },
      timestamp: new Date(),
    });

    console.log('');
  }

  /**
   * Check CPU time
   */
  private async checkCPUTime(): Promise<{ status: 'pass' | 'warn'; message: string; details?: unknown }> {
    try {
      const url = this.config.url || this.getDeploymentUrl();
      const response = await fetch(`${url}/metrics/cpu`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        const cpuTime = data.cpuTime || 0;
        const limit = data.limit || 50;

        if (cpuTime < limit * 0.9) {
          return {
            status: 'pass',
            message: `${cpuTime}ms / ${limit}ms (OK)`,
            details: data,
          };
        }

        return {
          status: 'warn',
          message: `${cpuTime}ms / ${limit}ms (High)`,
          details: data,
        };
      }

      return {
        status: 'warn',
        message: 'Could not check CPU time',
      };
    } catch {
      return {
        status: 'warn',
        message: 'CPU check unavailable',
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<{ status: 'pass' | 'warn'; message: string; details?: unknown }> {
    try {
      const url = this.config.url || this.getDeploymentUrl();
      const response = await fetch(`${url}/metrics/memory`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        const usage = data.usage || 0;
        const limit = data.limit || 128;

        if (usage < limit * 0.9) {
          return {
            status: 'pass',
            message: `${usage}MB / ${limit}MB (OK)`,
            details: data,
          };
        }

        return {
          status: 'warn',
          message: `${usage}MB / ${limit}MB (High)`,
          details: data,
        };
      }

      return {
        status: 'warn',
        message: 'Could not check memory usage',
      };
    } catch {
      return {
        status: 'warn',
        message: 'Memory check unavailable',
      };
    }
  }

  /**
   * Check metrics endpoint
   */
  private async checkMetricsEndpoint(url: string): Promise<void> {
    console.log('📊 Checking metrics endpoint...');

    try {
      const response = await fetch(`${url}/metrics`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();

        this.results.push({
          name: 'Metrics Endpoint',
          status: 'pass',
          duration: 0,
          message: 'Metrics endpoint accessible',
          details: data,
          timestamp: new Date(),
        });

        console.log('✅ Metrics endpoint OK\n');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.results.push({
        name: 'Metrics Endpoint',
        status: 'warn',
        duration: 0,
        message: `Metrics endpoint check failed: ${error}`,
        timestamp: new Date(),
      });

      console.warn(`⚠️  Metrics endpoint: ${error}\n`);
    }
  }

  /**
   * Generate health report
   */
  private generateReport(endTime: Date): HealthReport {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    // Calculate response time metrics
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const metrics = {
      avgResponseTime: this.average(this.responseTimes),
      p50ResponseTime: this.percentile(sortedTimes, 50),
      p95ResponseTime: this.percentile(sortedTimes, 95),
      p99ResponseTime: this.percentile(sortedTimes, 99),
      errorRate: total > 0 ? (failed / total) * 100 : 0,
      totalRequests: this.responseTimes.length,
      successfulRequests: passed,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failed > 0) {
      overallStatus = 'unhealthy';
    } else if (warnings > 0 || successRate < this.config.threshold) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      environment: this.config.environment,
      startTime: this.startTime,
      endTime,
      duration: endTime.getTime() - this.startTime.getTime(),
      overallStatus,
      results: this.results,
      summary: { total, passed, failed, warnings, successRate },
      metrics,
    };
  }

  /**
   * Print health check summary
   */
  private printSummary(report: HealthReport): void {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ClaudeFlare Health Check Report               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Environment:     ${report.environment}`);
    console.log(`Overall Status:  ${report.overallStatus.toUpperCase()}`);
    console.log(`Duration:        ${report.duration}ms`);
    console.log(`Success Rate:    ${report.summary.successRate.toFixed(2)}%`);
    console.log('');
    console.log('Checks:');
    console.log('');

    for (const result of report.results) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`  ${icon} ${result.name}: ${result.message}`);
    }

    console.log('');
    console.log('Response Time Metrics:');
    console.log(`  Average: ${report.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`  P50:     ${report.metrics.p50ResponseTime.toFixed(2)}ms`);
    console.log(`  P95:     ${report.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99:     ${report.metrics.p99ResponseTime.toFixed(2)}ms`);
    console.log(`  Error Rate: ${report.metrics.errorRate.toFixed(2)}%`);
    console.log('');

    if (report.overallStatus === 'healthy') {
      console.log('✅ System is healthy!');
    } else if (report.overallStatus === 'degraded') {
      console.log('⚠️  System is degraded. Review warnings above.');
    } else {
      console.log('❌ System is unhealthy. Review failures above.');
    }

    console.log('');
  }

  /**
   * Save report to file
   */
  async saveReport(report: HealthReport): Promise<void> {
    await writeFile(this.config.outputFile!, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to ${this.config.outputFile}`);
  }

  /**
   * Get deployment URL based on environment
   */
  private getDeploymentUrl(): string {
    switch (this.config.environment) {
      case 'production':
        return 'https://claudeflare.workers.dev';
      case 'staging':
        return 'https://staging.claudeflare.workers.dev';
      case 'development':
        return 'http://localhost:8787';
      default:
        throw new Error(`Unknown environment: ${this.config.environment}`);
    }
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

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(): HealthCheckConfig {
  const args = process.argv.slice(2);
  const config: Partial<HealthCheckConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--environment':
      case '-e':
        config.environment = (nextArg || 'production') as HealthCheckConfig['environment'];
        i++;
        break;
      case '--url':
      case '-u':
        config.url = nextArg;
        i++;
        break;
      case '--timeout':
      case '-t':
        config.timeout = parseInt(nextArg || '10000', 10);
        i++;
        break;
      case '--retries':
      case '-r':
        config.retries = parseInt(nextArg || '3', 10);
        i++;
        break;
      case '--threshold':
        config.threshold = parseInt(nextArg || '99', 10);
        i++;
        break;
      case '--duration':
      case '-d':
        config.duration = parseInt(nextArg || '60', 10);
        i++;
        break;
      case '--interval':
      case '-i':
        config.interval = parseInt(nextArg || '5', 10);
        i++;
        break;
      case '--quiet':
      case '-q':
        config.verbose = false;
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

  if (!config.environment) {
    config.environment = 'production';
  }

  return config as HealthCheckConfig;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ClaudeFlare Health Check Script

Usage: tsx scripts/health-check.ts [options]

Options:
  -e, --environment <env>   Target environment (development, staging, production) [default: production]
  -u, --url <url>           Custom URL to check
  -t, --timeout <ms>        Request timeout in milliseconds [default: 10000]
  -r, --retries <num>       Number of retries [default: 3]
      --threshold <num>     Success rate threshold (0-100) [default: 99]
  -d, --duration <sec>      Total check duration in seconds [default: 60]
  -i, --interval <sec>      Check interval in seconds [default: 5]
  -q, --quiet               Reduce output verbosity
  -o, --output <path>       Save report to file
  -h, --help                Show this help message

Examples:
  tsx scripts/health-check.ts --environment staging
  tsx scripts/health-check.ts --url https://api.example.com --duration 120
  tsx scripts/health-check.ts -e production --threshold 95 --output health-report.json
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    const checker = new HealthChecker(config);
    await checker.run();
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { HealthChecker, HealthCheckConfig, HealthReport, HealthCheckResult };
