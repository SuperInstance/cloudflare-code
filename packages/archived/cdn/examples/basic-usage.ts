/**
 * Basic CDN Usage Example
 *
 * Demonstrates basic CDN operations including caching,
 * invalidation, and optimization.
 */

import { CDN } from '../src/index.js';

// Initialize CDN with Cloudflare configuration
const cdn = new CDN({
  provider: 'cloudflare',
  apiKey: 'your-api-key',
  apiEmail: 'your-email@example.com',
  accountId: 'your-account-id',
  zoneId: 'your-zone-id',
  cachePolicies: [],
  cacheRules: [],
  analytics: true
});

// Handle incoming requests
async function handleRequest(url: string) {
  const context = {
    url,
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0',
      'accept-encoding': 'gzip'
    }
  };

  const response = await cdn.handleRequest(context);

  console.log(`Status: ${response.status}`);
  console.log(`From Cache: ${response.fromCache}`);
  console.log(`Response Time: ${response.responseTime}ms`);

  return response;
}

// Purge cache by URL
async function purgeURLs() {
  const result = await cdn.purge('url', [
    'https://example.com/api/users',
    'https://example.com/api/posts'
  ]);

  console.log(`Purged: ${result.purged} URLs`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Duration: ${result.duration}ms`);
}

// Purge cache by tag
async function purgeTags() {
  const result = await cdn.purge('tag', ['api', 'v1']);

  console.log(`Purged: ${result.purged} entries`);
}

// Optimize an image
async function optimizeImage(imageBuffer: Buffer) {
  const result = await cdn.optimizeAsset(imageBuffer, 'image', {
    quality: 85,
    format: 'webp',
    compress: true
  });

  console.log(`Original size: ${result.original.size} bytes`);
  console.log(`Optimized size: ${result.optimized.size} bytes`);
  console.log(`Savings: ${result.savings.percentage.toFixed(2)}%`);
}

// Deploy edge functions
async function deployFunctions() {
  const result = await cdn.deploy({
    version: '1.0.0',
    functions: [
      {
        name: 'auth-handler',
        content: `
          export default {
            async fetch(request) {
              // Handle authentication
              return new Response('Authenticated', { status: 200 });
            }
          };
        `,
        routes: ['/api/auth/*']
      }
    ],
    assets: [
      {
        path: '/styles/main.css',
        content: 'body { margin: 0; }',
        contentType: 'text/css'
      }
    ],
    routes: [
      {
        pattern: '/api/*',
        functionName: 'auth-handler',
        cachePolicy: 'api'
      }
    ]
  });

  console.log(`Deployment ID: ${result.deploymentId}`);
  console.log(`Status: ${result.status}`);
  console.log(`Duration: ${result.duration}ms`);
}

// Get analytics summary
function showAnalytics() {
  const summary = cdn.getSummary();

  console.log('CDN Analytics Summary:');
  console.log(`  Total Requests: ${summary.requests.total}`);
  console.log(`  Hit Rate: ${summary.requests.hitRate.toFixed(2)}%`);
  console.log(`  Bandwidth Saved: ${summary.bandwidth.saved} bytes`);
  console.log(`  Savings Rate: ${summary.bandwidth.savingsRate.toFixed(2)}%`);
}

// Warm up cache
async function warmCache() {
  const urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3'
  ];

  await cdn.warmCache(urls);
  console.log('Cache warmed up');
}

// Example usage
async function main() {
  try {
    // Handle a request
    await handleRequest('https://example.com/api/users');

    // Show analytics
    showAnalytics();

    // Purge cache
    await purgeURLs();

    // Deploy functions
    await deployFunctions();

    // Warm cache
    await warmCache();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    await cdn.destroy();
  }
}

main();
