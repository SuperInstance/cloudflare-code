/**
 * API Routes for Fine-tuning System
 * RESTful API endpoints for managing models, datasets, training jobs, and evaluations
 */

import { Router } from 'itty-router';
import { z } from 'zod';
import type { Env } from '../types';

// Import managers
import { TrainingPipelineManager } from '../pipeline/training';
import { ModelRegistryDO } from '../models/registry';
import { DatasetManager } from '../datasets/manager';
import { ModelEvaluator } from '../evaluation/metrics';
import { JobMonitor } from '../monitoring/jobs';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateTrainingJobSchema = z.object({
  modelId: z.string().min(1),
  datasetId: z.string().min(1),
  config: z.object({
    hyperparameters: z.object({
      learningRate: z.number().optional(),
      batchSize: z.number().optional(),
      epochs: z.number().optional(),
    }),
    checkpointConfig: z.object({
      enabled: z.boolean().optional(),
      interval: z.number().optional(),
    }).optional(),
    evaluationConfig: z.object({
      enabled: z.boolean().optional(),
      metrics: z.array(z.string()).optional(),
    }).optional(),
  }),
  metadata: z.record(z.any()).optional(),
});

const UploadDatasetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  format: z.enum(['jsonl', 'json', 'csv', 'parquet', 'custom']),
  source: z.enum(['upload', 'github', 'url', 'database', 'synthetic']),
  tags: z.array(z.string()).default([]),
});

const RegisterModelSchema = z.object({
  baseModel: z.string().min(1),
  name: z.string().min(1).max(255),
  version: z.string().optional(),
  datasetId: z.string().min(1),
  config: z.object({
    provider: z.enum(['openai', 'anthropic', 'cohere', 'custom']),
    apiKey: z.string().min(1),
    endpoint: z.string().optional(),
    inferenceConfig: z.object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(1).optional(),
      topP: z.number().min(0).max(1).optional(),
    }).optional(),
  }),
  hyperparameters: z.object({
    learningRate: z.number().optional(),
    batchSize: z.number().optional(),
    epochs: z.number().optional(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

const EvaluationRequestSchema = z.object({
  modelId: z.string().min(1),
  datasetId: z.string().optional(),
  testCases: z.array(z.object({
    input: z.string().min(1),
    expectedOutput: z.string().optional(),
  })).optional(),
  config: z.object({
    metrics: z.array(z.string()).default(['loss', 'accuracy']),
    batchSize: z.number().optional(),
    timeout: z.number().optional(),
  }),
});

// ============================================================================
// API Response Helpers
// ============================================================================

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function errorResponse(message: string, status: number = 400, details?: any): Response {
  return jsonResponse({
    success: false,
    error: {
      code: status.toString(),
      message,
      details,
      timestamp: Date.now(),
    },
  }, status);
}

function successResponse<T>(data: T, metadata?: any): Response {
  return jsonResponse({
    success: true,
    data,
    metadata,
  });
}

// ============================================================================
// API Router
// ============================================================================

export function createRouter(env: Env): Router {
  const router = Router();

  // CORS preflight
  router.options('*', () => new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  }));

  // ============================================================================
  // Health Check
  // ============================================================================

  router.get('/health', () => {
    return successResponse({
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
    });
  });

  // ============================================================================
  // Model Routes
  // ============================================================================

  // List models
  router.get('/api/models', async (request) => {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const status = url.searchParams.get('status');
      const provider = url.searchParams.get('provider');
      const tags = url.searchParams.get('tags')?.split(',');

      // Get model registry DO
      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/list`, {
          method: 'POST',
          body: JSON.stringify({
            filter: { status, provider, tags },
            pagination: { page, pageSize },
          }),
        })
      );

      const data = await response.json();
      return successResponse(data);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list models',
        500
      );
    }
  });

  // Get model
  router.get('/api/models/:modelId', async (request) => {
    try {
      const { modelId } = request.params || {};

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/get`, {
          method: 'POST',
          body: JSON.stringify({ modelId }),
        })
      );

      if (!response.ok) {
        return errorResponse('Model not found', 404);
      }

      const data = await response.json();
      return successResponse(data);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get model',
        500
      );
    }
  });

  // Register model
  router.post('/api/models', async (request) => {
    try {
      const body = await request.json();
      const validated = RegisterModelSchema.parse(body);

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/register`, {
          method: 'POST',
          body: JSON.stringify(validated),
        })
      );

      const data = await response.json();
      return successResponse(data, { message: 'Model registered successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse('Validation failed', 400, error.errors);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to register model',
        500
      );
    }
  });

  // Update model
  router.put('/api/models/:modelId', async (request) => {
    try {
      const { modelId } = request.params || {};
      const body = await request.json();

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/update`, {
          method: 'POST',
          body: JSON.stringify({ modelId, updates: body }),
        })
      );

      const data = await response.json();
      return successResponse(data, { message: 'Model updated successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to update model',
        500
      );
    }
  });

  // Delete model
  router.delete('/api/models/:modelId', async (request) => {
    try {
      const { modelId } = request.params || {};

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/delete`, {
          method: 'POST',
          body: JSON.stringify({ modelId }),
        })
      );

      return successResponse({ id: modelId }, { message: 'Model deleted successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to delete model',
        500
      );
    }
  });

  // Deploy model
  router.post('/api/models/:modelId/deploy', async (request) => {
    try {
      const { modelId } = request.params || {};
      const body = await request.json();

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/deploy`, {
          method: 'POST',
          body: JSON.stringify({ modelId, config: body }),
        })
      );

      const data = await response.json();
      return successResponse(data, { message: 'Model deployment initiated' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to deploy model',
        500
      );
    }
  });

  // Undeploy model
  router.post('/api/models/:modelId/undeploy', async (request) => {
    try {
      const { modelId } = request.params || {};

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/undeploy`, {
          method: 'POST',
          body: JSON.stringify({ modelId }),
        })
      );

      return successResponse({ id: modelId }, { message: 'Model undeployed successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to undeploy model',
        500
      );
    }
  });

  // Compare models
  router.post('/api/models/compare', async (request) => {
    try {
      const body = await request.json();
      const { modelIds } = body;

      if (!Array.isArray(modelIds) || modelIds.length < 2) {
        return errorResponse('At least 2 model IDs required', 400);
      }

      const registryId = env.MODEL_REGISTRY.idFromName('global');
      const registry = await env.MODEL_REGISTRY.get(registryId);

      const response = await registry.fetch(
        new Request(`${request.url}/compare`, {
          method: 'POST',
          body: JSON.stringify({ modelIds }),
        })
      );

      const data = await response.json();
      return successResponse(data);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to compare models',
        500
      );
    }
  });

  // ============================================================================
  // Dataset Routes
  // ============================================================================

  // List datasets
  router.get('/api/datasets', async (request) => {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const status = url.searchParams.get('status');

      const manager = new DatasetManager(env);
      const result = await manager.listDatasets(
        { status },
        { page, pageSize }
      );

      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list datasets',
        500
      );
    }
  });

  // Get dataset
  router.get('/api/datasets/:datasetId', async (request) => {
    try {
      const { datasetId } = request.params || {};

      const manager = new DatasetManager(env);
      const dataset = await manager.getDataset(datasetId);

      if (!dataset) {
        return errorResponse('Dataset not found', 404);
      }

      return successResponse(dataset);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get dataset',
        500
      );
    }
  });

  // Upload dataset
  router.post('/api/datasets/upload', async (request) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const metadata = JSON.parse(formData.get('metadata') as string);

      if (!file) {
        return errorResponse('No file provided', 400);
      }

      const manager = new DatasetManager(env);
      const dataset = await manager.uploadDataset(file, metadata);

      return successResponse(dataset, { message: 'Dataset uploaded successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to upload dataset',
        500
      );
    }
  });

  // Import dataset from URL
  router.post('/api/datasets/import/url', async (request) => {
    try {
      const body = await request.json();
      const { url, metadata } = body;

      if (!url || !metadata) {
        return errorResponse('URL and metadata required', 400);
      }

      const manager = new DatasetManager(env);
      const dataset = await manager.importFromUrl(url, metadata);

      return successResponse(dataset, { message: 'Dataset imported successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to import dataset',
        500
      );
    }
  });

  // Import dataset from GitHub
  router.post('/api/datasets/import/github', async (request) => {
    try {
      const body = await request.json();
      const { repo, path, metadata } = body;

      if (!repo || !path || !metadata) {
        return errorResponse('Repo, path, and metadata required', 400);
      }

      const manager = new DatasetManager(env);
      const dataset = await manager.importFromGitHub(repo, path, metadata);

      return successResponse(dataset, { message: 'Dataset imported successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to import dataset',
        500
      );
    }
  });

  // Validate dataset
  router.post('/api/datasets/:datasetId/validate', async (request) => {
    try {
      const { datasetId } = request.params || {};

      const manager = new DatasetManager(env);
      const result = await manager.validateDataset(datasetId);

      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to validate dataset',
        500
      );
    }
  });

  // Preprocess dataset
  router.post('/api/datasets/:datasetId/preprocess', async (request) => {
    try {
      const { datasetId } = request.params || {};
      const body = await request.json();

      const manager = new DatasetManager(env);
      const dataset = await manager.preprocessDataset(datasetId, body);

      return successResponse(dataset, { message: 'Dataset preprocessed successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to preprocess dataset',
        500
      );
    }
  });

  // Convert dataset format
  router.post('/api/datasets/:datasetId/convert', async (request) => {
    try {
      const { datasetId } = request.params || {};
      const body = await request.json();
      const { format } = body;

      if (!format) {
        return errorResponse('Target format required', 400);
      }

      const manager = new DatasetManager(env);
      const dataset = await manager.convertFormat(datasetId, format);

      return successResponse(dataset, { message: 'Dataset converted successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to convert dataset',
        500
      );
    }
  });

  // Download dataset
  router.get('/api/datasets/:datasetId/download', async (request) => {
    try {
      const { datasetId } = request.params || {};

      const manager = new DatasetManager(env);
      const { data, filename } = await manager.downloadDataset(datasetId);

      return new Response(data, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to download dataset',
        500
      );
    }
  });

  // Delete dataset
  router.delete('/api/datasets/:datasetId', async (request) => {
    try {
      const { datasetId } = request.params || {};

      const manager = new DatasetManager(env);
      await manager.deleteDataset(datasetId);

      return successResponse({ id: datasetId }, { message: 'Dataset deleted successfully' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to delete dataset',
        500
      );
    }
  });

  // ============================================================================
  // Training Job Routes
  // ============================================================================

  // List training jobs
  router.get('/api/training/jobs', async (request) => {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const status = url.searchParams.get('status');

      const manager = new TrainingPipelineManager(env);
      const result = await manager.listTrainingJobs(
        { status },
        { page, pageSize }
      );

      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list training jobs',
        500
      );
    }
  });

  // Get training job
  router.get('/api/training/jobs/:jobId', async (request) => {
    try {
      const { jobId } = request.params || {};

      const manager = new TrainingPipelineManager(env);
      const job = await manager.getJobStatus(jobId);

      return successResponse(job);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get training job',
        500
      );
    }
  });

  // Create training job
  router.post('/api/training/jobs', async (request) => {
    try {
      const body = await request.json();
      const validated = CreateTrainingJobSchema.parse(body);

      const manager = new TrainingPipelineManager(env);
      const job = await manager.createTrainingJob(
        validated.modelId,
        validated.datasetId,
        validated.config,
        validated.metadata
      );

      return successResponse(job, { message: 'Training job created successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse('Validation failed', 400, error.errors);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to create training job',
        500
      );
    }
  });

  // Start training job
  router.post('/api/training/jobs/:jobId/start', async (request) => {
    try {
      const { jobId } = request.params || {};

      const manager = new TrainingPipelineManager(env);
      const job = await manager.startTrainingJob(jobId);

      return successResponse(job, { message: 'Training job started' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to start training job',
        500
      );
    }
  });

  // Pause training job
  router.post('/api/training/jobs/:jobId/pause', async (request) => {
    try {
      const { jobId } = request.params || {};

      const manager = new TrainingPipelineManager(env);
      const job = await manager.pauseTrainingJob(jobId);

      return successResponse(job, { message: 'Training job paused' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to pause training job',
        500
      );
    }
  });

  // Cancel training job
  router.post('/api/training/jobs/:jobId/cancel', async (request) => {
    try {
      const { jobId } = request.params || {};

      const manager = new TrainingPipelineManager(env);
      const job = await manager.cancelTrainingJob(jobId);

      return successResponse(job, { message: 'Training job cancelled' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to cancel training job',
        500
      );
    }
  });

  // Get training logs
  router.get('/api/training/jobs/:jobId/logs', async (request) => {
    try {
      const { jobId } = request.params || {};
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '100');

      const manager = new TrainingPipelineManager(env);
      const logs = await manager.getTrainingLogs(jobId, limit);

      return successResponse(logs);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get training logs',
        500
      );
    }
  });

  // Get checkpoints
  router.get('/api/training/jobs/:jobId/checkpoints', async (request) => {
    try {
      const { jobId } = request.params || {};

      const manager = new TrainingPipelineManager(env);
      const checkpoints = await manager.getCheckpoints(jobId);

      return successResponse(checkpoints);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get checkpoints',
        500
      );
    }
  });

  // Resume from checkpoint
  router.post('/api/training/jobs/:jobId/resume', async (request) => {
    try {
      const { jobId } = request.params || {};
      const body = await request.json();
      const { checkpointId } = body;

      if (!checkpointId) {
        return errorResponse('Checkpoint ID required', 400);
      }

      const manager = new TrainingPipelineManager(env);
      const job = await manager.resumeFromCheckpoint(jobId, checkpointId);

      return successResponse(job, { message: 'Resumed from checkpoint' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to resume from checkpoint',
        500
      );
    }
  });

  // ============================================================================
  // Evaluation Routes
  // ============================================================================

  // Create evaluation
  router.post('/api/evaluations', async (request) => {
    try {
      const body = await request.json();
      const validated = EvaluationRequestSchema.parse(body);

      const evaluator = new ModelEvaluator(env);
      const evaluation = await evaluator.evaluateModel(validated);

      return successResponse(evaluation, { message: 'Evaluation created successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse('Validation failed', 400, error.errors);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to create evaluation',
        500
      );
    }
  });

  // Get evaluation
  router.get('/api/evaluations/:evaluationId', async (request) => {
    try {
      const { evaluationId } = request.params || {};

      const evaluator = new ModelEvaluator(env);
      const evaluation = await evaluator.getEvaluation(evaluationId);

      if (!evaluation) {
        return errorResponse('Evaluation not found', 404);
      }

      return successResponse(evaluation);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get evaluation',
        500
      );
    }
  });

  // List model evaluations
  router.get('/api/models/:modelId/evaluations', async (request) => {
    try {
      const { modelId } = request.params || {};

      const evaluator = new ModelEvaluator(env);
      const evaluations = await evaluator.listEvaluations(modelId);

      return successResponse(evaluations);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to list evaluations',
        500
      );
    }
  });

  // Compare models
  router.post('/api/evaluations/compare', async (request) => {
    try {
      const body = await request.json();
      const { modelIds, datasetId, testCases } = body;

      if (!Array.isArray(modelIds) || modelIds.length < 2) {
        return errorResponse('At least 2 model IDs required', 400);
      }

      const evaluator = new ModelEvaluator(env);
      const comparison = await evaluator.compareModels(modelIds, datasetId, testCases);

      return successResponse(comparison);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to compare models',
        500
      );
    }
  });

  // ============================================================================
  // Monitoring Routes
  // ============================================================================

  // Get system metrics
  router.get('/api/monitoring/metrics', async (request) => {
    try {
      const monitor = new JobMonitor(env);
      const metrics = await monitor.getSystemMetrics();

      return successResponse(metrics);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get system metrics',
        500
      );
    }
  });

  // Get dashboard data
  router.get('/api/monitoring/dashboard', async (request) => {
    try {
      const monitor = new JobMonitor(env);
      const dashboard = await monitor.getDashboardData();

      return successResponse(dashboard);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get dashboard data',
        500
      );
    }
  });

  // Get alerts
  router.get('/api/monitoring/alerts', async (request) => {
    try {
      const url = new URL(request.url);
      const severity = url.searchParams.get('severity') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const monitor = new JobMonitor(env);
      const alerts = await monitor.getAlerts(severity, limit);

      return successResponse(alerts);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get alerts',
        500
      );
    }
  });

  // Acknowledge alert
  router.post('/api/monitoring/alerts/:alertId/acknowledge', async (request) => {
    try {
      const { alertId } = request.params || {};

      const monitor = new JobMonitor(env);
      await monitor.acknowledgeAlert(alertId);

      return successResponse({ alertId }, { message: 'Alert acknowledged' });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to acknowledge alert',
        500
      );
    }
  });

  // Get job performance summary
  router.get('/api/monitoring/jobs/:jobId/performance', async (request) => {
    try {
      const { jobId } = request.params || {};

      const monitor = new JobMonitor(env);
      const summary = await monitor.getJobPerformanceSummary(jobId);

      return successResponse(summary);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get job performance',
        500
      );
    }
  });

  // Compare job performance
  router.post('/api/monitoring/jobs/compare', async (request) => {
    try {
      const body = await request.json();
      const { jobIds } = body;

      if (!Array.isArray(jobIds) || jobIds.length < 2) {
        return errorResponse('At least 2 job IDs required', 400);
      }

      const monitor = new JobMonitor(env);
      const comparison = await monitor.compareJobs(jobIds);

      return successResponse(comparison);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to compare jobs',
        500
      );
    }
  });

  // ============================================================================
  // Statistics Routes
  // ============================================================================

  // Get statistics
  router.get('/api/stats', async (request) => {
    try {
      const url = new URL(request.url);
      const timeRange = url.searchParams.get('timeRange') || '24h';

      const now = Date.now();
      const ranges: any = {
        '1h': now - 60 * 60 * 1000,
        '24h': now - 24 * 60 * 60 * 1000,
        '7d': now - 7 * 24 * 60 * 60 * 1000,
        '30d': now - 30 * 24 * 60 * 60 * 1000,
      };

      const from = ranges[timeRange] || ranges['24h'];

      // Get statistics from database
      const modelStats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_models,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_models,
          SUM(CASE WHEN status = 'deployed' THEN 1 ELSE 0 END) as deployed_models
        FROM models
      `).first();

      const datasetStats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_datasets,
          SUM(size) as total_size,
          SUM(row_count) as total_rows
        FROM datasets
        WHERE status = 'ready'
      `).first();

      const jobStats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
          SUM(CASE WHEN status = 'training' THEN 1 ELSE 0 END) as active_jobs
        FROM training_jobs
        WHERE created_at >= ?
      `).bind(from).first();

      return successResponse({
        models: modelStats,
        datasets: datasetStats,
        jobs: jobStats,
        timeRange,
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Failed to get statistics',
        500
      );
    }
  });

  return router;
}
