import { Pact } from '@pact-foundation/pact';
import { Matchers } from '@pact-foundation/pact';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contract Tests for Chat Provider Integration
 *
 * Tests contracts between ClaudeFlare and AI providers (OpenAI, Anthropic, etc.)
 */

const provider = new Pact({
  consumer: 'claudeflare-chat',
  provider: 'ai-provider-api',
  port: 1234,
  log: path.resolve(process.cwd(), 'logs', 'pact.log'),
  dir: path.resolve(process.cwd(), 'contracts', 'pacts'),
  logLevel: 'INFO',
  spec: 2
});

describe('Chat Provider Contract Tests', () => {
  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe('POST /v1/chat/completions', () => {
    it('should send chat completion request', async () => {
      await provider.addInteraction({
        state: 'provider is available',
        uponReceiving: 'a request for chat completion',
        withRequest: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': Matchers.like('Bearer sk-...')
          },
          body: {
            model: Matchers.like('gpt-4'),
            messages: Matchers.eachLike({
              role: Matchers.term({
                generate: 'user',
                matcher: 'user|assistant|system'
              }),
              content: Matchers.string('Hello')
            }),
            temperature: Matchers.number(0.7),
            max_tokens: Matchers.integer(1000)
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            id: Matchers.uuid('chatcmpl-123'),
            object: Matchers.like('chat.completion'),
            created: Matchers.integer(1234567890),
            model: Matchers.like('gpt-4'),
            choices: Matchers.eachLike({
              index: Matchers.integer(0),
              message: {
                role: Matchers.like('assistant'),
                content: Matchers.string('Response')
              },
              finish_reason: Matchers.like('stop')
            }),
            usage: {
              prompt_tokens: Matchers.integer(10),
              completion_tokens: Matchers.integer(20),
              total_tokens: Matchers.integer(30)
            }
          }
        }
      });

      // Verify interaction
      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test-key'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('choices');
    });

    it('should handle streaming responses', async () => {
      await provider.addInteraction({
        state: 'provider is available',
        uponReceiving: 'a request for streaming chat completion',
        withRequest: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            model: Matchers.like('gpt-4'),
            messages: Matchers.eachLike({
              role: Matchers.like('user'),
              content: Matchers.string('Stream this')
            }),
            stream: Matchers.boolean(true)
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          body: Matchers.like('data: {"choices":[{"delta":{"content":"test"}}]}')
        }
      });

      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Stream this' }],
          stream: true
        })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
    });

    it('should handle errors gracefully', async () => {
      await provider.addInteraction({
        state: 'provider is experiencing errors',
        uponReceiving: 'a request that will fail',
        withRequest: {
          method: 'POST',
          path: '/v1/chat/completions',
          body: {
            model: Matchers.like('invalid-model'),
            messages: Matchers.eachLike({
              role: Matchers.like('user'),
              content: Matchers.string('Test')
            })
          }
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: {
              message: Matchers.string('Invalid model'),
              type: Matchers.like('invalid_request_error'),
              code: Matchers.like('invalid_model')
            }
          }
        }
      });

      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /v1/completions', () => {
    it('should send completion request', async () => {
      await provider.addInteraction({
        state: 'provider is available',
        uponReceiving: 'a request for text completion',
        withRequest: {
          method: 'POST',
          path: '/v1/completions',
          body: {
            model: Matchers.like('gpt-4'),
            prompt: Matchers.string('Complete this'),
            max_tokens: Matchers.integer(100),
            temperature: Matchers.number(0.7)
          }
        },
        willRespondWith: {
          status: 200,
          body: {
            id: Matchers.uuid('cmpl-123'),
            object: Matchers.like('text_completion'),
            created: Matchers.integer(1234567890),
            model: Matchers.like('gpt-4'),
            choices: Matchers.eachLike({
              text: Matchers.string('Completed text'),
              index: Matchers.integer(0),
              finish_reason: Matchers.like('stop')
            }),
            usage: {
              prompt_tokens: Matchers.integer(5),
              completion_tokens: Matchers.integer(10),
              total_tokens: Matchers.integer(15)
            }
          }
        }
      });

      const response = await fetch('http://localhost:1234/v1/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          prompt: 'Complete this',
          max_tokens: 100,
          temperature: 0.7
        })
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /v1/embeddings', () => {
    it('should generate embeddings', async () => {
      await provider.addInteraction({
        state: 'provider is available',
        uponReceiving: 'a request for embeddings',
        withRequest: {
          method: 'POST',
          path: '/v1/embeddings',
          body: {
            model: Matchers.like('text-embedding-ada-002'),
            input: Matchers.string('Generate embedding for this text')
          }
        },
        willRespondWith: {
          status: 200,
          body: {
            object: Matchers.like('list'),
            data: Matchers.eachLike({
              object: Matchers.like('embedding'),
              embedding: Matchers.eachLike(Matchers.number(0.1)),
              index: Matchers.integer(0)
            }),
            model: Matchers.like('text-embedding-ada-002'),
            usage: {
              prompt_tokens: Matchers.integer(10),
              total_tokens: Matchers.integer(10)
            }
          }
        }
      });

      const response = await fetch('http://localhost:1234/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: 'Generate embedding for this text'
        })
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /v1/models', () => {
    it('should list available models', async () => {
      await provider.addInteraction({
        state: 'provider is available',
        uponReceiving: 'a request to list models',
        withRequest: {
          method: 'GET',
          path: '/v1/models',
          headers: {
            'Authorization': Matchers.like('Bearer sk-...')
          }
        },
        willRespondWith: {
          status: 200,
          body: {
            object: Matchers.like('list'),
            data: Matchers.eachLike({
              id: Matchers.like('gpt-4'),
              object: Matchers.like('model'),
              created: Matchers.integer(1234567890),
              owned_by: Matchers.like('organization')
            })
          }
        }
      });

      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer sk-test-key'
        }
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting Contract', () => {
    it('should enforce rate limits', async () => {
      await provider.addInteraction({
        state: 'rate limit exceeded',
        uponReceiving: 'a request exceeding rate limit',
        withRequest: {
          method: 'POST',
          path: '/v1/chat/completions',
          body: Matchers.like({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Test' }]
          })
        },
        willRespondWith: {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Matchers.string('60')
          },
          body: {
            error: {
              message: Matchers.string('Rate limit exceeded'),
              type: Matchers.like('rate_limit_error')
            }
          }
        }
      });

      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBeDefined();
    });
  });
});

/**
 * Internal API Contract Tests
 */
describe('Internal API Contract Tests', () => {
  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe('POST /api/code/generate', () => {
    it('should generate code with valid contract', async () => {
      await provider.addInteraction({
        state: 'code generation service is available',
        uponReceiving: 'a code generation request',
        withRequest: {
          method: 'POST',
          path: '/api/code/generate',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': Matchers.like('Bearer ')
          },
          body: {
            prompt: Matchers.string('Generate a function'),
            language: Matchers.like('TypeScript'),
            context: Matchers.optional({
              projectPath: Matchers.string('/path/to/project'),
              framework: Matchers.like('React')
            })
          }
        },
        willRespondWith: {
          status: 200,
          body: {
            code: Matchers.string('function'),
            language: Matchers.like('TypeScript'),
            explanation: Matchers.string('This function'),
            tokens: {
              input: Matchers.integer(10),
              output: Matchers.integer(50),
              total: Matchers.integer(60)
            },
            latency: Matchers.integer(1000)
          }
        }
      });

      const response = await fetch('http://localhost:1234/api/code/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'Generate a function',
          language: 'TypeScript'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('code');
    });
  });

  describe('POST /api/routing/select-provider', () => {
    it('should select appropriate provider', async () => {
      await provider.addInteraction({
        state: 'routing service is available',
        uponReceiving: 'a provider selection request',
        withRequest: {
          method: 'POST',
          path: '/api/routing/select-provider',
          body: {
            task: Matchers.like('code_generation'),
            quality: Matchers.like('high'),
            maxLatency: Matchers.integer(5000),
            maxCost: Matchers.number(0.01),
            estimatedTokens: Matchers.integer(1000)
          }
        },
        willRespondWith: {
          status: 200,
          body: {
            provider: Matchers.like('openai'),
            model: Matchers.like('gpt-4'),
            reasoning: Matchers.string('Selected based on quality'),
            estimatedLatency: Matchers.integer(2000),
            estimatedCost: Matchers.number(0.005)
          }
        }
      });

      const response = await fetch('http://localhost:1234/api/routing/select-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task: 'code_generation',
          quality: 'high',
          maxLatency: 5000,
          maxCost: 0.01,
          estimatedTokens: 1000
        })
      });

      expect(response.status).toBe(200);
    });
  });
});
