import { CircuitBreakerConfig, ThresholdConfig, HealthCheckConfig, RecoveryConfig } from '../types/index.js';

/**
 * Default threshold configuration
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000,
  windowSize: 100,
  minRequests: 10,
  errorRateThreshold: 50,
  slowCallThreshold: 1000,
  slowCallRateThreshold: 30,
};

/**
 * Default circuit breaker configuration
 */
export function getDefaultConfig(name: string): CircuitBreakerConfig {
  return {
    name,
    thresholds: { ...DEFAULT_THRESHOLDS },
    enableMetrics: true,
    enablePredictiveDetection: true,
    enablePersistence: false,
    operationTimeoutMs: 30000,
    maxConcurrent: 100,
    enableAdaptiveThresholds: false,
    adaptiveSensitivity: 0.5,
  };
}

/**
 * Default health check configuration
 */
export function getDefaultHealthCheckConfig(checker: () => Promise<boolean>): HealthCheckConfig {
  return {
    enabled: true,
    intervalMs: 10000,
    timeoutMs: 5000,
    successThreshold: 2,
    failureThreshold: 3,
    checker,
  };
}

/**
 * Default recovery configuration
 */
export function getDefaultRecoveryConfig(): RecoveryConfig {
  return {
    enabled: true,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    maxAttempts: 5,
    enableGradualRamping: false,
    initialTrafficPercent: 10,
    trafficIncrement: 10,
    rampingStepDurationMs: 5000,
  };
}

/**
 * Validate circuit breaker configuration
 */
export function validateConfig(config: CircuitBreakerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!config.name || typeof config.name !== 'string') {
    errors.push('name must be a non-empty string');
  }

  // Validate thresholds
  if (!config.thresholds) {
    errors.push('thresholds is required');
  } else {
    const t = config.thresholds;

    if (t.failureThreshold < 1) {
      errors.push('failureThreshold must be >= 1');
    }

    if (t.successThreshold < 1) {
      errors.push('successThreshold must be >= 1');
    }

    if (t.timeoutMs < 1000) {
      errors.push('timeoutMs must be >= 1000');
    }

    if (t.windowSize < 10) {
      errors.push('windowSize must be >= 10');
    }

    if (t.minRequests < 1) {
      errors.push('minRequests must be >= 1');
    }

    if (t.minRequests > t.windowSize) {
      errors.push('minRequests must be <= windowSize');
    }

    if (t.errorRateThreshold < 0 || t.errorRateThreshold > 100) {
      errors.push('errorRateThreshold must be between 0 and 100');
    }

    if (t.slowCallThreshold < 0) {
      errors.push('slowCallThreshold must be >= 0');
    }

    if (t.slowCallRateThreshold < 0 || t.slowCallRateThreshold > 100) {
      errors.push('slowCallRateThreshold must be between 0 and 100');
    }
  }

  // Validate operation timeout
  if (config.operationTimeoutMs !== undefined && config.operationTimeoutMs < 100) {
    errors.push('operationTimeoutMs must be >= 100');
  }

  // Validate max concurrent
  if (config.maxConcurrent !== undefined && config.maxConcurrent < 1) {
    errors.push('maxConcurrent must be >= 1');
  }

  // Validate adaptive sensitivity
  if (config.adaptiveSensitivity !== undefined && (config.adaptiveSensitivity < 0 || config.adaptiveSensitivity > 1)) {
    errors.push('adaptiveSensitivity must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge configurations with defaults
 */
export function mergeConfig(userConfig: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  const defaults = getDefaultConfig(userConfig.name || 'default');
  return {
    ...defaults,
    ...userConfig,
    thresholds: {
      ...defaults.thresholds,
      ...(userConfig.thresholds || {}),
    },
  };
}

/**
 * Preset configurations for different scenarios
 */
export const PRESETS = {
  /**
   * Aggressive configuration for critical services
   */
  CRITICAL: (name: string): Partial<CircuitBreakerConfig> => ({
    name,
    thresholds: {
      failureThreshold: 3,
      successThreshold: 3,
      timeoutMs: 30000,
      windowSize: 50,
      minRequests: 5,
      errorRateThreshold: 30,
      slowCallThreshold: 500,
      slowCallRateThreshold: 20,
    },
    enablePredictiveDetection: true,
    enableAdaptiveThresholds: true,
  }),

  /**
   * Lenient configuration for non-critical services
   */
  LENIENT: (name: string): Partial<CircuitBreakerConfig> => ({
    name,
    thresholds: {
      failureThreshold: 10,
      successThreshold: 2,
      timeoutMs: 120000,
      windowSize: 200,
      minRequests: 20,
      errorRateThreshold: 70,
      slowCallThreshold: 2000,
      slowCallRateThreshold: 50,
    },
    enablePredictiveDetection: false,
    enableAdaptiveThresholds: false,
  }),

  /**
   * Balanced configuration for general use
   */
  BALANCED: (name: string): Partial<CircuitBreakerConfig> => ({
    name,
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
    enablePredictiveDetection: true,
    enableAdaptiveThresholds: false,
  }),

  /**
   * Development/Testing configuration
   */
  DEVELOPMENT: (name: string): Partial<CircuitBreakerConfig> => ({
    name,
    thresholds: {
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 5000,
      windowSize: 10,
      minRequests: 2,
      errorRateThreshold: 50,
      slowCallThreshold: 500,
      slowCallRateThreshold: 50,
    },
    enablePredictiveDetection: false,
    enableAdaptiveThresholds: false,
    enableMetrics: true,
  }),
};

/**
 * Configuration builder
 */
export class ConfigBuilder {
  private config: Partial<CircuitBreakerConfig>;

  constructor(name: string) {
    this.config = { name };
  }

  withFailureThreshold(threshold: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      failureThreshold: threshold,
      successThreshold: (this.config.thresholds as any)?.successThreshold ?? 2,
      timeoutMs: (this.config.thresholds as any)?.timeoutMs ?? 60000,
      windowSize: (this.config.thresholds as any)?.windowSize ?? 100,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      errorRateThreshold: (this.config.thresholds as any)?.errorRateThreshold ?? 50,
      slowCallThreshold: (this.config.thresholds as any)?.slowCallThreshold ?? 5000,
      slowCallRateThreshold: (this.config.thresholds as any)?.slowCallRateThreshold ?? 50,
    } as any;
    return this;
  }

  withSuccessThreshold(threshold: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      successThreshold: threshold,
      failureThreshold: (this.config.thresholds as any)?.failureThreshold ?? 5,
      timeoutMs: (this.config.thresholds as any)?.timeoutMs ?? 60000,
      windowSize: (this.config.thresholds as any)?.windowSize ?? 100,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      errorRateThreshold: (this.config.thresholds as any)?.errorRateThreshold ?? 50,
      slowCallThreshold: (this.config.thresholds as any)?.slowCallThreshold ?? 5000,
      slowCallRateThreshold: (this.config.thresholds as any)?.slowCallRateThreshold ?? 50,
    } as any;
    return this;
  }

  withTimeout(ms: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      timeoutMs: ms,
      failureThreshold: (this.config.thresholds as any)?.failureThreshold ?? 5,
      successThreshold: (this.config.thresholds as any)?.successThreshold ?? 2,
      windowSize: (this.config.thresholds as any)?.windowSize ?? 100,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      errorRateThreshold: (this.config.thresholds as any)?.errorRateThreshold ?? 50,
      slowCallThreshold: (this.config.thresholds as any)?.slowCallThreshold ?? 5000,
      slowCallRateThreshold: (this.config.thresholds as any)?.slowCallRateThreshold ?? 50,
    } as any;
    return this;
  }

  withWindowSize(size: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      windowSize: size,
      failureThreshold: (this.config.thresholds as any)?.failureThreshold ?? 5,
      successThreshold: (this.config.thresholds as any)?.successThreshold ?? 2,
      timeoutMs: (this.config.thresholds as any)?.timeoutMs ?? 60000,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      errorRateThreshold: (this.config.thresholds as any)?.errorRateThreshold ?? 50,
      slowCallThreshold: (this.config.thresholds as any)?.slowCallThreshold ?? 5000,
      slowCallRateThreshold: (this.config.thresholds as any)?.slowCallRateThreshold ?? 50,
    } as any;
    return this;
  }

  withErrorRateThreshold(threshold: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      errorRateThreshold: threshold,
      failureThreshold: (this.config.thresholds as any)?.failureThreshold ?? 5,
      successThreshold: (this.config.thresholds as any)?.successThreshold ?? 2,
      timeoutMs: (this.config.thresholds as any)?.timeoutMs ?? 60000,
      windowSize: (this.config.thresholds as any)?.windowSize ?? 100,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      slowCallThreshold: (this.config.thresholds as any)?.slowCallThreshold ?? 5000,
      slowCallRateThreshold: (this.config.thresholds as any)?.slowCallRateThreshold ?? 50,
    } as any;
    return this;
  }

  withSlowCallThreshold(threshold: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      slowCallThreshold: threshold,
      failureThreshold: (this.config.thresholds as any)?.failureThreshold ?? 5,
      successThreshold: (this.config.thresholds as any)?.successThreshold ?? 2,
      timeoutMs: (this.config.thresholds as any)?.timeoutMs ?? 60000,
      windowSize: (this.config.thresholds as any)?.windowSize ?? 100,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      errorRateThreshold: (this.config.thresholds as any)?.errorRateThreshold ?? 50,
      slowCallRateThreshold: (this.config.thresholds as any)?.slowCallRateThreshold ?? 50,
    } as any;
    return this;
  }

  withSlowCallRateThreshold(threshold: number): this {
    this.config.thresholds = {
      ...this.config.thresholds,
      slowCallRateThreshold: threshold,
      failureThreshold: (this.config.thresholds as any)?.failureThreshold ?? 5,
      successThreshold: (this.config.thresholds as any)?.successThreshold ?? 2,
      timeoutMs: (this.config.thresholds as any)?.timeoutMs ?? 60000,
      windowSize: (this.config.thresholds as any)?.windowSize ?? 100,
      minRequests: (this.config.thresholds as any)?.minRequests ?? 10,
      errorRateThreshold: (this.config.thresholds as any)?.errorRateThreshold ?? 50,
      slowCallThreshold: (this.config.thresholds as any)?.slowCallThreshold ?? 5000,
    } as any;
    return this;
  }

  withMetrics(enabled: boolean): this {
    this.config.enableMetrics = enabled;
    return this;
  }

  withPredictiveDetection(enabled: boolean): this {
    this.config.enablePredictiveDetection = enabled;
    return this;
  }

  withPersistence(enabled: boolean, storageKey?: string): this {
    this.config.enablePersistence = enabled;
    this.config.storageKey = storageKey;
    return this;
  }

  withOperationTimeout(ms: number): this {
    this.config.operationTimeoutMs = ms;
    return this;
  }

  withMaxConcurrent(max: number): this {
    this.config.maxConcurrent = max;
    return this;
  }

  withAdaptiveThresholds(enabled: boolean, sensitivity?: number): this {
    this.config.enableAdaptiveThresholds = enabled;
    if (sensitivity !== undefined) {
      this.config.adaptiveSensitivity = sensitivity;
    }
    return this;
  }

  build(): CircuitBreakerConfig {
    return mergeConfig(this.config);
  }
}

/**
 * Create a config builder
 */
export function createConfigBuilder(name: string): ConfigBuilder {
  return new ConfigBuilder(name);
}
