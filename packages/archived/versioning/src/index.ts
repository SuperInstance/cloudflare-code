/**
 * ClaudeFlare API Versioning System
 *
 * Comprehensive API versioning and deprecation system for distributed AI coding platform
 */

// Version Management
export {
  VersionManager,
  SemanticVersioning,
  VersioningMiddleware,
  createVersioningMiddleware,
  requireVersion,
} from './versions/index.js';

// Deprecation
export { DeprecationManager } from './deprecation/index.js';

// Breaking Change Detection
export {
  BreakingChangeDetector,
  type ChangeAnalysis,
  type EndpointComparison,
} from './analysis/index.js';

// Compatibility Testing
export { CompatibilityTester, type TestCase } from './compatibility/index.js';

// Migration
export { MigrationEngine, type MigrationResult } from './migration/index.js';

// Migration Guides
export { GuideGenerator, type GuideOptions } from './guides/index.js';

// Validation
export { APIValidator } from './validation/index.js';

// Types
export * from './types/index.js';

// Version utilities
export { VersionUtils } from './utils/VersionUtils.js';
