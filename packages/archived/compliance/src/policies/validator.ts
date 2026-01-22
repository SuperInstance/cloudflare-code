import {
  PolicyDefinition,
  PolicyRule,
  Control,
  PolicyException,
  ComplianceStandard,
  ComplianceCategory,
  SeverityLevel
} from '../types';

/**
 * Policy validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Policy validator
 */
export class PolicyValidator {
  /**
   * Validate a policy definition
   */
  validatePolicy(policy: PolicyDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate required fields
    this.validateRequiredFields(policy, errors);
    this.validateId(policy, errors);
    this.validateVersion(policy, errors);
    this.validateDates(policy, errors, warnings);
    this.validateRules(policy, errors, warnings);
    this.validateControls(policy, errors, warnings);
    this.validateExceptions(policy, errors, warnings);
    this.validateStandard(policy, errors);
    this.validateCategory(policy, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate multiple policies
   */
  validatePolicies(policies: PolicyDefinition[]): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    // Validate individual policies
    for (const policy of policies) {
      results.set(policy.id, this.validatePolicy(policy));
    }

    // Validate cross-policy consistency
    this.validateCrossPolicyConsistency(policies, results);

    return results;
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(
    policy: PolicyDefinition,
    errors: ValidationError[]
  ): void {
    const requiredFields: (keyof PolicyDefinition)[] = [
      'id',
      'name',
      'standard',
      'category',
      'version',
      'effectiveDate',
      'lastReviewed',
      'nextReviewDate',
      'owner',
      'rules',
      'controls'
    ];

    for (const field of requiredFields) {
      if (policy[field] === undefined || policy[field] === null) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          code: 'MISSING_REQUIRED_FIELD'
        });
      }
    }
  }

  /**
   * Validate policy ID
   */
  private validateId(
    policy: PolicyDefinition,
    errors: ValidationError[]
  ): void {
    if (!policy.id) return;

    // ID format validation
    const idPattern = /^[a-z0-9-]+$/;
    if (!idPattern.test(policy.id)) {
      errors.push({
        field: 'id',
        message: 'Policy ID must contain only lowercase letters, numbers, and hyphens',
        code: 'INVALID_ID_FORMAT'
      });
    }

    // ID length validation
    if (policy.id.length < 3 || policy.id.length > 100) {
      errors.push({
        field: 'id',
        message: 'Policy ID must be between 3 and 100 characters',
        code: 'INVALID_ID_LENGTH'
      });
    }
  }

  /**
   * Validate version
   */
  private validateVersion(
    policy: PolicyDefinition,
    errors: ValidationError[]
  ): void {
    if (!policy.version) return;

    // Semantic versioning format
    const versionPattern = /^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/;
    if (!versionPattern.test(policy.version)) {
      errors.push({
        field: 'version',
        message: 'Version must follow semantic versioning (e.g., 1.0.0)',
        code: 'INVALID_VERSION_FORMAT'
      });
    }
  }

  /**
   * Validate dates
   */
  private validateDates(
    policy: PolicyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const now = new Date();

    // Effective date should be in the past or present
    if (policy.effectiveDate > now) {
      warnings.push({
        field: 'effectiveDate',
        message: 'Effective date is in the future',
        code: 'FUTURE_EFFECTIVE_DATE'
      });
    }

    // Last reviewed should be before or equal to now
    if (policy.lastReviewed > now) {
      errors.push({
        field: 'lastReviewed',
        message: 'Last reviewed date cannot be in the future',
        code: 'FUTURE_LAST_REVIEWED'
      });
    }

    // Next review date should be in the future
    if (policy.nextReviewDate <= now) {
      warnings.push({
        field: 'nextReviewDate',
        message: 'Next review date should be in the future',
        code: 'PAST_NEXT_REVIEW_DATE'
      });
    }

    // Effective date should be before last reviewed
    if (policy.effectiveDate > policy.lastReviewed) {
      errors.push({
        field: 'lastReviewed',
        message: 'Last reviewed date should be after effective date',
        code: 'INVALID_DATE_SEQUENCE'
      });
    }

    // Next review should be after last review
    if (policy.nextReviewDate <= policy.lastReviewed) {
      errors.push({
        field: 'nextReviewDate',
        message: 'Next review date should be after last reviewed date',
        code: 'INVALID_REVIEW_DATE_SEQUENCE'
      });
    }

    // Check review interval (should be at least 3 months)
    const reviewInterval = policy.nextReviewDate.getTime() - policy.lastReviewed.getTime();
    const minReviewInterval = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
    if (reviewInterval < minReviewInterval) {
      warnings.push({
        field: 'nextReviewDate',
        message: 'Review interval should be at least 90 days',
        code: 'SHORT_REVIEW_INTERVAL'
      });
    }
  }

  /**
   * Validate rules
   */
  private validateRules(
    policy: PolicyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!policy.rules || policy.rules.length === 0) {
      errors.push({
        field: 'rules',
        message: 'Policy must have at least one rule',
        code: 'NO_RULES'
      });
      return;
    }

    const ruleIds = new Set<string>();

    policy.rules.forEach((rule, index) => {
      // Validate rule structure
      this.validateRule(rule, index, errors, warnings);

      // Check for duplicate rule IDs
      if (ruleIds.has(rule.id)) {
        errors.push({
          field: `rules[${index}].id`,
          message: `Duplicate rule ID: ${rule.id}`,
          code: 'DUPLICATE_RULE_ID'
        });
      } else {
        ruleIds.add(rule.id);
      }
    });

    // Check automated vs manual rule balance
    const automatedRules = policy.rules.filter(r => r.automatedCheck).length;
    const manualRules = policy.rules.length - automatedRules;

    if (automatedRules === 0) {
      warnings.push({
        field: 'rules',
        message: 'No automated checks defined - all rules require manual review',
        code: 'NO_AUTOMATED_CHECKS'
      });
    }

    if (manualRules > policy.rules.length * 0.5) {
      warnings.push({
        field: 'rules',
        message: 'More than 50% of rules require manual review',
        code: 'HIGH_MANUAL_REVIEW_RATIO'
      });
    }
  }

  /**
   * Validate a single rule
   */
  private validateRule(
    rule: PolicyRule,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const prefix = `rules[${index}]`;

    // Validate required fields
    if (!rule.id) {
      errors.push({
        field: `${prefix}.id`,
        message: 'Rule ID is required',
        code: 'MISSING_RULE_ID'
      });
    }

    if (!rule.name) {
      errors.push({
        field: `${prefix}.name`,
        message: 'Rule name is required',
        code: 'MISSING_RULE_NAME'
      });
    }

    if (!rule.description) {
      errors.push({
        field: `${prefix}.description`,
        message: 'Rule description is required',
        code: 'MISSING_RULE_DESCRIPTION'
      });
    }

    if (!rule.condition) {
      errors.push({
        field: `${prefix}.condition`,
        message: 'Rule condition is required',
        code: 'MISSING_RULE_CONDITION'
      });
    } else {
      // Validate condition syntax
      this.validateCondition(rule.condition, `${prefix}.condition`, errors);
    }

    if (!rule.severity) {
      errors.push({
        field: `${prefix}.severity`,
        message: 'Rule severity is required',
        code: 'MISSING_RULE_SEVERITY'
      });
    } else {
      // Validate severity value
      if (!['critical', 'high', 'medium', 'low', 'info'].includes(rule.severity)) {
        errors.push({
          field: `${prefix}.severity`,
          message: `Invalid severity: ${rule.severity}`,
          code: 'INVALID_SEVERITY'
        });
      }
    }

    if (rule.automatedCheck === undefined) {
      warnings.push({
        field: `${prefix}.automatedCheck`,
        message: 'Rule does not specify if it can be automated',
        code: 'MISSING_AUTOMATED_FLAG'
      });
    }

    // Check for remediation on high-severity rules
    if (rule.severity === 'critical' || rule.severity === 'high') {
      if (!rule.remediation) {
        warnings.push({
          field: `${prefix}.remediation`,
          message: 'High-severity rules should include remediation guidance',
          code: 'MISSING_REMEDIATION'
        });
      }
    }
  }

  /**
   * Validate condition syntax
   */
  private validateCondition(
    condition: string,
    field: string,
    errors: ValidationError[]
  ): void {
    // Check for common syntax errors
    if (condition.includes('== ')) {
      errors.push({
        field,
        message: 'Use === instead of == for strict equality',
        code: 'WEAK_EQUALITY_OPERATOR'
      });
    }

    if (condition.includes('= ') && !condition.includes('==') && !condition.includes('===')) {
      errors.push({
        field,
        message: 'Invalid assignment operator in condition',
        code: 'INVALID_CONDITION_SYNTAX'
      });
    }

    // Check for balanced parentheses
    const openParens = (condition.match(/\(/g) || []).length;
    const closeParens = (condition.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        field,
        message: 'Unbalanced parentheses in condition',
        code: 'UNBALANCED_PARENTHESES'
      });
    }

    // Check for balanced brackets
    const openBrackets = (condition.match(/\[/g) || []).length;
    const closeBrackets = (condition.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push({
        field,
        message: 'Unbalanced brackets in condition',
        code: 'UNBALANCED_BRACKETS'
      });
    }
  }

  /**
   * Validate controls
   */
  private validateControls(
    policy: PolicyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!policy.controls || policy.controls.length === 0) {
      warnings.push({
        field: 'controls',
        message: 'Policy has no controls defined',
        code: 'NO_CONTROLS'
      });
      return;
    }

    const controlIds = new Set<string>();

    policy.controls.forEach((control, index) => {
      this.validateControl(control, index, errors, warnings);

      // Check for duplicate control IDs
      if (controlIds.has(control.id)) {
        errors.push({
          field: `controls[${index}].id`,
          message: `Duplicate control ID: ${control.id}`,
          code: 'DUPLICATE_CONTROL_ID'
        });
      } else {
        controlIds.add(control.id);
      }
    });
  }

  /**
   * Validate a single control
   */
  private validateControl(
    control: Control,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const prefix = `controls[${index}]`;

    if (!control.id) {
      errors.push({
        field: `${prefix}.id`,
        message: 'Control ID is required',
        code: 'MISSING_CONTROL_ID'
      });
    }

    if (!control.name) {
      errors.push({
        field: `${prefix}.name`,
        message: 'Control name is required',
        code: 'MISSING_CONTROL_NAME'
      });
    }

    if (!control.description) {
      errors.push({
        field: `${prefix}.description`,
        message: 'Control description is required',
        code: 'MISSING_CONTROL_DESCRIPTION'
      });
    }

    if (!control.type) {
      errors.push({
        field: `${prefix}.type`,
        message: 'Control type is required',
        code: 'MISSING_CONTROL_TYPE'
      });
    } else {
      const validTypes = ['preventive', 'detective', 'corrective'];
      if (!validTypes.includes(control.type)) {
        errors.push({
          field: `${prefix}.type`,
          message: `Invalid control type: ${control.type}`,
          code: 'INVALID_CONTROL_TYPE'
        });
      }
    }

    if (!control.frequency) {
      errors.push({
        field: `${prefix}.frequency`,
        message: 'Control frequency is required',
        code: 'MISSING_CONTROL_FREQUENCY'
      });
    } else {
      const validFrequencies = ['continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually'];
      if (!validFrequencies.includes(control.frequency)) {
        errors.push({
          field: `${prefix}.frequency`,
          message: `Invalid control frequency: ${control.frequency}`,
          code: 'INVALID_CONTROL_FREQUENCY'
        });
      }
    }
  }

  /**
   * Validate exceptions
   */
  private validateExceptions(
    policy: PolicyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!policy.exceptions || policy.exceptions.length === 0) {
      return;
    }

    policy.exceptions.forEach((exception, index) => {
      this.validateException(exception, index, policy, errors, warnings);
    });
  }

  /**
   * Validate a single exception
   */
  private validateException(
    exception: PolicyException,
    index: number,
    policy: PolicyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const prefix = `exceptions[${index}]`;

    if (!exception.id) {
      errors.push({
        field: `${prefix}.id`,
        message: 'Exception ID is required',
        code: 'MISSING_EXCEPTION_ID'
      });
    }

    if (!exception.ruleId) {
      errors.push({
        field: `${prefix}.ruleId`,
        message: 'Exception must reference a rule ID',
        code: 'MISSING_EXCEPTION_RULE_ID'
      });
    } else {
      // Check if referenced rule exists
      const ruleExists = policy.rules.some(r => r.id === exception.ruleId);
      if (!ruleExists) {
        errors.push({
          field: `${prefix}.ruleId`,
          message: `Referenced rule does not exist: ${exception.ruleId}`,
          code: 'INVALID_EXCEPTION_RULE_REF'
        });
      }
    }

    if (!exception.reason) {
      errors.push({
        field: `${prefix}.reason`,
        message: 'Exception reason is required',
        code: 'MISSING_EXCEPTION_REASON'
      });
    }

    if (!exception.approvedBy) {
      errors.push({
        field: `${prefix}.approvedBy`,
        message: 'Exception approver is required',
        code: 'MISSING_EXCEPTION_APPROVER'
      });
    }

    if (!exception.approvedDate) {
      errors.push({
        field: `${prefix}.approvedDate`,
        message: 'Exception approval date is required',
        code: 'MISSING_EXCEPTION_APPROVAL_DATE'
      });
    }

    if (exception.expiryDate && exception.expiryDate <= exception.approvedDate) {
      errors.push({
        field: `${prefix}.expiryDate`,
        message: 'Exception expiry date must be after approval date',
        code: 'INVALID_EXCEPTION_EXPIRY_DATE'
      });
    }

    if (exception.expiryDate && exception.expiryDate <= new Date()) {
      warnings.push({
        field: `${prefix}.expiryDate`,
        message: 'Exception has expired',
        code: 'EXCEPTION_EXPIRED'
      });
    }
  }

  /**
   * Validate standard
   */
  private validateStandard(
    policy: PolicyDefinition,
    errors: ValidationError[]
  ): void {
    const validStandards: ComplianceStandard[] = [
      ComplianceStandard.SOC2,
      ComplianceStandard.ISO27001,
      ComplianceStandard.GDPR,
      ComplianceStandard.HIPAA,
      ComplianceStandard.PCI_DSS
    ];

    if (!validStandards.includes(policy.standard)) {
      errors.push({
        field: 'standard',
        message: `Invalid standard: ${policy.standard}`,
        code: 'INVALID_STANDARD'
      });
    }
  }

  /**
   * Validate category
   */
  private validateCategory(
    policy: PolicyDefinition,
    errors: ValidationError[]
  ): void {
    const validCategories: ComplianceCategory[] = [
      ComplianceCategory.SECURITY,
      ComplianceCategory.AVAILABILITY,
      ComplianceCategory.PROCESSING_INTEGRITY,
      ComplianceCategory.CONFIDENTIALITY,
      ComplianceCategory.PRIVACY,
      ComplianceCategory.ACCESS_CONTROL,
      ComplianceCategory.CRYPTOGRAPHY,
      ComplianceCategory.PHYSICAL_SECURITY,
      ComplianceCategory.OPERATIONS_SECURITY,
      ComplianceCategory.DATA_PROTECTION,
      ComplianceCategory.INCIDENT_MANAGEMENT,
      ComplianceCategory.RISK_MANAGEMENT
    ];

    if (!validCategories.includes(policy.category)) {
      errors.push({
        field: 'category',
        message: `Invalid category: ${policy.category}`,
        code: 'INVALID_CATEGORY'
      });
    }

    // Validate category matches standard
    if (!this.isValidCategoryForStandard(policy.category, policy.standard)) {
      errors.push({
        field: 'category',
        message: `Category '${policy.category}' is not valid for standard '${policy.standard}'`,
        code: 'INVALID_CATEGORY_FOR_STANDARD'
      });
    }
  }

  /**
   * Check if category is valid for standard
   */
  private isValidCategoryForStandard(
    category: ComplianceCategory,
    standard: ComplianceStandard
  ): boolean {
    const validCombinations: Record<ComplianceStandard, ComplianceCategory[]> = {
      [ComplianceStandard.SOC2]: [
        ComplianceCategory.SECURITY,
        ComplianceCategory.AVAILABILITY,
        ComplianceCategory.PROCESSING_INTEGRITY,
        ComplianceCategory.CONFIDENTIALITY,
        ComplianceCategory.PRIVACY
      ],
      [ComplianceStandard.ISO27001]: [
        ComplianceCategory.ACCESS_CONTROL,
        ComplianceCategory.CRYPTOGRAPHY,
        ComplianceCategory.PHYSICAL_SECURITY,
        ComplianceCategory.OPERATIONS_SECURITY
      ],
      [ComplianceStandard.GDPR]: [
        ComplianceCategory.DATA_PROTECTION,
        ComplianceCategory.PRIVACY
      ],
      [ComplianceStandard.HIPAA]: [
        ComplianceCategory.SECURITY,
        ComplianceCategory.DATA_PROTECTION,
        ComplianceCategory.INCIDENT_MANAGEMENT
      ],
      [ComplianceStandard.PCI_DSS]: [
        ComplianceCategory.SECURITY,
        ComplianceCategory.DATA_PROTECTION,
        ComplianceCategory.ACCESS_CONTROL
      ]
    };

    return validCombinations[standard]?.includes(category) ?? false;
  }

  /**
   * Validate cross-policy consistency
   */
  private validateCrossPolicyConsistency(
    policies: PolicyDefinition[],
    results: Map<string, ValidationResult>
  ): void {
    // Check for duplicate policy IDs across the set
    const policyIds = new Map<string, PolicyDefinition[]>();

    policies.forEach(policy => {
      if (!policyIds.has(policy.id)) {
        policyIds.set(policy.id, []);
      }
      policyIds.get(policy.id)!.push(policy);
    });

    policyIds.forEach((duplicatePolicies, id) => {
      if (duplicatePolicies.length > 1) {
        duplicatePolicies.forEach(policy => {
          const result = results.get(policy.id);
          if (result) {
            result.errors.push({
              field: 'id',
              message: `Duplicate policy ID across policies: ${id}`,
              code: 'DUPLICATE_POLICY_ID'
            });
            result.valid = false;
          }
        });
      }
    });
  }

  /**
   * Validate policy update
   */
  validatePolicyUpdate(
    oldPolicy: PolicyDefinition,
    newPolicy: PolicyDefinition
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate that IDs match
    if (oldPolicy.id !== newPolicy.id) {
      errors.push({
        field: 'id',
        message: 'Policy ID cannot be changed',
        code: 'ID_CHANGE_NOT_ALLOWED'
      });
    }

    // Validate that standard hasn't changed
    if (oldPolicy.standard !== newPolicy.standard) {
      errors.push({
        field: 'standard',
        message: 'Policy standard cannot be changed',
        code: 'STANDARD_CHANGE_NOT_ALLOWED'
      });
    }

    // Validate version has increased
    const oldVersion = oldPolicy.version.split('.').map(Number);
    const newVersion = newPolicy.version.split('.').map(Number);

    let versionIncreased = false;
    for (let i = 0; i < Math.max(oldVersion.length, newVersion.length); i++) {
      const oldPart = oldVersion[i] || 0;
      const newPart = newVersion[i] || 0;

      if (newPart > oldPart) {
        versionIncreased = true;
        break;
      } else if (newPart < oldPart) {
        errors.push({
          field: 'version',
          message: 'Version must be increased',
          code: 'VERSION_NOT_INCREASED'
        });
        break;
      }
    }

    if (!versionIncreased && oldPolicy.version === newPolicy.version) {
      warnings.push({
        field: 'version',
        message: 'Version has not changed',
        code: 'VERSION_UNCHANGED'
      });
    }

    // Validate lastReviewed has been updated
    if (newPolicy.lastReviewed <= oldPolicy.lastReviewed) {
      errors.push({
        field: 'lastReviewed',
        message: 'Last reviewed date must be updated',
        code: 'LAST_REVIEWED_NOT_UPDATED'
      });
    }

    // Validate the new policy
    const newPolicyValidation = this.validatePolicy(newPolicy);
    errors.push(...newPolicyValidation.errors);
    warnings.push(...newPolicyValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
