/**
 * Code Embedding Generator
 *
 * Generates embeddings for code chunks with context-aware
 * preprocessing for better semantic search.
 *
 * Performance Targets:
 * - Generate 100 embeddings: <5s (via Workers AI)
 * - Batch processing: ~50ms per chunk
 * - Memory overhead: ~2x embedding size
 */

import type {
  CodeChunk,
  SupportedLanguage,
  EmbeddingGeneratorOptions,
} from './types';
import { EmbeddingService } from '../embeddings';

const DEFAULT_OPTIONS: Required<EmbeddingGeneratorOptions> = {
  model: '@cf/baai/bge-base-en-v1.5',
  includePath: true,
  includeLanguage: true,
  includeSignature: true,
  batchSize: 10,
  ai: undefined as unknown as AiTextEmbeddingsInput,
};

/**
 * Code-specific prompt templates for better embeddings
 */
const CODE_TEMPLATES: Record<SupportedLanguage, string> = {
  typescript: 'TypeScript code:\n{code}',
  javascript: 'JavaScript code:\n{code}',
  python: 'Python code:\n{code}',
  java: 'Java code:\n{code}',
  go: 'Go code:\n{code}',
  rust: 'Rust code:\n{code}',
  cpp: 'C++ code:\n{code}',
  c: 'C code:\n{code}',
  csharp: 'C# code:\n{code}',
  php: 'PHP code:\n{code}',
  ruby: 'Ruby code:\n{code}',
  swift: 'Swift code:\n{code}',
  kotlin: 'Kotlin code:\n{code}',
  scala: 'Scala code:\n{code}',
  markdown: 'Markdown documentation:\n{code}',
  json: 'JSON configuration:\n{code}',
  yaml: 'YAML configuration:\n{code}',
  toml: 'TOML configuration:\n{code}',
  xml: 'XML data:\n{code}',
  html: 'HTML markup:\n{code}',
  css: 'CSS stylesheet:\n{code}',
  shell: 'Shell script:\n{code}',
  sql: 'SQL query:\n{code}',
};

/**
 * Code Embedding Generator
 */
export class CodeEmbeddingGenerator {
  private options: Required<EmbeddingGeneratorOptions>;
  private embeddingService: EmbeddingService;

  constructor(options: EmbeddingGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.embeddingService = new EmbeddingService({
      model: this.options.model,
      ...(options.ai !== undefined && { ai: options.ai }),
    });
  }

  /**
   * Generate embeddings for code chunks
   *
   * @param chunks - Code chunks to embed
   * @returns Chunks with embeddings added
   */
  async generateEmbeddings(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    const startTime = performance.now();

    // Process in batches
    const embeddedChunks: CodeChunk[] = [];
    const batchSize = this.options.batchSize;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embedded = await this.processBatch(batch);
      embeddedChunks.push(...embedded);

      console.debug(`Generated embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }

    const latency = performance.now() - startTime;
    console.debug(`Generated ${chunks.length} embeddings in ${latency.toFixed(2)}ms`);

    return embeddedChunks as CodeChunk[];
  }

  /**
   * Process a batch of chunks
   *
   * @private
   */
  private async processBatch(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    // Prepare texts with context
    const texts = chunks.map(chunk => this.prepareText(chunk));

    // Generate embeddings in parallel
    const embeddings = await this.embeddingService.generateBatch(texts);

    // Add embeddings to chunks
    return chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
      indexedAt: Date.now(),
    })) as CodeChunk[];
  }

  /**
   * Prepare text for embedding with context
   *
   * @private
   */
  private prepareText(chunk: CodeChunk): string {
    let text = chunk.content;

    // Add language context
    if (this.options.includeLanguage) {
      const template = CODE_TEMPLATES[chunk.language] || '{code}';
      text = template.replace('{code}', text);
    }

    // Add file path context
    if (this.options.includePath) {
      const fileName = chunk.filePath.split('/').pop() || chunk.filePath;
      text = `File: ${fileName}\n\n${text}`;
    }

    // Add signature context
    if (this.options.includeSignature && chunk.signature) {
      text = `${chunk.signature}\n\n${text}`;
    }

    // Add function/class name context
    if (chunk.name && !chunk.signature) {
      const typeLabel = chunk.type === 'function' ? 'Function' : chunk.type === 'class' ? 'Class' : 'Code';
      text = `${typeLabel}: ${chunk.name}\n\n${text}`;
    }

    return text;
  }

  /**
   * Generate embedding for a single chunk
   *
   * @param chunk - Code chunk to embed
   * @returns Chunk with embedding
   */
  async generateEmbedding(chunk: CodeChunk): Promise<CodeChunk> {
    const text = this.prepareText(chunk);
    const embedding = await this.embeddingService.generate(text);

    return {
      ...chunk,
      embedding,
      indexedAt: Date.now(),
    };
  }

  /**
   * Regenerate embeddings for chunks
   *
   * @param chunks - Chunks to re-embed
   * @returns Chunks with new embeddings
   */
  async regenerateEmbeddings(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    // Remove existing embeddings by creating new objects without those properties
    const chunksToEmbed = chunks.map(({ embedding, indexedAt, ...rest }) => rest);

    return this.generateEmbeddings(chunksToEmbed);
  }

  /**
   * Generate embedding for search query
   *
   * @param query - Search query
   * @param language - Optional language hint
   * @returns Query embedding
   */
  async generateQueryEmbedding(query: string, language?: SupportedLanguage): Promise<Float32Array> {
    let text = query;

    // Add language context if provided
    if (language && this.options.includeLanguage) {
      const template = CODE_TEMPLATES[language] || '{code}';
      text = template.replace('{code}', query);
    }

    return this.embeddingService.generate(text);
  }

  /**
   * Calculate similarity between two chunks
   *
   * @param chunk1 - First chunk
   * @param chunk2 - Second chunk
   * @returns Similarity score (0-1)
   */
  similarity(chunk1: CodeChunk, chunk2: CodeChunk): number {
    if (!chunk1.embedding || !chunk2.embedding) {
      throw new Error('Both chunks must have embeddings');
    }

    return this.embeddingService.similarity(chunk1.embedding, chunk2.embedding);
  }

  /**
   * Find most similar chunks to a query
   *
   * @param query - Query string
   * @param chunks - Chunks to search
   * @param k - Number of results
   * @returns Top k similar chunks with scores
   */
  async findSimilar(
    query: string,
    chunks: CodeChunk[],
    k: number = 10
  ): Promise<Array<{ chunk: CodeChunk; score: number }>> {
    const queryEmbedding = await this.generateQueryEmbedding(query);

    // Calculate similarities
    const similarities = chunks
      .filter(chunk => chunk.embedding)
      .map(chunk => ({
        chunk,
        score: this.embeddingService.similarity(queryEmbedding, chunk.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return similarities;
  }

  /**
   * Get embedding statistics
   *
   * @param chunks - Chunks to analyze
   * @returns Statistics about embeddings
   */
  getEmbeddingStats(chunks: CodeChunk[]): {
    totalChunks: number;
    embeddedChunks: number;
    dimensions: number;
    avgSimilarity: number;
    model: string;
  } {
    const embeddedChunks = chunks.filter(chunk => chunk.embedding);
    const dimensions = embeddedChunks[0]?.embedding?.length || 0;

    // Calculate average pairwise similarity (sample)
    let totalSimilarity = 0;
    let comparisons = 0;
    const sampleSize = Math.min(embeddedChunks.length, 100);

    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const embI = embeddedChunks[i]!.embedding;
        const embJ = embeddedChunks[j]!.embedding;
        if (embI && embJ) {
          totalSimilarity += this.embeddingService.similarity(
            embI,
            embJ
          );
          comparisons++;
        }
      }
    }

    return {
      totalChunks: chunks.length,
      embeddedChunks: embeddedChunks.length,
      dimensions,
      avgSimilarity: comparisons > 0 ? totalSimilarity / comparisons : 0,
      model: this.options.model,
    };
  }

  /**
   * Update embedding model
   *
   * @param model - New model to use
   */
  updateModel(model: string): void {
    this.options.model = model;
    this.embeddingService = new EmbeddingService({ model });
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.options.model;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.embeddingService.getDimensions();
  }
}

/**
 * Create an embedding generator instance
 */
export function createCodeEmbeddingGenerator(options?: EmbeddingGeneratorOptions): CodeEmbeddingGenerator {
  return new CodeEmbeddingGenerator(options);
}

/**
 * Default embedding generator instance
 */
export const defaultCodeEmbeddingGenerator = new CodeEmbeddingGenerator();
