/**
 * CLI for ClaudeFlare Testing Framework
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { TestRunner } from './runner/runner.js';
import { createReporter } from './reporting/analytics.js';

const argv = await yargs(hideBin(process.argv))
  .option('files', {
    alias: 'f',
    type: 'array',
    description: 'Test files or patterns to run',
    default: ['src'],
  })
  .option('pattern', {
    alias: 'p',
    type: 'string',
    description: 'Pattern to filter test names',
  })
  .option('exclude', {
    alias: 'e',
    type: 'array',
    description: 'Patterns to exclude',
  })
  .option('level', {
    alias: 'l',
    type: 'string',
    choices: ['unit', 'integration', 'e2e', 'performance'],
    description: 'Test level to run',
  })
  .option('tag', {
    alias: 't',
    type: 'array',
    description: 'Tags to filter tests',
  })
  .option('parallel', {
    type: 'boolean',
    description: 'Run tests in parallel',
    default: true,
  })
  .option('concurrency', {
    alias: 'c',
    type: 'number',
    description: 'Number of concurrent tests',
    default: 4,
  })
  .option('timeout', {
    type: 'number',
    description: 'Default test timeout in milliseconds',
    default: 5000,
  })
  .option('retries', {
    type: 'number',
    description: 'Number of retries for failed tests',
    default: 1,
  })
  .option('bail', {
    type: 'number',
    description: 'Stop after N failures',
  })
  .option('grep', {
    type: 'string',
    description: 'Pattern to match test names',
  })
  .option('shard', {
    type: 'string',
    description: 'Shard tests (e.g., 1/3)',
  })
  .option('watch', {
    alias: 'w',
    type: 'boolean',
    description: 'Watch mode',
    default: false,
  })
  .option('coverage', {
    type: 'boolean',
    description: 'Enable coverage reporting',
    default: false,
  })
  .option('reporter', {
    alias: 'r',
    type: 'array',
    description: 'Reporters to use',
    default: ['console'],
  })
  .option('output-dir', {
    alias: 'o',
    type: 'string',
    description: 'Output directory for reports',
    default: './test-results',
  })
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .parse();

async function main() {
  const runner = new TestRunner();

  // Parse shard option
  let shard: { index: number; total: number } | undefined;
  if (argv.shard) {
    const [index, total] = argv.shard.split('/').map(Number);
    if (index && total) {
      shard = { index: index - 1, total };
    }
  }

  // Setup reporters
  const reporters = (argv.reporter as string[]).map(type =>
    createReporter(type as any, { outputDir: argv['output-dir'] as string })
  );

  const options = {
    files: argv.files as string[],
    pattern: argv.pattern as string | undefined,
    exclude: argv.exclude as string[] | undefined,
    level: argv.level as any,
    tag: argv.tag as string[] | undefined,
    parallel: argv.parallel as boolean,
    concurrency: argv.concurrency as number,
    timeout: argv.timeout as number,
    retries: argv.retries as number,
    bail: argv.bail as number | undefined,
    grep: argv.grep as string | RegExp | undefined,
    shard,
    watch: argv.watch as boolean,
    coverage: argv.coverage as boolean,
    reporters,
    outputDir: argv['output-dir'] as string,
  };

  try {
    console.log('🚀 Starting ClaudeFlare Test Runner...\n');

    const results = await runner.run(options);

    // Exit with appropriate code
    process.exit(results.stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

main();
