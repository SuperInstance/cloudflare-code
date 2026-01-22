/**
 * Code Completion Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { CodeCompletionEngine, getCompletions } from './completion';
import type { CompletionRequest, SupportedLanguage } from './types';

describe('CodeCompletionEngine', () => {
  let engine: CodeCompletionEngine;

  beforeEach(() => {
    engine = new CodeCompletionEngine();
  });

  describe('complete', () => {
    it('should provide TypeScript completions', async () => {
      const request: CompletionRequest = {
        code: 'function add',
        language: 'typescript',
        cursor: { line: 0, column: 12 },
      };

      const result = await engine.complete(request);

      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.context).toBeDefined();
    });

    it('should provide completions for import statements', async () => {
      const request: CompletionRequest = {
        code: 'import {',
        language: 'typescript',
        cursor: { line: 0, column: 9 },
      };

      const result = await engine.complete(request);

      expect(result.items).toBeDefined();
      expect(result.items.some(i => i.kind === 'keyword')).toBe(true);
    });

    it('should provide Python completions', async () => {
      const request: CompletionRequest = {
        code: 'def fac',
        language: 'python',
        cursor: { line: 0, column: 7 },
      };

      const result = await engine.complete(request);

      expect(result.items).toBeDefined();
      expect(result.items.some(i => i.label === 'def')).toBe(true);
    });

    it('should provide snippet completions', async () => {
      const request: CompletionRequest = {
        code: '',
        language: 'typescript',
        cursor: { line: 0, column: 0 },
      };

      const result = await engine.complete(request);

      expect(result.items.some(i => i.kind === 'snippet')).toBe(true);
      expect(result.items.some(i => i.label === 'function')).toBe(true);
    });

    it('should filter by max results', async () => {
      const request: CompletionRequest = {
        code: '',
        language: 'typescript',
        cursor: { line: 0, column: 0 },
        options: {
          maxResults: 5,
        },
      };

      const result = await engine.complete(request);

      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it('should extract symbols from context', async () => {
      const code = `
function test() {
  return 42;
}
const x = 10;
`;

      const request: CompletionRequest = {
        code,
        language: 'typescript',
        cursor: { line: 5, column: 0 },
      };

      const result = await engine.complete(request);

      expect(result.context.symbols).toBeDefined();
      expect(result.context.symbols.length).toBeGreaterThan(0);
    });
  });

  describe('getTriggerCharacters', () => {
    it('should return trigger characters for TypeScript', () => {
      const triggers = engine.getTriggerCharacters('typescript');
      expect(triggers).toContain('.');
      expect(triggers).toContain('"');
    });

    it('should return trigger characters for Python', () => {
      const triggers = engine.getTriggerCharacters('python');
      expect(triggers).toContain('.');
      expect(triggers).toContain('(');
    });

    it('should return empty array for unsupported language', () => {
      const triggers = engine.getTriggerCharacters('scala' as SupportedLanguage);
      expect(Array.isArray(triggers)).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache completion results', async () => {
      const request: CompletionRequest = {
        code: 'function',
        language: 'typescript',
        cursor: { line: 0, column: 8 },
      };

      const result1 = await engine.complete(request);
      const result2 = await engine.complete(request);

      expect(result1.items).toEqual(result2.items);
    });

    it('should clear cache', async () => {
      const request: CompletionRequest = {
        code: 'function',
        language: 'typescript',
        cursor: { line: 0, column: 8 },
      };

      await engine.complete(request);
      engine.clearCache();

      const result = await engine.complete(request);

      expect(result.items).toBeDefined();
    });
  });
});

describe('getCompletions', () => {
  it('should use default engine', async () => {
    const request: CompletionRequest = {
      code: 'func',
      language: 'typescript',
      cursor: { line: 0, column: 4 },
    };

    const result = await getCompletions(request);

    expect(result.items).toBeDefined();
  });
});
