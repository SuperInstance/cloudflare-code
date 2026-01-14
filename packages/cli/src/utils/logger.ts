/**
 * Enhanced logger with color support and formatting
 */

import chalk from 'chalk';

export interface LoggerOptions {
  debug?: boolean;
  verbose?: boolean;
  colors?: boolean;
  timestamp?: boolean;
}

export class Logger {
  private debug: boolean;
  private verbose: boolean;
  private colors: boolean;
  private timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.debug = options.debug ?? false;
    this.verbose = options.verbose ?? false;
    this.colors = options.colors ?? true;
    this.timestamp = options.timestamp ?? false;
  }

  private getTimestamp(): string {
    if (!this.timestamp) return '';
    const now = new Date();
    return `[${now.toISOString()}] `;
  }

  private formatMessage(level: string, message: string, color: chalk.Chalk): string {
    const prefix = color.bold(`[${level}]`);
    return `${this.getTimestamp()}${prefix} ${message}`;
  }

  info(message: string): void {
    console.log(this.formatMessage('INFO', message, chalk.blue));
  }

  success(message: string): void {
    console.log(this.formatMessage('✓', message, chalk.green));
  }

  warn(message: string): void {
    console.warn(this.formatMessage('WARN', message, chalk.yellow));
  }

  error(message: string): void {
    console.error(this.formatMessage('ERROR', message, chalk.red));
  }

  debug(message: string): void {
    if (this.debug) {
      console.debug(this.formatMessage('DEBUG', message, chalk.gray));
    }
  }

  verbose(message: string): void {
    if (this.verbose) {
      console.log(this.formatMessage('VERBOSE', message, chalk.dim));
    }
  }

  // Specialized logging methods
  command(message: string): void {
    console.log(this.formatMessage('$', message,chalk.cyan));
  }

  step(step: number, total: number, message: string): void {
    const progress = chalk.dim(`[${step}/${total}]`);
    console.log(`${progress} ${message}`);
  }

  // Boxed messages
  box(title: string, content: string): void {
    const lines = content.split('\n');
    const maxLength = Math.max(title.length, ...lines.map(l => l.length));
    const border = '─'.repeat(maxLength + 2);

    console.log();
    console.log(chalk.dim('┌' + border + '┐'));
    const titleLine = this.colors ? chalk.bold.white(` ${title.padEnd(maxLength)} `) : ` ${title.padEnd(maxLength)} `;
    console.log(chalk.dim('│') + titleLine + chalk.dim('│'));
    console.log(chalk.dim('├' + border + '┤'));

    for (const line of lines) {
      console.log(chalk.dim('│') + ` ${line.padEnd(maxLength)} ` + chalk.dim('│'));
    }

    console.log(chalk.dim('└' + border + '┘'));
    console.log();
  }

  // Lists and tables
  list(items: string[], title?: string): void {
    if (title) {
      console.log(chalk.bold(title));
    }
    for (const item of items) {
      console.log(`  ${chalk.dim('•')} ${item}`);
    }
    console.log();
  }

  keyvalue(pairs: Record<string, string>): void {
    const maxKeyLength = Math.max(...Object.keys(pairs).map(k => k.length));

    for (const [key, value] of Object.entries(pairs)) {
      const paddedKey = key.padEnd(maxKeyLength);
      console.log(`  ${chalk.cyan(paddedKey)}  ${chalk.dim('→')}  ${value}`);
    }
    console.log();
  }

  // Error with suggestions
  errorWithSolution(error: string, solution: string): void {
    this.error(error);
    console.log();
    console.log(chalk.dim('  💡 ' + chalk.white(solution)));
    console.log();
  }

  // JSON output
  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  // Newline helpers
  newline(): void {
    console.log();
  }

  separator(char: string = '─', length: number = 50): void {
    console.log(chalk.dim(char.repeat(length)));
  }
}

// Create default logger instance
let defaultLogger: Logger | null = null;

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

export function getLogger(options?: LoggerOptions): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger(options);
  }
  return defaultLogger;
}

export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}
