/**
 * Unit tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateTraceId,
  generateSpanId,
  isValidTraceId,
  isValidSpanId,
} from '../../src/utils/id.generator';
import {
  msToUs,
  usToMs,
  calculateDuration,
  calculatePercentile,
  calculateAverage,
  calculateMedian,
  calculateStandardDeviation,
  calculateDurationStatistics,
  formatDuration,
} from '../../src/utils/time.utils';
import {
  validateSpan,
  validateTrace,
  isValidTraceId as validateIsValidTraceId,
  isValidSpanId as validateIsValidSpanId,
  hasErrors,
  traceHasErrors,
  getErrorSpans,
  calculateCompleteness,
  sanitizeSpan,
} from '../../src/utils/validation.utils';
import { Span, Trace, SpanKind, TraceId, SpanId, Duration } from '../../src/types/trace.types';

describe('ID Generator', () => {
  describe('generateTraceId', () => {
    it('should generate a valid 32-character hex string', () => {
      const traceId = generateTraceId();
      expect(traceId).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/i.test(traceId)).toBe(true);
    });

    it('should generate unique trace IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateTraceId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('generateSpanId', () => {
    it('should generate a valid 16-character hex string', () => {
      const spanId = generateSpanId();
      expect(spanId).toHaveLength(16);
      expect(/^[0-9a-f]{16}$/i.test(spanId)).toBe(true);
    });

    it('should generate unique span IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateSpanId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('isValidTraceId', () => {
    it('should validate correct trace IDs', () => {
      expect(isValidTraceId('0123456789abcdef0123456789abcdef')).toBe(true);
      expect(isValidTraceId('ABCDEF0123456789ABCDEF0123456789')).toBe(true);
    });

    it('should reject invalid trace IDs', () => {
      expect(isValidTraceId('invalid')).toBe(false);
      expect(isValidTraceId('0123456789abcdef')).toBe(false); // Too short
      expect(isValidTraceId('')).toBe(false);
    });
  });

  describe('isValidSpanId', () => {
    it('should validate correct span IDs', () => {
      expect(isValidSpanId('0123456789abcdef')).toBe(true);
      expect(isValidSpanId('ABCDEF0123456789')).toBe(true);
    });

    it('should reject invalid span IDs', () => {
      expect(isValidSpanId('invalid')).toBe(false);
      expect(isValidSpanId('0123456789')).toBe(false); // Too short
      expect(isValidSpanId('')).toBe(false);
    });
  });
});

describe('Time Utils', () => {
  describe('msToUs', () => {
    it('should convert milliseconds to microseconds', () => {
      expect(msToUs(1)).toBe(1000);
      expect(msToUs(0.5)).toBe(500);
      expect(msToUs(0)).toBe(0);
    });
  });

  describe('usToMs', () => {
    it('should convert microseconds to milliseconds', () => {
      expect(usToMs(1000)).toBe(1);
      expect(usToMs(500)).toBe(0.5);
      expect(usToMs(0)).toBe(0);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration between timestamps', () => {
      expect(calculateDuration(1000, 2000)).toBe(1000);
      expect(calculateDuration(0, 100)).toBe(100);
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(calculatePercentile(values, 50)).toBe(5);
      expect(calculatePercentile(values, 90)).toBe(9);
      expect(calculatePercentile(values, 95)).toBe(10);
    });

    it('should handle empty arrays', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });
  });

  describe('calculateAverage', () => {
    it('should calculate average correctly', () => {
      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateAverage([10, 20, 30])).toBe(20);
    });

    it('should handle empty arrays', () => {
      expect(calculateAverage([])).toBe(0);
    });
  });

  describe('calculateMedian', () => {
    it('should calculate median for odd-length arrays', () => {
      expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateMedian([10, 5, 7])).toBe(7);
    });

    it('should calculate median for even-length arrays', () => {
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
      expect(calculateMedian([10, 20, 30, 40])).toBe(25);
    });

    it('should handle empty arrays', () => {
      expect(calculateMedian([])).toBe(0);
    });
  });

  describe('calculateStandardDeviation', () => {
    it('should calculate standard deviation', () => {
      expect(calculateStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
    });

    it('should handle empty arrays', () => {
      expect(calculateStandardDeviation([])).toBe(0);
    });
  });

  describe('calculateDurationStatistics', () => {
    it('should calculate comprehensive statistics', () => {
      const values = [100, 200, 300, 400, 500];
      const stats = calculateDurationStatistics(values);

      expect(stats.count).toBe(5);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(500);
      expect(stats.avg).toBe(300);
      expect(stats.median).toBe(300);
      expect(stats.p50).toBe(300);
      expect(stats.p95).toBe(500);
      expect(stats.p99).toBe(500);
    });

    it('should handle empty arrays', () => {
      const stats = calculateDurationStatistics([]);
      expect(stats.count).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format microseconds', () => {
      expect(formatDuration(500)).toBe('500.00μs');
    });

    it('should format milliseconds', () => {
      expect(formatDuration(1500)).toBe('1.50ms');
      expect(formatDuration(1000000)).toBe('1.00s');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000000)).toBe('5.00s');
    });

    it('should format minutes', () => {
      expect(formatDuration(120000000)).toBe('2m 0s');
    });
  });
});

describe('Validation Utils', () => {
  const createValidSpan = (): Span => ({
    traceId: '0123456789abcdef0123456789abcdef' as TraceId,
    spanId: '0123456789abcdef' as SpanId,
    name: 'test-span',
    kind: SpanKind.INTERNAL,
    startTime: 1000,
    endTime: 2000,
    duration: 1000,
    status: { code: 1 },
    service: 'test-service',
  });

  describe('validateSpan', () => {
    it('should validate a correct span', () => {
      const span = createValidSpan();
      const result = validateSpan(span);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject span with missing traceId', () => {
      const span = createValidSpan();
      delete (span as any).traceId;

      const result = validateSpan(span);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'traceId')).toBe(true);
    });

    it('should reject span with invalid traceId format', () => {
      const span = createValidSpan();
      (span as any).traceId = 'invalid';

      const result = validateSpan(span);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TRACE_ID')).toBe(true);
    });

    it('should reject span with missing spanId', () => {
      const span = createValidSpan();
      delete (span as any).spanId;

      const result = validateSpan(span);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'spanId')).toBe(true);
    });

    it('should reject span with endTime before startTime', () => {
      const span = createValidSpan();
      span.endTime = 500;

      const result = validateSpan(span);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_END_TIME')).toBe(true);
    });

    it('should reject span where parentSpanId equals spanId', () => {
      const span = createValidSpan();
      span.parentSpanId = span.spanId;

      const result = validateSpan(span);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PARENT')).toBe(true);
    });

    it('should warn about error status without message', () => {
      const span = createValidSpan();
      span.status = { code: 2 }; // ERROR

      const result = validateSpan(span);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'MISSING_ERROR_MESSAGE')).toBe(true);
    });
  });

  describe('validateTrace', () => {
    const createValidTrace = (): Trace => ({
      traceId: '0123456789abcdef0123456789abcdef' as TraceId,
      rootSpan: createValidSpan(),
      spans: [createValidSpan()],
      startTime: 1000,
      endTime: 2000,
      duration: 1000,
      spanCount: 1,
      services: [],
      serviceMap: new Map(),
      completeness: {
        hasRootSpan: true,
        allSpansConnected: true,
        orphanedSpans: 0,
        missingSpans: 0,
        completenessScore: 1.0,
      },
    });

    it('should validate a correct trace', () => {
      const trace = createValidTrace();
      const result = validateTrace(trace);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject trace with inconsistent trace IDs', () => {
      const trace = createValidTrace();
      trace.spans[0].traceId = 'different' as TraceId;

      const result = validateTrace(trace);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INCONSISTENT_TRACE_IDS')).toBe(true);
    });

    it('should reject trace with duplicate span IDs', () => {
      const trace = createValidTrace();
      const span = createValidSpan();
      span.spanId = trace.spans[0].spanId;
      trace.spans.push(span);
      trace.spanCount = 2;

      const result = validateTrace(trace);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_SPAN_IDS')).toBe(true);
    });
  });

  describe('hasErrors', () => {
    it('should return true for error spans', () => {
      const span = createValidSpan();
      span.status = { code: 2 };
      expect(hasErrors(span)).toBe(true);
    });

    it('should return false for non-error spans', () => {
      const span = createValidSpan();
      span.status = { code: 1 };
      expect(hasErrors(span)).toBe(false);
    });
  });

  describe('traceHasErrors', () => {
    it('should return true if any span has errors', () => {
      const trace: Trace = {
        traceId: '0123456789abcdef0123456789abcdef' as TraceId,
        rootSpan: createValidSpan(),
        spans: [createValidSpan(), createValidSpan()],
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        spanCount: 2,
        services: [],
        serviceMap: new Map(),
        completeness: {
          hasRootSpan: true,
          allSpansConnected: true,
          orphanedSpans: 0,
          missingSpans: 0,
          completenessScore: 1.0,
        },
      };

      trace.spans[1].status = { code: 2 };

      expect(traceHasErrors(trace)).toBe(true);
    });

    it('should return false if no spans have errors', () => {
      const trace: Trace = {
        traceId: '0123456789abcdef0123456789abcdef' as TraceId,
        rootSpan: createValidSpan(),
        spans: [createValidSpan()],
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        spanCount: 1,
        services: [],
        serviceMap: new Map(),
        completeness: {
          hasRootSpan: true,
          allSpansConnected: true,
          orphanedSpans: 0,
          missingSpans: 0,
          completenessScore: 1.0,
        },
      };

      expect(traceHasErrors(trace)).toBe(false);
    });
  });

  describe('getErrorSpans', () => {
    it('should return only error spans', () => {
      const trace: Trace = {
        traceId: '0123456789abcdef0123456789abcdef' as TraceId,
        rootSpan: createValidSpan(),
        spans: [createValidSpan(), createValidSpan(), createValidSpan()],
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        spanCount: 3,
        services: [],
        serviceMap: new Map(),
        completeness: {
          hasRootSpan: true,
          allSpansConnected: true,
          orphanedSpans: 0,
          missingSpans: 0,
          completenessScore: 1.0,
        },
      };

      trace.spans[1].status = { code: 2 };
      trace.spans[2].status = { code: 2 };

      const errorSpans = getErrorSpans(trace);
      expect(errorSpans).toHaveLength(2);
      expect(errorSpans[0].spanId).toBe(trace.spans[1].spanId);
      expect(errorSpans[1].spanId).toBe(trace.spans[2].spanId);
    });
  });

  describe('calculateCompleteness', () => {
    it('should calculate completeness score', () => {
      const trace: Trace = {
        traceId: '0123456789abcdef0123456789abcdef' as TraceId,
        rootSpan: createValidSpan(),
        spans: [createValidSpan()],
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        spanCount: 1,
        services: [],
        serviceMap: new Map(),
        completeness: {
          hasRootSpan: true,
          allSpansConnected: true,
          orphanedSpans: 0,
          missingSpans: 0,
          completenessScore: 1.0,
        },
      };

      const score = calculateCompleteness(trace);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('sanitizeSpan', () => {
    it('should remove sensitive attributes', () => {
      const span = createValidSpan();
      span.attributes = {
        'user.name': 'John',
        'user.password': 'secret123',
        'api.key': 'abc123',
        'normal.field': 'value',
      };

      const sanitized = sanitizeSpan(span);

      expect(sanitized.attributes?.['user.name']).toBe('John');
      expect(sanitized.attributes?.['user.password']).toBeUndefined();
      expect(sanitized.attributes?.['api.key']).toBeUndefined();
      expect(sanitized.attributes?.['normal.field']).toBe('value');
    });

    it('should use custom sensitive keys', () => {
      const span = createValidSpan();
      span.attributes = {
        'custom.sensitive': 'secret',
        'normal.field': 'value',
      };

      const sanitized = sanitizeSpan(span, ['custom.sensitive']);

      expect(sanitized.attributes?.['custom.sensitive']).toBeUndefined();
      expect(sanitized.attributes?.['normal.field']).toBe('value');
    });
  });
});
