/**
 * Marketplace Integration Plugin
 *
 * Demonstrates how to use the plugin marketplace to:
 * - Discover plugins
 * - Install updates
 * - Check for new plugins
 * - Rate and review plugins
 */

import { Plugin } from '../core/plugin';
import { PluginMarketplace } from '../marketplace';
import { hooks } from '../hooks';

export class MarketplacePlugin extends Plugin {
  private marketplace!: PluginMarketplace;

  override async onLoad(): Promise<void> {
    await super.onLoad();

    // Initialize marketplace client
    this.marketplace = new PluginMarketplace({
      apiUrl: 'https://marketplace.claudeflare.dev/api',
      cacheEnabled: true,
      checkUpdates: true
    });

    this.logger.info('Marketplace plugin loaded');
  }

  override async onActivate(): Promise<void> {
    await super.onActivate();

    // Register hooks
    this.registerHook(hooks.beforeRequest, this.handleBeforeRequest.bind(this), {
      priority: 100
    });

    this.logger.info('Marketplace plugin activated');
  }

  /**
   * Search for plugins in the marketplace
   */
  async searchPlugins(query: string, category?: string): Promise<unknown[]> {
    const result = await this.marketplace.search({
      query,
      category: category as any,
      sortBy: 'popularity',
      limit: 20
    });

    return result.plugins;
  }

  /**
   * Get featured plugins
   */
  async getFeaturedPlugins(): Promise<unknown[]> {
    return this.marketplace.getFeatured(12);
  }

  /**
   * Get trending plugins
   */
  async getTrendingPlugins(): Promise<unknown[]> {
    return this.marketplace.getTrending(12);
  }

  /**
   * Install a plugin from the marketplace
   */
  async installPlugin(pluginId: string, version?: string): Promise<boolean> {
    try {
      // Get download URL
      const downloadInfo = await this.marketplace.getDownloadUrl({
        pluginId,
        version
      });

      if (!downloadInfo) {
        this.logger.error('Failed to get download URL', { pluginId });
        return false;
      }

      // Download plugin
      const buffer = await this.marketplace.downloadPlugin({
        pluginId,
        version
      });

      if (!buffer) {
        this.logger.error('Failed to download plugin', { pluginId });
        return false;
      }

      // Track download
      await this.marketplace.trackDownload(pluginId, downloadInfo.version);

      this.logger.info('Plugin installed successfully', { pluginId, version: downloadInfo.version });
      return true;
    } catch (error) {
      this.logger.error('Failed to install plugin', { pluginId, error });
      return false;
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(installedPlugins: Array<{ id: string; version: string }>): Promise<
    Array<{ id: string; currentVersion: string; latestVersion: string }>
  > {
    const updates = await this.marketplace.checkUpdates(installedPlugins);

    return updates
      .filter(u => u.updateAvailable)
      .map(u => ({
        id: u.id,
        currentVersion: u.currentVersion,
        latestVersion: u.latestVersion
      }));
  }

  /**
   * Submit a review for a plugin
   */
  async submitReview(
    pluginId: string,
    review: {
      rating: number;
      title: string;
      content: string;
    }
  ): Promise<boolean> {
    try {
      await this.marketplace.submitReview(pluginId, {
        userId: 'current-user',
        username: 'Current User',
        ...review,
        verifiedPurchase: true
      }, 'auth-token');

      this.logger.info('Review submitted', { pluginId, rating: review.rating });
      return true;
    } catch (error) {
      this.logger.error('Failed to submit review', { pluginId, error });
      return false;
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<Record<string, unknown> | null> {
    try {
      const stats = await this.marketplace.getStats();
      return {
        totalPlugins: stats.totalPlugins,
        totalDownloads: stats.totalDownloads,
        activePlugins: stats.activePlugins,
        categories: stats.categories
      };
    } catch (error) {
      this.logger.error('Failed to get marketplace stats', { error });
      return null;
    }
  }

  /**
   * Hook handler for before request
   */
  private async handleBeforeRequest(data: unknown): Promise<unknown> {
    this.logger.debug('Before request hook called', { data });
    return data;
  }
}

// Export for dynamic loading
export default MarketplacePlugin;
