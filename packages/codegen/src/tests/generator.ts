/**
 * Test Generator
 * Generates unit, integration, and E2E tests
 */

import { Language, TestOptions, GeneratedTestSuite, GeneratedTest, TestCase, GeneratedFixture, MockReference, CodeFile } from '../types/index.js';
import { FileManager } from '../utils/file-manager.js';
import { TemplateEngine } from '../templates/engine.js';
import { readFileSync } from 'fs';

/**
 * Test Generator class
 */
export class TestGenerator {
  private fileManager: FileManager;
  private templateEngine: TemplateEngine;

  constructor() {
    this.fileManager = new FileManager();
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate tests from source code
   */
  async generate(options: TestOptions): Promise<GeneratedTestSuite[]> {
    const testSuites: GeneratedTestSuite[] = [];

    // Read source files
    const sourceFiles = await this.readSourceFiles(options.sourcePath);

    if (options.testType === 'unit' || options.testType === 'all') {
      const unitTests = await this.generateUnitTests(sourceFiles, options);
      testSuites.push(...unitTests);
    }

    if (options.testType === 'integration' || options.testType === 'all') {
      const integrationTests = await this.generateIntegrationTests(sourceFiles, options);
      testSuites.push(...integrationTests);
    }

    if (options.testType === 'e2e' || options.testType === 'all') {
      const e2eTests = await this.generateE2ETests(sourceFiles, options);
      testSuites.push(...e2eTests);
    }

    return testSuites;
  }

  /**
   * Generate unit tests
   */
  private async generateUnitTests(
    sourceFiles: CodeFile[],
    options: TestOptions
  ): Promise<GeneratedTestSuite[]> {
    const testSuites: GeneratedTestSuite[] = [];

    for (const file of sourceFiles) {
      const testCases = this.extractTestCases(file);
      const testFile = this.generateUnitTestFile(file, testCases, options);

      testSuites.push({
        name: `${file.path} Unit Tests`,
        type: 'unit',
        framework: options.testFramework,
        files: [testFile],
        fixtures: options.generateFixtures ? this.generateFixtures(file) : [],
        mocks: options.generateMocks ? this.generateMocks(file, testCases) : [],
        coverageTarget: options.coverageTarget
      });
    }

    return testSuites;
  }

  /**
   * Generate integration tests
   */
  private async generateIntegrationTests(
    sourceFiles: CodeFile[],
    options: TestOptions
  ): Promise<GeneratedTestSuite[]> {
    const testSuites: GeneratedTestSuite[] = [];

    // Group files by module/feature
    const modules = this.groupFilesByModule(sourceFiles);

    for (const [moduleName, files] of Object.entries(modules)) {
      const testFile = this.generateIntegrationTestFile(moduleName, files, options);

      testSuites.push({
        name: `${moduleName} Integration Tests`,
        type: 'integration',
        framework: options.testFramework,
        files: [testFile],
        fixtures: [],
        mocks: []
      });
    }

    return testSuites;
  }

  /**
   * Generate E2E tests
   */
  private async generateE2ETests(
    sourceFiles: CodeFile[],
    options: TestOptions
  ): Promise<GeneratedTestSuite[]> {
    const testSuites: GeneratedTestSuite[] = [];

    const testFile = this.generateE2ETestFile(sourceFiles, options);

    testSuites.push({
      name: 'End-to-End Tests',
      type: 'e2e',
      framework: options.testFramework,
      files: [testFile],
      fixtures: [],
      mocks: []
    });

    return testSuites;
  }

  /**
   * Read source files
   */
  private async readSourceFiles(sourcePath: string): Promise<CodeFile[]> {
    const { glob } = await import('glob');
    const { extname } = await import('path');
    const { readFile } = await import('fs/promises');

    const patterns = this.getLanguageFilePatterns();
    const filePaths: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(`${sourcePath}/${pattern}`);
      filePaths.push(...matches);
    }

    const files: CodeFile[] = [];
    for (const filePath of filePaths) {
      const content = await readFile(filePath, 'utf-8');
      const ext = extname(filePath);
      const language = this.getLanguageFromExtension(ext);

      files.push({
        path: filePath,
        language,
        content,
        exports: this.extractExports(content, language),
        imports: this.extractImports(content, language)
      });
    }

    return files;
  }

  /**
   * Get language file patterns
   */
  private getLanguageFilePatterns(): string[] {
    return [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.go',
      '**/*.rs',
      '**/*.java'
    ];
  }

  /**
   * Get language from file extension
   */
  private getLanguageFromExtension(ext: string): Language {
    const extMap: Record<string, Language> = {
      '.ts': Language.TypeScript,
      '.tsx': Language.TypeScript,
      '.js': Language.JavaScript,
      '.jsx': Language.JavaScript,
      '.py': Language.Python,
      '.go': Language.Go,
      '.rs': Language.Rust,
      '.java': Language.Java
    };

    return extMap[ext] || Language.TypeScript;
  }

  /**
   * Extract exports from code
   */
  private extractExports(code: string, language: Language): any[] {
    const exports: any[] = [];

    if (language === Language.TypeScript || language === Language.JavaScript) {
      // Extract function exports
      const functionExports = code.match(/export\s+(?:async\s+)?function\s+(\w+)/g);
      if (functionExports) {
        for (const match of functionExports) {
          const name = match.match(/function\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'function' });
          }
        }
      }

      // Extract class exports
      const classExports = code.match(/export\s+class\s+(\w+)/g);
      if (classExports) {
        for (const match of classExports) {
          const name = match.match(/class\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'class' });
          }
        }
      }

      // Extract const exports
      const constExports = code.match(/export\s+(?:const|let|var)\s+(\w+)/g);
      if (constExports) {
        for (const match of constExports) {
          const name = match.match(/(?:const|let|var)\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'const' });
          }
        }
      }
    }

    return exports;
  }

  /**
   * Extract imports from code
   */
  private extractImports(code: string, language: Language): any[] {
    const imports: any[] = [];

    if (language === Language.TypeScript || language === Language.JavaScript) {
      // Extract ES6 imports
      const es6Imports = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      if (es6Imports) {
        for (const match of es6Imports) {
          const module = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
          if (module) {
            imports.push({ module, type: 'es6' });
          }
        }
      }
    }

    return imports;
  }

  /**
   * Extract test cases from file
   */
  private extractTestCases(file: CodeFile): TestCase[] {
    const testCases: TestCase[] = [];

    for (const exp of file.exports) {
      if (exp.type === 'function') {
        testCases.push({
          name: `should call ${exp.name}`,
          description: `Test ${exp.name} function`,
          given: 'input parameters',
          when: `${exp.name} is called`,
          then: 'expected result is returned',
          implementation: this.generateFunctionTest(exp.name, file),
          assertions: [
            `expect(result).toBeDefined()`,
            `expect(result).toMatchSnapshot()`
          ],
          mocks: []
        });
      } else if (exp.type === 'class') {
        testCases.push({
          name: `should instantiate ${exp.name}`,
          description: `Test ${exp.name} class instantiation`,
          given: 'class constructor parameters',
          when: `${exp.name} is instantiated`,
          then: 'instance is created',
          implementation: this.generateClassTest(exp.name, file),
          assertions: [
            `expect(instance).toBeInstanceOf(${exp.name})`,
            `expect(instance).toBeDefined()`
          ],
          mocks: []
        });
      }
    }

    return testCases;
  }

  /**
   * Generate unit test file
   */
  private generateUnitTestFile(
    file: CodeFile,
    testCases: TestCase[],
    options: TestOptions
  ): any {
    const fileName = file.path.replace(/\.(ts|js|py|go)$/, '.test.$1');

    if (options.testFramework === 'vitest' || options.testFramework === 'jest') {
      return this.generateJestStyleTestFile(file, testCases, options);
    } else if (options.testFramework === 'mocha') {
      return this.generateMochaStyleTestFile(file, testCases, options);
    }

    return { path: fileName, content: '// Test file', language: file.language };
  }

  /**
   * Generate Jest-style test file
   */
  private generateJestStyleTestFile(
    file: CodeFile,
    testCases: TestCase[],
    options: TestOptions
  ): any {
    let testCode = '';

    if (file.language === Language.TypeScript || file.language === Language.JavaScript) {
      testCode = `import { describe, it, expect, beforeEach, afterEach, vi } from '${options.testFramework}';\n`;

      // Add imports from source file
      const relativePath = file.path.replace(/.*\/src\//, '../src/');
      testCode += `import { ${file.exports.map(e => e.name).join(', ')} } from '${relativePath.replace(/\.(ts|js)$/, '')}';\n\n`;

      // Generate test suites for each export
      for (const exp of file.exports) {
        testCode += `describe('${exp.name}', () => {\n`;
        testCode += `  beforeEach(() => {\n`;
        testCode += `    // Setup\n`;
        testCode += `  });\n\n`;

        const expTests = testCases.filter(t => t.name.includes(exp.name));
        for (const test of expTests) {
          testCode += `  it('${test.name}', () => {\n`;
          testCode += `    // Arrange\n`;
          testCode += `    const input = {};\n\n`;
          testCode += `    // Act\n`;
          testCode += `    const result = ${exp.name}(input);\n\n`;
          testCode += `    // Assert\n`;
          testCode += `    ${test.assertions.map(a => a).join('\n    ')}\n`;
          testCode += `  });\n\n`;
        }

        testCode += `  afterEach(() => {\n`;
        testCode += `    // Cleanup\n`;
        testCode += `  });\n`;
        testCode += `});\n\n`;
      }
    }

    return {
      path: file.path.replace(/\.(ts|js)$/, '.test.ts'),
      content: testCode,
      language: file.language
    };
  }

  /**
   * Generate Mocha-style test file
   */
  private generateMochaStyleTestFile(
    file: CodeFile,
    testCases: TestCase[],
    options: TestOptions
  ): any {
    let testCode = '';

    if (file.language === Language.TypeScript || file.language === Language.JavaScript) {
      testCode = `import { describe, it, before, after, beforeEach, afterEach } from 'mocha';\n`;
      testCode += `import { expect } from 'chai';\n`;

      const relativePath = file.path.replace(/.*\/src\//, '../src/');
      testCode += `import { ${file.exports.map(e => e.name).join(', ')} } from '${relativePath.replace(/\.(ts|js)$/, '')}';\n\n`;

      for (const exp of file.exports) {
        testCode += `describe('${exp.name}', () => {\n`;
        testCode += `  before(() => {\n`;
        testCode += `    // Global setup\n`;
        testCode += `  });\n\n`;

        const expTests = testCases.filter(t => t.name.includes(exp.name));
        for (const test of expTests) {
          testCode += `  it('${test.name}', () => {\n`;
          testCode += `    const input = {};\n`;
          testCode += `    const result = ${exp.name}(input);\n`;
          testCode += `    expect(result).to.be.undefined;\n`;
          testCode += `  });\n\n`;
        }

        testCode += `  after(() => {\n`;
        testCode += `    // Global cleanup\n`;
        testCode += `  });\n`;
        testCode += `});\n\n`;
      }
    }

    return {
      path: file.path.replace(/\.(ts|js)$/, '.test.ts'),
      content: testCode,
      language: file.language
    };
  }

  /**
   * Generate integration test file
   */
  private generateIntegrationTestFile(
    moduleName: string,
    files: CodeFile[],
    options: TestOptions
  ): any {
    let testCode = '';

    if (options.testFramework === 'vitest' || options.testFramework === 'jest') {
      testCode = `import { describe, it, expect, beforeAll, afterAll } from '${options.testFramework}';\n\n`;
      testCode += `describe('${moduleName} Integration Tests', () => {\n`;
      testCode += `  beforeAll(async () => {\n`;
      testCode += `    // Setup integration test environment\n`;
      testCode += `  });\n\n`;

      testCode += `  it('should integrate modules correctly', async () => {\n`;
      testCode += `    // Integration test implementation\n`;
      testCode += `    expect(true).toBe(true);\n`;
      testCode += `  });\n\n`;

      testCode += `  afterAll(async () => {\n`;
      testCode += `    // Cleanup integration test environment\n`;
      testCode += `  });\n`;
      testCode += `});\n`;
    }

    return {
      path: `integration/${moduleName.toLowerCase()}.integration.test.ts`,
      content: testCode,
      language: Language.TypeScript
    };
  }

  /**
   * Generate E2E test file
   */
  private generateE2ETestFile(
    files: CodeFile[],
    options: TestOptions
  ): any {
    let testCode = '';

    if (options.testFramework === 'vitest' || options.testFramework === 'jest') {
      testCode = `import { describe, it, expect, beforeAll, afterAll } from '${options.testFramework}';\n\n`;
      testCode += `describe('End-to-End Tests', () => {\n`;
      testCode += `  beforeAll(async () => {\n`;
      testCode += `    // Setup E2E test environment\n`;
      testCode += `  });\n\n`;

      testCode += `  it('should complete full user flow', async () => {\n`;
      testCode += `    // E2E test implementation\n`;
      testCode += `    expect(true).toBe(true);\n`;
      testCode += `  });\n\n`;

      testCode += `  afterAll(async () => {\n`;
      testCode += `    // Cleanup E2E test environment\n`;
      testCode += `  });\n`;
      testCode += `});\n`;
    }

    return {
      path: 'e2e/app.e2e.test.ts',
      content: testCode,
      language: Language.TypeScript
    };
  }

  /**
   * Generate function test
   */
  private generateFunctionTest(functionName: string, file: CodeFile): string {
    return `// Test for ${functionName}
const result = ${functionName}(input);
expect(result).toBeDefined();`;
  }

  /**
   * Generate class test
   */
  private generateClassTest(className: string, file: CodeFile): string {
    return `// Test for ${className}
const instance = new ${className}();
expect(instance).toBeInstanceOf(${className});`;
  }

  /**
   * Generate fixtures
   */
  private generateFixtures(file: CodeFile): GeneratedFixture[] {
    const fixtures: GeneratedFixture[] = [];

    for (const exp of file.exports) {
      fixtures.push({
        name: `${exp.name}Fixture`,
        description: `Fixture data for ${exp.name}`,
        data: { id: 1, name: 'Test' },
        schema: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          }
        },
        usage: `const fixture = ${exp.name}Fixture;`
      });
    }

    return fixtures;
  }

  /**
   * Generate mocks
   */
  private generateMocks(file: CodeFile, testCases: TestCase[]): any[] {
    const mocks: any[] = [];

    for (const testCase of testCases) {
      if (testCase.mocks && testCase.mocks.length > 0) {
        mocks.push(...testCase.mocks);
      }
    }

    return mocks;
  }

  /**
   * Group files by module
   */
  private groupFilesByModule(files: CodeFile[]): Record<string, CodeFile[]> {
    const modules: Record<string, CodeFile[]> = {};

    for (const file of files) {
      const pathParts = file.path.split('/');
      const moduleName = pathParts[pathParts.length - 2] || 'default';

      if (!modules[moduleName]) {
        modules[moduleName] = [];
      }

      modules[moduleName].push(file);
    }

    return modules;
  }
}
