/**
 * Real-time Analytics Module
 * Exports all real-time analytics functionality
 */

export {
  RealtimeProcessor,
  RealtimeMetricsCalculator,
  RealtimeAlertManager,
  RealtimeAnalytics,
} from './analytics.js';

export type {
  RealtimeEvent,
  RealtimeMetrics,
  RealtimeEventMetrics,
  RealtimeUserMetrics,
  RealtimeSessionMetrics,
  RealtimeConversionMetrics,
  RealtimeTopEvent,
  RealtimeTopPage,
  RealtimeAlert,
  AlertType,
  AlertSeverity,
  AlertThreshold,
} from '../types/index.js';
