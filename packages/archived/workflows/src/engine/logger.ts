/**
 * Execution Logger for workflow execution
 */

import type { ExecutionId, ExecutionLog } from '../types';

export class ExecutionLogger {
  private executionId: ExecutionId;
  private logs: ExecutionLog[] = [];

  constructor(executionId: ExecutionId) {
    this.executionId = executionId;
  }

  /**
   * Log a debug message
   */
  public debug(message: string, data?: any): void {
    this.addLog('debug', message, data);
  }

  /**
   * Log an info message
   */
  public info(message: string, data?: any): void {
    this.addLog('info', message, data);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, data?: any): void {
    this.addLog('warn', message, data);
  }

  /**
   * Log an error message
   */
  public error(message: string, data?: any): void {
    this.addLog('error', message, data);
  }

  /**
   * Add a log entry
   */
  private addLog(level: ExecutionLog['level'], message: string, data?: any): void {
    const log: ExecutionLog = {
      level,
      message,
      timestamp: new Date(),
      data
    };

    this.logs.push(log);
  }

  /**
   * Get all logs
   */
  public getLogs(): ExecutionLog[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: ExecutionLog['level']): ExecutionLog[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs since a specific timestamp
   */
  public getLogsSince(timestamp: Date): ExecutionLog[] {
    return this.logs.filter(log => log.timestamp >= timestamp);
  }

  /**
   * Clear all logs
   */
  public clear(): void {
    this.logs = [];
  }

  /**
   * Get log count
   */
  public getCount(): number {
    return this.logs.length;
  }

  /**
   * Get logs as JSON
   */
  public toJSON(): any {
    return {
      executionId: this.executionId,
      logs: this.logs,
      count: this.logs.length
    };
  }
}
