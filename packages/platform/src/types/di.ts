/**
 * Dependency Injection Types
 *
 * Type definitions for the dependency injection container.
 */

/**
 * DI token - can be a string, symbol, or constructor
 */
export type DIToken<T = unknown> = string | symbol | abstract new (...args: unknown[]) => T;

/**
 * DI factory or constructor
 */
export type DIFactory<T> = (container: DIContainer) => T | Promise<T>;

/**
 * DI constructor
 */
export type DIConstructor<T> = new (...args: unknown[]) => T;

/**
 * DI registration
 */
export interface DIRegistration<T = unknown> {
  readonly token: DIToken<T>;
  readonly factory: DIFactory<T>;
  readonly lifecycle: DILifecycle;
  readonly dependencies: ReadonlyArray<DIToken>;
  readonly instance?: T;
  readonly initialized: boolean;
}

/**
 * DI lifecycle
 */
export enum DILifecycle {
  SINGLETON = 'singleton',
  SCOPED = 'scoped',
  TRANSIENT = 'transient',
}

/**
 * DI resolution context
 */
export interface DIResolutionContext {
  readonly resolving: Set<DIToken>;
  readonly stack: ReadonlyArray<DIToken>;
  readonly scope?: DIScope;
}

/**
 * DI scope
 */
export interface DIScope {
  readonly id: string;
  readonly parent?: DIScope;
  readonly registrations: ReadonlyMap<DIToken, unknown>;

  resolve<T>(token: DIToken<T>): Promise<T>;
  dispose(): Promise<void>;
}

/**
 * DI container options
 */
export interface DIContainerOptions {
  readonly autoRegister?: boolean;
  readonly enableCache?: boolean;
  readonly enableProxy?: boolean;
  readonly maxDepth?: number;
  readonly onResolution?: (token: DIToken, instance: unknown) => void;
  readonly onError?: (token: DIToken, error: Error) => void;
}

/**
 * DI error types
 */
export enum DIErrorType {
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  INVALID_FACTORY = 'INVALID_FACTORY',
  RESOLUTION_FAILED = 'RESOLUTION_FAILED',
  DISPOSE_FAILED = 'DISPOSE_FAILED',
}

/**
 * DI error
 */
export class DIError extends Error {
  constructor(
    public readonly type: DIErrorType,
    public readonly token: DIToken,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DIError';
  }
}

/**
 * DI module for grouping registrations
 */
export interface DIModule {
  readonly name: string;
  readonly imports?: ReadonlyArray<DIModule>;
  readonly exports?: ReadonlyArray<DIToken>;
  readonly providers: ReadonlyArray<DIProvider>;
}

/**
 * DI provider
 */
export interface DIProvider {
  readonly provide: DIToken;
  readonly useFactory?: DIFactory<unknown>;
  readonly useClass?: DIConstructor<unknown>;
  readonly useValue?: unknown;
  readonly deps?: ReadonlyArray<DIToken>;
  readonly lifecycle?: DILifecycle;
  readonly multi?: boolean;
}

/**
 * DI injection token with type
 */
export class InjectionToken<T = unknown> {
  constructor(public readonly description: string) {
    Object.freeze(this);
  }

  toString(): string {
    return `InjectionToken(${this.description})`;
  }
}
