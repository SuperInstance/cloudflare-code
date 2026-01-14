/**
 * Cron expression parser
 * Supports standard 5-part and extended 6-part cron expressions
 * Provides next execution calculation, validation, and human-readable descriptions
 */

import {
  CronExpression,
  CronParts,
  CronValidationResult,
  NextExecution,
  CronDescription,
  ExecutionHistoryEntry,
  TimeZone
} from '../types';

/**
 * Cron parser class
 */
export class CronParser {
  private static readonly DEFAULT_CRON = '0 * * * *';
  private static readonly MAX_LOOKAhead = 100;
  private static readonly MAX_HISTORY_SIZE = 1000;

  /**
   * Parse a cron expression into its components
   */
  static parse(expression: CronExpression): CronParts {
    const parts = expression.trim().split(/\s+/);

    if (parts.length < 5 || parts.length > 6) {
      throw new Error(
        `Invalid cron expression: expected 5 or 6 parts, got ${parts.length}`
      );
    }

    // Handle 6-part expression (seconds included)
    const startIndex = parts.length === 6 ? 1 : 0;

    return {
      minute: this.parsePart(parts[startIndex], 0, 59),
      hour: this.parsePart(parts[startIndex + 1], 0, 23),
      dayOfMonth: this.parsePart(parts[startIndex + 2], 1, 31),
      month: this.parsePart(parts[startIndex + 3], 1, 12),
      dayOfWeek: this.parsePart(parts[startIndex + 4], 0, 6)
    };
  }

  /**
   * Parse a single part of a cron expression
   */
  private static parsePart(part: string, min: number, max: number): number[] {
    const values: Set<number> = new Set();

    // Handle wildcard
    if (part === '*') {
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
      return Array.from(values).sort((a, b) => a - b);
    }

    // Handle lists (comma-separated)
    const listItems = part.split(',');

    for (const item of listItems) {
      // Handle ranges with step (e.g., 1-5/2 or */5)
      if (item.includes('/')) {
        const [range, stepStr] = item.split('/');
        const step = parseInt(stepStr, 10);

        if (isNaN(step) || step <= 0) {
          throw new Error(`Invalid step value: ${stepStr}`);
        }

        let rangeStart: number;
        let rangeEnd: number;

        if (range === '*') {
          rangeStart = min;
          rangeEnd = max;
        } else if (range.includes('-')) {
          [rangeStart, rangeEnd] = range.split('-').map(Number);
        } else {
          rangeStart = parseInt(range, 10);
          rangeEnd = max;
        }

        if (rangeStart < min || rangeEnd > max) {
          throw new Error(`Range ${rangeStart}-${rangeEnd} out of bounds [${min}, ${max}]`);
        }

        for (let i = rangeStart; i <= rangeEnd; i += step) {
          if (i >= min && i <= max) {
            values.add(i);
          }
        }
      }
      // Handle ranges (e.g., 1-5)
      else if (item.includes('-')) {
        const [start, end] = item.split('-').map(Number);

        if (start < min || end > max) {
          throw new Error(`Range ${start}-${end} out of bounds [${min}, ${max}]`);
        }

        for (let i = start; i <= end; i++) {
          values.add(i);
        }
      }
      // Handle single values
      else {
        const value = parseInt(item, 10);

        if (isNaN(value)) {
          throw new Error(`Invalid value: ${item}`);
        }

        if (value < min || value > max) {
          throw new Error(`Value ${value} out of bounds [${min}, ${max}]`);
        }

        values.add(value);
      }
    }

    const result = Array.from(values).sort((a, b) => a - b);

    if (result.length === 0) {
      throw new Error(`No valid values for part: ${part}`);
    }

    return result;
  }

  /**
   * Validate a cron expression
   */
  static validate(expression: CronExpression): CronValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parts = expression.trim().split(/\s+/);

      if (parts.length < 5) {
        errors.push('Expression has too few parts (minimum 5)');
        return { valid: false, errors, warnings };
      }

      if (parts.length > 6) {
        errors.push('Expression has too many parts (maximum 6)');
        return { valid: false, errors, warnings };
      }

      // Try to parse each part
      const startIndex = parts.length === 6 ? 1 : 0;

      try {
        this.parsePart(parts[startIndex], 0, 59);
      } catch (e) {
        errors.push(`Invalid minute part: ${(e as Error).message}`);
      }

      try {
        this.parsePart(parts[startIndex + 1], 0, 23);
      } catch (e) {
        errors.push(`Invalid hour part: ${(e as Error).message}`);
      }

      try {
        this.parsePart(parts[startIndex + 2], 1, 31);
      } catch (e) {
        errors.push(`Invalid day of month part: ${(e as Error).message}`);
      }

      try {
        this.parsePart(parts[startIndex + 3], 1, 12);
      } catch (e) {
        errors.push(`Invalid month part: ${(e as Error).message}`);
      }

      try {
        this.parsePart(parts[startIndex + 4], 0, 6);
      } catch (e) {
        errors.push(`Invalid day of week part: ${(e as Error).message}`);
      }

      // Check for common mistakes
      if (parts[startIndex + 2] === '31' && parts[startIndex + 3] === '2') {
        warnings.push('February 31st does not exist in any year');
      }

      if (errors.length === 0) {
        return {
          valid: true,
          errors: [],
          warnings,
          normalizedExpression: this.normalize(expression)
        };
      }
    } catch (e) {
      errors.push(`Unexpected error: ${(e as Error).message}`);
    }

    return { valid: false, errors, warnings };
  }

  /**
   * Normalize a cron expression
   */
  static normalize(expression: CronExpression): CronExpression {
    const parsed = this.parse(expression);
    const parts = [
      this.normalizePart(parsed.minute, 0, 59),
      this.normalizePart(parsed.hour, 0, 23),
      this.normalizePart(parsed.dayOfMonth, 1, 31),
      this.normalizePart(parsed.month, 1, 12),
      this.normalizePart(parsed.dayOfWeek, 0, 6)
    ];

    return parts.join(' ');
  }

  /**
   * Normalize a parsed part back to a string
   */
  private static normalizePart(values: number[], min: number, max: number): string {
    if (values.length === 0) {
      return '*';
    }

    // Check if it's all values (wildcard)
    if (values.length === max - min + 1) {
      let isAll = true;
      for (let i = min; i <= max; i++) {
        if (!values.includes(i)) {
          isAll = false;
          break;
        }
      }
      if (isAll) {
        return '*';
      }
    }

    // Check for patterns that can be simplified
    const ranges: string[] = [];
    let startRange = values[0];
    let prevValue = values[0];

    for (let i = 1; i < values.length; i++) {
      if (values[i] === prevValue + 1) {
        prevValue = values[i];
      } else {
        // End of range
        if (startRange === prevValue) {
          ranges.push(startRange.toString());
        } else {
          ranges.push(`${startRange}-${prevValue}`);
        }
        startRange = values[i];
        prevValue = values[i];
      }
    }

    // Add final range
    if (startRange === prevValue) {
      ranges.push(startRange.toString());
    } else {
      ranges.push(`${startRange}-${prevValue}`);
    }

    return ranges.join(',');
  }

  /**
   * Calculate the next execution time
   */
  static nextExecution(
    expression: CronExpression,
    from: Date = new Date(),
    timeZone: TimeZone = 'UTC'
  ): NextExecution {
    const parsed = this.parse(expression);
    const normalized = this.normalize(expression);

    let current = new Date(from.getTime());
    current.setSeconds(0, 0);

    // Advance to the next minute
    current.setMinutes(current.getMinutes() + 1);

    let maxIterations = 1000; // Prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const minute = current.getMinutes();
      const hour = current.getHours();
      const dayOfMonth = current.getDate();
      const month = current.getMonth() + 1;
      const dayOfWeek = current.getDay();

      // Check if current time matches all parts
      if (
        parsed.minute.includes(minute) &&
        parsed.hour.includes(hour) &&
        parsed.dayOfMonth.includes(dayOfMonth) &&
        parsed.month.includes(month) &&
        parsed.dayOfWeek.includes(dayOfWeek)
      ) {
        return {
          timestamp: current,
          originalExpression: expression,
          normalizedExpression: normalized,
          timeZone
        };
      }

      // Advance to next minute
      current.setMinutes(current.getMinutes() + 1);

      // Handle month overflow
      if (current.getMonth() + 1 > 12) {
        current.setFullYear(current.getFullYear() + 1);
        current.setMonth(0);
      }

      // Handle day overflow
      const daysInMonth = this.getDaysInMonth(
        current.getFullYear(),
        current.getMonth() + 1
      );
      if (current.getDate() > daysInMonth) {
        current.setDate(1);
        current.setMonth(current.getMonth() + 1);
      }
    }

    throw new Error('Could not find next execution time within limit');
  }

  /**
   * Calculate multiple next execution times
   */
  static nextExecutions(
    expression: CronExpression,
    count: number,
    from: Date = new Date(),
    timeZone: TimeZone = 'UTC'
  ): Date[] {
    const executions: Date[] = [];
    let current = from;

    for (let i = 0; i < count; i++) {
      const next = this.nextExecution(expression, current, timeZone);
      executions.push(next.timestamp);
      current = new Date(next.timestamp.getTime() + 1000); // Move past this execution
    }

    return executions;
  }

  /**
   * Get previous execution time
   */
  static previousExecution(
    expression: CronExpression,
    from: Date = new Date(),
    timeZone: TimeZone = 'UTC'
  ): Date {
    const parsed = this.parse(expression);
    let current = new Date(from.getTime());
    current.setSeconds(0, 0);

    // Go back one minute
    current.setMinutes(current.getMinutes() - 1);

    let maxIterations = 1000;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const minute = current.getMinutes();
      const hour = current.getHours();
      const dayOfMonth = current.getDate();
      const month = current.getMonth() + 1;
      const dayOfWeek = current.getDay();

      if (
        parsed.minute.includes(minute) &&
        parsed.hour.includes(hour) &&
        parsed.dayOfMonth.includes(dayOfMonth) &&
        parsed.month.includes(month) &&
        parsed.dayOfWeek.includes(dayOfWeek)
      ) {
        return current;
      }

      // Go back one minute
      current.setMinutes(current.getMinutes() - 1);

      // Handle month underflow
      if (current.getMonth() < 0) {
        current.setFullYear(current.getFullYear() - 1);
        current.setMonth(11);
      }

      // Handle day underflow
      if (current.getDate() < 1) {
        current.setMonth(current.getMonth() - 1);
        const daysInMonth = this.getDaysInMonth(
          current.getFullYear(),
          current.getMonth() + 1
        );
        current.setDate(daysInMonth);
      }
    }

    throw new Error('Could not find previous execution time within limit');
  }

  /**
   * Get days in month
   */
  private static getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Generate a human-readable description
   */
  static describe(
    expression: CronExpression,
    timeZone: TimeZone = 'UTC',
    count: number = 5
  ): CronDescription {
    const parsed = this.parse(expression);
    const description = this.generateDescription(parsed);

    const nextExecutions = this.nextExecutions(expression, count, new Date(), timeZone);
    const previousExecutions: Date[] = [];

    for (let i = 0; i < Math.min(count, 10); i++) {
      try {
        const from = i === 0 ? new Date() : previousExecutions[i - 1];
        previousExecutions.push(this.previousExecution(expression, from, timeZone));
      } catch {
        break;
      }
    }

    return {
      expression,
      description,
      nextExecutions,
      previousExecutions: previousExecutions.reverse(),
      timeZone
    };
  }

  /**
   * Generate human-readable description from parsed parts
   */
  private static generateDescription(parts: CronParts): string {
    const minuteDesc = this.describePart(parts.minute, 'minute');
    const hourDesc = this.describePart(parts.hour, 'hour');
    const dayOfMonthDesc = this.describePart(parts.dayOfMonth, 'day of month');
    const monthDesc = this.describePart(parts.month, 'month');
    const dayOfWeekDesc = this.describePart(parts.dayOfWeek, 'day of week');

    let description = '';

    // Special cases
    if (parts.minute.length === 1 && parts.hour.length === 1) {
      description = `At ${String(parts.hour[0]).padStart(2, '0')}:${String(parts.minute[0]).padStart(2, '0')}`;
    } else if (parts.hour.length === 24 && parts.minute.length === 1) {
      description = `Every hour at minute ${parts.minute[0]}`;
    } else if (parts.minute.length === 60 && parts.hour.length === 1) {
      description = `Every minute of hour ${parts.hour[0]}`;
    } else if (parts.minute.length === 60 && parts.hour.length === 24) {
      description = 'Every minute';
    } else {
      description = `At ${minuteDesc} past ${hourDesc}`;
    }

    // Add day/month constraints
    if (parts.dayOfMonth.length < 31 || parts.dayOfWeek.length < 7) {
      if (parts.dayOfMonth.length === 31 && parts.dayOfWeek.length < 7) {
        description += `, on ${dayOfWeekDesc}`;
      } else if (parts.dayOfMonth.length < 31 && parts.dayOfWeek.length === 7) {
        description += `, on day ${dayOfMonthDesc} of the month`;
      } else {
        description += `, on day ${dayOfMonthDesc} of the month or ${dayOfWeekDesc}`;
      }
    }

    // Add month constraints
    if (parts.month.length < 12) {
      description += `, in ${monthDesc}`;
    }

    return description;
  }

  /**
   * Describe a single part
   */
  private static describePart(values: number[], unit: string): string {
    if (values.length === 1) {
      return `${values[0]}`;
    }

    if (this.isConsecutiveRange(values)) {
      return `${values[0]}-${values[values.length - 1]}`;
    }

    if (values.length <= 3) {
      return values.join(', ');
    }

    return `specific ${unit}s`;
  }

  /**
   * Check if values form a consecutive range
   */
  private static isConsecutiveRange(values: number[]): boolean {
    if (values.length < 2) {
      return false;
    }

    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1] + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a time matches a cron expression
   */
  static matches(expression: CronExpression, time: Date): boolean {
    try {
      const parsed = this.parse(expression);

      return (
        parsed.minute.includes(time.getMinutes()) &&
        parsed.hour.includes(time.getHours()) &&
        parsed.dayOfMonth.includes(time.getDate()) &&
        parsed.month.includes(time.getMonth() + 1) &&
        parsed.dayOfWeek.includes(time.getDay())
      );
    } catch {
      return false;
    }
  }

  /**
   * Calculate execution history for a time range
   */
  static getExecutionHistory(
    expression: CronExpression,
    start: Date,
    end: Date,
    timeZone: TimeZone = 'UTC'
  ): ExecutionHistoryEntry[] {
    const history: ExecutionHistoryEntry[] = [];
    const parsed = this.parse(expression);

    let current = this.nextExecution(expression, start, timeZone).timestamp;
    let count = 0;

    while (current < end && count < this.MAX_HISTORY_SIZE) {
      history.push({
        jobId: '',
        jobName: '',
        executionTime: current,
        scheduledTime: current,
        completedAt: current,
        status: 'completed' as any,
        duration: 0,
        attemptNumber: 1,
        node: ''
      });

      current = this.nextExecution(expression, current, timeZone).timestamp;
      count++;
    }

    return history;
  }

  /**
   * Get time until next execution
   */
  static getTimeUntilNextExecution(
    expression: CronExpression,
    from: Date = new Date(),
    timeZone: TimeZone = 'UTC'
  ): number {
    const next = this.nextExecution(expression, from, timeZone);
    return next.timestamp.getTime() - from.getTime();
  }

  /**
   * Check if execution is due
   */
  static isDue(expression: CronExpression, from: Date = new Date(), timeZone: TimeZone = 'UTC'): boolean {
    try {
      const next = this.nextExecution(expression, from, timeZone);
      return next.timestamp.getTime() <= from.getTime();
    } catch {
      return false;
    }
  }
}
