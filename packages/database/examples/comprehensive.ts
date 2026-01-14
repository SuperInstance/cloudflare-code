/**
 * ClaudeFlare Database - Comprehensive Usage Examples
 *
 * This file demonstrates all major features of the database package
 */

import {
  createDatabaseManager,
  DatabaseReplicator,
  MultiLeaderReplicator,
  ConsistentHashSharding,
  HorizontalSharding,
  GeographicalSharding,
  ConsistencyManager,
  LeaderElection,
  HealthMonitor,
  DisasterRecovery,
  ReshardingManager,
  SchemaMigration,
  QueryCache,
  QueryOptimizer,
  CRDTManager,
  LWWRegister,
  GCounter,
  ORSet,
} from '../src';

// ========================================
// EXAMPLE 1: Basic Replication Setup
// ========================================

async function example1_BasicReplication() {
  console.log('=== Example 1: Basic Replication ===');

  const replicator = new DatabaseReplicator({
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
      {
        id: 'eu-west',
        name: 'EU West',
        endpoint: 'eu-west.db.example.com',
        primary: false,
        latency: 100,
        available: true,
      },
    ],
    quorumSize: 2,
    heartbeatInterval: 5000,
    maxLagMs: 1000,
    retryAttempts: 3,
    timeoutMs: 30000,
  });

  // Execute a write with replication
  const writeResult = await replicator.write(
    {
      id: 'write-1',
      query: 'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
      params: [1, 'Alice', 'alice@example.com'],
      timestamp: new Date(),
      consistency: 'strong',
      quorum: 2,
    },
    {}
  );

  console.log('Write result:', writeResult);

  // Execute a read with strong consistency
  const readResult = await replicator.read(
    {
      id: 'read-1',
      query: 'SELECT * FROM users WHERE id = ?',
      params: [1],
      timestamp: new Date(),
      consistency: 'strong',
    },
    {}
  );

  console.log('Read result:', readResult);

  // Get replication status
  const status = replicator.getStatus();
  console.log('Replication status:', status);
}

// ========================================
// EXAMPLE 2: Multi-Leader Replication
// ========================================

async function example2_MultiLeaderReplication() {
  console.log('\n=== Example 2: Multi-Leader Replication ===');

  const replicator = new MultiLeaderReplicator(
    {
      mode: 'async',
      topology: 'multi-leader',
      consistency: 'eventual',
      regions: [
        {
          id: 'region1',
          name: 'Region 1',
          endpoint: 'region1.db.example.com',
          primary: true,
          latency: 10,
          available: true,
        },
        {
          id: 'region2',
          name: 'Region 2',
          endpoint: 'region2.db.example.com',
          primary: true,
          latency: 10,
          available: true,
        },
      ],
      quorumSize: 2,
      heartbeatInterval: 5000,
      maxLagMs: 1000,
      retryAttempts: 3,
      timeoutMs: 30000,
    },
    {
      strategy: 'last-write-wins',
    }
  );

  // Write to different leaders concurrently
  const result1 = await replicator.write(
    'region1',
    'UPDATE users SET name = ? WHERE id = ?',
    ['Alice Updated', 1],
    {}
  );

  const result2 = await replicator.write(
    'region2',
    'UPDATE users SET name = ? WHERE id = ?',
    ['Alice Also Updated', 1],
    {}
  );

  console.log('Write results:', result1, result2);

  // Check for conflicts
  if (result1.conflicts || result2.conflicts) {
    console.log('Conflicts detected and resolved');
  }

  // Get vector clocks
  const clock1 = replicator.getVectorClock('region1');
  const clock2 = replicator.getVectorClock('region2');
  console.log('Vector clocks:', { region1: clock1, region2: clock2 });
}

// ========================================
// EXAMPLE 3: Consistent Hashing Sharding
// ========================================

async function example3_ConsistentHashing() {
  console.log('\n=== Example 3: Consistent Hashing Sharding ===');

  const sharding = new ConsistentHashSharding({
    strategy: 'consistent-hash',
    shards: [
      { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      { id: 'shard3', region: 'eu-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
    ],
    shardKey: {
      name: 'user_id',
      type: 'number',
      columns: ['user_id'],
    },
    replicas: 2,
    consistentHashReplicas: 150,
    rebalanceThreshold: 0.2,
    migrationBatchSize: 1000,
  });

  // Route keys to shards
  for (let i = 0; i < 10; i++) {
    const key = `user-${i}`;
    const shard = sharding.routeKey(key);
    console.log(`Key ${key} -> Shard ${shard?.id}`);
  }

  // Get replica shards for a key
  const replicas = sharding.getReplicaShards('user-1', 2);
  console.log('Replicas for user-1:', replicas.map((r) => r.id));

  // Check if rebalancing is needed
  const needsRebalancing = sharding.needsRebalancing();
  console.log('Needs rebalancing:', needsRebalancing);

  // Get statistics
  const stats = sharding.getStats();
  console.log('Sharding stats:', stats);
}

// ========================================
// EXAMPLE 4: Geographical Sharding
// ========================================

async function example4_GeographicalSharding() {
  console.log('\n=== Example 4: Geographical Sharding ===');

  const sharding = new GeographicalSharding({
    strategy: 'geographical',
    shards: [
      { id: 'shard1', region: 'us-east', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      { id: 'shard2', region: 'us-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
      { id: 'shard3', region: 'eu-west', weight: 1, status: 'active', nodeCount: 1, capacity: 1000, utilization: 0 },
    ],
    shardKey: {
      name: 'user_id',
      type: 'number',
      columns: ['user_id'],
    },
    replicas: 2,
    consistentHashReplicas: 150,
    rebalanceThreshold: 0.2,
    migrationBatchSize: 1000,
  });

  // User in San Francisco
  const sfUser = { latitude: 37.7749, longitude: -122.4194 };
  const result1 = sharding.route(sfUser, 'user-123');
  console.log('SF user routing:', {
    primary: result1.primary.id,
    replicas: result1.replicas.map((r) => r.id),
    latency: result1.latency,
  });

  // User in London
  const londonUser = { latitude: 51.5074, longitude: -0.1278 };
  const result2 = sharding.route(londonUser, 'user-456');
  console.log('London user routing:', {
    primary: result2.primary.id,
    replicas: result2.replicas.map((r) => r.id),
    latency: result2.latency,
  });

  // Set user location affinity
  sharding.setUserLocation('user-789', 'eu-west');
  const userRegion = sharding.getUserRegion('user-789');
  console.log('User-789 preferred region:', userRegion);

  // Get routing info
  const routingInfo = sharding.getRoutingInfo();
  console.log('Routing info:', routingInfo);
}

// ========================================
// EXAMPLE 5: Consistency Models
// ========================================

async function example5_ConsistencyModels() {
  console.log('\n=== Example 5: Consistency Models ===');

  const manager = new ConsistencyManager(
    {
      model: 'strong',
      quorumSize: 2,
      readQuorum: 2,
      writeQuorum: 2,
      timeout: 5000,
      maxStaleness: 1000,
    },
    ['us-east', 'us-west', 'eu-west']
  );

  // Strong consistency read
  const strongRead = await manager.read(
    {
      id: 'read-1',
      query: 'SELECT * FROM users WHERE id = ?',
      params: [1],
      consistency: 'strong',
      timestamp: new Date(),
    },
    async (region) => ({ data: { id: 1, name: 'Alice' }, version: 1 })
  );

  console.log('Strong consistency read:', strongRead);

  // Eventual consistency read
  const eventualRead = await manager.read(
    {
      id: 'read-2',
      query: 'SELECT * FROM users',
      params: [],
      consistency: 'eventual',
      timestamp: new Date(),
    },
    async (region) => ({ data: [], version: 1 })
  );

  console.log('Eventual consistency read:', eventualRead);

  // Read-your-writes consistency
  const session = manager.getSession('session-123');
  const rywRead = await manager.read(
    {
      id: 'read-3',
      query: 'SELECT * FROM users WHERE id = ?',
      params: [1],
      consistency: 'read-your-writes',
      timestamp: new Date(),
      sessionId: 'session-123',
    },
    async (region) => ({ data: { id: 1, name: 'Alice' }, version: 1 })
  );

  console.log('Read-your-writes read:', rywRead);

  // Get consistency stats
  const stats = manager.getStats();
  console.log('Consistency stats:', stats);
}

// ========================================
// EXAMPLE 6: Leader Election
// ========================================

async function example6_LeaderElection() {
  console.log('\n=== Example 6: Leader Election ===');

  const election = new LeaderElection(
    {
      heartbeatInterval: 1000,
      failureThreshold: 3,
      recoveryThreshold: 2,
      electionTimeout: 5000,
      automaticFailover: true,
      recoveryMode: 'automatic',
      maxRetries: 3,
      retryDelay: 1000,
      dataSyncThreshold: 100,
    },
    [
      {
        id: 'node1',
        region: 'us-east',
        role: 'primary',
        status: 'healthy',
        lastHeartbeat: new Date(),
        endpoint: 'node1.db',
        priority: 100,
      },
      {
        id: 'node2',
        region: 'us-west',
        role: 'replica',
        status: 'healthy',
        lastHeartbeat: new Date(),
        endpoint: 'node2.db',
        priority: 50,
      },
      {
        id: 'node3',
        region: 'eu-west',
        role: 'replica',
        status: 'healthy',
        lastHeartbeat: new Date(),
        endpoint: 'node3.db',
        priority: 50,
      },
    ]
  );

  // Get initial leader
  console.log('Initial leader:', election.getLeader());

  // Start an election
  const result = await election.startElection('node1');
  console.log('Election result:', {
    leader: result.leaderId,
    term: result.term,
    votes: Array.from(result.votes.entries()),
  });

  // Simulate leader failure
  election.updateNodeStatus('node1', 'failed', new Date());

  // Trigger failover
  const failoverResult = await election.triggerFailover();
  console.log('Failover result:', {
    newLeader: failoverResult?.leaderId,
    term: failoverResult?.term,
  });

  // Get cluster state
  const state = election.getState();
  console.log('Cluster state:', state);
}

// ========================================
// EXAMPLE 7: Health Monitoring
// ========================================

async function example7_HealthMonitoring() {
  console.log('\n=== Example 7: Health Monitoring ===');

  const monitor = new HealthMonitor(
    {
      heartbeatInterval: 100,
      failureThreshold: 3,
      recoveryThreshold: 2,
      electionTimeout: 5000,
      automaticFailover: true,
      recoveryMode: 'automatic',
      maxRetries: 3,
      retryDelay: 1000,
      dataSyncThreshold: 100,
    },
    [
      {
        id: 'node1',
        region: 'us-east',
        role: 'primary',
        status: 'healthy',
        lastHeartbeat: new Date(),
        endpoint: 'node1.db',
        priority: 100,
      },
      {
        id: 'node2',
        region: 'us-west',
        role: 'replica',
        status: 'healthy',
        lastHeartbeat: new Date(),
        endpoint: 'node2.db',
        priority: 50,
      },
    ]
  );

  // Start monitoring
  monitor.start();

  // Wait a bit for health checks
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Get cluster health
  const health = monitor.getClusterHealth();
  console.log('Cluster health:', health);

  // Get node health
  const nodeHealth = monitor.getNodeHealth('node1');
  console.log('Node1 health:', nodeHealth);

  // Get all node health
  const allHealth = monitor.getAllNodeHealth();
  console.log('All node health:', Array.from(allHealth.entries()));

  // Get failover metrics
  const metrics = monitor.getMetrics();
  console.log('Failover metrics:', metrics);

  // Stop monitoring
  monitor.stop();
}

// ========================================
// EXAMPLE 8: Disaster Recovery
// ========================================

async function example8_DisasterRecovery() {
  console.log('\n=== Example 8: Disaster Recovery ===');

  const recovery = new DisasterRecovery();

  // Create a backup
  const data = {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ],
  };

  const backup = await recovery.createBackup('node1', data, 'full');
  console.log('Backup created:', {
    id: backup.id,
    size: backup.size,
    type: backup.type,
    checksum: backup.checksum,
  });

  // Restore from backup
  const restored = await recovery.restoreBackup(backup.id);
  console.log('Backup restored:', {
    success: restored.success,
    time: restored.time,
  });

  // Create and execute recovery plan
  const plan = recovery.createRecoveryPlan('node1', true);
  console.log('Recovery plan:', {
    nodeId: plan.nodeId,
    steps: plan.steps.length,
    estimatedTime: plan.estimatedTime,
  });

  const recoveryResult = await recovery.executeRecoveryPlan('node1');
  console.log('Recovery result:', recoveryResult);

  // Point-in-time recovery
  for (let i = 0; i < 10; i++) {
    recovery.logChange({ id: i, operation: `change-${i}`, timestamp: Date.now() });
  }

  const pitr = recovery.canRecoverToPointInTime(new Date());
  console.log('Point-in-time recovery:', pitr);

  const recovered = await recovery.recoverToPointInTime(new Date());
  console.log('Recovered to point in time:', recovered);

  // List backups
  const backups = recovery.listBackups();
  console.log('All backups:', backups.length);

  // Get stats
  const stats = recovery.getStats();
  console.log('Recovery stats:', stats);
}

// ========================================
// EXAMPLE 9: Resharding
// ========================================

async function example9_Resharding() {
  console.log('\n=== Example 9: Resharding ===');

  const manager = new ReshardingManager(5);

  // Plan a shard split
  const splitPlan = manager.planResharding({
    currentShards: ['shard1'],
    newShards: ['shard1a', 'shard1b'],
    strategy: 'split',
    batchSize: 1000,
    maxParallelTasks: 5,
  });

  console.log('Split plan:', {
    tasks: splitPlan.tasks.length,
    estimatedTime: splitPlan.estimatedTime,
    dataMovement: splitPlan.estimatedDataMovement,
  });

  // Execute migration
  const result = await manager.executeMigration(splitPlan, async (batch) => {
    console.log(`Processing batch ${batch.batchNumber} with ${batch.rows.length} rows`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  console.log('Migration result:', result);

  // Plan a shard merge
  const mergePlan = manager.planResharding({
    currentShards: ['shard1a', 'shard1b'],
    newShards: ['shard1'],
    strategy: 'merge',
    batchSize: 1000,
    maxParallelTasks: 5,
  });

  console.log('Merge plan:', {
    tasks: mergePlan.tasks.length,
    estimatedTime: mergePlan.estimatedTime,
  });
}

// ========================================
// EXAMPLE 10: Schema Migration
// ========================================

async function example10_SchemaMigration() {
  console.log('\n=== Example 10: Schema Migration ===');

  const migration = new SchemaMigration();

  // Plan and apply a schema change
  const change = {
    type: 'add-column' as const,
    table: 'users',
    column: 'email',
    definition: 'email VARCHAR(255) NULL',
  };

  const changeId = migration.planChange(change);
  console.log('Planned change:', changeId);

  const result = await migration.applyChange(change, async (sql) => {
    console.log('Executing SQL:', sql);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  console.log('Change result:', result);

  // Validate schema
  const validation = await migration.validate('users', async (sql) => {
    return { valid: true };
  });

  console.log('Schema validation:', validation);

  // Get pending changes
  const pending = migration.getPendingChanges();
  console.log('Pending changes:', pending.length);
}

// ========================================
// EXAMPLE 11: Query Caching
// ========================================

async function example11_QueryCaching() {
  console.log('\n=== Example 11: Query Caching ===');

  const cache = new QueryCache({
    maxSize: 100,
    defaultTTL: 60000,
    evictionPolicy: 'lru',
    maxSizeBytes: 1024 * 1024,
  });

  // Set cache entries
  cache.set('query-1', { users: [{ id: 1, name: 'Alice' }] });
  cache.set('query-2', { users: [{ id: 2, name: 'Bob' }] }, 5000);

  // Get cache entries
  const result1 = cache.get('query-1');
  const result2 = cache.get('query-2');
  console.log('Cache hits:', { query1: result1, query2: result2 });

  // Miss
  const result3 = cache.get('query-3');
  console.log('Cache miss:', result3);

  // Get stats
  const stats = cache.getStats();
  console.log('Cache stats:', stats);

  // Warm cache
  const data = new Map();
  data.set('query-4', { users: [] });
  data.set('query-5', { users: [] });
  await cache.warm(data);

  // Invalidate by pattern
  const invalidated = cache.invalidate('query-*');
  console.log('Invalidated entries:', invalidated);
}

// ========================================
// EXAMPLE 12: Query Optimization
// ========================================

async function example12_QueryOptimization() {
  console.log('\n=== Example 12: Query Optimization ===');

  const optimizer = new QueryOptimizer(100);

  // Record query metrics
  optimizer.recordQuery('SELECT * FROM users WHERE id = 1', 50, 10, 1);
  optimizer.recordQuery('SELECT * FROM users WHERE id = 2', 60, 10, 1);
  optimizer.recordQuery('SELECT * FROM users WHERE email = ?', 250, 1000, 1);
  optimizer.recordQuery('SELECT * FROM orders WHERE user_id = ?', 300, 5000, 100);

  // Analyze queries
  const plan1 = optimizer.analyzeQuery('SELECT * FROM users WHERE id = 1');
  console.log('Query plan 1:', {
    query: plan1.query,
    estimatedCost: plan1.estimatedCost,
    suggestions: plan1.suggestions.length,
  });

  const plan2 = optimizer.analyzeQuery('SELECT * FROM users WHERE email = ?');
  console.log('Query plan 2:', {
    query: plan2.query,
    estimatedCost: plan2.estimatedCost,
    suggestions: plan2.suggestions.length,
  });

  // Optimize query
  const optimized = optimizer.optimizeQuery('SELECT * FROM users');
  console.log('Optimized query:', optimized);

  // Generate performance report
  const report = optimizer.generateReport();
  console.log('Performance report:', {
    totalQueries: report.totalQueries,
    avgLatency: report.avgLatency,
    p95Latency: report.p95Latency,
    p99Latency: report.p99Latency,
    cacheHitRate: report.cacheHitRate,
    slowQueries: report.slowQueries.length,
  });

  // Get query cache
  const cache = optimizer.getCache();
  console.log('Query cache:', cache.getStats());
}

// ========================================
// EXAMPLE 13: CRDTs
// ========================================

async function example13_CRDTs() {
  console.log('\n=== Example 13: CRDTs ===');

  // Create CRDT managers for different nodes
  const node1 = new CRDTManager('node1');
  const node2 = new CRDTManager('node2');

  // LWW Register
  const register1 = node1.getRegister('config', { theme: 'dark' });
  const register2 = node2.getRegister('config', { theme: 'light' });

  register1.set({ theme: 'dark', fontSize: 14 });
  register2.set({ theme: 'light', fontSize: 16 });

  // Merge registers
  register1.merge(register2);
  console.log('Merged register:', register1.value());

  // G-Counter
  const counter1 = node1.getCounter('page-views');
  const counter2 = node2.getCounter('page-views');

  counter1.increment('node1', 10);
  counter2.increment('node2', 20);

  counter1.merge(counter2);
  console.log('Merged counter:', counter1.value());

  // OR-Set
  const set1 = node1.getSet<string>('tags');
  const set2 = node2.getSet<string>('tags');

  set1.add('typescript', 'node1');
  set2.add('rust', 'node2');

  set1.merge(set2);
  console.log('Merged set:', Array.from(set1.value()));

  // Merge entire managers
  node1.merge(node2);
  console.log('Merged managers');
}

// ========================================
// EXAMPLE 14: Complete Workflow
// ========================================

async function example14_CompleteWorkflow() {
  console.log('\n=== Example 14: Complete Workflow ===');

  // Create database manager
  const manager = createDatabaseManager({
    replication: {
      mode: 'sync',
      topology: 'primary-replica',
      consistency: 'strong',
      regions: [
        { id: 'us-east', name: 'US East', endpoint: 'us-east.db', primary: true, latency: 10, available: true },
        { id: 'us-west', name: 'US West', endpoint: 'us-west.db', primary: false, latency: 50, available: true },
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
      shardKey: { name: 'id', type: 'number', columns: ['id'] },
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

  // Write data
  await manager.write('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);

  // Read data
  const users = await manager.read('SELECT * FROM users', []);
  console.log('Users:', users);

  // Check cluster health
  const health = manager.getClusterHealth();
  console.log('Cluster health:', health);

  // Get performance report
  const report = manager.getPerformanceReport();
  console.log('Performance report:', report);
}

// ========================================
// Run All Examples
// ========================================

async function runAllExamples() {
  try {
    await example1_BasicReplication();
    await example2_MultiLeaderReplication();
    await example3_ConsistentHashing();
    await example4_GeographicalSharding();
    await example5_ConsistencyModels();
    await example6_LeaderElection();
    await example7_HealthMonitoring();
    await example8_DisasterRecovery();
    await example9_Resharding();
    await example10_SchemaMigration();
    await example11_QueryCaching();
    await example12_QueryOptimization();
    await example13_CRDTs();
    await example14_CompleteWorkflow();

    console.log('\n✓ All examples completed successfully');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_BasicReplication,
  example2_MultiLeaderReplication,
  example3_ConsistentHashing,
  example4_GeographicalSharding,
  example5_ConsistencyModels,
  example6_LeaderElection,
  example7_HealthMonitoring,
  example8_DisasterRecovery,
  example9_Resharding,
  example10_SchemaMigration,
  example11_QueryCaching,
  example12_QueryOptimization,
  example13_CRDTs,
  example14_CompleteWorkflow,
};
