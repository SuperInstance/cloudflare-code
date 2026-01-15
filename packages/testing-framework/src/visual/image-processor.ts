/**
 * Image Processor
 * Provides image manipulation and processing utilities for visual regression testing
 */

export class ImageProcessor {
  /**
   * Load an image from URL or file path
   */
  async loadImage(imageUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${imageUrl}`));
      };

      img.src = imageUrl;
    });
  }

  /**
   * Save ImageData to file
   */
  async saveImage(imageData: ImageData, filename: string): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    // Create object URL
    return URL.createObjectURL(blob);
  }

  /**
   * Detect edges using Canny edge detection
   */
  async detectEdges(imageData: ImageData): Promise<ImageData> {
    const gray = this.convertToGrayscale(imageData);
    const blurred = this.applyGaussianBlur(gray);
    const edges = this.calculateSobel(blurred);
    const nonMax = this.nonMaxSuppression(edges);
    const thresholded = this.applyThreshold(nonMax);

    return thresholded;
  }

  /**
   * Convert image to grayscale
   */
  private convertToGrayscale(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data.length);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray = Math.round(
        0.299 * imageData.data[i] +
        0.587 * imageData.data[i + 1] +
        0.114 * imageData.data[i + 2]
      );

      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = imageData.data[i + 3];
    }

    return {
      data,
      width: imageData.width,
      height: imageData.height
    };
  }

  /**
   * Apply Gaussian blur
   */
  private applyGaussianBlur(imageData: ImageData): ImageData {
    const kernel = [
      [1/16, 2/16, 1/16],
      [2/16, 4/16, 2/16],
      [1/16, 2/16, 1/16]
    ];

    return this.applyConvolution(imageData, kernel);
  }

  /**
   * Calculate Sobel gradients
   */
  private calculateSobel(imageData: ImageData): { x: ImageData; y: ImageData; magnitude: ImageData } {
    const sobelX = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1]
    ];

    const sobelY = [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1]
    ];

    const x = this.applyConvolution(imageData, sobelX);
    const y = this.applyConvolution(imageData, sobelY);

    const magnitudeData = new Uint8ClampedArray(imageData.data.length);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const mag = Math.sqrt(
        x.data[i] * x.data[i] + y.data[i] * y.data[i]
      );

      magnitudeData[i] = mag;
      magnitudeData[i + 1] = mag;
      magnitudeData[i + 2] = mag;
      magnitudeData[i + 3] = imageData.data[i + 3];
    }

    return {
      x,
      y,
      magnitude: {
        data: magnitudeData,
        width: imageData.width,
        height: imageData.height
      }
    };
  }

  /**
   * Apply convolution kernel
   */
  private applyConvolution(imageData: ImageData, kernel: number[][]): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;

        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const pixelX = x + kx - half;
            const pixelY = y + ky - half;

            if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
              const idx = (pixelY * width + pixelX) * 4;
              sum += imageData.data[idx] * kernel[ky][kx];
            }
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.max(0, sum));
        data[idx + 1] = data[idx];
        data[idx + 2] = data[idx];
        data[idx + 3] = imageData.data[idx + 3];
      }
    }

    return {
      data,
      width,
      height
    };
  }

  /**
   * Non-maximum suppression
   */
  private nonMaxSuppression(sobelResult: { x: ImageData; y: ImageData; magnitude: ImageData }): ImageData {
    const data = new Uint8ClampedArray(sobelResult.magnitude.data.length);
    const width = sobelResult.magnitude.width;
    const height = sobelResult.magnitude.height;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const mag = sobelResult.magnitude.data[idx];

        if (mag === 0) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }

        // Calculate gradient direction
        const gx = sobelResult.x.data[idx];
        const gy = sobelResult.y.data[idx];
        const angle = Math.atan2(gy, gx) * 180 / Math.PI;

        // Normalize to 0-180 degrees
        const normalizedAngle = angle < 0 ? angle + 180 : angle;

        // Find neighboring pixels in gradient direction
        let neighbor1 = 0, neighbor2 = 0;

        if ((normalizedAngle >= 0 && normalizedAngle < 22.5) ||
            (normalizedAngle >= 157.5 && normalizedAngle <= 180)) {
          // Horizontal
          neighbor1 = (y * width + (x - 1)) * 4;
          neighbor2 = (y * width + (x + 1)) * 4;
        } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
          // 45 degrees
          neighbor1 = ((y - 1) * width + (x + 1)) * 4;
          neighbor2 = ((y + 1) * width + (x - 1)) * 4;
        } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
          // Vertical
          neighbor1 = ((y - 1) * width + x) * 4;
          neighbor2 = ((y + 1) * width + x) * 4;
        } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
          // 135 degrees
          neighbor1 = ((y - 1) * width + (x - 1)) * 4;
          neighbor2 = ((y + 1) * width + (x + 1)) * 4;
        }

        // Suppress non-maximum
        if (mag >= sobelResult.magnitude.data[neighbor1] &&
            mag >= sobelResult.magnitude.data[neighbor2]) {
          data[idx] = mag;
          data[idx + 1] = mag;
          data[idx + 2] = mag;
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        }

        data[idx + 3] = 255;
      }
    }

    return {
      data,
      width,
      height
    };
  }

  /**
   * Apply double threshold
   */
  private applyThreshold(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const highThreshold = 50;
    const lowThreshold = 10;

    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = imageData.data[i];

      if (value >= highThreshold) {
        // Strong edge
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else if (value >= lowThreshold) {
        // Weak edge
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
      } else {
        // Non-edge
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }

      data[i + 3] = 255;
    }

    return {
      data,
      width: imageData.width,
      height: imageData.height
    };
  }

  /**
   * Resize image
   */
  async resizeImage(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): Promise<ImageData> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.putImageData(imageData, 0, 0);

    // Create temporary canvas for resize
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Could not get temp canvas context');
    }

    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;

    // Draw resized image
    tempCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    return tempCtx.getImageData(0, 0, targetWidth, targetHeight);
  }

  /**
   * Crop image to region
   */
  cropImage(imageData: ImageData, region: {
    x: number;
    y: number;
    width: number;
    height: number
  }): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = region.width;
    canvas.height = region.height;

    // Create full image canvas
    const fullCanvas = document.createElement('canvas');
    const fullCtx = fullCanvas.getContext('2d');

    if (!fullCtx) {
      throw new Error('Could not get full canvas context');
    }

    fullCanvas.width = imageData.width;
    fullCanvas.height = imageData.height;
    fullCtx.putImageData(imageData, 0, 0);

    // Crop to region
    ctx.drawImage(
      fullCanvas,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    return ctx.getImageData(0, 0, region.width, region.height);
  }

  /**
   * Apply color threshold
   */
  applyColorThreshold(imageData: ImageData, threshold: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = imageData.data[i];
      const thresholded = value > threshold ? 255 : 0;

      data[i] = thresholded;
      data[i + 1] = thresholded;
      data[i + 2] = thresholded;
      data[i + 3] = imageData.data[i + 3];
    }

    return {
      data,
      width: imageData.width,
      height: imageData.height
    };
  }

  /**
   * Calculate image hash (perceptual hash)
   */
  async calculateHash(imageData: ImageData): Promise<string> {
    // Convert to grayscale
    const gray = this.convertToGrayscale(imageData);

    // Downsample to 8x8
    const small = await this.resizeImage(gray, 8, 8);

    // Calculate average pixel value
    let sum = 0;
    for (let i = 0; i < small.data.length; i += 4) {
      sum += small.data[i];
    }
    const average = sum / (small.data.length / 4);

    // Generate hash
    let hash = '';
    for (let i = 0; i < small.data.length; i += 4) {
      hash += small.data[i] > average ? '1' : '0';
    }

    return hash;
  }

  /**
   * Compare image hashes
   */
  compareHashes(hash1: string, hash2: string): number {
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }
    return 1 - (differences / hash1.length);
  }

  /**
   * Detect dominant colors
   */
  detectDominantColors(imageData: ImageData, count: number = 5): string[] {
    // Simplified color detection
    // In a real implementation, this would use k-means clustering
    const colors: string[] = [];

    // Simple approach: sample pixels and group similar colors
    const colorMap = new Map<string, number>();

    // Sample every 10th pixel
    for (let i = 0; i < imageData.data.length; i += 40) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      // Quantize colors
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;

      const colorKey = `${qr},${qg},${qb}`;
      colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
    }

    // Sort by frequency and get top colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([color]) => `rgb(${color})`);

    return sortedColors;
  }
}