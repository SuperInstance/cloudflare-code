/**
 * Seeders index
 */

import { UsersSeeder } from './users.seed';
import { FeatureFlagsSeeder } from './feature_flags.seed';
import { MetricsSeeder } from './metrics.seed';
import type { Seeder } from './types';

/**
 * All seeders
 */
export const ALL_SEEDERS: Seeder[] = [
  new UsersSeeder(),
  new FeatureFlagsSeeder(),
  new MetricsSeeder()
];

/**
 * Get seeders by environment
 */
export function getSeedersForEnvironment(env: string): Seeder[] {
  if (env === 'production') {
    // Only seed feature flags in production
    return [new FeatureFlagsSeeder()];
  }

  // Seed everything in development/test
  return ALL_SEEDERS;
}

/**
 * Get seeder by name
 */
export function getSeederByName(name: string): Seeder | undefined {
  return ALL_SEEDERS.find((s) => s.name === name);
}

export * from './types';
export * from './runner';
export * from './users.seed';
export * from './feature_flags.seed';
export * from './metrics.seed';
