/**
 * Code Review Module
 * Exports all code review functionality
 */

export { CodeReviewManager } from './manager';
export {
  generateReviewSummary,
  calculateReviewVelocity,
  identifyReviewBottlenecks,
  generateReviewerReport,
} from './analytics';

// ============================================================================
// Re-exports
// ============================================================================

export type {
  Review,
  ReviewStatus,
  ReviewPriority,
  ReviewSettings,
  ReviewStatistics,
  ReviewComment,
  CommentType,
  CommentStatus,
  CommentReaction,
  ReviewAssignment,
  AssignmentStatus,
  SuggestedChange,
  ReviewAnalytics,
} from '../types';
