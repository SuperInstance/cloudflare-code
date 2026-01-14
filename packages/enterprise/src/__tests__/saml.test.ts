/**
 * SAML 2.0 Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  SAMLService,
  buildAuthnRequest,
  buildSPMetadata,
  parseSAMLResponse,
  extractAttributesFromAssertion,
  SAMLResponseValidator,
} from '../saml';

import type { SAMLConfig, SAMLAssertion } from '../types';

describe('SAMLService', () => {
  let config: SAMLConfig;
  let service: SAMLService;

  beforeEach(() => {
    config = {
      entityId: 'https://sp.example.com/metadata',
      ssoUrl: 'https://idp.example.com/sso',
      sloUrl: 'https://idp.example.com/slo',
      certificate: 'MIICijCCAXICCQD6m6kno1PDkjANBgkqhkiG9w0BAQsFADCBiDELMAkGA1UEBhMCVVMx',
      privateKey: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKBjK',
      nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      assertionConsumerServiceUrl: 'https://sp.example.com/acs',
      wantAssertionsSigned: true,
      signingAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    };

    service = new SAMLService(config);
  });

  describe('createAuthnRequest', () => {
    it('should create a SAML authn request', () => {
      const result = service.createAuthnRequest({
        forceAuthn: true,
        isPassive: false,
      });

      expect(result).toBeDefined();
      expect(result.requestId).toBeDefined();
      expect(result.requestUrl).toBeDefined();
      expect(result.requestUrl).toContain(config.ssoUrl);
      expect(result.requestUrl).toContain('SAMLRequest=');
    });

    it('should create signed authn request when private key is provided', () => {
      const result = service.createAuthnRequest({
        forceAuthn: false,
      });

      expect(result.requestId).toBeDefined();
      expect(result.requestUrl).toBeDefined();
    });

    it('should include relay state if provided', () => {
      const relayState = 'test-relay-state';
      const result = service.createAuthnRequest({
        relayState,
      });

      expect(result.relayState).toBe(relayState);
      expect(result.requestUrl).toContain('RelayState=');
    });
  });

  describe('processResponse', () => {
    it('should process valid SAML response', async () => {
      const mockResponse = createMockSAMLResponse();
      const result = await service.processResponse(mockResponse);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle invalid SAML response', async () => {
      const invalidResponse = 'invalid-base64';
      const result = await service.processResponse(invalidResponse);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('generateSPMetadata', () => {
    it('should generate SP metadata', () => {
      const metadata = service.generateSPMetadata({
        organizationName: 'Test Organization',
        organizationDisplayName: 'Test Org',
        organizationUrl: 'https://example.com',
        contactPersonType: 'technical',
        contactPersonEmail: 'technical@example.com',
      });

      expect(metadata).toBeDefined();
      expect(metadata).toContain(config.entityId);
      expect(metadata).toContain(config.assertionConsumerServiceUrl);
      expect(metadata).toContain('Test Organization');
    });
  });
});

describe('buildAuthnRequest', () => {
  const config: SAMLConfig = {
    entityId: 'https://sp.example.com',
    ssoUrl: 'https://idp.example.com/sso',
    certificate: 'cert',
    assertionConsumerServiceUrl: 'https://sp.example.com/acs',
  };

  it('should build authn request with default options', () => {
    const result = buildAuthnRequest(config);

    expect(result.samlRequest).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.id).toMatch(/^_/);
  });

  it('should build authn request with nameIdPolicy', () => {
    const result = buildAuthnRequest(config, {
      nameIdPolicy: {
        format: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
        allowCreate: true,
      },
    });

    expect(result.samlRequest).toBeDefined();
  });
});

describe('parseSAMLResponse', () => {
  it('should parse SAML response', () => {
    const mockResponse = createMockSAMLResponse();
    const parsed = parseSAMLResponse(mockResponse);

    expect(parsed).toBeDefined();
    expect(parsed.id).toBeDefined();
    expect(parsed.issuer).toBeDefined();
  });
});

describe('extractAttributesFromAssertion', () => {
  it('should extract user attributes from assertion', () => {
    const assertion: SAMLAssertion = {
      id: '_abc123',
      issueInstant: new Date(),
      issuer: 'https://idp.example.com',
      subject: {
        nameId: {
          format: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
          value: 'user123',
        },
        subjectConfirmations: [],
      },
      attributeStatements: [
        {
          attributes: [
            {
              name: 'email',
              values: ['user@example.com'],
            },
            {
              name: 'firstName',
              values: ['John'],
            },
            {
              name: 'lastName',
              values: ['Doe'],
            },
          ],
        },
      ],
    };

    const attributes = extractAttributesFromAssertion(assertion);

    expect(attributes.userId).toBe('user123');
    expect(attributes.email).toBe('user@example.com');
    expect(attributes.firstName).toBe('John');
    expect(attributes.lastName).toBe('Doe');
  });

  it('should extract attributes with custom mapping', () => {
    const assertion: SAMLAssertion = {
      id: '_abc123',
      issueInstant: new Date(),
      issuer: 'https://idp.example.com',
      subject: {
        nameId: {
          format: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
          value: 'user@example.com',
        },
        subjectConfirmations: [],
      },
      attributeStatements: [
        {
          attributes: [
            {
              name: 'emailAddress',
              values: ['user@example.com'],
            },
          ],
        },
      ],
    };

    const attributes = extractAttributesFromAssertion(assertion, {
      email: 'emailAddress',
    });

    expect(attributes.email).toBe('user@example.com');
  });
});

// Helper function to create mock SAML response
function createMockSAMLResponse(): string {
  const response = `
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    ID="_mock123"
                    InResponseTo="_request123"
                    IssueInstant="2024-01-15T10:00:00Z"
                    Version="2.0"
                    Destination="https://sp.example.com/acs">
      <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
      <samlp:Status>
        <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
      </samlp:Status>
      <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="_assertion123"
                     IssueInstant="2024-01-15T10:00:00Z"
                     Version="2.0">
        <saml:Issuer>https://idp.example.com</saml:Issuer>
        <saml:Subject>
          <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">user123</saml:NameID>
          <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
            <saml:SubjectConfirmationData NotOnOrAfter="2024-01-15T10:05:00Z"
                                         Recipient="https://sp.example.com/acs"/>
          </saml:SubjectConfirmation>
        </saml:Subject>
        <saml:Conditions NotBefore="2024-01-15T09:55:00Z" NotOnOrAfter="2024-01-15T10:05:00Z">
          <saml:AudienceRestriction>
            <saml:Audience>https://sp.example.com</saml:Audience>
          </saml:AudienceRestriction>
        </saml:Conditions>
        <saml:AttributeStatement>
          <saml:Attribute Name="email">
            <saml:AttributeValue>user@example.com</saml:AttributeValue>
          </saml:Attribute>
          <saml:Attribute Name="firstName">
            <saml:AttributeValue>John</saml:AttributeValue>
          </saml:Attribute>
          <saml:Attribute Name="lastName">
            <saml:AttributeValue>Doe</saml:AttributeValue>
          </saml:Attribute>
        </saml:AttributeStatement>
      </saml:Assertion>
    </samlp:Response>
  `.trim();

  return Buffer.from(response).toString('base64');
}
