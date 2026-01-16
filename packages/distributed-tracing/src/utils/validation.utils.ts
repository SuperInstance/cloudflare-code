/**
 * Validation utilities for distributed tracing
 * Validates spans, traces, and related data structures
 */

import {
  Span,
  Trace,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types/trace.types';
import { isValidTraceId, isValidSpanId } from './id.generator';

/**
 * Validate a span
 */
export function validateSpan(span: Span): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!span.traceId) {
    errors.push({
      field: 'traceId',
      message: 'traceId is required',
      code: 'MISSING_TRACE_ID',
      severity: 'error',
    });
  } else if (!isValidTraceId(span.traceId)) {
    errors.push({
      field: 'traceId',
      message: 'traceId must be 32 hex characters',
      code: 'INVALID_TRACE_ID',
      severity: 'error',
    });
  }

  if (!span.spanId) {
    errors.push({
      field: 'spanId',
      message: 'spanId is required',
      code: 'MISSING_SPAN_ID',
      severity: 'error',
    });
  } else if (!isValidSpanId(span.spanId)) {
    errors.push({
      field: 'spanId',
      message: 'spanId must be 16 hex characters',
      code: 'INVALID_SPAN_ID',
      severity: 'error',
    });
  }

  if (!span.name) {
    errors.push({
      field: 'name',
      message: 'name is required',
      code: 'MISSING_NAME',
      severity: 'error',
    });
  }

  if (!span.service) {
    errors.push({
      field: 'service',
      message: 'service is required',
      code: 'MISSING_SERVICE',
      severity: 'error',
    });
  }

  // Temporal validation
  if (span.startTime === undefined || span.startTime === null) {
    errors.push({
      field: 'startTime',
      message: 'startTime is required',
      code: 'MISSING_START_TIME',
      severity: 'error',
    });
  }

  if (span.endTime !== undefined && span.endTime !== null) {
    if (span.endTime < span.startTime) {
      errors.push({
        field: 'endTime',
        message: 'endTime must be after startTime',
        code: 'INVALID_END_TIME',
        severity: 'error',
      });
    }
  }

  if (span.duration !== undefined && span.duration !== null) {
    if (span.duration < 0) {
      errors.push({
        field: 'duration',
        message: 'duration must be non-negative',
        code: 'INVALID_DURATION',
        severity: 'error',
      });
    }

    if (span.endTime !== undefined && span.startTime !== undefined) {
      const calculatedDuration = span.endTime - span.startTime;
      if (Math.abs(calculatedDuration - span.duration) > 1000) {
        // Allow 1ms tolerance
        warnings.push({
          field: 'duration',
          message: 'duration does not match endTime - startTime',
          code: 'DURATION_MISMATCH',
          severity: 'warning',
        });
      }
    }
  }

  // Parent validation
  if (span.parentSpanId === span.spanId) {
    errors.push({
      field: 'parentSpanId',
      message: 'parentSpanId cannot be the same as spanId',
      code: 'INVALID_PARENT',
      severity: 'error',
    });
  }

  // Status validation
  if (span.status && span.status.code === 2 && !span.status.message) {
    warnings.push({
      field: 'status.message',
      message: 'error status should include a message',
      code: 'MISSING_ERROR_MESSAGE',
      severity: 'warning',
    });
  }

  // Attribute validation
  if (span.attributes) {
    const invalidKeys = Object.keys(span.attributes).filter(
      (key) => !isValidAttributeKey(key)
    );
    if (invalidKeys.length > 0) {
      warnings.push({
        field: 'attributes',
        message: `Invalid attribute keys: ${invalidKeys.join(', ')}`,
        code: 'INVALID_ATTRIBUTE_KEYS',
        severity: 'warning',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a complete trace
 */
export function validateTrace(trace: Trace): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!trace.traceId) {
    errors.push({
      field: 'traceId',
      message: 'traceId is required',
      code: 'MISSING_TRACE_ID',
      severity: 'error',
    });
  }

  if (!trace.rootSpan) {
    errors.push({
      field: 'rootSpan',
      message: 'rootSpan is required',
      code: 'MISSING_ROOT_SPAN',
      severity: 'error',
    });
  }

  if (!trace.spans || trace.spans.length === 0) {
    errors.push({
      field: 'spans',
      message: 'trace must have at least one span',
      code: 'EMPTY_TRACE',
      severity: 'error',
    });
  }

  // Validate all spans
  if (trace.spans) {
    trace.spans.forEach((span, index) => {
      const spanValidation = validateSpan(span);
      if (!spanValidation.valid) {
        errors.push(
          ...spanValidation.errors.map((e) => ({
            ...e,
            field: `spans[${index}].${e.field}`,
          }))
        );
      }
      warnings.push(
        ...spanValidation.warnings.map((w) => ({
          ...w,
          field: `spans[${index}].${w.field}`,
        }))
      );
    });
  }

  // Validate trace consistency
  if (trace.spans && trace.spans.length > 0) {
    const traceIds = new Set(trace.spans.map((s) => s.traceId));
    if (traceIds.size !== 1 || !traceIds.has(trace.traceId)) {
      errors.push({
        field: 'spans',
        message: 'All spans must have the same traceId',
        code: 'INCONSISTENT_TRACE_IDS',
        severity: 'error',
      });
    }

    // Check for duplicate span IDs
    const spanIds = new Set(trace.spans.map((s) => s.spanId));
    if (spanIds.size !== trace.spans.length) {
      errors.push({
        field: 'spans',
        message: 'Duplicate span IDs detected',
        code: 'DUPLICATE_SPAN_IDS',
        severity: 'error',
      });
    }
  }

  // Temporal validation
  if (trace.startTime !== undefined && trace.endTime !== undefined) {
    if (trace.endTime < trace.startTime) {
      errors.push({
        field: 'endTime',
        message: 'endTime must be after startTime',
        code: 'INVALID_END_TIME',
        severity: 'error',
      });
    }

    if (trace.duration !== undefined) {
      const calculatedDuration = trace.endTime - trace.startTime;
      if (Math.abs(calculatedDuration - trace.duration) > 1000) {
        warnings.push({
          field: 'duration',
          message: 'duration does not match endTime - startTime',
          code: 'DURATION_MISMATCH',
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate attribute key according to OpenTelemetry spec
 */
export function isValidAttributeKey(key: string): boolean {
  // Must start with a letter or underscore
  // Can contain letters, numbers, dots, underscores, and hyphens
  return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(key);
}

/**
 * Validate attribute value
 */
export function isValidAttributeValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const allowedTypes = ['string', 'number', 'boolean'];
  if (allowedTypes.includes(typeof value)) {
    return true;
  }

  // Allow arrays of primitive types
  if (Array.isArray(value)) {
    return value.every((v) => isValidAttributeValue(v));
  }

  return false;
}

/**
 * Check if span is root span
 */
export function isRootSpan(span: Span): boolean {
  return !span.parentSpanId;
}

/**
 * Check if span has errors
 */
export function hasErrors(span: Span): boolean {
  return span.status?.code === 2; // ERROR
}

/**
 * Check if trace has errors
 */
export function traceHasErrors(trace: Trace): boolean {
  return trace.spans.some(hasErrors);
}

/**
 * Get error spans from trace
 */
export function getErrorSpans(trace: Trace): Span[] {
  return trace.spans.filter(hasErrors);
}

/**
 * Calculate trace completeness score
 */
export function calculateCompleteness(trace: Trace): number {
  let score = 1.0;

  // Check for orphaned spans (spans with parentSpanId that doesn't exist)
  const spanIds = new Set(trace.spans.map((s) => s.spanId));
  const orphanedCount = trace.spans.filter(
    (s) => s.parentSpanId && !spanIds.has(s.parentSpanId)
  ).length;

  // Penalize orphaned spans
  score -= (orphanedCount / trace.spans.length) * 0.3;

  // Check for missing time data
  const spansWithoutDuration = trace.spans.filter((s) => !s.duration).length;
  score -= (spansWithoutDuration / trace.spans.length) * 0.2;

  // Check for root span
  if (!trace.rootSpan) {
    score -= 0.5;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Sanitize span data (remove sensitive information)
 */
export function sanitizeSpan(span: Span, sensitiveKeys: string[] = []): Span {
  const sanitized = { ...span };

  if (sanitized.attributes) {
    const defaultSensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey'];
    const keysToSanitize = [...defaultSensitiveKeys, ...sensitiveKeys];

    sanitized.attributes = Object.fromEntries(
      Object.entries(sanitized.attributes).filter(([key]) => {
        const lowerKey = key.toLowerCase();
        return !keysToSanitize.some((sensitive) => lowerKey.includes(sensitive));
      })
    );
  }

  return sanitized;
}

/**
 * Sanitize trace data
 */
export function sanitizeTrace(trace: Trace, sensitiveKeys: string[] = []): Trace {
  return {
    ...trace,
    spans: trace.spans.map((s) => sanitizeSpan(s, sensitiveKeys)),
    rootSpan: sanitizeSpan(trace.rootSpan, sensitiveKeys),
  };
}
