/**
 * Unified Package Integration Layer
 *
 * Standardized interfaces for package communication, service discovery,
 * and orchestration across all 116 packages in the ClaudeFlare ecosystem.
 */

/**
 * Package identifier with version
 */
export interface PackageIdentifier {
  /**
   * Package name (e.g., "@claudeflare/streaming")
   */
  name: string;

  /**
   * Package version
   */
  version: string;

  /**
   * Unique instance ID for runtime
   */
  instanceId: string;
}

/**
 * Package capability descriptor
 */
export interface PackageCapability {
  /**
   * Capability name (e.g., "stream-processing", "vector-search")
   */
  name: string;

  /**
   * Capability version
   */
  version: string;

  /**
   * Capability description
   */
  description?: string;

  /**
   * Input schema for this capability
   */
  inputSchema?: Record<string, unknown>;

  /**
   * Output schema for this capability
   */
  outputSchema?: Record<string, unknown>;

  /**
   * Required dependencies for this capability
   */
  dependencies?: string[];

  /**
   * Resource requirements
   */
  resources?: {
    memory?: number;
    cpu?: number;
    timeout?: number;
  };
}

/**
 * Package metadata
 */
export interface PackageMetadata {
  /**
   * Package identifier
   */
  id: PackageIdentifier;

  /**
   * Package type
   */
  type: 'service' | 'library' | 'agent' | 'durable-object' | 'middleware';

  /**
   * Package capabilities
   */
  capabilities: PackageCapability[];

  /**
   * Package dependencies
   */
  dependencies: string[];

  /**
   * Health check endpoint/path
   */
  healthCheck?: string;

  /**
   * Package location/endpoint
   */
  location?: {
    type: 'local' | 'remote' | 'durable-object';
    endpoint?: string;
    doId?: string;
  };

  /**
   * Package tags
   */
  tags?: string[];

  /**
   * Package priority (higher = more important)
   */
  priority?: number;
}

/**
 * Package health status
 */
export type PackageHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Package health check result
 */
export interface PackageHealth {
  /**
   * Package identifier
   */
  package: PackageIdentifier;

  /**
   * Health status
   */
  status: PackageHealthStatus;

  /**
   * Last check timestamp
   */
  timestamp: number;

  /**
   * Health metrics
   */
  metrics?: {
    /**
     * Response time in milliseconds
     */
    responseTime?: number;

    /**
     * Memory usage in bytes
     */
    memoryUsage?: number;

    /**
     * CPU usage percentage
     */
    cpuUsage?: number;

    /**
     * Error rate
     */
    errorRate?: number;

    /**
     * Request count
     */
    requestCount?: number;
  };

  /**
   * Additional health data
   */
  data?: Record<string, unknown>;
}

/**
 * Service discovery request
 */
export interface ServiceDiscoveryRequest {
  /**
   * Capability name to discover
   */
  capability?: string;

  /**
   * Package type filter
   */
  type?: PackageMetadata['type'];

  /**
   * Tags filter
   */
  tags?: string[];

  /**
   * Minimum health status
   */
  minHealth?: PackageHealthStatus;

  /**
   * Maximum response time in milliseconds
   */
  maxResponseTime?: number;

  /**
   * Preferred package (if multiple available)
   */
  preferred?: string[];
}

/**
 * Service discovery result
 */
export interface ServiceDiscoveryResult {
  /**
   * Available packages
   */
  packages: Array<{
    metadata: PackageMetadata;
    health: PackageHealth;
  }>;

  /**
   * Selected package (best match)
   */
  selected?: {
    metadata: PackageMetadata;
    health: PackageHealth;
  };

  /**
   * Discovery timestamp
   */
  timestamp: number;
}

/**
 * Package invocation request
 */
export interface PackageInvocationRequest {
  /**
   * Target package
   */
  target: PackageIdentifier;

  /**
   * Capability to invoke
   */
  capability: string;

  /**
   * Input data
   */
  input: unknown;

  /**
   * Invocation options
   */
  options?: {
    /**
     * Timeout in milliseconds
     */
    timeout?: number;

    /**
     * Retry count
     */
    retries?: number;

    /**
     * Request ID for tracing
     */
    requestId?: string;

    /**
     * Additional metadata
     */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Package invocation response
 */
export interface PackageInvocationResponse {
  /**
   * Response data
   */
  data: unknown;

  /**
   * Response status
   */
  status: 'success' | 'error' | 'partial';

  /**
   * Response metadata
   */
  metadata?: {
    /**
     * Processing time in milliseconds
     */
    processingTime?: number;

    /**
     * Package that handled the request
     */
    package?: PackageIdentifier;

    /**
     * Capability that was invoked
     */
    capability?: string;

    /**
     * Error details (if status is error)
     */
    error?: {
      code: string;
      message: string;
      stack?: string;
    };
  };
}

/**
 * Package event
 */
export interface PackageEvent {
  /**
   * Event ID
   */
  id: string;

  /**
   * Event type
   */
  type: string;

  /**
   * Event source
   */
  source: PackageIdentifier;

  /**
   * Event timestamp
   */
  timestamp: number;

  /**
   * Event data
   */
  data: unknown;

  /**
   * Event metadata
   */
  metadata?: {
    /**
     * Correlation ID
     */
    correlationId?: string;

    /**
     * Causation ID (event that caused this event)
     */
    causationId?: string;

    /**
     * Event version
     */
    version?: string;
  };
}

/**
 * Event subscription
 */
export interface EventSubscription {
  /**
   * Subscription ID
   */
  id: string;

  /**
   * Event types to subscribe to
   */
  eventTypes: string[];

  /**
   * Package to notify
   */
  subscriber: PackageIdentifier;

  /**
   * Filter function (returns true if event matches)
   */
  filter?: (event: PackageEvent) => boolean;

  /**
   * Handler for matching events
   */
  handler: (event: PackageEvent) => Promise<void>;
}

/**
 * Package registry configuration
 */
export interface PackageRegistryConfig {
  /**
   * Enable service discovery
   */
  enableDiscovery?: boolean;

  /**
   * Enable health monitoring
   */
  enableHealthMonitoring?: boolean;

  /**
   * Health check interval in milliseconds
   */
  healthCheckInterval?: number;

  /**
   * Health check timeout in milliseconds
   */
  healthCheckTimeout?: number;

  /**
   * Enable event bus
   */
  enableEventBus?: boolean;

  /**
   * Event retention time in milliseconds
   */
  eventRetention?: number;

  /**
   * Maximum events to retain
   */
  maxEvents?: number;

  /**
   * Persistence backend
   */
  persistence?: {
    /**
     * KV namespace for persistence
     */
    kv?: KVNamespace;

    /**
     * Durable Object namespace for distributed state
     */
    doNamespace?: DurableObjectNamespace;
  };
}

/**
 * Package registry statistics
 */
export interface PackageRegistryStats {
  /**
   * Total registered packages
   */
  totalPackages: number;

  /**
   * Packages by type
   */
  packagesByType: Record<string, number>;

  /**
   * Packages by health status
   */
  packagesByHealth: Record<PackageHealthStatus, number>;

  /**
   * Total capabilities
   */
  totalCapabilities: number;

  /**
   * Total event subscriptions
   */
  totalSubscriptions: number;

  /**
   * Total invocations
   */
  totalInvocations: number;

  /**
   * Successful invocations
   */
  successfulInvocations: number;

  /**
   * Failed invocations
   */
  failedInvocations: number;

  /**
   * Average response time
   */
  avgResponseTime: number;

  /**
   * Registry uptime in milliseconds
   */
  uptime: number;
}
