/**
 * Asset Optimizer
 *
 * Advanced asset optimization for images, JavaScript, CSS, and more.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import PQueue from 'p-queue';
import crypto from 'crypto';
import mime from 'mime-types';
import type {
  IAssetOptimization,
  IOptimizedAsset,
  AssetType,
  OptimizationLevel,
  IOptimizerOptions
} from '../types/index.js';

const execAsync = promisify(exec);

export class AssetOptimizer {
  private options: IOptimizerOptions;
  private cache: Map<string, IOptimizedAsset>;
  private queue: PQueue;

  constructor(options?: IOptimizerOptions) {
    this.options = {
      parallelism: options?.parallelism ?? 4,
      cacheDir: options?.cacheDir,
      tempDir: options?.tempDir ?? '/tmp/cdn_optimizer',
      maxFileSize: options?.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      timeout: options?.timeout ?? 30000
    };

    this.cache = new Map();
    this.queue = new PQueue({ concurrency: this.options.parallelism });
  }

  /**
   * Optimize asset
   */
  public async optimize(
    content: string | Buffer,
    type: AssetType,
    options: Partial<IAssetOptimization> = {}
  ): Promise<IOptimizedAsset> {
    const startTime = Date.now();
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    // Generate cache key
    const cacheKey = this.generateCacheKey(contentBuffer, type, options);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check file size
    if (contentBuffer.length > this.options.maxFileSize) {
      throw new Error(
        `File size (${contentBuffer.length} bytes) exceeds maximum (${this.options.maxFileSize} bytes)`
      );
    }

    // Get optimization config
    const config: IAssetOptimization = {
      type,
      level: options.level ?? 'standard',
      compress: options.compress ?? true,
      minify: options.minify ?? true,
      transform: options.transform ?? false,
      quality: options.quality ?? 85,
      format: options.format,
      dimensions: options.dimensions,
      options: options.options ?? {}
    };

    // Optimize based on type
    let optimized: Buffer;
    switch (type) {
      case 'image':
        optimized = await this.optimizeImage(contentBuffer, config);
        break;
      case 'javascript':
        optimized = await this.optimizeJavaScript(contentBuffer, config);
        break;
      case 'css':
        optimized = await this.optimizeCSS(contentBuffer, config);
        break;
      case 'font':
        optimized = await this.optimizeFont(contentBuffer, config);
        break;
      default:
        optimized = contentBuffer;
    }

    // Apply compression if enabled
    if (config.compress) {
      optimized = await this.compress(optimized, type);
    }

    const result: IOptimizedAsset = {
      original: {
        size: contentBuffer.length,
        type: mime.lookup(type) || 'application/octet-stream',
        url: ''
      },
      optimized: {
        size: optimized.length,
        type: config.format ? mime.lookup(config.format) || 'application/octet-stream' : mime.lookup(type) || 'application/octet-stream',
        url: ''
      },
      savings: {
        bytes: contentBuffer.length - optimized.length,
        percentage: ((contentBuffer.length - optimized.length) / contentBuffer.length) * 100
      },
      duration: Date.now() - startTime,
      metadata: {
        cacheKey,
        optimizationLevel: config.level,
        quality: config.quality
      }
    };

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Optimize image
   */
  private async optimizeImage(
    content: Buffer,
    config: IAssetOptimization
  ): Promise<Buffer> {
    // For image optimization, we would typically use sharp or imagemin
    // This is a simplified implementation that demonstrates the pattern

    try {
      // Try using sharp if available
      const sharp = await import('sharp').catch(() => null);
      if (sharp) {
        return await this.optimizeWithSharp(content, config);
      }
    } catch (error) {
      console.warn('Sharp not available, using basic optimization');
    }

    // Basic optimization: just return original with format conversion if needed
    if (config.format && config.format !== 'original') {
      // In a real implementation, we would convert the image format
      // For now, just return the original
    }

    return content;
  }

  /**
   * Optimize with sharp
   */
  private async optimizeWithSharp(
    content: Buffer,
    config: IAssetOptimization
  ): Promise<Buffer> {
    const sharp = (await import('sharp')).default;

    let pipeline = sharp(content);

    // Resize if dimensions specified
    if (config.dimensions) {
      pipeline = pipeline.resize(
        config.dimensions.width,
        config.dimensions.height,
        {
          fit: 'inside',
          withoutEnlargement: true
        }
      );
    }

    // Apply quality settings
    const quality = config.quality ?? 85;

    // Output format
    switch (config.format) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, progressive: true });
        break;
      default:
        // Auto-detect from input
        const metadata = await sharp(content).metadata();
        if (metadata.format === 'png') {
          pipeline = pipeline.png({ quality, progressive: true });
        } else {
          pipeline = pipeline.jpeg({ quality, progressive: true });
        }
    }

    return await pipeline.toBuffer();
  }

  /**
   * Optimize JavaScript
   */
  private async optimizeJavaScript(
    content: Buffer,
    config: IAssetOptimization
  ): Promise<Buffer> {
    if (!config.minify) {
      return content;
    }

    const code = content.toString('utf-8');

    // Basic minification (remove comments, extra whitespace)
    const minified = code
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}();,:])\s*/g, '$1') // Remove spacing around operators
      .trim();

    return Buffer.from(minified, 'utf-8');
  }

  /**
   * Optimize CSS
   */
  private async optimizeCSS(
    content: Buffer,
    config: IAssetOptimization
  ): Promise<Buffer> {
    if (!config.minify) {
      return content;
    }

    const css = content.toString('utf-8');

    // Basic minification
    const minified = css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}:;,>~])\s*/g, '$1') // Remove spacing around delimiters
      .replace(/;}/g, '}') // Remove last semicolon
      .trim();

    return Buffer.from(minified, 'utf-8');
  }

  /**
   * Optimize font
   */
  private async optimizeFont(
    content: Buffer,
    config: IAssetOptimization
  ): Promise<Buffer> {
    // Font optimization is complex and typically requires specialized tools
    // This is a placeholder that returns the original content
    return content;
  }

  /**
   * Compress content
   */
  private async compress(content: Buffer, type: AssetType): Promise<Buffer> {
    // For compression, we would typically use gzip/brotli
    // This is a simplified implementation
    return content;
  }

  /**
   * Optimize multiple assets in parallel
   */
  public async optimizeBatch(
    assets: Array<{
      content: string | Buffer;
      type: AssetType;
      options?: Partial<IAssetOptimization>;
    }>
  ): Promise<IOptimizedAsset[]> {
    const results = await Promise.all(
      assets.map(asset =>
        this.queue.add(() => this.optimize(asset.content, asset.type, asset.options))
      )
    );

    return results as IOptimizedAsset[];
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    content: Buffer,
    type: AssetType,
    options: Partial<IAssetOptimization>
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(content)
      .update(type)
      .update(JSON.stringify(options))
      .digest('hex');

    return `opt_${hash.substring(0, 16)}`;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get optimization statistics
   */
  public getStatistics(): {
    totalOptimized: number;
    totalSaved: number;
    avgSavings: number;
    cacheHitRate: number;
  } {
    const values = Array.from(this.cache.values());
    const totalSaved = values.reduce((sum, v) => sum + v.savings.bytes, 0);
    const avgSavings =
      values.length > 0
        ? values.reduce((sum, v) => sum + v.savings.percentage, 0) / values.length
        : 0;

    return {
      totalOptimized: values.length,
      totalSaved,
      avgSavings,
      cacheHitRate: 0 // Would need to track requests
    };
  }

  /**
   * Get supported formats
   */
  public getSupportedFormats(type: AssetType): string[] {
    switch (type) {
      case 'image':
        return ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg'];
      case 'javascript':
        return ['js', 'mjs', 'cjs'];
      case 'css':
        return ['css'];
      case 'font':
        return ['woff2', 'woff', 'ttf', 'otf', 'eot'];
      default:
        return [];
    }
  }

  /**
   * Validate asset
   */
  public validateAsset(
    content: Buffer,
    type: AssetType
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    if (content.length > this.options.maxFileSize) {
      errors.push(
        `File size (${content.length} bytes) exceeds maximum (${this.options.maxFileSize} bytes)`
      );
    }

    // Check for empty content
    if (content.length === 0) {
      errors.push('File is empty');
    }

    // Type-specific validation
    switch (type) {
      case 'javascript':
        const jsContent = content.toString('utf-8');
        if (!jsContent.trim()) {
          errors.push('JavaScript file is empty or contains only whitespace');
        }
        break;
      case 'css':
        const cssContent = content.toString('utf-8');
        if (!cssContent.trim()) {
          errors.push('CSS file is empty or contains only whitespace');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get optimization recommendations
   */
  public getRecommendations(
    content: Buffer,
    type: AssetType
  ): Array<{ action: string; impact: string; description: string }> {
    const recommendations: Array<{
      action: string;
      impact: string;
      description: string;
    }> = [];

    const sizeKB = content.length / 1024;

    if (type === 'image') {
      if (sizeKB > 500) {
        recommendations.push({
          action: 'Reduce image dimensions',
          impact: 'high',
          description: 'Large images significantly impact load times'
        });
      }

      recommendations.push({
        action: 'Convert to WebP',
        impact: 'medium',
        description: 'WebP provides better compression than JPEG/PNG'
      });

      recommendations.push({
        action: 'Use progressive loading',
        impact: 'low',
        description: 'Progressive images improve perceived performance'
      });
    } else if (type === 'javascript' || type === 'css') {
      if (sizeKB > 100) {
        recommendations.push({
          action: 'Enable minification',
          impact: 'high',
          description: 'Minification can reduce file size by 30-50%'
        });
      }

      recommendations.push({
        action: 'Enable compression',
        impact: 'medium',
        description: 'Gzip compression can reduce file size by 60-80%'
      });
    }

    return recommendations;
  }
}

export default AssetOptimizer;
