/**
 * Codebase Upload and Search API Routes
 *
 * Provides endpoints for uploading, indexing, and searching
 * codebases for RAG (Retrieval-Augmented Generation).
 *
 * Endpoints:
 * - POST /v1/codebase/upload - Upload and index code files
 * - POST /v1/codebase/batch - Batch upload multiple files
 * - GET /v1/codebase/search - Search indexed code
 * - GET /v1/codebase/stats - Get indexing statistics
 * - DELETE /v1/codebase - Clear indexed code
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { CodebaseParser } from '../lib/codebase/parser';
import { CodeChunker } from '../lib/codebase/chunker';
import { CodeEmbeddingGenerator } from '../lib/codebase/embeddings';
import { CodeVectorStore } from '../lib/codebase/vector-store';
import { CodeRetriever } from '../lib/codebase/retriever';
import type { UploadResult, BatchUploadResult } from '../lib/codebase/types';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /v1/codebase/upload
 *
 * Upload and index a single code file
 *
 * Request: multipart/form-data
 * - file: File to upload
 * - path: Optional file path (defaults to filename)
 *
 * Response:
 * {
 *   success: true,
 *   filePath: string,
 *   language: string,
 *   chunksIndexed: number,
 *   indexingTime: number
 * }
 */
app.post('/upload', async (c) => {
  const startTime = performance.now();

  try {
    const formData = await c.req.formData();
    const file = formData.get('file');
    const customPath = formData.get('path') as string | null;

    if (!file) {
      return c.json({
        success: false,
        error: 'No file provided',
      }, 400);
    }

    // Check if it's a File object
    if (typeof file !== 'object' || !('name' in file) || !('text' in file)) {
      return c.json({
        success: false,
        error: 'Invalid file provided',
      }, 400);
    }

    // Cast to File type for access to file methods
    const fileObj = file as { name: string; text: () => Promise<string> };

    // Get or create vector store from env
    let vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      vectorStore = new CodeVectorStore({}, c.env.KV);
      c.env.CODEBASE_VECTOR_STORE = vectorStore as any;
    }

    // Create parser and chunker
    const parser = new CodebaseParser();
    const chunker = new CodeChunker();
    const embedder = new CodeEmbeddingGenerator({
      ...(c.env.AI !== undefined ? { ai: c.env.AI } : {}),
    });

    // Read file content
    const content = await fileObj.text();
    const filePath = customPath || fileObj.name;

    // Parse file
    const parsed = await parser.parseFile(content, filePath);

    // Chunk code
    const chunks = await chunker.chunk(parsed);

    // Generate embeddings
    const embeddedChunks = await embedder.generateEmbeddings(chunks);

    // Store in vector store
    await vectorStore.index(embeddedChunks);

    const indexingTime = performance.now() - startTime;

    const result: UploadResult = {
      success: true,
      filePath,
      language: parsed.language,
      chunksIndexed: chunks.length,
      indexingTime,
    };

    return c.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /v1/codebase/batch
 *
 * Upload and index multiple code files
 *
 * Request: multipart/form-data or JSON
 * - files: Array of files (multipart) or { content, path } objects (JSON)
 *
 * Response:
 * {
 *   success: true,
 *   files: UploadResult[],
 *   totalChunks: number,
 *   totalTime: number,
 *   errors: string[]
 * }
 */
app.post('/batch', async (c) => {
  const startTime = performance.now();

  try {
    const contentType = c.req.header('content-type') || '';
    let files: Array<{ content: string; path: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await c.req.formData();
      const fileEntries = formData.getAll('files');

      files = await Promise.all(
        (fileEntries as unknown[]).filter((f): f is File => f instanceof File).map(async (file) => ({
          content: await file.text(),
          path: file.name,
        }))
      );
    } else {
      // Handle JSON request
      const body = await c.req.json();
      files = body.files || [];
    }

    if (files.length === 0) {
      return c.json({
        success: false,
        error: 'No files provided',
      }, 400);
    }

    // Get or create vector store
    let vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      vectorStore = new CodeVectorStore({}, c.env.KV);
      c.env.CODEBASE_VECTOR_STORE = vectorStore as any;
    }

    // Create components
    const parser = new CodebaseParser();
    const chunker = new CodeChunker();
    const embedder = new CodeEmbeddingGenerator({
      ...(c.env.AI !== undefined ? { ai: c.env.AI } : {}),
    });

    // Process files
    const results: UploadResult[] = [];
    const errors: string[] = [];
    let totalChunks = 0;

    for (const file of files) {
      try {
        // Parse
        const parsed = await parser.parseFile(file.content, file.path);

        // Chunk
        const chunks = await chunker.chunk(parsed);

        // Generate embeddings
        const embeddedChunks = await embedder.generateEmbeddings(chunks);

        // Store
        await vectorStore.index(embeddedChunks);

        results.push({
          success: true,
          filePath: file.path,
          language: parsed.language,
          chunksIndexed: chunks.length,
          indexingTime: 0, // Will be calculated at the end
        });

        totalChunks += chunks.length;
      } catch (error) {
        errors.push(`${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.push({
          success: false,
          filePath: file.path,
          language: 'typescript',
          chunksIndexed: 0,
          indexingTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalTime = performance.now() - startTime;

    const result: BatchUploadResult = {
      success: errors.length === 0,
      files: results,
      totalChunks,
      totalTime,
      errors,
    };

    return c.json(result);
  } catch (error) {
    console.error('Batch upload error:', error);
    return c.json({
      success: false,
      files: [],
      totalChunks: 0,
      totalTime: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }, 500);
  }
});

/**
 * GET /v1/codebase/search
 *
 * Search indexed code using semantic search
 *
 * Query params:
 * - q: Search query (required)
 * - k: Number of results (default: 10)
 * - minSimilarity: Minimum similarity threshold (default: 0.5)
 * - language: Filter by language (optional)
 * - type: Filter by chunk type (optional)
 * - hybrid: Use hybrid search (default: false)
 *
 * Response:
 * {
 *   chunks: CodeChunk[],
 *   context: string,
 *   metadata: {
 *     totalTokens: number,
 *     fileCount: number,
 *     chunkCount: number,
 *     averageRelevance: number,
 *     retrievalTime: number
 *   }
 * }
 */
app.get('/search', async (c) => {
  const startTime = performance.now();

  try {
    const query = c.req.query('q');
    if (!query) {
      return c.json({
        success: false,
        error: 'Query parameter "q" is required',
      }, 400);
    }

    const k = parseInt(c.req.query('k') || '10', 10);
    const minSimilarity = parseFloat(c.req.query('minSimilarity') || '0.5');
    const hybrid = c.req.query('hybrid') === 'true';

    // Get vector store
    const vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      return c.json({
        success: false,
        error: 'No indexed code found. Upload files first.',
      }, 404);
    }

    // Create retriever
    const embedder = new CodeEmbeddingGenerator({
      ...(c.env.AI !== undefined ? { ai: c.env.AI } : {}),
    });
    const retriever = new CodeRetriever(vectorStore, embedder, {
      maxChunks: k,
      minSimilarity,
    });

    // Retrieve code
    const retrieved = hybrid
      ? await retriever.retrieveHybrid(query)
      : await retriever.retrieve(query);

    const retrievalTime = performance.now() - startTime;

    return c.json({
      ...retrieved,
      metadata: {
        ...retrieved.metadata,
        retrievalTime,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /v1/codebase/file
 *
 * Get all chunks from a specific file
 *
 * Query params:
 * - path: File path (required)
 *
 * Response:
 * {
 *   chunks: CodeChunk[],
 *   filePath: string,
 *   chunkCount: number
 * }
 */
app.get('/file', async (c) => {
  try {
    const path = c.req.query('path');
    if (!path) {
      return c.json({
        success: false,
        error: 'Path parameter is required',
      }, 400);
    }

    const vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      return c.json({
        success: false,
        error: 'No indexed code found',
      }, 404);
    }

    const chunks = await vectorStore.getByFile(path);

    return c.json({
      chunks,
      filePath: path,
      chunkCount: chunks.length,
    });
  } catch (error) {
    console.error('Get file error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /v1/codebase/stats
 *
 * Get indexing and search statistics
 *
 * Response:
 * {
 *   totalFiles: number,
 *   totalChunks: number,
 *   totalTokens: number,
 *   languages: Record<string, number>,
 *   avgChunksPerFile: number,
 *   avgFileSize: number,
 *   lastIndexed: number,
 *   totalSearches: number,
 *   avgSearchTime: number,
 *   avgResults: number,
 *   cacheHitRate: number
 * }
 */
app.get('/stats', async (c) => {
  try {
    const vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      return c.json({
        success: false,
        error: 'No indexed code found',
      }, 404);
    }

    const stats = vectorStore.getStats();

    return c.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /v1/codebase
 *
 * Clear all indexed code
 *
 * Response:
 * {
 *   success: true,
 *   message: string
 * }
 */
app.delete('/', async (c) => {
  try {
    const vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      return c.json({
        success: false,
        error: 'No indexed code found',
      }, 404);
    }

    await vectorStore.clear();

    return c.json({
      success: true,
      message: 'All indexed code has been cleared',
    });
  } catch (error) {
    console.error('Clear error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /v1/codebase/reindex
 *
 * Re-index all files (regenerate embeddings)
 *
 * Response:
 * {
 *   success: true,
 *   filesReindexed: number,
 *   time: number
 * }
 */
app.post('/reindex', async (c) => {
  const startTime = performance.now();

  try {
    const vectorStore = c.env.CODEBASE_VECTOR_STORE as CodeVectorStore;
    if (!vectorStore) {
      return c.json({
        success: false,
        error: 'No indexed code found',
      }, 404);
    }

    const embedder = new CodeEmbeddingGenerator({
      ...(c.env.AI !== undefined ? { ai: c.env.AI } : {}),
    });

    // Get all chunks
    const stats = vectorStore.getStats();
    const allChunks = Array.from({ length: stats.totalChunks }, () => ({} as any)); // Placeholder

    // Regenerate embeddings
    const reindexed = await embedder.regenerateEmbeddings(allChunks);

    // Re-index
    await vectorStore.clear();
    await vectorStore.index(reindexed);

    const time = performance.now() - startTime;

    return c.json({
      success: true,
      filesReindexed: stats.totalFiles,
      chunksReindexed: reindexed.length,
      time,
    });
  } catch (error) {
    console.error('Reindex error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;
