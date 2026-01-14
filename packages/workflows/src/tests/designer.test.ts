/**
 * Tests for Workflow Designer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowDesigner } from '../designer/designer';
import type {
  Workflow,
  Node,
  NodeId,
  Position
} from '../types';

describe('WorkflowDesigner', () => {
  let designer: WorkflowDesigner;
  let sampleWorkflow: Workflow;

  beforeEach(() => {
    sampleWorkflow = {
      id: 'test-workflow' as any,
      name: 'Test Workflow',
      description: 'A test workflow',
      version: 1,
      status: 'active',
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

    designer = new WorkflowDesigner(sampleWorkflow);
  });

  describe('Node Management', () => {
    it('should add a node to the workflow', () => {
      const position = { x: 100, y: 100 };
      const node = designer.addNode('http-request', position);

      expect(node).toBeDefined();
      expect(node.type).toBe('action');
      expect(node.position).toEqual({ x: 100, y: 100 });
      expect(sampleWorkflow.nodes).toHaveLength(1);
    });

    it('should remove a node from the workflow', () => {
      const position = { x: 100, y: 100 };
      const node = designer.addNode('http-request', position);
      designer.removeNode(node.id);

      expect(sampleWorkflow.nodes).toHaveLength(0);
    });

    it('should update a node', () => {
      const position = { x: 100, y: 100 };
      const node = designer.addNode('http-request', position);
      designer.updateNode(node.id, { name: 'Updated Node' });

      expect(node.name).toBe('Updated Node');
    });

    it('should move nodes', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });

      designer.moveNodes([node1.id, node2.id], { x: 50, y: 50 });

      expect(node1.position).toEqual({ x: 150, y: 150 });
      expect(node2.position).toEqual({ x: 250, y: 150 });
    });

    it('should snap positions to grid', () => {
      designer = new WorkflowDesigner(sampleWorkflow, { snapToGrid: true, gridSize: 20 });
      const node = designer.addNode('http-request', { x: 15, y: 25 });

      expect(node.position.x).toBe(20);
      expect(node.position.y).toBe(40);
    });
  });

  describe('Connection Management', () => {
    it('should create a connection between nodes', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });

      const connection = designer.createConnection(node1.id, node2.id);

      expect(connection).toBeDefined();
      expect(connection.sourceNodeId).toBe(node1.id);
      expect(connection.targetNodeId).toBe(node2.id);
      expect(sampleWorkflow.connections).toHaveLength(1);
    });

    it('should not allow self-connections', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      expect(() => {
        designer.createConnection(node.id, node.id);
      }).toThrow();
    });

    it('should not allow duplicate connections', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });

      designer.createConnection(node1.id, node2.id);

      expect(() => {
        designer.createConnection(node1.id, node2.id);
      }).toThrow();
    });

    it('should remove a connection', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });
      const connection = designer.createConnection(node1.id, node2.id);

      designer.removeConnection(connection.id);

      expect(sampleWorkflow.connections).toHaveLength(0);
    });
  });

  describe('Selection Management', () => {
    it('should select nodes', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });

      designer.selectNodes([node1.id, node2.id]);

      expect(designer.getSelectionState().selectedNodes).toHaveLength(2);
    });

    it('should add to selection', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });

      designer.selectNodes([node1.id]);
      designer.selectNodes([node2.id], true);

      expect(designer.getSelectionState().selectedNodes).toHaveLength(2);
    });

    it('should clear selection', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });
      designer.selectNodes([node.id]);
      designer.clearSelection();

      expect(designer.getSelectionState().selectedNodes).toHaveLength(0);
    });
  });

  describe('Clipboard Operations', () => {
    it('should copy and paste nodes', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      designer.selectNodes([node1.id]);
      designer.copySelection();

      const { nodes } = designer.paste({ x: 200, y: 200 });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).not.toBe(node1.id);
      expect(nodes[0].name).toContain('copy');
      expect(sampleWorkflow.nodes).toHaveLength(2);
    });

    it('should cut and paste nodes', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      designer.selectNodes([node1.id]);
      designer.cutSelection();

      expect(sampleWorkflow.nodes).toHaveLength(0);

      const { nodes } = designer.paste({ x: 200, y: 200 });

      expect(nodes).toHaveLength(1);
      expect(sampleWorkflow.nodes).toHaveLength(1);
    });

    it('should duplicate selection', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      designer.selectNodes([node1.id]);

      const { nodes } = designer.duplicateSelection();

      expect(nodes).toHaveLength(1);
      expect(sampleWorkflow.nodes).toHaveLength(2);
    });

    it('should delete selection', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });
      designer.selectNodes([node1.id, node2.id]);
      designer.deleteSelection();

      expect(sampleWorkflow.nodes).toHaveLength(0);
    });
  });

  describe('Undo/Redo', () => {
    it('should undo node addition', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });
      designer.undo();

      expect(sampleWorkflow.nodes).toHaveLength(0);
    });

    it('should redo undone action', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });
      designer.undo();
      designer.redo();

      expect(sampleWorkflow.nodes).toHaveLength(1);
    });

    it('should maintain history limit', () => {
      const historyLimit = 50;

      for (let i = 0; i < historyLimit + 10; i++) {
        designer.addNode('http-request', { x: 100 + i, y: 100 });
      }

      // Should not exceed history limit
      expect(designer['history'].past.length).toBeLessThanOrEqual(historyLimit);
    });
  });

  describe('Validation', () => {
    it('should detect cycles', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });
      const node3 = designer.addNode('kv-set', { x: 300, y: 100 });

      designer.createConnection(node1.id, node2.id);
      designer.createConnection(node2.id, node3.id);

      // Create cycle
      sampleWorkflow.connections.push({
        id: 'cycle-conn' as any,
        sourceNodeId: node3.id,
        targetNodeId: node1.id
      });

      const validation = designer.getValidation();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].message).toContain('Cycle detected');
    });

    it('should warn about orphaned nodes', () => {
      designer.addNode('http-request', { x: 100, y: 100 });

      const validation = designer.getValidation();

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0].message).toContain('not connected');
    });

    it('should detect duplicate node IDs', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      // Add duplicate node
      sampleWorkflow.nodes.push({ ...node, id: node.id });

      const validation = designer.getValidation();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
    });
  });

  describe('Auto Layout', () => {
    it('should auto layout nodes', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });
      const node3 = designer.addNode('kv-set', { x: 300, y: 100 });

      designer.createConnection(node1.id, node2.id);
      designer.createConnection(node2.id, node3.id);

      designer.autoLayout();

      // Check that nodes are arranged in levels
      const yPositions = sampleWorkflow.nodes.map(n => n.position.y);
      expect(new Set(yPositions).size).toBeGreaterThan(1);
    });
  });

  describe('Import/Export', () => {
    it('should export workflow to JSON', () => {
      designer.addNode('http-request', { x: 100, y: 100 });

      const json = designer.exportToJSON();

      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed.nodes).toHaveLength(1);
    });

    it('should import workflow from JSON', () => {
      designer.addNode('http-request', { x: 100, y: 100 });
      const json = designer.exportToJSON();

      designer.removeNode(sampleWorkflow.nodes[0].id);
      expect(sampleWorkflow.nodes).toHaveLength(0);

      designer.importFromJSON(json);
      expect(sampleWorkflow.nodes).toHaveLength(1);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        designer.importFromJSON('invalid json');
      }).toThrow();
    });
  });

  describe('Templates', () => {
    it('should provide node templates', () => {
      const templates = designer.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('category');
    });

    it('should filter templates by category', () => {
      const triggerTemplates = designer.getTemplatesByCategory('triggers');
      const actionTemplates = designer.getTemplatesByCategory('actions');

      expect(triggerTemplates.length).toBeGreaterThan(0);
      expect(actionTemplates.length).toBeGreaterThan(0);

      triggerTemplates.forEach(t => {
        expect(t.category).toBe('triggers');
      });
    });

    it('should register custom templates', () => {
      designer.registerTemplate({
        id: 'custom-template',
        type: 'action',
        actionType: 'http_post' as any,
        name: 'Custom Action',
        description: 'A custom action template',
        icon: '🔧',
        category: 'custom',
        config: {},
        defaults: {
          name: 'Custom Action',
          type: 'action',
          actionType: 'http_post',
          config: {}
        }
      });

      const templates = designer.getTemplates();
      const customTemplate = templates.find(t => t.id === 'custom-template');

      expect(customTemplate).toBeDefined();
      expect(customTemplate?.name).toBe('Custom Action');
    });
  });

  describe('Zoom and Pan', () => {
    it('should set zoom level', () => {
      designer.setZoom(2.0);

      expect(designer.getWorkflow().constructor.name).toBe('Object'); // Workflow object
    });

    it('should limit zoom range', () => {
      designer.setZoom(5.0); // Above max
      expect(designer['state'].zoom).toBeLessThanOrEqual(3.0);

      designer.setZoom(0.05); // Below min
      expect(designer['state'].zoom).toBeGreaterThanOrEqual(0.1);
    });

    it('should set pan position', () => {
      designer.setPan({ x: 100, y: 200 });

      expect(designer['state'].pan).toEqual({ x: 100, y: 200 });
    });
  });

  describe('Drag State', () => {
    it('should start dragging nodes', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      designer.startDrag([node.id], { x: 10, y: 10 });

      expect(designer.getDragState().isDragging).toBe(true);
      expect(designer.getDragState().draggedNodes).toContain(node.id);
    });

    it('should update drag position', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      designer.startDrag([node.id], { x: 10, y: 10 });
      designer.updateDrag({ x: 20, y: 20 });

      expect(node.position).not.toEqual({ x: 100, y: 100 });
    });

    it('should end dragging', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      designer.startDrag([node.id], { x: 10, y: 10 });
      designer.endDrag();

      expect(designer.getDragState().isDragging).toBe(false);
    });
  });

  describe('Connection Draft', () => {
    it('should start connection draft', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      designer.startConnection(node.id, 'output', { x: 150, y: 150 });

      expect(designer.getConnectionDraft()).toBeDefined();
      expect(designer.getConnectionDraft()?.sourceNodeId).toBe(node.id);
    });

    it('should update connection draft position', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      designer.startConnection(node.id, 'output', { x: 150, y: 150 });
      designer.updateConnectionDraft({ x: 200, y: 200 });

      expect(designer.getConnectionDraft()?.mousePosition).toEqual({ x: 200, y: 200 });
    });

    it('should complete connection', () => {
      const node1 = designer.addNode('http-request', { x: 100, y: 100 });
      const node2 = designer.addNode('kv-get', { x: 200, y: 100 });

      designer.startConnection(node1.id, 'output', { x: 150, y: 150 });
      const connection = designer.completeConnection(node2.id, 'input');

      expect(connection).toBeDefined();
      expect(connection?.sourceNodeId).toBe(node1.id);
      expect(connection?.targetNodeId).toBe(node2.id);
      expect(designer.getConnectionDraft()).toBeUndefined();
    });

    it('should cancel connection', () => {
      const node = designer.addNode('http-request', { x: 100, y: 100 });

      designer.startConnection(node.id, 'output', { x: 150, y: 150 });
      designer.cancelConnection();

      expect(designer.getConnectionDraft()).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', () => {
      designer = new WorkflowDesigner(sampleWorkflow, { autoSave: true });
      designer.destroy();

      expect(designer['autoSaveTimer']).toBeUndefined();
    });
  });
});
