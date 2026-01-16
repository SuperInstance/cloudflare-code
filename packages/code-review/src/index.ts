/**
 * ClaudeFlare Code Review - Ultra-Optimized
 * Automated code review and analysis platform
 */

export * from './types';

// Core components (minimal exports)
export { ReviewEngine } from './review/engine';
export { RuleRegistry } from './review/rule-registry';
export { TemplateManager } from './review/template-manager';
export { QualityAnalyzer } from './quality/analyzer';
export { SecurityScanner } from './security/scanner';
export { PerformanceAnalyzer } from './performance/analyzer';
export { StyleChecker } from './style/checker';
export { MetricsCalculator } from './metrics/calculator';
export { LanguageDetector, ParserFactory } from './utils';

// Main system
export { CodeReview, createCodeReview } from './system';
import { CodeReview } from './system';

export const VERSION = '0.1.0';
export default CodeReview;
