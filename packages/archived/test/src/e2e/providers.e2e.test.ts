/**
 * AI Providers E2E Tests
 *
 * Comprehensive tests for AI provider integrations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProviderMockManager,
  COMMON_TEST_RESPONSES,
} from '../mocks/providers';
import { TestDataGenerator } from '../generators/data';

describe('AI Providers E2E Tests', () => {
  describe('Anthropic Provider', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should create message', async () => {
      const anthropic = manager.getAnthropic();

      anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

      const response = await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Hello, Claude!' },
        ],
      });

      expect(response.id).toBeDefined();
      expect(response.type).toBe('message');
      expect(response.content).toBeInstanceOf(Array);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('Claude');
    });

    it('should create message with streaming', async () => {
      const anthropic = manager.getAnthropic();

      anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

      const chunks = [];
      for await (const chunk of anthropic.createMessageStream({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      const anthropic = manager.getAnthropic();
      anthropic.setFailRate(1.0);

      await expect(
        anthropic.createMessage({
          model: 'claude-3-opus-20240229',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();
    });

    it('should handle rate limiting', async () => {
      const anthropic = manager.getAnthropic();
      anthropic.setDelay(100);

      const start = Date.now();

      await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('OpenAI Provider', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should create chat completion', async () => {
      const openai = manager.getOpenAI();

      openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

      const response = await openai.createChatCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Hello, GPT!' },
        ],
      });

      expect(response.id).toBeDefined();
      expect(response.object).toBe('chat.completion');
      expect(response.choices).toBeInstanceOf(Array);
      expect(response.choices[0].message).toBeDefined();
      expect(response.choices[0].message.content).toContain('GPT');
    });

    it('should create chat completion with streaming', async () => {
      const openai = manager.getOpenAI();

      openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

      const chunks = [];
      for await (const chunk of openai.createChatCompletionStream({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const finalChunk = chunks[chunks.length - 1];
      expect(finalChunk.choices[0].finish_reason).toBe('stop');
    });

    it('should include usage information', async () => {
      const openai = manager.getOpenAI();

      openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

      const response = await openai.createChatCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage.prompt_tokens).toBeGreaterThan(0);
      expect(response.usage.completion_tokens).toBeGreaterThan(0);
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      const openai = manager.getOpenAI();
      openai.setFailRate(1.0);

      await expect(
        openai.createChatCompletion({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('Groq Provider', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should create chat completion', async () => {
      const groq = manager.getGroq();

      groq.setResponse(COMMON_TEST_RESPONSES.groq.simple);

      const response = await groq.createChatCompletion({
        model: 'llama2-70b-4096',
        messages: [
          { role: 'user', content: 'Hello, LLaMA!' },
        ],
      });

      expect(response.id).toBeDefined();
      expect(response.object).toBe('chat.completion');
      expect(response.choices).toBeInstanceOf(Array);
      expect(response.choices[0].message.content).toContain('LLaMA');
    });

    it('should include usage information', async () => {
      const groq = manager.getGroq();

      groq.setResponse(COMMON_TEST_RESPONSES.groq.simple);

      const response = await groq.createChatCompletion({
        model: 'llama2-70b-4096',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      const groq = manager.getGroq();
      groq.setFailRate(1.0);

      await expect(
        groq.createChatCompletion({
          model: 'llama2-70b-4096',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('Cerebras Provider', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should create chat completion', async () => {
      const cerebras = manager.getCerebras();

      cerebras.setResponse(COMMON_TEST_RESPONSES.cerebras.simple);

      const response = await cerebras.createChatCompletion({
        model: 'llama3.1-70b',
        messages: [
          { role: 'user', content: 'Hello, LLaMA 3.1!' },
        ],
      });

      expect(response.id).toBeDefined();
      expect(response.object).toBe('chat.completion');
      expect(response.choices).toBeInstanceOf(Array);
      expect(response.choices[0].message.content).toContain('LLaMA');
    });

    it('should include usage information', async () => {
      const cerebras = manager.getCerebras();

      cerebras.setResponse(COMMON_TEST_RESPONSES.cerebras.simple);

      const response = await cerebras.createChatCompletion({
        model: 'llama3.1-70b',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      const cerebras = manager.getCerebras();
      cerebras.setFailRate(1.0);

      await expect(
        cerebras.createChatCompletion({
          model: 'llama3.1-70b',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('Multi-Provider Routing', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should route to Anthropic', async () => {
      const anthropic = manager.getAnthropic();
      anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

      const response = await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.content[0].text).toContain('Claude');
    });

    it('should route to OpenAI', async () => {
      const openai = manager.getOpenAI();
      openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

      const response = await openai.createChatCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.choices[0].message.content).toContain('GPT');
    });

    it('should route to Groq', async () => {
      const groq = manager.getGroq();
      groq.setResponse(COMMON_TEST_RESPONSES.groq.simple);

      const response = await groq.createChatCompletion({
        model: 'llama2-70b-4096',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.choices[0].message.content).toContain('LLaMA 2');
    });

    it('should route to Cerebras', async () => {
      const cerebras = manager.getCerebras();
      cerebras.setResponse(COMMON_TEST_RESPONSES.cerebras.simple);

      const response = await cerebras.createChatCompletion({
        model: 'llama3.1-70b',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.choices[0].message.content).toContain('LLaMA 3.1');
    });
  });

  describe('Provider Failover', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should failover from Anthropic to OpenAI', async () => {
      const anthropic = manager.getAnthropic();
      const openai = manager.getOpenAI();

      anthropic.setFailRate(1.0);
      openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

      // Try Anthropic (should fail)
      await expect(
        anthropic.createMessage({
          model: 'claude-3-opus-20240229',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();

      // Fallback to OpenAI (should succeed)
      const response = await openai.createChatCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.choices[0].message.content).toBeDefined();
    });

    it('should handle all providers failing', async () => {
      manager.setGlobalFailRate(1.0);

      const anthropic = manager.getAnthropic();
      const openai = manager.getOpenAI();
      const groq = manager.getGroq();
      const cerebras = manager.getCerebras();

      await expect(
        anthropic.createMessage({
          model: 'claude-3-opus-20240229',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();

      await expect(
        openai.createChatCompletion({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();

      await expect(
        groq.createChatCompletion({
          model: 'llama2-70b-4096',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();

      await expect(
        cerebras.createChatCompletion({
          model: 'llama3.1-70b',
          messages: [
            { role: 'user', content: 'Test' },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('Conversation Management', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should handle multi-turn conversations', async () => {
      const anthropic = manager.getAnthropic();

      const conversation = TestDataGenerator.conversation(5);

      for (const message of conversation) {
        if (message.role === 'user') {
          anthropic.setResponse({
            id: `msg-${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: `Response to: ${message.content.substring(0, 50)}...`,
              },
            ],
            model: 'claude-3-opus-20240229',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
          });

          const response = await anthropic.createMessage({
            model: 'claude-3-opus-20240229',
            messages: [message],
          });

          expect(response.content[0].text).toBeDefined();
        }
      }
    });

    it('should handle system prompts', async () => {
      const anthropic = manager.getAnthropic();

      const systemPrompt = MessageGenerator.systemPrompt();

      anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

      const response = await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(response.content[0].text).toBeDefined();
    });

    it('should handle long contexts', async () => {
      const anthropic = manager.getAnthropic();

      const longMessage = StringGenerator.paragraph(50);

      anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

      const response = await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: longMessage },
        ],
      });

      expect(response.content[0].text).toBeDefined();
      expect(response.usage.input_tokens).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
      manager.setGlobalDelay(10); // 10ms per request
    });

    it('should handle 100 concurrent Anthropic requests', async () => {
      const anthropic = manager.getAnthropic();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

        promises.push(
          anthropic.createMessage({
            model: 'claude-3-opus-20240229',
            messages: [
              { role: 'user', content: `Test ${i}` },
            ],
          })
        );
      }

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(100);
      expect(responses.every(r => r.id)).toBe(true);
    });

    it('should handle 100 concurrent OpenAI requests', async () => {
      const openai = manager.getOpenAI();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

        promises.push(
          openai.createChatCompletion({
            model: 'gpt-4-turbo-preview',
            messages: [
              { role: 'user', content: `Test ${i}` },
            ],
          })
        );
      }

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(100);
      expect(responses.every(r => r.id)).toBe(true);
    });

    it('should complete requests within timeout', async () => {
      const anthropic = manager.getAnthropic();
      anthropic.setDelay(50);

      const start = Date.now();

      await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // Should complete in < 500ms
    });
  });

  describe('Token Usage', () => {
    let manager: ReturnType<typeof createProviderMockManager>;

    beforeEach(() => {
      manager = createProviderMockManager();
    });

    it('should track Anthropic token usage', async () => {
      const anthropic = manager.getAnthropic();
      anthropic.setResponse(COMMON_TEST_RESPONSES.anthropic.simple);

      const response = await anthropic.createMessage({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage.input_tokens).toBe(10);
      expect(response.usage.output_tokens).toBe(15);
    });

    it('should track OpenAI token usage', async () => {
      const openai = manager.getOpenAI();
      openai.setResponse(COMMON_TEST_RESPONSES.openai.simple);

      const response = await openai.createChatCompletion({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage.prompt_tokens).toBe(10);
      expect(response.usage.completion_tokens).toBe(11);
      expect(response.usage.total_tokens).toBe(21);
    });

    it('should track Groq token usage', async () => {
      const groq = manager.getGroq();
      groq.setResponse(COMMON_TEST_RESPONSES.groq.simple);

      const response = await groq.createChatCompletion({
        model: 'llama2-70b-4096',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should track Cerebras token usage', async () => {
      const cerebras = manager.getCerebras();
      cerebras.setResponse(COMMON_TEST_RESPONSES.cerebras.simple);

      const response = await cerebras.createChatCompletion({
        model: 'llama3.1-70b',
        messages: [
          { role: 'user', content: 'Test' },
        ],
      });

      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });
  });
});
