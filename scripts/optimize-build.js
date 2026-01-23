#!/usr/bin/env node

/**
 * Build Performance Optimization Script
 *
 * Analyzes and optimizes build performance for the Cocapn platform.
 * Measures cold builds, incremental builds, and provides recommendations.
 *
 * Usage:
 *   node scripts/optimize-build.js           # Full analysis
 *   node scripts/optimize-build.js --clean   # Clean caches and rebuild
 *   node scripts/optimize-build.js --analyze # Bundle analysis only
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Performance targets
const TARGETS = {
  coldBuild: 10000,      // 10 seconds
  incrementalBuild: 2000, // 2 seconds
  bundleSize: 1000000,   // 1MB
  typecheck: 30000,      // 30 seconds
};

/**
 * Colorize output
 */
function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Log with emoji
 */
function log(emoji, message, color = 'reset') {
  console.log(`${emoji} ${colorize(color, message)}`);
}

/**
 * Execute command and measure time
 */
function measure(command, description) {
  const start = Date.now();
  try {
    const output = execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const duration = Date.now() - start;
    return { success: true, duration, output };
  } catch (error) {
    const duration = Date.now() - start;
    return { success: false, duration, error: error.message };
  }
}

/**
 * Clean build artifacts safely
 */
function cleanArtifacts() {
  const artifacts = ['.tsbuildinfo', 'dist'];
  artifacts.forEach(artifact => {
    const path = join(rootDir, artifact);
    if (existsSync(path)) {
      // Remove directory recursively
      execSync(`rm -rf "${path}"`, { cwd: rootDir, stdio: 'ignore' });
    }
  });
}

/**
 * Parse time output
 */
function parseTimeOutput(output) {
  const match = output.match(/real\s+(\d+)m([\d.]+)s/);
  if (match) {
    const minutes = parseInt(match[1]);
    const seconds = parseFloat(match[2]);
    return minutes * 60000 + seconds * 1000;
  }
  return null;
}

/**
 * Format milliseconds
 */
function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Get file size
 */
function getFileSize(filePath) {
  if (!existsSync(filePath)) return null;
  const stats = statSync(filePath);
  return stats.size;
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * Check performance against targets
 */
function checkTarget(actual, target, metric) {
  const ratio = actual / target;
  if (ratio <= 1) {
    return {
      status: '✅',
      color: 'green',
      message: `${formatMs(actual)} (${Math.round(ratio * 100)}% of target)`,
    };
  } else if (ratio <= 1.5) {
    return {
      status: '🟡',
      color: 'yellow',
      message: `${formatMs(actual)} (${Math.round(ratio * 100)}% of target)`,
    };
  } else {
    return {
      status: '❌',
      color: 'red',
      message: `${formatMs(actual)} (${Math.round(ratio * 100)}% of target)`,
    };
  }
}

/**
 * Analyze bundle size
 */
function analyzeBundleSize() {
  log('📦', 'Analyzing bundle sizes...', 'cyan');

  const mainBundle = getFileSize(join(rootDir, 'dist/worker.js'));
  const sourceMap = getFileSize(join(rootDir, 'dist/worker.js.map'));

  if (mainBundle) {
    console.log(`\n   Bundle Size: ${colorize('bold', formatBytes(mainBundle))}`);
    console.log(`   Source Map: ${formatBytes(sourceMap)}`);

    const ratio = mainBundle / TARGETS.bundleSize;
    if (ratio <= 1) {
      log('✅', `Bundle size is ${Math.round(ratio * 100)}% of target`, 'green');
    } else {
      log('❌', `Bundle size is ${Math.round(ratio * 100)}% of target`, 'red');
    }
  } else {
    log('⚠️', 'Bundle not found. Run build first.', 'yellow');
  }

  return mainBundle;
}

/**
 * Analyze bundle composition
 */
function analyzeBundleComposition() {
  log('📊', 'Analyzing bundle composition...', 'cyan');

  const metaPath = join(rootDir, 'meta.json');
  if (!existsSync(metaPath)) {
    log('⚠️', 'Bundle analysis not found. Run with --analyze first.', 'yellow');
    return;
  }

  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const inputs = Object.entries(meta.inputs || {});

    // Group by source
    const groups = {
      source: { count: 0, bytes: 0 },
      node_modules: { count: 0, bytes: 0 },
    };

    inputs.forEach(([path, data]) => {
      if (path.startsWith('node_modules')) {
        groups.node_modules.count++;
        groups.node_modules.bytes += data.bytes;
      } else {
        groups.source.count++;
        groups.source.bytes += data.bytes;
      }
    });

    console.log('\n   Bundle Composition:');
    console.log(`   - Source files: ${groups.source.count} files, ${formatBytes(groups.source.bytes)}`);
    console.log(`   - Dependencies: ${groups.node_modules.count} files, ${formatBytes(groups.node_modules.bytes)}`);

    // Find largest files
    const largest = inputs
      .sort(([, a], [, b]) => b.bytes - a.bytes)
      .slice(0, 5);

    console.log('\n   Largest Files:');
    largest.forEach(([path, data], index) => {
      const name = path.split('/').pop();
      console.log(`   ${index + 1}. ${name}: ${formatBytes(data.bytes)}`);
    });
  } catch (error) {
    log('❌', `Failed to analyze bundle: ${error.message}`, 'red');
  }
}

/**
 * Strip JSON comments and trailing commas
 */
function stripJsonComments(json) {
  let result = json;
  // Remove single-line comments
  result = result.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove trailing commas
  result = result.replace(/,(\s*[}\]])/g, '$1');
  return result;
}

/**
 * Check TypeScript configuration
 */
function checkTypeScriptConfig() {
  log('🔍', 'Checking TypeScript configuration...', 'cyan');

  const tsconfigPath = join(rootDir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    log('⚠️', 'tsconfig.json not found', 'yellow');
    return;
  }

  try {
    const tsconfigContent = readFileSync(tsconfigPath, 'utf8');
    const tsconfig = JSON.parse(stripJsonComments(tsconfigContent));
    const exclude = tsconfig.exclude || [];

    console.log('\n   TypeScript Configuration:');
    console.log(`   - Incremental: ${tsconfig.compilerOptions?.incremental ? '✅' : '❌'}`);
    console.log(`   - Skip Lib Check: ${tsconfig.compilerOptions?.skipLibCheck ? '✅' : '❌'}`);
    console.log(`   - Excluded: ${exclude.length} patterns`);
    console.log(`   - Exclude patterns: ${exclude.join(', ')}`);

    // Check if archived packages are excluded
    if (exclude.some(pattern => pattern.includes('archived'))) {
      log('✅', 'Archived packages excluded from TypeScript', 'green');
      return null;
    } else {
      log('⚠️', 'Archived packages NOT excluded - see recommendations', 'yellow');
      return {
        recommendation: 'Add "packages/archived" to exclude array',
      };
    }
  } catch (error) {
    log('⚠️', `Could not parse tsconfig.json (has comments/trailing commas)`, 'yellow');
    log('💡', 'Checking exclude array manually...', 'cyan');
    try {
      const tsconfigContent = readFileSync(tsconfigPath, 'utf8');
      const hasArchived = tsconfigContent.includes('packages/archived');
      if (hasArchived) {
        log('✅', 'Archived packages excluded from TypeScript', 'green');
      } else {
        log('⚠️', 'Archived packages NOT excluded', 'yellow');
      }
    } catch (e) {
      log('❌', 'Failed to check tsconfig', 'red');
    }
  }

  return null;
}

/**
 * Measure build performance
 */
function measureBuildPerformance() {
  log('🚀', 'Measuring build performance...', 'cyan');
  console.log('');

  // Cold build
  log('📊', 'Phase 1: Cold Build (Clearing caches)', 'blue');
  cleanArtifacts();
  const coldBuild = measure('time npm run build 2>&1', 'Cold build');

  if (coldBuild.success) {
    const time = parseTimeOutput(coldBuild.output);
    if (time) {
      const result = checkTarget(time, TARGETS.coldBuild, 'coldBuild');
      log(result.status, `Cold Build: ${result.message}`, result.color);
    }
  } else {
    log('❌', 'Cold build failed', 'red');
    console.error(coldBuild.error);
  }

  console.log('');

  // Incremental build
  log('📊', 'Phase 2: Incremental Build', 'blue');
  execSync('touch src/index.ts', { cwd: rootDir });
  const incBuild = measure('time npm run build 2>&1', 'Incremental build');

  if (incBuild.success) {
    const time = parseTimeOutput(incBuild.output);
    if (time) {
      const result = checkTarget(time, TARGETS.incrementalBuild, 'incrementalBuild');
      log(result.status, `Incremental Build: ${result.message}`, result.color);
    }
  } else {
    log('❌', 'Incremental build failed', 'red');
    console.error(incBuild.error);
  }

  console.log('');

  // Analyze results
  analyzeBundleSize();
}

/**
 * Generate recommendations
 */
function generateRecommendations() {
  log('💡', 'Generating recommendations...', 'cyan');

  const recommendations = [];

  // Check for archived packages
  const tsconfigPath = join(rootDir, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    try {
      const tsconfigContent = readFileSync(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(stripJsonComments(tsconfigContent));
      if (!tsconfig.exclude?.some(p => p.includes('archived'))) {
        recommendations.push({
          priority: 'HIGH',
          title: 'Exclude archived packages from TypeScript',
          description: 'Add "packages/archived" to tsconfig exclude array for faster type checking',
          effort: '5 minutes',
        });
      }
    } catch (error) {
      // Skip if JSON parsing fails
    }
  }

  // Check for watch mode
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (!pkg.scripts['dev:watch']) {
        recommendations.push({
          priority: 'MEDIUM',
          title: 'Add watch mode for development',
          description: 'Add "dev:watch" script for automatic rebuilding during development',
          effort: '10 minutes',
        });
      }
    } catch (error) {
      // Skip if JSON parsing fails
    }
  }

  // Check for large files
  const devRoutesPath = join(rootDir, 'src/routes/dev-routes.ts');
  if (existsSync(devRoutesPath)) {
    const stats = statSync(devRoutesPath);
    if (stats.size > 100000) { // 100KB
      recommendations.push({
        priority: 'LOW',
        title: 'Split large route files',
        description: `dev-routes.ts is ${formatBytes(stats.size)} - consider splitting into modules`,
        effort: '4-6 hours',
      });
    }
  }

  if (recommendations.length > 0) {
    console.log('\n' + colorize('bold', 'Recommendations:'));
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. [${rec.priority}] ${rec.title}`);
      console.log(`   ${rec.description}`);
      console.log(`   Effort: ${rec.effort}`);
    });
  } else {
    log('✅', 'No immediate recommendations - build system is optimal!', 'green');
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  console.log(colorize('bold', '\n🔧 Cocapn Build Performance Optimizer\n'));

  if (args.includes('--clean')) {
    log('🧹', 'Cleaning caches...', 'cyan');
    cleanArtifacts();
    log('✅', 'Caches cleaned', 'green');
  }

  if (args.includes('--analyze')) {
    log('📊', 'Running bundle analysis...', 'cyan');
    measure('npm run build:analyze', 'Build with analysis');
    analyzeBundleComposition();
  } else if (args.includes('--watch')) {
    log('⚡', 'Starting watch mode...', 'cyan');
    log('💡', 'Press Ctrl+C to stop', 'yellow');
    execSync('esbuild src/index.ts --bundle --format=esm --outfile=dist/worker.js --watch', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } else {
    // Full performance analysis
    measureBuildPerformance();
    checkTypeScriptConfig();
    generateRecommendations();
  }

  console.log('\n' + colorize('bold', '✨ Analysis complete!\n'));
}

// Run main function
main();
