/**
 * ReAct (Reasoning + Acting) Agent Implementation
 *
 * Implements the ReAct paradigm combining reasoning traces with
 * dynamic tool selection and execution for complex problem solving.
 */

import type {
  ReActConfig,
  ReActStep,
  ReActResult,
  ToolCall,
  Tool,
  ReasoningError,
} from '../types';

// ============================================================================
// ReAct Core Engine
// ============================================================================

export class ReActEngine {
  private config: Required<ReActConfig>;
  private tools: Map<string, Tool>;
  private steps: ReActStep[] = [];
  private toolCalls: ToolCall[] = [];

  constructor(config: ReActConfig = {}, tools: Tool[] = []) {
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      toolTimeout: config.toolTimeout ?? 30000,
      verbose: config.verbose ?? false,
      allowRepeatedActions: config.allowRepeatedActions ?? false,
      maxToolErrors: config.maxToolErrors ?? 3,
      thoughtPrompt:
        config.thoughtPrompt ?? 'Thought: I should analyze the current state and determine the best next action.',
      actionPrompt:
        config.actionPrompt ?? 'Action: I will use the following tool:',
    };
    this.tools = new Map();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * Execute ReAct loop
   */
  async execute(
    task: string,
    context?: Record<string, unknown>
  ): Promise<ReActResult> {
    const startTime = Date.now();
    this.steps = [];
    this.toolCalls = [];
    let errorCount = 0;
    const actionHistory: string[] = [];

    try {
      let currentObservation: unknown = undefined;

      for (let i = 0; i < this.config.maxIterations; i++) {
        // Generate thought
        const thought = await this.generateThought(
          task,
          currentObservation,
          context
        );

        const step: ReActStep = {
          thought,
          action: '',
          actionInput: {},
          timestamp: Date.now(),
        };

        // Determine if we should conclude
        if (this.shouldConclude(thought)) {
          step.action = 'finish';
          step.actionInput = { answer: this.extractFinalAnswer(thought) };
          this.steps.push(step);

          if (this.config.verbose) {
            console.log(`\n[ReAct] Concluding at iteration ${i + 1}`);
          }

          break;
        }

        // Select action/tool
        const actionSelection = await this.selectAction(
          thought,
          currentObservation
        );

        step.action = actionSelection.tool;
        step.actionInput = actionSelection.input;

        // Check for repeated actions
        if (
          !this.config.allowRepeatedActions &&
          actionHistory.includes(actionSelection.tool)
        ) {
          if (this.config.verbose) {
            console.log(
              `[ReAct] Skipping repeated action: ${actionSelection.tool}`
            );
          }
          continue;
        }

        actionHistory.push(actionSelection.tool);

        // Execute action
        try {
          const toolResult = await this.executeAction(
            actionSelection.tool,
            actionSelection.input
          );

          step.observation = toolResult;
          currentObservation = toolResult;

          if (this.config.verbose) {
            console.log(
              `[ReAct] Executed ${actionSelection.tool}:`,
              toolResult
            );
          }
        } catch (error) {
          step.error = error instanceof Error ? error.message : String(error);
          errorCount++;

          if (this.config.verbose) {
            console.error(
              `[ReAct] Error executing ${actionSelection.tool}:`,
              error
            );
          }

          if (errorCount >= this.config.maxToolErrors) {
            throw new Error(
              `Maximum tool errors (${this.config.maxToolErrors}) reached`
            );
          }
        }

        this.steps.push(step);

        // Check if task is complete
        if (this.isTaskComplete(currentObservation)) {
          if (this.config.verbose) {
            console.log(`\n[ReAct] Task completed at iteration ${i + 1}`);
          }
          break;
        }
      }

      // Generate final answer
      const finalAnswer = this.generateFinalAnswer();

      const executionTime = Date.now() - startTime;

      return {
        finalAnswer,
        steps: this.steps,
        toolCalls: this.toolCalls,
        metadata: {
          totalSteps: this.steps.length,
          totalToolCalls: this.toolCalls.length,
          executionTime,
          errors: errorCount,
        },
      };
    } catch (error) {
      throw this.createError(
        'ReAct execution failed',
        'REACT_EXECUTION_FAILED',
        { task, error }
      );
    }
  }

  /**
   * Generate thought for current step
   */
  private async generateThought(
    task: string,
    observation: unknown,
    context?: Record<string, unknown>
  ): Promise<string> {
    // Build prompt with task and observation
    let prompt = `Task: ${task}\n\n`;

    if (this.steps.length > 0) {
      prompt += 'Previous steps:\n';
      for (const step of this.steps.slice(-3)) {
        prompt += `  Thought: ${step.thought}\n`;
        if (step.action) {
          prompt += `  Action: ${step.action}\n`;
        }
        if (step.observation) {
          prompt += `  Observation: ${JSON.stringify(step.observation)}\n`;
        }
      }
      prompt += '\n';
    }

    if (observation) {
      prompt += `Current observation: ${JSON.stringify(observation)}\n\n`;
    }

    prompt += this.config.thoughtPrompt;

    // In a real implementation, this would call an LLM
    // For now, we simulate thought generation
    return await this.simulateThoughtGeneration(prompt, context);
  }

  /**
   * Simulate thought generation (placeholder for actual LLM call)
   */
  private async simulateThoughtGeneration(
    prompt: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    const stepNumber = this.steps.length + 1;
    let thought = `Step ${stepNumber}: Analyzing the situation`;

    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      if (lastStep.observation) {
        thought += ` based on previous observation: ${JSON.stringify(lastStep.observation).substring(0, 100)}`;
      }
    }

    return thought;
  }

  /**
   * Select action/tool based on thought
   */
  private async selectAction(
    thought: string,
    observation: unknown
  ): Promise<{ tool: string; input: Record<string, unknown> }> {
    // Analyze thought to determine best tool
    const availableTools = Array.from(this.tools.keys());

    if (availableTools.length === 0) {
      throw new Error('No tools available');
    }

    // Simple keyword-based tool selection
    // In production, this would use LLM-based tool selection
    const lowerThought = thought.toLowerCase();

    for (const toolName of availableTools) {
      const tool = this.tools.get(toolName)!;
      const keywords = tool.description.split(/\s+/).map((k) => k.toLowerCase());

      for (const keyword of keywords) {
        if (lowerThought.includes(keyword) && keyword.length > 3) {
          return {
            tool: toolName,
            input: this.buildToolInput(tool, thought, observation),
          };
        }
      }
    }

    // Default to first available tool
    const defaultTool = availableTools[0];
    const tool = this.tools.get(defaultTool)!;

    return {
      tool: defaultTool,
      input: this.buildToolInput(tool, thought, observation),
    };
  }

  /**
   * Build input parameters for a tool
   */
  private buildToolInput(
    tool: Tool,
    thought: string,
    observation: unknown
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    // Extract parameters based on tool schema
    for (const [paramName, paramSchema] of Object.entries(tool.parameters)) {
      if (typeof paramSchema === 'object' && paramSchema !== null) {
        const schema = paramSchema as { type?: string; description?: string };

        // Try to extract value from thought
        const value = this.extractParameterValue(
          paramName,
          schema,
          thought,
          observation
        );

        if (value !== undefined) {
          input[paramName] = value;
        } else if ('default' in schema) {
          input[paramName] = (schema as { default: unknown }).default;
        }
      }
    }

    return input;
  }

  /**
   * Extract parameter value from thought or observation
   */
  private extractParameterValue(
    paramName: string,
    schema: { type?: string; description?: string },
    thought: string,
    observation: unknown
  ): unknown {
    // Try to find parameter in thought
    const patterns = [
      new RegExp(`${paramName}\\s*=\\s*([^\\s]+)`, 'i'),
      new RegExp(`${paramName}\\s*:\\s*([^\\s]+)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = thought.match(pattern);
      if (match && match[1]) {
        return this.convertType(match[1], schema.type);
      }
    }

    // Try to extract from observation
    if (
      observation &&
      typeof observation === 'object' &&
      paramName in observation
    ) {
      return (observation as Record<string, unknown>)[paramName];
    }

    return undefined;
  }

  /**
   * Convert string value to specified type
   */
  private convertType(value: string, type?: string): unknown {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'array':
        return value.split(',').map((s) => s.trim());
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return { value };
        }
      default:
        return value;
    }
  }

  /**
   * Execute action with timeout
   */
  private async executeAction(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const timeout = tool.timeout ?? this.config.toolTimeout;

    const startTime = Date.now();
    let success = true;
    let result: unknown;

    try {
      // Execute with timeout
      result = await Promise.race([
        tool.execute(input),
        this.createTimeoutPromise(timeout),
      ]);
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - startTime;

      this.toolCalls.push({
        tool: toolName,
        input,
        output: success ? result : undefined,
        duration,
        success,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Check if we should conclude
   */
  private shouldConclude(thought: string): boolean {
    const conclusionMarkers = [
      'done',
      'complete',
      'finished',
      'solved',
      'answer:',
      'final answer:',
      'conclusion:',
    ];

    const lowerThought = thought.toLowerCase();
    return conclusionMarkers.some((marker) => lowerThought.includes(marker));
  }

  /**
   * Extract final answer from thought
   */
  private extractFinalAnswer(thought: string): string {
    const patterns = [
      /answer:\s*(.+)$/i,
      /final answer:\s*(.+)$/i,
      /conclusion:\s*(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = thought.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return thought;
  }

  /**
   * Check if task is complete
   */
  private isTaskComplete(observation: unknown): boolean {
    if (!observation) {
      return false;
    }

    if (typeof observation === 'object') {
      const obs = observation as Record<string, unknown>;
      return (
        obs.complete === true ||
        obs.done === true ||
        obs.finished === true ||
        obs.status === 'complete' ||
        obs.status === 'done'
      );
    }

    return false;
  }

  /**
   * Generate final answer from all steps
   */
  private generateFinalAnswer(): string {
    // Try to get answer from last step
    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];

      if (lastStep.action === 'finish') {
        return String(lastStep.actionInput.answer ?? lastStep.thought);
      }

      if (lastStep.observation) {
        return JSON.stringify(lastStep.observation);
      }
    }

    // Synthesize answer from observations
    const observations = this.steps
      .filter((s) => s.observation)
      .map((s) => s.observation);

    if (observations.length > 0) {
      return `Completed ${observations.length} actions. Final result: ${JSON.stringify(observations[observations.length - 1])}`;
    }

    return 'Task execution complete';
  }

  /**
   * Create error with proper type
   */
  private createError(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): ReasoningError {
    const error = new Error(message) as ReasoningError;
    error.name = 'ReasoningError';
    error.code = code;
    error.details = details;
    return error;
  }
}

// ============================================================================
// Tool Registry and Built-in Tools
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Built-in calculator tool
 */
export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  parameters: {
    expression: {
      type: 'string',
      description: 'Mathematical expression to evaluate',
    },
  },
  async execute(params: Record<string, unknown>): Promise<unknown> {
    const expression = params.expression as string;

    try {
      // Safe evaluation of mathematical expressions
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      return { result, expression };
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error}`);
    }
  },
};

/**
 * Built-in search tool
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Search for information',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results',
      default: 10,
    },
  },
  async execute(params: Record<string, unknown>): Promise<unknown> {
    // Placeholder for actual search implementation
    return {
      results: [],
      query: params.query,
      message: 'Search tool is a placeholder - implement actual search',
    };
  },
};

/**
 * Built-in data store tool
 */
export const dataStoreTool: Tool = {
  name: 'data_store',
  description: 'Store and retrieve data',
  parameters: {
    action: {
      type: 'string',
      description: 'Action to perform: get, set, delete',
    },
    key: {
      type: 'string',
      description: 'Data key',
    },
    value: {
      type: 'any',
      description: 'Data value (for set action)',
    },
  },
  execute: async (params: Record<string, unknown>): Promise<unknown> => {
    const action = params.action as string;
    const key = params.key as string;
    const store = new Map<string, unknown>();

    switch (action) {
      case 'get':
        return { key, value: store.get(key) };
      case 'set':
        store.set(key, params.value);
        return { key, value: params.value, stored: true };
      case 'delete':
        const deleted = store.delete(key);
        return { key, deleted };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};

/**
 * Built-in HTTP request tool
 */
export const httpTool: Tool = {
  name: 'http',
  description: 'Make HTTP requests',
  parameters: {
    url: {
      type: 'string',
      description: 'URL to request',
    },
    method: {
      type: 'string',
      description: 'HTTP method',
      default: 'GET',
    },
    headers: {
      type: 'object',
      description: 'Request headers',
    },
    body: {
      type: 'any',
      description: 'Request body',
    },
  },
  async execute(params: Record<string, unknown>): Promise<unknown> {
    const url = params.url as string;
    const method = (params.method as string) ?? 'GET';
    const headers = params.headers as Record<string, string> ?? {};
    const body = params.body;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json().catch(() => response.text());

      return {
        url,
        method,
        status: response.status,
        data,
      };
    } catch (error) {
      throw new Error(`HTTP request failed: ${error}`);
    }
  },
};

/**
 * Built-in file operations tool
 */
export const fileTool: Tool = {
  name: 'file',
  description: 'Read and write files',
  parameters: {
    action: {
      type: 'string',
      description: 'Action to perform: read, write, list',
    },
    path: {
      type: 'string',
      description: 'File path',
    },
    content: {
      type: 'string',
      description: 'Content to write',
    },
  },
  async execute(params: Record<string, unknown>): Promise<unknown> {
    const action = params.action as string;
    const path = params.path as string;

    switch (action) {
      case 'read':
        // Placeholder for file reading
        return { path, content: 'File content placeholder' };
      case 'write':
        // Placeholder for file writing
        return { path, written: true, content: params.content };
      case 'list':
        // Placeholder for directory listing
        return { path, files: [] };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};

// ============================================================================
// ReAct Reasoning Tracer
// ============================================================================

export class ReActTracer {
  private traces: Map<string, ReActStep[]> = new Map();

  /**
   * Record a ReAct step
   */
  recordStep(executionId: string, step: ReActStep): void {
    if (!this.traces.has(executionId)) {
      this.traces.set(executionId, []);
    }
    this.traces.get(executionId)!.push(step);
  }

  /**
   * Get trace for execution
   */
  getTrace(executionId: string): ReActStep[] {
    return this.traces.get(executionId) ?? [];
  }

  /**
   * Get all traces
   */
  getAllTraces(): Map<string, ReActStep[]> {
    return new Map(this.traces);
  }

  /**
   * Clear trace for execution
   */
  clearTrace(executionId: string): void {
    this.traces.delete(executionId);
  }

  /**
   * Clear all traces
   */
  clearAll(): void {
    this.traces.clear();
  }

  /**
   * Export trace as JSON
   */
  exportAsJSON(executionId: string): string {
    const steps = this.getTrace(executionId);
    return JSON.stringify(steps, null, 2);
  }

  /**
   * Export trace as formatted text
   */
  exportAsText(executionId: string): string {
    const steps = this.getTrace(executionId);

    return steps
      .map((step, i) => {
        let output = `Step ${i + 1}:\n`;
        output += `  Thought: ${step.thought}\n`;
        output += `  Action: ${step.action}\n`;
        if (Object.keys(step.actionInput).length > 0) {
          output += `  Input: ${JSON.stringify(step.actionInput)}\n`;
        }
        if (step.observation) {
          output += `  Observation: ${JSON.stringify(step.observation)}\n`;
        }
        if (step.error) {
          output += `  Error: ${step.error}\n`;
        }
        return output;
      })
      .join('\n');
  }

  /**
   * Analyze trace patterns
   */
  analyzePatterns(executionId: string): {
    totalSteps: number;
    actionsUsed: string[];
    errorRate: number;
    averageStepDuration: number;
  } {
    const steps = this.getTrace(executionId);

    const actionsUsed = steps
      .map((s) => s.action)
      .filter((a) => a && a !== 'finish');

    const errorCount = steps.filter((s) => s.error).length;

    const durations: number[] = [];
    for (let i = 1; i < steps.length; i++) {
      durations.push(steps[i].timestamp - steps[i - 1].timestamp);
    }

    const averageStepDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    return {
      totalSteps: steps.length,
      actionsUsed: Array.from(new Set(actionsUsed)),
      errorRate: steps.length > 0 ? errorCount / steps.length : 0,
      averageStepDuration,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate ReAct configuration
 */
export function validateReActConfig(
  config: ReActConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxIterations !== undefined && config.maxIterations < 1) {
    errors.push('maxIterations must be at least 1');
  }

  if (config.toolTimeout !== undefined && config.toolTimeout < 0) {
    errors.push('toolTimeout must be non-negative');
  }

  if (config.maxToolErrors !== undefined && config.maxToolErrors < 0) {
    errors.push('maxToolErrors must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format ReAct step for display
 */
export function formatReActStep(step: ReActStep, index: number): string {
  let output = `## Step ${index + 1}\n\n`;
  output += `**Thought:** ${step.thought}\n\n`;
  output += `**Action:** ${step.action}\n\n`;

  if (Object.keys(step.actionInput).length > 0) {
    output += `**Input:** \n${JSON.stringify(step.actionInput, null, 2)}\n\n`;
  }

  if (step.observation) {
    output += `**Observation:** \n${JSON.stringify(step.observation, null, 2)}\n\n`;
  }

  if (step.error) {
    output += `**Error:** ${step.error}\n\n`;
  }

  return output;
}

/**
 * Extract tool usage statistics
 */
export function extractToolStatistics(toolCalls: ToolCall[]): {
  toolCounts: Map<string, number>;
  averageDurations: Map<string, number>;
  errorRates: Map<string, number>;
} {
  const toolCounts = new Map<string, number>();
  const totalDurations = new Map<string, number>();
  const errorCounts = new Map<string, number>();

  for (const call of toolCalls) {
    // Count
    toolCounts.set(call.tool, (toolCounts.get(call.tool) ?? 0) + 1);

    // Duration
    totalDurations.set(
      call.tool,
      (totalDurations.get(call.tool) ?? 0) + call.duration
    );

    // Errors
    if (!call.success) {
      errorCounts.set(call.tool, (errorCounts.get(call.tool) ?? 0) + 1);
    }
  }

  // Calculate averages
  const averageDurations = new Map<string, number>();
  for (const [tool, total] of totalDurations) {
    const count = toolCounts.get(tool)!;
    averageDurations.set(tool, total / count);
  }

  // Calculate error rates
  const errorRates = new Map<string, number>();
  for (const [tool, count] of toolCounts) {
    const errors = errorCounts.get(tool) ?? 0;
    errorRates.set(tool, errors / count);
  }

  return {
    toolCounts,
    averageDurations,
    errorRates,
  };
}
