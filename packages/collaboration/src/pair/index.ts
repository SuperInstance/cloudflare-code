/**
 * Pair Programming Module
 * Exports all pair programming functionality
 */

export { PairProgrammingManager, WebRTCSessionManager } from './session';
export { generatePairSummary, calculatePairEfficiency, analyzePairDynamics } from './analytics';

// ============================================================================
// Re-exports
// ============================================================================

export type {
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
} from '../types';
