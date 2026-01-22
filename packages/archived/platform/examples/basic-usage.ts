/**
 * Basic Usage Example
 *
 * This example demonstrates how to use the ClaudeFlare Platform
 * for production-ready application initialization and management.
 */

import {
  initPlatform,
  getPlatform,
  shutdownPlatform,
  EnhancedConfigManager,
  HealthMonitor,
  ShutdownHandler,
  PerformanceOptimizer,
  ReadinessChecker,
  createHealthMonitor,
  createShutdownHandler,
  createReadinessChecker,
} from '@claudeflare/platform';

/**
 * Example 1: Basic Platform Initialization
 */
async function basicInitialization() {
  console.log('=== Basic Platform Initialization ===\n');

  // Initialize the platform with default settings
  const result = await initPlatform({
    environment: {
      mode: 'production',
      debug: false,
      metrics: true,
      tracing: false,
    },
    autoStart: true,
    enableDiscovery: true,
    enableHealthChecks: true,
    enableShutdownHooks: true,
    enablePerformanceOptimization: true,
  });

  console.log('Platform initialized:', result.success);
  console.log('Duration:', result.duration, 'ms');
  console.log('Readiness score:', result.readinessScore);
  console.log('Services started:', result.services.length);

  // Get platform instance
  const platform = getPlatform();
  const health = await platform.getHealth();
  console.log('Platform health:', health.status);
}

/**
 * Example 2: Advanced Configuration Management
 */
async function advancedConfiguration() {
  console.log('\n=== Advanced Configuration Management ===\n');

  // Create enhanced configuration manager
  const config = new EnhancedConfigManager({
    versioning: true,
    secretInjection: true,
    cacheEnabled: true,
    validationMode: 'strict',
  });

  // Set configuration values
  await config.set('database.host', 'localhost', {
    source: 'config',
    tags: ['database', 'connection'],
  });

  await config.set('database.port', 5432, {
    source: 'config',
    tags: ['database', 'connection'],
  });

  await config.set('database.ssl', true, {
    source: 'config',
    tags: ['database', 'security'],
  });

  // Add schema for validation
  config.addSchema('database.port', {
    type: 'number',
    minimum: 1,
    maximum: 65535,
    description: 'Database port number',
  });

  // Get configuration
  const host = await config.get('database.host');
  const port = await config.getOrDefault('database.port', 3306);
  const ssl = await config.get('database.ssl');

  console.log('Database config:');
  console.log('  Host:', host);
  console.log('  Port:', port);
  console.log('  SSL:', ssl);

  // Watch for changes
  config.watch('database.host', async (value) => {
    console.log('Database host changed:', value.value);
  });

  // Get all configuration
  const allConfig = await config.getAll();
  console.log('\nAll configuration:', Object.keys(allConfig).length, 'keys');

  // Get configuration versions
  await config.set('database.host', 'remote-host', {
    source: 'runtime',
    author: 'admin',
    reason: 'Failover to backup',
  });

  const versions = await config.getVersions('database.host');
  console.log('\nConfiguration versions:', versions.length);

  // Rollback if needed
  if (versions.length > 1) {
    await config.rollback('database.host', versions[0].version);
    console.log('Rolled back to version:', versions[0].version);
  }

  // Export configuration
  const exported = await config.export({
    includeMetadata: true,
    includeVersions: true,
    redactSecrets: true,
  });

  console.log('\nExported configuration:', Object.keys(exported).length, 'entries');
}

/**
 * Example 3: Health Monitoring
 */
async function healthMonitoring() {
  console.log('\n=== Health Monitoring ===\n');

  // Create health monitor
  const healthMonitor = createHealthMonitor({
    checkInterval: 30000,
    timeout: 10000,
    autoRecovery: true,
  });

  await healthMonitor.initialize();

  // Add custom health check
  healthMonitor.registerCheck('api', {
    name: 'api',
    check: async () => {
      // Simulate API health check
      const startTime = Date.now();
      // await fetch('/health');
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        return {
          status: 'degraded',
          details: { latency: duration },
        };
      }

      return {
        status: 'healthy',
        details: { latency: duration },
      };
    },
    interval: 10000,
    critical: true,
  });

  // Add recovery action
  healthMonitor.registerRecoveryAction('api', {
    name: 'restart-api',
    condition: (state) => state.consecutiveFailures >= 3,
    action: async () => {
      console.log('Attempting API recovery...');
      // Restart service logic
    },
  });

  // Check all health
  const results = await healthMonitor.checkAll();
  console.log('Health checks:', results.length);

  for (const result of results) {
    console.log(`  ${result.name}: ${result.status}`);
  }

  // Get health report
  const report = await healthMonitor.getReport();
  console.log('\nHealth Report:');
  console.log('  Status:', report.globalStatus);
  console.log('  Total checks:', report.summary.total);
  console.log('  Healthy:', report.summary.healthy);
  console.log('  Degraded:', report.summary.degraded);
  console.log('  Unhealthy:', report.summary.unhealthy);
  console.log('  Uptime:', report.summary.uptime, 'ms');
  console.log('  Avg response time:', report.summary.averageResponseTime, 'ms');
}

/**
 * Example 4: Graceful Shutdown
 */
async function gracefulShutdown() {
  console.log('\n=== Graceful Shutdown ===\n');

  // Create shutdown handler
  const shutdownHandler = createShutdownHandler({
    timeout: 10000,
    drainTimeout: 5000,
    enableSignals: true,
  });

  await shutdownHandler.initialize();

  // Register cleanup hooks
  shutdownHandler.registerCleanup({
    name: 'database',
    priority: 100,
    timeout: 5000,
    cleanup: async () => {
      console.log('Closing database connections...');
      // Close database connections
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log('Database connections closed');
    },
    forceCleanup: async () => {
      console.log('Force closing database connections...');
    },
  });

  shutdownHandler.registerCleanup({
    name: 'cache',
    priority: 90,
    timeout: 3000,
    cleanup: async () => {
      console.log('Flushing cache...');
      // Flush cache to disk
      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log('Cache flushed');
    },
  });

  shutdownHandler.registerCleanup({
    name: 'logs',
    priority: 80,
    timeout: 2000,
    cleanup: async () => {
      console.log('Flushing logs...');
      // Flush logs
      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log('Logs flushed');
    },
  });

  // Track in-flight requests
  shutdownHandler.trackRequest('req-1', 'http');
  shutdownHandler.trackRequest('req-2', 'http');
  shutdownHandler.trackRequest('req-3', 'websocket');

  console.log('In-flight requests:', shutdownHandler.getInFlightCount());

  // Complete some requests
  shutdownHandler.completeRequest('req-1');
  console.log('In-flight requests:', shutdownHandler.getInFlightCount());

  // Simulate shutdown
  console.log('\nInitiating shutdown...');
  await shutdownHandler.shutdown('maintenance');

  const status = shutdownHandler.getStatus();
  console.log('\nShutdown status:');
  console.log('  State:', status.state);
  console.log('  Duration:', status.duration, 'ms');
  console.log('  Hooks executed:', status.hooksExecuted, '/', status.hooksTotal);
  console.log('  Errors:', status.errors.length);
}

/**
 * Example 5: Performance Optimization
 */
async function performanceOptimization() {
  console.log('\n=== Performance Optimization ===\n');

  // Create performance optimizer
  const optimizer = new PerformanceOptimizer({
    enabled: true,
    autoTune: true,
    monitoring: true,
    optimizationInterval: 60000,
  });

  await optimizer.initialize();

  // Configure connection pool
  optimizer.configureConnectionPool('database', {
    maxConnections: 20,
    minConnections: 5,
    acquireTimeout: 10000,
    idleTimeout: 30000,
    maxLifetime: 3600000,
  });

  // Configure cache
  optimizer.configureCache('api-cache', {
    maxSize: 1000,
    ttl: 3600000,
    strategy: 'lru',
    compression: true,
  });

  // Enable optimizations
  await optimizer.enableMemoryOptimization();
  await optimizer.enableConnectionPooling();
  await optimizer.enableCaching();

  // Get current metrics
  const metrics = optimizer.getMetrics();
  console.log('Performance metrics:');
  console.log('  Memory usage:', metrics.memoryUsage.percentage * 100, '%');
  console.log('  CPU usage:', metrics.cpuUsage * 100, '%');
  console.log('  Response time:', metrics.responseTime, 'ms');
  console.log('  Throughput:', metrics.throughput, 'req/s');
  console.log('  Error rate:', metrics.errorRate * 100, '%');
  console.log('  Cache hit rate:', metrics.cacheHitRate * 100, '%');

  // Run optimization
  await optimizer.optimize();
  console.log('\nOptimization completed');
}

/**
 * Example 6: Production Readiness Checks
 */
async function productionReadiness() {
  console.log('\n=== Production Readiness Checks ===\n');

  // Create readiness checker
  const checker = createReadinessChecker();

  // Add custom checks
  checker.registerCheck('environment', async () => {
    const hasRequiredEnvVars =
      process.env.DATABASE_URL &&
      process.env.API_KEY &&
      process.env.SECRET_KEY;

    return {
      name: 'environment',
      status: hasRequiredEnvVars ? 'pass' : 'fail',
      message: hasRequiredEnvVars
        ? 'All required environment variables are set'
        : 'Missing required environment variables',
      critical: true,
    };
  });

  checker.registerCheck('database', async () => {
    // Check database connectivity
    try {
      // await database.query('SELECT 1');
      return {
        name: 'database',
        status: 'pass',
        message: 'Database is accessible',
        critical: true,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        message: `Database connection failed: ${error}`,
        critical: true,
      };
    }
  });

  checker.registerCheck('storage', async () => {
    // Check storage availability
    const hasEnoughSpace = true; // Check disk space

    if (hasEnoughSpace) {
      return {
        name: 'storage',
        status: 'pass',
        message: 'Sufficient storage available',
        critical: true,
      };
    } else {
      return {
        name: 'storage',
        status: 'warn',
        message: 'Storage space is low',
        critical: false,
      };
    }
  });

  // Run readiness checks
  const result = await checker.check();

  console.log('Readiness score:', result.score);
  console.log('Status:', result.status);
  console.log('\nSummary:');
  console.log('  Passed:', result.summary.passed);
  console.log('  Failed:', result.summary.failed);
  console.log('  Warnings:', result.summary.warnings);
  console.log('  Total:', result.summary.total);

  console.log('\nChecks:');
  for (const check of result.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    console.log(`  ${icon} ${check.name}: ${check.message}`);
  }

  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of result.recommendations) {
      console.log('  -', rec);
    }
  }

  console.log('\nProduction ready:', result.status === 'ready');
}

/**
 * Example 7: Complete Workflow
 */
async function completeWorkflow() {
  console.log('=== Complete Platform Workflow ===\n');

  try {
    // 1. Initialize platform
    console.log('1. Initializing platform...');
    const initResult = await initPlatform({
      environment: {
        mode: 'production',
        debug: false,
      },
      autoStart: true,
      enableHealthChecks: true,
      enableShutdownHooks: true,
      enablePerformanceOptimization: true,
    });

    if (!initResult.success) {
      console.error('Platform initialization failed');
      return;
    }

    console.log('✓ Platform initialized');

    // 2. Run readiness checks
    console.log('\n2. Running readiness checks...');
    const checker = createReadinessChecker();
    const readinessResult = await checker.check();

    console.log(`✓ Readiness score: ${readinessResult.score}/100`);

    if (readinessResult.status !== 'ready') {
      console.warn('Platform is not fully ready');
    }

    // 3. Monitor health
    console.log('\n3. Checking health...');
    const platform = getPlatform();
    const health = await platform.getHealth();

    console.log(`✓ Platform health: ${health.status}`);
    console.log(`  Services: ${health.services.length}`);

    // 4. Run for some time
    console.log('\n4. Platform running...');
    console.log('Press Ctrl+C to shutdown gracefully');

    // Simulate running
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 5. Shutdown
    console.log('\n5. Shutting down...');
    await shutdownPlatform('normal-exit');

    console.log('✓ Platform shutdown complete');
  } catch (error) {
    console.error('Error:', error);
    await shutdownPlatform('error');
  }
}

/**
 * Run examples
 */
async function main() {
  console.log('ClaudeFlare Platform Examples\n');

  try {
    // await basicInitialization();
    // await advancedConfiguration();
    // await healthMonitoring();
    // await gracefulShutdown();
    // await performanceOptimization();
    // await productionReadiness();
    await completeWorkflow();
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
