/**
 * Spinner wrapper around ora with enhanced features
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface SpinnerOptions {
  text: string;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
  spinner?: string | Ora;
  isSilent?: boolean;
}

export class Spinner {
  private ora: Ora;
  private startTime: number;
  private isSilent: boolean;

  constructor(options: SpinnerOptions) {
    this.isSilent = options.isSilent ?? false;
    this.startTime = Date.now();

    this.ora = ora({
      text: options.text,
      color: options.color ?? 'cyan',
      spinner: typeof options.spinner === 'string' ? options.spinner : undefined,
      isSilent: this.isSilent,
    });
  }

  start(): Spinner {
    if (!this.isSilent) {
      this.ora.start();
    }
    return this;
  }

  succeed(text?: string): Spinner {
    if (text) {
      this.ora.succeed(chalk.green(text));
    } else {
      this.ora.succeed();
    }
    return this;
  }

  fail(text?: string): Spinner {
    if (text) {
      this.ora.fail(chalk.red(text));
    } else {
      this.ora.fail();
    }
    return this;
  }

  warn(text?: string): Spinner {
    if (text) {
      this.ora.warn(chalk.yellow(text));
    } else {
      this.ora.warn();
    }
    return this;
  }

  info(text?: string): Spinner {
    if (text) {
      this.ora.info(chalk.blue(text));
    } else {
      this.ora.info();
    }
    return this;
  }

  stop(): Spinner {
    this.ora.stop();
    return this;
  }

  clear(): Spinner {
    this.ora.clear();
    return this;
  }

  update(text: string): Spinner {
    if (!this.isSilent) {
      this.ora.text = text;
    }
    return this;
  }

  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  // Static helper methods
  static wait(text: string, fn: () => Promise<void> | void): Promise<void> {
    const spinner = new Spinner({ text });
    spinner.start();

    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then(() => spinner.succeed());
      }
      spinner.succeed();
      return Promise.resolve();
    } catch (error) {
      spinner.fail();
      throw error;
    }
  }
}

export function createSpinner(options: SpinnerOptions): Spinner {
  return new Spinner(options);
}
