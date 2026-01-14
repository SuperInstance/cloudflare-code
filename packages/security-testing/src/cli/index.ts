#!/usr/bin/env node
/**
 * ClaudeFlare Security Testing CLI
 * Command-line interface for security scanning
 */

import { Command } from 'commander';
import { SecurityTesting, Severity } from '../index';
import { Logger } from '../utils/logger';
import { promises as fsp } from 'fs';
import path from 'path';

const program = new Command();

program
  .name('claudeflare-security')
  .description('ClaudeFlare Security Testing CLI')
  .version('1.0.0');

// Scan command
program
  .command('scan')
  .description('Run comprehensive security scan')
  .argument('[target]', 'Target directory or URL', process.cwd())
  .option('-s, --sast', 'Enable SAST scanning')
  .option('-d, --dast', 'Enable DAST scanning')
  .option('-c, --sca', 'Enable dependency scanning')
  .option('-p, --compliance <frameworks>', 'Enable compliance scanning (comma-separated)')
  .option('-t, --severity <level>', 'Minimum severity level', 'info')
  .option('-o, --output <file>', 'Output file')
  .option('-f, --format <format>', 'Output format (json, sarif, html)', 'json')
  .action(async (target, options) => {
    const logger = Logger.createDefault();
    const securityTesting = new SecurityTesting();

    try {
      console.log(`🔒 Starting security scan of ${target}...\n`);

      const results = await securityTesting.runComprehensiveScan(target, {
        enableSAST: options.sast !== false,
        enableDAST: options.dast || false,
        enableSCA: options.sca !== false,
        enableCompliance: !!options.compliance,
        frameworks: options.compliance ? options.compliance.split(',') : [],
        severityThreshold: options.severity as Severity,
      });

      // Output results
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fsp.writeFile(outputPath, JSON.stringify(results, null, 2));
        console.log(`✅ Results saved to ${outputPath}\n`);
      } else {
        console.log('\n=== Scan Results ===');
        console.log(`Total Findings: ${results.summary.totalFindings}`);
        console.log(`Critical: ${results.summary.critical}`);
        console.log(`High: ${results.summary.high}`);
        console.log(`Medium: ${results.summary.medium}`);
        console.log(`Low: ${results.summary.low}`);
        console.log(`Info: ${results.summary.info}\n`);
      }

      process.exit(results.summary.critical > 0 ? 1 : 0);
    } catch (error) {
      console.error(`❌ Scan failed: ${error}`);
      process.exit(1);
    }
  });

// SAST scan command
program
  .command('scan-sast')
  .description('Run SAST scan')
  .argument('[target]', 'Target directory', process.cwd())
  .option('-t, --severity <level>', 'Minimum severity level', 'info')
  .option('-m, --max-files <number>', 'Maximum files to scan', '1000')
  .option('-o, --output <file>', 'Output file')
  .action(async (target, options) => {
    const logger = Logger.createDefault();
    const securityTesting = new SecurityTesting();

    try {
      console.log(`🔍 Starting SAST scan of ${target}...`);

      const result = await securityTesting.scanCode(target, {
        severityThreshold: options.severity as Severity,
        maxFiles: parseInt(options.maxFiles),
      });

      if (options.output) {
        await fsp.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(`✅ Results saved to ${options.output}`);
      } else {
        console.log(`\nFound ${result.stats.total} vulnerabilities`);
        console.log(`Files scanned: ${result.stats.filesScanned}\n`);
      }
    } catch (error) {
      console.error(`❌ SAST scan failed: ${error}`);
      process.exit(1);
    }
  });

// DAST scan command
program
  .command('scan-dast')
  .description('Run DAST scan')
  .argument('<target>', 'Target URL')
  .option('-p, --max-pages <number>', 'Maximum pages to crawl', '100')
  .option('-t, --timeout <number>', 'Request timeout in ms', '30000')
  .option('-a, --auth <type>', 'Authentication type (basic, bearer)')
  .option('-o, --output <file>', 'Output file')
  .action(async (target, options) => {
    const logger = Logger.createDefault();
    const securityTesting = new SecurityTesting();

    try {
      console.log(`🌐 Starting DAST scan of ${target}...`);

      const result = await securityTesting.scanWebApplication(target, {
        maxPages: parseInt(options.maxPages),
        timeout: parseInt(options.timeout),
      });

      if (options.output) {
        await fsp.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(`✅ Results saved to ${options.output}`);
      } else {
        console.log(`\nFound ${result.stats.total} vulnerabilities`);
        console.log(`Pages crawled: ${result.stats.filesScanned}\n`);
      }
    } catch (error) {
      console.error(`❌ DAST scan failed: ${error}`);
      process.exit(1);
    }
  });

// Dependency scan command
program
  .command('scan-sca')
  .description('Run dependency scan')
  .argument('[target]', 'Target directory', process.cwd())
  .option('-d, --include-dev', 'Include dev dependencies', 'true')
  .option('-t, --transitive', 'Include transitive dependencies', 'false')
  .option('-l, --license-blacklist <licenses>', 'Blacklisted licenses (comma-separated)')
  .option('-o, --output <file>', 'Output file')
  .action(async (target, options) => {
    const logger = Logger.createDefault();
    const securityTesting = new SecurityTesting();

    try {
      console.log(`📦 Starting dependency scan of ${target}...`);

      const result = await securityTesting.scanDependencies(target, {
        includeDevDependencies: options.includeDev === 'true',
        includeTransitiveDependencies: options.transitive === 'true',
        licenseBlacklist: options.licenseBlacklist ? options.licenseBlacklist.split(',') : undefined,
      });

      if (options.output) {
        await fsp.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(`✅ Results saved to ${options.output}`);
      } else {
        console.log(`\nFound ${result.stats.vulnerabilitiesFound} vulnerabilities`);
        console.log(`Dependencies scanned: ${result.stats.filesScanned}\n`);
      }
    } catch (error) {
      console.error(`❌ Dependency scan failed: ${error}`);
      process.exit(1);
    }
  });

// Compliance scan command
program
  .command('scan-compliance')
  .description('Run compliance scan')
  .argument('[target]', 'Target directory', process.cwd())
  .requiredOption('-f, --frameworks <frameworks>', 'Compliance frameworks (comma-separated)')
  .option('-s, --strict', 'Enable strict mode', 'false')
  .option('-o, --output <file>', 'Output file')
  .action(async (target, options) => {
    const logger = Logger.createDefault();
    const securityTesting = new SecurityTesting();

    try {
      const frameworks = options.frameworks.split(',');
      console.log(`📋 Starting compliance scan for: ${frameworks.join(', ')}...`);

      const results = await securityTesting.scanCompliance(
        target,
        frameworks as any[],
        {
          strictMode: options.strict === 'true',
        }
      );

      if (options.output) {
        await fsp.writeFile(options.output, JSON.stringify(results, null, 2));
        console.log(`✅ Results saved to ${options.output}`);
      } else {
        for (const report of results) {
          console.log(`\n${report.framework}: ${report.overallScore}%`);
          console.log(`Passed: ${report.passedControls}`);
          console.log(`Failed: ${report.failedControls}`);
        }
      }
    } catch (error) {
      console.error(`❌ Compliance scan failed: ${error}`);
      process.exit(1);
    }
  });

// Pentest command
program
  .command('pentest')
  .description('Run penetration test')
  .argument('<target>', 'Target URL')
  .option('-p, --phases <phases>', 'Enabled phases (comma-separated)', 'reconnaissance,scanning')
  .option('-d, --duration <minutes>', 'Maximum duration in minutes', '60')
  .option('-o, --output <file>', 'Output file')
  .action(async (target, options) => {
    const logger = Logger.createDefault();
    const securityTesting = new SecurityTesting();

    try {
      const phases = options.phases.split(',').map((p: string) => ({ name: p.trim(), enabled: true }));

      console.log(`🎯 Starting penetration test of ${target}...`);
      console.log(`Enabled phases: ${options.phases}\n`);

      const report = await securityTesting.runPenTest(target, {
        targetType: 'web',
        phases,
        options: {
          maxDuration: parseInt(options.duration) * 60 * 1000,
          parallelAttacks: 5,
        },
      });

      if (options.output) {
        await fsp.writeFile(options.output, JSON.stringify(report, null, 2));
        console.log(`\n✅ Report saved to ${options.output}`);
      } else {
        console.log(`\n=== Penetration Test Results ===`);
        console.log(`Risk Score: ${report.riskScore}/100`);
        console.log(`Total Findings: ${report.findings.length}\n`);
        console.log(report.executiveSummary);
      }
    } catch (error) {
      console.error(`❌ Penetration test failed: ${error}`);
      process.exit(1);
    }
  });

// Generate CI/CD files
program
  .command('generate-github-action')
  .description('Generate GitHub Actions workflow')
  .option('-o, --output <file>', 'Output file', '.github/workflows/security-scan.yml')
  .action(async (options) => {
    const workflow = `name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx @claudeflare/security-testing scan ./src
      - uses: actions/upload-artifact@v3
        with:
          name: security-results
          path: security-results.json
`;

    await fsp.writeFile(options.output, workflow);
    console.log(`✅ GitHub Actions workflow generated: ${options.output}`);
  });

program
  .command('generate-gitlab-ci')
  .description('Generate GitLab CI configuration')
  .option('-o, --output <file>', 'Output file', '.gitlab-ci.yml')
  .action(async (options) => {
    const config = `security-scan:
  stage: security
  image: node:18
  script:
    - npm ci
    - npx @claudeflare/security-testing scan ./src
  artifacts:
    paths:
      - security-results.json
    expire_in: 1 week
  only:
    - main
    - develop
    - merge_requests
`;

    await fsp.writeFile(options.output, config);
    console.log(`✅ GitLab CI configuration generated: ${options.output}`);
  });

program
  .command('generate-jenkins-file')
  .description('Generate Jenkinsfile')
  .option('-o, --output <file>', 'Output file', 'Jenkinsfile')
  .action(async (options) => {
    const jenkinsfile = `pipeline {
    agent any

    stages {
        stage('Security Scan') {
            steps {
                sh 'npm ci'
                sh 'npx @claudeflare/security-testing scan ./src'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'security-results.json', fingerprint: true
        }
    }
}
`;

    await fsp.writeFile(options.output, jenkinsfile);
    console.log(`✅ Jenkinsfile generated: ${options.output}`);
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('ClaudeFlare Security Testing v1.0.0');
    console.log('Enterprise-grade security testing for ClaudeFlare');
  });

// Parse arguments
program.parse();
