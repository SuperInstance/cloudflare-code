/**
 * Plugin Marketplace - Comprehensive plugin discovery and distribution system
 *
 * Features:
 * - Plugin listing with search and filtering
 * - Plugin ratings and reviews
 * - Download tracking and analytics
 * - Plugin trending and popularity metrics
 * - Category browsing
 * - Version management
 * - Security scanning integration
 * - Dependency visualization
 * - License compliance checking
 */

import { z } from 'zod';
import type {
  PluginManifest,
  PluginMetadata,
  PluginVersion,
  PluginCategory
} from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('Marketplace');

// ============================================================================
// Types and Schemas
// ============================================================================

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  author: string;
  email?: string;
  website?: string;
  repository?: string;
  logo?: string;
  banners?: string[];
  version: string;
  latestVersion: string;
  versions: PluginVersion[];
  category: PluginCategory;
  categories: PluginCategory[];
  keywords: string[];
  license: string;
  price?: number;
  free: boolean;
  verified: boolean;
  featured: boolean;
  downloads: number;
  installs: number;
  rating: number;
  ratingCount: number;
  reviews: Review[];
  trending: number;
  popularity: number;
  lastUpdated: Date;
  publishedAt: Date;
  dependencies: string[];
  peerDependencies: string[];
  devDependencies?: string[];
  compatibility: string[];
  security: SecurityInfo;
  screenshots?: Screenshot[];
  videos?: Video[];
  documentation?: string;
  homepage?: string;
  support?: string;
  donate?: string;
  sponsors?: Sponsor[];
  metrics: PluginMetrics;
  tags: string[];
  language?: string;
  minPlatformVersion?: string;
  maxPlatformVersion?: string;
  deprecated?: boolean;
  replacement?: string;
  experimental?: boolean;
  stable?: boolean;
  beta?: boolean;
  apiVersion?: string;
}

export interface Review {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  avatar?: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  notHelpful: number;
  createdAt: Date;
  updatedAt: Date;
  verifiedPurchase: boolean;
  response?: {
    userId: string;
    username: string;
    content: string;
    createdAt: Date;
  };
}

export interface SecurityInfo {
  scanned: boolean;
  lastScan: Date;
  vulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
  score: number;
  scanId?: string;
  reportUrl?: string;
  approved: boolean;
  flags: SecurityFlag[];
}

export interface SecurityFlag {
  type: 'vulnerability' | 'malware' | 'suspicious' | 'policy' | 'license';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details?: string;
}

export interface Screenshot {
  url: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface Video {
  url: string;
  thumbnail: string;
  caption?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface Sponsor {
  name: string;
  url?: string;
  avatar?: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
}

export interface PluginMetrics {
  views: number;
  uniqueViews: number;
  downloads: number;
  installs: number;
  uninstalls: number;
  activeInstalls: number;
  avgRating: number;
  ratingDistribution: Record<number, number>;
  retentionRate: number;
  churnRate: number;
  crashRate: number;
  performanceScore: number;
  qualityScore: number;
  documentationScore: number;
  supportScore: number;
}

export interface MarketplaceStats {
  totalPlugins: number;
  totalDownloads: number;
  totalInstalls: number;
  totalReviews: number;
  activePlugins: number;
  featuredPlugins: number;
  verifiedPlugins: number;
  categories: Record<PluginCategory, number>;
  topCategories: PluginCategory[];
  recentPlugins: MarketplacePlugin[];
  trendingPlugins: MarketplacePlugin[];
  popularPlugins: MarketplacePlugin[];
}

export interface SearchQuery {
  query?: string;
  category?: PluginCategory;
  categories?: PluginCategory[];
  keywords?: string[];
  tags?: string[];
  author?: string;
  license?: string;
  version?: string;
  compatibility?: string;
  verified?: boolean;
  featured?: boolean;
  free?: boolean;
  priceRange?: [number, number];
  rating?: number;
  downloads?: number;
  sortBy?: SearchSortOption;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export type SearchSortOption =
  | 'relevance'
  | 'name'
  | 'downloads'
  | 'rating'
  | 'reviews'
  | 'updated'
  | 'published'
  | 'trending'
  | 'popularity'
  | 'price'
  | 'installs';

export interface SearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: Record<PluginCategory, number>;
  licenses: Record<string, number>;
  authors: Record<string, number>;
  keywords: Record<string, number>;
  tags: Record<string, number>;
  priceRanges: Record<string, number>;
  ratingRanges: Record<string, number>;
}

export interface DownloadRequest {
  pluginId: string;
  version?: string;
  userId?: string;
  platform?: string;
  platformVersion?: string;
}

export interface DownloadResponse {
  pluginId: string;
  version: string;
  downloadUrl: string;
  checksum: string;
  size: number;
  signature?: string;
  expiresAt: Date;
}

// ============================================================================
// Configuration
// ============================================================================

export interface MarketplaceConfig {
  apiUrl: string;
  cdnUrl: string;
  cacheEnabled: boolean;
  cacheTtl: number;
  timeout: number;
  maxRetries: number;
  apiKey?: string;
  verifyDownloads?: boolean;
  checkUpdates?: boolean;
}

const DEFAULT_CONFIG: MarketplaceConfig = {
  apiUrl: 'https://marketplace.claudeflare.dev/api',
  cdnUrl: 'https://cdn.claudeflare.dev/plugins',
  cacheEnabled: true,
  cacheTtl: 300000, // 5 minutes
  timeout: 30000,
  maxRetries: 3,
  verifyDownloads: true,
  checkUpdates: true
};

// ============================================================================
// Marketplace Client
// ============================================================================

export class PluginMarketplace {
  private config: MarketplaceConfig;
  private cache: Map<string, { data: unknown; expiresAt: number }>;
  private http: typeof fetch;

  constructor(config: Partial<MarketplaceConfig> = {}, httpImpl: typeof fetch = fetch) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.http = httpImpl;
  }

  // ========================================================================
  // Plugin Discovery
  // ========================================================================

  /**
   * Search for plugins in the marketplace
   */
  async search(query: SearchQuery = {}): Promise<SearchResult> {
    const cacheKey = `search:${JSON.stringify(query)}`;

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<SearchResult>(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    if (query.query) params.set('q', query.query);
    if (query.category) params.set('category', query.category);
    if (query.categories) params.set('categories', query.categories.join(','));
    if (query.keywords) params.set('keywords', query.keywords.join(','));
    if (query.tags) params.set('tags', query.tags.join(','));
    if (query.author) params.set('author', query.author);
    if (query.license) params.set('license', query.license);
    if (query.compatibility) params.set('compatibility', query.compatibility);
    if (query.verified !== undefined) params.set('verified', String(query.verified));
    if (query.featured !== undefined) params.set('featured', String(query.featured));
    if (query.free !== undefined) params.set('free', String(query.free));
    if (query.rating) params.set('rating', String(query.rating));
    if (query.sortBy) params.set('sort', query.sortBy);
    if (query.sortOrder) params.set('order', query.sortOrder);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));

    const url = `${this.config.apiUrl}/plugins/search?${params}`;
    const result = await this.fetchWithRetry<SearchResult>(url);

    if (this.config.cacheEnabled) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * Get plugin details by ID
   */
  async getPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    const cacheKey = `plugin:${pluginId}`;

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<MarketplacePlugin>(cacheKey);
      if (cached) return cached;
    }

    try {
      const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}`;
      const result = await this.fetchWithRetry<MarketplacePlugin>(url);

      if (this.config.cacheEnabled) {
        this.setCache(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.warn('Failed to fetch plugin', { pluginId, error });
      return null;
    }
  }

  /**
   * Get multiple plugins by IDs
   */
  async getPlugins(pluginIds: string[]): Promise<MarketplacePlugin[]> {
    const plugins = await Promise.all(
      pluginIds.map(id => this.getPlugin(id))
    );
    return plugins.filter((p): p is MarketplacePlugin => p !== null);
  }

  /**
   * Get featured plugins
   */
  async getFeatured(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ featured: true, sortBy: 'popularity', limit }).then(r => r.plugins);
  }

  /**
   * Get trending plugins
   */
  async getTrending(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ sortBy: 'trending', limit }).then(r => r.plugins);
  }

  /**
   * Get popular plugins
   */
  async getPopular(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ sortBy: 'popularity', limit }).then(r => r.plugins);
  }

  /**
   * Get recently updated plugins
   */
  async getRecentlyUpdated(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ sortBy: 'updated', limit }).then(r => r.plugins);
  }

  /**
   * Get newly published plugins
   */
  async getNew(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ sortBy: 'published', limit }).then(r => r.plugins);
  }

  /**
   * Get top rated plugins
   */
  async getTopRated(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ sortBy: 'rating', limit }).then(r => r.plugins);
  }

  /**
   * Get most downloaded plugins
   */
  async getMostDownloaded(limit = 12): Promise<MarketplacePlugin[]> {
    return this.search({ sortBy: 'downloads', limit }).then(r => r.plugins);
  }

  /**
   * Browse plugins by category
   */
  async browseByCategory(
    category: PluginCategory,
    options: Partial<SearchQuery> = {}
  ): Promise<SearchResult> {
    return this.search({ ...options, category });
  }

  /**
   * Get plugins by author
   */
  async getByAuthor(author: string, options: Partial<SearchQuery> = {}): Promise<SearchResult> {
    return this.search({ ...options, author });
  }

  /**
   * Get related plugins
   */
  async getRelated(pluginId: string, limit = 6): Promise<MarketplacePlugin[]> {
    const cacheKey = `related:${pluginId}`;

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<MarketplacePlugin[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/related?limit=${limit}`;
      const result = await this.fetchWithRetry<MarketplacePlugin[]>(url);

      if (this.config.cacheEnabled) {
        this.setCache(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.warn('Failed to fetch related plugins', { pluginId, error });
      return [];
    }
  }

  // ========================================================================
  // Plugin Downloads
  // ========================================================================

  /**
   * Get download URL for a plugin
   */
  async getDownloadUrl(request: DownloadRequest): Promise<DownloadResponse | null> {
    try {
      const body = JSON.stringify(request);
      const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(request.pluginId)}/download`;

      const response = await this.fetchWithRetry<DownloadResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      return response;
    } catch (error) {
      logger.error('Failed to get download URL', { request, error });
      return null;
    }
  }

  /**
   * Download a plugin
   */
  async downloadPlugin(request: DownloadRequest): Promise<Buffer | null> {
    const downloadInfo = await this.getDownloadUrl(request);
    if (!downloadInfo) return null;

    try {
      const response = await this.http(downloadInfo.downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify checksum if enabled
      if (this.config.verifyDownloads && downloadInfo.checksum) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (hash !== downloadInfo.checksum) {
          throw new Error('Checksum verification failed');
        }
      }

      return buffer;
    } catch (error) {
      logger.error('Failed to download plugin', { request, error });
      return null;
    }
  }

  // ========================================================================
  // Reviews and Ratings
  // ========================================================================

  /**
   * Get reviews for a plugin
   */
  async getReviews(
    pluginId: string,
    options: { limit?: number; offset?: number; sortBy?: 'helpful' | 'recent' } = {}
  ): Promise<{ reviews: Review[]; total: number }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.sortBy) params.set('sort', options.sortBy);

    const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/reviews?${params}`;
    return this.fetchWithRetry(url);
  }

  /**
   * Submit a review for a plugin
   */
  async submitReview(
    pluginId: string,
    review: Omit<Review, 'id' | 'pluginId' | 'helpful' | 'notHelpful' | 'createdAt' | 'updatedAt'>,
    authToken: string
  ): Promise<Review> {
    const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/reviews`;
    const body = JSON.stringify(review);

    return this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body
    });
  }

  /**
   * Rate a review as helpful or not
   */
  async rateReview(
    pluginId: string,
    reviewId: string,
    helpful: boolean,
    authToken: string
  ): Promise<void> {
    const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/reviews/${reviewId}/rate`;
    await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ helpful })
    });
  }

  // ========================================================================
  // Statistics and Analytics
  // ========================================================================

  /**
   * Get marketplace statistics
   */
  async getStats(): Promise<MarketplaceStats> {
    const cacheKey = 'stats';

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<MarketplaceStats>(cacheKey);
      if (cached) return cached;
    }

    const url = `${this.config.apiUrl}/stats`;
    const result = await this.fetchWithRetry<MarketplaceStats>(url);

    if (this.config.cacheEnabled) {
      this.setCache(cacheKey, result, 60000); // Cache stats for 1 minute
    }

    return result;
  }

  /**
   * Get plugin metrics
   */
  async getPluginMetrics(pluginId: string): Promise<PluginMetrics | null> {
    try {
      const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/metrics`;
      return await this.fetchWithRetry<PluginMetrics>(url);
    } catch (error) {
      logger.warn('Failed to fetch plugin metrics', { pluginId, error });
      return null;
    }
  }

  /**
   * Track a plugin view
   */
  async trackView(pluginId: string): Promise<void> {
    try {
      await this.fetchWithRetry(`${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/view`, {
        method: 'POST'
      });
    } catch (error) {
      logger.warn('Failed to track view', { pluginId, error });
    }
  }

  /**
   * Track a plugin download
   */
  async trackDownload(pluginId: string, version: string): Promise<void> {
    try {
      await this.fetchWithRetry(`${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/download/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version })
      });
    } catch (error) {
      logger.warn('Failed to track download', { pluginId, version, error });
    }
  }

  // ========================================================================
  // Categories and Tags
  // ========================================================================

  /**
   * Get all categories with plugin counts
   */
  async getCategories(): Promise<Record<PluginCategory, number>> {
    const cacheKey = 'categories';

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<Record<PluginCategory, number>>(cacheKey);
      if (cached) return cached;
    }

    try {
      const url = `${this.config.apiUrl}/categories`;
      const result = await this.fetchWithRetry<Record<PluginCategory, number>>(url);

      if (this.config.cacheEnabled) {
        this.setCache(cacheKey, result, 300000); // Cache for 5 minutes
      }

      return result;
    } catch (error) {
      logger.warn('Failed to fetch categories', { error });
      return {};
    }
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit = 50): Promise<Array<{ tag: string; count: number }>> {
    try {
      const url = `${this.config.apiUrl}/tags?limit=${limit}`;
      return await this.fetchWithRetry<Array<{ tag: string; count: number }>>(url);
    } catch (error) {
      logger.warn('Failed to fetch popular tags', { error });
      return [];
    }
  }

  // ========================================================================
  // Version Management
  // ========================================================================

  /**
   * Get available versions for a plugin
   */
  async getVersions(pluginId: string): Promise<PluginVersion[]> {
    try {
      const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/versions`;
      return await this.fetchWithRetry<PluginVersion[]>(url);
    } catch (error) {
      logger.warn('Failed to fetch plugin versions', { pluginId, error });
      return [];
    }
  }

  /**
   * Check for updates for installed plugins
   */
  async checkUpdates(installedPlugins: Array<{ id: string; version: string }>): Promise<
    Array<{ id: string; currentVersion: string; latestVersion: string; updateAvailable: boolean }>
  > {
    try {
      const url = `${this.config.apiUrl}/plugins/check-updates`;
      const body = JSON.stringify({ plugins: installedPlugins });
      return await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
    } catch (error) {
      logger.warn('Failed to check for updates', { error });
      return [];
    }
  }

  // ========================================================================
  // Security
  // ========================================================================

  /**
   * Get security information for a plugin
   */
  async getSecurityInfo(pluginId: string): Promise<SecurityInfo | null> {
    try {
      const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/security`;
      return await this.fetchWithRetry<SecurityInfo>(url);
    } catch (error) {
      logger.warn('Failed to fetch security info', { pluginId, error });
      return null;
    }
  }

  /**
   * Report a security issue
   */
  async reportSecurityIssue(
    pluginId: string,
    issue: { title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical' },
    authToken: string
  ): Promise<void> {
    const url = `${this.config.apiUrl}/plugins/${encodeURIComponent(pluginId)}/security/report`;
    await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(issue)
    });
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.config.cacheTtl);
    this.cache.set(key, { data, expiresAt });
  }

  public clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.match(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // ========================================================================
  // HTTP Utilities
  // ========================================================================

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        ...options.headers
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await this.http(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retryCount < this.config.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry<T>(url, options, retryCount + 1);
      }

      throw error;
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default PluginMarketplace;
