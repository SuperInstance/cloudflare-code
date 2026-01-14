#!/usr/bin/env node

/**
 * Coverage Checker Script
 *
 * Validates that test coverage meets minimum thresholds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COVERAGE_FILE = path.join(__dirname, '../coverage/coverage-summary.json');
const THRESHOLDS = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};

function checkCoverage() {
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('❌ Coverage file not found. Run tests with coverage first:');
    console.error('   npm run test:coverage');
    process.exit(1);
  }

  const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf-8'));
  const total = coverage.total;

  console.log('\n📊 Coverage Report\n');

  let passed = true;
  const metrics = ['statements', 'branches', 'functions', 'lines'];

  metrics.forEach(metric => {
    const covered = total[metric].pct;
    const threshold = THRESHOLDS[metric];
    const status = covered >= threshold ? '✅' : '❌';

    console.log(
      `${status} ${metric.padEnd(12)} ${covered.toFixed(2)}% (threshold: ${threshold}%)`
    );

    if (covered < threshold) {
      passed = false;
    }
  });

  console.log('');

  if (passed) {
    console.log('✅ All coverage thresholds met!\n');
    process.exit(0);
  } else {
    console.error('❌ Coverage thresholds not met. Please add more tests.\n');
    process.exit(1);
  }
}

checkCoverage();
