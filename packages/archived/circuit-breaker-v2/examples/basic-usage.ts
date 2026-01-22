import { CircuitBreaker, CircuitBreakerConfig, FallbackConfig } from '../src/index.js';

/**
 * Basic Circuit Breaker Usage Example
 */

// Example 1: Basic usage with automatic circuit breaking
async function basicExample() {
  console.log('=== Basic Circuit Breaker Example ===\n');

  const config: CircuitBreakerConfig = {
    name: 'api-service',
    thresholds: {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
      windowSize: 100,
      minRequests: 10,
      errorRateThreshold: 50,
      slowCallThreshold: 1000,
      slowCallRateThreshold: 30,
    },
    enableMetrics: true,
    enablePredictiveDetection: true,
  };

  const circuitBreaker = new CircuitBreaker(config);

  // Simulate an API call
  async function callApi(id: string) {
    console.log(`Calling API for ${id}...`);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { id, data: `Response for ${id}` };
  }

  try {
    // Execute operation through circuit breaker
    const result = await circuitBreaker.execute(() => callApi('123'));
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }

  // Check circuit state
  console.log('Circuit state:', circuitBreaker.getState());
  console.log('Metrics:', circuitBreaker.getMetrics());
}

// Example 2: Circuit breaker with fallbacks
async function fallbackExample() {
  console.log('\n=== Circuit Breaker with Fallbacks ===\n');

  const circuitBreaker = CircuitBreaker.create({
    name: 'database-service',
    thresholds: {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 30000,
      windowSize: 50,
      minRequests: 5,
      errorRateThreshold: 50,
      slowCallThreshold: 500,
      slowCallRateThreshold: 20,
    },
    enableMetrics: true,
  });

  // Register fallbacks
  circuitBreaker.registerFallback({
    name: 'cache-fallback',
    priority: 1, // HIGH
    handler: async (context, error) => {
      console.log('Using cache fallback');
      return { fromCache: true, data: 'cached-data' };
    },
    enabled: true,
    tags: ['cache', 'high-priority'],
  });

  circuitBreaker.registerFallback({
    name: 'static-fallback',
    priority: 3, // LOW
    handler: async (context, error) => {
      console.log('Using static fallback');
      return { static: true, data: 'default-data' };
    },
    enabled: true,
    tags: ['static', 'low-priority'],
  });

  // Simulate failing operation
  let failureCount = 0;
  async function unreliableOperation() {
    failureCount++;
    if (failureCount <= 3) {
      throw new Error('Service unavailable');
    }
    return { success: true, data: 'operation-result' };
  }

  try {
    // First few calls will use fallbacks
    for (let i = 0; i < 5; i++) {
      const result = await circuitBreaker.execute(unreliableOperation);
      console.log(`Attempt ${i + 1}:`, result);
    }
  } catch (error) {
    console.error('Final error:', error);
  }

  console.log('Circuit state:', circuitBreaker.getState());
  console.log('Fallback stats:', circuitBreaker.getFallbackStats());
}

// Example 3: Circuit breaker with manual control
async function manualControlExample() {
  console.log('\n=== Manual Control Example ===\n');

  const circuitBreaker = CircuitBreaker.create({
    name: 'external-service',
    thresholds: {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
      windowSize: 100,
      minRequests: 10,
      errorRateThreshold: 50,
      slowCallThreshold: 1000,
      slowCallRateThreshold: 30,
    },
  });

  // Subscribe to events
  circuitBreaker.on((event) => {
    console.log('Event:', event.type, event.data);
  });

  // Manually open circuit
  console.log('Opening circuit...');
  circuitBreaker.open();
  console.log('State:', circuitBreaker.getState());

  // Try to execute - should be rejected
  try {
    await circuitBreaker.execute(async () => {
      console.log('This should not execute');
      return 'success';
    });
  } catch (error) {
    console.error('Expected rejection:', (error as Error).message);
  }

  // Close circuit
  console.log('\nClosing circuit...');
  circuitBreaker.close();
  console.log('State:', circuitBreaker.getState());

  // Now execution should work
  const result = await circuitBreaker.execute(async () => 'success');
  console.log('Result:', result);
}

// Example 4: Using presets
async function presetExample() {
  console.log('\n=== Preset Configuration Example ===\n');

  // Create with critical preset (aggressive circuit breaking)
  const criticalCircuit = CircuitBreaker.createCritical('payment-service');
  console.log('Critical circuit state:', criticalCircuit.getState());

  // Create with lenient preset (tolerant circuit breaking)
  const lenientCircuit = CircuitBreaker.createLenient('logging-service');
  console.log('Lenient circuit state:', lenientCircuit.getState());
}

// Example 5: Analytics and monitoring
async function analyticsExample() {
  console.log('\n=== Analytics and Monitoring Example ===\n');

  const circuitBreaker = CircuitBreaker.create({
    name: 'analytics-service',
    enableMetrics: true,
    enablePredictiveDetection: true,
    thresholds: {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
      windowSize: 100,
      minRequests: 10,
      errorRateThreshold: 50,
      slowCallThreshold: 1000,
      slowCallRateThreshold: 30,
    },
  });

  // Simulate some operations
  for (let i = 0; i < 20; i++) {
    try {
      await circuitBreaker.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
        if (Math.random() > 0.8) {
          throw new Error('Random failure');
        }
        return `result-${i}`;
      });
    } catch (error) {
      // Expected some failures
    }
  }

  // Get analytics
  const analytics = circuitBreaker.getAnalytics();
  console.log('Analytics summary:', JSON.stringify(analytics, null, 2));

  // Get comprehensive stats
  const stats = circuitBreaker.getStats();
  console.log('\nComprehensive stats:', JSON.stringify(stats, null, 2));

  // Export metrics
  console.log('\nExported metrics:');
  console.log(circuitBreaker.exportMetrics());
}

// Example 6: Health monitoring and fault detection
async function healthMonitoringExample() {
  console.log('\n=== Health Monitoring Example ===\n');

  const circuitBreaker = CircuitBreaker.create({
    name: 'health-monitored-service',
    enableMetrics: true,
    enablePredictiveDetection: true,
    thresholds: {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
      windowSize: 100,
      minRequests: 10,
      errorRateThreshold: 50,
      slowCallThreshold: 1000,
      slowCallRateThreshold: 30,
    },
  });

  // Simulate operations with varying success
  for (let i = 0; i < 30; i++) {
    try {
      await circuitBreaker.execute(async () => {
        const delay = 100 + Math.random() * 500; // Variable delay
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (Math.random() > 0.7) {
          throw new Error('Intermittent failure');
        }
        return `operation-${i}`;
      });
    } catch (error) {
      // Some failures expected
    }
  }

  // Check health status
  console.log('Health status:', circuitBreaker.getHealthStatus());

  // Detect faults
  const faultDetection = circuitBreaker.detectFaults();
  console.log('Fault detection:', faultDetection);
  console.log('Issues detected:', faultDetection.issues.length);
  console.log('Recommendations:', faultDetection.recommendations);
}

// Run all examples
async function runAllExamples() {
  try {
    await basicExample();
    await fallbackExample();
    await manualControlExample();
    await presetExample();
    await analyticsExample();
    await healthMonitoringExample();
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Uncomment to run examples
// runAllExamples().then(() => console.log('\nAll examples completed!'));

export {
  basicExample,
  fallbackExample,
  manualControlExample,
  presetExample,
  analyticsExample,
  healthMonitoringExample,
  runAllExamples,
};
