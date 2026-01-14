/**
 * Anomaly Detection
 * Detects anomalies in data using statistical and ML-based methods
 */

import type { AnomalyDetector, AnomalyDetectorConfig, AnomalyResult } from '../types';

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  score: number;
  confidence: number;
  reasons: string[];
  timestamp: Date;
}

export class AnomalyDetectionEngine {
  private detectors: Map<string, AnomalyDetector> = new Map();

  /**
   * Register an anomaly detector
   */
  registerDetector(id: string, detector: AnomalyDetector): void {
    this.detectors.set(id, detector);
  }

  /**
   * Detect anomalies in data
   */
  async detect(data: unknown[], detectorId?: string): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];

    if (detectorId) {
      const detector = this.detectors.get(detectorId);
      if (detector) {
        for (const record of data) {
          const result = await this.detectWithDetector(record, detector);
          results.push(result);
        }
      }
    } else {
      // Use all registered detectors
      for (const detector of this.detectors.values()) {
        for (const record of data) {
          const result = await this.detectWithDetector(record, detector);
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Detect anomalies in single record
   */
  async detectOne(record: unknown, detectorId: string): Promise<AnomalyDetectionResult> {
    const detector = this.detectors.get(detectorId);

    if (!detector) {
      throw new Error(`Detector not found: ${detectorId}`);
    }

    return this.detectWithDetector(record, detector);
  }

  /**
   * Detect anomalies using detector
   */
  private async detectWithDetector(
    record: unknown,
    detector: AnomalyDetector
  ): Promise<AnomalyDetectionResult> {
    const result = await this.detectAnomaly(record, detector);

    return {
      isAnomaly: result.isAnomaly,
      score: result.score,
      confidence: result.confidence,
      reasons: result.reasons,
      timestamp: new Date()
    };
  }

  /**
   * Detect anomaly in record
   */
  private async detectAnomaly(
    record: unknown,
    detector: AnomalyDetector
  ): Promise<AnomalyResult> {
    switch (detector.type) {
      case 'statistical':
        return this.detectStatisticalAnomaly(record, detector.config);

      case 'rule-based':
        return this.detectRuleBasedAnomaly(record, detector.config);

      case 'time-series':
        return this.detectTimeSeriesAnomaly(record, detector.config);

      default:
        return {
          isAnomaly: false,
          score: 0,
          confidence: 0,
          reasons: [],
          timestamp: new Date()
        };
    }
  }

  /**
   * Detect statistical anomalies
   */
  private async detectStatisticalAnomaly(
    record: unknown,
    config: AnomalyDetectorConfig
  ): Promise<AnomalyResult> {
    const reasons: string[] = [];
    let score = 0;
    const confidence = config.sensitivity === 'high' ? 0.9 :
                      config.sensitivity === 'medium' ? 0.7 : 0.5;

    if (typeof record !== 'object' || record === null) {
      return {
        isAnomaly: false,
        score: 0,
        confidence,
        reasons: [],
        timestamp: new Date()
      };
    }

    const obj = record as Record<string, unknown>;

    // Check for outliers in numeric fields
    if (config.features) {
      for (const feature of config.features) {
        const value = obj[feature];

        if (typeof value === 'number') {
          // Simple outlier detection using z-score
          // In production, you'd use historical data to calculate mean/stddev
          const mean = config.custom?.mean?.[feature] as number || 0;
          const stddev = config.custom?.stddev?.[feature] as number || 1;

          const zscore = Math.abs((value - mean) / stddev);

          if (zscore > 3) {
            score += 0.5;
            reasons.push(`${feature}: Z-score ${zscore.toFixed(2)} exceeds threshold (3)`);
          } else if (zscore > 2) {
            score += 0.3;
            reasons.push(`${feature}: Z-score ${zscore.toFixed(2)} is elevated`);
          }
        }
      }
    }

    const threshold = config.threshold || 0.7;
    const isAnomaly = score >= threshold;

    return {
      isAnomaly,
      score: Math.min(score, 1),
      confidence,
      reasons,
      timestamp: new Date()
    };
  }

  /**
   * Detect rule-based anomalies
   */
  private async detectRuleBasedAnomaly(
    record: unknown,
    config: AnomalyDetectorConfig
  ): Promise<AnomalyResult> {
    const reasons: string[] = [];
    let score = 0;
    const confidence = 0.8;

    if (typeof record !== 'object' || record === null) {
      return {
        isAnomaly: false,
        score: 0,
        confidence,
        reasons: [],
        timestamp: new Date()
      };
    }

    const obj = record as Record<string, unknown>;

    // Check for null values in critical fields
    if (config.custom?.criticalFields) {
      const criticalFields = config.custom.criticalFields as string[];

      for (const field of criticalFields) {
        if (obj[field] === null || obj[field] === undefined) {
          score += 0.3;
          reasons.push(`Critical field ${field} is null or undefined`);
        }
      }
    }

    // Check for invalid ranges
    if (config.custom?.ranges) {
      const ranges = config.custom.ranges as Record<string, { min: number; max: number }>;

      for (const [field, range] of Object.entries(ranges)) {
        const value = obj[field];

        if (typeof value === 'number') {
          if (value < range.min || value > range.max) {
            score += 0.2;
            reasons.push(`${field}: Value ${value} outside valid range [${range.min}, ${range.max}]`);
          }
        }
      }
    }

    // Check for negative values where not expected
    if (config.custom?.nonNegativeFields) {
      const nonNegativeFields = config.custom.nonNegativeFields as string[];

      for (const field of nonNegativeFields) {
        const value = obj[field];

        if (typeof value === 'number' && value < 0) {
          score += 0.2;
          reasons.push(`${field}: Unexpected negative value ${value}`);
        }
      }
    }

    const threshold = config.threshold || 0.5;
    const isAnomaly = score >= threshold;

    return {
      isAnomaly,
      score: Math.min(score, 1),
      confidence,
      reasons,
      timestamp: new Date()
    };
  }

  /**
   * Detect time series anomalies
   */
  private async detectTimeSeriesAnomaly(
    record: unknown,
    config: AnomalyDetectorConfig
  ): Promise<AnomalyResult> {
    const reasons: string[] = [];
    let score = 0;
    const confidence = 0.7;

    if (typeof record !== 'object' || record === null) {
      return {
        isAnomaly: false,
        score: 0,
        confidence,
        reasons: [],
        timestamp: new Date()
      };
    }

    const obj = record as Record<string, unknown>;

    // Check for sudden changes
    if (config.custom?.baseline) {
      const baseline = config.custom.baseline as Record<string, number>;

      for (const [field, baselineValue] of Object.entries(baseline)) {
        const currentValue = obj[field];

        if (typeof currentValue === 'number') {
          const changePercent = Math.abs((currentValue - baselineValue) / baselineValue * 100);
          const threshold = config.custom?.changeThreshold as number || 50;

          if (changePercent > threshold) {
            score += 0.4;
            reasons.push(`${field}: ${changePercent.toFixed(1)}% change from baseline exceeds threshold (${threshold}%)`);
          }
        }
      }
    }

    // Check for missing timestamps
    if (config.custom?.timestampField) {
      const timestampField = config.custom.timestampField as string;
      const timestamp = obj[timestampField];

      if (!timestamp) {
        score += 0.3;
        reasons.push(`Missing timestamp field: ${timestampField}`);
      } else {
        const date = new Date(timestamp as string | number);
        if (isNaN(date.getTime())) {
          score += 0.3;
          reasons.push(`Invalid timestamp: ${timestamp}`);
        }
      }
    }

    const threshold = config.threshold || 0.5;
    const isAnomaly = score >= threshold;

    return {
      isAnomaly,
      score: Math.min(score, 1),
      confidence,
      reasons,
      timestamp: new Date()
    };
  }
}

// ============================================================================
// Data Profiler
// ============================================================================

export class DataProfiler {
  /**
   * Profile data and generate statistics
   */
  profile(records: unknown[]): ProfileResult {
    if (records.length === 0) {
      return {
        fieldProfiles: [],
        summary: {
          totalRecords: 0,
          totalFields: 0,
          completeFields: 0,
          completenessScore: 0,
          uniquenessScore: 0,
          validityScore: 0
        },
        timestamp: new Date()
      };
    }

    const fieldStats = this.calculateFieldStats(records);
    const summary = this.calculateSummary(records, fieldStats);

    return {
      fieldProfiles: fieldStats,
      summary,
      timestamp: new Date()
    };
  }

  /**
   * Calculate field statistics
   */
  private calculateFieldStats(records: unknown[]): FieldProfile[] {
    const profiles: FieldProfile[] = [];

    if (records.length === 0) {
      return profiles;
    }

    const firstRecord = records[0];
    if (typeof firstRecord !== 'object' || firstRecord === null) {
      return profiles;
    }

    const fields = Object.keys(firstRecord as Record<string, unknown>);
    const totalRecords = records.length;

    for (const field of fields) {
      const values: unknown[] = [];

      for (const record of records) {
        if (typeof record === 'object' && record !== null) {
          values.push((record as Record<string, unknown>)[field]);
        }
      }

      const nullCount = values.filter(v => v === null || v === undefined).length;
      const uniqueValues = new Set(values.filter(v => v !== null && v !== undefined));

      const profile: FieldProfile = {
        name: field,
        type: this.inferFieldType(values),
        nullCount,
        nullPercentage: (nullCount / totalRecords) * 100,
        uniqueCount: uniqueValues.size,
        uniquePercentage: (uniqueValues.size / totalRecords) * 100
      };

      // Add type-specific statistics
      if (profile.type === 'number') {
        profile.statistics = this.calculateNumberStats(values as number[]);
      } else if (profile.type === 'string') {
        profile.statistics = this.calculateStringStats(values as string[]);
      }

      profiles.push(profile);
    }

    return profiles;
  }

  /**
   * Infer field type
   */
  private inferFieldType(values: unknown[]): string {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);

    if (nonNullValues.length === 0) {
      return 'unknown';
    }

    const types = new Set(nonNullValues.map(v => typeof v));

    if (types.size === 1) {
      return Array.from(types)[0];
    }

    if (types.has('number') && types.has('string')) {
      return 'mixed';
    }

    return 'mixed';
  }

  /**
   * Calculate number statistics
   */
  private calculateNumberStats(values: number[]): NumberStatistics {
    const numbers = values.filter(v => typeof v === 'number');

    if (numbers.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stddev: 0,
        variance: 0
      };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    const mean = sum / numbers.length;
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stddev: Math.sqrt(variance),
      variance
    };
  }

  /**
   * Calculate string statistics
   */
  private calculateStringStats(values: string[]): StringStatistics {
    const strings = values.filter(v => typeof v === 'string');

    if (strings.length === 0) {
      return {
        minLength: 0,
        maxLength: 0,
        meanLength: 0,
        mostCommon: []
      };
    }

    const lengths = strings.map(s => s.length);
    const frequency = new Map<string, number>();

    for (const str of strings) {
      frequency.set(str, (frequency.get(str) || 0) + 1);
    }

    const mostCommon = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value]) => value);

    return {
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      meanLength: lengths.reduce((sum, len) => sum + len, 0) / lengths.length,
      mostCommon
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(records: unknown[], fieldProfiles: FieldProfile[]): SummaryStatistics {
    const totalRecords = records.length;
    const totalFields = fieldProfiles.length;

    const completeFields = fieldProfiles.filter(
      p => p.nullPercentage === 0
    ).length;

    const avgCompleteness = fieldProfiles.reduce(
      (sum, p) => sum + (100 - p.nullPercentage),
      0
    ) / fieldProfiles.length;

    const avgUniqueness = fieldProfiles.reduce(
      (sum, p) => sum + p.uniquePercentage,
      0
    ) / fieldProfiles.length;

    return {
      totalRecords,
      totalFields,
      completeFields,
      completenessScore: avgCompleteness,
      uniquenessScore: avgUniqueness,
      validityScore: 100 // Placeholder - would calculate based on validation
    };
  }
}

/**
 * Profile result
 */
export interface ProfileResult {
  fieldProfiles: FieldProfile[];
  summary: SummaryStatistics;
  timestamp: Date;
}

export interface FieldProfile {
  name: string;
  type: string;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  statistics?: NumberStatistics | StringStatistics;
}

export interface NumberStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  variance: number;
}

export interface StringStatistics {
  minLength: number;
  maxLength: number;
  meanLength: number;
  mostCommon: string[];
}

export interface SummaryStatistics {
  totalRecords: number;
  totalFields: number;
  completeFields: number;
  completenessScore: number;
  uniquenessScore: number;
  validityScore: number;
}
