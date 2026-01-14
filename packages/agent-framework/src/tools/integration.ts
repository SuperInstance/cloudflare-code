/**
 * Tool Integration System
 *
 * Provides tool discovery, invocation, composition,
 * result processing, and permission management for agents.
 */

import type { AgentId, TaskId } from '../types';
import { createLogger } from '../utils/logger';
import { generateId, timeout } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';

/**
 * Tool definition
 */
export interface Tool {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  returnType: ToolReturnType;
  handler: ToolHandler;
  permissions: string[];
  timeout: number;
  rateLimit?: RateLimit;
  metadata: Record<string, unknown>;
}

/**
 * Tool parameter
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
  enum?: unknown[];
  validation?: ParameterValidation;
}

/**
 * Parameter validation rules
 */
export interface ParameterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  custom?: (value: unknown) => boolean;
}

/**
 * Tool return type
 */
export interface ToolReturnType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'stream';
  description: string;
  schema?: Record<string, unknown>;
}

/**
 * Tool handler function
 */
export type ToolHandler = (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

/**
 * Tool execution context
 */
export interface ToolContext {
  agentId: AgentId;
  taskId?: TaskId;
  sessionId?: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

/**
 * Tool result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  executionTime: number;
}

/**
 * Tool invocation
 */
export interface ToolInvocation {
  invocationId: string;
  toolId: string;
  agentId: AgentId;
  taskId?: TaskId;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startTime: number;
  endTime?: number;
  result?: ToolResult;
  error?: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  maxCalls: number;
  period: number; // milliseconds
}

/**
 * Tool composition
 */
export interface ToolComposition {
  compositionId: string;
  name: string;
  description: string;
  tools: ToolCompositionStep[];
  executionStrategy: 'sequential' | 'parallel' | 'conditional';
}

/**
 * Tool composition step
 */
export interface ToolCompositionStep {
  stepId: string;
  toolId: string;
  parameters: Record<string, unknown> | ((previousResults: Map<string, ToolResult>) => Record<string, unknown>);
  dependsOn: string[];
  condition?: (results: Map<string, ToolResult>) => boolean;
}

/**
 * Permission grant
 */
export interface PermissionGrant {
  agentId: AgentId;
  toolId: string;
  permissions: string[];
  grantedAt: number;
  expiresAt?: number;
  grantedBy: string;
}

/**
 * Tool registry configuration
 */
export interface ToolRegistryConfig {
  enableCache: boolean;
  cacheTimeout: number;
  enableMetrics: boolean;
  defaultTimeout: number;
  maxConcurrentInvocations: number;
}

/**
 * Tool registry events
 */
export interface ToolRegistryEvents {
  'tool:registered': (tool: Tool) => void;
  'tool:unregistered': (toolId: string) => void;
  'tool:invoked': (invocation: ToolInvocation) => void;
  'tool:completed': (invocation: ToolInvocation) => void;
  'tool:failed': (invocation: ToolInvocation, error: Error) => void;
  'permission:granted': (grant: PermissionGrant) => void;
  'permission:revoked': (agentId: AgentId, toolId: string) => void;
}

/**
 * Tool Registry class
 */
export class ToolRegistry extends EventEmitter<ToolRegistryEvents> {
  private config: ToolRegistryConfig;
  private logger = createLogger('ToolRegistry');
  private tools: Map<string, Tool>;
  private invocations: Map<string, ToolInvocation>;
  private permissions: Map<string, PermissionGrant[]>; // agentId -> grants
  private rateLimitTracking: Map<string, number[]>; // toolId -> timestamps
  private metrics: ToolMetrics;

  constructor(config: Partial<ToolRegistryConfig> = {}) {
    super();

    this.config = {
      enableCache: true,
      cacheTimeout: 60000, // 1 minute
      enableMetrics: true,
      defaultTimeout: 30000,
      maxConcurrentInvocations: 100,
      ...config
    };

    this.tools = new Map();
    this.invocations = new Map();
    this.permissions = new Map();
    this.rateLimitTracking = new Map();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ToolMetrics {
    return {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      timeoutInvocations: 0,
      averageExecutionTime: 0,
      toolUsage: new Map(),
      lastReset: Date.now()
    };
  }

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.logger.info('Registering tool', { toolId: tool.id, name: tool.name });

    // Validate tool definition
    this.validateTool(tool);

    this.tools.set(tool.id, tool);
    this.metrics.toolUsage.set(tool.id, 0);

    this.emit('tool:registered', tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): void {
    this.logger.info('Unregistering tool', { toolId });

    if (!this.tools.has(toolId)) {
      throw new Error(`Tool ${toolId} not found`);
    }

    this.tools.delete(toolId);
    this.metrics.toolUsage.delete(toolId);

    // Revoke all permissions for this tool
    for (const [agentId, grants] of this.permissions) {
      const filtered = grants.filter(g => g.toolId !== toolId);
      this.permissions.set(agentId, filtered);
    }

    this.emit('tool:unregistered', toolId);
  }

  /**
   * Get tool by ID
   */
  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Search tools by criteria
   */
  searchTools(criteria: {
    category?: string;
    name?: string;
    permissions?: string[];
  }): Tool[] {
    let tools = Array.from(this.tools.values());

    if (criteria.category) {
      tools = tools.filter(t => t.category === criteria.category);
    }

    if (criteria.name) {
      tools = tools.filter(t => t.name.includes(criteria.name!));
    }

    if (criteria.permissions && criteria.permissions.length > 0) {
      tools = tools.filter(t =>
        criteria.permissions!.some(p => t.permissions.includes(p))
      );
    }

    return tools;
  }

  /**
   * Invoke a tool
   */
  async invokeTool(
    toolId: string,
    agentId: AgentId,
    parameters: Record<string, unknown>,
    context?: Partial<ToolContext>
  ): Promise<ToolResult> {
    this.logger.debug('Invoking tool', { toolId, agentId });

    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Check permissions
    await this.checkPermissions(agentId, toolId);

    // Check rate limits
    await this.checkRateLimit(toolId);

    // Validate parameters
    await this.validateParameters(tool, parameters);

    // Create invocation record
    const invocationId = generateId('invocation');
    const invocation: ToolInvocation = {
      invocationId,
      toolId,
      agentId,
      parameters,
      status: 'pending',
      startTime: Date.now()
    };

    this.invocations.set(invocationId, invocation);

    this.emit('tool:invoked', invocation);

    try {
      // Set status to running
      invocation.status = 'running';

      // Execute tool with timeout
      const result = await timeout(
        tool.handler(parameters, {
          agentId,
          timestamp: Date.now(),
          metadata: context?.metadata || {}
        }),
        tool.timeout || this.config.defaultTimeout,
        `Tool ${toolId} invocation timeout`
      );

      invocation.status = 'completed';
      invocation.endTime = Date.now();
      invocation.result = result;

      // Update metrics
      this.metrics.totalInvocations++;
      this.metrics.successfulInvocations++;
      this.metrics.averageExecutionTime =
        (this.metrics.averageExecutionTime * (this.metrics.totalInvocations - 1) +
          (invocation.endTime - invocation.startTime)) /
        this.metrics.totalInvocations;
      this.metrics.toolUsage.set(toolId, (this.metrics.toolUsage.get(toolId) || 0) + 1);

      this.emit('tool:completed', invocation);

      return result;
    } catch (error) {
      invocation.status = 'failed';
      invocation.endTime = Date.now();
      invocation.error = error instanceof Error ? error.message : 'Unknown error';

      // Update metrics
      this.metrics.totalInvocations++;
      this.metrics.failedInvocations++;

      this.emit('tool:failed', invocation, error as Error);

      return {
        success: false,
        error: invocation.error,
        executionTime: invocation.endTime - invocation.startTime
      };
    }
  }

  /**
   * Compose and execute multiple tools
   */
  async composeTools(
    composition: ToolComposition,
    agentId: AgentId,
    context?: Partial<ToolContext>
  ): Promise<Map<string, ToolResult>> {
    this.logger.info('Executing tool composition', {
      compositionId: composition.compositionId,
      toolCount: composition.tools.length
    });

    const results = new Map<string, ToolResult>();

    if (composition.executionStrategy === 'sequential') {
      // Execute tools sequentially
      for (const step of composition.tools) {
        // Check dependencies
        if (step.dependsOn.length > 0) {
          for (const dep of step.dependsOn) {
            if (!results.has(dep)) {
              throw new Error(`Dependency ${dep} not found`);
            }
          }
        }

        // Check condition
        if (step.condition && !step.condition(results)) {
          continue;
        }

        // Calculate parameters
        const params =
          typeof step.parameters === 'function'
            ? step.parameters(results)
            : step.parameters;

        // Execute tool
        const result = await this.invokeTool(step.toolId, agentId, params, context);
        results.set(step.stepId, result);

        // Stop on failure
        if (!result.success) {
          break;
        }
      }
    } else if (composition.executionStrategy === 'parallel') {
      // Execute tools in parallel
      const promises = composition.tools.map(async (step) => {
        const params =
          typeof step.parameters === 'function'
            ? step.parameters(results)
            : step.parameters;

        const result = await this.invokeTool(step.toolId, agentId, params, context);
        return { stepId: step.stepId, result };
      });

      const parallelResults = await Promise.all(promises);
      for (const { stepId, result } of parallelResults) {
        results.set(stepId, result);
      }
    }

    return results;
  }

  /**
   * Grant permission to agent for tool
   */
  grantPermission(
    agentId: AgentId,
    toolId: string,
    permissions: string[],
    grantedBy: string,
    expiresAt?: number
  ): void {
    this.logger.info('Granting tool permission', { agentId, toolId, permissions });

    const grant: PermissionGrant = {
      agentId,
      toolId,
      permissions,
      grantedAt: Date.now(),
      expiresAt,
      grantedBy
    };

    if (!this.permissions.has(agentId)) {
      this.permissions.set(agentId, []);
    }

    this.permissions.get(agentId)!.push(grant);

    this.emit('permission:granted', grant);
  }

  /**
   * Revoke permission from agent for tool
   */
  revokePermission(agentId: AgentId, toolId: string): void {
    this.logger.info('Revoking tool permission', { agentId, toolId });

    const grants = this.permissions.get(agentId);
    if (!grants) {
      return;
    }

    const filtered = grants.filter(g => g.toolId !== toolId);
    this.permissions.set(agentId, filtered);

    this.emit('permission:revoked', agentId, toolId);
  }

  /**
   * Check if agent has permission for tool
   */
  async checkPermissions(agentId: AgentId, toolId: string): Promise<void> {
    const grants = this.permissions.get(agentId);
    if (!grants || grants.length === 0) {
      throw new Error(`Agent ${agentId} has no permissions for tool ${toolId}`);
    }

    const toolGrants = grants.filter(g => g.toolId === toolId);
    if (toolGrants.length === 0) {
      throw new Error(`Agent ${agentId} has no permissions for tool ${toolId}`);
    }

    // Check expiration
    const now = Date.now();
    const validGrants = toolGrants.filter(g => !g.expiresAt || g.expiresAt > now);
    if (validGrants.length === 0) {
      throw new Error(`Agent ${agentId} permissions for tool ${toolId} have expired`);
    }
  }

  /**
   * Check rate limits for tool
   */
  private async checkRateLimit(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool || !tool.rateLimit) {
      return;
    }

    const now = Date.now();
    const timestamps = this.rateLimitTracking.get(toolId) || [];

    // Remove old timestamps outside the rate limit window
    const recentTimestamps = timestamps.filter(t => now - t < tool.rateLimit!.period);

    if (recentTimestamps.length >= tool.rateLimit.maxCalls) {
      throw new Error(`Rate limit exceeded for tool ${toolId}`);
    }

    recentTimestamps.push(now);
    this.rateLimitTracking.set(toolId, recentTimestamps);
  }

  /**
   * Validate tool definition
   */
  private validateTool(tool: Tool): void {
    if (!tool.id || !tool.name) {
      throw new Error('Tool must have id and name');
    }

    if (!tool.handler || typeof tool.handler !== 'function') {
      throw new Error('Tool must have a valid handler function');
    }

    for (const param of tool.parameters) {
      if (!param.name || !param.type) {
        throw new Error('Tool parameter must have name and type');
      }
    }
  }

  /**
   * Validate parameters against tool definition
   */
  private async validateParameters(
    tool: Tool,
    parameters: Record<string, unknown>
  ): Promise<void> {
    for (const param of tool.parameters) {
      const value = parameters[param.name];

      // Check required parameters
      if (param.required && value === undefined) {
        throw new Error(`Required parameter ${param.name} is missing`);
      }

      // Skip validation for optional parameters that are not provided
      if (!param.required && value === undefined) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, param.type)) {
        throw new Error(`Parameter ${param.name} must be of type ${param.type}`);
      }

      // Enum validation
      if (param.enum && !param.enum.includes(value)) {
        throw new Error(`Parameter ${param.name} must be one of ${param.enum.join(', ')}`);
      }

      // Custom validation
      if (param.validation) {
        await this.validateParameterValue(param.name, value, param.validation);
      }
    }
  }

  /**
   * Validate parameter value
   */
  private async validateParameterValue(
    name: string,
    value: unknown,
    validation: ParameterValidation
  ): Promise<void> {
    if (validation.min !== undefined && typeof value === 'number') {
      if (value < validation.min) {
        throw new Error(`Parameter ${name} must be >= ${validation.min}`);
      }
    }

    if (validation.max !== undefined && typeof value === 'number') {
      if (value > validation.max) {
        throw new Error(`Parameter ${name} must be <= ${validation.max}`);
      }
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        throw new Error(`Parameter ${name} does not match pattern ${validation.pattern}`);
      }
    }

    if (validation.minLength && typeof value === 'string') {
      if (value.length < validation.minLength) {
        throw new Error(`Parameter ${name} must have length >= ${validation.minLength}`);
      }
    }

    if (validation.maxLength && typeof value === 'string') {
      if (value.length > validation.maxLength) {
        throw new Error(`Parameter ${name} must have length <= ${validation.maxLength}`);
      }
    }

    if (validation.custom && !validation.custom(value)) {
      throw new Error(`Parameter ${name} failed custom validation`);
    }
  }

  /**
   * Validate type
   */
  private validateType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Get tool metrics
   */
  getMetrics(): ToolMetrics {
    return {
      ...this.metrics,
      toolUsage: new Map(this.metrics.toolUsage)
    };
  }

  /**
   * Get invocation by ID
   */
  getInvocation(invocationId: string): ToolInvocation | undefined {
    return this.invocations.get(invocationId);
  }

  /**
   * Get tool usage statistics
   */
  getToolUsage(toolId: string): number {
    return this.metrics.toolUsage.get(toolId) || 0;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Shutdown tool registry
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down tool registry');

    this.tools.clear();
    this.invocations.clear();
    this.permissions.clear();
    this.rateLimitTracking.clear();

    this.removeAllListeners();
  }
}

/**
 * Tool metrics
 */
export interface ToolMetrics {
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  timeoutInvocations: number;
  averageExecutionTime: number;
  toolUsage: Map<string, number>;
  lastReset: number;
}
