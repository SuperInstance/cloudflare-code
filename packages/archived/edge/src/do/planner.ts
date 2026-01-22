/**
 * Planner Agent Durable Object
 *
 * Specialized agents for different expertise areas:
 * - Code: Code generation, refactoring, optimization
 * - Documentation: Documentation generation, explanation
 * - Debugging: Bug identification, fix suggestions
 * - Architecture: System design, pattern recommendations
 */

import type {
  ChatRequest,
  Plan,
  PlanStep,
  Complexity,
  TokenEstimate,
  ModelSelection,
  PlannerExpertise,
} from '../lib/agents/types';

export interface Env {
  PLANNER_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
}

/**
 * Planner Agent State
 */
interface PlannerState {
  expertise: PlannerExpertise;
  plansGenerated: number;
  totalComplexityScore: number;
  averageComplexity: number;
  lastActivity: number;
  load: number; // 0-1 scale
}

/**
 * Planner Agent - Specialized planning for specific expertise
 *
 * Features:
 * - Complexity analysis
 * - Token estimation
 * - Model selection
 * - Plan generation
 * - Load tracking
 */
export class PlannerAgent implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private storage: DurableObjectStorage;
  private expertise: PlannerExpertise;
  private plannerState: PlannerState;

  constructor(state: DurableObjectState, env: Env, expertise: PlannerExpertise) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
    this.expertise = expertise;

    // Initialize state
    this.plannerState = {
      expertise,
      plansGenerated: 0,
      totalComplexityScore: 0,
      averageComplexity: 0,
      lastActivity: Date.now(),
      load: 0,
    };

    // Load from storage
    this.initializeFromStorage();
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/plan') {
        return this.handlePlan(request);
      }

      if (method === 'GET' && path === '/state') {
        return this.handleGetState();
      }

      if (method === 'GET' && path === '/expertise') {
        return this.handleGetExpertise();
      }

      if (method === 'GET' && path === '/load') {
        return this.handleGetLoad();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle plan generation request
   */
  private async handlePlan(request: Request): Promise<Response> {
    const startTime = performance.now();

    // Increment load
    this.plannerState.load = Math.min(1, this.plannerState.load + 0.1);

    try {
      const body = (await request.json()) as {
        requestId: string;
        expertise: PlannerExpertise;
        chatRequest: ChatRequest;
        directorId: string;
      };

      // Validate expertise matches
      if (body.expertise !== this.expertise) {
        return new Response(
          JSON.stringify({ error: 'Expertise mismatch' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generate plan
      const plan = await this.plan(body.chatRequest);

      // Update state
      this.plannerState.plansGenerated++;
      this.plannerState.lastActivity = Date.now();

      await this.persistState();

      const latency = performance.now() - startTime;

      return new Response(
        JSON.stringify({
          plan,
          expertise: this.expertise,
          latency,
          plannerId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      // Decrement load
      this.plannerState.load = Math.max(0, this.plannerState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle get state request
   */
  private async handleGetState(): Promise<Response> {
    return new Response(
      JSON.stringify(this.plannerState),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get expertise request
   */
  private async handleGetExpertise(): Promise<Response> {
    return new Response(
      JSON.stringify({ expertise: this.expertise }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get load request
   */
  private async handleGetLoad(): Promise<Response> {
    return new Response(
      JSON.stringify({ load: this.plannerState.load }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Main plan generation logic
   */
  async plan(request: ChatRequest): Promise<Plan> {
    const planId = crypto.randomUUID();

    // Step 1: Analyze complexity
    const complexity = await this.analyzeComplexity(request);

    // Step 2: Estimate tokens
    const tokenEstimate = await this.estimateTokens(request, complexity);

    // Step 3: Select model
    const modelSelection = await this.selectModel(complexity, tokenEstimate);

    // Step 4: Generate plan steps
    const steps = await this.generateSteps(request, complexity);

    // Step 5: Calculate priority and confidence
    const priority = this.calculatePriority(complexity, this.expertise);
    const confidence = this.calculateConfidence(complexity, this.expertise, request);

    const plan: Plan = {
      id: planId,
      plannerId: this.state.id.toString(),
      expertise: this.expertise,
      steps,
      estimatedTokens: tokenEstimate.total,
      selectedModel: modelSelection.model,
      provider: modelSelection.provider,
      priority,
      confidence,
      createdAt: Date.now(),
    };

    return plan;
  }

  /**
   * Analyze request complexity
   */
  private async analyzeComplexity(request: ChatRequest): Promise<Complexity> {
    const messages = request.messages;
    const lastMessage = messages[messages.length - 1];

    // Calculate code complexity
    let codeComplexity = 0;
    if (lastMessage?.content) {
      // Count code blocks
      const codeBlocks = (lastMessage.content.match(/```/g) || []).length / 2;
      codeComplexity = Math.min(1, codeBlocks / 5); // Max out at 5 code blocks

      // Check for code-related keywords
      const codeKeywords = [
        'function', 'class', 'import', 'export', 'async', 'await',
        'interface', 'type', 'implement', 'refactor', 'debug'
      ];
      const keywordCount = codeKeywords.filter(keyword =>
        lastMessage.content.toLowerCase().includes(keyword)
      ).length;
      codeComplexity = Math.min(1, codeComplexity + keywordCount * 0.1);
    }

    // Calculate context length
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const contextLength = Math.min(1, totalLength / 10000); // Normalize against 10K chars

    // Check for multi-file references
    const multiFile = messages.some(msg =>
      msg.content.includes('./') ||
      msg.content.includes('src/') ||
      msg.content.includes('file:')
    );

    // Check if research is needed
    const requiresResearch = messages.some(msg =>
      msg.content.toLowerCase().includes('research') ||
      msg.content.toLowerCase().includes('find') ||
      msg.content.toLowerCase().includes('look up')
    );

    // Calculate overall score
    const score = (codeComplexity * 0.4 + contextLength * 0.3) +
                  (multiFile ? 0.2 : 0) +
                  (requiresResearch ? 0.1 : 0);

    // Determine level
    let level: 'low' | 'medium' | 'high';
    if (score < 0.3) level = 'low';
    else if (score < 0.7) level = 'medium';
    else level = 'high';

    return {
      level,
      score,
      factors: {
        codeComplexity,
        contextLength,
        multiFile,
        requiresResearch,
      },
    };
  }

  /**
   * Estimate token requirements
   */
  private async estimateTokens(
    request: ChatRequest,
    complexity: Complexity
  ): Promise<TokenEstimate> {
    const baseTokensPerChar = 0.25; // Rough estimate: 1 token per 4 chars
    const totalChars = request.messages.reduce((sum, msg) => sum + msg.content.length, 0);

    // Adjust based on complexity
    const complexityMultiplier = 1 + complexity.score * 0.5;

    const input = Math.floor(totalChars * baseTokensPerChar * complexityMultiplier);

    // Estimate output based on input and expertise
    let outputRatio = 0.5; // Default: output is 50% of input

    switch (this.expertise) {
      case 'code':
        outputRatio = 1.2; // Code generation often produces more
        break;
      case 'documentation':
        outputRatio = 1.5; // Documentation is verbose
        break;
      case 'debugging':
        outputRatio = 0.8; // Debugging explanations are concise
        break;
      case 'architecture':
        outputRatio = 1.0; // Architecture is balanced
        break;
    }

    const output = Math.floor(input * outputRatio);
    const total = input + output;

    // Confidence based on message length
    const confidence = Math.min(1, totalChars / 1000);

    return {
      input,
      output,
      total,
      confidence,
    };
  }

  /**
   * Select appropriate model based on complexity and tokens
   */
  private async selectModel(
    complexity: Complexity,
    tokens: TokenEstimate
  ): Promise<ModelSelection> {
    // Model selection logic
    let model: string;
    let provider: string;
    let reason: string;
    let estimatedCost: number;
    let estimatedLatency: number;

    if (complexity.level === 'low' && tokens.total < 2000) {
      // Fast, cheap model for simple tasks
      model = 'llama-3.1-8b';
      provider = 'groq';
      reason = 'Low complexity task with small token count';
      estimatedCost = 0.0001; // ~$0.10 per 1M tokens
      estimatedLatency = 500; // ~500ms
    } else if (complexity.level === 'medium' || tokens.total < 8000) {
      // Balanced model for medium tasks
      model = 'llama-3.1-70b';
      provider = 'groq';
      reason = 'Medium complexity task with moderate token count';
      estimatedCost = 0.0007; // ~$0.70 per 1M tokens
      estimatedLatency = 1500; // ~1.5s
    } else {
      // High-end model for complex tasks
      model = 'claude-3-5-sonnet';
      provider = 'anthropic';
      reason = 'High complexity task with large token count';
      estimatedCost = 0.003; // ~$3 per 1M tokens
      estimatedLatency = 3000; // ~3s
    }

    return {
      model,
      provider,
      reason,
      estimatedCost,
      estimatedLatency,
    };
  }

  /**
   * Generate plan steps based on expertise and request
   */
  private async generateSteps(
    request: ChatRequest,
    complexity: Complexity
  ): Promise<PlanStep[]> {
    const steps: PlanStep[] = [];
    const lastMessage = request.messages[request.messages.length - 1];

    switch (this.expertise) {
      case 'code':
        steps.push(
          {
            id: crypto.randomUUID(),
            type: 'analyze',
            description: 'Analyze code requirements and context',
            input: { message: lastMessage.content },
            estimatedTokens: Math.floor(complexity.score * 500),
            dependencies: [],
          },
          {
            id: crypto.randomUUID(),
            type: 'generate',
            description: 'Generate code solution',
            input: { message: lastMessage.content },
            estimatedTokens: Math.floor(complexity.score * 2000),
            dependencies: [steps[0].id],
          },
          {
            id: crypto.randomUUID(),
            type: 'validate',
            description: 'Validate generated code',
            input: {},
            estimatedTokens: Math.floor(complexity.score * 300),
            dependencies: [steps[1].id],
          }
        );
        break;

      case 'documentation':
        steps.push(
          {
            id: crypto.randomUUID(),
            type: 'analyze',
            description: 'Analyze documentation requirements',
            input: { message: lastMessage.content },
            estimatedTokens: Math.floor(complexity.score * 400),
            dependencies: [],
          },
          {
            id: crypto.randomUUID(),
            type: 'generate',
            description: 'Generate documentation',
            input: { message: lastMessage.content },
            estimatedTokens: Math.floor(complexity.score * 1500),
            dependencies: [steps[0].id],
          }
        );
        break;

      case 'debugging':
        steps.push(
          {
            id: crypto.randomUUID(),
            type: 'analyze',
            description: 'Analyze bug and identify root cause',
            input: { message: lastMessage.content },
            estimatedTokens: Math.floor(complexity.score * 600),
            dependencies: [],
          },
          {
            id: crypto.randomUUID(),
            type: 'retrieve',
            description: 'Retrieve relevant code context',
            input: {},
            estimatedTokens: Math.floor(complexity.score * 400),
            dependencies: [steps[0].id],
          },
          {
            id: crypto.randomUUID(),
            type: 'generate',
            description: 'Generate fix suggestions',
            input: {},
            estimatedTokens: Math.floor(complexity.score * 800),
            dependencies: [steps[1].id],
          }
        );
        break;

      case 'architecture':
        steps.push(
          {
            id: crypto.randomUUID(),
            type: 'analyze',
            description: 'Analyze architectural requirements',
            input: { message: lastMessage.content },
            estimatedTokens: Math.floor(complexity.score * 500),
            dependencies: [],
          },
          {
            id: crypto.randomUUID(),
            type: 'retrieve',
            description: 'Retrieve architectural patterns',
            input: {},
            estimatedTokens: Math.floor(complexity.score * 300),
            dependencies: [steps[0].id],
          },
          {
            id: crypto.randomUUID(),
            type: 'generate',
            description: 'Generate architectural design',
            input: {},
            estimatedTokens: Math.floor(complexity.score * 2000),
            dependencies: [steps[1].id],
          }
        );
        break;
    }

    return steps;
  }

  /**
   * Calculate plan priority based on complexity and expertise match
   */
  private calculatePriority(complexity: Complexity, expertise: PlannerExpertise): number {
    let basePriority = 0.5;

    // Adjust based on complexity
    switch (complexity.level) {
      case 'low':
        basePriority = 0.3;
        break;
      case 'medium':
        basePriority = 0.6;
        break;
      case 'high':
        basePriority = 0.9;
        break;
    }

    // Adjust based on expertise (higher is better)
    const expertiseWeights: Record<PlannerExpertise, number> = {
      code: 1.0,
      architecture: 0.9,
      debugging: 0.8,
      documentation: 0.7,
    };

    return Math.min(1, basePriority * expertiseWeights[expertise]);
  }

  /**
   * Calculate confidence based on complexity, expertise, and request
   */
  private calculateConfidence(
    complexity: Complexity,
    expertise: PlannerExpertise,
    request: ChatRequest
  ): number {
    let confidence = 0.5;

    // Higher complexity = lower confidence (more uncertainty)
    confidence -= complexity.score * 0.2;

    // Boost confidence based on expertise match
    const lastMessage = request.messages[request.messages.length - 1];
    const content = lastMessage?.content.toLowerCase() || '';

    switch (expertise) {
      case 'code':
        if (content.includes('code') || content.includes('function') || content.includes('class')) {
          confidence += 0.3;
        }
        break;
      case 'documentation':
        if (content.includes('document') || content.includes('explain') || content.includes('readme')) {
          confidence += 0.3;
        }
        break;
      case 'debugging':
        if (content.includes('bug') || content.includes('error') || content.includes('fix')) {
          confidence += 0.3;
        }
        break;
      case 'architecture':
        if (content.includes('design') || content.includes('architecture') || content.includes('pattern')) {
          confidence += 0.3;
        }
        break;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Initialize state from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<PlannerState>('plannerState');

      if (stored) {
        this.plannerState = stored;
      }
    } catch (error) {
      console.error('Failed to load state from storage:', error);
    }
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('plannerState', this.plannerState);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    // Decay load over time
    this.plannerState.load = Math.max(0, this.plannerState.load * 0.9);

    await this.persistState();
  }
}

/**
 * Helper function to create Planner Agent stub
 */
export function createPlannerStub(env: Env, expertise: PlannerExpertise, sessionId: string): DurableObjectStub {
  const plannerId = `planner-${expertise}-${sessionId}`;
  return env.PLANNER_DO.get(env.PLANNER_DO.idFromName(plannerId));
}
