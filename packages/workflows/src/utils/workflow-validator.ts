/**
 * Workflow Validator
 */

import type { Workflow, ValidationResult, ValidationError, ValidationWarning } from '../types';

export class WorkflowValidator {
  /**
   * Validate a workflow
   */
  public validate(workflow: Workflow): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate workflow metadata
    this.validateMetadata(workflow, errors, warnings);

    // Validate nodes
    this.validateNodes(workflow, errors, warnings);

    // Validate connections
    this.validateConnections(workflow, errors, warnings);

    // Validate triggers
    this.validateTriggers(workflow, errors, warnings);

    // Validate variables
    this.validateVariables(workflow, errors, warnings);

    // Check for cycles
    const cycles = this.detectCycles(workflow);
    for (const cycle of cycles) {
      errors.push({
        type: 'connection',
        id: cycle.join('->'),
        message: `Cycle detected: ${cycle.join(' -> ')}`,
        severity: 'error'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate workflow metadata
   */
  private validateMetadata(
    workflow: Workflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!workflow.name || workflow.name.trim() === '') {
      errors.push({
        type: 'workflow',
        id: workflow.id,
        message: 'Workflow name is required',
        severity: 'error'
      });
    }

    if (workflow.name && workflow.name.length > 200) {
      warnings.push({
        type: 'workflow',
        id: workflow.id,
        message: 'Workflow name is very long',
        severity: 'warning'
      });
    }

    if (!workflow.description || workflow.description.trim() === '') {
      warnings.push({
        type: 'workflow',
        id: workflow.id,
        message: 'Workflow description is recommended',
        severity: 'warning'
      });
    }
  }

  /**
   * Validate nodes
   */
  private validateNodes(
    workflow: Workflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (workflow.nodes.length === 0) {
      errors.push({
        type: 'workflow',
        id: workflow.id,
        message: 'Workflow must have at least one node',
        severity: 'error'
      });
      return;
    }

    const nodeIds = new Set<string>();

    for (const node of workflow.nodes) {
      // Check for duplicate node IDs
      if (nodeIds.has(node.id)) {
        errors.push({
          type: 'node',
          id: node.id,
          message: 'Duplicate node ID detected',
          severity: 'error'
        });
      }
      nodeIds.add(node.id);

      // Validate node name
      if (!node.name || node.name.trim() === '') {
        errors.push({
          type: 'node',
          id: node.id,
          message: 'Node name is required',
          severity: 'error'
        });
      }

      // Validate action type for action nodes
      if (node.type === 'action' && !node.actionType) {
        errors.push({
          type: 'node',
          id: node.id,
          message: 'Action node must have an action type',
          severity: 'error'
        });
      }

      // Validate node position
      if (node.position.x < 0 || node.position.y < 0) {
        warnings.push({
          type: 'node',
          id: node.id,
          message: 'Node position has negative coordinates',
          severity: 'warning'
        });
      }

      // Validate timeout
      if (node.timeout !== undefined && node.timeout <= 0) {
        errors.push({
          type: 'node',
          id: node.id,
          message: 'Node timeout must be positive',
          severity: 'error'
        });
      }

      // Validate retry config
      if (node.retryConfig) {
        if (node.retryConfig.maxAttempts < 0) {
          errors.push({
            type: 'node',
            id: node.id,
            message: 'Retry max attempts cannot be negative',
            severity: 'error'
          });
        }

        if (node.retryConfig.initialDelay < 0) {
          errors.push({
            type: 'node',
            id: node.id,
            message: 'Retry initial delay cannot be negative',
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Validate connections
   */
  private validateConnections(
    workflow: Workflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const connectionIds = new Set<string>();

    for (const conn of workflow.connections) {
      // Check for duplicate connection IDs
      if (connectionIds.has(conn.id)) {
        errors.push({
          type: 'connection',
          id: conn.id,
          message: 'Duplicate connection ID detected',
          severity: 'error'
        });
      }
      connectionIds.add(conn.id);

      // Check if source node exists
      const sourceExists = workflow.nodes.some(n => n.id === conn.sourceNodeId);
      if (!sourceExists) {
        errors.push({
          type: 'connection',
          id: conn.id,
          message: `Source node not found: ${conn.sourceNodeId}`,
          severity: 'error'
        });
      }

      // Check if target node exists
      const targetExists = workflow.nodes.some(n => n.id === conn.targetNodeId);
      if (!targetExists) {
        errors.push({
          type: 'connection',
          id: conn.id,
          message: `Target node not found: ${conn.targetNodeId}`,
          severity: 'error'
        });
      }

      // Check for self-loops
      if (conn.sourceNodeId === conn.targetNodeId) {
        errors.push({
          type: 'connection',
          id: conn.id,
          message: 'Self-loops are not allowed',
          severity: 'error'
        });
      }

      // Check for duplicate connections
      const isDuplicate = workflow.connections.some(
        c =>
          c.id !== conn.id &&
          c.sourceNodeId === conn.sourceNodeId &&
          c.targetNodeId === conn.targetNodeId
      );

      if (isDuplicate) {
        warnings.push({
          type: 'connection',
          id: conn.id,
          message: 'Duplicate connection detected',
          severity: 'warning'
        });
      }
    }

    // Check for orphaned nodes
    for (const node of workflow.nodes) {
      const hasConnections = workflow.connections.some(
        c => c.sourceNodeId === node.id || c.targetNodeId === node.id
      );

      if (!hasConnections && workflow.nodes.length > 1) {
        warnings.push({
          type: 'node',
          id: node.id,
          message: 'Node is not connected to any other nodes',
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Validate triggers
   */
  private validateTriggers(
    workflow: Workflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    for (const trigger of workflow.triggers) {
      // Check if trigger node exists
      const nodeExists = workflow.nodes.some(n => n.id === trigger.nodeId);
      if (!nodeExists) {
        errors.push({
          type: 'node',
          id: trigger.id,
          message: `Trigger node not found: ${trigger.nodeId}`,
          severity: 'error'
        });
      }

      // Validate trigger name
      if (!trigger.name || trigger.name.trim() === '') {
        errors.push({
          type: 'node',
          id: trigger.id,
          message: 'Trigger name is required',
          severity: 'error'
        });
      }

      // Validate webhook trigger
      if (trigger.type === 'webhook') {
        const config = trigger.config as any;
        if (!config.endpoint || config.endpoint.trim() === '') {
          errors.push({
            type: 'node',
            id: trigger.id,
            message: 'Webhook endpoint is required',
            severity: 'error'
          });
        }

        if (!config.method || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method)) {
          errors.push({
            type: 'node',
            id: trigger.id,
            message: 'Invalid webhook method',
            severity: 'error'
          });
        }
      }

      // Validate schedule trigger
      if (trigger.type === 'schedule') {
        const config = trigger.config as any;
        if (config.scheduleType === 'cron' && !config.cron) {
          errors.push({
            type: 'node',
            id: trigger.id,
            message: 'Cron expression is required for cron schedule',
            severity: 'error'
          });
        }

        if (config.scheduleType === 'interval' && !config.interval) {
          errors.push({
            type: 'node',
            id: trigger.id,
            message: 'Interval is required for interval schedule',
            severity: 'error'
          });
        }

        if (config.scheduleType === 'once' && !config.runAt) {
          errors.push({
            type: 'node',
            id: trigger.id,
            message: 'Run time is required for one-time schedule',
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Validate variables
   */
  private validateVariables(
    workflow: Workflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const variableNames = new Set<string>();

    for (const variable of workflow.variables) {
      // Check for duplicate variable names
      if (variableNames.has(variable.name)) {
        errors.push({
          type: 'workflow',
          id: workflow.id,
          message: `Duplicate variable name: ${variable.name}`,
          severity: 'error'
        });
      }
      variableNames.add(variable.name);

      // Validate variable name format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        errors.push({
          type: 'workflow',
          id: workflow.id,
          message: `Invalid variable name: ${variable.name}`,
          severity: 'error'
        });
      }

      // Validate variable type
      if (
        !['string', 'number', 'boolean', 'object', 'array'].includes(variable.type)
      ) {
        errors.push({
          type: 'workflow',
          id: workflow.id,
          message: `Invalid variable type: ${variable.type}`,
          severity: 'error'
        });
      }

      // Check if required variable has a value
      if (variable.required && (variable.value === undefined || variable.value === null)) {
        if (!variable.defaultValue) {
          errors.push({
            type: 'workflow',
            id: workflow.id,
            message: `Required variable has no value: ${variable.name}`,
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Detect cycles in the workflow
   */
  private detectCycles(workflow: Workflow): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const buildAdjacencyList = (): Map<string, string[]> => {
      const adj = new Map<string, string[]>();
      for (const node of workflow.nodes) {
        adj.set(node.id, []);
      }
      for (const conn of workflow.connections) {
        const sources = adj.get(conn.sourceNodeId) || [];
        sources.push(conn.targetNodeId);
        adj.set(conn.sourceNodeId, sources);
      }
      return adj;
    };

    const adj = buildAdjacencyList();

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const children = adj.get(nodeId) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          dfs(childId);
        } else if (recursionStack.has(childId)) {
          const cycleStart = path.indexOf(childId);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle, childId]);
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }
}
