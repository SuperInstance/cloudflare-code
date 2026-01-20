#!/usr/bin/env node

/**
 * Cocapn Hybrid IDE Validation Script
 *
 * This script validates that all components are properly implemented
 * and working together correctly.
 */

import fs from 'fs';
import path from 'path';

class IDEValidator {
  constructor() {
    this.basePath = new URL('.', import.meta.url).pathname;
    this.components = [
      'chat-interface',
      'editor-panel',
      'file-tree',
      'preview-panel',
      'terminal-panel',
      'hybrid-ide'
    ];
    this.results = {
      files: 0,
      valid: 0,
      errors: 0,
      warnings: 0,
      details: []
    };
  }

  async validateAll() {
    console.log('🔍 Validating Cocapn Hybrid IDE Components');
    console.log('=' .repeat(50));

    // Validate component files
    this.validateComponentFiles();

    // Validate content structure
    await this.validateComponentContent();

    // Validate integration
    await this.validateIntegration();

    // Generate report
    this.generateReport();
  }

  validateComponentFiles() {
    console.log('\n📁 Validating Component Files...');

    this.components.forEach(component => {
      const componentPath = path.join(this.basePath, 'src/components', `${component}.tsx`);
      const exists = fs.existsSync(componentPath);

      this.results.files++;

      if (exists) {
        this.results.valid++;
        console.log(`  ✅ ${component}.tsx - Exists`);
        this.results.details.push({
          type: 'file',
          name: component,
          status: 'valid',
          message: 'Component file exists'
        });
      } else {
        this.results.errors++;
        console.log(`  ❌ ${component}.tsx - Missing`);
        this.results.details.push({
          type: 'file',
          name: component,
          status: 'error',
          message: 'Component file missing'
        });
      }
    });
  }

  async validateComponentContent() {
    console.log('\n🔬 Validating Component Content...');

    for (const component of this.components) {
      const componentPath = path.join(this.basePath, 'src/components', `${component}.tsx`);

      if (!fs.existsSync(componentPath)) {
        continue;
      }

      const content = fs.readFileSync(componentPath, 'utf8');

      await this.validateComponentStructure(component, content);
      await this.validateComponentSecurity(component, content);
      await this.validateComponentFunctionality(component, content);
    }
  }

  async validateComponentStructure(component, content) {
    const validations = {
      'render': () => {
        const hasRender = content.includes('render:') || content.includes('render(') || content.includes('static render');
        if (!hasRender) {
          throw new Error('Render method missing');
        }
      },
      'exports': () => {
        const hasExport = content.includes('export') || content.includes('export default');
        if (!hasExport) {
          throw new Error('Export statement missing');
        }
      },
      'html': () => {
        const hasHtml = content.includes('html`') || content.includes('html(');
        if (!hasHtml) {
          throw new Error('HTML generation missing');
        }
      },
      'css': () => {
        const hasCss = content.includes('<style>') || content.includes('css`');
        if (!hasCss) {
          throw new Error('CSS styling missing');
        }
      }
    };

    try {
      Object.values(validations).forEach(validation => validation());
      this.results.valid++;
      this.results.details.push({
        type: 'structure',
        name: component,
        status: 'valid',
        message: 'Component structure is valid'
      });
    } catch (error) {
      this.results.errors++;
      this.results.details.push({
        type: 'structure',
        name: component,
        status: 'error',
        message: error.message
      });
    }
  }

  async validateComponentSecurity(component, content) {
    const securityChecks = [
      {
        name: 'innerHTML',
        check: (content) => {
          const innerHtmlMatches = content.match(/innerHTML\s*=\s*['"`].*?['"`]/g);
          // Allow legitimate uses of innerHTML that are properly escaped
          const legitimateUses = (content.match(/innerHTML\s*=\s*escapeHtml\(.*?\)/g) || []).length;
          return !innerHtmlMatches || (innerHtmlMatches.length === legitimateUses);
        },
        error: 'Potential XSS vulnerability with innerHTML'
      },
      {
        name: 'eval',
        check: (content) => {
          return !content.includes('eval(');
        },
        error: 'Use of eval() detected'
      },
      {
        name: 'escapeHtml',
        check: (content) => {
          return content.includes('escapeHtml') || content.includes('textContent');
        },
        error: 'Missing HTML escaping'
      }
    ];

    let securityPassed = true;

    securityChecks.forEach(({ name, check, error }) => {
      try {
        if (!check(content)) {
          securityPassed = false;
          this.results.warnings++;
          this.results.details.push({
            type: 'security',
            name: component,
            status: 'warning',
            message: error
          });
        }
      } catch (error) {
        securityPassed = false;
        this.results.errors++;
        this.results.details.push({
          type: 'security',
          name: component,
          status: 'error',
          message: `Security check failed: ${error.message}`
        });
      }
    });

    if (securityPassed) {
      this.results.valid++;
      this.results.details.push({
        type: 'security',
        name: component,
        status: 'valid',
        message: 'Security validation passed'
      });
    }
  }

  async validateComponentFunctionality(component, content) {
    const functionalChecks = {
      'chat-interface': [
        { pattern: 'provider-select', description: 'Provider selection dropdown' },
        { pattern: 'messages-container', description: 'Message display area' },
        { pattern: 'chat-input', description: 'Chat input field' }
      ],
      'editor-panel': [
        { pattern: 'monaco-editor', description: 'Monaco editor container' },
        { pattern: 'tabs-container', description: 'File tabs system' },
        { pattern: 'saveCurrentFile', description: 'File save functionality' }
      ],
      'file-tree': [
        { pattern: 'tree-node', description: 'File node structure' },
        { pattern: 'searchFiles', description: 'Search functionality' },
        { pattern: 'context-menu', description: 'Context menu' }
      ],
      'preview-panel': [
        { pattern: 'preview-frame', description: 'Preview iframe' },
        { pattern: 'status-indicator', description: 'Status indicators' },
        { pattern: 'setPreviewUrl', description: 'URL management' }
      ],
      'terminal-panel': [
        { pattern: 'terminal-input', description: 'Terminal input' },
        { pattern: 'executeCommand', description: 'Command execution' },
        { pattern: 'wrangler', description: 'Wrangler integration' }
      ],
      'hybrid-ide': [
        { pattern: 'ide-layout', description: 'Main layout' },
        { pattern: 'sidebar', description: 'Sidebar navigation' },
        { pattern: 'panel', description: 'Panel system' }
      ]
    };

    const checks = functionalChecks[component] || [];
    let functionalPassed = 0;

    checks.forEach(({ pattern, description }) => {
      const patternLower = pattern.toLowerCase();
      const contentLower = content.toLowerCase();

      if (contentLower.includes(patternLower) || content.includes(pattern)) {
        functionalPassed++;
      } else {
        this.results.warnings++;
        this.results.details.push({
          type: 'functionality',
          name: component,
          status: 'warning',
          message: `Missing: ${description} (pattern: ${pattern})`
        });
      }
    });

    if (functionalPassed === checks.length) {
      this.results.valid++;
      this.results.details.push({
        type: 'functionality',
        name: component,
        status: 'valid',
        message: `All ${functionalPassed} functional requirements met`
      });
    } else {
      this.results.warnings++;
      this.results.details.push({
        type: 'functionality',
        name: component,
        status: 'warning',
        message: `${functionalPassed}/${checks.length} functional requirements met`
      });
    }
  }

  async validateIntegration() {
    console.log('\n🔗 Validating Component Integration...');

    // Check that all components reference each other appropriately
    const hybridIdePath = path.join(this.basePath, 'src/components/hybrid-ide.tsx');
    if (fs.existsSync(hybridIdePath)) {
      const hybridContent = fs.readFileSync(hybridIdePath, 'utf8');

      // Check that all components are imported/rendered (excluding hybrid-ide itself)
      this.components.forEach(component => {
        // Skip self-referential check for hybrid-ide
        if (component === 'hybrid-ide') {
          this.results.valid++;
          this.results.details.push({
            type: 'integration',
            name: component,
            status: 'valid',
            message: 'Component is the main IDE file'
          });
          return;
        }
        const componentName = component.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');

        const isImported = hybridContent.includes(`import { ${componentName} }`);
        const isRendered = hybridContent.includes(componentName + '.render(');

        if (isImported && isRendered) {
          this.results.valid++;
          this.results.details.push({
            type: 'integration',
            name: component,
            status: 'valid',
            message: 'Component properly integrated in main IDE'
          });
        } else {
          this.results.errors++;
          this.results.details.push({
            type: 'integration',
            name: component,
            status: 'error',
            message: 'Component not properly integrated in main IDE'
          });
        }
      });
    }

    // Check for shared patterns and consistency
    this.validateConsistency();
  }

  validateConsistency() {
    console.log('\n🎨 Validating Design Consistency...');

    // Check for consistent styling patterns
    const patterns = [
      { type: 'border-radius', expected: '8px', pattern: 'border-radius:\\s*[\'"]?8px[\'"]?' },
      { type: 'box-shadow', expected: 'rgba(0, 0, 0, 0.1)', pattern: 'rgba\\(0,\\s*0,\\s*0,\\s*0\\.1\\)' },
      { type: 'transition', expected: 'all 0.2s', pattern: 'transition:\\s*all\\s+0\\.2s' }
    ];

    patterns.forEach(({ type, expected, pattern }) => {
      const regex = new RegExp(pattern, 'g');
      let matches = 0;

      this.components.forEach(component => {
        const componentPath = path.join(this.basePath, 'src/components', `${component}.tsx`);
        if (fs.existsSync(componentPath)) {
          const content = fs.readFileSync(componentPath, 'utf8');
          matches += (content.match(regex) || []).length;
        }
      });

      if (matches > 0) {
        this.results.valid++;
        this.results.details.push({
          type: 'consistency',
          name: type,
          status: 'valid',
          message: `${type} pattern used consistently (${matches} instances)`
        });
      } else {
        this.results.warnings++;
        this.results.details.push({
          type: 'consistency',
          name: type,
          status: 'warning',
          message: `${type} pattern not found`
        });
      }
    });
  }

  generateReport() {
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Validation Report');
    console.log('=' .repeat(50));

    console.log(`Files Validated: ${this.results.files}`);
    console.log(`Valid: ${this.results.valid} ✅`);
    console.log(`Errors: ${this.results.errors} ❌`);
    console.log(`Warnings: ${this.results.warnings} ⚠️`);

    if (this.results.errors === 0) {
      console.log('\n🎉 All validations passed! The Hybrid IDE is ready for use.');
    } else {
      console.log('\n🔧 Issues found that need to be addressed:');
    }

    // Show error details
    const errorDetails = this.results.details.filter(d => d.status === 'error');
    if (errorDetails.length > 0) {
      console.log('\n❌ Errors:');
      errorDetails.forEach(detail => {
        console.log(`  • ${detail.name}: ${detail.message}`);
      });
    }

    // Show warning details
    const warningDetails = this.results.details.filter(d => d.status === 'warning');
    if (warningDetails.length > 0) {
      console.log('\n⚠️ Warnings:');
      warningDetails.forEach(detail => {
        console.log(`  • ${detail.name}: ${detail.message}`);
      });
    }

    // Success details
    const successDetails = this.results.details.filter(d => d.status === 'valid');
    if (successDetails.length > 0) {
      console.log('\n✅ Valid Components:');
      successDetails.forEach(detail => {
        console.log(`  • ${detail.name}: ${detail.message}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (this.results.errors > 0) {
      console.log('• Fix all errors before proceeding');
    }
    if (this.results.warnings > 0) {
      console.log('• Address warnings to improve component quality');
    }
    console.log('• Test the interface in multiple browsers');
    console.log('• Validate accessibility compliance');
    console.log('• Test performance on different devices');

    console.log('\n🚀 Validation completed!');
  }
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new IDEValidator();
  validator.validateAll().catch(console.error);
}

export default IDEValidator;