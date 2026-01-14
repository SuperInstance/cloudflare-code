/**
 * Counterfactual Explanation Module
 * Generate counterfactual examples to explain model predictions
 */

export { CounterfactualGenerator } from './generator';

export type {
  CounterfactualExplanation,
  CounterfactualConfig,
  CounterfactualChange,
  ActionabilityScore,
  FeatureConstraints,
} from '../types/explanations';
