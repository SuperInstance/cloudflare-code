/**
 * Code Review System - Optimized
 */

import { ReviewEngine } from './review/engine';
import { QualityAnalyzer } from './quality/analyzer';
import { SecurityScanner } from './security/scanner';
import { PerformanceAnalyzer } from './performance/analyzer';
import { MetricsCalculator } from './metrics/calculator';

export interface CodeReviewOptions {
  review?: any;
  quality?: any;
  security?: any;
  performance?: any;
  metrics?: any;
}

export class CodeReview {
  private engine: ReviewEngine;
  private quality: QualityAnalyzer;
  private security: SecurityScanner;
  private performance: PerformanceAnalyzer;
  private metrics: MetricsCalculator;

  constructor(options: CodeReviewOptions = {}) {
    this.engine = new ReviewEngine(options.review || {});
    this.quality = new QualityAnalyzer(options.quality || {});
    this.security = new SecurityScanner(options.security || {});
    this.performance = new PerformanceAnalyzer(options.performance || {});
    this.metrics = new MetricsCalculator(options.metrics || {});
  }

  async review(code: string, language: string): Promise<any> {
    const [quality, security, performance] = await Promise.all([
      this.quality.analyze(code, language),
      this.security.scan(code, language),
      this.performance.analyze(code, language)
    ]);

    return this.engine.review({ code, language, quality, security, performance });
  }

  getStats(): any {
    return {
      engine: this.engine.getStats(),
      quality: this.quality.getStats(),
      security: this.security.getStats(),
      performance: this.performance.getStats()
    };
  }
}

export function createCodeReview(options: CodeReviewOptions = {}): CodeReview {
  return new CodeReview(options);
}
