/**
 * Network Optimization Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { NetworkOptimizer } from '../src/network/optimizer.js';

describe('NetworkOptimizer', () => {
  it('should create optimizer instance', () => {
    const optimizer = new NetworkOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should batch requests', async () => {
    const optimizer = new NetworkOptimizer({
      requestBatching: true,
      batchSize: 3,
      batchTimeout: 100,
    });

    const promises = [
      optimizer.batchRequest({ id: '1', url: '/api/1', method: 'GET', priority: 1 }),
      optimizer.batchRequest({ id: '2', url: '/api/2', method: 'GET', priority: 1 }),
      optimizer.batchRequest({ id: '3', url: '/api/3', method: 'GET', priority: 1 }),
    ];

    await Promise.all(promises);

    expect(optimizer.getPendingBatchCount()).toBe(0);
  });

  it('should compress data', () => {
    const optimizer = new NetworkOptimizer({ compression: true });
    const result = optimizer.compressData('hello world');

    expect(result).toHaveProperty('compressed');
    expect(result).toHaveProperty('originalSize');
    expect(result).toHaveProperty('compressedSize');
    expect(result).toHaveProperty('ratio');
  });

  it('should skip compression for small data', () => {
    const optimizer = new NetworkOptimizer({ compression: true });
    const result = optimizer.compressData('hi');

    expect(result.ratio).toBe(0);
  });

  it('should create connection pool', () => {
    const optimizer = new NetworkOptimizer();
    const pool = optimizer.createConnectionPool('example.com', { maxConnections: 10 });

    expect(pool).toHaveProperty('available');
    expect(pool).toHaveProperty('active');
    expect(pool).toHaveProperty('max');
    expect(pool.max).toBe(10);
  });

  it('should get connection pool', () => {
    const optimizer = new NetworkOptimizer();
    optimizer.createConnectionPool('example.com');

    const pool = optimizer.getConnectionPool('example.com');
    expect(pool).toBeDefined();

    const missing = optimizer.getConnectionPool('unknown.com');
    expect(missing).toBeUndefined();
  });

  it('should analyze network performance', () => {
    const optimizer = new NetworkOptimizer();
    const analysis = optimizer.analyze();

    expect(analysis).toHaveProperty('metrics');
    expect(analysis).toHaveProperty('batches');
    expect(analysis).toHaveProperty('connectionPool');
    expect(analysis).toHaveProperty('recommendations');
  });

  it('should get metrics', () => {
    const optimizer = new NetworkOptimizer();
    const metrics = optimizer.getMetrics();

    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('successfulRequests');
    expect(metrics).toHaveProperty('failedRequests');
    expect(metrics).toHaveProperty('avgLatency');
  });

  it('should reset metrics', () => {
    const optimizer = new NetworkOptimizer();

    // Simulate some requests
    optimizer.batchRequest({ id: '1', url: '/api', method: 'GET', priority: 1 });

    optimizer.resetMetrics();

    const metrics = optimizer.getMetrics();
    expect(metrics.totalRequests).toBe(0);
  });

  it('should generate report', () => {
    const optimizer = new NetworkOptimizer();
    const report = optimizer.generateReport();

    expect(report).toContain('Network Optimization Report');
    expect(report).toContain('Metrics');
  });

  it('should generate recommendations', () => {
    const optimizer = new NetworkOptimizer({
      requestBatching: false,
      compression: false,
      http2: false,
    });

    const analysis = optimizer.analyze();
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should update config', () => {
    const optimizer = new NetworkOptimizer();

    optimizer.updateConfig({ batchSize: 20 });
    const config = optimizer.getConfig();

    expect(config.batchSize).toBe(20);
  });

  it('should flush all batches', async () => {
    const optimizer = new NetworkOptimizer({
      requestBatching: true,
      batchTimeout: 10000, // Long timeout
    });

    optimizer.batchRequest({ id: '1', url: '/api/1', method: 'GET', priority: 1 });

    expect(optimizer.getPendingBatchCount()).toBeGreaterThan(0);

    await optimizer.flushAllBatches();

    expect(optimizer.getPendingBatchCount()).toBe(0);
  });

  it('should clear connection pools', () => {
    const optimizer = new NetworkOptimizer();
    optimizer.createConnectionPool('example.com');
    optimizer.createConnectionPool('api.example.com');

    optimizer.clearConnectionPools();

    const pool = optimizer.getConnectionPool('example.com');
    expect(pool).toBeUndefined();
  });
});
