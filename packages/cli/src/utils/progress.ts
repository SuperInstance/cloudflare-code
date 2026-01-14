/**
 * Progress bar wrapper around cli-progress with enhanced features
 */

import chalk from 'chalk';
import * as cliProgress from 'cli-progress';

export interface ProgressBarOptions {
  title?: string;
  titleColor?: (text: string) => string;
  barCompleteChar?: string;
  barIncompleteChar?: string;
  format?: string;
  hideCursor?: boolean;
  clearOnComplete?: boolean;
  stopOnComplete?: true;
  barsize?: number;
  position?: 'top' | 'bottom';
  autopadding?: boolean;
}

export class ProgressBar {
  private bar: cliProgress.SingleBar;
  private currentValue = 0;
  private totalValue: number;

  constructor(total: number, options: ProgressBarOptions = {}) {
    this.totalValue = total;

    const format =
      options.format ??
      '{title} |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | {duration_formatted}';

    this.bar = new cliProgress.SingleBar({
      format,
      barCompleteChar: options.barCompleteChar ?? '\u2588',
      barIncompleteChar: options.barIncompleteChar ?? '\u2591',
      hideCursor: options.hideCursor ?? true,
      clearOnComplete: options.clearOnComplete ?? false,
      stopOnComplete: options.stopOnComplete ?? true,
      barsize: options.barsize ?? 40,
      position: options.position,
      autopadding: options.autopadding ?? true,
      linewrap: true,
    });

    this.bar.start(total, 0, {
      title: options.titleColor ? options.titleColor(options.title ?? '') : options.title ?? '',
    });
  }

  update(value: number, payload?: Record<string, unknown>): void {
    this.currentValue = value;
    this.bar.update(value, payload);
  }

  increment(payload?: Record<string, unknown>): void {
    this.currentValue++;
    this.bar.increment(payload);
  }

  stop(): void {
    this.bar.stop();
  }

  updateTitle(title: string): void {
    this.bar.update(this.currentValue, { title });
  }

  getValue(): number {
    return this.currentValue;
  }

  getTotal(): number {
    return this.totalValue;
  }

  // Static helper methods
  static execute<T>(
    items: T[],
    title: string,
    fn: (item: T, index: number) => Promise<void> | void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const bar = new ProgressBar(items.length, { title });

      let index = 0;
      const processNext = async (): Promise<void> => {
        if (index >= items.length) {
          bar.stop();
          resolve();
          return;
        }

        try {
          await fn(items[index], index);
          bar.increment();
          index++;
          setImmediate(processNext);
        } catch (error) {
          bar.stop();
          reject(error);
        }
      };

      processNext();
    });
  }
}

export function createProgressBar(total: number, options?: ProgressBarOptions): ProgressBar {
  return new ProgressBar(total, options);
}
