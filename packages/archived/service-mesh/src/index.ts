/**
 * ClaudeFlare Service Mesh
 * Enterprise-grade service mesh and microservices infrastructure
 */

// ========================================================================
// Type Definitions
// ========================================================================

export * from './types';

// ========================================================================
// Service Discovery
// ========================================================================

export { ServiceRegistry } from './discovery/service-registry';
export { ServiceDiscoveryClient } from './discovery/client';
export { ServiceLoadBalancer } from './discovery/load-balancer';

// ========================================================================
// Circuit Breaker
// ========================================================================

export { CircuitBreaker } from './circuit/breaker';
export { CircuitBreakerStore } from './circuit/store';

// ========================================================================
// Retry and Timeout
// ========================================================================

export {
  RetryExecutor,
  BackoffStrategies,
  RetryConditions,
  retryable
} from './retry/policy';

export {
  TimeoutManager,
  TimeoutError,
  TimeoutStrategy,
  AdaptiveTimeoutManager,
  TimeoutChain,
  timeoutable
} from './retry/timeout';

// ========================================================================
// Communication
// ========================================================================

export {
  ServiceHttpClient,
  RequestBuilder
} from './communication/http-client';

// ========================================================================
// Observability
// ========================================================================

export {
  MetricsCollector,
  MetricsExporter
} from './observability/metrics';

export {
  Tracer,
  TraceScope,
  createTracingMiddleware
} from './observability/tracing';

// ========================================================================
// Traffic Management
// ========================================================================

export {
  TrafficManager,
  TrafficSplitController
} from './traffic/manager';

// ========================================================================
// Control Plane
// ========================================================================

export {
  ServiceMeshControlPlane,
  ControlPlaneAPI
} from './control/plane';

// ========================================================================
// Sidecar Proxy
// ========================================================================

export {
  SidecarProxy,
  ProxyManager
} from './proxy/sidecar';

// ========================================================================
// Utilities
// ========================================================================

export {
  generateId,
  generateUUID,
  sleep,
  retryWithBackoff,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  isObject,
  calculatePercentage,
  calculatePercentile,
  formatDuration,
  formatBytes,
  parseDuration,
  isValidUrl,
  extractHostname,
  deepEqual,
  createTimeoutPromise,
  promiseWithTimeout,
  chunk,
  slidingWindow,
  groupBy,
  CircularBuffer,
  ExponentialMovingAverage,
  TokenBucket,
  hashString,
  ConsistentHashRing
} from './utils/helpers';

// ========================================================================
// Convenience Factory Functions
// ========================================================================

import { ServiceMeshControlPlane } from './control/plane';
import { ServiceDiscoveryClient } from './discovery/client';
import { ServiceHttpClient } from './communication/http-client';
import { MetricsCollector } from './observability/metrics';
import { Tracer } from './observability/tracing';
import { TrafficManager } from './traffic/manager';

/**
 * Create a complete service mesh setup
 */
export function createServiceMesh(meshId: string, options: {
  registryUrl: string;
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableTrafficManagement?: boolean;
}) {
  const controlPlane = new ServiceMeshControlPlane(meshId);
  const discoveryClient = new ServiceDiscoveryClient({ registryUrl: options.registryUrl });
  const httpClient = new ServiceHttpClient({
    enableCircuitBreaker: true,
    enableRetry: true,
    enableMetrics: options.enableMetrics ?? true
  });

  let metricsCollector: MetricsCollector | undefined;
  let tracer: Tracer | undefined;
  let trafficManager: TrafficManager | undefined;

  if (options.enableMetrics) {
    metricsCollector = new MetricsCollector();
  }

  if (options.enableTracing) {
    tracer = new Tracer(meshId);
  }

  if (options.enableTrafficManagement) {
    trafficManager = new TrafficManager();
  }

  return {
    meshId,
    controlPlane,
    discoveryClient,
    httpClient,
    metricsCollector,
    tracer,
    trafficManager,

    async shutdown() {
      // Cleanup resources
      await discoveryClient.destroy();

      if (metricsCollector) {
        metricsCollector.clear();
      }

      if (tracer) {
        tracer.clearTraces();
      }

      controlPlane.destroy();
    }
  };
}

/**
 * Create a sidecar proxy instance
 */
export function createSidecarProxy(config: {
  proxyId: string;
  serviceName: string;
  namespace: string;
  upstreams: Array<{
    name: string;
    service: string;
    port: number;
  }>;
}) {
  const { SidecarProxy } = require('./proxy/sidecar');

  const proxyConfig = {
    ...config,
    meshId: 'claudeflare-mesh',
    listeningPorts: [
      {
        name: 'http',
        port: 8080,
        protocol: 'http'
      }
    ],
    upstreams: config.upstreams.map(u => ({
      ...u,
      protocol: 'http' as const,
      loadBalancing: { type: 'round-robin' as const },
      timeout: {
        connection: 10000,
        request: 30000,
        idle: 60000
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
        path: '/health'
      }
    })),
    filters: [],
    resources: {
      cpu: '1000m',
      memory: '512Mi',
      connections: 10000,
      requestsPerSecond: 1000
    },
    metadata: {}
  };

  return new SidecarProxy(proxyConfig);
}

// ========================================================================
// Version
// ========================================================================

export const VERSION = '0.1.0';

// ========================================================================
// Default Exports
// ========================================================================

export default {
  VERSION,
  createServiceMesh,
  createSidecarProxy
};
