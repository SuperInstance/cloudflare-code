/**
 * OCR Recognition Engine
 * Extract text from images using Tesseract OCR with preprocessing and enhancement
 */

// @ts-nocheck - External tesseract.js dependency
import { createWorker } from 'tesseract.js';
import type {
  OCRRecognitionOptions,
  OCRResult,
  OCRLine,
  OCRWord,
  OCRBlock,
  OCRLanguage,
  OCRMetadata,
  BoundingBox
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  language: 'eng' as OCRLanguage,
  preprocess: true,
  enhanceContrast: true,
  denoise: true,
  segmentByLines: true,
  preserveLayout: false
};

// ============================================================================
// Main Recognition Functions
// ============================================================================

/**
 * Main entry point for OCR text recognition
 */
export async function recognizeText(
  options: OCRRecognitionOptions
): Promise<OCRResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_CONFIG, ...options };

  try {
    // Preprocess image if requested
    let image = options.image;
    if (config.preprocess) {
      image = await preprocessImage(image, config);
    }

    // Create Tesseract worker
    const worker = await createWorker({
      logger: (m: { status: string; progress: number }) => {
        // Optional: Log progress
        if (m.status === 'recognizing text') {
          // Progress: m.progress * 100
        }
      }
    });

    // Load language
    await worker.loadLanguage(config.language);
    await worker.initialize(config.language);

    // Set recognition parameters
    await worker.setParameters({
      tessedit_pageseg_mode: config.preserveLayout ? '1' : '6',
      preserve_interword_spaces: '1'
    });

    // Perform recognition
    const { data } = await worker.recognize(image);

    // Terminate worker
    await worker.terminate();

    // Parse and format results
    const result = parseOCRResult(data, config);

    // Add metadata
    result.metadata = {
      engine: 'tesseract',
      language: config.language,
      processingTime: Date.now() - startTime,
      preprocessed: config.preprocess,
      resolution: await getImageResolution(image)
    };

    return result;
  } catch (error) {
    throw new Error(`OCR recognition failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Recognize text with line-by-line segmentation
 */
export async function recognizeTextByLines(
  image: Buffer | string,
  language?: OCRLanguage
): Promise<OCRLine[]> {
  const result = await recognizeText({
    image,
    language: language || 'eng',
    segmentByLines: true,
    preprocess: true
  });

  return result.lines;
}

/**
 * Recognize text with block detection
 */
export async function recognizeTextWithBlocks(
  image: Buffer | string,
  language?: OCRLanguage
): Promise<OCRBlock[]> {
  const result = await recognizeText({
    image,
    language: language || 'eng',
    preprocess: true,
    preserveLayout: true
  });

  return result.blocks || [];
}

/**
 * Recognize code from image (specialized OCR for code)
 */
export async function recognizeCode(
  image: Buffer | string,
  language?: OCRLanguage
): Promise<OCRResult> {
  // Use enhanced preprocessing for code
  const result = await recognizeText({
    image,
    language: language || 'eng',
    preprocess: true,
    enhanceContrast: true,
    denoise: true,
    preserveLayout: true
  });

  // Post-process for code
  result.text = postProcessCodeText(result.text);

  return result;
}

// ============================================================================
// Image Preprocessing
// ============================================================================

/**
 * Preprocess image for better OCR results
 */
async function preprocessImage(
  image: Buffer | string,
  config: OCRRecognitionOptions
): Promise<Buffer> {
  // Note: In a real implementation, you would use sharp or similar library
  // For now, we'll return the original image
  // The actual preprocessing would include:
  // - Grayscale conversion
  // - Contrast enhancement
  // - Noise reduction
  // - Resizing to optimal DPI
  // - Skew correction

  if (typeof image === 'string') {
    // It's a base64 string, convert to buffer
    return Buffer.from(image, 'base64');
  }

  return image;
}

/**
 * Get image resolution
 */
async function getImageResolution(image: Buffer | string): Promise<{ width: number; height: number; dpi: number } | undefined> {
  // Note: In a real implementation, you would use sharp to get image dimensions
  // For now, return undefined
  return undefined;
}

// ============================================================================
// Result Parsing
// ============================================================================

/**
 * Parse Tesseract OCR result
 */
function parseOCRResult(
  data: {
    text: string;
    lines: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number; words: any[] }[];
    blocks?: any[];
  },
  config: OCRRecognitionOptions
): OCRResult {
  const lines: OCRLine[] = data.lines.map(line => ({
    text: line.text.trim(),
    confidence: line.confidence / 100,
    boundingBox: {
      x: line.bbox.x0,
      y: line.bbox.y0,
      width: line.bbox.x1 - line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0
    },
    words: line.words.map((word: any) => ({
      text: word.text,
      confidence: word.confidence / 100,
      boundingBox: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0
      }
    }))
  }));

  const blocks: OCRBlock[] | undefined = data.blocks?.map(block => ({
    type: block.type,
    content: block.text,
    boundingBox: {
      x: block.bbox.x0,
      y: block.bbox.y0,
      width: block.bbox.x1 - block.bbox.x0,
      height: block.bbox.y1 - block.bbox.y0
    },
    confidence: block.confidence / 100
  }));

  // Calculate overall confidence
  const avgLineConfidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;

  return {
    text: data.text,
    confidence: avgLineConfidence,
    lines,
    blocks,
    metadata: {} as OCRMetadata // Will be added by caller
  };
}

/**
 * Post-process text for code
 */
function postProcessCodeText(text: string): string {
  let processed = text;

  // Remove common OCR errors in code
  processed = processed
    .replace(/\s+$/gm, '') // Remove trailing whitespace
    .replace(/\t/g, '  ') // Convert tabs to spaces
    .replace(/\u201C|\u201D/g, '"') // Convert smart quotes
    .replace(/\u2018|\u2019/g, "'") // Convert smart apostrophes
    .replace(/\u2026/g, '...') // Convert ellipsis
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/[^\x00-\x7F]/g, char => {
      // Replace common non-ASCII characters with ASCII equivalents
      const replacements: Record<string, string> = {
        '"': '"',
        "'": "'",
        '\u2014': '-',
        '\u2013': '-'
      };
      return replacements[char] || char;
    });

  return processed;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Recognize text from multiple images
 */
export async function recognizeTextBatch(
  images: (Buffer | string)[],
  options?: OCRRecognitionOptions
): Promise<OCRResult[]> {
  const results = await Promise.all(
    images.map(image => recognizeText({ image, ...options }))
  );

  return results;
}

/**
 * Recognize text from image regions
 */
export async function recognizeTextByRegion(
  image: Buffer | string,
  regions: BoundingBox[],
  options?: OCRRecognitionOptions
): Promise<Map<string, OCRResult>> {
  // Note: In a real implementation, you would crop the image to each region
  // and run OCR on each region separately
  // For now, return a single OCR result for the entire image

  const result = await recognizeText({ image, ...options });

  const resultMap = new Map<string, OCRResult>();
  resultMap.set('full', result);

  return resultMap;
}

// ============================================================================
// Validation and Quality Checks
// ============================================================================

/**
 * Validate OCR result quality
 */
export function validateOCRQuality(result: OCRResult): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check confidence
  if (result.confidence < 0.5) {
    issues.push(`Low confidence score: ${Math.round(result.confidence * 100)}%`);
    suggestions.push('Consider improving image quality or using a different preprocessing method');
  }

  // Check for empty text
  if (!result.text || result.text.trim().length === 0) {
    issues.push('No text was extracted from the image');
    suggestions.push('Verify that the image contains readable text');
  }

  // Check for suspicious patterns
  if (result.text.includes('�') || result.text.includes('')) {
    issues.push('Character encoding issues detected');
    suggestions.push('Try converting the image to a different format or encoding');
  }

  // Check for excessive whitespace
  const whitespaceRatio = (result.text.match(/\s/g) || []).length / result.text.length;
  if (whitespaceRatio > 0.8) {
    issues.push('Excessive whitespace detected in output');
    suggestions.push('The image may be too sparse or have poor contrast');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

/**
 * Compare two OCR results
 */
export function compareOCRResults(
  result1: OCRResult,
  result2: OCRResult
): {
  textSimilarity: number;
  confidenceDifference: number;
  preferred: OCRResult;
} {
  // Calculate text similarity (simple character overlap)
  const set1 = new Set(result1.text.toLowerCase());
  const set2 = new Set(result2.text.toLowerCase());

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const textSimilarity = intersection.size / union.size;

  const confidenceDifference = Math.abs(result1.confidence - result2.confidence);

  const preferred = result1.confidence > result2.confidence ? result1 : result2;

  return {
    textSimilarity,
    confidenceDifference,
    preferred
  };
}

// ============================================================================
// Language Support
// ============================================================================

/**
 * Detect language from text
 */
export async function detectLanguage(text: string): Promise<OCRLanguage> {
  // Simple language detection based on character sets
  const chinesePattern = /[\u4e00-\u9fff]/;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
  const koreanPattern = /[\uac00-\ud7af]/;
  const arabicPattern = /[\u0600-\u06ff]/;
  const cyrillicPattern = /[\u0400-\u04ff]/;
  const greekPattern = /[\u0370-\u03ff]/;

  if (chinesePattern.test(text)) {
    // Could be simplified or traditional
    return 'chi_sim';
  }

  if (japanesePattern.test(text)) {
    return 'jpn';
  }

  if (koreanPattern.test(text)) {
    return 'kor';
  }

  if (arabicPattern.test(text)) {
    return 'ara';
  }

  if (cyrillicPattern.test(text)) {
    return 'rus';
  }

  if (greekPattern.test(text)) {
    return 'deu';
  }

  // Default to English
  return 'eng';
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): OCRLanguage[] {
  return [
    'eng',
    'spa',
    'fra',
    'deu',
    'chi_sim',
    'chi_tra',
    'jpn',
    'kor',
    'ara',
    'rus'
  ];
}

// ============================================================================
// Export and Utility Functions
// ============================================================================

/**
 * Export OCR result to structured format
 */
export function exportOCRResult(result: OCRResult, format: 'json' | 'text' | 'markdown'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);

    case 'text':
      return result.text;

    case 'markdown':
      let markdown = `# OCR Result\n\n`;
      markdown += `**Confidence:** ${Math.round(result.confidence * 100)}%\n\n`;
      markdown += `**Language:** ${result.metadata.language}\n\n`;
      markdown += `## Extracted Text\n\n`;
      markdown += '```\n';
      markdown += result.text;
      markdown += '\n```\n\n';
      markdown += `## Lines (${result.lines.length})\n\n`;
      for (const line of result.lines) {
        markdown += `- ${line.text} (${Math.round(line.confidence * 100)}%)\n`;
      }
      return markdown;

    default:
      return result.text;
  }
}

/**
 * Merge multiple OCR results
 */
export function mergeOCRResults(results: OCRResult[]): OCRResult {
  const mergedText = results.map(r => r.text).join('\n\n');
  const mergedLines = results.flatMap(r => r.lines);

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  return {
    text: mergedText,
    confidence: avgConfidence,
    lines: mergedLines,
    blocks: results.flatMap(r => r.blocks || []),
    metadata: {
      engine: 'tesseract',
      language: results[0].metadata.language,
      processingTime: results.reduce((sum, r) => sum + r.metadata.processingTime, 0),
      preprocessed: results.some(r => r.metadata.preprocessed)
    }
  };
}

/**
 * Filter OCR results by confidence threshold
 */
export function filterByConfidence(
  result: OCRResult,
  threshold: number
): OCRResult {
  const filteredLines = result.lines.filter(line => line.confidence >= threshold);
  const filteredText = filteredLines.map(line => line.text).join('\n');

  return {
    ...result,
    text: filteredText,
    lines: filteredLines,
    confidence: filteredLines.reduce((sum, line) => sum + line.confidence, 0) / filteredLines.length
  };
}
