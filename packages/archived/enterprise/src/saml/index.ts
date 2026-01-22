/**
 * SAML 2.0 Module
 * Main entry point for SAML 2.0 functionality
 */

// Re-export all types
export * from '../types';

// Re-export SAML service
export { SAMLService, SAMLServiceFactory, SAMLServiceOptions } from './saml-service';

// Re-export SAML request builder
export {
  buildAuthnRequest,
  buildSignedAuthnRequest,
  buildLogoutRequest,
  buildSPMetadata,
  buildIdPMetadata,
  parseSAMLResponse,
  AuthnRequestOptions,
  LogoutRequestOptions,
  MetadataOptions,
  ParsedSAMLResponse,
} from './saml-request-builder';

// Re-export SAML response validator
export {
  SAMLResponseValidator,
  extractAttributesFromAssertion,
  SAMLStatusHandler,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SAMLErrorCode,
  ValidationOptions,
  ExtractedAttributes,
} from './saml-response-validator';

// Re-export SAML utils
export {
  generateSAMLId,
  generateSAMLTimestamp,
  generateIssueInstant,
  base64Encode,
  base64Decode,
  base64URLEncode,
  base64URLDecode,
  inflateAndDecode,
  deflateAndEncode,
  generateDigest,
  signData,
  verifySignature,
  encryptData,
  decryptData,
  generateNonce,
  generateRelayState,
  escapeXML,
  createSAMLNamespace,
  createSAMLProtocolNamespace,
  createXMLSigNamespace,
  parseXML,
  buildXML,
  validateSAMLResponse,
  validateAssertionConditions,
  validateSubjectConfirmation,
  extractPublicKeyFromCertificate,
  validateCertificateExpiration,
  formatCertificate,
  buildSAMLRequestUrl,
  extractSAMLResponseFromPost,
  extractSAMLRequestFromQuery,
  createSAMLError,
  getSAMLErrorMessage,
  SAML_VERSION,
  SAML_PROTOCOL,
  SAML_ASSERTION,
  SAML_METADATA,
  SAML_XMLSIG,
  SAMLENC,
  NAMEID_FORMATS,
  SIGNING_ALGORITHMS,
  DIGEST_ALGORITHMS,
  BINDINGS,
  NAME_ID_POLICY_FORMATS,
} from './saml-utils';
