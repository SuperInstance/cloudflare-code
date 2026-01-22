/**
 * Pluralization rules for 20+ languages based on CLDR data
 */

import type { PluralCategory, PluralRule } from '../types/index.js';

/**
 * Get pluralization rule for locale
 */
export function getPluralRule(locale: string): PluralRule {
  const language = locale.split('-')[0];

  return pluralRules[language] || pluralRules.en;
}

/**
 * CLDR plural rules for all languages
 * Based on: https://unicode.org/reports/tr35/tr35-numbers.html#Language_Plural_Rules
 */
const pluralRules: Record<string, PluralRule> = {
  // English, German, Dutch, Swedish, Danish, Norwegian, Finnish, Estonian, Hungarian
  en: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      return 'other';
    },
    ordinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (v === 0) {
        const mod10 = i % 10;
        const mod100 = i % 100;

        if (mod10 === 1 && mod100 !== 11) return 'one';
        if (mod10 === 2 && mod100 !== 12) return 'two';
        if (mod10 === 3 && mod100 !== 13) return 'few';
      }
      return 'other';
    },
  },

  de: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      return 'other';
    },
    ordinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (v === 0) {
        const mod10 = i % 10;
        const mod100 = i % 100;

        if (mod10 === 1 && mod100 !== 11) return 'one';
        if (mod10 === 2 && mod100 !== 12) return 'two';
      }
      return 'other';
    },
  },

  nl: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      return 'other';
    },
  },

  sv: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      return 'other';
    },
  },

  // Spanish, Italian, Portuguese
  es: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      return 'other';
    },
    ordinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (v === 0) {
        const mod10 = i % 10;
        const mod100 = i % 100;

        if (mod10 === 1 && mod100 !== 11) return 'one';
        if (mod10 === 2 && mod100 !== 12) return 'two';
        if (mod10 === 3 && mod100 !== 13) return 'few';
        if (mod10 === 0) return 'many';
      }
      return 'other';
    },
  },

  it: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      return 'other';
    },
  },

  pt: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 0 || i === 1) return 'one';
      return 'other';
    },
  },

  // French
  fr: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 0 || i === 1) return 'one';
      return 'other';
    },
    ordinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1) return 'one';
      return 'other';
    },
  },

  // Russian, Ukrainian, Polish, Czech
  ru: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;
      const mod10 = i % 10;
      const mod100 = i % 100;

      if (v === 0) {
        if (mod10 === 1 && mod100 !== 11) return 'one';
        if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14))
          return 'few';
        if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14))
          return 'many';
      }
      return 'other';
    },
  },

  uk: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;
      const mod10 = i % 10;
      const mod100 = i % 100;

      if (v === 0) {
        if (mod10 === 1 && mod100 !== 11) return 'one';
        if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14))
          return 'few';
        if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14))
          return 'many';
      }
      return 'other';
    },
  },

  pl: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      const mod10 = i % 10;
      const mod100 = i % 100;

      if (v === 0) {
        if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14))
          return 'few';
      }
      if (!(i === 1 && v === 0) && (v === 0 || v === 1)) return 'many';
      return 'other';
    },
  },

  cs: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      if (i >= 2 && i <= 4 && v === 0) return 'few';
      return 'other';
    },
  },

  // Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian
  zh: {
    cardinal: (_n: number): PluralCategory => 'other',
  },

  ja: {
    cardinal: (_n: number): PluralCategory => 'other',
  },

  ko: {
    cardinal: (_n: number): PluralCategory => 'other',
  },

  vi: {
    cardinal: (_n: number): PluralCategory => 'other',
  },

  th: {
    cardinal: (_n: number): PluralCategory => 'other',
  },

  id: {
    cardinal: (_n: number): PluralCategory => 'other',
  },

  // Arabic
  ar: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (n === 0) return 'zero';
      if (i === 1 && v === 0) return 'one';
      if (i === 2 && v === 0) return 'two';
      if (v === 0 && (n % 100 >= 3 && n % 100 <= 10)) return 'few';
      if (v === 0 && (n % 100 >= 11 && n % 100 <= 99)) return 'many';
      return 'other';
    },
    ordinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));

      if (i === 0) return 'zero';
      if (i === 1) return 'one';
      if (i === 2) return 'two';
      if (i % 100 >= 3 && i % 100 <= 10) return 'few';
      return 'other';
    },
  },

  // Hebrew
  he: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));
      const v = n.toString().split('.')[1]?.length || 0;

      if (i === 1 && v === 0) return 'one';
      if (i === 2 && v === 0) return 'two';
      if (v === 0 && (n < 0 || n > 10) && n % 10 === 0) return 'many';
      return 'other';
    },
    ordinal: (n: number): PluralCategory => {
      return 'other';
    },
  },

  // Persian
  fa: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));

      if (i === 0) return 'one';
      return 'other';
    },
  },

  // Turkish
  tr: {
    cardinal: (n: number): PluralCategory => {
      const i = Math.floor(Math.abs(n));

      if (i === 1 || n === 0) return 'one';
      return 'other';
    },
  },
};

/**
 * Get plural category for a number in a locale
 */
export function getPluralCategory(
  n: number,
  locale: string,
  type: 'cardinal' | 'ordinal' = 'cardinal'
): PluralCategory {
  const rule = getPluralRule(locale);

  if (type === 'ordinal' && rule.ordinal) {
    return rule.ordinal(n);
  }

  return rule.cardinal(n);
}

/**
 * Format plural message
 */
export function formatPlural(
  n: number,
  locale: string,
  messages: Record<PluralCategory, string>,
  type: 'cardinal' | 'ordinal' = 'cardinal'
): string {
  const category = getPluralCategory(n, locale, type);
  return messages[category] || messages.other || '';
}

/**
 * Get all available plural categories for a locale
 */
export function getPluralCategories(
  locale: string,
  type: 'cardinal' | 'ordinal' = 'cardinal'
): PluralCategory[] {
  const rule = getPluralRule(locale);
  const categories: PluralCategory[] = [];

  // Test numbers 0-100 to find which categories are used
  for (let i = 0; i <= 100; i++) {
    const category =
      type === 'ordinal' && rule.ordinal
        ? rule.ordinal(i)
        : rule.cardinal(i);

    if (!categories.includes(category)) {
      categories.push(category);
    }
  }

  return categories.sort();
}

/**
 * Check if locale has plural forms
 */
export function hasPlurals(locale: string): boolean {
  const categories = getPluralCategories(locale);
  return categories.length > 1;
}
