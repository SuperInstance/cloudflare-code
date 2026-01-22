/**
 * Token Counter - Utilities for counting tokens in text
 */

import { TokenCountResult } from '../types';

/**
 * Simple token counter using character-based approximation
 */
export class TokenCounter {
  private readonly charsPerToken: number;

  constructor(charsPerToken: number = 4) {
    this.charsPerToken = charsPerToken;
  }

  /**
   * Count tokens in text
   */
  async count(text: string): Promise<number> {
    return Math.ceil(text.length / this.charsPerToken);
  }

  /**
   * Count tokens in multiple texts
   */
  async countBatch(texts: string[]): Promise<number[]> {
    return Promise.all(texts.map(text => this.count(text)));
  }

  /**
   * Get detailed token count result
   */
  async countDetailed(text: string): Promise<TokenCountResult> {
    const tokens = await this.count(text);

    return {
      tokens,
      characters: text.length,
      estimated: true,
    };
  }

  /**
   * Estimate tokens without counting (very fast approximation)
   */
  estimate(text: string): number {
    return Math.ceil(text.length / this.charsPerToken);
  }

  /**
   * Count tokens in messages array
   */
  async countMessages(messages: Array<{ content: string }>): Promise<number> {
    let total = 0;

    for (const message of messages) {
      total += await this.count(message.content);
    }

    return total;
  }
}

/**
 * Create a token counter instance
 */
export function createTokenCounter(charsPerToken?: number): TokenCounter {
  return new TokenCounter(charsPerToken);
}

/**
 * Quick token counting function
 */
export async function countTokens(text: string): Promise<number> {
  const counter = new TokenCounter();
  return counter.count(text);
}

/**
 * Quick token estimation function
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
