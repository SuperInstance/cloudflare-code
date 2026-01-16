/**
 * ClaudeFlare Collaboration - Ultra-Optimized
 * Advanced collaboration features for real-time coding
 */

export * from './types';

// Core components (minimal exports)
export { CRDTDocumentManager, CollaborationManager } from './realtime';
export { PairProgrammingManager, WebRTCSessionManager } from './pair';
export { CodeReviewManager } from './review';
export { KnowledgeManager } from './knowledge';
export { TeamManager } from './teams';
export { ActivityManager } from './activity';

// Main system
export { Collaboration, createCollaboration } from './system';
import { Collaboration } from './system';

export const VERSION = '1.0.0';
export default Collaboration;
