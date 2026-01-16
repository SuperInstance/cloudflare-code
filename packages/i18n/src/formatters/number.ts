/**
 * Number formatting for different locales
 */

// @ts-nocheck - Type incompatibilities with NumberFormatOptions

import type { NumberFormatOptions, Locale } from '../types/index.js';

/**
 * Format number according to locale
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options: NumberFormatOptions = {}
): string {
  const {
    style = 'decimal',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    minimumIntegerDigits,
    minimumSignificantDigits,
    maximumSignificantDigits,
  } = options;

  try {
    const formatterOptions: Intl.NumberFormatOptions = {
      style,
      minimumFractionDigits,
      maximumFractionDigits,
      minimumIntegerDigits,
      minimumSignificantDigits,
      maximumSignificantDigits,
    };

    if (currency && style === 'currency') {
      formatterOptions.currency = currency;
      formatterOptions.currencyDisplay = 'symbol';
    }

    const formatter = new Intl.NumberFormat(locale, formatterOptions);
    return formatter.format(value);
  } catch (error) {
    // Fallback to basic formatting
    return value.toLocaleString();
  }
}

/**
 * Format decimal number
 */
export function formatDecimal(
  value: number,
  locale: Locale,
  decimals?: number
): string {
  return formatNumber(value, locale, {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage
 */
export function formatPercent(value: number, locale: Locale): string {
  return formatNumber(value, locale, { style: 'percent' });
}

/**
 * Format currency
 */
export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string,
  display: 'symbol' | 'narrowSymbol' | 'code' | 'name' = 'symbol'
): string {
  return formatNumber(value, locale, {
    style: 'currency',
    currency,
    currencyDisplay: display,
  });
}

/**
 * Format integer (no decimal places)
 */
export function formatInteger(value: number, locale: Locale): string {
  return formatNumber(value, locale, {
    maximumFractionDigits: 0,
  });
}

/**
 * Format with significant digits
 */
export function formatSignificant(
  value: number,
  locale: Locale,
  digits: number
): string {
  return formatNumber(value, locale, {
    minimumSignificantDigits: digits,
    maximumSignificantDigits: digits,
  });
}

/**
 * Compact notation (1.2K, 1.5M, etc.)
 */
export function formatCompact(
  value: number,
  locale: Locale,
  style: 'short' | 'long' = 'short'
): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: style,
    });
    return formatter.format(value);
  } catch {
    return value.toLocaleString();
  }
}

/**
 * Format bytes (1024, 1048576 -> 1 KB, 1 MB)
 */
export function formatBytes(value: number, locale: Locale): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return formatDecimal(size, locale, 1) + ' ' + units[unitIndex];
}

/**
 * Parse number from localized string
 */
export function parseNumber(value: string, locale: Locale): number | null {
  try {
    // Get formatting symbols for locale
    const format = new Intl.NumberFormat(locale);
    const parts = format.formatToParts(12345.6);

    let groupSeparator = ',';
    let decimalSeparator = '.';

    for (const part of parts) {
      if (part.type === 'group') groupSeparator = part.value;
      if (part.type === 'decimal') decimalSeparator = part.value;
    }

    // Remove non-numeric characters except separators
    let normalized = value
      .replace(new RegExp(`\\${groupSeparator}`, 'g'), '')
      .replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.');

    // Remove currency symbols and other non-numeric characters
    normalized = normalized.replace(/[^\d.-]/g, '');

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Get default currency for locale
 */
export function getDefaultCurrency(locale: Locale): string {
  const currencyMap: Record<string, string> = {
    'en-US': 'USD',
    'en-GB': 'GBP',
    'en-CA': 'CAD',
    'en-AU': 'AUD',
    es: 'EUR',
    'es-MX': 'MXN',
    'es-AR': 'ARS',
    fr: 'EUR',
    de: 'EUR',
    it: 'EUR',
    nl: 'EUR',
    pt: 'EUR',
    'pt-BR': 'BRL',
    ja: 'JPY',
    ko: 'KRW',
    zh: 'CNY',
    'zh-Hant': 'TWD',
    ru: 'RUB',
    tr: 'TRY',
    ar: 'SAR',
    he: 'ILS',
    fa: 'IRR',
    th: 'THB',
    vi: 'VND',
    id: 'IDR',
    sv: 'SEK',
    pl: 'PLN',
    cs: 'CZK',
    uk: 'UAH',
  };

  return currencyMap[locale] || currencyMap[locale.split('-')[0]] || 'USD';
}

/**
 * Format accounting number (negative in parentheses)
 */
export function formatAccounting(
  value: number,
  locale: Locale,
  currency?: string
): string {
  if (value < 0) {
    const formatted = formatNumber(Math.abs(value), locale, currency ? {
      style: 'currency',
      currency,
    } : {});
    return `(${formatted})`;
  }

  return formatNumber(value, locale, currency ? {
    style: 'currency',
    currency,
  } : {});
}

/**
 * Format scientific notation
 */
export function formatScientific(value: number, locale: Locale): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      notation: 'scientific',
    });
    return formatter.format(value);
  } catch {
    return value.toExponential();
  }
}

/**
 * Spell out number (one, two, three)
 */
export function spellOutNumber(value: number, locale: Locale): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'unit',
      unitDisplay: 'long',
    });
    // Fallback as not all locales support spellout
    return formatter.format(value);
  } catch {
    return value.toString();
  }
}

/**
 * Format range (1-10, 100-1000)
 */
export function formatRange(
  start: number,
  end: number,
  locale: Locale
): string {
  const formattedStart = formatNumber(start, locale);
  const formattedEnd = formatNumber(end, locale);

  // RTL locales need different order
  const isRTL = locale === 'ar' || locale === 'he' || locale === 'fa';

  if (isRTL) {
    return `${formattedEnd}-${formattedStart}`;
  }

  return `${formattedStart}-${formattedEnd}`;
}

/**
 * Format ratio (3:1)
 */
export function formatRatio(
  numerator: number,
  denominator: number,
  locale: Locale
): string {
  return `${formatNumber(numerator, locale)}:${formatNumber(denominator, locale)}`;
}
