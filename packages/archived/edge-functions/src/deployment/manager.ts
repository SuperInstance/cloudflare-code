/**
 * Deployment Manager
 *
 * Handles deployment, versioning, rollback, and lifecycle management
 * of edge functions across global edge locations.
 */

import {
  EdgeFunction,
  DeploymentConfig,
  DeploymentResult,
  DeploymentEnvironment,
  DeploymentStatus,
  RolloutStrategy,
  FunctionVersion,
} from '../types/index.js';

// ============================================================================
// Deployment Configuration
// ============================================================================

/**
 * Deployment manager configuration
 */
export interface DeploymentManagerConfig {
  /**
   * Enable automatic rollback on failure
   * @default true
   */
  autoRollback?: boolean;

  /**
   * Rollback threshold (failure rate)
   * @default 0.5
   */
  rollbackThreshold?: number;

  /**
   * Deployment timeout in ms
   * @default 300000 (5 minutes)
   */
  deploymentTimeout?: number;

  /**
   * Enable health checks after deployment
   * @default true
   */
  enableHealthChecks?: boolean;

  /**
   * Health check configuration
   */
  healthCheck?: HealthCheckConfig;

  /**
   * Number of versions to retain
   * @default 10
   */
  retainedVersions?: number;

  /**
   * Enable pre-deployment validation
   * @default true
   */
  enableValidation?: boolean;

  /**
   * Deployment regions
   * @default 'all'
   */
  regions?: string[] | 'all';

  /**
   * Custom deployment hooks
   */
  hooks?: DeploymentHooks;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /**
   * Number of checks to perform
   * @default 3
   */
  count?: number;

  /**
   * Interval between checks (ms)
   * @default 5000
   */
  interval?: number;

  /**
   * Timeout for each check (ms)
   * @default 10000
   */
  timeout?: number;

  /**
   * Success threshold
   * @default 2
   */
  successThreshold?: number;

  /**
   * Failure threshold
   * @default 2
   */
  failureThreshold?: number;

  /**
   * Health check path
   * @default '/health'
   */
  path?: string;

  /**
   * Expected status code
   * @default 200
   */
  expectedStatus?: number;
}

/**
 * Deployment hooks
 */
export interface DeploymentHooks {
  /**
   * Called before deployment starts
   */
  beforeDeploy?: (config: DeploymentConfig) => Promise<void>;

  /**
   * Called after deployment completes
   */
  afterDeploy?: (result: DeploymentResult) => Promise<void>;

  /**
   * Called before rollback
   */
  beforeRollback?: (functionId: string, version: string) => Promise<void>;

  /**
   * Called after rollback
   */
  afterRollback?: (functionId: string, version: string) => Promise<void>;

  /**
   * Called on deployment failure
   */
  onDeployFailure?: (error: Error, config: DeploymentConfig) => Promise<void>;
}

// ============================================================================
// Deployment Errors
// ============================================================================

/**
 * Base error for deployment errors
 */
export class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly functionId?: string,
    public readonly deploymentId?: string
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends DeploymentError {
  constructor(
    message: string,
    functionId?: string,
    public readonly validationErrors: string[] = []
  ) {
    super(message, 'VALIDATION_ERROR', functionId);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when deployment fails
 */
export class DeploymentFailedError extends DeploymentError {
  constructor(
    message: string,
    functionId?: string,
    deploymentId?: string,
    public readonly reason?: string
  ) {
    super(message, 'DEPLOYMENT_FAILED', functionId, deploymentId);
    this.name = 'DeploymentFailedError';
  }
}

/**
 * Error thrown when rollback fails
 */
export class RollbackError extends DeploymentError {
  constructor(
    message: string,
    functionId?: string,
    public readonly targetVersion?: string
  ) {
    super(message, 'ROLLBACK_ERROR', functionId);
    this.name = 'RollbackError';
  }
}

// ============================================================================
// Deployment Manager
// ============================================================================

/**
 * Manages deployment of edge functions to global edge locations
 */
export class DeploymentManager {
  private readonly config: DeploymentManagerConfig;
  private readonly deployments: Map<string, DeploymentState>;
  private readonly functions: Map<string, DeployedFunction>;
  private readonly versions: Map<string, FunctionVersion[]>;

  constructor(config: DeploymentManagerConfig = {}) {
    this.config = {
      autoRollback: true,
      rollbackThreshold: 0.5,
      deploymentTimeout: 300000,
      enableHealthChecks: true,
      healthCheck: {},
      retainedVersions: 10,
      enableValidation: true,
      regions: 'all',
      hooks: {},
      ...config,
    };
    this.deployments = new Map();
    this.functions = new Map();
    this.versions = new Map();
  }

  // ========================================================================
  // Deployment Operations
  // ========================================================================

  /**
   * Deploy one or more functions
   */
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    const startTime = Date.now();

    // Normalize functions to array
    const functionsToDeploy = Array.isArray(config.functions)
      ? config.functions
      : [config.functions];

    // Validate before deployment
    if (this.config.enableValidation) {
      await this.validateDeployment(functionsToDeploy, config);
    }

    // Call beforeDeploy hook
    if (this.config.hooks?.beforeDeploy) {
      await this.config.hooks.beforeDeploy(config);
    }

    // Create deployment state
    const state: DeploymentState = {
      deploymentId,
      status: 'deploying',
      functions: functionsToDeploy.map(f => f.id),
      environment: config.environment,
      version: config.version || this.generateVersion(),
      startTime,
      endTime: 0,
      locations: [],
      metrics: {
        duration: 0,
        locationCount: 0,
        successRate: 0,
      },
    };

    this.deployments.set(deploymentId, state);

    try {
      // Deploy to edge locations
      const locations = await this.deployToLocations(
        functionsToDeploy,
        config,
        deploymentId
      );

      state.locations = locations;
      state.metrics.locationCount = locations.length;

      // Perform health checks if enabled
      if (this.config.enableHealthChecks) {
        await this.performHealthChecks(functionsToDeploy, config);
      }

      // Update function versions
      for (const func of functionsToDeploy) {
        await this.updateFunctionVersion(func, state.version, config);
      }

      // Mark deployment as successful
      state.status = 'deployed';
      state.endTime = Date.now();
      state.metrics.duration = state.endTime - startTime;
      state.metrics.successRate = 1;

      // Create result
      const result: DeploymentResult = {
        deploymentId,
        status: 'deployed',
        functions: functionsToDeploy.map(f => f.id),
        version: state.version,
        timestamp: startTime,
        locations,
        metrics: state.metrics,
      };

      // Call afterDeploy hook
      if (this.config.hooks?.afterDeploy) {
        await this.config.hooks.afterDeploy(result);
      }

      return result;
    } catch (error) {
      // Mark deployment as failed
      state.status = 'failed';
      state.endTime = Date.now();
      state.metrics.duration = state.endTime - startTime;

      const err = error instanceof Error ? error : new Error(String(error));

      // Call onDeployFailure hook
      if (this.config.hooks?.onDeployFailure) {
        await this.config.hooks.onDeployFailure(err, config);
      }

      // Auto rollback if enabled
      if (this.config.autoRollback && state.version) {
        await this.rollbackInternal(functionsToDeploy[0].id, state.version);
      }

      return {
        deploymentId,
        status: 'failed',
        functions: functionsToDeploy.map(f => f.id),
        version: state.version,
        timestamp: startTime,
        locations: state.locations,
        metrics: state.metrics,
        error: err,
      };
    }
  }

  /**
   * Rollback a function to a previous version
   */
  async rollback(
    functionId: string,
    targetVersion?: string
  ): Promise<DeploymentResult> {
    // Call beforeRollback hook
    if (this.config.hooks?.beforeRollback) {
      await this.config.hooks.beforeRollback(functionId, targetVersion || '');
    }

    try {
      const result = await this.rollbackInternal(functionId, targetVersion);

      // Call afterRollback hook
      if (this.config.hooks?.afterRollback) {
        await this.config.hooks.afterRollback(functionId, result.version);
      }

      return result;
    } catch (error) {
      throw new RollbackError(
        `Rollback failed for function ${functionId}: ${error}`,
        functionId,
        targetVersion
      );
    }
  }

  /**
   * Internal rollback implementation
   */
  private async rollbackInternal(
    functionId: string,
    targetVersion?: string
  ): Promise<DeploymentResult> {
    const deployedFunc = this.functions.get(functionId);
    if (!deployedFunc) {
      throw new DeploymentError(`Function not found: ${functionId}`, 'FUNCTION_NOT_FOUND', functionId);
    }

    // Get versions
    const versions = this.versions.get(functionId) || [];
    if (versions.length === 0) {
      throw new DeploymentError(`No versions found for function: ${functionId}`, 'NO_VERSIONS', functionId);
    }

    // Determine target version
    const versionToRollback = targetVersion
      ? versions.find(v => v.version === targetVersion)
      : versions.find(v => v.status === 'active');

    if (!versionToRollback) {
      throw new DeploymentError(
        `Target version not found: ${targetVersion || 'latest active'}`,
        'VERSION_NOT_FOUND',
        functionId
      );
    }

    // Create rollback deployment
    const deploymentId = this.generateDeploymentId();
    const startTime = Date.now();

    const state: DeploymentState = {
      deploymentId,
      status: 'rolling-back',
      functions: [functionId],
      environment: deployedFunc.environment,
      version: versionToRollback.version,
      startTime,
      endTime: 0,
      locations: [],
      metrics: {
        duration: 0,
        locationCount: 0,
        successRate: 0,
      },
    };

    this.deployments.set(deploymentId, state);

    try {
      // Deploy previous version to locations
      const locations = await this.deployToLocations(
        [deployedFunc.function],
        {
          environment: deployedFunc.environment,
          version: versionToRollback.version,
          functions: [deployedFunc.function],
        },
        deploymentId
      );

      state.locations = locations;
      state.status = 'rolled-back';
      state.endTime = Date.now();
      state.metrics.duration = state.endTime - startTime;
      state.metrics.locationCount = locations.length;

      return {
        deploymentId,
        status: 'rolled-back',
        functions: [functionId],
        version: versionToRollback.version,
        timestamp: startTime,
        locations,
        metrics: state.metrics,
      };
    } catch (error) {
      state.status = 'failed';
      state.endTime = Date.now();
      state.metrics.duration = state.endTime - startTime;

      throw error;
    }
  }

  // ========================================================================
  // Version Management
  // ========================================================================

  /**
   * Get all versions for a function
   */
  getVersions(functionId: string): FunctionVersion[] {
    return this.versions.get(functionId) || [];
  }

  /**
   * Get active version for a function
   */
  getActiveVersion(functionId: string): FunctionVersion | undefined {
    const versions = this.versions.get(functionId) || [];
    return versions.find(v => v.status === 'active');
  }

  /**
   * Delete old versions
   */
  async cleanupOldVersions(
    functionId: string,
    retain?: number
  ): Promise<void> {
    const versions = this.versions.get(functionId);
    if (!versions) return;

    const retainCount = retain ?? this.config.retainedVersions!;
    const activeVersions = versions.filter(v => v.status === 'active');

    // Keep active versions and the most recent versions up to retainCount
    const toKeep = [
      ...activeVersions,
      ...versions
        .filter(v => v.status !== 'active')
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, retainCount),
    ];

    const toDelete = versions.filter(v => !toKeep.includes(v));

    for (const version of toDelete) {
      version.status = 'archived';
    }
  }

  /**
   * Update function version
   */
  private async updateFunctionVersion(
    func: EdgeFunction,
    version: string,
    config: DeploymentConfig
  ): Promise<void> {
    const versions = this.versions.get(func.id) || [];

    // Create new version
    const newVersion: FunctionVersion = {
      version,
      hash: await this.generateHash(func),
      createdAt: Date.now(),
      status: 'active',
      changelog: config.metadata?.changelog,
      tags: config.metadata?.tags,
    };

    // Mark existing active versions as deprecated
    for (const v of versions) {
      if (v.status === 'active') {
        v.status = 'deprecated';
      }
    }

    versions.push(newVersion);
    this.versions.set(func.id, versions);

    // Update deployed function
    this.functions.set(func.id, {
      function: func,
      version,
      environment: config.environment,
      deployedAt: Date.now(),
      deploymentId: this.generateDeploymentId(),
    });
  }

  // ========================================================================
  // Deployment Validation
  // ========================================================================

  /**
   * Validate deployment configuration
   */
  private async validateDeployment(
    functions: EdgeFunction[],
    config: DeploymentConfig
  ): Promise<void> {
    const errors: string[] = [];

    // Validate functions
    for (const func of functions) {
      // Check function ID
      if (!func.id || func.id.trim() === '') {
        errors.push(`Function ID is required for ${func.name || 'unnamed function'}`);
      }

      // Check function handler
      if (!func.handler || typeof func.handler !== 'function') {
        errors.push(`Function handler is required for ${func.id}`);
      }

      // Check required environment variables
      if (func.config.requiredEnvVars) {
        for (const envVar of func.config.requiredEnvVars) {
          if (!config.envVars?.[envVar]) {
            errors.push(`Missing required environment variable: ${envVar} for function ${func.id}`);
          }
        }
      }

      // Check required secrets
      if (func.config.requiredSecrets) {
        for (const secret of func.config.requiredSecrets) {
          if (!config.secrets?.[secret]) {
            errors.push(`Missing required secret: ${secret} for function ${func.id}`);
          }
        }
      }

      // Validate timeout
      if (func.config.timeout && func.config.timeout < 0) {
        errors.push(`Invalid timeout for function ${func.id}: must be positive`);
      }

      // Validate memory limit
      if (func.config.memoryLimit && (func.config.memoryLimit < 1 || func.config.memoryLimit > 128)) {
        errors.push(`Invalid memory limit for function ${func.id}: must be between 1 and 128 MB`);
      }
    }

    // Validate environment
    const validEnvironments: DeploymentEnvironment[] = ['development', 'staging', 'production', 'custom'];
    if (!validEnvironments.includes(config.environment)) {
      errors.push(`Invalid environment: ${config.environment}`);
    }

    // Validate rollout strategy
    if (config.strategy) {
      const validStrategies: RolloutStrategy[] = ['immediate', 'canary', 'blue-green', 'gradual'];
      if (!validStrategies.includes(config.strategy)) {
        errors.push(`Invalid rollout strategy: ${config.strategy}`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Deployment validation failed', functions[0]?.id, errors);
    }
  }

  // ========================================================================
  // Location Deployment
  // ========================================================================

  /**
   * Deploy to edge locations
   */
  private async deployToLocations(
    functions: EdgeFunction[],
    config: DeploymentConfig,
    deploymentId: string
  ): Promise<string[]> {
    // Determine target locations
    const locations = this.config.regions === 'all'
      ? this.getAllEdgeLocations()
      : this.config.regions;

    // Deploy based on strategy
    const strategy = config.strategy || 'immediate';

    switch (strategy) {
      case 'immediate':
        return await this.deployImmediate(functions, locations || [], config, deploymentId);

      case 'canary':
        return await this.deployCanary(functions, locations || [], config, deploymentId);

      case 'blue-green':
        return await this.deployBlueGreen(functions, locations || [], config, deploymentId);

      case 'gradual':
        return await this.deployGradual(functions, locations || [], config, deploymentId);

      default:
        throw new DeploymentError(`Unknown deployment strategy: ${strategy}`, 'INVALID_STRATEGY');
    }
  }

  /**
   * Deploy immediately to all locations
   */
  private async deployImmediate(
    functions: EdgeFunction[],
    locations: string[],
    config: DeploymentConfig,
    deploymentId: string
  ): Promise<string[]> {
    const results = await Promise.allSettled(
      locations.map(location =>
        this.deployToLocation(functions, location, config, deploymentId)
      )
    );

    const successful = results
      .map((result, index) => ({ result, location: locations[index] }))
      .filter(({ result }) => result.status === 'fulfilled')
      .map(({ location }) => location);

    const failed = results
      .filter(r => r.status === 'rejected')
      .length;

    if (failed > 0) {
      console.warn(`Deployment to ${failed} locations failed`);
    }

    return successful;
  }

  /**
   * Deploy using canary strategy
   */
  private async deployCanary(
    functions: EdgeFunction[],
    locations: string[],
    config: DeploymentConfig,
    deploymentId: string
  ): Promise<string[]> {
    // Start with 10% of locations
    const canaryCount = Math.max(1, Math.floor(locations.length * 0.1));

    // Deploy to canary locations
    const canaryLocations = locations.slice(0, canaryCount);
    await this.deployImmediate(functions, canaryLocations, config, deploymentId);

    // Monitor for issues (simplified)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // If no issues, deploy to remaining locations
    const remainingLocations = locations.slice(canaryCount);
    await this.deployImmediate(functions, remainingLocations, config, deploymentId);

    return locations;
  }

  /**
   * Deploy using blue-green strategy
   */
  private async deployBlueGreen(
    functions: EdgeFunction[],
    locations: string[],
    config: DeploymentConfig,
    deploymentId: string
  ): Promise<string[]> {
    // Deploy to all locations but don't switch traffic
    await this.deployImmediate(functions, locations, config, deploymentId);

    // Switch traffic (simplified - would need traffic management)
    return locations;
  }

  /**
   * Deploy using gradual rollout
   */
  private async deployGradual(
    functions: EdgeFunction[],
    locations: string[],
    config: DeploymentConfig,
    deploymentId: string
  ): Promise<string[]> {
    // Deploy in stages: 25%, 50%, 75%, 100%
    const stages = [0.25, 0.5, 0.75, 1.0];

    for (const stage of stages) {
      const count = Math.floor(locations.length * stage);
      const stageLocations = locations.slice(0, count);

      await this.deployImmediate(functions, stageLocations, config, deploymentId);

      // Wait between stages
      if (stage < 1.0) {
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    return locations;
  }

  /**
   * Deploy to a single location
   */
  private async deployToLocation(
    _functions: EdgeFunction[],
    location: string,
    _config: DeploymentConfig,
    _deploymentId: string
  ): Promise<string> {
    // Simulate deployment to location
    // In real implementation, this would upload and activate functions

    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    return location;
  }

  /**
   * Get all edge locations
   */
  private getAllEdgeLocations(): string[] {
    // Return list of Cloudflare edge locations
    return [
      'ams', 'atl', 'bos', 'cdg', 'den', 'dfw', 'ewr', 'fra',
      'hkg', 'iad', 'jnb', 'lax', 'lhr', 'maa', 'mad', 'mia',
      'mom', 'ord', 'otp', 'pdg', 'sin', 'sjc', 'syd', 'waw',
      'yul', 'yyz', 'zyn',
    ];
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  /**
   * Perform health checks on deployed functions
   */
  private async performHealthChecks(
    _functions: EdgeFunction[],
    _config: DeploymentConfig
  ): Promise<void> {
    const _healthCheckConfig = {
      count: 3,
      interval: 5000,
      timeout: 10000,
      successThreshold: 2,
      failureThreshold: 2,
      path: '/health',
      expectedStatus: 200,
      ...this.config.healthCheck,
    };

    // Perform health checks
    let successes = 0;
    let failures = 0;

    for (let i = 0; i < _healthCheckConfig.count!; i++) {
      try {
        // Simulate health check
        await this.performHealthCheck(_functions[0].id, _config, _healthCheckConfig);
        successes++;

        if (successes >= _healthCheckConfig.successThreshold!) {
          return; // Health check passed
        }
      } catch (error) {
        failures++;
        if (failures >= _healthCheckConfig.failureThreshold!) {
          throw new DeploymentError(
            `Health check failed: ${error}`,
            'HEALTH_CHECK_FAILED',
            _functions[0].id
          );
        }
      }

      if (i < _healthCheckConfig.count! - 1) {
        await new Promise(resolve => setTimeout(resolve, _healthCheckConfig.interval!));
      }
    }
  }

  /**
   * Perform a single health check
   */
  private async performHealthCheck(
    _functionId: string,
    _config: DeploymentConfig,
    _healthCheckConfig: any
  ): Promise<void> {
    // Simulate health check
    // In real implementation, this would make HTTP requests to the function
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Simulate occasional failure
    if (Math.random() < 0.05) {
      throw new Error('Health check failed');
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Generate deployment ID
   */
  private generateDeploymentId(): string {
    return `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    const now = new Date();
    const major = now.getFullYear();
    const minor = now.getMonth() + 1;
    const patch = now.getDate();
    const build = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return `${major}.${minor}.${patch}.${build}`;
  }

  /**
   * Generate hash for function
   */
  private async generateHash(func: EdgeFunction): Promise<string> {
    // Simplified hash generation
    const str = JSON.stringify({
      id: func.id,
      name: func.name,
      handler: func.handler.toString(),
      config: func.config,
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): DeploymentState | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get all deployments
   */
  getAllDeployments(): DeploymentState[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get deployed function info
   */
  getDeployedFunction(functionId: string): DeployedFunction | undefined {
    return this.functions.get(functionId);
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Deployment state
 */
interface DeploymentState {
  deploymentId: string;
  status: DeploymentStatus;
  functions: string[];
  environment: DeploymentEnvironment;
  version: string;
  startTime: number;
  endTime: number;
  locations: string[];
  metrics: {
    duration: number;
    locationCount: number;
    successRate: number;
  };
}

/**
 * Deployed function info
 */
interface DeployedFunction {
  function: EdgeFunction;
  version: string;
  environment: DeploymentEnvironment;
  deployedAt: number;
  deploymentId: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new deployment manager
 */
export function createDeploymentManager(
  config?: DeploymentManagerConfig
): DeploymentManager {
  return new DeploymentManager(config);
}

/**
 * Generate a deployment configuration
 */
export function createDeploymentConfig(
  functions: EdgeFunction | EdgeFunction[],
  environment: DeploymentEnvironment,
  overrides?: Partial<DeploymentConfig>
): DeploymentConfig {
  return {
    functions,
    environment,
    ...overrides,
  };
}

/**
 * Create health check configuration
 */
export function createHealthCheckConfig(
  overrides?: Partial<HealthCheckConfig>
): HealthCheckConfig {
  return {
    count: 3,
    interval: 5000,
    timeout: 10000,
    successThreshold: 2,
    failureThreshold: 2,
    path: '/health',
    expectedStatus: 200,
    ...overrides,
  };
}
