/**
 * Interactive prompts using inquirer
 */

import chalk from 'chalk';
import { Logger } from './logger.js';

export interface PromptOptions {
  message: string;
  default?: string | number | boolean;
  choices?: Array<string | { name: string; value: string; description?: string }>;
  validate?: (input: string) => boolean | string;
  transform?: (input: string) => string;
  filter?: (input: string) => string;
  when?: boolean | ((answers: Record<string, unknown>) => boolean);
}

export interface ConfirmOptions {
  message: string;
  default?: boolean;
}

export interface ListOptions {
  message: string;
  choices: Array<string | { name: string; value: string; description?: string }>;
  default?: string;
}

export interface CheckboxOptions {
  message: string;
  choices: Array<string | { name: string; value: string; checked?: boolean }>;
  validate?: (input: string[]) => boolean | string;
}

export interface PasswordOptions {
  message: string;
  mask?: string;
  validate?: (input: string) => boolean | string;
}

export class Prompts {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger();
  }

  async input(options: PromptOptions): Promise<string> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'input',
        name: 'input',
        message: options.message,
        default: options.default as string,
        validate: options.validate,
        transformer: options.transform,
        filter: options.filter,
        when: options.when,
      },
    ]);
    return answers.input as string;
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: options.message,
        default: options.default ?? false,
      },
    ]);
    return answers.confirm as boolean;
  }

  async list(options: ListOptions): Promise<string> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'list',
        name: 'list',
        message: options.message,
        choices: options.choices,
        default: options.default,
      },
    ]);
    return answers.list as string;
  }

  async checkbox(options: CheckboxOptions): Promise<string[]> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'checkbox',
        name: 'checkbox',
        message: options.message,
        choices: options.choices,
        validate: options.validate,
      },
    ]);
    return answers.checkbox as string[];
  }

  async password(options: PasswordOptions): Promise<string> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'password',
        name: 'password',
        message: options.message,
        mask: options.mask ?? '●',
        validate: options.validate,
      },
    ]);
    return answers.password as string;
  }

  async number(options: PromptOptions): Promise<number> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'number',
        name: 'number',
        message: options.message,
        default: options.default as number,
        validate: options.validate,
      },
    ]);
    return answers.number as number;
  }

  async autocomplete(options: {
    message: string;
    source: (answersSoFar: string, input: string) => Promise<string[]>;
    suggestOnly?: boolean;
  }): Promise<string> {
    const autocompletePrompt = (await import('inquirer')).prompt;
    const answers = await autocompletePrompt([
      {
        type: 'autocomplete',
        name: 'autocomplete',
        message: options.message,
        source: options.source,
        suggestOnly: options.suggestOnly ?? false,
      } as any,
    ]);
    return answers.autocomplete as string;
  }

  // Multi-step prompts
  async multiStep<T extends Record<string, unknown>>(
    steps: Array<{
      name: string;
      prompt: () => Promise<unknown>;
    }>
  ): Promise<T> {
    const result: Partial<T> = {};

    for (const step of steps) {
      result[step.name as keyof T] = await step.prompt();
    }

    return result as T;
  }

  // Prompt with cancellation
  async confirmOrCancel(message: string): Promise<boolean> {
    const { prompt } = await import('inquirer');
    const answers = await prompt([
      {
        type: 'list',
        name: 'confirm',
        message,
        choices: [
          { name: chalk.green('Yes'), value: true },
          { name: chalk.red('No'), value: false },
          { name: chalk.dim('Cancel'), value: 'cancel' },
        ],
        default: false,
      },
    ]);

    if (answers.confirm === 'cancel') {
      this.logger.info('Operation cancelled');
      process.exit(0);
    }

    return answers.confirm as boolean;
  }
}

export function createPrompts(logger?: Logger): Prompts {
  return new Prompts(logger);
}
