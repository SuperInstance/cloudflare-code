/**
 * Groups and Role Mapping Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { GroupMappingService } from '../groups/group-mapping';

import type { GroupMappingConfig, GroupMapping, RoleMapping } from '../types';

describe('GroupMappingService', () => {
  let config: GroupMappingConfig;
  let service: GroupMappingService;

  beforeEach(() => {
    config = {
      enabled: true,
      syncMode: 'automatic',
      syncInterval: 3600000,
      source: 'saml',
      mappings: [
        {
          sourceGroup: 'Admins',
          targetGroup: 'Administrators',
          attributeSync: {
            enabled: true,
            attributes: ['name', 'description'],
          },
          roleMappings: [
            {
              sourceRole: 'admin',
              targetRole: 'Administrator',
              permissions: ['*'],
            },
          ],
        },
        {
          sourceGroup: 'Developers',
          targetGroup: 'Developers',
          roleMappings: [
            {
              sourceRole: 'developer',
              targetRole: 'Developer',
              permissions: ['code:*', 'deploy:dev'],
            },
          ],
        },
      ],
      autoCreateGroups: true,
      preserveManualAssignments: true,
    };

    service = new GroupMappingService(config, {
      autoCreateGroups: true,
      preserveManualAssignments: true,
      validationEnabled: true,
    });
  });

  describe('constructor', () => {
    it('should create service with config', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(GroupMappingService);
    });

    it('should initialize mappings cache', () => {
      const stats = service.getCacheStats();

      expect(stats.groupMappings).toBeGreaterThan(0);
    });
  });

  describe('mapGroup', () => {
    it('should map source group to target group', () => {
      const mapped = service.mapGroup('Admins');

      expect(mapped).toBe('Administrators');
    });

    it('should return null for unmapped group when auto-create is disabled', () => {
      const localService = new GroupMappingService(config, {
        autoCreateGroups: false,
      });

      const mapped = localService.mapGroup('UnmappedGroup');

      expect(mapped).toBeNull();
    });

    it('should return source group when auto-create is enabled', () => {
      const mapped = service.mapGroup('NewGroup');

      expect(mapped).toBe('NewGroup');
    });
  });

  describe('reverseMapGroup', () => {
    it('should reverse map target group to source groups', () => {
      const sources = service.reverseMapGroup('Administrators');

      expect(sources).toContain('Admins');
    });

    it('should return empty array for unmapped target group', () => {
      const sources = service.reverseMapGroup('UnmappedGroup');

      expect(sources).toEqual([]);
    });
  });

  describe('mapGroups', () => {
    it('should map multiple groups', () => {
      const mapped = service.mapGroups(['Admins', 'Developers']);

      expect(mapped).toContain('Administrators');
      expect(mapped).toContain('Developers');
    });

    it('should remove duplicates', () => {
      const mapped = service.mapGroups(['Admins', 'Admins', 'Developers']);

      expect(mapped).toEqual(['Administrators', 'Developers']);
    });
  });

  describe('mapRole', () => {
    it('should map source role to target roles', () => {
      const mapped = service.mapRole('admin');

      expect(mapped).toContain('Administrator');
    });

    it('should return source role when no mapping exists', () => {
      const mapped = service.mapRole('custom-role');

      expect(mapped).toContain('custom-role');
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user', () => {
      const assignment = service.assignRoleToUser('user123', 'Administrator', {
        source: 'saml',
        sourceId: 'Admins',
      });

      expect(assignment).toBeDefined();
      expect(assignment.userId).toBe('user123');
      expect(assignment.roleId).toBe('Administrator');
      expect(assignment.source).toBe('saml');
    });

    it('should support expiration', () => {
      const expiresAt = new Date(Date.now() + 86400000);
      const assignment = service.assignRoleToUser('user123', 'Administrator', {
        expiresAt,
      });

      expect(assignment.expiresAt).toBe(expiresAt);
    });

    it('should support conditions', () => {
      const assignment = service.assignRoleToUser('user123', 'Administrator', {
        conditions: [
          {
            field: 'department',
            operator: 'equals',
            value: 'Engineering',
          },
        ],
      });

      expect(assignment.conditions).toBeDefined();
      expect(assignment.conditions).toHaveLength(1);
    });
  });

  describe('revokeRoleFromUser', () => {
    it('should revoke role from user', () => {
      service.assignRoleToUser('user123', 'Administrator');
      const revoked = service.revokeRoleFromUser('user123', 'Administrator');

      expect(revoked).toBe(true);
    });

    it('should return false when role not assigned', () => {
      const revoked = service.revokeRoleFromUser('user123', 'NonExistentRole');

      expect(revoked).toBe(false);
    });
  });

  describe('getUserRoles', () => {
    it('should get user roles', () => {
      service.assignRoleToUser('user123', 'Administrator');
      service.assignRoleToUser('user123', 'Developer');

      const roles = service.getUserRoles('user123');

      expect(roles).toBeDefined();
      expect(roles.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter expired assignments', () => {
      const pastDate = new Date(Date.now() - 86400000);
      service.assignRoleToUser('user123', 'ExpiredRole', {
        expiresAt: pastDate,
      });

      const roles = service.getUserRoles('user123');

      expect(roles).toBeDefined();
      expect(roles.some(r => r.roleId === 'ExpiredRole')).toBe(false);
    });
  });

  describe('userHasRole', () => {
    it('should check if user has role', () => {
      service.assignRoleToUser('user123', 'Administrator');

      const hasRole = service.userHasRole('user123', 'Administrator');

      expect(hasRole).toBe(true);
    });

    it('should return false when user does not have role', () => {
      const hasRole = service.userHasRole('user123', 'NonExistentRole');

      expect(hasRole).toBe(false);
    });
  });

  describe('getRoleAssignments', () => {
    it('should get all assignments for a role', () => {
      service.assignRoleToUser('user1', 'Administrator');
      service.assignRoleToUser('user2', 'Administrator');

      const assignments = service.getRoleAssignments('Administrator');

      expect(assignments).toBeDefined();
      expect(assignments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('addGroupMapping', () => {
    it('should add group mapping', () => {
      const mapping: GroupMapping = {
        sourceGroup: 'NewGroup',
        targetGroup: 'New Target Group',
      };

      service.addGroupMapping(mapping);

      const mapped = service.mapGroup('NewGroup');
      expect(mapped).toBe('New Target Group');
    });
  });

  describe('removeGroupMapping', () => {
    it('should remove group mapping', () => {
      const removed = service.removeGroupMapping('Admins');

      expect(removed).toBe(true);

      const mapped = service.mapGroup('Admins');
      expect(mapped).toBeNull(); // or 'Admins' if auto-create is enabled
    });
  });

  describe('updateGroupMapping', () => {
    it('should update group mapping', () => {
      const updated = service.updateGroupMapping('Admins', {
        targetGroup: 'NewAdministrators',
      });

      expect(updated).toBe(true);

      const mapped = service.mapGroup('Admins');
      expect(mapped).toBe('NewAdministrators');
    });

    it('should return false for non-existent mapping', () => {
      const updated = service.updateGroupMapping('NonExistent', {
        targetGroup: 'Target',
      });

      expect(updated).toBe(false);
    });
  });

  describe('getGroupMappings', () => {
    it('should get all group mappings', () => {
      const mappings = service.getGroupMappings();

      expect(mappings).toBeDefined();
      expect(Array.isArray(mappings)).toBe(true);
      expect(mappings.length).toBeGreaterThan(0);
    });
  });

  describe('getGroupMapping', () => {
    it('should get specific group mapping', () => {
      const mapping = service.getGroupMapping('Admins');

      expect(mapping).toBeDefined();
      expect(mapping?.sourceGroup).toBe('Admins');
      expect(mapping?.targetGroup).toBe('Administrators');
    });

    it('should return undefined for non-existent mapping', () => {
      const mapping = service.getGroupMapping('NonExistent');

      expect(mapping).toBeUndefined();
    });
  });

  describe('syncGroups', () => {
    it('should sync groups', async () => {
      const sourceGroups = [
        {
          name: 'Admins',
          members: ['user1', 'user2'],
        },
        {
          name: 'Developers',
          members: ['user3', 'user4'],
        },
      ];

      const result = await service.syncGroups(sourceGroups);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.added).toBe('number');
      expect(typeof result.updated).toBe('number');
      expect(typeof result.failed).toBe('number');
    });

    it('should handle sync errors', async () => {
      const sourceGroups = [
        {
          name: 'InvalidGroup',
          members: [],
        },
      ];

      const result = await service.syncGroups(sourceGroups);

      expect(result).toBeDefined();
      expect(typeof result.failed).toBe('number');
    });
  });

  describe('syncUserGroupMemberships', () => {
    it('should sync user group memberships', async () => {
      const sourceGroups = ['Admins', 'Developers'];

      const result = await service.syncUserGroupMemberships('user123', sourceGroups);

      expect(result).toBeDefined();
      expect(Array.isArray(result.added)).toBe(true);
      expect(Array.isArray(result.removed)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cache', () => {
      service.clearCache();

      const stats = service.getCacheStats();

      expect(stats.groupMappings).toBe(0);
      expect(stats.roleAssignments).toBe(0);
    });
  });

  describe('exportConfig', () => {
    it('should export configuration', () => {
      const exported = service.exportConfig();

      expect(exported).toBeDefined();
      expect(exported.mappings).toBeDefined();
      expect(Array.isArray(exported.mappings)).toBe(true);
    });
  });
});
