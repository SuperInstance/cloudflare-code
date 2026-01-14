/**
 * ClaudeFlare Collaboration Package
 * Advanced collaboration features for real-time coding
 *
 * Features:
 * - CRDT-based real-time collaboration
 * - Pair programming with WebRTC
 * - Code review workflow
 * - Knowledge sharing platform
 * - Team management
 * - Activity feeds and notifications
 *
 * @package @claudeflare/collaboration
 */

// ============================================================================
// Real-time Collaboration
// ============================================================================

export {
  // CRDT
  CRDTDocumentManager,
  createOperation,
  compareVectors,
  areVectorsConcurrent,
  mergeVectors,
  calculateOperationLength,
  validateOperation,

  // Collaboration
  CollaborationManager,
  calculateCursorDistance,
  doSelectionsOverlap,
  mergeSelections,
} from './realtime';

// ============================================================================
// Pair Programming
// ============================================================================

export {
  PairProgrammingManager,
  WebRTCSessionManager,
  generatePairSummary,
  calculatePairEfficiency,
  analyzePairDynamics,
} from './pair';

// ============================================================================
// Code Review
// ============================================================================

export {
  CodeReviewManager,
  generateReviewSummary,
  calculateReviewVelocity,
  identifyReviewBottlenecks,
  generateReviewerReport,
} from './review';

// ============================================================================
// Knowledge Sharing
// ============================================================================

export {
  KnowledgeManager,
  generateKnowledgeGraph,
  calculateArticleSimilarity,
  recommendArticles,
} from './knowledge';

// ============================================================================
// Team Management
// ============================================================================

export { TeamManager } from './teams';

// ============================================================================
// Activity & Notifications
// ============================================================================

export {
  ActivityManager,
  generateActivitySummary,
  calculateActivityScore,
  getActivityTrends,
} from './activity';

// ============================================================================
// Utilities
// ============================================================================

export {
  // ID Generation
  generateSessionId,
  generateDocumentId,
  generateCommentId,

  // Color Generation
  generateUserColor,
  generateColorPalette,

  // Text Processing
  truncateText,
  normalizeWhitespace,
  extractMentions,
  extractHashtags,

  // Date/Time Utilities
  formatRelativeTime,
  formatDate,
  isWithinTimeWindow,
  getTimeDifference,

  // Validation Utilities
  isValidEmail,
  isValidSlug,
  isValidUrl,
  sanitizeHtml,

  // String Utilities
  generateSlug,
  toTitleCase,
  calculateStringSimilarity,

  // Array Utilities
  chunkArray,
  shuffleArray,
  uniqueArray,
  groupBy,

  // Map Utilities
  mapToObject,
  objectToMap,

  // Statistics Utilities
  average,
  median,
  standardDeviation,
  percentile,

  // Debounce/Throttle
  debounce,
  throttle,

  // Promise Utilities
  retry,
  parallel,

  // Debugging Utilities
  createLogger,
  measureTime,

  // Additional Utilities
  deepClone,
  mergeObjects,
  pick,
  omit,
  isEqual,
  generateId,
  safeJsonParse,
  safeJsonStringify,
  isEmpty,
  isPromise,
  isDefined,
  createEnum,
  formatBytes,
  formatNumber,
  clamp,
  mapRange,
  lerp,
  hexToRgb,
  rgbToHex,
  isLightColor,
  getContrastColor,
  parseQueryString,
  buildQueryString,
  randomItem,
  randomBetween,
  randomInt,
  uuidv4,
  sleep,
  timeout,
  batch,
  flatten,
  partition,
  unique,
  findDuplicates,
  zip,
  unzip,
  memoize,
  noop,
  constant,
  identity,
} from './utils';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core Types
  CollaborationSession,
  UserStatus,
  CollaborationRole,
  SessionPermissions,
  CursorPosition,
  SelectionRange,
  PresenceUpdate,
  PresenceState,

  // CRDT Types
  CRDTDocument,
  CRDTType,
  CRDTOperation,
  OperationType,
  DocumentMetadata,
  CRDTState,
  Conflict,
  ConflictType,
  ConflictResolution,
  ResolutionStrategy,

  // Pair Programming Types
  PairSession,
  PairParticipant,
  PairRole,
  PairSessionStatus,
  PairPermissions,
  PairSessionSettings,
  PairStatistics,
  RoleSwitchRequest,
  WebRTCSession,
  WebRTCSessionType,

  // Code Review Types
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

  // Knowledge Sharing Types
  KnowledgeArticle,
  ArticleStatus,
  ArticleVisibility,
  ArticleMetadata,
  DifficultyLevel,
  ArticleAttachment,
  CodeSnippet,
  KnowledgeCategory,
  BestPractice,
  PracticeRule,
  PracticeExample,

  // Team Management Types
  Team,
  TeamSettings,
  TeamPermissions,
  TeamMember,
  TeamRole,
  MemberStatus,
  MemberPermissions,
  MemberStatistics,
  TeamInvite,
  InviteStatus,
  TeamProject,
  ProjectVisibility,

  // Activity & Notification Types
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

  // WebSocket Types
  WebSocketMessage,
  WebSocketConfig,

  // Collaboration Events
  CollaborationEvents,

  // WebRTC Types
  WebRTCPeer,
  WebRTCMetadata,
  WebRTCSignal,
} from './types';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Default Exports
// ============================================================================

export default {
  // Real-time
  CRDTDocumentManager,
  CollaborationManager,

  // Pair Programming
  PairProgrammingManager,
  WebRTCSessionManager,

  // Code Review
  CodeReviewManager,

  // Knowledge Sharing
  KnowledgeManager,

  // Team Management
  TeamManager,

  // Activity & Notifications
  ActivityManager,

  // Utilities
  utils: {
    generateId,
    formatRelativeTime,
    isValidEmail,
    debounce,
    throttle,
    retry,
    memoize,
  },

  VERSION,
};
