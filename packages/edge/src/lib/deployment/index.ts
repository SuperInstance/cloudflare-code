/**
 * Multi-Region Deployment Module
 *
 * Production-ready deployment system supporting canary releases,
 * blue-green deployments, traffic routing, and automatic rollback.
 *
 * @example
 * ```ts
 * import { createDeploymentManager } from '@claudeflare/deployment';
 *
 * const manager = createDeploymentManager({
 *   enableAutoRollback: true,
 *   enableMetrics: true,
 * });
 *
 * // Create a canary deployment
 * const deploymentId = await manager.createDeployment({
 *   id: 'deployment-1',
 *   version: {
 *     version: '2.0.0',
 *     commitSha: 'abc123',
 *     buildTime: Date.now(),
 *   },
 *   regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
 *   strategy: 'canary',
 *   canary: {
 *     initialPercentage: 10,
 *     incrementPercentage: 10,
 *     incrementInterval: 300000, // 5 minutes
 *     autoPromoteThreshold: 0.01, // 1% error rate
 *     autoRollbackThreshold: 0.05, // 5% error rate
 *   },
 * });
 *
 * await manager.startDeployment(deploymentId);
 * ```
 */

// Core types
export type {
  Region,
  DeploymentStatus,
  DeploymentStrategy,
  TrafficRuleType,
  DeploymentVersion,
  RegionDeployment,
  DeploymentConfig,
  TrafficRule,
  DeploymentState,
  DeploymentMetrics,
  DeploymentEvent,
  DeploymentManagerOptions,
  TrafficRoutingResult,
  RollbackOptions,
} from './types';

// Deployment Manager
export {
  DeploymentManager,
  createDeploymentManager,
} from './manager';

// Convenience re-exports
export { createDeploymentManager as createManager } from './manager';
export { createDeploymentManager as init } from './manager';
