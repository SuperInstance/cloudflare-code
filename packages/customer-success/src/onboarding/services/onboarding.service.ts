/**
 * Onboarding Service
 * Manages customer onboarding workflows and progress tracking
 */

import {
  OnboardingWorkflow,
  OnboardingStep,
  OnboardingTemplate,
  OnboardingSession,
  OnboardingAnalytics,
  OnboardingProgress,
  OnboardingRecommendation,
  OnboardingStatus,
  OnboardingStepStatus,
  CustomerType,
} from '../types/onboarding.types';

export class OnboardingService {
  private workflows: Map<string, OnboardingWorkflow> = new Map();
  private templates: Map<string, OnboardingTemplate> = new Map();
  private sessions: Map<string, OnboardingSession> = new Map();

  /**
   * Initialize onboarding for a new customer
   */
  async initializeOnboarding(
    customerId: string,
    customerType: CustomerType,
    templateId?: string
  ): Promise<OnboardingWorkflow> {
    // Get appropriate template
    const template = templateId
      ? this.getTemplate(templateId)
      : this.getDefaultTemplate(customerType);

    if (!template) {
      throw new Error(`No template found for customer type: ${customerType}`);
    }

    // Create workflow from template
    const workflow: OnboardingWorkflow = {
      id: this.generateId(),
      customerId,
      customerType,
      templateId: template.id,
      status: 'not_started',
      progress: this.createInitialProgress(),
      steps: this.createStepsFromTemplate(template),
      milestones: this.createMilestonesFromTemplate(template),
      timeline: this.createInitialTimeline(template),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedCompletion: this.calculateEstimatedCompletion(template),
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Start onboarding workflow
   */
  async startOnboarding(workflowId: string): Promise<OnboardingWorkflow> {
    const workflow = this.getWorkflow(workflowId);
    workflow.status = 'in_progress';
    workflow.timeline.startedAt = new Date();
    workflow.updatedAt = new Date();

    // Mark first step as in_progress
    const firstStep = workflow.steps.find(s => s.order === 0);
    if (firstStep) {
      firstStep.status = 'in_progress';
      firstStep.startedAt = new Date();
      workflow.progress.currentStepId = firstStep.id;
    }

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Update onboarding step progress
   */
  async updateStepProgress(
    workflowId: string,
    stepId: string,
    status: OnboardingStepStatus,
    metadata?: Record<string, any>
  ): Promise<OnboardingWorkflow> {
    const workflow = this.getWorkflow(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);

    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    // Update step status
    step.status = status;
    step.metadata = { ...step.metadata, ...metadata };

    if (status === 'completed') {
      step.completedAt = new Date();
      await this.handleStepCompletion(workflow, step);
    } else if (status === 'in_progress' && !step.startedAt) {
      step.startedAt = new Date();
    }

    // Recalculate progress
    workflow.progress = this.calculateProgress(workflow);
    workflow.updatedAt = new Date();

    // Check if workflow is complete
    if (this.isWorkflowComplete(workflow)) {
      workflow.status = 'completed';
      workflow.timeline.completedAt = new Date();
      workflow.completedAt = new Date();
    }

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Get workflow progress
   */
  async getProgress(workflowId: string): Promise<OnboardingProgress> {
    const workflow = this.getWorkflow(workflowId);
    return workflow.progress;
  }

  /**
   * Generate onboarding recommendations
   */
  async generateRecommendations(
    workflowId: string
  ): Promise<OnboardingRecommendation[]> {
    const workflow = this.getWorkflow(workflowId);
    const recommendations: OnboardingRecommendation[] = [];

    // Check for stuck users
    const currentStep = workflow.steps.find(
      s => s.id === workflow.progress.currentStepId
    );

    if (currentStep && currentStep.status === 'in_progress') {
      const timeInStep = Date.now() - (currentStep.startedAt?.getTime() || 0);
      const hoursInStep = timeInStep / (1000 * 60 * 60);

      if (hoursInStep > 24) {
        recommendations.push({
          customerId: workflow.customerId,
          workflowId: workflow.id,
          type: 'support',
          priority: 'high',
          title: 'Onboarding Progress Assistance',
          description: `You've been on "${currentStep.name}" for over 24 hours. Would you like help?`,
          actionUrl: '/support',
          actionType: 'side_panel',
          createdAt: new Date(),
          dismissed: false,
        });
      }
    }

    // Check for uncompleted required steps
    const pendingRequired = workflow.steps.filter(
      s => s.required && s.status === 'pending'
    );

    if (pendingRequired.length > 0) {
      recommendations.push({
        customerId: workflow.customerId,
        workflowId: workflow.id,
        type: 'next_step',
        priority: 'medium',
        title: 'Complete Required Steps',
        description: `You have ${pendingRequired.length} required steps remaining`,
        actionUrl: `/onboarding/${workflowId}`,
        actionType: 'navigation',
        createdAt: new Date(),
        dismissed: false,
      });
    }

    // Suggest resources based on current step
    if (currentStep && currentStep.resources.length > 0) {
      recommendations.push({
        customerId: workflow.customerId,
        workflowId: workflow.id,
        type: 'resource',
        priority: 'low',
        title: `Help with ${currentStep.name}`,
        description: 'Check out these resources to help you complete this step',
        actionUrl: currentStep.resources[0].url,
        actionType: 'modal',
        createdAt: new Date(),
        dismissed: false,
      });
    }

    return recommendations;
  }

  /**
   * Analyze onboarding analytics
   */
  async analyzeOnboarding(workflowId: string): Promise<OnboardingAnalytics> {
    const workflow = this.getWorkflow(workflowId);
    const sessions = this.getSessionsByWorkflow(workflowId);

    return {
      workflowId: workflow.id,
      customerId: workflow.customerId,
      metrics: this.calculateMetrics(workflow, sessions),
      funnelMetrics: this.calculateFunnelMetrics(workflow),
      engagementMetrics: this.calculateEngagementMetrics(sessions),
      timeMetrics: this.calculateTimeMetrics(workflow),
      completionMetrics: this.calculateCompletionMetrics(workflow),
      dropOffPoints: this.identifyDropOffPoints(workflow, sessions),
      recommendations: await this.generateRecommendations(workflowId),
    };
  }

  /**
   * Create onboarding session for tracking
   */
  async createSession(
    workflowId: string,
    stepId: string
  ): Promise<OnboardingSession> {
    const session: OnboardingSession = {
      id: this.generateId(),
      workflowId,
      customerId: this.getWorkflow(workflowId).customerId,
      stepId,
      startedAt: new Date(),
      actions: [],
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Track session action
   */
  async trackSessionAction(
    sessionId: string,
    type: string,
    details?: Record<string, any>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.actions.push({
      type: type as any,
      timestamp: new Date(),
      details,
    });
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.completedAt = new Date();
    session.duration = session.completedAt.getTime() - session.startedAt.getTime();
  }

  /**
   * Get onboarding templates
   */
  async getTemplates(customerType?: CustomerType): Promise<OnboardingTemplate[]> {
    const templates = Array.from(this.templates.values());
    if (customerType) {
      return templates.filter(t => t.customerTypes.includes(customerType));
    }
    return templates.filter(t => t.isActive);
  }

  /**
   * Create custom template
   */
  async createTemplate(
    template: Omit<OnboardingTemplate, 'id' | 'version' | 'createdAt'>
  ): Promise<OnboardingTemplate> {
    const newTemplate: OnboardingTemplate = {
      ...template,
      id: this.generateId(),
      version: 1,
      createdAt: new Date(),
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  // Private helper methods

  private getWorkflow(id: string): OnboardingWorkflow {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }
    return workflow;
  }

  private getTemplate(id: string): OnboardingTemplate | undefined {
    return this.templates.get(id);
  }

  private getDefaultTemplate(customerType: CustomerType): OnboardingTemplate | undefined {
    const templates = Array.from(this.templates.values()).filter(
      t => t.isActive && t.customerTypes.includes(customerType)
    );
    return templates[0];
  }

  private createInitialProgress(): OnboardingProgress {
    return {
      percentage: 0,
      completedSteps: 0,
      totalSteps: 0,
      overallScore: 0,
      engagementScore: 0,
      lastActivityAt: new Date(),
    };
  }

  private createStepsFromTemplate(template: OnboardingTemplate): OnboardingStep[] {
    return template.steps.map((step, index) => ({
      id: this.generateId(),
      name: step.name,
      description: step.description,
      order: index,
      category: step.category,
      required: step.required,
      estimatedDuration: step.estimatedDuration,
      dependencies: step.dependencies,
      resources: step.resources,
      status: 'pending',
      metadata: {},
    }));
  }

  private createMilestonesFromTemplate(template: OnboardingTemplate): any[] {
    return template.milestones.map(m => ({
      id: this.generateId(),
      name: m.name,
      description: m.description,
      targetDate: new Date(Date.now() + m.dayNumber * 24 * 60 * 60 * 1000),
      status: 'pending',
      requirements: m.requirements,
      rewards: m.rewards,
    }));
  }

  private createInitialTimeline(template: OnboardingTemplate): any {
    return {
      expectedDuration: template.estimatedDuration,
      checkpoints: [],
    };
  }

  private calculateEstimatedCompletion(template: OnboardingTemplate): Date {
    return new Date(Date.now() + template.estimatedDuration * 24 * 60 * 60 * 1000);
  }

  private calculateProgress(workflow: OnboardingWorkflow): OnboardingProgress {
    const totalSteps = workflow.steps.length;
    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Calculate overall score
    const requiredSteps = workflow.steps.filter(s => s.required);
    const completedRequired = requiredSteps.filter(s => s.status === 'completed').length;
    const requiredScore = requiredSteps.length > 0
      ? (completedRequired / requiredSteps.length) * 100
      : 0;

    const engagementScore = this.calculateEngagementScore(workflow);

    return {
      percentage: Math.round(percentage),
      completedSteps,
      totalSteps,
      currentStepId: workflow.progress.currentStepId,
      overallScore: Math.round((requiredScore + engagementScore) / 2),
      engagementScore,
      lastActivityAt: new Date(),
    };
  }

  private calculateEngagementScore(workflow: OnboardingWorkflow): number {
    const sessions = this.getSessionsByWorkflow(workflow.id);
    if (sessions.length === 0) return 0;

    const totalActions = sessions.reduce((sum, s) => sum + s.actions.length, 0);
    const avgActionsPerSession = totalActions / sessions.length;

    // Score based on engagement metrics
    let score = 0;
    if (avgActionsPerSession > 10) score += 40;
    else if (avgActionsPerSession > 5) score += 30;
    else if (avgActionsPerSession > 2) score += 20;

    if (sessions.length >= 3) score += 30;
    else if (sessions.length >= 2) score += 20;
    else if (sessions.length >= 1) score += 10;

    // Bonus for resource usage
    const resourcesUsed = new Set();
    sessions.forEach(s => {
      s.actions.forEach(a => {
        if (a.type === 'view' && a.details?.resource) {
          resourcesUsed.add(a.details.resource);
        }
      });
    });
    score += Math.min(resourcesUsed.size * 5, 30);

    return Math.min(score, 100);
  }

  private async handleStepCompletion(
    workflow: OnboardingWorkflow,
    step: OnboardingStep
  ): Promise<void> {
    // Update timeline based on step category
    const now = new Date();
    switch (step.category) {
      case 'account_setup':
        if (!workflow.timeline.accountSetupCompletedAt) {
          workflow.timeline.accountSetupCompletedAt = now;
        }
        break;
      case 'team_management':
        if (!workflow.timeline.teamSetupCompletedAt) {
          workflow.timeline.teamSetupCompletedAt = now;
        }
        break;
      case 'project_creation':
        if (!workflow.timeline.firstProjectCreatedAt) {
          workflow.timeline.firstProjectCreatedAt = now;
        }
        break;
      case 'api_configuration':
        if (!workflow.timeline.firstApiCallAt) {
          workflow.timeline.firstApiCallAt = now;
        }
        break;
      case 'first_code_generation':
        if (!workflow.timeline.firstCodeGeneratedAt) {
          workflow.timeline.firstCodeGeneratedAt = now;
        }
        break;
    }

    // Move to next step
    const nextStep = workflow.steps.find(s => s.order === step.order + 1);
    if (nextStep) {
      nextStep.status = 'in_progress';
      nextStep.startedAt = now;
      workflow.progress.currentStepId = nextStep.id;
    }

    // Check milestones
    workflow.milestones.forEach(milestone => {
      if (milestone.status === 'pending') {
        const requirementsMet = milestone.requirements.every(req =>
          workflow.steps.some(s => s.id === req && s.status === 'completed')
        );
        if (requirementsMet) {
          milestone.status = 'completed';
          milestone.actualDate = now;
        }
      }
    });
  }

  private isWorkflowComplete(workflow: OnboardingWorkflow): boolean {
    const requiredSteps = workflow.steps.filter(s => s.required);
    return requiredSteps.every(s => s.status === 'completed');
  }

  private getSessionsByWorkflow(workflowId: string): OnboardingSession[] {
    return Array.from(this.sessions.values()).filter(s => s.workflowId === workflowId);
  }

  private calculateMetrics(workflow: OnboardingWorkflow, sessions: OnboardingSession[]): any {
    return {
      totalSteps: workflow.steps.length,
      completedSteps: workflow.steps.filter(s => s.status === 'completed').length,
      completionRate: workflow.progress.percentage,
      averageStepDuration: this.calculateAverageStepDuration(workflow, sessions),
      totalDuration: workflow.timeline.completedAt
        ? (workflow.timeline.completedAt.getTime() - (workflow.timeline.startedAt?.getTime() || 0)) / (1000 * 60 * 60 * 24)
        : 0,
      skippedSteps: workflow.steps.filter(s => s.status === 'skipped').length,
      failedSteps: workflow.steps.filter(s => s.status === 'failed').length,
      helpRequests: sessions.reduce((sum, s) =>
        sum + s.actions.filter(a => a.type === 'help_request').length, 0
      ),
    };
  }

  private calculateAverageStepDuration(workflow: OnboardingWorkflow, sessions: OnboardingSession[]): number {
    const completedSteps = workflow.steps.filter(s => s.status === 'completed' && s.startedAt && s.completedAt);
    if (completedSteps.length === 0) return 0;

    const totalDuration = completedSteps.reduce((sum, step) => {
      return sum + (step.completedAt!.getTime() - step.startedAt!.getTime());
    }, 0);

    return totalDuration / completedSteps.length / (1000 * 60); // minutes
  }

  private calculateFunnelMetrics(workflow: OnboardingWorkflow): any {
    const steps = workflow.steps;
    return {
      started: workflow.timeline.startedAt ? 1 : 0,
      accountSetup: steps.filter(s => s.category === 'account_setup' && s.status === 'completed').length,
      teamSetup: steps.filter(s => s.category === 'team_management' && s.status === 'completed').length,
      firstProject: steps.filter(s => s.category === 'project_creation' && s.status === 'completed').length,
      firstApiCall: steps.filter(s => s.category === 'api_configuration' && s.status === 'completed').length,
      firstCodeGeneration: steps.filter(s => s.category === 'first_code_generation' && s.status === 'completed').length,
      completed: workflow.status === 'completed' ? 1 : 0,
      conversionRates: {},
    };
  }

  private calculateEngagementMetrics(sessions: OnboardingSession[]): any {
    const totalDuration = sessions.reduce((sum, s) =>
      sum + (s.duration || 0), 0
    );
    const totalActions = sessions.reduce((sum, s) => sum + s.actions.length, 0);

    return {
      sessionCount: sessions.length,
      totalSessionDuration: totalDuration,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
      actionsPerSession: sessions.length > 0 ? totalActions / sessions.length : 0,
      resourceViews: sessions.reduce((sum, s) =>
        sum + s.actions.filter(a => a.type === 'view').length, 0
      ),
      helpRequests: sessions.reduce((sum, s) =>
        sum + s.actions.filter(a => a.type === 'help_request').length, 0
      ),
      engagementScore: this.calculateEngagementScoreFromSessions(sessions),
    };
  }

  private calculateEngagementScoreFromSessions(sessions: OnboardingSession[]): number {
    if (sessions.length === 0) return 0;

    let score = 0;
    score += Math.min(sessions.length * 20, 40); // Up to 40 points for sessions

    const avgActions = sessions.reduce((sum, s) => sum + s.actions.length, 0) / sessions.length;
    score += Math.min(avgActions * 5, 30); // Up to 30 points for actions

    const resourceViews = sessions.reduce((sum, s) =>
      sum + s.actions.filter(a => a.type === 'view').length, 0
    );
    score += Math.min(resourceViews * 3, 30); // Up to 30 points for resources

    return Math.min(score, 100);
  }

  private calculateTimeMetrics(workflow: OnboardingWorkflow): any {
    const now = Date.now();
    const startTime = workflow.timeline.startedAt?.getTime() || now;

    return {
      timeToFirstProject: workflow.timeline.firstProjectCreatedAt
        ? (workflow.timeline.firstProjectCreatedAt.getTime() - startTime) / (1000 * 60 * 60)
        : 0,
      timeToFirstApiCall: workflow.timeline.firstApiCallAt
        ? (workflow.timeline.firstApiCallAt.getTime() - startTime) / (1000 * 60 * 60)
        : 0,
      timeToFirstCodeGeneration: workflow.timeline.firstCodeGeneratedAt
        ? (workflow.timeline.firstCodeGeneratedAt.getTime() - startTime) / (1000 * 60 * 60)
        : 0,
      timeToValue: workflow.timeline.completedAt
        ? (workflow.timeline.completedAt.getTime() - startTime) / (1000 * 60 * 60 * 24)
        : 0,
      totalOnboardingTime: workflow.timeline.completedAt
        ? (workflow.timeline.completedAt.getTime() - startTime) / (1000 * 60 * 60 * 24)
        : (now - startTime) / (1000 * 60 * 60 * 24),
    };
  }

  private calculateCompletionMetrics(workflow: OnboardingWorkflow): any {
    const steps = workflow.steps;
    const categoryCompletionRates: Record<string, number> = {};

    const categories = new Set(steps.map(s => s.category));
    categories.forEach(category => {
      const categorySteps = steps.filter(s => s.category === category);
      const completed = categorySteps.filter(s => s.status === 'completed').length;
      categoryCompletionRates[category] = categorySteps.length > 0
        ? (completed / categorySteps.length) * 100
        : 0;
    });

    const requiredSteps = steps.filter(s => s.required);
    const optionalSteps = steps.filter(s => !s.required);

    return {
      overallCompletionRate: workflow.progress.percentage,
      requiredStepsCompletionRate: requiredSteps.length > 0
        ? (requiredSteps.filter(s => s.status === 'completed').length / requiredSteps.length) * 100
        : 0,
      optionalStepsCompletionRate: optionalSteps.length > 0
        ? (optionalSteps.filter(s => s.status === 'completed').length / optionalSteps.length) * 100
        : 0,
      categoryCompletionRates,
      milestoneAchievementRate: workflow.milestones.length > 0
        ? (workflow.milestones.filter(m => m.status === 'completed').length / workflow.milestones.length) * 100
        : 0,
    };
  }

  private identifyDropOffPoints(workflow: OnboardingWorkflow, sessions: OnboardingSession[]): any[] {
    const dropOffPoints: any[] = [];

    workflow.steps.forEach(step => {
      if (step.status === 'pending' || step.status === 'in_progress') {
        const stepSessions = sessions.filter(s => s.stepId === step.id);
        if (stepSessions.length > 0) {
          const avgTimeAtStep = stepSessions.reduce((sum, s) =>
            sum + (s.duration || 0), 0
          ) / stepSessions.length;

          if (avgTimeAtStep > 30 * 60 * 1000) { // 30 minutes
            dropOffPoints.push({
              stepId: step.id,
              stepName: step.name,
              dropOffCount: stepSessions.length,
              dropOffRate: 0,
              averageTimeAtStep: avgTimeAtStep,
              commonReasons: ['Taking longer than expected'],
              suggestedActions: ['Provide additional guidance', 'Offer live support'],
            });
          }
        }
      }
    });

    return dropOffPoints;
  }

  private generateId(): string {
    return `onb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
