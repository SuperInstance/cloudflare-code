/**
 * Basic Usage Example for Context Management Package
 */

import {
  ContextManager,
  MemoryStore,
  ContextCompressor,
  ContextOptimizer,
  RAGEngine,
  CrossSessionManager,
} from '../src';

// ========================================================================
// Context Manager Example
// ========================================================================

async function contextManagerExample() {
  console.log('=== Context Manager Example ===\n');

  // Create context manager
  const manager = new ContextManager({
    maxTokens: 200000,
    reservedTokens: 10000,
    compressionEnabled: true,
  });

  // Create a new conversation context
  const context = await manager.createContext('user-123', {
    title: 'AI Assistant Conversation',
    tags: ['support', 'technical'],
  });

  console.log(`Created context: ${context.sessionId}`);

  // Add messages to the conversation
  await manager.addMessages(context.sessionId, [
    {
      role: 'system',
      content: 'You are a helpful AI assistant specialized in technical support.',
    },
    {
      role: 'user',
      content: 'How do I install TypeScript?',
    },
    {
      role: 'assistant',
      content:
        'You can install TypeScript globally using npm: npm install -g typescript',
    },
    {
      role: 'user',
      content: 'What about the type definitions?',
    },
  ]);

  // Get current context
  const currentContext = await manager.getContext(context.sessionId);
  console.log(`Total messages: ${currentContext.messages.length}`);

  // Check token usage
  const usage = manager.getTokenUsage(context.sessionId);
  console.log(`Token usage: ${usage.current}/${usage.max} (${usage.percentage.toFixed(2)}%)`);

  // Get last messages
  const lastMessages = await manager.getLastMessages(context.sessionId, 2);
  console.log(`Last ${lastMessages.length} messages:`);
  lastMessages.forEach(msg => {
    console.log(`  ${msg.role}: ${msg.content.substring(0, 50)}...`);
  });
}

// ========================================================================
// Memory Store Example
// ========================================================================

async function memoryStoreExample() {
  console.log('\n=== Memory Store Example ===\n');

  const store = new MemoryStore({
    maxSize: 10000,
    forgettingEnabled: true,
  });

  // Create episodic memory
  const episodic = await store.createEpisodicMemory(
    'User asked about TypeScript installation and type definitions',
    Date.now(),
    {
      userId: 'user-123',
      participants: ['user-123', 'assistant'],
      emotions: ['curious', 'helpful'],
    }
  );

  console.log(`Created episodic memory: ${episodic.id}`);

  // Create semantic memory
  const semantic = await store.createSemanticMemory(
    'TypeScript installation knowledge',
    [
      {
        id: 'fact-1',
        statement: 'TypeScript can be installed via npm',
        confidence: 1.0,
      },
      {
        id: 'fact-2',
        statement: 'Type definitions are installed via @types packages',
        confidence: 0.9,
      },
    ],
    [],
    {
      userId: 'user-123',
      categories: ['typescript', 'installation', 'npm'],
    }
  );

  console.log(`Created semantic memory: ${semantic.id}`);

  // Create procedural memory
  const procedural = await store.createProceduralMemory(
    'How to install TypeScript and type definitions',
    [
      { order: 1, action: 'Install TypeScript globally' },
      { order: 2, action: 'Initialize project with tsc --init' },
      { order: 3, action: 'Install type definitions for dependencies' },
    ],
    ['typescript', 'installation', 'setup'],
    ['TypeScript project ready for development']
  );

  console.log(`Created procedural memory: ${procedural.id}`);

  // Retrieve memories
  const episodicMemories = await store.getEpisodicMemories('user-123');
  console.log(`\nRetrieved ${episodicMemories.length} episodic memories`);

  const semanticMemories = await store.getSemanticMemories('typescript');
  console.log(`Retrieved ${semanticMemories.length} semantic memories`);

  // Search memories
  const searchResults = await store.keywordSearch('TypeScript installation', 5);
  console.log(`\nFound ${searchResults.length} memories matching query`);
}

// ========================================================================
// Context Compression Example
// ========================================================================

async function compressionExample() {
  console.log('\n=== Context Compression Example ===\n');

  const compressor = new ContextCompressor({
    level: 'medium',
    strategy: 'hybrid',
    targetRatio: 0.4,
  });

  // Create a large conversation
  const messages = [];
  for (let i = 0; i < 100; i++) {
    if (i % 2 === 0) {
      messages.push({
        id: `msg-${i}`,
        role: 'user' as const,
        content: `User question ${i}: What can you tell me about topic ${i}?`,
        timestamp: Date.now() - (100 - i) * 1000,
      });
    } else {
      messages.push({
        id: `msg-${i}`,
        role: 'assistant' as const,
        content: `Assistant response ${i}: Here's detailed information about topic ${i - 1}...`,
        timestamp: Date.now() - (100 - i) * 1000,
      });
    }
  }

  console.log(`Original conversation: ${messages.length} messages`);

  // Compress the conversation
  const result = await compressor.compress(messages);

  console.log(`Compressed to: ${result.compressed.length} messages`);
  console.log(`Compression ratio: ${(result.ratio * 100).toFixed(2)}%`);
  console.log(`Tokens saved: ${result.tokensSaved}`);
  console.log(`Quality score: ${(result.quality * 100).toFixed(2)}%`);

  // Extract key points
  console.log(`\nKey points extracted: ${result.metadata.keyPoints.length}`);
  result.metadata.keyPoints.slice(0, 3).forEach((point, i) => {
    console.log(`  ${i + 1}. ${point.substring(0, 80)}...`);
  });
}

// ========================================================================
// Context Optimizer Example
// ========================================================================

async function optimizerExample() {
  console.log('\n=== Context Optimizer Example ===\n');

  const optimizer = new ContextOptimizer({
    maxTokens: 10000,
    priorityStrategy: 'hybrid',
    relevanceThreshold: 0.5,
  });

  // Create a conversation
  const messages = [
    {
      id: '1',
      role: 'system' as const,
      content: 'You are a helpful AI assistant.',
      timestamp: Date.now() - 5000,
    },
    {
      id: '2',
      role: 'user' as const,
      content: 'What is machine learning?',
      timestamp: Date.now() - 4000,
    },
    {
      id: '3',
      role: 'assistant' as const,
      content:
        'Machine learning is a subset of AI that focuses on algorithms that learn from data.',
      timestamp: Date.now() - 3000,
    },
    {
      id: '4',
      role: 'user' as const,
      content: 'Tell me about deep learning.',
      timestamp: Date.now() - 2000,
    },
    {
      id: '5',
      role: 'assistant' as const,
      content:
        'Deep learning uses neural networks with multiple layers to model complex patterns.',
      timestamp: Date.now() - 1000,
    },
    {
      id: '6',
      role: 'user' as const,
      content: 'What about reinforcement learning?',
      timestamp: Date.now(),
    },
  ];

  // Optimize for a specific query
  const result = await optimizer.optimize(messages, 'machine learning algorithms');

  console.log(`Optimization results:`);
  console.log(`  Included: ${result.included.length} messages`);
  console.log(`  Excluded: ${result.excluded.length} messages`);
  console.log(`  Compressed: ${result.compressed.length} messages`);
  console.log(`  Total tokens: ${result.totalTokens}`);

  // Quality metrics
  console.log(`\nQuality metrics:`);
  console.log(`  Overall score: ${(result.qualityScore * 100).toFixed(2)}%`);
  console.log(`  Coverage: ${(result.coverage * 100).toFixed(2)}%`);
  console.log(`  Diversity: ${(result.diversity * 100).toFixed(2)}%`);
}

// ========================================================================
// RAG Engine Example
// ========================================================================

async function ragEngineExample() {
  console.log('\n=== RAG Engine Example ===\n');

  const rag = new RAGEngine({
    chunkSize: 512,
    chunkOverlap: 50,
    retrievalStrategy: 'hybrid',
  });

  // Add documents
  const docs = await rag.addDocuments([
    {
      content:
        'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
      metadata: {
        source: 'typescript-docs',
        title: 'Introduction to TypeScript',
        tags: ['typescript', 'programming'],
      },
    },
    {
      content:
        'React is a JavaScript library for building user interfaces. It lets you compose complex UIs from small and isolated pieces of code called components.',
      metadata: {
        source: 'react-docs',
        title: 'Introduction to React',
        tags: ['react', 'javascript', 'ui'],
      },
    },
    {
      content:
        'Node.js is a JavaScript runtime built on Chrome V8 engine. It allows you to run JavaScript outside of a browser.',
      metadata: {
        source: 'nodejs-docs',
        title: 'Introduction to Node.js',
        tags: ['nodejs', 'javascript', 'backend'],
      },
    },
  ]);

  console.log(`Added ${docs.length} documents to RAG engine`);

  // Retrieve relevant chunks
  const retrieval = await rag.retrieve({
    query: 'TypeScript programming language',
    limit: 3,
  });

  console.log(`\nRetrieved ${retrieval.chunks.length} chunks`);
  console.log(`Query: "${retrieval.query}"`);
  console.log(`Retrieval time: ${retrieval.retrievalTime}ms`);

  retrieval.chunks.forEach((result, i) => {
    console.log(`\nResult ${i + 1}:`);
    console.log(`  Score: ${result.score.toFixed(3)}`);
    console.log(`  Content: ${result.chunk.content.substring(0, 100)}...`);
  });

  // Get statistics
  const stats = rag.getStats();
  console.log(`\nRAG Engine Statistics:`);
  console.log(`  Documents: ${stats.documentCount}`);
  console.log(`  Chunks: ${stats.chunkCount}`);
  console.log(`  Total tokens: ${stats.totalTokens}`);
}

// ========================================================================
// Cross-Session Management Example
// ========================================================================

async function crossSessionExample() {
  console.log('\n=== Cross-Session Management Example ===\n');

  const sessionManager = new CrossSessionManager({
    persistenceEnabled: true,
    linkingEnabled: true,
    sharingEnabled: true,
  });

  const contextManager = new ContextManager();

  // Create first session
  const context1 = await contextManager.createContext('user-session1');
  await contextManager.addMessages(context1.sessionId, [
    { role: 'user', content: 'Let discuss machine learning' },
    {
      role: 'assistant',
      content: 'Great! What aspect of ML interests you?',
    },
  ]);

  const session1 = await sessionManager.createSession(context1, {
    title: 'Machine Learning Discussion',
  });

  console.log(`Created session 1: ${session1.id}`);

  // Create second session
  const context2 = await contextManager.createContext('user-session1');
  await contextManager.addMessages(context2.sessionId, [
    { role: 'user', content: 'Continue our ML discussion' },
    {
      role: 'assistant',
      content: 'Let me recall our previous conversation.',
    },
  ]);

  const session2 = await sessionManager.createSession(context2, {
    title: 'ML Follow-up',
  });

  console.log(`Created session 2: ${session2.id}`);

  // Link sessions
  const link = await sessionManager.linkSessions(
    session1.id,
    session2.id,
    'followup',
    0.8
  );

  console.log(`\nLinked sessions with type: ${link.type}`);

  // Share session
  await sessionManager.shareSession(session1.id, ['collaborator-1', 'collaborator-2'], 'read');

  console.log(`Shared session 1 with collaborators`);

  // Get session statistics
  const stats = sessionManager.getStats('user-session1');
  console.log(`\nSession statistics:`);
  console.log(`  Total sessions: ${stats.totalSessions}`);
  console.log(`  Active sessions: ${stats.activeSessions}`);
  console.log(`  Total links: ${stats.totalLinks}`);
}

// ========================================================================
// Complete Workflow Example
// ========================================================================

async function completeWorkflowExample() {
  console.log('\n=== Complete Workflow Example ===\n');

  // Initialize all components
  const contextManager = new ContextManager();
  const memoryStore = new MemoryStore();
  const compressor = new ContextCompressor();
  const optimizer = new ContextOptimizer();
  const rag = new RAGEngine();
  const sessionManager = new CrossSessionManager();

  // 1. Create session and add context
  console.log('1. Creating session...');
  const context = await contextManager.createContext('user-complete');
  const session = await sessionManager.createSession(context, {
    title: 'Complete Workflow Demo',
  });

  // 2. Add documents to RAG
  console.log('2. Adding documents to RAG...');
  await rag.addDocument(
    'ClaudeFlare is a distributed AI coding platform for building scalable applications.',
    {
      source: 'docs',
      title: 'ClaudeFlare Overview',
    }
  );

  // 3. Add conversation messages
  console.log('3. Adding conversation messages...');
  await contextManager.addMessages(context.sessionId, [
    { role: 'user', content: 'What is ClaudeFlare?' },
    {
      role: 'assistant',
      content: 'ClaudeFlare is a distributed AI coding platform.',
    },
    { role: 'user', content: 'Tell me more about its features' },
  ]);

  // 4. Create memories
  console.log('4. Creating memories...');
  await memoryStore.createEpisodicMemory(
    'User asked about ClaudeFlare platform and its features',
    Date.now(),
    { userId: 'user-complete' }
  );

  await memoryStore.createSemanticMemory(
    'ClaudeFlare knowledge',
    [
      {
        id: 'cf-1',
        statement: 'ClaudeFlare is a distributed AI coding platform',
        confidence: 1.0,
      },
    ],
    [],
    { categories: ['claudeflare', 'platform'] }
  );

  // 5. Retrieve relevant documents
  console.log('5. Retrieving relevant documents...');
  const retrieval = await rag.retrieve({
    query: 'ClaudeFlare platform features',
    limit: 3,
  });

  // 6. Optimize context for next response
  console.log('6. Optimizing context...');
  const currentContext = await contextManager.getContext(context.sessionId);
  const optimized = await optimizer.optimize(
    currentContext.messages,
    'ClaudeFlare features'
  );

  // 7. Compress if needed
  console.log('7. Checking compression...');
  const usage = contextManager.getTokenUsage(context.sessionId);
  if (usage.percentage > 50) {
    await contextManager.compressContext(context.sessionId);
  }

  // 8. Persist session
  console.log('8. Persisting session...');
  await sessionManager.persistSession(session.id);

  console.log('\n✓ Complete workflow finished successfully!');
  console.log(`\nFinal state:`);
  console.log(`  Messages: ${currentContext.messages.length}`);
  console.log(`  Retrieved chunks: ${retrieval.chunks.length}`);
  console.log(`  Optimized messages: ${optimized.included.length}`);
  console.log(`  Memory count: ${memoryStore.getTotalMemoryCount()}`);
}

// ========================================================================
// Main
// ========================================================================

async function main() {
  try {
    await contextManagerExample();
    await memoryStoreExample();
    await compressionExample();
    await optimizerExample();
    await ragEngineExample();
    await crossSessionExample();
    await completeWorkflowExample();

    console.log('\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

export {
  contextManagerExample,
  memoryStoreExample,
  compressionExample,
  optimizerExample,
  ragEngineExample,
  crossSessionExample,
  completeWorkflowExample,
};
