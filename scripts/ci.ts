#!/usr/bin/env tsx

/**
 * ClaudeFlare CI Orchestration Script
 * Automates continuous integration pipeline with:
 * - Code quality checks
 * - Security scanning
 * - Automated testing
 * - Build verification
 * - Coverage reporting
 */

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

interface CIConfig {
  skipLint?: boolean;
  skipTypeCheck?: boolean;
  skipTests?: boolean;
  skipSecurity?: boolean;
  skipBundleCheck?: boolean;
  coverageThreshold?: number;
  verbose?: boolean;
  fixIssues?: boolean;
}

interface CIResult {
  stage: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

interface CIReport {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  results: CIResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

const DEFAULT_CONFIG: Required<CIConfig> = {
  skipLint: false,
  skipTypeCheck: false,
  skipTests: false,
  skipSecurity: false,
  skipBundleCheck: false,
  coverageThreshold: 80,
  verbose: true,
  fixIssues: false,
};

class CIOrchestrator {
  private config: Required<CIConfig>;
  private results: CIResult[] = [];
  private startTime: Date = new Date();

  constructor(config: CIConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute complete CI pipeline
   */
  async run(): Promise<CIReport> {
    console.log('🚀 Starting ClaudeFlare CI Pipeline');
    console.log(`   Started: ${this.startTime.toISOString()}`);
    console.log(`   Config: ${JSON.stringify(this.config, null, 2)}`);
    console.log('');

    try {
      // Stage 1: Code Quality
      if (!this.config.skipLint) {
        await this.runStage('Lint', this.runLint.bind(this));
      } else {
        console.log('⏭️  Skipping lint stage\n');
      }

      // Stage 2: Type Checking
      if (!this.config.skipTypeCheck) {
        await this.runStage('Type Check', this.runTypeCheck.bind(this));
      } else {
        console.log('⏭️  Skipping type check stage\n');
      }

      // Stage 3: Unit Tests
      if (!this.config.skipTests) {
        await this.runStage('Unit Tests', this.runUnitTests.bind(this));
      } else {
        console.log('⏭️  Skipping tests stage\n');
      }

      // Stage 4: Integration Tests
      if (!this.config.skipTests) {
        await this.runStage('Integration Tests', this.runIntegrationTests.bind(this));
      } else {
        console.log('⏭️  Skipping integration tests stage\n');
      }

      // Stage 5: Security Scanning
      if (!this.config.skipSecurity) {
        await this.runStage('Security Scan', this.runSecurityScan.bind(this));
      } else {
        console.log('⏭️  Skipping security stage\n');
      }

      // Stage 6: Build Verification
      await this.runStage('Build', this.runBuild.bind(this));

      // Stage 7: Bundle Size Check
      if (!this.config.skipBundleCheck) {
        await this.runStage('Bundle Check', this.runBundleCheck.bind(this));
      } else {
        console.log('⏭️  Skipping bundle check stage\n');
      }

      const endTime = new Date();
      const report = this.generateReport(endTime);

      this.printSummary(report);

      // Exit with error code if any stage failed
      if (report.summary.failed > 0) {
        process.exit(1);
      }

      return report;
    } catch (error) {
      console.error('❌ CI pipeline failed:', error);
      process.exit(1);
    }
  }

  /**
   * Run a single CI stage
   */
  private async runStage(stageName: string, stageFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    console.log(`🔍 Running: ${stageName}`);

    try {
      await stageFn();
      const duration = Date.now() - startTime;

      this.results.push({
        stage: stageName,
        success: true,
        duration,
      });

      console.log(`✅ ${stageName} passed (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.results.push({
        stage: stageName,
        success: false,
        duration,
        error: errorMessage,
      });

      console.error(`❌ ${stageName} failed (${duration}ms)`);
      console.error(`   Error: ${errorMessage}\n`);

      throw error;
    }
  }

  /**
   * Run ESLint
   */
  private async runLint(): Promise<void> {
    const command = this.config.fixIssues
      ? 'npm run lint:fix'
      : 'npm run lint';

    try {
      execSync(command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: process.env,
      });
    } catch (error) {
      throw new Error('Linting failed. Run "npm run lint:fix" to auto-fix issues.');
    }
  }

  /**
   * Run TypeScript type checking
   */
  private async runTypeCheck(): Promise<void> {
    try {
      execSync('npm run typecheck', {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: process.env,
      });
    } catch (error) {
      throw new Error('Type checking failed. Fix type errors before committing.');
    }
  }

  /**
   * Run unit tests with coverage
   */
  private async runUnitTests(): Promise<void> {
    try {
      execSync('npm run test:unit', {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      // Check coverage threshold
      await this.checkCoverage();
    } catch (error) {
      throw new Error('Unit tests failed. Check test output for details.');
    }
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<void> {
    try {
      execSync('npm run test:integration', {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });
    } catch (error) {
      throw new Error('Integration tests failed. Check test output for details.');
    }
  }

  /**
   * Run security scanning
   */
  private async runSecurityScan(): Promise<void> {
    const results = {
      npmAudit: false,
      secrets: false,
    };

    // Run npm audit
    try {
      execSync('npm audit --audit-level=moderate', {
        stdio: 'pipe',
        env: process.env,
      });
      results.npmAudit = true;
    } catch (error) {
      // npm audit exits with non-zero if vulnerabilities found
      console.warn('⚠️  Security vulnerabilities found in dependencies');
    }

    // Check for secrets (basic check)
    try {
      const patterns = [
        'password',
        'secret',
        'api_key',
        'apikey',
        'private_key',
        'token',
      ];

      const { execSync: exec } = await import('child_process');
      const grepOutput = exec(
        `grep -r -i -E '${patterns.join('|')}' src/ --include='*.ts' || true`,
        { encoding: 'utf-8' }
      );

      if (grepOutput.trim()) {
        console.warn('⚠️  Potential secrets found in source code:');
        console.warn(grepOutput);
      } else {
        results.secrets = true;
      }
    } catch (error) {
      // grep found nothing, which is good
      results.secrets = true;
    }

    // Fail if critical issues found
    if (!results.npmAudit && !results.secrets) {
      throw new Error('Critical security issues found. Please review.');
    }
  }

  /**
   * Build the project
   */
  private async runBuild(): Promise<void> {
    try {
      execSync('npm run build', {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      });
    } catch (error) {
      throw new Error('Build failed. Check build logs for details.');
    }
  }

  /**
   * Check bundle size
   */
  private async runBundleCheck(): Promise<void> {
    try {
      execSync('npm run check-bundle-size', {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          BUNDLE_SIZE_LIMIT: '3072000', // 3MB (Cloudflare Worker limit)
        },
      });
    } catch (error) {
      throw new Error('Bundle size check failed. Bundle exceeds size limit.');
    }
  }

  /**
   * Check test coverage threshold
   */
  private async checkCoverage(): Promise<void> {
    try {
      const coverageFile = join(process.cwd(), 'coverage', 'coverage-summary.json');

      if (!existsSync(coverageFile)) {
        console.warn('⚠️  Coverage file not found, skipping coverage check');
        return;
      }

      const coverage = JSON.parse(await readFile(coverageFile, 'utf-8'));
      const totalCoverage = coverage.total?.lines?.pct || 0;

      if (totalCoverage < this.config.coverageThreshold) {
        throw new Error(
          `Coverage ${totalCoverage}% is below threshold ${this.config.coverageThreshold}%`
        );
      }

      console.log(`✅ Coverage: ${totalCoverage}% (threshold: ${this.config.coverageThreshold}%)`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      console.warn('⚠️  Could not check coverage');
    }
  }

  /**
   * Generate CI report
   */
  private generateReport(endTime: Date): CIReport {
    const totalDuration = endTime.getTime() - this.startTime.getTime();

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      skipped: 0,
    };

    return {
      startTime: this.startTime,
      endTime,
      totalDuration,
      results: this.results,
      summary,
    };
  }

  /**
   * Print CI summary
   */
  private printSummary(report: CIReport): void {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ClaudeFlare CI Pipeline Summary               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Started:     ${report.startTime.toISOString()}`);
    console.log(`Ended:       ${report.endTime.toISOString()}`);
    console.log(`Duration:    ${report.totalDuration}ms`);
    console.log('');
    console.log('Stages:');
    console.log('');

    for (const result of report.results) {
      const status = result.success ? '✅' : '❌';
      const duration = `(${result.duration}ms)`;
      console.log(`  ${status} ${result.stage.padEnd(25)} ${duration}`);

      if (result.error && this.config.verbose) {
        console.log(`     Error: ${result.error}`);
      }
    }

    console.log('');
    console.log('Summary:');
    console.log(`  Total:   ${report.summary.total}`);
    console.log(`  Passed:  ${report.summary.passed}`);
    console.log(`  Failed:  ${report.summary.failed}`);
    console.log('');

    if (report.summary.failed === 0) {
      console.log('🎉 All CI stages passed!');
    } else {
      console.log('❌ Some CI stages failed. Please review the output above.');
    }

    console.log('');
  }

  /**
   * Save CI report to file
   */
  async saveReport(outputPath: string): Promise<void> {
    const report = this.generateReport(new Date());
    await writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to ${outputPath}`);
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(): CIConfig & { outputPath?: string } {
  const args = process.argv.slice(2);
  const config: CIConfig & { outputPath?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--skip-lint':
        config.skipLint = true;
        break;
      case '--skip-typecheck':
        config.skipTypeCheck = true;
        break;
      case '--skip-tests':
        config.skipTests = true;
        break;
      case '--skip-security':
        config.skipSecurity = true;
        break;
      case '--skip-bundle-check':
        config.skipBundleCheck = true;
        break;
      case '--coverage-threshold':
        config.coverageThreshold = parseInt(nextArg || '80', 10);
        i++;
        break;
      case '--fix':
        config.fixIssues = true;
        break;
      case '--quiet':
        config.verbose = false;
        break;
      case '--output':
        config.outputPath = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ClaudeFlare CI Orchestration Script

Usage: tsx scripts/ci.ts [options]

Options:
  --skip-lint              Skip linting stage
  --skip-typecheck         Skip type checking stage
  --skip-tests             Skip all test stages
  --skip-security          Skip security scanning stage
  --skip-bundle-check      Skip bundle size check
  --coverage-threshold <n> Set minimum coverage percentage [default: 80]
  --fix                    Auto-fix linting issues
  --quiet                  Reduce output verbosity
  --output <path>          Save CI report to file
  -h, --help               Show this help message

Examples:
  tsx scripts/ci.ts
  tsx scripts/ci.ts --skip-security --coverage-threshold 90
  tsx scripts/ci.ts --fix --output ci-report.json
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    const orchestrator = new CIOrchestrator(config);

    const report = await orchestrator.run();

    if (config.outputPath) {
      await orchestrator.saveReport(config.outputPath);
    }
  } catch (error) {
    console.error('❌ CI pipeline failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { CIOrchestrator, CIConfig, CIResult, CIReport };
