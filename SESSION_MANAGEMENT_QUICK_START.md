# Session Management - Quick Start Guide

## Installation

The session management system is already included in ClaudeFlare. No additional installation required.

## Basic Usage

### 1. Create a Session

```typescript
import { SessionManager } from './lib/sessions';

const manager = new SessionManager(
  env.SESSIONS,
  env.KV_CACHE,
  env.R2_STORAGE
);

const session = await manager.create(sessionId, userId);
```

### 2. Add Messages

```typescript
await manager.addMessage(sessionId, {
  role: 'user',
  content: 'Hello, how are you?',
  timestamp: Date.now(),
  tokens: 5,
});
```

### 3. Build Context for LLM

```typescript
import { ContextBuilder } from './lib/sessions';

const builder = new ContextBuilder({ contextWindow: 128000 });

// Recent messages only
const context = await builder.buildContext(session, 'recent');

// With summary
const context = await builder.buildContext(session, 'summary');

// All messages
const context = await builder.buildContext(session, 'all');

// Use context for LLM
const messages = context.messages.map(m => ({
  role: m.role,
  content: m.content,
}));
```

### 4. Manage Storage Tiers

```typescript
import { SessionStorage } from './lib/sessions';

const storage = new SessionStorage(
  env.SESSIONS,
  env.KV_CACHE,
  env.R2_STORAGE
);

// Automatically manages tiers
await storage.save(session, 'hot');  // Start in HOT tier

// Automatic migration happens based on access patterns
await storage.runMigrationPolicy();
```

### 5. Cleanup Old Sessions

```typescript
import { cleanupInactiveSessions } from './routes/cleanup';

// Manual cleanup
const result = await cleanupInactiveSessions(env);
console.log(`Archived: ${result.archived}, Deleted: ${result.deleted}`);
```

## Advanced Usage

### Custom Context Building

```typescript
const builder = new ContextBuilder({
  contextWindow: 128000,
  enableSummarization: true,
  summaryTargetTokens: 10000,
  reservedTokens: 4000,
});

// Build with custom metadata
const context = await builder.buildContextWithMetadata(
  session,
  'recent',
  { language: 'typescript', framework: 'react' }
);

// Optimize context
const optimized = await builder.optimizeContext(context);

// Estimate quality
const quality = builder.estimateQuality(context);
console.log(`Quality Score: ${quality.score}/100`);
```

### Manual Tier Migration

```typescript
// Promote session
await storage.promote(sessionId, 'warm', 'hot');

// Demote session
await storage.demote(sessionId, 'hot', 'warm');

// Check if should promote
const shouldPromote = await storage.shouldPromote(sessionId, 'warm');
```

### Session Metadata

```typescript
// Update metadata
await manager.updateSessionMetadata(sessionId, {
  language: 'typescript',
  framework: 'react',
  projectPath: '/my-project',
});

// Touch session to update activity
await manager.touchSession(sessionId);
```

### Monitoring

```typescript
// Get session statistics
const stats = await manager.getStats();
console.log(`Active: ${stats.activeSessions}`);
console.log(`Archived: ${stats.archivedSessions}`);
console.log(`Messages: ${stats.totalMessages}`);
console.log(`Tokens: ${stats.totalTokens}`);

// Get tier statistics
const tierStats = await storage.getTierStats();
console.log(`HOT: ${tierStats.hot.count} sessions`);
console.log(`WARM: ${tierStats.warm.count} sessions`);
console.log(`COLD: ${tierStats.cold.count} sessions`);

// Get cleanup stats
const cleanupStats = await getCleanupStats(env);
console.log(`Cleanup candidates: ${cleanupStats.estimatedCleanupCandidates}`);
```

## Configuration

### Session Manager Options

```typescript
const manager = new SessionManager(
  env.SESSIONS,
  env.KV_CACHE,
  env.R2_STORAGE,
  {
    sessionTimeout: 60 * 60 * 1000,        // 1 hour
    archiveThreshold: 60 * 60 * 1000,       // 1 hour
    deleteThreshold: 30 * 24 * 60 * 60 * 1000,  // 30 days
    maxMessages: 10000,                     // Max messages
    contextWindow: 128000,                  // 128K tokens
  }
);
```

### Context Builder Options

```typescript
const builder = new ContextBuilder({
  contextWindow: 128000,                   // Total context window
  enableSummarization: true,                // Enable summarization
  summaryTargetTokens: 10000,               // Summary length
  reservedTokens: 4000,                     // Reserved for system
});
```

### Storage Options

```typescript
const storage = new SessionStorage(
  env.SESSIONS,
  env.KV_CACHE,
  env.R2_STORAGE,
  {
    hotMaxAge: 60 * 60 * 1000,              // HOT tier max age
    warmMaxAge: 7 * 24 * 60 * 60 * 1000,    // WARM tier max age
    hotAccessThreshold: 5,                  // Promotion threshold
    warmAccessThreshold: 3,                 // Promotion threshold
    autoMigrate: true,                      // Auto migration
  }
);
```

## Error Handling

```typescript
try {
  const session = await manager.getOrCreate(sessionId, userId);
} catch (error) {
  console.error('Failed to create session:', error);
  // Handle error
}

try {
  await storage.migrate(sessionId, 'hot', 'warm');
} catch (error) {
  console.error('Migration failed:', error);
  // Handle error
}
```

## Best Practices

1. **Always use `getOrCreate`** to ensure sessions exist
2. **Touch sessions regularly** to prevent premature archival
3. **Use appropriate context strategies** based on message count
4. **Monitor tier statistics** to optimize storage usage
5. **Test cleanup in dry-run mode** before production

## Performance Tips

1. **Use HOT tier** for frequently accessed sessions
2. **Enable summarization** for large conversation histories
3. **Adjust context window** based on your LLM's capabilities
4. **Monitor memory usage** to stay under 128MB DO limit
5. **Use recent strategy** for fastest context building

## Troubleshooting

### Sessions not being archived

- Check `archiveThreshold` configuration
- Verify cleanup cron is running
- Check session `lastActivity` timestamps

### High memory usage

- Monitor `sessionCount` in HOT tier
- Check `maxMemoryBytes` limit
- Verify LRU eviction is working

### Slow context building

- Use 'recent' strategy for large sessions
- Enable summarization
- Check token estimation accuracy

## See Also

- [Full Documentation](./packages/edge/src/lib/sessions/README.md)
- [Implementation Summary](./SESSION_MANAGEMENT_IMPLEMENTATION.md)
- [API Reference](./packages/edge/src/lib/sessions/index.ts)
