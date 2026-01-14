import { describe, it, expect } from 'vitest';
import { RemediationEngine } from '../src/remediation';
import { Finding, SeverityLevel } from '../src/types';

describe('RemediationEngine', () => {
  it('should create workflow from finding', () => {
    const engine = new RemediationEngine();

    const finding: Finding = {
      id: 'finding-1',
      title: 'Test Finding',
      description: 'Test description',
      standard: 'SOC2' as any,
      category: 'Security' as any,
      severity: SeverityLevel.HIGH,
      status: 'non_compliant' as any,
      target: 'infrastructure' as any,
      location: 'test-location',
      evidence: ['evidence-1'],
      remediation: {
        steps: [
          {
            id: 'step-1',
            description: 'Test step',
            action: 'enable-mfa',
            target: 'test-target',
            order: 0,
            automated: true,
            status: 'pending' as any
          }
        ],
        estimatedEffort: 4,
        priority: 2
      },
      discoveredAt: new Date()
    };

    const workflow = engine.createWorkflowFromFinding(finding);

    expect(workflow).toBeDefined();
    expect(workflow.id).toBeDefined();
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.approvalChain).toBeDefined();
  });

  it('should execute workflow', async () => {
    const engine = new RemediationEngine();

    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      description: 'Test description',
      trigger: {
        type: 'manual' as const
      },
      steps: [
        {
          id: 'step-1',
          name: 'Test Step',
          description: 'Test step description',
          action: 'enable-mfa',
          target: 'test-target',
          order: 0,
          automated: true,
          requiresApproval: false,
          status: 'pending' as any
        }
      ],
      approvalChain: {
        levels: [],
        currentLevel: 0,
        allRequired: false
      },
      status: 'pending' as any,
      createdAt: new Date()
    };

    engine.createWorkflow(workflow);

    const results = await engine.execute('workflow-1', {
      initiator: 'test-user'
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].stepId).toBe('step-1');
  });

  it('should get workflow by ID', () => {
    const engine = new RemediationEngine();

    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      description: 'Test description',
      trigger: {
        type: 'manual' as const
      },
      steps: [],
      approvalChain: {
        levels: [],
        currentLevel: 0,
        allRequired: false
      },
      status: 'pending' as any,
      createdAt: new Date()
    };

    engine.createWorkflow(workflow);

    const retrieved = engine.getWorkflow('workflow-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('workflow-1');
  });

  it('should get workflows by status', () => {
    const engine = new RemediationEngine();

    const workflow1 = {
      id: 'workflow-1',
      name: 'Test Workflow 1',
      description: 'Test description',
      trigger: {
        type: 'manual' as const
      },
      steps: [],
      approvalChain: {
        levels: [],
        currentLevel: 0,
        allRequired: false
      },
      status: 'pending' as any,
      createdAt: new Date()
    };

    const workflow2 = {
      id: 'workflow-2',
      name: 'Test Workflow 2',
      description: 'Test description',
      trigger: {
        type: 'manual' as const
      },
      steps: [],
      approvalChain: {
        levels: [],
        currentLevel: 0,
        allRequired: false
      },
      status: 'completed' as any,
      createdAt: new Date()
    };

    engine.createWorkflow(workflow1);
    engine.createWorkflow(workflow2);

    const pendingWorkflows = engine.getWorkflowsByStatus('pending' as any);

    expect(pendingWorkflows.length).toBe(1);
    expect(pendingWorkflows[0].id).toBe('workflow-1');
  });

  it('should cancel workflow', async () => {
    const engine = new RemediationEngine();

    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      description: 'Test description',
      trigger: {
        type: 'manual' as const
      },
      steps: [
        {
          id: 'step-1',
          name: 'Test Step',
          description: 'Test step description',
          action: 'enable-mfa',
          target: 'test-target',
          order: 0,
          automated: true,
          requiresApproval: false,
          status: 'in_progress' as any
        }
      ],
      approvalChain: {
        levels: [],
        currentLevel: 0,
        allRequired: false
      },
      status: 'in_progress' as any,
      createdAt: new Date()
    };

    engine.createWorkflow(workflow);

    await engine.cancel('workflow-1');

    const cancelled = engine.getWorkflow('workflow-1');
    expect(cancelled?.status).toBe('failed' as any);
  });
});
