/**
 * Performance Metrics Formatter
 *
 * Formats performance metrics for display
 */

export class MetricsFormatter {
  /**
   * Format duration in human-readable format
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    } else if (ms < 60000) {
      const seconds = ms / 1000;
      return `${seconds.toFixed(2)}s`;
    } else {
      const minutes = ms / 60000;
      const seconds = (ms % 60000) / 1000;
      return `${Math.floor(minutes)}m ${seconds.toFixed(1)}s`;
    }
  }

  /**
   * Format bytes in human-readable format
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)}${units[unitIndex]}`;
  }

  /**
   * format percentage
   */
  static formatPercentage(value: number, decimals = 2): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format throughput
   */
  static formatThroughput(opsPerSecond: number): string {
    if (opsPerSecond >= 1000000) {
      return `${(opsPerSecond / 1000000).toFixed(2)}M ops/s`;
    } else if (opsPerSecond >= 1000) {
      return `${(opsPerSecond / 1000).toFixed(2)}K ops/s`;
    } else {
      return `${opsPerSecond.toFixed(2)} ops/s`;
    }
  }

  /**
   * Format request rate
   */
  static formatRequestRate(reqPerSec: number): string {
    if (reqPerSec >= 1000) {
      return `${(reqPerSec / 1000).toFixed(2)}K req/s`;
    } else {
      return `${reqPerSec.toFixed(2)} req/s`;
    }
  }

  /**
   * Format latency percentile
   */
  static formatPercentile(label: string, value: number): string {
    return `${label}: ${value.toFixed(2)}ms`;
  }

  /**
   * Format metric with trend
   */
  static formatWithTrend(
    label: string,
    current: number,
    previous?: number,
    unit = '',
    lowerIsBetter = true
  ): string {
    let result = `${label}: ${current.toFixed(2)}${unit}`;

    if (previous !== undefined) {
      const change = ((current - previous) / previous) * 100;
      const symbol = change > 0 ? '↑' : change < 0 ? '↓' : '→';
      const good = lowerIsBetter ? change < 0 : change > 0;
      const emoji = good ? '✅' : '⚠️';

      result += ` ${emoji} ${symbol} ${Math.abs(change).toFixed(1)}%`;
    }

    return result;
  }

  /**
   * Format table
   */
  static formatTable(headers: string[], rows: string[][]): string {
    // Calculate column widths
    const colWidths = headers.map((h, i) => {
      const maxRowWidth = Math.max(...rows.map((r) => r[i]?.length || 0));
      return Math.max(h.length, maxRowWidth);
    });

    // Format header
    let table = '|';
    for (let i = 0; i < headers.length; i++) {
      table += ` ${headers[i].padEnd(colWidths[i])} |`;
    }
    table += '\n';

    // Format separator
    table += '|';
    for (let i = 0; i < headers.length; i++) {
      table += ` ${'-'.repeat(colWidths[i])} |`;
    }
    table += '\n';

    // Format rows
    for (const row of rows) {
      table += '|';
      for (let i = 0; i < row.length; i++) {
        table += ` ${row[i].padEnd(colWidths[i])} |`;
      }
      table += '\n';
    }

    return table;
  }

  /**
   * Format comparison
   */
  static formatComparison(
    baseline: number,
    current: number,
    unit = '',
    lowerIsBetter = true
  ): string {
    const change = ((current - baseline) / baseline) * 100;
    const improvement = lowerIsBetter ? current < baseline : current > baseline;
    const emoji = improvement ? '✅' : '⚠️';
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';

    return `${emoji} ${baseline.toFixed(2)}${unit} → ${current.toFixed(2)}${unit} (${arrow} ${Math.abs(change).toFixed(1)}%)`;
  }

  /**
   * Format memory snapshot
   */
  static formatMemorySnapshot(heapUsed: number, heapTotal: number): string {
    const used = this.formatBytes(heapUsed);
    const total = this.formatBytes(heapTotal);
    const percentage = (heapUsed / heapTotal) * 100;

    return `Heap: ${used} / ${total} (${percentage.toFixed(1)}%)`;
  }

  /**
   * Format CPU usage
   */
  static formatCpuUsage(cpuUsage: number): string {
    return `CPU: ${(cpuUsage * 100).toFixed(1)}%`;
  }

  /**
   * Format event loop lag
   */
  static formatEventLoopLag(lag: number): string {
    if (lag < 10) {
      return `Event Loop: ${lag.toFixed(2)}ms ✅`;
    } else if (lag < 50) {
      return `Event Loop: ${lag.toFixed(2)}ms ⚠️`;
    } else {
      return `Event Loop: ${lag.toFixed(2)}ms 🚨`;
    }
  }

  /**
   * Format benchmark result
   */
  static formatBenchmarkResult(result: {
    name: string;
    avgTime: number;
    minTime: number;
    maxTime: number;
    opsPerSecond: number;
    stdDev: number;
  }): string {
    const lines = [
      `**${result.name}**`,
      `  Average: ${this.formatDuration(result.avgTime)}`,
      `  Min: ${this.formatDuration(result.minTime)}`,
      `  Max: ${this.formatDuration(result.maxTime)}`,
      `  Throughput: ${this.formatThroughput(result.opsPerSecond)}`,
      `  Std Dev: ${result.stdDev.toFixed(4)}ms`,
    ];

    return lines.join('\n');
  }

  /**
   * Format load test result
   */
  static formatLoadTestResult(result: {
    name: string;
    latency: { mean: number; p95: number; p99: number };
    throughput: { mean: number };
    requests: { total: number; failed: number };
  }): string {
    const errorRate = (result.requests.failed / result.requests.total) * 100;

    const lines = [
      `**${result.name}**`,
      `  Throughput: ${this.formatRequestRate(result.throughput.mean)}`,
      `  Latency (mean): ${this.formatDuration(result.latency.mean)}`,
      `  Latency (p95): ${this.formatDuration(result.latency.p95)}`,
      `  Latency (p99): ${this.formatDuration(result.latency.p99)}`,
      `  Errors: ${result.requests.failed}/${result.requests.total} (${errorRate.toFixed(2)}%)`,
    ];

    return lines.join('\n');
  }

  /**
   * Colorize for terminal (if supported)
   */
  static colorize(text: string, color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'): string {
    const colors = {
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      blue: '\x1b[34m',
      gray: '\x1b[90m',
      reset: '\x1b[0m',
    };

    // Only colorize if in terminal
    if (process.stdout.isTTY) {
      return `${colors[color]}${text}${colors.reset}`;
    }

    return text;
  }

  /**
   * Format progress bar
   */
  static formatProgressBar(current: number, total: number, width = 40): string {
    const percentage = (current / total) * 100;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const text = `${bar} ${percentage.toFixed(0)}%`;

    if (percentage >= 100) {
      return this.colorize(text, 'green');
    } else if (percentage >= 50) {
      return this.colorize(text, 'yellow');
    } else {
      return this.colorize(text, 'red');
    }
  }
}

export default MetricsFormatter;
