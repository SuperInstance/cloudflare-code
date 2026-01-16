// @ts-nocheck
/**
 * Workflow Serializer - serialize and deserialize workflows
 */

import type { Workflow } from '../types';

export class WorkflowSerializer {
  /**
   * Serialize workflow to JSON
   */
  public serialize(workflow: Workflow): string {
    return JSON.stringify(workflow, this.dateReplacer, 2);
  }

  /**
   * Deserialize workflow from JSON
   */
  public deserialize(json: string): Workflow {
    const workflow = JSON.parse(json, this.dateReviver);

    // Validate required fields
    if (!workflow.id) {
      throw new Error('Invalid workflow: missing id');
    }

    if (!workflow.name) {
      throw new Error('Invalid workflow: missing name');
    }

    if (!Array.isArray(workflow.nodes)) {
      throw new Error('Invalid workflow: nodes must be an array');
    }

    if (!Array.isArray(workflow.connections)) {
      throw new Error('Invalid workflow: connections must be an array');
    }

    return workflow;
  }

  /**
   * Serialize workflow to compressed format
   */
  public serializeCompressed(workflow: Workflow): string {
    // Remove unnecessary fields for storage
    const compressed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      status: workflow.status,
      nodes: workflow.nodes.map(n => ({
        id: n.id,
        type: n.type,
        actionType: n.actionType,
        name: n.name,
        position: n.position,
        config: n.config,
        enabled: n.enabled
      })),
      connections: workflow.connections,
      triggers: workflow.triggers,
      variables: workflow.variables,
      settings: workflow.settings
    };

    return JSON.stringify(compressed);
  }

  /**
   * Deserialize workflow from compressed format
   */
  public deserializeCompressed(json: string): Workflow {
    const compressed = JSON.parse(json);

    return {
      ...compressed,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: compressed.metadata || {}
    } as Workflow;
  }

  /**
   * Export workflow for sharing
   */
  public exportForSharing(workflow: Workflow): string {
    // Remove sensitive information
    const exported = {
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes.map(n => ({
        type: n.type,
        actionType: n.actionType,
        name: n.name,
        description: n.description,
        config: this.sanitizeConfig(n.config),
        enabled: n.enabled
      })),
      connections: workflow.connections.map(c => ({
        sourceNodeId: c.sourceNodeId,
        targetNodeId: c.targetNodeId,
        sourceOutput: c.sourceOutput,
        targetInput: c.targetInput
      })),
      variables: workflow.variables.filter(v => !v.secret).map(v => ({
        name: v.name,
        type: v.type,
        required: v.required,
        description: v.description
      })),
      metadata: workflow.metadata
    };

    return JSON.stringify(exported, null, 2);
  }

  /**
   * Import workflow from shared format
   */
  public importFromShared(json: string): Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> {
    const imported = JSON.parse(json);

    return {
      ...imported,
      version: 1,
      status: 'draft',
      triggers: imported.triggers || [],
      settings: imported.settings || {
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: imported.metadata || {}
    };
  }

  /**
   * Date replacer for JSON serialization
   */
  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  /**
   * Date reviver for JSON deserialization
   */
  private dateReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  /**
   * Sanitize config to remove sensitive information
   */
  private sanitizeConfig(config: any): any {
    if (!config) {
      return config;
    }

    const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key'];
    const sanitized: any = {};

    for (const [key, value] of Object.entries(config)) {
      const isSensitive = sensitiveKeys.some(sensitiveKey =>
        key.toLowerCase().includes(sensitiveKey)
      );

      if (isSensitive) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeConfig(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
