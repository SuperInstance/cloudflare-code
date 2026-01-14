/**
 * Locale Detection and Negotiation for ClaudeFlare i18n
 * Handles detection from HTTP headers, cookies, query params, and storage
 */

import type {
  Locale,
  LocaleComponents,
  LocaleDetectionOptions,
  LocaleDetectionResult,
  LocaleNegotiationResult,
} from '../types/index.js';

/**
 * Parse locale into components
 */
export function parseLocale(locale: string): LocaleComponents | null {
  const parts = locale.replace(/_/g, '-').split('-');

  if (parts.length === 0) return null;

  const result: LocaleComponents = {
    language: parts[0].toLowerCase(),
  };

  // Script (title case, 4 letters)
  if (parts.length > 1 && parts[1].length === 4) {
    result.script =
      parts[1][0].toUpperCase() + parts[1].slice(1).toLowerCase();
    parts.splice(1, 1);
  }

  // Region (uppercase, 2-3 letters or 3 digits)
  if (parts.length > 1) {
    const region = parts[1];
    if (
      (region.length === 2 && /^[A-Z]{2}$/.test(region)) ||
      (region.length === 3 && /^\d{3}$/.test(region))
    ) {
      result.region = region.toUpperCase();
      parts.splice(1, 1);
    }
  }

  // Variant (lowercase)
  if (parts.length > 1) {
    result.variant = parts.slice(1).join('-').toLowerCase();
  }

  return result;
}

/**
 * Format locale components to string
 */
export function formatLocale(components: LocaleComponents): Locale {
  let locale = components.language;

  if (components.script) {
    locale += `-${components.script}`;
  }

  if (components.region) {
    locale += `-${components.region}`;
  }

  if (components.variant) {
    locale += `-${components.variant}`;
  }

  return locale;
}

/**
 * Normalize locale string
 */
export function normalizeLocale(locale: string): Locale {
  const parsed = parseLocale(locale);
  return parsed ? formatLocale(parsed) : locale;
}

/**
 * Get parent locale (e.g., en-US -> en)
 */
export function getParentLocale(locale: Locale): Locale | null {
  const parts = locale.split('-');
  if (parts.length <= 1) return null;
  return parts[0];
}

/**
 * Check if locale is supported
 */
export function isSupportedLocale(
  locale: Locale,
  supported: Locale[]
): boolean {
  const normalized = normalizeLocale(locale);
  return (
    supported.includes(normalized) ||
    supported.some((s) => normalizeLocale(s) === normalized)
  );
}

/**
 * Find closest supported locale
 */
export function findClosestLocale(
  locale: Locale,
  supported: Locale[]
): Locale | null {
  const normalized = normalizeLocale(locale);

  // Exact match
  if (supported.includes(normalized)) {
    return normalized;
  }

  // Try parent locale
  const parent = getParentLocale(normalized);
  if (parent && supported.includes(parent)) {
    return parent;
  }

  // Try matching just language
  const language = normalized.split('-')[0];
  const languageMatch = supported.find((s) => s.split('-')[0] === language);
  if (languageMatch) {
    return languageMatch;
  }

  return null;
}

/**
 * Parse Accept-Language header
 */
export interface AcceptLanguage {
  locale: Locale;
  quality: number;
}

export function parseAcceptLanguage(header: string): AcceptLanguage[] {
  if (!header) return [];

  return header
    .split(',')
    .map((part) => {
      const [locale, q] = part.trim().split(';q=');
      return {
        locale: normalizeLocale(locale),
        quality: q ? parseFloat(q) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Detect locale from request
 */
export function detectLocale(
  request: Request,
  options: LocaleDetectionOptions
): LocaleDetectionResult {
  const {
    fallbackLocale = 'en',
    supportedLocales,
    cookieName = 'locale',
    queryParam = 'lang',
    headerName = 'accept-language',
    storageKey = 'locale',
  } = options;

  // 1. Check query parameter (highest priority)
  const url = new URL(request.url);
  const queryLocale = url.searchParams.get(queryParam);
  if (queryLocale && isSupportedLocale(queryLocale, supportedLocales)) {
    return {
      locale: normalizeLocale(queryLocale),
      quality: 1.0,
      source: 'query',
    };
  }

  // 2. Check cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const localeCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
    if (localeCookie) {
      const cookieValue = localeCookie.split('=')[1];
      if (cookieValue && isSupportedLocale(cookieValue, supportedLocales)) {
        return {
          locale: normalizeLocale(cookieValue),
          quality: 0.9,
          source: 'cookie',
        };
      }
    }
  }

  // 3. Check Accept-Language header
  const acceptLanguage = request.headers.get(headerName);
  if (acceptLanguage) {
    const parsed = parseAcceptLanguage(acceptLanguage);
    for (const { locale, quality } of parsed) {
      if (isSupportedLocale(locale, supportedLocales)) {
        return {
          locale,
          quality,
          source: 'header',
        };
      }
    }
  }

  // 4. Use fallback
  return {
    locale: fallbackLocale,
    quality: 0.0,
    source: 'default',
  };
}

/**
 * Negotiate best locale based on preferences
 */
export function negotiateLocale(
  preferredLocales: Locale[],
  supportedLocales: Locale[],
  fallbackLocale = 'en'
): LocaleNegotiationResult {
  const fallbackChain: Locale[] = [];
  let reason = '';

  // Try exact matches
  for (const preferred of preferredLocales) {
    const normalized = normalizeLocale(preferred);

    if (supportedLocales.includes(normalized)) {
      return {
        locale: normalized,
        matched: true,
        fallbackChain,
        reason: 'Exact match found',
      };
    }

    // Build fallback chain
    fallbackChain.push(normalized);
  }

  // Try parent locales
  for (const preferred of preferredLocales) {
    const parent = getParentLocale(preferred);
    if (parent && supportedLocales.includes(parent)) {
      return {
        locale: parent,
        matched: true,
        fallbackChain,
        reason: 'Parent locale matched',
      };
    }
  }

  // Try language match
  for (const preferred of preferredLocales) {
    const language = preferred.split('-')[0];
    const languageMatch = supportedLocales.find(
      (s) => s.split('-')[0] === language
    );
    if (languageMatch) {
      return {
        locale: languageMatch,
        matched: true,
        fallbackChain,
        reason: 'Language match found',
      };
    }
  }

  // Use fallback
  reason = 'No match found, using fallback';
  if (!supportedLocales.includes(fallbackLocale)) {
    fallbackLocale = supportedLocales[0] || 'en';
  }

  return {
    locale: fallbackLocale,
    matched: false,
    fallbackChain,
    reason,
  };
}

/**
 * Get browser locales from navigator
 */
export function getBrowserLocales(): Locale[] {
  if (typeof navigator === 'undefined' || !navigator.languages) {
    return ['en'];
  }

  return navigator.languages.map(normalizeLocale);
}

/**
 * Get timezone from browser
 */
export function getTimezone(): string {
  if (typeof Intl === 'undefined') {
    return 'UTC';
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Get locale from URL path
 */
export function getLocaleFromPath(
  path: string,
  supportedLocales: Locale[]
): Locale | null {
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const firstSegment = segments[0];
  if (isSupportedLocale(firstSegment, supportedLocales)) {
    return normalizeLocale(firstSegment);
  }

  return null;
}

/**
 * Remove locale from URL path
 */
export function removeLocaleFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return '/';

  // Check if first segment looks like a locale
  const localeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
  if (localeRegex.test(segments[0])) {
    segments.shift();
  }

  return '/' + segments.join('/');
}

/**
 * Add locale to URL path
 */
export function addLocaleToPath(path: string, locale: Locale): string {
  const cleanedPath = removeLocaleFromPath(path);
  return `/${locale}${cleanedPath}`;
}

/**
 * Get locale direction (LTR or RTL)
 */
export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  const rtlLocales = [
    'ar', // Arabic
    'he', // Hebrew
    'fa', // Persian
    'ur', // Urdu
    'yi', // Yiddish
    'ckb', // Central Kurdish
    'sd', // Sindhi
    'dv', // Divehi
  ];

  const language = locale.split('-')[0];
  return rtlLocales.includes(language) ? 'rtl' : 'ltr';
}

/**
 * Check if locale is RTL
 */
export function isRTLLocale(locale: Locale): boolean {
  return getLocaleDirection(locale) === 'rtl';
}

/**
 * Get available locales with metadata
 */
export interface LocaleMetadata {
  code: Locale;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export function getAvailableLocales(): LocaleMetadata[] {
  return [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' },
    {
      code: 'zh-Hans',
      name: 'Chinese (Simplified)',
      nativeName: '简体中文',
      direction: 'ltr',
    },
    {
      code: 'zh-Hant',
      name: 'Chinese (Traditional)',
      nativeName: '繁體中文',
      direction: 'ltr',
    },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr' },
    {
      code: 'id',
      name: 'Indonesian',
      nativeName: 'Bahasa Indonesia',
      direction: 'ltr',
    },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl' },
    {
      code: 'fa',
      name: 'Persian',
      nativeName: 'فارسی',
      direction: 'rtl',
    },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', direction: 'ltr' },
    {
      code: 'sv',
      name: 'Swedish',
      nativeName: 'Svenska',
      direction: 'ltr',
    },
    {
      code: 'uk',
      name: 'Ukrainian',
      nativeName: 'Українська',
      direction: 'ltr',
    },
  ];
}

/**
 * Validate locale format
 */
export function isValidLocale(locale: string): boolean {
  // BCP 47 language tag pattern
  const bcp47Regex =
    /^([A-Za-z]{2,3}(?:-[A-Za-z]{3})?(?:-[A-Za-z]{4})?|(?:[A-Za-z]{4})(?:-[A-Za-z]{4})?)(?:-[A-Za-z]{2}|\d{3})?(?:-[A-Za-z0-9]{5,8})*$/;

  return bcp47Regex.test(locale);
}

/**
 * Get locale flag emoji (for UI display)
 */
export function getLocaleFlag(locale: Locale): string {
  const flagMap: Record<string, string> = {
    en: '🇬🇧',
    'en-US': '🇺🇸',
    'en-GB': '🇬🇧',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    pt: '🇵🇹',
    'pt-BR': '🇧🇷',
    it: '🇮🇹',
    nl: '🇳🇱',
    zh: '🇨🇳',
    'zh-Hans': '🇨🇳',
    'zh-Hant': '🇹🇼',
    ja: '🇯🇵',
    ko: '🇰🇷',
    vi: '🇻🇳',
    th: '🇹🇭',
    id: '🇮🇩',
    ar: '🇸🇦',
    he: '🇮🇱',
    fa: '🇮🇷',
    tr: '🇹🇷',
    ru: '🇷🇺',
    pl: '🇵🇱',
    cs: '🇨🇿',
    sv: '🇸🇪',
    uk: '🇺🇦',
  };

  return flagMap[locale] || flagMap[locale.split('-')[0]] || '🌐';
}
