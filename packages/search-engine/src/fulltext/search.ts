import { FullTextIndex, IndexOptions, IndexStats } from './index';
import { FullTextSearchQuery, SearchResult } from '../types';
import { LRUCache } from '../utils';

export interface FullTextSearchOptions {
  index?: FullTextIndex;
  useCache?: boolean;
  cacheSize?: number;
  fuzzyThreshold?: number;
}

export class FullTextSearch {
  private index: FullTextIndex;
  private cache: LRUCache<string, SearchResult[]>;
  private options: FullTextSearchOptions;

  constructor(options: FullTextSearchOptions = {}) {
    this.index = options.index || new FullTextIndex();
    this.cache = new LRUCache(options.cacheSize || 1000);
    this.options = {
      useCache: true,
      ...options
    };
  }

  search(query: FullTextSearchQuery): SearchResult[] {
    const cacheKey = this.generateCacheKey(query);

    if (this.options.useCache && this.cache.get(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const startTime = Date.now();
    const results = this.performSearch(query);
    const queryTime = Date.now() - startTime;

    if (this.options.useCache) {
      this.cache.set(cacheKey, results);
    }

    return results;
  }

  private performSearch(query: FullTextSearchQuery): SearchResult[] {
    const {
      query: searchQuery,
      limit = 10,
      offset = 0,
      sortBy,
      sortOrder = 'desc',
      useStemming = true,
      useStopWords = true,
      useFuzzy = false,
      fuzzyThreshold = 0.8
    } = query;

    let rawResults = this.index.search(searchQuery, {
      limit,
      offset,
      sortBy,
      sortOrder
    });

    if (useFuzzy) {
      rawResults = this.applyFuzzySearch(rawResults, searchQuery, fuzzyThreshold);
    }

    const results: SearchResult[] = rawResults.map(result => ({
      id: result.id,
      title: result.document.terms.find(t => t.term.includes('title'))?.term || searchQuery,
      content: this.generateContentSnippet(result.document, searchQuery),
      score: result.score,
      highlights: this.generateHighlights(result.document, searchQuery),
      metadata: {
        documentLength: result.document.totalTerms,
        uniqueTerms: result.document.uniqueTerms,
        queryTime: Date.now() - (Date.now() - (result.score * 10))
      }
    }));

    return results;
  }

  private generateCacheKey(query: FullTextSearchQuery): string {
    const { query: searchQuery, limit, offset, sortBy, sortOrder } = query;
    return `${searchQuery}:${limit}:${offset}:${sortBy}:${sortOrder}`;
  }

  private generateContentSnippet(document: any, query: string): string {
    const queryTerms = query.toLowerCase().split(' ');
    const content = '';

    let bestSnippet = '';
    let bestScore = 0;

    for (const term of document.terms) {
      for (const queryTerm of queryTerms) {
        if (term.term.includes(queryTerm)) {
          const snippet = this.extractSnippet(term.term);
          const score = this.calculateSnippetScore(snippet, queryTerms);

          if (score > bestScore) {
            bestScore = score;
            bestSnippet = snippet;
          }
        }
      }
    }

    return bestSnippet || content.substring(0, 200) + '...';
  }

  private extractSnippet(term: string): string {
    return term;
  }

  private calculateSnippetScore(snippet: string, queryTerms: string[]): number {
    let score = 0;
    for (const term of queryTerms) {
      if (snippet.toLowerCase().includes(term)) {
        score += 1;
      }
    }
    return score;
  }

  private generateHighlights(document: any, query: string): string[] {
    const queryTerms = query.toLowerCase().split(' ');
    const highlights: string[] = [];

    for (const termFreq of document.terms) {
      for (const queryTerm of queryTerms) {
        if (termFreq.term.includes(queryTerm)) {
          highlights.push(termFreq.term);
          if (highlights.length >= 3) break;
        }
      }
      if (highlights.length >= 3) break;
    }

    return highlights;
  }

  private applyFuzzySearch(
    results: Array<{ id: string; score: number; document: any }>,
    query: string,
    threshold: number
  ): Array<{ id: string; score: number; document: any }> {
    const queryTerms = query.toLowerCase().split(' ');
    const fuzzyResults = [...results];

    for (const result of fuzzyResults) {
      let fuzzyScore = 0;

      for (const term of result.document.terms) {
        for (const queryTerm of queryTerms) {
          const similarity = this.calculateStringSimilarity(term.term, queryTerm);
          if (similarity >= threshold) {
            fuzzyScore += similarity;
          }
        }
      }

      result.score = result.score * (1 + fuzzyScore);
    }

    return fuzzyResults.sort((a, b) => b.score - a.score);
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - (distance / Math.max(len1, len2));
  }

  index(document: { id: string; content: string }): void {
    this.index.index(document);
  }

  batchIndex(documents: Array<{ id: string; content: string }>): void {
    this.index.batchIndex(documents);
  }

  remove(documentId: string): boolean {
    return this.index.remove(documentId);
  }

  getStats(): IndexStats {
    return this.index.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheHitRate(): number {
    return this.cache.size() / (this.cache.size() + 1000);
  }
}