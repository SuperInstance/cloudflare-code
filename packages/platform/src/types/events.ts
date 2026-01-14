/**
 * Event Types
 *
 * Type definitions for platform events and event bus integration.
 */

/**
 * Base event interface
 */
export interface PlatformEvent<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly timestamp: number;
  readonly data: T;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Service lifecycle events
 */
export interface ServiceRegisteredEvent {
  readonly serviceId: string;
  readonly serviceType: string;
  readonly metadata: Record<string, unknown>;
}

export interface ServiceUnregisteredEvent {
  readonly serviceId: string;
  readonly reason: string;
}

export interface ServiceInitializedEvent {
  readonly serviceId: string;
  readonly duration: number;
}

export interface ServiceStartedEvent {
  readonly serviceId: string;
  readonly duration: number;
}

export interface ServiceStoppedEvent {
  readonly serviceId: string;
  readonly duration: number;
}

export interface ServiceFailedEvent {
  readonly serviceId: string;
  readonly error: string;
  readonly stack?: string;
}

export interface ServiceHealthChangedEvent {
  readonly serviceId: string;
  readonly previousStatus: string;
  readonly currentStatus: string;
  readonly timestamp: number;
}

/**
 * State management events
 */
export interface StateChangedEvent {
  readonly key: string;
  readonly scope?: string;
  readonly previousValue: unknown;
  readonly currentValue: unknown;
  readonly timestamp: number;
}

export interface StateDeletedEvent {
  readonly key: string;
  readonly scope?: string;
  readonly value: unknown;
  readonly timestamp: number;
}

export interface StateClearedEvent {
  readonly scope?: string;
  readonly count: number;
  readonly timestamp: number;
}

/**
 * AI service events
 */
export interface AIRequestEvent {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly timestamp: number;
}

export interface AIResponseEvent {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly duration: number;
  readonly timestamp: number;
}

export interface AIErrorEvent {
  readonly requestId: string;
  readonly provider: string;
  readonly error: string;
  readonly retryable: boolean;
  readonly timestamp: number;
}

/**
 * Agent events
 */
export interface AgentCreatedEvent {
  readonly agentId: string;
  readonly agentType: string;
  readonly config: Record<string, unknown>;
  readonly timestamp: number;
}

export interface AgentExecutedEvent {
  readonly agentId: string;
  readonly executionId: string;
  readonly duration: number;
  readonly success: boolean;
  readonly output?: unknown;
  readonly timestamp: number;
}

/**
 * Storage events
 */
export interface StorageReadEvent {
  readonly storageType: string;
  readonly key: string;
  readonly hit: boolean;
  readonly size?: number;
  readonly duration: number;
  readonly timestamp: number;
}

export interface StorageWriteEvent {
  readonly storageType: string;
  readonly key: string;
  readonly size: number;
  readonly duration: number;
  readonly timestamp: number;
}

export interface StorageDeleteEvent {
  readonly storageType: string;
  readonly key: string;
  readonly duration: number;
  readonly timestamp: number;
}

/**
 * Cache events
 */
export interface CacheHitEvent {
  readonly key: string;
  readonly level: 'L1' | 'L2';
  readonly size: number;
  readonly timestamp: number;
}

export interface CacheMissEvent {
  readonly key: string;
  readonly timestamp: number;
}

export interface CacheEvictionEvent {
  readonly key: string;
  readonly level: 'L1' | 'L2';
  readonly reason: 'expired' | 'capacity' | 'manual';
  readonly timestamp: number;
}

/**
 * Security events
 */
export interface AuthenticatedEvent {
  readonly userId: string;
  readonly method: string;
  readonly success: boolean;
  readonly timestamp: number;
}

export interface AuthorizationCheckEvent {
  readonly userId: string;
  readonly resource: string;
  readonly action: string;
  readonly allowed: boolean;
  readonly timestamp: number;
}

export interface AuditLogEvent {
  readonly eventId: string;
  readonly userId?: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: 'success' | 'failure';
  readonly timestamp: number;
}

/**
 * Platform lifecycle events
 */
export interface PlatformInitializedEvent {
  readonly duration: number;
  readonly services: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly status: string;
  }>;
  readonly timestamp: number;
}

export interface PlatformShutdownEvent {
  readonly reason: string;
  readonly duration: number;
  readonly timestamp: number;
}

/**
 * Configuration events
 */
export interface ConfigChangedEvent {
  readonly key: string;
  readonly previousValue: unknown;
  readonly currentValue: unknown;
  readonly timestamp: number;
}

export interface ConfigReloadedEvent {
  readonly source: string;
  readonly count: number;
  readonly timestamp: number;
}

/**
 * Event handler
 */
export type EventHandler<T = unknown> = (event: PlatformEvent<T>) => void | Promise<void>;

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  readonly once?: boolean;
  readonly filter?: (event: PlatformEvent) => boolean;
  readonly transform?: <T>(event: PlatformEvent<T>) => T | Promise<T>;
}

/**
 * Event publisher options
 */
export interface EventPublishOptions {
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly ttl?: number;
}
