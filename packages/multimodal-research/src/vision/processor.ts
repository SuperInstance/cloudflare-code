/**
 * Image Processing Utilities for Vision Models
 */

// @ts-nocheck
import type { ImageInput, Tensor } from '../types';

export interface ImageProcessorConfig {
  targetSize: number;
  mean?: number[];
  std?: number[];
  normalize: boolean;
  resizeMethod: 'bilinear' | 'bicubic' | 'nearest';
}

export class ImageProcessor {
  private config: ImageProcessorConfig;

  constructor(config?: Partial<ImageProcessorConfig>) {
    this.config = {
      targetSize: 224,
      mean: [0.485, 0.456, 0.406], // ImageNet mean
      std: [0.229, 0.224, 0.225],   // ImageNet std
      normalize: true,
      resizeMethod: 'bilinear',
      ...config
    };
  }

  /**
   * Preprocess image for model input
   */
  async preprocess(image: ImageInput): Promise<Tensor> {
    let data = new Float32Array(await this.toArrayBuffer(image.data));

    // Convert to RGB if needed
    data = this.ensureRGB(data);

    // Resize to target size
    data = this.resize(data, image.width || 224, image.height || 224, this.config.targetSize);

    // Normalize
    if (this.config.normalize) {
      data = this.normalize(data);
    }

    // Convert to CHW format (Channels, Height, Width)
    data = this.toCHW(data);

    return {
      data,
      shape: [3, this.config.targetSize, this.config.targetSize],
      dtype: 'float32'
    };
  }

  /**
   * Convert various input formats to ArrayBuffer
   */
  private async toArrayBuffer(data: Uint8Array | ArrayBuffer): Promise<ArrayBuffer> {
    if (data instanceof ArrayBuffer) {
      return data;
    }
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  /**
   * Ensure image is in RGB format
   */
  private ensureRGB(data: Float32Array): Float32Array {
    // Assume RGBA, convert to RGB
    const rgb = new Float32Array((data.length / 4) * 3);
    for (let i = 0; i < data.length / 4; i++) {
      rgb[i * 3] = data[i * 4];
      rgb[i * 3 + 1] = data[i * 4 + 1];
      rgb[i * 3 + 2] = data[i * 4 + 2];
    }
    return rgb;
  }

  /**
   * Resize image to target size
   */
  private resize(data: Float32Array, width: number, height: number, targetSize: number): Float32Array {
    if (width === targetSize && height === targetSize) {
      return data;
    }

    const scaleX = width / targetSize;
    const scaleY = height / targetSize;
    const resized = new Float32Array(targetSize * targetSize * 3);

    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);

        for (let c = 0; c < 3; c++) {
          resized[(y * targetSize + x) * 3 + c] =
            data[(srcY * width + srcX) * 3 + c];
        }
      }
    }

    return resized;
  }

  /**
   * Normalize image with mean and std
   */
  private normalize(data: Float32Array): Float32Array {
    const normalized = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      const channel = i % 3;
      normalized[i] = (data[i] / 255 - this.config.mean![channel]) / this.config.std![channel];
    }

    return normalized;
  }

  /**
   * Convert from HWC to CHW format
   */
  private toCHW(data: Float32Array): Float32Array {
    const size = this.config.targetSize;
    const chw = new Float32Array(data.length);

    for (let c = 0; c < 3; c++) {
      for (let h = 0; h < size; h++) {
        for (let w = 0; w < size; w++) {
          chw[c * size * size + h * size + w] = data[(h * size + w) * 3 + c];
        }
      }
    }

    return chw;
  }

  /**
   * Apply data augmentation
   */
  async augment(image: ImageInput, augmentations: string[]): Promise<ImageInput> {
    let processed = { ...image };

    for (const aug of augmentations) {
      switch (aug) {
        case 'horizontal_flip':
          processed = this.horizontalFlip(processed);
          break;
        case 'vertical_flip':
          processed = this.verticalFlip(processed);
          break;
        case 'rotate_90':
          processed = this.rotate90(processed);
          break;
        case 'random_crop':
          processed = this.randomCrop(processed);
          break;
        case 'color_jitter':
          processed = this.colorJitter(processed);
          break;
      }
    }

    return processed;
  }

  private horizontalFlip(image: ImageInput): ImageInput {
    const data = new Float32Array(image.data as ArrayBuffer);
    const width = image.width || 224;
    const height = image.height || 224;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width / 2; x++) {
        const leftIdx = (y * width + x) * 3;
        const rightIdx = (y * width + (width - 1 - x)) * 3;

        for (let c = 0; c < 3; c++) {
          const temp = data[leftIdx + c];
          data[leftIdx + c] = data[rightIdx + c];
          data[rightIdx + c] = temp;
        }
      }
    }

    return { ...image, data: data.buffer };
  }

  private verticalFlip(image: ImageInput): ImageInput {
    const data = new Float32Array(image.data as ArrayBuffer);
    const width = image.width || 224;
    const height = image.height || 224;

    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width; x++) {
        const topIdx = (y * width + x) * 3;
        const bottomIdx = ((height - 1 - y) * width + x) * 3;

        for (let c = 0; c < 3; c++) {
          const temp = data[topIdx + c];
          data[topIdx + c] = data[bottomIdx + c];
          data[bottomIdx + c] = temp;
        }
      }
    }

    return { ...image, data: data.buffer };
  }

  private rotate90(image: ImageInput): ImageInput {
    const width = image.width || 224;
    const height = image.height || 224;
    const data = new Float32Array(image.data as ArrayBuffer);
    const rotated = new Float32Array(data.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          rotated[(x * height + (height - 1 - y)) * 3 + c] = data[(y * width + x) * 3 + c];
        }
      }
    }

    return { ...image, data: rotated.buffer, width: height, height: width };
  }

  private randomCrop(image: ImageInput): ImageInput {
    const cropSize = Math.floor((image.width || 224) * 0.8);
    const maxX = (image.width || 224) - cropSize;
    const maxY = (image.height || 224) - cropSize;
    const startX = Math.floor(Math.random() * maxX);
    const startY = Math.floor(Math.random() * maxY);

    const data = new Float32Array(image.data as ArrayBuffer);
    const cropped = new Float32Array(cropSize * cropSize * 3);
    const width = image.width || 224;

    for (let y = 0; y < cropSize; y++) {
      for (let x = 0; x < cropSize; x++) {
        for (let c = 0; c < 3; c++) {
          cropped[(y * cropSize + x) * 3 + c] =
            data[((startY + y) * width + (startX + x)) * 3 + c];
        }
      }
    }

    return { ...image, data: cropped.buffer, width: cropSize, height: cropSize };
  }

  private colorJitter(image: ImageInput): ImageInput {
    const brightness = 0.8 + Math.random() * 0.4;
    const contrast = 0.8 + Math.random() * 0.4;
    const saturation = 0.8 + Math.random() * 0.4;

    const data = new Float32Array(image.data as ArrayBuffer);
    const jittered = new Float32Array(data.length);

    for (let i = 0; i < data.length; i += 3) {
      // Apply brightness
      for (let c = 0; c < 3; c++) {
        jittered[i + c] = data[i + c] * brightness;
      }

      // Apply contrast
      const mean = (jittered[i] + jittered[i + 1] + jittered[i + 2]) / 3;
      for (let c = 0; c < 3; c++) {
        jittered[i + c] = (jittered[i + c] - mean) * contrast + mean;
      }

      // Apply saturation
      const gray = 0.299 * jittered[i] + 0.587 * jittered[i + 1] + 0.114 * jittered[i + 2];
      for (let c = 0; c < 3; c++) {
        jittered[i + c] = gray + (jittered[i + c] - gray) * saturation;
      }

      // Clip to valid range
      for (let c = 0; c < 3; c++) {
        jittered[i + c] = Math.max(0, Math.min(255, jittered[i + c]));
      }
    }

    return { ...image, data: jittered.buffer };
  }

  /**
   * Extract patches for vision transformers
   */
  extractPatches(image: ImageInput, patchSize: number): Float32Array[] {
    const width = image.width || 224;
    const height = image.height || 224;
    const data = new Float32Array(image.data as ArrayBuffer);

    const patches: Float32Array[] = [];
    const numPatchesX = Math.ceil(width / patchSize);
    const numPatchesY = Math.ceil(height / patchSize);

    for (let y = 0; y < numPatchesY; y++) {
      for (let x = 0; x < numPatchesX; x++) {
        const patch = new Float32Array(patchSize * patchSize * 3);

        for (let py = 0; py < patchSize; py++) {
          for (let px = 0; px < patchSize; px++) {
            const imgX = x * patchSize + px;
            const imgY = y * patchSize + py;

            if (imgX < width && imgY < height) {
              for (let c = 0; c < 3; c++) {
                patch[(py * patchSize + px) * 3 + c] = data[(imgY * width + imgX) * 3 + c];
              }
            }
          }
        }

        patches.push(patch);
      }
    }

    return patches;
  }
}
