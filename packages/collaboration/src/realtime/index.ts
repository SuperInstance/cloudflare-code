/**
 * Real-time Collaboration Module
 * Exports all real-time collaboration functionality
 */

export {
  CRDTDocumentManager,
  createOperation,
  compareVectors,
  areVectorsConcurrent,
  mergeVectors,
  calculateOperationLength,
  validateOperation,
} from './crdt';

export {
  CollaborationManager,
  calculateCursorDistance,
  doSelectionsOverlap,
  mergeSelections,
} from './collaboration';

// ============================================================================
// Re-exports
// ============================================================================

export type {
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
  CollaborationSession,
  PresenceUpdate,
  PresenceState,
  UserStatus,
  CursorPosition,
  SelectionRange,
  SessionPermissions,
  WebSocketMessage,
  WebSocketConfig,
  CollaborationEvents,
} from '../types';
