/**
 * Complete Integration Example
 *
 * Demonstrates how the Unified Package Integration Layer and
 * Multi-Region Deployment System work together in a real-world scenario.
 *
 * This example shows:
 * 1. Setting up the integration manager
 * 2. Registering packages with the adapter
 * 3. Creating and executing deployments
 * 4. Handling failover and rollback scenarios
 * 5. Monitoring and observability
 */

import {
  createIntegrationManager,
  createServiceAdapter,
  type PackageMetadata,
  type PackageIdentifier,
} from '../integration';
import {
  createDeploymentManager,
  type DeploymentConfig,
  type Region,
} from '../deployment';

// ============================================================================
// Scenario: E-commerce Platform with Microservices
// ============================================================================

/**
 * This example demonstrates deploying an e-commerce platform with the following services:
 * - Product Catalog Service
 * - Inventory Service
 * - Order Processing Service
 * - Payment Service
 * - Notification Service
 *
 * Each service is deployed across multiple regions with canary releases.
 */

async function deployEcommercePlatform() {
  console.log('=== E-Commerce Platform Deployment Example ===\n');

  // 1. Create the integration manager
  console.log('1. Creating integration manager...');
  const integrationManager = createIntegrationManager({
    enableAutoDiscovery: true,
    enableAutoHealthMonitoring: true,
    enableAutoReconnect: true,
  });

  await integrationManager.start();
  console.log('✓ Integration manager started\n');

  // 2. Register all services using the adapter
  console.log('2. Registering services...');

  // Product Catalog Service
  const productCatalog = createServiceAdapter(
    integrationManager,
    {
      name: '@ecommerce/product-catalog',
      version: '2.0.0',
      instanceId: 'product-catalog-prod',
    },
    [
      {
        name: 'get-products',
        version: '1.0.0',
        description: 'Retrieve product listings',
        handler: async (input: { category?: string; limit?: number }) => {
          return {
            products: [
              { id: '1', name: 'Laptop', price: 999.99, category: 'electronics' },
              { id: '2', name: 'Phone', price: 699.99, category: 'electronics' },
            ],
            total: 2,
          };
        },
      },
      {
        name: 'get-product-details',
        version: '1.0.0',
        description: 'Get detailed product information',
        handler: async (input: { productId: string }) => {
          return {
            id: input.productId,
            name: 'Laptop',
            price: 999.99,
            description: 'High-performance laptop',
            stock: 50,
          };
        },
      },
    ],
    {
      tags: ['catalog', 'products', 'read-heavy'],
      healthCheck: {
        handler: async () => true,
        interval: 30000,
      },
    }
  );

  await productCatalog.register();
  console.log('  ✓ Product Catalog Service registered');

  // Inventory Service
  const inventory = createServiceAdapter(
    integrationManager,
    {
      name: '@ecommerce/inventory',
      version: '2.0.0',
      instanceId: 'inventory-prod',
    },
    [
      {
        name: 'check-stock',
        version: '1.0.0',
        description: 'Check product availability',
        handler: async (input: { productId: string; quantity: number }) => {
          return {
            available: true,
            stock: 50,
            backordered: false,
          };
        },
      },
      {
        name: 'reserve-stock',
        version: '1.0.0',
        description: 'Reserve inventory for order',
        handler: async (input: { productId: string; quantity: number }) => {
          return {
            reserved: true,
            reservationId: 'res-' + Date.now(),
            expiresAt: Date.now() + 900000, // 15 minutes
          };
        },
      },
    ],
    {
      tags: ['inventory', 'stock', 'critical'],
      dependencies: ['@ecommerce/product-catalog'],
      healthCheck: {
        handler: async () => true,
        interval: 15000,
      },
    }
  );

  await inventory.register();
  console.log('  ✓ Inventory Service registered');

  // Order Processing Service
  const orderProcessing = createServiceAdapter(
    integrationManager,
    {
      name: '@ecommerce/order-processing',
      version: '2.0.0',
      instanceId: 'order-processing-prod',
    },
    [
      {
        name: 'create-order',
        version: '1.0.0',
        description: 'Create a new order',
        handler: async (input: {
          items: Array<{ productId: string; quantity: number }>;
          customerId: string;
        }) => {
          return {
            orderId: 'ord-' + Date.now(),
            status: 'pending',
            total: 1699.98,
            createdAt: Date.now(),
          };
        },
      },
      {
        name: 'get-order-status',
        version: '1.0.0',
        description: 'Get order status',
        handler: async (input: { orderId: string }) => {
          return {
            orderId: input.orderId,
            status: 'processing',
            items: [
              { productId: '1', quantity: 1, price: 999.99 },
              { productId: '2', quantity: 1, price: 699.99 },
            ],
            total: 1699.98,
          };
        },
      },
    ],
    {
      tags: ['orders', 'transactions', 'critical'],
      dependencies: ['@ecommerce/inventory', '@ecommerce/payment'],
      priority: 100,
      healthCheck: {
        handler: async () => true,
        interval: 10000,
      },
    }
  );

  await orderProcessing.register();
  console.log('  ✓ Order Processing Service registered');

  // Payment Service
  const payment = createServiceAdapter(
    integrationManager,
    {
      name: '@ecommerce/payment',
      version: '2.0.0',
      instanceId: 'payment-prod',
    },
    [
      {
        name: 'process-payment',
        version: '1.0.0',
        description: 'Process payment transaction',
        handler: async (input: {
          orderId: string;
          amount: number;
          method: string;
        }) => {
          return {
            paymentId: 'pay-' + Date.now(),
            status: 'completed',
            amount: input.amount,
            processedAt: Date.now(),
          };
        },
      },
    ],
    {
      tags: ['payment', 'financial', 'pci-compliant'],
      dependencies: ['@ecommerce/order-processing'],
      priority: 100,
      healthCheck: {
        handler: async () => true,
        interval: 5000,
      },
    }
  );

  await payment.register();
  console.log('  ✓ Payment Service registered');

  // Notification Service
  const notification = createServiceAdapter(
    integrationManager,
    {
      name: '@ecommerce/notification',
      version: '2.0.0',
      instanceId: 'notification-prod',
    },
    [
      {
        name: 'send-confirmation',
        version: '1.0.0',
        description: 'Send order confirmation',
        handler: async (input: { orderId: string; customerId: string }) => {
          return {
            sent: true,
            method: 'email',
            to: 'customer@example.com',
            at: Date.now(),
          };
        },
      },
    ],
    {
      tags: ['notification', 'email', 'sms'],
      dependencies: ['@ecommerce/order-processing'],
    }
  );

  await notification.register();
  console.log('  ✓ Notification Service registered\n');

  // 3. Create deployment manager
  console.log('3. Creating deployment manager...');
  const deploymentManager = createDeploymentManager({
    enableAutoRollback: true,
    enableMetrics: true,
    enableEventLogging: true,
    healthCheckInterval: 30000,
  });
  console.log('✓ Deployment manager created\n');

  // 4. Deploy services across regions using canary strategy
  console.log('4. Deploying services across regions...');

  const regions: Region[] = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

  for (const service of ['product-catalog', 'inventory', 'order-processing', 'payment', 'notification']) {
    const deploymentConfig: DeploymentConfig = {
      id: `deploy-${service}-2.0.0`,
      version: {
        version: '2.0.0',
        commitSha: 'abc123' + service,
        buildTime: Date.now(),
        metadata: {
          author: 'CI/CD Pipeline',
          branch: 'main',
          message: `Release ${service} v2.0.0`,
        },
      },
      regions,
      strategy: 'canary',
      canary: {
        initialPercentage: 10,
        incrementPercentage: 10,
        incrementInterval: 60000, // 1 minute (faster for demo)
        autoPromoteThreshold: 0.01, // 1% error rate
        autoRollbackThreshold: 0.05, // 5% error rate
      },
      healthCheck: {
        endpoint: '/health',
        interval: 30000,
        timeout: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      },
      rollback: {
        autoRollback: true,
        trigger: 'error-rate',
        threshold: 0.05,
        timeout: 300000, // 5 minutes
      },
      trafficRules: [
        {
          id: `internal-traffic-${service}`,
          type: 'header',
          priority: 100,
          condition: {
            version: '2.0.0',
            header: {
              name: 'x-internal-traffic',
              value: 'true',
            },
          },
          enabled: true,
        },
        {
          id: `beta-users-${service}`,
          type: 'cookie',
          priority: 90,
          condition: {
            version: '2.0.0',
            cookie: {
              name: 'beta_user',
              value: 'true',
            },
          },
          enabled: true,
        },
      ],
    };

    // Create deployment
    const deploymentId = await deploymentManager.createDeployment(deploymentConfig);
    console.log(`  ✓ Created deployment for ${service}: ${deploymentId}`);

    // Start deployment
    await deploymentManager.startDeployment(deploymentId);
    console.log(`  ✓ Started deployment for ${service}`);
  }

  console.log('\n5. Deployment summary:');
  const stats = integrationManager.getStatistics();
  console.log(`  Registered packages: ${stats.registry.totalPackages}`);
  console.log(`  Healthy packages: ${stats.registry.packagesByHealth.healthy}`);
  console.log(`  Active deployments: ${deploymentManager.getAllDeployments().filter(d => d.status === 'deploying').length}`);

  // 6. Demonstrate service invocation
  console.log('\n6. Testing service invocation...');

  const orchestrator = integrationManager.getOrchestrator();

  // Get products
  const products = await orchestrator.invokeDiscovered(
    'get-products',
    { category: 'electronics', limit: 10 }
  );
  console.log('  Products:', products.data);

  // Check stock
  const stock = await orchestrator.invokeDiscovered(
    'check-stock',
    { productId: '1', quantity: 1 }
  );
  console.log('  Stock:', stock.data);

  // Create order
  const order = await orchestrator.invokeDiscovered(
    'create-order',
    {
      items: [{ productId: '1', quantity: 1 }],
      customerId: 'cust-123',
    }
  );
  console.log('  Order:', order.data);

  // 7. Monitor deployment progress
  console.log('\n7. Monitoring deployment progress...');

  const activeDeployment = deploymentManager.getActiveDeployment();
  if (activeDeployment) {
    console.log(`  Active deployment: ${activeDeployment.config.id}`);
    console.log(`  Status: ${activeDeployment.status}`);
    console.log(`  Regions: ${Array.from(activeDeployment.regions.keys()).join(', ')}`);

    for (const [region, regionState] of activeDeployment.regions) {
      console.log(`    ${region}: ${regionState.status} (${regionState.health})`);
    }

    // Show traffic routing
    console.log('\n8. Traffic routing demo:');
    const testRequest = new Request('https://api.example.com/products', {
      headers: {
        'x-internal-traffic': 'true',
      },
    });

    const routing = deploymentManager.routeTraffic(activeDeployment.config.id, testRequest);
    console.log(`  Request routed to: ${routing.version} in ${routing.region}`);
    console.log(`  Reason: ${routing.reason}`);
    if (routing.matchedRule) {
      console.log(`  Matched rule: ${routing.matchedRule.id}`);
    }
  }

  // 9. Cleanup
  console.log('\n9. Cleaning up...');
  await integrationManager.stop();
  deploymentManager.dispose();
  console.log('✓ Cleanup complete');

  return {
    integrationManager,
    deploymentManager,
    services: {
      productCatalog,
      inventory,
      orderProcessing,
      payment,
      notification,
    },
  };
}

// ============================================================================
// Scenario: Handling Failure and Rollback
// ============================================================================

async function demonstrateRollback() {
  console.log('\n=== Rollback Demonstration ===\n');

  const integrationManager = createIntegrationManager();
  await integrationManager.start();

  const deploymentManager = createDeploymentManager({
    enableAutoRollback: true,
  });

  // Create a service that will fail
  const failingService = createServiceAdapter(
    integrationManager,
    {
      name: '@example/failing-service',
      version: '2.0.0',
      instanceId: 'failing-1',
    },
    [
      {
        name: 'failing-operation',
        version: '1.0.0',
        description: 'This operation will fail',
        handler: async () => {
          throw new Error('Simulated failure');
        },
      },
    ],
    {
      healthCheck: {
        handler: async () => false, // Always unhealthy
        interval: 5000,
      },
    }
  );

  await failingService.register();

  // Create deployment
  const deploymentId = await deploymentManager.createDeployment({
    id: 'deploy-failing-2.0.0',
    version: {
      version: '2.0.0',
      commitSha: 'bad123',
      buildTime: Date.now(),
    },
    regions: ['us-east-1'],
    strategy: 'canary',
    canary: {
      initialPercentage: 10,
      incrementPercentage: 10,
      incrementInterval: 10000,
      autoPromoteThreshold: 0.01,
      autoRollbackThreshold: 0.01, // 1% threshold triggers rollback
    },
    healthCheck: {
      endpoint: '/health',
      interval: 5000,
      timeout: 1000,
      unhealthyThreshold: 2,
      healthyThreshold: 2,
    },
    rollback: {
      autoRollback: true,
      trigger: 'error-rate',
      threshold: 0.01,
    },
  });

  console.log('Created deployment with failing service');
  console.log('Starting deployment (will auto-rollback)...');

  await deploymentManager.startDeployment(deploymentId);

  // Wait for rollback
  await new Promise((resolve) => setTimeout(resolve, 15000));

  const deployment = deploymentManager.getDeployment(deploymentId);
  console.log(`\nDeployment status: ${deployment?.status}`);
  console.log('Rollback triggered due to health check failures!');

  await integrationManager.stop();
  deploymentManager.dispose();
}

// ============================================================================
// Run examples
// ============================================================================

export async function runExamples() {
  try {
    await deployEcommercePlatform();
    await demonstrateRollback();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in tests or manual execution
export const examples = {
  deployEcommercePlatform,
  demonstrateRollback,
};

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runExamples().catch(console.error);
}
