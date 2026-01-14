/**
 * Tests for Locale utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parseLocale,
  formatLocale,
  normalizeLocale,
  getParentLocale,
  isSupportedLocale,
  findClosestLocale,
  parseAcceptLanguage,
  detectLocale,
  getLocaleDirection,
  isRTLLocale,
} from '../src/core/locale.js';

describe('Locale Utilities', () => {
  describe('parseLocale', () => {
    it('should parse simple locale', () => {
      const result = parseLocale('en');
      expect(result).toEqual({ language: 'en' });
    });

    it('should parse locale with region', () => {
      const result = parseLocale('en-US');
      expect(result).toEqual({ language: 'en', region: 'US' });
    });

    it('should parse locale with script', () => {
      const result = parseLocale('zh-Hans');
      expect(result).toEqual({ language: 'zh', script: 'Hans' });
    });

    it('should parse complex locale', () => {
      const result = parseLocale('zh-Hans-CN');
      expect(result).toEqual({ language: 'zh', script: 'Hans', region: 'CN' });
    });
  });

  describe('formatLocale', () => {
    it('should format simple locale', () => {
      const result = formatLocale({ language: 'en' });
      expect(result).toBe('en');
    });

    it('should format locale with region', () => {
      const result = formatLocale({ language: 'en', region: 'US' });
      expect(result).toBe('en-US');
    });

    it('should format locale with script and region', () => {
      const result = formatLocale({ language: 'zh', script: 'Hans', region: 'CN' });
      expect(result).toBe('zh-Hans-CN');
    });
  });

  describe('normalizeLocale', () => {
    it('should normalize uppercase to lowercase', () => {
      expect(normalizeLocale('EN')).toBe('en');
    });

    it('should normalize underscore to hyphen', () => {
      expect(normalizeLocale('en_US')).toBe('en-US');
    });

    it('should capitalize region', () => {
      expect(normalizeLocale('en-us')).toBe('en-US');
    });

    it('should capitalize script', () => {
      expect(normalizeLocale('zh-hans')).toBe('zh-Hans');
    });
  });

  describe('getParentLocale', () => {
    it('should get parent locale', () => {
      expect(getParentLocale('en-US')).toBe('en');
    });

    it('should return null for simple locale', () => {
      expect(getParentLocale('en')).toBe(null);
    });
  });

  describe('isSupportedLocale', () => {
    it('should check if locale is supported', () => {
      const supported = ['en', 'es', 'fr'];
      expect(isSupportedLocale('en', supported)).toBe(true);
      expect(isSupportedLocale('de', supported)).toBe(false);
    });

    it('should handle normalized locales', () => {
      const supported = ['en-US', 'en-GB'];
      expect(isSupportedLocale('en-us', supported)).toBe(true);
    });
  });

  describe('findClosestLocale', () => {
    it('should find exact match', () => {
      const supported = ['en', 'es', 'fr'];
      expect(findClosestLocale('en', supported)).toBe('en');
    });

    it('should find parent locale match', () => {
      const supported = ['en', 'es'];
      expect(findClosestLocale('en-US', supported)).toBe('en');
    });

    it('should find language match', () => {
      const supported = ['en-US', 'en-GB'];
      expect(findClosestLocale('en-CA', supported)).toBe('en-US');
    });

    it('should return null if no match', () => {
      const supported = ['en', 'es'];
      expect(findClosestLocale('de', supported)).toBe(null);
    });
  });

  describe('parseAcceptLanguage', () => {
    it('should parse Accept-Language header', () => {
      const result = parseAcceptLanguage('en-US,en;q=0.9,es;q=0.8');
      expect(result).toEqual([
        { locale: 'en-US', quality: 1.0 },
        { locale: 'en', quality: 0.9 },
        { locale: 'es', quality: 0.8 },
      ]);
    });

    it('should handle empty header', () => {
      const result = parseAcceptLanguage('');
      expect(result).toEqual([]);
    });
  });

  describe('getLocaleDirection', () => {
    it('should return LTR for English', () => {
      expect(getLocaleDirection('en')).toBe('ltr');
    });

    it('should return RTL for Arabic', () => {
      expect(getLocaleDirection('ar')).toBe('rtl');
    });

    it('should return RTL for Hebrew', () => {
      expect(getLocaleDirection('he')).toBe('rtl');
    });
  });

  describe('isRTLLocale', () => {
    it('should return true for RTL locales', () => {
      expect(isRTLLocale('ar')).toBe(true);
      expect(isRTLLocale('he')).toBe(true);
      expect(isRTLLocale('fa')).toBe(true);
    });

    it('should return false for LTR locales', () => {
      expect(isRTLLocale('en')).toBe(false);
      expect(isRTLLocale('es')).toBe(false);
    });
  });
});

describe('Locale Detection', () => {
  it('should detect locale from query parameter', () => {
    const request = new Request('http://example.com?lang=es');
    const result = detectLocale(request, {
      fallbackLocale: 'en',
      supportedLocales: ['en', 'es', 'fr'],
    });

    expect(result.locale).toBe('es');
    expect(result.source).toBe('query');
  });

  it('should fallback to default locale', () => {
    const request = new Request('http://example.com');
    const result = detectLocale(request, {
      fallbackLocale: 'en',
      supportedLocales: ['en', 'es', 'fr'],
    });

    expect(result.locale).toBe('en');
    expect(result.source).toBe('default');
  });
});
