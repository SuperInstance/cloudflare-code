/**
 * AI Suggestions Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AIDebugSuggestionsEngine,
  createAISuggestionsEngine,
  generateSuggestions,
} from './suggestions';
import type { ErrorInfo, ErrorCategory, RootCauseAnalysis, StackTrace, Language } from './types';

describe('AIDebugSuggestionsEngine', () => {
  let engine: AIDebugSuggestionsEngine;

  beforeEach(() => {
    engine = new AIDebugSuggestionsEngine();
  });

  const createMockError = (message: string): ErrorInfo => ({
    errorId: 'test-error-1',
    errorType: 'TestError',
    message,
    stackTrace: 'Error: Test\n    at method (/src/file.js:10:15)',
    timestamp: Date.now(),
    source: 'test-service',
    severity: 'high',
    category: 'runtime' as ErrorCategory,
    recoverable: true,
    context: {},
  });

  const createMockStackTrace = (): StackTrace => ({
    traceId: 'trace-1',
    language: 'javascript' as Language,
    frames: [
      {
        index: 0,
        language: 'javascript' as Language,
        filePath: '/src/app.js',
        lineNumber: 10,
        functionName: 'processData',
        raw: 'at processData (/src/app.js:10:15)',
        isAsync: true,
        isLibrary: false,
        isApp: true,
      },
    ],
    raw: 'Error: Test\n    at processData (/src/app.js:10:15)',
    appFrames: [],
    libraryFrames: [],
    asyncFrames: [],
    timestamp: Date.now(),
  });

  describe('Null/Undefined Errors', () => {
    it('should suggest optional chaining for null reference', async () => {
      const error = createMockError('Cannot read property "test" of undefined');

      const suggestions = await engine.generateSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);

      const nullCheckSuggestion = suggestions.find(s =>
        s.title.includes('optional chaining') || s.title.includes('null check')
      );

      expect(nullCheckSuggestion).toBeDefined();
      expect(nullCheckSuggestion?.confidence).toBeGreaterThan(0.8);
      expect(nullCheckSuggestion?.type).toBe('code_fix');
    });

    it('should include code diff for fix', async () => {
      const error = createMockError('Cannot read property "data" of null');

      const suggestions = await engine.generateSuggestions(error);

      const suggestionWithDiff = suggestions.find(s => s.codeDiff);

      expect(suggestionWithDiff).toBeDefined();
      expect(suggestionWithDiff?.codeDiff).toBeDefined();
      expect(suggestionWithDiff?.codeDiff?.original).toBeDefined();
      expect(suggestionWithDiff?.codeDiff?.suggested).toBeDefined();
    });
  });

  describe('Network Errors', () => {
    it('should suggest retry logic for connection errors', async () => {
      const error = createMockError('ECONNREFUSED: Connection refused');

      const suggestions = await engine.generateSuggestions(error);

      const retrySuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('retry')
      );

      expect(retrySuggestion).toBeDefined();
      expect(retrySuggestion?.type).toBe('error_handling');
      expect(retrySuggestion?.references.length).toBeGreaterThan(0);
    });

    it('should suggest exponential backoff', async () => {
      const error = createMockError('ETIMEDOUT: Connection timed out');

      const suggestions = await engine.generateSuggestions(error);

      const backoffSuggestion = suggestions.find(s =>
        s.description.toLowerCase().includes('backoff')
      );

      expect(backoffSuggestion).toBeDefined();
    });
  });

  describe('Memory Errors', () => {
    it('should suggest memory leak fixes', async () => {
      const error = createMockError('JavaScript heap out of memory');

      const suggestions = await engine.generateSuggestions(error);

      const memorySuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('memory')
      );

      expect(memorySuggestion).toBeDefined();
      expect(memorySuggestion?.type).toBe('performance');
      expect(memorySuggestion?.impact.errorReduction).toBeGreaterThan(0);
    });
  });

  describe('Timeout Errors', () => {
    it('should suggest timeout optimizations', async () => {
      const error = createMockError('Operation timed out after 30000ms');

      const suggestions = await engine.generateSuggestions(error);

      const timeoutSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('timeout')
      );

      expect(timeoutSuggestion).toBeDefined();
      expect(timeoutSuggestion?.type).toBe('performance');
    });
  });

  describe('Configuration Errors', () => {
    it('should suggest configuration validation', async () => {
      const error = createMockError('Invalid configuration: missing required field');

      const suggestions = await engine.generateSuggestions(error);

      const configSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('configuration') ||
        s.description.toLowerCase().includes('configuration')
      );

      expect(configSuggestion).toBeDefined();
      expect(configSuggestion?.type).toBe('config_change');
    });
  });

  describe('Security Errors', () => {
    it('should suggest parameterized queries for SQL injection', async () => {
      const error = createMockError('Potential SQL injection detected');

      const suggestions = await engine.generateSuggestions(error);

      const securitySuggestion = suggestions.find(s => s.type === 'security');

      expect(securitySuggestion).toBeDefined();
      expect(securitySuggestion?.confidence).toBeGreaterThan(0.9);
      expect(securitySuggestion?.references.length).toBeGreaterThan(0);
    });

    it('should prioritize security fixes', async () => {
      const error = createMockError('SQL injection vulnerability');

      const suggestions = await engine.generateSuggestions(error);

      const securitySuggestions = suggestions.filter(s => s.type === 'security');
      expect(securitySuggestions.length).toBeGreaterThan(0);

      // Security suggestions should be ranked higher
      const securityIndex = suggestions.findIndex(s => s.type === 'security');
      expect(securityIndex).toBeLessThan(3);
    });
  });

  describe('Stack Trace Analysis', () => {
    it('should analyze deep call stacks', async () => {
      const error = createMockError('Stack overflow');
      const deepStack: StackTrace = {
        traceId: 'trace-1',
        language: 'javascript' as Language,
        frames: Array.from({ length: 60 }, (_, i) => ({
          index: i,
          language: 'javascript' as Language,
          functionName: `function${i}`,
          raw: `at function${i} (/src/file.js:${i}:0)`,
          isAsync: false,
          isLibrary: false,
          isApp: true,
        })),
        raw: '',
        appFrames: [],
        libraryFrames: [],
        asyncFrames: [],
        timestamp: Date.now(),
      };

      const suggestions = await engine.generateSuggestions(error, deepStack);

      const depthSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('call stack')
      );

      expect(depthSuggestion).toBeDefined();
      expect(depthSuggestion?.description).toContain('60');
    });

    it('should analyze async complexity', async () => {
      const error = createMockError('Async error');
      const asyncStack: StackTrace = {
        traceId: 'trace-1',
        language: 'javascript' as Language,
        frames: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          language: 'javascript' as Language,
          functionName: `asyncFunction${i}`,
          raw: `at asyncFunction${i} (/src/file.js:${i}:0)`,
          isAsync: true,
          isLibrary: false,
          isApp: true,
        })),
        raw: '',
        appFrames: [],
        libraryFrames: [],
        asyncFrames: [],
        timestamp: Date.now(),
      };

      const suggestions = await engine.generateSuggestions(error, asyncStack);

      const asyncSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('async') &&
        s.description.toLowerCase().includes('async')
      );

      expect(asyncSuggestion).toBeDefined();
      expect(asyncSuggestion?.tags).toContain('async');
    });

    it('should analyze library dependency', async () => {
      const error = createMockError('Library error');
      const libStack: StackTrace = {
        traceId: 'trace-1',
        language: 'javascript' as Language,
        frames: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          language: 'javascript' as Language,
          filePath: i < 8 ? '/node_modules/lib/index.js' : '/src/app.js',
          functionName: `function${i}`,
          raw: `at function${i} (${i < 8 ? '/node_modules/lib/index.js' : '/src/app.js'}:${i}:0)`,
          isAsync: false,
          isLibrary: i < 8,
          isApp: i >= 8,
        })),
        raw: '',
        appFrames: [],
        libraryFrames: [],
        asyncFrames: [],
        timestamp: Date.now(),
      };

      const suggestions = await engine.generateSuggestions(error, libStack);

      const depSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('dependency') ||
        s.description.toLowerCase().includes('library')
      );

      expect(depSuggestion).toBeDefined();
    });
  });

  describe('Root Cause Analysis', () => {
    it('should generate suggestions from root cause', async () => {
      const error = createMockError('Test error');
      const stackTrace = createMockStackTrace();

      const rootCause: RootCauseAnalysis = {
        analysisId: 'rc-1',
        rootCause: 'Null reference error',
        confidence: 0.85,
        category: 'code_bug',
        explanation: 'Attempted to access property on null value',
        factors: [
          {
            factor: 'Missing null check',
            impact: 0.9,
            evidence: ['Error message indicates null reference'],
          },
        ],
        evidence: [],
        prevention: ['Add null checks', 'Use optional chaining'],
      };

      const suggestions = await engine.generateSuggestions(error, stackTrace, rootCause);

      expect(suggestions.length).toBeGreaterThan(0);

      const preventionSuggestions = suggestions.filter(s =>
        s.tags.includes('prevention')
      );

      expect(preventionSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Best Practices', () => {
    it('should suggest logging improvements', async () => {
      const error = createMockError('Unknown error occurred');

      const suggestions = await engine.generateSuggestions(error);

      const loggingSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('logging') ||
        s.description.toLowerCase().includes('logging')
      );

      expect(loggingSuggestion).toBeDefined();
      expect(loggingSuggestion?.type).toBe('observability');
    });

    it('should suggest monitoring setup', async () => {
      const error = createMockError('Unhandled exception');

      const suggestions = await engine.generateSuggestions(error);

      const monitoringSuggestion = suggestions.find(s =>
        s.title.toLowerCase().includes('monitoring') ||
        s.description.toLowerCase().includes('monitoring')
      );

      expect(monitoringSuggestion).toBeDefined();
      expect(monitoringSuggestion?.type).toBe('observability');
    });
  });

  describe('Suggestion Ranking', () => {
    it('should rank security suggestions highest', async () => {
      const errors = [
        createMockError('SQL injection'),
        createMockError('Null reference'),
        createMockError('Timeout'),
      ];

      const allSuggestions: string[] = [];
      for (const error of errors) {
        const suggestions = await engine.generateSuggestions(error);
        allSuggestions.push(...suggestions.map(s => s.type));
      }

      const securityIndex = allSuggestions.indexOf('security');
      expect(securityIndex).toBeGreaterThanOrEqual(0);
      expect(securityIndex).toBeLessThan(5); // Should be in top 5
    });

    it('should rank by confidence', async () => {
      const error = createMockError('Cannot read property "test" of undefined');

      const suggestions = await engine.generateSuggestions(error);

      // Suggestions should be sorted by confidence
      for (let i = 0; i < suggestions.length - 1; i++) {
        if (suggestions[i].type === suggestions[i + 1].type) {
          expect(suggestions[i].confidence).toBeGreaterThanOrEqual(
            suggestions[i + 1].confidence
          );
        }
      }
    });
  });

  describe('Impact Assessment', () => {
    it('should assess error reduction impact', async () => {
      const error = createMockError('Test error');

      const suggestions = await engine.generateSuggestions(error);

      for (const suggestion of suggestions) {
        expect(suggestion.impact).toBeDefined();
        expect(suggestion.impact.errorReduction).toBeGreaterThanOrEqual(0);
        expect(suggestion.impact.errorReduction).toBeLessThanOrEqual(1);
      }
    });

    it('should assess performance impact', async () => {
      const error = createMockError('Slow operation');

      const suggestions = await engine.generateSuggestions(error);

      for (const suggestion of suggestions) {
        expect(suggestion.impact.performanceImpact).toMatch(/^(positive|neutral|negative)$/);
      }
    });

    it('should assess risk level', async () => {
      const error = createMockError('Test error');

      const suggestions = await engine.generateSuggestions(error);

      for (const suggestion of suggestions) {
        expect(suggestion.impact.riskLevel).toMatch(/^(low|medium|high)$/);
      }
    });
  });

  describe('Effort Estimation', () => {
    it('should estimate implementation effort', async () => {
      const error = createMockError('Test error');

      const suggestions = await engine.generateSuggestions(error);

      for (const suggestion of suggestions) {
        expect(suggestion.effort).toMatch(/^(low|medium|high)$/);
      }
    });

    it('should estimate higher effort for architecture changes', async () => {
      const error = createMockError('Scalability issue');

      const suggestions = await engine.generateSuggestions(error);
      const archSuggestions = suggestions.filter(s => s.type === 'architecture');

      for (const suggestion of archSuggestions) {
        expect(suggestion.effort).toBe('high');
      }
    });
  });

  describe('References', () => {
    it('should include relevant references', async () => {
      const error = createMockError('Cannot read property "test" of undefined');

      const suggestions = await engine.generateSuggestions(error);

      const suggestionWithRefs = suggestions.find(s => s.references.length > 0);

      expect(suggestionWithRefs).toBeDefined();
      expect(suggestionWithRefs?.references[0].title).toBeDefined();
      expect(suggestionWithRefs?.references[0].url).toBeDefined();
      expect(suggestionWithRefs?.references[0].type).toBeDefined();
    });
  });
});

describe('Convenience Functions', () => {
  it('should generate suggestions using convenience function', async () => {
    const error: ErrorInfo = {
      errorId: 'error-1',
      errorType: 'TestError',
      message: 'Cannot read property "test" of undefined',
      stackTrace: '',
      timestamp: Date.now(),
      source: 'test',
      severity: 'medium',
      category: 'runtime' as ErrorCategory,
      recoverable: true,
      context: {},
    };

    const suggestions = await generateSuggestions(error);

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
