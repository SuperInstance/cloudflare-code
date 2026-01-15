/**
 * Metrics command - Monitor application performance metrics
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { setInterval } from 'timers/promises';
import {
  createLogger,
  createSpinner,
  createProgressBar,
  TableFormatter,
} from '../utils/index.js';

export interface MetricsOptions {
  project?: string;
  environment?: 'production' | 'preview' | 'development';
  duration?: string;
  interval?: number;
  output?: 'table' | 'json' | 'csv';
  realtime?: boolean;
  filter?: string[];
  metric?: string[];
  debug?: boolean;
}

export interface MetricData {
  timestamp: number;
  project: string;
  environment: string;
  requests: number;
  errors: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  compute: {
    cpu: number;
    memory: number;
    network: number;
  };
  storage: {
    kv: {
      reads: number;
      writes: number;
      size: number;
    };
    r2: {
      reads: number;
      writes: number;
      size: number;
    };
  };
  agents: {
    active: number;
    total: number;
    averageResponseTime: number;
  };
  tokens: {
    used: number;
    remaining: number;
    cost: number;
  };
}

export interface MetricsSummary {
  period: string;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  computeUtilization: number;
  storageUsage: {
    kv: number;
    r2: number;
  };
  agentActivity: {
    peakActive: number;
    averageActive: number;
  };
  tokenUsage: {
    total: number;
    cost: number;
  };
}

export async function metricsCommand(options: MetricsOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Initializing metrics collection...',
    color: 'cyan',
  });

  try {
    // Validate authentication
    const configPath = getAuthConfigPath();
    if (!existsSync(configPath)) {
      spinner.fail('Not authenticated');
      throw new Error('Run `claudeflare auth login` to authenticate first');
    }

    const authConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!authConfig.claudeflare?.accessToken) {
      spinner.fail('No access token found');
      throw new Error('Run `claudeflare auth login` to authenticate');
    }

    // Parse options
    const project = options.project || 'default';
    const environment = options.environment || 'production';
    const duration = parseDuration(options.duration || '5m');
    const interval = options.interval || 5000; // 5 seconds
    const outputFormat = options.output || 'table';

    spinner.start('Initializing metrics collector...');

    // Initialize metrics collector
    const metricsCollector = new MetricsCollector(authConfig.claudeflare.accessToken);
    const metricsStorage = new MetricsStorage();

    spinner.succeed('Metrics collector initialized');

    // Set up real-time display
    if (options.realtime) {
      await metricsRealtime(metricsCollector, options);
    } else {
      await metricsCollection(metricsCollector, metricsStorage, project, environment, duration, interval, options);
    }

  } catch (error) {
    spinner.fail('Metrics collection failed');

    if (error instanceof Error) {
      logger.error(error.message);

      if (options.debug && error.stack) {
        logger.debug(error.stack);
      }
    }

    process.exit(1);
  }
}

/**
 * Real-time metrics display
 */
async function metricsRealtime(collector: MetricsCollector, options: MetricsOptions): Promise<void> {
  const logger = createLogger();
  const progressBar = createProgressBar({
    format: 'Processing [:bar] :percent :etas',
    complete: '=',
    incomplete: '-',
    width: 40,
    total: 100,
  });

  console.log('\n📊 Real-time Metrics\n');

  try {
    for await (const metrics of collector.streamMetrics()) {
      clearScreen();

      console.log('📊 Real-time Metrics - Last Update: ' + new Date().toLocaleTimeString());
      console.log('─'.repeat(80));

      if (options.output === 'json') {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        displayMetricsTable(metrics);
      }

      progressBar.tick(10);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'KeyboardInterrupt') {
      throw error;
    }
  }
}

/**
 * Metrics collection and summary
 */
async function metricsCollection(
  collector: MetricsCollector,
  storage: MetricsStorage,
  project: string,
  environment: string,
  duration: number,
  interval: number,
  options: MetricsOptions
): Promise<void> {
  const logger = createLogger();
  const metrics: MetricData[] = [];

  console.log(`📊 Collecting metrics for ${formatDuration(duration)}...\n`);

  try {
    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime) {
      const metric = await collector.fetchMetrics(project, environment, options.metric);
      metrics.push(metric);

      if (options.output === 'json') {
        console.log(JSON.stringify(metric, null, 2));
      } else {
        displayMetricsTable(metric);
      }

      // Store metric
      await storage.store(metric);

      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // Generate summary
    const summary = generateSummary(metrics, options);

    if (options.output === 'csv') {
      console.log(metricsToCsv(metrics));
    } else if (options.output === 'json') {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      displayMetricsSummary(summary);
    }

    // Save metrics to file
    const metricsFile = getMetricsFile();
    writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
    logger.info(`Metrics saved to: ${metricsFile}`);

  } catch (error) {
    if (error instanceof Error && error.message !== 'KeyboardInterrupt') {
      throw error;
    }
  }
}

/**
 * Display metrics in table format
 */
function displayMetricsTable(metrics: MetricData): void {
  console.clear();
  console.log('📊 Live Metrics');
  console.log('─'.repeat(80));

  // Performance metrics
  console.log('\n🚀 Performance');
  console.log(TableFormatter.performance({
    requests: metrics.requests,
    errors: metrics.errors,
    latency: metrics.latency,
  }));

  // Compute metrics
  console.log('\n💻 Compute');
  console.log(TableFormatter.compute({
    cpu: metrics.compute.cpu,
    memory: metrics.compute.memory,
    network: metrics.compute.network,
  }));

  // Storage metrics
  console.log('\n💾 Storage');
  console.log(TableFormatter.storage({
    kv: metrics.storage.kv,
    r2: metrics.storage.r2,
  }));

  // Agent metrics
  console.log('\n🤖 Agent Activity');
  console.log(TableFormatter.agents({
    active: metrics.agents.active,
    total: metrics.agents.total,
    avgResponseTime: metrics.agents.averageResponseTime,
  }));

  // Token metrics
  console.log('\n🎫 Token Usage');
  console.log(TableFormatter.tokens({
    used: metrics.tokens.used,
    remaining: metrics.tokens.remaining,
    cost: metrics.tokens.cost,
  }));
}

/**
 * Display metrics summary
 */
function displayMetricsSummary(summary: MetricsSummary): void {
  console.clear();
  console.log('📊 Metrics Summary');
  console.log('─'.repeat(80));

  console.log('\n📈 Request Statistics');
  console.log(TableFormatter.summary({
    totalRequests: summary.totalRequests,
    totalErrors: summary.totalErrors,
    errorRate: summary.errorRate,
    averageLatency: summary.averageLatency,
    p95Latency: summary.p95Latency,
    p99Latency: summary.p99Latency,
  }));

  console.log('\n💻 Compute Performance');
  console.log(TableFormatter.computePerformance({
    utilization: summary.computeUtilization,
  }));

  console.log('\n💾 Storage Usage');
  console.log(TableFormatter.storageUsage({
    kv: summary.storageUsage.kv,
    r2: summary.storageUsage.r2,
  }));

  console.log('\n🤖 Agent Activity');
  console.log(TableFormatter.agentSummary({
    peakActive: summary.agentActivity.peakActive,
    averageActive: summary.agentActivity.averageActive,
  }));

  console.log('\n🎫 Token Usage');
  console.log(TableFormatter.tokenSummary({
    total: summary.tokenUsage.total,
    cost: summary.tokenUsage.cost,
  }));
}

/**
 * Generate metrics summary
 */
function generateSummary(metrics: MetricData[], options: MetricsOptions): MetricsSummary {
  const period = metrics[0]?.timestamp && metrics[metrics.length - 1]?.timestamp
    ? `${formatDuration((metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 1000)}`
    : 'Unknown';

  const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
  const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

  const latencies = metrics.map(m => m.latency.average);
  const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

  const p95Latency = calculatePercentile(latencies, 95);
  const p99Latency = calculatePercentile(latencies, 99);

  const computeCpu = metrics.map(m => m.compute.cpu);
  const computeUtilization = computeCpu.reduce((sum, c) => sum + c, 0) / computeCpu.length;

  const kvSize = metrics.map(m => m.storage.kv.size);
  const r2Size = metrics.map(m => m.storage.r2.size);

  const activeAgents = metrics.map(m => m.agents.active);
  const peakActive = Math.max(...activeAgents);
  const averageActive = activeAgents.reduce((sum, a) => sum + a, 0) / activeAgents.length;

  const tokensUsed = metrics.reduce((sum, m) => sum + m.tokens.used, 0);
  const tokensCost = metrics.reduce((sum, m) => sum + m.tokens.cost, 0);

  return {
    period,
    totalRequests,
    totalErrors,
    errorRate,
    averageLatency,
    p95Latency,
    p99Latency,
    computeUtilization,
    storageUsage: {
      kv: kvSize[kvSize.length - 1] || 0,
      r2: r2Size[r2Size.length - 1] || 0,
    },
    agentActivity: {
      peakActive,
      averageActive,
    },
    tokenUsage: {
      total: tokensUsed,
      cost: tokensCost,
    },
  };
}

/**
 * Convert metrics to CSV format
 */
function metricsToCsv(metrics: MetricData[]): string {
  const headers = [
    'timestamp', 'project', 'environment', 'requests', 'errors',
    'latency_p50', 'latency_p95', 'latency_p99', 'latency_average',
    'compute_cpu', 'compute_memory', 'compute_network',
    'storage_kv_reads', 'storage_kv_writes', 'storage_kv_size',
    'storage_r2_reads', 'storage_r2_writes', 'storage_r2_size',
    'agents_active', 'agents_total', 'agents_averageResponseTime',
    'tokens_used', 'tokens_remaining', 'tokens_cost'
  ];

  const rows = metrics.map(m => [
    m.timestamp,
    m.project,
    m.environment,
    m.requests,
    m.errors,
    m.latency.p50,
    m.latency.p95,
    m.latency.p99,
    m.latency.average,
    m.compute.cpu,
    m.compute.memory,
    m.compute.network,
    m.storage.kv.reads,
    m.storage.kv.writes,
    m.storage.kv.size,
    m.storage.r2.reads,
    m.storage.r2.writes,
    m.storage.r2.size,
    m.agents.active,
    m.agents.total,
    m.agents.averageResponseTime,
    m.tokens.used,
    m.tokens.remaining,
    m.tokens.cost,
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

/**
 * Metrics Collector class
 */
class MetricsCollector {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async fetchMetrics(project: string, environment: string, metrics?: string[]): Promise<MetricData> {
    const url = new URL('https://api.claudeflare.workers.dev/metrics');
    url.searchParams.set('project', project);
    url.searchParams.set('environment', environment);

    if (metrics?.length) {
      url.searchParams.set('metrics', metrics.join(','));
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    return await response.json();
  }

  async *streamMetrics(): AsyncIterableIterator<MetricData> {
    const url = new URL('https://api.claudeflare.workers.dev/metrics/stream');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to stream metrics: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const metric = JSON.parse(line);
            yield metric;
          } catch (error) {
            console.warn('Failed to parse metric:', line);
          }
        }
      }
    }
  }
}

/**
 * Metrics Storage class
 */
class MetricsStorage {
  async store(metric: MetricData): Promise<void> {
    // In a real implementation, this would store metrics to a database
    // For now, we'll just log them
    console.log(`Stored metric at ${new Date(metric.timestamp).toISOString()}`);
  }
}

/**
 * Helper functions
 */
function getAuthConfigPath(): string {
  const configDir = join(homedir(), '.claudeflare');
  return join(configDir, 'auth.json');
}

function getMetricsFile(): string {
  const configDir = join(homedir(), '.claudeflare');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  return join(configDir, 'metrics.json');
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value * 1000;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[0f');
}

/**
 * Register metrics command with CLI
 */
export function registerMetricsCommand(program: Command): void {
  program
    .command('metrics')
    .description('Monitor application performance metrics')
    .option('-p, --project <name>', 'Project name')
    .option('-e, --environment <env>', 'Environment', 'production')
    .option('-d, --duration <time>', 'Collection duration (e.g., 5m, 1h, 1d)', '5m')
    .option('-i, --interval <ms>', 'Collection interval in milliseconds', '5000')
    .option('-o, --output <format>', 'Output format', 'table')
    .option('--realtime', 'Real-time metrics display')
    .option('--filter <metrics>', 'Filter specific metrics', [])
    .option('--metric <name>', 'Specific metrics to fetch', [])
    .option('--debug', 'Enable debug output')
    .action(metricsCommand);
}