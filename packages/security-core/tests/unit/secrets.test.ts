/**
 * Unit Tests for Secrets Manager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SecretsManager,
  InMemorySecretStorage,
  ConsoleAuditLogger,
  SecretOperation,
} from '../../src/secrets/manager';
import { SecretAccessDeniedError, SecretNotFoundError } from '../../src/types';

describe('SecretsManager', () => {
  let secretsManager: SecretsManager;
  let storage: InMemorySecretStorage;
  let auditLogger: ConsoleAuditLogger;

  beforeEach(() => {
    storage = new InMemorySecretStorage();
    auditLogger = new ConsoleAuditLogger();
    secretsManager = new SecretsManager({
      storage,
      auditLogger,
      encryptionRequired: true,
      accessLoggingEnabled: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSecret', () => {
    it('should create a new secret', async () => {
      const secret = await secretsManager.createSecret({
        name: 'test-secret',
        value: 'my-secret-value',
        description: 'Test secret',
        createdBy: 'user-123',
      });

      expect(secret).toBeDefined();
      expect(secret.name).toBe('test-secret');
      expect(secret.version).toBe(1);
      expect(secret.createdBy).toBe('user-123');
      expect(secret.currentVersion.value).toBeDefined();
    });

    it('should encrypt secret value when encryption is required', async () => {
      const secret = await secretsManager.createSecret({
        name: 'encrypted-secret',
        value: 'sensitive-data',
        createdBy: 'user-123',
      });

      expect(secret.currentVersion.value).not.toBe('sensitive-data');
      expect(secret.currentVersion.value).toMatch(/^{.*}$/); // JSON format
    });

    it('should throw error when secret already exists', async () => {
      await secretsManager.createSecret({
        name: 'duplicate-secret',
        value: 'value-1',
        createdBy: 'user-123',
      });

      await expect(
        secretsManager.createSecret({
          name: 'duplicate-secret',
          value: 'value-2',
          createdBy: 'user-123',
        })
      ).rejects.toThrow('already exists');
    });

    it('should create secret with custom access policy', async () => {
      const secret = await secretsManager.createSecret({
        name: 'custom-policy-secret',
        value: 'value',
        createdBy: 'admin-123',
        accessPolicy: {
          allowedPrincipals: ['admin-123', 'user-456'],
          requireMfa: true,
          auditAccess: true,
          allowedOperations: [SecretOperation.READ, SecretOperation.WRITE],
          allowedIpRanges: ['*'],
        },
      });

      expect(secret.accessPolicy.allowedPrincipals).toContain('admin-123');
      expect(secret.accessPolicy.allowedPrincipals).toContain('user-456');
      expect(secret.accessPolicy.requireMfa).toBe(true);
    });

    it('should create secret with custom rotation policy', async () => {
      const secret = await secretsManager.createSecret({
        name: 'custom-rotation-secret',
        value: 'value',
        createdBy: 'admin-123',
        rotationPolicy: {
          enabled: true,
          intervalDays: 30,
          automaticRotation: true,
          notificationDaysBefore: 14,
          gracePeriodDays: 7,
        },
      });

      expect(secret.rotationPolicy.enabled).toBe(true);
      expect(secret.rotationPolicy.intervalDays).toBe(30);
      expect(secret.rotationPolicy.automaticRotation).toBe(true);
    });
  });

  describe('getSecret', () => {
    beforeEach(async () => {
      await secretsManager.createSecret({
        name: 'get-test-secret',
        value: 'secret-to-retrieve',
        createdBy: 'creator-123',
      });
    });

    it('should retrieve a secret by ID', async () => {
      const secret = await secretsManager.getSecret('get-test-secret', 'creator-123');

      expect(secret).toBeDefined();
      expect(secret.name).toBe('get-test-secret');
      expect(secret.currentVersion.value).toBe('secret-to-retrieve'); // Decrypted
    });

    it('should throw error for non-existent secret', async () => {
      await expect(
        secretsManager.getSecret('non-existent', 'user-123')
      ).rejects.toThrow(SecretNotFoundError);
    });

    it('should update last accessed time', async () => {
      const beforeAccess = new Date();
      await secretsManager.getSecret('get-test-secret', 'creator-123');

      const secret = await storage.get('get-test-secret');
      expect(secret?.lastAccessedAt).toBeDefined();
      expect(secret?.lastAccessedAt!.getTime()).toBeGreaterThanOrEqual(beforeAccess.getTime());
    });
  });

  describe('updateSecret', () => {
    let secretId: string;

    beforeEach(async () => {
      const secret = await secretsManager.createSecret({
        name: 'update-test-secret',
        value: 'original-value',
        createdBy: 'creator-123',
      });
      secretId = secret.id;
    });

    it('should update secret value', async () => {
      const updated = await secretsManager.updateSecret(
        secretId,
        'creator-123',
        { value: 'new-value' }
      );

      expect(updated.version).toBe(2);
      expect(updated.lastRotatedAt).toBeDefined();
    });

    it('should update secret description', async () => {
      const updated = await secretsManager.updateSecret(
        secretId,
        'creator-123',
        { description: 'New description' }
      );

      expect(updated.description).toBe('New description');
    });

    it('should merge tags', async () => {
      const updated = await secretsManager.updateSecret(
        secretId,
        'creator-123',
        { tags: { environment: 'production', owner: 'team-1' } }
      );

      expect(updated.tags.environment).toBe('production');
      expect(updated.tags.owner).toBe('team-1');
    });

    it('should maintain previous versions', async () => {
      await secretsManager.updateSecret(secretId, 'creator-123', { value: 'value-2' });
      await secretsManager.updateSecret(secretId, 'creator-123', { value: 'value-3' });

      const secret = await storage.get(secretId);
      expect(secret?.previousVersions).toBeDefined();
      expect(secret?.previousVersions?.length).toBeGreaterThan(0);
    });
  });

  describe('rotateSecret', () => {
    let secretId: string;

    beforeEach(async () => {
      const secret = await secretsManager.createSecret({
        name: 'rotation-test-secret',
        value: 'initial-value',
        createdBy: 'creator-123',
        rotationPolicy: {
          enabled: true,
          intervalDays: 30,
          automaticRotation: false,
          notificationDaysBefore: 7,
          gracePeriodDays: 14,
        },
      });
      secretId = secret.id;
    });

    it('should rotate secret value', async () => {
      const rotated = await secretsManager.rotateSecret(
        secretId,
        'creator-123',
        'rotated-value'
      );

      expect(rotated.version).toBe(2);
      expect(rotated.lastRotatedAt).toBeDefined();
    });

    it('should set next rotation date', async () => {
      const rotated = await secretsManager.rotateSecret(
        secretId,
        'creator-123',
        'rotated-value'
      );

      expect(rotated.nextRotationAt).toBeDefined();
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      expect(rotated.nextRotationAt!.getTime()).toBeCloseTo(expectedDate.getTime(), -5);
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret', async () => {
      const secret = await secretsManager.createSecret({
        name: 'delete-test-secret',
        value: 'value',
        createdBy: 'creator-123',
      });

      await secretsManager.deleteSecret(secret.id, 'creator-123');

      const exists = await storage.exists(secret.id);
      expect(exists).toBe(false);
    });

    it('should throw error when deleting non-existent secret', async () => {
      await expect(
        secretsManager.deleteSecret('non-existent', 'user-123')
      ).rejects.toThrow(SecretNotFoundError);
    });
  });

  describe('listSecrets', () => {
    beforeEach(async () => {
      await secretsManager.createSecret({
        name: 'secret-1',
        value: 'value-1',
        createdBy: 'user-1',
        tags: { environment: 'dev' },
      });

      await secretsManager.createSecret({
        name: 'secret-2',
        value: 'value-2',
        createdBy: 'user-2',
        tags: { environment: 'prod' },
      });

      await secretsManager.createSecret({
        name: 'secret-3',
        value: 'value-3',
        createdBy: 'user-1',
        tags: { environment: 'dev' },
      });
    });

    it('should list all secrets', async () => {
      const secrets = await secretsManager.listSecrets();
      expect(secrets.length).toBe(3);
    });

    it('should filter by creator', async () => {
      const secrets = await secretsManager.listSecrets({ createdBy: 'user-1' });
      expect(secrets.length).toBe(2);
    });

    it('should filter by tags', async () => {
      const secrets = await secretsManager.listSecrets({
        tags: { environment: 'dev' },
      });
      expect(secrets.length).toBe(2);
    });

    it('should search by name or description', async () => {
      const secrets = await secretsManager.listSecrets({ search: 'secret-1' });
      expect(secrets.length).toBe(1);
      expect(secrets[0].name).toBe('secret-1');
    });
  });

  describe('createTemporaryCredential', () => {
    it('should create temporary credential', async () => {
      const secret = await secretsManager.createSecret({
        name: 'share-test-secret',
        value: 'shared-value',
        createdBy: 'owner-123',
      });

      const credential = await secretsManager.createTemporaryCredential({
        secretId: secret.id,
        principalId: 'recipient-456',
        requesterId: 'owner-123',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        permissions: [SecretOperation.READ],
        maxUses: 5,
      });

      expect(credential).toBeDefined();
      expect(credential.secretId).toBe(secret.id);
      expect(credential.principalId).toBe('recipient-456');
      expect(credential.permissions).toContain(SecretOperation.READ);
      expect(credential.maxUses).toBe(5);
    });
  });

  describe('access control', () => {
    it('should grant access to a principal', async () => {
      const secret = await secretsManager.createSecret({
        name: 'access-test-secret',
        value: 'value',
        createdBy: 'owner-123',
      });

      await secretsManager.grantAccess(
        secret.id,
        'new-user-456',
        [SecretOperation.READ],
        'owner-123'
      );

      const retrieved = await storage.get(secret.id);
      expect(retrieved?.accessPolicy.allowedPrincipals).toContain('new-user-456');
    });

    it('should revoke access from a principal', async () => {
      const secret = await secretsManager.createSecret({
        name: 'revoke-test-secret',
        value: 'value',
        createdBy: 'owner-123',
        accessPolicy: {
          allowedPrincipals: ['user-1', 'user-2'],
          requireMfa: false,
          auditAccess: true,
          allowedOperations: [SecretOperation.READ],
        },
      });

      await secretsManager.revokeAccess(secret.id, 'user-1', 'owner-123');

      const retrieved = await storage.get(secret.id);
      expect(retrieved?.accessPolicy.allowedPrincipals).not.toContain('user-1');
    });

    it('should check access permissions', async () => {
      const secret = await secretsManager.createSecret({
        name: 'check-access-secret',
        value: 'value',
        createdBy: 'owner-123',
        accessPolicy: {
          allowedPrincipals: ['authorized-user'],
          requireMfa: false,
          auditAccess: true,
          allowedOperations: [SecretOperation.READ],
        },
      });

      const hasAccess = await secretsManager.checkAccess(
        secret.id,
        'authorized-user',
        SecretOperation.READ
      );

      expect(hasAccess).toBe(true);
    });
  });

  describe('getSecretsNeedingRotation', () => {
    it('should return secrets needing rotation', async () => {
      await secretsManager.createSecret({
        name: 'needs-rotation-secret',
        value: 'value',
        createdBy: 'creator-123',
        rotationPolicy: {
          enabled: true,
          intervalDays: 1,
          automaticRotation: false,
          notificationDaysBefore: 1,
          gracePeriodDays: 1,
        },
      });

      // Manually set last rotation to past
      const secret = await storage.get('needs-rotation-secret');
      if (secret) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 2);
        secret.lastRotatedAt = pastDate;
        await storage.put(secret);
      }

      const needsRotation = await secretsManager.getSecretsNeedingRotation();
      expect(needsRotation.length).toBeGreaterThan(0);
    });
  });
});
