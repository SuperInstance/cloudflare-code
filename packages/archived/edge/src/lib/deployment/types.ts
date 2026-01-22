/**
 * Multi-Region Deployment Types
 *
 * Type definitions for production-ready deployment features including
 * canary releases, blue-green deployments, traffic routing, and rollback.
 */

/**
 * Region identifier
 */
export type Region =
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-northeast-1'
  | 'global';

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'rolling-back'
  | 'rolled-back';

/**
 * Deployment strategy
 */
export type DeploymentStrategy =
  | 'rolling'
  | 'canary'
  | 'blue-green'
  | 'all-at-once';

/**
 * Traffic rule type
 */
export type TrafficRuleType =
  | 'percentage'
  | 'header'
  | 'cookie'
  | 'geo'
  | 'weighted';

/**
 * Deployment version
 */
export interface DeploymentVersion {
  /**
   * Version identifier
   */
  version: string;

  /**
   * Git commit SHA
   */
  commitSha: string;

  /**
   * Build timestamp
   */
  buildTime: number;

  /**
   * Artifact location
   */
  artifactUrl?: string;

  /**
   * Version metadata
   */
  metadata?: {
    /**
     * Author
     */
    author?: string;

    /**
     * Commit message
     */
    message?: string;

    /**
     * Branch
     */
    branch?: string;

    /**
     * Tags
     */
    tags?: string[];

    /**
     * Additional metadata
     */
    [key: string]: unknown;
  };
}

/**
 * Region deployment state
 */
export interface RegionDeployment {
  /**
   * Region identifier
   */
  region: Region;

  /**
   * Deployment version
   */
  version: DeploymentVersion;

  /**
   * Deployment status
   */
  status: DeploymentStatus;

  /**
   * Deployment percentage (for rolling/canary)
   */
  percentage?: number;

  /**
   * Health status
   */
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

  /**
   * Last health check timestamp
   */
  lastHealthCheck?: number;

  /**
   * Deployment timestamp
   */
  deployedAt?: number;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Instance count
   */
  instanceCount?: number;

  /**
   * Active instances
   */
  activeInstances?: number;
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /**
   * Deployment ID
   */
  id: string;

  /**
   * Deployment version
   */
  version: DeploymentVersion;

  /**
   * Target regions
   */
  regions: Region[];

  /**
   * Deployment strategy
   */
  strategy: DeploymentStrategy;

  /**
   * Canary configuration (if strategy is canary)
   */
  canary?: {
    /**
     * Initial traffic percentage
     */
    initialPercentage: number;

    /**
     * Increment percentage
     */
    incrementPercentage: number;

    /**
     * Increment interval in milliseconds
     */
    incrementInterval: number;

    /**
     * Auto-promote threshold (success rate)
     */
    autoPromoteThreshold: number;

    /**
     * Auto-rollback threshold (error rate)
     */
    autoRollbackThreshold: number;
  };

  /**
   * Rolling configuration (if strategy is rolling)
   */
  rolling?: {
    /**
     * Batch size (percentage or count)
     */
    batchSize: number;

    /**
     * Batch interval in milliseconds
     */
    batchInterval: number;

    /**
     * Health check duration per batch
     */
    healthCheckDuration: number;
  };

  /**
   * Blue-green configuration (if strategy is blue-green)
   */
  blueGreen?: {
    /**
     * Health check duration before cutover
     */
    healthCheckDuration: number;

    /**
     * Enable automatic cutover
     */
    autoCutover: boolean;

    /**
     * Keep old version running after cutover
     */
    keepOldVersion: boolean;

    /**
     * Old version TTL after cutover (milliseconds)
     */
    oldVersionTtl?: number;
  };

  /**
   * Traffic rules
   */
  trafficRules?: TrafficRule[];

  /**
   * Health check configuration
   */
  healthCheck?: {
    /**
     * Health check endpoint
     */
    endpoint: string;

    /**
     * Health check interval in milliseconds
     */
    interval: number;

    /**
     * Health check timeout in milliseconds
     */
    timeout: number;

    /**
     * Unhealthy threshold
     */
    unhealthyThreshold: number;

    /**
     * Healthy threshold
     */
    healthyThreshold: number;
  };

  /**
   * Rollback configuration
   */
  rollback?: {
    /**
     * Enable automatic rollback
     */
    autoRollback: boolean;

    /**
     * Rollback trigger (error rate, health status, etc.)
     */
    trigger: 'error-rate' | 'health-status' | 'manual';

    /**
     * Rollback threshold
     */
    threshold?: number;

    /**
   * Rollback timeout in milliseconds
   */
    timeout?: number;
  };

  /**
   * Timeout for deployment in milliseconds
   */
  timeout?: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Traffic rule for routing requests
 */
export interface TrafficRule {
  /**
   * Rule ID
   */
  id: string;

  /**
   * Rule type
   */
  type: TrafficRuleType;

  /**
   * Rule priority (higher = evaluated first)
   */
  priority: number;

  /**
   * Rule conditions
   */
  condition: {
    /**
     * Target version
     */
    version: string;

    /**
     * Traffic percentage (for percentage-based rules)
     */
    percentage?: number;

    /**
     * Header match (for header-based rules)
     */
    header?: {
      name: string;
      value: string | RegExp;
    };

    /**
     * Cookie match (for cookie-based rules)
     */
    cookie?: {
      name: string;
      value: string | RegExp;
    };

    /**
     * Geo match (for geo-based rules)
     */
    geo?: Region[];

    /**
     * Weight for weighted rules
     */
    weight?: number;
  };

  /**
   * Rule is enabled
   */
  enabled: boolean;
}

/**
 * Deployment state
 */
export interface DeploymentState {
  /**
   * Deployment configuration
   */
  config: DeploymentConfig;

  /**
   * Current status
   */
  status: DeploymentStatus;

  /**
   * Region deployments
   */
  regions: Map<Region, RegionDeployment>;

  /**
   * Created timestamp
   */
  createdAt: number;

  /**
   * Updated timestamp
   */
  updatedAt: number;

  /**
   * Started timestamp
   */
  startedAt?: number;

  /**
   * Completed timestamp
   */
  completedAt?: number;

  /**
   * Previous deployment (for rollback)
   */
  previousDeployment?: DeploymentState;

  /**
   * Deployment metrics
   */
  metrics?: DeploymentMetrics;
}

/**
 * Deployment metrics
 */
export interface DeploymentMetrics {
  /**
   * Total requests
   */
  totalRequests: number;

  /**
   * Successful requests
   */
  successfulRequests: number;

  /**
   * Failed requests
   */
  failedRequests: number;

  /**
   * Error rate
   */
  errorRate: number;

  /**
   * Average response time
   */
  avgResponseTime: number;

  /**
   * P50 response time
   */
  p50ResponseTime: number;

  /**
   * P95 response time
   */
  p95ResponseTime: number;

  /**
   * P99 response time
   */
  p99ResponseTime: number;

  /**
   * Requests by region
   */
  requestsByRegion: Map<Region, number>;

  /**
   * Requests by version
   */
  requestsByVersion: Map<string, number>;
}

/**
 * Deployment event
 */
export interface DeploymentEvent {
  /**
   * Event ID
   */
  id: string;

  /**
   * Event timestamp
   */
  timestamp: number;

  /**
   * Deployment ID
   */
  deploymentId: string;

  /**
   * Event type
   */
  type: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'rollback' | 'rolled-back';

  /**
   * Event region (if region-specific)
   */
  region?: Region;

  /**
   * Event message
   */
  message?: string;

  /**
   * Event data
   */
  data?: Record<string, unknown>;

  /**
   * Previous state
   */
  previousState?: DeploymentStatus;

  /**
   * New state
   */
  newState?: DeploymentStatus;
}

/**
 * Deployment manager options
 */
export interface DeploymentManagerOptions {
  /**
   * KV namespace for persistence
   */
  kv?: KVNamespace;

  /**
   * Durable Object namespace for distributed coordination
   */
  doNamespace?: DurableObjectNamespace;

  /**
   * Enable automatic rollback
   */
  enableAutoRollback?: boolean;

  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;

  /**
   * Enable event logging
   */
  enableEventLogging?: boolean;

  /**
   * Default deployment timeout in milliseconds
   */
  defaultTimeout?: number;

  /**
   * Health check interval in milliseconds
   */
  healthCheckInterval?: number;

  /**
   * Maximum concurrent deployments
   */
  maxConcurrentDeployments?: number;
}

/**
 * Traffic routing result
 */
export interface TrafficRoutingResult {
  /**
   * Target version
   */
  version: string;

  /**
   * Target region
   */
  region: Region;

  /**
   * Routing reason
   */
  reason: string;

  /**
   * Matched rule
   */
  matchedRule?: TrafficRule;
}

/**
 * Rollback options
 */
export interface RollbackOptions {
  /**
   * Rollback to specific version (defaults to previous)
   */
  version?: string;

  /**
   * Rollback specific regions only
   */
  regions?: Region[];

  /**
   * Skip health checks
   */
  skipHealthChecks?: boolean;

  /**
   * Immediate rollback (kill existing connections)
   */
  immediate?: boolean;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}
