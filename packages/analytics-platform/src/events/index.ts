/**
 * Events Module
 * Event tracking, collection, and processing
 */

export { EventTracker, SchemaValidator, EventFilter, EventTransformer } from './tracker.js';
export {
  EventCollector,
  UserProfileEnricher,
  GeoLocationEnricher,
  DeviceInfoEnricher,
  CustomEnricher,
  EventBuffer,
} from './collector.js';

export type {
  EventTrackerConfig,
  EventValidationResult,
  ValidationError,
  ValidationWarning,
  EventTrackerStats,
  EventHandler,
  EventValidator,
  EventSchema,
  PropertyRule,
  EventFilterRule,
  TransformationRule,
  CollectorConfig,
  RouteConfig,
  EventFilter,
  EnricherConfig,
  CollectorMetrics,
} from './tracker.js';

export type {
  RouteConfig as CollectorRouteConfig,
  EventFilter as CollectorEventFilter,
  EnricherConfig as CollectorEnricherConfig,
  CollectorMetrics as CollectorMetricsType,
} from './collector.js';
