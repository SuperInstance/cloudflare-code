/**
 * Pipeline Orchestration Module
 * Orchestrates and monitors data pipeline execution
 */

export { PipelineOrchestrator } from './workflow';
export type { OrchestratorConfig } from './workflow';

export {
  PipelineMonitor,
  MetricsCollector,
  HealthChecker,
  type MetricValue,
  type Alert,
  type DashboardData,
  type MetricSummary,
  type HealthStatus,
  type HealthCheckResult
} from './monitoring';

import type { Workflow, WorkflowNode, WorkflowEdge, MonitoringConfig } from '../types';
import { PipelineOrchestrator } from './workflow';
import { PipelineMonitor } from './monitoring';

// ============================================================================
// Workflow Builder
// ============================================================================

/**
 * Fluent builder for creating workflows
 */
export class WorkflowBuilder {
  private workflow: Partial<Workflow> = {
    id: '',
    name: '',
    version: '1.0.0',
    status: 'draft',
    nodes: [],
    edges: [],
    variables: {}
  };

  /**
   * Set workflow ID
   */
  id(id: string): WorkflowBuilder {
    this.workflow.id = id;
    return this;
  }

  /**
   * Set workflow name
   */
  name(name: string): WorkflowBuilder {
    this.workflow.name = name;
    return this;
  }

  /**
   * Set workflow description
   */
  description(description: string): WorkflowBuilder {
    this.workflow.description = description;
    return this;
  }

  /**
   * Set workflow version
   */
  version(version: string): WorkflowBuilder {
    this.workflow.version = version;
    return this;
  }

  /**
   * Add variable
   */
  variable(name: string, value: unknown): WorkflowBuilder {
    if (!this.workflow.variables) {
      this.workflow.variables = {};
    }
    this.workflow.variables[name] = value;
    return this;
  }

  /**
   * Add source node
   */
  addSource(id: string, config: Record<string, unknown>): WorkflowBuilder {
    const node: WorkflowNode = {
      id,
      type: 'source',
      config,
      position: { x: 0, y: 0 }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add transform node
   */
  addTransform(id: string, config: Record<string, unknown>): WorkflowBuilder {
    const node: WorkflowNode = {
      id,
      type: 'transform',
      config,
      position: { x: 0, y: 0 }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add destination node
   */
  addDestination(id: string, config: Record<string, unknown>): WorkflowBuilder {
    const node: WorkflowNode = {
      id,
      type: 'destination',
      config,
      position: { x: 0, y: 0 }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add condition node
   */
  addCondition(id: string, condition: string): WorkflowBuilder {
    const node: WorkflowNode = {
      id,
      type: 'condition',
      config: { condition },
      position: { x: 0, y: 0 }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add parallel node
   */
  addParallel(id: string, tasks: WorkflowNode[]): WorkflowBuilder {
    const node: WorkflowNode = {
      id,
      type: 'parallel',
      config: { tasks },
      position: { x: 0, y: 0 }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add sequence node
   */
  addSequence(id: string, tasks: WorkflowNode[]): WorkflowBuilder {
    const node: WorkflowNode = {
      id,
      type: 'sequence',
      config: { tasks },
      position: { x: 0, y: 0 }
    };

    this.workflow.nodes!.push(node);
    return this;
  }

  /**
   * Add edge
   */
  addEdge(
    source: string,
    target: string,
    condition?: string,
    label?: string
  ): WorkflowBuilder {
    const edge: WorkflowEdge = {
      id: `edge-${source}-${target}`,
      source,
      target,
      condition,
      label
    };

    this.workflow.edges!.push(edge);
    return this;
  }

  /**
   * Set node position
   */
  setNodePosition(nodeId: string, x: number, y: number): WorkflowBuilder {
    const node = this.workflow.nodes!.find(n => n.id === nodeId);

    if (node) {
      node.position = { x, y };
    }

    return this;
  }

  /**
   * Build workflow
   */
  build(): Workflow {
    if (!this.workflow.id) {
      throw new Error('Workflow ID is required');
    }

    if (!this.workflow.name) {
      this.workflow.name = this.workflow.id;
    }

    return this.workflow as Workflow;
  }
}

/**
 * Create a new workflow builder
 */
export function workflow(): WorkflowBuilder {
  return new WorkflowBuilder();
}

// ============================================================================
// Pipeline Manager
// ============================================================================

/**
 * Manages complete pipeline lifecycle
 */
export class PipelineManager {
  private orchestrator: PipelineOrchestrator;
  private monitor: PipelineMonitor;
  private config: MonitoringConfig;

  constructor(monitoringConfig: MonitoringConfig) {
    this.orchestrator = new PipelineOrchestrator();
    this.monitor = new PipelineMonitor(monitoringConfig);
    this.config = monitoringConfig;
  }

  /**
   * Register workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.orchestrator.registerWorkflow(workflow);
  }

  /**
   * Start pipeline execution
   */
  async start(workflowId: string, input?: Record<string, unknown>): Promise<PipelineExecutionResult> {
    const startTime = Date.now();

    // Record start event
    this.monitor.recordEvent({
      type: 'pipeline.started',
      pipelineId: workflowId,
      timestamp: new Date(),
      data: { input }
    });

    try {
      // Execute workflow
      const execution = await this.orchestrator.start(workflowId, input);

      const duration = Date.now() - startTime;

      // Record completion event
      this.monitor.recordEvent({
        type: 'pipeline.completed',
        pipelineId: workflowId,
        timestamp: new Date(),
        data: {
          executionId: execution.executionId,
          status: execution.status,
          duration
        }
      });

      return {
        executionId: execution.executionId,
        status: execution.status,
        duration,
        nodeExecutions: execution.nodeExecutions.length,
        error: execution.error?.message
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure event
      this.monitor.recordEvent({
        type: 'pipeline.failed',
        pipelineId: workflowId,
        timestamp: new Date(),
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      });

      throw error;
    }
  }

  /**
   * Stop pipeline execution
   */
  stop(executionId: string): void {
    this.orchestrator.stop(executionId);
  }

  /**
   * Get pipeline status
   */
  getStatus(executionId: string): PipelineExecutionResult | undefined {
    const execution = this.orchestrator.getExecution(executionId);

    if (!execution) {
      return undefined;
    }

    return {
      executionId: execution.executionId,
      status: execution.status,
      duration: execution.endTime
        ? execution.endTime.getTime() - execution.startTime.getTime()
        : 0,
      nodeExecutions: execution.nodeExecutions.length,
      error: execution.error?.message
    };
  }

  /**
   * Get monitoring data
   */
  getMonitoringData(): DashboardData {
    return this.monitor.getDashboardData();
  }

  /**
   * Get active alerts
   */
  getAlerts() {
    return this.monitor.getActiveAlerts();
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: (event: any) => void): void {
    this.monitor.on(eventType, handler);
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.orchestrator.getWorkflow(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): Workflow[] {
    return this.orchestrator.getAllWorkflows();
  }
}

/**
 * Pipeline execution result
 */
export interface PipelineExecutionResult {
  executionId: string;
  status: string;
  duration: number;
  nodeExecutions: number;
  error?: string;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  metrics: any[];
  alerts: any[];
  timestamp: Date;
}

// ============================================================================
// Predefined Workflows
// ============================================================================

/**
 * Create ETL workflow
 */
export function createETLWorkflow(config: {
  id: string;
  name: string;
  source: Record<string, unknown>;
  transforms: Record<string, unknown>[];
  destination: Record<string, unknown>;
}): Workflow {
  const builder = workflow()
    .id(config.id)
    .name(config.name)
    .addSource('source', config.source);

  // Add transform nodes
  config.transforms.forEach((transform, index) => {
    const transformId = `transform-${index}`;
    builder.addTransform(transformId, transform);

    // Connect previous node to this transform
    if (index === 0) {
      builder.addEdge('source', transformId);
    } else {
      builder.addEdge(`transform-${index - 1}`, transformId);
    }
  });

  // Add destination node
  builder.addDestination('destination', config.destination);

  // Connect last transform to destination
  if (config.transforms.length > 0) {
    builder.addEdge(`transform-${config.transforms.length - 1}`, 'destination');
  } else {
    builder.addEdge('source', 'destination');
  }

  return builder.build();
}

/**
 * Create data validation workflow
 */
export function createValidationWorkflow(config: {
  id: string;
  name: string;
  source: Record<string, unknown>;
  validationRules: Record<string, unknown>[];
  destination: Record<string, unknown>;
}): Workflow {
  return workflow()
    .id(config.id)
    .name(config.name)
    .addSource('source', config.source)
    .addTransform('validate', { rules: config.validationRules })
    .addCondition('check-valid', 'output.valid === true')
    .addDestination('destination', config.destination)
    .addEdge('source', 'validate')
    .addEdge('validate', 'check-valid')
    .addEdge('check-valid', 'destination', 'output.valid === true', 'Valid')
    .build();
}

/**
 * Create data aggregation workflow
 */
export function createAggregationWorkflow(config: {
  id: string;
  name: string;
  source: Record<string, unknown>;
  aggregations: Record<string, unknown>[];
  destination: Record<string, unknown>;
}): Workflow {
  return workflow()
    .id(config.id)
    .name(config.name)
    .addSource('source', config.source)
    .addTransform('aggregate', {
      aggregations: config.aggregations,
      groupBy: config.aggregations.map(a => (a as any).field)
    })
    .addDestination('destination', config.destination)
    .addEdge('source', 'aggregate')
    .addEdge('aggregate', 'destination')
    .build();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create pipeline manager
 */
export function createPipelineManager(monitoringConfig: MonitoringConfig): PipelineManager {
  return new PipelineManager(monitoringConfig);
}

/**
 * Create monitoring configuration
 */
export function createMonitoringConfig(
  enabled: boolean = true,
  metrics: any[] = [],
  alerts: any[] = []
): MonitoringConfig {
  return {
    enabled,
    metrics,
    alerts,
    logging: {
      level: 'info',
      format: 'json'
    }
  };
}
