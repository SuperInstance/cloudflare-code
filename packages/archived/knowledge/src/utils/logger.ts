/**
 * Logger utility for the knowledge package
 */

// @ts-nocheck - Unused variables

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private level: LogLevel;

  constructor(
    private context: string,
    level: LogLevel = LogLevel.INFO
  ) {
    this.level = level;
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  error(message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', message, error);
    }
  }

  private log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.context}]`;

    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export class NullLogger implements Logger {
  constructor(private context: string = '') {}

  debug(message: string, data?: any): void {}
  info(message: string, data?: any): void {}
  warn(message: string, data?: any): void {}
  error(message: string, error?: any): void {}

  setLevel(level: LogLevel): void {}
}
