/**
 * Plugin Marketplace Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginMarketplace, type MarketplacePlugin, type SearchQuery } from '../src/marketplace';

describe('PluginMarketplace', () => {
  let marketplace: PluginMarketplace;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    marketplace = new PluginMarketplace({}, mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search plugins with basic query', async () => {
      const mockResult = {
        plugins: [
          {
            id: 'test-plugin',
            name: 'Test Plugin',
            description: 'A test plugin',
            version: '1.0.0',
            downloads: 1000,
            rating: 4.5
          }
        ],
        total: 1,
        facets: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const result = await marketplace.search({ query: 'test' });

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=test'),
        expect.any(Object)
      );
    });

    it('should handle search errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(marketplace.search({ query: 'test' })).rejects.toThrow('Network error');
    });

    it('should cache search results', async () => {
      const mockResult = {
        plugins: [],
        total: 0,
        facets: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      // First call
      await marketplace.search({ query: 'test' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await marketplace.search({ query: 'test' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPlugin', () => {
    it('should fetch plugin details', async () => {
      const mockPlugin: MarketplacePlugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        description: 'A test plugin',
        version: '1.0.0',
        latestVersion: '1.0.0',
        versions: [],
        category: 'integration',
        categories: ['integration'],
        keywords: ['test'],
        license: 'MIT',
        free: true,
        verified: true,
        featured: false,
        downloads: 1000,
        installs: 500,
        rating: 4.5,
        ratingCount: 100,
        reviews: [],
        trending: 0,
        popularity: 0,
        lastUpdated: new Date(),
        publishedAt: new Date(),
        dependencies: [],
        peerDependencies: [],
        compatibility: [],
        security: {
          scanned: true,
          lastScan: new Date(),
          vulnerabilities: 0,
          criticalVulnerabilities: 0,
          highVulnerabilities: 0,
          mediumVulnerabilities: 0,
          lowVulnerabilities: 0,
          score: 100,
          approved: true,
          flags: []
        },
        metrics: {
          views: 10000,
          uniqueViews: 5000,
          downloads: 1000,
          installs: 500,
          uninstalls: 10,
          activeInstalls: 490,
          avgRating: 4.5,
          ratingDistribution: {},
          retentionRate: 0.98,
          churnRate: 0.02,
          crashRate: 0.001,
          performanceScore: 95,
          qualityScore: 90,
          documentationScore: 85,
          supportScore: 88
        },
        tags: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlugin
      });

      const result = await marketplace.getPlugin('test-plugin');

      expect(result).toEqual(mockPlugin);
    });

    it('should return null for non-existent plugins', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not found'));

      const result = await marketplace.getPlugin('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('browse methods', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ plugins: [], total: 0, facets: {} })
      });
    });

    it('should get featured plugins', async () => {
      await marketplace.getFeatured(12);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('featured=true'),
        expect.any(Object)
      );
    });

    it('should get trending plugins', async () => {
      await marketplace.getTrending(12);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=trending'),
        expect.any(Object)
      );
    });

    it('should get popular plugins', async () => {
      await marketplace.getPopular(12);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=popularity'),
        expect.any(Object)
      );
    });

    it('should get recently updated plugins', async () => {
      await marketplace.getRecentlyUpdated(12);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=updated'),
        expect.any(Object)
      );
    });
  });

  describe('download', () => {
    it('should get download URL', async () => {
      const mockDownloadInfo = {
        pluginId: 'test-plugin',
        version: '1.0.0',
        downloadUrl: 'https://cdn.example.com/test-plugin-1.0.0.tgz',
        checksum: 'abc123',
        size: 1024000,
        expiresAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDownloadInfo
      });

      const result = await marketplace.getDownloadUrl({
        pluginId: 'test-plugin',
        version: '1.0.0'
      });

      expect(result).toEqual(mockDownloadInfo);
    });

    it('should download plugin', async () => {
      const mockDownloadInfo = {
        pluginId: 'test-plugin',
        version: '1.0.0',
        downloadUrl: 'https://cdn.example.com/test-plugin-1.0.0.tgz',
        checksum: 'abc123',
        size: 1024000,
        expiresAt: new Date()
      };

      const mockBuffer = Buffer.from('test content');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDownloadInfo
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockBuffer.buffer,
          headers: new Headers()
        });

      const result = await marketplace.downloadPlugin({
        pluginId: 'test-plugin',
        version: '1.0.0'
      });

      expect(result).toEqual(mockBuffer);
    });
  });

  describe('reviews', () => {
    it('should get reviews for a plugin', async () => {
      const mockReviews = {
        reviews: [
          {
            id: 'review-1',
            pluginId: 'test-plugin',
            userId: 'user-1',
            username: 'Test User',
            rating: 5,
            title: 'Great plugin',
            content: 'Works perfectly',
            helpful: 10,
            notHelpful: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            verifiedPurchase: true
          }
        ],
        total: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReviews
      });

      const result = await marketplace.getReviews('test-plugin');

      expect(result).toEqual(mockReviews);
    });

    it('should submit a review', async () => {
      const mockReview = {
        id: 'review-1',
        pluginId: 'test-plugin',
        userId: 'user-1',
        username: 'Test User',
        rating: 5,
        title: 'Great plugin',
        content: 'Works perfectly',
        helpful: 0,
        notHelpful: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedPurchase: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReview
      });

      const result = await marketplace.submitReview(
        'test-plugin',
        {
          userId: 'user-1',
          username: 'Test User',
          rating: 5,
          title: 'Great plugin',
          content: 'Works perfectly',
          verifiedPurchase: true
        },
        'auth-token'
      );

      expect(result).toEqual(mockReview);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviews'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token'
          })
        })
      );
    });
  });

  describe('cache management', () => {
    it('should clear all cache', () => {
      marketplace.clearCache();
      // Should not throw
    });

    it('should clear cache by pattern', () => {
      marketplace.clearCache('plugin:.*');
      // Should not throw
    });
  });

  describe('error handling', () => {
    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ plugins: [], total: 0, facets: {} })
        });

      await marketplace.search({ query: 'test' });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should timeout after configured time', async () => {
      const slowMarketplace = new PluginMarketplace({ timeout: 100 }, mockFetch);

      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      await expect(slowMarketplace.search({ query: 'test' })).rejects.toThrow();
    }, 10000);
  });
});
