/**
 * Privacy & Compliance Module
 * Exports all privacy and compliance functionality
 */

export {
  ConsentManager,
  DataClassifier,
  PrivacyRequestProcessor,
  DataAnonymizer,
  DataRetentionManager,
} from './compliance.js';

export type {
  PrivacyRequest,
  PrivacyRequestResult,
  PrivacyRequestMetadata,
  ConsentRecord,
  ConsentEntry,
  DataClassification,
} from '../types/index.js';
