/**
 * ClaudeFlare Cloudflare Worker Entry Point
 * Main request handler and routing logic
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CodeReviewService } from './services/code-review-service';
import { SecurityTestingService } from './services/security-testing-service';

type Bindings = {
  // KV Storage
  CACHE_KV: KVNamespace;
  
  // Durable Objects
  AGENT_ORCHESTRATOR: DurableObjectNamespace;
  VECTOR_INDEX: DurableObjectNamespace;
  
  // R2 Storage
  STORAGE_BUCKET: R2Bucket;
  
  // D1 Database
  DB: D1Database;
  
  // Queue
  TASK_QUEUE: Queue;
  
  // Environment variables
  ENVIRONMENT: string;
  API_ENDPOINT: string;
  GRAPHQL_ENDPOINT: string;
  ENABLE_CACHE: string;
  ENABLE_ANALYTICS: string;
  ENABLE_RATE_LIMITING: string;
  LOG_LEVEL: string;
  PROVIDER_ROUTING_STRATEGY: string;
  MAX_CONCURRENT_REQUESTS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'unknown',
  });
});

// Version endpoint
app.get('/version', (c) => {
  return c.json({
    version: '0.1.0',
    commit: process.env.CF_PAGES_COMMIT_SHA || 'dev',
  });
});

// Metrics endpoint
app.get('/metrics', (c) => {
  return c.json({
    requests: 0,
    errors: 0,
    latency: 0,
  });
});

// API v1 routes
app.route('/api/v1', createAPIRouter());

// Durable Object routes
app.route('/api/do', createDORouter());

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

function createAPIRouter() {
  const router = new Hono<{ Bindings: Bindings }>();
  const codeReviewService = new CodeReviewService();
  const securityTestingService = new SecurityTestingService();

  router.get('/test', (c) => {
    return c.json({
      status: 'ok',
      message: 'API is working',
    });
  });

  router.post('/test', async (c) => {
    const body = await c.req.json();
    return c.json({
      status: 'ok',
      received: body,
    });
  });

  // Code review endpoints
  router.post('/code-review', async (c) => {
    try {
      const request = await c.req.json();

      // Validate request
      if (!request.content) {
        return c.json({
          success: false,
          error: 'Content is required'
        }, 400);
      }

      // Extract optional parameters
      const {
        filePath = 'code.ts',
        config = {}
      } = request;

      // Perform code review
      const result = await codeReviewService.reviewCode({
        content: request.content,
        filePath,
        config
      });

      // Return result with proper HTTP status
      if (result.success) {
        return c.json(result);
      } else {
        return c.json(result, 400);
      }
    } catch (error) {
      console.error('Code review error:', error);
      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  });

  // Code review endpoint with file path parameter
  router.post('/code-review/:filePath', async (c) => {
    try {
      const filePath = c.req.param('filePath');
      const request = await c.req.json();

      // Validate request
      if (!request.content) {
        return c.json({
          success: false,
          error: 'Content is required'
        }, 400);
      }

      // Perform code review
      const result = await codeReviewService.reviewCode({
        content: request.content,
        filePath,
        config: request.config || {}
      });

      // Return result with proper HTTP status
      if (result.success) {
        return c.json(result);
      } else {
        return c.json(result, 400);
      }
    } catch (error) {
      console.error('Code review error:', error);
      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  });

  // Get supported languages
  router.get('/code-review/languages', (c) => {
    const languages = [
      'typescript', 'javascript', 'python', 'go', 'rust',
      'java', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
      'scala', 'dart'
    ];

    return c.json({
      success: true,
      languages,
      supportedLanguages: languages.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get code review statistics and metrics
  router.get('/code-review/stats', (c) => {
    return c.json({
      success: true,
      stats: {
        supportedLanguages: 14,
        supportedCategories: [
          'security', 'performance', 'quality', 'style',
          'best-practices', 'documentation', 'testing',
          'maintainability', 'complexity', 'duplication'
        ],
        defaultConfig: {
          includeQuality: true,
          includeSecurity: true,
          includePerformance: true,
          includeStyle: true,
          includePractices: true,
          includeMetrics: true
        },
        maxFileSize: '10MB',
        maxContentLength: 1000000,
        supportedFileExtensions: [
          '.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs',
          '.java', '.cpp', '.c', '.cs', '.rb', '.php',
          '.swift', '.kt', '.scala', '.dart'
        ]
      },
      timestamp: new Date().toISOString()
    });
  });

  // Health check for code review service
  router.get('/code-review/health', (c) => {
    return c.json({
      success: true,
      status: 'healthy',
      service: 'code-review',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown'
    });
  });

  // ============================================================================
  // Security Testing Endpoints
  // ============================================================================

  // Main security testing endpoint
  router.post('/security-test', async (c) => {
    try {
      const request = await c.req.json();

      // Validate request
      if (!request.target) {
        return c.json({
          success: false,
          error: 'Target is required'
        }, 400);
      }

      // Perform security scan
      const result = await securityTestingService.performSecurityScan({
        target: request.target,
        targetType: request.targetType,
        options: request.options
      });

      // Return result with proper HTTP status
      if (result.success) {
        return c.json(result);
      } else {
        return c.json(result, 400);
      }
    } catch (error) {
      console.error('Security testing error:', error);
      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  });

  // Get scan status
  router.get('/security-test/status/:scanId', async (c) => {
    try {
      const scanId = c.req.param('scanId');
      const status = await securityTestingService.getScanStatus(scanId);

      if (!status) {
        return c.json({
          success: false,
          error: 'Scan not found'
        }, 404);
      }

      return c.json({
        success: true,
        scan: status
      });
    } catch (error) {
      console.error('Get scan status error:', error);
      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  });

  // Get available scan types
  router.get('/security-test/types', (c) => {
    const scanTypes = securityTestingService.getAvailableScanTypes();
    return c.json({
      success: true,
      scanTypes,
      count: scanTypes.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get available compliance frameworks
  router.get('/security-test/compliance-frameworks', (c) => {
    const frameworks = securityTestingService.getAvailableComplianceFrameworks();
    return c.json({
      success: true,
      frameworks,
      count: frameworks.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get security testing statistics
  router.get('/security-test/stats', (c) => {
    const stats = securityTestingService.getStatistics();
    return c.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  });

  // Health check for security testing service
  router.get('/security-test/health', (c) => {
    return c.json({
      success: true,
      status: 'healthy',
      service: 'security-testing',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
      capabilities: [
        'SAST (Static Application Security Testing)',
        'DAST (Dynamic Application Security Testing)',
        'SCA (Software Composition Analysis)',
        'Compliance Scanning',
        'Vulnerability Database Lookup',
        'Policy Engine'
      ]
    });
  });

  // Quick security test endpoint for common use cases
  router.post('/security-test/quick', async (c) => {
    try {
      const request = await c.req.json();

      // Validate request
      if (!request.target) {
        return c.json({
          success: false,
          error: 'Target is required'
        }, 400);
      }

      // Determine target type and perform appropriate scan
      let scanRequest: any = {
        target: request.target,
        options: {
          enableSAST: true,
          enableSCA: true,
          enableDAST: request.target.startsWith('http'),
          enableCompliance: false,
          severityThreshold: 'medium' as any
        }
      };

      // For URLs, perform DAST scan
      if (request.target.startsWith('http')) {
        scanRequest.targetType = 'url';
        scanRequest.options = {
          maxDepth: 3,
          maxPages: 50,
          timeout: 120000
        };
      }
      // For dependencies, perform SCA scan
      else if (request.target.includes('package.json') ||
               request.target.includes('requirements.txt') ||
               request.target.includes('go.mod') ||
               request.target.includes('pom.xml')) {
        scanRequest.targetType = 'dependency';
        scanRequest.options = {
          includeDevDependencies: true,
          includeTransitiveDependencies: true
        };
      }

      const result = await securityTestingService.performSecurityScan(scanRequest);

      return c.json(result);
    } catch (error) {
      console.error('Quick security test error:', error);
      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  });

  // Lookup specific vulnerability
  router.get('/security-test/vulnerability/:ecosystem/:package/:version', async (c) => {
    try {
      const ecosystem = c.req.param('ecosystem');
      const packageName = c.req.param('package');
      const version = c.req.param('version');

      const vulnerabilities = securityTestingService['securityTesting'].lookupVulnerabilities(
        packageName,
        ecosystem,
        version
      );

      return c.json({
        success: true,
        package: packageName,
        ecosystem,
        version,
        vulnerabilities: vulnerabilities || [],
        count: vulnerabilities?.length || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Vulnerability lookup error:', error);
      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  });

  return router;
}

function createDORouter() {
  const router = new Hono<{ Bindings: Bindings }>();

  // Agent Orchestrator endpoints
  router.get('/agent/orchestrator/stats', async (c) => {
    try {
      const id = c.env.AGENT_ORCHESTRATOR.idFromName('test');
      const stub = c.env.AGENT_ORCHESTRATOR.get(id);
      const response = await stub.fetch('https://fake.com/stats');
      return await response.json();
    } catch (error) {
      return c.json({ error: 'Agent Orchestrator not available' }, 500);
    }
  });

  // Vector Index endpoints
  router.get('/vector/index/stats', async (c) => {
    try {
      const id = c.env.VECTOR_INDEX.idFromName('test');
      const stub = c.env.VECTOR_INDEX.get(id);
      const response = await stub.fetch('https://fake.com/stats');
      return await response.json();
    } catch (error) {
      return c.json({ error: 'Vector Index not available' }, 500);
    }
  });

  router.post('/vector/index', async (c) => {
    try {
      const id = c.env.VECTOR_INDEX.idFromName('test');
      const stub = c.env.VECTOR_INDEX.get(id);
      const response = await stub.fetch(new Request(c.req.url, {
        method: c.req.method,
        headers: c.req.headers,
        body: c.req.body
      }));
      return await response.json();
    } catch (error) {
      return c.json({ error: 'Vector Index operation failed' }, 500);
    }
  });

  router.get('/vector/search', async (c) => {
    try {
      const id = c.env.VECTOR_INDEX.idFromName('test');
      const stub = c.env.VECTOR_INDEX.get(id);
      const response = await stub.fetch(new Request(c.req.url, {
        method: 'GET',
        headers: c.req.headers
      }));
      return await response.json();
    } catch (error) {
      return c.json({ error: 'Vector search failed' }, 500);
    }
  });

  return router;
}

// Durable Object classes - Export for runtime
export { AgentOrchestrator } from './durable/agent-orchestrator';
export { VectorIndex } from './durable/vector-index';

// Cloudflare Workers fetch handler with Durable Objects
export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    // Handle scheduled tasks (cron jobs)
    console.log('Scheduled task executed');
  },
};
