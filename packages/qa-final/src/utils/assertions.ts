/**
 * Custom assertion utilities for QA framework
 */

import { expect, Page } from '@playwright/test';
import type { Assertable, AssertionOptions } from './types';

/**
 * Custom assertion class
 */
export class Assertions<T> implements Assertable<T> {
  constructor(
    private actual: T,
    private isSoft = false
  ) {}

  private softFailures: string[] = [];

  private async assert(
    condition: boolean,
    message: string,
    options?: AssertionOptions
  ): Promise<void> {
    const shouldFail = options?.soft ?? this.isSoft;

    if (!condition) {
      if (shouldFail) {
        this.softFailures.push(message || 'Assertion failed');
      } else {
        throw new Error(message || 'Assertion failed');
      }
    }
  }

  async toBe(expected: T, options?: AssertionOptions): Promise<void> {
    await this.assert(
      this.actual === expected,
      `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(this.actual)}`,
      options
    );
  }

  async toEqual(expected: T, options?: AssertionOptions): Promise<void> {
    const isEqual = JSON.stringify(this.actual) === JSON.stringify(expected);
    await this.assert(
      isEqual,
      `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(this.actual)}`,
      options
    );
  }

  async toMatch(expected: Partial<T>, options?: AssertionOptions): Promise<void> {
    if (typeof this.actual !== 'object' || this.actual === null) {
      throw new Error('toMatch can only be used with objects');
    }

    const actualObj = this.actual as Record<string, unknown>;
    let matches = true;

    for (const [key, value] of Object.entries(expected)) {
      if (actualObj[key] !== value) {
        matches = false;
        break;
      }
    }

    await this.assert(
      matches,
      `Object does not match expected pattern`,
      options
    );
  }

  async toContain(expected: T, options?: AssertionOptions): Promise<void> {
    const contains = Array.isArray(this.actual)
      ? this.actual.includes(expected)
      : String(this.actual).includes(String(expected));

    await this.assert(
      contains,
      `Expected value to contain ${JSON.stringify(expected)}`,
      options
    );
  }

  async toThrow(expected?: Error | string, options?: AssertionOptions): Promise<void> {
    try {
      if (typeof this.actual === 'function') {
        await (this.actual as () => unknown)();
      }
      await this.assert(false, 'Expected function to throw', options);
    } catch (error) {
      if (expected) {
        const message = error instanceof Error ? error.message : String(error);
        const expectedMessage = expected instanceof Error ? expected.message : expected;
        await this.assert(
          message.includes(expectedMessage),
          `Expected error message to contain "${expectedMessage}" but got "${message}"`,
          options
        );
      }
    }
  }

  async toBeGreaterThan(expected: T, options?: AssertionOptions): Promise<void> {
    if (typeof this.actual !== 'number' || typeof expected !== 'number') {
      throw new Error('toBeGreaterThan can only be used with numbers');
    }
    await this.assert(
      this.actual > expected,
      `Expected ${this.actual} to be greater than ${expected}`,
      options
    );
  }

  async toBeLessThan(expected: T, options?: AssertionOptions): Promise<void> {
    if (typeof this.actual !== 'number' || typeof expected !== 'number') {
      throw new Error('toBeLessThan can only be used with numbers');
    }
    await this.assert(
      this.actual < expected,
      `Expected ${this.actual} to be less than ${expected}`,
      options
    );
  }

  async toBeGreaterThanOrEqual(expected: T, options?: AssertionOptions): Promise<void> {
    if (typeof this.actual !== 'number' || typeof expected !== 'number') {
      throw new Error('toBeGreaterThanOrEqual can only be used with numbers');
    }
    await this.assert(
      this.actual >= expected,
      `Expected ${this.actual} to be greater than or equal to ${expected}`,
      options
    );
  }

  async toBeLessThanOrEqual(expected: T, options?: AssertionOptions): Promise<void> {
    if (typeof this.actual !== 'number' || typeof expected !== 'number') {
      throw new Error('toBeLessThanOrEqual can only be used with numbers');
    }
    await this.assert(
      this.actual <= expected,
      `Expected ${this.actual} to be less than or equal to ${expected}`,
      options
    );
  }

  async toBeCloseTo(expected: T, precision = 2, options?: AssertionOptions): Promise<void> {
    if (typeof this.actual !== 'number' || typeof expected !== 'number') {
      throw new Error('toBeCloseTo can only be used with numbers');
    }
    const multiplier = Math.pow(10, precision);
    const actualRounded = Math.round(this.actual * multiplier) / multiplier;
    const expectedRounded = Math.round(expected * multiplier) / multiplier;

    await this.assert(
      actualRounded === expectedRounded,
      `Expected ${this.actual} to be close to ${expected} (precision: ${precision})`,
      options
    );
  }

  async toHaveLength(expected: number, options?: AssertionOptions): Promise<void> {
    const length = Array.isArray(this.actual) || typeof this.actual === 'string'
      ? this.actual.length
      : Object.keys(this.actual as object).length;

    await this.assert(
      length === expected,
      `Expected length to be ${expected} but got ${length}`,
      options
    );
  }

  async toInclude(expected: T, options?: AssertionOptions): Promise<void> {
    return this.toContain(expected, options);
  }

  async toBeTruthy(options?: AssertionOptions): Promise<void> {
    await this.assert(
      Boolean(this.actual),
      `Expected value to be truthy but got ${JSON.stringify(this.actual)}`,
      options
    );
  }

  async toBeFalsy(options?: AssertionOptions): Promise<void> {
    await this.assert(
      !Boolean(this.actual),
      `Expected value to be falsy but got ${JSON.stringify(this.actual)}`,
      options
    );
  }

  async toBeNull(options?: AssertionOptions): Promise<void> {
    await this.assert(
      this.actual === null,
      `Expected value to be null but got ${JSON.stringify(this.actual)}`,
      options
    );
  }

  async toBeUndefined(options?: AssertionOptions): Promise<void> {
    await this.assert(
      this.actual === undefined,
      `Expected value to be undefined but got ${JSON.stringify(this.actual)}`,
      options
    );
  }

  async toBeDefined(options?: AssertionOptions): Promise<void> {
    await this.assert(
      this.actual !== undefined,
      `Expected value to be defined`,
      options
    );
  }

  getSoftFailures(): string[] {
    return [...this.softFailures];
  }

  hasSoftFailures(): boolean {
    return this.softFailures.length > 0;
  }

  clearSoftFailures(): void {
    this.softFailures = [];
  }
}

/**
 * Create a new assertion
 */
export function assert<T>(actual: T): Assertions<T> {
  return new Assertions(actual);
}

/**
 * Create a soft assertion (doesn't stop test execution)
 */
export function softAssert<T>(actual: T): Assertions<T> {
  return new Assertions(actual, true);
}

/**
 * Assert HTTP status code
 */
export async function assertStatusCode(
  actualStatus: number,
  expectedStatus: number,
  options?: AssertionOptions
): Promise<void> {
  await assert(actualStatus).toBe(expectedStatus, options);
}

/**
 * Assert response contains expected data
 */
export async function assertResponseContains<T>(
  response: T,
  expectedData: Partial<T>,
  options?: AssertionOptions
): Promise<void> {
  await assert(response).toMatch(expectedData, options);
}

/**
 * Assert API response structure
 */
export async function assertApiResponse<T>(
  response: unknown,
  schema: { [K in keyof T]?: unknown },
  options?: AssertionOptions
): Promise<void> {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Response must be an object');
  }

  for (const [key, value] of Object.entries(schema)) {
    if (!(key in response)) {
      throw new Error(`Response missing required key: ${key}`);
    }

    if (value !== undefined && (response as Record<string, unknown>)[key] !== value) {
      const message = `Expected ${key} to be ${JSON.stringify(value)} but got ${JSON.stringify((response as Record<string, unknown>)[key])}`;
      if (options?.soft) {
        console.warn(message);
      } else {
        throw new Error(message);
      }
    }
  }
}

/**
 * Assert page title
 */
export async function assertPageTitle(
  page: Page,
  expectedTitle: string,
  options?: AssertionOptions
): Promise<void> {
  const actualTitle = await page.title();
  await assert(actualTitle).toBe(expectedTitle, options);
}

/**
 * Assert page URL
 */
export async function assertPageUrl(
  page: Page,
  expectedUrl: string | RegExp,
  options?: AssertionOptions
): Promise<void> {
  const actualUrl = page.url();

  if (expectedUrl instanceof RegExp) {
    await assert(expectedUrl.test(actualUrl)).toBeTruthy(options);
  } else {
    await assert(actualUrl).toBe(expectedUrl, options);
  }
}

/**
 * Assert element exists
 */
export async function assertElementExists(
  page: Page,
  selector: string,
  options?: AssertionOptions & { timeout?: number }
): Promise<void> {
  const { timeout = 5000, ...assertOptions } = options || {};

  try {
    await page.waitForSelector(selector, { timeout });
    const element = page.locator(selector);
    await expect(element).toHaveCount(1);
  } catch (error) {
    if (!assertOptions?.soft) {
      throw error;
    }
  }
}

/**
 * Assert element text
 */
export async function assertElementText(
  page: Page,
  selector: string,
  expectedText: string,
  options?: AssertionOptions & { timeout?: number }
): Promise<void> {
  const { timeout = 5000, ...assertOptions } = options || {};

  try {
    await page.waitForSelector(selector, { timeout });
    const element = page.locator(selector);
    const actualText = await element.textContent();

    await assert(actualText || '').toBe(expectedText, assertOptions);
  } catch (error) {
    if (!assertOptions?.soft) {
      throw error;
    }
  }
}

/**
 * Assert element attribute
 */
export async function assertElementAttribute(
  page: Page,
  selector: string,
  attribute: string,
  expectedValue: string,
  options?: AssertionOptions & { timeout?: number }
): Promise<void> {
  const { timeout = 5000, ...assertOptions } = options || {};

  try {
    await page.waitForSelector(selector, { timeout });
    const element = page.locator(selector);
    const actualValue = await element.getAttribute(attribute);

    await assert(actualValue || '').toBe(expectedValue, assertOptions);
  } catch (error) {
    if (!assertOptions?.soft) {
      throw error;
    }
  }
}

/**
 * Assert element is enabled
 */
export async function assertElementEnabled(
  page: Page,
  selector: string,
  options?: AssertionOptions & { timeout?: number }
): Promise<void> {
  const { timeout = 5000, ...assertOptions } = options || {};

  try {
    await page.waitForSelector(selector, { timeout });
    const element = page.locator(selector);
    const isEnabled = await element.isEnabled();

    await assert(isEnabled).toBeTruthy(assertOptions);
  } catch (error) {
    if (!assertOptions?.soft) {
      throw error;
    }
  }
}

/**
 * Assert element is disabled
 */
export async function assertElementDisabled(
  page: Page,
  selector: string,
  options?: AssertionOptions & { timeout?: number }
): Promise<void> {
  const { timeout = 5000, ...assertOptions } = options || {};

  try {
    await page.waitForSelector(selector, { timeout });
    const element = page.locator(selector);
    const isEnabled = await element.isEnabled();

    await assert(isEnabled).toBeFalsy(assertOptions);
  } catch (error) {
    if (!assertOptions?.soft) {
      throw error;
    }
  }
}

/**
 * Assert array contains item
 */
export async function assertArrayContains<T>(
  array: T[],
  item: T,
  options?: AssertionOptions
): Promise<void> {
  await assert(array).toContain(item, options);
}

/**
 * Assert array length
 */
export async function assertArrayLength<T>(
  array: T[],
  expectedLength: number,
  options?: AssertionOptions
): Promise<void> {
  await assert(array).toHaveLength(expectedLength, options);
}

/**
 * Assert object has property
 */
export async function assertObjectHasProperty<T extends object>(
  obj: T,
  property: string,
  options?: AssertionOptions
): Promise<void> {
  await assert(property in obj).toBeTruthy(options);
}

/**
 * Assert object property value
 */
export async function assertObjectProperty<T extends object, K extends keyof T>(
  obj: T,
  property: K,
  expectedValue: T[K],
  options?: AssertionOptions
): Promise<void> {
  const actualValue = obj[property];
  await assert(actualValue).toBe(expectedValue, options);
}

/**
 * Assert date is within range
 */
export async function assertDateInRange(
  date: Date,
  minDate: Date,
  maxDate: Date,
  options?: AssertionOptions
): Promise<void> {
  await assert(date.getTime()).toBeGreaterThanOrEqual(minDate.getTime(), options);
  await assert(date.getTime()).toBeLessThanOrEqual(maxDate.getTime(), options);
}

/**
 * Assert string matches pattern
 */
export async function assertStringMatches(
  str: string,
  pattern: RegExp,
  options?: AssertionOptions
): Promise<void> {
  await assert(pattern.test(str)).toBeTruthy(options);
}

/**
 * Assert number is within range
 */
export async function assertNumberInRange(
  num: number,
  min: number,
  max: number,
  options?: AssertionOptions
): Promise<void> {
  await assert(num).toBeGreaterThanOrEqual(min, options);
  await assert(num).toBeLessThanOrEqual(max, options);
}

/**
 * Assert performance metric
 */
export async function assertPerformanceMetric(
  metricName: string,
  actualValue: number,
  threshold: number,
  options?: AssertionOptions & { operator?: 'less' | 'greater' }
): Promise<void> {
  const { operator = 'less', ...assertOptions } = options || {};

  if (operator === 'less') {
    await assert(actualValue).toBeLessThanOrEqual(threshold, {
      ...assertOptions,
      message: `Performance metric '${metricName}' (${actualValue}ms) exceeds threshold (${threshold}ms)`
    });
  } else {
    await assert(actualValue).toBeGreaterThanOrEqual(threshold, {
      ...assertOptions,
      message: `Performance metric '${metricName}' (${actualValue}ms) is below threshold (${threshold}ms)`
    });
  }
}
