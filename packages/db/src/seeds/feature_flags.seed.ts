/**
 * Feature flags seeder
 */

import { Seeder, SeedContext } from './types';

export interface FeatureFlagSeedData {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'percentage' | 'json';
  value?: any;
}

export class FeatureFlagsSeeder extends Seeder<FeatureFlagSeedData> {
  readonly name = 'feature_flags';
  readonly tableName = 'feature_flags';
  readonly description = 'Seed default feature flags';

  async data(context: SeedContext): Promise<FeatureFlagSeedData[]> {
    return [
      {
        key: 'ai_agent_enabled',
        name: 'AI Agent',
        description: 'Enable AI agent functionality',
        enabled: true,
        type: 'boolean'
      },
      {
        key: 'code_review_enabled',
        name: 'Code Review',
        description: 'Enable AI-powered code review',
        enabled: true,
        type: 'boolean'
      },
      {
        key: 'vector_search_enabled',
        name: 'Vector Search',
        description: 'Enable vector similarity search',
        enabled: false,
        type: 'boolean'
      },
      {
        key: 'new_ui_enabled',
        name: 'New UI',
        description: 'Enable new user interface',
        enabled: false,
        type: 'percentage',
        value: { percentage_users: 10 }
      },
      {
        key: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Enable advanced analytics features',
        enabled: false,
        type: 'json',
        value: { tiers: ['enterprise', 'pro'] }
      }
    ];
  }

  protected async beforeSeed(context: SeedContext): Promise<void> {
    await context.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }
}
