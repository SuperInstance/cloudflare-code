/**
 * JIT Provisioning Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { JITProvisioningService } from '../jit/jit-provisioning';

import type { JITConfig } from '../types';

describe('JITProvisioningService', () => {
  let config: JITConfig;
  let service: JITProvisioningService;

  beforeEach(() => {
    config = {
      enabled: true,
      autoCreateUsers: true,
      autoUpdateUsers: true,
      defaultRoles: ['User'],
      defaultGroups: ['Users'],
      attributeMapping: {
        userId: 'NameID',
        email: 'email',
        firstName: 'firstName',
        lastName: 'lastName',
        displayName: 'displayName',
      },
      groupMapping: {
        enabled: true,
        sourceAttribute: 'groups',
        groupMapping: {
          'Admins': 'Administrators',
          'Developers': 'Developers',
        },
        defaultGroups: ['Users'],
        autoCreateGroups: true,
      },
      roleMapping: {
        enabled: true,
        sourceAttribute: 'roles',
        roleMapping: {
          'admin': 'Administrator',
          'developer': 'Developer',
        },
        defaultRoles: ['User'],
      },
      licenseAssignment: {
        enabled: true,
        defaultLicense: 'standard',
      },
      domainRestrictions: ['example.com', 'partner.org'],
      provisioningRules: [
        {
          name: 'Block external domains',
          condition: {
            field: 'email',
            operator: 'endsWith',
            value: '@external.com',
          },
          actions: [
            {
              type: 'skipProvisioning',
              target: '',
            },
          ],
          priority: 1,
        },
      ],
    };

    service = new JITProvisioningService(config, {
      source: 'saml',
      domainWhitelist: ['example.com'],
      requireApproval: false,
    });
  });

  describe('constructor', () => {
    it('should create JIT service with config', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(JITProvisioningService);
    });
  });

  describe('provisionUser', () => {
    it('should provision user with valid data', async () => {
      const userData = {
        userId: 'user123',
        email: 'testuser@example.com',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
        department: 'Engineering',
        title: 'Developer',
        groups: ['Developers'],
        roles: ['developer'],
      };

      const result = await service.provisionUser(userData);

      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
      expect(result.groups).toBeDefined();
      expect(result.roles).toBeDefined();
      expect(result.licenses).toBeDefined();
    });

    it('should fail to provision user without userId', async () => {
      const userData = {
        email: 'testuser@example.com',
      };

      const result = await service.provisionUser(userData);

      expect(result.success).toBe(false);
      expect(result.action).toBe('skipped');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail to provision user without email', async () => {
      const userData = {
        userId: 'user123',
      };

      const result = await service.provisionUser(userData);

      expect(result.success).toBe(false);
      expect(result.action).toBe('skipped');
    });

    it('should fail to provision user with invalid email', async () => {
      const userData = {
        userId: 'user123',
        email: 'invalid-email',
      };

      const result = await service.provisionUser(userData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should fail to provision user from restricted domain', async () => {
      const userData = {
        userId: 'user123',
        email: 'user@external.com',
      };

      const result = await service.provisionUser(userData);

      expect(result.success).toBe(false);
      expect(result.action).toBe('skipped');
      expect(result.errors).toContain('Domain not allowed: external.com');
    });

    it('should apply attribute mapping', async () => {
      const userData = {
        userId: 'user123',
        email: 'testuser@example.com',
        customAttributes: {
          NameID: 'custom-user-id',
          email: 'custom@example.com',
          firstName: 'Custom',
        },
      };

      const result = await service.provisionUser(userData);

      expect(result).toBeDefined();
    });

    it('should apply group mappings', async () => {
      const userData = {
        userId: 'user123',
        email: 'testuser@example.com',
        groups: ['Admins', 'Developers'],
      };

      const result = await service.provisionUser(userData);

      expect(result.groups).toBeDefined();
      expect(result.groups).toContain('Administrators');
      expect(result.groups).toContain('Developers');
    });

    it('should apply role mappings', async () => {
      const userData = {
        userId: 'user123',
        email: 'testuser@example.com',
        roles: ['admin'],
      };

      const result = await service.provisionUser(userData);

      expect(result.roles).toBeDefined();
      expect(result.roles).toContain('Administrator');
    });

    it('should assign default license', async () => {
      const userData = {
        userId: 'user123',
        email: 'testuser@example.com',
      };

      const result = await service.provisionUser(userData);

      expect(result.licenses).toBeDefined();
      expect(result.licenses).toContain('standard');
    });

    it('should skip provisioning based on rule', async () => {
      const userData = {
        userId: 'user123',
        email: 'user@external.com',
      };

      const result = await service.provisionUser(userData);

      expect(result.action).toBe('skipped');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('provisionFromSAML', () => {
    it('should provision user from SAML attributes', async () => {
      const samlAttributes = {
        NameID: ['user123'],
        email: ['testuser@example.com'],
        firstName: ['Test'],
        lastName: ['User'],
        displayName: ['Test User'],
      };

      const result = await service.provisionFromSAML(samlAttributes);

      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
    });
  });

  describe('provisionFromLDAP', () => {
    it('should provision user from LDAP attributes', async () => {
      const ldapAttributes = {
        uid: 'user123',
        mail: 'testuser@example.com',
        givenName: 'Test',
        sn: 'User',
        displayName: 'Test User',
        memberOf: ['cn=Developers,ou=groups,dc=example,dc=com'],
      };

      const result = await service.provisionFromLDAP(ldapAttributes);

      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
    });
  });

  describe('provisionFromOIDC', () => {
    it('should provision user from OIDC claims', async () => {
      const oidcClaims = {
        sub: 'user123',
        email: 'testuser@example.com',
        given_name: 'Test',
        family_name: 'User',
        name: 'Test User',
      };

      const result = await service.provisionFromOIDC(oidcClaims);

      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
    });
  });
});
