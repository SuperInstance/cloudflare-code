/**
 * Team Management Module
 * Exports all team management functionality
 */

export { TeamManager } from './manager';

// ============================================================================
// Re-exports
// ============================================================================

export type {
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
} from '../types';
