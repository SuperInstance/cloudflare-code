/**
 * Groups and Role Mapping Module
 * Main entry point for group and role mapping functionality
 */

// Re-export all types
export * from '../types';

// Re-export group mapping service
export {
  GroupMappingService,
  type GroupMappingServiceOptions,
} from './group-mapping';
