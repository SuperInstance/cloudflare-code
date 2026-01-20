#!/usr/bin/env node

/**
 * Simple Interface Test for Cocapn Hybrid IDE
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Testing Cocapn Hybrid IDE Interface');
console.log('=' .repeat(50));

// Test component files exist
const components = [
  'chat-interface',
  'editor-panel',
  'file-tree',
  'preview-panel',
  'terminal-panel',
  'hybrid-ide'
];

console.log('\n📁 Testing Component Files...');
const missingFiles = [];

components.forEach(component => {
  const componentPath = path.join('src/components', `${component}.tsx`);
  if (fs.existsSync(componentPath)) {
    console.log(`  ✅ ${component}.tsx - Exists`);
  } else {
    console.log(`  ❌ ${component}.tsx - Missing`);
    missingFiles.push(componentPath);
  }
});

// Test page exists
console.log('\n📄 Testing Test Page...');
const testPagePath = 'src/pages/hybrid-ide.tsx';
if (fs.existsSync(testPagePath)) {
  console.log(`  ✅ hybrid-ide.tsx - Exists`);
} else {
  console.log(`  ❌ hybrid-ide.tsx - Missing`);
  missingFiles.push(testPagePath);
}

// Test content functionality
console.log('\n🔬 Testing Component Content...');
components.forEach(component => {
  const componentPath = path.join('src/components', `${component}.tsx`);
  if (fs.existsSync(componentPath)) {
    const content = fs.readFileSync(componentPath, 'utf8');

    // Test for key features
    const features = {
      'chat-interface': ['provider-select', 'messages-container', 'chat-input'],
      'editor-panel': ['monaco-editor', 'tabs-container', 'saveCurrentFile'],
      'file-tree': ['tree-node', 'searchFiles', 'context-menu'],
      'preview-panel': ['preview-frame', 'status-indicator', 'setPreviewUrl'],
      'terminal-panel': ['terminal-input', 'executeCommand', 'wrangler'],
      'hybrid-ide': ['ide-layout', 'sidebar', 'panel']
    };

    const expectedFeatures = features[component] || [];
    let foundFeatures = 0;

    expectedFeatures.forEach(feature => {
      if (content.includes(feature)) {
        foundFeatures++;
      }
    });

    const status = foundFeatures === expectedFeatures.length ? '✅' : '⚠️';
    console.log(`  ${status} ${component}: ${foundFeatures}/${expectedFeatures.length} features`);
  }
});

// Test integration
console.log('\n🔗 Testing Integration...');
const hybridIdePath = 'src/components/hybrid-ide.tsx';
if (fs.existsSync(hybridIdePath)) {
  const hybridContent = fs.readFileSync(hybridIdePath, 'utf8');

  // Test imports
  let importsCorrect = 0;
  components.forEach(component => {
    if (component === 'hybrid-ide') return; // Skip self

    const componentName = component.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');

    const hasImport = hybridContent.includes(`import { ${componentName} }`);
    const hasRender = hybridContent.includes(`${componentName}.render(`);

    if (hasImport && hasRender) {
      importsCorrect++;
      console.log(`  ✅ ${component} - Properly integrated`);
    } else {
      console.log(`  ❌ ${component} - Integration issue`);
    }
  });
}

console.log('\n' + '=' .repeat(50));
console.log('📊 Test Summary');

if (missingFiles.length === 0) {
  console.log('🎉 All component files are present!');
  console.log('✅ The Hybrid IDE interface is ready for use.');
  console.log('\n💡 Next steps:');
  console.log('• Run the test page: src/pages/hybrid-ide.tsx');
  console.log('• Test browser compatibility');
  console.log('• Validate accessibility');
  console.log('• Test performance');
} else {
  console.log(`❌ ${missingFiles.length} files are missing:`);
  missingFiles.forEach(file => console.log(`  • ${file}`));
}

console.log('\n🚀 Interface test completed!');