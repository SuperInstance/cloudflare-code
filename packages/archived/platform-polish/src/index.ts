// @ts-nocheck
// Main exports for the platform-polish package

// Core components
export * from './core/platform-api';
export * from './types';

// Configuration
export * from './config/config-manager';

// Service Management
export * from './service-discovery/service-discovery';
export * from './load-balancer/load-balancer';
export * from './circuit-breaker/circuit-breaker-manager';

// Health and Monitoring
export * from './health/health-monitor';
export * from './monitoring/metrics-collector';

// Reliability
export * from './graceful-degradation/graceful-degradation';

// Utilities
export * from './utils';

// Additional components (would be implemented in a real scenario)
export * from './security/security-manager';
export * from './cache/cache-manager';
export * from './deployment/deployment-manager';
export * from './optimization/resource-optimizer';

// Factory function to create a configured PlatformAPI instance
import { PlatformAPI } from './core/platform-api';
import { PlatformConfig } from './types';
import { ConfigManager } from './config/config-manager';

export function createPlatform(config: PlatformConfig): PlatformAPI {
  const configManager = new ConfigManager();
  // Set the config
  configManager['config'] = config;

  return new PlatformAPI(config);
}

// Default configuration
export const defaultPlatformConfig: PlatformConfig = {
  name: 'ClaudeFlare Platform',
  version: '1.0.0',
  environment: 'development',
  services: [],
  global: {
    port: 3000,
    host: 'localhost',
    cluster: false,
    workers: 1,
    shutdownTimeout: 30000
  },
  orchestration: {
    enabled: true,
    autoScaling: {
      enabled: true,
      minInstances: 1,
      maxInstances: 10,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3
    },
    serviceDependencies: [],
    migration: {
      enabled: true,
      autoMigrate: true,
      backupBeforeMigration: true,
      rollbackOnFailure: true
    }
  },
  deployment: {
    enabled: true,
    strategy: 'rolling',
    healthCheckEndpoint: '/health',
    readinessProbe: {
      enabled: true,
      interval: 5000,
      timeout: 3000,
      threshold: 1,
      failureThreshold: 3
    },
    livenessProbe: {
      enabled: true,
      interval: 10000,
      timeout: 3000,
      threshold: 1,
      failureThreshold: 3
    },
    rollback: {
      enabled: true,
      automatic: true,
      timeout: 300000,
      healthCheckInterval: 10000
    }
  },
  optimization: {
    enabled: true,
    cpu: {
      enabled: true,
      target: 0.7,
      scaleDown: 0.3
    },
    memory: {
      enabled: true,
      target: 0.8,
      scaleDown: 0.3
    },
    network: {
      enabled: true,
      compression: true,
      caching: true
    },
    database: {
      enabled: true,
      connectionPooling: true,
      queryCaching: true
    }
  }
};

// Version information
export const version = '1.0.0';