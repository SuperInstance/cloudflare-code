/**
 * Service Mesh Basic Usage Examples
 *
 * This file demonstrates how to use the ClaudeFlare Service Mesh
 * for common service-to-service communication patterns.
 */

import {
  ServiceRegistryDO,
  ServiceRegistryClient,
  LoadBalancer,
  CircuitBreaker,
  CircuitBreakerManager,
  TrafficManager,
  SecurityLayer,
  createRegistryClient,
  type ServiceInstance,
  type ServiceRegistration,
  type LoadBalancingStrategy,
  type RetryPolicy,
} from '../src';

// ============================================================================
// Example 1: Service Registration and Discovery
// ============================================================================

async function exampleServiceRegistration() {
  console.log('=== Service Registration Example ===\n');

  // Create a service registry client
  const registryClient = createRegistryClient({
    SERVICE_REGISTRY: {
      idFromName: () => ({}),
      get: () => ({}),
    },
  });

  // Register a service instance
  const instance: ServiceInstance = {
    id: 'payment-service-1',
    serviceName: 'payment-service',
    host: 'payment-service.prod.svc.cluster.local',
    port: 8080,
    protocol: 'http',
    metadata: {
      cpuThreshold: 80,
      memoryThreshold: 85,
    },
    healthStatus: 'healthy',
    lastHeartbeat: Date.now(),
    version: '2.1.0',
    tags: ['v2', 'production', 'payments'],
    zone: 'us-east-1a',
    region: 'us-east-1',
    weight: 1,
  };

  const registration: ServiceRegistration = {
    serviceName: 'payment-service',
    instance,
    ttl: 30000, // 30 seconds TTL
  };

  // Register the service
  await registryClient.register(registration);
  console.log(`✓ Registered service: ${instance.serviceName}`);

  // Discover service instances
  const endpoints = await registryClient.discover({
    serviceName: 'payment-service',
    healthyOnly: true,
    region: 'us-east-1',
  });

  console.log(`✓ Found ${endpoints.instances.length} healthy instances`);
  endpoints.instances.forEach((inst) => {
    console.log(`  - ${inst.id} (${inst.host}:${inst.port})`);
  });

  // Get registry statistics
  const stats = await registryClient.getStats();
  console.log(`\nRegistry Stats:`);
  console.log(`  Total Services: ${stats.totalServices}`);
  console.log(`  Total Instances: ${stats.totalInstances}`);
  console.log(`  Healthy Instances: ${stats.healthyInstances}`);
}

// ============================================================================
// Example 2: Load Balancing
// ============================================================================

async function exampleLoadBalancing() {
  console.log('\n=== Load Balancing Example ===\n');

  // Create a load balancer with different strategies
  const strategies: LoadBalancingStrategy[] = [
    { type: 'round-robin' },
    { type: 'random' },
    { type: 'least-connections' },
    { type: 'weighted' },
    { type: 'ip-hash' },
    { type: 'consistent-hash' },
  ];

  // Mock service instances
  const instances: ServiceInstance[] = [
    {
      id: 'api-server-1',
      serviceName: 'api-service',
      host: 'api-1.example.com',
      port: 8080,
      protocol: 'http',
      metadata: {},
      healthStatus: 'healthy',
      lastHeartbeat: Date.now(),
      version: '1.0.0',
      tags: ['v1'],
      zone: 'us-east-1a',
      region: 'us-east-1',
      weight: 1,
    },
    {
      id: 'api-server-2',
      serviceName: 'api-service',
      host: 'api-2.example.com',
      port: 8080,
      protocol: 'http',
      metadata: {},
      healthStatus: 'healthy',
      lastHeartbeat: Date.now(),
      version: '1.0.0',
      tags: ['v1'],
      zone: 'us-east-1b',
      region: 'us-east-1',
      weight: 2, // Higher weight
    },
    {
      id: 'api-server-3',
      serviceName: 'api-service',
      host: 'api-3.example.com',
      port: 8080,
      protocol: 'http',
      metadata: {},
      healthStatus: 'healthy',
      lastHeartbeat: Date.now(),
      version: '1.0.0',
      tags: ['v1'],
      zone: 'us-west-1a',
      region: 'us-west-1',
      weight: 1,
    },
  ];

  // Test round-robin strategy
  console.log('Round Robin Strategy:');
  const rrBalancer = new LoadBalancer({
    strategy: { type: 'round-robin' },
    healthAware: true,
  });

  for (let i = 0; i < 6; i++) {
    const result = rrBalancer.select(instances);
    console.log(`  Request ${i + 1}: ${result.endpoint.id}`);
  }

  // Test weighted strategy
  console.log('\nWeighted Strategy (100 requests):');
  const weightedBalancer = new LoadBalancer({
    strategy: { type: 'weighted' },
    healthAware: true,
  });

  const selections: Map<string, number> = new Map();
  for (let i = 0; i < 100; i++) {
    const result = weightedBalancer.select(instances);
    const count = selections.get(result.endpoint.id) || 0;
    selections.set(result.endpoint.id, count + 1);
  }

  for (const [id, count] of selections) {
    const percentage = ((count / 100) * 100).toFixed(1);
    console.log(`  ${id}: ${count} requests (${percentage}%)`);
  }

  // Test least connections strategy
  console.log('\nLeast Connections Strategy:');
  const lcBalancer = new LoadBalancer({
    strategy: { type: 'least-connections' },
    healthAware: true,
  });

  // Simulate active connections
  lcBalancer.incrementConnections('api-server-1');
  lcBalancer.incrementConnections('api-server-1');
  lcBalancer.incrementConnections('api-server-2');

  for (let i = 0; i < 3; i++) {
    const result = lcBalancer.select(instances);
    console.log(`  Request ${i + 1}: ${result.endpoint.id} (least connections)`);
  }

  // Get load balancer statistics
  const stats = rrBalancer.getStats();
  console.log('\nLoad Balancer Stats:');
  console.log(`  Total Requests: ${stats.totalRequests}`);
  console.log(`  Requests per Endpoint:`);
  for (const [id, count] of stats.requestsPerEndpoint) {
    console.log(`    ${id}: ${count}`);
  }
}

// ============================================================================
// Example 3: Circuit Breaker
// ============================================================================

async function exampleCircuitBreaker() {
  console.log('\n=== Circuit Breaker Example ===\n');

  // Create a circuit breaker manager
  const manager = new CircuitBreakerManager({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    halfOpenMaxCalls: 3,
  });

  // Get circuit breaker for a service
  const circuitBreaker = manager.getBreaker('external-api');

  // Mock API function that fails occasionally
  let requestCount = 0;
  const apiRequest = async () => {
    requestCount++;
    const shouldFail = Math.random() < 0.3; // 30% failure rate

    if (shouldFail) {
      throw new Error('API request failed');
    }

    return { data: 'success', status: 200 };
  };

  // Execute requests with circuit breaker protection
  console.log('Executing 20 requests (30% failure rate):');

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < 20; i++) {
    try {
      const result = await circuitBreaker.execute(apiRequest);
      successCount++;
      console.log(`  Request ${i + 1}: ✓ Success`);
    } catch (error: any) {
      failureCount++;
      if (error.name === 'CircuitBreakerOpenError') {
        console.log(`  Request ${i + 1}: ✗ Circuit breaker OPEN - request rejected`);
      } else {
        console.log(`  Request ${i + 1}: ✗ Failed`);
      }
    }
  }

  console.log(`\nResults: ${successCount} successful, ${failureCount} failed`);
  console.log(`Actual API calls made: ${requestCount} (circuit breaker prevented more)`);

  // Get circuit breaker state
  const state = circuitBreaker.getState();
  console.log(`\nCircuit Breaker State: ${state}`);

  const stats = circuitBreaker.getStats();
  console.log('Statistics:');
  console.log(`  Total Requests: ${stats.totalRequests}`);
  console.log(`  Successful: ${stats.successfulRequests}`);
  console.log(`  Failed: ${stats.failedRequests}`);
  console.log(`  Rejected: ${stats.rejectedRequests}`);
  console.log(`  Current Failure Rate: ${stats.currentFailureRate.toFixed(2)}%`);
}

// ============================================================================
// Example 4: Circuit Breaker with Retry
// ============================================================================

async function exampleCircuitBreakerWithRetry() {
  console.log('\n=== Circuit Breaker with Retry Example ===\n');

  const circuitBreaker = new CircuitBreaker({
    serviceName: 'database-service',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
  });

  // Define retry policy
  const retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    initialBackoff: 100,
    maxBackoff: 1000,
    backoffMultiplier: 2, // Exponential backoff
    jitterEnabled: true,
    jitterFactor: 0.1,
    retryableStatuses: [503, 504, 507],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'],
  };

  // Mock database request that fails initially then succeeds
  let attemptCount = 0;
  const dbRequest = async () => {
    attemptCount++;

    if (attemptCount < 3) {
      const error: any = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    }

    return { data: 'query result', rows: 42 };
  };

  console.log('Executing request with retry policy:');

  try {
    const result = await circuitBreaker.execute(dbRequest, retryPolicy);
    console.log(`✓ Success after ${attemptCount} attempts`);
    console.log(`  Result: ${JSON.stringify(result)}`);
  } catch (error: any) {
    console.log(`✗ Failed after ${attemptCount} attempts`);
    console.log(`  Error: ${error.message}`);
  }

  console.log(`\nCircuit Breaker State: ${circuitBreaker.getState()}`);
}

// ============================================================================
// Example 5: Traffic Management (Canary Deployment)
// ============================================================================

async function exampleCanaryDeployment() {
  console.log('\n=== Canary Deployment Example ===\n');

  const trafficManager = new TrafficManager({
    enableMetrics: true,
    enableShadowing: false,
  });

  // Create a canary deployment
  const deploymentConfig: any = {
    id: 'feature-canary-123',
    name: 'New Checkout Flow',
    strategy: 'canary',
    versions: [
      {
        name: 'stable',
        weight: 90,
        instances: ['checkout-v1-1', 'checkout-v1-2', 'checkout-v1-3'],
        metadata: { version: '1.5.0' },
      },
      {
        name: 'canary',
        weight: 10,
        instances: ['checkout-v2-1'],
        metadata: { version: '2.0.0' },
      },
    ],
    canary: {
      version: 'canary',
      weight: 10, // Start with 10%
      incrementStep: 5, // Increase by 5% every interval
      incrementInterval: 300000, // Every 5 minutes
      maxWeight: 50, // Up to 50%
      metrics: {
        errorRate: 5, // Rollback if error rate > 5%
        latencyThreshold: 500, // Rollback if latency > 500ms
      },
      rollbackThreshold: 10,
    },
    status: 'pending',
    startTime: Date.now(),
  };

  trafficManager.createDeployment(deploymentConfig);
  trafficManager.startDeployment(deploymentConfig.id);
  console.log('✓ Created canary deployment');
  console.log(`  Stable version: 90% (v1.5.0)`);
  console.log(`  Canary version: 10% (v2.0.0)`);

  // Simulate traffic routing
  const versionCounts: Map<string, number> = new Map();

  const endpoints: any[] = [
    { id: 'checkout-v1-1', version: 'stable' },
    { id: 'checkout-v1-2', version: 'stable' },
    { id: 'checkout-v1-3', version: 'stable' },
    { id: 'checkout-v2-1', version: 'canary' },
  ];

  console.log('\nRouting 1000 requests:');

  for (let i = 0; i < 1000; i++) {
    const context = {
      method: 'POST',
      path: '/api/checkout',
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
      cookies: {
        session_id: `session-${i}`,
      },
    };

    const routing = await trafficManager.route('checkout-service', endpoints, context);
    const version = routing.metadata.version || 'unknown';

    const count = versionCounts.get(version) || 0;
    versionCounts.set(version, count + 1);
  }

  for (const [version, count] of versionCounts) {
    const percentage = ((count / 1000) * 100).toFixed(1);
    console.log(`  ${version}: ${count} requests (${percentage}%)`);
  }

  // Simulate canary promotion based on metrics
  console.log('\nSimulating canary progression...');

  // After positive metrics, increase canary weight
  setTimeout(() => {
    trafficManager.recordLatency('canary', 250); // Good latency
    trafficManager.recordError('canary'); // Low error rate

    const canaryStatus = (trafficManager as any).activeCanaries.get(deploymentConfig.id);
    if (canaryStatus) {
      canaryStatus.currentWeight = 15; // Increase to 15%
      console.log('  ✓ Increased canary weight to 15% (good metrics)');
    }
  }, 1000);

  // Get traffic statistics
  const stats = trafficManager.getStats();
  console.log('\nTraffic Manager Stats:');
  console.log(`  Total Requests: ${stats.totalRequests}`);
  console.log(`  Requests per Version:`);
  for (const [version, count] of stats.requestsPerVersion) {
    console.log(`    ${version}: ${count}`);
  }
}

// ============================================================================
// Example 6: Security Layer (mTLS)
// ============================================================================

async function exampleSecurityLayer() {
  console.log('\n=== Security Layer Example ===\n');

  const securityLayer = new SecurityLayer({
    mtlsEnabled: true,
    authEnabled: true,
    encryptionEnabled: true,
    keyRotationInterval: 86400000, // 24 hours
  });

  // Initialize with mTLS configuration
  await securityLayer.initialize({
    enabled: true,
    certAuthority: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
    clientCertificate: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
    clientPrivateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    minVersion: '1.3',
    cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'],
    verifyClient: 'require',
  });

  console.log('✓ Security layer initialized with mTLS');

  // Secure a request
  const requestData = new TextEncoder().encode(
    JSON.stringify({ action: 'transfer', amount: 1000 })
  );

  const { data: securedData, context } = await securityLayer.secureRequest(
    'payment-service',
    'bank-service',
    requestData.buffer
  );

  console.log('\nSecured Request:');
  console.log(`  Source: ${context.sourceService}`);
  console.log(`  Target: ${context.targetService}`);
  console.log(`  Authenticated: ${context.authenticated}`);
  console.log(`  Authorized: ${context.authorized}`);
  console.log(`  Encrypted: ${context.encrypted}`);

  // Verify and decrypt request
  const { verified, data: decryptedData } = await securityLayer.verifyRequest(
    securedData,
    context
  );

  console.log('\nVerified Request:');
  console.log(`  Verified: ${verified}`);
  console.log(`  Data length: ${decryptedData.byteLength} bytes`);

  // Add authorization policy
  securityLayer.addAuthPolicy({
    id: 'payment-policy',
    name: 'Payment Service Authorization',
    rules: [
      {
        id: 'allow-payment',
        source: 'checkout-service',
        destination: 'payment-service',
        methods: ['POST', 'GET'],
        paths: ['/api/payments/*'],
        action: 'allow',
      },
      {
        id: 'deny-admin',
        source: 'untrusted-service',
        destination: '*',
        methods: ['*'],
        paths: ['*'],
        action: 'deny',
      },
    ],
    defaultAction: 'deny',
  });

  console.log('\n✓ Added authorization policy');

  // Get security statistics
  const stats = securityLayer.getStats();
  console.log('\nSecurity Stats:');
  console.log(`  Authenticated Requests: ${stats.authenticatedRequests}`);
  console.log(`  Active Encryption Keys: ${stats.activeKeys}`);
  console.log(`  Cached Certificates: ${stats.cachedCertificates}`);
}

// ============================================================================
// Example 7: Complete Service Mesh Setup
// ============================================================================

async function exampleCompleteSetup() {
  console.log('\n=== Complete Service Mesh Setup ===\n');

  // This example shows how to set up a complete service mesh

  // 1. Service Registry
  const registryClient = createRegistryClient({
    SERVICE_REGISTRY: {
      idFromName: () => ({}),
      get: () => ({}),
    },
  });

  // 2. Load Balancer Pool
  const loadBalancerPool = new (require('../src/loadbalancer/balancer').LoadBalancerPool)();

  // 3. Circuit Breaker Manager
  const circuitBreakerManager = new CircuitBreakerManager({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });

  // 4. Traffic Manager
  const trafficManager = new TrafficManager({
    enableMetrics: true,
  });

  // 5. Security Layer
  const securityLayer = new SecurityLayer({
    mtlsEnabled: true,
    authEnabled: true,
    encryptionEnabled: true,
  });

  await securityLayer.initialize();

  console.log('✓ Service mesh components initialized');
  console.log('  - Service Registry');
  console.log('  - Load Balancer Pool');
  console.log('  - Circuit Breaker Manager');
  console.log('  - Traffic Manager');
  console.log('  - Security Layer');

  // Register a service
  const instance: ServiceInstance = {
    id: 'api-gateway-1',
    serviceName: 'api-gateway',
    host: 'api-gateway.prod.svc.cluster.local',
    port: 8443,
    protocol: 'https',
    metadata: {},
    healthStatus: 'healthy',
    lastHeartbeat: Date.now(),
    version: '3.0.0',
    tags: ['v3', 'production'],
    zone: 'us-east-1a',
    region: 'us-east-1',
    weight: 1,
  };

  await registryClient.register({
    serviceName: instance.serviceName,
    instance,
    ttl: 30000,
  });

  console.log('\n✓ Registered api-gateway service');

  // Make a request through the service mesh
  console.log('\nSimulating service mesh request flow:');

  const endpoints = await registryClient.discover({
    serviceName: 'api-gateway',
    healthyOnly: true,
  });

  const loadBalancer = loadBalancerPool.getBalancer('api-gateway', {
    strategy: { type: 'round-robin' },
    healthAware: true,
  });

  loadBalancer.updateEndpoints('api-gateway', endpoints.instances);

  const selected = loadBalancer.select('api-gateway', {
    timestamp: Date.now(),
  });

  console.log(`  Selected endpoint: ${selected!.endpoint.id}`);
  console.log(`  Health status: ${selected!.endpoint.healthStatus}`);

  const circuitBreaker = circuitBreakerManager.getBreaker('api-gateway');

  try {
    const mockRequest = async () => {
      return { status: 200, data: { message: 'Hello from service mesh!' } };
    };

    const result = await circuitBreaker.execute(mockRequest);
    console.log(`  Request completed: ${result.status}`);
  } catch (error) {
    console.log(`  Request failed: ${error}`);
  }

  console.log('\n✓ Service mesh request flow complete');
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  try {
    await exampleServiceRegistration();
    await exampleLoadBalancing();
    await exampleCircuitBreaker();
    await exampleCircuitBreakerWithRetry();
    await exampleCanaryDeployment();
    await exampleSecurityLayer();
    await exampleCompleteSetup();

    console.log('\n=== All Examples Complete ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run examples
// runExamples();

export {
  exampleServiceRegistration,
  exampleLoadBalancing,
  exampleCircuitBreaker,
  exampleCircuitBreakerWithRetry,
  exampleCanaryDeployment,
  exampleSecurityLayer,
  exampleCompleteSetup,
};
