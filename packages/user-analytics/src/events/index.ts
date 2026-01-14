/**
 * Event Tracking Module
 * Exports all event tracking functionality
 */

export {
  EventTracker,
  EventValidator,
  EventEnricher,
  EventBatcher,
  EventRouter,
  generateEventId,
  generateSessionId,
  generateAnonymousId,
} from './tracker.js';

export type {
  AnalyticsEvent,
  EventValidationResult,
  EventBatch,
  EventMetadata,
  AnalyticsConfig,
} from '../types/index.js';
