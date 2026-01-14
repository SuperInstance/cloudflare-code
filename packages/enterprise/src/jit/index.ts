/**
 * JIT Provisioning Module
 * Main entry point for Just-in-Time provisioning functionality
 */

// Re-export all types
export * from '../types';

// Re-export JIT provisioning service
export {
  JITProvisioningService,
  type JITUserData,
  type JITProvisioningOptions,
} from './jit-provisioning';
