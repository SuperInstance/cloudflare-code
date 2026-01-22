/**
 * HTTP inspection example
 */

import { HTTPInspector } from '@claudeflare/observability';

async function main() {
  const inspector = new HTTPInspector({
    recordHeaders: true,
    recordBody: true,
    maxBodySize: 102400,
    maskSensitiveHeaders: ['authorization', 'cookie', 'set-cookie'],
  });

  console.log('Setting up HTTP inspection...');

  // Intercept fetch
  inspector.interceptFetch();

  // Make some HTTP requests
  await makeRequests();

  // Get all pairs
  const pairs = inspector.getPairs();
  console.log(`\nCaptured ${pairs.length} request/response pairs`);

  // Filter errors
  const errors = inspector.filterPairs({
    hasError: true,
  });
  console.log(`Found ${errors.length} error responses`);

  // Get statistics
  const stats = inspector.getStatistics();
  console.log('\nHTTP Statistics:');
  console.log(`  Total requests: ${stats.totalRequests}`);
  console.log(`  Average response time: ${stats.avgResponseTime.toFixed(2)}ms`);
  console.log(`  Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
  console.log('  Status distribution:', stats.statusDistribution);
  console.log('  Method distribution:', stats.methodDistribution);

  // Export as HAR
  const har = inspector.exportAsHAR();
  console.log(`\nExported HAR (${har.length} bytes)`);
}

async function makeRequests(): Promise<void> {
  // Make some example requests
  const requests = [
    'https://jsonplaceholder.typicode.com/posts/1',
    'https://jsonplaceholder.typicode.com/users/1',
    'https://jsonplaceholder.typicode.com/comments/1',
  ];

  for (const url of requests) {
    try {
      const response = await fetch(url);
      console.log(`Fetched ${url}: ${response.status}`);
      await response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
    }
  }

  // Make a request that will fail
  try {
    await fetch('https://invalid-domain-that-does-not-exist-12345.com');
  } catch {
    // Expected to fail
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
}

main().catch(console.error);
