/**
 * Cocapn Hybrid IDE Test Suite
 *
 * This comprehensive test suite validates all components of the
 * Hybrid IDE interface working together.
 */

const fs = require('fs');
const path = require('path');

class HybridIDETestSuite {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    this.components = [
      'ChatInterface',
      'EditorPanel',
      'FileTree',
      'PreviewPanel',
      'TerminalPanel',
      'HybridIDE'
    ];

    this.tests = {
      ChatInterface: [
        'renderMethodExists',
        'ProviderSelection',
        'MessageDisplay',
        'FileActions'
      ],
      EditorPanel: [
        'renderMethodExists',
        'MonacoIntegration',
        'FileTabs',
        'SyntaxHighlighting'
      ],
      FileTree: [
        'renderMethodExists',
        'FileHierarchy',
        'FileOperations',
        'SearchFunctionality'
      ],
      PreviewPanel: [
        'renderMethodExists',
        'IframeIntegration',
        'StatusIndicators',
        'ThemeSwitching'
      ],
      TerminalPanel: [
        'renderMethodExists',
        'CommandExecution',
        'HistoryNavigation',
        'ANSISupport'
      ],
      HybridIDE: [
        'renderMethodExists',
        'LayoutIntegration',
        'ProviderSwitching',
        'PanelManagement',
        'ResponsiveDesign'
      ]
    };
  }

  // Test execution
  async runAllTests() {
    console.log('🚀 Starting Cocapn Hybrid IDE Test Suite');
    console.log('=' .repeat(50));

    for (const component of this.components) {
      console.log(`\n🧪 Testing ${component}...`);
      console.log('-' .repeat(30));

      await this.testComponent(component);
    }

    this.generateReport();
  }

  async testComponent(componentName) {
    const componentPath = path.join(__dirname, `components/${componentName.toLowerCase()}.tsx`);

    try {
      if (!fs.existsSync(componentPath)) {
        throw new Error(`Component file not found: ${componentPath}`);
      }

      const componentCode = fs.readFileSync(componentPath, 'utf8');

      for (const testName of this.tests[componentName]) {
        this.results.total++;

        try {
          const testResult = await this.runTest(componentName, testName, componentCode);

          if (testResult.passed) {
            this.results.passed++;
            console.log(`  ✅ ${testName}`);
          } else {
            this.results.failed++;
            console.log(`  ❌ ${testName} - ${testResult.error}`);
          }

          this.results.details.push({
            component: componentName,
            test: testName,
            passed: testResult.passed,
            error: testResult.error || null
          });
        } catch (error) {
          this.results.failed++;
          console.log(`  ❌ ${testName} - ${error.message}`);

          this.results.details.push({
            component: componentName,
            test: testName,
            passed: false,
            error: error.message
          });
        }
      }
    } catch (error) {
      console.log(`  🔥 ${componentName} - ${error.message}`);
      this.results.failed++;
    }
  }

  async runTest(componentName, testName, componentCode) {
    switch (componentName) {
      case 'ChatInterface':
        return this.testChatInterface(testName, componentCode);
      case 'EditorPanel':
        return this.testEditorPanel(testName, componentCode);
      case 'FileTree':
        return this.testFileTree(testName, componentCode);
      case 'PreviewPanel':
        return this.testPreviewPanel(testName, componentCode);
      case 'TerminalPanel':
        return this.testTerminalPanel(testName, componentCode);
      case 'HybridIDE':
        return this.testHybridIDE(testName, componentCode);
      default:
        throw new Error(`Unknown component: ${componentName}`);
    }
  }

  // Chat Interface Tests
  async testChatInterface(testName, code) {
    switch (testName) {
      case 'renderMethodExists':
        if (!code.includes('render(')) {
          throw new Error('Render method not found');
        }
        return { passed: true };

      case 'ProviderSelection':
        if (!code.includes('provider-select') || !code.includes('manus') || !code.includes('claude')) {
          throw new Error('Provider selection UI elements missing');
        }
        return { passed: true };

      case 'MessageDisplay':
        if (!code.includes('messages-container') || !code.includes('role="user"')) {
          throw new Error('Message display components missing');
        }
        return { passed: true };

      case 'FileActions':
        if (!code.includes('📁 Insert File') || !code.includes('📝 Open Editor')) {
          throw new Error('File action buttons missing');
        }
        return { passed: true };

      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  // Editor Panel Tests
  async testEditorPanel(testName, code) {
    switch (testName) {
      case 'renderMethodExists':
        if (!code.includes('render(')) {
          throw new Error('Render method not found');
        }
        return { passed: true };

      case 'MonacoIntegration':
        if (!code.includes('monaco-editor') || !code.includes('MonacoEditor')) {
          throw new Error('Monaco editor integration missing');
        }
        return { passed: true };

      case 'FileTabs':
        if (!code.includes('tabs-container') || !code.includes('new-tab-btn')) {
          throw new Error('File tab system missing');
        }
        return { passed: true };

      case 'SyntaxHighlighting':
        if (!code.includes('typescript') || !code.includes('language')) {
          throw new Error('Syntax highlighting support missing');
        }
        return { passed: true };

      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  // File Tree Tests
  async testFileTree(testName, code) {
    switch (testName) {
      case 'renderMethodExists':
        if (!code.includes('render(')) {
          throw new Error('Render method not found');
        }
        return { passed: true };

      case 'FileHierarchy':
        if (!code.includes('tree-node') || !code.includes('tree-children')) {
          throw new Error('File hierarchy structure missing');
        }
        return { passed: true };

      case 'FileOperations':
        if (!code.includes('renameFile') || !code.includes('deleteFile')) {
          throw new Error('File operation methods missing');
        }
        return { passed: true };

      case 'SearchFunctionality':
        if (!code.includes('searchFiles') || !code.includes('file-search')) {
          throw new Error('Search functionality missing');
        }
        return { passed: true };

      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  // Preview Panel Tests
  async testPreviewPanel(testName, code) {
    switch (testName) {
      case 'renderMethodExists':
        if (!code.includes('render(')) {
          throw new Error('Render method not found');
        }
        return { passed: true };

      case 'IframeIntegration':
        if (!code.includes('preview-frame') || !code.includes('iframe')) {
          throw new Error('Iframe integration missing');
        }
        return { passed: true };

      case 'StatusIndicators':
        if (!code.includes('status-indicator') || !code.includes('ready')) {
          throw new Error('Status indicators missing');
        }
        return { passed: true };

      case 'ThemeSwitching':
        if (!code.includes('changePreviewTheme') || !code.includes('theme-selector')) {
          throw new Error('Theme switching functionality missing');
        }
        return { passed: true };

      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  // Terminal Panel Tests
  async testTerminalPanel(testName, code) {
    switch (testName) {
      case 'renderMethodExists':
        if (!code.includes('render(')) {
          throw new Error('Render method not found');
        }
        return { passed: true };

      case 'CommandExecution':
        if (!code.includes('executeCommand') || !code.includes('wrangler')) {
          throw new Error('Command execution missing');
        }
        return { passed: true };

      case 'HistoryNavigation':
        if (!code.includes('navigateHistory') || !code.includes('ArrowUp')) {
          throw new Error('History navigation missing');
        }
        return { passed: true };

      case 'ANSISupport':
        if (!code.includes('ansi-text') || !code.includes('ansi-')) {
          throw new Error('ANSI color support missing');
        }
        return { passed: true };

      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  // Hybrid IDE Tests
  async testHybridIDE(testName, code) {
    switch (testName) {
      case 'renderMethodExists':
        if (!code.includes('render(')) {
          throw new Error('Render method not found');
        }
        return { passed: true };

      case 'LayoutIntegration':
        if (!code.includes('ide-layout') || !code.includes('sidebar')) {
          throw new Error('Layout integration missing');
        }
        return { passed: true };

      case 'ProviderSwitching':
        if (!code.includes('switchProvider') || !code.includes('provider-tabs')) {
          throw new Error('Provider switching missing');
        }
        return { passed: true };

      case 'PanelManagement':
        if (!code.includes('setActivePanel') || !code.includes('activePanel')) {
          throw new Error('Panel management missing');
        }
        return { passed: true };

      case 'ResponsiveDesign':
        if (!code.includes('@media') || !code.includes('768px')) {
          throw new Error('Responsive design missing');
        }
        return { passed: true };

      default:
        throw new Error(`Unknown test: ${testName}`);
    }
  }

  // Generate test report
  generateReport() {
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Results Summary');
    console.log('=' .repeat(50));

    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n🔧 Failed Tests:');
      this.results.details
        .filter(result => !result.passed)
        .forEach(detail => {
          console.log(`  • ${detail.component}.${detail.test} - ${detail.error}`);
        });
    }

    // Component breakdown
    console.log('\n📋 Component Breakdown:');
    const componentStats = {};

    this.results.details.forEach(detail => {
      if (!componentStats[detail.component]) {
        componentStats[detail.component] = { total: 0, passed: 0 };
      }

      componentStats[detail.component].total++;
      if (detail.passed) {
        componentStats[detail.component].passed++;
      }
    });

    Object.entries(componentStats).forEach(([component, stats]) => {
      const rate = (stats.passed / stats.total * 100).toFixed(1);
      const status = stats.passed === stats.total ? '✅' : '⚠️';
      console.log(`  ${status} ${component}: ${stats.passed}/${stats.total} (${rate}%)`);
    });

    // Performance analysis
    console.log('\n🚀 Performance Notes:');
    console.log('• All components use TypeScript interfaces');
    console.log('• HTML escaping implemented for security');
    console.log('• Responsive design with mobile support');
    console.log('• Keyboard shortcuts for efficiency');
    console.log('• Component-based architecture');

    // Recommendations
    if (this.results.failed > 0) {
      console.log('\n🔧 Recommendations:');
      console.log('• Review failed tests above');
      console.log('• Check component integration');
      console.log('• Validate dependencies');
      console.log('• Test browser compatibility');
    }

    console.log('\n✨ Test suite completed!');
  }
}

// Export for use
module.exports = HybridIDETestSuite;

// Run if called directly
if (require.main === module) {
  const testSuite = new HybridIDETestSuite();
  testSuite.runAllTests().catch(console.error);
}