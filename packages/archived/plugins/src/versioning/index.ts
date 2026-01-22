/**
 * Plugin Versioning Module
 *
 * Exports version management functionality for plugins.
 */

export {
  // SemVer operations
  parseSemVer,
  formatSemVer,
  compareSemVer,
  equalsSemVer,
  greaterThanSemVer,
  lessThanSemVer,
  satisfiesSemVer,
  incrementSemVer,

  // Version constraints
  parseVersionConstraint,
  formatVersionConstraint,

  // Version manager
  VersionManager,

  // Types
  type SemVer,
  type VersionRange,
  type PluginVersionInfo,
  type Migration,
  type VersionConstraint,
  type DependencyVersion,
  type VersionConflict,
  type VersionManagerConfig
} from './versioning';
