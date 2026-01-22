/**
 * Basic Usage Examples for Dependency Analyzer
 */

import { DependencyAnalyzer, createAnalyzer } from '../src/index.js';

async function basicExample() {
  console.log('=== Basic Dependency Analysis ===\n');

  // Create analyzer with auto-detection
  const analyzer = await createAnalyzer();

  // Perform complete analysis
  const result = await analyzer.analyze();

  console.log('Project:', result.projectPath);
  console.log('Total Modules:', result.summary.totalModules);
  console.log('Total Dependencies:', result.summary.totalDependencies);
  console.log('Circular Dependencies:', result.summary.circularDependencies);
  console.log('Unused Dependencies:', result.summary.unusedDependencies);
  console.log('Vulnerabilities:', result.summary.vulnerabilities);
  console.log('License Issues:', result.summary.licenseIssues);
}

async function circularDependencyExample() {
  console.log('\n=== Circular Dependency Detection ===\n');

  const analyzer = await createAnalyzer();
  await analyzer.buildGraph();

  const { cycles } = await analyzer.detectCircular();

  if (cycles.length === 0) {
    console.log('✓ No circular dependencies found');
    return;
  }

  console.log(`Found ${cycles.length} circular dependencies:\n`);

  for (const cycle of cycles) {
    console.log(`${cycle.type} cycle (severity: ${cycle.severity})`);
    console.log('  Path:', cycle.path.join(' -> '));
    console.log('  Suggestions:');
    for (const suggestion of cycle.suggestions) {
      console.log('    •', suggestion);
    }
    console.log('');
  }
}

async function unusedDependencyExample() {
  console.log('\n=== Unused Dependency Detection ===\n');

  const analyzer = await createAnalyzer();
  const { dependencies, code } = await analyzer.detectUnused();

  console.log(`Found ${dependencies.length} unused dependencies`);
  console.log(`Found ${code.length} unused code items\n`);

  if (dependencies.length > 0) {
    console.log('Unused Dependencies:');
    for (const dep of dependencies.slice(0, 10)) {
      console.log(`  • ${dep.name}@${dep.version}`);
      console.log(`    Type: ${dep.type}`);
      console.log(`    Reason: ${dep.reason}`);
      if (dep.size) {
        console.log(`    Size: ${(dep.size / 1024).toFixed(2)} KB`);
      }
    }
  }

  if (code.length > 0) {
    console.log('\nUnused Code (first 10):');
    for (const item of code.slice(0, 10)) {
      console.log(`  • ${item.file}:${item.line}:${item.column}`);
      console.log(`    ${item.type}: ${item.name}`);
    }
  }
}

async function updateCheckExample() {
  console.log('\n=== Dependency Update Check ===\n');

  const analyzer = await createAnalyzer();
  const { updates } = await analyzer.checkUpdates();

  const major = updates.filter((u) => u.type === 'major');
  const minor = updates.filter((u) => u.type === 'minor');
  const patch = updates.filter((u) => u.type === 'patch');

  console.log(`Total updates: ${updates.length}`);
  console.log(`  Major: ${major.length}`);
  console.log(`  Minor: ${minor.length}`);
  console.log(`  Patch: ${patch.length}\n`);

  if (major.length > 0) {
    console.log('Major Updates (review carefully):');
    for (const update of major.slice(0, 5)) {
      console.log(`  • ${update.name}: ${update.currentVersion} → ${update.latestVersion}`);
      if (update.breaking) {
        console.log(`    ⚠️  May contain breaking changes`);
      }
    }
  }
}

async function licenseAnalysisExample() {
  console.log('\n=== License Analysis ===\n');

  const analyzer = await createAnalyzer();
  const { licenses, issues } = await analyzer.analyzeLicenses();

  // Group by type
  const byType = new Map<string, string[]>();
  for (const [pkg, license] of licenses) {
    if (!byType.has(license.type)) {
      byType.set(license.type, []);
    }
    byType.get(license.type)!.push(pkg);
  }

  console.log('License Distribution:');
  for (const [type, packages] of byType) {
    console.log(`  ${type}: ${packages.length}`);
  }

  if (issues.length > 0) {
    console.log('\nCompliance Issues:');
    for (const issue of issues) {
      console.log(`  ${issue.severity.toUpperCase()}: ${issue.package}`);
      console.log(`    License: ${issue.license}`);
      console.log(`    Issue: ${issue.issue}`);
    }
  }
}

async function securityScanExample() {
  console.log('\n=== Security Scan ===\n');

  const analyzer = new DependencyAnalyzer({
    projectPath: process.cwd(),
    packageManager: 'npm',
    rules: {
      security: {
        enabled: true,
        severity: ['critical', 'high', 'moderate'],
      },
    },
  });

  const { vulnerabilities, summary } = await analyzer.scanSecurity();

  console.log('Vulnerability Summary:');
  console.log(`  Critical: ${summary.critical}`);
  console.log(`  High: ${summary.high}`);
  console.log(`  Moderate: ${summary.moderate}`);
  console.log(`  Low: ${summary.low}`);

  if (vulnerabilities.length > 0) {
    console.log('\nVulnerabilities (first 10):');
    for (const vuln of vulnerabilities.slice(0, 10)) {
      console.log(`\n  ${vuln.packageName} (${vuln.id})`);
      console.log(`  Severity: ${vuln.severity}`);
      console.log(`  ${vuln.title}`);
      if (vuln.patchedVersions) {
        console.log(`  Patched: ${vuln.patchedVersions.join(', ')}`);
      }
    }
  }
}

async function optimizationExample() {
  console.log('\n=== Bundle Optimization ===\n');

  const analyzer = await createAnalyzer();
  await analyzer.buildGraph();

  const { bundle } = await analyzer.optimize();

  console.log('Bundle Analysis:');
  console.log(`  Total Dependencies: ${bundle.dependencies}`);
  console.log(`  Total Size: ${(bundle.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Tree-shakeable: ${(bundle.treeShakeable / 1024 / 1024).toFixed(2)} MB`);

  if (bundle.duplicates.length > 0) {
    console.log('\nDuplicate Dependencies:');
    for (const dup of bundle.duplicates.slice(0, 5)) {
      console.log(`  • ${dup.name}`);
      console.log(`    Versions: ${dup.versions.join(', ')}`);
      console.log(`    Wasted: ${(dup.totalSize / 1024).toFixed(2)} KB`);
    }
  }

  if (bundle.lazyLoadCandidates.length > 0) {
    console.log('\nLazy Load Candidates:');
    for (const candidate of bundle.lazyLoadCandidates.slice(0, 5)) {
      console.log(`  • ${candidate.import}`);
      console.log(`    Impact: ${(candidate.impact / 1024).toFixed(2)} KB`);
      console.log(`    Reason: ${candidate.reason}`);
    }
  }
}

async function visualizationExample() {
  console.log('\n=== Graph Visualization ===\n');

  const analyzer = await createAnalyzer();
  await analyzer.buildGraph();

  // Generate different visualizations
  const dot = analyzer.visualize('dot');
  const json = analyzer.visualize('json');
  const mermaid = analyzer.visualize('mermaid');

  console.log('DOT format (for Graphviz):');
  console.log(dot.substring(0, 200) + '...\n');

  console.log('JSON format:');
  console.log(json.substring(0, 200) + '...\n');

  console.log('Mermaid format:');
  console.log(mermaid.substring(0, 200) + '...\n');
}

async function reportGenerationExample() {
  console.log('\n=== Report Generation ===\n');

  const analyzer = await createAnalyzer();

  // Generate different report formats
  const markdown = await analyzer.generateReport();
  const json = await analyzer.exportResults('json');
  const html = await analyzer.exportResults('html');

  console.log('Markdown report length:', markdown.length);
  console.log('JSON report length:', json.length);
  console.log('HTML report length:', html.length);

  // Save reports
  const { writeFile } = await import('fs/promises');
  await writeFile('dependency-report.md', markdown);
  await writeFile('dependency-report.json', json);
  await writeFile('dependency-report.html', html);

  console.log('\nReports saved:');
  console.log('  • dependency-report.md');
  console.log('  • dependency-report.json');
  console.log('  • dependency-report.html');
}

async function customConfigurationExample() {
  console.log('\n=== Custom Configuration ===\n');

  // Create analyzer with custom configuration
  const analyzer = new DependencyAnalyzer({
    projectPath: process.cwd(),
    packageManager: 'npm',
    include: ['src/**/*.ts', 'lib/**/*.ts'],
    exclude: ['node_modules/**', 'dist/**', '**/*.test.ts'],
    rules: {
      circular: {
        enabled: true,
        maxDepth: 15,
        ignorePatterns: ['\\.test\\.ts$', '\\.spec\\.ts$'],
      },
      unused: {
        enabled: true,
        includeExports: true,
        ignorePatterns: ['index\\.ts$'],
      },
      security: {
        enabled: true,
        severity: ['critical', 'high'],
      },
      license: {
        enabled: true,
        allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
      },
    },
  });

  const result = await analyzer.analyze();
  console.log('Analysis with custom configuration complete');
  console.log('Found', result.summary.circularDependencies, 'circular dependencies');
  console.log('Found', result.summary.vulnerabilities, 'vulnerabilities');
}

async function optimizationSuggestionsExample() {
  console.log('\n=== Optimization Suggestions ===\n');

  const analyzer = await createAnalyzer();
  const suggestions = await analyzer.getSuggestions();

  console.log(`Found ${suggestions.length} optimization suggestions:\n`);

  // Group by priority
  const byPriority = {
    high: suggestions.filter((s) => s.priority === 'high'),
    medium: suggestions.filter((s) => s.priority === 'medium'),
    low: suggestions.filter((s) => s.priority === 'low'),
  };

  for (const [priority, items] of Object.entries(byPriority)) {
    if (items.length === 0) continue;

    console.log(`${priority.toUpperCase()} Priority (${items.length}):`);
    for (const suggestion of items.slice(0, 5)) {
      console.log(`  • ${suggestion.title}`);
      console.log(`    ${suggestion.description}`);
      console.log(`    Impact: size=${suggestion.impact.size}, performance=${suggestion.impact.performance}`);
      console.log(`    Effort: ${suggestion.effort}`);
      if (suggestion.code) {
        console.log(`    Code:\n${suggestion.code}`);
      }
      console.log('');
    }
  }
}

// Run all examples
async function main() {
  try {
    await basicExample();
    await circularDependencyExample();
    await unusedDependencyExample();
    await updateCheckExample();
    await licenseAnalysisExample();
    await securityScanExample();
    await optimizationExample();
    await visualizationExample();
    await reportGenerationExample();
    await customConfigurationExample();
    await optimizationSuggestionsExample();
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main();
}
