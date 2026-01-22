import { createLogger, format, transports } from 'winston';

const { combine, timestamp, errors, json, colorize, printf, cli } = format;

/**
 * Custom log format for console output
 */
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] ${message}`;

  if (stack) {
    log += `\n${stack}`;
  }

  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }

  return log;
});

/**
 * Logger class for the testing framework
 */
export class Logger {
  private logger: any;

  constructor(options: { name: string; level?: string; colorize?: boolean } = { name: 'Default' }) {
    const { name, level = 'info', colorize = true } = options;

    this.logger = createLogger({
      level,
      format: combine(
        errors({ stack: true }),
        timestamp(),
        json()
      ),
      defaultMeta: { service: name },
      transports: [
        new transports.Console({
          format: combine(
            colorize ? colorize() : format.uncolorize(),
            cli(),
            consoleFormat
          )
        }),
        new transports.File({
          filename: 'test-results/logs/test-framework.log',
          format: combine(timestamp(), errors({ stack: true }), json()),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(new transports.File({
      filename: 'test-results/logs/exceptions.log',
      format: combine(timestamp(), json()),
      maxsize: 5242880,
      maxFiles: 5
    }));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', {
        promise: promise,
        reason: reason
      });
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  /**
   * Log verbose message
   */
  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Log silly message
   */
  silly(message: string, meta?: any): void {
    this.logger.silly(message, meta);
  }

  /**
   * Set log level
   */
  setLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.logger.level;
  }

  /**
   * Create child logger with additional metadata
   */
  child(metadata: any): Logger {
    const childLogger = this.logger.child(metadata);
    return new Logger({
      name: this.logger.defaultMeta.service,
      level: this.logger.level,
      colorize: false // Child loggers don't need colorization
    });
  }

  /**
   * Check if logger is enabled for a specific level
   */
  isEnabled(level: string): boolean {
    return this.logger.isLevelEnabled(level);
  }

  /**
   * Log test start
   */
  testStart(testId: string, testName: string): void {
    this.info(`Test started: ${testId}`, { test: testName });
  }

  /**
   * Log test completion
   */
  testComplete(testId: string, testName: string, duration: number, status: string): void {
    this.info(`Test completed: ${testId}`, { test: testName, duration, status });
  }

  /**
   * Log test failure
   */
  testFailure(testId: string, testName: string, error: Error): void {
    this.error(`Test failed: ${testId}`, { test: testName, error: error.message, stack: error.stack });
  }

  /**
   * Log test timeout
   */
  testTimeout(testId: string, testName: string, timeout: number): void {
    this.warn(`Test timed out: ${testId}`, { test: testName, timeout });
  }

  /**
   * Log suite start
   */
  suiteStart(suiteName: string): void {
    this.info(`Suite started: ${suiteName}`);
  }

  /**
   * Log suite completion
   */
  suiteComplete(suiteName: string, duration: number, results: any): void {
    this.info(`Suite completed: ${suiteName}`, { duration, results });
  }

  /**
   * Log test collection
   */
  testCollection(files: string[], count: number): void {
    this.info(`Collected tests from ${files.length} files`, { testCount: count });
  }

  /**
   * Log performance metric
   */
  performanceMetric(name: string, value: number, unit: string, threshold?: number): void {
    const meta = { name, value, unit, threshold };

    if (threshold && value > threshold) {
      this.warn(`Performance metric ${name} exceeded threshold`, meta);
    } else {
      this.info(`Performance metric ${name}`, meta);
    }
  }

  /**
   * Log coverage report
   */
  coverageReport(coverage: any): void {
    this.info('Coverage report', coverage);
  }

  /**
   * Log test execution summary
   */
  executionSummary(total: number, passed: number, failed: number, skipped: number, duration: number): void {
    this.info('Test execution summary', {
      total,
      passed,
      failed,
      skipped,
      duration,
      passRate: (passed / total * 100).toFixed(2) + '%'
    });
  }
}