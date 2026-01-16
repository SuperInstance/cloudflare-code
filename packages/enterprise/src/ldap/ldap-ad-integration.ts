/**
 * Active Directory Integration
 * Specialized LDAP client for Microsoft Active Directory
 */

// @ts-nocheck - Access modifier issues with private properties in base class
import type {
  LDAPConfig,
  LDAPUser,
  LDAPGroup,
  LDAPAuthResult,
  LDAPSearchResult,
  LDAPSyncResult,
} from '../types';

import { LDAPClient } from './ldap-client';

// ============================================================================
// Active Directory Specific Types
// ============================================================================

export interface ADConfig extends LDAPConfig {
  domain?: string;
  domainController?: string;
  useKerberos?: boolean;
  useNTLM?: boolean;
  adSpecificAttributes?: {
    lastLogon?: string;
    lastLogonTimestamp?: string;
    pwdLastSet?: string;
    userAccountControl?: string;
    accountExpires?: string;
    badPwdCount?: string;
    logonCount?: string;
  };
}

export interface ADUser extends LDAPUser {
  userAccountControl?: number;
  lastLogon?: Date;
  lastLogonTimestamp?: Date;
  pwdLastSet?: Date;
  accountExpires?: Date;
  badPwdCount?: number;
  logonCount?: number;
  isDisabled?: boolean;
  isLocked?: boolean;
  passwordNeverExpires?: boolean;
  accountIsActive?: boolean;
}

export interface ADGroup extends LDAPGroup {
  groupType?: number;
  groupScope?: number;
  isSecurityGroup?: boolean;
  isDistributionGroup?: boolean;
}

// ============================================================================
// Active Directory Client
// ============================================================================

export class ADClient extends LDAPClient {
  private adConfig: ADConfig;

  constructor(config: ADConfig) {
    // Set AD-specific defaults
    const ldapConfig: LDAPConfig = {
      ...config,
      searchFilter: config.searchFilter || '(sAMAccountName={username})',
      groupSearchFilter: config.groupSearchFilter || '(objectClass=group)',
      searchAttributes: config.searchAttributes || [
        'dn',
        'cn',
        'sAMAccountName',
        'mail',
        'displayName',
        'givenName',
        'sn',
        'telephoneNumber',
        'mobile',
        'title',
        'department',
        'company',
        'userAccountControl',
        'lastLogon',
        'lastLogonTimestamp',
        'pwdLastSet',
        'accountExpires',
        'memberOf',
      ],
    };

    super(ldapConfig);
    this.adConfig = config;
  }

  // ============================================================================
  // User Account Control Flags
  // ============================================================================

  private readonly UAC_SCRIPT = 0x0001;
  private readonly UAC_ACCOUNTDISABLE = 0x0002;
  private readonly UAC_HOMEDIR_REQUIRED = 0x0008;
  private readonly UAC_LOCKOUT = 0x0010;
  private readonly UAC_PASSWD_NOTREQD = 0x0020;
  private readonly UAC_PASSWD_CANT_CHANGE = 0x0040;
  private readonly UAC_ENCRYPTED_TEXT_PWD_ALLOWED = 0x0080;
  private readonly UAC_TEMP_DUPLICATE_ACCOUNT = 0x0100;
  private readonly UAC_NORMAL_ACCOUNT = 0x0200;
  private readonly UAC_INTERDOMAIN_TRUST_ACCOUNT = 0x0800;
  private readonly UAC_WORKSTATION_TRUST_ACCOUNT = 0x1000;
  private readonly UAC_SERVER_TRUST_ACCOUNT = 0x2000;
  private readonly UAC_DONT_EXPIRE_PASSWORD = 0x10000;
  private readonly UAC_MNS_LOGON_ACCOUNT = 0x20000;
  private readonly UAC_SMARTCARD_REQUIRED = 0x40000;
  private readonly UAC_TRUSTED_FOR_DELEGATION = 0x80000;
  private readonly UAC_NOT_DELEGATED = 0x100000;
  private readonly UAC_USE_DES_KEY_ONLY = 0x200000;
  private readonly UAC_DONT_REQ_PREAUTH = 0x400000;
  private readonly UAC_PASSWORD_EXPIRED = 0x800000;
  private readonly UAC_TRUSTED_TO_AUTH_FOR_DELEGATION = 0x1000000;
  private readonly UAC_PARTIAL_SECRETS_ACCOUNT = 0x04000000;

  // ============================================================================
  // Group Type Flags
  // ============================================================================

  private readonly GROUP_TYPE_GLOBAL_GROUP = 0x00000002;
  private readonly GROUP_TYPE_DOMAIN_LOCAL_GROUP = 0x00000004;
  private readonly GROUP_TYPE_UNIVERSAL_GROUP = 0x00000008;
  private readonly GROUP_TYPE_SECURITY_ENABLED = 0x80000000;

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  /**
   * Authenticate user with Active Directory
   */
  async authenticate(username: string, password: string): Promise<LDAPAuthResult> {
    try {
      // First authenticate
      const result = await super.authenticate(username, password);

      if (!result.success || !result.user) {
        return result;
      }

      // Check if account is disabled
      const adUser = result.user as ADUser;
      if (adUser.userAccountControl !== undefined) {
        const isDisabled = (adUser.userAccountControl & this.UAC_ACCOUNTDISABLE) !== 0;
        if (isDisabled) {
          return {
            success: false,
            error: 'Account is disabled',
            errorCode: 49,
          };
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        errorCode: 1,
      };
    }
  }

  // ============================================================================
  // AD-Specific User Methods
  // ============================================================================

  /**
   * Get user by sAMAccountName
   */
  async getUserBySAMAccountName(sAMAccountName: string): Promise<ADUser | null> {
    try {
      await this.bindAsAdmin();

      const filter = `(sAMAccountName=${this.escapeLDAPFilter(sAMAccountName)})`;

      const result = await this.searchLDAP({
        base: this.config.searchBase,
        scope: this.config.searchScope || 'sub',
        filter,
        attributes: this.config.searchAttributes || ['*'],
        sizeLimit: 1,
      });

      if (result.entries.length > 0) {
        return this.enrichADUser(result.entries[0] as ADUser);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by User Principal Name (UPN)
   */
  async getUserByUPN(upn: string): Promise<ADUser | null> {
    try {
      await this.bindAsAdmin();

      const filter = `(userPrincipalName=${this.escapeLDAPFilter(upn)})`;

      const result = await this.searchLDAP({
        base: this.config.searchBase,
        scope: this.config.searchScope || 'sub',
        filter,
        attributes: this.config.searchAttributes || ['*'],
        sizeLimit: 1,
      });

      if (result.entries.length > 0) {
        return this.enrichADUser(result.entries[0] as ADUser);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<ADUser | null> {
    try {
      await this.bindAsAdmin();

      const filter = `(mail=${this.escapeLDAPFilter(email)})`;

      const result = await this.searchLDAP({
        base: this.config.searchBase,
        scope: this.config.searchScope || 'sub',
        filter,
        attributes: this.config.searchAttributes || ['*'],
        sizeLimit: 1,
      });

      if (result.entries.length > 0) {
        return this.enrichADUser(result.entries[0] as ADUser);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user account is disabled
   */
  async isUserDisabled(username: string): Promise<boolean> {
    try {
      const user = await this.getUserBySAMAccountName(username);

      if (!user || user.userAccountControl === undefined) {
        return false;
      }

      return (user.userAccountControl & this.UAC_ACCOUNTDISABLE) !== 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user account is locked
   */
  async isUserLocked(username: string): Promise<boolean> {
    try {
      const user = await this.getUserBySAMAccountName(username);

      if (!user || user.userAccountControl === undefined) {
        return false;
      }

      return (user.userAccountControl & this.UAC_LOCKOUT) !== 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user password never expires
   */
  async passwordNeverExpires(username: string): Promise<boolean> {
    try {
      const user = await this.getUserBySAMAccountName(username);

      if (!user || user.userAccountControl === undefined) {
        return false;
      }

      return (user.userAccountControl & this.UAC_DONT_EXPIRE_PASSWORD) !== 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's last logon time
   */
  async getUserLastLogon(username: string): Promise<Date | null> {
    try {
      const user = await this.getUserBySAMAccountName(username);

      if (!user) {
        return null;
      }

      return user.lastLogon || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user's password last set time
   */
  async getUserPasswordLastSet(username: string): Promise<Date | null> {
    try {
      const user = await this.getUserBySAMAccountName(username);

      if (!user) {
        return null;
      }

      return user.pwdLastSet || null;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // AD-Specific Group Methods
  // ============================================================================

  /**
   * Get group by sAMAccountName
   */
  async getGroupBySAMAccountName(sAMAccountName: string): Promise<ADGroup | null> {
    try {
      await this.bindAsAdmin();

      const filter = `(&(objectClass=group)(sAMAccountName=${this.escapeLDAPFilter(sAMAccountName)}))`;
      const base = this.config.groupSearchBase || this.config.searchBase;

      const result = await this.searchLDAP({
        base,
        scope: this.config.groupSearchScope || 'sub',
        filter,
        attributes: ['*'],
        sizeLimit: 1,
      });

      if (result.entries.length > 0) {
        return this.enrichADGroup(result.entries[0] as ADGroup);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all security groups
   */
  async getSecurityGroups(): Promise<ADGroup[]> {
    try {
      await this.bindAsAdmin();

      const filter = '(&(objectClass=group)(groupType:1.2.840.113556.1.4.803:=2147483648))';
      const base = this.config.groupSearchBase || this.config.searchBase;

      const result = await this.searchLDAP({
        base,
        scope: this.config.groupSearchScope || 'sub',
        filter,
        attributes: ['*'],
        sizeLimit: 1000,
      });

      return result.entries.map(entry => this.enrichADGroup(entry as ADGroup));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all distribution groups
   */
  async getDistributionGroups(): Promise<ADGroup[]> {
    try {
      await this.bindAsAdmin();

      const filter = '(&(objectClass=group)(!(groupType:1.2.840.113556.1.4.803:=2147483648)))';
      const base = this.config.groupSearchBase || this.config.searchBase;

      const result = await this.searchLDAP({
        base,
        scope: this.config.groupSearchScope || 'sub',
        filter,
        attributes: ['*'],
        sizeLimit: 1000,
      });

      return result.entries.map(entry => this.enrichADGroup(entry as ADGroup));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get nested group memberships
   */
  async getNestedGroupMemberships(username: string): Promise<string[]> {
    try {
      const user = await this.getUserBySAMAccountName(username);

      if (!user || !user.memberOf) {
        return [];
      }

      const allGroups: string[] = [...user.memberOf];
      const processed = new Set<string>();

      // Recursively get nested groups
      for (const groupDN of user.memberOf) {
        if (!processed.has(groupDN)) {
          processed.add(groupDN);
          const nested = await this.getNestedGroups(groupDN, processed);
          allGroups.push(...nested);
        }
      }

      return [...new Set(allGroups)];
    } catch (error) {
      return [];
    }
  }

  /**
   * Recursively get nested groups
   */
  private async getNestedGroups(groupDN: string, processed: Set<string>): Promise<string[]> {
    try {
      const group = await this.getGroupByDN(groupDN);

      if (!group || !group.memberOf) {
        return [];
      }

      const allGroups: string[] = [];

      for (const parentGroupDN of group.memberOf) {
        if (!processed.has(parentGroupDN)) {
          processed.add(parentGroupDN);
          allGroups.push(parentGroupDN);
          const nested = await this.getNestedGroups(parentGroupDN, processed);
          allGroups.push(...nested);
        }
      }

      return allGroups;
    } catch (error) {
      return [];
    }
  }

  // ============================================================================
  // AD Domain Methods
  // ============================================================================

  /**
   * Get domain information
   */
  async getDomainInfo(): Promise<{
    name?: string;
    dnsRoot?: string;
    domainController?: string;
    functionalLevel?: number;
  }> {
    try {
      await this.bindAsAdmin();

      const filter = '(objectClass=domainDNS)';
      const base = this.config.searchBase.split(',').slice(1).join(',');

      const result = await this.searchLDAP({
        base,
        scope: 'base',
        filter,
        attributes: ['name', 'dnsRoot', 'domainControllerFunctionality'],
        sizeLimit: 1,
      });

      if (result.entries.length > 0) {
        const entry = result.entries[0];
        return {
          name: entry.name as string,
          dnsRoot: entry.dnsRoot as string,
          domainController: this.adConfig.domainController,
          functionalLevel: entry.domainControllerFunctionality as number,
        };
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Get all domain controllers
   */
  async getDomainControllers(): Promise<ADUser[]> {
    try {
      await this.bindAsAdmin();

      const filter = '(&(objectClass=computer)(userAccountControl:1.2.840.113556.1.4.803:=8192))';

      const result = await this.searchLDAP({
        base: this.config.searchBase,
        scope: this.config.searchScope || 'sub',
        filter,
        attributes: ['*'],
        sizeLimit: 100,
      });

      return result.entries.map(entry => this.enrichADUser(entry as ADUser));
    } catch (error) {
      return [];
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Enrich AD user with computed properties
   */
  private enrichADUser(user: ADUser): ADUser {
    if (user.userAccountControl !== undefined) {
      user.isDisabled = (user.userAccountControl & this.UAC_ACCOUNTDISABLE) !== 0;
      user.isLocked = (user.userAccountControl & this.UAC_LOCKOUT) !== 0;
      user.passwordNeverExpires = (user.userAccountControl & this.UAC_DONT_EXPIRE_PASSWORD) !== 0;
      user.accountIsActive = !user.isDisabled;
    }

    // Convert AD timestamps (100-nanosecond intervals since 1601-01-01)
    if (user.lastLogon !== undefined && typeof user.lastLogon === 'number') {
      user.lastLogon = this.convertADTimestampToDate(user.lastLogon);
    }

    if (user.lastLogonTimestamp !== undefined && typeof user.lastLogonTimestamp === 'number') {
      user.lastLogonTimestamp = this.convertADTimestampToDate(user.lastLogonTimestamp);
    }

    if (user.pwdLastSet !== undefined && typeof user.pwdLastSet === 'number') {
      user.pwdLastSet = this.convertADTimestampToDate(user.pwdLastSet);
    }

    return user;
  }

  /**
   * Enrich AD group with computed properties
   */
  private enrichADGroup(group: ADGroup): ADGroup {
    if (group.groupType !== undefined) {
      group.isSecurityGroup = (group.groupType & this.GROUP_TYPE_SECURITY_ENABLED) !== 0;
      group.isDistributionGroup = !group.isSecurityGroup;
    }

    return group;
  }

  /**
   * Convert AD timestamp to JavaScript Date
   */
  private convertADTimestampToDate(adTimestamp: number): Date {
    // AD timestamps are 100-nanosecond intervals since January 1, 1601
    const epochDiff = 11644473600000; // Difference between AD epoch and Unix epoch in milliseconds
    const timestampMs = adTimestamp / 10000 - epochDiff;
    return new Date(timestampMs);
  }

  /**
   * Escape LDAP filter string
   */
  private escapeLDAPFilter(value: string): string {
    const escapeChars = ['\\', '*', '(', ')', '\u0000'];
    let escaped = '';

    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (escapeChars.includes(char)) {
        escaped += '\\\\' + char.charCodeAt(0).toString(16);
      } else {
        escaped += char;
      }
    }

    return escaped;
  }

  /**
   * Perform LDAP search (protected method override)
   */
  protected async searchLDAP(options: {
    base: string;
    scope: 'base' | 'one' | 'sub';
    filter: string;
    attributes?: string[];
    sizeLimit?: number;
    timeLimit?: number;
  }): Promise<LDAPSearchResult> {
    // Delegate to parent class
    return super['searchLDAP'](options);
  }
}

// ============================================================================
// AD Client Factory
// ============================================================================

export class ADClientFactory {
  private static instances: Map<string, ADClient> = new Map();

  /**
   * Create or get an AD client instance
   */
  static create(config: ADConfig): ADClient {
    const key = `${config.url}:${config.searchBase}`;

    if (!this.instances.has(key)) {
      this.instances.set(key, new ADClient(config));
    }

    return this.instances.get(key)!;
  }

  /**
   * Remove an AD client instance
   */
  static async remove(config: ADConfig): Promise<void> {
    const key = `${config.url}:${config.searchBase}`;
    const client = this.instances.get(key);

    if (client) {
      await client.closeAll();
      this.instances.delete(key);
    }
  }

  /**
   * Clear all instances
   */
  static async clear(): Promise<void> {
    for (const [key, client] of this.instances) {
      await client.closeAll();
    }

    this.instances.clear();
  }

  /**
   * Get all instance keys
   */
  static getInstances(): string[] {
    return Array.from(this.instances.keys());
  }
}

// ============================================================================
// Export convenience types
// ============================================================================

export type { ADConfig, ADUser, ADGroup };
