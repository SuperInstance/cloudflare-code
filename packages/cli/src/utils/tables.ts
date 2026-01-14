/**
 * Table formatting utilities
 */

import chalk from 'chalk';
import { table, TableUserOptions } from 'table';
import wrapAnsi from 'wrap-ansi';

export interface TableColumn {
  name: string;
  alignment?: 'left' | 'center' | 'right';
  width?: number;
  wrapWord?: boolean;
}

export interface TableData {
  columns: TableColumn[];
  rows: Array<Array<string | number>>;
}

export class TableFormatter {
  /**
   * Format data as a table
   */
  static format(data: TableData, options?: TableUserOptions): string {
    const headers = data.columns.map((col) =>
      col.wrapWord ? wrapAnsi(chalk.bold(col.name), col.width ?? 20) : chalk.bold(col.name)
    );

    const tableData: Array<Array<string | number>> = [headers, ...data.rows];

    const tableOptions: TableUserOptions = {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼',
      },
      ...options,
    };

    return table(tableData, tableOptions);
  }

  /**
   * Format key-value pairs as a table
   */
  static keyValue(pairs: Record<string, string | number>): string {
    const data: TableData = {
      columns: [
        { name: 'Key', alignment: 'right' },
        { name: 'Value', alignment: 'left' },
      ],
      rows: Object.entries(pairs).map(([key, value]) => [
        chalk.cyan(key),
        String(value),
      ]),
    };

    return this.format(data);
  }

  /**
   * Format status information
   */
  static status(items: Array<{ name: string; status: string; message?: string }>): string {
    const data: TableData = {
      columns: [
        { name: 'Name' },
        { name: 'Status', alignment: 'center' },
        { name: 'Message' },
      ],
      rows: items.map((item) => {
        const status =
          item.status === 'healthy' || item.status === 'pass' || item.status === 'success'
            ? chalk.green(item.status)
            : item.status === 'unhealthy' || item.status === 'fail' || item.status === 'error'
              ? chalk.red(item.status)
              : item.status === 'degraded' || item.status === 'warn'
                ? chalk.yellow(item.status)
                : item.status;

        return [item.name, status, item.message ?? ''];
      }),
    };

    return this.format(data);
  }

  /**
   * Format deployment information
   */
  static deployment(deployment: {
    environment: string;
    url?: string;
    version?: string;
    duration?: number;
  }): string {
    const data: TableData = {
      columns: [
        { name: 'Property', alignment: 'right', width: 20 },
        { name: 'Value', alignment: 'left' },
      ],
      rows: [
        ['Environment', deployment.environment],
        ['URL', deployment.url ?? 'N/A'],
        ['Version', deployment.version ?? 'N/A'],
        ['Duration', deployment.duration ? `${deployment.duration}ms` : 'N/A'],
      ],
    };

    return this.format(data);
  }

  /**
   * Format comparison table
   */
  static comparison(
    items: Array<{ label: string; before: string; after: string; changed?: boolean }>
  ): string {
    const data: TableData = {
      columns: [
        { name: 'Property' },
        { name: 'Before', alignment: 'center' },
        { name: 'After', alignment: 'center' },
        { name: 'Changed', alignment: 'center' },
      ],
      rows: items.map((item) => [
        item.label,
        item.before,
        item.after,
        item.changed ?? item.before !== item.after
          ? chalk.yellow('Yes')
          : chalk.dim('No'),
      ]),
    };

    return this.format(data);
  }

  /**
   * Format list with indices
   */
  static list(items: string[], title?: string): string {
    const maxLength = Math.max(...items.map((i) => i.length));
    const lines: string[] = [];

    if (title) {
      lines.push(chalk.bold(title));
      lines.push('');
    }

    items.forEach((item, index) => {
      const paddedIndex = chalk.dim(`[${String(index + 1).padStart(2)}]`);
      const paddedItem = item.padEnd(maxLength);
      lines.push(`  ${paddedIndex} ${paddedItem}`);
    });

    return lines.join('\n') + '\n';
  }
}
