/**
 * Tests for pluralization rules
 */

import { describe, it, expect } from 'vitest';
import {
  getPluralRule,
  getPluralCategory,
  formatPlural,
  getPluralCategories,
  hasPlurals,
} from '../src/utils/plural-rules.js';

describe('Pluralization Rules', () => {
  describe('English', () => {
    const rule = getPluralRule('en');

    it('should handle singular', () => {
      expect(rule.cardinal(1)).toBe('one');
    });

    it('should handle plural', () => {
      expect(rule.cardinal(0)).toBe('other');
      expect(rule.cardinal(2)).toBe('other');
      expect(rule.cardinal(5)).toBe('other');
    });

    it('should handle ordinals', () => {
      expect(rule.ordinal(1)).toBe('one');
      expect(rule.ordinal(2)).toBe('two');
      expect(rule.ordinal(3)).toBe('few');
      expect(rule.ordinal(4)).toBe('other');
      expect(rule.ordinal(11)).toBe('other');
      expect(rule.ordinal(21)).toBe('one');
    });
  });

  describe('Arabic', () => {
    const rule = getPluralRule('ar');

    it('should handle zero', () => {
      expect(rule.cardinal(0)).toBe('zero');
    });

    it('should handle singular', () => {
      expect(rule.cardinal(1)).toBe('one');
    });

    it('should handle dual', () => {
      expect(rule.cardinal(2)).toBe('two');
    });

    it('should handle few', () => {
      expect(rule.cardinal(3)).toBe('few');
      expect(rule.cardinal(10)).toBe('few');
    });

    it('should handle many', () => {
      expect(rule.cardinal(11)).toBe('many');
      expect(rule.cardinal(99)).toBe('many');
    });
  });

  describe('Russian', () => {
    const rule = getPluralRule('ru');

    it('should handle one', () => {
      expect(rule.cardinal(1)).toBe('one');
      expect(rule.cardinal(21)).toBe('one');
      expect(rule.cardinal(51)).toBe('one');
    });

    it('should handle few', () => {
      expect(rule.cardinal(2)).toBe('few');
      expect(rule.cardinal(3)).toBe('few');
      expect(rule.cardinal(4)).toBe('few');
      expect(rule.cardinal(22)).toBe('few');
    });

    it('should handle many', () => {
      expect(rule.cardinal(0)).toBe('many');
      expect(rule.cardinal(5)).toBe('many');
      expect(rule.cardinal(11)).toBe('many');
    });
  });

  describe('Japanese', () => {
    const rule = getPluralRule('ja');

    it('should always return other', () => {
      expect(rule.cardinal(0)).toBe('other');
      expect(rule.cardinal(1)).toBe('other');
      expect(rule.cardinal(2)).toBe('other');
      expect(rule.cardinal(100)).toBe('other');
    });
  });

  describe('Chinese', () => {
    const rule = getPluralRule('zh');

    it('should always return other', () => {
      expect(rule.cardinal(0)).toBe('other');
      expect(rule.cardinal(1)).toBe('other');
      expect(rule.cardinal(2)).toBe('other');
    });
  });

  describe('Polish', () => {
    const rule = getPluralRule('pl');

    it('should handle one', () => {
      expect(rule.cardinal(1)).toBe('one');
    });

    it('should handle few', () => {
      expect(rule.cardinal(2)).toBe('few');
      expect(rule.cardinal(3)).toBe('few');
      expect(rule.cardinal(4)).toBe('few');
      expect(rule.cardinal(22)).toBe('few');
    });

    it('should handle many', () => {
      expect(rule.cardinal(0)).toBe('many');
      expect(rule.cardinal(5)).toBe('many');
      expect(rule.cardinal(6)).toBe('many');
    });
  });

  describe('Czech', () => {
    const rule = getPluralRule('cs');

    it('should handle one', () => {
      expect(rule.cardinal(1)).toBe('one');
    });

    it('should handle few', () => {
      expect(rule.cardinal(2)).toBe('few');
      expect(rule.cardinal(3)).toBe('few');
      expect(rule.cardinal(4)).toBe('few');
    });

    it('should handle other', () => {
      expect(rule.cardinal(0)).toBe('other');
      expect(rule.cardinal(5)).toBe('other');
    });
  });

  describe('Turkish', () => {
    const rule = getPluralRule('tr');

    it('should handle one', () => {
      expect(rule.cardinal(1)).toBe('one');
      expect(rule.cardinal(0)).toBe('one'); // Turkish treats 0 as one
    });

    it('should handle other', () => {
      expect(rule.cardinal(2)).toBe('other');
      expect(rule.cardinal(5)).toBe('other');
    });
  });

  describe('Persian', () => {
    const rule = getPluralRule('fa');

    it('should handle one', () => {
      expect(rule.cardinal(0)).toBe('one');
      expect(rule.cardinal(1)).toBe('one');
    });

    it('should handle other', () => {
      expect(rule.cardinal(2)).toBe('other');
      expect(rule.cardinal(5)).toBe('other');
    });
  });
});

describe('Pluralization Helpers', () => {
  it('should get plural category', () => {
    expect(getPluralCategory(1, 'en')).toBe('one');
    expect(getPluralCategory(2, 'en')).toBe('other');
    expect(getPluralCategory(0, 'ar')).toBe('zero');
  });

  it('should format plural message', () => {
    const messages = {
      one: 'One item',
      other: '# items',
    };

    expect(formatPlural(1, 'en', messages)).toBe('One item');
    expect(formatPlural(5, 'en', messages)).toBe('5 items');
  });

  it('should check if locale has plurals', () => {
    expect(hasPlurals('en')).toBe(true);
    expect(hasPlurals('ja')).toBe(false);
    expect(hasPlurals('zh')).toBe(false);
  });

  it('should get all plural categories for locale', () => {
    const enCategories = getPluralCategories('en');
    expect(enCategories).toContain('one');
    expect(enCategories).toContain('other');

    const arCategories = getPluralCategories('ar');
    expect(arCategories).toContain('zero');
    expect(arCategories).toContain('one');
    expect(arCategories).toContain('two');
    expect(arCategories).toContain('few');
    expect(arCategories).toContain('many');
  });
});
