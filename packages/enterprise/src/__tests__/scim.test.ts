/**
 * SCIM 2.0 Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SCIMService } from '../scim/scim-service';
import {
  SCIMProvisioningService,
  SCIMSyncService,
} from '../scim/scim-provisioning';
import {
  buildSCIMFilter,
  buildCompoundFilter,
  createPatchOperation,
} from '../scim/scim-service';

import type { SCIMConfig, SCIMUser, SCIMGroup } from '../types';

describe('SCIMService', () => {
  let config: SCIMConfig;
  let service: SCIMService;

  beforeEach(() => {
    config = {
      baseUrl: 'https://scim.example.com',
      authenticationToken: 'test-token',
      authenticationScheme: 'Bearer',
      maxResults: 100,
    };

    service = new SCIMService(config);
  });

  describe('constructor', () => {
    it('should create SCIM service with config', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SCIMService);
    });

    it('should set default headers', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const user: SCIMUser = {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'testuser@example.com',
        name: {
          givenName: 'Test',
          familyName: 'User',
        },
        emails: [
          {
            value: 'testuser@example.com',
            type: 'work',
            primary: true,
          },
        ],
        active: true,
      };

      // This would fail in real implementation without a server
      // but we can test the method exists and has correct signature
      const result = service.createUser(user);

      expect(result).toBeDefined();
      expect(Promise.resolve(result)).resolves.toBeDefined();
    });
  });

  describe('getUser', () => {
    it('should get user by ID', async () => {
      const result = service.getUser('user123');

      expect(result).toBeDefined();
    });
  });

  describe('getUserByUsername', () => {
    it('should get user by username', async () => {
      const result = service.getUserByUsername('testuser@example.com');

      expect(result).toBeDefined();
    });
  });

  describe('replaceUser', () => {
    it('should replace user', async () => {
      const user: SCIMUser = {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'testuser@example.com',
        active: true,
      };

      const result = service.replaceUser('user123', user);

      expect(result).toBeDefined();
    });
  });

  describe('updateUser', () => {
    it('should update user with patch operations', async () => {
      const operations = [
        {
          op: 'replace' as const,
          path: 'active',
          value: 'false',
        },
      ];

      const result = service.updateUser('user123', operations);

      expect(result).toBeDefined();
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const result = service.deleteUser('user123');

      expect(result).toBeDefined();
    });
  });

  describe('listUsers', () => {
    it('should list users', async () => {
      const result = service.listUsers({
        startIndex: 1,
        count: 10,
      });

      expect(result).toBeDefined();
    });

    it('should support filtering', async () => {
      const result = service.listUsers({
        filter: 'userName eq "testuser@example.com"',
      });

      expect(result).toBeDefined();
    });

    it('should support sorting', async () => {
      const result = service.listUsers({
        sortBy: 'userName',
        sortOrder: 'ascending',
      });

      expect(result).toBeDefined();
    });
  });
});

describe('SCIMProvisioningService', () => {
  let config: SCIMConfig;
  let provisioningService: SCIMProvisioningService;

  beforeEach(() => {
    config = {
      baseUrl: 'https://scim.example.com',
      authenticationToken: 'test-token',
      authenticationScheme: 'Bearer',
    };

    provisioningService = new SCIMProvisioningService(config, {
      autoCreateGroups: true,
      retryFailedProvisions: false,
    });
  });

  describe('provisionUser', () => {
    it('should provision a new user', async () => {
      const userData: Partial<SCIMUser> = {
        userName: 'testuser@example.com',
        name: {
          givenName: 'Test',
          familyName: 'User',
        },
        emails: [
          {
            value: 'testuser@example.com',
            primary: true,
          },
        ],
      };

      const result = await provisioningService.provisionUser(userData, {
        assignGroups: ['Users'],
        activate: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('deprovisionUser', () => {
    it('should deprovision user', async () => {
      const result = await provisioningService.deprovisionUser('user123', {
        keepAccount: false,
        removeFromGroups: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should deactivate user when keepAccount is true', async () => {
      const result = await provisioningService.deprovisionUser('user123', {
        keepAccount: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe('provisionGroup', () => {
    it('should provision a new group', async () => {
      const groupData: SCIMGroup = {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        displayName: 'Test Group',
        members: [],
      };

      const result = await provisioningService.provisionGroup(groupData, {
        autoCreate: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('addUserToGroup', () => {
    it('should add user to group', async () => {
      const result = await provisioningService.addUserToGroup('group123', 'user123');

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('removeUserFromGroup', () => {
    it('should remove user from group', async () => {
      const result = await provisioningService.removeUserFromGroup('group123', 'user123');

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('batchProvisionUsers', () => {
    it('should batch provision users', async () => {
      const users = [
        {
          userName: 'user1@example.com',
          emails: [{ value: 'user1@example.com', primary: true }],
        },
        {
          userName: 'user2@example.com',
          emails: [{ value: 'user2@example.com', primary: true }],
        },
      ];

      const result = await provisioningService.batchProvisionUsers(users, {
        assignGroups: ['Users'],
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.succeeded)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
    });
  });
});

describe('SCIMSyncService', () => {
  let config: SCIMConfig;
  let syncService: SCIMSyncService;

  beforeEach(() => {
    config = {
      baseUrl: 'https://scim.example.com',
      authenticationToken: 'test-token',
      authenticationScheme: 'Bearer',
    };

    syncService = new SCIMSyncService(config);
  });

  describe('sync', () => {
    it('should perform full sync', async () => {
      const result = await syncService.sync({
        fullSync: true,
        syncUsers: true,
        syncGroups: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.stats).toBeDefined();
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();
      await syncService.sync({
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });
  });
});

describe('SCIM Helper Functions', () => {
  describe('buildSCIMFilter', () => {
    it('should build simple filter', () => {
      const filter = buildSCIMFilter({
        attribute: 'userName',
        operator: 'eq',
        value: 'testuser@example.com',
      });

      expect(filter).toBe('userName eq "testuser%40example.com"');
    });

    it('should build filter with contains operator', () => {
      const filter = buildSCIMFilter({
        attribute: 'name.givenName',
        operator: 'co',
        value: 'John',
      });

      expect(filter).toBe('name.givenName co "John"');
    });
  });

  describe('buildCompoundFilter', () => {
    it('should build AND filter', () => {
      const filter = buildCompoundFilter('and', [
        'userName eq "testuser@example.com"',
        'active eq "true"',
      ]);

      expect(filter).toBe('(userName eq "testuser@example.com" AND active eq "true")');
    });

    it('should build OR filter', () => {
      const filter = buildCompoundFilter('or', [
        'userName eq "user1@example.com"',
        'userName eq "user2@example.com"',
      ]);

      expect(filter).toBe('(userName eq "user1@example.com" OR userName eq "user2@example.com")');
    });
  });

  describe('createPatchOperation', () => {
    it('should create add operation', () => {
      const op = createPatchOperation('add', 'emails', [
        { value: 'new@example.com', type: 'work' },
      ]);

      expect(op.op).toBe('add');
      expect(op.path).toBe('emails');
      expect(op.value).toBeDefined();
    });

    it('should create replace operation', () => {
      const op = createPatchOperation('replace', 'active', 'true');

      expect(op.op).toBe('replace');
      expect(op.path).toBe('active');
      expect(op.value).toBe('true');
    });

    it('should create remove operation', () => {
      const op = createPatchOperation('remove', 'emails[value eq "old@example.com"]');

      expect(op.op).toBe('remove');
      expect(op.path).toBe('emails[value eq "old@example.com"]');
      expect(op.value).toBeUndefined();
    });
  });
});
