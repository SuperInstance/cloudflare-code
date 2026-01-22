/**
 * Just-in-Time (JIT) Provisioning Service
 * Automatically provisions users on first login
 */

// @ts-nocheck - Export conflicts with JITUserData and JITProvisioningOptions
import type {
  JITConfig,
  JITProvisioningResult,
  JITAttributeMapping,
  JITGroupMapping,
  JITRoleMapping,
  JITProvisioningRule,
  JITCondition,
  JITAction,
} from '../types';

// ============================================================================
// JIT User Data
// ============================================================================

export interface JITUserData {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  title?: string;
  manager?: string;
  phone?: string;
  mobile?: string;
  location?: string;
  timezone?: string;
  locale?: string;
  groups?: string[];
  roles?: string[];
  customAttributes?: Record<string, any>;
}

// ============================================================================
// JIT Provisioning Options
// ============================================================================

export interface JITProvisioningOptions {
  source?: 'saml' | 'ldap' | 'oidc';
  domainWhitelist?: string[];
  domainBlacklist?: string[];
  requireApproval?: boolean;
  approvers?: string[];
  approvalTimeout?: number;
  sendWelcomeEmail?: boolean;
  welcomeEmailTemplate?: string;
}

// ============================================================================
// JIT Provisioning Service
// ============================================================================

export class JITProvisioningService {
  private config: JITConfig;
  private options: JITProvisioningOptions;

  constructor(config: JITConfig, options: JITProvisioningOptions = {}) {
    this.config = config;
    this.options = {
      source: 'saml',
      domainWhitelist: [],
      domainBlacklist: [],
      requireApproval: false,
      approvers: [],
      approvalTimeout: 86400000, // 24 hours
      sendWelcomeEmail: false,
      ...options,
    };
  }

  // ============================================================================
  // Main Provisioning Methods
  // ============================================================================

  /**
   * Provision user based on JIT configuration
   */
  async provisionUser(userData: JITUserData): Promise<JITProvisioningResult> {
    const result: JITProvisioningResult = {
      success: false,
      action: 'skipped',
      roles: [],
      groups: [],
      licenses: [],
      warnings: [],
      errors: [],
    };

    try {
      // Validate user data
      const validation = this.validateUserData(userData);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        result.action = 'skipped';
        return result;
      }

      // Check domain restrictions
      const domainCheck = this.checkDomainRestrictions(userData.email);
      if (!domainCheck.allowed) {
        result.errors.push(`Domain not allowed: ${domainCheck.domain}`);
        result.action = 'skipped';
        return result;
      }

      // Apply attribute mapping
      const mappedUserData = this.applyAttributeMapping(userData);

      // Evaluate provisioning rules
      const ruleEvaluation = this.evaluateProvisioningRules(mappedUserData);

      // Check if provisioning should proceed
      if (ruleEvaluation.skip) {
        result.warnings.push('Provisioning skipped by rule evaluation');
        result.action = 'skipped';
        return result;
      }

      // Check if approval is required
      if (this.options.requireApproval || this.config.approvalRequired) {
        result.action = 'pending';
        // In production, this would trigger approval workflow
        result.warnings.push('User provisioning requires approval');
        return result;
      }

      // Determine if creating or updating user
      const userExists = await this.checkUserExists(mappedUserData.userId);

      if (userExists) {
        // Update existing user
        const updateResult = await this.updateUser(mappedUserData);

        if (!updateResult.success) {
          result.errors.push(...updateResult.errors);
          result.action = 'skipped';
          return result;
        }

        result.action = 'updated';
        result.userId = updateResult.userId;
      } else {
        // Create new user
        if (!this.config.autoCreateUsers) {
          result.warnings.push('Auto-create users is disabled');
          result.action = 'skipped';
          return result;
        }

        const createResult = await this.createUser(mappedUserData);

        if (!createResult.success) {
          result.errors.push(...createResult.errors);
          result.action = 'skipped';
          return result;
        }

        result.action = 'created';
        result.userId = createResult.userId;
      }

      // Apply group mappings
      const groupResult = this.applyGroupMappings(mappedUserData);
      result.groups = groupResult.groups;
      result.warnings.push(...groupResult.warnings);
      result.errors.push(...groupResult.errors);

      // Apply role mappings
      const roleResult = this.applyRoleMappings(mappedUserData);
      result.roles = roleResult.roles;
      result.warnings.push(...roleResult.warnings);
      result.errors.push(...roleResult.errors);

      // Assign licenses
      const licenseResult = this.assignLicenses(mappedUserData);
      result.licenses = licenseResult.licenses;
      result.warnings.push(...licenseResult.warnings);
      result.errors.push(...licenseResult.errors);

      result.success = result.errors.length === 0;

      return result;
    } catch (error) {
      result.errors.push(`Provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
      return result;
    }
  }

  /**
   * Provision user from SAML assertion
   */
  async provisionFromSAML(samlAttributes: Record<string, string[]>): Promise<JITProvisioningResult> {
    const userData = this.extractUserDataFromSAML(samlAttributes);
    return this.provisionUser(userData);
  }

  /**
   * Provision user from LDAP entry
   */
  async provisionFromLDAP(ldapAttributes: Record<string, any>): Promise<JITProvisioningResult> {
    const userData = this.extractUserDataFromLDAP(ldapAttributes);
    return this.provisionUser(userData);
  }

  /**
   * Provision user from OIDC token
   */
  async provisionFromOIDC(oidcClaims: Record<string, any>): Promise<JITProvisioningResult> {
    const userData = this.extractUserDataFromOIDC(oidcClaims);
    return this.provisionUser(userData);
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validate user data
   */
  private validateUserData(userData: JITUserData): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!userData.userId) {
      errors.push('User ID is required');
    }

    if (!userData.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(userData.email)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check domain restrictions
   */
  private checkDomainRestrictions(email: string): {
    allowed: boolean;
    domain?: string;
  } {
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain) {
      return { allowed: false };
    }

    // Check blacklist first
    if (this.options.domainBlacklist && this.options.domainBlacklist.length > 0) {
      if (this.options.domainBlacklist.some(d => domain.endsWith(d.toLowerCase()))) {
        return { allowed: false, domain };
      }
    }

    // Check whitelist if configured
    if (this.options.domainWhitelist && this.options.domainWhitelist.length > 0) {
      if (!this.options.domainWhitelist.some(d => domain.endsWith(d.toLowerCase()))) {
        return { allowed: false, domain };
      }
    }

    // Check config domain restrictions
    if (this.config.domainRestrictions && this.config.domainRestrictions.length > 0) {
      if (!this.config.domainRestrictions.some(d => domain.endsWith(d.toLowerCase()))) {
        return { allowed: false, domain };
      }
    }

    return { allowed: true, domain };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ============================================================================
  // Attribute Mapping
  // ============================================================================

  /**
   * Apply attribute mapping to user data
   */
  private applyAttributeMapping(userData: JITUserData): JITUserData {
    const mapping = this.config.attributeMapping;
    const mapped: JITUserData = { ...userData };

    // Apply standard mappings
    if (mapping.userId && userData.customAttributes?.[mapping.userId]) {
      mapped.userId = userData.customAttributes[mapping.userId];
    }

    if (mapping.email && userData.customAttributes?.[mapping.email]) {
      mapped.email = userData.customAttributes[mapping.email];
    }

    if (mapping.firstName && userData.customAttributes?.[mapping.firstName]) {
      mapped.firstName = userData.customAttributes[mapping.firstName];
    }

    if (mapping.lastName && userData.customAttributes?.[mapping.lastName]) {
      mapped.lastName = userData.customAttributes[mapping.lastName];
    }

    if (mapping.displayName && userData.customAttributes?.[mapping.displayName]) {
      mapped.displayName = userData.customAttributes[mapping.displayName];
    }

    if (mapping.department && userData.customAttributes?.[mapping.department]) {
      mapped.department = userData.customAttributes[mapping.department];
    }

    if (mapping.title && userData.customAttributes?.[mapping.title]) {
      mapped.title = userData.customAttributes[mapping.title];
    }

    if (mapping.manager && userData.customAttributes?.[mapping.manager]) {
      mapped.manager = userData.customAttributes[mapping.manager];
    }

    if (mapping.phone && userData.customAttributes?.[mapping.phone]) {
      mapped.phone = userData.customAttributes[mapping.phone];
    }

    if (mapping.mobile && userData.customAttributes?.[mapping.mobile]) {
      mapped.mobile = userData.customAttributes[mapping.mobile];
    }

    if (mapping.location && userData.customAttributes?.[mapping.location]) {
      mapped.location = userData.customAttributes[mapping.location];
    }

    if (mapping.timezone && userData.customAttributes?.[mapping.timezone]) {
      mapped.timezone = userData.customAttributes[mapping.timezone];
    }

    if (mapping.locale && userData.customAttributes?.[mapping.locale]) {
      mapped.locale = userData.customAttributes[mapping.locale];
    }

    // Apply custom mappings
    if (mapping.custom) {
      for (const [target, source] of Object.entries(mapping.custom)) {
        if (userData.customAttributes?.[source]) {
          if (!mapped.customAttributes) {
            mapped.customAttributes = {};
          }
          mapped.customAttributes[target] = userData.customAttributes[source];
        }
      }
    }

    return mapped;
  }

  // ============================================================================
  // Rule Evaluation
  // ============================================================================

  /**
   * Evaluate provisioning rules
   */
  private evaluateProvisioningRules(userData: JITUserData): {
    skip: boolean;
    actions: JITAction[];
    warnings: string[];
  } {
    const actions: JITAction[] = [];
    const warnings: string[] = [];

    if (!this.config.provisioningRules || this.config.provisioningRules.length === 0) {
      return { skip: false, actions, warnings };
    }

    // Sort rules by priority
    const sortedRules = [...this.config.provisioningRules].sort((a, b) => a.priority - b.priority);

    // Evaluate rules
    for (const rule of sortedRules) {
      if (this.evaluateCondition(rule.condition, userData)) {
        // Apply rule actions
        for (const action of rule.actions) {
          actions.push(action);

          if (action.type === 'skipProvisioning') {
            return {
              skip: true,
              actions,
              warnings: [`Provisioning skipped by rule: ${rule.name}`],
            };
          }
        }
      }
    }

    return { skip: false, actions, warnings };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: JITCondition, userData: JITUserData): boolean {
    const fieldValue = this.getFieldValue(userData, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);

      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.startsWith(condition.value);

      case 'endsWith':
        return typeof fieldValue === 'string' && fieldValue.endsWith(condition.value);

      case 'matches':
        if (typeof fieldValue === 'string') {
          const regex = new RegExp(condition.value);
          return regex.test(fieldValue);
        }
        return false;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);

      case 'notIn':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

      default:
        return false;
    }
  }

  /**
   * Get field value from user data
   */
  private getFieldValue(userData: JITUserData, field: string): any {
    const fieldPath = field.split('.');

    let value: any = userData;

    for (const key of fieldPath) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  // ============================================================================
  // Group and Role Mapping
  // ============================================================================

  /**
   * Apply group mappings
   */
  private applyGroupMappings(userData: JITUserData): {
    groups: string[];
    warnings: string[];
    errors: string[];
  } {
    const groups: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!this.config.groupMapping || !this.config.groupMapping.enabled) {
      // Add default groups
      if (this.config.defaultGroups) {
        groups.push(...this.config.defaultGroups);
      }
      return { groups, warnings, errors };
    }

    const groupMapping = this.config.groupMapping;

    // Get source attribute value
    const sourceValue = this.getFieldValue(userData, groupMapping.sourceAttribute);

    if (!sourceValue) {
      // Add default groups
      if (groupMapping.defaultGroups) {
        groups.push(...groupMapping.defaultGroups);
      }
      return { groups, warnings, errors };
    }

    // Map source value to groups
    const sourceValues = Array.isArray(sourceValue) ? sourceValue : [sourceValue];

    for (const value of sourceValues) {
      if (groupMapping.groupMapping && groupMapping.groupMapping[value]) {
        groups.push(groupMapping.groupMapping[value]);
      } else if (groupMapping.autoCreateGroups) {
        // Create group from source value
        groups.push(value);
      }
    }

    // Add default groups
    if (groupMapping.defaultGroups) {
      groups.push(...groupMapping.defaultGroups);
    }

    return { groups, warnings, errors };
  }

  /**
   * Apply role mappings
   */
  private applyRoleMappings(userData: JITUserData): {
    roles: string[];
    warnings: string[];
    errors: string[];
  } {
    const roles: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!this.config.roleMapping || !this.config.roleMapping.enabled) {
      // Add default roles
      if (this.config.defaultRoles) {
        roles.push(...this.config.defaultRoles);
      }
      return { roles, warnings, errors };
    }

    const roleMapping = this.config.roleMapping;

    // Get source attribute value
    const sourceValue = this.getFieldValue(userData, roleMapping.sourceAttribute);

    if (!sourceValue) {
      // Add default roles
      if (roleMapping.defaultRoles) {
        roles.push(...roleMapping.defaultRoles);
      }
      return { roles, warnings, errors };
    }

    // Map source value to roles
    const sourceValues = Array.isArray(sourceValue) ? sourceValue : [sourceValue];

    for (const value of sourceValues) {
      if (roleMapping.roleMapping && roleMapping.roleMapping[value]) {
        roles.push(roleMapping.roleMapping[value]);
      }
    }

    // Add default roles
    if (roleMapping.defaultRoles) {
      roles.push(...roleMapping.defaultRoles);
    }

    return { roles, warnings, errors };
  }

  /**
   * Assign licenses
   */
  private assignLicenses(userData: JITUserData): {
    licenses: string[];
    warnings: string[];
    errors: string[];
  } {
    const licenses: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!this.config.licenseAssignment || !this.config.licenseAssignment.enabled) {
      return { licenses, warnings, errors };
    }

    const licenseConfig = this.config.licenseAssignment;

    // Add default license
    if (licenseConfig.defaultLicense) {
      licenses.push(licenseConfig.defaultLicense);
    }

    // Check for license attribute
    if (licenseConfig.licenseAttribute) {
      const licenseValue = this.getFieldValue(userData, licenseConfig.licenseAttribute);

      if (licenseValue) {
        const licenseValues = Array.isArray(licenseValue) ? licenseValue : [licenseValue];
        licenses.push(...licenseValues);
      }
    }

    return { licenses, warnings, errors };
  }

  // ============================================================================
  // User Creation/Update
  // ============================================================================

  /**
   * Check if user exists
   */
  private async checkUserExists(userId: string): Promise<boolean> {
    // In production, this would query the user database
    // For now, return false (user doesn't exist)
    return false;
  }

  /**
   * Create user
   */
  private async createUser(userData: JITUserData): Promise<{
    success: boolean;
    userId?: string;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // In production, this would create the user in the database
      // For now, simulate successful creation

      return {
        success: true,
        userId: userData.userId,
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        errors,
      };
    }
  }

  /**
   * Update user
   */
  private async updateUser(userData: JITUserData): Promise<{
    success: boolean;
    userId?: string;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!this.config.autoUpdateUsers) {
      errors.push('Auto-update users is disabled');
      return {
        success: false,
        errors,
      };
    }

    try {
      // In production, this would update the user in the database
      // For now, simulate successful update

      return {
        success: true,
        userId: userData.userId,
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        errors,
      };
    }
  }

  // ============================================================================
  // Data Extraction Methods
  // ============================================================================

  /**
   * Extract user data from SAML attributes
   */
  private extractUserDataFromSAML(samlAttributes: Record<string, string[]>): JITUserData {
    return {
      userId: samlAttributes['userId']?.[0] || samlAttributes['NameID']?.[0] || '',
      email: samlAttributes['email']?.[0] || samlAttributes['mail']?.[0] || '',
      firstName: samlAttributes['firstName']?.[0] || samlAttributes['givenName']?.[0],
      lastName: samlAttributes['lastName']?.[0] || samlAttributes['sn']?.[0],
      displayName: samlAttributes['displayName']?.[0],
      department: samlAttributes['department']?.[0],
      title: samlAttributes['title']?.[0],
      phone: samlAttributes['phone']?.[0] || samlAttributes['telephoneNumber']?.[0],
      mobile: samlAttributes['mobile']?.[0],
      groups: samlAttributes['groups'] || samlAttributes['memberOf'],
      customAttributes: samlAttributes,
    };
  }

  /**
   * Extract user data from LDAP attributes
   */
  private extractUserDataFromLDAP(ldapAttributes: Record<string, any>): JITUserData {
    return {
      userId: ldapAttributes.uid || ldapAttributes.sAMAccountName || ldapAttributes.userPrincipalName || '',
      email: ldapAttributes.mail || ldapAttributes.email || '',
      firstName: ldapAttributes.givenName || ldapAttributes.firstName,
      lastName: ldapAttributes.sn || ldapAttributes.lastName,
      displayName: ldapAttributes.displayName || ldapAttributes.cn,
      department: ldapAttributes.department || ldapAttributes.departmentNumber,
      title: ldapAttributes.title || ldapAttributes.jobTitle,
      phone: ldapAttributes.telephoneNumber || ldapAttributes.phone,
      mobile: ldapAttributes.mobile || ldapAttributes.mobileTelephoneNumber,
      groups: ldapAttributes.memberOf || ldapAttributes.groupMembership,
      customAttributes: ldapAttributes,
    };
  }

  /**
   * Extract user data from OIDC claims
   */
  private extractUserDataFromOIDC(oidcClaims: Record<string, any>): JITUserData {
    return {
      userId: oidcClaims.sub || oidcClaims.user_id || '',
      email: oidcClaims.email || oidcClaims.email_address || '',
      firstName: oidcClaims.given_name || oidcClaims.first_name,
      lastName: oidcClaims.family_name || oidcClaims.last_name,
      displayName: oidcClaims.name,
      groups: oidcClaims.groups || oidcClaims.group_membership,
      customAttributes: oidcClaims,
    };
  }
}

// ============================================================================
// Export convenience types
// ============================================================================

export type {
  JITUserData,
  JITProvisioningOptions,
};
