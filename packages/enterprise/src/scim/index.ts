/**
 * SCIM 2.0 Module
 * Main entry point for SCIM 2.0 functionality
 */

// Re-export all types
export * from '../types';

// Re-export SCIM service
export {
  SCIMService,
  buildSCIMFilter,
  buildCompoundFilter,
  createPatchOperation,
  addUserToGroupOperation,
  removeUserFromGroupOperation,
  type SCIMServiceOptions,
  type SCIMResponse,
  type SCIMListResponseWithMeta,
} from './scim-service';

// Re-export SCIM provisioning
export {
  SCIMProvisioningService,
  SCIMSyncService,
  type SCIMProvisioningOptions,
  type SCIMSyncOptions,
  type SCIMSyncResult,
  type SCIMSyncStats,
} from './scim-provisioning';
