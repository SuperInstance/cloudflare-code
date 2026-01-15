import { createId } from '../utils';
import { Analyzer, DocumentTerms } from './analyzer';
import { Tokenizer } from './tokenizer';

export interface IndexOptions {
  analyzerOptions?: {
    useStemming?: boolean;
    useStopWords?: boolean;
    preserveCase?: boolean;
    preservePositions?: boolean;
  };
  shardCount?: number;
  replicationFactor?: number;
}

export interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  averageDocumentLength: number;
  largestDocumentLength: number;
  indexSize: number;
  lastUpdated: Date;
}

export class FullTextIndex {
  private documents = new Map<string, DocumentTerms>();
  private invertedIndex = new Map<string, { documentIds: string[]; positions: Map<string, number[]> }>();
  private analyzer: Analyzer;
  private tokenizer: Tokenizer;
  private options: IndexOptions;
  private stats: IndexStats;

  constructor(options: IndexOptions = {}) {
    this.analyzer = new Analyzer();
    this.tokenizer = new Tokenizer();
    this.options = options;
    this.stats = {
      totalDocuments: 0,
      totalTerms: 0,
      averageDocumentLength: 0,
      largestDocumentLength: 0,
      indexSize: 0,
      lastUpdated: new Date()
    };
  }

  index(document: { id: string; content: string }): void {
    const documentTerms = this.analyzer.analyze(document.content, this.options.analyzerOptions);
    documentTerms.id = document.id;

    this.documents.set(document.id, documentTerms);

    for (const termFreq of documentTerms.terms) {
      const term = termFreq.term;
      const positions = termFreq.positions;

      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, {
          documentIds: [],
          positions: new Map()
        });
      }

      const indexEntry = this.invertedIndex.get(term)!;
      const existingPositions = indexEntry.documentIds.indexOf(document.id);

      if (existingPositions === -1) {
        indexEntry.documentIds.push(document.id);
      }

      indexEntry.positions.set(document.id, positions);
    }

    this.updateStats(documentTerms);
  }

  batchIndex(documents: Array<{ id: string; content: string }>): void {
    for (const document of documents) {
      this.index(document);
    }
  }

  remove(documentId: string): boolean {
    const documentTerms = this.documents.get(documentId);
    if (!documentTerms) {
      return false;
    }

    for (const termFreq of documentTerms.terms) {
      const term = termFreq.term;
      const indexEntry = this.invertedIndex.get(term);

      if (indexEntry) {
        const documentIndex = indexEntry.documentIds.indexOf(documentId);
        if (documentIndex !== -1) {
          indexEntry.documentIds.splice(documentIndex, 1);
        }

        indexEntry.positions.delete(documentId);

        if (indexEntry.documentIds.length === 0) {
          this.invertedIndex.delete(term);
        }
      }
    }

    this.documents.delete(documentId);
    this.updateStats();
    return true;
  }

  search(query: string, options: {
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'documentLength';
    sortOrder?: 'asc' | 'desc';
  } = {}): Array<{ id: string; score: number; document: DocumentTerms }> {
    const {
      limit = 10,
      offset = 0,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options;

    const queryTerms = this.tokenizer.tokenize(query, {
      preserveCase: false,
      removeStopWords: false,
      preservePositions: true
    }).map(token => token.text);

    if (queryTerms.length === 0) {
      return [];
    }

    const results: Array<{ id: string; score: number; document: DocumentTerms }> = [];

    for (const [documentId, documentTerms] of this.documents) {
      const score = this.calculateScore(queryTerms, documentTerms);
      if (score > 0) {
        results.push({
          id: documentId,
          score,
          document: documentTerms
        });
      }
    }

    results.sort((a, b) => {
      if (sortBy === 'relevance') {
        return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
      } else if (sortBy === 'documentLength') {
        const lengthA = a.document.totalTerms;
        const lengthB = b.document.totalTerms;
        return sortOrder === 'desc' ? lengthB - lengthA : lengthA - lengthB;
      }
      return 0;
    });

    const startIndex = offset;
    const endIndex = startIndex + limit;

    return results.slice(startIndex, endIndex);
  }

  private calculateScore(queryTerms: string[], document: DocumentTerms): number {
    let score = 0;

    for (const queryTerm of queryTerms) {
      const termInfo = document.terms.find(t => t.term === queryTerm);
      if (termInfo) {
        score += termInfo.frequency;
      }
    }

    const queryTermsSet = new Set(queryTerms);
    const matchingTerms = document.terms.filter(t => queryTermsSet.has(t.term)).length;
    const coverage = matchingTerms / queryTermsSet.size;

    score = score * (1 + coverage);

    return score;
  }

  private updateStats(documentTerms?: DocumentTerms): void {
    if (documentTerms) {
      this.stats.totalDocuments = this.documents.size;
      this.stats.totalTerms += documentTerms.terms.length;
      this.stats.averageDocumentLength = this.calculateAverageDocumentLength();
      this.stats.largestDocumentLength = Math.max(
        this.stats.largestDocumentLength,
        documentTerms.totalTerms
      );
    } else {
      this.stats.totalDocuments = this.documents.size;
      this.stats.totalTerms = Array.from(this.documents.values())
        .reduce((sum, doc) => sum + doc.terms.length, 0);
      this.stats.averageDocumentLength = this.calculateAverageDocumentLength();
    }

    this.stats.indexSize = this.calculateIndexSize();
    this.stats.lastUpdated = new Date();
  }

  private calculateAverageDocumentLength(): number {
    if (this.documents.size === 0) return 0;

    const totalLength = Array.from(this.documents.values())
      .reduce((sum, doc) => sum + doc.totalTerms, 0);

    return totalLength / this.documents.size;
  }

  private calculateIndexSize(): number {
    let size = 0;

    size += this.documents.size * 50;

    for (const term of this.invertedIndex.keys()) {
      size += term.length * 2;
      const entry = this.invertedIndex.get(term)!;
      size += entry.documentIds.length * 8;
      size += entry.positions.size * 20;
    }

    return size;
  }

  getStats(): IndexStats {
    return { ...this.stats };
  }

  getDocument(id: string): DocumentTerms | undefined {
    return this.documents.get(id);
  }

  getTermFrequency(term: string): number {
    return this.invertedIndex.get(term)?.documentIds.length || 0;
  }

  getDocumentFrequency(term: string): number {
    const postings = this.invertedIndex.get(term);
    return postings ? postings.documentIds.length : 0;
  }

  getAllTerms(): string[] {
    return Array.from(this.invertedIndex.keys());
  }

  clear(): void {
    this.documents.clear();
    this.invertedIndex.clear();
    this.stats = {
      totalDocuments: 0,
      totalTerms: 0,
      averageDocumentLength: 0,
      largestDocumentLength: 0,
      indexSize: 0,
      lastUpdated: new Date()
    };
  }
}