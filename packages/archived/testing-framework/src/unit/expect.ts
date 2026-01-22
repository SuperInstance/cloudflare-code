import { Matcher, Matchers } from './types';
import { AssertionError } from './errors';

/**
 * Expect class for building assertions
 */
export class Expect<T> {
  constructor(private readonly actual: T) {}

  /**
   * Expect actual to be equal to expected
   */
  toBe(expected: T): void {
    if (this.actual !== expected) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be ${this.stringify(expected)}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to deeply equal expected
   */
  toEqual(expected: T): void {
    if (!this.isDeepEqual(this.actual, expected)) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to deeply equal ${this.stringify(expected)}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to be truthy
   */
  toBeTruthy(): void {
    if (!this.actual) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be truthy`, true, this.actual);
    }
  }

  /**
   * Expect actual to be falsy
   */
  toBeFalsy(): void {
    if (this.actual) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be falsy`, false, this.actual);
    }
  }

  /**
   * Expect actual to be true
   */
  toBeTrue(): void {
    if (this.actual !== true) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be true`, true, this.actual);
    }
  }

  /**
   * Expect actual to be false
   */
  toBeFalse(): void {
    if (this.actual !== false) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be false`, false, this.actual);
    }
  }

  /**
   * Expect actual to be null
   */
  toBeNull(): void {
    if (this.actual !== null) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be null`, null, this.actual);
    }
  }

  /**
   * Expect actual to be undefined
   */
  toBeUndefined(): void {
    if (this.actual !== undefined) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be undefined`, undefined, this.actual);
    }
  }

  /**
   * Expect actual to be defined
   */
  toBeDefined(): void {
    if (this.actual === undefined) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to be defined`, 'defined', this.actual);
    }
  }

  /**
   * Expect actual to contain expected
   */
  toContain(expected: any): void {
    if (typeof this.actual === 'string') {
      if (!this.actual.includes(expected)) {
        throw new AssertionError(`Expected string "${this.actual}" to contain "${expected}"`, expected, this.actual);
      }
    } else if (Array.isArray(this.actual)) {
      if (!this.actual.includes(expected)) {
        throw new AssertionError(`Expected array [${this.actual.join(', ')}] to contain ${expected}`, expected, this.actual);
      }
    } else {
      throw new AssertionError(`Expected value to be string or array`, 'string or array', typeof this.actual);
    }
  }

  /**
   * Expect actual to not contain expected
   */
  notToContain(expected: any): void {
    if (typeof this.actual === 'string') {
      if (this.actual.includes(expected)) {
        throw new AssertionError(`Expected string "${this.actual}" to not contain "${expected}"`, 'not contain', this.actual);
      }
    } else if (Array.isArray(this.actual)) {
      if (this.actual.includes(expected)) {
        throw new AssertionError(`Expected array [${this.actual.join(', ')}] to not contain ${expected}`, 'not contain', this.actual);
      }
    } else {
      throw new AssertionError(`Expected value to be string or array`, 'string or array', typeof this.actual);
    }
  }

  /**
   * Expect actual to match pattern
   */
  toMatch(pattern: string | RegExp): void {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const toTest = typeof this.actual === 'string' ? this.actual : this.actual.toString();

    if (!regex.test(toTest)) {
      throw new AssertionError(`Expected "${toTest}" to match pattern ${pattern}`, pattern, this.actual);
    }
  }

  /**
   * Expect actual to not match pattern
   */
  notToMatch(pattern: string | RegExp): void {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const toTest = typeof this.actual === 'string' ? this.actual : this.actual.toString();

    if (regex.test(toTest)) {
      throw new AssertionError(`Expected "${toTest}" to not match pattern ${pattern}`, 'not match', this.actual);
    }
  }

  /**
   * Expect actual to be instance of expected
   */
  toBeInstanceOf(expected: any): void {
    if (!(this.actual instanceof expected)) {
      throw new AssertionError(`Expected ${this.actual} to be instance of ${expected.name}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to not be instance of expected
   */
  notToBeInstanceOf(expected: any): void {
    if (this.actual instanceof expected) {
      throw new AssertionError(`Expected ${this.actual} to not be instance of ${expected.name}`, 'not instance', this.actual);
    }
  }

  /**
   * Expect actual to be greater than expected
   */
  toBeGreaterThan(expected: number): void {
    if (this.actual <= expected) {
      throw new AssertionError(`Expected ${this.actual} to be greater than ${expected}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to be greater than or equal to expected
   */
  toBeGreaterThanOrEqual(expected: number): void {
    if (this.actual < expected) {
      throw new AssertionError(`Expected ${this.actual} to be greater than or equal to ${expected}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to be less than expected
   */
  toBeLessThan(expected: number): void {
    if (this.actual >= expected) {
      throw new AssertionError(`Expected ${this.actual} to be less than ${expected}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to be less than or equal to expected
   */
  toBeLessThanOrEqual(expected: number): void {
    if (this.actual > expected) {
      throw new AssertionError(`Expected ${this.actual} to be less than or equal to ${expected}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to be approximately equal to expected
   */
  toBeCloseTo(expected: number, precision: number = 2): void {
    const factor = Math.pow(10, precision);
    const roundedActual = Math.round(this.actual * factor) / factor;
    const roundedExpected = Math.round(expected * factor) / factor;

    if (roundedActual !== roundedExpected) {
      throw new AssertionError(`Expected ${this.actual} to be close to ${expected} with precision ${precision}`, expected, this.actual);
    }
  }

  /**
   * Expect actual to be within range
   */
  toBeWithinRange(min: number, max: number): void {
    if (this.actual < min || this.actual > max) {
      throw new AssertionError(`Expected ${this.actual} to be within range [${min}, ${max}]`, [min, max], this.actual);
    }
  }

  /**
   * Expect actual to throw an error
   */
  toThrow(expectedError?: string | RegExp | Function): void {
    if (typeof this.actual !== 'function') {
      throw new AssertionError(`Expected function to throw, got ${typeof this.actual}`, 'function', typeof this.actual);
    }

    try {
      this.actual();
      throw new AssertionError(`Expected function to throw, but it didn't`, 'error', 'no error');
    } catch (error) {
      if (expectedError) {
        if (typeof expectedError === 'string') {
          if (error.message !== expectedError) {
            throw new AssertionError(`Expected error message "${error.message}" to be "${expectedError}"`, expectedError, error.message);
          }
        } else if (expectedError instanceof RegExp) {
          if (!expectedError.test(error.message)) {
            throw new AssertionError(`Error message "${error.message}" to match pattern ${expectedError}`, expectedError, error.message);
          }
        } else if (typeof expectedError === 'function') {
          if (!(error instanceof expectedError)) {
            throw new AssertionError(`Error ${error} to be instance of ${expectedError.name}`, expectedError, error);
          }
        }
      }
    }
  }

  /**
   * Expect actual to not throw an error
   */
  notToThrow(): void {
    if (typeof this.actual !== 'function') {
      throw new AssertionError(`Expected function to not throw, got ${typeof this.actual}`, 'function', typeof this.actual);
    }

    try {
      this.actual();
    } catch (error) {
      throw new AssertionError(`Expected function to not throw, but it threw: ${error.message}`, 'no error', error);
    }
  }

  /**
   * Expect actual to be empty
   */
  toBeEmpty(): void {
    if (Array.isArray(this.actual)) {
      if (this.actual.length !== 0) {
        throw new AssertionError(`Expected array to be empty, but has ${this.actual.length} elements`, 0, this.actual.length);
      }
    } else if (typeof this.actual === 'string') {
      if (this.actual.length !== 0) {
        throw new AssertionError(`Expected string to be empty, but has ${this.actual.length} characters`, 0, this.actual.length);
      }
    } else if (typeof this.actual === 'object' && this.actual !== null) {
      if (Object.keys(this.actual).length !== 0) {
        throw new AssertionError(`Expected object to be empty, but has ${Object.keys(this.actual).length} properties`, 0, Object.keys(this.actual).length);
      }
    } else {
      throw new AssertionError(`Expected value to be array, string, or object`, 'array/string/object', typeof this.actual);
    }
  }

  /**
   * Expect actual to have specific length
   */
  toHaveLength(length: number): void {
    if (Array.isArray(this.actual) || typeof this.actual === 'string') {
      if (this.actual.length !== length) {
        throw new AssertionError(`Expected ${Array.isArray(this.actual) ? 'array' : 'string'} to have length ${length}, but got ${this.actual.length}`, length, this.actual.length);
      }
    } else {
      throw new AssertionError(`Expected value to be array or string`, 'array/string', typeof this.actual);
    }
  }

  /**
   * Expect actual to have property with specific value
   */
  toHaveProperty(property: string, value?: any): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }

    if (!(property in this.actual)) {
      throw new AssertionError(`Expected object to have property "${property}"`, property, 'none');
    }

    if (value !== undefined) {
      if ((this.actual as any)[property] !== value) {
        throw new AssertionError(`Expected property "${property}" to be ${value}, but got ${(this.actual as any)[property]}`, value, (this.actual as any)[property]);
      }
    }
  }

  /**
   * Expect actual to not have specific property
   */
  notToHaveProperty(property: string): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }

    if (property in this.actual) {
      throw new AssertionError(`Expected object to not have property "${property}"`, 'not have', 'has');
    }
  }

  /**
   * Expect actual to contain specific key
   */
  toContainKey(key: string): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }

    if (!Object.keys(this.actual).includes(key)) {
      throw new AssertionError(`Expected object to contain key "${key}"`, key, Object.keys(this.actual));
    }
  }

  /**
   * Expect actual to not contain specific key
   */
  notToContainKey(key: string): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }

    if (Object.keys(this.actual).includes(key)) {
      throw new AssertionError(`Expected object to not contain key "${key}"`, 'not contain', key);
    }
  }

  /**
   * Expect actual to have specific keys
   */
  toContainKeys(keys: string[]): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }

    const actualKeys = Object.keys(this.actual);
    const missingKeys = keys.filter(key => !actualKeys.includes(key));

    if (missingKeys.length > 0) {
      throw new AssertionError(`Expected object to contain keys [${keys.join(', ')}], but missing [${missingKeys.join(', ')}]`, keys, actualKeys);
    }
  }

  /**
   * Expect actual to not have specific keys
   */
  notToContainKeys(keys: string[]): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }

    const actualKeys = Object.keys(this.actual);
    const unexpectedKeys = keys.filter(key => actualKeys.includes(key));

    if (unexpectedKeys.length > 0) {
      throw new AssertionError(`Expected object to not contain keys [${keys.join(', ')}], but found [${unexpectedKeys.join(', ')}]`, 'not contain', unexpectedKeys);
    }
  }

  /**
   * Use custom matcher
   */
  toMatchMatcher(matcher: Matcher<T>): void {
    if (!matcher.matches(this.actual)) {
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to match ${this.stringify(matcher.getExpected())}`, matcher.getExpected(), this.actual);
    }
  }

  /**
   * Expect actual to satisfy custom matcher
   */
  toSatisfy(matcher: (value: T) => boolean, description?: string): void {
    if (!matcher(this.actual)) {
      const desc = description || matcher.toString();
      throw new AssertionError(`Expected ${this.stringify(this.actual)} to satisfy ${desc}`, true, false);
    }
  }

  /**
   * Expect actual to be a number
   */
  toBeNumber(): void {
    if (typeof this.actual !== 'number') {
      throw new AssertionError(`Expected number, got ${typeof this.actual}`, 'number', typeof this.actual);
    }
  }

  /**
   * Expect actual to be a string
   */
  toBeString(): void {
    if (typeof this.actual !== 'string') {
      throw new AssertionError(`Expected string, got ${typeof this.actual}`, 'string', typeof this.actual);
    }
  }

  /**
   * Expect actual to be a boolean
   */
  toBeBoolean(): void {
    if (typeof this.actual !== 'boolean') {
      throw new AssertionError(`Expected boolean, got ${typeof this.actual}`, 'boolean', typeof this.actual);
    }
  }

  /**
   * Expect actual to be an object
   */
  toBeObject(): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new AssertionError(`Expected object, got ${typeof this.actual}`, 'object', typeof this.actual);
    }
  }

  /**
   * Expect actual to be an array
   */
  toBeArray(): void {
    if (!Array.isArray(this.actual)) {
      throw new AssertionError(`Expected array, got ${typeof this.actual}`, 'array', typeof this.actual);
    }
  }

  /**
   * Expect actual to be a function
   */
  toBeFunction(): void {
    if (typeof this.actual !== 'function') {
      throw new AssertionError(`Expected function, got ${typeof this.actual}`, 'function', typeof this.actual);
    }
  }

  /**
   * Expect actual to be a Date
   */
  toBeDate(): void {
    if (!(this.actual instanceof Date)) {
      throw new AssertionError(`Expected Date, got ${typeof this.actual}`, 'Date', typeof this.actual);
    }
  }

  /**
   * Expect actual to be a RegExp
   */
  toBeRegExp(): void {
    if (!(this.actual instanceof RegExp)) {
      throw new AssertionError(`Expected RegExp, got ${typeof this.actual}`, 'RegExp', typeof this.actual);
    }
  }

  /**
   * Expect actual to be a Promise
   */
  toBePromise(): void {
    if (!(this.actual instanceof Promise)) {
      throw new AssertionError(`Expected Promise, got ${typeof this.actual}`, 'Promise', typeof this.actual);
    }
  }

  /**
   * Expect actual to be an Error
   */
  toBeError(): void {
    if (!(this.actual instanceof Error)) {
      throw new AssertionError(`Expected Error, got ${typeof this.actual}`, 'Error', typeof this.actual);
    }
  }

  /**
   * Expect actual to have specific prototype
   */
  toHavePrototype(prototype: any): void {
    if (Object.getPrototypeOf(this.actual) !== prototype) {
      throw new AssertionError(`Expected object to have prototype ${prototype.name}`, prototype, Object.getPrototypeOf(this.actual));
    }
  }

  /**
   * Stringify value for error messages
   */
  private stringify(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (value instanceof Error) return `Error: ${value.message}`;
    if (typeof value === 'function') return value.name || 'function';
    if (Array.isArray(value)) return `[${value.map(v => this.stringify(v)).join(', ')}]`;
    if (typeof value === 'object') return `{${Object.keys(value).map(k => `${k}: ${this.stringify(value[k])}`).join(', ')}}`;
    return String(value);
  }

  /**
   * Deep equality comparison
   */
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
 * Create expect instance
 */
export function expect<T>(actual: T): Expect<T> {
  return new Expect(actual);
}

/**
 * Global expect function
 */
export const globalExpect = expect;