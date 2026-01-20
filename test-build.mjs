#!/usr/bin/env node

/**
 * Test build process for Cocapn Hybrid IDE
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Cocapn Hybrid IDE Build Process');
console.log('=' .repeat(50));

// Test 1: Check if required files exist
console.log('\n📁 Checking required files...');

const requiredFiles = [
  'src/worker.ts',
  'src/components/chat-interface.tsx',
  'src/components/editor-panel.tsx',
  'src/components/file-tree.tsx',
  'src/components/preview-panel.tsx',
  'src/components/terminal-panel.tsx',
  'src/components/hybrid-ide.tsx',
  'wrangler-ide.toml',
];

const missingFiles = [];
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    missingFiles.push(file);
  }
});

// Test 2: Build process
console.log('\n🔨 Testing build process...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('  ✅ Build successful');
} catch (error) {
  console.log('  ❌ Build failed');
  process.exit(1);
}

// Test 3: Check built files
console.log('\n📦 Checking built files...');
const builtFiles = [
  'dist/worker.js',
  'dist/worker.js.map'
];

builtFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`  ✅ ${file} (${stats.size.toLocaleString()} bytes)`);
  } else {
    console.log(`  ❌ ${file}`);
  }
});

// Test 4: Validate wrangler configuration
console.log('\n⚙️  Validating wrangler configuration...');
try {
  execSync('wrangler config list', { stdio: 'pipe' });
  console.log('  ✅ Wrangler configuration valid');
} catch (error) {
  console.log('  ⚠️  Wrangler configuration issues');
}

// Test 5: Check Cloudflare login
console.log('\n🔐 Checking Cloudflare login...');
try {
  const whoami = execSync('wrangler whoami --format json', { encoding: 'utf8', stdio: 'pipe' });
  const userInfo = JSON.parse(whoami);
  console.log(`  ✅ Logged in as: ${userInfo.email}`);
  console.log(`  ✅ Account ID: ${userInfo.account_id}`);
} catch (error) {
  console.log('  ❌ Not logged in to Cloudflare');
}

// Final Summary
console.log('\n' + '=' .repeat(50));
console.log('📊 BUILD TEST SUMMARY');
console.log('=' .repeat(50));

if (missingFiles.length === 0) {
  console.log('✅ All required files present');
} else {
  console.log(`❌ ${missingFiles.length} missing files: ${missingFiles.join(', ')}`);
}

console.log('🏗️  Build Status: ' + (fs.existsSync('dist/worker.js') ? '✅ Ready' : '❌ Failed'));

if (fs.existsSync('dist/worker.js')) {
  console.log('\n🚀 READY FOR DEPLOYMENT!');
  console.log('💡 Next steps:');
  console.log('1. Set up API key secrets');
  console.log('2. Run ./deploy.sh staging');
  console.log('3. Test in staging environment');
  console.log('4. Deploy to production with ./deploy.sh production');
} else {
  console.log('\n⚠️  Build issues need to be resolved before deployment');
}

console.log('\n🎯 Build test completed!');