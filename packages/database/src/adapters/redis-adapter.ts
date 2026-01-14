/**
 * Redis Adapter
 * Key-value store with advanced data structures
 */

import { DatabaseAdapter } from './adapter';
import { RedisConfig, QueryResult, FieldInfo } from '../types';

// ============================================================================
// Redis Adapter Implementation
// ============================================================================

export class RedisAdapter extends DatabaseAdapter {
  protected declare config: RedisConfig;
  private client: any = null;
  private publisher: any = null;
  private subscriber: any = null;

  constructor(config: RedisConfig) {
    super(config);
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  async connect(): Promise<void> {
    if (this.isConnectedFlag) {
      return;
    }

    try {
      // Dynamic import of redis module
      const { createClient } = await import('redis');

      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: this.config.connectionTimeout || 10000,
        },
        password: this.config.password,
        database: this.config.db || 0,
      });

      await this.client.connect();

      // Create separate clients for pub/sub
      this.publisher = this.client.duplicate();
      this.subscriber = this.client.duplicate();
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);

      this.isConnectedFlag = true;
    } catch (error) {
      throw new Error(`Redis connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isConnectedFlag = false;
  }

  isConnected(): boolean {
    return this.isConnectedFlag && this.client !== null;
  }

  // ========================================================================
  // Basic Key-Value Operations
  // ========================================================================

  async get(key: string): Promise<string | null> {
    this.validateConnection();
    return await this.client.get(key);
  }

  async set(key: string, value: string, options?: { EX?: number; PX?: number; NX?: boolean; XX?: boolean }): Promise<string | null> {
    this.validateConnection();
    return await this.client.set(key, value, options);
  }

  async del(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.exists(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    this.validateConnection();
    return await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.ttl(key);
  }

  async rename(oldKey: string, newKey: string): Promise<string> {
    this.validateConnection();
    return await this.client.rename(oldKey, newKey);
  }

  async type(key: string): Promise<string> {
    this.validateConnection();
    return await this.client.type(key);
  }

  // ========================================================================
  // String Operations
  // ========================================================================

  async append(key: string, value: string): Promise<number> {
    this.validateConnection();
    return await this.client.append(key, value);
  }

  async getRange(key: string, start: number, end: number): Promise<string> {
    this.validateConnection();
    return await this.client.getRange(key, start, end);
  }

  async setRange(key: string, offset: number, value: string): Promise<number> {
    this.validateConnection();
    return await this.client.setRange(key, offset, value);
  }

  async strlen(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.strLen(key);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    this.validateConnection();
    return await this.client.mGet(keys);
  }

  async mset(keyValues: Record<string, string>): Promise<string> {
    this.validateConnection();
    return await this.client.mSet(keyValues);
  }

  async incr(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.incr(key);
  }

  async incrBy(key: string, increment: number): Promise<number> {
    this.validateConnection();
    return await this.client.incrBy(key, increment);
  }

  async decr(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.decr(key);
  }

  async decrBy(key: string, decrement: number): Promise<number> {
    this.validateConnection();
    return await this.client.decrBy(key, decrement);
  }

  // ========================================================================
  // Hash Operations
  // ========================================================================

  async hget(key: string, field: string): Promise<string | null> {
    this.validateConnection();
    return await this.client.hGet(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    this.validateConnection();
    return await this.client.hSet(key, field, value);
  }

  async hmget(key: string, fields: string[]): Promise<(string | null)[]> {
    this.validateConnection();
    return await this.client.hMGet(key, fields);
  }

  async hmset(key: string, fields: Record<string, string>): Promise<string> {
    this.validateConnection();
    return await this.client.hMSet(key, fields);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    this.validateConnection();
    return await this.client.hGetAll(key);
  }

  async hdel(key: string, field: string): Promise<number> {
    this.validateConnection();
    return await this.client.hDel(key, field);
  }

  async hexists(key: string, field: string): Promise<number> {
    this.validateConnection();
    return await this.client.hExists(key, field);
  }

  async hkeys(key: string): Promise<string[]> {
    this.validateConnection();
    return await this.client.hKeys(key);
  }

  async hvals(key: string): Promise<string[]> {
    this.validateConnection();
    return await this.client.hVals(key);
  }

  async hlen(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.hLen(key);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    this.validateConnection();
    return await this.client.hIncrBy(key, field, increment);
  }

  // ========================================================================
  // List Operations
  // ========================================================================

  async lpush(key: string, ...values: string[]): Promise<number> {
    this.validateConnection();
    return await this.client.lPush(key, values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    this.validateConnection();
    return await this.client.rPush(key, values);
  }

  async lpop(key: string): Promise<string | null> {
    this.validateConnection();
    return await this.client.lPop(key);
  }

  async rpop(key: string): Promise<string | null> {
    this.validateConnection();
    return await this.client.rPop(key);
  }

  async llen(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.lLen(key);
  }

  async lindex(key: string, index: number): Promise<string | null> {
    this.validateConnection();
    return await this.client.lIndex(key, index);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this.validateConnection();
    return await this.client.lRange(key, start, stop);
  }

  async lset(key: string, index: number, value: string): Promise<string> {
    this.validateConnection();
    return await this.client.lSet(key, index, value);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    this.validateConnection();
    return await this.client.lTrim(key, start, stop);
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    this.validateConnection();
    return await this.client.lRem(key, count, value);
  }

  // ========================================================================
  // Set Operations
  // ========================================================================

  async sadd(key: string, ...members: string[]): Promise<number> {
    this.validateConnection();
    return await this.client.sAdd(key, members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    this.validateConnection();
    return await this.client.sRem(key, members);
  }

  async smembers(key: string): Promise<string[]> {
    this.validateConnection();
    return await this.client.sMembers(key);
  }

  async scard(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.sCard(key);
  }

  async sismember(key: string, member: string): Promise<number> {
    this.validateConnection();
    return await this.client.sIsMember(key, member);
  }

  async spop(key: string, count?: number): Promise<string | string[]> {
    this.validateConnection();
    return await this.client.sPop(key, count);
  }

  async srandmember(key: string, count?: number): Promise<string | string[]> {
    this.validateConnection();
    return await this.client.sRandMember(key, count);
  }

  async smove(source: string, destination: string, member: string): Promise<number> {
    this.validateConnection();
    return await this.client.sMove(source, destination, member);
  }

  async sdiff(...keys: string[]): Promise<string[]> {
    this.validateConnection();
    return await this.client.sDiff(keys);
  }

  async sinter(...keys: string[]): Promise<string[]> {
    this.validateConnection();
    return await this.client.sInter(keys);
  }

  async sunion(...keys: string[]): Promise<string[]> {
    this.validateConnection();
    return await this.client.sUnion(keys);
  }

  // ========================================================================
  // Sorted Set Operations
  // ========================================================================

  async zadd(key: string, score: number, member: string): Promise<number> {
    this.validateConnection();
    return await this.client.zAdd(key, { score, value: member });
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    this.validateConnection();
    return await this.client.zRem(key, members);
  }

  async zscore(key: string, member: string): Promise<number | null> {
    this.validateConnection();
    return await this.client.zScore(key, member);
  }

  async zincrby(key: string, increment: number, member: string): Promise<number> {
    this.validateConnection();
    return await this.client.zIncrBy(key, increment, member);
  }

  async zcard(key: string): Promise<number> {
    this.validateConnection();
    return await this.client.zCard(key);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    this.validateConnection();
    return await this.client.zCount(key, min, max);
  }

  async zrange(key: string, start: number, stop: number, reverse = false): Promise<string[]> {
    this.validateConnection();
    return await this.client.zRange(key, start, stop, { REVERSE: reverse });
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    this.validateConnection();
    return await this.client.zRangeByScore(key, min, max);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    this.validateConnection();
    return await this.client.zRank(key, member);
  }

  async zrevrank(key: string, member: string): Promise<number | null> {
    this.validateConnection();
    return await this.client.zRevRank(key, member);
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    this.validateConnection();
    return await this.client.zRemRangeByRank(key, start, stop);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    this.validateConnection();
    return await this.client.zRemRangeByScore(key, min, max);
  }

  // ========================================================================
  // Pub/Sub Operations
  // ========================================================================

  async publish(channel: string, message: string): Promise<number> {
    this.validateConnection();
    return await this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    this.validateConnection();
    await this.subscriber.subscribe(channel, (message: string) => {
      callback(message);
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    this.validateConnection();
    await this.subscriber.unsubscribe(channel);
  }

  async psubscribe(pattern: string, callback: (message: string, channel: string) => void): Promise<void> {
    this.validateConnection();
    await this.subscriber.pSubscribe(pattern, (message: string, channel: string) => {
      callback(message, channel);
    });
  }

  async punsubscribe(pattern: string): Promise<void> {
    this.validateConnection();
    await this.subscriber.pUnsubscribe(pattern);
  }

  // ========================================================================
  // Transaction Operations
  // ========================================================================

  async multi(): Promise<RedisMulti> {
    this.validateConnection();
    const multi = this.client.multi();
    return new RedisMulti(multi, this);
  }

  // ========================================================================
  // Scripting
  // ========================================================================

  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    this.validateConnection();
    return await this.client.eval(script, {
      keys,
      arguments: args,
    });
  }

  async evalsha(sha: string, keys: string[], args: string[]): Promise<any> {
    this.validateConnection();
    return await this.client.evalSHA(sha, {
      keys,
      arguments: args,
    });
  }

  async scriptLoad(script: string): Promise<string> {
    this.validateConnection();
    return await this.client.scriptLoad(script);
  }

  async scriptFlush(): Promise<string> {
    this.validateConnection();
    return await this.client.scriptFlush();
  }

  async scriptExists(...sha: string[]): Promise<number[]> {
    this.validateConnection();
    return await this.client.scriptExists(sha);
  }

  // ========================================================================
  // Server Operations
  // ========================================================================

  async flushDb(): Promise<string> {
    this.validateConnection();
    return await this.client.flushDb();
  }

  async flushAll(): Promise<string> {
    this.validateConnection();
    return await this.client.flushAll();
  }

  async dbSize(): Promise<number> {
    this.validateConnection();
    return await this.client.dbSize();
  }

  async info(section?: string): Promise<string> {
    this.validateConnection();
    return await this.client.info(section);
  }

  async ping(message?: string): Promise<string> {
    this.validateConnection();
    return await this.client.ping(message);
  }

  async select(index: number): Promise<string> {
    this.validateConnection();
    return await this.client.select(index);
  }

  // ========================================================================
  // Key Operations
  // ========================================================================

  async keys(pattern: string): Promise<string[]> {
    this.validateConnection();
    return await this.client.keys(pattern);
  }

  async scan(cursor: number, pattern?: string, count?: number): Promise<[string, string[]]> {
    this.validateConnection();
    return await this.client.scan(cursor, { MATCH: pattern, COUNT: count });
  }

  async randomKey(): Promise<string | null> {
    this.validateConnection();
    return await this.client.randomKey();
  }

  // ========================================================================
  // Compatibility Methods (for DatabaseAdapter interface)
  // ========================================================================

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    // Redis doesn't support SQL queries, but we can parse basic commands
    const startTime = Date.now();

    try {
      const command = sql.trim().split(/\s+/)[0].toUpperCase();
      let result: any = null;

      switch (command) {
        case 'GET':
          result = await this.get(params?.[0] || '');
          break;
        case 'SET':
          result = await this.set(params?.[0] || '', params?.[1] || '');
          break;
        case 'HGET':
          result = await this.hget(params?.[0] || '', params?.[1] || '');
          break;
        case 'HSET':
          result = await this.hset(params?.[0] || '', params?.[1] || '', params?.[2] || '');
          break;
        case 'LRANGE':
          result = await this.lrange(params?.[0] || '', 0, -1);
          break;
        case 'KEYS':
          result = await this.keys(params?.[0] || '*');
          break;
        default:
          throw new Error(`Unsupported Redis command: ${command}`);
      }

      return {
        rows: Array.isArray(result) ? result : [result],
        rowCount: Array.isArray(result) ? result.length : 1,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Redis command failed: ${error}`);
    }
  }

  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    return this.query(sql, params);
  }

  quoteIdentifier(identifier: string): string {
    return identifier;
  }

  getPlaceholder(): string {
    return '?';
  }

  async getTableInfo(table: string): Promise<FieldInfo[]> {
    // Redis doesn't have tables, but we can return key patterns
    const keys = await this.keys(`${table}*`);
    return keys.map(key => ({
      name: key,
      type: 'string',
      nullable: true,
    }));
  }

  async tableExists(table: string): Promise<boolean> {
    const keys = await this.keys(`${table}*`);
    return keys.length > 0;
  }

  async createTable(table: string, schema: Record<string, any>): Promise<void> {
    // Redis doesn't have tables, but we can create a hash for the table
    // This is a no-op for Redis
  }

  async dropTable(table: string): Promise<void> {
    // Delete all keys matching the table pattern
    const keys = await this.keys(`${table}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async alterTable(table: string, changes: Record<string, any>): Promise<void> {
    // Redis doesn't have schema, no-op
  }

  async truncateTable(table: string): Promise<void> {
    await this.dropTable(table);
  }

  async addColumn(table: string, column: string, definition: any): Promise<void> {
    // No-op for Redis
  }

  async dropColumn(table: string, column: string): Promise<void> {
    // No-op for Redis
  }

  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    // No-op for Redis
  }

  async changeColumn(table: string, column: string, definition: any): Promise<void> {
    // No-op for Redis
  }

  async addIndex(table: string, columns: string[], options?: any): Promise<void> {
    // No-op for Redis
  }

  async dropIndex(table: string, indexName: string): Promise<void> {
    // No-op for Redis
  }

  async beginTransaction(): Promise<any> {
    return this.multi();
  }

  async commitTransaction(multi: RedisMulti): Promise<void> {
    await multi.exec();
  }

  async rollbackTransaction(multi: RedisMulti): Promise<void> {
    multi.discard();
  }
}

// ============================================================================
// Redis Multi/Transaction Helper
// ============================================================================

export class RedisMulti {
  private multi: any;
  private adapter: RedisAdapter;
  private commands: Array<{ command: string; args: any[] }> = [];

  constructor(multi: any, adapter: RedisAdapter) {
    this.multi = multi;
    this.adapter = adapter;
  }

  get(key: string): RedisMulti {
    this.commands.push({ command: 'get', args: [key] });
    this.multi.get(key);
    return this;
  }

  set(key: string, value: string): RedisMulti {
    this.commands.push({ command: 'set', args: [key, value] });
    this.multi.set(key, value);
    return this;
  }

  hget(key: string, field: string): RedisMulti {
    this.commands.push({ command: 'hget', args: [key, field] });
    this.multi.hGet(key, field);
    return this;
  }

  hset(key: string, field: string, value: string): RedisMulti {
    this.commands.push({ command: 'hset', args: [key, field, value] });
    this.multi.hSet(key, field, value);
    return this;
  }

  lpush(key: string, ...values: string[]): RedisMulti {
    this.commands.push({ command: 'lpush', args: [key, ...values] });
    this.multi.lPush(key, values);
    return this;
  }

  async exec(): Promise<any[]> {
    const results = await this.multi.exec();
    return results.map((r: any) => r.value);
  }

  discard(): void {
    this.multi.discard();
    this.commands = [];
  }
}
