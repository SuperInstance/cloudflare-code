/**
 * Advanced Caching Example
 *
 * Demonstrates advanced cache policies, rules,
 * and bypass strategies.
 */

import { CacheController } from '../src/cache/controller.js';

// Initialize cache controller
const cache = new CacheController({
  maxCacheSize: 10000,
  defaultTTL: 3600,
  enableHierarchy: true,
  hierarchyLevels: 3
});

// Register cache policies
cache.registerPolicy({
  name: 'static-assets',
  policy: 'public',
  ttl: 86400 * 7, // 1 week
  staleWhileRevalidate: 86400,
  level: 'both',
  tags: ['static', 'assets'],
  priority: 1
});

cache.registerPolicy({
  name: 'api-responses',
  policy: 'public',
  ttl: 60, // 1 minute
  staleWhileRevalidate: 30,
  mustRevalidate: true,
  level: 'edge',
  tags: ['api'],
  vary: ['Accept-Encoding', 'Authorization'],
  priority: 2
});

cache.registerPolicy({
  name: 'html-pages',
  policy: 'public',
  ttl: 3600, // 1 hour
  staleWhileRevalidate: 600,
  level: 'edge',
  tags: ['html'],
  vary: ['Accept-Encoding', 'Cookie'],
  priority: 3
});

// Register cache rules
cache.registerRule({
  id: 'static-images',
  pattern: '^/assets/images/.*\\.(jpg|jpeg|png|gif|webp)$',
  policy: cache['policies'].get('static-assets')!,
  enabled: true,
  priority: 10
});

cache.registerRule({
  id: 'api-endpoints',
  pattern: '^/api/',
  policy: cache['policies'].get('api-responses')!,
  conditions: [
    {
      field: 'method',
      operator: 'equals',
      value: 'GET'
    }
  ],
  enabled: true,
  priority: 9
});

cache.registerRule({
  id: 'html-pages',
  pattern: '^/.*\\.html$',
  policy: cache['policies'].get('html-pages')!,
  enabled: true,
  priority: 8
});

// Register bypass rules
cache.registerBypassRule({
  id: 'admin-routes',
  pattern: '^/admin/',
  reason: 'Admin routes bypass cache',
  enabled: true,
  priority: 10
});

cache.registerBypassRule({
  id: 'authenticated-requests',
  pattern: '^/api/secure/',
  reason: 'Authenticated requests bypass cache',
  enabled: true,
  priority: 9
});

// Example: Check if request should bypass cache
function checkBypass(url: string) {
  const context = {
    url,
    method: 'GET',
    headers: {
      'authorization': 'Bearer token123'
    }
  };

  const shouldBypass = cache.shouldBypass(context);

  if (shouldBypass) {
    console.log(`Request to ${url} bypasses cache`);
  } else {
    console.log(`Request to ${url} will be cached`);
  }

  return shouldBypass;
}

// Example: Get policy for request
function getPolicyForRequest(url: string) {
  const context = {
    url,
    method: 'GET',
    headers: {}
  };

  const policy = cache.getPolicyForRequest(context);

  if (policy) {
    console.log(`Policy for ${url}:`);
    console.log(`  Name: ${policy.name}`);
    console.log(`  TTL: ${policy.ttl}s`);
    console.log(`  Level: ${policy.level}`);
    console.log(`  Tags: ${policy.tags?.join(', ')}`);
  }

  return policy;
}

// Example: Generate cache key
function generateCacheKey(url: string, headers: Record<string, string>) {
  const policy = getPolicyForRequest(url);
  const key = cache.generateCacheKey(url, headers, policy?.vary);

  console.log(`Cache key for ${url}: ${key}`);
  return key;
}

// Example: Store and retrieve from cache
async function cacheOperations() {
  const url = 'https://example.com/api/users';
  const headers = {
    'accept-encoding': 'gzip',
    'authorization': 'Bearer token'
  };

  // Generate cache key
  const key = generateCacheKey(url, headers);

  // Create cache entry
  const entry = {
    url,
    status: 200,
    size: 1024,
    contentType: 'application/json',
    tags: ['api', 'users'],
    ttl: 60000,
    age: 0,
    lastAccessed: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    metadata: {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'max-age=60'
      }
    }
  };

  // Store in cache
  await cache.set(key, entry);
  console.log('Entry stored in cache');

  // Retrieve from cache
  const retrieved = await cache.get(key);
  if (retrieved) {
    console.log('Cache hit!');
    console.log(`  Status: ${retrieved.status}`);
    console.log(`  Size: ${retrieved.size} bytes`);
    console.log(`  Tags: ${retrieved.tags.join(', ')}`);
  } else {
    console.log('Cache miss');
  }
}

// Example: Delete by tag
async function deleteByTag() {
  const deleted = await cache.deleteByTag('api');
  console.log(`Deleted ${deleted} entries tagged with 'api'`);
}

// Example: Delete by pattern
async function deleteByPattern() {
  const deleted = await cache.deleteByPattern(/^https:\/\/example\.com\/api\/v1\/.*/);
  console.log(`Deleted ${deleted} entries matching pattern`);
}

// Example: Get cache statistics
function showCacheStats() {
  const stats = cache.getStats();

  console.log('Cache Statistics:');
  console.log(`  Hits: ${stats.hits}`);
  console.log(`  Misses: ${stats.misses}`);
  console.log(`  Hit Rate: ${stats.hitRate.toFixed(2)}%`);
  console.log(`  Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
  console.log(`  Bandwidth Saved: ${stats.savedBandwidth} bytes`);
  console.log(`  Total Bandwidth: ${stats.totalBandwidth} bytes`);
}

// Example: Health check
function checkHealth() {
  const health = cache.healthCheck();

  console.log('Cache Health:');
  console.log(`  Healthy: ${health.healthy}`);
  console.log(`  Levels: ${health.levels.length}`);

  for (const level of health.levels) {
    console.log(`    ${level.name}: ${level.size} entries, healthy: ${level.healthy}`);
  }
}

// Run examples
async function main() {
  try {
    // Check bypass rules
    checkBypass('https://example.com/admin/users');
    checkBypass('https://example.com/api/users');

    // Get policies
    getPolicyForRequest('https://example.com/assets/images/logo.png');
    getPolicyForRequest('https://example.com/api/users');
    getPolicyForRequest('https://example.com/page.html');

    // Cache operations
    await cacheOperations();

    // Delete operations
    await deleteByTag();
    await deleteByPattern();

    // Show statistics
    showCacheStats();

    // Health check
    checkHealth();

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
