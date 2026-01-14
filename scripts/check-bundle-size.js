#!/usr/bin/env node

/**
 * Bundle Size Check Script
 * Ensures bundle size stays within Cloudflare Workers 3MB limit
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_SIZE_LIMIT = 3 * 1024 * 1024; // 3MB in bytes
const WARNING_THRESHOLD = 2.5 * 1024 * 1024; // 2.5MB warning

const BUNDLE_FILE = './dist/worker.js';

console.log('📦 Checking bundle size...');
console.log('');

if (!fs.existsSync(BUNDLE_FILE)) {
  console.error('❌ Bundle file not found:', BUNDLE_FILE);
  console.error('Run "npm run build" first.');
  process.exit(1);
}

const stats = fs.statSync(BUNDLE_FILE);
const bundleSize = stats.size;
const bundleSizeMB = (bundleSize / 1024 / 1024).toFixed(2);
const limitMB = (BUNDLE_SIZE_LIMIT / 1024 / 1024).toFixed(2);
const usagePercent = ((bundleSize / BUNDLE_SIZE_LIMIT) * 100).toFixed(2);

console.log(`Bundle Size: ${bundleSizeMB} MB`);
console.log(`Size Limit: ${limitMB} MB`);
console.log(`Usage: ${usagePercent}%`);
console.log('');

if (bundleSize > BUNDLE_SIZE_LIMIT) {
  console.error('❌ Bundle size exceeds Cloudflare Workers 3MB limit!');
  console.error('');
  console.error('Please optimize your bundle:');
  console.error('  - Use tree-shaking');
  console.error('  - Remove unused dependencies');
  console.error('  - Code splitting for large modules');
  console.error('  - Minification is already enabled');
  process.exit(1);
}

if (bundleSize > WARNING_THRESHOLD) {
  console.warn('⚠️  Bundle size approaching limit!');
  console.warn('Consider optimizing before it exceeds 3MB.');
  process.exit(0);
}

console.log('✅ Bundle size within acceptable limits!');
process.exit(0);
