/**
 * Unit Tests for Provider Base Types and Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateChatTokens,
  normalizeError,
  validateProviderConfig,
  ProviderErrorType,
  type ProviderConfig,
} from '../../../../packages/edge/src/lib/providers/base';

describe('Provider Base Types', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens from text', () => {
      const text = 'Hello world! This is a test.';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      const tokens = estimateTokens(text);
      expect(tokens).toBe(250);
    });
  });

  describe('estimateChatTokens', () => {
    it('should estimate tokens from chat messages', () => {
      const messages = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const tokens = estimateChatTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty messages array', () => {
      expect(estimateChatTokens([])).toBe(0);
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate valid config', () => {
      const config: ProviderConfig = {
        apiKey: 'test-key',
        timeout: 10000,
        maxRetries: 3,
      };
      expect(() => validateProviderConfig(config)).not.toThrow();
    });

    it('should reject missing API key', () => {
      const config = { apiKey: '' } as ProviderConfig;
      expect(() => validateProviderConfig(config)).toThrow('Invalid API key');
    });

    it('should reject invalid timeout', () => {
      const config: ProviderConfig = {
        apiKey: 'test-key',
        timeout: 400000, // > 300000
      };
      expect(() => validateProviderConfig(config)).toThrow('Timeout must be between');
    });

    it('should reject invalid max retries', () => {
      const config: ProviderConfig = {
        apiKey: 'test-key',
        maxRetries: 15, // > 10
      };
      expect(() => validateProviderConfig(config)).toThrow('Max retries must be between');
    });
  });

  describe('normalizeError', () => {
    it('should normalize rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.RATE_LIMIT_ERROR);
      expect(normalized.provider).toBe('test-provider');
    });

    it('should normalize authentication errors', () => {
      const error = new Error('Unauthorized: Invalid API key');
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.AUTHENTICATION_ERROR);
    });

    it('should normalize quota errors', () => {
      const error = new Error('Quota exceeded');
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.QUOTA_EXCEEDED_ERROR);
    });

    it('should normalize server errors', () => {
      const error = new Error('500 Internal Server Error');
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.SERVER_ERROR);
    });

    it('should normalize timeout errors', () => {
      const error = new Error('Request timed out');
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.TIMEOUT_ERROR);
    });

    it('should normalize network errors', () => {
      const error = new Error('ECONNREFUSED');
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.NETWORK_ERROR);
    });

    it('should return ProviderError as-is', () => {
      const originalError = normalizeError('test', new Error('test'));
      const result = normalizeError('test', originalError);
      expect(result).toBe(originalError);
    });

    it('should handle unknown errors', () => {
      const error = 'string error';
      const normalized = normalizeError('test-provider', error);
      expect(normalized.type).toBe(ProviderErrorType.UNKNOWN_ERROR);
    });
  });
});
