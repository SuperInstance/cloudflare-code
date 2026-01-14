/**
 * Type Definitions Index
 *
 * Central export point for all framework types.
 */

export * from './agent.types';
export * from './message.types';
export * from './task.types';
export * from './pattern.types';

/**
 * Framework-wide error types
 */
export enum FrameworkError {
  // Agent errors
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_ALREADY_EXISTS = 'AGENT_ALREADY_EXISTS',
  AGENT_INITIALIZATION_FAILED = 'AGENT_INITIALIZATION_FAILED',
  AGENT_TERMINATION_FAILED = 'AGENT_TERMINATION_FAILED',

  // Task errors
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_INVALID = 'TASK_INVALID',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  TASK_DEPENDENCY_FAILED = 'TASK_DEPENDENCY_FAILED',

  // Message errors
  MESSAGE_DELIVERY_FAILED = 'MESSAGE_DELIVERY_FAILED',
  MESSAGE_VALIDATION_FAILED = 'MESSAGE_VALIDATION_FAILED',
  MESSAGE_TIMEOUT = 'MESSAGE_TIMEOUT',

  // Pattern errors
  PATTERN_NOT_SUPPORTED = 'PATTERN_NOT_SUPPORTED',
  PATTERN_EXECUTION_FAILED = 'PATTERN_EXECUTION_FAILED',
  PATTERN_VALIDATION_FAILED = 'PATTERN_VALIDATION_FAILED',

  // Registry errors
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  DEREGISTRATION_FAILED = 'DEREGISTRATION_FAILED',
  CAPABILITY_MISMATCH = 'CAPABILITY_MISMATCH',

  // Communication errors
  COMMUNICATION_ERROR = 'COMMUNICATION_ERROR',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  UNSUBSCRIPTION_FAILED = 'UNSUBSCRIPTION_FAILED',

  // Lifecycle errors
  LIFECYCLE_ERROR = 'LIFECYCLE_ERROR',
  SPAWN_FAILED = 'SPAWN_FAILED',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',

  // System errors
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SYSTEM_OVERLOAD = 'SYSTEM_OVERLOAD'
}

/**
 * Framework error class
 */
export class AgentFrameworkError extends Error {
  constructor(
    message: string,
    public code: FrameworkError,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentFrameworkError';
  }
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  tasks: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  messages: {
    sent: number;
    received: number;
    pending: number;
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  timestamp: number;
  checks: Record<string, HealthCheck>;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Individual health check
 */
export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration validation options
 */
export interface ValidationOptions {
  strict?: boolean;
  allowUnknown?: boolean;
  skipDefaults?: boolean;
}

/**
 * Logging levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}
