/**
 * Basic Testing Examples
 *
 * Demonstrates fundamental testing patterns using the ClaudeFlare Testing Framework
 */

import { describe, it, expect, beforeEach, afterEach } from '@claudeflare/testing';

// ============================================================================
// Basic Assertions
// ============================================================================

describe('Basic Assertions', () => {
  describe('Equality Matchers', () => {
    it('should compare primitives with toBe', () => {
      const a = 1;
      const b = 1;

      expect(a).toBe(b);
      expect(a).not.toBe(2);
    });

    it('should compare objects with toEqual', () => {
      const obj1 = { name: 'Alice', age: 30 };
      const obj2 = { name: 'Alice', age: 30 };

      expect(obj1).toEqual(obj2);
      expect(obj1).not.toBe(obj2); // Different references
    });

    it('should compare arrays deeply', () => {
      const arr1 = [1, 2, { three: 3 }];
      const arr2 = [1, 2, { three: 3 }];

      expect(arr1).toEqual(arr2);
    });
  });

  describe('String Matchers', () => {
    it('should match substrings', () => {
      const text = 'Hello, World!';

      expect(text).toMatch('World');
      expect(text).toMatch(/World/);
      expect(text).toMatch(/world/i); // Case insensitive
    });
  });

  describe('Number Matchers', () => {
    it('should compare numbers', () => {
      const value = 10;

      expect(value).toBeGreaterThan(5);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(20);
      expect(value).toBeLessThanOrEqual(10);
    });

    it('should handle floating point precision', () => {
      const value = 0.1 + 0.2;

      expect(value).toBeCloseTo(0.3, 1);
    });
  });

  describe('Boolean Matchers', () => {
    it('should check truthiness', () => {
      expect(true).toBeTruthy();
      expect(1).toBeTruthy();
      expect('text').toBeTruthy();
      expect({}).toBeTruthy();
      expect([]).toBeTruthy();
    });

    it('should check falsiness', () => {
      expect(false).toBeFalsy();
      expect(0).toBeFalsy();
      expect('').toBeFalsy();
      expect(null).toBeFalsy();
      expect(undefined).toBeFalsy();
    });
  });

  describe('Null Matchers', () => {
    it('should check for null', () => {
      const value = null;

      expect(value).toBeNull();
      expect(value).toBeDefined();
      expect(value).not.toBeUndefined();
    });

    it('should check for undefined', () => {
      let value: string | undefined;

      expect(value).toBeUndefined();
      expect(value).not.toBeDefined();
    });
  });

  describe('Array Matchers', () => {
    it('should check array length', () => {
      const arr = [1, 2, 3, 4, 5];

      expect(arr).toHaveLength(5);
    });

    it('should check array contents', () => {
      const arr = [1, 2, 3];

      expect(arr).toContain(2);
      expect(arr).toContainEqual(2);
    });
  });

  describe('Object Matchers', () => {
    it('should check object properties', () => {
      const obj = {
        name: 'Alice',
        age: 30,
        address: {
          city: 'New York',
          country: 'USA',
        },
      };

      expect(obj).toHaveProperty('name');
      expect(obj).toHaveProperty('address.city', 'New York');
    });

    it('should match partial objects', () => {
      const obj = {
        name: 'Alice',
        age: 30,
        email: 'alice@example.com',
      };

      expect(obj).toMatchObject({
        name: 'Alice',
        age: 30,
      });
    });
  });
});

// ============================================================================
// Async Testing
// ============================================================================

describe('Async Testing', () => {
  describe('Promises', () => {
    it('should handle resolved promises', async () => {
      const promise = Promise.resolve(42);

      await expect(promise).resolves.toBe(42);
    });

    it('should handle rejected promises', async () => {
      const promise = Promise.reject(new Error('Test error'));

      await expect(promise).rejects.toThrow('Test error');
    });

    it('should wait for async operations', async () => {
      let value = 0;

      const promise = new Promise((resolve) => {
        setTimeout(() => {
          value = 42;
          resolve(undefined);
        }, 100);
      });

      await promise;
      expect(value).toBe(42);
    });
  });

  describe('Async/Await', () => {
    async function fetchUser(id: number) {
      // Simulate API call
      return {
        id,
        name: 'Alice',
        email: 'alice@example.com',
      };
    }

    it('should test async functions', async () => {
      const user = await fetchUser(1);

      expect(user).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
      });
    });
  });
});

// ============================================================================
// Error Testing
// ============================================================================

describe('Error Testing', () => {
  function throwError() {
    throw new Error('Test error');
  }

  function throwTypeError() {
    throw new TypeError('Type error');
  }

  it('should test if function throws', () => {
    expect(throwError).toThrow();
    expect(throwError).toThrow('Test error');
    expect(throwError).toThrow(/Test/);
  });

  it('should test specific error types', () => {
    expect(throwTypeError).toThrow(TypeError);
  });

  it('should test async errors', async () => {
    async function asyncThrow() {
      throw new Error('Async error');
    }

    await expect(asyncThrow()).rejects.toThrow('Async error');
  });
});

// ============================================================================
// Setup and Teardown
// ============================================================================

describe('Setup and Teardown', () => {
  let counter = 0;

  beforeEach(() => {
    // Runs before each test
    counter = 0;
  });

  afterEach(() => {
    // Runs after each test
    console.log(`Counter value after test: ${counter}`);
  });

  it('should increment counter', () => {
    counter++;
    expect(counter).toBe(1);
  });

  it('should have fresh counter', () => {
    expect(counter).toBe(0);
    counter++;
    expect(counter).toBe(1);
  });
});

// ============================================================================
// Custom Matchers
// ============================================================================

describe('Custom Matchers', () => {
  beforeAll(() => {
    expect.extend({
      toBeWithinRange(this: any, actual: number, min: number, max: number) {
        const pass = actual >= min && actual <= max;
        return {
          pass,
          message: () =>
            `expected ${actual} ${pass ? 'not ' : ''}to be within range ${min} - ${max}`,
        };
      },

      toBeValidEmail(this: any, actual: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const pass = emailRegex.test(actual);
        return {
          pass,
          message: () => `expected "${actual}" ${pass ? 'not ' : ''}to be a valid email`,
        };
      },
    });
  });

  it('should use custom range matcher', () => {
    const value = 5;

    expect(value).toBeWithinRange(1, 10);
    expect(value).not.toBeWithinRange(6, 10);
  });

  it('should use custom email matcher', () => {
    const email = 'test@example.com';

    expect(email).toBeValidEmail();
    expect('invalid').not.toBeValidEmail();
  });
});

// ============================================================================
// Testing Classes
// ============================================================================

class Calculator {
  private result = 0;

  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

describe('Calculator', () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  it('should add numbers', () => {
    expect(calculator.add(2, 3)).toBe(5);
  });

  it('should subtract numbers', () => {
    expect(calculator.subtract(5, 3)).toBe(2);
  });

  it('should multiply numbers', () => {
    expect(calculator.multiply(3, 4)).toBe(12);
  });

  it('should divide numbers', () => {
    expect(calculator.divide(10, 2)).toBe(5);
  });

  it('should throw error when dividing by zero', () => {
    expect(() => calculator.divide(10, 0)).toThrow('Division by zero');
  });
});

// ============================================================================
// Testing DOM-like Structures
// ============================================================================

interface Element {
  tagName: string;
  attributes: Record<string, string>;
  children: Element[];
  textContent?: string;
}

describe('DOM Testing', () => {
  function createElement(tagName: string, attributes: Record<string, string> = {}): Element {
    return {
      tagName,
      attributes,
      children: [],
    };
  }

  it('should create element with tag name', () => {
    const div = createElement('div');

    expect(div).toHaveProperty('tagName', 'div');
  });

  it('should create element with attributes', () => {
    const button = createElement('button', {
      id: 'submit',
      class: 'btn-primary',
    });

    expect(button).toMatchObject({
      tagName: 'button',
      attributes: {
        id: 'submit',
        class: 'btn-primary',
      },
    });
  });

  it('should build element tree', () => {
    const ul = createElement('ul');

    ul.children.push(
      createElement('li', { class: 'item' }),
      createElement('li', { class: 'item' }),
      createElement('li', { class: 'item' })
    );

    expect(ul).toHaveProperty('children');
    expect(ul.children).toHaveLength(3);
  });
});
