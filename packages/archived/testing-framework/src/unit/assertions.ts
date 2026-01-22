import { AssertionError } from './errors';
import { AssertionLocation } from './types';

/**
 * Assertion interface
 */
export interface Assertion {
  status: 'pass' | 'fail';
  message: string;
  expected?: any;
  actual?: any;
  location?: AssertionLocation;
}

/**
 * Assert interface for test assertions
 */
export interface Assert {
  equal(actual: any, expected: any, message?: string): Assertion;
  notEqual(actual: any, expected: any, message?: string): Assertion;
  strictEqual(actual: any, expected: any, message?: string): Assertion;
  notStrictEqual(actual: any, expected: any, message?: string): Assertion;
  deepEqual(actual: any, expected: any, message?: string): Assertion;
  notDeepEqual(actual: any, expected: any, message?: string): Assertion;
  truthy(actual: any, message?: string): Assertion;
  falsy(actual: any, message?: string): Assertion;
  true(actual: any, message?: string): Assertion;
  false(actual: any, message?: string): Assertion;
  null(actual: any, message?: string): Assertion;
  notNull(actual: any, message?: string): Assertion;
  undefined(actual: any, message?: string): Assertion;
  defined(actual: any, message?: string): Assertion;
  instanceOf(actual: any, constructor: any, message?: string): Assertion;
  notInstanceOf(actual: any, constructor: any, message?: string): Assertion;
  contains(actual: string | any[], expected: any, message?: string): Assertion;
  notContains(actual: string | any[], expected: any, message?: string): Assertion;
  matches(actual: string | RegExp, pattern: string | RegExp, message?: string): Assertion;
  notMatches(actual: string | RegExp, pattern: string | RegExp, message?: string): Assertion;
  greaterThan(actual: number, expected: number, message?: string): Assertion;
  greaterThanOrEqual(actual: number, expected: number, message?: string): Assertion;
  lessThan(actual: number, expected: number, message?: string): Assertion;
  lessThanOrEqual(actual: number, expected: number, message?: string): Assertion;
  throws(fn: Function, expectedError?: string | RegExp | Function, message?: string): Assertion;
  notThrows(fn: Function, message?: string): Assertion;
  resolves(promise: Promise<any>, message?: string): Assertion;
  rejects(promise: Promise<any>, expectedError?: string | RegExp | Function, message?: string): Assertion;
  approximately(actual: number, expected: number, tolerance?: number, message?: string): Assertion;
  closeTo(actual: number, expected: number, precision?: number, message?: string): Assertion;
  arrayContains(actual: any[], expected: any[], message?: string): Assertion;
  notArrayContains(actual: any[], expected: any[], message?: string): Assertion;
  objectContainsKey(actual: object, expected: string, message?: string): Assertion;
  objectNotContainsKey(actual: object, expected: string, message?: string): Assertion;
  same(actual: any, expected: any, message?: string): Assertion;
  notSame(actual: any, expected: any, message?: string): Assertion;
  assert(condition: boolean, message?: string): Assertion;
  fail(message?: string): never;
  fail(actual: any, expected: any, message?: string, operator?: string): never;
}

/**
 * Assertion class implementation
 */
export class AssertionErrorImpl extends AssertionError {
  constructor(message: string, expected?: any, actual?: any, location?: AssertionLocation) {
    super(message, expected, actual, location);
    this.name = 'AssertionError';
  }
}

/**
 * Assert implementation
 */
export class AssertImpl implements Assert {
  private location?: AssertionLocation;

  constructor(location?: AssertionLocation) {
    this.location = location;
  }

  equal(actual: any, expected: any, message?: string): Assertion {
    return this.check(actual === expected, actual, expected, message || 'Expected values to be equal');
  }

  notEqual(actual: any, expected: any, message?: string): Assertion {
    return this.check(actual !== expected, actual, expected, message || 'Expected values to be not equal');
  }

  strictEqual(actual: any, expected: any, message?: string): Assertion {
    return this.check(actual === expected, actual, expected, message || 'Expected values to be strictly equal');
  }

  notStrictEqual(actual: any, expected: any, message?: string): Assertion {
    return this.check(actual !== expected, actual, expected, message || 'Expected values to be not strictly equal');
  }

  deepEqual(actual: any, expected: any, message?: string): Assertion {
    return this.check(this.deepEqual(actual, expected), actual, expected, message || 'Expected objects to be deeply equal');
  }

  notDeepEqual(actual: any, expected: any, message?: string): Assertion {
    return this.check(!this.deepEqual(actual, expected), actual, expected, message || 'Expected objects to be not deeply equal');
  }

  truthy(actual: any, message?: string): Assertion {
    return this.check(!!actual, actual, true, message || 'Expected value to be truthy');
  }

  falsy(actual: any, message?: string): Assertion {
    return this.check(!actual, actual, false, message || 'Expected value to be falsy');
  }

  true(actual: any, message?: string): Assertion {
    return this.check(actual === true, actual, true, message || 'Expected value to be true');
  }

  false(actual: any, message?: string): Assertion {
    return this.check(actual === false, actual, false, message || 'Expected value to be false');
  }

  null(actual: any, message?: string): Assertion {
    return this.check(actual === null, actual, null, message || 'Expected value to be null');
  }

  notNull(actual: any, message?: string): Assertion {
    return this.check(actual !== null, actual, null, message || 'Expected value to be not null');
  }

  undefined(actual: any, message?: string): Assertion {
    return this.check(actual === undefined, actual, undefined, message || 'Expected value to be undefined');
  }

  defined(actual: any, message?: string): Assertion {
    return this.check(actual !== undefined, actual, undefined, message || 'Expected value to be defined');
  }

  instanceOf(actual: any, constructor: any, message?: string): Assertion {
    return this.check(actual instanceof constructor, actual, constructor, message || 'Expected value to be instance of constructor');
  }

  notInstanceOf(actual: any, constructor: any, message?: string): Assertion {
    return this.check(!(actual instanceof constructor), actual, constructor, message || 'Expected value to not be instance of constructor');
  }

  contains(actual: string | any[], expected: any, message?: string): Assertion {
    if (typeof actual === 'string') {
      return this.check(actual.includes(expected), actual, expected, message || 'Expected string to contain substring');
    } else if (Array.isArray(actual)) {
      return this.check(actual.includes(expected), actual, expected, message || 'Expected array to contain value');
    }
    return this.check(false, actual, expected, message || 'Expected value to be string or array');
  }

  notContains(actual: string | any[], expected: any, message?: string): Assertion {
    if (typeof actual === 'string') {
      return this.check(!actual.includes(expected), actual, expected, message || 'Expected string to not contain substring');
    } else if (Array.isArray(actual)) {
      return this.check(!actual.includes(expected), actual, expected, message || 'Expected array to not contain value');
    }
    return this.check(false, actual, expected, message || 'Expected value to be string or array');
  }

  matches(actual: string | RegExp, pattern: string | RegExp, message?: string): Assertion {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const toTest = typeof actual === 'string' ? actual : actual.toString();
    return this.check(regex.test(toTest), actual, regex, message || 'Expected value to match pattern');
  }

  notMatches(actual: string | RegExp, pattern: string | RegExp, message?: string): Assertion {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const toTest = typeof actual === 'string' ? actual : actual.toString();
    return this.check(!regex.test(toTest), actual, regex, message || 'Expected value to not match pattern');
  }

  greaterThan(actual: number, expected: number, message?: string): Assertion {
    return this.check(actual > expected, actual, expected, message || 'Expected value to be greater than');
  }

  greaterThanOrEqual(actual: number, expected: number, message?: string): Assertion {
    return this.check(actual >= expected, actual, expected, message || 'Expected value to be greater than or equal to');
  }

  lessThan(actual: number, expected: number, message?: string): Assertion {
    return this.check(actual < expected, actual, expected, message || 'Expected value to be less than');
  }

  lessThanOrEqual(actual: number, expected: number, message?: string): Assertion {
    return this.check(actual <= expected, actual, expected, message || 'Expected value to be less than or equal to');
  }

  throws(fn: Function, expectedError?: string | RegExp | Function, message?: string): Assertion {
    try {
      fn();
      return this.check(false, 'nothing thrown', expectedError, message || 'Expected function to throw');
    } catch (error) {
      if (expectedError) {
        if (typeof expectedError === 'string') {
          return this.check(error.message === expectedError, error.message, expectedError, message || 'Expected error message to match');
        } else if (expectedError instanceof RegExp) {
          return this.check(expectedError.test(error.message), error.message, expectedError, message || 'Expected error message to match regex');
        } else if (typeof expectedError === 'function') {
          return this.check(error instanceof expectedError, error, expectedError, message || 'Expected error to be instance of');
        }
      }
      return this.check(true, error, 'Error thrown', message || 'Expected function to throw');
    }
  }

  notThrows(fn: Function, message?: string): Assertion {
    try {
      fn();
      return this.check(true, 'no error', undefined, message || 'Expected function to not throw');
    } catch (error) {
      return this.check(false, error, 'no error', message || 'Expected function to not throw');
    }
  }

  resolves(promise: Promise<any>, message?: string): Assertion {
    return promise
      .then(result => this.check(true, result, 'resolved', message || 'Expected promise to resolve'))
      .catch(error => this.check(false, error, 'resolved', message || 'Expected promise to resolve'));
  }

  rejects(promise: Promise<any>, expectedError?: string | RegExp | Function, message?: string): Assertion {
    return promise
      .then(result => this.check(false, result, 'rejected', message || 'Expected promise to reject'))
      .catch(error => {
        if (expectedError) {
          if (typeof expectedError === 'string') {
            return this.check(error.message === expectedError, error.message, expectedError, message || 'Expected error message to match');
          } else if (expectedError instanceof RegExp) {
            return this.check(expectedError.test(error.message), error.message, expectedError, message || 'Expected error message to match regex');
          } else if (typeof expectedError === 'function') {
            return this.check(error instanceof expectedError, error, expectedError, message || 'Expected error to be instance of');
          }
        }
        return this.check(true, error, 'rejected', message || 'Expected promise to reject');
      });
  }

  approximately(actual: number, expected: number, tolerance = 0.001, message?: string): Assertion {
    return this.check(Math.abs(actual - expected) <= tolerance, actual, expected, message || 'Expected value to be approximately equal');
  }

  closeTo(actual: number, expected: number, precision = 2, message?: string): Assertion {
    const factor = Math.pow(10, precision);
    const roundedActual = Math.round(actual * factor) / factor;
    const roundedExpected = Math.round(expected * factor) / factor;
    return this.check(roundedActual === roundedExpected, actual, expected, message || 'Expected value to be close to');
  }

  arrayContains(actual: any[], expected: any[], message?: string): Assertion {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      return this.check(false, actual, expected, message || 'Expected arrays');
    }

    for (const item of expected) {
      if (!actual.includes(item)) {
        return this.check(false, actual, expected, message || 'Expected array to contain all elements');
      }
    }

    return this.check(true, actual, expected, message || 'Expected array to contain all elements');
  }

  notArrayContains(actual: any[], expected: any[], message?: string): Assertion {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      return this.check(false, actual, expected, message || 'Expected arrays');
    }

    let containsAll = true;
    for (const item of expected) {
      if (!actual.includes(item)) {
        containsAll = false;
        break;
      }
    }

    return this.check(!containsAll, actual, expected, message || 'Expected array to not contain all elements');
  }

  objectContainsKey(actual: object, expected: string, message?: string): Assertion {
    return this.check(expected in actual, actual, expected, message || 'Expected object to contain key');
  }

  objectNotContainsKey(actual: object, expected: string, message?: string): Assertion {
    return this.check(!(expected in actual), actual, expected, message || 'Expected object to not contain key');
  }

  same(actual: any, expected: any, message?: string): Assertion {
    return this.check(actual === expected, actual, expected, message || 'Expected values to be same reference');
  }

  notSame(actual: any, expected: any, message?: string): Assertion {
    return this.check(actual !== expected, actual, expected, message || 'Expected values to be different references');
  }

  assert(condition: boolean, message?: string): Assertion {
    return this.check(condition, condition, true, message || 'Expected condition to be true');
  }

  fail(message?: string): never {
    throw new AssertionErrorImpl(message || 'Test failed');
  }

  fail(actual: any, expected: any, message?: string, operator?: string): never {
    throw new AssertionErrorImpl(message, expected, actual);
  }

  /**
   * Deep equality comparison
   */
  private deepEqual(a: any, b: any): boolean {
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
          if (!this.deepEqual(a[i], b[i])) return false;
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
          if (!b.has(key) || !this.deepEqual(value, b.get(key))) return false;
        }
        return true;
      default:
        if (typeof a !== 'object' || typeof b !== 'object') return false;

        const keysA = Object.keys(a).sort();
        const keysB = Object.keys(b).sort();

        if (keysA.length !== keysB.length) return false;

        for (let i = 0; i < keysA.length; i++) {
          if (keysA[i] !== keysB[i]) return false;
          if (!this.deepEqual(a[keysA[i]], b[keysB[i]])) return false;
        }

        return true;
    }
  }

  /**
   * Check assertion and return result
   */
  private check(condition: boolean, actual: any, expected: any, message: string): Assertion {
    if (condition) {
      return {
        status: 'pass',
        message: message,
        expected,
        actual,
        location: this.location
      };
    } else {
      throw new AssertionErrorImpl(message, expected, actual, this.location);
    }
  }
}

/**
 * Create new assert instance
 */
export function createAssert(location?: AssertionLocation): Assert {
  return new AssertImpl(location);
}

/**
 * Global assert instance
 */
export const assert: Assert = new AssertImpl();