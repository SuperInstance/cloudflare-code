/**
 * KV-based translation storage for ClaudeFlare i18n
 */

import type {
  TranslationStorage,
  TranslationNamespace,
  KVStorageOptions,
  Locale,
  TranslationEntry,
  TranslationCacheEntry,
} from '../types/index.js';
import { generateCacheKey, hashTranslation } from '../utils/hash.js';

/**
 * KV Translation Storage
 */
export class KVTranslationStorage implements TranslationStorage {
  private binding: KVNamespace;
  private prefix: string;
  private ttl: number;
  private cache: Map<string, TranslationNamespace>;

  constructor(options: KVStorageOptions) {
    this.binding = options.binding;
    this.prefix = options.prefix || 'i18n';
    this.ttl = options.ttl || 3600; // 1 hour default
    this.cache = new Map();
  }

  /**
   * Get translation namespace
   */
  async get(locale: Locale, namespace: string): Promise<TranslationNamespace | null> {
    const cacheKey = this.getStorageKey(locale, namespace);

    // Check memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from KV
    const data = await this.binding.get(cacheKey, 'json');
    if (!data) {
      return null;
    }

    const namespaceData = data as TranslationNamespace;

    // Cache in memory
    this.cache.set(cacheKey, namespaceData);

    return namespaceData;
  }

  /**
   * Set translation namespace
   */
  async set(namespace: TranslationNamespace): Promise<void> {
    const cacheKey = this.getStorageKey(namespace.locale, namespace.namespace);

    // Update memory cache
    this.cache.set(cacheKey, namespace);

    // Store in KV
    await this.binding.put(cacheKey, JSON.stringify(namespace), {
      expirationTtl: this.ttl,
    });
  }

  /**
   * Delete translation namespace
   */
  async delete(locale: Locale, namespace: string): Promise<void> {
    const cacheKey = this.getStorageKey(locale, namespace);

    // Remove from memory cache
    this.cache.delete(cacheKey);

    // Delete from KV
    await this.binding.delete(cacheKey);
  }

  /**
   * List all namespaces (optionally filtered by locale)
   */
  async list(locale?: Locale): Promise<TranslationNamespace[]> {
    const namespaces: TranslationNamespace[] = [];

    // KV list operation is limited, so we'll use a different approach
    // In production, you'd want to maintain a separate index
    const prefix = locale
      ? `${this.prefix}:${locale}:`
      : `${this.prefix}:`;

    // Note: This is a simplified implementation
    // In production, you'd want to use a proper index or iterate through known namespaces
    const list = await this.binding.list({ prefix });

    for (const key of list.keys) {
      const data = await this.binding.get(key.name, 'json');
      if (data) {
        const namespaceData = data as TranslationNamespace;
        if (!locale || namespaceData.locale === locale) {
          namespaces.push(namespaceData);
        }
      }
    }

    return namespaces;
  }

  /**
   * Check if namespace exists
   */
  async has(locale: Locale, namespace: string): Promise<boolean> {
    const cacheKey = this.getStorageKey(locale, namespace);

    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      return true;
    }

    // Check KV
    const data = await this.binding.get(cacheKey);
    return data !== null;
  }

  /**
   * Get a single translation entry
   */
  async getEntry(
    locale: Locale,
    namespace: string,
    key: string
  ): Promise<TranslationEntry | null> {
    const ns = await this.get(locale, namespace);
    return ns?.translations[key] || null;
  }

  /**
   * Set a single translation entry
   */
  async setEntry(
    locale: Locale,
    namespace: string,
    key: string,
    entry: TranslationEntry
  ): Promise<void> {
    let ns = await this.get(locale, namespace);

    if (!ns) {
      ns = {
        locale,
        namespace,
        translations: {},
        metadata: {
          version: '1.0.0',
          totalKeys: 0,
        },
      };
    }

    ns.translations[key] = entry;

    if (ns.metadata) {
      ns.metadata.totalKeys = Object.keys(ns.translations).length;
    }

    await this.set(ns);
  }

  /**
   * Delete a single translation entry
   */
  async deleteEntry(locale: Locale, namespace: string, key: string): Promise<void> {
    const ns = await this.get(locale, namespace);

    if (!ns) {
      return;
    }

    delete ns.translations[key];

    if (ns.metadata) {
      ns.metadata.totalKeys = Object.keys(ns.translations).length;
    }

    await this.set(ns);
  }

  /**
   * Bulk set entries
   */
  async setEntries(
    locale: Locale,
    namespace: string,
    entries: Record<string, TranslationEntry>
  ): Promise<void> {
    let ns = await this.get(locale, namespace);

    if (!ns) {
      ns = {
        locale,
        namespace,
        translations: {},
        metadata: {
          version: '1.0.0',
          totalKeys: 0,
        },
      };
    }

    Object.assign(ns.translations, entries);

    if (ns.metadata) {
      ns.metadata.totalKeys = Object.keys(ns.translations).length;
    }

    await this.set(ns);
  }

  /**
   * Get all keys for a namespace
   */
  async getKeys(locale: Locale, namespace: string): Promise<string[]> {
    const ns = await this.get(locale, namespace);
    return ns ? Object.keys(ns.translations) : [];
  }

  /**
   * Get missing keys (compared to fallback locale)
   */
  async getMissingKeys(
    locale: Locale,
    namespace: string,
    fallbackLocale: Locale
  ): Promise<string[]> {
    const ns = await this.get(locale, namespace);
    const fallbackNs = await this.get(fallbackLocale, namespace);

    if (!fallbackNs) {
      return [];
    }

    if (!ns) {
      return Object.keys(fallbackNs.translations);
    }

    return Object.keys(fallbackNs.translations).filter(
      (key) => !ns.translations[key]
    );
  }

  /**
   * Clear memory cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Prefetch namespaces
   */
  async prefetch(locale: Locale, namespaces: string[]): Promise<void> {
    const promises = namespaces.map((ns) => this.get(locale, ns));
    await Promise.all(promises);
  }

  /**
   * Get storage key
   */
  private getStorageKey(locale: Locale, namespace: string): string {
    return `${this.prefix}:${locale}:${namespace}`;
  }

  /**
   * Export all translations for a locale
   */
  async exportLocale(locale: Locale): Promise<Record<string, TranslationNamespace>> {
    const namespaces = await this.list(locale);
    const result: Record<string, TranslationNamespace> = {};

    for (const ns of namespaces) {
      result[ns.namespace] = ns;
    }

    return result;
  }

  /**
   * Import translations for a locale
   */
  async importLocale(
    locale: Locale,
    data: Record<string, TranslationNamespace>
  ): Promise<number> {
    let count = 0;

    for (const [namespace, nsData] of Object.entries(data)) {
      await this.set(nsData);
      count++;
    }

    return count;
  }

  /**
   * Get translation statistics
   */
  async getStatistics(locale: Locale): Promise<{
    totalNamespaces: number;
    totalKeys: number;
    estimatedSize: number;
  }> {
    const namespaces = await this.list(locale);
    let totalKeys = 0;
    let estimatedSize = 0;

    for (const ns of namespaces) {
      totalKeys += Object.keys(ns.translations).length;
      estimatedSize += JSON.stringify(ns).length;
    }

    return {
      totalNamespaces: namespaces.length,
      totalKeys,
      estimatedSize,
    };
  }

  /**
   * Backup all translations
   */
  async backup(): Promise<string> {
    const allNamespaces = await this.list();
    const backup = JSON.stringify(allNamespaces, null, 2);

    // Store backup
    const backupKey = `${this.prefix}:backup:${Date.now()}`;
    await this.binding.put(backupKey, backup);

    return backupKey;
  }

  /**
   * Restore translations from backup
   */
  async restore(backupKey: string): Promise<number> {
    const backup = await this.binding.get(backupKey);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const namespaces = JSON.parse(backup) as TranslationNamespace[];

    for (const ns of namespaces) {
      await this.set(ns);
    }

    return namespaces.length;
  }

  /**
   * Invalidate cache for a namespace
   */
  invalidateCache(locale: Locale, namespace: string): void {
    const cacheKey = this.getStorageKey(locale, namespace);
    this.cache.delete(cacheKey);
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Create a new KV translation storage instance
 */
export function createKVStorage(options: KVStorageOptions): KVTranslationStorage {
  return new KVTranslationStorage(options);
}
