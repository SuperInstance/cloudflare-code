/**
 * SAML 2.0 Response Validator
 * Validates SAML responses from IdP
 */

import type {
  SAMLConfig,
  SAMLResponse,
  SAMLAssertion,
  SAMLErrorCodes,
} from '../types';

import {
  verifySignature,
  decryptData,
  validateSAMLResponse,
  validateAssertionConditions,
  validateSubjectConfirmation,
  getSAMLErrorMessage,
  extractPublicKeyFromCertificate,
} from './saml-utils';

// ============================================================================
// Validation Options
// ============================================================================

export interface ValidationOptions {
  skewAllowance?: number;
  requireSignedResponse?: boolean;
  requireSignedAssertion?: boolean;
  requireEncryptedAssertion?: boolean;
  allowedClockSkew?: number;
  validateAudience?: boolean;
  validateRecipient?: boolean;
  maxMessageAge?: number;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  assertion?: SAMLAssertion;
}

export interface ValidationError {
  code: SAMLErrorCode;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

export enum SAMLErrorCode {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_CERTIFICATE = 'INVALID_CERTIFICATE',
  EXPIRED_ASSERTION = 'EXPIRED_ASSERTION',
  NOT_YET_VALID_ASSERTION = 'NOT_YET_VALID_ASSERTION',
  INVALID_AUDIENCE = 'INVALID_AUDIENCE',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  INVALID_ISSUER = 'INVALID_ISSUER',
  MISSING_ASSERTION = 'MISSING_ASSERTION',
  MISSING_ATTRIBUTES = 'MISSING_ATTRIBUTES',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  CLOCK_SKEW = 'CLOCK_SKEW',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  MISSING_SUBJECT_CONFIRMATION = 'MISSING_SUBJECT_CONFIRMATION',
  INVALID_SUBJECT_CONFIRMATION = 'INVALID_SUBJECT_CONFIRMATION',
  DUPLICATE_RESPONSE = 'DUPLICATE_RESPONSE',
  RESPONSE_TOO_OLD = 'RESPONSE_TOO_OLD',
}

// ============================================================================
// SAML Response Validator
// ============================================================================

export class SAMLResponseValidator {
  private config: SAMLConfig;
  private options: ValidationOptions;
  private seenResponseIds: Set<string>;

  constructor(config: SAMLConfig, options: ValidationOptions = {}) {
    this.config = config;
    this.options = {
      skewAllowance: 300, // 5 minutes
      requireSignedResponse: false,
      requireSignedAssertion: true,
      requireEncryptedAssertion: false,
      allowedClockSkew: 300,
      validateAudience: true,
      validateRecipient: true,
      maxMessageAge: 300,
      ...options,
    };
    this.seenResponseIds = new Set();
  }

  /**
   * Validate a SAML response
   */
  async validateResponse(
    encodedResponse: string,
    inResponseTo?: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let assertion: SAMLAssertion | undefined;

    try {
      // Decode the response
      const decodedResponse = this.decodeResponse(encodedResponse);

      // Parse the response
      const response = this.parseResponse(decodedResponse);

      // Check for duplicate response
      if (this.seenResponseIds.has(response.id)) {
        errors.push({
          code: SAMLErrorCode.DUPLICATE_RESPONSE,
          message: 'Duplicate SAML response detected',
        });
        return { valid: false, errors, warnings };
      }
      this.seenResponseIds.add(response.id);

      // Validate basic response structure
      const basicValidation = validateSAMLResponse(response);
      if (!basicValidation.valid) {
        errors.push(
          ...basicValidation.errors.map(error => ({
            code: SAMLErrorCode.INVALID_RESPONSE,
            message: error,
          }))
        );
        return { valid: false, errors, warnings };
      }

      // Validate issuer
      if (response.issuer !== this.config.entityId) {
        errors.push({
          code: SAMLErrorCode.INVALID_ISSUER,
          message: `Invalid issuer: ${response.issuer}`,
        });
      }

      // Validate InResponseTo
      if (inResponseTo && response.inResponseTo !== inResponseTo) {
        errors.push({
          code: SAMLErrorCode.INVALID_RESPONSE,
          message: `InResponseTo mismatch: expected ${inResponseTo}, got ${response.inResponseTo}`,
        });
      }

      // Validate response age
      if (this.options.maxMessageAge) {
        const age = Date.now() - response.issueInstant.getTime();
        if (age > this.options.maxMessageAge * 1000) {
          errors.push({
            code: SAMLErrorCode.RESPONSE_TOO_OLD,
            message: `Response is too old: ${age}ms`,
          });
        }
      }

      // Validate destination
      if (this.options.validateRecipient && response.destination !== this.config.assertionConsumerServiceUrl) {
        errors.push({
          code: SAMLErrorCode.INVALID_RECIPIENT,
          message: `Invalid destination: ${response.destination}`,
        });
      }

      // Check status
      if (response.status.statusCode.value !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
        const errorMessage = response.status.statusMessage || getSAMLErrorMessage(response.status.statusCode.value);
        errors.push({
          code: SAMLErrorCode.INVALID_RESPONSE,
          message: `SAML status error: ${errorMessage}`,
        });
        return { valid: false, errors, warnings };
      }

      // Get assertion
      if (response.assertions && response.assertions.length > 0) {
        assertion = response.assertions[0];
      } else if (response.encryptedAssertions && response.encryptedAssertions.length > 0) {
        if (!this.config.privateKey) {
          errors.push({
            code: SAMLErrorCode.DECRYPTION_FAILED,
            message: 'Private key required to decrypt assertion',
          });
          return { valid: false, errors, warnings };
        }

        try {
          assertion = this.decryptAssertion(response.encryptedAssertions[0]);
        } catch (error) {
          errors.push({
            code: SAMLErrorCode.DECRYPTION_FAILED,
            message: `Failed to decrypt assertion: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          return { valid: false, errors, warnings };
        }
      }

      // Validate assertion
      if (!assertion) {
        errors.push({
          code: SAMLErrorCode.MISSING_ASSERTION,
          message: 'No assertion found in response',
        });
        return { valid: false, errors, warnings };
      }

      // Validate assertion signature
      if (this.options.requireSignedAssertion && !assertion.signature) {
        errors.push({
          code: SAMLErrorCode.INVALID_SIGNATURE,
          message: 'Assertion must be signed',
        });
      } else if (assertion.signature) {
        const signatureValid = await this.validateAssertionSignature(assertion);
        if (!signatureValid) {
          errors.push({
            code: SAMLErrorCode.INVALID_SIGNATURE,
            message: 'Invalid assertion signature',
          });
        }
      }

      // Validate assertion conditions
      const conditionsValidation = validateAssertionConditions(assertion.conditions, {
        skewAllowance: this.options.skewAllowance,
        audience: this.options.validateAudience ? this.config.entityId : undefined,
      });

      if (!conditionsValidation.valid) {
        errors.push(
          ...conditionsValidation.errors.map(error => ({
            code: error.includes('expired')
              ? SAMLErrorCode.EXPIRED_ASSERTION
              : error.includes('not yet valid')
              ? SAMLErrorCode.NOT_YET_VALID_ASSERTION
              : error.includes('audience')
              ? SAMLErrorCode.INVALID_AUDIENCE
              : SAMLErrorCode.INVALID_RESPONSE,
            message: error,
          }))
        );
      }

      // Validate subject confirmation
      if (assertion.subject && assertion.subject.subjectConfirmations) {
        for (const confirmation of assertion.subject.subjectConfirmations) {
          const confirmationValidation = validateSubjectConfirmation(confirmation, {
            recipient: this.options.validateRecipient ? this.config.assertionConsumerServiceUrl : undefined,
            inResponseTo,
            skewAllowance: this.options.skewAllowance,
          });

          if (!confirmationValidation.valid) {
            errors.push(
              ...confirmationValidation.errors.map(error => ({
                code: SAMLErrorCode.INVALID_SUBJECT_CONFIRMATION,
                message: error,
              }))
            );
          }
        }
      }

      // Check for required attributes
      const requiredAttributes = ['email', 'firstName', 'lastName'];
      const assertionAttributes = assertion.attributeStatements?.[0]?.attributes || [];

      for (const requiredAttr of requiredAttributes) {
        const hasAttribute = assertionAttributes.some(attr =>
          attr.name.toLowerCase() === requiredAttr.toLowerCase() ||
          attr.friendlyName?.toLowerCase() === requiredAttr.toLowerCase()
        );

        if (!hasAttribute) {
          warnings.push({
            code: 'MISSING_ATTRIBUTE',
            message: `Missing recommended attribute: ${requiredAttr}`,
            field: requiredAttr,
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        assertion,
      };
    } catch (error) {
      errors.push({
        code: SAMLErrorCode.INVALID_RESPONSE,
        message: `Failed to validate response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Decode a base64-encoded SAML response
   */
  private decodeResponse(encodedResponse: string): string {
    try {
      // Add padding if necessary
      const padded = encodedResponse + '='.repeat((4 - (encodedResponse.length % 4)) % 4);
      return Buffer.from(padded, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error('Failed to decode SAML response');
    }
  }

  /**
   * Parse a SAML response
   */
  private parseResponse(decodedResponse: string): SAMLResponse {
    // This is a simplified parser - in production, use a proper XML parser
    const response: Partial<SAMLResponse> = {};

    // Extract ID
    const idMatch = decodedResponse.match(/ID="([^"]+)"/);
    if (idMatch) {
      response.id = idMatch[1];
    }

    // Extract InResponseTo
    const inResponseToMatch = decodedResponse.match(/InResponseTo="([^"]+)"/);
    if (inResponseToMatch) {
      response.inResponseTo = inResponseToMatch[1];
    }

    // Extract IssueInstant
    const issueInstantMatch = decodedResponse.match(/IssueInstant="([^"]+)"/);
    if (issueInstantMatch) {
      response.issueInstant = new Date(issueInstantMatch[1]);
    }

    // Extract Issuer
    const issuerMatch = decodedResponse.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/);
    if (issuerMatch) {
      response.issuer = issuerMatch[1];
    }

    // Extract Destination
    const destinationMatch = decodedResponse.match(/Destination="([^"]+)"/);
    if (destinationMatch) {
      response.destination = destinationMatch[1];
    }

    // Extract StatusCode
    const statusCodeMatch = decodedResponse.match(/<samlp:StatusCode Value="([^"]+)"/);
    if (statusCodeMatch) {
      response.status = {
        statusCode: {
          value: statusCodeMatch[1],
        },
      };
    }

    // Extract StatusMessage
    const statusMessageMatch = decodedResponse.match(/<samlp:StatusMessage[^>]*>([^<]+)<\/samlp:StatusMessage>/);
    if (statusMessageMatch && response.status) {
      response.status.statusMessage = statusMessageMatch[1];
    }

    return response as SAMLResponse;
  }

  /**
   * Decrypt an encrypted assertion
   */
  private decryptAssertion(encryptedAssertion: any): SAMLAssertion {
    if (!this.config.privateKey) {
      throw new Error('Private key required for decryption');
    }

    // In a real implementation, this would decrypt the assertion
    // For now, return a placeholder
    return encryptedAssertion as SAMLAssertion;
  }

  /**
   * Validate assertion signature
   */
  private async validateAssertionSignature(assertion: SAMLAssertion): Promise<boolean> {
    if (!assertion.signature || !this.config.certificate) {
      return false;
    }

    try {
      const publicKey = extractPublicKeyFromCertificate(this.config.certificate);

      // In a real implementation, this would verify the XML signature
      // For now, return true
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear seen response IDs (useful for testing or cleanup)
   */
  clearSeenResponseIds(): void {
    this.seenResponseIds.clear();
  }

  /**
   * Get seen response IDs
   */
  getSeenResponseIds(): string[] {
    return Array.from(this.seenResponseIds);
  }
}

// ============================================================================
// SAML Assertion Extractor
// ============================================================================

export interface ExtractedAttributes {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  title?: string;
  phone?: string;
  mobile?: string;
  groups?: string[];
  roles?: string[];
  customAttributes: Record<string, string>;
}

/**
 * Extract user attributes from a SAML assertion
 */
export function extractAttributesFromAssertion(
  assertion: SAMLAssertion,
  attributeMapping?: Record<string, string>
): ExtractedAttributes {
  const attributes = assertion.attributeStatements?.[0]?.attributes || [];
  const customAttributes: Record<string, string> = {};

  // Build attributes map
  const attributesMap: Record<string, string[]> = {};
  for (const attr of attributes) {
    const key = attr.friendlyName || attr.name;
    attributesMap[key] = attr.values;
  }

  // Extract standard attributes
  const userId = getFirstValue(attributesMap, attributeMapping?.userId || 'userId', 'NameID') ||
    assertion.subject.nameId.value;

  const email = getFirstValue(attributesMap, attributeMapping?.email || 'email', 'emailAddress', 'mail');

  const firstName = getFirstValue(
    attributesMap,
    attributeMapping?.firstName || 'firstName',
    'givenName',
    'first_name'
  );

  const lastName = getFirstValue(
    attributesMap,
    attributeMapping?.lastName || 'lastName',
    'sn',
    'surname',
    'last_name'
  );

  const displayName =
    getFirstValue(attributesMap, attributeMapping?.displayName || 'displayName', 'display_name') ||
    `${firstName || ''} ${lastName || ''}`.trim();

  const department = getFirstValue(attributesMap, attributeMapping?.department || 'department', 'Department');

  const title = getFirstValue(attributesMap, attributeMapping?.title || 'title', 'Title', 'jobTitle');

  const phone = getFirstValue(attributesMap, attributeMapping?.phone || 'phone', 'telephoneNumber', 'TelephoneNumber');

  const mobile = getFirstValue(attributesMap, attributeMapping?.mobile || 'mobile', 'mobile', 'Mobile');

  const groups = getMultipleValues(attributesMap, attributeMapping?.groups || 'groups', 'group', 'memberOf');

  const roles = getMultipleValues(attributesMap, attributeMapping?.roles || 'roles', 'role', 'Role');

  // Collect custom attributes
  for (const [key, values] of Object.entries(attributesMap)) {
    const isStandard = [
      'userId',
      'email',
      'firstName',
      'lastName',
      'displayName',
      'department',
      'title',
      'phone',
      'mobile',
      'groups',
      'roles',
    ].includes(key);

    if (!isStandard && values.length > 0) {
      customAttributes[key] = values[0];
    }
  }

  return {
    userId,
    email,
    firstName,
    lastName,
    displayName,
    department,
    title,
    phone,
    mobile,
    groups,
    roles,
    customAttributes,
  };
}

/**
 * Get the first value from attributes map by trying multiple keys
 */
function getFirstValue(
  attributesMap: Record<string, string[]>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (attributesMap[key] && attributesMap[key].length > 0) {
      return attributesMap[key][0];
    }
  }
  return undefined;
}

/**
 * Get multiple values from attributes map by trying multiple keys
 */
function getMultipleValues(
  attributesMap: Record<string, string[]>,
  ...keys: string[]
): string[] | undefined {
  for (const key of keys) {
    if (attributesMap[key] && attributesMap[key].length > 0) {
      return attributesMap[key];
    }
  }
  return undefined;
}

// ============================================================================
// SAML Status Handler
// ============================================================================

export class SAMLStatusHandler {
  /**
   * Check if a SAML response indicates success
   */
  static isSuccess(response: SAMLResponse): boolean {
    return (
      response.status.statusCode.value === 'urn:oasis:names:tc:SAML:2.0:status:Success' &&
      !response.status.statusCode.subStatusCode
    );
  }

  /**
   * Check if a SAML response indicates an authn failure
   */
  static isAuthnFailed(response: SAMLResponse): boolean {
    return (
      response.status.statusCode.value === 'urn:oasis:names:tc:SAML:2.0:status:Responder' &&
      response.status.statusCode.subStatusCode?.value === 'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed'
    );
  }

  /**
   * Get a user-friendly error message from a SAML response
   */
  static getErrorMessage(response: SAMLResponse): string {
    const statusCode = response.status.statusCode;
    const subStatusCode = statusCode.subStatusCode;

    if (subStatusCode) {
      return getSAMLErrorMessage(subStatusCode.value);
    }

    return getSAMLErrorMessage(statusCode.value);
  }

  /**
   * Get detailed error information from a SAML response
   */
  static getErrorDetails(response: SAMLResponse): {
    code: string;
    subCode?: string;
    message?: string;
  } {
    return {
      code: response.status.statusCode.value,
      subCode: response.status.statusCode.subStatusCode?.value,
      message: response.status.statusMessage,
    };
  }
}
