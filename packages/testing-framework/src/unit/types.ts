/**
 * Type definitions for unit testing module
 */

/**
 * Mock function type
 */
export type MockFunction<T extends Function = Function> = T & {
  mock: MockFunctionState;
};

/**
 * Mock state
 */
export interface MockFunctionState {
  calls: Array<{
    arguments: any[];
    result?: any;
    error?: any;
    timestamp: number;
  }>;
  instances: any[];
  context: any | null;
  results: Array<{
    type: 'return' | 'throw';
    value: any;
  }>;
}

/**
 * Mock configuration
 */
export interface MockConfig {
  implementation?: Function;
  constructorMock?: boolean;
  getter?: (this: any, ...args: any[]) => any;
  setter?: (this: any, value: any, ...args: any[]) => void;
}

/**
 * Spy function type
 */
export type SpyFunction<T extends Function = Function> = T & {
  spy: SpyFunctionState;
};

/**
 * Spy state
 */
export interface SpyFunctionState {
  calls: Array<{
    arguments: any[];
    result?: any;
    error?: any;
    timestamp: number;
    this?: any;
  }>;
  callCount: number;
  called: boolean;
  calledOnce: boolean;
  calledTwice: boolean;
  calledThrice: boolean;
  firstCall?: {
    arguments: any[];
    result?: any;
    error?: any;
    timestamp: number;
    this?: any;
  };
  lastCall?: {
    arguments: any[];
    result?: any;
    error?: any;
    timestamp: number;
    this?: any;
  };
}

/**
 * Test callback type
 */
export type TestCallback = (this: TestContext, done: DoneCallback) => Promise<void> | void;

/**
 * Done callback type
 */
export type DoneCallback = (error?: any) => void;

/**
 * Test context
 */
export interface TestContext {
  [key: string]: any;
}

/**
 * Test metadata
 */
export interface TestMetadata {
  type: 'unit';
  tags?: string[];
  timeout?: number;
  slow?: number;
  retry?: number;
  flaky?: boolean;
  disabled?: boolean;
  skip?: boolean;
  only?: boolean;
  concurrent?: boolean;
  requires?: string[];
  provides?: string[];
}

/**
 * Suite metadata
 */
export interface SuiteMetadata {
  type: 'unit';
  tags?: string[];
  timeout?: number;
  slow?: number;
  flaky?: boolean;
  disabled?: boolean;
  skip?: boolean;
  only?: boolean;
  concurrent?: boolean;
  requires?: string[];
  provides?: string[];
}

/**
 * Test options
 */
export interface TestOptions {
  timeout?: number;
  slow?: number;
  retry?: number;
  flaky?: boolean;
  skip?: boolean;
  only?: boolean;
  concurrent?: boolean;
  tags?: string[];
  meta?: TestMetadata;
}

/**
 * Suite options
 */
export interface SuiteOptions {
  timeout?: number;
  slow?: number;
  flaky?: boolean;
  skip?: boolean;
  only?: boolean;
  concurrent?: boolean;
  tags?: string[];
  meta?: SuiteMetadata;
}

/**
 * Test configuration
 */
export interface TestConfiguration {
  timeout: number;
  slow: number;
  retry: number;
  flaky: boolean;
  concurrent: boolean;
  coverage: boolean;
  coverageThreshold: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

/**
 * Mock expectations
 */
export interface MockExpectations {
  /**
   * Expected call count
   */
  times?: number;

  /**
   * Minimum call count
   */
  atLeast?: number;

  /**
   * Maximum call count
   */
  atMost?: number;

  /**
   * Expected arguments
   */
  with?: any[];

  /**
   * Expected to be called with any arguments
   */
  withAnyArgs?: boolean;

  /**
   * Expected to be called with no arguments
   */
  withNoArgs?: boolean;

  /**
   * Expected to be called with specific arguments
   */
  withExactly?: any[];

  /**
   * Expected to be called with matchers
   */
  withMatch?: any[];

  /**
   * Expected to return a specific value
   */
  returns?: any;

  /**
   * Expected to throw an error
   */
  throws?: any;

  /**
   * Expected to resolve with a specific value
   */
  resolves?: any;

  /**
   * Expected to reject with a specific error
   */
  rejects?: any;

  /**
   * Expected to call through to original implementation
   */
  callsThrough?: boolean;

  /**
   * Expected to call a specific implementation
   */
  implementation?: Function;
}

/**
 * Matcher interface
 */
export interface Matcher<T = any> {
  matches(value: T): boolean;
  getExpected(): any;
}

/**
 * Equality matcher
 */
export class EqualityMatcher<T> implements Matcher<T> {
  constructor(private expected: T) {}

  matches(value: T): boolean {
    return value === this.expected;
  }

  getExpected(): T {
    return this.expected;
  }
}

/**
 * Deep equality matcher
 */
export class DeepEqualityMatcher<T> implements Matcher<T> {
  constructor(private expected: T) {}

  matches(value: T): boolean {
    return this.isDeepEqual(value, this.expected);
  }

  getExpected(): T {
    return this.expected;
  }

  private isDeepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return false;

    const className = Object.prototype.toString.call(a);
    if (className !== Object.prototype.toString.call(b)) return false;

    switch (className) {
      case '[object RegExp]':
      case '[object String]':
        return '' + a === '' + b;
      case '[object Number]':
        return +a === +b;
      case '[object Date]':
        return a.getTime() === b.getTime();
      case '[object Boolean]':
        return +a === +b;
      case '[object Array]':
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.isDeepEqual(a[i], b[i])) return false;
        }
        return true;
      case '[object Set]':
        if (a.size !== b.size) return false;
        for (const item of a) {
          if (!b.has(item)) return false;
        }
        return true;
      case '[object Map]':
        if (a.size !== b.size) return false;
        for (const [key, value] of a) {
          if (!b.has(key) || !this.isDeepEqual(value, b.get(key))) return false;
        }
        return true;
      default:
        if (typeof a !== 'object' || typeof b !== 'object') return false;

        const keysA = Object.keys(a).sort();
        const keysB = Object.keys(b).sort();

        if (keysA.length !== keysB.length) return false;

        for (let i = 0; i < keysA.length; i++) {
          if (keysA[i] !== keysB[i]) return false;
          if (!this.isDeepEqual(a[keysA[i]], b[keysB[i]])) return false;
        }

        return true;
    }
  }
}

/**
 * String match matcher
 */
export class StringMatchMatcher implements Matcher<string> {
  constructor(private expected: string | RegExp) {}

  matches(value: string): boolean {
    if (this.expected instanceof RegExp) {
      return this.expected.test(value);
    }
    return value.includes(this.expected);
  }

  getExpected(): string | RegExp {
    return this.expected;
  }
}

/**
 * Greater than matcher
 */
export class GreaterThanMatcher implements Matcher<number> {
  constructor(private expected: number) {}

  matches(value: number): boolean {
    return value > this.expected;
  }

  getExpected(): number {
    return this.expected;
  }
}

/**
 * Less than matcher
 */
export class LessThanMatcher implements Matcher<number> {
  constructor(private expected: number) {}

  matches(value: number): boolean {
    return value < this.expected;
  }

  getExpected(): number {
    return this.expected;
  }
}

/**
 * Property matcher
 */
export class PropertyMatcher<T> implements Matcher<T> {
  constructor(private property: string, private expected: any) {}

  matches(value: T): boolean {
    if (typeof value !== 'object' || value === null) return false;
    return (value as any)[this.property] === this.expected;
  }

  getExpected(): any {
    return { property: this.property, value: this.expected };
  }
}

/**
 * Any matcher
 */
export class AnyMatcher implements Matcher<any> {
  matches(): boolean {
    return true;
  }

  getExpected(): any {
    return '<any>';
  }
}

/**
 * Not matcher
 */
export class NotMatcher<T> implements Matcher<T> {
  constructor(private expected: Matcher<T> | T) {}

  matches(value: T): boolean {
    const matcher = this.expected instanceof Matcher ? this.expected : new EqualityMatcher(this.expected);
    return !matcher.matches(value);
  }

  getExpected(): any {
    return this.expected;
  }
}

/**
 * Matcher factory
 */
export class Matchers {
  static toBe<T>(expected: T): Matcher<T> {
    return new EqualityMatcher(expected);
  }

  static toEqual<T>(expected: T): Matcher<T> {
    return new DeepEqualityMatcher(expected);
  }

  static toContain<T>(expected: T): Matcher<T> {
    return new StringMatchMatcher(expected);
  }

  static toMatch(pattern: string | RegExp): Matcher<string> {
    return new StringMatchMatcher(pattern);
  }

  static toBeGreaterThan<T extends number>(expected: T): Matcher<T> {
    return new GreaterThanMatcher(expected);
  }

  static toBeLessThan<T extends number>(expected: T): Matcher<T> {
    return new LessThanMatcher(expected);
  }

  static toHaveProperty(property: string, value?: any): Matcher<any> {
    if (value !== undefined) {
      return new PropertyMatcher(property, value);
    }
    return new PropertyMatcher(property, true);
  }

  static toBeTruthy(): Matcher<any> {
    return new class implements Matcher<any> {
      matches(value: any): boolean {
        return !!value;
      }
      getExpected(): any {
        return '<truthy>';
      }
    }();
  }

  static toBeFalsy(): Matcher<any> {
    return new class implements Matcher<any> {
      matches(value: any): boolean {
        return !value;
      }
      getExpected(): any {
        return '<falsy>';
      }
    }();
  }

  static toBeNull(): Matcher<any> {
    return new class implements Matcher<any> {
      matches(value: any): boolean {
        return value === null;
      }
      getExpected(): any {
        return '<null>';
      }
    }();
  }

  static toBeUndefined(): Matcher<any> {
    return new class implements Matcher<any> {
      matches(value: any): boolean {
        return value === undefined;
      }
      getExpected(): any {
        return '<undefined>';
      }
    }();
  }

  static toBeDefined(): Matcher<any> {
    return new class implements Matcher<any> {
      matches(value: any): boolean {
        return value !== undefined;
      }
      getExpected(): any {
        return '<defined>';
      }
    }();
  }

  static any<T = any>(): Matcher<T> {
    return new AnyMatcher();
  }

  static not<T>(expected: Matcher<T> | T): Matcher<T> {
    return new NotMatcher(expected);
  }
}