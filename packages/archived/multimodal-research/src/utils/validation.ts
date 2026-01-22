/**
 * Validation utilities
 */

// @ts-nocheck
import type { ImageInput, AudioInput, TextInput } from '../types';

export class ValidationUtils {
  /**
   * Validate image input
   */
  static validateImageInput(image: ImageInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!image.data) {
      errors.push('Image data is required');
    }

    if (image.format && !['png', 'jpeg', 'webp', 'gif'].includes(image.format)) {
      errors.push(`Invalid image format: ${image.format}`);
    }

    if (image.width && image.width <= 0) {
      errors.push('Image width must be positive');
    }

    if (image.height && image.height <= 0) {
      errors.push('Image height must be positive');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate audio input
   */
  static validateAudioInput(audio: AudioInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!audio.data) {
      errors.push('Audio data is required');
    }

    if (!audio.sampleRate || audio.sampleRate <= 0) {
      errors.push('Sample rate must be positive');
    }

    if (audio.channels && audio.channels <= 0) {
      errors.push('Number of channels must be positive');
    }

    if (audio.duration && audio.duration <= 0) {
      errors.push('Duration must be positive');
    }

    if (audio.format && !['wav', 'mp3', 'ogg', 'flac'].includes(audio.format)) {
      errors.push(`Invalid audio format: ${audio.format}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate text input
   */
  static validateTextInput(text: TextInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!text.text || text.text.trim().length === 0) {
      errors.push('Text content is required');
    }

    if (text.text.length > 100000) {
      errors.push('Text is too long (>100000 characters)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate embedding dimensions
   */
  static validateEmbedding(embedding: Float32Array, expectedDim: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!embedding || embedding.length === 0) {
      errors.push('Embedding is empty');
    }

    if (embedding.length !== expectedDim) {
      errors.push(`Embedding dimension mismatch: expected ${expectedDim}, got ${embedding.length}`);
    }

    // Check for NaN or Inf values
    for (let i = 0; i < embedding.length; i++) {
      if (!Number.isFinite(embedding[i])) {
        errors.push(`Invalid value at index ${i}: ${embedding[i]}`);
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate batch dimensions
   */
  static validateBatch(batch: unknown[], batchSize: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!batch || batch.length === 0) {
      errors.push('Batch is empty');
    }

    if (batch.length > batchSize) {
      errors.push(`Batch size exceeds maximum: ${batch.length} > ${batchSize}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate model config
   */
  static validateModelConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.architecture) {
      errors.push('Model architecture is required');
    }

    if (config.parameters && typeof config.parameters !== 'object') {
      errors.push('Model parameters must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate training config
   */
  static validateTrainingConfig(config: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.epochs !== undefined && (config.epochs <= 0 || config.epochs > 1000)) {
      errors.push('Epochs must be between 1 and 1000');
    }

    if (config.batchSize !== undefined && (config.batchSize <= 0 || config.batchSize > 10000)) {
      errors.push('Batch size must be between 1 and 10000');
    }

    if (config.learningRate !== undefined && (config.learningRate <= 0 || config.learningRate > 1)) {
      errors.push('Learning rate must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for NaN values
   */
  static hasNaN(tensor: Float32Array): boolean {
    for (let i = 0; i < tensor.length; i++) {
      if (Number.isNaN(tensor[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for Inf values
   */
  static hasInf(tensor: Float32Array): boolean {
    for (let i = 0; i < tensor.length; i++) {
      if (!Number.isFinite(tensor[i]) && !Number.isNaN(tensor[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check tensor for numerical issues
   */
  static checkTensor(tensor: Float32Array): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.hasNaN(tensor)) {
      errors.push('Tensor contains NaN values');
    }

    if (this.hasInf(tensor)) {
      errors.push('Tensor contains Inf values');
    }

    const maxVal = Math.max(...tensor);
    const minVal = Math.min(...tensor);

    if (Math.abs(maxVal) > 1e10) {
      errors.push(`Tensor values too large: max = ${maxVal}`);
    }

    if (Math.abs(minVal) > 1e10) {
      errors.push(`Tensor values too large: min = ${minVal}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file path
   */
  static validateFilePath(path: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!path || path.trim().length === 0) {
      errors.push('File path is empty');
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/g;
    if (invalidChars.test(path)) {
      errors.push('File path contains invalid characters');
    }

    // Check for path traversal attempts
    if (path.includes('..')) {
      errors.push('File path contains path traversal attempt');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate hyperparameters
   */
  static validateHyperparameters(params: Record<string, number>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (!Number.isFinite(value)) {
        errors.push(`Hyperparameter ${key} is not finite: ${value}`);
      }

      if (value < 0) {
        errors.push(`Hyperparameter ${key} is negative: ${value}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate metrics
   */
  static validateMetrics(metrics: Record<string, number>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(metrics)) {
      if (!Number.isFinite(value)) {
        errors.push(`Metric ${key} is not finite: ${value}`);
      }

      if (value < 0 || value > 1) {
        errors.push(`Metric ${key} is out of [0, 1] range: ${value}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate checkpoint path
   */
  static validateCheckpoint(path: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const filePathValidation = this.validateFilePath(path);
    if (!filePathValidation.valid) {
      errors.push(...filePathValidation.errors);
    }

    // Check file extension
    const validExtensions = ['.pt', '.pth', '.ckpt', '.bin', '.safetensors'];
    const hasValidExtension = validExtensions.some(ext => path.endsWith(ext));

    if (!hasValidExtension) {
      errors.push(`Invalid checkpoint extension. Valid extensions: ${validExtensions.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
