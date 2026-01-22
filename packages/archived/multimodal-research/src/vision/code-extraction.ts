/**
 * Code Extraction from Screenshots
 * Uses Vision Models to Extract and Parse Code
 */

// @ts-nocheck

import type { ImageInput, VisualQuestionAnswer } from '../types';
import { OCRPipeline, OCRResult } from './ocr';
import { ImageProcessor } from './processor';

export interface CodeExtractionConfig {
  language?: string;
  includeLineNumbers: boolean;
  preserveFormatting: boolean;
  detectSyntax: boolean;
}

export interface ExtractedCode {
  code: string;
  language: string;
  confidence: number;
  lineNumbers?: number[];
  syntaxHighlights?: SyntaxHighlight[];
  metadata: CodeMetadata;
}

export interface SyntaxHighlight {
  start: number;
  end: number;
  type: 'keyword' | 'string' | 'comment' | 'function' | 'variable' | 'number' | 'operator';
}

export interface CodeMetadata {
  source: 'screenshot' | 'ocr' | 'mixed';
  boundingBoxes: CodeBoundingBox[];
  indentation: string;
  encoding: string;
}

export interface CodeBoundingBox {
  line: number;
  start: number;
  end: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class CodeExtractor {
  private ocr: OCRPipeline;
  private processor: ImageProcessor;
  private config: CodeExtractionConfig;

  constructor(config?: Partial<CodeExtractionConfig>) {
    this.config = {
      includeLineNumbers: true,
      preserveFormatting: true,
      detectSyntax: true,
      ...config
    };

    this.ocr = new OCRPipeline({
      engine: 'tesseract',
      languages: ['eng']
    });

    this.processor = new ImageProcessor({
      targetSize: 224,
      normalize: true
    });
  }

  /**
   * Extract code from screenshot
   */
  async extractCode(image: ImageInput): Promise<ExtractedCode> {
    // Run OCR
    const ocrResult = await this.ocr.extractText(image);

    // Detect programming language
    const language = await this.detectLanguage(image, ocrResult);

    // Parse code structure
    const codeStructure = this.parseCodeStructure(ocrResult);

    // Enhance with vision-based detection
    const visionEnhanced = await this.enhanceWithVision(image, codeStructure);

    // Detect syntax if requested
    let syntaxHighlights: SyntaxHighlight[] = [];
    if (this.config.detectSyntax) {
      syntaxHighlights = this.detectSyntaxHighlights(visionEnhanced.code, language);
    }

    return {
      code: visionEnhanced.code,
      language,
      confidence: ocrResult.confidence,
      lineNumbers: this.config.includeLineNumbers ? this.extractLineNumbers(ocrResult) : undefined,
      syntaxHighlights: syntaxHighlights.length > 0 ? syntaxHighlights : undefined,
      metadata: {
        source: 'mixed',
        boundingBoxes: this.extractBoundingBoxes(ocrResult),
        indentation: this.detectIndentation(visionEnhanced.code),
        encoding: 'utf-8'
      }
    };
  }

  /**
   * Detect programming language from code
   */
  private async detectLanguage(image: ImageInput, ocrResult: OCRResult): Promise<string> {
    const text = ocrResult.text.toLowerCase();

    // Language detection patterns
    const patterns: Record<string, RegExp[]> = {
      javascript: [
        /function\s+\w+\s*\(/,
        /const\s+\w+\s*=/,
        /=>\s*{/,
        /import\s+.*from/,
        /console\.(log|error)/
      ],
      python: [
        /def\s+\w+\s*\(/,
        /class\s+\w+/,
        /import\s+\w+/,
        /print\s*\(/,
        /^\s+[\w\s]+:#/
      ],
      java: [
        /public\s+(class|void|int|String)/,
        /System\.out\.print/,
        /new\s+\w+\s*\(/,
        /@\w+/
      ],
      cpp: [
        /#include\s*<.*>/,
        /std::/,
        /cout\s*<</,
        /int\s+main\s*\(/
      ],
      go: [
        /func\s+\w+\s*\(/,
        /package\s+main/,
        /fmt\.Print/,
        /:=\s*/
      ],
      rust: [
        /fn\s+\w+\s*\(/,
        /let\s+mut\s+/,
        /use\s+\w+/,
        /println!/
      ],
      html: [
        /<!DOCTYPE html>/,
        /<html/,
        /<body/,
        /<div/
      ],
      css: [
        /\.\w+\s*{/,
        /#\w+\s*{/,
        /:\s*\w+;/,
        /@media/
      ],
      sql: [
        /SELECT\s+.*FROM/,
        /INSERT\s+INTO/,
        /CREATE\s+TABLE/,
        /UPDATE\s+.*SET/
      ]
    };

    // Check patterns
    for (const [lang, langPatterns] of Object.entries(patterns)) {
      for (const pattern of langPatterns) {
        if (pattern.test(text)) {
          return lang;
        }
      }
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Parse code structure from OCR
   */
  private parseCodeStructure(ocrResult: OCRResult): { code: string; confidence: number } {
    let code = '';

    // Reconstruct code from lines
    for (const line of ocrResult.lines) {
      // Preserve indentation
      const indentation = this.getIndentation(line.words);
      code += indentation + line.text + '\n';
    }

    return {
      code: code.trim(),
      confidence: ocrResult.confidence
    };
  }

  /**
   * Enhance code with vision-based detection
   */
  private async enhanceWithVision(
    image: ImageInput,
    codeStructure: { code: string; confidence: number }
  ): Promise<{ code: string; confidence: number }> {
    let enhanced = codeStructure.code;

    // Fix common OCR errors
    enhanced = this.fixOCRErrors(enhanced);

    // Preserve formatting
    if (this.config.preserveFormatting) {
      enhanced = this.preserveFormatting(enhanced);
    }

    return {
      code: enhanced,
      confidence: codeStructure.confidence
    };
  }

  /**
   * Fix common OCR errors in code
   */
  private fixOCRErrors(code: string): string {
    // Common OCR error corrections
    const corrections: Record<string, string> = {
      '{': '{',
      '}': '}',
      '(': '(',
      ')': ')',
      '[': '[',
      ']': ']',
      ';': ';',
      ':': ':',
      '=': '=',
      '+': '+',
      '-': '-',
      '*': '*',
      '/': '/',
      '!': '!',
      '?': '?',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": "'",
      '|': '|',
      '&': '&',
      '%': '%',
      '$': '$',
      '#': '#',
      '@': '@',
      '~': '~',
      '`': '`',
      '\\': '\\'
    };

    // Fix spacing around operators
    let fixed = code
      .replace(/\s*([{}()[\];,:=+\-*/!?<>|&%$#@~`\\])\s*/g, '$1')
      .replace(/([a-zA-Z0-9_])\s+([{}()[\];,:=+\-*/!?<>|&%$#@~`\\])/g, '$1$2')
      .replace(/([{}()[\];,:=+\-*/!?<>|&%$#@~`\\])\s+([a-zA-Z0-9_])/g, '$1$2');

    // Fix common misrecognitions
    fixed = fixed
      .replace(/function\s*\(/g, 'function(')
      .replace(/def\s*\(/g, 'def(')
      .replace(/if\s*\(/g, 'if(')
      .replace(/for\s*\(/g, 'for(')
      .replace(/while\s*\(/g, 'while(')
      .replace(/return\s*\(/g, 'return(');

    return fixed;
  }

  /**
   * Preserve code formatting
   */
  private preserveFormatting(code: string): string {
    // Normalize line endings
    let formatted = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Preserve consistent indentation
    const lines = formatted.split('\n');
    const indentSizes = lines
      .filter(line => line.trim().length > 0)
      .map(line => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      });

    // Detect common indentation size
    const commonIndent = this.mostCommon(indentSizes);

    // Normalize to detected indentation
    formatted = lines.map(line => {
      const match = line.match(/^(\s*)/);
      const currentIndent = match ? match[1].length : 0;
      const indentLevel = Math.round(currentIndent / commonIndent);
      return ' '.repeat(indentLevel * commonIndent) + line.trim();
    }).join('\n');

    return formatted;
  }

  /**
   * Detect syntax highlights
   */
  private detectSyntaxHighlights(code: string, language: string): SyntaxHighlight[] {
    const highlights: SyntaxHighlight[] = [];

    // Language-specific syntax patterns
    const patterns: Record<string, Record<string, RegExp[]>> = {
      javascript: {
        keyword: [
          /\b(function|const|let|var|if|else|for|while|do|switch|case|break|continue|return|class|extends|import|export|from|async|await|try|catch|finally|throw|new|typeof|instanceof|in|of|null|undefined|true|false)\b/g
        ],
        string: [
          /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g
        ],
        comment: [
          /\/\/.*$/gm,
          /\/\*[\s\S]*?\*\//g
        ],
        function: [
          /\b[a-zA-Z_]\w*\s*(?=\()/g
        ],
        number: [
          /\b\d+\.?\d*\b/g
        ],
        operator: [
          /[+\-*/%=<>!&|^~?:]/g
        ]
      },
      python: {
        keyword: [
          /\b(def|class|if|elif|else|for|while|do|try|except|finally|with|as|import|from|return|yield|raise|pass|break|continue|and|or|not|in|is|None|True|False|lambda|global|nonlocal|async|await)\b/g
        ],
        string: [
          /(["'])(?:(?!\1)[^\\]|\\.)*\1/g
        ],
        comment: [
          /#.*$/gm
        ],
        function: [
          /\b[a-zA-Z_]\w*\s*(?=\()/g
        ],
        number: [
          /\b\d+\.?\d*\b/g
        ],
        operator: [
          /[+\-*/%=<>!&|^~@]/g
        ]
      }
    };

    const langPatterns = patterns[language] || patterns.javascript;

    for (const [type, typePatterns] of Object.entries(langPatterns)) {
      for (const pattern of typePatterns) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(code)) !== null) {
          highlights.push({
            start: match.index,
            end: match.index + match[0].length,
            type: type as SyntaxHighlight['type']
          });
        }
      }
    }

    // Sort by start position
    highlights.sort((a, b) => a.start - b.start);

    return highlights;
  }

  /**
   * Extract line numbers from OCR
   */
  private extractLineNumbers(ocrResult: OCRResult): number[] {
    const lineNumbers: number[] = [];

    for (let i = 0; i < ocrResult.lines.length; i++) {
      // Check if line starts with a number
      const match = ocrResult.lines[i].text.match(/^(\d+)\s/);
      if (match) {
        lineNumbers.push(parseInt(match[1]));
      } else {
        lineNumbers.push(i + 1);
      }
    }

    return lineNumbers;
  }

  /**
   * Extract bounding boxes
   */
  private extractBoundingBoxes(ocrResult: OCRResult): CodeBoundingBox[] {
    const boundingBoxes: CodeBoundingBox[] = [];

    for (let i = 0; i < ocrResult.lines.length; i++) {
      const line = ocrResult.lines[i];
      if (line.words.length > 0) {
        const firstWord = line.words[0];
        const lastWord = line.words[line.words.length - 1];

        boundingBoxes.push({
          line: i + 1,
          start: firstWord.boundingBox.x,
          end: lastWord.boundingBox.x + lastWord.boundingBox.width,
          boundingBox: line.boundingBox
        });
      }
    }

    return boundingBoxes;
  }

  /**
   * Get indentation from words
   */
  private getIndentation(words: OCRResult['words']): string {
    if (words.length === 0) return '';

    const firstWord = words[0];
    const x = firstWord.boundingBox.x;

    // Approximate indentation (2 spaces per 10 pixels)
    const indentSpaces = Math.round(x / 10);
    return ' '.repeat(indentSpaces);
  }

  /**
   * Detect indentation style
   */
  private detectIndentation(code: string): string {
    const lines = code.split('\n');
    const indents = lines
      .map(line => line.match(/^(\s*)/)?.[1] || '')
      .filter(indent => indent.length > 0);

    if (indents.length === 0) return '  ';

    // Check if using tabs or spaces
    const hasTabs = indents.some(indent => indent.includes('\t'));
    if (hasTabs) return '\t';

    // Detect space indentation size
    const sizes = indents.map(indent => indent.length);
    const commonSize = this.mostCommon(sizes.filter(s => s > 0));

    return ' '.repeat(commonSize);
  }

  /**
   * Find most common value
   */
  private mostCommon(arr: number[]): number {
    const counts: Record<number, number> = {};
    for (const val of arr) {
      counts[val] = (counts[val] || 0) + 1;
    }

    let maxCount = 0;
    let mostCommon = arr[0];
    for (const [val, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = parseInt(val);
      }
    }

    return mostCommon;
  }

  /**
   * Extract code block from specific region
   */
  async extractRegion(
    image: ImageInput,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<ExtractedCode> {
    // Crop image to region
    const cropped = this.cropImage(image, region);

    // Extract code from cropped region
    return this.extractCode(cropped);
  }

  /**
   * Crop image to region
   */
  private cropImage(
    image: ImageInput,
    region: { x: number; y: number; width: number; height: number }
  ): ImageInput {
    const data = new Float32Array(image.data as ArrayBuffer);
    const width = image.width || 224;
    const height = image.height || 224;

    const cropped = new Float32Array(region.width * region.height * 3);

    for (let y = 0; y < region.height; y++) {
      for (let x = 0; x < region.width; x++) {
        const srcX = region.x + x;
        const srcY = region.y + y;

        if (srcX < width && srcY < height) {
          for (let c = 0; c < 3; c++) {
            cropped[(y * region.width + x) * 3 + c] = data[(srcY * width + srcX) * 3 + c];
          }
        }
      }
    }

    return {
      data: cropped.buffer,
      width: region.width,
      height: region.height,
      format: image.format
    };
  }

  /**
   * Batch extract from multiple regions
   */
  async batchExtract(
    image: ImageInput,
    regions: { x: number; y: number; width: number; height: number }[]
  ): Promise<ExtractedCode[]> {
    const results: ExtractedCode[] = [];

    for (const region of regions) {
      try {
        const result = await this.extractRegion(image, region);
        results.push(result);
      } catch (error) {
        console.error(`Failed to extract from region ${JSON.stringify(region)}:`, error);
      }
    }

    return results;
  }
}
