/**
 * SHAP (SHapley Additive exPlanations) Module
 * Model-agnostic feature attribution using Shapley values
 */

export { KernelSHAP } from './kernel';
export { SHAPSampler } from './sampling';

export type {
  SHAPValues,
  SHAPExplanation,
  SHAPInteractionValues,
  SHAPConfig,
} from '../types/explanations';
