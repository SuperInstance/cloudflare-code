/**
 * LIME (Local Interpretable Model-agnostic Explanations) Module
 * Local linear approximation for model explanations
 */

export { TabularLIME } from './tabular';
export { LIMEKernel } from './kernel';

export type {
  LIMEExplanation,
  LIMEConfig,
  LocalModelExplanation,
} from '../types/explanations';
