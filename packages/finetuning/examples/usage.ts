/**
 * ClaudeFlare Fine-tuning System - Usage Examples
 *
 * This file demonstrates how to use the fine-tuning system
 */

import {
  TrainingPipelineManager,
  DatasetManager,
  ModelEvaluator,
  JobMonitor,
  HyperparameterUtils,
} from '../src';

// ============================================================================
// Dataset Management Examples
// ============================================================================

/**
 * Example 1: Upload and validate a dataset
 */
async function uploadDatasetExample(env: any) {
  const manager = new DatasetManager(env);

  // Upload from file
  const file = new File(
    [JSON.stringify([
      { prompt: 'What is AI?', completion: 'AI is artificial intelligence.' },
      { prompt: 'Explain ML', completion: 'Machine learning is a subset of AI.' },
    ])],
    'training-data.jsonl',
    { type: 'application/jsonl' }
  );

  const dataset = await manager.uploadDataset(file, {
    name: 'AI Q&A Dataset',
    description: 'Questions and answers about AI and ML',
    format: 'jsonl',
    source: 'upload',
    tags: ['ai', 'qa', 'educational'],
  });

  console.log('Dataset uploaded:', dataset.id);

  // Validate the dataset
  const validationResult = await manager.validateDataset(dataset.id);
  console.log('Validation result:', validationResult);

  return dataset;
}

/**
 * Example 2: Import dataset from GitHub
 */
async function importFromGitHubExample(env: any) {
  const manager = new DatasetManager(env);

  const dataset = await manager.importFromGitHub(
    'openai/finetuning-datasets',
    'examples/qa-dataset.jsonl',
    {
      name: 'OpenAI Q&A Dataset',
      format: 'jsonl',
      source: 'github',
      tags: ['openai', 'qa'],
    }
  );

  console.log('Dataset imported:', dataset.id);
  return dataset;
}

/**
 * Example 3: Preprocess dataset
 */
async function preprocessDatasetExample(env: any, datasetId: string) {
  const manager = new DatasetManager(env);

  const preprocessed = await manager.preprocessDataset(datasetId, {
    cleanText: true,
    removeDuplicates: true,
    minLength: 10,
    maxLength: 1000,
    trainSplit: 0.8,
    valSplit: 0.1,
    testSplit: 0.1,
  });

  console.log('Dataset preprocessed:', preprocessed);
  return preprocessed;
}

// ============================================================================
// Training Job Examples
// ============================================================================

/**
 * Example 4: Create and start a training job
 */
async function createTrainingJobExample(env: any, modelId: string, datasetId: string) {
  const manager = new TrainingPipelineManager(env);

  // Get suggested hyperparameters
  const dataset = await manager.getDataset(datasetId);
  const hyperparams = HyperparameterUtils.suggestForDataset(dataset.rowCount);

  // Create training job
  const job = await manager.createTrainingJob(
    modelId,
    datasetId,
    {
      hyperparameters: {
        learningRate: hyperparams.learningRate,
        batchSize: hyperparams.batchSize,
        epochs: hyperparams.epochs,
        warmupSteps: hyperparams.warmupSteps,
        weightDecay: 0.01,
      },
      checkpointConfig: {
        enabled: true,
        interval: 500,
        maxToKeep: 5,
        saveBest: true,
        metric: 'loss',
      },
      evaluationConfig: {
        enabled: true,
        interval: 1000,
        metrics: ['loss', 'accuracy'],
        testSet: false,
      },
      resourceConfig: {
        gpuCount: 1,
        maxRuntime: 86400, // 24 hours
        priority: 'normal',
        spotInstance: true,
      },
    },
    {
      experiment: 'baseline',
      description: 'Baseline model training',
    }
  );

  console.log('Training job created:', job.id);

  // Start training
  await manager.startTrainingJob(job.id);
  console.log('Training started');

  return job;
}

/**
 * Example 5: Monitor training progress
 */
async function monitorTrainingExample(env: any, jobId: string) {
  const manager = new TrainingPipelineManager(env);
  const monitor = new JobMonitor(env);

  // Start monitoring
  const job = await manager.getJobStatus(jobId);
  await monitor.startMonitoring(job);

  // Poll for updates
  const interval = setInterval(async () => {
    const status = await manager.getJobStatus(jobId);

    console.log('Progress:', status.progress.percentage.toFixed(2) + '%');
    console.log('Loss:', status.metrics.loss.current.toFixed(4));
    console.log('Status:', status.status);

    if (status.status === 'completed' || status.status === 'failed') {
      clearInterval(interval);
      await monitor.stopMonitoring(jobId);

      if (status.status === 'completed') {
        console.log('Training completed successfully!');
        console.log('Final loss:', status.metrics.loss.current);
      } else {
        console.log('Training failed:', status.error?.message);
      }
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Example 6: Resume from checkpoint
 */
async function resumeFromCheckpointExample(env: any, jobId: string, checkpointId: string) {
  const manager = new TrainingPipelineManager(env);

  const job = await manager.resumeFromCheckpoint(jobId, checkpointId);
  console.log('Resumed training from checkpoint:', checkpointId);
  return job;
}

// ============================================================================
// Model Evaluation Examples
// ============================================================================

/**
 * Example 7: Evaluate a model
 */
async function evaluateModelExample(env: any, modelId: string, datasetId: string) {
  const evaluator = new ModelEvaluator(env);

  const evaluation = await evaluator.evaluateModel({
    modelId,
    datasetId,
    config: {
      metrics: ['loss', 'accuracy', 'bleu', 'rouge'],
      batchSize: 10,
      timeout: 300000, // 5 minutes
    },
  });

  console.log('Evaluation completed:', evaluation.id);
  console.log('Metrics:', evaluation.metrics);

  return evaluation;
}

/**
 * Example 8: Compare multiple models
 */
async function compareModelsExample(env: any, modelIds: string[], datasetId: string) {
  const evaluator = new ModelEvaluator(env);

  const comparison = await evaluator.compareModels(modelIds, datasetId);

  console.log('Model comparison:');
  for (const model of comparison.comparison) {
    console.log(`  ${model.modelName}:`);
    console.log(`    Loss: ${model.metrics.loss}`);
    console.log(`    Accuracy: ${model.metrics.accuracy}`);
    console.log(`    Improvement: ${JSON.stringify(model.improvement)}`);
  }

  console.log('Winner:', comparison.winner);

  return comparison;
}

// ============================================================================
// Monitoring Examples
// ============================================================================

/**
 * Example 9: Get system metrics
 */
async function getSystemMetricsExample(env: any) {
  const monitor = new JobMonitor(env);

  const metrics = await monitor.getSystemMetrics();

  console.log('Active jobs:', metrics.activeJobs);
  console.log('Queued jobs:', metrics.queuedJobs);
  console.log('Throughput:', metrics.throughput);

  return metrics;
}

/**
 * Example 10: Get dashboard data
 */
async function getDashboardExample(env: any) {
  const monitor = new JobMonitor(env);

  const dashboard = await monitor.getDashboardData();

  console.log('System metrics:', dashboard.systemMetrics);
  console.log('Active jobs:', dashboard.activeJobs.length);
  console.log('Recent alerts:', dashboard.recentAlerts.length);
  console.log('Trends:', dashboard.trends);

  return dashboard;
}

/**
 * Example 11: Get job performance summary
 */
async function getJobPerformanceExample(env: any, jobId: string) {
  const monitor = new JobMonitor(env);

  const summary = await monitor.getJobPerformanceSummary(jobId);

  console.log('Job performance summary:');
  console.log('  Status:', summary.status);
  console.log('  Progress:', summary.progress.percentage + '%');
  console.log('  Anomalies:', summary.anomalies.length);
  console.log('  Recommendations:', summary.recommendations);

  return summary;
}

/**
 * Example 12: Compare job performance
 */
async function compareJobsExample(env: any, jobIds: string[]) {
  const monitor = new JobMonitor(env);

  const comparison = await monitor.compareJobs(jobIds);

  console.log('Job comparison:');
  for (const job of comparison.jobs) {
    console.log(`  ${job.jobId}: ${job.performance}`);
  }

  console.log('Best job:', comparison.best);
  console.log('Worst job:', comparison.worst);

  return comparison;
}

// ============================================================================
// Complete Workflow Example
// ============================================================================

/**
 * Example 13: Complete fine-tuning workflow
 */
async function completeWorkflowExample(env: any) {
  console.log('=== Starting Complete Fine-tuning Workflow ===\n');

  // Step 1: Upload dataset
  console.log('Step 1: Uploading dataset...');
  const dataset = await uploadDatasetExample(env);
  console.log('Dataset uploaded:', dataset.id, '\n');

  // Step 2: Validate dataset
  console.log('Step 2: Validating dataset...');
  const validationResult = await new DatasetManager(env).validateDataset(dataset.id);
  console.log('Validation:', validationResult.valid ? 'PASSED' : 'FAILED', '\n');

  // Step 3: Preprocess dataset
  console.log('Step 3: Preprocessing dataset...');
  const preprocessed = await preprocessDatasetExample(env, dataset.id);
  console.log('Dataset preprocessed:', preprocessed.rowCount, 'rows\n');

  // Step 4: Create training job
  console.log('Step 4: Creating training job...');
  const job = await createTrainingJobExample(env, 'base-model-id', dataset.id);
  console.log('Training job created:', job.id, '\n');

  // Step 5: Monitor training
  console.log('Step 5: Monitoring training...');
  await monitorTrainingExample(env, job.id);

  // Step 6: Evaluate model
  console.log('Step 6: Evaluating model...');
  const evaluation = await evaluateModelExample(env, 'model-id', dataset.id);
  console.log('Evaluation metrics:', evaluation.metrics, '\n');

  // Step 7: Get performance summary
  console.log('Step 7: Getting performance summary...');
  const summary = await getJobPerformanceExample(env, job.id);
  console.log('Performance summary:', summary.recommendations, '\n');

  console.log('=== Workflow Complete ===');
}

// ============================================================================
// API Usage Examples
// ============================================================================

/**
 * Example 14: Using the REST API
 */
async function apiUsageExample() {
  const baseUrl = 'https://your-worker.workers.dev';

  // Upload dataset
  const formData = new FormData();
  formData.append('file', new File(['{}'], 'data.jsonl'));
  formData.append('metadata', JSON.stringify({
    name: 'Test Dataset',
    format: 'jsonl',
    source: 'upload',
  }));

  const uploadResponse = await fetch(`${baseUrl}/api/datasets/upload`, {
    method: 'POST',
    body: formData,
  });

  const dataset = await uploadResponse.json();
  console.log('Dataset uploaded:', dataset.data.id);

  // Create training job
  const jobResponse = await fetch(`${baseUrl}/api/training/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: 'model-id',
      datasetId: dataset.data.id,
      config: {
        hyperparameters: {
          learningRate: 0.0001,
          batchSize: 32,
          epochs: 3,
        },
      },
    }),
  });

  const job = await jobResponse.json();
  console.log('Training job created:', job.data.id);

  // Start training
  await fetch(`${baseUrl}/api/training/jobs/${job.data.id}/start`, {
    method: 'POST',
  });

  console.log('Training started');

  // Monitor progress
  const statusResponse = await fetch(`${baseUrl}/api/training/jobs/${job.data.id}`);
  const status = await statusResponse.json();
  console.log('Job status:', status.data.status, status.data.progress.percentage + '%');
}

// ============================================================================
// Webhook Examples
// ============================================================================

/**
 * Example 15: Setting up webhooks
 */
async function webhookSetupExample() {
  const baseUrl = 'https://your-worker.workers.dev';

  // Register webhook
  await fetch(`${baseUrl}/api/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://your-webhook-url.com',
      events: [
        'training.started',
        'training.completed',
        'training.failed',
        'training.progress',
      ],
      secret: 'your-webhook-secret',
    }),
  });

  console.log('Webhook registered');
}

/**
 * Example 16: Handling webhook events
 */
function handleWebhookEvent(event: any) {
  console.log('Received webhook event:', event.event);

  switch (event.event) {
    case 'training.started':
      console.log('Training started for job:', event.data.jobId);
      break;

    case 'training.completed':
      console.log('Training completed for job:', event.data.jobId);
      console.log('Final metrics:', event.data.metrics);
      break;

    case 'training.failed':
      console.log('Training failed for job:', event.data.jobId);
      console.log('Error:', event.data.error);
      break;

    case 'training.progress':
      console.log('Progress:', event.data.progress.percentage + '%');
      break;
  }
}

// Export examples
export {
  uploadDatasetExample,
  importFromGitHubExample,
  preprocessDatasetExample,
  createTrainingJobExample,
  monitorTrainingExample,
  resumeFromCheckpointExample,
  evaluateModelExample,
  compareModelsExample,
  getSystemMetricsExample,
  getDashboardExample,
  getJobPerformanceExample,
  compareJobsExample,
  completeWorkflowExample,
  apiUsageExample,
  webhookSetupExample,
  handleWebhookEvent,
};
