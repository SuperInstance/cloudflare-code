# Session Management System

Comprehensive session management with conversation context persistence for ClaudeFlare.

## Architecture

```
Session Start → Initialize Session DO
                ↓
           Track messages and context
                ↓
           Auto-save to storage tiers
                ↓
           Auto-expire after inactivity
```

## Components

### 1. Session Durable Object (`/packages/edge/src/do/session.ts`)

HOT tier storage for active sessions with sub-millisecond access latency.

**Features:**
- In-memory storage for active sessions
- Automatic persistence to Durable Object storage
- LRU eviction when approaching 128MB limit
- Real-time session updates

**Key Methods:**
```typescript
async initialize(userId: string): Promise<SessionInfo>
async addMessage(message: Message): Promise<void>
async getHistory(limit?: number): Promise<Message[]>
async getContext(tokenLimit: number): Promise<ConversationContext>
async updateMetadata(metadata: Record<string, unknown>): Promise<void>
async touch(): Promise<void>
async destroy(): Promise<void>
```

### 2. Session Manager (`/packages/edge/src/lib/sessions/manager.ts`)

Manages session lifecycle including creation, retrieval, cleanup, and archival.

**Features:**
- Get or create sessions
- List user sessions
- Clean up inactive sessions
- Archive old sessions to R2
- Delete old archives

**Key Methods:**
```typescript
async getOrCreate(sessionId: string, userId: string): Promise<SessionDO>
async get(sessionId: string): Promise<SessionDO | null>
async listUserSessions(userId: string): Promise<SessionInfo[]>
async cleanupInactive(olderThan: number): Promise<number>
async archiveSession(sessionId: string): Promise<void>
```

### 3. Context Builder (`/packages/edge/src/lib/sessions/context.ts`)

Builds conversation context for LLM with multiple strategies.

**Features:**
- Multiple context building strategies (recent, summary, all)
- Automatic token estimation
- Message summarization
- Context window management

**Key Methods:**
```typescript
async buildContext(
  session: SessionDO,
  tokenLimit: number,
  strategy: 'recent' | 'summary' | 'all'
): Promise<ConversationContext>

async optimizeContext(context: ConversationContext): Promise<ConversationContext>
async estimateQuality(context: ConversationContext): QualityScore
```

### 4. Session Storage Strategy (`/packages/edge/src/lib/sessions/storage.ts`)

Multi-tier session storage management with intelligent promotion/demotion.

**Storage Tiers:**
- **HOT**: Active sessions in DO (<1ms access)
- **WARM**: Recent sessions in KV (1-50ms access)
- **COLD**: Archived sessions in R2 (50-100ms access)

**Key Methods:**
```typescript
async save(session: SessionDO, tier: 'hot' | 'warm' | 'cold'): Promise<void>
async load(sessionId: string): Promise<SessionDO | null>
async migrate(sessionId: string, from: Tier, to: Tier): Promise<void>
async shouldPromote(sessionId: string, currentTier: Tier): Promise<boolean>
async shouldDemote(sessionId: string): Promise<boolean>
```

### 5. Session Cleanup Cron (`/packages/edge/src/routes/cleanup.ts`)

Automated cleanup of inactive and archived sessions via Cloudflare Workers Cron Triggers.

**Features:**
- Archive sessions inactive for >1 hour
- Delete sessions archived for >30 days
- Automatic tier migration
- Dry-run support

**Usage:**
```typescript
// In wrangler.toml:
// [triggers]
// crons = ["0 * * * *"]  # Every hour

export default {
  async scheduled(event: ScheduledEvent) {
    await cleanupInactiveSessions(event.env);
  }
}
```

## Configuration

```typescript
{
  sessionTimeout: 60 * 60 * 1000,        // 1 hour
  archiveThreshold: 60 * 60 * 1000,       // 1 hour
  deleteThreshold: 30 * 24 * 60 * 60 * 1000,  // 30 days
  maxMessages: 10000,                     // Max messages per session
  contextWindow: 128000,                  // 128K tokens
}
```

## Usage Examples

### Creating a Session

```typescript
import { SessionManager } from './lib/sessions';

const manager = new SessionManager(
  env.SESSIONS,
  env.KV_CACHE,
  env.R2_STORAGE
);

// Get or create session
const session = await manager.getOrCreate(sessionId, userId);
```

### Adding Messages

```typescript
await manager.addMessage(sessionId, {
  role: 'user',
  content: 'Hello, how are you?',
  timestamp: Date.now(),
});
```

### Building Context

```typescript
import { ContextBuilder } from './lib/sessions';

const builder = new ContextBuilder({ contextWindow: 128000 });

// Build recent context
const context = await builder.buildContext(session, 'recent');

// Build summary context
const summaryContext = await builder.buildContext(session, 'summary');

// Build full context
const fullContext = await builder.buildContext(session, 'all');
```

### Managing Storage Tiers

```typescript
import { SessionStorage } from './lib/sessions';

const storage = new SessionStorage(
  env.SESSIONS,
  env.KV_CACHE,
  env.R2_STORAGE
);

// Save to HOT tier
await storage.save(session, 'hot');

// Migrate to WARM tier
await storage.migrate(sessionId, 'hot', 'warm');

// Check if should promote
const shouldPromote = await storage.shouldPromote(sessionId, 'warm');
```

### Running Cleanup

```typescript
import { cleanupInactiveSessions } from './routes/cleanup';

// Manual cleanup
const result = await cleanupInactiveSessions(env, {
  archiveThreshold: 60 * 60 * 1000,
  deleteThreshold: 30 * 24 * 60 * 60 * 1000,
  dryRun: false,
});

console.log(`Archived: ${result.archived}`);
console.log(`Deleted: ${result.deleted}`);
```

## Performance Targets

- **Session Access Latency**: <1ms for HOT tier
- **Concurrent Sessions**: Support 10K+ concurrent sessions
- **Context Building**: <100ms for 1000 messages
- **Storage Migration**: <500ms per session

## Testing

### Unit Tests

```bash
npm test -- tests/sessions/context.test.ts
npm test -- tests/sessions/storage.test.ts
```

### Integration Tests

```bash
npm test -- tests/sessions/integration.test.ts
```

## File Structure

```
/packages/edge/src/
├── do/
│   └── session.ts              # Session Durable Object
├── lib/
│   └── sessions/
│       ├── index.ts            # Module exports
│       ├── manager.ts          # Session Manager
│       ├── context.ts          # Context Builder
│       └── storage.ts          # Storage Strategy
└── routes/
    └── cleanup.ts              # Cleanup Cron Job

/tests/sessions/
├── context.test.ts             # Context Builder Tests
├── storage.test.ts             # Storage Strategy Tests
└── integration.test.ts         # Integration Tests
```

## Best Practices

1. **Always use `getOrCreate`** to ensure sessions exist before operations
2. **Touch sessions regularly** to prevent premature archival
3. **Use appropriate context strategies** based on message count
4. **Monitor tier statistics** to optimize storage usage
5. **Test cleanup in dry-run mode** before production deployment

## Monitoring

Key metrics to monitor:

```typescript
const stats = await sessionManager.getStats();
console.log(`Active Sessions: ${stats.activeSessions}`);
console.log(`Archived Sessions: ${stats.archivedSessions}`);
console.log(`Total Messages: ${stats.totalMessages}`);
console.log(`Total Tokens: ${stats.totalTokens}`);

const tierStats = await sessionStorage.getTierStats();
console.log(`HOT Tier: ${tierStats.hot.count} sessions`);
console.log(`WARM Tier: ${tierStats.warm.count} sessions`);
console.log(`COLD Tier: ${tierStats.cold.count} sessions`);
```

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

## License

MIT
