/**
 * Tests for Assertion Library
 */

import { describe, it, expect } from 'vitest';
import {
  MatcherImpl,
  ExpectImpl,
  EqualityUtils,
  DiffUtils,
  createExpect,
} from '../src/assertions/matcher.js';

describe('EqualityUtils', () => {
  const utils = new EqualityUtils();

  describe('deepEqual', () => {
    it('should compare primitives', () => {
      expect(utils.deepEqual(1, 1)).toBe(true);
      expect(utils.deepEqual('test', 'test')).toBe(true);
      expect(utils.deepEqual(true, true)).toBe(true);
      expect(utils.deepEqual(null, null)).toBe(true);
      expect(utils.deepEqual(undefined, undefined)).toBe(true);
    });

    it('should handle NaN', () => {
      expect(utils.deepEqual(NaN, NaN)).toBe(true);
      expect(utils.deepEqual(NaN, 1)).toBe(false);
    });

    it('should compare arrays', () => {
      expect(utils.deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(utils.deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(utils.deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });

    it('should compare objects', () => {
      expect(utils.deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(utils.deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
      expect(utils.deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should compare nested structures', () => {
      expect(utils.deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true);
      expect(utils.deepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
    });

    it('should compare dates', () => {
      const date = new Date('2020-01-01');
      expect(utils.deepEqual(date, new Date('2020-01-01'))).toBe(true);
      expect(utils.deepEqual(date, new Date('2020-01-02'))).toBe(false);
    });

    it('should compare regex', () => {
      expect(utils.deepEqual(/test/g, /test/g)).toBe(true);
      expect(utils.deepEqual(/test/g, /test/i)).toBe(false);
    });

    it('should compare Maps', () => {
      const map1 = new Map([['a', 1]]);
      const map2 = new Map([['a', 1]]);
      expect(utils.deepEqual(map1, map2)).toBe(true);
    });

    it('should compare Sets', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 3]);
      expect(utils.deepEqual(set1, set2)).toBe(true);
    });

    it('should handle circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      const obj2: any = { a: 1 };
      obj2.self = obj2;
      expect(utils.deepEqual(obj, obj2)).toBe(true);
    });
  });
});

describe('DiffUtils', () => {
  const utils = new DiffUtils();

  describe('generateDiff', () => {
    it('should return null for identical values', () => {
      expect(utils.generateDiff(1, 1)).toBeNull();
      expect(utils.generateDiff('test', 'test')).toBeNull();
    });

    it('should generate diff for different strings', () => {
      const diff = utils.generateDiff('hello world', 'hello there');
      expect(diff).toBeTruthy();
      expect(diff).toContain('- world');
      expect(diff).toContain('+ there');
    });

    it('should generate diff for different objects', () => {
      const diff = utils.generateDiff({ a: 1 }, { a: 2 });
      expect(diff).toBeTruthy();
    });
  });
});

describe('MatcherImpl', () => {
  describe('toBe', () => {
    it('should check strict equality', () => {
      const matcher = new MatcherImpl(1);
      expect(() => matcher.toBe(1)).not.toThrow();
      expect(() => matcher.toBe(2)).toThrow();
    });

    it('should handle NaN correctly', () => {
      const matcher = new MatcherImpl(NaN);
      expect(() => matcher.toBe(NaN)).not.toThrow();
    });
  });

  describe('toEqual', () => {
    it('should check deep equality', () => {
      const matcher = new MatcherImpl({ a: 1, b: 2 });
      expect(() => matcher.toEqual({ a: 1, b: 2 })).not.toThrow();
      expect(() => matcher.toEqual({ a: 1, b: 3 })).toThrow();
    });

    it('should check array equality', () => {
      const matcher = new MatcherImpl([1, 2, 3]);
      expect(() => matcher.toEqual([1, 2, 3])).not.toThrow();
      expect(() => matcher.toEqual([1, 2, 4])).toThrow();
    });
  });

  describe('toMatch', () => {
    it('should match strings', () => {
      const matcher = new MatcherImpl('hello world');
      expect(() => matcher.toMatch('world')).not.toThrow();
      expect(() => matcher.toMatch(/world/)).not.toThrow();
      expect(() => matcher.toMatch('goodbye')).toThrow();
    });
  });

  describe('toContain', () => {
    it('should check array contains', () => {
      const matcher = new MatcherImpl([1, 2, 3]);
      expect(() => matcher.toContain(2)).not.toThrow();
      expect(() => matcher.toContain(4)).toThrow();
    });

    it('should check string contains', () => {
      const matcher = new MatcherImpl('hello world');
      expect(() => matcher.toContain('world')).not.toThrow();
      expect(() => matcher.toContain('goodbye')).toThrow();
    });
  });

  describe('toBeTruthy', () => {
    it('should check truthy values', () => {
      expect(() => new MatcherImpl(1).toBeTruthy()).not.toThrow();
      expect(() => new MatcherImpl(true).toBeTruthy()).not.toThrow();
      expect(() => new MatcherImpl('text').toBeTruthy()).not.toThrow();
      expect(() => new MatcherImpl(0).toBeTruthy()).toThrow();
      expect(() => new MatcherImpl(false).toBeTruthy()).toThrow();
      expect(() => new MatcherImpl('').toBeTruthy()).toThrow();
    });
  });

  describe('toBeFalsy', () => {
    it('should check falsy values', () => {
      expect(() => new MatcherImpl(0).toBeFalsy()).not.toThrow();
      expect(() => new MatcherImpl(false).toBeFalsy()).not.toThrow();
      expect(() => new MatcherImpl('').toBeFalsy()).not.toThrow();
      expect(() => new MatcherImpl(1).toBeFalsy()).toThrow();
      expect(() => new MatcherImpl(true).toBeFalsy()).toThrow();
    });
  });

  describe('toBeNull', () => {
    it('should check null', () => {
      expect(() => new MatcherImpl(null).toBeNull()).not.toThrow();
      expect(() => new MatcherImpl(undefined).toBeNull()).toThrow();
    });
  });

  describe('toBeUndefined', () => {
    it('should check undefined', () => {
      expect(() => new MatcherImpl(undefined).toBeUndefined()).not.toThrow();
      expect(() => new MatcherImpl(null).toBeUndefined()).toThrow();
    });
  });

  describe('toBeGreaterThan', () => {
    it('should check greater than', () => {
      const matcher = new MatcherImpl(5);
      expect(() => matcher.toBeGreaterThan(3)).not.toThrow();
      expect(() => matcher.toBeGreaterThan(5)).toThrow();
      expect(() => matcher.toBeGreaterThan(7)).toThrow();
    });
  });

  describe('toBeLessThan', () => {
    it('should check less than', () => {
      const matcher = new MatcherImpl(3);
      expect(() => matcher.toBeLessThan(5)).not.toThrow();
      expect(() => matcher.toBeLessThan(3)).toThrow();
      expect(() => matcher.toBeLessThan(1)).toThrow();
    });
  });

  describe('toThrow', () => {
    it('should check if function throws', () => {
      const thrower = () => {
        throw new Error('test error');
      };
      const matcher = new MatcherImpl(thrower);
      expect(() => matcher.toThrow()).not.toThrow();
      expect(() => matcher.toThrow('test error')).not.toThrow();
      expect(() => matcher.toThrow(/test/)).not.toThrow();
      expect(() => matcher.toThrow('other error')).toThrow();
    });
  });

  describe('toHaveLength', () => {
    it('should check length', () => {
      expect(() => new MatcherImpl([1, 2, 3]).toHaveLength(3)).not.toThrow();
      expect(() => new MatcherImpl('hello').toHaveLength(5)).not.toThrow();
      expect(() => new MatcherImpl([1, 2, 3]).toHaveLength(4)).toThrow();
    });
  });

  describe('not modifier', () => {
    it('should negate assertions', () => {
      const matcher = new MatcherImpl(1);
      expect(() => matcher.not.toBe(2)).not.toThrow();
      expect(() => matcher.not.toBe(1)).toThrow();
    });
  });
});

describe('ExpectImpl', () => {
  it('should create expect function', () => {
    const expectImpl = new ExpectImpl();
    const expect = expectImpl.createExpect.bind(expectImpl);

    expect(1).toBe(1);
    expect({ a: 1 }).toEqual({ a: 1 });
  });

  it('should track assertions', () => {
    const expectImpl = new ExpectImpl();
    const expect = expectImpl.createExpect.bind(expectImpl);

    expect(1).toBe(1);
    expect(2).toBe(2);

    expect(expectImpl.getAssertionCount()).toBe(2);
  });

  it('should verify expected assertions', () => {
    const expectImpl = new ExpectImpl();
    const expect = expectImpl.createExpect.bind(expectImpl);

    expectImpl.assertions(2);
    expect(1).toBe(1);
    expect(2).toBe(2);

    expect(() => expectImpl.verifyAssertions()).not.toThrow();
  });

  it('should fail if wrong number of assertions', () => {
    const expectImpl = new ExpectImpl();
    const expect = expectImpl.createExpect.bind(expectImpl);

    expectImpl.assertions(2);
    expect(1).toBe(1);

    expect(() => expectImpl.verifyAssertions()).toThrow();
  });
});

describe('createExpect', () => {
  it('should create a working expect function', () => {
    const expect = createExpect();

    expect(1).toBe(1);
    expect({ a: 1 }).toEqual({ a: 1 });
    expect('hello').toContain('ell');
  });

  it('should support custom matchers', () => {
    const expect = createExpect();

    expect.extend({
      toBeWithinRange(this: any, actual: number, min: number, max: number) {
        const pass = actual >= min && actual <= max;
        return {
          pass,
          message: () => `expected ${actual} ${pass ? 'not ' : ''}to be between ${min} and ${max}`,
        };
      },
    });

    expect(5).toBeWithinRange(1, 10);
  });
});
