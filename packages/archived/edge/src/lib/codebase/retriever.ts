/**
 * Code Retriever for RAG
 *
 * Retrieves relevant code chunks and builds context
 * for Retrieval-Augmented Generation.
 *
 * Performance Targets:
 * - Retrieve and build context: <100ms
 * - Format for LLM: <10ms
 * - Handle 10K+ files efficiently
 */

import type {
  CodeChunk,
  ConversationContext,
  RetrievedCode,
  RetrieverOptions,
  ChunkSearchResult,
} from './types';
import { CodeVectorStore } from './vector-store';
import { CodeEmbeddingGenerator } from './embeddings';

const DEFAULT_OPTIONS: Required<RetrieverOptions> = {
  maxChunks: 10,
  maxTokens: 8000,
  minSimilarity: 0.5,
  reranking: 'hybrid',
  includeFileContext: true,
  includeRelated: true,
  contextWindow: 16000,
};

/**
 * Code Retriever
 */
export class CodeRetriever {
  private options: Required<RetrieverOptions>;
  private vectorStore: CodeVectorStore;
  private embeddingGenerator: CodeEmbeddingGenerator;

  constructor(
    vectorStore: CodeVectorStore,
    embeddingGenerator: CodeEmbeddingGenerator,
    options: RetrieverOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.vectorStore = vectorStore;
    this.embeddingGenerator = embeddingGenerator;
  }

  /**
   * Retrieve relevant code for query
   *
   * @param query - Search query
   * @param context - Conversation context
   * @returns Retrieved code with context
   */
  async retrieve(
    query: string,
    context: ConversationContext = { messages: [], currentQuery: query }
  ): Promise<RetrievedCode> {
    const startTime = performance.now();

    // Generate query embedding
    const queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query);

    // Perform semantic search
    let results = await this.vectorStore.search(
      queryEmbedding,
      this.options.maxChunks * 2, // Get more for reranking
      this.buildFilters(context)
    );

    // Filter by minimum similarity
    results = results.filter(r => r.similarity >= this.options.minSimilarity);

    // Rerank based on strategy
    results = await this.rankChunks(results, query, context);

    // Limit to max chunks
    results = results.slice(0, this.options.maxChunks);

    // Include related chunks if enabled
    if (this.options.includeRelated) {
      results = await this.includeRelatedChunks(results);
    }

    // Build context from retrieved chunks
    const formattedContext = this.buildContext(results.map(r => r.chunk));

    // Calculate metadata
    const totalTokens = this.estimateTokens(formattedContext);
    const fileCount = new Set(results.map(r => r.chunk.filePath)).size;

    const latency = performance.now() - startTime;

    return {
      chunks: results.map(r => r.chunk),
      context: formattedContext,
      metadata: {
        totalTokens,
        fileCount,
        chunkCount: results.length,
        averageRelevance: results.reduce((sum, r) => sum + r.similarity, 0) / results.length,
        retrievalTime: latency,
      },
    };
  }

  /**
   * Retrieve with hybrid search
   *
   * @param query - Search query
   * @param context - Conversation context
   * @returns Retrieved code with context
   */
  async retrieveHybrid(
    query: string,
    context: ConversationContext = { messages: [], currentQuery: query }
  ): Promise<RetrievedCode> {
    const startTime = performance.now();

    // Generate query embedding
    const queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query);

    // Perform hybrid search
    let results = await this.vectorStore.hybridSearch(
      query,
      queryEmbedding,
      this.options.maxChunks * 2,
      this.buildFilters(context)
    );

    // Filter by minimum similarity (for semantic results)
    results = results.filter(r => r.similarity >= this.options.minSimilarity || r.score > 0);

    // Rerank based on strategy
    results = await this.rankChunks(results, query, context);

    // Limit to max chunks
    results = results.slice(0, this.options.maxChunks);

    // Build context
    const formattedContext = this.buildContext(results.map(r => r.chunk));

    // Calculate metadata
    const totalTokens = this.estimateTokens(formattedContext);
    const fileCount = new Set(results.map(r => r.chunk.filePath)).size;

    const latency = performance.now() - startTime;

    return {
      chunks: results.map(r => r.chunk),
      context: formattedContext,
      metadata: {
        totalTokens,
        fileCount,
        chunkCount: results.length,
        averageRelevance: results.reduce((sum, r) => sum + r.score, 0) / results.length,
        retrievalTime: latency,
      },
    };
  }

  /**
   * Rank chunks by relevance and recency
   *
   * @private
   */
  private async rankChunks(
    results: ChunkSearchResult[],
    query: string,
    context: ConversationContext
  ): Promise<ChunkSearchResult[]> {
    switch (this.options.reranking) {
      case 'similarity':
        return results.sort((a, b) => b.similarity - a.similarity);

      case 'recency':
        return results.sort((a, b) => (b.chunk.indexedAt || 0) - (a.chunk.indexedAt || 0));

      case 'hybrid':
        return this.hybridRerank(results, query, context);

      default:
        return results;
    }
  }

  /**
   * Hybrid reranking combining multiple signals
   *
   * @private
   */
  private hybridRerank(
    results: ChunkSearchResult[],
    query: string,
    context: ConversationContext
  ): ChunkSearchResult[] {
    // Boost scores based on multiple factors
    const scored = results.map(result => {
      let score = result.score;

      // Semantic similarity boost
      score += result.similarity * 0.5;

      // File context boost (if previously accessed)
      if (context.relevantFiles?.includes(result.chunk.filePath)) {
        score *= 1.2; // 20% boost
      }

      // Chunk type boost (functions/classes are more relevant)
      if (result.chunk.type === 'function' || result.chunk.type === 'class') {
        score *= 1.1; // 10% boost
      }

      // Exported items boost
      if (result.chunk.exports.length > 0) {
        score *= 1.05; // 5% boost
      }

      // Query term matching boost
      const queryTerms = query.toLowerCase().split(/\s+/);
      const content = result.chunk.content.toLowerCase();
      const name = result.chunk.name?.toLowerCase() || '';

      for (const term of queryTerms) {
        if (name.includes(term)) {
          score *= 1.15; // 15% boost for name matches
        } else if (content.includes(term)) {
          score *= 1.05; // 5% boost for content matches
        }
      }

      return { ...result, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Include related chunks based on dependencies
   *
   * @private
   */
  private async includeRelatedChunks(results: ChunkSearchResult[]): Promise<ChunkSearchResult[]> {
    const additionalChunks: ChunkSearchResult[] = [];
    const processed = new Set(results.map(r => r.chunk.id));

    for (const result of results) {
      const related = await this.vectorStore.getRelated(result.chunk.id, 1);

      for (const relatedChunk of related) {
        if (processed.has(relatedChunk.id)) continue;

        processed.add(relatedChunk.id);
        additionalChunks.push({
          chunk: relatedChunk,
          similarity: result.similarity * 0.8, // Lower score for dependencies
          score: result.score * 0.8,
          rank: results.length + additionalChunks.length,
        });
      }
    }

    // Re-sort and limit
    const allResults = [...results, ...additionalChunks];
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxChunks);
  }

  /**
   * Build context from retrieved chunks
   *
   * @private
   */
  private buildContext(chunks: CodeChunk[]): string {
    if (chunks.length === 0) {
      return '// No relevant code found';
    }

    const sections: string[] = [];

    // Group by file
    const byFile = new Map<string, CodeChunk[]>();
    for (const chunk of chunks) {
      if (!byFile.has(chunk.filePath)) {
        byFile.set(chunk.filePath, []);
      }
      byFile.get(chunk.filePath)!.push(chunk);
    }

    // Build context sections
    for (const [filePath, fileChunks] of byFile) {
      const fileName = filePath.split('/').pop() || filePath;

      if (this.options.includeFileContext) {
        sections.push(`\n// File: ${fileName}`);
        sections.push(`// Path: ${filePath}\n`);
      }

      // Sort chunks by line number
      fileChunks.sort((a, b) => a.startLine - b.startLine);

      for (const chunk of fileChunks) {
        sections.push(this.formatChunk(chunk));
      }
    }

    return sections.join('\n');
  }

  /**
   * Format chunk for LLM consumption
   *
   * @private
   */
  private formatChunk(chunk: CodeChunk): string {
    const lines: string[] = [];

    // Add chunk header
    if (chunk.name) {
      const typeLabel = chunk.type === 'function' ? 'Function' : chunk.type === 'class' ? 'Class' : 'Code';
      lines.push(`// ${typeLabel}: ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})`);
    } else {
      lines.push(`// Code (lines ${chunk.startLine}-${chunk.endLine})`);
    }

    // Add signature if available
    if (chunk.signature) {
      lines.push(`// ${chunk.signature}`);
    }

    // Add content
    lines.push(chunk.content);

    return lines.join('\n');
  }

  /**
   * Build filters from conversation context
   *
   * @private
   */
  private buildFilters(context: ConversationContext) {
    const filters: any = {};

    if (context.relevantFiles && context.relevantFiles.length > 0) {
      filters.filePaths = context.relevantFiles;
    }

    // Could add more filters based on conversation history
    // For example, if user asked about "TypeScript code", filter by language

    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  /**
   * Estimate token count for text
   *
   * @private
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Format retrieved code for LLM with template
   *
   * @param retrieved - Retrieved code
   * @param template - Optional template
   * @returns Formatted string
   */
  formatForLLM(retrieved: RetrievedCode, template?: string): string {
    const defaultTemplate = `<context>
Relevant code from the codebase:

{context}

Metadata:
- Files: {fileCount}
- Chunks: {chunkCount}
- Tokens: {totalTokens}
- Average relevance: {averageRelevance:.2f}
</context>`;

    const tmpl = template || defaultTemplate;

    return tmpl
      .replace('{context}', retrieved.context)
      .replace('{fileCount}', retrieved.metadata.fileCount.toString())
      .replace('{chunkCount}', retrieved.metadata.chunkCount.toString())
      .replace('{totalTokens}', retrieved.metadata.totalTokens.toString())
      .replace('{averageRelevance}', retrieved.metadata.averageRelevance.toFixed(2));
  }

  /**
   * Retrieve with streaming support (for large codebases)
   *
   * @param query - Search query
   * @param context - Conversation context
   * @param onChunk - Callback for each retrieved chunk
   */
  async retrieveStream(
    query: string,
    context: ConversationContext,
    onChunk: (chunk: CodeChunk) => void
  ): Promise<RetrievedCode> {
    const startTime = performance.now();

    // Generate query embedding
    const queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query);

    // Perform search
    const results = await this.vectorStore.search(
      queryEmbedding,
      this.options.maxChunks,
      this.buildFilters(context)
    );

    // Stream chunks
    const chunks: CodeChunk[] = [];
    for (const result of results) {
      if (result.similarity >= this.options.minSimilarity) {
        onChunk(result.chunk);
        chunks.push(result.chunk);

        // Check token limit
        const currentTokens = this.estimateTokens(this.buildContext(chunks));
        if (currentTokens >= this.options.maxTokens) {
          break;
        }
      }
    }

    // Build final context
    const formattedContext = this.buildContext(chunks);
    const totalTokens = this.estimateTokens(formattedContext);
    const fileCount = new Set(chunks.map(c => c.filePath)).size;
    const latency = performance.now() - startTime;

    return {
      chunks,
      context: formattedContext,
      metadata: {
        totalTokens,
        fileCount,
        chunkCount: chunks.length,
        averageRelevance: results
          .slice(0, chunks.length)
          .reduce((sum, r) => sum + r.similarity, 0) / chunks.length,
        retrievalTime: latency,
      },
    };
  }

  /**
   * Update retriever options
   */
  updateOptions(options: Partial<RetrieverOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): RetrieverOptions {
    return { ...this.options };
  }
}

/**
 * Create a code retriever instance
 */
export function createCodeRetriever(
  vectorStore: CodeVectorStore,
  embeddingGenerator: CodeEmbeddingGenerator,
  options?: RetrieverOptions
): CodeRetriever {
  return new CodeRetriever(vectorStore, embeddingGenerator, options);
}
