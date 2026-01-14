/**
 * Basic Workflow Example
 * Demonstrates how to create and execute a simple workflow
 */

import { EnhancedWorkflowEngine } from '../src/execution/enhanced-engine';
import { WorkflowDesigner } from '../src/designer/designer';
import type { Workflow, Node, Connection, Trigger } from '../src/types';

async function basicWorkflowExample() {
  // Create a new workflow
  const workflow: Workflow = {
    id: 'basic-workflow' as any,
    name: 'Basic Workflow',
    description: 'A simple workflow example',
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

  // Add nodes
  const triggerNode: Node = {
    id: 'trigger-1' as any,
    type: 'trigger',
    name: 'Webhook Trigger',
    description: 'Triggered by HTTP webhook',
    config: {
      type: 'webhook',
      endpoint: '/webhook/basic'
    },
    position: { x: 100, y: 100 },
    enabled: true
  };

  const fetchNode: Node = {
    id: 'fetch-1' as any,
    type: 'action',
    actionType: 'http_get',
    name: 'Fetch Data',
    description: 'Fetch data from API',
    config: {
      url: 'https://api.example.com/data',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    position: { x: 100, y: 250 },
    enabled: true
  };

  const transformNode: Node = {
    id: 'transform-1' as any,
    type: 'action',
    actionType: 'transform_data',
    name: 'Transform Data',
    description: 'Transform the fetched data',
    config: {
      transformations: [
        {
          field: 'data',
          operation: 'uppercase'
        }
      ]
    },
    position: { x: 100, y: 400 },
    enabled: true
  };

  const storeNode: Node = {
    id: 'store-1' as any,
    type: 'action',
    actionType: 'kv_set',
    name: 'Store Data',
    description: 'Store transformed data in KV',
    config: {
      key: 'processed_data',
      value: '{{transform-1.result}}'
    },
    position: { x: 100, y: 550 },
    enabled: true
  };

  workflow.nodes.push(triggerNode, fetchNode, transformNode, storeNode);

  // Add connections
  const connections: Connection[] = [
    {
      id: 'conn-1' as any,
      sourceNodeId: triggerNode.id,
      targetNodeId: fetchNode.id
    },
    {
      id: 'conn-2' as any,
      sourceNodeId: fetchNode.id,
      targetNodeId: transformNode.id,
      sourceOutput: 'data',
      targetInput: 'input'
    },
    {
      id: 'conn-3' as any,
      sourceNodeId: transformNode.id,
      targetNodeId: storeNode.id,
      sourceOutput: 'result',
      targetInput: 'value'
    }
  ];

  workflow.connections.push(...connections);

  // Create execution engine
  const engine = new EnhancedWorkflowEngine({
    maxConcurrentExecutions: 10,
    defaultTimeout: 30000,
    enableMetrics: true
  });

  // Execute workflow
  try {
    const execution = await engine.execute(
      workflow,
      { input: 'test input' },
      { type: 'manual', source: 'example' }
    );

    console.log('Workflow executed successfully!');
    console.log('Execution ID:', execution.id);
    console.log('Duration:', execution.duration, 'ms');
    console.log('Output:', execution.output);

    return execution;
  } catch (error) {
    console.error('Workflow execution failed:', error);
    throw error;
  }
}

async function designerExample() {
  // Create a workflow using the designer
  const designer = new WorkflowDesigner({
    canvasWidth: 2000,
    canvasHeight: 1500,
    gridSize: 20,
    snapToGrid: true
  });

  // Add nodes using templates
  const triggerNode = designer.addNode('webhook-trigger', { x: 100, y: 100 });
  const fetchNode = designer.addNode('http-request', { x: 100, y: 250 }, {
    config: {
      url: 'https://api.example.com/data',
      method: 'GET'
    }
  });

  const conditionNode = designer.addNode('condition', { x: 100, y: 400 }, {
    config: {
      conditions: [
        {
          id: 'cond-1' as any,
          operator: 'equals',
          leftOperand: { type: 'variable', path: 'fetch-1.status' },
          rightOperand: 200
        }
      ]
    }
  });

  // Connect nodes
  designer.createConnection(triggerNode.id, fetchNode.id);
  designer.createConnection(fetchNode.id, conditionNode.id);

  // Validate workflow
  const validation = designer.getValidation();
  if (!validation.valid) {
    console.error('Workflow validation failed:', validation.errors);
    return;
  }

  // Auto-layout
  designer.autoLayout();

  // Export workflow
  const workflowJson = designer.exportToJSON();
  console.log('Workflow JSON:', workflowJson);

  return designer.getWorkflow();
}

async function parallelExecutionExample() {
  const { ParallelExecutor } = await import('../src/parallel/executor');

  const executor = new ParallelExecutor({
    maxConcurrency: 5,
    timeout: 10000,
    enableDeadlockDetection: true
  });

  // Create parallel tasks
  const tasks = [
    {
      id: 'task-1',
      name: 'Fetch User',
      execute: async () => {
        const response = await fetch('https://api.example.com/user/1');
        return await response.json();
      },
      priority: 1,
      dependencies: []
    },
    {
      id: 'task-2',
      name: 'Fetch Posts',
      execute: async () => {
        const response = await fetch('https://api.example.com/posts');
        return await response.json();
      },
      priority: 1,
      dependencies: []
    },
    {
      id: 'task-3',
      name: 'Fetch Comments',
      execute: async () => {
        const response = await fetch('https://api.example.com/comments');
        return await response.json();
      },
      priority: 1,
      dependencies: []
    }
  ];

  // Execute tasks in parallel
  const summary = await executor.execute(tasks);

  console.log('Parallel execution summary:');
  console.log('- Total tasks:', summary.totalTasks);
  console.log('- Completed:', summary.completedTasks);
  console.log('- Failed:', summary.failedTasks);
  console.log('- Duration:', summary.totalDuration, 'ms');

  return summary;
}

async function conditionalWorkflowExample() {
  const { EnhancedConditionEvaluator } = await import('../src/conditions/enhanced-evaluator');

  const evaluator = new EnhancedConditionEvaluator();

  // Set variables
  const context = evaluator.getContext();
  context.variables.set('userRole', 'admin');
  context.variables.set('permission', 'write');

  // Evaluate conditions
  const isAdminCondition = {
    id: 'cond-1',
    operator: 'equals' as const,
    leftOperand: { type: 'variable', path: 'userRole' },
    rightOperand: 'admin'
  };

  const hasWritePermission = {
    id: 'cond-2',
    operator: 'equals' as const,
    leftOperand: { type: 'variable', path: 'permission' },
    rightOperand: 'write'
  };

  const isAdmin = await evaluator.evaluate(isAdminCondition);
  const canWrite = await evaluator.evaluate(hasWritePermission);

  console.log('Is admin:', isAdmin);
  console.log('Can write:', canWrite);

  // Complex condition
  const canDeleteCondition = {
    id: 'cond-3',
    operator: 'equals' as const,
    leftOperand: { type: 'variable', path: 'userRole' },
    rightOperand: 'admin',
    logicOperator: 'AND' as const,
    conditions: [
      {
        id: 'cond-4',
        operator: 'equals' as const,
        leftOperand: { type: 'variable', path: 'permission' },
        rightOperand: 'delete'
      }
    ]
  };

  const canDelete = await evaluator.evaluate(canDeleteCondition);
  console.log('Can delete:', canDelete);

  return { isAdmin, canWrite, canDelete };
}

async function templateExample() {
  const { EnhancedTemplateLibrary } = await import('../src/templates/enhanced-library');

  const library = new EnhancedTemplateLibrary();

  // Search for templates
  const deploymentTemplates = library.search('deployment');
  console.log('Found deployment templates:', deploymentTemplates.length);

  // Get templates by category
  const devTemplates = library.getByCategory('development');
  console.log('Development templates:', devTemplates.length);

  // Instantiate a template
  const ciTemplate = library.getTemplate('ci-cd-pipeline' as any);
  if (ciTemplate) {
    const workflow = library.instantiate('ci-cd-pipeline' as any, {
      repository: 'https://github.com/user/repo',
      branch: 'main',
      buildCommand: 'npm run build',
      testCommand: 'npm test',
      deployEnvironment: 'production'
    });

    console.log('Instantiated workflow:', workflow.name);
    return workflow;
  }
}

async function versioningExample() {
  const { WorkflowVersioningManager } = await import('../src/versioning/manager');

  const manager = new WorkflowVersioningManager();

  // Create a workflow
  const workflow: Workflow = {
    id: 'versioned-workflow' as any,
    name: 'Versioned Workflow',
    description: 'A workflow with versioning',
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

  // Create initial version
  const v1 = await manager.createVersion(
    workflow,
    {
      type: 'major',
      description: 'Initial version',
      changes: [],
      breakingChanges: false
    },
    {
      stable: true,
      environment: 'production'
    }
  );

  console.log('Created version:', v1.version);

  // Activate version
  await manager.activateVersion(v1.id);

  // Modify workflow
  workflow.name = 'Updated Workflow';
  workflow.version = 2;

  // Create new version
  const v2 = await manager.createVersion(
    workflow,
    {
      type: 'minor',
      description: 'Updated workflow name',
      changes: [],
      breakingChanges: false
    }
  );

  console.log('Created version:', v2.version);

  // Compare versions
  const diff = manager.diffVersions(v1.id, v2.id);
  console.log('Version diff:', diff.summary);

  // Create rollback plan
  const rollbackPlan = manager.createRollbackPlan(
    workflow.id,
    v1.id,
    'immediate'
  );

  console.log('Rollback plan steps:', rollbackPlan.steps.length);

  return { v1, v2, diff, rollbackPlan };
}

// Run examples
async function main() {
  console.log('=== Basic Workflow Example ===');
  await basicWorkflowExample();

  console.log('\n=== Designer Example ===');
  await designerExample();

  console.log('\n=== Parallel Execution Example ===');
  await parallelExecutionExample();

  console.log('\n=== Conditional Workflow Example ===');
  await conditionalWorkflowExample();

  console.log('\n=== Template Example ===');
  await templateExample();

  console.log('\n=== Versioning Example ===');
  await versioningExample();
}

// Export examples
export {
  basicWorkflowExample,
  designerExample,
  parallelExecutionExample,
  conditionalWorkflowExample,
  templateExample,
  versioningExample
};

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
