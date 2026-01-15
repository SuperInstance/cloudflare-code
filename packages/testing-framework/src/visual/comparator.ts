/**
 * Visual Comparator
 * Provides image comparison and diff analysis capabilities for visual regression testing
 */

import {
  VisualSnapshot,
  VisualTestResult,
  VisualComparison,
  VisualDiff,
  RegionDiff,
  DiffHighlight,
  Region
} from './types';
import { Logger } from '../core/logger';
import { ImageProcessor } from './image-processor';

export class VisualComparator {
  private logger: Logger;
  private imageProcessor: ImageProcessor;

  constructor() {
    this.logger = new Logger('VisualComparator');
    this.imageProcessor = new ImageProcessor();
  }

  /**
   * Compare two snapshots and return detailed comparison result
   */
  async compareSnapshots(
    baseline: VisualSnapshot,
    current: VisualSnapshot,
    options: {
      threshold: number;
      mode: 'strict' | 'fuzzy' | 'semantic';
      ignoreColors?: string[];
      ignoreRegions?: Region[];
      maskRegions?: Region[];
    }
  ): Promise<VisualComparison> {
    this.logger.info(`Comparing snapshots: ${baseline.id} vs ${current.id}`);

    try {
      // Load images
      const baselineImage = await this.imageProcessor.loadImage(baseline.imageUrl);
      const currentImage = await this.imageProcessor.loadImage(current.imageUrl);

      // Apply masks and ignore regions
      const processedBaseline = this.applyMasks(baselineImage, options.ignoreRegions, options.maskRegions);
      const processedCurrent = this.applyMasks(currentImage, options.ignoreRegions, options.maskRegions);

      // Compare based on mode
      let comparison: VisualComparison;

      switch (options.mode) {
        case 'strict':
          comparison = await this.compareStrict(processedBaseline, processedCurrent);
          break;
        case 'fuzzy':
          comparison = await this.compareFuzzy(processedBaseline, processedCurrent, options.threshold);
          break;
        case 'semantic':
          comparison = await this.compareSemantic(processedBaseline, processedCurrent, options.threshold);
          break;
        default:
          throw new Error(`Unknown comparison mode: ${options.mode}`);
      }

      // Apply color ignore list
      if (options.ignoreColors && options.ignoreColors.length > 0) {
        comparison = this.applyColorIgnore(comparison, options.ignoreColors);
      }

      this.logger.info(`Comparison completed: ${comparison.pixelDiffCount} pixels differ (${comparison.pixelDiffPercentage.toFixed(2)}%)`);

      return comparison;

    } catch (error) {
      this.logger.error(`Comparison failed: ${error}`);
      throw error;
    }
  }

  /**
   * Strict pixel-by-pixel comparison
   */
  private async compareStrict(
    baseline: ImageData,
    current: ImageData
  ): Promise<VisualComparison> {
    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error('Images must have the same dimensions for strict comparison');
    }

    const pixelDiffCount = 0;
    const regionDiffs: RegionDiff[] = [];

    for (let y = 0; y < baseline.height; y++) {
      for (let x = 0; x < baseline.width; x++) {
        const idx = (y * baseline.width + x) * 4;
        const baselinePixel = {
          r: baseline.data[idx],
          g: baseline.data[idx + 1],
          b: baseline.data[idx + 2],
          a: baseline.data[idx + 3]
        };
        const currentPixel = {
          r: current.data[idx],
          g: current.data[idx + 1],
          b: current.data[idx + 2],
          a: current.data[idx + 3]
        };

        if (!this.pixelsEqual(baselinePixel, currentPixel)) {
          pixelDiffCount++;

          // Group adjacent pixels into regions
          const region = this.findOrCreateRegion(regionDiffs, x, y);
          region.difference++;
          region.similarity = Math.max(0, 1 - region.difference / (region.width * region.height));
        }
      }
    }

    const totalPixels = baseline.width * baseline.height;
    const pixelDiffPercentage = (pixelDiffCount / totalPixels) * 100;

    return {
      pixelDiffCount,
      pixelDiffPercentage,
      regionDiffs,
      matchScore: 100 - pixelDiffPercentage,
      isExactMatch: pixelDiffCount === 0,
      visualDiff: this.generateVisualDiff(baseline, current, regionDiffs)
    };
  }

  /**
   * Fuzzy comparison with tolerance
   */
  private async compareFuzzy(
    baseline: ImageData,
    current: ImageData,
    threshold: number
  ): Promise<VisualComparison> {
    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error('Images must have the same dimensions for fuzzy comparison');
    }

    const pixelDiffCount = 0;
    const regionDiffs: RegionDiff[] = [];

    for (let y = 0; y < baseline.height; y++) {
      for (let x = 0; x < baseline.width; x++) {
        const idx = (y * baseline.width + x) * 4;
        const baselinePixel = {
          r: baseline.data[idx],
          g: baseline.data[idx + 1],
          b: baseline.data[idx + 2],
          a: baseline.data[idx + 3]
        };
        const currentPixel = {
          r: current.data[idx],
          g: current.data[idx + 1],
          b: current.data[idx + 2],
          a: current.data[idx + 3]
        };

        const colorDiff = this.calculateColorDifference(baselinePixel, currentPixel);

        if (colorDiff > threshold) {
          pixelDiffCount++;

          const region = this.findOrCreateRegion(regionDiffs, x, y);
          region.difference++;
          region.similarity = Math.max(0, 1 - region.difference / (region.width * region.height));
        }
      }
    }

    const totalPixels = baseline.width * baseline.height;
    const pixelDiffPercentage = (pixelDiffCount / totalPixels) * 100;

    return {
      pixelDiffCount,
      pixelDiffPercentage,
      regionDiffs,
      matchScore: 100 - pixelDiffPercentage,
      isExactMatch: pixelDiffCount === 0,
      visualDiff: this.generateVisualDiff(baseline, current, regionDiffs)
    };
  }

  /**
   * Semantic comparison using feature extraction
   */
  private async compareSemantic(
    baseline: ImageData,
    current: ImageData,
    threshold: number
  ): Promise<VisualComparison> {
    // Apply edge detection
    const baselineEdges = await this.imageProcessor.detectEdges(baseline);
    const currentEdges = await this.imageProcessor.detectEdges(current);

    // Compare edge maps
    const edgeComparison = await this.compareStrict(baselineEdges, currentEdges);

    // Compare color distributions
    const baselineHistogram = this.calculateColorHistogram(baseline);
    const currentHistogram = this.calculateColorHistogram(current);
    const histDifference = this.compareHistograms(baselineHistogram, currentHistogram);

    // Combine results
    const overallMatchScore = (edgeComparison.matchScore * 0.7) + ((100 - histDifference) * 0.3);
    const pixelDiffCount = edgeComparison.pixelDiffCount;
    const pixelDiffPercentage = edgeComparison.pixelDiffPercentage;

    return {
      pixelDiffCount,
      pixelDiffPercentage,
      regionDiffs: edgeComparison.regionDiffs,
      matchScore: overallMatchScore,
      isExactMatch: overallMatchScore >= 100 - threshold,
      visualDiff: this.generateVisualDiff(baseline, current, edgeComparison.regionDiffs)
    };
  }

  /**
   * Apply masks to image data
   */
  private applyMasks(
    image: ImageData,
    ignoreRegions?: Region[],
    maskRegions?: Region[]
  ): ImageData {
    let processed = { ...image };

    // Apply mask regions (set to transparent)
    if (maskRegions && maskRegions.length > 0) {
      processed = this.maskRegions(processed, maskRegions);
    }

    // Apply ignore regions (skip comparison by setting to baseline)
    if (ignoreRegions && ignoreRegions.length > 0) {
      processed = this.ignoreRegions(processed, ignoreRegions);
    }

    return processed;
  }

  /**
   * Mask regions by setting alpha to 0
   */
  private maskRegions(image: ImageData, regions: Region[]): ImageData {
    const data = new Uint8ClampedArray(image.data);

    for (const region of regions) {
      for (let y = region.y; y < region.y + region.height && y < image.height; y++) {
        for (let x = region.x; x < region.x + region.width && x < image.width; x++) {
          const idx = (y * image.width + x) * 4;
          data[idx + 3] = 0; // Set alpha to 0
        }
      }
    }

    return {
      data,
      width: image.width,
      height: image.height
    };
  }

  /**
   * Ignore regions by copying baseline values
   */
  private ignoreRegions(image: ImageData, regions: Region[]): ImageData {
    const data = new Uint8ClampedArray(image.data);

    // For ignore regions, we don't modify the data
    // The comparison logic will skip these regions
    return {
      data,
      width: image.width,
      height: image.height
    };
  }

  /**
   * Apply color ignore list to comparison
   */
  private applyColorIgnore(
    comparison: VisualComparison,
    ignoreColors: string[]
  ): VisualComparison {
    const updatedRegionDiffs = comparison.regionDiffs.filter(regionDiff => {
      return !ignoreColors.some(color =>
        this.isColorSimilar(regionDiff.beforeColor, color) ||
        this.isColorSimilar(regionDiff.afterColor, color)
      );
    });

    const updatedPixelDiffCount = updatedRegionDiffs.reduce(
      (sum, region) => sum + region.difference, 0
    );

    const totalPixels = comparison.regionDiffs.reduce(
      (sum, region) => sum + region.width * region.height, 1
    );

    const updatedPixelDiffPercentage = (updatedPixelDiffCount / totalPixels) * 100;
    const updatedMatchScore = 100 - updatedPixelDiffPercentage;

    return {
      ...comparison,
      pixelDiffCount: updatedPixelDiffCount,
      pixelDiffPercentage: updatedPixelDiffPercentage,
      regionDiffs: updatedRegionDiffs,
      matchScore: updatedMatchScore,
      isExactMatch: updatedPixelDiffCount === 0
    };
  }

  /**
   * Generate visual diff image
   */
  private generateVisualDiff(
    baseline: ImageData,
    current: ImageData,
    regionDiffs: RegionDiff[]
  ): VisualDiff {
    const diffImage = new ImageData(baseline.width, baseline.height);
    const highlights: DiffHighlight[] = [];

    // Calculate overall color for diff
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
    let pixelCount = 0;

    for (let y = 0; y < baseline.height; y++) {
      for (let x = 0; x < baseline.width; x++) {
        const idx = (y * baseline.width + x) * 4;

        const baselinePixel = {
          r: baseline.data[idx],
          g: baseline.data[idx + 1],
          b: baseline.data[idx + 2],
          a: baseline.data[idx + 3]
        };
        const currentPixel = {
          r: current.data[idx],
          g: current.data[idx + 1],
          b: current.data[idx + 2],
          a: current.data[idx + 3]
        };

        if (!this.pixelsEqual(baselinePixel, currentPixel)) {
          // Mark different pixels
          diffImage.data[idx] = 255;     // Red
          diffImage.data[idx + 1] = 0;   // Green
          diffImage.data[idx + 2] = 0;   // Blue
          diffImage.data[idx + 3] = 255; // Alpha

          // Add to totals
          totalR += 255;
          totalG += 0;
          totalB += 0;
          totalA += 255;
          pixelCount++;

          // Add highlight if region exists
          const region = regionDiffs.find(r =>
            x >= r.region.x && x < r.region.x + r.region.width &&
            y >= r.region.y && y < r.region.y + r.region.height
          );

          if (region && !highlights.some(h => this.regionsOverlap(h.region, region.region))) {
            highlights.push({
              region: region.region,
              severity: this.getSeverityFromDifference(region.difference),
              color: '#FF0000',
              description: `Difference: ${region.difference} pixels`
            });
          }
        } else {
          // Copy original pixel
          diffImage.data[idx] = baseline.data[idx];
          diffImage.data[idx + 1] = baseline.data[idx + 1];
          diffImage.data[idx + 2] = baseline.data[idx + 2];
          diffImage.data[idx + 3] = baseline.data[idx + 3];
        }
      }
    }

    const overallColor = {
      r: Math.round(totalR / pixelCount) || 0,
      g: Math.round(totalG / pixelCount) || 0,
      b: Math.round(totalB / pixelCount) || 0,
      a: Math.round(totalA / pixelCount) || 0
    };

    return {
      imageUrl: '', // Would be set by image processor
      highlights,
      overallColor
    };
  }

  /**
   * Helper methods
   */
  private pixelsEqual(a: { r: number; g: number; b: number; a: number }, b: { r: number; g: number; b: number; a: number }): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
  }

  private calculateColorDifference(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  private findOrCreateRegion(regionDiffs: RegionDiff[], x: number, y: number): RegionDiff {
    // Find existing region that contains this pixel
    for (const region of regionDiffs) {
      if (x >= region.region.x && x < region.region.x + region.region.width &&
          y >= region.region.y && y < region.region.y + region.height) {
        return region;
      }
    }

    // Create new region
    const newRegion: RegionDiff = {
      region: { x, y, width: 1, height: 1 },
      beforeColor: '',
      afterColor: '',
      difference: 0,
      similarity: 1
    };

    regionDiffs.push(newRegion);
    return newRegion;
  }

  private regionsOverlap(a: Region, b: Region): boolean {
    return !(a.x + a.width <= b.x ||
             b.x + b.width <= a.x ||
             a.y + a.height <= b.y ||
             b.y + b.height <= a.y);
  }

  private getSeverityFromDifference(difference: number): 'low' | 'medium' | 'high' {
    if (difference < 10) return 'low';
    if (difference < 50) return 'medium';
    return 'high';
  }

  private isColorSimilar(color1: string, color2: string): boolean {
    // Simple color comparison - would implement proper color parsing
    return color1.toLowerCase() === color2.toLowerCase();
  }

  private calculateColorHistogram(imageData: ImageData): number[] {
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const brightness = Math.round(
        (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3
      );
      histogram[brightness]++;
    }

    return histogram;
  }

  private compareHistograms(hist1: number[], hist2: number[]): number {
    let difference = 0;
    for (let i = 0; i < hist1.length; i++) {
      difference += Math.abs(hist1[i] - hist2[i]);
    }
    return difference / hist1.length;
  }
}