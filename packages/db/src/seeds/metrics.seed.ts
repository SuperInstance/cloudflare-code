/**
 * Metrics seeder for testing
 */

import { Seeder, SeedContext } from './types';

export interface MetricSeedData {
  name: string;
  type: string;
  value: number;
  labels: Record<string, any>;
}

export class MetricsSeeder extends Seeder<MetricSeedData> {
  readonly name = 'metrics';
  readonly tableName = 'metrics';
  readonly description = 'Seed sample metrics for testing';

  async data(context: SeedContext): Promise<MetricSeedData[]> {
    const now = Date.now();
    const metrics: MetricSeedData[] = [];

    // Generate sample metrics for the last hour
    for (let i = 0; i < 60; i++) {
      const timestamp = now - i * 60000; // Every minute

      metrics.push(
        {
          name: 'api_requests_total',
          type: 'counter',
          value: Math.floor(Math.random() * 100) + 50,
          labels: { endpoint: '/api/v1/chat', method: 'POST' }
        },
        {
          name: 'api_latency_ms',
          type: 'histogram',
          value: Math.floor(Math.random() * 500) + 50,
          labels: { endpoint: '/api/v1/chat' }
        },
        {
          name: 'active_users',
          type: 'gauge',
          value: Math.floor(Math.random() * 50) + 10,
          labels: {}
        }
      );
    }

    return metrics;
  }

  protected async insertRow(context: SeedContext, row: MetricSeedData): Promise<void> {
    await context.db
      .prepare(
        `
        INSERT INTO ${this.tableName} (name, type, value, labels, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `
      )
      .bind(row.name, row.type, row.value, JSON.stringify(row.labels), Date.now())
      .run();
  }

  protected async beforeSeed(context: SeedContext): Promise<void> {
    await context.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }
}
