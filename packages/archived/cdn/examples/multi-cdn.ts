/**
 * Multi-CDN Example
 *
 * Demonstrates multi-CDN routing with failover
 * and load balancing.
 */

import { MultiCDNProvider, CDNLoadBalancer } from '../src/multi-cdn/index.js';
import type { CDNProvider } from '../src/types/index.js';

// Initialize multi-CDN provider
const multiCDN = new MultiCDNProvider({
  primary: 'cloudflare',
  fallback: ['aws_cloudfront', 'fastly'],
  strategy: 'performance',
  weights: new Map<CDNProvider, number>([
    ['cloudflare', 100],
    ['aws_cloudfront', 50],
    ['fastly', 30]
  ]),
  healthCheck: {
    interval: 60000,
    timeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    path: 'https://example.com/health',
    expectedStatus: 200
  },
  failoverThreshold: 3
});

// Initialize load balancer
const loadBalancer = new CDNLoadBalancer({
  strategy: 'weighted',
  sessionAffinity: true,
  weights: new Map<CDNProvider, number>([
    ['cloudflare', 100],
    ['aws_cloudfront', 50],
    ['fastly', 30]
  ])
});

// Route request to best provider
async function routeRequest(url: string) {
  const context = {
    url,
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0',
      'cf-connecting-ip': '1.2.3.4'
    },
    ip: '1.2.3.4',
    country: 'US'
  };

  try {
    const response = await multiCDN.route(context);

    console.log(`Request routed to: ${response.provider}`);
    console.log(`Status: ${response.status}`);
    console.log(`From Cache: ${response.fromCache}`);
    console.log(`Response Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {
    console.error('Route failed:', error);
    throw error;
  }
}

// Get provider statistics
function showProviderStats() {
  const stats = multiCDN.getStatistics();

  console.log('Multi-CDN Statistics:');
  console.log(`  Total Providers: ${stats.totalProviders}`);
  console.log(`  Healthy Providers: ${stats.healthyProviders}`);
  console.log(`  Unhealthy Providers: ${stats.unhealthyProviders}`);
  console.log(`  Primary Provider: ${stats.primaryProvider}`);
  console.log(`  Strategy: ${stats.strategy}`);
}

// Get all provider statuses
function showProviderStatuses() {
  const statuses = multiCDN.getAllProviderStatuses();

  console.log('Provider Statuses:');

  for (const status of statuses) {
    console.log(`  ${status.provider}:`);
    console.log(`    Healthy: ${status.healthy}`);
    console.log(`    Response Time: ${status.responseTime}ms`);
    console.log(`    Last Check: ${status.lastCheck.toISOString()}`);
    console.log(`    Consecutive Failures: ${status.consecutiveFailures}`);
  }
}

// Get healthy providers
function showHealthyProviders() {
  const healthy = multiCDN.getHealthyProviders();

  console.log(`Healthy Providers: ${healthy.join(', ')}`);
}

// Enable/disable providers
function manageProviders() {
  // Disable a provider
  multiCDN.disableProvider('fastly');
  console.log('Fastly disabled');

  // Re-enable provider
  multiCDN.enableProvider('fastly');
  console.log('Fastly re-enabled');
}

// Load balancing example
function loadBalanceRequests(requests: Array<{ url: string }>) {
  console.log('Load Balancing Requests:');

  for (const request of requests) {
    const context = {
      url: request.url,
      method: 'GET',
      headers: {}
    };

    const provider = loadBalancer.select(context);

    console.log(`  ${request.url} -> ${provider}`);

    // Release connection after processing
    loadBalancer.release(provider);
  }
}

// Get load balancer statistics
function showLoadBalancerStats() {
  const stats = loadBalancer.getStatistics();

  console.log('Load Balancer Statistics:');
  console.log(`  Total Requests: ${stats.totalRequests}`);
  console.log(`  Active Connections: ${stats.activeConnections}`);

  console.log('\nProvider Distribution:');

  for (const provider of stats.providers) {
    console.log(`  ${provider.provider}:`);
    console.log(`    Active Connections: ${provider.activeConnections}`);
    console.log(`    Total Requests: ${provider.totalRequests}`);
    console.log(`    Load Percentage: ${provider.loadPercentage.toFixed(2)}%`);
  }
}

// Update load balancer weights
function updateWeights() {
  const newWeights = new Map<CDNProvider, number>([
    ['cloudflare', 80],
    ['aws_cloudfront', 60],
    ['fastly', 40]
  ]);

  loadBalancer.updateWeights(newWeights);
  console.log('Weights updated');
}

// Update load balancer strategy
function updateStrategy() {
  loadBalancer.updateStrategy('least_connections');
  console.log('Strategy updated to least_connections');
}

// Example: Failover scenario
async function simulateFailover() {
  console.log('Simulating Failover:');

  // Make requests (will failover if primary fails)
  const urls = [
    'https://example.com/api/users',
    'https://example.com/api/posts',
    'https://example.com/api/comments'
  ];

  for (const url of urls) {
    try {
      await routeRequest(url);
    } catch (error) {
      console.error(`Request to ${url} failed after all failovers`);
    }
  }
}

// Event handling
function setupEventListeners() {
  multiCDN.on('provider_healthy', (provider) => {
    console.log(`Provider ${provider} is now healthy`);
  });

  multiCDN.on('provider_unhealthy', (provider) => {
    console.log(`Provider ${provider} is now unhealthy`);
  });

  multiCDN.on('failover', ({ from, to }) => {
    console.log(`Failover from ${from} to ${to}`);
  });

  multiCDN.on('provider_enabled', (provider) => {
    console.log(`Provider ${provider} enabled`);
  });

  multiCDN.on('provider_disabled', (provider) => {
    console.log(`Provider ${provider} disabled`);
  });
}

// Run examples
async function main() {
  try {
    // Setup event listeners
    setupEventListeners();

    // Route requests
    await routeRequest('https://example.com/api/users');

    // Show statistics
    showProviderStats();
    showProviderStatuses();
    showHealthyProviders();

    // Manage providers
    manageProviders();

    // Load balance
    loadBalanceRequests([
      { url: 'https://example.com/page1' },
      { url: 'https://example.com/page2' },
      { url: 'https://example.com/page3' }
    ]);

    showLoadBalancerStats();

    // Update configuration
    updateWeights();
    updateStrategy();

    // Simulate failover
    await simulateFailover();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    multiCDN.destroy();
    loadBalancer.destroy();
  }
}

main();
