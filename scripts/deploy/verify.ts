/**
 * Deployment Verification Script for ClaudeFlare
 * Comprehensive deployment health checks and validation
 */

import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentEvent,
  VerificationResult,
  VerificationCheck,
  HealthCheckResult,
  DeploymentRegion,
  Environment,
  WorkerDeploymentOptions,
} from './types.js';

/**
 * Deployment verifier class
 */
export class DeploymentVerifier {
  private config: DeploymentConfig;
  private context: DeploymentContext;

  constructor(config: DeploymentConfig, context: DeploymentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Run comprehensive deployment verification
   */
  async verifyDeployment(): Promise<VerificationResult> {
    this.emitEvent({
      type: 'info',
      message: 'Starting deployment verification...',
      timestamp: new Date(),
    });

    const checks: VerificationCheck[] = [];
    let overallScore = 100;

    // 1. Worker deployment check
    const workerCheck = await this.verifyWorkerDeployment();
    checks.push(workerCheck);
    if (workerCheck.status === 'fail') overallScore -= 30;
    if (workerCheck.status === 'warn') overallScore -= 10;

    // 2. Health check
    const healthCheck = await this.verifyHealth();
    checks.push(healthCheck);
    if (healthCheck.status === 'fail') overallScore -= 25;
    if (healthCheck.status === 'warn') overallScore -= 10;

    // 3. API endpoints check
    const apiCheck = await this.verifyAPIEndpoints();
    checks.push(apiCheck);
    if (apiCheck.status === 'fail') overallScore -= 20;
    if (apiCheck.status === 'warn') overallScore -= 5;

    // 4. Storage resources check
    const storageCheck = await this.verifyStorageResources();
    checks.push(storageCheck);
    if (storageCheck.status === 'fail') overallScore -= 15;
    if (storageCheck.status === 'warn') overallScore -= 5;

    // 5. Durable Objects check
    const doCheck = await this.verifyDurableObjects();
    checks.push(doCheck);
    if (doCheck.status === 'fail') overallScore -= 10;
    if (doCheck.status === 'warn') overallScore -= 3;

    const success = checks.every(c => c.status !== 'fail');

    const result: VerificationResult = {
      success,
      checks,
      timestamp: new Date(),
      environment: this.config.environment,
      overallScore: Math.max(0, overallScore),
    };

    if (success) {
      this.emitEvent({
        type: 'success',
        message: `Deployment verification passed (Score: ${overallScore}/100)`,
        timestamp: new Date(),
        details: { result },
      });
    } else {
      this.emitEvent({
        type: 'error',
        message: `Deployment verification failed (Score: ${overallScore}/100)`,
        timestamp: new Date(),
        details: { result },
      });
    }

    return result;
  }

  /**
   * Verify worker deployment
   */
  private async verifyWorkerDeployment(): Promise<VerificationCheck> {
    const startTime = Date.now();
    const name = 'Worker Deployment';

    try {
      const url = this.getWorkerUrl();

      // Check if worker is accessible
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        return {
          name,
          status: 'fail',
          message: `Worker returned HTTP ${response.status}`,
          duration,
        };
      }

      // Check response headers
      const server = response.headers.get('Server') || response.headers.get('server');
      if (!server?.includes('cloudflare')) {
        return {
          name,
          status: 'warn',
          message: 'Response not from Cloudflare',
          duration,
        };
      }

      return {
        name,
        status: 'pass',
        message: 'Worker is deployed and accessible',
        duration,
      };
    } catch (error) {
      return {
        name,
        status: 'fail',
        message: `Worker is not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Verify health endpoints
   */
  private async verifyHealth(): Promise<VerificationCheck> {
    const startTime = Date.now();
    const name = 'Health Check';
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const url = this.getWorkerUrl();
      const healthUrl = `${url}/health`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        errors.push(`Health endpoint returned HTTP ${response.status}`);
      }

      // Parse response
      const data = await response.json();

      if (data.status !== 'ok' && data.status !== 'healthy') {
        errors.push(`Health status is ${data.status}`);
      }

      // Check if all components are healthy
      if (data.components) {
        const unhealthyComponents = Object.entries(data.components)
          .filter(([_, status]: [string, unknown]) => status !== 'healthy')
          .map(([name]) => name);

        if (unhealthyComponents.length > 0) {
          warnings.push(`Unhealthy components: ${unhealthyComponents.join(', ')}`);
        }
      }

      const duration = Date.now() - startTime;

      if (errors.length > 0) {
        return {
          name,
          status: 'fail',
          message: errors.join('; '),
          duration,
        };
      }

      if (warnings.length > 0) {
        return {
          name,
          status: 'warn',
          message: warnings.join('; '),
          duration,
        };
      }

      return {
        name,
        status: 'pass',
        message: 'All health checks passed',
        duration,
      };
    } catch (error) {
      return {
        name,
        status: 'fail',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Verify API endpoints
   */
  private async verifyAPIEndpoints(): Promise<VerificationCheck> {
    const startTime = Date.now();
    const name = 'API Endpoints';
    const errors: string[] = [];
    const warnings: string[] = [];

    const endpoints = [
      { path: '/api/v1/health', method: 'GET' },
      { path: '/api/v1/version', method: 'GET' },
      { path: '/metrics', method: 'GET' },
    ];

    const url = this.getWorkerUrl();

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${url}${endpoint.path}`, {
          method: endpoint.method,
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          errors.push(`${endpoint.method} ${endpoint.path} returned HTTP ${response.status}`);
        }
      } catch (error) {
        warnings.push(`${endpoint.method} ${endpoint.path} is not accessible`);
      }
    }

    const duration = Date.now() - startTime;

    if (errors.length > 0) {
      return {
        name,
        status: 'fail',
        message: errors.join('; '),
        duration,
      };
    }

    if (warnings.length > 0) {
      return {
        name,
        status: 'warn',
        message: warnings.join('; '),
        duration,
      };
    }

    return {
      name,
      status: 'pass',
      message: 'All API endpoints are accessible',
      duration,
    };
  }

  /**
   * Verify storage resources
   */
  private async verifyStorageResources(): Promise<VerificationCheck> {
    const startTime = Date.now();
    const name = 'Storage Resources';
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const url = this.getWorkerUrl();

      // Check KV storage
      try {
        const kvResponse = await fetch(`${url}/admin/storage/kv/test`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!kvResponse.ok) {
          warnings.push('KV storage may not be configured');
        }
      } catch (error) {
        warnings.push('KV storage check failed');
      }

      // Check R2 storage
      try {
        const r2Response = await fetch(`${url}/admin/storage/r2/test`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!r2Response.ok) {
          warnings.push('R2 storage may not be configured');
        }
      } catch (error) {
        warnings.push('R2 storage check failed');
      }

      // Check D1 database
      try {
        const d1Response = await fetch(`${url}/admin/storage/d1/test`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!d1Response.ok) {
          warnings.push('D1 database may not be configured');
        }
      } catch (error) {
        warnings.push('D1 database check failed');
      }

      const duration = Date.now() - startTime;

      if (errors.length > 0) {
        return {
          name,
          status: 'fail',
          message: errors.join('; '),
          duration,
        };
      }

      if (warnings.length > 0) {
        return {
          name,
          status: 'warn',
          message: warnings.join('; '),
          duration,
        };
      }

      return {
        name,
        status: 'pass',
        message: 'All storage resources are accessible',
        duration,
      };
    } catch (error) {
      return {
        name,
        status: 'warn',
        message: `Storage verification incomplete: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Verify Durable Objects
   */
  private async verifyDurableObjects(): Promise<VerificationCheck> {
    const startTime = Date.now();
    const name = 'Durable Objects';
    const errors: string[] = [];
    const warnings: string[] = [];

    const objects = ['AGENT_ORCHESTRATOR', 'VECTOR_INDEX', 'SESSION_MANAGER'];
    const url = this.getWorkerUrl();

    for (const objectName of objects) {
      try {
        const response = await fetch(`${url}/admin/objects/${objectName}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          warnings.push(`Durable Object ${objectName} is not accessible`);
        }
      } catch (error) {
        warnings.push(`Durable Object ${objectName} check failed`);
      }
    }

    const duration = Date.now() - startTime;

    if (errors.length > 0) {
      return {
        name,
        status: 'fail',
        message: errors.join('; '),
        duration,
      };
    }

    if (warnings.length > 0) {
      return {
        name,
        status: 'warn',
        message: warnings.join('; '),
        duration,
      };
    }

    return {
      name,
      status: 'pass',
      message: 'All Durable Objects are accessible',
      duration,
    };
  }

  /**
   * Perform multi-region health checks
   */
  async performMultiRegionHealthChecks(
    regions: DeploymentRegion[]
  ): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const region of regions) {
      const result = await this.healthCheckRegion(region);
      results.push(result);
    }

    return results;
  }

  /**
   * Health check for a specific region
   */
  private async healthCheckRegion(region: DeploymentRegion): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const url = this.getWorkerUrl();

      const response = await fetch(`${url}/health?region=${region}`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.healthCheckTimeout),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        errors.push(`HTTP ${response.status}`);
        return {
          status: 'unhealthy',
          latency,
          timestamp: new Date(),
          errors,
          warnings,
          region,
        };
      }

      const data = await response.json();

      if (data.status !== 'ok' && data.status !== 'healthy') {
        warnings.push('Health check status not ok');
      }

      return {
        status: errors.length === 0 ? 'healthy' : 'degraded',
        latency,
        timestamp: new Date(),
        errors,
        warnings,
        region,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        timestamp: new Date(),
        errors,
        warnings,
        region,
      };
    }
  }

  /**
   * Smoke test deployment
   */
  async smokeTest(): Promise<{
    success: boolean;
    tests: Array<{ name: string; passed: boolean; duration: number }>;
  }> {
    const tests: Array<{ name: string; passed: boolean; duration: number }> = [];
    const url = this.getWorkerUrl();

    // Test 1: Health check
    {
      const startTime = Date.now();
      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        tests.push({
          name: 'Health Check',
          passed: response.ok,
          duration: Date.now() - startTime,
        });
      } catch {
        tests.push({
          name: 'Health Check',
          passed: false,
          duration: Date.now() - startTime,
        });
      }
    }

    // Test 2: Version check
    {
      const startTime = Date.now();
      try {
        const response = await fetch(`${url}/version`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        tests.push({
          name: 'Version Check',
          passed: response.ok,
          duration: Date.now() - startTime,
        });
      } catch {
        tests.push({
          name: 'Version Check',
          passed: false,
          duration: Date.now() - startTime,
        });
      }
    }

    // Test 3: Metrics check
    {
      const startTime = Date.now();
      try {
        const response = await fetch(`${url}/metrics`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        tests.push({
          name: 'Metrics Check',
          passed: response.ok,
          duration: Date.now() - startTime,
        });
      } catch {
        tests.push({
          name: 'Metrics Check',
          passed: false,
          duration: Date.now() - startTime,
        });
      }
    }

    // Test 4: API endpoint
    {
      const startTime = Date.now();
      try {
        const response = await fetch(`${url}/api/v1/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'ping' }),
          signal: AbortSignal.timeout(5000),
        });
        tests.push({
          name: 'API Test',
          passed: response.ok,
          duration: Date.now() - startTime,
        });
      } catch {
        tests.push({
          name: 'API Test',
          passed: false,
          duration: Date.now() - startTime,
        });
      }
    }

    const success = tests.every(t => t.passed);

    return {
      success,
      tests,
    };
  }

  /**
   * Monitor deployment over time
   */
  async monitorDeployment(duration: number, interval: number = 30000): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Monitoring deployment for ${duration}ms...`,
      timestamp: new Date(),
    });

    const startTime = Date.now();
    let failures = 0;

    while (Date.now() - startTime < duration) {
      const result = await this.verifyDeployment();

      if (!result.success) {
        failures++;
        this.emitEvent({
          type: 'warning',
          message: `Verification failed (${failures} times)`,
          timestamp: new Date(),
        });

        if (failures >= 3) {
          throw new Error('Deployment monitoring failed after 3 consecutive failures');
        }
      } else {
        failures = 0;
      }

      await this.sleep(interval);
    }

    this.emitEvent({
      type: 'success',
      message: 'Deployment monitoring completed successfully',
      timestamp: new Date(),
    });
  }

  /**
   * Get worker URL based on environment
   */
  private getWorkerUrl(): string {
    const subdomain = this.config.environment === 'production'
      ? 'claudeflare'
      : `claudeflare-${this.config.environment}`;

    return `https://${subdomain}.workers.dev`;
  }

  /**
   * Emit deployment event
   */
  private emitEvent(event: DeploymentEvent): void {
    this.context.events.push(event);
    this.context.logger.info(`[${event.type.toUpperCase()}] ${event.message}`);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a new deployment verifier instance
 */
export function createDeploymentVerifier(
  config: DeploymentConfig,
  context: DeploymentContext
): DeploymentVerifier {
  return new DeploymentVerifier(config, context);
}
