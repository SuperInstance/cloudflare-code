/**
 * Plugin Permissions Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PermissionManager,
  PermissionDeniedError,
  parsePermissionString,
  createPermissionString,
  isDangerousPermission,
  getPermissionDescription,
  type Permission,
  type PermissionScope
} from '../src/permissions';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  describe('granting permissions', () => {
    it('should grant a permission to a plugin', async () => {
      const grant = manager.grantPermission('test-plugin', {
        scope: 'network.https'
      }, {
        grantedBy: 'system'
      });

      expect(grant.permission.scope).toBe('network.https');
      expect(grant.grantedBy).toBe('system');
      expect(grant.revoked).toBe(false);
    });

    it('should grant multiple permissions', async () => {
      const grants = manager.grantPermissions('test-plugin', [
        { scope: 'network.https' },
        { scope: 'storage.kv' }
      ], {
        grantedBy: 'system'
      });

      expect(grants).toHaveLength(2);
    });

    it('should check granted permissions', async () => {
      manager.grantPermission('test-plugin', {
        scope: 'network.https'
      }, {
        grantedBy: 'system'
      });

      const hasPermission = await manager.checkPermission('test-plugin', 'network.https');

      expect(hasPermission).toBe(true);
    });

    it('should deny ungranted permissions', async () => {
      const hasPermission = await manager.checkPermission('test-plugin', 'network.https');

      expect(hasPermission).toBe(false);
    });
  });

  describe('revoking permissions', () => {
    it('should revoke a permission', () => {
      const grant = manager.grantPermission('test-plugin', {
        scope: 'network.https'
      }, {
        grantedBy: 'system'
      });

      const revoked = manager.revokePermission('test-plugin', grant.auditId, 'system');

      expect(revoked).toBe(true);
      expect(grant.revoked).toBe(true);
      expect(grant.revokedBy).toBe('system');
    });

    it('should revoke all permissions for a plugin', () => {
      manager.grantPermissions('test-plugin', [
        { scope: 'network.https' },
        { scope: 'storage.kv' }
      ], {
        grantedBy: 'system'
      });

      const count = manager.revokeAllPermissions('test-plugin', 'system');

      expect(count).toBe(2);
    });
  });

  describe('permission constraints', () => {
    it('should enforce domain constraints', async () => {
      manager.grantPermission('test-plugin', {
        scope: 'network.https',
        constraints: {
          allowedDomains: ['api.example.com']
        }
      }, {
        grantedBy: 'system'
      });

      const allowed = await manager.checkPermission(
        'test-plugin',
        'network.https',
        'https://api.example.com/data'
      );

      const blocked = await manager.checkPermission(
        'test-plugin',
        'network.https',
        'https://evil.com/data'
      );

      expect(allowed).toBe(true);
      expect(blocked).toBe(false);
    });

    it('should enforce path constraints', async () => {
      manager.grantPermission('test-plugin', {
        scope: 'fs.read',
        constraints: {
          allowedPaths: ['/home/user/.claudeflare/plugins/']
        }
      }, {
        grantedBy: 'system'
      });

      const allowed = await manager.checkPermission(
        'test-plugin',
        'fs.read',
        '/home/user/.claudeflare/plugins/test/config.json'
      );

      const blocked = await manager.checkPermission(
        'test-plugin',
        'fs.read',
        '/etc/passwd'
      );

      expect(allowed).toBe(true);
      expect(blocked).toBe(false);
    });

    it('should enforce expiration', async () => {
      const expiredDate = new Date(Date.now() - 1000);

      manager.grantPermission('test-plugin', {
        scope: 'network.https'
      }, {
        grantedBy: 'system',
        expiresAt: expiredDate
      });

      const hasPermission = await manager.checkPermission('test-plugin', 'network.https');

      expect(hasPermission).toBe(false);
    });
  });

  describe('permission requests', () => {
    it('should create a permission request', () => {
      const request = manager.requestPermissions('test-plugin', [
        { scope: 'network.https' },
        { scope: 'storage.kv' }
      ], 'Need these features');

      expect(request.pluginId).toBe('test-plugin');
      expect(request.permissions).toHaveLength(2);
      expect(request.status).toBe('pending');
      expect(request.reason).toBe('Need these features');
    });

    it('should approve a permission request', async () => {
      const request = manager.requestPermissions('test-plugin', [
        { scope: 'network.https' }
      ]);

      await manager.approveRequest(request, 'admin');

      expect(request.status).toBe('approved');
      expect(request.respondedBy).toBe('admin');

      const hasPermission = await manager.checkPermission('test-plugin', 'network.https');
      expect(hasPermission).toBe(true);
    });

    it('should deny a permission request', () => {
      const request = manager.requestPermissions('test-plugin', [
        { scope: 'system.exec' }
      ]);

      manager.denyRequest(request, 'admin', 'Too dangerous');

      expect(request.status).toBe('denied');
      expect(request.respondedBy).toBe('admin');
    });
  });

  describe('policies', () => {
    it('should add a policy', () => {
      const policy = {
        id: 'test-policy',
        name: 'Test Policy',
        permissions: [
          { scope: 'network.https' as PermissionScope }
        ],
        defaultAllow: false,
        precedence: 100,
        appliesTo: ['*']
      };

      manager.addPolicy(policy);

      const retrieved = manager.getPolicy('test-policy');
      expect(retrieved).toEqual(policy);
    });

    it('should remove a policy', () => {
      const policy = {
        id: 'test-policy',
        name: 'Test Policy',
        permissions: [],
        defaultAllow: false,
        precedence: 100,
        appliesTo: ['*']
      };

      manager.addPolicy(policy);
      const removed = manager.removePolicy('test-policy');

      expect(removed).toBe(true);
      expect(manager.getPolicy('test-policy')).toBeUndefined();
    });

    it('should apply policies to plugins', async () => {
      manager.addPolicy({
        id: 'https-policy',
        name: 'HTTPS Policy',
        permissions: [
          { scope: 'network.https' as PermissionScope }
        ],
        defaultAllow: false,
        precedence: 100,
        appliesTo: ['*']
      });

      const hasPermission = await manager.checkPermission('test-plugin', 'network.https');

      expect(hasPermission).toBe(true);
    });
  });

  describe('audit log', () => {
    it('should log permission grants', () => {
      manager.grantPermission('test-plugin', {
        scope: 'network.https'
      }, {
        grantedBy: 'system'
      });

      const log = manager.getAuditLog({ type: 'permission_grant' });

      expect(log).toHaveLength(1);
      expect(log[0].pluginId).toBe('test-plugin');
      expect(log[0].type).toBe('permission_grant');
    });

    it('should filter audit log by plugin', () => {
      manager.grantPermission('plugin-a', { scope: 'network.https' }, { grantedBy: 'system' });
      manager.grantPermission('plugin-b', { scope: 'storage.kv' }, { grantedBy: 'system' });

      const logA = manager.getAuditLog({ pluginId: 'plugin-a' });
      const logB = manager.getAuditLog({ pluginId: 'plugin-b' });

      expect(logA).toHaveLength(1);
      expect(logB).toHaveLength(1);
      expect(logA[0].pluginId).toBe('plugin-a');
      expect(logB[0].pluginId).toBe('plugin-b');
    });

    it('should limit audit log results', () => {
      for (let i = 0; i < 10; i++) {
        manager.grantPermission(`plugin-${i}`, { scope: 'network.https' }, { grantedBy: 'system' });
      }

      const log = manager.getAuditLog({ limit: 5 });

      expect(log).toHaveLength(5);
    });
  });

  describe('require permission', () => {
    it('should pass when permission is granted', async () => {
      manager.grantPermission('test-plugin', {
        scope: 'network.https'
      }, {
        grantedBy: 'system'
      });

      await expect(manager.requirePermission('test-plugin', 'network.https')).resolves.not.toThrow();
    });

    it('should throw when permission is denied', async () => {
      await expect(manager.requirePermission('test-plugin', 'system.exec')).rejects.toThrow(
        PermissionDeniedError
      );
    });
  });
});

describe('Permission utilities', () => {
  describe('parsePermissionString', () => {
    it('should parse simple permission', () => {
      const result = parsePermissionString('network.https');

      expect(result.scope).toBe('network.https');
      expect(result.resource).toBeUndefined();
    });

    it('should parse permission with resource', () => {
      const result = parsePermissionString('fs.read:/path/to/file');

      expect(result.scope).toBe('fs.read');
      expect(result.resource).toBe('/path/to/file');
    });
  });

  describe('createPermissionString', () => {
    it('should create string without resource', () => {
      const result = createPermissionString('network.https');

      expect(result).toBe('network.https');
    });

    it('should create string with resource', () => {
      const result = createPermissionString('fs.read', '/path/to/file');

      expect(result).toBe('fs.read:/path/to/file');
    });
  });

  describe('isDangerousPermission', () => {
    it('should identify dangerous permissions', () => {
      expect(isDangerousPermission('system.exec')).toBe(true);
      expect(isDangerousPermission('fs.write')).toBe(true);
      expect(isDangerousPermission('network.http')).toBe(true);
    });

    it('should identify safe permissions', () => {
      expect(isDangerousPermission('network.https')).toBe(false);
      expect(isDangerousPermission('storage.kv')).toBe(false);
    });
  });

  describe('getPermissionDescription', () => {
    it('should return permission description', () => {
      const desc = getPermissionDescription('system.exec');

      expect(desc).toBe('Execute system commands');
    });

    it('should return unknown for undefined permissions', () => {
      const desc = getPermissionDescription('unknown.permission' as PermissionScope);

      expect(desc).toBe('Unknown permission');
    });
  });
});
