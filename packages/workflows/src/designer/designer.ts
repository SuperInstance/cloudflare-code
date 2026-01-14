/**
 * Visual Workflow Designer
 * Provides a drag-and-drop interface for building workflows visually
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  Node,
  Connection,
  NodeId,
  Position,
  ActionType,
  BuilderState,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types';

export interface DesignerConfig {
  canvasWidth?: number;
  canvasHeight?: number;
  gridSize?: number;
  snapToGrid?: boolean;
  enableShortcuts?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

export interface NodeTemplate {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'loop' | 'parallel' | 'wait';
  actionType?: ActionType;
  name: string;
  description: string;
  icon: string;
  category: string;
  config: any;
  defaults: any;
}

export interface DragState {
  isDragging: boolean;
  draggedNodes: NodeId[];
  dragOffset: Position;
  originalPositions: Map<NodeId, Position>;
}

export interface SelectionState {
  selectedNodes: NodeId[];
  selectedConnections: string[];
  selectionBox?: {
    start: Position;
    end: Position;
  };
}

export interface ConnectionDraft {
  sourceNodeId: NodeId;
  sourceOutput?: string;
  targetNodeId?: NodeId;
  targetInput?: string;
  mousePosition: Position;
}

export class WorkflowDesigner {
  private state: BuilderState;
  private config: Required<DesignerConfig>;
  private nodeTemplates: Map<string, NodeTemplate>;
  private dragState: DragState;
  private selectionState: SelectionState;
  private connectionDraft?: ConnectionDraft;
  private clipboard?: {
    nodes: Node[];
    connections: Connection[];
  };
  private history: {
    past: Workflow[];
    present: Workflow;
    future: Workflow[];
  };
  private autoSaveTimer?: ReturnType<typeof setInterval>;

  constructor(workflow: Workflow, config: DesignerConfig = {}) {
    this.config = {
      canvasWidth: 2000,
      canvasHeight: 1500,
      gridSize: 20,
      snapToGrid: true,
      enableShortcuts: true,
      autoSave: true,
      autoSaveInterval: 30000,
      ...config
    };

    this.state = {
      workflow,
      selectedNodes: [],
      selectedConnections: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      history: {
        past: [],
        present: workflow,
        future: []
      },
      validation: this.validateWorkflow(workflow)
    };

    this.nodeTemplates = new Map();
    this.dragState = {
      isDragging: false,
      draggedNodes: [],
      dragOffset: { x: 0, y: 0 },
      originalPositions: new Map()
    };

    this.selectionState = {
      selectedNodes: [],
      selectedConnections: []
    };

    this.history = {
      past: [],
      present: workflow,
      future: []
    };

    this.initializeNodeTemplates();

    if (this.config.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Initialize available node templates
   */
  private initializeNodeTemplates(): void {
    // Trigger templates
    this.registerTemplate({
      id: 'webhook-trigger',
      type: 'trigger',
      name: 'Webhook',
      description: 'Trigger workflow via HTTP webhook',
      icon: '🔗',
      category: 'triggers',
      config: { type: 'webhook' },
      defaults: {
        name: 'Webhook Trigger',
        config: {
          endpoint: '',
          method: 'POST',
          authentication: { type: 'none' }
        }
      }
    });

    this.registerTemplate({
      id: 'schedule-trigger',
      type: 'trigger',
      name: 'Schedule',
      description: 'Trigger workflow on a schedule',
      icon: '⏰',
      category: 'triggers',
      config: { type: 'schedule' },
      defaults: {
        name: 'Schedule Trigger',
        config: {
          scheduleType: 'cron',
          cron: '0 * * * *',
          timezone: 'UTC'
        }
      }
    });

    this.registerTemplate({
      id: 'event-trigger',
      type: 'trigger',
      name: 'Event',
      description: 'Trigger workflow on an event',
      icon: '⚡',
      category: 'triggers',
      config: { type: 'event' },
      defaults: {
        name: 'Event Trigger',
        config: {
          eventType: '',
          source: '',
          filters: {}
        }
      }
    });

    // Action templates
    this.registerTemplate({
      id: 'http-request',
      type: 'action',
      actionType: 'http_post' as ActionType,
      name: 'HTTP Request',
      description: 'Make an HTTP request',
      icon: '🌐',
      category: 'actions',
      config: { type: 'http_post' },
      defaults: {
        name: 'HTTP Request',
        actionType: 'http_post',
        config: {
          url: '',
          method: 'POST',
          headers: {},
          body: {}
        }
      }
    });

    this.registerTemplate({
      id: 'code-generation',
      type: 'action',
      actionType: 'generate_code' as ActionType,
      name: 'Generate Code',
      description: 'Generate code using AI',
      icon: '🤖',
      category: 'ai',
      config: { type: 'generate_code' },
      defaults: {
        name: 'Generate Code',
        actionType: 'generate_code',
        config: {
          prompt: '',
          language: 'typescript',
          context: ''
        }
      }
    });

    this.registerTemplate({
      id: 'send-email',
      type: 'action',
      actionType: 'send_email' as ActionType,
      name: 'Send Email',
      description: 'Send an email notification',
      icon: '📧',
      category: 'communication',
      config: { type: 'send_email' },
      defaults: {
        name: 'Send Email',
        actionType: 'send_email',
        config: {
          to: '',
          subject: '',
          body: ''
        }
      }
    });

    this.registerTemplate({
      id: 'kv-get',
      type: 'action',
      actionType: 'kv_get' as ActionType,
      name: 'KV Get',
      description: 'Get value from KV storage',
      icon: '💾',
      category: 'storage',
      config: { type: 'kv_get' },
      defaults: {
        name: 'KV Get',
        actionType: 'kv_get',
        config: {
          key: '',
          namespace: ''
        }
      }
    });

    this.registerTemplate({
      id: 'kv-set',
      type: 'action',
      actionType: 'kv_set' as ActionType,
      name: 'KV Set',
      description: 'Set value in KV storage',
      icon: '💾',
      category: 'storage',
      config: { type: 'kv_set' },
      defaults: {
        name: 'KV Set',
        actionType: 'kv_set',
        config: {
          key: '',
          value: '',
          namespace: '',
          ttl: null
        }
      }
    });

    // Logic templates
    this.registerTemplate({
      id: 'condition',
      type: 'condition',
      name: 'Condition',
      description: 'Conditional branching',
      icon: '🔀',
      category: 'logic',
      config: { type: 'condition' },
      defaults: {
        name: 'Condition',
        type: 'condition',
        config: {
          conditions: [],
          branches: []
        }
      }
    });

    this.registerTemplate({
      id: 'loop',
      type: 'loop',
      name: 'Loop',
      description: 'Iterate over items',
      icon: '🔁',
      category: 'logic',
      config: { type: 'loop' },
      defaults: {
        name: 'Loop',
        type: 'loop',
        config: {
          iterations: {
            type: 'forEach',
            iterable: '',
            maxIterations: 100
          }
        }
      }
    });

    this.registerTemplate({
      id: 'parallel',
      type: 'parallel',
      name: 'Parallel',
      description: 'Execute tasks in parallel',
      icon: '⚡',
      category: 'logic',
      config: { type: 'parallel' },
      defaults: {
        name: 'Parallel',
        type: 'parallel',
        config: {
          branches: []
        }
      }
    });

    this.registerTemplate({
      id: 'wait',
      type: 'wait',
      name: 'Wait',
      description: 'Wait for a specified time',
      icon: '⏸️',
      category: 'logic',
      config: { type: 'wait' },
      defaults: {
        name: 'Wait',
        type: 'wait',
        config: {
          waitTime: 1000
        }
      }
    });
  }

  /**
   * Register a new node template
   */
  public registerTemplate(template: NodeTemplate): void {
    this.nodeTemplates.set(template.id, template);
  }

  /**
   * Get all available templates
   */
  public getTemplates(): NodeTemplate[] {
    return Array.from(this.nodeTemplates.values());
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): NodeTemplate[] {
    return Array.from(this.nodeTemplates.values()).filter(
      t => t.category === category
    );
  }

  /**
   * Add a node to the workflow
   */
  public addNode(
    templateId: string,
    position: Position,
    customConfig?: any
  ): Node {
    const template = this.nodeTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const node: Node = {
      id: uuidv4() as NodeId,
      type: template.type,
      actionType: template.actionType,
      name: customConfig?.name || template.defaults.name,
      description: template.description,
      config: { ...template.defaults.config, ...customConfig },
      position: this.snapToGrid(position),
      enabled: true
    };

    this.saveToHistory();
    this.state.workflow.nodes.push(node);
    this.state.validation = this.validateWorkflow(this.state.workflow);

    return node;
  }

  /**
   * Remove a node from the workflow
   */
  public removeNode(nodeId: NodeId): void {
    this.saveToHistory();

    // Remove node
    this.state.workflow.nodes = this.state.workflow.nodes.filter(
      n => n.id !== nodeId
    );

    // Remove associated connections
    this.state.workflow.connections = this.state.workflow.connections.filter(
      c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );

    // Remove from selection
    this.selectionState.selectedNodes = this.selectionState.selectedNodes.filter(
      id => id !== nodeId
    );

    this.state.validation = this.validateWorkflow(this.state.workflow);
  }

  /**
   * Update a node's configuration
   */
  public updateNode(nodeId: NodeId, updates: Partial<Node>): void {
    const node = this.state.workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    this.saveToHistory();
    Object.assign(node, updates);
    this.state.validation = this.validateWorkflow(this.state.workflow);
  }

  /**
   * Move nodes to new positions
   */
  public moveNodes(nodeIds: NodeId[], delta: Position): void {
    for (const nodeId of nodeIds) {
      const node = this.state.workflow.nodes.find(n => n.id === nodeId);
      if (node) {
        node.position = this.snapToGrid({
          x: node.position.x + delta.x,
          y: node.position.y + delta.y
        });
      }
    }
  }

  /**
   * Start dragging nodes
   */
  public startDrag(nodeIds: NodeId[], offset: Position): void {
    this.dragState.isDragging = true;
    this.dragState.draggedNodes = nodeIds;
    this.dragState.dragOffset = offset;

    // Store original positions for undo
    for (const nodeId of nodeIds) {
      const node = this.state.workflow.nodes.find(n => n.id === nodeId);
      if (node) {
        this.dragState.originalPositions.set(nodeId, { ...node.position });
      }
    }
  }

  /**
   * Update drag position
   */
  public updateDrag(position: Position): void {
    if (!this.dragState.isDragging) return;

    const delta = {
      x: position.x - this.dragState.dragOffset.x,
      y: position.y - this.dragState.dragOffset.y
    };

    this.moveNodes(this.dragState.draggedNodes, delta);
  }

  /**
   * End dragging
   */
  public endDrag(): void {
    if (this.dragState.isDragging) {
      this.saveToHistory();
    }
    this.dragState.isDragging = false;
    this.dragState.draggedNodes = [];
    this.dragState.originalPositions.clear();
  }

  /**
   * Select nodes
   */
  public selectNodes(nodeIds: NodeId[], addToSelection = false): void {
    if (!addToSelection) {
      this.selectionState.selectedNodes = nodeIds;
    } else {
      for (const nodeId of nodeIds) {
        if (!this.selectionState.selectedNodes.includes(nodeId)) {
          this.selectionState.selectedNodes.push(nodeId);
        }
      }
    }

    this.state.selectedNodes = this.selectionState.selectedNodes;
  }

  /**
   * Select connections
   */
  public selectConnections(connectionIds: string[], addToSelection = false): void {
    if (!addToSelection) {
      this.selectionState.selectedConnections = connectionIds;
    } else {
      for (const connId of connectionIds) {
        if (!this.selectionState.selectedConnections.includes(connId)) {
          this.selectionState.selectedConnections.push(connId);
        }
      }
    }

    this.state.selectedConnections = this.selectionState.selectedConnections;
  }

  /**
   * Clear selection
   */
  public clearSelection(): void {
    this.selectionState.selectedNodes = [];
    this.selectionState.selectedConnections = [];
    this.selectionState.selectionBox = undefined;
    this.state.selectedNodes = [];
    this.state.selectedConnections = [];
  }

  /**
   * Create a connection between nodes
   */
  public createConnection(
    sourceNodeId: NodeId,
    targetNodeId: NodeId,
    sourceOutput?: string,
    targetInput?: string,
    condition?: any
  ): Connection {
    // Validate connection
    const validation = this.validateConnection(sourceNodeId, targetNodeId);
    if (!validation.valid) {
      throw new Error(validation.errors[0].message);
    }

    const connection: Connection = {
      id: uuidv4(),
      sourceNodeId,
      targetNodeId,
      sourceOutput,
      targetInput,
      condition
    };

    this.saveToHistory();
    this.state.workflow.connections.push(connection);
    this.state.validation = this.validateWorkflow(this.state.workflow);

    return connection;
  }

  /**
   * Remove a connection
   */
  public removeConnection(connectionId: string): void {
    this.saveToHistory();
    this.state.workflow.connections = this.state.workflow.connections.filter(
      c => c.id !== connectionId
    );
    this.state.validation = this.validateWorkflow(this.state.workflow);
  }

  /**
   * Start creating a connection
   */
  public startConnection(
    sourceNodeId: NodeId,
    sourceOutput?: string,
    mousePosition: Position
  ): void {
    this.connectionDraft = {
      sourceNodeId,
      sourceOutput,
      mousePosition
    };
  }

  /**
   * Update connection draft
   */
  public updateConnectionDraft(mousePosition: Position): void {
    if (this.connectionDraft) {
      this.connectionDraft.mousePosition = mousePosition;
    }
  }

  /**
   * Complete connection
   */
  public completeConnection(
    targetNodeId: NodeId,
    targetInput?: string
  ): Connection | null {
    if (!this.connectionDraft) return null;

    try {
      const connection = this.createConnection(
        this.connectionDraft.sourceNodeId,
        targetNodeId,
        this.connectionDraft.sourceOutput,
        targetInput
      );

      this.connectionDraft = undefined;
      return connection;
    } catch (error) {
      this.connectionDraft = undefined;
      throw error;
    }
  }

  /**
   * Cancel connection draft
   */
  public cancelConnection(): void {
    this.connectionDraft = undefined;
  }

  /**
   * Copy selected nodes and connections
   */
  public copySelection(): void {
    const nodes = this.state.workflow.nodes.filter(n =>
      this.selectionState.selectedNodes.includes(n.id)
    );

    const connectionIds = this.state.workflow.connections
      .filter(c =>
        this.selectionState.selectedNodes.includes(c.sourceNodeId) ||
        this.selectionState.selectedNodes.includes(c.targetNodeId)
      )
      .map(c => c.id);

    this.clipboard = {
      nodes: nodes.map(n => ({ ...n })),
      connections: this.state.workflow.connections
        .filter(c => connectionIds.includes(c.id))
        .map(c => ({ ...c }))
    };
  }

  /**
   * Cut selected nodes and connections
   */
  public cutSelection(): void {
    this.copySelection();

    for (const nodeId of this.selectionState.selectedNodes) {
      this.removeNode(nodeId);
    }

    this.clearSelection();
  }

  /**
   * Paste clipboard content
   */
  public paste(position: Position): { nodes: Node[]; connections: Connection[] } {
    if (!this.clipboard) {
      throw new Error('Nothing to paste');
    }

    this.saveToHistory();

    const idMap = new Map<string, string>();
    const newNodes: Node[] = [];
    const offset = { x: 50, y: 50 };

    // Paste nodes with new IDs
    for (const node of this.clipboard.nodes) {
      const newNode: Node = {
        ...node,
        id: uuidv4() as NodeId,
        name: `${node.name} (copy)`,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y
        }
      };

      idMap.set(node.id, newNode.id);
      newNodes.push(newNode);
      this.state.workflow.nodes.push(newNode);
    }

    // Paste connections with updated IDs
    const newConnections: Connection[] = [];
    for (const connection of this.clipboard.connections) {
      const newSourceId = idMap.get(connection.sourceNodeId);
      const newTargetId = idMap.get(connection.targetNodeId);

      if (newSourceId && newTargetId) {
        const newConnection: Connection = {
          ...connection,
          id: uuidv4(),
          sourceNodeId: newSourceId,
          targetNodeId: newTargetId
        };

        newConnections.push(newConnection);
        this.state.workflow.connections.push(newConnection);
      }
    }

    this.state.validation = this.validateWorkflow(this.state.workflow);

    return { nodes: newNodes, connections: newConnections };
  }

  /**
   * Duplicate selected nodes
   */
  public duplicateSelection(): { nodes: Node[]; connections: Connection[] } {
    this.copySelection();
    const selection = this.selectionState.selectedNodes;

    if (selection.length > 0) {
      const firstNode = this.state.workflow.nodes.find(
        n => n.id === selection[0]
      );
      if (firstNode) {
        return this.paste(firstNode.position);
      }
    }

    return this.paste({ x: 100, y: 100 });
  }

  /**
   * Delete selected items
   */
  public deleteSelection(): void {
    for (const nodeId of this.selectionState.selectedNodes) {
      this.removeNode(nodeId);
    }

    for (const connId of this.selectionState.selectedConnections) {
      this.removeConnection(connId);
    }

    this.clearSelection();
  }

  /**
   * Undo last action
   */
  public undo(): void {
    if (this.history.past.length > 0) {
      const previous = this.history.past.pop()!;
      this.history.future.push(this.state.workflow);
      this.state.workflow = previous;
      this.history.present = previous;
      this.state.validation = this.validateWorkflow(this.state.workflow);
    }
  }

  /**
   * Redo last action
   */
  public redo(): void {
    if (this.history.future.length > 0) {
      const next = this.history.future.pop()!;
      this.history.past.push(this.state.workflow);
      this.state.workflow = next;
      this.history.present = next;
      this.state.validation = this.validateWorkflow(this.state.workflow);
    }
  }

  /**
   * Save current state to history
   */
  private saveToHistory(): void {
    this.history.past.push(JSON.parse(JSON.stringify(this.state.workflow)));
    this.history.future = [];
    this.history.present = this.state.workflow;

    // Limit history size
    if (this.history.past.length > 50) {
      this.history.past.shift();
    }
  }

  /**
   * Snap position to grid
   */
  private snapToGrid(position: Position): Position {
    if (!this.config.snapToGrid) {
      return position;
    }

    return {
      x: Math.round(position.x / this.config.gridSize) * this.config.gridSize,
      y: Math.round(position.y / this.config.gridSize) * this.config.gridSize
    };
  }

  /**
   * Validate the workflow
   */
  public validateWorkflow(workflow: Workflow): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for duplicate node IDs
    const nodeIds = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push({
          type: 'node',
          id: node.id,
          message: `Duplicate node ID: ${node.id}`,
          severity: 'error'
        });
      }
      nodeIds.add(node.id);
    }

    // Check for duplicate connection IDs
    const connectionIds = new Set<string>();
    for (const connection of workflow.connections) {
      if (connectionIds.has(connection.id)) {
        errors.push({
          type: 'connection',
          id: connection.id,
          message: `Duplicate connection ID: ${connection.id}`,
          severity: 'error'
        });
      }
      connectionIds.add(connection.id);
    }

    // Check for orphaned nodes
    const connectedNodeIds = new Set<string>();
    for (const connection of workflow.connections) {
      connectedNodeIds.add(connection.sourceNodeId);
      connectedNodeIds.add(connection.targetNodeId);
    }

    for (const node of workflow.nodes) {
      if (node.type !== 'trigger' && !connectedNodeIds.has(node.id)) {
        warnings.push({
          type: 'node',
          id: node.id,
          message: `Node "${node.name}" is not connected to any other nodes`,
          severity: 'warning'
        });
      }
    }

    // Check for cycles
    const cycles = this.detectCycles();
    for (const cycle of cycles) {
      errors.push({
        type: 'workflow',
        id: 'cycle',
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
   * Validate a connection
   */
  private validateConnection(
    sourceNodeId: NodeId,
    targetNodeId: NodeId
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (sourceNodeId === targetNodeId) {
      errors.push({
        type: 'connection',
        id: 'self',
        message: 'Cannot connect a node to itself',
        severity: 'error'
      });
    }

    // Check if connection already exists
    const exists = this.state.workflow.connections.some(
      c => c.sourceNodeId === sourceNodeId && c.targetNodeId === targetNodeId
    );

    if (exists) {
      errors.push({
        type: 'connection',
        id: 'duplicate',
        message: 'Connection already exists',
        severity: 'error'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Detect cycles in the workflow
   */
  private detectCycles(): string[][] {
    const graph = new Map<string, string[]>();
    const cycles: string[][] = [];

    // Build adjacency list
    for (const connection of this.state.workflow.connections) {
      if (!graph.has(connection.sourceNodeId)) {
        graph.set(connection.sourceNodeId, []);
      }
      graph.get(connection.sourceNodeId)!.push(connection.targetNodeId);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
          return true;
        }
      }

      path.pop();
      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.state.workflow.nodes.map(n => n.id)) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Auto-layout the workflow
   */
  public autoLayout(): void {
    this.saveToHistory();

    const levels = this.calculateLevels();
    const levelHeight = 150;
    const nodeWidth = 200;
    const horizontalGap = 50;

    for (const [nodeId, level] of Object.entries(levels)) {
      const node = this.state.workflow.nodes.find(n => n.id === nodeId);
      if (node) {
        // Find nodes in the same level
        const sameLevelNodes = Object.entries(levels)
          .filter(([_, l]) => l === level)
          .map(([id]) => id);

        const indexInLevel = sameLevelNodes.indexOf(nodeId);
        const totalInLevel = sameLevelNodes.length;

        const x = (indexInLevel - (totalInLevel - 1) / 2) * (nodeWidth + horizontalGap);
        const y = level * levelHeight;

        node.position = this.snapToGrid({ x, y });
      }
    }

    this.state.validation = this.validateWorkflow(this.state.workflow);
  }

  /**
   * Calculate levels for auto-layout
   */
  private calculateLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const node of this.state.workflow.nodes) {
      inDegree.set(node.id, 0);
      graph.set(node.id, []);
    }

    // Build graph
    for (const connection of this.state.workflow.connections) {
      graph.get(connection.sourceNodeId)!.push(connection.targetNodeId);
      inDegree.set(
        connection.targetNodeId,
        (inDegree.get(connection.targetNodeId) || 0) + 1
      );
    }

    // Kahn's algorithm for level assignment
    const queue: string[] = [];

    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
        levels[nodeId] = 0;
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLevel = levels[nodeId];

      for (const neighbor of graph.get(nodeId) || []) {
        const newLevel = Math.max(levels[neighbor] || 0, currentLevel + 1);
        levels[neighbor] = newLevel;

        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return levels;
  }

  /**
   * Export workflow to JSON
   */
  public exportToJSON(): string {
    return JSON.stringify(this.state.workflow, null, 2);
  }

  /**
   * Import workflow from JSON
   */
  public importFromJSON(json: string): void {
    try {
      const workflow = JSON.parse(json);
      this.saveToHistory();
      this.state.workflow = workflow;
      this.state.validation = this.validateWorkflow(this.state.workflow);
    } catch (error) {
      throw new Error('Invalid workflow JSON');
    }
  }

  /**
   * Get the current workflow
   */
  public getWorkflow(): Workflow {
    return this.state.workflow;
  }

  /**
   * Get validation result
   */
  public getValidation(): ValidationResult {
    return this.state.validation;
  }

  /**
   * Get drag state
   */
  public getDragState(): DragState {
    return this.dragState;
  }

  /**
   * Get selection state
   */
  public getSelectionState(): SelectionState {
    return this.selectionState;
  }

  /**
   * Get connection draft
   */
  public getConnectionDraft(): ConnectionDraft | undefined {
    return this.connectionDraft;
  }

  /**
   * Set zoom level
   */
  public setZoom(zoom: number): void {
    this.state.zoom = Math.min(Math.max(zoom, 0.1), 3);
  }

  /**
   * Set pan position
   */
  public setPan(position: Position): void {
    this.state.pan = position;
  }

  /**
   * Start auto-save
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      // Trigger auto-save event
      this.emit('autoSave', this.state.workflow);
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Emit events (for integration with UI frameworks)
   */
  private emit(event: string, data: any): void {
    // This would integrate with the UI framework's event system
    // For now, it's a placeholder
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopAutoSave();
  }
}
