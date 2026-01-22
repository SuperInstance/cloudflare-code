/**
 * ClaudeFlare A/B Testing Platform
 *
 * A comprehensive A/B testing framework with statistical rigor,
 * multi-armed bandit optimization, and cohort analysis.
 *
 * @example
 * ```typescript
 * import { ExperimentDesigner, AllocationEngine, StatisticalEngine } from '@claudeflare/ab-testing';
 *
 * // Create an experiment
 * const designer = new ExperimentDesigner();
 * const experiment = designer.createExperiment({
 *   id: 'exp-001',
 *   name: 'Button Color Test',
 *   description: 'Test different button colors',
 *   hypothesis: designer.createHypothesis({
 *     title: 'Red buttons increase conversions',
 *     description: 'Red buttons are more attention-grabbing',
 *     expectedOutcome: 'Higher conversion rate',
 *     rationale: 'Color psychology research',
 *     expectedEffectSize: 0.05
 *   }),
 *   variants: [
 *     designer.createVariant({ id: 'control', name: 'Blue', description: 'Current blue button', parameters: { color: 'blue' }, isControl: true }),
 *     designer.createVariant({ id: 'treatment', name: 'Red', description: 'New red button', parameters: { color: 'red' } })
 *   ],
 *   metrics: [
 *     designer.createMetric({ id: 'conversion', name: 'Conversion Rate', description: 'Users who convert', type: 'binary', direction: 'higher_is_better', primary: true })
 *   ]
 * });
 *
 * // Allocate users
 * const allocator = new AllocationEngine();
 * const result = await allocator.allocate('user-123', experiment);
 *
 * // Analyze results
 * const stats = new StatisticalEngine();
 * const testResult = stats.zTestProportions(100, 1000, 120, 1000);
 * ```
 */

// Core types
export * from './types/index.js';

// Experiment Designer
export * from './designer/index.js';

// Allocation Engine
export * from './allocation/index.js';

// Statistical Engine
export * from './statistics/index.js';

// Multi-Armed Bandit
export * from './bandit/index.js';

// Cohort Analyzer
export * from './cohort/index.js';

// Visualization Generator
export * from './visualization/index.js';

// Utilities
export * from './utils/index.js';

// Durable Objects
export * from './durable-objects/index.js';

// Version
export const VERSION = '0.1.0';

/**
 * Create a complete A/B testing setup
 */
export function createABTestingPlatform(config?: {
  defaultAlpha?: number;
  defaultPower?: number;
  cacheTTL?: number;
}) {
  const {
    ExperimentDesigner
  } = require('./designer/index.js');

  const {
    AllocationEngine
  } = require('./allocation/index.js');

  const {
    StatisticalEngine
  } = require('./statistics/index.js');

  const {
    createBandit
  } = require('./bandit/index.js');

  const {
    CohortAnalyzer
  } = require('./cohort/index.js');

  const {
    VisualizationGenerator
  } = require('./visualization/index.js');

  return {
    designer: new ExperimentDesigner(config),
    allocator: new AllocationEngine({
      cacheTTL: config?.cacheTTL
    }),
    statistics: new StatisticalEngine(),
    createBandit,
    cohortAnalyzer: new CohortAnalyzer(),
    visualization: new VisualizationGenerator()
  };
}

// Default export
export default createABTestingPlatform;
