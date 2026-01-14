/**
 * Assertion Library - Deep equality assertions with async support and custom matchers
 */

import { diff as diffLines } from 'diff';
import type {
  Expect,
  Assertion,
  CustomMatcher,
  CustomMatcherResult,
  MatcherContext,
  MatcherUtils,
  SnapshotSerializer,
} from '../types/index.js';

// ============================================================================
// Equality Utilities
// ============================================================================

export class EqualityUtils {
  deepEqual(a: unknown, b: unknown): boolean {
    return this.deepEqualInternal(a, b, [], []);
  }

  private deepEqualInternal(
    a: unknown,
    b: unknown,
    aStack: unknown[],
    bStack: unknown[]
  ): boolean {
    // Primitive types
    if (a === b) {
      return true;
    }

    // Handle null/undefined
    if (a == null || b == null) {
      return a === b;
    }

    // Handle NaN
    if (typeof a === 'number' && typeof b === 'number') {
      if (Number.isNaN(a) && Number.isNaN(b)) {
        return true;
      }
    }

    // Handle different types
    if (typeof a !== typeof b) {
      return false;
    }

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle regex
    if (a instanceof RegExp && b instanceof RegExp) {
      return a.source === b.source && a.flags === b.flags;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqualInternal(a[i], b[i], [...aStack, a], [...bStack, b])) {
          return false;
        }
      }
      return true;
    }

    // Handle objects
    if (this.isPlainObject(a) && this.isPlainObject(b)) {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);

      if (keysA.length !== keysB.length) {
        return false;
      }

      // Check for circular references
      const aIndex = aStack.indexOf(a);
      const bIndex = bStack.indexOf(b);
      if (aIndex !== bIndex) {
        return false;
      }
      if (aIndex >= 0) {
        return true;
      }

      for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) {
          return false;
        }
        if (
          !this.deepEqualInternal(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
            [...aStack, a],
            [...bStack, b]
          )
        ) {
          return false;
        }
      }
      return true;
    }

    // Handle Maps
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) {
        return false;
      }
      for (const [key, value] of a) {
        if (!b.has(key) || !this.deepEqualInternal(value, b.get(key), aStack, bStack)) {
          return false;
        }
      }
      return true;
    }

    // Handle Sets
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) {
        return false;
      }
      for (const value of a) {
        if (!this.hasEqualValue(b, value, aStack, bStack)) {
          return false;
        }
      }
      return true;
    }

    // Handle ArrayBuffers
    if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
      return this.arrayBuffersEqual(a, b);
    }

    // Handle TypedArrays
    if (this.isTypedArray(a) && this.isTypedArray(b)) {
      return this.typedArraysEqual(a as ArrayBufferView, b as ArrayBufferView);
    }

    return false;
  }

  private isPlainObject(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  }

  private hasEqualValue(
    set: Set<unknown>,
    value: unknown,
    aStack: unknown[],
    bStack: unknown[]
  ): boolean {
    for (const item of set) {
      if (this.deepEqualInternal(value, item, aStack, bStack)) {
        return true;
      }
    }
    return false;
  }

  private arrayBuffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) {
      return false;
    }
    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);
    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) {
        return false;
      }
    }
    return true;
  }

  private isTypedArray(value: unknown): boolean {
    return (
      value instanceof Int8Array ||
      value instanceof Uint8Array ||
      value instanceof Uint8ClampedArray ||
      value instanceof Int16Array ||
      value instanceof Uint16Array ||
      value instanceof Int32Array ||
      value instanceof Uint32Array ||
      value instanceof Float32Array ||
      value instanceof Float64Array
    );
  }

  private typedArraysEqual(a: ArrayBufferView, b: ArrayBufferView): boolean {
    if (a.byteLength !== b.byteLength) {
      return false;
    }
    return this.arrayBuffersEqual(
      a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength),
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    );
  }

  getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    if (value instanceof Map) return 'map';
    if (value instanceof Set) return 'set';
    if (value instanceof Error) return 'error';
    return typeof value;
  }
}

// ============================================================================
// Diff Utilities
// ============================================================================

export class DiffUtils {
  generateDiff(actual: unknown, expected: unknown): string | null {
    const actualStr = this.stringify(actual);
    const expectedStr = this.stringify(expected);

    if (actualStr === expectedStr) {
      return null;
    }

    const diff = diffLines(expectedStr, actualStr);
    const output: string[] = [];

    for (const change of diff) {
      const lines = change.value.split('\n').filter((l) => l);
      for (const line of lines) {
        const prefix = change.added ? '+' : change.removed ? '-' : ' ';
        output.push(`${prefix} ${line}`);
      }
    }

    return output.join('\n');
  }

  private stringify(value: unknown, indent = 2): string {
    const seen = new Set<unknown>();

    const stringify = (val: unknown, currentIndent = 0): string => {
      const spaces = ' '.repeat(currentIndent);

      // Handle primitives
      if (val === null) return 'null';
      if (val === undefined) return 'undefined';
      if (typeof val === 'string') return JSON.stringify(val);
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);

      // Handle special objects
      if (val instanceof Date) return `new Date("${val.toISOString()}")`;
      if (val instanceof RegExp) return val.toString();

      // Handle circular references
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);

      // Handle arrays
      if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        const items = val.map((item) => stringify(item, currentIndent + indent));
        return `[\n${items.map((i) => spaces + i).join(',\n')}\n${' '.repeat(currentIndent)}]`;
      }

      // Handle objects
      if (typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length === 0) return '{}';
        const entries = keys.map((key) => {
          const value = (val as Record<string, unknown>)[key];
          return `${spaces}${key}: ${stringify(value, currentIndent + indent)}`;
        });
        return `{\n${entries.join(',\n')}\n${' '.repeat(currentIndent)}}`;
      }

      return String(val);
    };

    return stringify(value);
  }
}

// ============================================================================
// Matcher Implementation
// ============================================================================

export class MatcherImpl<T = unknown> {
  private actual: T;
  private isNot = false;
  private customMessage?: string;
  private equalityUtils = new EqualityUtils();
  private diffUtils = new DiffUtils();

  constructor(actual: T, isNot = false, customMessage?: string) {
    this.actual = actual;
    this.isNot = isNot;
    this.customMessage = customMessage;
  }

  get not(): MatcherImpl<T> {
    return new MatcherImpl(this.actual, !this.isNot, this.customMessage);
  }

  // Basic equality
  toBe(expected: T): void {
    this.check(
      Object.is(this.actual, expected),
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be ${this.formatValue(expected)}`
    );
  }

  toEqual(expected: T): void {
    const equals = this.equalityUtils.deepEqual(this.actual, expected);
    this.check(
      this.isNot ? !equals : equals,
      () => {
        const diff = this.diffUtils.generateDiff(this.actual, expected);
        const message = `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to deeply equal ${this.formatValue(expected)}`;
        return diff ? `${message}\n\nDifference:\n${diff}` : message;
      }
    );
  }

  toStrictEqual(expected: T): void {
    const equals = this.equalityUtils.deepEqual(this.actual, expected);
    this.check(
      this.isNot ? !equals : equals,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to strictly equal ${this.formatValue(expected)}`
    );
  }

  // String matching
  toMatch(expected: string | RegExp): void {
    const actualStr = String(this.actual);
    const matches = typeof expected === 'string'
      ? actualStr.includes(expected)
      : expected.test(actualStr);

    this.check(
      this.isNot ? !matches : matches,
      `Expected "${actualStr}" ${this.isNot ? 'not ' : ''}to match ${expected}`
    );
  }

  // Object matching
  toMatchObject(expected: Partial<T>): void {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new Error('toMatchObject requires an object as actual value');
    }

    const matches = this.objectsMatch(this.actual as Record<string, unknown>, expected as Record<string, unknown>);
    this.check(
      this.isNot ? !matches : matches,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to match object ${this.formatValue(expected)}`
    );
  }

  toHaveProperty(path: string | string[], value?: unknown): void {
    const actualValue = this.getProperty(this.actual, path);
    const hasProperty = actualValue !== undefined;

    if (value === undefined) {
      this.check(
        this.isNot ? !hasProperty : hasProperty,
        `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to have property "${Array.isArray(path) ? path.join('.') : path}"`
      );
    } else {
      const matches = this.equalityUtils.deepEqual(actualValue, value);
      this.check(
        this.isNot ? !matches : matches,
        `Expected property "${Array.isArray(path) ? path.join('.') : path}" ${this.isNot ? 'not ' : ''}to be ${this.formatValue(value)}`
      );
    }
  }

  // Containment
  toContain(expected: unknown): void {
    const contains = this.checkContains(this.actual, expected);
    this.check(
      this.isNot ? !contains : contains,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to contain ${this.formatValue(expected)}`
    );
  }

  toContainEqual(expected: unknown): void {
    const containsEqual = this.checkContainsEqual(this.actual, expected);
    this.check(
      this.isNot ? !containsEqual : containsEqual,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to contain equal ${this.formatValue(expected)}`
    );
  }

  // Truthiness
  toBeTruthy(): void {
    this.check(
      this.isNot ? !this.actual : !!this.actual,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be truthy`
    );
  }

  toBeFalsy(): void {
    this.check(
      this.isNot ? !!this.actual : !this.actual,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be falsy`
    );
  }

  // Null checks
  toBeNull(): void {
    this.check(
      this.isNot ? this.actual !== null : this.actual === null,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be null`
    );
  }

  toBeUndefined(): void {
    this.check(
      this.isNot ? this.actual !== undefined : this.actual === undefined,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be undefined`
    );
  }

  toBeDefined(): void {
    this.check(
      this.isNot ? this.actual === undefined : this.actual !== undefined,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be defined`
    );
  }

  toBeNaN(): void {
    this.check(
      this.isNot ? !Number.isNaN(this.actual) : Number.isNaN(this.actual as number),
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be NaN`
    );
  }

  // Number comparisons
  toBeGreaterThan(expected: number): void {
    if (typeof this.actual !== 'number') {
      throw new Error('toBeGreaterThan requires a number as actual value');
    }
    this.check(
      this.isNot ? !(this.actual > expected) : this.actual > expected,
      `Expected ${this.actual} ${this.isNot ? 'not ' : ''}to be greater than ${expected}`
    );
  }

  toBeGreaterThanOrEqual(expected: number): void {
    if (typeof this.actual !== 'number') {
      throw new Error('toBeGreaterThanOrEqual requires a number as actual value');
    }
    this.check(
      this.isNot ? !(this.actual >= expected) : this.actual >= expected,
      `Expected ${this.actual} ${this.isNot ? 'not ' : ''}to be greater than or equal to ${expected}`
    );
  }

  toBeLessThan(expected: number): void {
    if (typeof this.actual !== 'number') {
      throw new Error('toBeLessThan requires a number as actual value');
    }
    this.check(
      this.isNot ? !(this.actual < expected) : this.actual < expected,
      `Expected ${this.actual} ${this.isNot ? 'not ' : ''}to be less than ${expected}`
    );
  }

  toBeLessThanOrEqual(expected: number): void {
    if (typeof this.actual !== 'number') {
      throw new Error('toBeLessThanOrEqual requires a number as actual value');
    }
    this.check(
      this.isNot ? !(this.actual <= expected) : this.actual <= expected,
      `Expected ${this.actual} ${this.isNot ? 'not ' : ''}to be less than or equal to ${expected}`
    );
  }

  toBeCloseTo(expected: number, precision = 2): void {
    if (typeof this.actual !== 'number') {
      throw new Error('toBeCloseTo requires a number as actual value');
    }
    const multiplier = 10 ** precision;
    const actualRounded = Math.round((this.actual as number) * multiplier) / multiplier;
    const expectedRounded = Math.round(expected * multiplier) / multiplier;
    this.check(
      this.isNot ? actualRounded !== expectedRounded : actualRounded === expectedRounded,
      `Expected ${this.actual} ${this.isNot ? 'not ' : ''}to be close to ${expected} (precision: ${precision})`
    );
  }

  // Errors
  toThrow(expected?: string | RegExp | ErrorConstructor): void {
    if (typeof this.actual !== 'function') {
      throw new Error('toThrow requires a function as actual value');
    }

    let threw = false;
    let error: Error | undefined;

    try {
      (this.actual as () => unknown)();
    } catch (e) {
      threw = true;
      error = e as Error;
    }

    if (!threw) {
      this.check(false, `Expected function to throw${expected ? ` matching ${expected}` : ''}`);
      return;
    }

    if (expected) {
      if (typeof expected === 'string') {
        this.check(
          this.isNot ? !error?.message.includes(expected) : error?.message.includes(expected),
          `Expected error message ${this.isNot ? 'not ' : ''}to contain "${expected}"`
        );
      } else if (expected instanceof RegExp) {
        this.check(
          this.isNot ? !expected.test(error?.message || '') : expected.test(error?.message || ''),
          `Expected error message ${this.isNot ? 'not ' : ''}to match ${expected}`
        );
      } else if (typeof expected === 'function') {
        this.check(
          this.isNot ? !(error instanceof expected) : error instanceof expected,
          `Expected error ${this.isNot ? 'not ' : ''}to be instance of ${expected.name}`
        );
      }
    } else {
      this.check(true, 'Expected function to throw');
    }
  }

  toThrowError(expected?: string | RegExp | ErrorConstructor): void {
    this.toThrow(expected);
  }

  // Instance checks
  toBeInstanceOf(expected: Function): void {
    this.check(
      this.isNot ? !(this.actual instanceof expected) : this.actual instanceof expected,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to be instance of ${expected.name}`
    );
  }

  // Length
  toHaveLength(expected: number): void {
    const length = this.getLength(this.actual);
    this.check(
      this.isNot ? length !== expected : length === expected,
      `Expected ${this.formatValue(this.actual)} ${this.isNot ? 'not ' : ''}to have length ${expected}`
    );
  }

  // Async helpers
  get resolves(): AsyncMatchers<T> {
    return new AsyncMatchers(this.actual, this.isNot, this.customMessage);
  }

  get rejects(): AsyncMatchers<T> {
    return new AsyncMatchers(this.actual, this.isNot, this.customMessage, true);
  }

  // Private helpers
  private check(pass: boolean, message: string | (() => string)): void {
    if (!pass) {
      const msg = typeof message === 'function' ? message() : message;
      const fullMessage = this.customMessage ? `${this.customMessage}\n\n${msg}` : msg;
      throw new Error(fullMessage);
    }
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return this.diffUtils.stringify(value);
  }

  private objectsMatch(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
    for (const key in expected) {
      if (!(key in actual)) {
        return false;
      }
      if (!this.equalityUtils.deepEqual(actual[key], expected[key])) {
        return false;
      }
    }
    return true;
  }

  private getProperty(obj: unknown, path: string | string[]): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }

    const keys = Array.isArray(path) ? path : path.split('.');
    let current: Record<string, unknown> = obj as Record<string, unknown>;

    for (const key of keys) {
      if (typeof current !== 'object' || current === null || !(key in current)) {
        return undefined;
      }
      current = current[key] as Record<string, unknown>;
    }

    return current;
  }

  private checkContains(actual: unknown, expected: unknown): boolean {
    if (Array.isArray(actual)) {
      return actual.includes(expected);
    }
    if (typeof actual === 'string') {
      return actual.includes(String(expected));
    }
    if (actual instanceof Set) {
      return actual.has(expected);
    }
    if (typeof actual === 'object' && actual !== null) {
      return expected in actual;
    }
    return false;
  }

  private checkContainsEqual(actual: unknown, expected: unknown): boolean {
    if (Array.isArray(actual)) {
      return actual.some(item => this.equalityUtils.deepEqual(item, expected));
    }
    if (actual instanceof Set) {
      for (const item of actual) {
        if (this.equalityUtils.deepEqual(item, expected)) {
          return true;
        }
      }
      return false;
    }
    return false;
  }

  private getLength(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'string') return value.length;
    if (value instanceof Set || value instanceof Map) return value.size;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length;
    return 0;
  }
}

// ============================================================================
// Async Matchers
// ============================================================================

export class AsyncMatchers<T> {
  private actual: T;
  private isNot: boolean;
  private customMessage?: string;
  private shouldReject: boolean;

  constructor(
    actual: T,
    isNot: boolean,
    customMessage?: string,
    shouldReject = false
  ) {
    this.actual = actual;
    this.isNot = isNot;
    this.customMessage = customMessage;
    this.shouldReject = shouldReject;
  }

  async toBe(expected: Awaited<T>): Promise<void> {
    const promise = Promise.resolve(this.actual);
    const matcher = new MatcherImpl<Awaited<T>>(await promise, this.isNot, this.customMessage);

    if (this.shouldReject) {
      await this.checkRejects(promise, 'to not reject');
    } else {
      matcher.toBe(expected);
    }
  }

  async toEqual(expected: Awaited<T>): Promise<void> {
    const promise = Promise.resolve(this.actual);
    const matcher = new MatcherImpl<Awaited<T>>(await promise, this.isNot, this.customMessage);

    if (this.shouldReject) {
      await this.checkRejects(promise, 'to not reject');
    } else {
      matcher.toEqual(expected);
    }
  }

  async toMatch(expected: string | RegExp): Promise<void> {
    const promise = Promise.resolve(this.actual);
    const matcher = new MatcherImpl<string>(String(await promise), this.isNot, this.customMessage);

    if (this.shouldReject) {
      await this.checkRejects(promise, 'to not reject');
    } else {
      matcher.toMatch(expected);
    }
  }

  async toThrow(expected?: string | RegExp | ErrorConstructor): Promise<void> {
    if (!this.shouldReject) {
      throw new Error('resolves.toThrow() is not supported. Use rejects.toThrow() instead.');
    }

    const promise = Promise.resolve(this.actual);
    let threw = false;
    let error: Error | undefined;

    try {
      await promise;
    } catch (e) {
      threw = true;
      error = e as Error;
    }

    if (!threw) {
      throw new Error(`Expected promise to reject${expected ? ` matching ${expected}` : ''}`);
    }

    if (expected) {
      const matcher = new MatcherImpl<Error>(error!, this.isNot, this.customMessage);
      matcher.toThrow(expected);
    }
  }

  private async checkRejects(promise: Promise<unknown>, message: string): Promise<void> {
    try {
      await promise;
      throw new Error(`Expected promise to reject, but it resolved`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('to reject')) {
        throw error;
      }
    }
  }
}

// ============================================================================
// Expect Implementation
// ============================================================================

export class ExpectImpl {
  private customMatchers: Map<string, CustomMatcher> = new Map();
  private snapshotSerializers: SnapshotSerializer[] = [];
  private assertionCount = 0;
  private expectedAssertions?: number;

  constructor() {}

  createExpect<T>(actual: T, customMessage?: string): Assertion<T> {
    this.assertionCount++;
    return new MatcherImpl(actual, false, customMessage) as unknown as Assertion<T>;
  }

  extend(matchers: Record<string, CustomMatcher>): void {
    for (const [name, matcher] of Object.entries(matchers)) {
      this.customMatchers.set(name, matcher);
    }
  }

  assertions(expected: number): void {
    this.expectedAssertions = expected;
  }

  hasAssertions(): void {
    this.expectedAssertions = Math.max(this.expectedAssertions || 0, 1);
  }

  addSnapshotSerializer(serializer: SnapshotSerializer): void {
    this.snapshotSerializers.push(serializer);
  }

  getAssertionCount(): number {
    return this.assertionCount;
  }

  getExpectedAssertions(): number | undefined {
    return this.expectedAssertions;
  }

  verifyAssertions(): void {
    if (this.expectedAssertions !== undefined && this.assertionCount !== this.expectedAssertions) {
      throw new Error(
        `Expected ${this.expectedAssertions} assertions, but ${this.assertionCount} were made`
      );
    }
  }

  resetAssertions(): void {
    this.assertionCount = 0;
    this.expectedAssertions = undefined;
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createExpect(): Expect {
  const expectImpl = new ExpectImpl();
  const expect = expectImpl.createExpect.bind(expectImpl) as Expect;

  expect.extend = expectImpl.extend.bind(expectImpl);
  expect.assertions = expectImpl.assertions.bind(expectImpl);
  expect.hasAssertions = expectImpl.hasAssertions.bind(expectImpl);
  expect.addSnapshotSerializer = expectImpl.addSnapshotSerializer.bind(expectImpl);

  return expect;
}
