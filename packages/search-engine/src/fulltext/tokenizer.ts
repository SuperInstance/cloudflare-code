import { normalizeText } from '../utils';

export interface Token {
  text: string;
  position: number;
  length: number;
  positionLength: number;
}

export class Tokenizer {
  private stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
    'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
    'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
    'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
    'one', 'all', 'would', 'there', 'their', 'what', 'so',
    'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
    'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
    'him', 'know', 'take', 'people', 'into', 'year', 'your',
    'good', 'some', 'could', 'them', 'see', 'other', 'than',
    'then', 'now', 'look', 'only', 'come', 'its', 'over',
    'think', 'also', 'back', 'after', 'use', 'two', 'how',
    'our', 'work', 'first', 'well', 'way', 'even', 'new',
    'want', 'because', 'any', 'these', 'give', 'day', 'most',
    'us'
  ]);

  private specialChars = /[^\w\s]/g;

  tokenize(text: string, options: {
    preserveCase?: boolean;
    removeStopWords?: boolean;
    preservePositions?: boolean;
  } = {}): Token[] {
    const {
      preserveCase = false,
      removeStopWords = true,
      preservePositions = true
    } = options;

    let cleanText = text.replace(this.specialChars, ' ');

    if (!preserveCase) {
      cleanText = normalizeText(cleanText);
    }

    const tokens: Token[] = [];
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);

    let currentPosition = 0;

    for (const word of words) {
      const token: Token = {
        text: word,
        position: preservePositions ? currentPosition : 0,
        length: word.length,
        positionLength: preservePositions ? 1 : 0
      };

      if (!removeStopWords || !this.stopWords.has(word)) {
        tokens.push(token);
      }

      if (preservePositions) {
        currentPosition++;
      }
    }

    return tokens;
  }

  setStopWords(words: string[]): void {
    this.stopWords = new Set(words);
  }

  addStopWords(words: string[]): void {
    words.forEach(word => this.stopWords.add(word.toLowerCase()));
  }

  removeStopWords(words: string[]): void {
    words.forEach(word => this.stopWords.delete(word.toLowerCase()));
  }

  getStopWords(): string[] {
    return Array.from(this.stopWords);
  }
}

export const tokenizer = new Tokenizer();