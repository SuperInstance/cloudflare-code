/**
 * Activity Feed Module
 * Exports all activity feed and notification functionality
 */

export { ActivityManager } from './manager';
export { generateActivitySummary, calculateActivityScore, getActivityTrends } from './analytics';

// ============================================================================
// Re-exports
// ============================================================================

export type {
  Activity,
  ActivityType,
  ActivityAction,
  ActivityTarget,
  ActivityMetadata,
  ActivityVisibility,
  ActivityFilter,
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationMetadata,
  ActivityDigest,
  DigestPeriod,
  DigestSummary,
} from '../types';
