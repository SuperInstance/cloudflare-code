/**
 * OCR Pipeline for Text Recognition from Images
 */

import type { ImageInput, Captions } from '../types';
import { ImageProcessor } from './processor';

export interface OCRConfig {
  engine: 'tesseract' | 'easyocr' | 'paddleocr' | 'custom';
  languages: string[];
  preprocessing?: OCRPreprocessing;
  postprocessing?: OCRPostprocessing;
}

export interface OCRPreprocessing {
  grayscale: boolean;
  binarize: boolean;
  denoise: boolean;
  deskew: boolean;
}

export interface OCRPostprocessing {
  spellCheck: boolean;
  confidenceThreshold: number;
  mergeLines: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRBlock[];
  language?: string;
}

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRBlock {
  text: string;
  confidence: number;
  lines: OCRLine[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type?: 'text' | 'title' | 'list' | 'table';
}

export class OCRPipeline {
  private config: OCRConfig;
  private processor: ImageProcessor;

  constructor(config?: Partial<OCRConfig>) {
    this.config = {
      engine: 'tesseract',
      languages: ['eng'],
      preprocessing: {
        grayscale: true,
        binarize: true,
        denoise: false,
        deskew: true
      },
      postprocessing: {
        spellCheck: false,
        confidenceThreshold: 0.6,
        mergeLines: true
      },
      ...config
    };

    this.processor = new ImageProcessor();
  }

  /**
   * Run OCR on image
   */
  async extractText(image: ImageInput): Promise<OCRResult> {
    // Preprocess image
    let processed = image;
    if (this.config.preprocessing) {
      processed = await this.preprocess(image);
    }

    // Run OCR engine
    const rawResult = await this.runOCREngine(processed);

    // Postprocess results
    const result = this.postprocess(rawResult);

    return result;
  }

  /**
   * Preprocess image for OCR
   */
  private async preprocess(image: ImageInput): Promise<ImageInput> {
    let processed = { ...image };

    if (this.config.preprocessing?.grayscale) {
      processed = this.toGrayscale(processed);
    }

    if (this.config.preprocessing?.binarize) {
      processed = this.binarize(processed);
    }

    if (this.config.preprocessing?.denoise) {
      processed = this.denoise(processed);
    }

    if (this.config.preprocessing?.deskew) {
      processed = this.deskew(processed);
    }

    return processed;
  }

  /**
   * Run OCR engine
   */
  private async runOCREngine(image: ImageInput): Promise<OCRResult> {
    switch (this.config.engine) {
      case 'tesseract':
        return this.runTesseract(image);
      case 'easyocr':
        return this.runEasyOCR(image);
      case 'paddleocr':
        return this.runPaddleOCR(image);
      default:
        return this.runTesseract(image);
    }
  }

  /**
   * Simulated Tesseract OCR
   */
  private async runTesseract(image: ImageInput): Promise<OCRResult> {
    // In production, would use actual Tesseract.js
    // This is a simplified simulation

    const words: OCRWord[] = [];
    const lines: OCRLine[] = [];
    const blocks: OCRBlock[] = [];

    // Simulate OCR results
    const sampleTexts = [
      'Hello World',
      'This is a test',
      'OCR extraction',
      'Text recognition'
    ];

    let y = 50;
    for (let i = 0; i < sampleTexts.length; i++) {
      const textWords = sampleTexts[i].split(' ');
      const lineWords: OCRWord[] = [];

      let x = 50;
      for (const word of textWords) {
        const wordConfidence = 0.8 + Math.random() * 0.2;
        lineWords.push({
          text: word,
          confidence: wordConfidence,
          boundingBox: {
            x,
            y,
            width: word.length * 20,
            height: 30
          }
        });
        x += word.length * 20 + 20;
      }

      const lineConfidence = lineWords.reduce((sum, w) => sum + w.confidence, 0) / lineWords.length;

      lines.push({
        text: sampleTexts[i],
        confidence: lineConfidence,
        words: lineWords,
        boundingBox: {
          x: 50,
          y,
          width: x - 50,
          height: 30
        }
      });

      words.push(...lineWords);
      y += 50;
    }

    blocks.push({
      text: lines.map(l => l.text).join('\n'),
      confidence: lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length,
      lines,
      boundingBox: {
        x: 50,
        y: 50,
        width: 300,
        height: y - 50
      },
      type: 'text'
    });

    return {
      text: lines.map(l => l.text).join('\n'),
      confidence: blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length,
      words,
      lines,
      blocks,
      language: this.config.languages[0]
    };
  }

  /**
   * Run EasyOCR
   */
  private async runEasyOCR(image: ImageInput): Promise<OCRResult> {
    // Simulated EasyOCR
    return this.runTesseract(image);
  }

  /**
   * Run PaddleOCR
   */
  private async runPaddleOCR(image: ImageInput): Promise<OCRResult> {
    // Simulated PaddleOCR
    return this.runTesseract(image);
  }

  /**
   * Postprocess OCR results
   */
  private postprocess(result: OCRResult): OCRResult {
    let filteredWords = result.words;

    // Filter by confidence threshold
    if (this.config.postprocessing?.confidenceThreshold) {
      filteredWords = filteredWords.filter(
        w => w.confidence >= this.config.postprocessing!.confidenceThreshold
      );
    }

    // Reconstruct lines from filtered words
    const lines = this.reconstructLines(filteredWords);

    // Reconstruct blocks
    const blocks = this.reconstructBlocks(lines);

    // Merge lines if requested
    const text = this.config.postprocessing?.mergeLines
      ? lines.map(l => l.text).join(' ')
      : lines.map(l => l.text).join('\n');

    return {
      text,
      confidence: blocks.length > 0
        ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
        : 0,
      words: filteredWords,
      lines,
      blocks,
      language: result.language
    };
  }

  /**
   * Reconstruct lines from words
   */
  private reconstructLines(words: OCRWord[]): OCRLine[] {
    const lines: OCRLine[] = [];

    if (words.length === 0) return lines;

    // Sort words by y coordinate
    const sortedWords = [...words].sort((a, b) => a.boundingBox.y - b.boundingBox.y);

    let currentLine: OCRWord[] = [sortedWords[0]];
    let currentY = sortedWords[0].boundingBox.y;

    for (let i = 1; i < sortedWords.length; i++) {
      const word = sortedWords[i];
      const yDiff = Math.abs(word.boundingBox.y - currentY);

      if (yDiff < 30) {
        // Same line
        currentLine.push(word);
      } else {
        // New line
        lines.push(this.createLineFromWords(currentLine));
        currentLine = [word];
        currentY = word.boundingBox.y;
      }
    }

    if (currentLine.length > 0) {
      lines.push(this.createLineFromWords(currentLine));
    }

    return lines;
  }

  private createLineFromWords(words: OCRWord[]): OCRLine {
    // Sort words by x coordinate
    const sortedWords = words.sort((a, b) => a.boundingBox.x - b.boundingBox.x);

    const minX = Math.min(...sortedWords.map(w => w.boundingBox.x));
    const maxX = Math.max(...sortedWords.map(w => w.boundingBox.x + w.boundingBox.width));
    const minY = Math.min(...sortedWords.map(w => w.boundingBox.y));
    const maxY = Math.max(...sortedWords.map(w => w.boundingBox.y + w.boundingBox.height));

    return {
      text: sortedWords.map(w => w.text).join(' '),
      confidence: sortedWords.reduce((sum, w) => sum + w.confidence, 0) / sortedWords.length,
      words: sortedWords,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    };
  }

  /**
   * Reconstruct blocks from lines
   */
  private reconstructBlocks(lines: OCRLine[]): OCRBlock[] {
    const blocks: OCRBlock[] = [];

    if (lines.length === 0) return blocks;

    // Simple grouping: all lines in one block
    const minX = Math.min(...lines.map(l => l.boundingBox.x));
    const maxX = Math.max(...lines.map(l => l.boundingBox.x + l.boundingBox.width));
    const minY = Math.min(...lines.map(l => l.boundingBox.y));
    const maxY = Math.max(...lines.map(l => l.boundingBox.y + l.boundingBox.height));

    blocks.push({
      text: lines.map(l => l.text).join('\n'),
      confidence: lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length,
      lines,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      type: 'text'
    });

    return blocks;
  }

  /**
   * Convert image to grayscale
   */
  private toGrayscale(image: ImageInput): ImageInput {
    const data = new Float32Array(image.data as ArrayBuffer);
    const grayscale = new Float32Array((data.length / 3) * 4); // RGBA

    for (let i = 0; i < data.length; i += 3) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const idx = (i / 3) * 4;
      grayscale[idx] = gray;
      grayscale[idx + 1] = gray;
      grayscale[idx + 2] = gray;
      grayscale[idx + 3] = 255;
    }

    return { ...image, data: grayscale.buffer };
  }

  /**
   * Binarize image
   */
  private binarize(image: ImageInput): ImageInput {
    const data = new Float32Array(image.data as ArrayBuffer);
    const threshold = 128;

    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] > threshold ? 255 : 0;
    }

    return { ...image, data: data.buffer };
  }

  /**
   * Denoise image
   */
  private denoise(image: ImageInput): ImageInput {
    const data = new Float32Array(image.data as ArrayBuffer);
    const width = image.width || 224;
    const height = image.height || 224;
    const denoised = new Float32Array(data.length);

    // Simple median filter
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const values: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              values.push(data[((y + dy) * width + (x + dx)) * 3 + c]);
            }
          }
          values.sort((a, b) => a - b);
          denoised[(y * width + x) * 3 + c] = values[Math.floor(values.length / 2)];
        }
      }
    }

    return { ...image, data: denoised.buffer };
  }

  /**
   * Deskew image
   */
  private deskew(image: ImageInput): ImageInput {
    // Simplified deskewing - would use Hough transform in practice
    return image;
  }

  /**
   * Extract structured data from OCR results
   */
  extractStructuredData(result: OCRResult): Record<string, string> {
    const structured: Record<string, string> = {};

    // Extract key-value pairs
    for (const block of result.blocks) {
      const lines = block.lines.map(l => l.text);

      for (const line of lines) {
        // Look for patterns like "Key: Value" or "Key = Value"
        const match1 = line.match(/^([^:]+):\s*(.+)$/);
        const match2 = line.match(/^([^=]+)=\s*(.+)$/);

        if (match1) {
          structured[match1[1].trim()] = match1[2].trim();
        } else if (match2) {
          structured[match2[1].trim()] = match2[2].trim();
        }
      }
    }

    return structured;
  }

  /**
   * Extract tables from OCR results
   */
  extractTables(result: OCRResult): string[][] {
    const tables: string[][] = [];

    for (const block of result.blocks) {
      if (block.type === 'table') {
        const table: string[] = [];
        for (const line of block.lines) {
          table.push(line.text);
        }
        tables.push(table);
      }
    }

    return tables;
  }
}
