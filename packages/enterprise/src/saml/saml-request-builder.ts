/**
 * SAML 2.0 Request Builder
 * Builds SAML authentication requests for SP-initiated SSO
 */

import type {
  SAMLConfig,
  SAMLRequest,
  SAMLNameIdFormat,
  SAMLNameIdPolicy,
  SAMLRequestedAuthnContext,
} from '../types';

import {
  generateSAMLId,
  generateIssueInstant,
  base64URLEncode,
  escapeXML,
  SAML_VERSION,
  SAML_PROTOCOL,
  SAML_ASSERTION,
  NAMEID_FORMATS,
  SIGNING_ALGORITHMS,
  DIGEST_ALGORITHMS,
  BINDINGS,
  signData,
} from './saml-utils';

// ============================================================================
// SAML AuthnRequest Builder
// ============================================================================

export interface AuthnRequestOptions {
  forceAuthn?: boolean;
  isPassive?: boolean;
  nameIdPolicy?: SAMLNameIdPolicy;
  requestedAuthnContext?: SAMLRequestedAuthnContext;
  attributeConsumingServiceIndex?: number;
  relayState?: string;
  binding?: string;
  destination?: string;
}

/**
 * Build a SAML 2.0 Authentication Request
 */
export function buildAuthnRequest(
  config: SAMLConfig,
  options: AuthnRequestOptions = {}
): {
  samlRequest: string;
  id: string;
  relayState?: string;
} {
  const id = generateSAMLId();
  const issueInstant = generateIssueInstant();
  const destination = options.destination || config.ssoUrl;
  const binding = options.binding || BINDINGS.HTTP_POST;

  // Build NameIDPolicy
  let nameIdPolicyXml = '';
  if (options.nameIdPolicy) {
    const allowCreate = options.nameIdPolicy.allowCreate !== false;
    nameIdPolicyXml = `
      <NameIDPolicy
        Format="${options.nameIdPolicy.format}"
        ${options.nameIdPolicy.spNameQualifier ? `SPNameQualifier="${options.nameIdPolicy.spNameQualifier}"` : ''}
        AllowCreate="${allowCreate ? 'true' : 'false'}"/>`;
  } else if (config.nameIdFormat) {
    nameIdPolicyXml = `
      <NameIDPolicy
        Format="${config.nameIdFormat}"
        AllowCreate="true"/>`;
  }

  // Build RequestedAuthnContext
  let authnContextXml = '';
  if (options.requestedAuthnContext) {
    const comparison = options.requestedAuthnContext.comparison || 'exact';
    const classRefs = options.requestedAuthnContext.authnContextClassRefs
      .map(ref => `<AuthnContextClassRef>${ref}</AuthnContextClassRef>`)
      .join('\n        ');

    authnContextXml = `
      <RequestedAuthnContext Comparison="${comparison}">
        ${classRefs}
      </RequestedAuthnContext>`;
  }

  // Build AttributeConsumingServiceIndex
  let attributeIndexXml = '';
  if (options.attributeConsumingServiceIndex || config.attributeConsumingServiceIndex) {
    const index = options.attributeConsumingServiceIndex || config.attributeConsumingServiceIndex;
    attributeIndexXml = `AttributeConsumingServiceIndex="${index}"`;
  }

  // Build ForceAuthn
  const forceAuthn = options.forceAuthn ? 'true' : 'false';

  // Build IsPassive
  const isPassive = options.isPassive ? 'true' : 'false';

  // Build the full AuthnRequest
  const authnRequest = `
    <samlp:AuthnRequest
      xmlns:samlp="${SAML_PROTOCOL}"
      xmlns:saml="${SAML_ASSERTION}"
      ID="${id}"
      Version="${SAML_VERSION}"
      IssueInstant="${issueInstant}"
      Destination="${escapeXML(destination)}"
      ProtocolBinding="${binding}"
      AssertionConsumerServiceURL="${escapeXML(config.assertionConsumerServiceUrl)}"
      ${attributeIndexXml}
      ForceAuthn="${forceAuthn}"
      IsPassive="${isPassive}">
      <saml:Issuer>${escapeXML(config.entityId)}</saml:Issuer>${nameIdPolicyXml}${authnContextXml}
    </samlp:AuthnRequest>
  `.trim();

  // Encode the request
  const encodedRequest = base64URLEncode(authnRequest);

  return {
    samlRequest: encodedRequest,
    id,
    relayState: options.relayState,
  };
}

/**
 * Build a SAML 2.0 Authentication Request with signature
 */
export function buildSignedAuthnRequest(
  config: SAMLConfig,
  options: AuthnRequestOptions = {}
): {
  samlRequest: string;
  id: string;
  relayState?: string;
  signature?: string;
  signingAlgorithm?: string;
} {
  if (!config.privateKey) {
    throw new Error('Private key is required for signed requests');
  }

  const { samlRequest, id, relayState } = buildAuthnRequest(config, options);

  // Build the signature string
  const signingAlgorithm = config.signingAlgorithm || SIGNING_ALGORITHMS.RSA_SHA256;
  const signatureString = `SAMLRequest=${encodeURIComponent(samlRequest)}&RelayState=${encodeURIComponent(relayState || '')}&SigAlg=${encodeURIComponent(signingAlgorithm)}`;

  // Sign the request
  const signature = signData(signatureString, config.privateKey, signingAlgorithm);

  return {
    samlRequest,
    id,
    relayState,
    signature,
    signingAlgorithm,
  };
}

// ============================================================================
// SAML LogoutRequest Builder
// ============================================================================

export interface LogoutRequestOptions {
  sessionIndex?: string;
  reason?: string;
  relayState?: string;
  binding?: string;
  destination?: string;
}

/**
 * Build a SAML 2.0 Logout Request
 */
export function buildLogoutRequest(
  config: SAMLConfig,
  nameId: string,
  nameIdFormat: SAMLNameIdFormat,
  sessionIndex: string,
  options: LogoutRequestOptions = {}
): {
  samlRequest: string;
  id: string;
  relayState?: string;
} {
  const id = generateSAMLId();
  const issueInstant = generateIssueInstant();
  const destination = options.destination || config.sloUrl;
  const binding = options.binding || BINDINGS.HTTP_REDIRECT;

  // Build the LogoutRequest
  const logoutRequest = `
    <samlp:LogoutRequest
      xmlns:samlp="${SAML_PROTOCOL}"
      xmlns:saml="${SAML_ASSERTION}"
      ID="${id}"
      Version="${SAML_VERSION}"
      IssueInstant="${issueInstant}"
      Destination="${escapeXML(destination)}"
      ${options.reason ? `Reason="${escapeXML(options.reason)}"` : ''}>
      <saml:Issuer>${escapeXML(config.entityId)}</saml:Issuer>
      <saml:NameID Format="${nameIdFormat}">${escapeXML(nameId)}</saml:NameID>
      <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>
    </samlp:LogoutRequest>
  `.trim();

  // Encode the request
  const encodedRequest = base64URLEncode(logoutRequest);

  return {
    samlRequest: encodedRequest,
    id,
    relayState: options.relayState,
  };
}

// ============================================================================
// SAML Metadata Builder
// ============================================================================

export interface MetadataOptions {
  organizationName?: string;
  organizationDisplayName?: string;
  organizationUrl?: string;
  contactPersonType?: 'technical' | 'support' | 'administrative' | 'billing' | 'other';
  contactPersonEmail?: string;
  contactPersonName?: string;
  validUntil?: Date;
  cacheDuration?: string;
}

/**
 * Build SP Metadata for SAML 2.0
 */
export function buildSPMetadata(
  config: SAMLConfig,
  options: MetadataOptions = {}
): string {
  const now = new Date();
  const validUntil = options.validUntil || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
  const cacheDuration = options.cacheDuration || 'PT5H'; // 5 hours

  // Build Organization section
  let organizationXml = '';
  if (options.organizationName) {
    organizationXml = `
      <Organization>
        <OrganizationName>${escapeXML(options.organizationName)}</OrganizationName>
        <OrganizationDisplayName>${escapeXML(options.organizationDisplayName || options.organizationName)}</OrganizationDisplayName>
        <OrganizationURL>${escapeXML(options.organizationUrl || config.entityId)}</OrganizationURL>
      </Organization>`;
  }

  // Build ContactPerson section
  let contactPersonXml = '';
  if (options.contactPersonEmail) {
    contactPersonXml = `
      <ContactPerson contactType="${options.contactPersonType || 'technical'}">
        ${options.contactPersonName ? `<GivenName>${escapeXML(options.contactPersonName.split(' ')[0])}</GivenName>` : ''}
        ${options.contactPersonName ? `<SurName>${escapeXML(options.contactPersonName.split(' ').slice(1).join(' '))}</SurName>` : ''}
        <EmailAddress>${escapeXML(options.contactPersonEmail)}</EmailAddress>
      </ContactPerson>`;
  }

  // Build KeyDescriptor for signing
  const keyDescriptorXml = `
    <KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${config.certificate.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '')}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>`;

  // Build the full metadata
  const metadata = `
    <md:EntityDescriptor
      xmlns:md="${SAML_PROTOCOL}metadata"
      entityID="${escapeXML(config.entityId)}"
      validUntil="${validUntil.toISOString()}"
      cacheDuration="${cacheDuration}">
      <md:SPSSODescriptor
        protocolSupportEnumeration="${SAML_PROTOCOL}"
        AuthnRequestsSigned="${config.wantAssertionsSigned ? 'true' : 'false'}"
        WantAssertionsSigned="${config.wantAssertionsSigned ? 'true' : 'false'}">
        ${keyDescriptorXml}
        <md:NameIDFormat>${config.nameIdFormat || NAMEID_FORMATS.TRANSIENT}</md:NameIDFormat>
        <md:AssertionConsumerService
          Binding="${BINDINGS.HTTP_POST}"
          Location="${escapeXML(config.assertionConsumerServiceUrl)}"
          index="1"/>
        ${config.sloUrl ? `<md:SingleLogoutService
          Binding="${BINDINGS.HTTP_REDIRECT}"
          Location="${escapeXML(config.sloUrl)}"/>` : ''}
      </md:SPSSODescriptor>${organizationXml}${contactPersonXml}
    </md:EntityDescriptor>
  `.trim();

  return metadata;
}

/**
 * Build IdP Metadata for SAML 2.0
 */
export function buildIdPMetadata(
  config: SAMLConfig,
  options: MetadataOptions = {}
): string {
  const now = new Date();
  const validUntil = options.validUntil || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Build Organization section
  let organizationXml = '';
  if (options.organizationName) {
    organizationXml = `
      <Organization>
        <OrganizationName>${escapeXML(options.organizationName)}</OrganizationName>
        <OrganizationDisplayName>${escapeXML(options.organizationDisplayName || options.organizationName)}</OrganizationDisplayName>
        <OrganizationURL>${escapeXML(options.organizationUrl || config.entityId)}</OrganizationURL>
      </Organization>`;
  }

  // Build ContactPerson section
  let contactPersonXml = '';
  if (options.contactPersonEmail) {
    contactPersonXml = `
      <ContactPerson contactType="${options.contactPersonType || 'technical'}">
        ${options.contactPersonName ? `<GivenName>${escapeXML(options.contactPersonName.split(' ')[0])}</GivenName>` : ''}
        ${options.contactPersonName ? `<SurName>${escapeXML(options.contactPersonName.split(' ').slice(1).join(' '))}</SurName>` : ''}
        <EmailAddress>${escapeXML(options.contactPersonEmail)}</EmailAddress>
      </ContactPerson>`;
  }

  // Build KeyDescriptor
  const signingKeyXml = `
    <KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${config.certificate.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '')}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>`;

  const encryptionKeyXml = config.wantAssertionsEncrypted ? signingKeyXml : '';

  // Build the full metadata
  const metadata = `
    <md:EntityDescriptor
      xmlns:md="${SAML_PROTOCOL}metadata"
      entityID="${escapeXML(config.entityId)}"
      validUntil="${validUntil.toISOString()}">
      <md:IDPSSODescriptor
        protocolSupportEnumeration="${SAML_PROTOCOL}"
        WantAuthnRequestsSigned="${config.wantAssertionsSigned ? 'true' : 'false'}">
        ${signingKeyXml}
        ${encryptionKeyXml}
        <md:NameIDFormat>${config.nameIdFormat || NAMEID_FORMATS.TRANSIENT}</md:NameIDFormat>
        <md:SingleSignOnService
          Binding="${BINDINGS.HTTP_REDIRECT}"
          Location="${escapeXML(config.ssoUrl)}"/>
        <md:SingleSignOnService
          Binding="${BINDINGS.HTTP_POST}"
          Location="${escapeXML(config.ssoUrl)}"/>
        ${config.sloUrl ? `<md:SingleLogoutService
          Binding="${BINDINGS.HTTP_REDIRECT}"
          Location="${escapeXML(config.sloUrl)}"/>
        <md:SingleLogoutService
          Binding="${BINDINGS.HTTP_POST}"
          Location="${escapeXML(config.sloUrl)}"/>` : ''}
      </md:IDPSSODescriptor>${organizationXml}${contactPersonXml}
    </md:EntityDescriptor>
  `.trim();

  return metadata;
}

// ============================================================================
// SAML Response Parser
// ============================================================================

export interface ParsedSAMLResponse {
  id: string;
  inResponseTo: string;
  issuer: string;
  destination: string;
  issueInstant: Date;
  statusCode: string;
  statusMessage?: string;
  nameId?: string;
  nameIdFormat?: string;
  sessionIndex?: string;
  attributes: Record<string, string[]>;
  notOnOrAfter?: Date;
  notBefore?: Date;
  audience?: string[];
  relayState?: string;
}

/**
 * Parse a SAML 2.0 Response
 */
export function parseSAMLResponse(
  encodedResponse: string,
  relayState?: string
): ParsedSAMLResponse {
  // Decode the response
  const decodedResponse = Buffer.from(encodedResponse, 'base64').toString('utf-8');

  // This is a simplified parser - in production, use a proper XML parser
  const parsed: ParsedSAMLResponse = {
    id: '',
    inResponseTo: '',
    issuer: '',
    destination: '',
    issueInstant: new Date(),
    statusCode: '',
    attributes: {},
    relayState,
  };

  // Extract ID
  const idMatch = decodedResponse.match(/ID="([^"]+)"/);
  if (idMatch) {
    parsed.id = idMatch[1];
  }

  // Extract InResponseTo
  const inResponseToMatch = decodedResponse.match(/InResponseTo="([^"]+)"/);
  if (inResponseToMatch) {
    parsed.inResponseTo = inResponseToMatch[1];
  }

  // Extract Issuer
  const issuerMatch = decodedResponse.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/);
  if (issuerMatch) {
    parsed.issuer = issuerMatch[1];
  }

  // Extract Destination
  const destinationMatch = decodedResponse.match(/Destination="([^"]+)"/);
  if (destinationMatch) {
    parsed.destination = destinationMatch[1];
  }

  // Extract IssueInstant
  const issueInstantMatch = decodedResponse.match(/IssueInstant="([^"]+)"/);
  if (issueInstantMatch) {
    parsed.issueInstant = new Date(issueInstantMatch[1]);
  }

  // Extract StatusCode
  const statusCodeMatch = decodedResponse.match(/<samlp:StatusCode Value="([^"]+)"/);
  if (statusCodeMatch) {
    parsed.statusCode = statusCodeMatch[1];
  }

  // Extract StatusMessage
  const statusMessageMatch = decodedResponse.match(/<samlp:StatusMessage[^>]*>([^<]+)<\/samlp:StatusMessage>/);
  if (statusMessageMatch) {
    parsed.statusMessage = statusMessageMatch[1];
  }

  // Extract NameID
  const nameIdMatch = decodedResponse.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
  if (nameIdMatch) {
    parsed.nameId = nameIdMatch[1];
  }

  // Extract NameID Format
  const nameIdFormatMatch = decodedResponse.match(/<saml:NameID[^>]+Format="([^"]+)"/);
  if (nameIdFormatMatch) {
    parsed.nameIdFormat = nameIdFormatMatch[1];
  }

  // Extract SessionIndex
  const sessionIndexMatch = decodedResponse.match(/<samlp:SessionIndex>([^<]+)<\/samlp:SessionIndex>/);
  if (sessionIndexMatch) {
    parsed.sessionIndex = sessionIndexMatch[1];
  }

  // Extract attributes
  const attributeMatches = decodedResponse.matchAll(/<saml:Attribute[^>]+Name="([^"]+)"[^>]*>([\s\S]*?)<\/saml:Attribute>/g);
  for (const match of attributeMatches) {
    const attributeName = match[1];
    const attributeValueMatch = match[2].match(/<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/);

    if (attributeValueMatch) {
      const attributeValue = attributeValueMatch[1];
      if (!parsed.attributes[attributeName]) {
        parsed.attributes[attributeName] = [];
      }
      parsed.attributes[attributeName].push(attributeValue);
    }
  }

  // Extract NotOnOrAfter
  const notOnOrAfterMatch = decodedResponse.match(/NotOnOrAfter="([^"]+)"/);
  if (notOnOrAfterMatch) {
    parsed.notOnOrAfter = new Date(notOnOrAfterMatch[1]);
  }

  // Extract NotBefore
  const notBeforeMatch = decodedResponse.match(/NotBefore="([^"]+)"/);
  if (notBeforeMatch) {
    parsed.notBefore = new Date(notBeforeMatch[1]);
  }

  // Extract Audience
  const audienceMatch = decodedResponse.match(/<saml:Audience[^>]*>([^<]+)<\/saml:Audience>/);
  if (audienceMatch) {
    parsed.audience = [audienceMatch[1]];
  }

  return parsed;
}
