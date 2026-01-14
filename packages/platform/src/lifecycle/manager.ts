/**
 * Lifecycle Manager
 *
 * Service lifecycle management with hooks and phases.
 */

import type {
  ServiceInstance,
  ServiceLifecycle,
  ResourceId,
} from '../types/core';

/**
 * Lifecycle phase
 */
export enum LifecyclePhase {
  CREATE = 'create',
  CONFIGURE = 'configure',
  INITIALIZE = 'initialize',
  START = 'start',
  STOP = 'stop',
  DESTROY = 'destroy',
}

/**
 * Lifecycle hook
 */
export interface LifecycleHook {
  readonly phase: LifecyclePhase;
  readonly handler: () => void | Promise<void>;
  readonly priority: number;
}

/**
 * Lifecycle transition
 */
export interface LifecycleTransition {
  readonly from: ServiceLifecycle;
  readonly to: ServiceLifecycle;
  readonly timestamp: number;
  readonly duration: number;
}

/**
 * Lifecycle manager
 */
export class LifecycleManager {
  private services: Map<ResourceId, ServiceLifecycleState>;
  private hooks: Map<LifecyclePhase, LifecycleHook[]>;
  private transitions: Map<ResourceId, LifecycleTransition[]>;
  private disposed: boolean;

  constructor() {
    this.services = new Map();
    this.hooks = new Map();
    this.transitions = new Map();
    this.disposed = false;
  }

  /**
   * Register a service
   */
  register(service: ServiceInstance): void {
    this.assertNotDisposed();

    this.services.set(service.metadata.id, {
      service,
      phase: LifecyclePhase.CREATE,
      transitions: [],
    });
  }

  /**
   * Unregister a service
   */
  unregister(serviceId: ResourceId): void {
    this.services.delete(serviceId);
    this.transitions.delete(serviceId);
  }

  /**
   * Add a lifecycle hook
   */
  addHook(hook: LifecycleHook): this {
    if (!this.hooks.has(hook.phase)) {
      this.hooks.set(hook.phase, []);
    }

    this.hooks.get(hook.phase)!.push(hook);

    // Sort by priority (lower = earlier)
    this.hooks.get(hook.phase)!.sort((a, b) => a.priority - b.priority);

    return this;
  }

  /**
   * Remove a lifecycle hook
   */
  removeHook(phase: LifecyclePhase, handler: () => void): this {
    const hooks = this.hooks.get(phase);

    if (hooks) {
      const index = hooks.findIndex((h) => h.handler === handler);

      if (index !== -1) {
        hooks.splice(index, 1);
      }
    }

    return this;
  }

  /**
   * Execute a lifecycle phase
   */
  async executePhase(
    serviceId: ResourceId,
    phase: LifecyclePhase
  ): Promise<void> {
    this.assertNotDisposed();

    const state = this.services.get(serviceId);

    if (!state) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const startTime = Date.now();

    // Execute hooks
    const hooks = this.hooks.get(phase) || [];

    for (const hook of hooks) {
      try {
        await hook.handler();
      } catch (error) {
        console.error(
          `Error in lifecycle hook for ${phase} of ${serviceId}:`,
          error
        );
        throw error;
      }
    }

    // Execute service method
    try {
      switch (phase) {
        case LifecyclePhase.INITIALIZE:
          await state.service.initialize();
          break;
        case LifecyclePhase.START:
          await state.service.start();
          break;
        case LifecyclePhase.STOP:
          await state.service.stop();
          break;
        case LifecyclePhase.DESTROY:
          await state.service.destroy();
          break;
      }

      state.phase = phase;

      // Record transition
      const transition: LifecycleTransition = {
        from: state.service.lifecycle as ServiceLifecycle,
        to: state.service.lifecycle as ServiceLifecycle,
        timestamp: startTime,
        duration: Date.now() - startTime,
      };

      if (!this.transitions.has(serviceId)) {
        this.transitions.set(serviceId, []);
      }

      this.transitions.get(serviceId)!.push(transition);
      state.transitions.push(transition);
    } catch (error) {
      console.error(
        `Error executing phase ${phase} for service ${serviceId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Initialize a service
   */
  async initialize(serviceId: ResourceId): Promise<void> {
    await this.executePhase(serviceId, LifecyclePhase.INITIALIZE);
  }

  /**
   * Start a service
   */
  async start(serviceId: ResourceId): Promise<void> {
    await this.executePhase(serviceId, LifecyclePhase.START);
  }

  /**
   * Stop a service
   */
  async stop(serviceId: ResourceId): Promise<void> {
    await this.executePhase(serviceId, LifecyclePhase.STOP);
  }

  /**
   * Destroy a service
   */
  async destroy(serviceId: ResourceId): Promise<void> {
    await this.executePhase(serviceId, LifecyclePhase.DESTROY);
  }

  /**
   * Get service state
   */
  getState(serviceId: ResourceId): ServiceLifecycleState | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get service transitions
   */
  getTransitions(
    serviceId: ResourceId
  ): ReadonlyArray<LifecycleTransition> {
    return this.transitions.get(serviceId) || [];
  }

  /**
   * Get all services in a phase
   */
  getServicesInPhase(phase: LifecyclePhase): ResourceId[] {
    const result: ResourceId[] = [];

    for (const [id, state] of this.services.entries()) {
      if (state.phase === phase) {
        result.push(id);
      }
    }

    return result;
  }

  /**
   * Dispose of lifecycle manager
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop all services
    for (const [serviceId] of this.services.entries()) {
      try {
        await this.stop(serviceId);
      } catch (error) {
        console.error(`Error stopping service ${serviceId}:`, error);
      }
    }

    // Clear all
    this.services.clear();
    this.hooks.clear();
    this.transitions.clear();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('LifecycleManager has been disposed');
    }
  }
}

/**
 * Service lifecycle state
 */
interface ServiceLifecycleState {
  readonly service: ServiceInstance;
  phase: LifecyclePhase;
  transitions: LifecycleTransition[];
}

/**
 * Lifecycle hooks builder
 */
export class LifecycleHooksBuilder {
  private hooks: LifecycleHook[] = [];

  /**
   * Add a hook for CREATE phase
   */
  onCreate(handler: () => void | Promise<void>, priority = 0): this {
    this.hooks.push({
      phase: LifecyclePhase.CREATE,
      handler,
      priority,
    });
    return this;
  }

  /**
   * Add a hook for CONFIGURE phase
   */
  onConfigure(handler: () => void | Promise<void>, priority = 0): this {
    this.hooks.push({
      phase: LifecyclePhase.CONFIGURE,
      handler,
      priority,
    });
    return this;
  }

  /**
   * Add a hook for INITIALIZE phase
   */
  onInitialize(handler: () => void | Promise<void>, priority = 0): this {
    this.hooks.push({
      phase: LifecyclePhase.INITIALIZE,
      handler,
      priority,
    });
    return this;
  }

  /**
   * Add a hook for START phase
   */
  onStart(handler: () => void | Promise<void>, priority = 0): this {
    this.hooks.push({
      phase: LifecyclePhase.START,
      handler,
      priority,
    });
    return this;
  }

  /**
   * Add a hook for STOP phase
   */
  onStop(handler: () => void | Promise<void>, priority = 0): this {
    this.hooks.push({
      phase: LifecyclePhase.STOP,
      handler,
      priority,
    });
    return this;
  }

  /**
   * Add a hook for DESTROY phase
   */
  onDestroy(handler: () => void | Promise<void>, priority = 0): this {
    this.hooks.push({
      phase: LifecyclePhase.DESTROY,
      handler,
      priority,
    });
    return this;
  }

  /**
   * Build hooks array
   */
  build(): LifecycleHook[] {
    return [...this.hooks];
  }

  /**
   * Apply hooks to lifecycle manager
   */
  apply(manager: LifecycleManager): this {
    for (const hook of this.hooks) {
      manager.addHook(hook);
    }
    return this;
  }
}

/**
 * Common lifecycle hooks
 */
export const CommonLifecycleHooks = {
  /**
   * Logging hook
   */
  logging: (serviceId: string): LifecycleHook => ({
    phase: LifecyclePhase.START,
    priority: 1000,
    handler: async () => {
      console.log(`[Lifecycle] Starting service: ${serviceId}`);
    },
  }),

  /**
   * Health check hook
   */
  healthCheck: (serviceId: string): LifecycleHook => ({
    phase: LifecyclePhase.START,
    priority: -1000,
    handler: async () => {
      console.log(`[Lifecycle] Health check for: ${serviceId}`);
    },
  }),

  /**
   * Metrics hook
   */
  metrics: (
    serviceId: string,
    metrics: { increment: (name: string) => void }
  ): LifecycleHook => ({
    phase: LifecyclePhase.START,
    priority: 0,
    handler: async () => {
      metrics.increment(`lifecycle.start.${serviceId}`);
    },
  }),

  /**
   * Cleanup hook
   */
  cleanup: (serviceId: string): LifecycleHook => ({
    phase: LifecyclePhase.DESTROY,
    priority: -1000,
    handler: async () => {
      console.log(`[Lifecycle] Cleaning up service: ${serviceId}`);
    },
  }),
};
