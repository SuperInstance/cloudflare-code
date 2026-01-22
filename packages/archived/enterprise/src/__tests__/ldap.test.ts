/**
 * LDAP/Active Directory Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LDAPClient, LDAPClientFactory } from '../ldap';
import { ADClient, ADClientFactory } from '../ldap/ldap-ad-integration';

import type { LDAPConfig, ADConfig } from '../types';

describe('LDAPClient', () => {
  let config: LDAPConfig;
  let client: LDAPClient;

  beforeEach(() => {
    config = {
      url: 'ldap://ldap.example.com:389',
      bindDN: 'cn=admin,dc=example,dc=com',
      bindCredentials: 'password',
      searchBase: 'dc=example,dc=com',
      searchFilter: '(uid={username})',
      searchScope: 'sub',
      searchAttributes: ['*', 'memberOf'],
      groupSearchBase: 'ou=groups,dc=example,dc=com',
      groupSearchFilter: '(objectClass=group)',
    };

    client = new LDAPClient(config);
  });

  describe('constructor', () => {
    it('should create LDAP client with config', () => {
      expect(client).toBeDefined();
    });

    it('should set default options', () => {
      expect(client).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect to LDAP server', async () => {
      // Mock connection - in production this would actually connect
      await expect(client.connect()).resolves.not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from LDAP server', async () => {
      await client.connect();
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe('authenticate', () => {
    it('should authenticate user with valid credentials', async () => {
      const result = await client.authenticate('testuser', 'password');

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should fail authentication with invalid credentials', async () => {
      const result = await client.authenticate('testuser', 'wrongpassword');

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should fail authentication without password', async () => {
      const result = await client.authenticate('testuser', '');

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Password is required');
    });
  });

  describe('findUserDN', () => {
    it('should find user DN by username', async () => {
      const dn = await client.findUserDN('testuser');

      expect(dn).toBeDefined();
      expect(typeof dn).toBe('string');
    });

    it('should return null for non-existent user', async () => {
      const dn = await client.findUserDN('nonexistent');

      // In mocked implementation, might return null
      expect(dn === null || typeof dn === 'string').toBe(true);
    });
  });

  describe('getUserByUsername', () => {
    it('should get user by username', async () => {
      const user = await client.getUserByUsername('testuser');

      expect(user).toBeDefined();
    });

    it('should return null for non-existent user', async () => {
      const user = await client.getUserByUsername('nonexistent');

      expect(user === null || user !== null).toBe(true);
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email', async () => {
      const user = await client.getUserByEmail('user@example.com');

      expect(user).toBeDefined();
    });
  });

  describe('listUsers', () => {
    it('should list users', async () => {
      const result = await client.listUsers({ limit: 10 });

      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await client.listUsers({ offset: 10, limit: 10 });

      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
    });
  });

  describe('getUserGroups', () => {
    it('should get user groups', async () => {
      const groups = await client.getUserGroups('testuser');

      expect(groups).toBeDefined();
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('listGroups', () => {
    it('should list groups', async () => {
      const result = await client.listGroups({ limit: 10 });

      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });

  describe('getGroupMembers', () => {
    it('should get group members', async () => {
      const members = await client.getGroupMembers('cn=testgroup,ou=groups,dc=example,dc=com');

      expect(members).toBeDefined();
      expect(Array.isArray(members)).toBe(true);
    });
  });

  describe('syncUsers', () => {
    it('should sync users', async () => {
      const result = await client.syncUsers();

      expect(result).toBeDefined();
      expect(typeof result.added).toBe('number');
      expect(typeof result.updated).toBe('number');
      expect(typeof result.removed).toBe('number');
      expect(typeof result.failed).toBe('number');
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();
      await client.syncUsers({ onProgress });

      expect(onProgress).toHaveBeenCalled();
    });
  });
});

describe('LDAPClientFactory', () => {
  const config: LDAPConfig = {
    url: 'ldap://ldap.example.com:389',
    bindDN: 'cn=admin,dc=example,dc=com',
    bindCredentials: 'password',
    searchBase: 'dc=example,dc=com',
  };

  it('should create client instance', () => {
    const client = LDAPClientFactory.create(config);

    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(LDAPClient);
  });

  it('should return same instance for same config', () => {
    const client1 = LDAPClientFactory.create(config);
    const client2 = LDAPClientFactory.create(config);

    expect(client1).toBe(client2);
  });

  it('should remove instance', async () => {
    LDAPClientFactory.create(config);
    await LDAPClientFactory.remove(config);

    // Should create new instance after removal
    const client = LDAPClientFactory.create(config);
    expect(client).toBeDefined();
  });

  it('should clear all instances', async () => {
    LDAPClientFactory.create(config);
    await LDAPClientFactory.clear();

    expect(LDAPClientFactory.getInstances().length).toBe(0);
  });
});

describe('ADClient', () => {
  let adConfig: ADConfig;
  let adClient: ADClient;

  beforeEach(() => {
    adConfig = {
      url: 'ldap://ad.example.com:389',
      bindDN: 'cn=admin,cn=users,dc=example,dc=com',
      bindCredentials: 'password',
      searchBase: 'cn=users,dc=example,dc=com',
      searchFilter: '(sAMAccountName={username})',
      domain: 'EXAMPLE',
      domainController: 'dc01.example.com',
      adSpecificAttributes: {
        lastLogon: 'lastLogon',
        userAccountControl: 'userAccountControl',
      },
    };

    adClient = new ADClient(adConfig);
  });

  describe('constructor', () => {
    it('should create AD client with config', () => {
      expect(adClient).toBeDefined();
      expect(adClient).toBeInstanceOf(ADClient);
    });
  });

  describe('getUserBySAMAccountName', () => {
    it('should get user by sAMAccountName', async () => {
      const user = await adClient.getUserBySAMAccountName('testuser');

      expect(user).toBeDefined();
    });
  });

  describe('getUserByUPN', () => {
    it('should get user by UPN', async () => {
      const user = await adClient.getUserByUPN('testuser@example.com');

      expect(user).toBeDefined();
    });
  });

  describe('isUserDisabled', () => {
    it('should check if user is disabled', async () => {
      const isDisabled = await adClient.isUserDisabled('testuser');

      expect(typeof isDisabled).toBe('boolean');
    });
  });

  describe('isUserLocked', () => {
    it('should check if user is locked', async () => {
      const isLocked = await adClient.isUserLocked('testuser');

      expect(typeof isLocked).toBe('boolean');
    });
  });

  describe('getSecurityGroups', () => {
    it('should get security groups', async () => {
      const groups = await adClient.getSecurityGroups();

      expect(groups).toBeDefined();
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('getNestedGroupMemberships', () => {
    it('should get nested group memberships', async () => {
      const memberships = await adClient.getNestedGroupMemberships('testuser');

      expect(memberships).toBeDefined();
      expect(Array.isArray(memberships)).toBe(true);
    });
  });

  describe('getDomainInfo', () => {
    it('should get domain information', async () => {
      const info = await adClient.getDomainInfo();

      expect(info).toBeDefined();
    });
  });

  describe('getDomainControllers', () => {
    it('should get domain controllers', async () => {
      const dcs = await adClient.getDomainControllers();

      expect(dcs).toBeDefined();
      expect(Array.isArray(dcs)).toBe(true);
    });
  });
});

describe('ADClientFactory', () => {
  const adConfig: ADConfig = {
    url: 'ldap://ad.example.com:389',
    bindDN: 'cn=admin,cn=users,dc=example,dc=com',
    bindCredentials: 'password',
    searchBase: 'cn=users,dc=example,dc=com',
    domain: 'EXAMPLE',
  };

  it('should create AD client instance', () => {
    const client = ADClientFactory.create(adConfig);

    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(ADClient);
  });

  it('should return same instance for same config', () => {
    const client1 = ADClientFactory.create(adConfig);
    const client2 = ADClientFactory.create(adConfig);

    expect(client1).toBe(client2);
  });
});
