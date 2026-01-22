/**
 * Image Processing Utilities
 * Helper functions for image manipulation and validation
 */

import type { ImageResolution, BoundingBox } from '../types';

// ============================================================================
// Image Validation
// ============================================================================

/**
 * Validate if buffer is a valid image
 */
export function isValidImage(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    return false;
  }

  // Check for known image signatures
  const validSignatures = [
    { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], format: 'PNG' },
    { signature: [0xFF, 0xD8, 0xFF], format: 'JPEG' },
    { signature: [0x47, 0x49, 0x46, 0x38], format: 'GIF' },
    { signature: [0x52, 0x49, 0x46, 0x46], format: 'WEBP' },
    { signature: [0x42, 0x4D], format: 'BMP' }
  ];

  return validSignatures.some(({ signature }) => {
    if (buffer.length < signature.length) return false;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }
    return true;
  });
}

/**
 * Detect image format from buffer
 */
export function detectImageFormat(buffer: Buffer): string | null {
  const formatSignatures: Record<string, number[]> = {
    'PNG': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'JPEG': [0xFF, 0xD8, 0xFF],
    'GIF': [0x47, 0x49, 0x46, 0x38],
    'WEBP': [0x52, 0x49, 0x46, 0x46],
    'BMP': [0x42, 0x4D]
  };

  for (const [format, signature] of Object.entries(formatSignatures)) {
    if (buffer.length >= signature.length) {
      let match = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          match = false;
          break;
        }
      }
      if (match) return format;
    }
  }

  return null;
}

/**
 * Get MIME type from image format
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    'PNG': 'image/png',
    'JPEG': 'image/jpeg',
    'JPG': 'image/jpeg',
    'GIF': 'image/gif',
    'WEBP': 'image/webp',
    'BMP': 'image/bmp'
  };

  return mimeTypes[format.toUpperCase()] || 'image/png';
}

/**
 * Get image dimensions from buffer (basic implementation)
 */
export function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  const format = detectImageFormat(buffer);

  switch (format) {
    case 'PNG':
      return getPNGDimensions(buffer);
    case 'JPEG':
      return getJPEGDimensions(buffer);
    case 'GIF':
      return getGIFDimensions(buffer);
    default:
      return null;
  }
}

/**
 * Get PNG dimensions
 */
function getPNGDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG dimensions are at bytes 16-24 (IHDR chunk)
  if (buffer.length < 24) return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

/**
 * Get JPEG dimensions
 */
function getJPEGDimensions(buffer: Buffer): { width: number; height: number } | null {
  // JPEG dimensions are in SOF markers
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) return null;

    const marker = buffer[i + 1];
    const length = buffer.readUInt16BE(i + 2);

    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      return { width, height };
    }

    i += 2 + length;
  }

  return null;
}

/**
 * Get GIF dimensions
 */
function getGIFDimensions(buffer: Buffer): { width: number; height: number } | null {
  // GIF dimensions are at bytes 6-9
  if (buffer.length < 10) return null;

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);

  return { width, height };
}

// ============================================================================
// Image Conversion
// ============================================================================

/**
 * Convert buffer to base64
 */
export function bufferToBase64(buffer: Buffer, mimeType?: string): string {
  const format = detectImageFormat(buffer);
  const type = mimeType || (format ? getMimeType(format) : 'image/png');
  return `data:${type};base64,${buffer.toString('base64')}`;
}

/**
 * Convert base64 to buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return Buffer.from(matches[2], 'base64');
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Resize image (placeholder for actual implementation)
 */
export async function resizeImage(
  buffer: Buffer,
  maxWidth: number,
  maxHeight: number
): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

/**
 * Compress image (placeholder for actual implementation)
 */
export async function compressImage(
  buffer: Buffer,
  quality: number = 0.8
): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

/**
 * Convert image to grayscale (placeholder for actual implementation)
 */
export async function convertToGrayscale(buffer: Buffer): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

/**
 * Enhance image contrast (placeholder for actual implementation)
 */
export async function enhanceContrast(
  buffer: Buffer,
  factor: number = 1.5
): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

/**
 * Denoise image (placeholder for actual implementation)
 */
export async function denoiseImage(buffer: Buffer): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

/**
 * Rotate image (placeholder for actual implementation)
 */
export async function rotateImage(
  buffer: Buffer,
  degrees: number
): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

/**
 * Crop image to bounding box (placeholder for actual implementation)
 */
export async function cropImage(
  buffer: Buffer,
  bbox: BoundingBox
): Promise<Buffer> {
  // In a real implementation, you would use sharp or similar library
  // For now, return the original buffer
  return buffer;
}

// ============================================================================
// Image Analysis
// ============================================================================

/**
 * Calculate image aspect ratio
 */
export function getAspectRatio(buffer: Buffer): number | null {
  const dimensions = getImageDimensions(buffer);
  if (!dimensions) return null;

  return dimensions.width / dimensions.height;
}

/**
 * Calculate image size in bytes
 */
export function getImageSize(buffer: Buffer): number {
  return buffer.length;
}

/**
 * Calculate image size in human-readable format
 */
export function getHumanReadableSize(buffer: Buffer): string {
  const bytes = getImageSize(buffer);
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Calculate image DPI estimate
 */
export function estimateDPI(buffer: Buffer): number | null {
  const dimensions = getImageDimensions(buffer);
  if (!dimensions) return null;

  // Estimate based on file size and dimensions
  const bytesPerPixel = buffer.length / (dimensions.width * dimensions.height);

  // Very rough estimation
  if (bytesPerPixel > 3) return 300;
  if (bytesPerPixel > 2) return 200;
  if (bytesPerPixel > 1) return 150;
  return 72;
}

/**
 * Get image resolution
 */
export function getResolution(buffer: Buffer): ImageResolution | null {
  const dimensions = getImageDimensions(buffer);
  if (!dimensions) return null;

  return {
    width: dimensions.width,
    height: dimensions.height,
    dpi: estimateDPI(buffer) || 72
  };
}

// ============================================================================
// Image Quality Assessment
// ============================================================================

/**
 * Assess image quality score
 */
export function assessQuality(buffer: Buffer): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const dimensions = getImageDimensions(buffer);
  if (!dimensions) {
    issues.push('Unable to read image dimensions');
    return { score: 0, issues, suggestions: ['Try a different image format'] };
  }

  // Check resolution
  if (dimensions.width < 800 || dimensions.height < 600) {
    issues.push('Low resolution image');
    suggestions.push('Use an image with at least 800x600 resolution for best results');
    score -= 20;
  }

  // Check file size
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB < 0.01) {
    issues.push('Very small file size - may be heavily compressed');
    suggestions.push('Use a higher quality image');
    score -= 10;
  }

  // Check aspect ratio
  const aspectRatio = dimensions.width / dimensions.height;
  if (aspectRatio < 0.5 || aspectRatio > 2) {
    issues.push('Unusual aspect ratio');
    suggestions.push('Ensure image is properly oriented');
    score -= 10;
  }

  return { score, issues, suggestions };
}

/**
 * Check if image is suitable for OCR
 */
export function isSuitableForOCR(buffer: Buffer): {
  suitable: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let suitable = true;

  const dimensions = getImageDimensions(buffer);
  if (!dimensions) {
    reasons.push('Unable to read image dimensions');
    suitable = false;
  } else {
    if (dimensions.width < 300) {
      reasons.push('Image width is too small for OCR');
      suitable = false;
    }

    if (dimensions.height < 100) {
      reasons.push('Image height is too small for OCR');
      suitable = false;
    }
  }

  const format = detectImageFormat(buffer);
  if (format === 'GIF') {
    reasons.push('GIF format is not ideal for OCR');
    suitable = false;
  }

  return { suitable, reasons };
}

// ============================================================================
// Image Preprocessing Pipeline
// ============================================================================

/**
 * Apply preprocessing pipeline for OCR
 */
export async function preprocessForOCR(buffer: Buffer): Promise<Buffer> {
  let processed = buffer;

  // Convert to grayscale
  processed = await convertToGrayscale(processed);

  // Enhance contrast
  processed = await enhanceContrast(processed, 1.5);

  // Denoise
  processed = await denoiseImage(processed);

  return processed;
}

/**
 * Apply preprocessing pipeline for vision models
 */
export async function preprocessForVision(buffer: Buffer): Promise<Buffer> {
  let processed = buffer;

  // Resize if too large
  const dimensions = getImageDimensions(processed);
  if (dimensions && (dimensions.width > 4096 || dimensions.height > 4096)) {
    processed = await resizeImage(processed, 2048, 2048);
  }

  return processed;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate percentage position to pixels
 */
export function percentageToPixels(
  percentage: number,
  dimension: number
): number {
  return Math.round((percentage / 100) * dimension);
}

/**
 * Calculate pixels to percentage
 */
export function pixelsToPercentage(
  pixels: number,
  dimension: number
): number {
  return (pixels / dimension) * 100;
}

/**
 * Scale bounding box
 */
export function scaleBoundingBox(
  bbox: BoundingBox,
  scaleX: number,
  scaleY: number
): BoundingBox {
  return {
    x: bbox.x * scaleX,
    y: bbox.y * scaleY,
    width: bbox.width * scaleX,
    height: bbox.height * scaleY
  };
}

/**
 * Convert bounding box from percentage to pixels
 */
export function bboxToPixels(
  bbox: BoundingBox,
  imageWidth: number,
  imageHeight: number
): BoundingBox {
  return {
    x: percentageToPixels(bbox.x, imageWidth),
    y: percentageToPixels(bbox.y, imageHeight),
    width: percentageToPixels(bbox.width, imageWidth),
    height: percentageToPixels(bbox.height, imageHeight)
  };
}

/**
 * Convert bounding box from pixels to percentage
 */
export function bboxToPercentage(
  bbox: BoundingBox,
  imageWidth: number,
  imageHeight: number
): BoundingBox {
  return {
    x: pixelsToPercentage(bbox.x, imageWidth),
    y: pixelsToPercentage(bbox.y, imageHeight),
    width: pixelsToPercentage(bbox.width, imageWidth),
    height: pixelsToPercentage(bbox.height, imageHeight)
  };
}
