/**
 * Hash utilities for translation caching and deduplication
 */

/**
 * Generate hash for translation key
 */
export function hashTranslation(
  key: string,
  locale?: string,
  namespace?: string
): string {
  const data = namespace ? `${namespace}:${key}` : key;
  if (locale) {
    return simpleHash(`${locale}:${data}`);
  }
  return simpleHash(data);
}

/**
 * Simple hash function (FNV-1a 32-bit)
 */
export function simpleHash(str: string): string {
  let hash = 2166136261;

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

/**
 * Generate hash for object
 */
export function hashObject(obj: unknown): string {
  return simpleHash(JSON.stringify(obj));
}

/**
 * Check if translation hash matches
 */
export function verifyHash(
  key: string,
  value: string,
  expectedHash: string
): boolean {
  const actualHash = simpleHash(`${key}:${value}`);
  return actualHash === expectedHash;
}

/**
 * Generate cache key
 */
export function generateCacheKey(
  locale: string,
  namespace: string,
  key: string
): string {
  return `${locale}:${namespace}:${key}`;
}

/**
 * Parse cache key
 */
export function parseCacheKey(
  cacheKey: string
): { locale: string; namespace: string; key: string } | null {
  const parts = cacheKey.split(':');

  if (parts.length >= 3) {
    return {
      locale: parts[0],
      namespace: parts[1],
      key: parts.slice(2).join(':'),
    };
  }

  return null;
}
