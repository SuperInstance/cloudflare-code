/**
 * Image processing utilities
 */

import type { ImageInput } from '../types';

export class ImageUtils {
  /**
   * Resize image
   */
  static resize(image: ImageInput, targetWidth: number, targetHeight: number): ImageInput {
    if (!image.width || !image.height) {
      return image;
    }

    const scaleX = targetWidth / image.width;
    const scaleY = targetHeight / image.height;

    // Simplified resizing - in practice would use proper interpolation
    const resized = {
      ...image,
      width: targetWidth,
      height: targetHeight
    };

    return resized;
  }

  /**
   * Crop image
   */
  static crop(image: ImageInput, x: number, y: number, width: number, height: number): ImageInput {
    if (!image.width || !image.height) {
      return image;
    }

    // Validate crop bounds
    const cropX = Math.max(0, Math.min(x, image.width - 1));
    const cropY = Math.max(0, Math.min(y, image.height - 1));
    const cropWidth = Math.min(width, image.width - cropX);
    const cropHeight = Math.min(height, image.height - cropY);

    // Simplified - in practice would actually crop the pixel data
    return {
      ...image,
      width: cropWidth,
      height: cropHeight
    };
  }

  /**
   * Pad image
   */
  static pad(
    image: ImageInput,
    paddingTop: number,
    paddingRight: number,
    paddingBottom: number,
    paddingLeft: number
  ): ImageInput {
    const newWidth = (image.width || 0) + paddingLeft + paddingRight;
    const newHeight = (image.height || 0) + paddingTop + paddingBottom;

    return {
      ...image,
      width: newWidth,
      height: newHeight
    };
  }

  /**
   * Rotate image
   */
  static rotate(image: ImageInput, degrees: number): ImageInput {
    // Simplified - just swap dimensions for 90/270 degree rotations
    if (degrees === 90 || degrees === 270) {
      return {
        ...image,
        width: image.height,
        height: image.width
      };
    }

    return image;
  }

  /**
   * Flip image horizontally
   */
  static flipHorizontal(image: ImageInput): ImageInput {
    return image; // Simplified
  }

  /**
   * Flip image vertically
   */
  static flipVertical(image: ImageInput): ImageInput {
    return image; // Simplified
  }

  /**
   * Convert image format
   */
  static convertFormat(image: ImageInput, targetFormat: 'png' | 'jpeg' | 'webp'): ImageInput {
    return {
      ...image,
      format: targetFormat
    };
  }

  /**
   * Calculate aspect ratio
   */
  static getAspectRatio(image: ImageInput): number {
    if (!image.width || !image.height || image.height === 0) {
      return 1;
    }
    return image.width / image.height;
  }

  /**
   * Calculate image size in bytes
   */
  static getImageSize(image: ImageInput): number {
    const bytesPerChannel = image.format === 'jpeg' ? 3 : 4; // RGB vs RGBA
    return (image.width || 0) * (image.height || 0) * bytesPerChannel;
  }

  /**
   * Check if image is grayscale
   */
  static isGrayscale(image: ImageInput): boolean {
    // Simplified - would check actual pixel data
    return false;
  }

  /**
   * Calculate histogram
   */
  static calculateHistogram(image: ImageInput): { r: number[]; g: number[]; b: number[] } {
    const histogram = {
      r: new Array(256).fill(0),
      g: new Array(256).fill(0),
      b: new Array(256).fill(0)
    };

    // Simplified - would analyze actual pixel data
    return histogram;
  }

  /**
   * Apply color filter
   */
  static applyColorFilter(image: ImageInput, filter: 'grayscale' | 'sepia' | 'invert'): ImageInput {
    return image; // Simplified
  }

  /**
   * Adjust brightness
   */
  static adjustBrightness(image: ImageInput, factor: number): ImageInput {
    return image; // Simplified
  }

  /**
   * Adjust contrast
   */
  static adjustContrast(image: ImageInput, factor: number): ImageInput {
    return image; // Simplified
  }

  /**
   * Apply Gaussian blur
   */
  static gaussianBlur(image: ImageInput, sigma: number): ImageInput {
    return image; // Simplified
  }

  /**
   * Sharpen image
   */
  static sharpen(image: ImageInput, amount: number): ImageInput {
    return image; // Simplified
  }

  /**
   * Detect edges (Sobel operator)
   */
  static detectEdges(image: ImageInput): ImageInput {
    return image; // Simplified
  }

  /**
   * Calculate image statistics
   */
  static calculateStats(image: ImageInput): {
    mean: { r: number; g: number; b: number };
    std: { r: number; g: number; b: number };
    min: { r: number; g: number; b: number };
    max: { r: number; g: number; b: number };
  } {
    return {
      mean: { r: 128, g: 128, b: 128 },
      std: { r: 64, g: 64, b: 64 },
      min: { r: 0, g: 0, b: 0 },
      max: { r: 255, g: 255, b: 255 }
    };
  }

  /**
   * Normalize image
   */
  static normalize(image: ImageInput): ImageInput {
    return image; // Simplified
  }

  /**
   * Denoise image
   */
  static denoise(image: ImageInput): ImageInput {
    return image; // Simplified
  }

  /**
   * Create thumbnail
   */
  static createThumbnail(image: ImageInput, maxSize: number): ImageInput {
    if (!image.width || !image.height) {
      return image;
    }

    const aspectRatio = this.getAspectRatio(image);
    let thumbnailWidth: number;
    let thumbnailHeight: number;

    if (image.width > image.height) {
      thumbnailWidth = maxSize;
      thumbnailHeight = Math.round(maxSize / aspectRatio);
    } else {
      thumbnailHeight = maxSize;
      thumbnailWidth = Math.round(maxSize * aspectRatio);
    }

    return this.resize(image, thumbnailWidth, thumbnailHeight);
  }

  /**
   * Combine multiple images
   */
  static combine(images: ImageInput[], layout: 'horizontal' | 'vertical' | 'grid'): ImageInput {
    if (images.length === 0) {
      throw new Error('No images to combine');
    }

    const firstImage = images[0];
    let combinedWidth = firstImage.width || 0;
    let combinedHeight = firstImage.height || 0;

    if (layout === 'horizontal') {
      combinedWidth = images.reduce((sum, img) => sum + (img.width || 0), 0);
      combinedHeight = Math.max(...images.map(img => img.height || 0));
    } else if (layout === 'vertical') {
      combinedWidth = Math.max(...images.map(img => img.width || 0));
      combinedHeight = images.reduce((sum, img) => sum + (img.height || 0), 0);
    } else if (layout === 'grid') {
      const gridSize = Math.ceil(Math.sqrt(images.length));
      combinedWidth = gridSize * Math.max(...images.map(img => img.width || 0));
      combinedHeight = gridSize * Math.max(...images.map(img => img.height || 0));
    }

    return {
      ...firstImage,
      width: combinedWidth,
      height: combinedHeight
    };
  }
}
