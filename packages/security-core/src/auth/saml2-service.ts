/**
 * SAML2 Service
 * Handles SAML2 authentication flows (SP-initiated and IdP-initiated)
 */

import xml2js from 'xml2js';
import crypto from 'crypto';
import { SAML2Config, SAML2Assertion } from './types';
import { SecurityError } from '../types';
import { Logger } from '../utils/logger';
import { AuthService } from './auth-service';

export class SAML2Service {
  private config: SAML2Config;
  private authService: AuthService;
  private logger: Logger;
  private parser: xml2js.Parser;

  constructor(config: SAML2Config, authService: AuthService) {
    this.config = config;
    this.authService = authService;
    this.logger = new Logger('SAML2Service');
    this.parser = new xml2js.Parser({
      explicitCharkey: true,
      explicitArray: false,
      mergeAttrs: true
    });
  }

  /**
   * Generate SAML2 authentication request
   */
  async generateAuthRequest(): Promise<{ samlRequest: string; relayState: string }> {
    try {
      const id = `_saml_${crypto.randomUUID()}`;
      const issueInstant = new Date().toISOString();
      const destination = this.config.idp.ssoUrl;

      const samlRequest = this.buildAuthRequest(id, issueInstant, destination);
      const encodedRequest = Buffer.from(samlRequest).toString('base64');
      const relayState = crypto.randomUUID();

      this.logger.info('SAML2 authentication request generated', {
        idp: this.config.idp.entityId,
        destination
      });

      return {
        samlRequest: encodedRequest,
        relayState
      };

    } catch (error) {
      this.logger.error('Failed to generate SAML2 authentication request', error);
      throw new SecurityError('Failed to generate SAML2 authentication request', 'SAML2_REQUEST_FAILED', 500);
    }
  }

  /**
   * Process SAML2 response (Assertion)
   */
  async processResponse(samlResponse: string, relayState?: string): Promise<{ user: any; token?: any }> {
    try {
      // Decode and parse SAML response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf8');
      const parsedResponse = await this.parser.parseStringPromise(decodedResponse);

      // Validate SAML response structure
      this.validateSamlResponseStructure(parsedResponse);

      // Verify signature if present
      if (parsedResponse.Response.Signature) {
        await this.verifySignature(parsedResponse);
      }

      // Extract assertion
      const assertion = parsedResponse.Response.Assertion;
      if (!assertion) {
        throw new SecurityError('SAML2 assertion not found in response', 'ASSERTION_NOT_FOUND', 400);
      }

      // Validate assertion
      await this.validateAssertion(assertion);

      // Extract user information
      const userInfo = this.extractUserInfoFromAssertion(assertion);

      // Find or create user
      const user = await this.findOrCreateSAML2User(userInfo);

      // Generate token
      const token = await this.authService['generateTokens'](user);

      this.logger.info('SAML2 response processed successfully', {
        idp: this.config.idp.entityId,
        userId: user.id
      });

      return {
        user,
        token
      };

    } catch (error) {
      this.logger.error('Failed to process SAML2 response', error);
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Failed to process SAML2 response', 'SAML2_RESPONSE_FAILED', 500);
    }
  }

  /**
   * Generate SAML2 logout request
   */
  async generateLogoutRequest(userId: string, relayState?: string): Promise<{ samlLogoutRequest: string }> {
    try {
      const id = `_saml_logout_${crypto.randomUUID()}`;
      const issueInstant = new Date().toISOString();
      const destination = this.config.idp.sloUrl || this.config.idp.ssoUrl;

      const samlLogoutRequest = this.buildLogoutRequest(id, issueInstant, destination, userId);
      const encodedRequest = Buffer.from(samlLogoutRequest).toString('base64');

      this.logger.info('SAML2 logout request generated', {
        idp: this.config.idp.entityId,
        userId
      });

      return {
        samlLogoutRequest: encodedRequest
      };

    } catch (error) {
      this.logger.error('Failed to generate SAML2 logout request', error);
      throw new SecurityError('Failed to generate SAML2 logout request', 'SAML2_LOGOUT_FAILED', 500);
    }
  }

  /**
   * Process SAML2 logout response
   */
  async processLogoutResponse(samlLogoutResponse: string): Promise<boolean> {
    try {
      const decodedResponse = Buffer.from(samlLogoutResponse, 'base64').toString('utf8');
      const parsedResponse = await this.parser.parseStringPromise(decodedResponse);

      // Validate logout response
      this.validateLogoutResponse(parsedResponse);

      this.logger.info('SAML2 logout response processed successfully');
      return true;

    } catch (error) {
      this.logger.error('Failed to process SAML2 logout response', error);
      throw new SecurityError('Failed to process SAML2 logout response', 'SAML2_LOGOUT_RESPONSE_FAILED', 500);
    }
  }

  /**
   * Build SAML2 authentication request
   */
  private buildAuthRequest(id: string, issueInstant: string, destination: string): string {
    const builder = new xml2js.Builder();
    const xmlObj = {
      'samlp:AuthnRequest': {
        'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'ID': id,
        'Version': '2.0',
        'IssueInstant': issueInstant,
        'Destination': destination,
        'ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        'AssertionConsumerServiceURL': this.config.assertionConsumerServiceUrl,
        'ProviderName': this.config.entityId,
        'saml:Issuer': {
          'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
          '_': this.config.entityId
        }
      }
    };

    return builder.buildObject(xmlObj);
  }

  /**
   * Build SAML2 logout request
   */
  private buildLogoutRequest(id: string, issueInstant: string, destination: string, userId: string): string {
    const builder = new xml2js.Builder();
    const xmlObj = {
      'samlp:LogoutRequest': {
        'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'ID': id,
        'Version': '2.0',
        'IssueInstant': issueInstant,
        'Destination': destination,
        'saml:NameID': {
          'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
          '_': userId,
          'Format': 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
        }
      }
    };

    return builder.buildObject(xmlObj);
  }

  /**
   * Validate SAML response structure
   */
  private validateSamlResponseStructure(parsedResponse: any): void {
    if (!parsedResponse.Response) {
      throw new SecurityError('Invalid SAML2 response: Response element missing', 'INVALID_RESPONSE', 400);
    }

    if (parsedResponse.Response.Status) {
      const statusCode = parsedResponse.Response.Status.StatusCode;
      if (statusCode && statusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
        throw new SecurityError(`SAML2 authentication failed: ${statusCode}`, 'SAML2_AUTH_FAILED', 400);
      }
    }
  }

  /**
   * Verify SAML2 signature
   */
  private async verifySignature(parsedResponse: any): Promise<void> {
    try {
      // Extract signature information
      const signature = parsedResponse.Response.Signature;
      if (!signature) {
        throw new SecurityError('Signature element missing', 'SIGNATURE_MISSING', 400);
      }

      // Verify certificate
      const idpCertificate = this.config.idp.certificate;
      const publicKey = crypto.createPublicKey({
        key: idpCertificate,
        format: 'pem'
      });

      // In a real implementation, you would verify the XML signature
      // This is a simplified version
      const verificationBuffer = Buffer.from(parsedResponse.Response);
      const isValid = crypto.verify(
        'sha256',
        verificationBuffer,
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(signature.SignatureValue, 'base64')
      );

      if (!isValid) {
        throw new SecurityError('SAML2 signature verification failed', 'SIGNATURE_VERIFICATION_FAILED', 400);
      }

    } catch (error) {
      this.logger.error('SAML2 signature verification failed', error);
      throw new SecurityError('SAML2 signature verification failed', 'SIGNATURE_VERIFICATION_FAILED', 400);
    }
  }

  /**
   * Validate SAML2 assertion
   */
  private async validateAssertion(assertion: any): Promise<void> {
    const now = new Date();

    // Check issue time
    const issueInstant = new Date(assertion.IssueInstant);
    if (issueInstant.getTime() > now.getTime()) {
      throw new SecurityError('SAML2 assertion issued in the future', 'FUTURE_ISSUE_TIME', 400);
    }

    // Check conditions
    if (assertion.Conditions) {
      const notBefore = new Date(assertion.Conditions.NotBefore);
      const notOnOrAfter = new Date(assertion.Conditions.NotOnOrAfter);

      if (now.getTime() < notBefore.getTime()) {
        throw new SecurityError('SAML2 assertion not yet valid', 'NOT_YET_VALID', 400);
      }

      if (now.getTime() >= notOnOrAfter.getTime()) {
        throw new SecurityError('SAML2 assertion expired', 'ASSERTION_EXPIRED', 400);
      }
    }

    // Check audience restriction
    if (assertion.Conditions?.AudienceRestriction) {
      const allowedAudience = this.config.entityId;
      const audience = assertion.Conditions.AudienceRestriction.Audience;

      if (audience !== allowedAudience) {
        throw new SecurityError('Invalid SAML2 audience', 'INVALID_AUDIENCE', 400);
      }
    }
  }

  /**
   * Extract user information from SAML2 assertion
   */
  private extractUserInfoFromAssertion(assertion: any): any {
    const subject = assertion.Subject;
    if (!subject || !subject.NameID) {
      throw new SecurityError('Subject information missing in SAML2 assertion', 'SUBJECT_MISSING', 400);
    }

    const nameId = subject.NameID;
    const attributes = assertion.AttributeStatement?.Attribute || {};

    return {
      email: nameId._ || attributes.email?.Value || nameId,
      firstName: attributes.firstName?.Value || attributes.givenName?.Value || '',
      lastName: attributes.lastName?.Value || attributes.sn?.Value || '',
      username: attributes.uid?.Value || attributes.employeeNumber?.Value || nameId,
      displayName: attributes.displayName?.Value || attributes.cn?.Value || '',
      department: attributes.department?.Value || '',
      title: attributes.title?.Value || '',
      id: attributes.employeeId?.Value || attributes.eduPersonPrincipalName?.Value || nameId
    };
  }

  /**
   * Find or create SAML2 user
   */
  private async findOrCreateSAML2User(userInfo: any): Promise<any> {
    try {
      const email = userInfo.email;
      if (!email) {
        throw new SecurityError('Email is required for SAML2 authentication', 'EMAIL_REQUIRED', 400);
      }

      // Find existing user
      let user = await this.authService['findUserByEmail'](email);

      if (!user) {
        // Create new user
        user = await this.authService['createUser']({
          email,
          username: userInfo.username || email.split('@')[0],
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          role: 'user',
          mfaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          metadata: {
            provider: 'saml2',
            providerId: userInfo.id,
            providerData: userInfo
          }
        });
      } else {
        // Update existing user with SAML2 info
        user.metadata = {
          ...user.metadata,
          provider: 'saml2',
          providerId: userInfo.id,
          providerData: userInfo,
          lastLoginAt: new Date()
        };
        await this.authService['updateUserLoginInfo'](user.id, false);
      }

      return user;

    } catch (error) {
      this.logger.error('Failed to find or create SAML2 user', error);
      throw new SecurityError('Failed to find or create user', 'USER_CREATE_FAILED', 500);
    }
  }

  /**
   * Validate SAML2 logout response
   */
  private validateLogoutResponse(parsedResponse: any): void {
    if (!parsedResponse.LogoutResponse) {
      throw new SecurityError('Invalid SAML2 logout response', 'INVALID_LOGOUT_RESPONSE', 400);
    }

    const status = parsedResponse.LogoutResponse.Status;
    if (status && status.StatusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
      throw new SecurityError(`SAML2 logout failed: ${status.StatusCode}`, 'SAML2_LOGOUT_FAILED', 400);
    }
  }

  /**
   * Generate metadata XML
   */
  generateMetadata(): string {
    const builder = new xml2js.Builder();
    const xmlObj = {
      'md:EntityDescriptor': {
        'xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
        'EntityDescriptor': {
          'entityID': this.config.entityId,
          'ID': `_md_${crypto.randomUUID()}`,
          'ValidUntil': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '+00:00'),
          'md:SPSSODescriptor': {
            'protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
            'KeyDescriptor': {
              'use': 'signing',
              'ds:KeyInfo': {
                'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                'ds:X509Data': {
                  'ds:X509Certificate': this.config.certificate
                }
              }
            },
            'md:AssertionConsumerService': {
              'Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
              'Location': this.config.assertionConsumerServiceUrl,
              'index': '1'
            },
            'md:SingleLogoutService': {
              'Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
              'Location': this.config.idp.sloUrl || this.config.idp.ssoUrl
            }
          }
        }
      }
    };

    return builder.buildObject(xmlObj);
  }
}