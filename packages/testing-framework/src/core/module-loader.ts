import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { Logger } from './logger';

const require = createRequire(import.meta.url);

export class ModuleLoader {
  private logger: Logger;
  private loadedModules = new Map<string, any>();

  constructor() {
    this.logger = new Logger({ name: 'ModuleLoader' });
  }

  /**
   * Load a module from file path
   */
  async load(modulePath: string): Promise<any> {
    // Check if module is already loaded
    const cached = this.loadedModules.get(modulePath);
    if (cached) {
      return cached;
    }

    try {
      // Convert path to URL for ES modules
      const moduleUrl = pathToFileURL(modulePath);

      // Load module dynamically
      let module;
      if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) {
        // For TypeScript files, use dynamic import
        module = await import(moduleUrl.href);
      } else {
        // For JavaScript files, use require
        module = require(modulePath);
      }

      // Cache module
      this.loadedModules.set(modulePath, module);

      this.logger.debug(`Loaded module: ${modulePath}`);
      return module;
    } catch (error) {
      this.logger.error(`Failed to load module ${modulePath}:`, error);
      throw error;
    }
  }

  /**
   * Load a test file and extract test functions
   */
  async loadTestFile(filePath: string): Promise<TestModule> {
    const module = await this.load(filePath);

    const testModule: TestModule = {
      default: module.default,
      setup: module.setup,
      teardown: module.teardown,
      beforeAll: module.beforeAll,
      afterAll: module.afterAll,
      beforeEach: module.beforeEach,
      afterEach: module.afterEach,
      tests: this.extractTests(module),
      fixtures: this.extractFixtures(module)
    };

    return testModule;
  }

  /**
   * Extract test functions from module
   */
  private extractTests(module: any): TestFunction[] {
    const tests: TestFunction[] = [];

    // Look for test functions in the module
    for (const [key, value] of Object.entries(module)) {
      if (typeof value === 'function') {
        if (this.isTestFunction(key)) {
          tests.push({
            name: key,
            fn: value,
            type: this.getTestType(key)
          });
        }
      }
    }

    return tests;
  }

  /**
   * Extract fixtures from module
   */
  private extractFixtures(module: any): Fixture[] {
    const fixtures: Fixture[] = [];

    // Look for fixture functions in the module
    for (const [key, value] of Object.entries(module)) {
      if (typeof value === 'function') {
        if (this.isFixtureFunction(key)) {
          fixtures.push({
            name: key,
            fn: value,
            scope: this.getFixtureScope(key)
          });
        }
      }
    }

    return fixtures;
  }

  /**
   * Check if function name indicates a test function
   */
  private isTestFunction(name: string): boolean {
    return (
      name.startsWith('test') ||
      name.startsWith('it') ||
      name.startsWith('describe') ||
      name.startsWith('suite') ||
      name.startsWith('should') ||
      name.startsWith('when') ||
      name.startsWith('given')
    );
  }

  /**
   * Check if function name indicates a fixture function
   */
  private isFixtureFunction(name: string): boolean {
    return (
      name.includes('fixture') ||
      name.includes('setup') ||
      name.includes('teardown') ||
      name.includes('before') ||
      name.includes('after')
    );
  }

  /**
   * Get test type from function name
   */
  private getTestType(name: string): TestType {
    if (name.includes('unit') || name.startsWith('testUnit') || name.startsWith('itUnit')) {
      return 'unit';
    } else if (name.includes('integration') || name.startsWith('testIntegration') || name.startsWith('itIntegration')) {
      return 'integration';
    } else if (name.includes('e2e') || name.startsWith('testE2e') || name.startsWith('itE2e')) {
      return 'e2e';
    } else if (name.includes('performance') || name.startsWith('testPerformance') || name.startsWith('itPerformance')) {
      return 'performance';
    } else if (name.includes('load') || name.startsWith('testLoad') || name.startsWith('itLoad')) {
      return 'load';
    } else if (name.includes('chaos') || name.startsWith('testChaos') || name.startsWith('itChaos')) {
      return 'chaos';
    } else if (name.includes('contract') || name.startsWith('testContract') || name.startsWith('itContract')) {
      return 'contract';
    } else if (name.includes('visual') || name.startsWith('testVisual') || name.startsWith('itVisual')) {
      return 'visual';
    } else if (name.includes('security') || name.startsWith('testSecurity') || name.startsWith('itSecurity')) {
      return 'security';
    } else if (name.includes('accessibility') || name.startsWith('testAccessibility') || name.startsWith('itAccessibility')) {
      return 'accessibility';
    } else if (name.includes('i18n') || name.startsWith('testI18n') || name.startsWith('itI18n')) {
      return 'i18n';
    } else if (name.includes('ab') || name.includes('split') || name.startsWith('testAB') || name.startsWith('itAB')) {
      return 'ab-testing';
    }

    // Default to unit test
    return 'unit';
  }

  /**
   * Get fixture scope from function name
   */
  private getFixtureScope(name: string): FixtureScope {
    if (name.includes('all') || name.includes('global')) {
      return 'all';
    } else if (name.includes('each') || name.includes('multiple')) {
      return 'each';
    } else {
      return 'test';
    }
  }

  /**
   * Clear all loaded modules
   */
  clear(): void {
    this.loadedModules.clear();
  }

  /**
   * Get statistics about loaded modules
   */
  getStats(): ModuleStats {
    return {
      loaded: this.loadedModules.size,
      memoryUsage: process.memoryUsage()
    };
  }
}

/**
 * Test module interface
 */
export interface TestModule {
  default?: any;
  setup?: (context: TestContext) => Promise<void>;
  teardown?: (context: TestContext) => Promise<void>;
  beforeAll?: (context: TestContext) => Promise<void>;
  afterAll?: (context: TestContext) => Promise<void>;
  beforeEach?: (context: TestContext) => Promise<void>;
  afterEach?: (context: TestContext) => Promise<void>;
  tests: TestFunction[];
  fixtures: Fixture[];
}

/**
 * Test function interface
 */
export interface TestFunction {
  name: string;
  fn: (context: TestContext) => Promise<void> | void;
  type: TestType;
}

/**
 * Fixture interface
 */
export interface Fixture {
  name: string;
  fn: (context: TestContext) => Promise<any> | any;
  scope: FixtureScope;
}

/**
 * Test type enum
 */
export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'load' | 'chaos' | 'contract' | 'visual' | 'security' | 'accessibility' | 'i18n' | 'ab-testing';

/**
 * Fixture scope enum
 */
export type FixtureScope = 'all' | 'test' | 'each';

/**
 * Test context interface
 */
export interface TestContext {
  testId: string;
  testName: string;
  environment: string;
  config: TestConfig;
  pluginManager: any;
  performanceMonitor: any;
  chaosEngine: any;
  [key: string]: any;
}

/**
 * Test config interface
 */
export interface TestConfig {
  pattern?: string[];
  testDir?: string[];
  ignore?: string[];
  maxParallel?: number;
  maxSuitesParallel?: number;
  coverage?: boolean;
  coverageReporter?: any;
  watch?: any;
  reporters?: any[];
  env?: Record<string, string>;
  setupFiles?: string[];
  teardownFiles?: string[];
  hooks?: any;
  plugins?: any[];
  performance?: any;
  chaos?: any;
  security?: any;
  environments?: any[];
  cicd?: any;
}

/**
 * Module statistics interface
 */
export interface ModuleStats {
  loaded: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}