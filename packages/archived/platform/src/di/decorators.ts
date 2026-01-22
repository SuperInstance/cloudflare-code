// @ts-nocheck
/**
 * Dependency Injection Decorators
 *
 * TypeScript decorators for dependency injection.
 */

import 'reflect-metadata';
import type { DIToken, DIFactory, DIRegistrationOptions } from '../types/di';
import { InjectionToken, DIError, DILifecycle } from '../types/di';

/**
 * Injectable decorator for classes
 */
export function Injectable(options: DIRegistrationOptions = {}) {
  return function <T extends new (...args: unknown[]) => unknown>(
    constructor: T
  ): T {
    // Store injection metadata
    const designParamTypes = Reflect.getMetadata(
      'design:paramtypes',
      constructor
    ) as Array<new (...args: unknown[]) => unknown>;

    const dependencies: DIToken[] = [];

    for (const paramType of designParamTypes) {
      if (paramType === Injectable) {
        continue;
      }
      dependencies.push(paramType);
    }

    // Store metadata for later registration
    Reflect.defineMetadata(
      'injectable',
      {
        constructor,
        dependencies,
        options: {
          lifecycle: options.lifecycle || DILifecycle.SINGLETON,
          ...options,
        },
      },
      constructor
    );

    return constructor;
  };
}

/**
 * Inject decorator for constructor parameters
 */
export function Inject(token: DIToken | string) {
  return function (
    target: unknown,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    const injectToken =
      typeof token === 'string' ? new InjectionToken(token) : token;

    const existingTokens =
      Reflect.getMetadata('design:paramtypes', target) || [];
    existingTokens[parameterIndex] = injectToken;
    Reflect.defineMetadata('design:paramtypes', existingTokens, target);
  };
}

/**
 * Optional decorator for optional dependencies
 */
export function Optional() {
  return function (
    target: unknown,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    const existingOptionals =
      Reflect.getMetadata('optional:params', target) || [];
    existingOptionals.push(parameterIndex);
    Reflect.defineMetadata('optional:params', existingOptionals, target);
  };
}

/**
 * Self decorator for self-injection
 */
export function Self() {
  return function (
    target: unknown,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    const existingSelf =
      Reflect.getMetadata('self:params', target) || [];
    existingSelf.push(parameterIndex);
    Reflect.defineMetadata('self:params', existingSelf, target);
  };
}

/**
 * Scoped decorator for scoped services
 */
export function Scoped() {
  return Injectable({ lifecycle: DILifecycle.SCOPED });
}

/**
 * Transient decorator for transient services
 */
export function Transient() {
  return Injectable({ lifecycle: DILifecycle.TRANSIENT });
}

/**
 * Singleton decorator (default)
 */
export function Singleton() {
  return Injectable({ lifecycle: DILifecycle.SINGLETON });
}

/**
 * Service decorator for automatic registration
 */
export function Service(name?: string) {
  return function <T extends new (...args: unknown[]) => unknown>(
    constructor: T
  ): T {
    const serviceName = name || constructor.name;

    // Store service metadata
    Reflect.defineMetadata(
      'service:name',
      serviceName,
      constructor
    );

    // Make it injectable
    return Injectable()(constructor);
  };
}

/**
 * Property injector decorator
 */
export function InjectProperty(token: DIToken | string) {
  return function (
    target: unknown,
    propertyKey: string
  ): void {
    const injectToken =
      typeof token === 'string' ? new InjectionToken(token) : token;

    // Store property injection metadata
    const propertyInjections =
      Reflect.getMetadata('property:injections', target.constructor) || {};
    propertyInjections[propertyKey] = injectToken;
    Reflect.defineMetadata(
      'property:injections',
      propertyInjections,
      target.constructor
    );
  };
}

/**
 * Metadata utilities
 */
export class DecoratorUtils {
  /**
   * Get injectable metadata
   */
  static getInjectableMetadata(
    constructor: new (...args: unknown[]) => unknown
  ):
    | {
        constructor: new (...args: unknown[]) => unknown;
        dependencies: DIToken[];
        options: DIRegistrationOptions;
      }
    | undefined {
    return Reflect.getMetadata('injectable', constructor);
  }

  /**
   * Check if class is injectable
   */
  static isInjectable(
    constructor: new (...args: unknown[]) => unknown
  ): boolean {
    return Reflect.hasMetadata('injectable', constructor);
  }

  /**
   * Get service name
   */
  static getServiceName(
    constructor: new (...args: unknown[]) => unknown
  ): string | undefined {
    return Reflect.getMetadata('service:name', constructor);
  }

  /**
   * Get property injections
   */
  static getPropertyInjections(
    constructor: new (...args: unknown[]) => unknown
  ): Record<string, DIToken> {
    return (
      Reflect.getMetadata('property:injections', constructor) || {}
    );
  }

  /**
   * Get optional parameters
   */
  static getOptionalParameters(
    target: unknown
  ): number[] {
    return Reflect.getMetadata('optional:params', target) || [];
  }

  /**
   * Get self parameters
   */
  static getSelfParameters(
    target: unknown
  ): number[] {
    return Reflect.getMetadata('self:params', target) || [];
  }

  /**
   * Create factory from constructor
   */
  static createFactory<T>(
    constructor: new (...args: unknown[]) => T
  ): DIFactory<T> {
    return async (container) => {
      const metadata = this.getInjectableMetadata(constructor);

      if (!metadata) {
        throw new DIError(
          'INVALID_FACTORY' as any,
          constructor,
          'Class is not injectable. Use @Injectable() decorator.'
        );
      }

      const dependencies = await Promise.all(
        metadata.dependencies.map((dep) =>
          container.resolve<typeof constructor.prototype>(dep as DIToken)
        )
      );

      return new constructor(...dependencies);
    };
  }
}

/**
 * Initialize class with DI
 */
export function injectClass<T>(
  container: DIContainer,
  constructor: new (...args: unknown[]) => T
): T {
  const metadata = DecoratorUtils.getInjectableMetadata(constructor);

  if (!metadata) {
    throw new Error('Class is not injectable');
  }

  // Register if not already registered
  if (!container.has(constructor as unknown as DIToken<T>)) {
    const factory = DecoratorUtils.createFactory(constructor);
    container.register(
      constructor as unknown as DIToken<T>,
      factory,
      metadata.options
    );
  }

  // Inject properties
  const propertyInjections = DecoratorUtils.getPropertyInjections(constructor);
  for (const [propertyKey, token] of Object.entries(propertyInjections)) {
    // Property injection would need to be handled separately
    // as TypeScript doesn't support runtime property assignment
  }

  return container.resolve(constructor as unknown as DIToken<T>);
}

// Re-export DIContainer for type usage
import type { DIContainer } from './container';
