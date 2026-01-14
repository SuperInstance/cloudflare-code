/**
 * Code Extraction from Images
 * Extract code from screenshots, whiteboards, and other visual sources
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  CodeExtractionOptions,
  CodeExtraction,
  CodeLanguage,
  DetectedElement,
  LineRange,
  VisionProvider,
  CodeExtractionMetadata
} from '../types';
import { recognizeText } from '../ocr/recognizer';

// ============================================================================
// Configuration
// ============================================================================

const LANGUAGE_KEYWORDS: Record<CodeLanguage, string[]> = {
  javascript: ['function', 'const', 'let', 'var', '=>', 'import', 'export', 'class', 'async', 'await'],
  typescript: ['interface', 'type', 'enum', 'namespace', 'implements', 'private', 'public', 'protected'],
  python: ['def', 'class', 'import', 'from', 'async', 'await', 'lambda', 'yield', 'with'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'package'],
  cpp: ['#include', 'using', 'namespace', 'class', 'public', 'private', 'template', 'typename'],
  csharp: ['using', 'namespace', 'class', 'public', 'private', 'protected', 'override', 'virtual'],
  go: ['package', 'import', 'func', 'type', 'struct', 'interface', 'go', 'chan', 'select'],
  rust: ['fn', 'let', 'mut', 'pub', 'struct', 'enum', 'impl', 'trait', 'use', 'mod'],
  php: ['<?php', 'function', 'class', 'public', 'private', 'protected', 'namespace', 'use'],
  ruby: ['def', 'class', 'module', 'require', 'include', 'attr_reader', 'attr_writer'],
  swift: ['func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension', 'import'],
  kotlin: ['fun', 'val', 'var', 'class', 'interface', 'object', 'companion', 'data class'],
  'auto-detect': []
};

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract code from image using vision models
 */
export async function extractCodeFromImage(
  options: CodeExtractionOptions
): Promise<CodeExtraction> {
  const startTime = Date.now();
  const language = options.language || 'auto-detect';

  // Try vision model first
  let visionResult: CodeExtraction | null;
  try {
    visionResult = await extractWithVision(options);
  } catch (error) {
    visionResult = null;
  }

  // If OCR enhancement is requested or vision failed, try OCR
  let ocrResult: CodeExtraction | null = null;
  if (options.ocrEnhancement || !visionResult) {
    try {
      ocrResult = await extractWithOCR(options);
    } catch (error) {
      ocrResult = null;
    }
  }

  // Combine results if both methods were used
  const finalResult = combineExtractionResults(visionResult, ocrResult, options);

  // Add metadata
  finalResult.metadata = {
    method: options.ocrEnhancement ? 'hybrid' : (visionResult ? 'vision' : 'ocr'),
    provider: 'anthropic',
    ocrConfidence: ocrResult?.metadata.ocrConfidence,
    visionConfidence: visionResult?.metadata.visionConfidence || 0,
    processingTime: Date.now() - startTime,
    detectedElements: finalResult.detectedElements || []
  };

  return finalResult;
}

/**
 * Extract code from multiple images (e.g., video frames)
 */
export async function extractCodeFromImages(
  images: (Buffer | string)[],
  language?: CodeLanguage
): Promise<CodeExtraction[]> {
  const results = await Promise.all(
    images.map(image => extractCodeFromImage({ image, language }))
  );

  return mergeCodeExtractions(results);
}

/**
 * Extract code from screenshot with syntax validation
 */
export async function extractCodeWithValidation(
  options: CodeExtractionOptions
): Promise<CodeExtraction & { validationErrors?: string[] }> {
  const result = await extractCodeFromImage(options);

  if (options.syntaxValidation) {
    const validationErrors = await validateSyntax(result.code, result.language);
    return { ...result, validationErrors };
  }

  return result;
}

/**
 * Extract code from whiteboard photo
 */
export async function extractCodeFromWhiteboard(
  image: Buffer | string
): Promise<CodeExtraction> {
  return extractCodeFromImage({
    image,
    language: 'auto-detect',
    ocrEnhancement: true,
    preserveFormatting: true
  });
}

/**
 * Extract code from PDF page image
 */
export async function extractCodeFromPDF(
  image: Buffer | string,
  language?: CodeLanguage
): Promise<CodeExtraction> {
  return extractCodeFromImage({
    image,
    language,
    ocrEnhancement: true,
    preserveFormatting: true,
    includeLineNumbers: true
  });
}

// ============================================================================
// Vision-Based Extraction
// ============================================================================

/**
 * Extract code using vision models
 */
async function extractWithVision(
  options: CodeExtractionOptions
): Promise<CodeExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const imageBase64 = typeof options.image === 'string'
    ? options.image
    : options.image.toString('base64');

  const mediaType = options.image instanceof Buffer
    ? getMediaTypeFromBuffer(options.image)
    : 'image/png';

  const prompt = buildCodeExtractionPrompt(options);

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 4096,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ]
  });

  return parseCodeExtractionResponse(
    message.content[0]?.type === 'text' ? message.content[0].text : '',
    options
  );
}

/**
 * Build prompt for code extraction
 */
function buildCodeExtractionPrompt(options: CodeExtractionOptions): string {
  const language = options.language || 'auto-detect';

  let prompt = `Extract the code from this image. `;

  if (language !== 'auto-detect') {
    prompt += `The code is in ${language}. `;
  }

  prompt += `
Please provide:
1. The complete, accurate code
2. The programming language detected
3. Confidence level (0-1)
4. Line ranges for different code blocks if present
5. Detected code elements with their positions

Output in this JSON format:
{
  "code": "extracted code here",
  "language": "javascript",
  "confidence": 0.95,
  "lineRanges": [{"start": 1, "end": 10, "text": "function..."}],
  "detectedElements": [
    {"type": "keyword", "value": "function", "position": {"x": 10, "y": 20, "width": 50, "height": 15}, "confidence": 0.98}
  ]
}`;

  if (options.preserveFormatting) {
    prompt += `\n\nPreserve all formatting, indentation, and comments.`;
  }

  if (options.includeLineNumbers) {
    prompt += `\n\nInclude line numbers in the output.`;
  }

  return prompt;
}

/**
 * Parse code extraction response
 */
function parseCodeExtractionResponse(
  response: string,
  options: CodeExtractionOptions
): CodeExtraction {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                     response.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      // Fallback: treat entire response as code
      return {
        code: response,
        language: options.language || 'auto-detect',
        confidence: 0.5,
        metadata: {
          method: 'vision',
          provider: 'anthropic',
          visionConfidence: 0.5,
          processingTime: 0,
          detectedElements: []
        }
      };
    }

    const parsed = JSON.parse(jsonMatch[1]);

    return {
      code: parsed.code || '',
      language: parsed.language || options.language || 'auto-detect',
      confidence: parsed.confidence || 0.5,
      lineRanges: parsed.lineRanges,
      detectedElements: parsed.detectedElements,
      metadata: {
        method: 'vision',
        provider: 'anthropic',
        visionConfidence: parsed.confidence || 0.5,
        processingTime: 0,
        detectedElements: parsed.detectedElements || []
      }
    };
  } catch (error) {
    return {
      code: response,
      language: options.language || 'auto-detect',
      confidence: 0.3,
      metadata: {
        method: 'vision',
        provider: 'anthropic',
        visionConfidence: 0.3,
        processingTime: 0,
        detectedElements: []
      }
    };
  }
}

// ============================================================================
// OCR-Based Extraction
// ============================================================================

/**
 * Extract code using OCR
 */
async function extractWithOCR(
  options: CodeExtractionOptions
): Promise<CodeExtraction> {
  const startTime = Date.now();

  // Use OCR to get text
  const ocrResult = await recognizeText({
    image: options.image,
    language: 'eng',
    preprocess: true,
    preserveLayout: true
  });

  // Post-process OCR result for code
  const code = postProcessOCRText(ocrResult.text, options);

  // Detect language if auto-detect
  const language = options.language === 'auto-detect'
    ? detectLanguage(code)
    : options.language;

  return {
    code,
    language,
    confidence: ocrResult.confidence * 0.8, // OCR typically less confident for code
    lineRanges: ocrResult.lines.map((line, index) => ({
      start: index + 1,
      end: index + 1,
      text: line.text
    })),
    metadata: {
      method: 'ocr',
      provider: 'tesseract',
      ocrConfidence: ocrResult.confidence,
      visionConfidence: 0,
      processingTime: Date.now() - startTime,
      detectedElements: []
    }
  };
}

/**
 * Post-process OCR text for code
 */
function postProcessOCRText(text: string, options: CodeExtractionOptions): string {
  let processed = text;

  // Remove common OCR errors
  processed = processed
    .replace(/\{\s*\}/g, '{}') // Fix empty objects
    .replace(/\(\s*\)/g, '()') // Fix empty parentheses
    .replace(/\[\s*\]/g, '[]') // Fix empty arrays
    .replace(/;\s*;/g, ';') // Remove double semicolons
    .replace(/==/g, '==') // Fix equals operators
    .replace(/!=/g, '!=') // Fix not equals
    .replace(/=>/g, '=>') // Fix arrow functions
    .replace(/&&/g, '&&') // Fix logical AND
    .replace(/\|\|/g, '||'); // Fix logical OR

  // Fix spacing around operators
  processed = processed
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*\*\s*/g, ' * ')
    .replace(/\s*\/\s*/g, ' / ');

  // Fix common character misrecognitions
  const corrections: Record<string, string> = {
    '{': '{',
    '}': '}',
    '(': '(',
    ')': ')',
    '[': '[',
    ']': ']',
    '|': '|',
    '!': '!',
    '~': '~',
    '`': '`',
    "'": "'",
    '"': '"'
  };

  for (const [wrong, correct] of Object.entries(corrections)) {
    processed = processed.replace(new RegExp(wrong, 'g'), correct);
  }

  return processed;
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Detect programming language from code
 */
export function detectLanguage(code: string): CodeLanguage {
  const scores: Record<CodeLanguage, number> = {
    javascript: 0,
    typescript: 0,
    python: 0,
    java: 0,
    cpp: 0,
    csharp: 0,
    go: 0,
    rust: 0,
    php: 0,
    ruby: 0,
    swift: 0,
    kotlin: 0,
    'auto-detect': 0
  };

  // Score each language based on keyword presence
  for (const [language, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    if (language === 'auto-detect') continue;

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = code.match(regex);
      if (matches) {
        scores[language as CodeLanguage] += matches.length;
      }
    }
  }

  // Check for TypeScript-specific patterns
  if (/\b(interface|type\s+\w+\s*=|enum|namespace)\b/gi.test(code)) {
    scores.typescript += 10;
  }

  // Check for Python-specific patterns
  if (/^\s*(def|class|import|from)\s+/gm.test(code)) {
    scores.python += 10;
  }

  // Find language with highest score
  let maxScore = 0;
  let detectedLanguage: CodeLanguage = 'javascript';

  for (const [language, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLanguage = language as CodeLanguage;
    }
  }

  return detectedLanguage;
}

/**
 * Validate code syntax
 */
async function validateSyntax(
  code: string,
  language: CodeLanguage
): Promise<string[]> {
  const errors: string[] = [];

  // Basic syntax checks
  const checkBalanced = (open: string, close: string) => {
    let count = 0;
    for (const char of code) {
      if (char === open) count++;
      if (char === close) count--;
      if (count < 0) return false;
    }
    return count === 0;
  };

  if (!checkBalanced('{', '}')) {
    errors.push('Unbalanced braces');
  }

  if (!checkBalanced('(', ')')) {
    errors.push('Unbalanced parentheses');
  }

  if (!checkBalanced('[', ']')) {
    errors.push('Unbalanced brackets');
  }

  // Language-specific checks
  if (language === 'javascript' || language === 'typescript') {
    // Check for common syntax errors
    if (/;\s*;/.test(code)) {
      errors.push('Double semicolon detected');
    }
    if (/\bfunction\s*\(/.test(code)) {
      errors.push('Missing function name or syntax error');
    }
  }

  return errors;
}

// ============================================================================
// Result Combination
// ============================================================================

/**
 * Combine vision and OCR extraction results
 */
function combineExtractionResults(
  visionResult: CodeExtraction | null,
  ocrResult: CodeExtraction | null,
  options: CodeExtractionOptions
): CodeExtraction {
  if (!visionResult) return ocrResult!;
  if (!ocrResult) return visionResult;

  // Choose the result with higher confidence
  const primary = visionResult.confidence > ocrResult.confidence
    ? visionResult
    : ocrResult;

  // Merge detected elements
  const detectedElements = [
    ...(visionResult.detectedElements || []),
    ...(ocrResult.detectedElements || [])
  ];

  // Use OCR result if vision confidence is low and OCR confidence is reasonable
  if (visionResult.confidence < 0.5 && ocrResult.confidence > 0.6) {
    return {
      ...ocrResult,
      detectedElements
    };
  }

  return {
    ...primary,
    detectedElements
  };
}

/**
 * Merge multiple code extractions
 */
function mergeCodeExtractions(results: CodeExtraction[]): CodeExtraction[] {
  // Group by language and merge
  const grouped = new Map<CodeLanguage, CodeExtraction[]>();

  for (const result of results) {
    const language = result.language;
    if (!grouped.has(language)) {
      grouped.set(language, []);
    }
    grouped.get(language)!.push(result);
  }

  const merged: CodeExtraction[] = [];

  for (const [language, extractions] of grouped.entries()) {
    // Concatenate code from same language
    const mergedCode = extractions
      .map(e => e.code)
      .join('\n\n');

    const maxConfidence = Math.max(...extractions.map(e => e.confidence));

    merged.push({
      code: mergedCode,
      language,
      confidence: maxConfidence,
      lineRanges: extractions.flatMap(e => e.lineRanges || []),
      metadata: {
        method: 'vision',
        provider: 'anthropic',
        visionConfidence: maxConfidence,
        processingTime: extractions.reduce((sum, e) => sum + e.metadata.processingTime, 0),
        detectedElements: extractions.flatMap(e => e.metadata.detectedElements || [])
      }
    });
  }

  return merged;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get media type from buffer
 */
function getMediaTypeFromBuffer(buffer: Buffer): string {
  const signatures: Record<string, string> = {
    'PNG': 'image/png',
    'JFIF': 'image/jpeg',
    'JPEG': 'image/jpeg',
    'GIF': 'image/gif',
    'WEBP': 'image/webp',
    'BM': 'image/bmp'
  };

  for (const [signature, mediaType] of Object.entries(signatures)) {
    if (buffer.indexOf(signature) === 0) {
      return mediaType;
    }
  }

  return 'image/png';
}

/**
 * Extract code blocks from text
 */
export function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push(match[2]);
  }

  return blocks;
}

/**
 * Format extracted code
 */
export function formatExtractedCode(
  code: string,
  language: CodeLanguage
): string {
  // Basic formatting based on language
  let formatted = code.trim();

  // Remove extra whitespace
  formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Ensure consistent indentation
  const lines = formatted.split('\n');
  const minIndent = Math.min(
    ...lines
      .filter(line => line.trim().length > 0)
      .map(line => line.match(/^\s*/)?.[0].length || 0)
  );

  if (minIndent > 0) {
    formatted = lines
      .map(line => line.slice(minIndent))
      .join('\n');
  }

  return formatted;
}
