/**
 * Custom error types for the A/B testing platform
 */

/**
 * Base error class for all A/B testing errors
 */
export class ABTestingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when an experiment is not found
 */
export class ExperimentNotFoundError extends ABTestingError {
  constructor(experimentId: string) {
    super(
      `Experiment ${experimentId} not found`,
      'EXPERIMENT_NOT_FOUND',
      { experimentId }
    );
  }
}

/**
 * Error thrown when a variant is not found
 */
export class VariantNotFoundError extends ABTestingError {
  constructor(variantId: string, experimentId?: string) {
    super(
      `Variant ${variantId} not found`,
      'VARIANT_NOT_FOUND',
      { variantId, experimentId }
    );
  }
}

/**
 * Error thrown when an experiment is not in a valid state for an operation
 */
export class InvalidExperimentStateError extends ABTestingError {
  constructor(
    experimentId: string,
    currentState: string,
    expectedStates: string[]
  ) {
    super(
      `Experiment ${experimentId} is in state ${currentState}, expected one of: ${expectedStates.join(', ')}`,
      'INVALID_EXPERIMENT_STATE',
      { experimentId, currentState, expectedStates }
    );
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends ABTestingError {
  constructor(field: string, message: string, value?: unknown) {
    super(
      `Validation failed for field ${field}: ${message}`,
      'VALIDATION_ERROR',
      { field, value }
    );
  }
}

/**
 * Error thrown when sample size is insufficient
 */
export class InsufficientSampleSizeError extends ABTestingError {
  constructor(
    currentSize: number,
    requiredSize: number,
    experimentId?: string
  ) {
    super(
      `Insufficient sample size: ${currentSize} < ${requiredSize}`,
      'INSUFFICIENT_SAMPLE_SIZE',
      { currentSize, requiredSize, experimentId }
    );
  }
}

/**
 * Error thrown when statistical test fails
 */
export class StatisticalTestError extends ABTestingError {
  constructor(testName: string, reason: string) {
    super(
      `Statistical test ${testName} failed: ${reason}`,
      'STATISTICAL_TEST_ERROR',
      { testName, reason }
    );
  }
}

/**
 * Error thrown when allocation fails
 */
export class AllocationError extends ABTestingError {
  constructor(userId: string, experimentId: string, reason: string) {
    super(
      `Failed to allocate user ${userId} to experiment ${experimentId}: ${reason}`,
      'ALLOCATION_ERROR',
      { userId, experimentId, reason }
    );
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends ABTestingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      `Configuration error: ${message}`,
      'CONFIGURATION_ERROR',
      details
    );
  }
}

/**
 * Error thrown when a user has already been assigned
 */
export class DuplicateAssignmentError extends ABTestingError {
  constructor(userId: string, experimentId: string, existingVariantId: string) {
    super(
      `User ${userId} already assigned to variant ${existingVariantId} in experiment ${experimentId}`,
      'DUPLICATE_ASSIGNMENT',
      { userId, experimentId, existingVariantId }
    );
  }
}

/**
 * Error thrown when a metric is not found
 */
export class MetricNotFoundError extends ABTestingError {
  constructor(metricId: string, experimentId?: string) {
    super(
      `Metric ${metricId} not found`,
      'METRIC_NOT_FOUND',
      { metricId, experimentId }
    );
  }
}

/**
 * Error thrown when bandit algorithm fails
 */
export class BanditAlgorithmError extends ABTestingError {
  constructor(algorithm: string, reason: string) {
    super(
      `Bandit algorithm ${algorithm} failed: ${reason}`,
      'BANDIT_ALGORITHM_ERROR',
      { algorithm, reason }
    );
  }
}

/**
 * Error thrown when cohort analysis fails
 */
export class CohortAnalysisError extends ABTestingError {
  constructor(cohortName: string, reason: string) {
    super(
      `Cohort analysis failed for ${cohortName}: ${reason}`,
      'COHORT_ANALYSIS_ERROR',
      { cohortName, reason }
    );
  }
}

/**
 * Error thrown when experiment duration is invalid
 */
export class InvalidDurationError extends ABTestingError {
  constructor(minDuration: number, maxDuration: number, actualDuration?: number) {
    super(
      `Invalid duration: must be between ${minDuration} and ${maxDuration} ms, got ${actualDuration}`,
      'INVALID_DURATION',
      { minDuration, maxDuration, actualDuration }
    );
  }
}

/**
 * Error thrown when weights don't sum to 1
 */
export class InvalidWeightsError extends ABTestingError {
  constructor(sum: number, expected: number = 1) {
    super(
      `Variant weights must sum to ${expected}, got ${sum}`,
      'INVALID_WEIGHTS',
      { sum, expected }
    );
  }
}

/**
 * Error thrown when concurrent modification is detected
 */
export class ConcurrentModificationError extends ABTestingError {
  constructor(experimentId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrent modification detected for experiment ${experimentId}: expected version ${expectedVersion}, got ${actualVersion}`,
      'CONCURRENT_MODIFICATION',
      { experimentId, expectedVersion, actualVersion }
    );
  }
}
