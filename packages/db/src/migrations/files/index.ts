/**
 * Migration files index - exports all migrations
 */

import { CreateUsersTableMigration } from './001_create_users_table';
import { CreateSessionsTableMigration } from './002_create_sessions_table';
import { CreateApiKeysTableMigration } from './003_create_api_keys_table';
import { CreateOrganizationsTableMigration } from './004_create_organizations_table';
import { CreateConversationsTableMigration } from './005_create_conversations_table';
import { CreateMessagesTableMigration } from './006_create_messages_table';
import { CreateAgentTasksTableMigration } from './007_create_agent_tasks_table';
import { CreateCodeReviewsTableMigration } from './008_create_code_reviews_table';
import { CreateFeatureFlagsTableMigration } from './009_create_feature_flags_table';
import { CreateExperimentsTableMigration } from './010_create_experiments_table';
import { CreateRateLimitsTableMigration } from './011_create_rate_limits_table';
import { CreateMetricsTableMigration } from './012_create_metrics_table';
import { CreateLogsTableMigration } from './013_create_logs_table';
import { CreateAlertsTableMigration } from './014_create_alerts_table';
import { CreateTracesTableMigration } from './015_create_traces_table';
import { CreateCacheEntriesTableMigration } from './016_create_cache_entries_table';
import { CreateEmbeddingsTableMigration } from './017_create_embeddings_table';
import { CreateVectorIndexesTableMigration } from './018_create_vector_indexes_table';
import { CreateProjectsTableMigration } from './019_create_projects_table';
import { CreateDeploymentsTableMigration } from './020_create_deployments_table';
import { CreateWebhooksTableMigration } from './021_create_webhooks_table';
import { CreateNotificationsTableMigration } from './022_create_notifications_table';
import { CreateAuditLogsTableMigration } from './023_create_audit_logs_table';
import { CreateScheduledTasksTableMigration } from './024_create_scheduled_tasks_table';

/**
 * All migrations in order
 */
export const ALL_MIGRATIONS = [
  new CreateUsersTableMigration(),
  new CreateSessionsTableMigration(),
  new CreateApiKeysTableMigration(),
  new CreateOrganizationsTableMigration(),
  new CreateConversationsTableMigration(),
  new CreateMessagesTableMigration(),
  new CreateAgentTasksTableMigration(),
  new CreateCodeReviewsTableMigration(),
  new CreateFeatureFlagsTableMigration(),
  new CreateExperimentsTableMigration(),
  new CreateRateLimitsTableMigration(),
  new CreateMetricsTableMigration(),
  new CreateLogsTableMigration(),
  new CreateAlertsTableMigration(),
  new CreateTracesTableMigration(),
  new CreateCacheEntriesTableMigration(),
  new CreateEmbeddingsTableMigration(),
  new CreateVectorIndexesTableMigration(),
  new CreateProjectsTableMigration(),
  new CreateDeploymentsTableMigration(),
  new CreateWebhooksTableMigration(),
  new CreateNotificationsTableMigration(),
  new CreateAuditLogsTableMigration(),
  new CreateScheduledTasksTableMigration()
];

/**
 * Get migrations by version
 */
export function getMigrationByVersion(version: number) {
  return ALL_MIGRATIONS.find((m) => m.version === version);
}

/**
 * Get migrations by version range
 */
export function getMigrationsInRange(minVersion: number, maxVersion: number) {
  return ALL_MIGRATIONS.filter((m) => m.version >= minVersion && m.version <= maxVersion);
}

/**
 * Get migrations by category
 */
export function getMigrationsByCategory(category: 'users' | 'ai' | 'config' | 'monitoring' | 'cache' | 'all') {
  const categoryMap: Record<string, number[]> = {
    users: [1, 2, 3, 4],
    ai: [5, 6, 7, 8],
    config: [9, 10, 11, 24],
    monitoring: [12, 13, 14, 15],
    cache: [16, 17, 18],
    all: ALL_MIGRATIONS.map((m) => m.version)
  };

  const versions = categoryMap[category] || categoryMap.all;
  return ALL_MIGRATIONS.filter((m) => versions.includes(m.version));
}
