import {
  RemediationWorkflow,
  RemediationStatus,
  WorkflowStep,
  ApprovalChain,
  ApprovalLevel,
  Approval,
  WorkflowTrigger,
  Finding,
  SeverityLevel
} from '../types';

/**
 * Remediation action
 */
export interface RemediationAction {
  id: string;
  name: string;
  description: string;
  type: 'automated' | 'manual' | 'hybrid';
  handler: string;
  parameters?: Record<string, any>;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
  };
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  workflowId: string;
  trigger: string;
  initiator: string;
  findingId?: string;
  parameters?: Record<string, any>;
  startTime: Date;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  stepId: string;
  status: RemediationStatus;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt: Date;
  duration: number;
}

/**
 * Remediation engine
 */
export class RemediationEngine {
  private workflows: Map<string, RemediationWorkflow> = new Map();
  private actions: Map<string, RemediationAction> = new Map();
  private executions: Map<string, WorkflowExecutionContext> = new Map();
  private stepResults: Map<string, StepExecutionResult> = new Map();

  constructor() {
    this.initializeDefaultActions();
  }

  /**
   * Create a remediation workflow
   */
  createWorkflow(workflow: RemediationWorkflow): void {
    // Validate workflow
    this.validateWorkflow(workflow);

    // Store workflow
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Execute a remediation workflow
   */
  async execute(
    workflowId: string,
    context: Partial<WorkflowExecutionContext>
  ): Promise<StepExecutionResult[]> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create execution context
    const executionContext: WorkflowExecutionContext = {
      workflowId,
      trigger: context.trigger || 'manual',
      initiator: context.initiator || 'system',
      findingId: context.findingId,
      parameters: context.parameters,
      startTime: new Date()
    };

    this.executions.set(workflowId, executionContext);

    // Update workflow status
    workflow.status = RemediationStatus.IN_PROGRESS;
    workflow.startedAt = new Date();

    const results: StepExecutionResult[] = [];

    // Execute steps in order
    for (const step of workflow.steps) {
      // Check if step should be executed
      if (!this.shouldExecuteStep(step, workflow)) {
        continue;
      }

      // Check for approvals if required
      if (step.requiresApproval) {
        const approved = await this.waitForApproval(step, workflow);
        if (!approved) {
          step.status = RemediationStatus.FAILED;
          results.push({
            stepId: step.id,
            status: RemediationStatus.FAILED,
            error: 'Approval denied',
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0
          });
          break;
        }
      }

      // Execute step
      const result = await this.executeStep(step, executionContext);
      results.push(result);

      // Check if step failed and stop workflow
      if (result.status === RemediationStatus.FAILED) {
        workflow.status = RemediationStatus.FAILED;
        break;
      }

      step.status = RemediationStatus.COMPLETED;
      step.completedAt = new Date();
    }

    // Update workflow status
    if (workflow.status !== RemediationStatus.FAILED) {
      workflow.status = RemediationStatus.COMPLETED;
      workflow.completedAt = new Date();
    }

    return results;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<StepExecutionResult> {
    const startTime = new Date();
    step.startedAt = startTime;
    step.status = RemediationStatus.IN_PROGRESS;

    try {
      let output: any;

      if (step.automated) {
        output = await this.executeAutomatedStep(step, context);
      } else {
        output = await this.executeManualStep(step, context);
      }

      const completedAt = new Date();
      const duration = completedAt.getTime() - startTime.getTime();

      const result: StepExecutionResult = {
        stepId: step.id,
        status: RemediationStatus.COMPLETED,
        output,
        startedAt: startTime,
        completedAt,
        duration
      };

      this.stepResults.set(step.id, result);

      return result;
    } catch (error) {
      const completedAt = new Date();
      const duration = completedAt.getTime() - startTime.getTime();

      const result: StepExecutionResult = {
        stepId: step.id,
        status: RemediationStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt: startTime,
        completedAt,
        duration
      };

      this.stepResults.set(step.id, result);

      return result;
    }
  }

  /**
   * Execute automated step
   */
  private async executeAutomatedStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<any> {
    const action = this.actions.get(step.action);
    if (!action) {
      throw new Error(`Action not found: ${step.action}`);
    }

    // In a real implementation, this would execute the action
    console.log(`Executing action: ${action.name} on target: ${step.target}`);

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      action: action.name,
      target: step.target,
      result: 'success'
    };
  }

  /**
   * Execute manual step
   */
  private async executeManualStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<any> {
    // Manual steps require human intervention
    // In a real implementation, this would create a task and wait for completion
    console.log(`Manual step ${step.name} requires human intervention`);

    return {
      action: step.name,
      target: step.target,
      result: 'awaiting_manual_completion'
    };
  }

  /**
   * Check if step should be executed
   */
  private shouldExecuteStep(step: WorkflowStep, workflow: RemediationWorkflow): boolean {
    // Check dependencies
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depStep = workflow.steps.find(s => s.id === depId);
        if (!depStep || depStep.status !== RemediationStatus.COMPLETED) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Wait for approval
   */
  private async waitForApproval(
    step: WorkflowStep,
    workflow: RemediationWorkflow
  ): Promise<boolean> {
    // In a real implementation, this would wait for actual approval
    // For now, auto-approve
    return true;
  }

  /**
   * Approve a workflow step
   */
  async approve(
    workflowId: string,
    stepId: string,
    approver: string,
    decision: 'approved' | 'rejected',
    comments?: string
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Add approval to chain
    const approval: Approval = {
      approver,
      timestamp: new Date(),
      decision,
      comments
    };

    // In a real implementation, this would update the approval chain
    console.log(`Step ${stepId} ${decision} by ${approver}`);
  }

  /**
   * Validate workflow
   */
  private validateWorkflow(workflow: RemediationWorkflow): void {
    if (!workflow.id) {
      throw new Error('Workflow must have an ID');
    }

    if (!workflow.name) {
      throw new Error('Workflow must have a name');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate steps are ordered
    const orders = workflow.steps.map(s => s.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i) {
        throw new Error('Workflow steps must have sequential orders starting from 0');
      }
    }

    // Validate dependencies
    for (const step of workflow.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          const depExists = workflow.steps.some(s => s.id === depId);
          if (!depExists) {
            throw new Error(`Dependency not found: ${depId}`);
          }
        }
      }
    }
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): RemediationWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): RemediationWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflows by status
   */
  getWorkflowsByStatus(status: RemediationStatus): RemediationWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.status === status);
  }

  /**
   * Get step results
   */
  getStepResults(workflowId: string): StepExecutionResult[] {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return [];

    return workflow.steps
      .map(step => this.stepResults.get(step.id))
      .filter((r): r is StepExecutionResult => r !== undefined);
  }

  /**
   * Cancel a workflow
   */
  async cancel(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = RemediationStatus.FAILED;

    // Cancel in-progress steps
    for (const step of workflow.steps) {
      if (step.status === RemediationStatus.IN_PROGRESS) {
        step.status = RemediationStatus.FAILED;
        step.error = 'Workflow cancelled';
      }
    }
  }

  /**
   * Retry a failed workflow
   */
  async retry(workflowId: string): Promise<StepExecutionResult[]> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Reset failed steps
    for (const step of workflow.steps) {
      if (step.status === RemediationStatus.FAILED) {
        step.status = RemediationStatus.PENDING;
        step.error = undefined;
      }
    }

    // Re-execute workflow
    const context = this.executions.get(workflowId);
    if (!context) {
      throw new Error('No execution context found');
    }

    return this.execute(workflowId, context);
  }

  /**
   * Initialize default remediation actions
   */
  private initializeDefaultActions(): void {
    // Security remediation actions
    this.actions.set('enable-mfa', {
      id: 'enable-mfa',
      name: 'Enable Multi-Factor Authentication',
      description: 'Enable MFA for user accounts',
      type: 'automated',
      handler: 'security.enableMFA',
      timeout: 60000
    });

    this.actions.set('encrypt-data', {
      id: 'encrypt-data',
      name: 'Encrypt Data at Rest',
      description: 'Enable encryption for data storage',
      type: 'automated',
      handler: 'security.encryptData',
      timeout: 300000
    });

    this.actions.set('update-firewall', {
      id: 'update-firewall',
      name: 'Update Firewall Rules',
      description: 'Update firewall configuration',
      type: 'automated',
      handler: 'network.updateFirewall',
      timeout: 60000
    });

    this.actions.set('patch-system', {
      id: 'patch-system',
      name: 'Apply Security Patches',
      description: 'Apply security patches to systems',
      type: 'automated',
      handler: 'operations.patchSystem',
      timeout: 600000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMultiplier: 2
      }
    });

    // Access control actions
    this.actions.set('revoke-access', {
      id: 'revoke-access',
      name: 'Revoke User Access',
      description: 'Revoke access for a user',
      type: 'automated',
      handler: 'access.revoke',
      timeout: 30000
    });

    this.actions.set('update-role', {
      id: 'update-role',
      name: 'Update User Role',
      description: 'Modify user role and permissions',
      type: 'automated',
      handler: 'access.updateRole',
      timeout: 30000
    });

    // Documentation actions
    this.actions.set('update-policy', {
      id: 'update-policy',
      name: 'Update Policy Document',
      description: 'Update compliance policy documentation',
      type: 'manual',
      handler: 'documentation.updatePolicy',
      timeout: 86400000 // 24 hours
    });

    this.actions.set('create-documentation', {
      id: 'create-documentation',
      name: 'Create Documentation',
      description: 'Create missing documentation',
      type: 'manual',
      handler: 'documentation.create',
      timeout: 86400000 // 24 hours
    });
  }

  /**
   * Create workflow from finding
   */
  createWorkflowFromFinding(finding: Finding): RemediationWorkflow {
    const workflowId = `workflow-${finding.id}`;
    const steps: WorkflowStep[] = [];

    if (finding.remediation) {
      for (let i = 0; i < finding.remediation.steps.length; i++) {
        const remediationStep = finding.remediation.steps[i];

        steps.push({
          id: `step-${i}`,
          name: remediationStep.description,
          description: remediationStep.action,
          action: remediationStep.action,
          target: remediationStep.target,
          order: i,
          automated: remediationStep.automated,
          requiresApproval: !remediationStep.automated || finding.severity === 'critical',
          timeout: finding.severity === 'critical' ? 300000 : 600000,
          status: RemediationStatus.PENDING
        });
      }
    }

    const workflow: RemediationWorkflow = {
      id: workflowId,
      name: `Remediate: ${finding.title}`,
      description: finding.description,
      trigger: {
        type: 'manual',
        condition: `finding.id === '${finding.id}'`
      },
      steps,
      approvalChain: {
        levels: this.generateApprovalLevels(finding.severity),
        currentLevel: 0,
        allRequired: finding.severity === 'critical'
      },
      status: RemediationStatus.PENDING,
      createdAt: new Date()
    };

    return workflow;
  }

  /**
   * Generate approval levels based on severity
   */
  private generateApprovalLevels(severity: SeverityLevel): ApprovalLevel[] {
    const levels: ApprovalLevel[] = [];

    if (severity === 'critical') {
      levels.push({
        level: 1,
        role: 'CISO',
        approvers: ['ciso@example.com'],
        minRequired: 1,
        status: 'pending',
        approvals: []
      });
      levels.push({
        level: 2,
        role: 'CTO',
        approvers: ['cto@example.com'],
        minRequired: 1,
        status: 'pending',
        approvals: []
      });
    } else if (severity === 'high') {
      levels.push({
        level: 1,
        role: 'Security Manager',
        approvers: ['security-manager@example.com'],
        minRequired: 1,
        status: 'pending',
        approvals: []
      });
    }

    return levels;
  }
}
