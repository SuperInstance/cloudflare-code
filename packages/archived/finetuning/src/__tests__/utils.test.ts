/**
 * Utility Functions Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MathUtils,
  TimeUtils,
  TokenUtils,
  ValidationUtils,
  HyperparameterUtils,
  ProgressUtils,
  MetricsUtils,
  ErrorUtils,
  AsyncUtils,
  StringUtils,
} from '../utils/helpers';

describe('MathUtils', () => {
  it('should calculate mean', () => {
    expect(MathUtils.mean([1, 2, 3, 4, 5])).toBe(3);
    expect(MathUtils.mean([10, 20, 30])).toBe(20);
  });

  it('should calculate median', () => {
    expect(MathUtils.median([1, 2, 3, 4, 5])).toBe(3);
    expect(MathUtils.median([1, 2, 3, 4])).toBe(2.5);
  });

  it('should calculate standard deviation', () => {
    const stdDev = MathUtils.stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stdDev).toBeCloseTo(2, 0);
  });

  it('should calculate percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(MathUtils.percentile(values, 50)).toBe(5);
    expect(MathUtils.percentile(values, 90)).toBe(9);
  });

  it('should clamp values', () => {
    expect(MathUtils.clamp(5, 0, 10)).toBe(5);
    expect(MathUtils.clamp(-5, 0, 10)).toBe(0);
    expect(MathUtils.clamp(15, 0, 10)).toBe(10);
  });

  it('should calculate EMA', () => {
    const values = [1, 2, 3, 4, 5];
    const ema = MathUtils.ema(values, 0.5);
    expect(ema).toHaveLength(5);
    expect(ema[0]).toBe(1);
  });
});

describe('TimeUtils', () => {
  it('should format duration', () => {
    expect(TimeUtils.formatDuration(1000)).toBe('1s');
    expect(TimeUtils.formatDuration(60000)).toBe('1m 0s');
    expect(TimeUtils.formatDuration(3600000)).toBe('1h 0m 0s');
    expect(TimeUtils.formatDuration(86400000)).toBe('1d 0h 0m');
  });

  it('should parse duration', () => {
    expect(TimeUtils.parseDuration('5s')).toBe(5000);
    expect(TimeUtils.parseDuration('10m')).toBe(600000);
    expect(TimeUtils.parseDuration('2h')).toBe(7200000);
    expect(TimeUtils.parseDuration('1d')).toBe(86400000);
  });

  it('should calculate time ago', () => {
    const now = Date.now();
    expect(TimeUtils.timeAgo(now)).toBe('just now');
    expect(TimeUtils.timeAgo(now - 30000)).toBe('30s ago');
    expect(TimeUtils.timeAgo(now - 60000)).toBe('1m ago');
  });
});

describe('TokenUtils', () => {
  it('should estimate tokens', () => {
    const text = 'Hello world, this is a test';
    const tokens = TokenUtils.estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should estimate message tokens', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const tokens = TokenUtils.estimateMessageTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should truncate to tokens', () => {
    const text = 'Hello world, this is a test of the token truncation';
    const truncated = TokenUtils.truncateToTokens(text, 5);
    expect(truncated.length).toBeLessThan(text.length);
  });
});

describe('ValidationUtils', () => {
  it('should validate emails', () => {
    expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true);
    expect(ValidationUtils.isValidEmail('invalid')).toBe(false);
  });

  it('should validate URLs', () => {
    expect(ValidationUtils.isValidUrl('https://example.com')).toBe(true);
    expect(ValidationUtils.isValidUrl('not-a-url')).toBe(false);
  });

  it('should validate UUIDs', () => {
    expect(ValidationUtils.isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(ValidationUtils.isValidUuid('not-a-uuid')).toBe(false);
  });

  it('should sanitize strings', () => {
    const input = '  <script>alert("xss")</script>  ';
    const sanitized = ValidationUtils.sanitizeString(input);
    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
  });
});

describe('HyperparameterUtils', () => {
  it('should validate hyperparameters', () => {
    const valid = {
      learningRate: 0.0001,
      batchSize: 32,
      epochs: 3,
    };

    const result = HyperparameterUtils.validate(valid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid hyperparameters', () => {
    const invalid = {
      learningRate: 2.0, // Invalid: > 1
      batchSize: 0, // Invalid: < 1
      epochs: 0, // Invalid: < 1
    };

    const result = HyperparameterUtils.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should get default hyperparameters', () => {
    const defaults = HyperparameterUtils.getDefaults();
    expect(defaults.learningRate).toBe(0.0001);
    expect(defaults.batchSize).toBe(32);
    expect(defaults.epochs).toBe(3);
  });

  it('should suggest hyperparameters for dataset', () => {
    const small = HyperparameterUtils.suggestForDataset(500);
    const large = HyperparameterUtils.suggestForDataset(50000);

    expect(small.epochs).toBeGreaterThanOrEqual(large.epochs);
    expect(small.batchSize).toBeLessThanOrEqual(large.batchSize);
  });
});

describe('ProgressUtils', () => {
  it('should calculate percentage', () => {
    expect(ProgressUtils.calculatePercentage(50, 100)).toBe(50);
    expect(ProgressUtils.calculatePercentage(0, 100)).toBe(0);
    expect(ProgressUtils.calculatePercentage(100, 100)).toBe(100);
  });

  it('should estimate ETA', () => {
    const eta = ProgressUtils.estimateEta(50, 100, 60000); // 50% done in 1 minute
    expect(eta).toBe(60000); // 1 minute remaining
  });

  it('should calculate speed', () => {
    const speed = ProgressUtils.calculateSpeed(100, 10000); // 100 steps in 10 seconds
    expect(speed).toBe(10); // 10 steps per second
  });

  it('should format progress bar', () => {
    const bar50 = ProgressUtils.formatProgressBar(50, 10);
    const bar100 = ProgressUtils.formatProgressBar(100, 10);

    expect(bar50).toContain('=');
    expect(bar100).toContain('=');
  });
});

describe('MetricsUtils', () => {
  it('should calculate improvement', () => {
    const improvement = MetricsUtils.calculateImprovement(1.0, 0.8, true);
    expect(improvement).toBe(20); // 20% improvement
  });

  it('should detect significant changes', () => {
    expect(MetricsUtils.isSignificant(1.0, 1.1, 0.05)).toBe(true);
    expect(MetricsUtils.isSignificant(1.0, 1.02, 0.05)).toBe(false);
  });

  it('should smooth metrics', () => {
    const values = [1, 2, 3, 4, 5];
    const smoothed = MetricsUtils.smoothMetrics(values, 3);
    expect(smoothed).toHaveLength(5);
  });

  it('should find best value', () => {
    const values = [5, 2, 8, 1, 9];
    const best = MetricsUtils.findBest(values, true); // lower is better
    expect(best.value).toBe(1);
    expect(best.index).toBe(3);
  });

  it('should summarize metrics', () => {
    const values = [1, 2, 3, 4, 5];
    const summary = MetricsUtils.summarize(values);

    expect(summary.min).toBe(1);
    expect(summary.max).toBe(5);
    expect(summary.mean).toBe(3);
    expect(summary.median).toBe(3);
  });
});

describe('ErrorUtils', () => {
  it('should create error response', () => {
    const response = ErrorUtils.createErrorResponse('Test error', 'TEST_ERROR');
    expect(response.success).toBe(false);
    expect(response.error.message).toBe('Test error');
    expect(response.error.code).toBe('TEST_ERROR');
  });

  it('should detect retryable errors', () => {
    const retryable = { code: 'RATE_LIMIT_EXCEEDED' };
    const nonRetryable = { code: 'INVALID_INPUT' };

    expect(ErrorUtils.isRetryable(retryable)).toBe(true);
    expect(ErrorUtils.isRetryable(nonRetryable)).toBe(false);
  });

  it('should extract error message', () => {
    expect(ErrorUtils.getErrorMessage('Plain string')).toBe('Plain string');
    expect(ErrorUtils.getErrorMessage(new Error('Error object'))).toBe('Error object');
    expect(ErrorUtils.getErrorMessage(null)).toBe('An unknown error occurred');
  });
});

describe('StringUtils', () => {
  it('should generate random ID', () => {
    const id1 = StringUtils.randomId();
    const id2 = StringUtils.randomId();

    expect(id1).toHaveLength(16);
    expect(id2).toHaveLength(16);
    expect(id1).not.toBe(id2);
  });

  it('should slugify text', () => {
    expect(StringUtils.slugify('Hello World!')).toBe('hello-world');
    expect(StringUtils.slugify('Test Multiple   Spaces')).toBe('test-multiple-spaces');
  });

  it('should truncate text', () => {
    expect(StringUtils.truncate('Hello World', 5)).toBe('He...');
    expect(StringUtils.truncate('Hi', 10)).toBe('Hi');
  });

  it('should capitalize text', () => {
    expect(StringUtils.capitalize('hello')).toBe('Hello');
  });

  it('should convert case', () => {
    expect(StringUtils.camelToSnake('myVariable')).toBe('my_variable');
    expect(StringUtils.snakeToCamel('my_variable')).toBe('myVariable');
  });
});

describe('AsyncUtils', () => {
  it('should sleep', async () => {
    const start = Date.now();
    await AsyncUtils.sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw { code: 'RATE_LIMIT_EXCEEDED' };
      return 'success';
    };

    const result = await AsyncUtils.retry(fn);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = async () => {
      throw { code: 'INVALID_INPUT' };
    };

    await expect(AsyncUtils.retry(fn)).rejects.toThrow();
  });
});
