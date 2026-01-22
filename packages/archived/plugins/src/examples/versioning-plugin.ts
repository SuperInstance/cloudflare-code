// @ts-nocheck
/**
 * Versioning Plugin
 *
 * Demonstrates how to use the versioning system to:
 * - Manage plugin versions
 * - Check for updates
 * - Handle version compatibility
 * - Resolve dependencies
 */

import { Plugin } from '../core/plugin';
import { VersionManager, parseSemVer, formatSemVer, satisfiesSemVer } from '../versioning';
import { hooks } from '../hooks';

export class VersioningPlugin extends Plugin {
  private versionManager = this.useContext('versionManager') as VersionManager;

  override async onLoad(): Promise<void> {
    await super.onLoad();

    // Initialize version manager
    if (!this.versionManager) {
      this.versionManager = new VersionManager({
        autoUpdate: true,
        allowPrerelease: false,
        checkInterval: 3600000, // 1 hour
        onUpdateAvailable: this.handleUpdateAvailable.bind(this)
      });
      this.setContext('versionManager', this.versionManager);
    }

    // Register this plugin's versions
    this.registerPluginVersions();

    this.logger.info('Versioning plugin loaded');
  }

  override async onActivate(): Promise<void> {
    await super.onActivate();

    // Mark current version as installed
    this.versionManager.setInstalled(this.id, this.getCurrentVersion());

    // Register hooks
    this.registerHook(hooks.onPluginLoad, this.handlePluginLoad.bind(this), {
      priority: 100
    });

    // Check for updates
    await this.checkForUpdates();

    this.logger.info('Versioning plugin activated');
  }

  /**
   * Register this plugin's versions
   */
  private registerPluginVersions(): void {
    this.versionManager.registerVersions(this.id, [
      {
        version: { major: 1, minor: 0, patch: 0 },
        breaking: false,
        features: ['Initial release', 'Basic versioning support'],
        fixes: [],
        deprecations: [],
        migrations: [],
        publishedAt: new Date('2024-01-01'),
        checksum: 'v1.0.0-checksum',
        size: 1024000
      },
      {
        version: { major: 1, minor: 1, patch: 0 },
        breaking: false,
        features: ['Added update checking', 'Improved dependency resolution'],
        fixes: ['Fixed version comparison bug'],
        deprecations: [],
        migrations: [],
        publishedAt: new Date('2024-02-01'),
        checksum: 'v1.1.0-checksum',
        size: 1025000
      },
      {
        version: { major: 2, minor: 0, patch: 0 },
        breaking: true,
        features: ['Breaking API changes', 'New versioning format'],
        fixes: [],
        deprecations: ['Old version format deprecated'],
        migrations: [
          {
            id: 'migrate-1-to-2',
            from: { major: 1, minor: 0, patch: 0 },
            to: { major: 2, minor: 0, patch: 0 },
            script: '// Migration script here',
            checksum: 'migration-checksum',
            dangerous: false,
            backupRequired: true,
            estimatedTime: 5000
          }
        ],
        publishedAt: new Date('2024-03-01'),
        checksum: 'v2.0.0-checksum',
        size: 1026000
      }
    ]);
  }

  /**
   * Get current plugin version
   */
  private getCurrentVersion() {
    return parseSemVer(this.version || '1.0.0');
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<boolean> {
    const hasUpdate = this.versionManager.hasUpdate(this.id);

    if (hasUpdate) {
      const current = this.versionManager.getInstalled(this.id)!;
      const latest = this.versionManager.getLatestVersion(this.id)!;

      this.logger.info('Update available', {
        current: formatSemVer(current),
        latest: formatSemVer(latest)
      });

      // Get version diff
      const diff = this.versionManager.getVersionDiff(this.id, current, latest);

      this.logger.info('Update details', {
        breaking: diff.breaking,
        features: diff.features,
        fixes: diff.fixes,
        migrations: diff.migrations.length
      });

      return true;
    }

    return false;
  }

  /**
   * Get all available versions
   */
  getAvailableVersions(): string[] {
    const versions = this.versionManager.getVersions(this.id);
    return versions.map(v => formatSemVer(v.version));
  }

  /**
   * Get compatible versions
   */
  getCompatibleVersions(): string[] {
    const current = this.getCurrentVersion();
    const compatible = this.versionManager.getCompatibleVersions(this.id, current);
    return compatible.map(v => formatSemVer(v));
  }

  /**
   * Check version compatibility
   */
  checkCompatibility(version: string): boolean {
    const current = this.getCurrentVersion();
    const target = parseSemVer(version);
    return this.versionManager.areCompatible(current, target);
  }

  /**
   * Resolve dependencies
   */
  resolveDependencies(): Map<string, string> | null {
    const resolved = this.versionManager.resolveDependencies(this.id);

    if (resolved) {
      const result = new Map<string, string>();
      for (const [id, version] of resolved) {
        result.set(id, formatSemVer(version));
      }
      return result;
    }

    return null;
  }

  /**
   * Handle update available callback
   */
  private handleUpdateAvailable(pluginId: string, current: any, available: any): void {
    this.logger.info('Update callback triggered', {
      pluginId,
      current: formatSemVer(current),
      available: formatSemVer(available)
    });
  }

  /**
   * Hook handler for plugin load
   */
  private async handlePluginLoad(data: { pluginId: string }): Promise<{ pluginId: string }> {
    const { pluginId } = data;

    // Check if the loaded plugin is compatible
    if (pluginId !== this.id) {
      const versions = this.versionManager.getVersions(pluginId);
      if (versions.length > 0) {
        const latest = versions[0].version;
        this.logger.info('Plugin loaded', {
          pluginId,
          latestVersion: formatSemVer(latest)
        });
      }
    }

    return data;
  }

  /**
   * Get version statistics
   */
  getVersionStats(): {
    current: string;
    latest: string;
    hasUpdate: boolean;
    totalVersions: number;
  } {
    const current = this.versionManager.getInstalled(this.id)!;
    const latest = this.versionManager.getLatestVersion(this.id)!;
    const versions = this.versionManager.getVersions(this.id);

    return {
      current: formatSemVer(current),
      latest: formatSemVer(latest),
      hasUpdate: this.versionManager.hasUpdate(this.id),
      totalVersions: versions.length
    };
  }

  /**
   * Compare two versions
   */
  compareVersions(v1: string, v2: string): number {
    return this.versionManager['compareSemVer']?.(
      parseSemVer(v1),
      parseSemVer(v2)
    ) || 0;
  }

  /**
   * Check if version satisfies constraint
   */
  satisfiesConstraint(version: string, constraint: string): boolean {
    return satisfiesSemVer(
      parseSemVer(version),
      this.versionManager['parseVersionConstraint']?.(constraint) || { type: 'any' }
    );
  }

  override async onDeactivate(): Promise<void> {
    // Cleanup
    this.versionManager?.stopUpdateChecker();

    await super.onDeactivate();
  }
}

// Export for dynamic loading
export default VersioningPlugin;
