#!/usr/bin/env tsx

/**
 * Deployment Verification Script
 * Verifies v1.0 deployment is healthy and functional
 */

import { program } from 'commander';
import fetch from 'node-fetch';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message: string;
  details?: any;
}

class DeploymentVerifier {
  private results: VerificationResult[] = [];
  private baseUrl: string;

  constructor(environment: string) {
    const urls = {
      development: 'https://dev.claudeflare.workers.dev',
      staging: 'https://staging.claudeflare.workers.dev',
      production: 'https://claudeflare.workers.dev',
    };
    this.baseUrl = urls[environment as keyof typeof urls] || urls.development;
  }

  async verify(name: string, test: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await test();
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'pass',
        duration,
        message: 'OK',
      });
      console.log(`✓ ${name} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'fail',
        duration,
        message: error.message,
        details: error,
      });
      console.log(`✗ ${name} (${duration}ms) - ${error.message}`);
    }
  }

  async verifyHealthEndpoint(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'healthy') {
      throw new Error(`System status: ${data.status}`);
    }

    // Check all services
    for (const [service, status] of Object.entries(data.services)) {
      if (status !== 'operational') {
        throw new Error(`Service ${service} status: ${status}`);
      }
    }
  }

  async verifyVersionEndpoint(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/version`);
    if (!response.ok) {
      throw new Error(`Version check failed: ${response.status}`);
    }
    const data = await response.json();

    // Verify v1.0 version
    if (!data.version.match(/^1\.0\.\d+$/)) {
      throw new Error(`Invalid version: ${data.version}`);
    }
  }

  async verifyMetricsEndpoint(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/metrics`);
    if (!response.ok) {
      throw new Error(`Metrics check failed: ${response.status}`);
    }
    const data = await response.json();

    // Verify critical metrics exist
    const requiredMetrics = ['requests', 'errors', 'latency', 'cacheHitRate'];
    for (const metric of requiredMetrics) {
      if (!(metric in data)) {
        throw new Error(`Missing metric: ${metric}`);
      }
    }

    // Verify error rate is acceptable
    if (data.errorRate > 1) {
      throw new Error(`High error rate: ${data.errorRate}%`);
    }
  }

  async verifyDatabaseConnectivity(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/health/database`);
    if (!response.ok) {
      throw new Error(`Database health check failed: ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'connected') {
      throw new Error(`Database not connected: ${data.status}`);
    }

    if (data.latency > 100) {
      throw new Error(`High database latency: ${data.latency}ms`);
    }
  }

  async verifyCacheConnectivity(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/health/cache`);
    if (!response.ok) {
      throw new Error(`Cache health check failed: ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'connected') {
      throw new Error(`Cache not connected: ${data.status}`);
    }

    if (data.latency > 50) {
      throw new Error(`High cache latency: ${data.latency}ms`);
    }
  }

  async verifyStorageConnectivity(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/health/storage`);
    if (!response.ok) {
      throw new Error(`Storage health check failed: ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'connected') {
      throw new Error(`Storage not connected: ${data.status}`);
    }
  }

  async verifyWebSocketConnectivity(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      const WebSocket = require('ws');
      const ws = new WebSocket(`${wsUrl}/api/v1/ws`);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve();
      });

      ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async verifyAPIEndpoints(): Promise<void> {
    const endpoints = [
      { path: '/api/v1/agents', method: 'GET' },
      { path: '/api/v1/sessions', method: 'POST' },
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });

      if (!response.ok && response.status !== 401) {
        throw new Error(`API endpoint ${endpoint.path} failed: ${response.status}`);
      }
    }
  }

  async verifyAuthentication(): Promise<void> {
    // Test that authentication is enforced
    const response = await fetch(`${this.baseUrl}/api/v1/agents`);
    if (response.status !== 401) {
      throw new Error(`Authentication not enforced: ${response.status}`);
    }
  }

  async verifyPerformance(): Promise<void> {
    const requests = 10;
    const times: number[] = [];

    for (let i = 0; i < requests; i++) {
      const start = Date.now();
      await fetch(`${this.baseUrl}/health`);
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    if (avgTime > 500) {
      throw new Error(`High average latency: ${avgTime}ms`);
    }
  }

  async verifySSLCertificate(): Promise<void> {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const req = https.get(this.baseUrl, (res: any) => {
        const cert = res.socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('No SSL certificate'));
        } else {
          resolve(cert);
        }
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('SSL verification timeout'));
      });
    });
  }

  async verifyDNSResolution(): Promise<void> {
    const dns = require('dns').promises;
    const url = new URL(this.baseUrl);
    try {
      await dns.lookup(url.hostname);
    } catch (error) {
      throw new Error(`DNS resolution failed for ${url.hostname}`);
    }
  }

  async runAll(): Promise<void> {
    console.log(`\n🔍 Verifying deployment: ${this.baseUrl}\n`);

    // Infrastructure checks
    console.log('Infrastructure:');
    await this.verify('DNS Resolution', () => this.verifyDNSResolution());
    await this.verify('SSL Certificate', () => this.verifySSLCertificate());
    await this.verify('Health Endpoint', () => this.verifyHealthEndpoint());
    await this.verify('Version Endpoint', () => this.verifyVersionEndpoint());

    // Service checks
    console.log('\nServices:');
    await this.verify('Database Connectivity', () => this.verifyDatabaseConnectivity());
    await this.verify('Cache Connectivity', () => this.verifyCacheConnectivity());
    await this.verify('Storage Connectivity', () => this.verifyStorageConnectivity());
    await this.verify('WebSocket Connectivity', () => this.verifyWebSocketConnectivity());

    // API checks
    console.log('\nAPI:');
    await this.verify('API Endpoints', () => this.verifyAPIEndpoints());
    await this.verify('Authentication', () => this.verifyAuthentication());

    // Metrics and performance
    console.log('\nMetrics & Performance:');
    await this.verify('Metrics Endpoint', () => this.verifyMetricsEndpoint());
    await this.verify('Performance', () => this.verifyPerformance());

    this.printSummary();
  }

  printSummary(): void {
    console.log('\n📊 Verification Summary\n');

    const passed = this.results.filter((r) => r.status === 'pass').length;
    const failed = this.results.filter((r) => r.status === 'fail').length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${passRate}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Checks:\n');
      this.results
        .filter((r) => r.status === 'fail')
        .forEach((r) => {
          console.log(`  • ${r.name}`);
          console.log(`    ${r.message}\n`);
        });
    }

    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\n⏱️  Total Duration: ${totalTime}ms\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('✅ All verifications passed!\n');
    }
  }
}

// CLI Interface
program
  .version('1.0.0')
  .description('Verify ClaudeFlare v1.0 deployment')
  .option('-e, --environment <env>', 'Environment to verify', 'production')
  .option('-v, --verbose', 'Verbose output')
  .parse(process.argv);

const options = program.opts();

async function main() {
  const verifier = new DeploymentVerifier(options.environment);
  await verifier.runAll();
}

main().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});
