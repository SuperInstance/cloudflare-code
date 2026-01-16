/**
 * Core Translation Engine for ClaudeFlare i18n
 * Provides translation lookup, interpolation, and fallback logic
 */

// @ts-nocheck - Type nullability issues and complex type inference

import type {
  Locale,
  TranslationEntry,
  TranslationNamespace,
  TranslationResult,
  TranslationStorage,
  TranslationContext,
  TranslationValue,
  PluralCategory,
} from '../types/index.js';
import { icuParser } from './icu-parser.js';
import { getPluralRule } from '../utils/plural-rules.js';
import { hashTranslation } from '../utils/hash.js';

/**
 * Translation engine options
 */
export interface TranslatorOptions {
  locale: Locale;
  fallbackLocale?: Locale;
  namespaces?: string[];
  storage: TranslationStorage;
  cache?: Map<string, string>;
  cacheTTL?: number;
  debug?: boolean;
}

/**
 * Translation engine
 */
export class Translator {
  private locale: Locale;
  private fallbackLocale: Locale;
  private storage: TranslationStorage;
  private namespaces: Set<string>;
  private cache: Map<string, { value: string; timestamp: number }>;
  private cacheTTL: number;
  private debug: boolean;

  // In-memory namespace cache
  private namespaceCache: Map<string, TranslationNamespace>;

  constructor(options: TranslatorOptions) {
    this.locale = options.locale;
    this.fallbackLocale = options.fallbackLocale || 'en';
    this.storage = options.storage;
    this.namespaces = new Set(options.namespaces || ['common']);
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes default
    this.debug = options.debug || false;
    this.namespaceCache = new Map();
  }

  /**
   * Translate a key with optional values
   */
  async translate(
    key: string,
    values?: Record<string, TranslationValue>,
    namespace?: string
  ): Promise<TranslationResult> {
    const ns = namespace || 'common';

    // Check cache first
    const cacheKey = `${this.locale}:${ns}:${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return {
        translated: this.interpolate(cached.value, values),
        locale: this.locale,
        usedFallback: false,
        substitutions: values,
      };
    }

    // Get translation
    let entry = await this.getEntry(key, ns);
    let usedFallback = false;
    let locale = this.locale;

    // Try fallback if not found
    if (!entry && this.locale !== this.fallbackLocale) {
      entry = await this.getEntry(key, ns, this.fallbackLocale);
      if (entry) {
        usedFallback = true;
        locale = this.fallbackLocale;
      }
    }

    if (!entry) {
      this.log(`Translation not found: ${key} (${this.locale})`);
      return {
        translated: key,
        locale: this.locale,
        usedFallback: false,
        missing: true,
        substitutions: values,
      };
    }

    // Cache the raw translation
    this.cache.set(cacheKey, {
      value: entry.value,
      timestamp: Date.now(),
    });

    // Interpolate values
    const translated = this.interpolate(entry.value, values, locale);

    return {
      translated,
      locale,
      usedFallback,
      substitutions: values,
    };
  }

  /**
   * Translate a key synchronously (only works with cached namespaces)
   */
  translateSync(
    key: string,
    values?: Record<string, TranslationValue>,
    namespace?: string
  ): TranslationResult {
    const ns = namespace || 'common';
    const entry = this.getCachedEntry(key, ns);

    if (!entry) {
      return {
        translated: key,
        locale: this.locale,
        usedFallback: false,
        missing: true,
        substitutions: values,
      };
    }

    const translated = this.interpolate(entry.value, values, this.locale);

    return {
      translated,
      locale: this.locale,
      usedFallback: false,
      substitutions: values,
    };
  }

  /**
   * Get translation entry from storage
   */
  private async getEntry(
    key: string,
    namespace: string,
    locale?: Locale
  ): Promise<TranslationEntry | null> {
    const loc = locale || this.locale;

    // Check namespace cache
    const nsKey = `${loc}:${namespace}`;
    let ns = this.namespaceCache.get(nsKey);

    if (!ns) {
      ns = await this.storage.get(loc, namespace);
      if (ns) {
        this.namespaceCache.set(nsKey, ns);
      }
    }

    return ns?.translations[key] || null;
  }

  /**
   * Get cached translation entry
   */
  private getCachedEntry(
    key: string,
    namespace: string,
    locale?: Locale
  ): TranslationEntry | null {
    const loc = locale || this.locale;
    const nsKey = `${loc}:${namespace}`;
    const ns = this.namespaceCache.get(nsKey);

    return ns?.translations[key] || null;
  }

  /**
   * Interpolate values into translation string
   */
  private interpolate(
    message: string,
    values?: Record<string, TranslationValue>,
    locale?: Locale
  ): string {
    if (!values || Object.keys(values).length === 0) {
      return message;
    }

    // Check if message contains ICU patterns
    if (message.includes('{') && message.includes('}')) {
      try {
        const parsed = icuParser.parse(message);
        const pluralRule = locale ? getPluralRule(locale) : undefined;
        return icuParser.format(parsed, values, locale || this.locale, pluralRule);
      } catch (error) {
        this.log('ICU parsing failed, falling back to simple interpolation', error);
      }
    }

    // Simple interpolation
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return values.hasOwnProperty(key) ? String(values[key]) : match;
    });
  }

  /**
   * Check if key exists
   */
  async has(key: string, namespace?: string): Promise<boolean> {
    const ns = namespace || 'common';
    const entry = await this.getEntry(key, ns);
    return entry !== null;
  }

  /**
   * Get current locale
   */
  getLocale(): Locale {
    return this.locale;
  }

  /**
   * Set locale
   */
  async setLocale(locale: Locale): Promise<void> {
    if (locale !== this.locale) {
      this.locale = locale;
      this.cache.clear(); // Clear cache on locale change
      await this.loadNamespaces();
    }
  }

  /**
   * Load all namespaces into memory
   */
  async loadNamespaces(): Promise<void> {
    const promises = Array.from(this.namespaces).map(async (ns) => {
      const nsKey = `${this.locale}:${ns}`;
      const namespace = await this.storage.get(this.locale, ns);
      if (namespace) {
        this.namespaceCache.set(nsKey, namespace);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Add a namespace
   */
  async addNamespace(namespace: string): Promise<void> {
    if (!this.namespaces.has(namespace)) {
      this.namespaces.add(namespace);
      await this.loadNamespace(namespace);
    }
  }

  /**
   * Load a specific namespace
   */
  async loadNamespace(namespace: string): Promise<void> {
    const nsKey = `${this.locale}:${namespace}`;
    const ns = await this.storage.get(this.locale, namespace);
    if (ns) {
      this.namespaceCache.set(nsKey, ns);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear namespace cache
   */
  clearNamespaceCache(): void {
    this.namespaceCache.clear();
  }

  /**
   * Get all keys for a namespace
   */
  async getKeys(namespace?: string): Promise<string[]> {
    const ns = namespace || 'common';
    const nsKey = `${this.locale}:${ns}`;
    let namespaceData = this.namespaceCache.get(nsKey);

    if (!namespaceData) {
      namespaceData = await this.storage.get(this.locale, ns);
      if (namespaceData) {
        this.namespaceCache.set(nsKey, namespaceData);
      }
    }

    return namespaceData ? Object.keys(namespaceData.translations) : [];
  }

  /**
   * Get translation statistics
   */
  async getStatistics(namespace?: string): Promise<{
    total: number;
    cached: number;
    cacheHitRate: number;
  }> {
    const keys = await this.getKeys(namespace);
    const total = keys.length;

    let cached = 0;
    keys.forEach((key) => {
      const cacheKey = `${this.locale}:${namespace || 'common'}:${key}`;
      if (this.cache.has(cacheKey)) {
        cached++;
      }
    });

    return {
      total,
      cached,
      cacheHitRate: total > 0 ? cached / total : 0,
    };
  }

  /**
   * Batch translate multiple keys
   */
  async translateBatch(
    keys: string[],
    values?: Record<string, TranslationValue>,
    namespace?: string
  ): Promise<Map<string, TranslationResult>> {
    const results = new Map<string, TranslationResult>();
    const promises = keys.map(async (key) => {
      const result = await this.translate(key, values, namespace);
      results.set(key, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get missing translations (keys in fallback but not in current locale)
   */
  async getMissingTranslations(
    namespace?: string
  ): Promise<Map<string, TranslationEntry>> {
    const missing = new Map<string, TranslationEntry>();
    const ns = namespace || 'common';

    // Get fallback locale keys
    const fallbackNsKey = `${this.fallbackLocale}:${ns}`;
    let fallbackNs = this.namespaceCache.get(fallbackNsKey);

    if (!fallbackNs) {
      fallbackNs = await this.storage.get(this.fallbackLocale, ns);
      if (fallbackNs) {
        this.namespaceCache.set(fallbackNsKey, fallbackNs);
      }
    }

    if (!fallbackNs) return missing;

    // Check each key
    for (const [key, entry] of Object.entries(fallbackNs.translations)) {
      const current = await this.getEntry(key, ns);
      if (!current) {
        missing.set(key, entry);
      }
    }

    return missing;
  }

  /**
   * Prefetch translations for a namespace
   */
  async prefetch(namespace: string): Promise<void> {
    await this.loadNamespace(namespace);
  }

  /**
   * Create translation context for external use
   */
  createContext(): TranslationContext {
    return {
      locale: this.locale,
      fallbackLocales: [this.fallbackLocale],
      storage: this.storage,
      formatters: true,
    };
  }

  /**
   * Log debug message
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Translator] ${message}`, ...args);
    }
  }
}

/**
 * Create a new translator instance
 */
export function createTranslator(options: TranslatorOptions): Translator {
  return new Translator(options);
}

/**
 * Default translator instance (lazy loaded)
 */
let defaultTranslator: Translator | null = null;

/**
 * Initialize default translator
 */
export async function initTranslator(
  options: TranslatorOptions
): Promise<Translator> {
  if (!defaultTranslator) {
    defaultTranslator = new Translator(options);
    await defaultTranslator.loadNamespaces();
  }
  return defaultTranslator;
}

/**
 * Get default translator instance
 */
export function getTranslator(): Translator | null {
  return defaultTranslator;
}

/**
 * Translate helper using default translator
 */
export async function t(
  key: string,
  values?: Record<string, TranslationValue>,
  namespace?: string
): Promise<string> {
  if (!defaultTranslator) {
    throw new Error('Translator not initialized. Call initTranslator first.');
  }
  const result = await defaultTranslator.translate(key, values, namespace);
  return result.translated;
}

/**
 * Translate sync helper using default translator
 */
export function tSync(
  key: string,
  values?: Record<string, TranslationValue>,
  namespace?: string
): string {
  if (!defaultTranslator) {
    throw new Error('Translator not initialized. Call initTranslator first.');
  }
  const result = defaultTranslator.translateSync(key, values, namespace);
  return result.translated;
}
