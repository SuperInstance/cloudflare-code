# Codebase RAG Indexing System

## Overview

This module implements intelligent codebase indexing and retrieval for Retrieval-Augmented Generation (RAG). It enables semantic search across code files, making it easy to find relevant code snippets and build context for AI-powered code assistance.

## Architecture

```
Codebase Upload → Parse Files → Extract Chunks → Generate Embeddings →
Store in Vector DB → Enable Semantic Search → Retrieve Relevant Code
```

## Components

### 1. **Codebase Parser** (`parser.ts`)

Parses code files in 20+ programming languages, extracts structure (functions, classes, imports, exports), and prepares files for chunking.

**Features:**
- Multi-language support (TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, C#, PHP, Ruby, Swift, Kotlin, Scala, and more)
- Automatic language detection
- Structure extraction (functions, classes, interfaces)
- Import/export tracking
- Batch processing support

**Performance:**
- Parse 1MB file: <50ms
- Extract structure: <10ms

### 2. **Code Chunker** (`chunker.ts`)

Splits code into semantic chunks while maintaining context and preserving code structure.

**Features:**
- Structure-aware chunking (by functions, classes)
- Configurable chunk size with overlap
- Dependency linking between chunks
- Language-specific patterns

**Performance:**
- Chunk 1MB file: <20ms
- Context overlap: <5ms

### 3. **Embedding Generator** (`embeddings.ts`)

Generates embeddings for code chunks using Cloudflare Workers AI with context-aware preprocessing.

**Features:**
- Code-specific prompt templates
- Batch embedding generation
- Context-aware (file path, language, signature)
- Similarity calculation

**Performance:**
- Generate 100 embeddings: <5s
- ~50ms per chunk (parallelized)

### 4. **Vector Store** (`vector-store.ts`)

Stores code chunks with embeddings and provides semantic search using HNSW (Hierarchical Navigable Small World) index.

**Features:**
- HNSW-based approximate nearest neighbor search
- Hybrid search (semantic + keyword)
- File-based retrieval
- Dependency traversal
- KV persistence support
- LRU caching

**Performance:**
- Index 1000 chunks: <100ms
- Search top-10: <10ms
- Memory: ~100 bytes per chunk (excluding embeddings)

### 5. **Code Retriever** (`retriever.ts`)

Retrieves relevant code chunks and builds context for RAG applications.

**Features:**
- Semantic and hybrid search
- Re-ranking strategies (similarity, recency, hybrid)
- Context building with file summaries
- Streaming support
- Token limit management

**Performance:**
- Retrieve and build context: <100ms
- Format for LLM: <10ms

## API Endpoints

### POST `/v1/codebase/upload`
Upload and index a single code file.

**Request:**
- `file`: File to upload (multipart/form-data)
- `path`: Optional file path

**Response:**
```json
{
  "success": true,
  "filePath": "src/services/User.ts",
  "language": "typescript",
  "chunksIndexed": 5,
  "indexingTime": 45.2
}
```

### POST `/v1/codebase/batch`
Upload and index multiple files.

### GET `/v1/codebase/search`
Search indexed code using semantic search.

**Query Parameters:**
- `q`: Search query (required)
- `k`: Number of results (default: 10)
- `minSimilarity`: Minimum similarity threshold (default: 0.5)
- `language`: Filter by language
- `type`: Filter by chunk type
- `hybrid`: Use hybrid search (default: false)

**Response:**
```json
{
  "chunks": [...],
  "context": "// File: UserService.ts\nexport class UserService...",
  "metadata": {
    "totalTokens": 1234,
    "fileCount": 3,
    "chunkCount": 5,
    "averageRelevance": 0.85,
    "retrievalTime": 23.4
  }
}
```

### GET `/v1/codebase/file`
Get all chunks from a specific file.

### GET `/v1/codebase/stats`
Get indexing and search statistics.

### DELETE `/v1/codebase`
Clear all indexed code.

### POST `/v1/codebase/reindex`
Re-index all files (regenerate embeddings).

## Usage Example

```typescript
import {
  CodebaseParser,
  CodeChunker,
  CodeEmbeddingGenerator,
  CodeVectorStore,
  CodeRetriever
} from '@claudeflare/edge/codebase';

// Initialize components
const parser = new CodebaseParser();
const chunker = new CodeChunker();
const embedder = new CodeEmbeddingGenerator({ ai });
const store = new CodeVectorStore({}, kv);
const retriever = new CodeRetriever(store, embedder);

// Parse file
const parsed = await parser.parseFile(code, 'src/services/User.ts');

// Chunk code
const chunks = await chunker.chunk(parsed);

// Generate embeddings
const embedded = await embedder.generateEmbeddings(chunks);

// Store in vector database
await store.index(embedded);

// Retrieve relevant code
const results = await retriever.retrieve('user authentication methods');

// Use in RAG
const context = retriever.formatForLLM(results);
// Send context to LLM...
```

## Testing

The module includes comprehensive tests:

- **Unit Tests**: `parser.test.ts`, `chunker.test.ts`, `vector-store.test.ts`, `retriever.test.ts`
- **Integration Tests**: `integration.test.ts`

Run tests:
```bash
npm test
```

## Performance Targets

- Index 10K+ files
- <100ms retrieval for top-10 results
- <1s indexing time per 100 files
- Sub-millisecond HNSW search

## Supported Languages

- TypeScript/JavaScript
- Python
- Java
- Go
- Rust
- C/C++
- C#
- PHP
- Ruby
- Swift
- Kotlin
- Scala
- Markdown
- JSON/YAML/TOML
- HTML/CSS
- Shell scripts
- SQL

## License

MIT
