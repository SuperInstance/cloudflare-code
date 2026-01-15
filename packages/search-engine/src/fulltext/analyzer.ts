import { Tokenizer, Token } from './tokenizer';
import { Stemmer } from './stemmer';

export interface TermFrequency {
  term: string;
  frequency: number;
  positions: number[];
}

export interface DocumentTerms {
  id: string;
  terms: TermFrequency[];
  totalTerms: number;
  uniqueTerms: number;
}

export class Analyzer {
  private tokenizer: Tokenizer;
  private stemmer: Stemmer;

  constructor() {
    this.tokenizer = new Tokenizer();
    this.stemmer = new Stemmer();
  }

  analyze(text: string, options: {
    useStemming?: boolean;
    useStopWords?: boolean;
    preserveCase?: boolean;
    preservePositions?: boolean;
  } = {}): DocumentTerms {
    const {
      useStemming = true,
      useStopWords = true,
      preserveCase = false,
      preservePositions = true
    } = options;

    const tokens = this.tokenizer.tokenize(text, {
      preserveCase,
      removeStopWords: useStopWords,
      preservePositions
    });

    let terms = tokens.map(token => token.text);

    if (useStemming) {
      terms = terms.map(term => this.stemmer.stem(term));
    }

    const termMap = new Map<string, { frequency: number; positions: number[] }>();

    terms.forEach((term, index) => {
      if (term) {
        const current = termMap.get(term) || { frequency: 0, positions: [] };
        current.frequency++;
        current.positions.push(index);
        termMap.set(term, current);
      }
    });

    const termFrequencies: TermFrequency[] = Array.from(termMap.entries())
      .map(([term, data]) => ({
        term,
        frequency: data.frequency,
        positions: data.positions
      }))
      .sort((a, b) => b.frequency - a.frequency);

    const totalTerms = terms.length;
    const uniqueTerms = termMap.size;

    return {
      id: createId(),
      terms: termFrequencies,
      totalTerms,
      uniqueTerms
    };
  }

  calculateTFIDF(documents: DocumentTerms[], term: string): number {
    const termFrequency = documents.reduce((sum, doc) => {
      const termInfo = doc.terms.find(t => t.term === term);
      return sum + (termInfo ? termInfo.frequency : 0);
    }, 0);

    const documentsWithTerm = documents.filter(doc =>
      doc.terms.some(t => t.term === term)
    ).length;

    if (documentsWithTerm === 0) {
      return 0;
    }

    const idf = Math.log(documents.length / documentsWithTerm);
    return termFrequency * idf;
  }

  calculateBM25Score(
    queryTerms: string[],
    document: DocumentTerms,
    k1: number = 1.2,
    b: number = 0.75,
    avgDocLength: number = 0
  ): number {
    if (!avgDocLength) {
      avgDocLength = document.totalTerms;
    }

    let score = 0;

    for (const queryTerm of queryTerms) {
      const termInfo = document.terms.find(t => t.term === queryTerm);
      if (!termInfo) continue;

      const tf = termInfo.frequency;
      const idf = this.calculateBM25IDF(queryTerm, document.terms);

      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (document.totalTerms / avgDocLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  private calculateBM25IDF(term: string, documentTerms: TermFrequency[]): number {
    const docsWithTerm = 1 + Math.floor(Math.random() * 1000);
    const totalDocs = 1000;
    return Math.log((totalDocs - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
  }

  getTermVectors(documents: DocumentTerms[]): Map<string, number[]> {
    const allTerms = new Set<string>();

    documents.forEach(doc => {
      doc.terms.forEach(termFreq => {
        allTerms.add(termFreq.term);
      });
    });

    const termList = Array.from(allTerms);
    const termVectors = new Map<string, number[]>();

    documents.forEach(doc => {
      const vector = termList.map(term => {
        const termFreq = doc.terms.find(t => t.term === term);
        return termFreq ? termFreq.frequency : 0;
      });
      termVectors.set(doc.id, vector);
    });

    return termVectors;
  }
}

function createId(): string {
  return Math.random().toString(36).substr(2, 9);
}