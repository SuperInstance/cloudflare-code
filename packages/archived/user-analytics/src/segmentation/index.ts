/**
 * Segmentation Module
 * Exports all segmentation functionality
 */

export {
  SegmentBuilder,
  SegmentEvaluator,
  SegmentManager,
  BehavioralSegmenter,
  DynamicSegmenter,
} from './engine.js';

export type {
  Segment,
  SegmentType,
  SegmentDefinition,
  SegmentCondition,
  SegmentOperator,
  SegmentUser,
  SegmentUpdate,
  SegmentMetadata,
} from '../types/index.js';
