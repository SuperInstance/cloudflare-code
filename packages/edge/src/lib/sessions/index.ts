/**
 * Session Management Module
 *
 * Comprehensive session management with conversation context persistence.
 * Exports all session-related functionality for easy integration.
 */

// Session Durable Object
export {
  SessionDO,
  createSessionStub,
  getSession,
  createSession,
  updateSession,
  deleteSession,
} from '../../do/session';

export type {
  SessionState,
  SessionMetadata,
  SessionInfo,
  ConversationContext,
} from '../../do/session';

// Session Manager
export {
  SessionManager,
  createSessionManager,
} from './manager';

export type { SessionManagerOptions } from './manager';

// Context Builder
export {
  ContextBuilder,
  createContextBuilder,
} from './context';

export type {
  ContextBuilderOptions,
  ContextStrategy,
} from './context';

// Session Storage
export {
  SessionStorage,
  createSessionStorage,
} from './storage';

export type {
  SessionStorageOptions,
  Tier,
} from './storage';

// Cleanup
export {
  cleanupInactiveSessions,
  handleScheduledCleanup,
  handleManualCleanup,
  getCleanupStats,
  checkCleanupHealth,
} from '../../routes/cleanup';

export type {
  CleanupOptions,
  CleanupResult,
} from '../../routes/cleanup';
