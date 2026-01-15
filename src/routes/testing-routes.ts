/**
 * Testing Routes
 * Comprehensive testing API endpoints for ClaudeFlare
 */

import { Hono } from 'hono';
import { TestingService } from '../services/testing-service';

export function createTestingRoutes(testingService: TestingService) {
  const router = new Hono<{ Bindings: any }>();

  // ============================================================================
  // Test Suite Management
  // ============================================================================

  // Create a new test suite
  router.post('/suites', async (c) => {
    try {
      const request = await c.req.json();

      if (!request.name || !request.tests) {
        return c.json({
          success: false,
          error: 'Name and tests are required'
        }, 400);
      }

      const suite = await testingService.createTestSuite(
        request.name,
        request.description || '',
        request.tests
      );

      return c.json({
        success: true,
        suite,
        message: 'Test suite created successfully'
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test suite'
      }, 500);
    }
  });

  // List all test suites
  router.get('/suites', async (c) => {
    try {
      const suites = await testingService.getTestSuites();
      return c.json({
        success: true,
        suites,
        count: suites.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to list test suites'
      }, 500);
    }
  });

  // Get specific test suite
  router.get('/suites/:suiteId', async (c) => {
    try {
      const suiteId = c.req.param('suiteId');
      const suite = await testingService.getTestSuite(suiteId);

      if (!suite) {
        return c.json({
          success: false,
          error: 'Test suite not found'
        }, 404);
      }

      return c.json({
        success: true,
        suite,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to get test suite'
      }, 500);
    }
  });

  // Execute a test suite
  router.post('/suites/:suiteId/execute', async (c) => {
    try {
      const suiteId = c.req.param('suiteId');
      const report = await testingService.executeTestSuite(suiteId);

      return c.json({
        success: true,
        report,
        message: 'Test suite execution started'
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute test suite'
      }, 500);
    }
  });

  // ============================================================================
  // Test Execution Management
  // ============================================================================

  // List test reports
  router.get('/reports', async (c) => {
    try {
      const suiteId = c.req.query('suiteId');
      const reports = await testingService.getTestReports(suiteId || undefined);

      return c.json({
        success: true,
        reports,
        count: reports.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to list test reports'
      }, 500);
    }
  });

  // Get specific test report
  router.get('/reports/:executionId', async (c) => {
    try {
      const executionId = c.req.param('executionId');
      const report = await testingService.getTestReport(executionId);

      if (!report) {
        return c.json({
          success: false,
          error: 'Test report not found'
        }, 404);
      }

      return c.json({
        success: true,
        report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to get test report'
      }, 500);
    }
  });

  // Generate test report (markdown)
  router.get('/reports/:executionId/markdown', async (c) => {
    try {
      const executionId = c.req.param('executionId');
      const report = await testingService.generateTestReport(executionId);

      return c.text(report, 200, {
        'Content-Type': 'text/markdown',
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate test report'
      }, 500);
    }
  });

  // Get test execution history
  router.get('/history', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '20');
      const history = await testingService.getTestExecutionHistory(limit);

      return c.json({
        success: true,
        history,
        count: history.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to get test execution history'
      }, 500);
    }
  });

  // ============================================================================
  // Test Health and Statistics
  // ============================================================================

  // Get testing service health
  router.get('/health', async (c) => {
    try {
      const health = await testingService.getTestingHealth();

      return c.json({
        success: true,
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to get testing health'
      }, 500);
    }
  });

  // Get testing statistics
  router.get('/stats', async (c) => {
    try {
      const suites = await testingService.getTestSuites();
      const reports = await testingService.getTestReports();
      const history = await testingService.getTestExecutionHistory(100);

      // Calculate statistics
      const totalExecutions = reports.length;
      const successfulExecutions = reports.filter(r => r.results.failed === 0).length;
      const totalTests = reports.reduce((sum, r) => sum + r.results.total, 0);
      const passedTests = reports.reduce((sum, r) => sum + r.results.passed, 0);
      const failedTests = reports.reduce((sum, r) => sum + r.results.failed, 0);

      const avgDuration = totalExecutions > 0
        ? reports.reduce((sum, r) => sum + (r.duration || 0), 0) / totalExecutions
        : 0;

      // Category distribution
      const categoryStats: Record<string, number> = {};
      suites.forEach(suite => {
        suite.tests.forEach(test => {
          categoryStats[test.category] = (categoryStats[test.category] || 0) + 1;
        });
      });

      return c.json({
        success: true,
        stats: {
          totalSuites: suites.length,
          totalExecutions,
          successfulExecutions,
          successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
          totalTests,
          passedTests,
          failedTests,
          passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
          averageDuration: avgDuration,
          categoryDistribution: categoryStats,
          recentActivity: history.length,
          oldestExecution: history[0]?.startTime,
          newestExecution: history[history.length - 1]?.startTime,
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to get testing statistics'
      }, 500);
    }
  });

  // ============================================================================
  // Utility Endpoints
  // ============================================================================

  // Create a demo test suite
  router.post('/demo-suite', async (c) => {
    try {
      const demoTests = [
        {
          name: 'Authentication Login Test',
          description: 'Test user login functionality',
          category: 'integration' as const,
          metadata: { endpoint: '/api/v1/auth/login', method: 'POST' },
        },
        {
          name: 'Code Review API Test',
          description: 'Test code review endpoint',
          category: 'integration' as const,
          metadata: { endpoint: '/api/v1/code-review', method: 'POST' },
        },
        {
          name: 'Security Scan Test',
          description: 'Test security scanning endpoint',
          category: 'integration' as const,
          metadata: { endpoint: '/api/v1/security-test', method: 'POST' },
        },
        {
          name: 'Performance Load Test',
          description: 'Test performance under load',
          category: 'performance' as const,
          metadata: { loadLevel: 10, duration: 30 },
        },
        {
          name: 'Security Vulnerability Scan',
          description: 'Test security scanning capabilities',
          category: 'security' as const,
          metadata: { scanType: 'vulnerability' },
        },
        {
          name: 'End-to-End User Flow',
          description: 'Test complete user journey',
          category: 'e2e' as const,
          metadata: { flow: 'registration-to-login' },
        },
      ];

      const suite = await testingService.createTestSuite(
        'ClaudeFlare Demo Suite',
        'A comprehensive demo test suite for ClaudeFlare platform',
        demoTests
      );

      return c.json({
        success: true,
        suite,
        message: 'Demo test suite created successfully'
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to create demo test suite'
      }, 500);
    }
  });

  // Execute demo test suite
  router.post('/demo-execute', async (c) => {
    try {
      const suites = await testingService.getTestSuites();
      const demoSuite = suites.find(s => s.name === 'ClaudeFlare Demo Suite');

      if (!demoSuite) {
        // Create demo suite first
        const response = await c.req.json();
        await fetch(c.req.url + '/demo-suite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        });
        // Try again
        const newSuites = await testingService.getTestSuites();
        const newDemoSuite = newSuites.find(s => s.name === 'ClaudeFlare Demo Suite');
        if (!newDemoSuite) {
          throw new Error('Failed to create demo suite');
        }
        const report = await testingService.executeTestSuite(newDemoSuite.id);
        return c.json({ success: true, report });
      }

      const report = await testingService.executeTestSuite(demoSuite.id);
      return c.json({ success: true, report });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute demo suite'
      }, 500);
    }
  });

  // Clean up old test data
  router.delete('/cleanup', async (c) => {
    try {
      const olderThanDays = parseInt(c.req.query('days') || '30');
      const cleanedCount = await testingService.cleanupOldData(olderThanDays);

      return c.json({
        success: true,
        message: `Cleaned up ${cleanedCount} old test records`,
        cleanedCount,
        olderThanDays,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Failed to cleanup test data'
      }, 500);
    }
  });

  return router;
}