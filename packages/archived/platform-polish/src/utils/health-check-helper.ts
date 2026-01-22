// @ts-nocheck
import { HealthStatus } from '../types';

export class HealthCheckHelper {
  static async checkServiceHealth(
    url: string,
    options: {
      timeout?: number;
      expectedStatus?: number[];
      retries?: number;
    } = {}
  ): Promise<HealthStatus> {
    const {
      timeout = 5000,
      expectedStatus = [200],
      retries = 3
    } = options;

    const startTime = Date.now();
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(timeout)
        });

        const responseTime = Date.now() - startTime;
        const isHealthy = expectedStatus.includes(response.status);

        return {
          service: url,
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          uptime: 0, // Would need to track uptime separately
          responseTime,
          errorRate: isHealthy ? 0 : 100,
          cpuUsage: 0, // Would need system metrics
          memoryUsage: 0 // Would need system metrics
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt === retries) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return {
      service: url,
      status: 'unhealthy',
      lastCheck: new Date(),
      uptime: 0,
      responseTime: 0,
      errorRate: 100,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }
}