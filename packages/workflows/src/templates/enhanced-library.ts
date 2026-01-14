/**
 * Enhanced Template Library
 * Provides pre-built workflows, patterns, and best practices
 */

import type {
  Workflow,
  Template,
  TemplateId,
  TemplateCategory,
  TemplateParameter,
  Node,
  NodeId,
  Connection,
  Trigger,
  TriggerType
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface TemplateLibrary {
  templates: Map<TemplateId, Template>;
  categories: Map<TemplateCategory, TemplateMetadata[]>;
  search(query: string): Template[];
  getByCategory(category: TemplateCategory): Template[];
  validate(template: Template): ValidationResult;
  instantiate(templateId: TemplateId, parameters: Record<string, any>): Workflow;
}

export interface TemplateMetadata {
  id: TemplateId;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  popularity: number;
  rating: number;
  usage: number;
  author: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  category: PatternCategory;
  structure: PatternStructure;
  bestFor: string[];
  examples: string[];
}

export type PatternCategory =
  | 'orchestration'
  | 'data-processing'
  | 'integration'
  | 'error-handling'
  | 'optimization'
  | 'communication';

export interface PatternStructure {
  nodes: PatternNode[];
  connections: PatternConnection[];
  flow: 'sequential' | 'parallel' | 'mixed' | 'conditional';
}

export interface PatternNode {
  type: 'trigger' | 'action' | 'condition' | 'loop' | 'parallel';
  actionType?: string;
  required: boolean;
  configurable: boolean;
  description: string;
}

export interface PatternConnection {
  from: string;
  to: string;
  condition?: string;
}

export class EnhancedTemplateLibrary implements TemplateLibrary {
  public templates: Map<TemplateId, Template>;
  public categories: Map<TemplateCategory, TemplateMetadata[]>;
  private patterns: Map<string, WorkflowPattern>;
  private bestPractices: Map<string, BestPractice>;

  constructor() {
    this.templates = new Map();
    this.categories = new Map();
    this.patterns = new Map();
    this.bestPractices = new Map();

    this.initializeTemplates();
    this.initializePatterns();
    this.initializeBestPractices();
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    // Development templates
    this.registerTemplate(this.createCIPipelineTemplate());
    this.registerTemplate(this.createCodeReviewTemplate());
    this.registerTemplate(this.createTestAutomationTemplate());

    // Deployment templates
    this.registerTemplate(this.createBlueGreenDeploymentTemplate());
    this.registerTemplate(this.createCanaryDeploymentTemplate());
    this.registerTemplate(this.createRollingDeploymentTemplate());

    // Monitoring templates
    this.registerTemplate(this.createHealthCheckTemplate());
    this.registerTemplate(this.createAlertingTemplate());
    this.registerTemplate(this.createMetricsCollectionTemplate());

    // Communication templates
    this.registerTemplate(this.createSlackNotificationTemplate());
    this.registerTemplate(this.createEmailDigestTemplate());
    this.registerTemplate(this.createIncidentResponseTemplate());

    // Data processing templates
    this.registerTemplate(this.createETLPipelineTemplate());
    this.registerTemplate(this.createDataTransformationTemplate());
    this.registerTemplate(this.createBatchProcessingTemplate());

    // Integration templates
    this.registerTemplate(this.createGitHubIntegrationTemplate());
    this.registerTemplate(this.createWebhookProcessorTemplate());
    this.registerTemplate(this.createAPISyncTemplate());
  }

  /**
   * CI/CD Pipeline Template
   */
  private createCIPipelineTemplate(): Template {
    return {
      id: 'ci-cd-pipeline' as TemplateId,
      name: 'CI/CD Pipeline',
      description: 'Complete continuous integration and deployment workflow',
      category: 'development',
      workflow: this.buildCIPipelineWorkflow(),
      parameters: [
        {
          name: 'repository',
          type: 'string',
          description: 'Git repository URL',
          required: true
        },
        {
          name: 'branch',
          type: 'string',
          description: 'Branch to deploy',
          required: true,
          defaultValue: 'main'
        },
        {
          name: 'buildCommand',
          type: 'string',
          description: 'Build command',
          required: true,
          defaultValue: 'npm run build'
        },
        {
          name: 'testCommand',
          type: 'string',
          description: 'Test command',
          required: true,
          defaultValue: 'npm test'
        },
        {
          name: 'deployEnvironment',
          type: 'string',
          description: 'Deployment environment',
          required: true,
          defaultValue: 'production'
        }
      ],
      documentation: `
# CI/CD Pipeline Template

This template provides a complete CI/CD pipeline with the following stages:

1. **Code Checkout**: Clone repository and checkout branch
2. **Install Dependencies**: Install project dependencies
3. **Run Tests**: Execute test suite
4. **Build**: Build the project
5. **Deploy**: Deploy to specified environment
6. **Notify**: Send notification on completion

## Best Practices

- Always run tests before deployment
- Use environment-specific configurations
- Implement rollback mechanisms
- Monitor deployment health

## Parameters

- \`repository\`: Git repository URL
- \`branch\`: Branch to deploy (default: main)
- \`buildCommand\`: Command to build the project
- \`testCommand\`: Command to run tests
- \`deployEnvironment\`: Target environment (staging/production)
      `,
      tags: ['ci-cd', 'deployment', 'automation', 'devops'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build CI/CD pipeline workflow
   */
  private buildCIPipelineWorkflow(): Workflow {
    const nodes: Node[] = [];
    const connections: Connection[] = [];
    const triggers: Trigger[] = [];

    // Trigger: Webhook
    const triggerId = uuidv4() as NodeId;
    nodes.push({
      id: triggerId,
      type: 'trigger',
      name: 'Webhook Trigger',
      description: 'Triggered by push event',
      config: {
        type: 'webhook',
        endpoint: '/ci-cd/webhook'
      },
      position: { x: 100, y: 100 },
      enabled: true
    });

    // Action: Checkout
    const checkoutId = uuidv4() as NodeId;
    nodes.push({
      id: checkoutId,
      type: 'action',
      actionType: 'http_get',
      name: 'Checkout Code',
      description: 'Clone repository',
      config: {
        url: '{{repository}}',
        branch: '{{branch}}'
      },
      position: { x: 100, y: 250 },
      enabled: true
    });

    // Action: Install Dependencies
    const installId = uuidv4() as NodeId;
    nodes.push({
      id: installId,
      type: 'action',
      actionType: 'http_post',
      name: 'Install Dependencies',
      description: 'Install project dependencies',
      config: {
        command: 'npm install'
      },
      position: { x: 100, y: 400 },
      enabled: true
    });

    // Action: Run Tests
    const testId = uuidv4() as NodeId;
    nodes.push({
      id: testId,
      type: 'action',
      actionType: 'run_tests',
      name: 'Run Tests',
      description: 'Execute test suite',
      config: {
        command: '{{testCommand}}'
      },
      position: { x: 100, y: 550 },
      enabled: true
    });

    // Condition: Tests Passed?
    const conditionId = uuidv4() as NodeId;
    nodes.push({
      id: conditionId,
      type: 'condition',
      name: 'Tests Passed?',
      description: 'Check if tests passed',
      config: {
        conditions: [
          {
            id: uuidv4(),
            operator: 'equals',
            leftOperand: { type: 'variable', path: 'tests.exit_code' },
            rightOperand: 0
          }
        ]
      },
      position: { x: 100, y: 700 },
      enabled: true
    });

    // Action: Build
    const buildId = uuidv4() as NodeId;
    nodes.push({
      id: buildId,
      type: 'action',
      actionType: 'http_post',
      name: 'Build',
      description: 'Build project',
      config: {
        command: '{{buildCommand}}'
      },
      position: { x: 100, y: 850 },
      enabled: true
    });

    // Action: Deploy
    const deployId = uuidv4() as NodeId;
    nodes.push({
      id: deployId,
      type: 'action',
      actionType: 'deploy_code',
      name: 'Deploy',
      description: 'Deploy to environment',
      config: {
        environment: '{{deployEnvironment}}'
      },
      position: { x: 100, y: 1000 },
      enabled: true
    });

    // Action: Notify Success
    const notifySuccessId = uuidv4() as NodeId;
    nodes.push({
      id: notifySuccessId,
      type: 'action',
      actionType: 'send_slack',
      name: 'Notify Success',
      description: 'Send success notification',
      config: {
        message: 'Deployment successful'
      },
      position: { x: 100, y: 1150 },
      enabled: true
    });

    // Action: Notify Failure
    const notifyFailureId = uuidv4() as NodeId;
    nodes.push({
      id: notifyFailureId,
      type: 'action',
      actionType: 'send_slack',
      name: 'Notify Failure',
      description: 'Send failure notification',
      config: {
        message: 'Deployment failed'
      },
      position: { x: 300, y: 850 },
      enabled: true
    });

    // Create connections
    connections.push(
      { id: uuidv4(), sourceNodeId: triggerId, targetNodeId: checkoutId },
      { id: uuidv4(), sourceNodeId: checkoutId, targetNodeId: installId },
      { id: uuidv4(), sourceNodeId: installId, targetNodeId: testId },
      { id: uuidv4(), sourceNodeId: testId, targetNodeId: conditionId },
      { id: uuidv4(), sourceNodeId: conditionId, targetNodeId: buildId },
      { id: uuidv4(), sourceNodeId: buildId, targetNodeId: deployId },
      { id: uuidv4(), sourceNodeId: deployId, targetNodeId: notifySuccessId },
      { id: uuidv4(), sourceNodeId: conditionId, targetNodeId: notifyFailureId }
    );

    return {
      id: uuidv4(),
      name: 'CI/CD Pipeline',
      description: 'Complete CI/CD pipeline',
      version: 1,
      status: 'active',
      nodes,
      connections,
      triggers,
      variables: [],
      settings: {
        timeout: 3600000,
        maxConcurrentExecutions: 1,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'development',
        estimatedDuration: 600000,
        tags: ['ci-cd', 'deployment']
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Code Review Template
   */
  private createCodeReviewTemplate(): Template {
    return {
      id: 'code-review' as TemplateId,
      name: 'Automated Code Review',
      description: 'Automated code review with AI analysis',
      category: 'development',
      workflow: this.buildCodeReviewWorkflow(),
      parameters: [
        {
          name: 'prNumber',
          type: 'number',
          description: 'Pull request number',
          required: true
        },
        {
          name: 'repository',
          type: 'string',
          description: 'Repository name',
          required: true
        },
        {
          name: 'reviewRules',
          type: 'object',
          description: 'Review rules configuration',
          required: false
        }
      ],
      documentation: `
# Automated Code Review Template

This template provides automated code review using AI analysis.

## Features

- Analyzes pull request changes
- Checks for code quality issues
- Provides improvement suggestions
- Posts review comments

## Parameters

- \`prNumber\`: Pull request number to review
- \`repository\`: Repository name
- \`reviewRules\`: Optional review rules configuration
      `,
      tags: ['code-review', 'ai', 'automation', 'quality'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build code review workflow
   */
  private buildCodeReviewWorkflow(): Workflow {
    const nodes: Node[] = [];
    const connections: Connection[] = [];
    const triggers: Trigger[] = [];

    // Similar structure to CI/CD pipeline
    // ... (implementation details)

    return {
      id: uuidv4(),
      name: 'Code Review',
      description: 'Automated code review',
      version: 1,
      status: 'active',
      nodes,
      connections,
      triggers,
      variables: [],
      settings: {
        timeout: 600000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'development',
        estimatedDuration: 300000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Test Automation Template
   */
  private createTestAutomationTemplate(): Template {
    return {
      id: 'test-automation' as TemplateId,
      name: 'Test Automation',
      description: 'Automated testing pipeline with multiple test types',
      category: 'development',
      workflow: this.buildTestAutomationWorkflow(),
      parameters: [
        {
          name: 'testTypes',
          type: 'array',
          description: 'Types of tests to run',
          required: true,
          defaultValue: ['unit', 'integration', 'e2e']
        },
        {
          name: 'coverageThreshold',
          type: 'number',
          description: 'Minimum code coverage percentage',
          required: false,
          defaultValue: 80
        }
      ],
      documentation: `
# Test Automation Template

Comprehensive test automation pipeline.

## Test Types

- Unit tests
- Integration tests
- E2E tests
- Performance tests

## Parameters

- \`testTypes\`: Array of test types to run
- \`coverageThreshold\`: Minimum coverage percentage
      `,
      tags: ['testing', 'automation', 'quality'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build test automation workflow
   */
  private buildTestAutomationWorkflow(): Workflow {
    // Implementation similar to previous workflows
    return {
      id: uuidv4(),
      name: 'Test Automation',
      description: 'Automated testing pipeline',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 1800000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'development',
        estimatedDuration: 900000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Blue-Green Deployment Template
   */
  private createBlueGreenDeploymentTemplate(): Template {
    return {
      id: 'blue-green-deployment' as TemplateId,
      name: 'Blue-Green Deployment',
      description: 'Zero-downtime deployment using blue-green strategy',
      category: 'deployment',
      workflow: this.buildBlueGreenDeploymentWorkflow(),
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'Service name to deploy',
          required: true
        },
        {
          name: 'image',
          type: 'string',
          description: 'Docker image to deploy',
          required: true
        },
        {
          name: 'healthCheckPath',
          type: 'string',
          description: 'Health check endpoint',
          required: true,
          defaultValue: '/health'
        },
        {
          name: 'healthCheckTimeout',
          type: 'number',
          description: 'Health check timeout in seconds',
          required: false,
          defaultValue: 30
        }
      ],
      documentation: `
# Blue-Green Deployment Template

Zero-downtime deployment strategy.

## Process

1. Deploy new version to green environment
2. Run health checks on green
3. Switch traffic to green
4. Monitor for issues
5. Keep blue for rollback

## Benefits

- Zero downtime
- Instant rollback
- Easy testing

## Parameters

- \`serviceName\`: Service name
- \`image\): Docker image
- \`healthCheckPath\`: Health check endpoint
- \`healthCheckTimeout\`: Health check timeout
      `,
      tags: ['deployment', 'blue-green', 'zero-downtime'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build blue-green deployment workflow
   */
  private buildBlueGreenDeploymentWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Blue-Green Deployment',
      description: 'Zero-downtime deployment',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 600000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'deployment',
        estimatedDuration: 300000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Canary Deployment Template
   */
  private createCanaryDeploymentTemplate(): Template {
    return {
      id: 'canary-deployment' as TemplateId,
      name: 'Canary Deployment',
      description: 'Gradual rollout with canary strategy',
      category: 'deployment',
      workflow: this.buildCanaryDeploymentWorkflow(),
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'Service name',
          required: true
        },
        {
          name: 'canaryPercentage',
          type: 'number',
          description: 'Initial canary traffic percentage',
          required: true,
          defaultValue: 10
        },
        {
          name: 'incrementSteps',
          type: 'number',
          description: 'Number of increment steps',
          required: false,
          defaultValue: 5
        },
        {
          name: 'monitorDuration',
          type: 'number',
          description: 'Duration to monitor each step (minutes)',
          required: false,
          defaultValue: 10
        }
      ],
      documentation: `
# Canary Deployment Template

Gradual rollout with monitoring.

## Process

1. Deploy canary version
2. Route X% traffic to canary
3. Monitor metrics
4. Gradually increase traffic
5. Full rollout or rollback

## Benefits

- Risk mitigation
- Gradual rollout
- Real monitoring

## Parameters

- \`serviceName\`: Service name
- \`canaryPercentage\`: Initial traffic percentage
- \`incrementSteps\`: Number of steps
- \`monitorDuration\`: Monitor duration per step
      `,
      tags: ['deployment', 'canary', 'gradual-rollout'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build canary deployment workflow
   */
  private buildCanaryDeploymentWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Canary Deployment',
      description: 'Gradual rollout deployment',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 1800000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'deployment',
        estimatedDuration: 900000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Rolling Deployment Template
   */
  private createRollingDeploymentTemplate(): Template {
    return {
      id: 'rolling-deployment' as TemplateId,
      name: 'Rolling Deployment',
      description: 'Rolling update deployment strategy',
      category: 'deployment',
      workflow: this.buildRollingDeploymentWorkflow(),
      parameters: [
        {
          name: 'serviceName',
          type: 'string',
          description: 'Service name',
          required: true
        },
        {
          name: 'batchSize',
          type: 'number',
          description: 'Number of instances to update at once',
          required: true,
          defaultValue: 1
        },
        {
          name: 'batchDelay',
          type: 'number',
          description: 'Delay between batches (seconds)',
          required: false,
          defaultValue: 30
        }
      ],
      documentation: `
# Rolling Deployment Template

Rolling update deployment strategy.

## Process

1. Update batch of instances
2. Wait and verify
3. Continue with next batch
4. Complete rollout

## Benefits

- No downtime
- Gradual update
- Easy rollback

## Parameters

- \`serviceName\`: Service name
- \`batchSize\`: Instances per batch
- \`batchDelay\): Delay between batches
      `,
      tags: ['deployment', 'rolling', 'zero-downtime'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build rolling deployment workflow
   */
  private buildRollingDeploymentWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Rolling Deployment',
      description: 'Rolling update deployment',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 1200000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'deployment',
        estimatedDuration: 600000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Health Check Template
   */
  private createHealthCheckTemplate(): Template {
    return {
      id: 'health-check' as TemplateId,
      name: 'Health Check',
      description: 'Periodic health check monitoring',
      category: 'monitoring',
      workflow: this.buildHealthCheckWorkflow(),
      parameters: [
        {
          name: 'endpoints',
          type: 'array',
          description: 'Endpoints to check',
          required: true
        },
        {
          name: 'interval',
          type: 'number',
          description: 'Check interval in seconds',
          required: true,
          defaultValue: 60
        },
        {
          name: 'timeout',
          type: 'number',
          description: 'Request timeout in seconds',
          required: false,
          defaultValue: 5
        }
      ],
      documentation: `
# Health Check Template

Periodic health check monitoring.

## Features

- Endpoint health monitoring
- Response time tracking
- Availability metrics
- Alert on failure

## Parameters

- \`endpoints\`: Array of endpoints to check
- \`interval\`: Check interval
- \`timeout\): Request timeout
      `,
      tags: ['monitoring', 'health-check', 'availability'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build health check workflow
   */
  private buildHealthCheckWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Health Check',
      description: 'Health check monitoring',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 60000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'monitoring',
        estimatedDuration: 30000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Alerting Template
   */
  private createAlertingTemplate(): Template {
    return {
      id: 'alerting' as TemplateId,
      name: 'Alerting System',
      description: 'Multi-channel alerting system',
      category: 'monitoring',
      workflow: this.buildAlertingWorkflow(),
      parameters: [
        {
          name: 'alertRules',
          type: 'object',
          description: 'Alert rule definitions',
          required: true
        },
        {
          name: 'channels',
          type: 'array',
          description: 'Alert channels',
          required: true,
          defaultValue: ['slack', 'email']
        },
        {
          name: 'escalationPolicy',
          type: 'object',
          description: 'Escalation policy configuration',
          required: false
        }
      ],
      documentation: `
# Alerting System Template

Multi-channel alerting with escalation.

## Features

- Multiple alert channels
- Escalation policies
- Alert grouping
- Suppression rules

## Parameters

- \`alertRules\`: Alert rule definitions
- \`channels\): Alert channels
- \`escalationPolicy\): Escalation configuration
      `,
      tags: ['monitoring', 'alerting', 'notification'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build alerting workflow
   */
  private buildAlertingWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Alerting System',
      description: 'Multi-channel alerting',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 60000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'monitoring',
        estimatedDuration: 10000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Metrics Collection Template
   */
  private createMetricsCollectionTemplate(): Template {
    return {
      id: 'metrics-collection' as TemplateId,
      name: 'Metrics Collection',
      description: 'Collect and aggregate metrics',
      category: 'monitoring',
      workflow: this.buildMetricsCollectionWorkflow(),
      parameters: [
        {
          name: 'sources',
          type: 'array',
          description: 'Metric sources',
          required: true
        },
        {
          name: 'aggregation',
          type: 'string',
          description: 'Aggregation method',
          required: true,
          defaultValue: 'avg'
        },
        {
          name: 'retention',
          type: 'number',
          description: 'Data retention period in days',
          required: false,
          defaultValue: 30
        }
      ],
      documentation: `
# Metrics Collection Template

Collect and aggregate system metrics.

## Features

- Multiple metric sources
- Data aggregation
- Retention policies
- Export capabilities

## Parameters

- \`sources\`: Metric sources
- \`aggregation\): Aggregation method
- \`retention\): Retention period
      `,
      tags: ['monitoring', 'metrics', 'analytics'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build metrics collection workflow
   */
  private buildMetricsCollectionWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Metrics Collection',
      description: 'Metrics collection and aggregation',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 300000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'monitoring',
        estimatedDuration: 60000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Slack Notification Template
   */
  private createSlackNotificationTemplate(): Template {
    return {
      id: 'slack-notification' as TemplateId,
      name: 'Slack Notification',
      description: 'Send notifications to Slack',
      category: 'communication',
      workflow: this.buildSlackNotificationWorkflow(),
      parameters: [
        {
          name: 'webhookUrl',
          type: 'string',
          description: 'Slack webhook URL',
          required: true
        },
        {
          name: 'channel',
          type: 'string',
          description: 'Slack channel',
          required: true,
          defaultValue: '#general'
        },
        {
          name: 'message',
          type: 'string',
          description: 'Message template',
          required: true
        },
        {
          name: 'attachments',
          type: 'array',
          description: 'Message attachments',
          required: false
        }
      ],
      documentation: `
# Slack Notification Template

Send notifications to Slack channels.

## Features

- Rich message formatting
- Attachments support
- Custom message templates
- Thread replies

## Parameters

- \`webhookUrl\): Slack webhook URL
- \`channel\): Target channel
- \`message\): Message template
- \`attachments\): Message attachments
      `,
      tags: ['communication', 'slack', 'notification'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build Slack notification workflow
   */
  private buildSlackNotificationWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Slack Notification',
      description: 'Send Slack notifications',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 30000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'communication',
        estimatedDuration: 5000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Email Digest Template
   */
  private createEmailDigestTemplate(): Template {
    return {
      id: 'email-digest' as TemplateId,
      name: 'Email Digest',
      description: 'Send periodic email digests',
      category: 'communication',
      workflow: this.buildEmailDigestWorkflow(),
      parameters: [
        {
          name: 'recipients',
          type: 'array',
          description: 'Email recipients',
          required: true
        },
        {
          name: 'subject',
          type: 'string',
          description: 'Email subject',
          required: true
        },
        {
          name: 'schedule',
          type: 'string',
          description: 'Cron schedule',
          required: true,
          defaultValue: '0 9 * * *'
        },
        {
          name: 'template',
          type: 'string',
          description: 'Email template',
          required: true
        }
      ],
      documentation: `
# Email Digest Template

Send periodic email digests.

## Features

- Scheduled delivery
- HTML templates
- Multiple recipients
- Custom scheduling

## Parameters

- \`recipients\): Email recipients
- \`subject\): Email subject
- \`schedule\): Cron schedule
- \`template\): Email template
      `,
      tags: ['communication', 'email', 'digest'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build email digest workflow
   */
  private buildEmailDigestWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Email Digest',
      description: 'Send email digests',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 120000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'communication',
        estimatedDuration: 30000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Incident Response Template
   */
  private createIncidentResponseTemplate(): Template {
    return {
      id: 'incident-response' as TemplateId,
      name: 'Incident Response',
      description: 'Automated incident response workflow',
      category: 'communication',
      workflow: this.buildIncidentResponseWorkflow(),
      parameters: [
        {
          name: 'severity',
          type: 'string',
          description: 'Incident severity',
          required: true,
          defaultValue: 'medium'
        },
        {
          name: 'oncall',
          type: 'string',
          description: 'On-call contact',
          required: true
        },
        {
          name: 'runbookUrl',
          type: 'string',
          description: 'Runbook URL',
          required: false
        }
      ],
      documentation: `
# Incident Response Template

Automated incident response procedures.

## Features

- Severity-based response
- Automatic notifications
- Runbook execution
- Status updates

## Parameters

- \`severity\): Incident severity
- \`oncall\): On-call contact
- \`runbookUrl\): Runbook URL
      `,
      tags: ['communication', 'incident', 'response'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build incident response workflow
   */
  private buildIncidentResponseWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Incident Response',
      description: 'Automated incident response',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 600000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'communication',
        estimatedDuration: 60000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * ETL Pipeline Template
   */
  private createETLPipelineTemplate(): Template {
    return {
      id: 'etl-pipeline' as TemplateId,
      name: 'ETL Pipeline',
      description: 'Extract, Transform, Load pipeline',
      category: 'data',
      workflow: this.buildETLPipelineWorkflow(),
      parameters: [
        {
          name: 'source',
          type: 'string',
          description: 'Data source',
          required: true
        },
        {
          name: 'destination',
          type: 'string',
          description: 'Data destination',
          required: true
        },
        {
          name: 'transformations',
          type: 'array',
          description: 'Data transformations',
          required: true
        },
        {
          name: 'batchSize',
          type: 'number',
          description: 'Batch size',
          required: false,
          defaultValue: 1000
        }
      ],
      documentation: `
# ETL Pipeline Template

Extract, Transform, Load data pipeline.

## Features

- Multiple data sources
- Data transformations
- Batch processing
- Error handling

## Parameters

- \`source\): Data source
- \`destination\): Data destination
- \`transformations\): Transformations
- \`batchSize\): Batch size
      `,
      tags: ['data', 'etl', 'pipeline'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build ETL pipeline workflow
   */
  private buildETLPipelineWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'ETL Pipeline',
      description: 'ETL data pipeline',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 3600000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'data',
        estimatedDuration: 1800000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Data Transformation Template
   */
  private createDataTransformationTemplate(): Template {
    return {
      id: 'data-transformation' as TemplateId,
      name: 'Data Transformation',
      description: 'Transform and process data',
      category: 'data',
      workflow: this.buildDataTransformationWorkflow(),
      parameters: [
        {
          name: 'inputFormat',
          type: 'string',
          description: 'Input data format',
          required: true,
          defaultValue: 'json'
        },
        {
          name: 'outputFormat',
          type: 'string',
          description: 'Output data format',
          required: true,
          defaultValue: 'json'
        },
        {
          name: 'transformations',
          type: 'array',
          description: 'Data transformations',
          required: true
        }
      ],
      documentation: `
# Data Transformation Template

Transform data between formats.

## Features

- Format conversion
- Data validation
- Schema transformation
- Error handling

## Parameters

- \`inputFormat\): Input format
- \`outputFormat\): Output format
- \`transformations\): Transformations
      `,
      tags: ['data', 'transformation', 'processing'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build data transformation workflow
   */
  private buildDataTransformationWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Data Transformation',
      description: 'Transform data',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 1800000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'data',
        estimatedDuration: 900000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Batch Processing Template
   */
  private createBatchProcessingTemplate(): Template {
    return {
      id: 'batch-processing' as TemplateId,
      name: 'Batch Processing',
      description: 'Process data in batches',
      category: 'data',
      workflow: this.buildBatchProcessingWorkflow(),
      parameters: [
        {
          name: 'dataSource',
          type: 'string',
          description: 'Data source',
          required: true
        },
        {
          name: 'batchSize',
          type: 'number',
          description: 'Batch size',
          required: true,
          defaultValue: 100
        },
        {
          name: 'processingFunction',
          type: 'string',
          description: 'Processing function',
          required: true
        }
      ],
      documentation: `
# Batch Processing Template

Process data in batches.

## Features

- Configurable batch size
- Progress tracking
- Error handling
- Retry logic

## Parameters

- \`dataSource\): Data source
- \`batchSize\): Batch size
- \`processingFunction\): Processing function
      `,
      tags: ['data', 'batch', 'processing'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build batch processing workflow
   */
  private buildBatchProcessingWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Batch Processing',
      description: 'Batch data processing',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 7200000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'data',
        estimatedDuration: 3600000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * GitHub Integration Template
   */
  private createGitHubIntegrationTemplate(): Template {
    return {
      id: 'github-integration' as TemplateId,
      name: 'GitHub Integration',
      description: 'Integrate with GitHub',
      category: 'integration',
      workflow: this.buildGitHubIntegrationWorkflow(),
      parameters: [
        {
          name: 'repository',
          type: 'string',
          description: 'Repository name',
          required: true
        },
        {
          name: 'events',
          type: 'array',
          description: 'GitHub events to listen to',
          required: true,
          defaultValue: ['push', 'pull_request']
        },
        {
          name: 'webhookSecret',
          type: 'string',
          description: 'Webhook secret',
          required: true
        }
      ],
      documentation: `
# GitHub Integration Template

Integrate workflows with GitHub.

## Features

- Webhook handling
- Event filtering
- PR automation
- Issue management

## Parameters

- \`repository\): Repository name
- \`events\): Events to listen to
- \`webhookSecret\): Webhook secret
      `,
      tags: ['integration', 'github', 'webhook'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build GitHub integration workflow
   */
  private buildGitHubIntegrationWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'GitHub Integration',
      description: 'GitHub integration',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 300000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'integration',
        estimatedDuration: 60000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Webhook Processor Template
   */
  private createWebhookProcessorTemplate(): Template {
    return {
      id: 'webhook-processor' as TemplateId,
      name: 'Webhook Processor',
      description: 'Process incoming webhooks',
      category: 'integration',
      workflow: this.buildWebhookProcessorWorkflow(),
      parameters: [
        {
          name: 'endpoint',
          type: 'string',
          description: 'Webhook endpoint',
          required: true
        },
        {
          name: 'validation',
          type: 'object',
          description: 'Webhook validation rules',
          required: false
        },
        {
          name: 'processing',
          type: 'object',
          description: 'Processing logic',
          required: true
        }
      ],
      documentation: `
# Webhook Processor Template

Process incoming webhooks.

## Features

- Endpoint registration
- Request validation
- Data processing
- Response handling

## Parameters

- \`endpoint\): Webhook endpoint
- \`validation\): Validation rules
- \`processing\): Processing logic
      `,
      tags: ['integration', 'webhook', 'api'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build webhook processor workflow
   */
  private buildWebhookProcessorWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'Webhook Processor',
      description: 'Process webhooks',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 60000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'integration',
        estimatedDuration: 10000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * API Sync Template
   */
  private createAPISyncTemplate(): Template {
    return {
      id: 'api-sync' as TemplateId,
      name: 'API Sync',
      description: 'Synchronize data between APIs',
      category: 'integration',
      workflow: this.buildAPISyncWorkflow(),
      parameters: [
        {
          name: 'sourceApi',
          type: 'string',
          description: 'Source API endpoint',
          required: true
        },
        {
          name: 'targetApi',
          type: 'string',
          description: 'Target API endpoint',
          required: true
        },
        {
          name: 'syncInterval',
          type: 'number',
          description: 'Sync interval in seconds',
          required: true,
          defaultValue: 300
        },
        {
          name: 'mapping',
          type: 'object',
          description: 'Field mapping',
          required: true
        }
      ],
      documentation: `
# API Sync Template

Synchronize data between APIs.

## Features

- Bidirectional sync
- Field mapping
- Conflict resolution
- Error handling

## Parameters

- \`sourceApi\): Source API
- \`targetApi\): Target API
- \`syncInterval\): Sync interval
- \`mapping\): Field mapping
      `,
      tags: ['integration', 'api', 'sync'],
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Build API sync workflow
   */
  private buildAPISyncWorkflow(): Workflow {
    return {
      id: uuidv4(),
      name: 'API Sync',
      description: 'API synchronization',
      version: 1,
      status: 'active',
      nodes: [],
      connections: [],
      triggers: [],
      variables: [],
      settings: {
        timeout: 600000,
        logLevel: 'info',
        enableMetrics: true,
        enableTracing: false
      },
      metadata: {
        category: 'integration',
        estimatedDuration: 120000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Register a template
   */
  public registerTemplate(template: Template): void {
    this.templates.set(template.id, template);

    // Update category index
    if (!this.categories.has(template.category)) {
      this.categories.set(template.category, []);
    }

    const metadata: TemplateMetadata = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags || [],
      popularity: 0,
      rating: 0,
      usage: 0,
      author: template.author || 'Unknown',
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };

    this.categories.get(template.category)!.push(metadata);
  }

  /**
   * Search templates
   */
  public search(query: string): Template[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.templates.values()).filter(template => {
      return (
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Get templates by category
   */
  public getByCategory(category: TemplateCategory): Template[] {
    return Array.from(this.templates.values()).filter(
      template => template.category === category
    );
  }

  /**
   * Validate a template
   */
  public validate(template: Template): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate workflow structure
    if (!template.workflow) {
      errors.push('Template must have a workflow');
    }

    // Validate parameters
    for (const param of template.parameters) {
      if (!param.name) {
        errors.push('Parameter must have a name');
      }

      if (param.required && !param.defaultValue) {
        warnings.push(`Required parameter '${param.name}' has no default value`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Instantiate a template
   */
  public instantiate(
    templateId: TemplateId,
    parameters: Record<string, any>
  ): Workflow {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Clone workflow
    const workflow: Workflow = JSON.parse(JSON.stringify(template.workflow));

    // Apply parameters
    for (const [key, value] of Object.entries(parameters)) {
      const param = template.parameters.find(p => p.name === key);

      if (!param) {
        throw new Error(`Unknown parameter: ${key}`);
      }

      // Replace parameter references in workflow
      this.replaceParameterInWorkflow(workflow, key, value);
    }

    // Generate new IDs
    workflow.id = uuidv4();
    workflow.name = `${template.name} (Instance)`;

    return workflow;
  }

  /**
   * Replace parameter references in workflow
   */
  private replaceParameterInWorkflow(workflow: Workflow, key: string, value: any): void {
    const placeholder = `{{${key}}}`;

    // Replace in nodes
    for (const node of workflow.nodes) {
      const json = JSON.stringify(node);
      if (json.includes(placeholder)) {
        const updated = json.replace(new RegExp(placeholder, 'g'), JSON.stringify(value));
        Object.assign(node, JSON.parse(updated));
      }
    }

    // Replace in variables
    for (const variable of workflow.variables) {
      if (typeof variable.value === 'string' && variable.value.includes(placeholder)) {
        variable.value = variable.value.replace(new RegExp(placeholder, 'g'), value);
      }
    }
  }

  /**
   * Initialize patterns
   */
  private initializePatterns(): void {
    // Common workflow patterns would be registered here
  }

  /**
   * Initialize best practices
   */
  private initializeBestPractices(): void {
    // Best practices would be registered here
  }

  /**
   * Get all templates
   */
  public getAllTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: TemplateId): Template | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get categories
   */
  public getCategories(): TemplateCategory[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get templates by tag
   */
  public getByTag(tag: string): Template[] {
    return Array.from(this.templates.values()).filter(template =>
      template.tags?.includes(tag)
    );
  }

  /**
   * Get popular templates
   */
  public getPopularTemplates(limit = 10): Template[] {
    return Array.from(this.templates.values())
      .sort((a, b) => {
        const metadataA = this.categories.get(a.category)?.find(m => m.id === a.id);
        const metadataB = this.categories.get(b.category)?.find(m => m.id === b.id);
        return (metadataB?.popularity || 0) - (metadataA?.popularity || 0);
      })
      .slice(0, limit);
  }

  /**
   * Rate a template
   */
  public rateTemplate(templateId: TemplateId, rating: number): void {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const category = this.categories.get(template.category);
    const metadata = category?.find(m => m.id === templateId);

    if (metadata) {
      metadata.rating = rating;
    }
  }

  /**
   * Increment template usage
   */
  public incrementUsage(templateId: TemplateId): void {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const category = this.categories.get(template.category);
    const metadata = category?.find(m => m.id === templateId);

    if (metadata) {
      metadata.usage++;
      metadata.popularity++;
    }
  }
}

/**
 * Best Practice
 */
interface BestPractice {
  id: string;
  title: string;
  description: string;
  category: string;
  rules: BestPracticeRule[];
  examples: string[];
}

interface BestPracticeRule {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (workflow: Workflow) => boolean;
}

/**
 * Export the enhanced template library
 */
export { EnhancedTemplateLibrary as TemplateLibrary };
