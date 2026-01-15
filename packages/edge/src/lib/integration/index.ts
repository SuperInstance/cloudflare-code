/**
 * Unified Package Integration Layer
 *
 * Complete package integration solution for the ClaudeFlare ecosystem.
 * Provides service discovery, orchestration, health monitoring, and event-driven communication.
 *
 * @example
 * ```ts
 * import { createIntegrationManager } from '@claudeflare/integration';
 *
 * const manager = createIntegrationManager({
 *   enableAutoDiscovery: true,
 *   enableAutoHealthMonitoring: true,
 * });
 *
 * await manager.start();
 *
 * // Register a package
 * await manager.registerPackage({
 *   id: { name: '@claudeflare/streaming', version: '1.0.0', instanceId: 'streaming-1' },
 *   type: 'service',
 *   capabilities: [
 *     {
 *       name: 'stream-processing',
 *       version: '1.0.0',
 *       description: 'Process streaming data',
 *     },
 *   ],
 *   dependencies: [],
 *   tags: ['streaming', 'real-time'],
 * });
 *
 * // Invoke a capability
 * const result = await manager.getOrchestrator().invokeDiscovered(
 *   'stream-processing',
 *   { data: 'example' }
 * );
 * ```
 */

// Core types
export type {
  PackageIdentifier,
  PackageCapability,
  PackageMetadata,
  PackageHealth,
  PackageHealthStatus,
  ServiceDiscoveryRequest,
  ServiceDiscoveryResult,
  PackageInvocationRequest,
  PackageInvocationResponse,
  PackageEvent,
  EventSubscription,
  PackageRegistryConfig,
  PackageRegistryStats,
} from './types';

// Registry
export { PackageRegistry, createPackageRegistry } from './registry';

// Orchestrator
export type {
  InvocationOptions,
  OrchestratorConfig,
  InvocationMetrics,
} from './orchestrator';
export {
  PackageOrchestrator,
  createPackageOrchestrator,
} from './orchestrator';

// Event Bus
export type {
  EventFilter,
  EventHandler,
  EventSubscriptionOptions,
  PublishResult,
  EventBusConfig,
  EventBusStats,
  EventReplayOptions,
} from './event-bus';
export {
  EventBus,
  createEventBus,
} from './event-bus';

// Integration Manager
export type {
  IntegrationManagerConfig,
  IntegrationManagerStatus,
} from './manager';
export {
  IntegrationManager,
  createIntegrationManager,
  getGlobalIntegrationManager,
  resetGlobalIntegrationManager,
} from './manager';

// Convenience re-exports
export { createIntegrationManager as createManager } from './manager';
export { createIntegrationManager as init } from './manager';
export { getGlobalIntegrationManager as getGlobal } from './manager';
