/**
 * Dependency Injection Container
 *
 * Advanced dependency injection with lifecycle management, scopes, and circular dependency detection.
 */

import type {
  DIToken,
  DIFactory,
  DILifecycle,
  DIRegistrationOptions,
  DIResolutionContext,
  DIContainerOptions,
  DIErrorType,
} from '../types/di';

import { DIError, DILifecycle as Lifecycle, InjectionToken } from '../types/di';

/**
 * DI Container implementation
 */
export class DIContainer {
  private registrations: Map<DIToken, DIRegistrationImpl>;
  private instances: Map<DIToken, unknown>;
  private scopes: Set<DIScopeImpl>;
  private resolutionStack: DIToken[];
  private options: Required<DIContainerOptions>;
  private disposed: boolean;

  constructor(options: DIContainerOptions = {}) {
    this.registrations = new Map();
    this.instances = new Map();
    this.scopes = new Set();
    this.resolutionStack = [];
    this.disposed = false;

    this.options = {
      autoRegister: options.autoRegister || false,
      enableCache: options.enableCache !== false,
      enableProxy: options.enableProxy || false,
      maxDepth: options.maxDepth || 100,
      onResolution: options.onResolution || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * Register a dependency
   */
  register<T>(
    token: DIToken<T>,
    factory: DIFactory<T>,
    options: DIRegistrationOptions = {}
  ): this {
    if (this.disposed) {
      throw new DIError(
        DIErrorType.INVALID_FACTORY,
        token,
        'Cannot register on disposed container'
      );
    }

    const lifecycle = this.resolveLifecycle(options);
    const dependencies = this.extractDependencies(factory);

    const registration: DIRegistrationImpl = {
      token,
      factory,
      lifecycle,
      dependencies,
      instance: undefined,
      initialized: false,
    };

    this.registrations.set(token, registration);

    return this;
  }

  /**
   * Register a singleton
   */
  registerSingleton<T>(
    token: DIToken<T>,
    factory: DIFactory<T>,
    deps: DIToken[] = []
  ): this {
    return this.register(token, factory, {
      lifecycle: Lifecycle.SINGLETON,
      deps,
    });
  }

  /**
   * Register a scoped dependency
   */
  registerScoped<T>(
    token: DIToken<T>,
    factory: DIFactory<T>,
    deps: DIToken[] = []
  ): this {
    return this.register(token, factory, {
      lifecycle: Lifecycle.SCOPED,
      deps,
    });
  }

  /**
   * Register a transient dependency
   */
  registerTransient<T>(
    token: DIToken<T>,
    factory: DIFactory<T>,
    deps: DIToken[] = []
  ): this {
    return this.register(token, factory, {
      lifecycle: Lifecycle.TRANSIENT,
      deps,
    });
  }

  /**
   * Register a value
   */
  registerValue<T>(token: DIToken<T>, value: T): this {
    return this.register(token, () => value, {
      lifecycle: Lifecycle.SINGLETON,
    });
  }

  /**
   * Check if a token is registered
   */
  has(token: DIToken): boolean {
    return this.registrations.has(token);
  }

  /**
   * Resolve a dependency
   */
  async resolve<T>(token: DIToken<T>): Promise<T> {
    if (this.disposed) {
      throw new DIError(
        DIErrorType.RESOLUTION_FAILED,
        token,
        'Cannot resolve from disposed container'
      );
    }

    const registration = this.registrations.get(token);

    if (!registration) {
      if (this.options.autoRegister) {
        throw new DIError(
          DIErrorType.TOKEN_NOT_FOUND,
          token,
          `Token not found and auto-register is enabled: ${this.formatToken(token)}`
        );
      }
      throw new DIError(
        DIErrorType.TOKEN_NOT_FOUND,
        token,
        `Token not registered: ${this.formatToken(token)}`
      );
    }

    // Check for circular dependencies
    if (this.resolutionStack.includes(token)) {
      throw new DIError(
        DIErrorType.CIRCULAR_DEPENDENCY,
        token,
        `Circular dependency detected: ${this.resolutionStack
          .map((t) => this.formatToken(t))
          .join(' -> ')} -> ${this.formatToken(token)}`
      );
    }

    // Return cached instance for singletons
    if (
      registration.lifecycle === Lifecycle.SINGLETON &&
      registration.initialized &&
      registration.instance !== undefined
    ) {
      return registration.instance as T;
    }

    // Push to resolution stack
    this.resolutionStack.push(token);

    try {
      // Resolve dependencies first
      const deps = await this.resolveDependencies(
        registration.dependencies
      );

      // Create instance
      const instance = await registration.factory(this);

      // Cache singleton instances
      if (registration.lifecycle === Lifecycle.SINGLETON) {
        registration.instance = instance;
        registration.initialized = true;
        this.instances.set(token, instance);
      }

      // Notify resolution
      this.options.onResolution(token, instance);

      return instance as T;
    } catch (error) {
      this.options.onError(token, error as Error);
      throw error;
    } finally {
      // Pop from resolution stack
      const index = this.resolutionStack.lastIndexOf(token);
      if (index !== -1) {
        this.resolutionStack.splice(index, 1);
      }
    }
  }

  /**
   * Resolve multiple dependencies
   */
  async resolveAll<T>(tokens: ReadonlyArray<DIToken<T>>): Promise<T[]> {
    const instances: T[] = [];

    for (const token of tokens) {
      const instance = await this.resolve(token);
      instances.push(instance);
    }

    return instances;
  }

  /**
   * Create a scoped container
   */
  createScope(): DIScopeImpl {
    const scope = new DIScopeImpl(this);
    this.scopes.add(scope);
    return scope;
  }

  /**
   * Dispose of the container and all resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Dispose all scopes
    for (const scope of this.scopes) {
      await scope.dispose();
    }
    this.scopes.clear();

    // Clear instances
    this.instances.clear();

    // Clear registrations
    this.registrations.clear();

    // Clear resolution stack
    this.resolutionStack = [];
  }

  /**
   * Get resolution context
   */
  getContext(): DIResolutionContext {
    return {
      resolving: new Set(this.resolutionStack),
      stack: [...this.resolutionStack],
    };
  }

  private resolveLifecycle(options: DIRegistrationOptions): DILifecycle {
    if (options.lifecycle) {
      return options.lifecycle;
    }

    if (options.singleton) {
      return Lifecycle.SINGLETON;
    }

    if (options.scoped) {
      return Lifecycle.SCOPED;
    }

    if (options.transient) {
      return Lifecycle.TRANSIENT;
    }

    return Lifecycle.SINGLETON;
  }

  private extractDependencies(factory: DIFactory): DIToken[] {
    const deps: DIToken[] = [];

    // Extract dependencies from factory function
    const factoryStr = factory.toString();

    // Match common dependency injection patterns
    const patterns = [
      /container\.resolve\(['"]([^'"]+)['"]\)/g,
      /container\.get\(['"]([^'"]+)['"]\)/g,
    ];

    for (const pattern of patterns) {
      let match;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        match = pattern.exec(factoryStr);
        if (!match) break;
        deps.push(match[1]);
      }
    }

    return deps;
  }

  private async resolveDependencies(
    tokens: ReadonlyArray<DIToken>
  ): Promise<unknown[]> {
    const deps: unknown[] = [];

    for (const token of tokens) {
      const dep = await this.resolve(token);
      deps.push(dep);
    }

    return deps;
  }

  private formatToken(token: DIToken): string {
    if (typeof token === 'string') {
      return token;
    }
    if (typeof token === 'symbol') {
      return token.toString();
    }
    if (token instanceof InjectionToken) {
      return token.toString();
    }
    return token.name || 'AnonymousToken';
  }
}

/**
 * DI Scope implementation
 */
export class DIScopeImpl {
  private parent: DIContainer;
  private instances: Map<DIToken, unknown>;
  private disposed: boolean;
  readonly id: string;

  constructor(parent: DIContainer, id?: string) {
    this.parent = parent;
    this.instances = new Map();
    this.disposed = false;
    this.id = id || `scope-${Date.now()}-${Math.random()}`;
  }

  /**
   * Resolve a dependency in this scope
   */
  async resolve<T>(token: DIToken<T>): Promise<T> {
    if (this.disposed) {
      throw new DIError(
        DIErrorType.RESOLUTION_FAILED,
        token,
        'Cannot resolve from disposed scope'
      );
    }

    // Check if already resolved in this scope
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // Resolve from parent
    const instance = await this.parent.resolve(token);

    // Cache in scope
    this.instances.set(token, instance);

    return instance as T;
  }

  /**
   * Check if a token is registered
   */
  has(token: DIToken): boolean {
    return this.parent.has(token);
  }

  /**
   * Dispose of this scope
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Clear scoped instances
    this.instances.clear();
  }
}

/**
 * Internal registration type
 */
interface DIRegistrationImpl {
  token: DIToken;
  factory: DIFactory;
  lifecycle: DILifecycle;
  dependencies: DIToken[];
  instance?: unknown;
  initialized: boolean;
}

/**
 * DI module builder
 */
export class DIModuleBuilder {
  private registrations: Array<{
    token: DIToken;
    factory: DIFactory;
    options?: DIRegistrationOptions;
  }> = [];

  register<T>(
    token: DIToken<T>,
    factory: DIFactory<T>,
    options?: DIRegistrationOptions
  ): this {
    this.registrations.push({ token, factory, options });
    return this;
  }

  registerSingleton<T>(
    token: DIToken<T>,
    factory: DIFactory<T>
  ): this {
    return this.register(token, factory, {
      lifecycle: Lifecycle.SINGLETON,
    });
  }

  registerScoped<T>(
    token: DIToken<T>,
    factory: DIFactory<T>
  ): this {
    return this.register(token, factory, {
      lifecycle: Lifecycle.SCOPED,
    });
  }

  registerTransient<T>(
    token: DIToken<T>,
    factory: DIFactory<T>
  ): this {
    return this.register(token, factory, {
      lifecycle: Lifecycle.TRANSIENT,
    });
  }

  registerValue<T>(token: DIToken<T>, value: T): this {
    return this.register(token, () => value, {
      lifecycle: Lifecycle.SINGLETON,
    });
  }

  build(container: DIContainer): DIContainer {
    for (const { token, factory, options } of this.registrations) {
      container.register(token, factory, options);
    }
    return container;
  }
}

/**
 * Decorator for dependency injection
 */
export function Injectable(options: DIRegistrationOptions = {}) {
  return function <T extends new (...args: unknown[]) => unknown>(
    constructor: T
  ): T {
    const token = new InjectionToken(constructor.name);

    // Store metadata for later registration
    Reflect.defineMetadata('injectable', { token, options }, constructor);

    return constructor;
  };
}

/**
 * Decorator for injecting dependencies
 */
export function Inject(token: DIToken) {
  return function (
    target: unknown,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    const existingTokens =
      Reflect.getMetadata('design:paramtypes', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('design:paramtypes', existingTokens, target);
  };
}

/**
 * Service container decorator
 */
export function ServiceContainer(options: DIContainerOptions = {}) {
  return function <T extends new (...args: unknown[]) => unknown>(
    constructor: T
  ): T {
    const container = new DIContainer(options);

    return class extends constructor {
      static readonly container = container;

      static async resolve<T>(): Promise<T> {
        return container.resolve(constructor as unknown as DIToken<T>);
      }
    } as T;
  };
}

/**
 * Re-export types
 */
export { InjectionToken, DIError, DILifecycle };
export type {
  DIToken,
  DIFactory,
  DIRegistrationOptions,
  DIContainerOptions,
  DIErrorType,
} from '../types/di';
