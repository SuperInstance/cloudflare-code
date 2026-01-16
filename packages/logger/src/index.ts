/**
 * Logger stub for ClaudeFlare
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  debug(message: string, ...args: any[]): void {
    // Stub implementation
  }

  info(message: string, ...args: any[]): void {
    // Stub implementation
  }

  warn(message: string, ...args: any[]): void {
    // Stub implementation
  }

  error(message: string, ...args: any[]): void {
    // Stub implementation
  }

  setLevel(level: LogLevel): void {
    // Stub implementation
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }
}
