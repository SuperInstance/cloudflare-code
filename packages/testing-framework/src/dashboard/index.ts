/**
 * Dashboard Module for ClaudeFlare Testing Framework
 * Provides real-time dashboards and analytics for testing results
 */

export * from './realtime';
export * from './analytics';
export * from './visualization';
export * from './reports';
export * from './types';

// Main exports for dashboard
export { createDashboard, Dashboard } from './realtime';
export { TestAnalytics } from './analytics';
export { TestVisualization } from './visualization';
export { ReportGenerator } from './reports';
export { DashboardConfig } from './types';