/**
 * User seeder for development/testing
 */

import { Seeder, SeedContext } from './types';

export interface UserSeedData {
  email: string;
  username: string;
  password_hash: string;
  full_name: string;
  bio?: string;
  email_verified?: boolean;
}

export class UsersSeeder extends Seeder<UserSeedData> {
  readonly name = 'users';
  readonly tableName = 'users';
  readonly description = 'Seed initial users for development';

  async data(context: SeedContext): Promise<UserSeedData[]> {
    // In development, seed test users
    if (context.env === 'development' || context.env === 'test') {
      return [
        {
          email: 'admin@claudeflare.dev',
          username: 'admin',
          password_hash: '$2a$10$K8J8Z8Z8Z8Z8Z8Z8Z8Z8Zu.', // bcrypt hash for 'password123'
          full_name: 'Admin User',
          bio: 'System administrator',
          email_verified: true
        },
        {
          email: 'developer@claudeflare.dev',
          username: 'developer',
          password_hash: '$2a$10$K8J8Z8Z8Z8Z8Z8Z8Z8Z8Zu.',
          full_name: 'Developer User',
          bio: 'Developer account',
          email_verified: true
        },
        {
          email: 'test@claudeflare.dev',
          username: 'testuser',
          password_hash: '$2a$10$K8J8Z8Z8Z8Z8Z8Z8Z8Z8Zu.',
          full_name: 'Test User',
          email_verified: true
        }
      ];
    }

    return [];
  }

  protected async beforeSeed(context: SeedContext): Promise<void> {
    if (context.env === 'development' || context.env === 'test') {
      await context.db.prepare(`DELETE FROM ${this.tableName}`).run();
    }
  }
}
