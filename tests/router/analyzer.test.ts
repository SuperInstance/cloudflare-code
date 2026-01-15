/**
 * Request Analyzer Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RequestAnalyzer } from '../../packages/edge/src/lib/router/analyzer';
import type { ChatRequest } from '../../packages/edge/src/types/index';

describe('RequestAnalyzer', () => {
  let analyzer: RequestAnalyzer;

  beforeEach(() => {
    analyzer = new RequestAnalyzer();
  });

  describe('analyze', () => {
    it('should analyze simple chat request', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
      };

      const analysis = await analyzer.analyze(request);

      expect(analysis.complexity).toBe('simple');
      expect(analysis.intent).toBe('chat');
      expect(analysis.hasCode).toBe(false);
      expect(analysis.codeSnippets).toHaveLength(0);
      expect(analysis.semanticHash).toBeDefined();
    });

    it('should analyze code request', async () => {
      const request: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Write a function to sort an array:\n```javascript\nfunction sort(arr) {\n  return arr.sort((a, b) => a - b);\n}\n```',
          },
        ],
      };

      const analysis = await analyzer.analyze(request);

      expect(analysis.intent).toBe('code');
      expect(analysis.hasCode).toBe(true);
      expect(analysis.codeSnippets).toHaveLength(1);
      expect(analysis.codeSnippets[0]?.language).toBe('javascript');
      expect(analysis.codeSnippets[0]?.lineCount).toBeGreaterThan(0);
      expect(analysis.languages).toContain('javascript');
    });

    it('should analyze analysis request', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Analyze the performance of this algorithm' },
        ],
      };

      const analysis = await analyzer.analyze(request);

      expect(analysis.intent).toBe('analysis');
    });

    it('should analyze creative request', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Write a creative story about a robot' },
        ],
      };

      const analysis = await analyzer.analyze(request);

      expect(analysis.intent).toBe('creative');
    });

    it('should detect complex request with long conversation', async () => {
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      // Create 15 pairs of substantial messages
      for (let i = 0; i < 15; i++) {
        messages.push({
          role: 'user',
          content: `This is message number ${i} with substantial content to increase token count. `.repeat(10)
        });
        messages.push({
          role: 'assistant',
          content: `This is response number ${i} with substantial content to increase token count. `.repeat(10)
        });
      }

      const request: ChatRequest = { messages };

      const analysis = await analyzer.analyze(request);

      expect(analysis.complexity).toBe('complex');
    });

    it('should detect multiple code snippets', async () => {
      const request: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Here are two code examples:\n```python\ndef hello():\n    print("Hello")\n```\n\n```javascript\nfunction hello() {\n  console.log("Hello");\n}\n```',
          },
        ],
      };

      const analysis = await analyzer.analyze(request);

      expect(analysis.hasCode).toBe(true);
      expect(analysis.codeSnippets.length).toBeGreaterThanOrEqual(2);
      expect(analysis.languages).toContain('python');
      expect(analysis.languages).toContain('javascript');
    });

    it('should estimate token cost', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'This is a test message with some text' },
        ],
        maxTokens: 1000,
      };

      const analysis = await analyzer.analyze(request);

      expect(analysis.estimatedTokens.input).toBeGreaterThan(0);
      expect(analysis.estimatedTokens.output).toBeGreaterThan(0);
      expect(analysis.estimatedTokens.total).toBe(
        analysis.estimatedTokens.input + analysis.estimatedTokens.output
      );
    });

    it('should generate consistent semantic hash', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        temperature: 0.7,
        maxTokens: 1000,
      };

      const analysis1 = await analyzer.analyze(request);
      const analysis2 = await analyzer.analyze(request);

      expect(analysis1.semanticHash).toBe(analysis2.semanticHash);
    });

    it('should generate different semantic hash for different parameters', async () => {
      const request1: ChatRequest = {
        messages: [{ role: 'user', content: 'Test message' }],
        temperature: 0.7,
      };

      const request2: ChatRequest = {
        messages: [{ role: 'user', content: 'Test message' }],
        temperature: 0.9,
      };

      const analysis1 = await analyzer.analyze(request1);
      const analysis2 = await analyzer.analyze(request2);

      expect(analysis1.semanticHash).not.toBe(analysis2.semanticHash);
    });
  });

  describe('complexity detection', () => {
    it('should classify short request as simple', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const analysis = await analyzer.analyze(request);
      expect(analysis.complexity).toBe('simple');
    });

    it('should classify medium request as moderate', async () => {
      // Need enough content to be moderate
      const mediumText = 'This is a medium length request with substantial content. '.repeat(30);
      const request: ChatRequest = {
        messages: [{ role: 'user', content: mediumText }],
      };

      const analysis = await analyzer.analyze(request);
      expect(analysis.complexity).toBe('moderate');
    });

    it('should classify very long request as complex', async () => {
      // Create a very long request with many messages
      const longText = 'This is a very long request with lots of content. '.repeat(500);

      const request: ChatRequest = {
        messages: [
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response 1' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response 2' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response 3' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response 4' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response 5' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response 6' },
        ],
      };

      const analysis = await analyzer.analyze(request);
      expect(analysis.complexity).toBe('complex');
    });
  });

  describe('language detection', () => {
    it('should detect Python code', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Write a Python function:\n```python\ndef test():\n    pass\n```' },
        ],
      };

      const analysis = await analyzer.analyze(request);
      expect(analysis.languages).toContain('python');
    });

    it('should detect JavaScript code', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'const x = () => { return true; };' },
        ],
      };

      const analysis = await analyzer.analyze(request);
      expect(analysis.languages).toContain('javascript');
    });

    it('should detect TypeScript code', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'interface User { name: string; }' },
        ],
      };

      const analysis = await analyzer.analyze(request);
      expect(analysis.languages).toContain('typescript');
    });
  });

  describe('configuration', () => {
    it('should use custom thresholds', async () => {
      const customAnalyzer = new RequestAnalyzer({
        simpleThreshold: 10,
        complexThreshold: 30,
      });

      // Create a request with enough content to be complex
      const longText = 'x'.repeat(2000); // ~500 tokens

      const request: ChatRequest = {
        messages: [
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: longText },
          { role: 'assistant', content: 'Response' },
          { role: 'user', content: longText },
        ],
      };

      const analysis = await customAnalyzer.analyze(request);
      expect(analysis.complexity).toBe('complex');
    });

    it('should update configuration', () => {
      analyzer.updateConfig({
        simpleThreshold: 100,
        complexThreshold: 500,
      });

      const config = analyzer.getConfig();
      expect(config.simpleThreshold).toBe(100);
      expect(config.complexThreshold).toBe(500);
    });
  });
});
