/**
 * Vision Module Exports
 * Image analysis, code extraction, diagram understanding, and visual debugging
 */

export {
  analyzeImage,
  analyzeScreenshot,
  analyzeErrorScreenshot,
  analyzeUIMockup,
  analyzeAccessibility,
  extractUIElements,
  extractText,
  extractColors,
  extractLayout,
  extractErrors,
  validateImageBuffer
} from './analyzers';

export {
  extractCodeFromImage,
  extractCodeFromImages,
  extractCodeWithValidation,
  extractCodeFromWhiteboard,
  extractCodeFromPDF,
  detectLanguage,
  extractCodeBlocks,
  formatExtractedCode
} from './code-extract';

export {
  analyzeDiagram,
  generateCodeFromDiagram,
  analyzeArchitectureDiagram,
  analyzeFlowchart,
  analyzeSequenceDiagram,
  analyzeERDiagram,
  exportToMermaid,
  exportToPlantUML
} from './diagram';

export {
  debugVisualIssue,
  analyzeErrorWithStack,
  generateReproductionGuide,
  suggestFixes,
  debugAccessibility,
  debugLayout,
  compareScreenshots,
  categorizeIssue,
  prioritizeFixes,
  estimateFixComplexity
} from './visual-debugging';
