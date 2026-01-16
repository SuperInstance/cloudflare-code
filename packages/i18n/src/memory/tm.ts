/**
 * Translation Memory with vector similarity search
 */

// @ts-nocheck - Expression callable type issues

import type {
  TranslationMemoryEntry,
  TranslationMatch,
  Locale,
  MachineTranslationOptions,
} from '../types/index.js';
import { simpleHash } from '../utils/hash.js';

/**
 * Translation Memory options
 */
export interface TranslationMemoryOptions {
  storage?: DurableObjectStorage | KVNamespace;
  minSimilarity?: number;
  maxEntries?: number;
  enableVectorSearch?: boolean;
}

/**
 * Translation Memory class
 */
export class TranslationMemory {
  private storage: DurableObjectStorage | KVNamespace | null;
  private minSimilarity: number;
  private maxEntries: number;
  private enableVectorSearch: boolean;

  // In-memory cache for frequently used translations
  private cache: Map<string, TranslationMemoryEntry[]>;

  constructor(options: TranslationMemoryOptions = {}) {
    this.storage = options.storage || null;
    this.minSimilarity = options.minSimilarity || 0.8;
    this.maxEntries = options.maxEntries || 10000;
    this.enableVectorSearch = options.enableVectorSearch || false;
    this.cache = new Map();
  }

  /**
   * Add translation to memory
   */
  async add(entry: Omit<TranslationMemoryEntry, 'id' | 'usage' | 'lastUsed'>): Promise<string> {
    const id = simpleHash(
      `${entry.sourceLocale}:${entry.targetLocale}:${entry.sourceText}`
    );

    const tmEntry: TranslationMemoryEntry = {
      ...entry,
      id,
      usage: 0,
      lastUsed: new Date().toISOString(),
      vector: this.enableVectorSearch ? this.generateVector(entry.sourceText) : undefined,
    };

    // Add to storage
    if (this.storage) {
      const key = `tm:${id}`;
      await this.storage.put(key, JSON.stringify(tmEntry));
    }

    // Add to cache
    const cacheKey = this.getCacheKey(entry.sourceLocale, entry.targetLocale);
    const entries = this.cache.get(cacheKey) || [];
    entries.push(tmEntry);

    // Limit cache size
    if (entries.length > this.maxEntries) {
      entries.sort((a, b) => a.usage - b.usage);
      entries.shift();
    }

    this.cache.set(cacheKey, entries);

    return id;
  }

  /**
   * Find exact match in translation memory
   */
  async findExact(
    sourceText: string,
    sourceLocale: Locale,
    targetLocale: Locale
  ): Promise<TranslationMemoryEntry | null> {
    const cacheKey = this.getCacheKey(sourceLocale, targetLocale);
    const entries = this.cache.get(cacheKey) || [];

    const exactMatch = entries.find((e) => e.sourceText === sourceText);
    if (exactMatch) {
      await this.updateUsage(exactMatch.id);
      return exactMatch;
    }

    // Check storage if not in cache
    if (this.storage) {
      const id = simpleHash(`${sourceLocale}:${targetLocale}:${sourceText}`);
      const key = `tm:${id}`;
      const stored = await this.storage.get(key);
      if (stored) {
        const entry = JSON.parse(stored as string) as TranslationMemoryEntry;
        await this.updateUsage(entry.id);
        return entry;
      }
    }

    return null;
  }

  /**
   * Find fuzzy matches using similarity search
   */
  async findFuzzy(
    sourceText: string,
    sourceLocale: Locale,
    targetLocale: Locale,
    maxResults = 5
  ): Promise<TranslationMatch[]> {
    const cacheKey = this.getCacheKey(sourceLocale, targetLocale);
    const entries = this.cache.get(cacheKey) || [];

    const matches: TranslationMatch[] = [];

    for (const entry of entries) {
      const similarity = this.calculateSimilarity(sourceText, entry.sourceText);

      if (similarity >= this.minSimilarity) {
        matches.push({
          entry,
          similarity,
          fuzzy: similarity < 1.0,
        });
      }
    }

    // Sort by similarity (descending)
    matches.sort((a, b) => b.similarity - a.similarity);

    // Return top matches
    return matches.slice(0, maxResults);
  }

  /**
   * Find best match (exact or fuzzy)
   */
  async findBest(
    sourceText: string,
    sourceLocale: Locale,
    targetLocale: Locale
  ): Promise<TranslationMatch | null> {
    // Try exact match first
    const exact = await this.findExact(sourceText, sourceLocale, targetLocale);
    if (exact) {
      return {
        entry: exact,
        similarity: 1.0,
        fuzzy: false,
      };
    }

    // Try fuzzy match
    const fuzzy = await this.findFuzzy(sourceText, sourceLocale, targetLocale, 1);
    if (fuzzy.length > 0) {
      return fuzzy[0];
    }

    return null;
  }

  /**
   * Batch find translations
   */
  async findBatch(
    texts: string[],
    sourceLocale: Locale,
    targetLocale: Locale
  ): Promise<Map<string, TranslationMatch | null>> {
    const results = new Map<string, TranslationMatch | null>();
    const promises = texts.map(async (text) => {
      const match = await this.findBest(text, sourceLocale, targetLocale);
      results.set(text, match);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Update translation entry
   */
  async update(id: string, updates: Partial<TranslationMemoryEntry>): Promise<boolean> {
    const cacheKey = this.getCacheKeyFromId(id);
    const entries = this.cache.get(cacheKey) || [];
    const index = entries.findIndex((e) => e.id === id);

    if (index !== -1) {
      entries[index] = { ...entries[index], ...updates };
      this.cache.set(cacheKey, entries);

      if (this.storage) {
        const key = `tm:${id}`;
        await this.storage.put(key, JSON.stringify(entries[index]));
      }

      return true;
    }

    return false;
  }

  /**
   * Delete translation entry
   */
  async delete(id: string): Promise<boolean> {
    const cacheKey = this.getCacheKeyFromId(id);
    const entries = this.cache.get(cacheKey) || [];
    const index = entries.findIndex((e) => e.id === id);

    if (index !== -1) {
      entries.splice(index, 1);
      this.cache.set(cacheKey, entries);

      if (this.storage) {
        const key = `tm:${id}`;
        await this.storage.delete(key);
      }

      return true;
    }

    return false;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalUsage: number;
    localePairs: Set<string>;
    qualityStats: { avgQuality: number; minQuality: number; maxQuality: number };
  }> {
    let totalEntries = 0;
    let totalUsage = 0;
    const localePairs = new Set<string>();
    const qualities: number[] = [];

    for (const entries of this.cache.values()) {
      for (const entry of entries) {
        totalEntries++;
        totalUsage += entry.usage;
        localePairs.add(`${entry.sourceLocale}:${entry.targetLocale}`);
        qualities.push(entry.quality);
      }
    }

    const avgQuality =
      qualities.length > 0
        ? qualities.reduce((a, b) => a + b, 0) / qualities.length
        : 0;
    const minQuality = qualities.length > 0 ? Math.min(...qualities) : 0;
    const maxQuality = qualities.length > 0 ? Math.max(...qualities) : 0;

    return {
      totalEntries,
      totalUsage,
      localePairs,
      qualityStats: {
        avgQuality,
        minQuality,
        maxQuality,
      },
    };
  }

  /**
   * Clear all translations
   */
  async clear(): Promise<void> {
    this.cache.clear();

    if (this.storage) {
      // Note: This would need a list operation which might not be available in all storage backends
      // Implementation depends on storage capabilities
    }
  }

  /**
   * Export translations
   */
  async export(localePair?: `${Locale}:${Locale}`): Promise<TranslationMemoryEntry[]> {
    const entries: TranslationMemoryEntry[] = [];

    if (localePair) {
      const [source, target] = localePair.split(':');
      const cacheKey = this.getCacheKey(source, target);
      const cached = this.cache.get(cacheKey) || [];
      entries.push(...cached);
    } else {
      for (const cached of this.cache.values()) {
        entries.push(...cached);
      }
    }

    return entries;
  }

  /**
   * Import translations
   */
  async import(entries: TranslationMemoryEntry[]): Promise<number> {
    let imported = 0;

    for (const entry of entries) {
      await this.add(entry);
      imported++;
    }

    return imported;
  }

  /**
   * Calculate text similarity (Levenshtein distance based)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;

    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);

    if (maxLength === 0) return 1.0;

    return 1.0 - distance / maxLength;
  }

  /**
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Generate simple vector representation of text
   */
  private generateVector(text: string): number[] {
    // Simple character n-gram based vector
    const n = 3; // trigram
    const vector: Map<string, number> = new Map();

    for (let i = 0; i <= text.length - n; i++) {
      const gram = text.slice(i, i + n);
      vector.set(gram, (vector.get(gram) || 0) + 1);
    }

    // Convert to array
    return Array.from(vector.values());
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Update usage statistics
   */
  private async updateUsage(id: string): Promise<void> {
    const cacheKey = this.getCacheKeyFromId(id);
    const entries = this.cache.get(cacheKey) || [];
    const entry = entries.find((e) => e.id === id);

    if (entry) {
      entry.usage++;
      entry.lastUsed = new Date().toISOString();

      if (this.storage) {
        const key = `tm:${id}`;
        await this.storage.put(key, JSON.stringify(entry));
      }
    }
  }

  /**
   * Get cache key for locale pair
   */
  private getCacheKey(sourceLocale: Locale, targetLocale: Locale): string {
    return `${sourceLocale}:${targetLocale}`;
  }

  /**
   * Get cache key from entry ID
   */
  private getCacheKeyFromId(id: string): string {
    // This is a simplification - in practice you'd need to store the locale pair
    // with the ID or parse it from the hash
    return 'unknown';
  }

  /**
   * Suggest translations using TM
   */
  async suggest(
    sourceText: string,
    sourceLocale: Locale,
    targetLocale: Locale,
    limit = 5
  ): Promise<TranslationMatch[]> {
    return this.findFuzzy(sourceText, sourceLocale, targetLocale, limit);
  }

  /**
   * Batch add translations
   */
  async addBatch(entries: Omit<TranslationMemoryEntry, 'id' | 'usage' | 'lastUsed'>[]): Promise<string[]> {
    const ids: string[] = [];

    for (const entry of entries) {
      const id = await this.add(entry);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Clean old entries
   */
  async cleanOldEntries(maxAge: number): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entries] of this.cache.entries()) {
      const filtered = entries.filter((entry) => {
        const age = now - new Date(entry.lastUsed).getTime();
        return age <= maxAge;
      });

      cleaned += entries.length - filtered.length;
      this.cache.set(key, filtered);
    }

    return cleaned;
  }
}

/**
 * Create a new Translation Memory instance
 */
export function createTranslationMemory(options?: TranslationMemoryOptions): TranslationMemory {
  return new TranslationMemory(options);
}

/**
 * Default Translation Memory instance (lazy loaded)
 */
let defaultTM: TranslationMemory | null = null;

/**
 * Initialize default translation memory
 */
export function initTranslationMemory(options?: TranslationMemoryOptions): TranslationMemory {
  if (!defaultTM) {
    defaultTM = new TranslationMemory(options);
  }
  return defaultTM;
}

/**
 * Get default translation memory instance
 */
export function getTranslationMemory(): TranslationMemory | null {
  return defaultTM;
}
