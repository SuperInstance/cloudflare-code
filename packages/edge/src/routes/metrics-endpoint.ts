/**
 * Prometheus Metrics Endpoint
 *
 * HTTP endpoint for exposing metrics in Prometheus format.
 * Integrates with the monitoring system to provide real-time metrics.
 */

import type { MetricsCollector, MonitoringSystem } from '../lib/monitoring';
import { Hono } from 'hono';

const app = new Hono();

/**
 * GET /metrics - Prometheus metrics endpoint
 */
app.get('/metrics', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.text('Monitoring system not initialized', 503);
  }

  const metrics = await monitoring.metrics.exportPrometheus();

  return c.text(metrics, 200, {
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
  });
});

/**
 * GET /metrics/json - Metrics in JSON format
 */
app.get('/metrics/json', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const metrics = monitoring.metrics.exportJSON();

  return c.json(metrics);
});

/**
 * GET /metrics/stats - Metrics statistics
 */
app.get('/metrics/stats', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const stats = monitoring.metrics.getStats();

  return c.json(stats);
});

/**
 * GET /dashboard - Dashboard data
 */
app.get('/dashboard', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const timeRange = (c.req.query('timeRange') as 'hour' | 'day' | 'week') || 'day';
  const forceRefresh = c.req.query('refresh') === 'true';

  const dashboard = await monitoring.dashboard.getData(timeRange, forceRefresh);

  return c.json(dashboard);
});

/**
 * GET /dashboard/export - Export dashboard data
 */
app.get('/dashboard/export', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const format = (c.req.query('format') as 'json' | 'prometheus' | 'grafana') || 'json';
  const exported = await monitoring.dashboard.export(format);

  return c.text(exported.data, 200, {
    'Content-Type': exported.contentType,
  });
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({
      healthy: false,
      error: 'Monitoring system not initialized',
    }, 503);
  }

  const health = await monitoring.getHealthStatus();

  const statusCode = health.healthy ? 200 : 503;

  return c.json(health, statusCode);
});

/**
 * GET /alerts - Get alerts
 */
app.get('/alerts', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const alerts = monitoring.alertManager.getAlertSummary();

  return c.json(alerts);
});

/**
 * GET /alerts/active - Get active alerts
 */
app.get('/alerts/active', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const activeAlerts = monitoring.alertManager.getActiveAlerts();

  return c.json(activeAlerts);
});

/**
 * POST /alerts/:alertId/resolve - Resolve an alert
 */
app.post('/alerts/:alertId/resolve', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const alertId = c.req.param('alertId');

  try {
    monitoring.alertManager.resolveAlert(alertId);

    return c.json({ success: true, alertId });
  } catch (error) {
    return c.json({
      error: 'Alert not found',
      alertId,
    }, 404);
  }
});

/**
 * POST /alerts/:alertId/acknowledge - Acknowledge an alert
 */
app.post('/alerts/:alertId/acknowledge', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const alertId = c.req.param('alertId');
  const body = await c.req.json();
  const acknowledgedBy = body.acknowledgedBy || 'unknown';

  try {
    monitoring.alertManager.acknowledgeAlert(alertId, acknowledgedBy);

    return c.json({ success: true, alertId, acknowledgedBy });
  } catch (error) {
    return c.json({
      error: 'Alert not found',
      alertId,
    }, 404);
  }
});

/**
 * GET /traces - Get trace summary
 */
app.get('/traces', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const stats = monitoring.tracer.getStats();

  return c.json(stats);
});

/**
 * GET /traces/:traceId - Get trace details
 */
app.get('/traces/:traceId', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const traceId = c.req.param('traceId');
  const traces = monitoring.tracer.getTrace(traceId);

  if (traces.length === 0) {
    return c.json({
      error: 'Trace not found',
      traceId,
    }, 404);
  }

  const stats = monitoring.tracer.getTraceStats(traceId);

  return c.json({
    traceId,
    spans: traces,
    stats,
  });
});

/**
 * GET /logs - Get log summary
 */
app.get('/logs', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const logger = monitoring.logger as any;
  const stats = logger.getStats ? logger.getStats() : null;

  return c.json(stats || { error: 'Logger statistics not available' });
});

/**
 * GET /logs/entries - Get log entries
 */
app.get('/logs/entries', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const logger = monitoring.logger as any;
  const limit = parseInt(c.req.query('limit') || '100');
  const level = c.req.query('level');

  const entries = logger.getEntries ? logger.getEntries({ limit, level }) : [];

  return c.json(entries);
});

/**
 * GET /profiles - Get profile statistics
 */
app.get('/profiles', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const stats = monitoring.profiler.getStats();

  return c.json(stats);
});

/**
 * GET /profiles/:profileId - Get profile details
 */
app.get('/profiles/:profileId', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const profileId = c.req.param('profileId');
  const profile = monitoring.profiler.getProfile(profileId);

  if (!profile) {
    return c.json({
      error: 'Profile not found',
      profileId,
    }, 404);
  }

  return c.json(profile);
});

/**
 * GET /export - Export all monitoring data
 */
app.get('/export', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  const data = await monitoring.exportAll();

  return c.json(data);
});

/**
 * POST /shutdown - Shutdown monitoring system
 */
app.post('/shutdown', async (c) => {
  const monitoring = c.get('monitoring') as MonitoringSystem;

  if (!monitoring) {
    return c.json({ error: 'Monitoring system not initialized' }, 503);
  }

  await monitoring.shutdown();

  return c.json({ success: true, message: 'Monitoring system shut down' });
});

export default app;
