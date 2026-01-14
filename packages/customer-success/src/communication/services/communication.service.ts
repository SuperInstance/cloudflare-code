/**
 * Communication Service
 * Manages customer communications, campaigns, and surveys
 */

import {
  CommunicationCampaign,
  CommunicationMessage,
  CommunicationTemplate,
  Survey,
  SurveyResponse,
  CommunicationPreferences,
  CampaignStatus,
  MessageStatus,
  SurveyStatus,
  CommunicationChannel,
} from '../types/communication.types';

export class CommunicationService {
  private campaigns: Map<string, CommunicationCampaign> = new Map();
  private messages: Map<string, CommunicationMessage> = new Map();
  private templates: Map<string, CommunicationTemplate> = new Map();
  private surveys: Map<string, Survey> = new Map();
  private surveyResponses: Map<string, SurveyResponse[]> = new Map();
  private preferences: Map<string, CommunicationPreferences> = new Map();

  /**
   * Create a new communication campaign
   */
  async createCampaign(
    campaign: Omit<CommunicationCampaign, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approval'>
  ): Promise<CommunicationCampaign> {
    const newCampaign: CommunicationCampaign = {
      ...campaign,
      id: this.generateId(),
      status: 'draft',
      approval: {
        required: false,
        approvers: [],
        status: 'approved',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.campaigns.set(newCampaign.id, newCampaign);
    return newCampaign;
  }

  /**
   * Launch a campaign
   */
  async launchCampaign(campaignId: string): Promise<CommunicationCampaign> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Check approval if required
    if (campaign.configuration.requireApproval && campaign.approval.status !== 'approved') {
      throw new Error('Campaign not approved');
    }

    campaign.status = 'running';
    campaign.launchedAt = new Date();
    campaign.updatedAt = new Date();

    // Generate messages for target customers
    await this.generateCampaignMessages(campaign);

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Send a single message to a customer
   */
  async sendMessage(
    customerId: string,
    channel: CommunicationChannel,
    subject: string,
    content: string,
    options?: {
      templateId?: string;
      variables?: Record<string, any>;
      schedule?: Date;
      metadata?: any;
    }
  ): Promise<CommunicationMessage> {
    // Check customer preferences
    const prefs = this.preferences.get(customerId);
    if (prefs && !this.isChannelEnabled(prefs, channel)) {
      throw new Error(`Channel ${channel} not enabled for customer`);
    }

    let personalizedContent = content;
    if (options?.templateId) {
      const template = this.templates.get(options.templateId);
      if (template) {
        personalizedContent = this personalizeContent(template.body, options.variables || {});
      }
    } else if (options?.variables) {
      personalizedContent = this.personalizeContent(content, options.variables);
    }

    const message: CommunicationMessage = {
      id: this.generateId(),
      customerId,
      customerEmail: `${customerId}@example.com`,
      channel,
      type: options?.templateId ? 'campaign' : 'manual',
      status: options?.schedule ? 'pending' : 'sending',
      direction: 'outbound',
      subject,
      content: {
        body: personalizedContent,
        variables: options?.variables || {},
        attachments: [],
        personalization: options?.variables || {},
      },
      metadata: {
        ...options?.metadata,
        category: 'transactional',
        priority: 'normal',
        tags: [],
      },
      events: [],
      metrics: {
        opens: 0,
        clicks: 0,
        conversions: 0,
        clickPaths: [],
      },
      scheduledFor: options?.schedule,
      sentAt: options?.schedule ? undefined : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.messages.set(message.id, message);

    // Simulate sending
    if (!options?.schedule || options.schedule <= new Date()) {
      await this.sendMessageInternal(message);
    }

    return message;
  }

  /**
   * Create a survey
   */
  async createSurvey(
    survey: Omit<Survey, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'launchedAt' | 'closedAt' | 'responses'>
  ): Promise<Survey> {
    const newSurvey: Survey = {
      ...survey,
      id: this.generateId(),
      responses: [],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      metrics: {
        invitations: 0,
        starts: 0,
        completions: 0,
        abandonment: 0,
        startRate: 0,
        completionRate: 0,
        averageScore: 0,
        averageDuration: 0,
        responsesByDay: [],
        responsesByChannel: {},
        nps: undefined,
        csat: undefined,
        ces: undefined,
        questionAnalysis: [],
      },
    };

    this.surveys.set(newSurvey.id, newSurvey);
    return newSurvey;
  }

  /**
   * Launch a survey
   */
  async launchSurvey(surveyId: string): Promise<Survey> {
    const survey = this.surveys.get(surveyId);
    if (!survey) {
      throw new Error(`Survey not found: ${surveyId}`);
    }

    survey.status = 'open';
    survey.launchedAt = new Date();
    survey.updatedAt = new Date();

    // Send survey invitations
    await this.sendSurveyInvitations(survey);

    this.surveys.set(surveyId, survey);
    return survey;
  }

  /**
   * Submit survey response
   */
  async submitSurveyResponse(
    surveyId: string,
    customerId: string,
    answers: Array<{ questionId: string; answer: any }>,
    respondentInfo?: any
  ): Promise<SurveyResponse> {
    const survey = this.surveys.get(surveyId);
    if (!survey) {
      throw new Error(`Survey not found: ${surveyId}`);
    }

    if (survey.status !== 'open') {
      throw new Error('Survey is not open for responses');
    }

    const response: SurveyResponse = {
      id: this.generateId(),
      surveyId,
      customerId,
      respondentInfo: respondentInfo || {
        anonymous: false,
        email: `${customerId}@example.com`,
      },
      answers: survey.questions.map(q => {
        const answerData = answers.find(a => a.questionId === q.id);
        return {
          questionId: q.id,
          question: q.text,
          type: q.type,
          answer: answerData?.answer,
          answeredAt: new Date(),
        };
      }),
      score: this.calculateSurveyScore(survey, answers),
      sentiment: this.determineSentiment(survey, answers),
      metadata: {
        source: 'web',
        customFields: {},
      },
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 300, // 5 minutes
      status: 'completed',
    };

    // Store response
    if (!this.surveyResponses.has(surveyId)) {
      this.surveyResponses.set(surveyId, []);
    }
    this.surveyResponses.get(surveyId)!.push(response);
    survey.responses.push(response);

    // Update metrics
    await this.updateSurveyMetrics(survey);

    survey.updatedAt = new Date();
    this.surveys.set(surveyId, survey);

    return response;
  }

  /**
   * Get customer communication preferences
   */
  async getPreferences(customerId: string): Promise<CommunicationPreferences> {
    let prefs = this.preferences.get(customerId);

    if (!prefs) {
      prefs = this.createDefaultPreferences(customerId);
      this.preferences.set(customerId, prefs);
    }

    return prefs;
  }

  /**
   * Update customer communication preferences
   */
  async updatePreferences(
    customerId: string,
    updates: Partial<CommunicationPreferences>
  ): Promise<CommunicationPreferences> {
    const currentPrefs = await this.getPreferences(customerId);
    const updatedPrefs: CommunicationPreferences = {
      ...currentPrefs,
      ...updates,
      updatedAt: new Date(),
    };

    this.preferences.set(customerId, updatedPrefs);
    return updatedPrefs;
  }

  /**
   * Unsubscribe customer from communications
   */
  async unsubscribe(customerId: string, channel: CommunicationChannel): Promise<void> {
    const prefs = await this.getPreferences(customerId);

    switch (channel) {
      case 'email':
        prefs.email.enabled = false;
        break;
      case 'in_app':
        prefs.inApp.enabled = false;
        break;
      case 'push':
        prefs.push.enabled = false;
        break;
      case 'sms':
        prefs.sms.enabled = false;
        break;
    }

    prefs.updatedAt = new Date();
    this.preferences.set(customerId, prefs);
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<any> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const messages = await this.getCampaignMessages(campaignId);

    return {
      ...campaign.metrics,
      messagesSent: messages.length,
      messagesDelivered: messages.filter(m => m.status === 'delivered').length,
      messagesOpened: messages.filter(m => m.metrics.opens > 0).length,
      messagesClicked: messages.filter(m => m.metrics.clicks > 0).length,
      messagesConverted: messages.filter(m => m.metrics.conversions > 0).length,
    };
  }

  /**
   * Get survey results and analytics
   */
  async getSurveyResults(surveyId: string): Promise<any> {
    const survey = this.surveys.get(surveyId);
    if (!survey) {
      throw new Error(`Survey not found: ${surveyId}`);
    }

    return {
      surveyId,
      name: survey.name,
      status: survey.status,
      metrics: survey.metrics,
      questions: survey.questions.map(q => ({
        questionId: q.id,
        question: q.text,
        type: q.type,
        responseCount: survey.responses.length,
        average: this.calculateQuestionAverage(q, survey.responses),
        distribution: this.calculateQuestionDistribution(q, survey.responses),
        textResponses: q.type === 'text' || q.type === 'textarea'
          ? this.getTextResponses(q, survey.responses)
          : undefined,
      })),
      responses: survey.responses,
      sent: survey.metrics.invitations,
      started: survey.metrics.starts,
      completed: survey.metrics.completions,
    };
  }

  // Private helper methods

  private createDefaultPreferences(customerId: string): CommunicationPreferences {
    return {
      customerId,
      email: {
        enabled: true,
        address: `${customerId}@example.com`,
        categories: {
          product: true,
          security: true,
          billing: true,
          support: true,
          features: true,
          education: true,
          community: true,
          custom: {},
        },
        frequency: 'immediate',
        digest: false,
      },
      inApp: {
        enabled: true,
        sound: true,
        desktop: true,
        mobile: true,
      },
      push: {
        enabled: true,
        deviceTokens: [],
        categories: {
          product: true,
          security: true,
          billing: true,
          support: true,
          features: true,
          education: false,
          community: false,
        },
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'UTC',
          weekends: true,
        },
      },
      sms: {
        enabled: false,
        phoneNumber: '',
        country: 'US',
        categories: {
          security: true,
          billing: true,
        },
      },
      slack: {
        enabled: false,
        workspace: '',
        channel: '',
        categories: {},
      },
      categories: {
        product: true,
        security: true,
        billing: true,
        support: true,
        features: true,
        education: true,
        community: true,
        custom: {},
      },
      frequency: {
        maximum: 10,
        minimum: 1,
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'UTC',
          weekends: true,
        },
        timezone: 'UTC',
        batchingEnabled: false,
        batchWindow: 24,
      },
      timezone: 'UTC',
      language: 'en',
      updatedAt: new Date(),
    };
  }

  private isChannelEnabled(prefs: CommunicationPreferences, channel: CommunicationChannel): boolean {
    switch (channel) {
      case 'email':
        return prefs.email.enabled;
      case 'in_app':
        return prefs.inApp.enabled;
      case 'push':
        return prefs.push.enabled;
      case 'sms':
        return prefs.sms.enabled;
      case 'slack':
        return prefs.slack.enabled;
      default:
        return true;
    }
  }

  private personalizeContent(template: string, variables: Record<string, any>): string {
    let content = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, String(value));
    });
    return content;
  }

  private async sendMessageInternal(message: CommunicationMessage): Promise<void> {
    // Simulate message sending
    message.status = 'sent';
    message.sentAt = new Date();

    // Add events
    message.events.push({
      id: this.generateId(),
      type: 'sent',
      timestamp: new Date(),
      details: { channel: message.channel },
    });

    // Simulate delivery
    setTimeout(() => {
      message.events.push({
        id: this.generateId(),
        type: 'delivered',
        timestamp: new Date(),
        details: {},
      });
      message.status = 'delivered';
      this.messages.set(message.id, message);
    }, 1000);

    this.messages.set(message.id, message);
  }

  private async generateCampaignMessages(campaign: CommunicationCampaign): Promise<void> {
    // Mock implementation - would fetch target customers and generate messages
    const targetCustomers = this.getMockTargetCustomers(campaign);

    for (const customerId of targetCustomers) {
      try {
        const message = await this.sendMessage(
          customerId,
          campaign.channels[0],
          campaign.content.subject,
          campaign.content.body,
          {
            templateId: campaign.content.template,
            variables: {
              customerName: `Customer ${customerId}`,
              companyName: `Company ${customerId}`,
            },
            metadata: {
              campaignId: campaign.id,
              category: campaign.category,
            },
          }
        );

        campaign.metrics.sent++;
      } catch (error) {
        console.error(`Failed to send message to ${customerId}:`, error);
      }
    }
  }

  private getMockTargetCustomers(campaign: CommunicationCampaign): string[] {
    // Mock implementation - would fetch from target definition
    return ['cust_1', 'cust_2', 'cust_3', 'cust_4', 'cust_5'];
  }

  private async getCampaignMessages(campaignId: string): Promise<CommunicationMessage[]> {
    return Array.from(this.messages.values()).filter(
      m => m.metadata?.campaignId === campaignId
    );
  }

  private async sendSurveyInvitations(survey: Survey): Promise<void> {
    // Mock implementation - would send to target customers
    survey.metrics.invitations = 100;

    // Simulate some responses
    setTimeout(async () => {
      for (let i = 0; i < 25; i++) {
        await this.submitSurveyResponse(
          survey.id,
          `customer_${i}`,
          survey.questions.map(q => ({
            questionId: q.id,
            answer: this.getMockAnswer(q),
          })),
          {
            anonymous: false,
            email: `customer_${i}@example.com`,
          }
        );
      }
    }, 1000);
  }

  private getMockAnswer(question: any): any {
    switch (question.type) {
      case 'nps':
        return Math.floor(Math.random() * 11);
      case 'rating':
      case 'scale':
        return Math.floor(Math.random() * 5) + 1;
      case 'multiple_choice':
        return question.options?.[0]?.id || 'option_1';
      case 'checkbox':
        return [question.options?.[0]?.id, question.options?.[1]?.id];
      case 'text':
      case 'textarea':
        return 'Sample response text';
      default:
        return null;
    }
  }

  private calculateSurveyScore(survey: Survey, answers: Array<{ questionId: string; answer: any }>): number | undefined {
    if (survey.type === 'nps') {
      const npsAnswer = answers.find(a =>
        survey.questions.find(q => q.id === a.questionId && q.type === 'nps')
      );
      return npsAnswer?.answer as number;
    }

    if (survey.type === 'csat') {
      const csatAnswers = answers.filter(a =>
        survey.questions.find(q => q.id === a.questionId && q.type === 'rating')
      );
      if (csatAnswers.length > 0) {
        const avg = csatAnswers.reduce((sum, a) => sum + (a.answer as number), 0) / csatAnswers.length;
        return (avg / 5) * 100; // Convert to 0-100 scale
      }
    }

    return undefined;
  }

  private determineSentiment(survey: Survey, answers: Array<{ questionId: string; answer: any }>): 'positive' | 'neutral' | 'negative' {
    const score = this.calculateSurveyScore(survey, answers);

    if (survey.type === 'nps') {
      if (score >= 9) return 'positive';
      if (score >= 7) return 'neutral';
      return 'negative';
    }

    if (survey.type === 'csat') {
      if (score >= 80) return 'positive';
      if (score >= 60) return 'neutral';
      return 'negative';
    }

    return 'neutral';
  }

  private async updateSurveyMetrics(survey: Survey): Promise<void> {
    const responses = survey.responses;
    const completed = responses.filter(r => r.status === 'completed');

    survey.metrics.invitations = 100; // Mock
    survey.metrics.starts = responses.length;
    survey.metrics.completions = completed.length;
    survey.metrics.startRate = responses.length / survey.metrics.invitations;
    survey.metrics.completionRate = completed.length / responses.length;
    survey.metrics.abandonment = responses.length - completed.length;
    survey.metrics.averageDuration = completed.reduce((sum, r) => sum + (r.duration || 0), 0) / completed.length;

    // Calculate NPS metrics if applicable
    if (survey.type === 'nps') {
      const scores = completed.map(r => r.score || 0).filter(s => s !== undefined);
      const promoters = scores.filter(s => s >= 9).length;
      const passives = scores.filter(s => s >= 7 && s <= 8).length;
      const detractors = scores.filter(s => s <= 6).length;

      survey.metrics.nps = {
        score: scores.length > 0 ? ((promoters - detractors) / scores.length) * 100 : 0,
        promoters,
        passives,
        detractors,
        promoterPercentage: (promoters / scores.length) * 100,
        passivePercentage: (passives / scores.length) * 100,
        detractorPercentage: (detractors / scores.length) * 100,
        responseCount: scores.length,
      };
    }

    // Calculate CSAT metrics if applicable
    if (survey.type === 'csat') {
      const scores = completed.map(r => r.score || 0).filter(s => s !== undefined);
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

      survey.metrics.csat = {
        score: avgScore,
        averageRating: avgScore / 20, // Convert to 1-5 scale
        positiveResponses: scores.filter(s => s >= 80).length,
        neutralResponses: scores.filter(s => s >= 60 && s < 80).length,
        negativeResponses: scores.filter(s => s < 60).length,
        responseCount: scores.length,
      };
    }
  }

  private calculateQuestionAverage(question: any, responses: SurveyResponse[]): number {
    const answers = responses
      .map(r => r.answers.find(a => a.questionId === question.id)?.answer)
      .filter(a => typeof a === 'number');

    if (answers.length === 0) return 0;
    return answers.reduce((sum, a) => sum + a, 0) / answers.length;
  }

  private calculateQuestionDistribution(question: any, responses: SurveyResponse[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    if (question.options) {
      question.options.forEach((opt: any) => {
        distribution[opt.text] = 0;
      });

      responses.forEach(r => {
        const answer = r.answers.find(a => a.questionId === question.id)?.answer;
        if (Array.isArray(answer)) {
          answer.forEach(a => {
            const option = question.options.find((o: any) => o.id === a);
            if (option) {
              distribution[option.text]++;
            }
          });
        } else {
          const option = question.options.find((o: any) => o.id === answer);
          if (option) {
            distribution[option.text]++;
          }
        }
      });
    }

    return distribution;
  }

  private getTextResponses(question: any, responses: SurveyResponse[]): string[] {
    return responses
      .map(r => r.answers.find(a => a.questionId === question.id)?.answer)
      .filter(a => typeof a === 'string') as string[];
  }

  private generateId(): string {
    return `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
