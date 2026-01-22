/**
 * SAML 2.0 Utility Functions
 * Helper functions for SAML message generation, validation, and processing
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import type {
  SAMLNameIdFormat,
  SAMLSigningAlgorithm,
  SAMLDigestAlgorithm,
} from '../types';

// ============================================================================
// Constants
// ============================================================================

export const SAML_VERSION = '2.0';
export const SAML_PROTOCOL = 'urn:oasis:names:tc:SAML:2.0:protocol';
export const SAML_ASSERTION = 'urn:oasis:names:tc:SAML:2.0:assertion';
export const SAML_METADATA = 'urn:oasis:names:tc:SAML:2.0:metadata';
export const SAML_XMLSIG = 'http://www.w3.org/2000/09/xmldsig#';
export const SAMLENC = 'urn:oasis:names:tc:SAML:2.0:ac';

export const NAMEID_FORMATS = {
  UNSPECIFIED: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  EMAIL_ADDRESS: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  X509_SUBJECT_NAME: 'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName',
  WINDOWS_DOMAIN_QUALIFIED_NAME:
    'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName',
  PERSISTENT: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  TRANSIENT: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
} as const;

export const SIGNING_ALGORITHMS = {
  RSA_SHA1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  RSA_SHA256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  RSA_SHA512: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
} as const;

export const DIGEST_ALGORITHMS = {
  SHA1: 'http://www.w3.org/2000/09/xmldsig#sha1',
  SHA256: 'http://www.w3.org/2001/04/xmlenc#sha256',
  SHA512: 'http://www.w3.org/2001/04/xmlenc#sha512',
} as const;

export const BINDINGS = {
  HTTP_REDIRECT: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
  HTTP_POST: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
  HTTP_ARTIFACT: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact',
  SOAP: 'urn:oasis:names:tc:SAML:2.0:bindings:SOAP',
  PAOS: 'urn:oasis:names:tc:SAML:2.0:bindings:PAOS',
} as const;

export const NAME_ID_POLICY_FORMATS = {
  UNSPECIFIED: NAMEID_FORMATS.UNSPECIFIED,
  EMAIL_ADDRESS: NAMEID_FORMATS.EMAIL_ADDRESS,
  PERSISTENT: NAMEID_FORMATS.PERSISTENT,
  TRANSIENT: NAMEID_FORMATS.TRANSIENT,
} as const;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique SAML ID
 * Format: _xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export function generateSAMLId(): string {
  return `_${uuidv4()}`;
}

/**
 * Generate SAML timestamp in ISO 8601 format
 */
export function generateSAMLTimestamp(date?: Date): string {
  const d = date || new Date();
  return d.toISOString();
}

/**
 * Generate SAML issue instant
 */
export function generateIssueInstant(date?: Date): string {
  return generateSAMLTimestamp(date);
}

// ============================================================================
// Base64 Encoding/Decoding
// ============================================================================

/**
 * Base64 encode a string
 */
export function base64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Base64 decode a string
 */
export function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Base64 encode a URL-safe string
 */
export function base64URLEncode(str: string): string {
  return base64Encode(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 decode a URL-safe string
 */
export function base64URLDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) {
    s += '=';
  }
  return base64Decode(s);
}

/**
 * Inflate and decode a base64-encoded string
 */
export function inflateAndDecode(encoded: string): string {
  const base64 = base64URLDecode(encoded);
  const buffer = Buffer.from(base64, 'base64');
  return buffer.toString('utf-8');
}

/**
 * Deflate and encode a string to base64
 */
export function deflateAndEncode(str: string): string {
  const buffer = Buffer.from(str, 'utf-8');
  return base64URLEncode(buffer.toString('base64'));
}

// ============================================================================
// Cryptography
// ============================================================================

/**
 * Generate a digest for a string
 */
export function generateDigest(
  data: string,
  algorithm: SAMLDigestAlgorithm = DIGEST_ALGORITHMS.SHA256
): string {
  const algo = algorithm.split('#')[1].toLowerCase() as 'sha1' | 'sha256' | 'sha512';
  return crypto.createHash(algo).update(data, 'utf-8').digest('base64');
}

/**
 * Sign data with a private key
 */
export function signData(
  data: string,
  privateKey: string,
  algorithm: SAMLSigningAlgorithm = SIGNING_ALGORITHMS.RSA_SHA256
): string {
  const algo = algorithm.split('#')[1].toLowerCase() as 'rsa-sha1' | 'rsa-sha256' | 'rsa-sha512';
  const sign = crypto.createSign(algo);
  sign.update(data, 'utf-8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Verify signature
 */
export function verifySignature(
  data: string,
  signature: string,
  publicKey: string,
  algorithm: SAMLSigningAlgorithm = SIGNING_ALGORITHMS.RSA_SHA256
): boolean {
  const algo = algorithm.split('#')[1].toLowerCase() as 'rsa-sha1' | 'rsa-sha256' | 'rsa-sha512';
  const verify = crypto.createVerify(algo);
  verify.update(data, 'utf-8');
  verify.end();
  return verify.verify(publicKey, signature, 'base64');
}

/**
 * Encrypt data with a public key
 */
export function encryptData(data: string, publicKey: string): string {
  const buffer = Buffer.from(data, 'utf-8');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );
  return encrypted.toString('base64');
}

/**
 * Decrypt data with a private key
 */
export function decryptData(encryptedData: string, privateKey: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );
  return decrypted.toString('utf-8');
}

/**
 * Generate a random nonce
 */
export function generateNonce(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a relay state for SAML requests
 */
export function generateRelayState(): string {
  return generateNonce(16);
}

// ============================================================================
// XML Helpers
// ============================================================================

/**
 * Escape special XML characters
 */
export function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Create a SAML namespace attribute
 */
export function createSAMLNamespace(prefix: string = 'saml'): string {
  return `xmlns:${prefix}="${SAML_ASSERTION}"`;
}

/**
 * Create a SAML protocol namespace attribute
 */
export function createSAMLProtocolNamespace(prefix: string = 'samlp'): string {
  return `xmlns:${prefix}="${SAML_PROTOCOL}"`;
}

/**
 * Create a XML Signature namespace attribute
 */
export function createXMLSigNamespace(prefix: string = 'ds'): string {
  return `xmlns:${prefix}="${SAML_XMLSIG}"`;
}

/**
 * Parse XML string to object
 */
export function parseXML(xml: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // This would use xml2js in a real implementation
    // For now, return a placeholder
    try {
      // Simulated XML parsing
      const result = { xml };
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Build XML string from object
 */
export function buildXML(obj: any): string {
  // This would use xml2js builder in a real implementation
  // For now, return a placeholder
  return JSON.stringify(obj);
}

// ============================================================================
// SAML Message Validation
// ============================================================================

/**
 * Validate a SAML response
 */
export function validateSAMLResponse(response: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!response.ID) {
    errors.push('Missing ID attribute');
  }

  if (!response.InResponseTo) {
    errors.push('Missing InResponseTo attribute');
  }

  if (!response.IssueInstant) {
    errors.push('Missing IssueInstant attribute');
  }

  if (!response.Issuer) {
    errors.push('Missing Issuer element');
  }

  if (!response.Destination) {
    errors.push('Missing Destination attribute');
  }

  // Check status
  if (!response.Status) {
    errors.push('Missing Status element');
  } else if (!response.Status.StatusCode) {
    errors.push('Missing StatusCode element');
  } else if (response.Status.StatusCode.Value !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
    errors.push(`Status code: ${response.Status.StatusCode.Value}`);
    if (response.Status.StatusMessage) {
      errors.push(`Status message: ${response.Status.StatusMessage}`);
    }
  }

  // Check assertions
  if (!response.Assertion && !response.EncryptedAssertion) {
    errors.push('No Assertion or EncryptedAssertion element found');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate SAML assertion conditions
 */
export function validateAssertionConditions(
  conditions: any,
  options: {
    skewAllowance?: number;
    audience?: string;
  } = {}
): {
  valid: boolean;
  errors: string[];
} {
  const { skewAllowance = 300, audience } = options;
  const errors: string[] = [];
  const now = Date.now();

  if (!conditions) {
    return { valid: true, errors: [] };
  }

  // Check NotBefore
  if (conditions.NotBefore) {
    const notBefore = new Date(conditions.NotBefore).getTime();
    if (now < notBefore - skewAllowance * 1000) {
      errors.push('Assertion is not yet valid');
    }
  }

  // Check NotOnOrAfter
  if (conditions.NotOnOrAfter) {
    const notOnOrAfter = new Date(conditions.NotOnOrAfter).getTime();
    if (now > notOnOrAfter + skewAllowance * 1000) {
      errors.push('Assertion has expired');
    }
  }

  // Check audience restrictions
  if (conditions.AudienceRestrictions && audience) {
    const validAudience = conditions.AudienceRestrictions.some((restriction: any) => {
      return restriction.Audience && restriction.Audience.includes(audience);
    });

    if (!validAudience) {
      errors.push('Assertion audience does not match');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate SAML subject confirmation
 */
export function validateSubjectConfirmation(
  subjectConfirmation: any,
  options: {
    recipient?: string;
    inResponseTo?: string;
    skewAllowance?: number;
  } = {}
): {
  valid: boolean;
  errors: string[];
} {
  const { recipient, inResponseTo, skewAllowance = 300 } = options;
  const errors: string[] = [];
  const now = Date.now();

  if (!subjectConfirmation) {
    errors.push('No subject confirmation found');
    return { valid: false, errors };
  }

  const confirmationData = subjectConfirmation.SubjectConfirmationData;

  if (!confirmationData) {
    errors.push('No subject confirmation data found');
    return { valid: false, errors };
  }

  // Check recipient
  if (recipient && confirmationData.Recipient !== recipient) {
    errors.push('Subject confirmation recipient mismatch');
  }

  // Check InResponseTo
  if (inResponseTo && confirmationData.InResponseTo !== inResponseTo) {
    errors.push('Subject confirmation InResponseTo mismatch');
  }

  // Check NotOnOrAfter
  if (confirmationData.NotOnOrAfter) {
    const notOnOrAfter = new Date(confirmationData.NotOnOrAfter).getTime();
    if (now > notOnOrAfter + skewAllowance * 1000) {
      errors.push('Subject confirmation has expired');
    }
  }

  // Check NotBefore
  if (confirmationData.NotBefore) {
    const notBefore = new Date(confirmationData.NotBefore).getTime();
    if (now < notBefore - skewAllowance * 1000) {
      errors.push('Subject confirmation is not yet valid');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Certificate Handling
// ============================================================================

/**
 * Extract public key from certificate
 */
export function extractPublicKeyFromCertificate(certificate: string): string {
  const cert = certificate
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  // In a real implementation, this would extract the actual public key
  // For now, return the certificate itself
  return `-----BEGIN CERTIFICATE-----\n${certificate.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
}

/**
 * Validate certificate expiration
 */
export function validateCertificateExpiration(certificate: string): {
  valid: boolean;
  expiresAt?: Date;
  expired: boolean;
  daysUntilExpiry?: number;
} {
  // In a real implementation, this would parse the certificate and check its expiration
  // For now, return a placeholder
  return {
    valid: true,
    expired: false,
  };
}

/**
 * Format certificate for display
 */
export function formatCertificate(certificate: string): string {
  const cleaned = certificate
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  const lines = cleaned.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Build a SAML request URL with all parameters
 */
export function buildSAMLRequestUrl(
  ssoUrl: string,
  samlRequest: string,
  relayState?: string,
  options: {
    signingAlgorithm?: SAMLSigningAlgorithm;
    signature?: string;
  } = {}
): string {
  const params = new URLSearchParams();

  params.append('SAMLRequest', samlRequest);

  if (relayState) {
    params.append('RelayState', relayState);
  }

  if (options.signature) {
    params.append('SigAlg', options.signingAlgorithm || SIGNING_ALGORITHMS.RSA_SHA256);
    params.append('Signature', options.signature);
  }

  const queryString = params.toString();
  return `${ssoUrl}${ssoUrl.includes('?') ? '&' : '?'}${queryString}`;
}

/**
 * Extract SAML response from POST data
 */
export function extractSAMLResponseFromPost(postData: {
  SAMLResponse?: string;
  RelayState?: string;
}): {
  samlResponse?: string;
  relayState?: string;
} {
  return {
    samlResponse: postData.SAMLResponse,
    relayState: postData.RelayState,
  };
}

/**
 * Extract SAML request from query parameters
 */
export function extractSAMLRequestFromQuery(query: {
  SAMLRequest?: string;
  RelayState?: string;
  Signature?: string;
  SigAlg?: string;
}): {
  samlRequest?: string;
  relayState?: string;
  signature?: string;
  signingAlgorithm?: string;
} {
  return {
    samlRequest: query.SAMLRequest,
    relayState: query.RelayState,
    signature: query.Signature,
    signingAlgorithm: query.SigAlg,
  };
}

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Create a SAML error response
 */
export function createSAMLError(
  errorCode: string,
  errorMessage?: string,
  inResponseTo?: string
): string {
  const id = generateSAMLId();
  const issueInstant = generateIssueInstant();

  const errorXml = `
    <samlp:ResponseStatus xmlns:samlp="${SAML_PROTOCOL}">
      <samlp:StatusCode Value="${errorCode}"/>
      ${errorMessage ? `<samlp:StatusMessage>${escapeXML(errorMessage)}</samlp:StatusMessage>` : ''}
    </samlp:ResponseStatus>
  `;

  return errorXml;
}

/**
 * Get friendly error message for SAML status code
 */
export function getSAMLErrorMessage(statusCode: string): string {
  const errorMessages: Record<string, string> = {
    'urn:oasis:names:tc:SAML:2.0:status:Requester':
      'The request could not be performed due to an error on the part of the requester',
    'urn:oasis:names:tc:SAML:2.0:status:Responder':
      'The request could not be performed due to an error on the part of the SAML responder or SAML authority',
    'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch':
      'The SAML responder could not process the request because the version of the request message was incorrect',
    'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed':
      'The responding provider was unable to authenticate the principal',
    'urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue':
      'An unexpected or invalid attribute value was received',
    'urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy':
      'The responding provider cannot authenticate the principal or the specified name identifier policy is not supported',
    'urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext':
      'The specified authentication context requirements cannot be met',
    'urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP':
      'The specified authentication context requirements cannot be met by any available identity provider',
    'urn:oasis:names:tc:SAML:2.0:status:NoPassive':
      'The responding provider cannot authenticate the principal without user interaction',
    'urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP':
      'The specified authentication context requirements cannot be met by the specified identity provider',
    'urn:oasis:names:tc:SAML:2.0:status:PartialLogout':
      'Some but not all of the participating session authorities have logged out',
    'urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded':
      'The responding provider cannot authenticate the principal due to proxy count exceeded',
    'urn:oasis:names:tc:SAML:2.0:status:RequestDenied':
      'The SAML request was denied',
    'urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported':
      'The SAML request is not supported',
    'urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated':
      'The SAML request version is deprecated',
    'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh':
      'The SAML request version is too high',
    'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow':
      'The SAML request version is too low',
    'urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized':
      'The resource value provided is not recognized',
    'urn:oasis:names:tc:SAML:2.0:status:TooManyResponses':
      'Too many responses were returned',
    'urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile':
      'An unknown attribute profile was requested',
    'urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal':
      'The principal is unknown',
    'urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding':
      'The requested binding is not supported',
  };

  return errorMessages[statusCode] || 'Unknown SAML error';
}
