/**
 * Command registration exports
 *
 * Centralized export point for all CLI commands.
 */

export { registerInitCommand } from './init.js';
export { registerNewCommand } from './new.js';
export { registerDevCommand } from './dev.js';
export { registerRunCommand } from './run.js';
export { registerBuildCommand } from './build.js';
export { registerDeployCommand } from './deploy.js';
export { registerTestCommand } from './test.js';
export { registerLogsCommand } from './logs.js';
export { registerTailCommand } from './tail.js';
export { registerConfigCommand } from './config.js';
export { registerEnvCommand } from './env.js';
export { registerSecretsCommand } from './secrets.js';
export { registerKVCommand } from './kv.js';
export { registerR2Command } from './r2.js';
export { registerDurableCommand } from './durable.js';
export { registerAddCommand } from './add.js';
export { registerRemoveCommand } from './remove.js';
export { registerDoctorCommand } from './doctor.js';
export { registerStatusCommand } from './status.js';
export { registerAnalyticsCommand } from './analytics.js';
export { registerMetricsCommand } from './metrics.js';
export { registerLoginCommand } from './auth/login.js';
export { registerLogoutCommand } from './auth/logout.js';
export { registerWhoamiCommand } from './auth/whoami.js';
export { registerRollbackCommand } from './rollback.js';
export { registerUpgradeCommand } from './upgrade.js';
export { registerDocsCommand } from './docs.js';
export { registerCompletionCommand } from './completion.js';
export { registerVersionCommand } from './version.js';
