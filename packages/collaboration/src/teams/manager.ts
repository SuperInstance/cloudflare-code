/**
 * Team Management Module
 * Manages teams, members, roles, and permissions
 */

import { nanoid } from 'nanoid';
import type {
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

// ============================================================================
// Team Manager
// ============================================================================

export class TeamManager {
  private teams: Map<string, Team> = new Map();
  private members: Map<string, Map<string, TeamMember>> = new Map(); // teamId -> userId -> member
  private invites: Map<string, TeamInvite> = new Map();
  private projects: Map<string, TeamProject[]> = new Map();

  // ============================================================================
  // Team Management
  // ============================================================================

  /**
   * Create a new team
   */
  createTeam(
    name: string,
    ownerId: string,
    ownerName: string,
    options?: {
      description?: string;
      avatar?: string;
      settings?: Partial<TeamSettings>;
    }
  ): Team {
    const slug = this.generateSlug(name);

    const team: Team = {
      id: nanoid(),
      name,
      slug,
      description: options?.description || '',
      avatar: options?.avatar,
      ownerId,
      settings: {
        allowPublicDiscovery: options?.settings?.allowPublicDiscovery ?? false,
        allowMemberInvite: options?.settings?.allowMemberInvite ?? true,
        requireApproval: options?.settings?.requireApproval ?? false,
        defaultRole: options?.settings?.defaultRole || 'member',
        maxMembers: options?.settings?.maxMembers,
        retentionDays: options?.settings?.retentionDays || 90,
      },
      permissions: this.getDefaultTeamPermissions(),
      memberCount: 1,
      projectCount: 0,
      created: Date.now(),
      updated: Date.now(),
    };

    this.teams.set(team.id, team);

    // Add owner as first member
    this.addMember(team.id, ownerId, ownerName, 'owner');

    return team;
  }

  /**
   * Get a team by ID
   */
  getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get a team by slug
   */
  getTeamBySlug(slug: string): Team | undefined {
    for (const team of this.teams.values()) {
      if (team.slug === slug) {
        return team;
      }
    }
    return undefined;
  }

  /**
   * Update a team
   */
  updateTeam(
    teamId: string,
    updates: Partial<Pick<Team, 'name' | 'description' | 'avatar' | 'settings' | 'permissions'>>
  ): Team | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    Object.assign(team, updates);

    if (updates.name) {
      team.slug = this.generateSlug(updates.name);
    }

    team.updated = Date.now();

    return team;
  }

  /**
   * Delete a team
   */
  deleteTeam(teamId: string): boolean {
    this.members.delete(teamId);
    this.projects.delete(teamId);

    // Delete all invites for this team
    for (const [inviteId, invite] of this.invites.entries()) {
      if (invite.teamId === teamId) {
        this.invites.delete(inviteId);
      }
    }

    return this.teams.delete(teamId);
  }

  /**
   * Get all teams
   */
  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  /**
   * Search teams
   */
  searchTeams(query: string): Team[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.teams.values()).filter(
      (team) =>
        team.settings.allowPublicDiscovery &&
        (team.name.toLowerCase().includes(lowerQuery) ||
          team.description.toLowerCase().includes(lowerQuery))
    );
  }

  // ============================================================================
  // Member Management
  // ============================================================================

  /**
   * Add a member to a team
   */
  addMember(
    teamId: string,
    userId: string,
    userName: string,
    role: TeamRole,
    options?: {
      email?: string;
      avatar?: string;
    }
  ): TeamMember {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check max members limit
    if (team.settings.maxMembers && team.memberCount >= team.settings.maxMembers) {
      throw new Error('Team has reached maximum members');
    }

    const member: TeamMember = {
      userId,
      userName,
      email: options?.email || '',
      avatar: options?.avatar,
      role,
      joinedAt: Date.now(),
      status: 'active',
      permissions: this.getRolePermissions(role),
      statistics: {
        contributions: 0,
        reviews: 0,
        articles: 0,
        lastActive: Date.now(),
      },
    };

    let teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      teamMembers = new Map();
      this.members.set(teamId, teamMembers);
    }

    teamMembers.set(userId, member);
    team.memberCount++;
    team.updated = Date.now();

    return member;
  }

  /**
   * Get a member from a team
   */
  getMember(teamId: string, userId: string): TeamMember | undefined {
    const teamMembers = this.members.get(teamId);
    return teamMembers?.get(userId);
  }

  /**
   * Get all members of a team
   */
  getTeamMembers(teamId: string): TeamMember[] {
    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return [];
    }

    return Array.from(teamMembers.values());
  }

  /**
   * Update a member's role
   */
  updateMemberRole(
    teamId: string,
    userId: string,
    newRole: TeamRole
  ): TeamMember | undefined {
    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return undefined;
    }

    const member = teamMembers.get(userId);
    if (!member) {
      return undefined;
    }

    member.role = newRole;
    member.permissions = this.getRolePermissions(newRole);

    return member;
  }

  /**
   * Update a member's status
   */
  updateMemberStatus(
    teamId: string,
    userId: string,
    status: MemberStatus
  ): TeamMember | undefined {
    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return undefined;
    }

    const member = teamMembers.get(userId);
    if (!member) {
      return undefined;
    }

    member.status = status;
    return member;
  }

  /**
   * Remove a member from a team
   */
  removeMember(teamId: string, userId: string): boolean {
    const team = this.teams.get(teamId);
    const teamMembers = this.members.get(teamId);

    if (!team || !teamMembers) {
      return false;
    }

    // Cannot remove owner
    if (team.ownerId === userId) {
      throw new Error('Cannot remove team owner');
    }

    const removed = teamMembers.delete(userId);
    if (removed) {
      team.memberCount--;
      team.updated = Date.now();
    }

    return removed;
  }

  /**
   * Get all teams for a user
   */
  getUserTeams(userId: string): Team[] {
    const userTeams: Team[] = [];

    for (const [teamId, teamMembers] of this.members.entries()) {
      if (teamMembers.has(userId)) {
        const team = this.teams.get(teamId);
        if (team) {
          userTeams.push(team);
        }
      }
    }

    return userTeams;
  }

  /**
   * Update member statistics
   */
  updateMemberStatistics(
    teamId: string,
    userId: string,
    updates: Partial<MemberStatistics>
  ): TeamMember | undefined {
    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return undefined;
    }

    const member = teamMembers.get(userId);
    if (!member) {
      return undefined;
    }

    Object.assign(member.statistics, updates);
    return member;
  }

  // ============================================================================
  // Invite Management
  // ============================================================================

  /**
   * Create an invite
   */
  createInvite(
    teamId: string,
    invitedBy: string,
    invitedEmail: string,
    role: TeamRole,
    expiresInDays: number = 7
  ): TeamInvite {
    const invite: TeamInvite = {
      inviteId: nanoid(),
      teamId,
      invitedBy,
      invitedEmail,
      role,
      status: 'pending',
      created: Date.now(),
      expires: Date.now() + expiresInDays * 86400000,
    };

    this.invites.set(invite.inviteId, invite);

    return invite;
  }

  /**
   * Get an invite by ID
   */
  getInvite(inviteId: string): TeamInvite | undefined {
    return this.invites.get(inviteId);
  }

  /**
   * Get invites for a team
   */
  getTeamInvites(teamId: string): TeamInvite[] {
    return Array.from(this.invites.values()).filter(
      (i) => i.teamId === teamId && i.status === 'pending'
    );
  }

  /**
   * Get invites for a user
   */
  getUserInvites(email: string): TeamInvite[] {
    return Array.from(this.invites.values()).filter(
      (i) => i.invitedEmail === email && i.status === 'pending'
    );
  }

  /**
   * Accept an invite
   */
  acceptInvite(
    inviteId: string,
    userId: string,
    userName: string
  ): TeamMember | undefined {
    const invite = this.invites.get(inviteId);
    if (!invite || invite.status !== 'pending') {
      return undefined;
    }

    if (Date.now() > invite.expires) {
      invite.status = 'expired';
      return undefined;
    }

    // Add user to team
    const member = this.addMember(
      invite.teamId,
      userId,
      userName,
      invite.role
    );

    invite.status = 'accepted';
    invite.acceptedAt = Date.now();

    return member;
  }

  /**
   * Decline an invite
   */
  declineInvite(inviteId: string): boolean {
    const invite = this.invites.get(inviteId);
    if (!invite) {
      return false;
    }

    invite.status = 'declined';
    return true;
  }

  /**
   * Cancel an invite
   */
  cancelInvite(inviteId: string): boolean {
    return this.invites.delete(inviteId);
  }

  /**
   * Clean up expired invites
   */
  cleanupExpiredInvites(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [inviteId, invite] of this.invites.entries()) {
      if (invite.status === 'pending' && now > invite.expires) {
        invite.status = 'expired';
        cleaned++;
      }
    }

    return cleaned;
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  /**
   * Add a project to a team
   */
  addProject(
    teamId: string,
    projectId: string,
    name: string,
    description: string,
    visibility: ProjectVisibility = 'private'
  ): TeamProject {
    const project: TeamProject = {
      projectId,
      teamId,
      name,
      description,
      visibility,
      memberCount: 0,
      created: Date.now(),
      updated: Date.now(),
    };

    let teamProjects = this.projects.get(teamId);
    if (!teamProjects) {
      teamProjects = [];
      this.projects.set(teamId, teamProjects);
    }

    teamProjects.push(project);

    // Update team project count
    const team = this.teams.get(teamId);
    if (team) {
      team.projectCount = teamProjects.length;
      team.updated = Date.now();
    }

    return project;
  }

  /**
   * Get projects for a team
   */
  getTeamProjects(teamId: string): TeamProject[] {
    return this.projects.get(teamId) || [];
  }

  /**
   * Update a project
   */
  updateProject(
    teamId: string,
    projectId: string,
    updates: Partial<Pick<TeamProject, 'name' | 'description' | 'visibility' | 'memberCount'>>
  ): TeamProject | undefined {
    const teamProjects = this.projects.get(teamId);
    if (!teamProjects) {
      return undefined;
    }

    const project = teamProjects.find((p) => p.projectId === projectId);
    if (!project) {
      return undefined;
    }

    Object.assign(project, updates);
    project.updated = Date.now();

    return project;
  }

  /**
   * Remove a project from a team
   */
  removeProject(teamId: string, projectId: string): boolean {
    const teamProjects = this.projects.get(teamId);
    if (!teamProjects) {
      return false;
    }

    const index = teamProjects.findIndex((p) => p.projectId === projectId);
    if (index === -1) {
      return false;
    }

    teamProjects.splice(index, 1);

    // Update team project count
    const team = this.teams.get(teamId);
    if (team) {
      team.projectCount = teamProjects.length;
      team.updated = Date.now();
    }

    return true;
  }

  // ============================================================================
  // Permission Management
  // ============================================================================

  /**
   * Check if a user has a specific permission
   */
  hasPermission(
    teamId: string,
    userId: string,
    permission: keyof TeamPermissions
  ): boolean {
    const member = this.getMember(teamId, userId);
    if (!member) {
      return false;
    }

    return member.permissions[permission] === true;
  }

  /**
   * Check if a user can perform an action
   */
  canPerformAction(
    teamId: string,
    userId: string,
    action: 'create_project' | 'delete_project' | 'invite_member' | 'remove_member' | 'manage_settings' | 'view_billing'
  ): boolean {
    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }

    // Owner can do everything
    if (team.ownerId === userId) {
      return true;
    }

    const member = this.getMember(teamId, userId);
    if (!member) {
      return false;
    }

    switch (action) {
      case 'create_project':
        return member.permissions.canCreateProjects;
      case 'delete_project':
        return member.permissions.canDeleteProjects;
      case 'invite_member':
        return member.permissions.canInviteMembers && team.settings.allowMemberInvite;
      case 'remove_member':
        return member.permissions.canRemoveMembers;
      case 'manage_settings':
        return member.permissions.canManageSettings;
      case 'view_billing':
        return member.permissions.canViewBilling;
      default:
        return false;
    }
  }

  /**
   * Get default team permissions
   */
  private getDefaultTeamPermissions(): TeamPermissions {
    return {
      canCreateProjects: true,
      canDeleteProjects: false,
      canInviteMembers: true,
      canRemoveMembers: false,
      canManageSettings: false,
      canViewBilling: false,
    };
  }

  /**
   * Get permissions for a role
   */
  private getRolePermissions(role: TeamRole): MemberPermissions {
    switch (role) {
      case 'owner':
        return {
          canCreateProjects: true,
          canDeleteProjects: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canManageSettings: true,
        };
      case 'admin':
        return {
          canCreateProjects: true,
          canDeleteProjects: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canManageSettings: true,
        };
      case 'moderator':
        return {
          canCreateProjects: true,
          canDeleteProjects: false,
          canInviteMembers: true,
          canRemoveMembers: true,
          canManageSettings: false,
        };
      case 'member':
        return {
          canCreateProjects: true,
          canDeleteProjects: false,
          canInviteMembers: false,
          canRemoveMembers: false,
          canManageSettings: false,
        };
      case 'guest':
        return {
          canCreateProjects: false,
          canDeleteProjects: false,
          canInviteMembers: false,
          canRemoveMembers: false,
          canManageSettings: false,
        };
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get team statistics
   */
  getTeamStatistics(teamId: string): {
    memberCount: number;
    projectCount: number;
    activeMembers: number;
    totalContributions: number;
    totalReviews: number;
    totalArticles: number;
  } | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return undefined;
    }

    const members = Array.from(teamMembers.values());
    const activeMembers = members.filter(
      (m) => m.status === 'active'
    ).length;

    const totalContributions = members.reduce(
      (sum, m) => sum + m.statistics.contributions,
      0
    );

    const totalReviews = members.reduce(
      (sum, m) => sum + m.statistics.reviews,
      0
    );

    const totalArticles = members.reduce(
      (sum, m) => sum + m.statistics.articles,
      0
    );

    return {
      memberCount: team.memberCount,
      projectCount: team.projectCount,
      activeMembers,
      totalContributions,
      totalReviews,
      totalArticles,
    };
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Generate a URL-friendly slug from a team name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.teams.clear();
    this.members.clear();
    this.invites.clear();
    this.projects.clear();
  }
}
