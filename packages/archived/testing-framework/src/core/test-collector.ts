import { glob } from 'glob';
import { readFileSync } from 'fs';
import { TestSuite, TestCase, TestConfig } from './types';
import { TestPatterns, TestStatus } from './constants';
import { Logger } from './logger';
import { Parser } from '@babel/parser';
import traverse from '@babel/traverse';
import { parse } from 'typescript';
import { loadModule } from './module-loader';

export class TestCollector {
  private config: TestConfig;
  private logger: Logger;

  constructor(config: TestConfig) {
    this.config = config;
    this.logger = new Logger({ name: 'TestCollector' });
  }

  /**
   * Collect test suites from configured directories
   */
  async collect(): Promise<TestSuite[]> {
    this.logger.info('Collecting test suites...');

    const patterns = this.getTestPatterns();
    const testSuites: TestSuite[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: this.config.ignore || [],
          cwd: process.cwd()
        });

        this.logger.debug(`Found ${files.length} test files for pattern: ${pattern}`);

        for (const file of files) {
          const suite = await this.collectTestSuite(file);
          if (suite) {
            testSuites.push(suite);
          }
        }
      } catch (error) {
        this.logger.error(`Error collecting tests from pattern ${pattern}:`, error);
      }
    }

    this.logger.info(`Collected ${testSuites.length} test suites`);
    return testSuites;
  }

  /**
   * Collect test suite from a single file
   */
  private async collectTestSuite(filePath: string): Promise<TestSuite | null> {
    try {
      this.logger.debug(`Parsing test file: ${filePath}`);

      // Read file content
      const content = readFileSync(filePath, 'utf8');
      const tests = this.parseTestFile(filePath, content);

      if (tests.length === 0) {
        return null;
      }

      return {
        id: this.generateSuiteId(filePath),
        name: this.getSuiteName(filePath),
        description: this.getSuiteDescription(filePath),
        file: filePath,
        path: this.getSuitePath(filePath),
        tests,
        metadata: this.extractSuiteMetadata(content, filePath),
        config: this.config
      };
    } catch (error) {
      this.logger.error(`Error parsing test file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse test file to extract test cases
   */
  private parseTestFile(filePath: string, content: string): TestCase[] {
    const tests: TestCase[] = [];

    try {
      // Try parsing as TypeScript first
      const ast = parse(content, {
        target: 2020,
        module: 'commonjs',
        jsx: 'preserve',
        esModuleInterop: true,
        skipLibCheck: true,
        sourceMap: false,
        sourceType: 'module'
      });

      // Extract tests from TypeScript AST
      this.extractTestsFromAST(filePath, content, ast, tests);

    } catch (error) {
      this.logger.debug(`TypeScript parsing failed for ${filePath}, trying JavaScript:`, error);

      try {
        // Fall back to JavaScript parsing
        const ast = Parser.parse(content, {
          sourceType: 'module',
          plugins: ['dynamicImport', 'objectRestSpread', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator']
        });

        // Extract tests from JavaScript AST
        this.extractTestsFromAST(filePath, content, ast, tests);

      } catch (error) {
        this.logger.error(`Failed to parse file ${filePath}:`, error);
      }
    }

    return tests;
  }

  /**
   * Extract tests from AST
   */
  private extractTestsFromAST(filePath: string, content: string, ast: any, tests: TestCase[]): void {
    const visitor = {
      // Jest-style tests
      CallExpression(path: any) {
        const node = path.node;

        // it() test cases
        if (this.isTestFunction(node.callee, 'it') || this.isTestFunction(node.callee, 'test')) {
          const testCase = this.parseJestTest(path, filePath, content);
          if (testCase) {
            tests.push(testCase);
          }
        }

        // describe() test suites
        if (this.isTestFunction(node.callee, 'describe') || this.isTestFunction(node.callee, 'describe')) {
          const nestedTests = this.parseDescribeSuite(path, filePath, content);
          tests.push(...nestedTests);
        }

        // Vitest test cases
        if (node.callee && node.callee.object && node.callee.object.name === 'vitest') {
          if (node.callee.property.name === 'test') {
            const testCase = this.parseVitestTest(path, filePath, content);
            if (testCase) {
              tests.push(testCase);
            }
          }
        }
      },

      // Mocha-style tests
      CallExpression(path: any) {
        const node = path.node;

        if (this.isTestFunction(node.callee, 'it') || this.isTestFunction(node.callee, 'test')) {
          const testCase = this.parseMochaTest(path, filePath, content);
          if (testCase) {
            tests.push(testCase);
          }
        }

        if (this.isTestFunction(node.callee, 'describe') || this.isTestFunction(node.callee, 'suite')) {
          const nestedTests = this.parseDescribeSuite(path, filePath, content);
          tests.push(...nestedTests);
        }
      },

      // Playwright test cases
      CallExpression(path: any) {
        const node = path.node;

        if (node.callee && node.callee.property && node.callee.property.name === 'test') {
          if (node.callee.object && node.callee.object.name === 'test') {
            const testCase = this.parsePlaywrightTest(path, filePath, content);
            if (testCase) {
              tests.push(testCase);
            }
          }
        }
      }
    };

    // Add the visitor methods
    Object.assign(visitor, {
      isTestFunction(callee: any, name: string): boolean {
        if (!callee) return false;

        // Direct function name
        if (callee.type === 'Identifier' && callee.name === name) {
          return true;
        }

        // Member expression (e.g., test.describe)
        if (callee.type === 'MemberExpression' && callee.property.name === name) {
          return true;
        }

        return false;
      },

      parseJestTest(path: any, filePath: string, content: string): TestCase | null {
        const node = path.node;

        if (node.arguments.length < 1) return null;

        const testName = this.extractTestName(node.arguments[0]);
        const testBody = node.arguments[1];
        const testLocation = this.extractTestLocation(path);

        return {
          id: this.generateTestId(filePath, testName),
          name: testName,
          file: filePath,
          line: testLocation.start.line,
          suite: this.getSuiteName(filePath),
          type: 'unit',
          priority: this.extractTestPriority(node),
          status: TestStatus.PENDING,
          timeout: this.extractTestTimeout(node),
          metadata: this.extractTestCaseMetadata(path, content),
          data: this.extractTestData(node)
        };
      },

      parseVitestTest(path: any, filePath: string, content: string): TestCase | null {
        const node = path.node;

        if (node.arguments.length < 1) return null;

        const testName = this.extractTestName(node.arguments[0]);
        const testBody = node.arguments[1];
        const testLocation = this.extractTestLocation(path);

        return {
          id: this.generateTestId(filePath, testName),
          name: testName,
          file: filePath,
          line: testLocation.start.line,
          suite: this.getSuiteName(filePath),
          type: 'unit',
          priority: this.extractTestPriority(node),
          status: TestStatus.PENDING,
          timeout: this.extractTestTimeout(node),
          metadata: this.extractTestCaseMetadata(path, content),
          data: this.extractTestData(node)
        };
      },

      parseMochaTest(path: any, filePath: string, content: string): TestCase | null {
        const node = path.node;

        if (node.arguments.length < 1) return null;

        const testName = this.extractTestName(node.arguments[0]);
        const testBody = node.arguments[1];
        const testLocation = this.extractTestLocation(path);

        return {
          id: this.generateTestId(filePath, testName),
          name: testName,
          file: filePath,
          line: testLocation.start.line,
          suite: this.getSuiteName(filePath),
          type: 'unit',
          priority: this.extractTestPriority(node),
          status: TestStatus.PENDING,
          timeout: this.extractTestTimeout(node),
          metadata: this.extractTestCaseMetadata(path, content),
          data: this.extractTestData(node)
        };
      },

      parsePlaywrightTest(path: any, filePath: string, content: string): TestCase | null {
        const node = path.node;

        if (node.arguments.length < 1) return null;

        const testName = this.extractTestName(node.arguments[0]);
        const testBody = node.arguments[1];
        const testLocation = this.extractTestLocation(path);

        return {
          id: this.generateTestId(filePath, testName),
          name: testName,
          file: filePath,
          line: testLocation.start.line,
          suite: this.getSuiteName(filePath),
          type: 'e2e',
          priority: this.extractTestPriority(node),
          status: TestStatus.PENDING,
          timeout: this.extractTestTimeout(node),
          metadata: this.extractTestCaseMetadata(path, content),
          data: this.extractTestData(node)
        };
      },

      parseDescribeSuite(path: any, filePath: string, content: string): TestCase[] {
        const node = path.node;
        const tests: TestCase[] = [];

        // Extract tests from describe block
        // This is a simplified implementation
        // In practice, you would need to traverse the child nodes

        return tests;
      },

      extractTestName(argument: any): string {
        if (argument.type === 'StringLiteral') {
          return argument.value;
        } else if (argument.type === 'TemplateLiteral') {
          return argument.quasis[0].value.raw;
        } else if (argument.type === 'Identifier') {
          return argument.name;
        }
        return 'Unknown Test';
      },

      extractTestPriority(node: any): number {
        // Extract priority from test options
        if (node.arguments.length > 2) {
          const options = node.arguments[2];
          if (options && options.type === 'ObjectExpression') {
            for (const prop of options.properties) {
              if (prop.key.name === 'priority' || prop.key.value === 'priority') {
                const value = prop.value.value;
                if (typeof value === 'number') {
                  return value;
                }
              }
            }
          }
        }
        return 2; // Default priority
      },

      extractTestTimeout(node: any): number {
        // Extract timeout from test options
        if (node.arguments.length > 2) {
          const options = node.arguments[2];
          if (options && options.type === 'ObjectExpression') {
            for (const prop of options.properties) {
              if (prop.key.name === 'timeout' || prop.key.value === 'timeout') {
                const value = prop.value.value;
                if (typeof value === 'number') {
                  return value;
                }
              }
            }
          }
        }
        return 5000; // Default timeout
      },

      extractTestLocation(path: any): { start: { line: number; column: number }; end: { line: number; column: number } } {
        return {
          start: {
            line: path.node.loc?.start?.line || 0,
            column: path.node.loc?.start?.column || 0
          },
          end: {
            line: path.node.loc?.end?.line || 0,
            column: path.node.loc?.end?.column || 0
          }
        };
      },

      extractTestCaseMetadata(path: any, content: string): any {
        // Extract metadata from comments or decorators
        const metadata: any = {};

        // Look for @test decorators
        if (path.node.leadingComments) {
          for (const comment of path.node.leadingComments) {
            if (comment.value.includes('@test')) {
              // Parse @test metadata
              const matches = comment.value.match(/@test\{([^}]+)\}/);
              if (matches) {
                try {
                  Object.assign(metadata, JSON.parse(matches[1]));
                } catch (error) {
                  this.logger.debug(`Failed to parse test metadata: ${matches[1]}`);
                }
              }
            }
          }
        }

        return metadata;
      },

      extractTestData(node: any): Record<string, any> | undefined {
        // Extract test data from test options
        if (node.arguments.length > 2) {
          const options = node.arguments[2];
          if (options && options.type === 'ObjectExpression') {
            const data: Record<string, any> = {};
            for (const prop of options.properties) {
              if (prop.key.name === 'data' || prop.key.value === 'data') {
                if (prop.value.type === 'ObjectExpression') {
                  for (const dataProp of prop.value.properties) {
                    data[dataProp.key.name] = dataProp.value.value;
                  }
                }
                return data;
              }
            }
          }
        }
        return undefined;
      }
    });

    traverse(ast, visitor);
  }

  /**
   * Get test patterns from config
   */
  private getTestPatterns(): string[] {
    if (this.config.pattern && this.config.pattern.length > 0) {
      return this.config.pattern;
    }

    // Default patterns for different test frameworks
    return [
      '**/__tests__/**/*.{js,ts,jsx,tsx}',
      '**/*.test.{js,ts,jsx,tsx}',
      '**/*.spec.{js,ts,jsx,tsx}',
      '**/*.{test,spec}.{js,ts,jsx,tsx}'
    ];
  }

  /**
   * Generate unique test suite ID
   */
  private generateSuiteId(filePath: string): string {
    return `suite_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  }

  /**
   * Generate unique test case ID
   */
  private generateTestId(filePath: string, testName: string): string {
    return `test_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  }

  /**
   * Get suite name from file path
   */
  private getSuiteName(filePath: string): string {
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    return fileName.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '');
  }

  /**
   * Get suite path from file path
   */
  private getSuitePath(filePath: string): string {
    return filePath.replace(process.cwd() + '/', '');
  }

  /**
   * Get suite description from file
   */
  private getSuiteDescription(filePath: string): string | undefined {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Look for description in file header
      for (const line of lines.slice(0, 10)) {
        if (line.includes('describe(') || line.includes('suite(') || line.includes('test.describe')) {
          // Extract description from test function
          const match = line.match(/['"]([^'"]+)['"]/);
          if (match) {
            return match[1];
          }
        }
      }

      // Look for @suite comment
      for (const line of lines) {
        if (line.includes('@suite')) {
          const match = line.match(/@suite\s+(.+)/);
          if (match) {
            return match[1];
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error reading suite description for ${filePath}:`, error);
    }

    return undefined;
  }

  /**
   * Extract suite metadata from file
   */
  private extractSuiteMetadata(content: string, filePath: string): any {
    const metadata: any = {};

    // Look for @suite metadata comments
    const lines = content.split('\n');
    for (const line of lines.slice(0, 20)) {
      if (line.includes('@')) {
        const matches = line.match(/@(\w+)\s+(.+)/);
        if (matches) {
          const [, key, value] = matches;
          metadata[key] = this.parseMetadataValue(value);
        }
      }
    }

    // Extract tags from comments
    if (content.includes('@tags')) {
      const tagsMatch = content.match(/@tags\s*\[([^\]]+)\]/);
      if (tagsMatch) {
        metadata.tags = tagsMatch[1].split(',').map(tag => tag.trim().replace(/['"]/g, ''));
      }
    }

    return metadata;
  }

  /**
   * Parse metadata value
   */
  private parseMetadataValue(value: string): any {
    value = value.trim();

    // Try parsing as JSON
    try {
      return JSON.parse(value);
    } catch {
      // If not JSON, try parsing as array
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          return JSON.parse(value);
        } catch {
          // If JSON parsing fails, return as string array
          return value.slice(1, -1).split(',').map(item => item.trim().replace(/['"]/g, ''));
        }
      }

      // Otherwise return as string
      return value;
    }
  }

  /**
   * Watch for test file changes
   */
  async watch(callback: (changedFiles: string[]) => void): Promise<void> {
    const chokidar = await import('chokidar');
    const patterns = this.getTestPatterns();

    const watcher = chokidar.watch(patterns, {
      ignored: this.config.ignore,
      persistent: true
    });

    watcher.on('change', (filePath) => {
      this.logger.debug(`Test file changed: ${filePath}`);
      callback([filePath]);
    });

    watcher.on('add', (filePath) => {
      this.logger.debug(`Test file added: ${filePath}`);
      callback([filePath]);
    });

    watcher.on('unlink', (filePath) => {
      this.logger.debug(`Test file removed: ${filePath}`);
      callback([filePath]);
    });
  }
}