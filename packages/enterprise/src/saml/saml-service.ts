/**
 * SAML 2.0 Service Provider Service
 * Main service for handling SAML SSO operations
 */

import type {
  SAMLConfig,
  AuthnRequestOptions,
  ParsedSAMLResponse,
  ValidationResult,
  ExtractedAttributes,
} from './types';

import {
  buildAuthnRequest,
  buildSignedAuthnRequest,
  buildLogoutRequest,
  buildSPMetadata,
  buildIdPMetadata,
  parseSAMLResponse,
} from './saml-request-builder';

import {
  SAMLResponseValidator,
  extractAttributesFromAssertion,
  SAMLStatusHandler,
} from './saml-response-validator';

import {
  buildSAMLRequestUrl,
  generateSAMLId,
  generateRelayState,
  inflateAndDecode,
} from './saml-utils';

// ============================================================================
// SAML Service Options
// ============================================================================

export interface SAMLServiceOptions {
  storeRequests?: boolean;
  storeResponses?: boolean;
  requestExpiration?: number;
  skewAllowance?: number;
}

// ============================================================================
// SAML Service
// ============================================================================

export class SAMLService {
  private config: SAMLConfig;
  private options: Required<SAMLServiceOptions>;
  private validator: SAMLResponseValidator;
  private requestStore: Map<string, { timestamp: number; relayState?: string }>;
  private responseStore: Map<string, { timestamp: number; validated: boolean }>;

  constructor(config: SAMLConfig, options: SAMLServiceOptions = {}) {
    this.config = config;
    this.options = {
      storeRequests: true,
      storeResponses: true,
      requestExpiration: 300, // 5 minutes
      skewAllowance: 300, // 5 minutes
      ...options,
    };
    this.validator = new SAMLResponseValidator(config, {
      skewAllowance: this.options.skewAllowance,
    });
    this.requestStore = new Map();
    this.responseStore = new Map();
  }

  // ============================================================================
  // Authentication Request Methods
  // ============================================================================

  /**
   * Create a SAML authentication request for SP-initiated SSO
   */
  createAuthnRequest(options: AuthnRequestOptions = {}): {
    requestId: string;
    requestUrl: string;
    relayState?: string;
  } {
    const relayState = options.relayState || generateRelayState();

    // Build the request
    const { samlRequest, id, relayState: generatedRelayState } = this.config.privateKey
      ? buildSignedAuthnRequest(this.config, { ...options, relayState })
      : buildAuthnRequest(this.config, { ...options, relayState });

    // Build the URL
    const requestUrl = buildSAMLRequestUrl(this.config.ssoUrl, samlRequest, relayState, {
      signingAlgorithm: this.config.signingAlgorithm,
    });

    // Store the request if enabled
    if (this.options.storeRequests) {
      this.requestStore.set(id, {
        timestamp: Date.now(),
        relayState: relayState || generatedRelayState,
      });
    }

    return {
      requestId: id,
      requestUrl,
      relayState: relayState || generatedRelayState,
    };
  }

  /**
   * Create a SAML logout request
   */
  createLogoutRequest(
    nameId: string,
    nameIdFormat: string,
    sessionIndex: string,
    relayState?: string
  ): {
    requestId: string;
    requestUrl: string;
  } {
    const { samlRequest, id } = buildLogoutRequest(this.config, nameId, nameIdFormat as any, sessionIndex, {
      relayState,
    });

    // Build the URL
    const requestUrl = buildSAMLRequestUrl(this.config.sloUrl || this.config.ssoUrl, samlRequest, relayState);

    return {
      requestId: id,
      requestUrl,
    };
  }

  // ============================================================================
  // Response Processing Methods
  ============================================================================ //

  /**
   * Process a SAML response from IdP
   */
  async processResponse(encodedResponse: string, relayState?: string): Promise<{
    success: boolean;
    attributes?: ExtractedAttributes;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      // Parse the response
      const parsedResponse = parseSAMLResponse(encodedResponse, relayState);

      // Get the original request
      const originalRequest = this.requestStore.get(parsedResponse.inResponseTo);

      if (!originalRequest) {
        return {
          success: false,
          errors: ['Invalid or expired request'],
        };
      }

      // Validate relay state if present
      if (relayState && originalRequest.relayState !== relayState) {
        return {
          success: false,
          errors: ['Invalid relay state'],
        };
      }

      // Validate the response
      const validationResult = await this.validator.validateResponse(
        encodedResponse,
        parsedResponse.inResponseTo
      );

      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors.map(e => e.message),
          warnings: validationResult.warnings.map(w => w.message),
        };
      }

      // Extract attributes
      if (validationResult.assertion) {
        const attributes = extractAttributesFromAssertion(validationResult.assertion);

        // Store the response if enabled
        if (this.options.storeResponses) {
          this.responseStore.set(parsedResponse.id, {
            timestamp: Date.now(),
            validated: true,
          });
        }

        return {
          success: true,
          attributes,
          warnings: validationResult.warnings.map(w => w.message),
        };
      }

      return {
        success: false,
        errors: ['No assertion found in response'],
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to process response: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Validate a SAML response without extracting attributes
   */
  async validateResponse(encodedResponse: string, inResponseTo?: string): Promise<ValidationResult> {
    return this.validator.validateResponse(encodedResponse, inResponseTo);
  }

  // ============================================================================
  // Metadata Methods
  // ============================================================================

  /**
   * Generate SP metadata
   */
  generateSPMetadata(options?: {
    organizationName?: string;
    organizationDisplayName?: string;
    organizationUrl?: string;
    contactPersonType?: 'technical' | 'support' | 'administrative' | 'billing' | 'other';
    contactPersonEmail?: string;
    contactPersonName?: string;
    validUntil?: Date;
  }): string {
    return buildSPMetadata(this.config, options);
  }

  /**
   * Generate IdP metadata
   */
  generateIdPMetadata(options?: {
    organizationName?: string;
    organizationDisplayName?: string;
    organizationUrl?: string;
    contactPersonType?: 'technical' | 'support' | 'administrative' | 'billing' | 'other';
    contactPersonEmail?: string;
    contactPersonName?: string;
    validUntil?: Date;
  }): string {
    return buildIdPMetadata(this.config, options);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Decode a SAML request
   */
  decodeRequest(encodedRequest: string): string {
    return inflateAndDecode(encodedRequest);
  }

  /**
   * Decode a SAML response
   */
  decodeResponse(encodedResponse: string): string {
    return inflateAndDecode(encodedResponse);
  }

  /**
   * Check if a status code indicates success
   */
  isSuccessfulStatusCode(statusCode: string): boolean {
    return statusCode === 'urn:oasis:names:tc:SAML:2.0:status:Success';
  }

  /**
   * Get a user-friendly error message from a status code
   */
  getErrorMessage(statusCode: string): string {
    return SAMLStatusHandler.getErrorMessage({
      id: '',
      inResponseTo: '',
      issueInstant: new Date(),
      issuer: '',
      destination: '',
      status: {
        statusCode: { value: statusCode },
      },
    });
  }

  // ============================================================================
  // Cleanup Methods
  // ============================================================================

  /**
   * Clean up expired requests from the store
   */
  cleanupExpiredRequests(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [id, request] of this.requestStore.entries()) {
      if (now - request.timestamp > this.options.requestExpiration * 1000) {
        expiredKeys.push(id);
      }
    }

    for (const key of expiredKeys) {
      this.requestStore.delete(key);
    }

    return expiredKeys.length;
  }

  /**
   * Clean up expired responses from the store
   */
  cleanupExpiredResponses(): number {
    const now = Date.now();
    const expiration = this.options.requestExpiration * 1000;
    const expiredKeys: string[] = [];

    for (const [id, response] of this.responseStore.entries()) {
      if (now - response.timestamp > expiration) {
        expiredKeys.push(id);
      }
    }

    for (const key of expiredKeys) {
      this.responseStore.delete(key);
    }

    return expiredKeys.length;
  }

  /**
   * Clean up all expired entries
   */
  cleanup(): number {
    return this.cleanupExpiredRequests() + this.cleanupExpiredResponses();
  }

  // ============================================================================
  // Getter Methods
  // ============================================================================

  /**
   * Get the SAML configuration
   */
  getConfig(): SAMLConfig {
    return { ...this.config };
  }

  /**
   * Get stored requests
   */
  getStoredRequests(): Map<string, { timestamp: number; relayState?: string }> {
    return new Map(this.requestStore);
  }

  /**
   * Get stored responses
   */
  getStoredResponses(): Map<string, { timestamp: number; validated: boolean }> {
    return new Map(this.responseStore);
  }

  /**
   * Clear all stored data
   */
  clearStores(): void {
    this.requestStore.clear();
    this.responseStore.clear();
  }

  /**
   * Get the validator instance
   */
  getValidator(): SAMLResponseValidator {
    return this.validator;
  }
}

// ============================================================================
// SAML Service Factory
// ============================================================================

export class SAMLServiceFactory {
  private static instances: Map<string, SAMLService> = new Map();

  /**
   * Create or get a SAML service instance
   */
  static create(config: SAMLConfig, options?: SAMLServiceOptions): SAMLService {
    const key = config.entityId;

    if (!this.instances.has(key)) {
      this.instances.set(key, new SAMLService(config, options));
    }

    return this.instances.get(key)!;
  }

  /**
   * Remove a SAML service instance
   */
  static remove(config: SAMLConfig): void {
    this.instances.delete(config.entityId);
  }

  /**
   * Clear all instances
   */
  static clear(): void {
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

export type { SAMLConfig, AuthnRequestOptions, ParsedSAMLResponse, ValidationResult };
