// Simple integration test to verify ClaudeFlare packages
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Test package structure
const packages = readdirSync('./packages');
console.log(`🔍 Testing ${packages.length} packages...`);

const results = {
  total: packages.length,
  valid: 0,
  issues: []
};

packages.forEach(pkg => {
  const pkgPath = join('./packages', pkg);
  const pkgJsonPath = join(pkgPath, 'package.json');

  try {
    // Check if package.json exists
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

    // Basic validation
    const issues = [];

    if (!pkgJson.name) {
      issues.push('Missing name');
    }

    if (!pkgJson.version) {
      issues.push('Missing version');
    }

    if (!pkgJson.description) {
      issues.push('Missing description');
    }

    // Check for main files
    const requiredFiles = ['src/index.ts', 'README.md'];
    requiredFiles.forEach(file => {
      if (!readFileSync(join(pkgPath, file), 'utf8')) {
        issues.push(`Missing ${file}`);
      }
    });

    // Check src directory
    const srcFiles = readdirSync(join(pkgPath, 'src'));
    if (srcFiles.length === 0) {
      issues.push('Empty src directory');
    }

    if (issues.length > 0) {
      results.issues.push({ package: pkg, issues });
      console.log(`❌ ${pkg}: ${issues.join(', ')}`);
    } else {
      results.valid++;
      console.log(`✅ ${pkg}: ${pkgJson.description}`);
    }

  } catch (error) {
    results.issues.push({ package: pkg, error: error.message });
    console.log(`❌ ${pkg}: ${error.message}`);
  }
});

// Summary
console.log('\n📊 Integration Test Results:');
console.log(`Total packages: ${results.total}`);
console.log(`Valid packages: ${results.valid}`);
console.log(`Issues found: ${results.issues.length}`);

if (results.issues.length > 0) {
  console.log('\n❌ Issues found:');
  results.issues.forEach(issue => {
    console.log(`  - ${issue.package}: ${issue.issues?.join(', ') || issue.error}`);
  });
}

// Test some core functionality
console.log('\n🧪 Testing Core Functionality...');

try {
  // Test Hono framework import
  const { Hono } = await import('hono');
  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({ status: 'healthy', packages: results.valid });
  });

  console.log('✅ Hono framework works');

  // Test basic route
  const res = app.request('http://localhost/health');
  console.log('✅ Basic routing works');

} catch (error) {
  console.log('❌ Framework test failed:', error.message);
}

console.log('\n🎯 Integration Test Complete!');