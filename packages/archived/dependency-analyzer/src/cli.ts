/**
 * CLI for Dependency Analyzer
 *
 * Command-line interface for the dependency analyzer package
 */

#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ora } from 'ora';
import Table from 'cli-table3';

import { DependencyAnalyzer, createAnalyzer } from './analyzer.js';

const program = new Command();

program
  .name('dep-analyzer')
  .description('Comprehensive dependency analysis and management')
  .version('0.1.0');

// Analyze command
program
  .command('analyze')
  .description('Perform complete dependency analysis')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-o, --output <file>', 'Output file')
  .option('-f, --format <format>', 'Output format (json, markdown, html)', 'markdown')
  .option('--no-circular', 'Skip circular dependency detection')
  .option('--no-unused', 'Skip unused dependency detection')
  .option('--no-security', 'Skip security scanning')
  .option('--no-license', 'Skip license analysis')
  .action(async (options) => {
    const spinner = ora('Initializing analyzer...').start();

    try {
      const analyzer = new DependencyAnalyzer({
        projectPath: options.path,
        rules: {
          circular: { enabled: options.circular },
          unused: { enabled: options.unused },
          security: { enabled: options.security },
          license: { enabled: options.license },
        },
      });

      spinner.text = 'Running analysis...';
      const result = await analyzer.exportResults(options.format as any);

      spinner.succeed('Analysis complete');

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, result, 'utf-8');
        console.log(chalk.green(`\nReport saved to ${options.output}`));
      } else {
        console.log('\n' + result);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Circular dependencies command
program
  .command('circular')
  .description('Detect circular dependencies')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--max-depth <number>', 'Maximum cycle depth to detect', '10')
  .action(async (options) => {
    const spinner = ora('Detecting circular dependencies...').start();

    try {
      const analyzer = await createAnalyzer(options.path);
      await analyzer.buildGraph();

      const { cycles } = await analyzer.detectCircular();
      spinner.succeed(`Found ${cycles.length} circular dependencies`);

      if (cycles.length === 0) {
        console.log(chalk.green('\n✓ No circular dependencies found'));
        return;
      }

      // Display cycles
      const table = new Table({
        head: ['Type', 'Severity', 'Length', 'Path'],
        colWidths: [10, 10, 8, 80],
      });

      for (const cycle of cycles) {
        const severityColor = {
          critical: 'red',
          high: 'yellow',
          moderate: 'blue',
          low: 'green',
        }[cycle.severity];

        table.push([
          cycle.type,
          chalk[severityColor as keyof typeof chalk](cycle.severity),
          cycle.length.toString(),
          cycle.path.slice(0, 3).join(' -> ') + (cycle.length > 3 ? ' ...' : ''),
        ]);
      }

      console.log('\n' + table.toString());

      // Show suggestions
      console.log(chalk.bold('\nSuggestions:'));
      for (const cycle of cycles.slice(0, 3)) {
        console.log(chalk.yellow(`\nCycle: ${cycle.path.join(' -> ')}`));
        for (const suggestion of cycle.suggestions.slice(0, 2)) {
          console.log(`  • ${suggestion}`);
        }
      }
    } catch (error) {
      spinner.fail('Detection failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Unused command
program
  .command('unused')
  .description('Find unused dependencies and code')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--include-exports', 'Include unused exports in analysis')
  .action(async (options) => {
    const spinner = ora('Scanning for unused code...').start();

    try {
      const analyzer = new DependencyAnalyzer({
        projectPath: options.path,
        rules: {
          unused: {
            enabled: true,
            includeExports: options.includeExports,
          },
        },
      });

      const { dependencies, code } = await analyzer.detectUnused();
      spinner.succeed(`Found ${dependencies.length} unused dependencies and ${code.length} unused code items`);

      if (dependencies.length === 0 && code.length === 0) {
        console.log(chalk.green('\n✓ No unused dependencies or code found'));
        return;
      }

      // Display unused dependencies
      if (dependencies.length > 0) {
        console.log(chalk.bold('\nUnused Dependencies:'));
        const depTable = new Table({
          head: ['Package', 'Version', 'Type', 'Size'],
          colWidths: [30, 15, 15, 15],
        });

        for (const dep of dependencies.slice(0, 20)) {
          const size = dep.size ? `${(dep.size / 1024).toFixed(2)} KB` : 'N/A';
          depTable.push([dep.name, dep.version, dep.type, size]);
        }

        console.log(depTable.toString());
      }

      // Display unused code
      if (code.length > 0) {
        console.log(chalk.bold('\nUnused Code:'));
        console.log(`Found ${code.length} unused imports, exports, or variables`);
        console.log(chalk.dim('(Run with --verbose for details)'));
      }

      // Show potential savings
      const totalSize = dependencies.reduce((sum, dep) => sum + (dep.size || 0), 0);
      if (totalSize > 0) {
        console.log(chalk.bold(`\nPotential savings: ${(totalSize / 1024 / 1024).toFixed(2)} MB`));
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Updates command
program
  .command('updates')
  .description('Check for dependency updates')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--type <type>', 'Filter by update type (major, minor, patch)')
  .action(async (options) => {
    const spinner = ora('Checking for updates...').start();

    try {
      const analyzer = await createAnalyzer(options.path);
      const { updates } = await analyzer.checkUpdates();
      spinner.succeed(`Found ${updates.length} available updates`);

      if (updates.length === 0) {
        console.log(chalk.green('\n✓ All dependencies are up to date'));
        return;
      }

      // Filter by type if specified
      const filtered = options.type
        ? updates.filter((u) => u.type === options.type)
        : updates;

      // Display by type
      const types = ['major', 'minor', 'patch', 'prerelease'];

      for (const type of types) {
        const typeUpdates = filtered.filter((u) => u.type === type);
        if (typeUpdates.length === 0) continue;

        const color = {
          major: 'red',
          minor: 'yellow',
          patch: 'green',
          prerelease: 'blue',
        }[type as keyof typeof typeof color];

        console.log(chalk.bold(`\n${type.toUpperCase()} updates (${typeUpdates.length}):`));

        const table = new Table({
          head: ['Package', 'Current', 'Latest', 'Breaking?'],
          colWidths: [30, 15, 15, 12],
        });

        for (const update of typeUpdates.slice(0, 10)) {
          table.push([
            update.name,
            update.currentVersion,
            chalk[color](update.latestVersion),
            update.breaking ? '⚠️ Yes' : 'No',
          ]);
        }

        console.log(table.toString());
      }

      console.log(chalk.dim('\nRun `npm update` to install updates (review major changes first)'));
    } catch (error) {
      spinner.fail('Update check failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// License command
program
  .command('license')
  .description('Analyze package licenses')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const spinner = ora('Analyzing licenses...').start();

    try {
      const analyzer = await createAnalyzer(options.path);
      const { licenses, issues } = await analyzer.analyzeLicenses();
      spinner.succeed(`Analyzed ${licenses.size} package licenses`);

      // Group by license type
      const byType: Record<string, string[]> = {};

      for (const [pkg, license] of licenses) {
        if (!byType[license.type]) {
          byType[license.type] = [];
        }
        byType[license.type].push(pkg);
      }

      console.log(chalk.bold('\nLicense Distribution:'));
      const table = new Table({
        head: ['Type', 'Count'],
        colWidths: [25, 10],
      });

      for (const [type, packages] of Object.entries(byType)) {
        const color = {
          permissive: 'green',
          'weak-copyleft': 'yellow',
          'strong-copyleft': 'red',
          proprietary: 'magenta',
          unknown: 'gray',
        }[type];

        table.push([chalk[color](type), packages.length.toString()]);
      }

      console.log(table.toString());

      // Show issues
      if (issues.length > 0) {
        console.log(chalk.bold('\nCompliance Issues:'));
        for (const issue of issues) {
          const severityColor = {
            high: 'red',
            medium: 'yellow',
            low: 'blue',
          }[issue.severity as keyof typeof typeof severityColor];

          console.log(chalk[severityColor](`\n${issue.severity.toUpperCase()}: ${issue.package}`));
          console.log(`  License: ${issue.license}`);
          console.log(`  Issue: ${issue.issue}`);
        }
      }
    } catch (error) {
      spinner.fail('License analysis failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Security command
program
  .command('security')
  .description('Scan for security vulnerabilities')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--severity <severities>', 'Comma-separated severities to show', 'critical,high,moderate')
  .action(async (options) => {
    const spinner = ora('Scanning for vulnerabilities...').start();

    try {
      const analyzer = new DependencyAnalyzer({
        projectPath: options.path,
        rules: {
          security: {
            enabled: true,
            severity: options.severity.split(',') as any,
          },
        },
      });

      const { vulnerabilities, summary } = await analyzer.scanSecurity();
      spinner.succeed(`Found ${summary.total} vulnerabilities`);

      if (vulnerabilities.length === 0) {
        console.log(chalk.green('\n✓ No vulnerabilities found'));
        return;
      }

      // Display summary
      console.log(chalk.bold('\nVulnerability Summary:'));
      console.log(`  Critical: ${chalk.red(summary.critical)}`);
      console.log(`  High: ${chalk.red(summary.high)}`);
      console.log(`  Moderate: ${chalk.yellow(summary.moderate)}`);
      console.log(`  Low: ${chalk.green(summary.low)}`);

      // Display details
      console.log(chalk.bold('\nVulnerabilities:'));

      for (const vuln of vulnerabilities.slice(0, 10)) {
        const severityColor = {
          critical: 'red',
          high: 'red',
          moderate: 'yellow',
          low: 'green',
        }[vuln.severity];

        console.log(chalk.bold(`\n${chalk[severityColor]('●')} ${vuln.packageName} (${vuln.id})`));
        console.log(`  ${vuln.title}`);
        if (vuln.cvss) {
          console.log(`  CVSS: ${vuln.cvss}`);
        }
        if (vuln.patchedVersions && vuln.patchedVersions.length > 0) {
          console.log(`  Patched: ${vuln.patchedVersions.join(', ')}`);
        }
      }

      console.log(chalk.bold('\nRecommendations:'));
      console.log('  • Run `npm audit fix` to automatically fix vulnerabilities');
      console.log('  • Review and update affected packages manually');
      console.log('  • Consider alternative packages if no patch is available');
    } catch (error) {
      spinner.fail('Security scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Optimize command
program
  .command('optimize')
  .description('Analyze and optimize dependencies')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const spinner = ora('Analyzing bundle...').start();

    try {
      const analyzer = await createAnalyzer(options.path);
      await analyzer.buildGraph();

      const { bundle } = await analyzer.optimize();
      spinner.succeed('Bundle analysis complete');

      // Display bundle info
      console.log(chalk.bold('\nBundle Analysis:'));
      console.log(`  Total Dependencies: ${bundle.dependencies}`);
      console.log(`  Total Size: ${(bundle.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Tree-shakeable: ${(bundle.treeShakeable / 1024 / 1024).toFixed(2)} MB`);

      // Show duplicates
      if (bundle.duplicates.length > 0) {
        console.log(chalk.bold('\nDuplicate Dependencies:'));
        const table = new Table({
          head: ['Package', 'Versions', 'Count', 'Size'],
          colWidths: [30, 30, 10, 15],
        });

        for (const dup of bundle.duplicates.slice(0, 10)) {
          table.push([
            dup.name,
            dup.versions.join(', '),
            dup.count.toString(),
            `${(dup.totalSize / 1024).toFixed(2)} KB`,
          ]);
        }

        console.log(table.toString());
      }

      // Show lazy load candidates
      if (bundle.lazyLoadCandidates.length > 0) {
        console.log(chalk.bold('\nLazy Load Candidates:'));
        for (const candidate of bundle.lazyLoadCandidates.slice(0, 5)) {
          console.log(`\n  ${candidate.import}`);
          console.log(`  Reason: ${candidate.reason}`);
          console.log(`  Impact: ${(candidate.impact / 1024).toFixed(2)} KB`);
        }
      }
    } catch (error) {
      spinner.fail('Optimization analysis failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Graph command
program
  .command('graph')
  .description('Visualize dependency graph')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-f, --format <format>', 'Output format (dot, json, mermaid)', 'json')
  .option('-o, --output <file>', 'Output file')
  .action(async (options) => {
    const spinner = ora('Building dependency graph...').start();

    try {
      const analyzer = await createAnalyzer(options.path);
      await analyzer.buildGraph();

      const visualization = analyzer.visualize(options.format);
      spinner.succeed('Graph generated');

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, visualization, 'utf-8');
        console.log(chalk.green(`\nGraph saved to ${options.output}`));
      } else {
        console.log('\n' + visualization);
      }
    } catch (error) {
      spinner.fail('Graph generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : error));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
