/**
 * OCR Module Exports
 * Text recognition and code extraction from images
 */

export {
  recognizeText,
  recognizeTextByLines,
  recognizeTextWithBlocks,
  recognizeCode,
  recognizeTextBatch,
  recognizeTextByRegion,
  validateOCRQuality,
  compareOCRResults,
  detectLanguage,
  getSupportedLanguages,
  exportOCRResult,
  mergeOCRResults,
  filterByConfidence
} from './recognizer';
