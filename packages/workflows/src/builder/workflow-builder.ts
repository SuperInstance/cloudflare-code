/**
 * Visual Workflow Builder
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  Node,
  Connection,
  Position,
  NodeId,
  BuilderState,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types';
import { ActionRegistry } from '../actions/registry';

export class WorkflowBuilder {
  private workflow: Workflow;
  private actionRegistry: ActionRegistry;
  private state: BuilderState;
  private history: Workflow[] = [];
  private historyIndex: number = -1;

  constructor(actionRegistry?: ActionRegistry) {
    this.actionRegistry = actionRegistry || new ActionRegistry();
    this.workflow = this.createEmptyWorkflow();
    this.state = this.createInitialState();
  }

  /**
   * Create an empty workflow
   */
  private createEmptyWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Untitled Workflow',
      description: '',
      version: 1,
      status: 'draft',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create initial builder state
   */
  private createInitialState(): BuilderState {
    return {
      workflow: this.workflow,
      selectedNodes: [],
      selectedConnections: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      history: {
        past: [],
        present: this.workflow,
        future: []
      },
      validation: {
        valid: true,
        errors: [],
        warnings: []
      }
    };
  }

  /**
   * Set workflow metadata
   */
  public setMetadata(metadata: { name?: string; description?: string }): void {
    if (metadata.name) {
      this.workflow.name = metadata.name;
    }
    if (metadata.description !== undefined) {
      this.workflow.description = metadata.description;
    }
    this.workflow.updatedAt = new Date();
    this.saveToHistory();
  }

  /**
   * Add a node to the workflow
   */
  public addNode(
    type: Node['type'],
    actionType?: string,
    position?: Position
  ): Node {
    const node: Node = {
      id: uuidv4() as NodeId,
      type,
      actionType: actionType as any,
      name: this.generateNodeName(type, actionType),
      position: position || { x: 100, y: 100 },
      config: {},
      enabled: true
    };

    this.workflow.nodes.push(node);
    this.workflow.updatedAt = new Date();
    this.saveToHistory();
    this.validate();

    return node;
  }

  /**
   * Update a node
   */
  public updateNode(nodeId: NodeId, updates: Partial<Node>): void {
    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (node) {
      Object.assign(node, updates);
      this.workflow.updatedAt = new Date();
      this.saveToHistory();
      this.validate();
    }
  }

  /**
   * Delete a node
   */
  public deleteNode(nodeId: NodeId): void {
    this.workflow.nodes = this.workflow.nodes.filter(n => n.id !== nodeId);
    this.workflow.connections = this.workflow.connections.filter(
      c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );
    this.workflow.updatedAt = new Date();
    this.saveToHistory();
    this.validate();
  }

  /**
   * Duplicate a node
   */
  public duplicateNode(nodeId: NodeId): Node | null {
    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      return null;
    }

    const duplicated: Node = {
      ...node,
      id: uuidv4() as NodeId,
      name: `${node.name} (copy)`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      }
    };

    this.workflow.nodes.push(duplicated);
    this.workflow.updatedAt = new Date();
    this.saveToHistory();
    this.validate();

    return duplicated;
  }

  /**
   * Connect two nodes
   */
  public connectNodes(
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
    sourceOutput?: string,
    targetInput?: string
  ): Connection | null {
    // Check if connection already exists
    const exists = this.workflow.connections.some(
      c => c.sourceNodeId === sourceNodeId && c.targetNodeId === targetNodeId
    );

    if (exists) {
      return null;
    }

    const connection: Connection = {
      id: uuidv4(),
      sourceNodeId,
      targetNodeId,
      sourceOutput,
      targetInput
    };

    this.workflow.connections.push(connection);
    this.workflow.updatedAt = new Date();
    this.saveToHistory();
    this.validate();

    return connection;
  }

  /**
   * Delete a connection
   */
  public deleteConnection(connectionId: string): void {
    this.workflow.connections = this.workflow.connections.filter(
      c => c.id !== connectionId
    );
    this.workflow.updatedAt = new Date();
    this.saveToHistory();
    this.validate();
  }

  /**
   * Select nodes
   */
  public selectNodes(nodeIds: NodeId[]): void {
    this.state.selectedNodes = nodeIds;
  }

  /**
   * Select connections
   */
  public selectConnections(connectionIds: string[]): void {
    this.state.selectedConnections = connectionIds;
  }

  /**
   * Clear selection
   */
  public clearSelection(): void {
    this.state.selectedNodes = [];
    this.state.selectedConnections = [];
  }

  /**
   * Copy selected nodes
   */
  public copy(): void {
    const selectedNodes = this.workflow.nodes.filter(n =>
      this.state.selectedNodes.includes(n.id)
    );

    const selectedConnections = this.workflow.connections.filter(c =>
      this.state.selectedNodes.includes(c.sourceNodeId) &&
      this.state.selectedNodes.includes(c.targetNodeId)
    );

    this.state.clipboard = {
      nodes: selectedNodes.map(n => ({ ...n })),
      connections: selectedConnections.map(c => ({ ...c }))
    };
  }

  /**
   * Paste copied nodes
   */
  public paste(): void {
    if (!this.state.clipboard) {
      return;
    }

    const idMap = new Map<NodeId, NodeId>();

    // Paste nodes
    for (const node of this.state.clipboard.nodes) {
      const newNode: Node = {
        ...node,
        id: uuidv4() as NodeId,
        name: `${node.name} (copy)`,
        position: {
          x: node.position.x + 100,
          y: node.position.y + 100
        }
      };

      this.workflow.nodes.push(newNode);
      idMap.set(node.id, newNode.id);
    }

    // Paste connections
    for (const conn of this.state.clipboard.connections) {
      const newSourceId = idMap.get(conn.sourceNodeId);
      const newTargetId = idMap.get(conn.targetNodeId);

      if (newSourceId && newTargetId) {
        this.workflow.connections.push({
          ...conn,
          id: uuidv4(),
          sourceNodeId: newSourceId,
          targetNodeId: newTargetId
        });
      }
    }

    this.workflow.updatedAt = new Date();
    this.saveToHistory();
    this.validate();
  }

  /**
   * Undo last action
   */
  public undo(): void {
    if (this.state.history.past.length > 0) {
      const previous = this.state.history.past[this.state.history.past.length - 1];
      this.state.history.future.push(this.state.history.present);
      this.state.history.past.pop();
      this.state.history.present = previous;
      this.workflow = previous;
      this.validate();
    }
  }

  /**
   * Redo last undone action
   */
  public redo(): void {
    if (this.state.history.future.length > 0) {
      const next = this.state.history.future[this.state.history.future.length - 1];
      this.state.history.past.push(this.state.history.present);
      this.state.history.future.pop();
      this.state.history.present = next;
      this.workflow = next;
      this.validate();
    }
  }

  /**
   * Set zoom level
   */
  public setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(3, zoom));
  }

  /**
   * Set pan position
   */
  public setPan(position: Position): void {
    this.state.pan = position;
  }

  /**
   * Validate the workflow
   */
  public validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for workflow name
    if (!this.workflow.name || this.workflow.name.trim() === '') {
      errors.push({
        type: 'workflow',
        id: this.workflow.id,
        message: 'Workflow name is required',
        severity: 'error'
      });
    }

    // Check for nodes
    if (this.workflow.nodes.length === 0) {
      errors.push({
        type: 'workflow',
        id: this.workflow.id,
        message: 'Workflow must have at least one node',
        severity: 'error'
      });
    }

    // Validate each node
    for (const node of this.workflow.nodes) {
      if (!node.name || node.name.trim() === '') {
        errors.push({
          type: 'node',
          id: node.id,
          message: 'Node name is required',
          severity: 'error'
        });
      }

      if (node.type === 'action' && !node.actionType) {
        errors.push({
          type: 'node',
          id: node.id,
          message: 'Action node must have an action type',
          severity: 'error'
        });
      }

      // Check if action type is valid
      if (node.actionType && !this.actionRegistry.has(node.actionType as any)) {
        warnings.push({
          type: 'node',
          id: node.id,
          message: `Unknown action type: ${node.actionType}`,
          severity: 'warning'
        });
      }

      // Check for orphaned nodes
      const hasConnections = this.workflow.connections.some(
        c => c.sourceNodeId === node.id || c.targetNodeId === node.id
      );

      if (!hasConnections && this.workflow.nodes.length > 1) {
        warnings.push({
          type: 'node',
          id: node.id,
          message: 'Node is not connected to any other nodes',
          severity: 'warning'
        });
      }
    }

    // Check for cycles
    const cycles = this.detectCycles();
    for (const cycle of cycles) {
      errors.push({
        type: 'connection',
        id: cycle.join('->'),
        message: `Cycle detected: ${cycle.join(' -> ')}`,
        severity: 'error'
      });
    }

    // Validate connections
    const connectionIds = new Set<string>();
    for (const conn of this.workflow.connections) {
      // Check for duplicate connections
      if (connectionIds.has(`${conn.sourceNodeId}-${conn.targetNodeId}`)) {
        errors.push({
          type: 'connection',
          id: conn.id,
          message: 'Duplicate connection detected',
          severity: 'error'
        });
      }
      connectionIds.add(`${conn.sourceNodeId}-${conn.targetNodeId}`);

      // Check if source and target nodes exist
      const sourceExists = this.workflow.nodes.some(n => n.id === conn.sourceNodeId);
      const targetExists = this.workflow.nodes.some(n => n.id === conn.targetNodeId);

      if (!sourceExists) {
        errors.push({
          type: 'connection',
          id: conn.id,
          message: `Source node not found: ${conn.sourceNodeId}`,
          severity: 'error'
        });
      }

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
    }

    this.state.validation = {
      valid: errors.length === 0,
      errors,
      warnings
    };

    return this.state.validation;
  }

  /**
   * Detect cycles in the workflow
   */
  private detectCycles(): NodeId[][] {
    const cycles: NodeId[][] = [];
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    const path: NodeId[] = [];

    const buildAdjacencyList = (): Map<NodeId, NodeId[]> => {
      const adj = new Map<NodeId, NodeId[]>();
      for (const node of this.workflow.nodes) {
        adj.set(node.id, []);
      }
      for (const conn of this.workflow.connections) {
        const sources = adj.get(conn.sourceNodeId) || [];
        sources.push(conn.targetNodeId);
        adj.set(conn.sourceNodeId, sources);
      }
      return adj;
    };

    const adj = buildAdjacencyList();

    const dfs = (nodeId: NodeId): void => {
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

    for (const node of this.workflow.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Generate a unique node name
   */
  private generateNodeName(type: Node['type'], actionType?: string): string {
    const baseName = actionType ? actionType.replace(/_/g, ' ') : type;
    const count = this.workflow.nodes.filter(
      n => n.name.startsWith(baseName)
    ).length;

    return count > 0 ? `${baseName} ${count + 1}` : baseName;
  }

  /**
   * Save current state to history
   */
  private saveToHistory(): void {
    this.state.history.past.push(this.state.history.present);
    this.state.history.present = JSON.parse(JSON.stringify(this.workflow));
    this.state.history.future = [];

    // Limit history size
    if (this.state.history.past.length > 50) {
      this.state.history.past.shift();
    }
  }

  /**
   * Get the current workflow
   */
  public getWorkflow(): Workflow {
    return this.workflow;
  }

  /**
   * Get the builder state
   */
  public getState(): BuilderState {
    return this.state;
  }

  /**
   * Load a workflow
   */
  public loadWorkflow(workflow: Workflow): void {
    this.workflow = workflow;
    this.state.history.present = workflow;
    this.state.history.past = [];
    this.state.history.future = [];
    this.validate();
  }

  /**
   * Get workflow statistics
   */
  public getStats(): {
    nodeCount: number;
    connectionCount: number;
    triggerCount: number;
    variableCount: number;
    categoryCounts: Record<string, number>;
  } {
    const categoryCounts: Record<string, number> = {};

    for (const node of this.workflow.nodes) {
      const category = node.actionType
        ? this.actionRegistry.get(node.actionType as any)?.category || 'unknown'
        : 'unknown';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    return {
      nodeCount: this.workflow.nodes.length,
      connectionCount: this.workflow.connections.length,
      triggerCount: this.workflow.triggers.length,
      variableCount: this.workflow.variables.length,
      categoryCounts
    };
  }

  /**
   * Export workflow as JSON
   */
  public exportJSON(): string {
    return JSON.stringify(this.workflow, null, 2);
  }

  /**
   * Import workflow from JSON
   */
  public importJSON(json: string): void {
    try {
      const workflow = JSON.parse(json);
      this.loadWorkflow(workflow);
    } catch (error) {
      throw new Error('Invalid workflow JSON');
    }
  }
}
