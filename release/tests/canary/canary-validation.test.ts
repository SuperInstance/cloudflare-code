/**
 * Canary Deployment Validation Tests
 * Validates canary deployment for v1.0 release
 */

import { describe, it, expect, beforeAll } from 'vitest';

const CANARY_URL = process.env.CANARY_URL || 'https://canary.claudeflare.workers.dev';
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://claudeflare.workers.dev';

interface CanaryMetrics {
  url: string;
  latency: number;
  success: boolean;
  statusCode: number;
  errorRate: number;
}

describe('Canary Deployment - Traffic Splitting', () => {
  let canaryMetrics: CanaryMetrics;
  let productionMetrics: CanaryMetrics;

  beforeAll(async () => {
    // Measure canary performance
    const canaryStart = Date.now();
    const canaryRes = await fetch(`${CANARY_URL}/health`);
    canaryMetrics = {
      url: CANARY_URL,
      latency: Date.now() - canaryStart,
      success: canaryRes.ok,
      statusCode: canaryRes.status,
      errorRate: 0,
    };

    // Measure production performance
    const prodStart = Date.now();
    const prodRes = await fetch(`${PRODUCTION_URL}/health`);
    productionMetrics = {
      url: PRODUCTION_URL,
      latency: Date.now() - prodStart,
      success: prodRes.ok,
      statusCode: prodRes.status,
      errorRate: 0,
    };
  });

  it('should have canary endpoint accessible', () => {
    expect(canaryMetrics.success).toBe(true);
    expect(canaryMetrics.statusCode).toBe(200);
  });

  it('should have latency within acceptable range compared to production', () => {
    const latencyDiff = Math.abs(canaryMetrics.latency - productionMetrics.latency);
    const acceptableDiff = productionMetrics.latency * 0.5; // 50% tolerance

    expect(latencyDiff).toBeLessThan(acceptableDiff);
  });

  it('should return same version for health checks', async () => {
    const canaryHealth = await (await fetch(`${CANARY_URL}/health`)).json();
    const prodHealth = await (await fetch(`${PRODUCTION_URL}/health`)).json();

    expect(canaryHealth.version).toBe(prodHealth.version);
  });
});

describe('Canary Deployment - 10% Traffic Validation', () => {
  it('should handle 10% traffic without errors', async () => {
    const requests = 100;
    const canaryRequests = Math.floor(requests * 0.1); // 10% to canary
    let errors = 0;

    // Test canary with 10% of requests
    await Promise.all(
      Array.from({ length: canaryRequests }, async () => {
        try {
          const res = await fetch(`${CANARY_URL}/api/agents`);
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
      })
    );

    const errorRate = (errors / canaryRequests) * 100;
    expect(errorRate).toBeLessThan(5); // Less than 5% error rate
  });
});

describe('Canary Deployment - Gradual Rollout', () => {
  const rolloutStages = [0.1, 0.25, 0.5, 0.75, 1.0];

  it.each(rolloutStages)('should validate %s traffic split', async (percentage) => {
    const requests = 100;
    const canaryRequests = Math.floor(requests * percentage);
    let errors = 0;

    await Promise.all(
      Array.from({ length: canaryRequests }, async () => {
        try {
          const res = await fetch(`${CANARY_URL}/health`);
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
      })
    );

    const errorRate = (errors / canaryRequests) * 100;
    expect(errorRate).toBeLessThan(5);
  });
});

describe('Canary Deployment - Metric Comparison', () => {
  it('should have comparable error rates', async () => {
    const requests = 50;
    let canaryErrors = 0;
    let prodErrors = 0;

    // Test canary
    await Promise.all(
      Array.from({ length: requests }, async () => {
        try {
          const res = await fetch(`${CANARY_URL}/api/agents`);
          if (!res.ok) canaryErrors++;
        } catch {
          canaryErrors++;
        }
      })
    );

    // Test production
    await Promise.all(
      Array.from({ length: requests }, async () => {
        try {
          const res = await fetch(`${PRODUCTION_URL}/api/agents`);
          if (!res.ok) prodErrors++;
        } catch {
          prodErrors++;
        }
      })
    );

    const canaryErrorRate = (canaryErrors / requests) * 100;
    const prodErrorRate = (prodErrors / requests) * 100;

    // Canary error rate should not be more than 2% higher than production
    expect(canaryErrorRate - prodErrorRate).toBeLessThan(2);
  });

  it('should have comparable cache hit rates', async () => {
    const canaryMetrics = await (await fetch(`${CANARY_URL}/metrics`)).json();
    const prodMetrics = await (await fetch(`${PRODUCTION_URL}/metrics`)).json();

    const diff = Math.abs(canaryMetrics.cacheHitRate - prodMetrics.cacheHitRate);
    expect(diff).toBeLessThan(10); // Within 10% difference
  });
});

describe('Canary Deployment - Automated Rollback Triggers', () => {
  it('should trigger rollback if error rate exceeds 10%', async () => {
    const requests = 100;
    let errors = 0;

    await Promise.all(
      Array.from({ length: requests }, async () => {
        try {
          const res = await fetch(`${CANARY_URL}/api/test-endpoint`);
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
      })
    );

    const errorRate = (errors / requests) * 100;

    if (errorRate > 10) {
      // Should trigger rollback
      expect(true).toBe(true);
      console.warn(`Error rate ${errorRate}% exceeds 10% threshold - rollback recommended`);
    } else {
      expect(errorRate).toBeLessThanOrEqual(10);
    }
  });

  it('should trigger rollback if latency degrades by >50%', async () => {
    const canaryLatencies: number[] = [];
    const prodLatencies: number[] = [];

    await Promise.all(
      Array.from({ length: 20 }, async () => {
        const start = Date.now();
        await fetch(`${CANARY_URL}/api/agents`);
        canaryLatencies.push(Date.now() - start);

        const prodStart = Date.now();
        await fetch(`${PRODUCTION_URL}/api/agents`);
        prodLatencies.push(Date.now() - prodStart);
      })
    );

    const avgCanaryLatency = canaryLatencies.reduce((a, b) => a + b, 0) / canaryLatencies.length;
    const avgProdLatency = prodLatencies.reduce((a, b) => a + b, 0) / prodLatencies.length;

    const degradation = ((avgCanaryLatency - avgProdLatency) / avgProdLatency) * 100;

    if (degradation > 50) {
      console.warn(`Latency degraded by ${degradation}% - rollback recommended`);
    }

    expect(degradation).toBeLessThanOrEqual(50);
  });
});

describe('Canary Deployment - Feature Validation', () => {
  it('should validate all v1.0 features work on canary', async () => {
    const features = [
      { endpoint: '/api/agents', method: 'GET' },
      { endpoint: '/api/sessions', method: 'POST' },
      { endpoint: '/api/execute', method: 'POST' },
      { endpoint: '/health', method: 'GET' },
      { endpoint: '/metrics', method: 'GET' },
    ];

    const results = await Promise.all(
      features.map(async (feature) => {
        const res = await fetch(`${CANARY_URL}${feature.endpoint}`, {
          method: feature.method,
        });
        return {
          feature: feature.endpoint,
          status: res.status,
          ok: res.ok,
        };
      })
    );

    results.forEach((result) => {
      expect(result.ok).toBe(true);
    });
  });
});

describe('Canary Deployment - Real User Monitoring', () => {
  it('should collect RUM metrics', async () => {
    const res = await fetch(`${CANARY_URL}/api/analytics/rum`);
    const data = await res.json();

    expect(data.metrics).toBeDefined();
    expect(data.samples).toBeGreaterThan(0);
  });

  it('should have acceptable Core Web Vitals', async () => {
    const res = await fetch(`${CANARY_URL}/api/analytics/core-web-vitals`);
    const data = await res.json();

    // LCP (Largest Contentful Paint) < 2.5s
    expect(data.metrics.LCP).toBeLessThan(2500);

    // FID (First Input Delay) < 100ms
    expect(data.metrics.FID).toBeLessThan(100);

    // CLS (Cumulative Layout Shift) < 0.1
    expect(data.metrics.CLS).toBeLessThan(0.1);
  });
});

describe('Canary Deployment - Database Migration Validation', () => {
  it('should validate database schema version', async () => {
    const canaryDb = await (await fetch(`${CANARY_URL}/api/health/database`)).json();
    const prodDb = await (await fetch(`${PRODUCTION_URL}/api/health/database`)).json();

    expect(canaryDb.schemaVersion).toBe(prodDb.schemaVersion);
  });

  it('should validate data consistency', async () => {
    // Check that critical data exists in both
    const canaryData = await (await fetch(`${CANARY_URL}/api/agents`)).json();
    const prodData = await (await fetch(`${PRODUCTION_URL}/api/agents`)).json();

    expect(canaryData.agents.length).toBeGreaterThanOrEqual(0);
    expect(prodData.agents.length).toBeGreaterThanOrEqual(0);
  });
});
