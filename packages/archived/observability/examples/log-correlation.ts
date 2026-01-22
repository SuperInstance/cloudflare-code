/**
 * Log correlation with traces example
 */

import { StructuredLogger, LogLevel } from '@claudeflare/observability';

async function main() {
  const logger = new StructuredLogger('user-service', {
    level: LogLevel.INFO,
    enableCorrelation: true,
  });

  // Simulate a request with trace context
  const traceId = 'trace-123456';
  const spanId = 'span-789012';

  logger.setTraceContext(traceId, spanId);

  logger.info('Handling user request', {
    userId: 'user-123',
    endpoint: '/api/users/profile',
  });

  try {
    logger.debug('Fetching user from database', {
      userId: 'user-123',
    });

    await fetchUser('user-123');

    logger.info('User fetched successfully', {
      userId: 'user-123',
      username: 'johndoe',
    });

  } catch (error) {
    logger.error('Failed to fetch user', error as Error, {
      userId: 'user-123',
    });

    throw error;
  } finally {
    logger.clearTraceContext();
  }

  // Get logs for the trace
  const traceLogs = logger.getLogsForTrace(traceId);
  console.log('Logs for trace:', traceLogs);

  // Get statistics
  const stats = logger.getStatistics();
  console.log('Logger statistics:', stats);
}

async function fetchUser(userId: string): Promise<void> {
  // Simulate fetching user
  await new Promise((resolve) => setTimeout(resolve, 100));
}

main().catch(console.error);
