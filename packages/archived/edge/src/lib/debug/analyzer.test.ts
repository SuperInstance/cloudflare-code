/**
 * Error Analyzer Tests
 */

import { describe, it, expect } from 'vitest';
import { ErrorAnalyzer, analyzeError } from './analyzer';
import type { ErrorInfo, ErrorCategory } from './types';

describe('ErrorAnalyzer', () => {
  const analyzer = new ErrorAnalyzer();

  const createMockError = (message: string, category: ErrorCategory): ErrorInfo => ({
    errorId: 'test-error-1',
    errorType: 'TestError',
    message,
    stackTrace: 'Error: Test\n    at method (/src/file.js:10:15)',
    timestamp: Date.now(),
    source: 'test-service',
    severity: 'high',
    category,
    recoverable: true,
    context: {},
  });

  describe('Root Cause Analysis', () => {
    it('should detect null reference errors', async () => {
      const error = createMockError(
        'Cannot read property "test" of undefined',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause).toBeDefined();
      expect(result.rootCause?.confidence).toBeGreaterThan(0);
      expect(result.rootCause?.category).toBeDefined();
    });

    it('should detect timeout errors', async () => {
      const error = createMockError(
        'Request timed out after 30000ms',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause).toBeDefined();
      expect(result.rootCause?.factors).toBeDefined();
      expect(result.rootCause?.factors.length).toBeGreaterThan(0);
    });

    it('should detect memory errors', async () => {
      const error = createMockError(
        'JavaScript heap out of memory',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause).toBeDefined();
      expect(result.rootCause?.category).toBe('resource_exhaustion');
    });

    it('should detect network errors', async () => {
      const error = createMockError(
        'ECONNREFUSED: Connection refused',
        'network' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause).toBeDefined();
      expect(result.rootCause?.category).toBe('external_dependency');
    });

    it('should detect permission errors', async () => {
      const error = createMockError(
        'EACCES: permission denied',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause).toBeDefined();
      expect(result.rootCause?.category).toBe('permission_denied');
    });
  });

  describe('Contributing Factors', () => {
    it('should identify contributing factors', async () => {
      const error = createMockError(
        'Timeout occurred while waiting for response',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        stackTrace: 'Error: Timeout\n    at asyncMethod (/src/file.js:10:15)\n    at asyncMethod (/src/file.js:20:8)',
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause?.factors).toBeDefined();
      expect(result.rootCause?.factors.length).toBeGreaterThan(0);
      expect(result.rootCause?.factors[0].impact).toBeGreaterThan(0);
    });
  });

  describe('Evidence Gathering', () => {
    it('should gather evidence from error context', async () => {
      const error = createMockError('Test error', 'runtime' as ErrorCategory);
      error.context = {
        requestId: 'req-123',
        userId: 'user-456',
        customField: 'value',
      };

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause?.evidence).toBeDefined();
      expect(result.rootCause?.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('Preventive Measures', () => {
    it('should suggest preventive measures', async () => {
      const error = createMockError(
        'Cannot read property "test" of undefined',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause?.prevention).toBeDefined();
      expect(result.rootCause?.prevention.length).toBeGreaterThan(0);
      expect(result.rootCause?.prevention[0]).toBeTruthy();
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate confidence scores', async () => {
      const error = createMockError(
        'Cannot read property "test" of undefined',
        'runtime' as ErrorCategory
      );

      const result = await analyzer.analyze({
        error,
        stackTrace: 'Error: Test\n    at appMethod (/src/app.js:10:15)',
        options: {
          includeStackTrace: true,
          correlateLogs: false,
          searchSimilarErrors: false,
          generateSuggestions: false,
          analyzePerformance: false,
          detectAnomalies: false,
          maxSimilarErrors: 10,
          logCorrelationWindow: 60000,
        },
      });

      expect(result.rootCause?.confidence).toBeGreaterThan(0);
      expect(result.rootCause?.confidence).toBeLessThanOrEqual(1);
    });
  });
});

describe('analyzeError convenience function', () => {
  it('should analyze error with default options', async () => {
    const error: ErrorInfo = {
      errorId: 'test-1',
      errorType: 'TestError',
      message: 'Test error message',
      stackTrace: '',
      timestamp: Date.now(),
      source: 'test',
      severity: 'medium',
      category: 'runtime' as ErrorCategory,
      recoverable: true,
      context: {},
    };

    const result = await analyzeError(error);

    expect(result).toBeDefined();
    expect(result.analysisId).toBeDefined();
    expect(result.rootCause).toBeDefined();
  });
});
