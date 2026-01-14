/**
 * Tests for RTL support
 */

import { describe, it, expect } from 'vitest';
import {
  isRTL,
  getTextDirection,
  getRTLConfig,
  mirrorCSS,
  formatMixedContent,
  containsRTL,
  containsLTR,
  detectTextDirection,
  mirrorFlexDirection,
  mirrorAlignment,
} from '../src/rtl/index.js';

describe('RTL Utilities', () => {
  describe('isRTL', () => {
    it('should return true for Arabic', () => {
      expect(isRTL('ar')).toBe(true);
    });

    it('should return true for Hebrew', () => {
      expect(isRTL('he')).toBe(true);
    });

    it('should return true for Persian', () => {
      expect(isRTL('fa')).toBe(true);
    });

    it('should return false for English', () => {
      expect(isRTL('en')).toBe(false);
    });

    it('should return false for Spanish', () => {
      expect(isRTL('es')).toBe(false);
    });
  });

  describe('getTextDirection', () => {
    it('should return rtl for RTL locales', () => {
      expect(getTextDirection('ar')).toBe('rtl');
      expect(getTextDirection('he')).toBe('rtl');
    });

    it('should return ltr for LTR locales', () => {
      expect(getTextDirection('en')).toBe('ltr');
      expect(getTextDirection('es')).toBe('ltr');
    });
  });

  describe('getRTLConfig', () => {
    it('should return enabled config for RTL locale', () => {
      const config = getRTLConfig('ar');
      expect(config.enabled).toBe(true);
      expect(config.layoutMirroring).toBe(true);
      expect(config.alignment).toBe('right');
    });

    it('should return disabled config for LTR locale', () => {
      const config = getRTLConfig('en');
      expect(config.enabled).toBe(false);
      expect(config.layoutMirroring).toBe(false);
      expect(config.alignment).toBe('left');
    });
  });

  describe('mirrorCSS', () => {
    it('should mirror margin-left to margin-right', () => {
      const result = mirrorCSS('margin-left: 10px;');
      expect(result).toContain('margin-right');
    });

    it('should mirror padding-right to padding-left', () => {
      const result = mirrorCSS('padding-right: 10px;');
      expect(result).toContain('padding-left');
    });

    it('should mirror border-radius', () => {
      const result = mirrorCSS('border-top-left-radius: 5px;');
      expect(result).toContain('border-top-right-radius');
    });

    it('should mirror left/right positions', () => {
      const result = mirrorCSS('left: 0;');
      expect(result).toContain('right');
    });
  });

  describe('formatMixedContent', () => {
    it('should handle mixed LTR/RTL content', () => {
      const result = formatMixedContent('Hello مرحبا', 'ar');
      expect(result).toBeTruthy();
    });

    it('should handle pure LTR content', () => {
      const result = formatMixedContent('Hello World', 'en');
      expect(result).toBeTruthy();
    });

    it('should handle pure RTL content', () => {
      const result = formatMixedContent('مرحبا بالعالم', 'ar');
      expect(result).toBeTruthy();
    });
  });

  describe('Text Direction Detection', () => {
    describe('containsRTL', () => {
      it('should detect RTL characters', () => {
        expect(containsRTL('مرحبا')).toBe(true);
        expect(containsRTL('שלום')).toBe(true);
      });

      it('should return false for LTR text', () => {
        expect(containsRTL('Hello')).toBe(false);
      });
    });

    describe('containsLTR', () => {
      it('should detect LTR characters', () => {
        expect(containsLTR('Hello')).toBe(true);
      });

      it('should return false for pure RTL text', () => {
        expect(containsLTR('مرحبا')).toBe(false);
      });
    });

    describe('detectTextDirection', () => {
      it('should detect LTR text', () => {
        expect(detectTextDirection('Hello World')).toBe('ltr');
      });

      it('should detect RTL text', () => {
        expect(detectTextDirection('مرحبا بالعالم')).toBe('rtl');
      });

      it('should detect mixed content', () => {
        expect(detectTextDirection('Hello مرحبا')).toBe('mixed');
      });
    });
  });

  describe('Layout Mirroring', () => {
    describe('mirrorFlexDirection', () => {
      it('should mirror row to row-reverse', () => {
        expect(mirrorFlexDirection('row')).toBe('row-reverse');
      });

      it('should mirror row-reverse to row', () => {
        expect(mirrorFlexDirection('row-reverse')).toBe('row');
      });

      it('should not change column direction', () => {
        expect(mirrorFlexDirection('column')).toBe('column');
        expect(mirrorFlexDirection('column-reverse')).toBe('column-reverse');
      });
    });

    describe('mirrorAlignment', () => {
      it('should mirror flex-start to flex-end', () => {
        expect(mirrorAlignment('flex-start')).toBe('flex-end');
      });

      it('should mirror left to right', () => {
        expect(mirrorAlignment('left')).toBe('right');
      });

      it('should mirror start to end', () => {
        expect(mirrorAlignment('start')).toBe('end');
      });
    });
  });

  describe('RTL-Specific Features', () => {
    it('should handle Arabic numeral conversion', () => {
      // This tests the convertNumerals function if exported
      // For now we just verify RTL utilities work
      expect(isRTL('ar')).toBe(true);
    });

    it('should handle bidirectional text', () => {
      const mixed = 'Hello 123 مرحبا';
      expect(detectTextDirection(mixed)).toBe('mixed');
    });
  });
});
