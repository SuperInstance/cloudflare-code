# ClaudeFlare Database Package

Enterprise-grade database replication, sharding, and distributed data management system for Cloudflare Workers D1 databases.

## Features

### Multi-Region Replication
- **Primary-Replica Replication**: Single primary with multiple read replicas
- **Multi-Leader Replication**: Multiple writable leaders with conflict resolution
- **Async/Sync Replication**: Configurable replication modes
- **Conflict-Free Replicated Data Types (CRDTs)**: LWW registers, counters, sets, and maps

### Database Sharding
- **Horizontal Sharding**: Hash-based, range-based, and directory-based sharding
- **Consistent Hashing**: Minimal data movement during topology changes
- **Geographical Sharding**: Route based on user location for low latency
- **Automatic Rebalancing**: Dynamic shard distribution based on load

### Consistency Models
- **Strong Consistency**: Linearizable reads and writes
- **Eventual Consistency**: Reads may return stale data
- **Causal Consistency**: Respect causal dependencies
- **Read-Your-Writes**: Clients always see their own writes
- **Quorum-Based**: Configurable read/write quorums

### Failover & Recovery
- **Automatic Failover**: Detect failures and elect new leaders
- **Leader Election**: Raft-like consensus algorithm
- **Health Monitoring**: Continuous health checks with configurable thresholds
- **Point-in-Time Recovery**: Restore to any point in time
- **Backup & Restore**: Automated backup management

### Data Migration
- **Resharding**: Split, merge, and move shards online
- **Schema Migration**: Zero-downtime schema changes
- **Bulk Import**: Efficient data loading tools
- **Rollback Support**: Safe migration with rollback plans

### Performance Optimization
- **Query Caching**: Distributed cache with LRU/LFU/TTL eviction
- **Query Optimization**: Automatic analysis and optimization suggestions
- **Index Recommendations**: AI-powered index suggestions
- **Performance Monitoring**: Real-time metrics and reports

## Installation

```bash
npm install @claudeflare/database
```

## Quick Start

```typescript
import { createDatabaseManager } from '@claudeflare/database';

const manager = createDatabaseManager({
  replication: {
    mode: 'sync',
    topology: 'primary-replica',
    consistency: 'strong',
    regions: [
      {
        id: 'us-east',
        name: 'US East',
        endpoint: 'us-east.db.example.com',
        primary: true,
        latency: 10,
        available: true,
      },
      {
        id: 'us-west',
        name: 'US West',
        endpoint: 'us-west.db.example.com',
        primary: false,
        latency: 50,
        available: true,
      },
    ],
    quorumSize: 2,
    heartbeatInterval: 5000,
    maxLagMs: 1000,
    retryAttempts: 3,
    timeoutMs: 30000,
  },
  sharding: {
    strategy: 'consistent-hash',
    shards: [],
    shardKey: {
      name: 'id',
      type: 'number',
      columns: ['id'],
    },
    replicas: 2,
    consistentHashReplicas: 150,
    rebalanceThreshold: 0.2,
    migrationBatchSize: 1000,
  },
  consistency: {
    model: 'strong',
    quorumSize: 2,
    readQuorum: 2,
    writeQuorum: 2,
    timeout: 5000,
    maxStaleness: 1000,
  },
  failover: {
    heartbeatInterval: 5000,
    failureThreshold: 3,
    recoveryThreshold: 2,
    electionTimeout: 10000,
    automaticFailover: true,
    recoveryMode: 'automatic',
    maxRetries: 3,
    retryDelay: 1000,
    dataSyncThreshold: 100,
  },
});

// Execute distributed read
const users = await manager.read('SELECT * FROM users WHERE id = ?', [1]);

// Execute distributed write
await manager.write('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);

// Route key to shard
const shard = manager.routeKey('user-123');

// Get cluster status
const status = manager.getReplicationStatus();
const health = manager.getClusterHealth();
const report = manager.getPerformanceReport();
```

## Architecture

### Replication Strategies

#### Primary-Replica
```
┌─────────┐
│ Primary │ (writes)
└────┬────┘
     │
     ├─────────┐
     │         │
┌────▼────┐ ┌─▼──────┐
│ Replica │ │ Replica │ (reads)
└─────────┘ └─────────┘
```

#### Multi-Leader
```
┌─────────┐
│ Leader  │┐ (writes)
└────┬────┘│
     │    │
     ├────┼─────────┐
     │    │         │
┌────▼────┐│┌───────▼─┐
│ Leader  │┘│ Leader  │ (writes)
└─────────┘ └─────────┘
     │           │
     └─────┬─────┘
           ▼
     ┌─────────┐
     │ Sync    │
     └─────────┘
```

### Sharding Topologies

#### Consistent Hashing Ring
```
       ┌──────────────────┐
      ╱                    ╲
     ╱   ┌────────┐        ╲
    │    │ Shard1 │         │
    │    └────────┘         │
   │      ┌────────┐       │
   │      │ Shard2 │       │
   │      └────────┘       │
   │    ┌────────┐         │
    │   │ Shard3 │         │
     │  └────────┘         │
      ╲                   ╱
       └──────────────────┘
```

#### Geographical Sharding
```
User Location (SF)
       │
       ▼
┌──────────────┐
│ Nearest Shard│
│ (us-west)    │
└──────────────┘
       │
       ├───────────┬────────────┐
       │           │            │
    ┌──▼──┐     ┌──▼──┐      ┌──▼──┐
    │primary    │replica1   │replica2
    │10ms       │50ms       │100ms
```

## API Reference

### DatabaseManager

Main orchestrator for all database operations.

#### Methods

- `read(query, params, consistency?)` - Execute distributed read
- `write(query, params)` - Execute distributed write
- `routeKey(key)` - Route key to appropriate shard
- `getReplicationStatus()` - Get replication status
- `getClusterHealth()` - Get cluster health
- `getPerformanceReport()` - Generate performance report

### Replication

#### DatabaseReplicator
Handles multi-region replication.

```typescript
const replicator = new DatabaseReplicator(config);
await replicator.write(writeRequest, env);
const result = await replicator.read(readRequest, env);
```

#### MultiLeaderReplicator
Multi-leader replication with conflict resolution.

```typescript
const replicator = new MultiLeaderReplicator(config, conflictResolution);
await replicator.write(regionId, query, params, env);
```

#### CRDTs
Conflict-free replicated data types.

```typescript
const manager = new CRDTManager(nodeId);
const register = manager.getRegister('key', initialValue);
const counter = manager.getCounter('counter');
const set = manager.getSet('set');
```

### Sharding

#### ConsistentHashSharding
Consistent hashing-based sharding.

```typescript
const sharding = new ConsistentHashSharding(config);
const shard = sharding.routeKey(key);
const replicas = sharding.getReplicaShards(key, 3);
```

#### HorizontalSharding
Horizontal sharding with various strategies.

```typescript
const sharding = new HorizontalSharding(config);
const shard = sharding.route(key, operation);
sharding.addShard(newShard);
```

#### GeographicalSharding
Location-based routing.

```typescript
const sharding = new GeographicalSharding(config);
const result = sharding.route(userLocation, userId);
```

### Consistency

#### ConsistencyManager
Manages consistency models.

```typescript
const manager = new ConsistencyManager(config, regions);
const result = await manager.read(readOperation, executor);
await manager.write(writeOperation, executor);
```

#### QuorumConsistency
Quorum-based reads and writes.

```typescript
const quorum = new QuorumConsistency(config, regions);
const result = await quorum.read(operation, executor);
await quorum.write(operation, executor);
```

### Failover

#### LeaderElection
Distributed leader election.

```typescript
const election = new LeaderElection(config, nodes);
const result = await election.startElection(candidateId);
```

#### HealthMonitor
Monitors node health and triggers failover.

```typescript
const monitor = new HealthMonitor(config, nodes);
monitor.start();
const health = monitor.getClusterHealth();
```

#### DisasterRecovery
Backup and recovery management.

```typescript
const recovery = new DisasterRecovery();
const backup = await recovery.createBackup(nodeId, data);
await recovery.restoreBackup(backup.id);
```

### Migration

#### ReshardingManager
Handles resharding operations.

```typescript
const manager = new ReshardingManager();
const plan = manager.planResharding(config);
const result = await manager.executeMigration(plan, executor);
```

#### SchemaMigration
Zero-downtime schema changes.

```typescript
const migration = new SchemaMigration();
await migration.applyChange(change, executor);
```

### Optimization

#### QueryCache
Distributed query caching.

```typescript
const cache = new QueryCache(config);
cache.set(key, value, ttl);
const value = cache.get(key);
```

#### QueryOptimizer
Query analysis and optimization.

```typescript
const optimizer = new QueryOptimizer();
optimizer.recordQuery(query, time, scanned, returned);
const plan = optimizer.analyzeQuery(query);
const report = optimizer.generateReport();
```

## Configuration

### Replication Config

```typescript
interface ReplicationConfig {
  mode: 'async' | 'sync' | 'semi-sync';
  topology: 'primary-replica' | 'multi-leader' | 'peer-to-peer';
  consistency: ConsistencyLevel;
  regions: Region[];
  quorumSize: number;
  heartbeatInterval: number;
  maxLagMs: number;
  retryAttempts: number;
  timeoutMs: number;
}
```

### Sharding Config

```typescript
interface ShardingConfig {
  strategy: ShardingStrategy;
  shards: Shard[];
  shardKey: ShardKey;
  replicas: number;
  consistentHashReplicas: number;
  rebalanceThreshold: number;
  migrationBatchSize: number;
}
```

### Failover Config

```typescript
interface FailoverConfig {
  heartbeatInterval: number;
  failureThreshold: number;
  recoveryThreshold: number;
  electionTimeout: number;
  automaticFailover: boolean;
  recoveryMode: RecoveryMode;
  maxRetries: number;
  retryDelay: number;
  dataSyncThreshold: number;
}
```

## Best Practices

### Replication
1. Use sync replication for critical data
2. Place replicas close to users
3. Monitor replication lag
4. Test failover scenarios

### Sharding
1. Choose shard keys carefully
2. Avoid hotspots
3. Plan for growth
4. Monitor shard utilization

### Consistency
1. Use strong consistency for financial data
2. Use eventual consistency for analytics
3. Implement client-side conflict resolution
4. Understand your consistency requirements

### Performance
1. Enable query caching
2. Use connection pooling
3. Monitor slow queries
4. Add recommended indexes

### Migration
1. Test migrations in staging
2. Have rollback plans ready
3. Monitor during migrations
4. Use incremental migrations

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines.

## Support

- Documentation: [docs.claudeflare.dev](https://docs.claudeflare.dev)
- Issues: [github.com/claudeflare/database/issues](https://github.com/claudeflare/database/issues)
- Discord: [discord.gg/claudeflare](https://discord.gg/claudeflare)
