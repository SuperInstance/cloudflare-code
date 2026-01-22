// @ts-nocheck
/**
 * Dialog Environments for RL
 */

import { Env, StepResult, Box, Discrete } from './base.js';

export interface DialogState {
  messages: Message[];
  context: string[];
  userIntent?: string;
  entities?: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Conversational AI Environment
 * Agent learns to engage in natural conversation
 */
export class ConversationalAIEnv extends Env<DialogState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private vocab: string[];
  private vocabSize: number;
  private maxContextLength: number;
  private conversationHistory: Message[] = [];
  private currentGoal: ConversationGoal | null = null;

  constructor(
    vocab: string[],
    options: {
      maxContextLength?: number;
      maxResponseLength?: number;
    } = {}
  ) {
    super();

    this.vocab = vocab;
    this.vocabSize = vocab.length;
    this.maxContextLength = options.maxContextLength ?? 512;

    this.observationSpace = new Box(0, vocabSize - 1, 'int32', [this.maxContextLength]);
    this.actionSpace = new Discrete(vocabSize);

    this._metadata = {
      'render.modes': ['human', 'ansi'],
    };
  }

  async reset(options?: Record<string, any>): Promise<DialogState> {
    this.conversationHistory = [];
    this.currentGoal = this.selectGoal();

    const initialState: DialogState = {
      messages: [],
      context: [],
      userIntent: this.currentGoal.intent,
    };

    if (this.currentGoal.initialMessage) {
      this.addMessage({
        role: 'user',
        content: this.currentGoal.initialMessage,
        timestamp: Date.now(),
      });
      initialState.messages = [...this.conversationHistory];
    }

    this._elapsedSteps = 0;

    return initialState;
  }

  async step(action: number): Promise<StepResult<DialogState>> {
    this._elapsedSteps++;

    // Generate response from action
    const response = this.generateResponse(action);

    // Add assistant message
    this.addMessage({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    // Calculate reward
    const reward = this.calculateReward();

    // Check if goal is achieved
    const { terminated, truncated } = this.checkTermination();

    // Generate user response if not done
    if (!terminated && !truncated) {
      const userResponse = this.generateUserResponse();
      this.addMessage({
        role: 'user',
        content: userResponse,
        timestamp: Date.now(),
      });
    }

    const newState: DialogState = {
      messages: [...this.conversationHistory],
      context: this.extractContext(),
      userIntent: this.currentGoal?.intent,
      entities: this.extractEntities(),
    };

    return {
      observation: newState,
      reward,
      terminated,
      truncated,
      info: {
        goal: this.currentGoal?.intent,
        achieved: this.isGoalAchieved(),
        conversationLength: this.conversationHistory.length,
      },
    };
  }

  private addMessage(message: Message): void {
    this.conversationHistory.push(message);
  }

  private selectGoal(): ConversationGoal {
    const goals: ConversationGoal[] = [
      {
        intent: 'greeting',
        initialMessage: 'Hello, how are you?',
        successCriteria: (msg) => msg.toLowerCase().includes('hello') || msg.toLowerCase().includes('hi'),
      },
      {
        intent: 'question',
        initialMessage: 'What is the capital of France?',
        successCriteria: (msg) => msg.toLowerCase().includes('paris'),
      },
      {
        intent: 'help',
        initialMessage: 'Can you help me with a problem?',
        successCriteria: (msg) =>
          msg.toLowerCase().includes('sure') ||
          msg.toLowerCase().includes('of course') ||
          msg.toLowerCase().includes('happy to help'),
      },
    ];

    return goals[Math.floor(Math.random() * goals.length)];
  }

  private generateResponse(action: number): string {
    // Map action to response (simplified)
    const responses = [
      'Hello!',
      'Hi there!',
      'I can help you with that.',
      'Sure!',
      'Of course.',
      'What would you like to know?',
      'I understand.',
      'Let me help you.',
    ];
    return responses[action % responses.length];
  }

  private generateUserResponse(): string {
    // Simulated user response
    const responses = [
      'That makes sense.',
      'Can you explain more?',
      'Thank you!',
      'What else?',
      'Interesting.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private calculateReward(): number {
    if (!this.currentGoal) return 0;

    const lastAssistantMessage = this.getLastAssistantMessage();
    if (!lastAssistantMessage) return 0;

    // Check if success criteria is met
    if (this.currentGoal.successCriteria(lastAssistantMessage.content)) {
      return 1.0;
    }

    // Partial reward for relevance
    let reward = 0;

    // Length penalty (prefer concise responses)
    const length = lastAssistantMessage.content.length;
    if (length > 10 && length < 100) {
      reward += 0.1;
    }

    // Coherence reward
    if (this.isCoherent(lastAssistantMessage.content)) {
      reward += 0.2;
    }

    // Engagement reward
    if (this.isEngaging(lastAssistantMessage.content)) {
      reward += 0.1;
    }

    return reward;
  }

  private getLastAssistantMessage(): Message | null {
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].role === 'assistant') {
        return this.conversationHistory[i];
      }
    }
    return null;
  }

  private isGoalAchieved(): boolean {
    if (!this.currentGoal) return false;

    const lastAssistantMessage = this.getLastAssistantMessage();
    if (!lastAssistantMessage) return false;

    return this.currentGoal.successCriteria(lastAssistantMessage.content);
  }

  private checkTermination(): { terminated: boolean; truncated: boolean } {
    const terminated = this.isGoalAchieved();
    const truncated = this._elapsedSteps >= 10;

    return { terminated, truncated };
  }

  private isCoherent(message: string): boolean {
    // Basic coherence check
    return message.length > 0 && message.split(/\s+/).length >= 2;
  }

  private isEngaging(message: string): boolean {
    // Check for engaging elements
    const engagingWords = ['?', '!', 'how', 'what', 'why', 'tell me', 'explain'];
    return engagingWords.some(word => message.toLowerCase().includes(word));
  }

  private extractContext(): string[] {
    return this.conversationHistory.slice(-5).map(m => m.content);
  }

  private extractEntities(): Record<string, any> {
    return {};
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    let output = `=== Conversation (Step ${this._elapsedSteps}) ===\n`;

    for (const message of this.conversationHistory) {
      const prefix = message.role === 'user' ? 'User' : 'Assistant';
      output += `${prefix}: ${message.content}\n`;
    }

    if (this.currentGoal) {
      output += `\nGoal: ${this.currentGoal.intent}\n`;
      output += `Achieved: ${this.isGoalAchieved()}\n`;
    }

    return output;
  }
}

export interface ConversationGoal {
  intent: string;
  initialMessage?: string;
  successCriteria: (response: string) => boolean;
}

/**
 * Question Answering Environment
 * Agent learns to answer questions accurately
 */
export class QuestionAnsweringEnv extends Env<QAState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private questions: QAInstance[];
  private currentQuestion: QAInstance | null = null;
  private vocabSize: number;

  constructor(questions: QAInstance[], vocabSize: number) {
    super();

    this.questions = questions;
    this.vocabSize = vocabSize;

    this.observationSpace = new Box(0, vocabSize - 1, 'int32', [512]);
    this.actionSpace = new Discrete(vocabSize);

    this._metadata = {
      'render.modes': ['human'],
    };
  }

  async reset(options?: Record<string, any>): Promise<QAState> {
    this.currentQuestion = this.questions[Math.floor(Math.random() * this.questions.length)];
    this._elapsedSteps = 0;

    return {
      question: this.currentQuestion.question,
      context: this.currentQuestion.context,
      answers: [],
      confidence: 0,
    };
  }

  async step(action: number): Promise<StepResult<QAState>> {
    if (!this.currentQuestion) {
      throw new Error('Environment not reset');
    }

    this._elapsedSteps++;

    const answer = this.generateAnswer(action);
    const { correct, confidence, reward } = this.evaluateAnswer(answer);

    const newState: QAState = {
      question: this.currentQuestion.question,
      context: this.currentQuestion.context,
      answers: [...(this.getCurrentState().answers ?? []), answer],
      confidence,
    };

    return {
      observation: newState,
      reward,
      terminated: correct,
      truncated: this._elapsedSteps >= 3,
      info: {
        answer,
        correct,
        confidence,
        expectedAnswer: this.currentQuestion.answer,
      },
    };
  }

  private getCurrentState(): QAState {
    return {
      question: this.currentQuestion?.question ?? '',
      context: this.currentQuestion?.context ?? '',
      answers: [],
      confidence: 0,
    };
  }

  private generateAnswer(action: number): string {
    // Generate answer based on action
    const answers = ['yes', 'no', 'maybe', 'unknown', '42', 'paris', 'javascript'];
    return answers[action % answers.length];
  }

  private evaluateAnswer(answer: string): { correct: boolean; confidence: number; reward: number } {
    if (!this.currentQuestion) {
      return { correct: false, confidence: 0, reward: 0 };
    }

    const correct = answer.toLowerCase() === this.currentQuestion.answer.toLowerCase();
    const confidence = correct ? 1.0 : Math.random() * 0.5;

    const reward = correct ? 1.0 : -0.1;

    return { correct, confidence, reward };
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    if (!this.currentQuestion) {
      return 'No active question';
    }

    const state = this.getCurrentState();

    return `
Q: ${state.question}
Context: ${state.context}
Answers: ${state.answers.join(', ')}
Expected: ${this.currentQuestion.answer}
`;
  }
}

export interface QAState {
  question: string;
  context: string;
  answers: string[];
  confidence: number;
}

export interface QAInstance {
  question: string;
  context: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Code Explanation Environment
 * Agent learns to explain code clearly
 */
export class CodeExplanationEnv extends Env<ExplanationState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private codeSnippets: CodeSnippetExplanation[];
  private currentSnippet: CodeSnippetExplanation | null = null;
  private vocabSize: number;

  constructor(snippets: CodeSnippetExplanation[], vocabSize: number) {
    super();

    this.codeSnippets = snippets;
    this.vocabSize = vocabSize;

    this.observationSpace = new Box(0, vocabSize - 1, 'int32', [512]);
    this.actionSpace = new Discrete(vocabSize);

    this._metadata = {
      'render.modes': ['human'],
    };
  }

  async reset(options?: Record<string, any>): Promise<ExplanationState> {
    this.currentSnippet = this.codeSnippets[Math.floor(Math.random() * this.codeSnippets.length)];
    this._elapsedSteps = 0;

    return {
      code: this.currentSnippet.code,
      explanation: '',
      clarity: 0,
      completeness: 0,
    };
  }

  async step(action: number): Promise<StepResult<ExplanationState>> {
    if (!this.currentSnippet) {
      throw new Error('Environment not reset');
    }

    this._elapsedSteps++;

    const explanation = this.generateExplanation(action);
    const { clarity, completeness, reward } = this.evaluateExplanation(explanation);

    const newState: ExplanationState = {
      code: this.currentSnippet.code,
      explanation,
      clarity,
      completeness,
    };

    return {
      observation: newState,
      reward,
      terminated: clarity > 0.8 && completeness > 0.8,
      truncated: this._elapsedSteps >= 5,
      info: {
        explanation,
        clarity,
        completeness,
      },
    };
  }

  private generateExplanation(action: number): string {
    // Generate explanation based on action
    const explanations = [
      'This function adds two numbers together.',
      'This code sorts an array in ascending order.',
      'This loop iterates through all elements.',
      'This condition checks if the value is valid.',
      'This variable stores the result.',
    ];
    return explanations[action % explanations.length];
  }

  private evaluateExplanation(explanation: string): {
    clarity: number;
    completeness: number;
    reward: number;
  } {
    if (!this.currentSnippet) {
      return { clarity: 0, completeness: 0, reward: 0 };
    }

    // Evaluate against reference explanation
    const reference = this.currentSnippet.explanation;

    // Calculate similarity (simplified)
    const clarity = this.calculateClarity(explanation);
    const completeness = this.calculateCompleteness(explanation, reference);

    const reward = clarity * 0.5 + completeness * 0.5;

    return { clarity, completeness, reward };
  }

  private calculateClarity(explanation: string): number {
    // Clarity metrics
    const words = explanation.split(/\s+/);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;

    let clarity = 0.5;

    // Prefer moderate word length
    if (avgWordLength >= 3 && avgWordLength <= 7) {
      clarity += 0.2;
    }

    // Check for clear structure
    if (explanation.includes('.')) {
      clarity += 0.1;
    }

    // Check for technical terms
    const technicalTerms = ['function', 'variable', 'loop', 'array', 'object'];
    if (technicalTerms.some(term => explanation.toLowerCase().includes(term))) {
      clarity += 0.2;
    }

    return Math.min(clarity, 1.0);
  }

  private calculateCompleteness(generated: string, reference: string): number {
    // Calculate keyword overlap
    const generatedWords = new Set(generated.toLowerCase().split(/\s+/));
    const referenceWords = new Set(reference.toLowerCase().split(/\s+/));

    let overlap = 0;
    for (const word of referenceWords) {
      if (generatedWords.has(word)) {
        overlap++;
      }
    }

    return referenceWords.size > 0 ? overlap / referenceWords.size : 0;
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    if (!this.currentSnippet) {
      return 'No active snippet';
    }

    return `
Code:
${this.currentSnippet.code}

Explanation: ${this.getCurrentState().explanation}

Reference: ${this.currentSnippet.explanation}
`;
  }

  private getCurrentState(): ExplanationState {
    return {
      code: this.currentSnippet?.code ?? '',
      explanation: '',
      clarity: 0,
      completeness: 0,
    };
  }
}

export interface ExplanationState {
  code: string;
  explanation: string;
  clarity: number;
  completeness: number;
}

export interface CodeSnippetExplanation {
  code: string;
  explanation: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Technical Support Environment
 * Agent learns to provide technical support
 */
export class TechnicalSupportEnv extends Env<SupportState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private tickets: SupportTicket[];
  private currentTicket: SupportTicket | null = null;
  private vocabSize: number;
  private resolutionSteps: string[] = [];

  constructor(tickets: SupportTicket[], vocabSize: number) {
    super();

    this.tickets = tickets;
    this.vocabSize = vocabSize;

    this.observationSpace = new Box(0, vocabSize - 1, 'int32', [512]);
    this.actionSpace = new Discrete(vocabSize);

    this._metadata = {
      'render.modes': ['human'],
    };
  }

  async reset(options?: Record<string, any>): Promise<SupportState> {
    this.currentTicket = this.tickets[Math.floor(Math.random() * this.tickets.length)];
    this.resolutionSteps = [];
    this._elapsedSteps = 0;

    return {
      issue: this.currentTicket.issue,
      category: this.currentTicket.category,
      severity: this.currentTicket.severity,
      steps: [],
      resolved: false,
      userSatisfaction: 0,
    };
  }

  async step(action: number): Promise<StepResult<SupportState>> {
    if (!this.currentTicket) {
      throw new Error('Environment not reset');
    }

    this._elapsedSteps++;

    const step = this.generateStep(action);
    this.resolutionSteps.push(step);

    const { resolved, satisfaction, reward } = this.evaluateResolution();

    const newState: SupportState = {
      issue: this.currentTicket.issue,
      category: this.currentTicket.category,
      severity: this.currentTicket.severity,
      steps: [...this.resolutionSteps],
      resolved,
      userSatisfaction: satisfaction,
    };

    return {
      observation: newState,
      reward,
      terminated: resolved,
      truncated: this._elapsedSteps >= 10,
      info: {
        step,
        resolved,
        satisfaction,
        expectedResolution: this.currentTicket.resolution,
      },
    };
  }

  private generateStep(action: number): string {
    // Generate resolution step
    const steps = [
      'Check your internet connection.',
      'Restart the application.',
      'Clear your cache.',
      'Update to the latest version.',
      'Check the logs for errors.',
      'Contact support with error details.',
      'Try reinstalling the software.',
      'Check system requirements.',
    ];
    return steps[action % steps.length];
  }

  private evaluateResolution(): {
    resolved: boolean;
    satisfaction: number;
    reward: number;
  } {
    if (!this.currentTicket) {
      return { resolved: false, satisfaction: 0, reward: 0 };
    }

    // Check if resolution matches expected
    const expectedKeywords = this.currentTicket.resolution.toLowerCase().split(/\s+/);
    const generatedKeywords = this.resolutionSteps.join(' ').toLowerCase().split(/\s+/);

    let matchCount = 0;
    for (const expected of expectedKeywords) {
      if (generatedKeywords.some(g => g.includes(expected) || expected.includes(g))) {
        matchCount++;
      }
    }

    const similarity = expectedKeywords.length > 0 ? matchCount / expectedKeywords.length : 0;

    const resolved = similarity > 0.7;
    const satisfaction = resolved ? 0.8 + Math.random() * 0.2 : similarity * 0.5;

    const reward = resolved ? 1.0 : satisfaction * 0.3 - 0.01 * this.resolutionSteps.length;

    return { resolved, satisfaction, reward };
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    if (!this.currentTicket) {
      return 'No active ticket';
    }

    return `
Issue: ${this.currentTicket.issue}
Category: ${this.currentTicket.category}
Severity: ${this.currentTicket.severity}

Steps Taken:
${this.resolutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Resolution: ${this.getCurrentState().resolved ? 'YES' : 'NO'}
Satisfaction: ${this.getCurrentState().userSatisfaction.toFixed(2)}
`;
  }

  private getCurrentState(): SupportState {
    return {
      issue: this.currentTicket?.issue ?? '',
      category: this.currentTicket?.category ?? '',
      severity: this.currentTicket?.severity ?? 'low',
      steps: this.resolutionSteps,
      resolved: false,
      userSatisfaction: 0,
    };
  }
}

export interface SupportState {
  issue: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  steps: string[];
  resolved: boolean;
  userSatisfaction: number;
}

export interface SupportTicket {
  issue: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution: string;
  satisfactionScore: number;
}
