/**
 * AI Provider Mocks
 *
 * Mock responses for AI provider APIs (Anthropic, OpenAI, Groq, Cerebras)
 */

/**
 * Anthropic API Types
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * OpenAI API Types
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: 'assistant';
      content: string;
    };
    delta?: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Groq API Types
 */
export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface GroqResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Cerebras API Types
 */
export interface CerebrasMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CerebrasRequest {
  model: string;
  messages: CerebrasMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface CerebrasResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Anthropic Mock
 */
export class AnthropicMock {
  private responses: AnthropicResponse[] = [];
  private delay: number = 0;
  private failRate: number = 0;

  constructor() {
    this.responses = [
      {
        id: 'msg-001',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello! I am Claude, an AI assistant.' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 15,
        },
      },
    ];
  }

  /**
   * Set mock response
   */
  setResponse(response: AnthropicResponse): void {
    this.responses.push(response);
  }

  /**
   * Set artificial delay
   */
  setDelay(delay: number): void {
    this.delay = delay;
  }

  /**
   * Set failure rate (0-1)
   */
  setFailRate(rate: number): void {
    this.failRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Mock create message
   */
  async createMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (Math.random() < this.failRate) {
      throw new Error('Anthropic API error');
    }

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mock response available');
    }

    return response;
  }

  /**
   * Mock streaming response
   */
  async *createMessageStream(request: AnthropicRequest): AsyncGenerator<AnthropicResponse, void, unknown> {
    const baseResponse = await this.createMessage(request);
    const chunks = baseResponse.content[0].text.split(' ');

    for (const chunk of chunks) {
      yield {
        ...baseResponse,
        content: [{ type: 'text', text: chunk + ' ' }],
      };
    }
  }

  /**
   * Create error response
   */
  createError(code: string, message: string): Error {
    const error = new Error(message) as any;
    error.status = 500;
    error.code = code;
    return error;
  }
}

/**
 * OpenAI Mock
 */
export class OpenAIMock {
  private responses: OpenAIResponse[] = [];
  private delay: number = 0;
  private failRate: number = 0;

  constructor() {
    this.responses = [
      {
        id: 'chatcmpl-001',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am GPT-4, an AI assistant.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 12,
          total_tokens: 22,
        },
      },
    ];
  }

  /**
   * Set mock response
   */
  setResponse(response: OpenAIResponse): void {
    this.responses.push(response);
  }

  /**
   * Set artificial delay
   */
  setDelay(delay: number): void {
    this.delay = delay;
  }

  /**
   * Set failure rate (0-1)
   */
  setFailRate(rate: number): void {
    this.failRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Mock chat completion
   */
  async createChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (Math.random() < this.failRate) {
      throw new Error('OpenAI API error');
    }

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mock response available');
    }

    return response;
  }

  /**
   * Mock streaming response
   */
  async *createChatCompletionStream(request: OpenAIRequest): AsyncGenerator<OpenAIResponse, void, unknown> {
    const baseResponse = await this.createChatCompletion(request);
    const content = baseResponse.choices[0].message?.content || '';
    const chunks = content.split(' ');

    for (const chunk of chunks) {
      yield {
        ...baseResponse,
        choices: [
          {
            index: 0,
            delta: {
              content: chunk + ' ',
            },
            finish_reason: null,
          },
        ],
      };
    }

    // Final chunk with finish_reason
    yield {
      ...baseResponse,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  }

  /**
   * Create error response
   */
  createError(code: string, message: string): Error {
    const error = new Error(message) as any;
    error.status = 500;
    error.code = code;
    return error;
  }
}

/**
 * Groq Mock
 */
export class GroqMock {
  private responses: GroqResponse[] = [];
  private delay: number = 0;
  private failRate: number = 0;

  constructor() {
    this.responses = [
      {
        id: 'groq-001',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2-70b-4096',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am LLaMA 2, an AI assistant.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 14,
          total_tokens: 24,
        },
      },
    ];
  }

  /**
   * Set mock response
   */
  setResponse(response: GroqResponse): void {
    this.responses.push(response);
  }

  /**
   * Set artificial delay
   */
  setDelay(delay: number): void {
    this.delay = delay;
  }

  /**
   * Set failure rate (0-1)
   */
  setFailRate(rate: number): void {
    this.failRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Mock chat completion
   */
  async createChatCompletion(request: GroqRequest): Promise<GroqResponse> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (Math.random() < this.failRate) {
      throw new Error('Groq API error');
    }

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mock response available');
    }

    return response;
  }

  /**
   * Create error response
   */
  createError(code: string, message: string): Error {
    const error = new Error(message) as any;
    error.status = 500;
    error.code = code;
    return error;
  }
}

/**
 * Cerebras Mock
 */
export class CerebrasMock {
  private responses: CerebrasResponse[] = [];
  private delay: number = 0;
  private failRate: number = 0;

  constructor() {
    this.responses = [
      {
        id: 'cerebras-001',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama3.1-70b',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am LLaMA 3.1, an AI assistant.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 16,
          total_tokens: 26,
        },
      },
    ];
  }

  /**
   * Set mock response
   */
  setResponse(response: CerebrasResponse): void {
    this.responses.push(response);
  }

  /**
   * Set artificial delay
   */
  setDelay(delay: number): void {
    this.delay = delay;
  }

  /**
   * Set failure rate (0-1)
   */
  setFailRate(rate: number): void {
    this.failRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Mock chat completion
   */
  async createChatCompletion(request: CerebrasRequest): Promise<CerebrasResponse> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (Math.random() < this.failRate) {
      throw new Error('Cerebras API error');
    }

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mock response available');
    }

    return response;
  }

  /**
   * Create error response
   */
  createError(code: string, message: string): Error {
    const error = new Error(message) as any;
    error.status = 500;
    error.code = code;
    return error;
  }
}

/**
 * Provider Mock Manager
 */
export class ProviderMockManager {
  private anthropic: AnthropicMock;
  private openai: OpenAIMock;
  private groq: GroqMock;
  private cerebras: CerebrasMock;

  constructor() {
    this.anthropic = new AnthropicMock();
    this.openai = new OpenAIMock();
    this.groq = new GroqMock();
    this.cerebras = new CerebrasMock();
  }

  /**
   * Get Anthropic mock
   */
  getAnthropic(): AnthropicMock {
    return this.anthropic;
  }

  /**
   * Get OpenAI mock
   */
  getOpenAI(): OpenAIMock {
    return this.openai;
  }

  /**
   * Get Groq mock
   */
  getGroq(): GroqMock {
    return this.groq;
  }

  /**
   * Get Cerebras mock
   */
  getCerebras(): CerebrasMock {
    return this.cerebras;
  }

  /**
   * Set global delay for all providers
   */
  setGlobalDelay(delay: number): void {
    this.anthropic.setDelay(delay);
    this.openai.setDelay(delay);
    this.groq.setDelay(delay);
    this.cerebras.setDelay(delay);
  }

  /**
   * Set global fail rate for all providers
   */
  setGlobalFailRate(rate: number): void {
    this.anthropic.setFailRate(rate);
    this.openai.setFailRate(rate);
    this.groq.setFailRate(rate);
    this.cerebras.setFailRate(rate);
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.anthropic = new AnthropicMock();
    this.openai = new OpenAIMock();
    this.groq = new GroqMock();
    this.cerebras = new CerebrasMock();
  }
}

/**
 * Create provider mock manager
 */
export function createProviderMockManager(): ProviderMockManager {
  return new ProviderMockManager();
}

/**
 * Common test responses
 */
export const COMMON_TEST_RESPONSES = {
  anthropic: {
    simple: {
      id: 'msg-001',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'This is a test response from Claude.' }],
      model: 'claude-3-opus-20240229',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 12 },
    } as AnthropicResponse,
    code: {
      id: 'msg-002',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Here is a code example:\n\n```typescript\nfunction hello() {\n  console.log("Hello, World!");\n}\n```',
        },
      ],
      model: 'claude-3-opus-20240229',
      stop_reason: 'end_turn',
      usage: { input_tokens: 15, output_tokens: 25 },
    } as AnthropicResponse,
  },

  openai: {
    simple: {
      id: 'chatcmpl-001',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4-turbo-preview',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response from GPT-4.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 11, total_tokens: 21 },
    } as OpenAIResponse,
    code: {
      id: 'chatcmpl-002',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4-turbo-preview',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Here is a code example:\n\n```typescript\nfunction hello() {\n  console.log("Hello, World!");\n}\n```',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 30, total_tokens: 45 },
    } as OpenAIResponse,
  },

  groq: {
    simple: {
      id: 'groq-001',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama2-70b-4096',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response from LLaMA 2.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 13, total_tokens: 23 },
    } as GroqResponse,
  },

  cerebras: {
    simple: {
      id: 'cerebras-001',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama3.1-70b',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response from LLaMA 3.1.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
    } as CerebrasResponse,
  },
};
