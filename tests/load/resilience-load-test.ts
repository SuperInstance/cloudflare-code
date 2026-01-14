/**
 * Load Testing Scenarios for Resilience Patterns
 *
 * Run with: npm run test:load
 */

import { TokenBucket, SlidingWindow } from '../../packages/edge/src/lib/rate-limit';
import { CircuitBreaker } from '../../packages/edge/src/lib/circuit-breaker';
import { RetryPolicy } from '../../packages/edge/src/lib/retry';

interface LoadTestResult {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  duration: number;
  requestsPerSecond: number;
  errorRate: number;
}

class LoadTester {
  /**
   * Test rate limiter under burst traffic
   */
  static async testBurstTraffic(): Promise<LoadTestResult> {
    console.log('\n=== Testing Burst Traffic ===');

    const limiter = new TokenBucket({
      capacity: 100,
      refillRate: 10, // 10 tokens per second
    });

    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const totalRequests = 500;

    // Simulate burst of 500 requests
    for (let i = 0; i < totalRequests; i++) {
      const allowed = await limiter.tryConsume('user-burst', 1);
      if (allowed) {
        successful++;
      } else {
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: 'Burst Traffic',
      totalRequests,
      successfulRequests: successful,
      failedRequests: failed,
      rateLimitedRequests: failed,
      duration,
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: (failed / totalRequests) * 100,
    };

    console.log(`Total: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Rate Limited: ${result.rateLimitedRequests}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);

    return result;
  }

  /**
   * Test rate limiter under sustained load
   */
  static async testSustainedLoad(): Promise<LoadTestResult> {
    console.log('\n=== Testing Sustained Load ===');

    const limiter = new TokenBucket({
      capacity: 60,
      refillRate: 1, // 1 request per second
    });

    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const duration = 10000; // 10 seconds
    const endTime = startTime + duration;

    // Sustained load for 10 seconds
    while (Date.now() < endTime) {
      const allowed = await limiter.tryConsume('user-sustained', 1);
      if (allowed) {
        successful++;
      } else {
        failed++;
      }
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const actualDuration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: 'Sustained Load',
      totalRequests: successful + failed,
      successfulRequests: successful,
      failedRequests: failed,
      rateLimitedRequests: failed,
      duration: actualDuration,
      requestsPerSecond: (successful / actualDuration) * 1000,
      errorRate: (failed / (successful + failed)) * 100,
    };

    console.log(`Total: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Rate Limited: ${result.rateLimitedRequests}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);

    return result;
  }

  /**
   * Test sliding window rate limiter
   */
  static async testSlidingWindow(): Promise<LoadTestResult> {
    console.log('\n=== Testing Sliding Window ===');

    const limiter = new SlidingWindow({
      maxRequests: 100,
      windowMs: 5000, // 5 second window
    });

    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const totalRequests = 200;

    // Send 200 requests as fast as possible
    for (let i = 0; i < totalRequests; i++) {
      const allowed = await limiter.isAllowed('user-window');
      if (allowed) {
        successful++;
      } else {
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: 'Sliding Window',
      totalRequests,
      successfulRequests: successful,
      failedRequests: failed,
      rateLimitedRequests: failed,
      duration,
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: (failed / totalRequests) * 100,
    };

    console.log(`Total: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Rate Limited: ${result.rateLimitedRequests}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);

    return result;
  }

  /**
   * Test circuit breaker under failure scenarios
   */
  static async testCircuitBreaker(): Promise<LoadTestResult> {
    console.log('\n=== Testing Circuit Breaker ===');

    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 5000,
    });

    let successful = 0;
    let failed = 0;
    let circuitOpened = 0;
    const totalRequests = 20;

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      try {
        await breaker.execute(async () => {
          // Simulate failures
          if (Math.random() > 0.3) {
            throw new Error('Service unavailable');
          }
          return 'success';
        });
        successful++;
      } catch (error: any) {
        failed++;
        if (error.message.includes('OPEN')) {
          circuitOpened++;
        }
      }
    }

    const duration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: 'Circuit Breaker',
      totalRequests,
      successfulRequests: successful,
      failedRequests: failed,
      rateLimitedRequests: circuitOpened,
      duration,
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: (failed / totalRequests) * 100,
    };

    console.log(`Total: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Failed: ${result.failedRequests}`);
    console.log(`Circuit Opened: ${result.rateLimitedRequests}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);
    console.log(`Final State: ${breaker.getState()}`);

    return result;
  }

  /**
   * Test retry logic with transient failures
   */
  static async testRetryLogic(): Promise<LoadTestResult> {
    console.log('\n=== Testing Retry Logic ===');

    const retry = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    });

    let successful = 0;
    let failed = 0;
    let totalAttempts = 0;
    const totalRequests = 50;

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const attemptStart = Date.now();
      let attempts = 0;

      try {
        await retry.execute(async () => {
          attempts++;
          totalAttempts++;

          // Simulate transient failures
          if (Math.random() > 0.7) {
            const error: any = new Error('Timeout');
            error.code = 'ETIMEDOUT';
            throw error;
          }
          return 'success';
        });

        successful++;
      } catch (error) {
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: 'Retry Logic',
      totalRequests,
      successfulRequests: successful,
      failedRequests: failed,
      rateLimitedRequests: totalAttempts - totalRequests,
      duration,
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: (failed / totalRequests) * 100,
    };

    console.log(`Total: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Failed: ${result.failedRequests}`);
    console.log(`Total Attempts: ${totalAttempts}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);

    return result;
  }

  /**
   * Test concurrent requests
   */
  static async testConcurrency(): Promise<LoadTestResult> {
    console.log('\n=== Testing Concurrent Requests ===');

    const limiter = new TokenBucket({
      capacity: 100,
      refillRate: 10,
    });

    const concurrentUsers = 50;
    const requestsPerUser = 10;
    const startTime = Date.now();

    const promises = Array.from({ length: concurrentUsers }, async (_, userId) => {
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < requestsPerUser; i++) {
        const allowed = await limiter.tryConsume(`user-${userId}`, 1);
        if (allowed) {
          successful++;
        } else {
          failed++;
        }
      }

      return { successful, failed };
    });

    const results = await Promise.all(promises);

    const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const duration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: 'Concurrent Requests',
      totalRequests: concurrentUsers * requestsPerUser,
      successfulRequests: totalSuccessful,
      failedRequests: totalFailed,
      rateLimitedRequests: totalFailed,
      duration,
      requestsPerSecond: ((concurrentUsers * requestsPerUser) / duration) * 1000,
      errorRate: (totalFailed / (concurrentUsers * requestsPerUser)) * 100,
    };

    console.log(`Concurrent Users: ${concurrentUsers}`);
    console.log(`Requests Per User: ${requestsPerUser}`);
    console.log(`Total: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Rate Limited: ${result.rateLimitedRequests}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);

    return result;
  }

  /**
   * Run all load tests
   */
  static async runAllTests(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Resilience Patterns - Load Testing Suite         ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const results: LoadTestResult[] = [];

    try {
      results.push(await this.testBurstTraffic());
    } catch (error) {
      console.error('Burst traffic test failed:', error);
    }

    try {
      results.push(await this.testSustainedLoad());
    } catch (error) {
      console.error('Sustained load test failed:', error);
    }

    try {
      results.push(await this.testSlidingWindow());
    } catch (error) {
      console.error('Sliding window test failed:', error);
    }

    try {
      results.push(await this.testCircuitBreaker());
    } catch (error) {
      console.error('Circuit breaker test failed:', error);
    }

    try {
      results.push(await this.testRetryLogic());
    } catch (error) {
      console.error('Retry logic test failed:', error);
    }

    try {
      results.push(await this.testConcurrency());
    } catch (error) {
      console.error('Concurrency test failed:', error);
    }

    this.printSummary(results);
  }

  /**
   * Print test summary
   */
  private static printSummary(results: LoadTestResult[]): void {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                   Test Summary                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('┌─────────────────────┬──────────┬───────────┬───────────┬──────────┐');
    console.log('│ Test                │ Total    │ Success   │ Failed    │ Error % │');
    console.log('├─────────────────────┼──────────┼───────────┼───────────┼──────────┤');

    for (const result of results) {
      const name = result.name.padEnd(19);
      const total = result.totalRequests.toString().padStart(8);
      const success = result.successfulRequests.toString().padStart(9);
      const failed = result.failedRequests.toString().padStart(9);
      const error = result.errorRate.toFixed(1).padStart(8);

      console.log(`│ ${name} │ ${total} │ ${success} │ ${failed} │ ${error}% │`);
    }

    console.log('└─────────────────────┴──────────┴───────────┴───────────┴──────────┘');

    // Calculate averages
    const avgSuccessRate = results.reduce((sum, r) =>
      sum + (r.successfulRequests / r.totalRequests) * 100, 0) / results.length;

    console.log(`\nAverage Success Rate: ${avgSuccessRate.toFixed(2)}%`);
    console.log(`Total Tests: ${results.length}`);
    console.log(`Total Requests: ${results.reduce((sum, r) => sum + r.totalRequests, 0)}`);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  LoadTester.runAllTests().catch(console.error);
}

export { LoadTester };
export type { LoadTestResult };
