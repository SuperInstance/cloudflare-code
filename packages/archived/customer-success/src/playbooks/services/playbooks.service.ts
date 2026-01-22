/**
 * Success Playbooks Service
 * Manages customer success playbooks and execution
 */

import {
  SuccessPlaybook,
  PlaybookExecution,
  PlaybookTemplate,
  PlaybookRecommendation,
  PlaybookType,
  PlaybookStatus,
  ExecutionStatus,
  TaskStatus,
} from '../types/playbooks.types';

export class PlaybooksService {
  private playbooks: Map<string, SuccessPlaybook> = new Map();
  private executions: Map<string, PlaybookExecution> = new Map();
  private templates: Map<string, PlaybookTemplate> = new Map();

  constructor() {
    this.initializeDefaultPlaybooks();
  }

  /**
   * Create a new playbook
   */
  async createPlaybook(playbook: Omit<SuccessPlaybook, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'usageStats'>): Promise<SuccessPlaybook> {
    const newPlaybook: SuccessPlaybook = {
      ...playbook,
      id: this.generateId(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageStats: {
        totalExecutions: 0,
        activeExecutions: 0,
        completedExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        bySegment: {},
        byTier: {},
      },
    };

    this.playbooks.set(newPlaybook.id, newPlaybook);
    return newPlaybook;
  }

  /**
   * Execute a playbook for a customer
   */
  async executePlaybook(
    playbookId: string,
    customerId: string,
    customerName: string,
    assignedTo: string,
    configuration?: any
  ): Promise<PlaybookExecution> {
    const playbook = this.playbooks.get(playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${playbookId}`);
    }

    const execution: PlaybookExecution = {
      id: this.generateId(),
      playbookId,
      customerId,
      customerName,
      status: 'not_started',
      stage: playbook.stages[0]?.id || '',
      progress: {
        percentage: 0,
        completedStages: 0,
        totalStages: playbook.stages.length,
        completedTasks: 0,
        totalTasks: playbook.stages.reduce((sum, s) => sum + s.tasks.length, 0),
      },
      tasks: this.createExecutionTasks(playbook),
      timeline: this.createExecutionTimeline(playbook),
      metrics: {
        customMetrics: {},
        playbookMetrics: {},
        customerHealthBefore: 0,
        riskScoreBefore: 0,
      },
      outcomes: [],
      notes: [],
      assignedTo,
      startedBy: assignedTo,
      configuration: configuration || {},
      customizations: [],
      triggers: [],
      createdAt: new Date(),
      startedAt: new Date(),
      estimatedCompletion: this.calculateEstimatedCompletion(playbook),
    };

    this.executions.set(execution.id, execution);

    // Update playbook stats
    playbook.usageStats.totalExecutions++;
    playbook.usageStats.activeExecutions++;
    playbook.lastUsed = new Date();

    // Auto-start if configured
    if (playbook.configuration.executionMode === 'auto') {
      await this.startExecution(execution.id);
    }

    return execution;
  }

  /**
   * Start playbook execution
   */
  async startExecution(executionId: string): Promise<PlaybookExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = 'in_progress';
    execution.updatedAt = new Date();

    // Start first stage
    const playbook = this.playbooks.get(execution.playbookId);
    if (playbook && playbook.stages.length > 0) {
      const firstStage = playbook.stages[0];
      execution.stage = firstStage.id;
      await this.startStage(execution, firstStage.id);
    }

    this.executions.set(executionId, execution);
    return execution;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    executionId: string,
    taskId: string,
    status: TaskStatus,
    notes?: string
  ): Promise<PlaybookExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const task = execution.tasks.find(t => t.taskId === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date();
      execution.progress.completedTasks++;
    }

    if (notes) {
      task.notes = notes;
    }

    // Recalculate progress
    execution.progress.percentage = Math.round(
      (execution.progress.completedTasks / execution.progress.totalTasks) * 100
    );

    // Check if stage is complete
    await this.checkStageCompletion(execution);

    // Check if execution is complete
    await this.checkExecutionCompletion(execution);

    execution.updatedAt = new Date();
    this.executions.set(executionId, execution);

    return execution;
  }

  /**
   * Add note to execution
   */
  async addNote(
    executionId: string,
    userId: string,
    userName: string,
    content: string,
    type: 'progress' | 'observation' | 'decision' | 'issue' | 'success' | 'custom' = 'progress'
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.notes.push({
      id: this.generateId(),
      userId,
      userName,
      content,
      timestamp: new Date(),
      type,
      visibility: 'team',
      attachments: [],
    });

    execution.updatedAt = new Date();
  }

  /**
   * Get recommended playbooks for a customer
   */
  async getRecommendedPlaybooks(customerId: string, context: any): Promise<PlaybookRecommendation[]> {
    const recommendations: PlaybookRecommendation[] = [];

    // Analyze customer context and recommend playbooks
    if (context.riskLevel === 'high' || context.riskLevel === 'critical') {
      const riskMitigationPlaybooks = Array.from(this.playbooks.values())
        .filter(p => p.type === 'risk_mitigation' && p.status === 'active');

      riskMitigationPlaybooks.forEach(playbook => {
        recommendations.push({
          customerId,
          recommendedPlaybooks: [{
            playbookId: playbook.id,
            playbookName: playbook.name,
            matchScore: 0.9,
            expectedOutcome: 'Reduce churn risk through targeted interventions',
            estimatedDuration: playbook.stages.reduce((sum, s) => sum + (s.duration || 0), 0),
            requiredResources: playbook.resources.map(r => r.title),
            potentialRisks: ['Time commitment from CSM', 'Customer responsiveness'],
          }],
          reasoning: `High churn risk detected. ${playbook.name} can help mitigate key risk factors.`,
          confidence: 0.85,
          priority: 'urgent',
          context,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        });
      });
    }

    if (context.healthScore < 70) {
      const healthImprovementPlaybooks = Array.from(this.playbooks.values())
        .filter(p => p.type === 'adoption' && p.status === 'active');

      healthImprovementPlaybooks.forEach(playbook => {
        recommendations.push({
          customerId,
          recommendedPlaybooks: [{
            playbookId: playbook.id,
            playbookName: playbook.name,
            matchScore: 0.8,
            expectedOutcome: 'Improve product adoption and engagement',
            estimatedDuration: playbook.stages.reduce((sum, s) => sum + (s.duration || 0), 0),
            requiredResources: playbook.resources.map(r => r.title),
            potentialRisks: ['Feature availability', 'User training needs'],
          }],
          reasoning: `Health score below threshold. ${playbook.name} can help drive feature adoption.`,
          confidence: 0.75,
          priority: 'high',
          context,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        });
      });
    }

    return recommendations;
  }

  /**
   * Get playbook by ID
   */
  getPlaybook(playbookId: string): SuccessPlaybook | undefined {
    return this.playbooks.get(playbookId);
  }

  /**
   * Get all playbooks
   */
  getAllPlaybooks(): SuccessPlaybook[] {
    return Array.from(this.playbooks.values());
  }

  /**
   * Get playbooks by type
   */
  getPlaybooksByType(type: PlaybookType): SuccessPlaybook[] {
    return Array.from(this.playbooks.values()).filter(p => p.type === type);
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): PlaybookExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get executions by customer
   */
  getExecutionsByCustomer(customerId: string): PlaybookExecution[] {
    return Array.from(this.executions.values()).filter(e => e.customerId === customerId);
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): PlaybookExecution[] {
    return Array.from(this.executions.values()).filter(e => e.status === 'in_progress');
  }

  /**
   * Create playbook from template
   */
  async createFromTemplate(templateId: string, customization: any): Promise<SuccessPlaybook> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const playbook: SuccessPlaybook = {
      id: this.generateId(),
      name: customization.name || template.name,
      description: customization.description || template.description,
      type: this.mapTemplateTypeToPlaybookType(template.category),
      category: template.category as any,
      targetSegment: {
        type: 'all',
        criteria: [],
      },
      triggers: [{
        id: this.generateId(),
        type: 'manual',
        condition: { field: '', operator: 'equals', value: '' },
        priority: 'medium',
        autoStart: false,
        manualApproval: false,
        notificationSettings: {
          notifyOnTrigger: true,
          channels: ['email'],
          recipients: [],
        },
      }],
      stages: template.stages.map((stage, i) => ({
        id: this.generateId(),
        name: stage.name,
        description: stage.description,
        order: i,
        type: 'execution' as any,
        duration: stage.duration,
        dependencies: [],
        tasks: stage.tasks.map((task, j) => ({
          id: this.generateId(),
          name: task.name,
          description: task.description,
          type: 'custom' as any,
          assignee: task.assignee,
          priority: 'medium',
          status: 'pending' as TaskStatus,
          estimatedDuration: task.duration,
          dependencies: task.dependencies || [],
          subtasks: [],
          checklists: [],
          attachments: [],
          automation: { enabled: false, triggers: [], actions: [], conditions: [] },
          completionCriteria: [],
        })),
        milestones: [],
        approvals: [],
        automatedActions: [],
        skipConditions: [],
        configuration: {
          allowSkip: false,
          requireCompletion: true,
          autoAdvance: true,
          notifyOnStart: true,
          notifyOnComplete: true,
        },
      })),
      configuration: {
        executionMode: 'manual',
        executionOrder: 'sequential',
        allowCustomization: true,
        requireApproval: false,
        escalationRules: [],
        successCriteria: [],
        failureHandling: {
          onTaskFailure: 'pause',
          onStageFailure: 'pause',
          onTimeout: 'escalate',
          maxRetries: 3,
          retryInterval: 24,
        },
        integrationSettings: {
          crm: false,
          support: false,
          analytics: false,
          communication: false,
          customIntegrations: [],
        },
      },
      metrics: {
        primaryMetric: { name: 'Completion Rate', target: 80 },
        secondaryMetrics: [],
        trackingMetrics: [],
        outcomes: [],
      },
      resources: template.resources.map(r => ({
        ...r,
        id: this.generateId(),
        required: false,
      })),
      status: 'active',
      version: 1,
      author: customization.author || 'system',
      reviewers: [],
      tags: template.tags,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageStats: {
        totalExecutions: 0,
        activeExecutions: 0,
        completedExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        bySegment: {},
        byTier: {},
      },
    };

    this.playbooks.set(playbook.id, playbook);
    return playbook;
  }

  // Private helper methods

  private initializeDefaultPlaybooks(): void {
    // Default playbooks will be initialized here
    // For now, we'll create placeholders
  }

  private createExecutionTasks(playbook: SuccessPlaybook): any[] {
    const tasks: any[] = [];

    playbook.stages.forEach(stage => {
      stage.tasks.forEach(task => {
        tasks.push({
          taskId: task.id,
          playbookTaskId: task.id,
          name: task.name,
          status: 'pending',
          assignee: task.assignee,
          dueDate: task.estimatedDuration
            ? new Date(Date.now() + task.estimatedDuration * 60 * 60 * 1000)
            : undefined,
          completedAt: undefined,
          notes: undefined,
          attachments: [],
          subtasks: task.subtasks.map(s => ({
            ...s,
            completed: false,
            completedAt: undefined,
          })),
        });
      });
    });

    return tasks;
  }

  private createExecutionTimeline(playbook: SuccessPlaybook): any {
    return {
      milestones: playbook.stages.map((stage, i) => ({
        stageId: stage.id,
        stageName: stage.name,
        targetDate: stage.duration
          ? new Date(Date.now() + stage.duration * 24 * 60 * 60 * 1000)
          : undefined,
        status: 'pending',
      })),
      events: [],
      reminders: [],
    };
  }

  private calculateEstimatedCompletion(playbook: SuccessPlaybook): Date {
    const totalDuration = playbook.stages.reduce((sum, s) => sum + (s.duration || 0), 0);
    return new Date(Date.now() + totalDuration * 24 * 60 * 60 * 1000);
  }

  private async startStage(execution: PlaybookExecution, stageId: string): Promise<void> {
    const playbook = this.playbooks.get(execution.playbookId);
    if (!playbook) return;

    const stage = playbook.stages.find(s => s.id === stageId);
    if (!stage) return;

    // Add timeline event
    execution.timeline.events.push({
      id: this.generateId(),
      type: 'stage_started',
      description: `Started stage: ${stage.name}`,
      timestamp: new Date(),
    });

    // Initialize stage tasks
    stage.tasks.forEach(task => {
      const executionTask = execution.tasks.find(t => t.playbookTaskId === task.id);
      if (executionTask && executionTask.status === 'pending') {
        executionTask.status = 'pending'; // Keep pending until assigned
      }
    });
  }

  private async checkStageCompletion(execution: PlaybookExecution): Promise<void> {
    const playbook = this.playbooks.get(execution.playbookId);
    if (!playbook) return;

    const currentStage = playbook.stages.find(s => s.id === execution.stage);
    if (!currentStage) return;

    const stageTasks = execution.tasks.filter(t =>
      currentStage.tasks.some(st => st.id === t.playbookTaskId)
    );
    const allCompleted = stageTasks.every(t => t.status === 'completed');

    if (allCompleted) {
      // Mark milestone as complete
      const milestone = execution.timeline.milestones.find(m => m.stageId === execution.stage);
      if (milestone) {
        milestone.status = 'completed';
        milestone.actualDate = new Date();
      }

      // Add event
      execution.timeline.events.push({
        id: this.generateId(),
        type: 'stage_completed',
        description: `Completed stage: ${currentStage.name}`,
        timestamp: new Date(),
      });

      execution.progress.completedStages++;

      // Move to next stage
      const nextStage = playbook.stages.find(s => s.order === currentStage.order + 1);
      if (nextStage) {
        execution.stage = nextStage.id;
        await this.startStage(execution, nextStage.id);
      }
    }
  }

  private async checkExecutionCompletion(execution: PlaybookExecution): Promise<void> {
    if (execution.progress.completedStages === execution.progress.totalStages) {
      execution.status = 'completed';
      execution.completedAt = new Date();

      const playbook = this.playbooks.get(execution.playbookId);
      if (playbook) {
        playbook.usageStats.activeExecutions--;
        playbook.usageStats.completedExecutions++;

        // Calculate success metrics
        const duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        const avgDuration = playbook.usageStats.averageDuration || 0;
        playbook.usageStats.averageDuration = (avgDuration * (playbook.usageStats.completedExecutions - 1) + duration) / playbook.usageStats.completedExecutions;
      }
    }
  }

  private mapTemplateTypeToPlaybookType(category: string): PlaybookType {
    const mapping: Record<string, PlaybookType> = {
      'product': 'adoption',
      'success': 'onboarding',
      'support': 'risk_mitigation',
      'marketing': 'expansion',
    };
    return mapping[category] || 'custom';
  }

  private generateId(): string {
    return `playbook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
