/**
 * Unit tests for Code Synthesizer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeSynthesizer } from '../../src/synthesis/synthesizer';
import { LLMManager } from '../../src/llm/index';
import { Language } from '../../src/types/index';

describe('CodeSynthesizer', () => {
  let synthesizer: CodeSynthesizer;
  let mockLLM: LLMManager;

  beforeEach(() => {
    mockLLM = {
      complete: vi.fn(),
      stream: vi.fn(),
      countTokens: vi.fn(),
      validateKey: vi.fn(),
      getModelInfo: vi.fn()
    } as any;

    synthesizer = new CodeSynthesizer(mockLLM);
  });

  describe('synthesize', () => {
    it('should generate code from prompt', async () => {
      const mockResponse = {
        text: `\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

EXPLANATION:
A simple hello function that takes a name parameter and returns a greeting.

DEPENDENCIES:
- None

EXPORTS:
- hello`,
        finishReason: 'stop' as const,
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        },
        model: 'claude-3-sonnet'
      };

      vi.mocked(mockLLM.complete).mockResolvedValue(mockResponse);

      const result = await synthesizer.synthesize({
        prompt: 'Create a hello function',
        language: Language.TypeScript,
        outputPath: '/tmp/hello.ts',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.code).toContain('function hello');
      expect(result.data?.language).toBe(Language.TypeScript);
    });

    it('should handle synthesis errors', async () => {
      vi.mocked(mockLLM.complete).mockRejectedValue(new Error('API error'));

      const result = await synthesizer.synthesize({
        prompt: 'Create a function',
        language: Language.TypeScript,
        outputPath: '/tmp/test.ts'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('SYNTHESIS_ERROR');
    });

    it('should validate generated code', async () => {
      const mockResponse = {
        text: 'function test() { return; }', // Valid code
        finishReason: 'stop' as const,
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        model: 'claude-3-sonnet'
      };

      vi.mocked(mockLLM.complete).mockResolvedValue(mockResponse);

      const result = await synthesizer.synthesize({
        prompt: 'Create a test function',
        language: Language.TypeScript,
        outputPath: '/tmp/test.ts',
        dryRun: true,
        typeCheck: true
      });

      expect(result.success).toBe(true);
    });
  });

  describe('refactor', () => {
    it('should refactor code to improve readability', async () => {
      const mockResponse = {
        text: `\`\`\`typescript
const sum = (a: number, b: number): number => a + b;
\`\`\`

CHANGES:
- Converted function to arrow function
- Added type annotations

IMPROVEMENTS:
- More concise syntax
- Better type safety`,
        finishReason: 'stop' as const,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'claude-3-sonnet'
      };

      vi.mocked(mockLLM.complete).mockResolvedValue(mockResponse);

      const result = await synthesizer.refactor(
        'function add(a, b) { return a + b; }',
        Language.TypeScript,
        ['improve readability', 'add type annotations']
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.refactored).toContain('sum');
      expect(result.data?.changes.length).toBeGreaterThan(0);
    });
  });

  describe('complete', () => {
    it('should complete code snippet', async () => {
      const mockResponse = {
        text: ' {\n  return console.log("Hello, world!");\n}',
        finishReason: 'stop' as const,
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        model: 'claude-3-sonnet'
      };

      vi.mocked(mockLLM.complete).mockResolvedValue(mockResponse);

      const result = await synthesizer.complete(
        'function sayHello()',
        Language.TypeScript
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.completion).toContain('return');
    });
  });

  describe('explain', () => {
    it('should explain code in detail', async () => {
      const mockResponse = {
        text: `SUMMARY:
This function calculates the factorial of a number.

DETAILED:
The factorial function uses recursion to calculate the product of all positive integers less than or equal to n.

COMPLEXITY:
Time: O(n), Space: O(n) due to recursion stack

PATTERNS:
- Recursion

SUGGESTIONS:
- Consider using memoization for better performance
- Add input validation`,
        finishReason: 'stop' as const,
        usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
        model: 'claude-3-sonnet'
      };

      vi.mocked(mockLLM.complete).mockResolvedValue(mockResponse);

      const result = await synthesizer.explain(
        'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }',
        Language.JavaScript
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.summary).toContain('factorial');
      expect(result.data?.patterns).toContain('Recursion');
    });
  });
});
