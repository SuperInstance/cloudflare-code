/**
 * ClaudeFlare Fine-tuning Package - Complete Usage Examples
 *
 * This file demonstrates comprehensive usage of the fine-tuning package
 * including dataset management, training, hyperparameter optimization,
 * evaluation, LoRA training, and pipeline automation.
 */

import {
  // Dataset Management
  DatasetManager,
  DataIngestor,
  DataValidator,
  DataCleaner,
  DataAugmenter,
  DatasetSplitter,
  FormatConverter,
  type DatasetConfig,
  type DataSource,

  // Training Orchestration
  TrainingOrchestrator,
  TrainingQueue,
  ResourceManager,
  TrainingMonitor,
  CheckpointManager,
  EarlyStoppingMonitor,
  type TrainingRequest,
  type ResourceConfig,

  // Hyperparameter Optimization
  HyperparameterOptimizer,
  GridSearchOptimizer,
  RandomSearchOptimizer,
  BayesianOptimizer,
  HyperparameterScheduler,
  ExperimentTracker,
  type SearchSpace,
  type OptimizationConfig,

  // Model Evaluation
  ModelEvaluator,
  MetricsCalculator,
  ABTester,
  ErrorAnalyzer,
  BenchmarkSuite,
  Leaderboard,

  // LoRA Training
  LoRATrainer,
  LoRALayerManager,
  QLoRAQuantizer,
  MultiAdapterManager,
  MemoryOptimizer,
  LoRAConfigPresets,
  type LoRAConfig,
  type QLoRAConfig,

  // Pipeline Automation
  PipelineAutomation,
  PipelineTemplateManager,
  ScheduledTrainingManager,
  TriggerManager,
  WorkflowOrchestrator,
  NotificationManager,

  // Distributed Training
  DistributedTrainingCoordinator,
  ProcessGroupManager,
  DistributedDataParallel,
  GradientSynchronizer,
  FaultToleranceManager,

  // GPU Providers
  GPUProviderManager,
  AWSProvider,
  GCPProvider,
  AzureProvider,
  LambdaProvider,
} from '@claudeflare/finetuning';

// ============================================================================
// Example 1: Dataset Management
// ============================================================================

async function example1_DatasetManagement() {
  console.log('=== Example 1: Dataset Management ===\n');

  // Create dataset manager
  const datasetManager = new DatasetManager();

  // Ingest synthetic data
  const syntheticSource: DataSource = {
    type: 'synthetic',
    location: 'example-dataset',
    options: {
      count: 100,
      template: 'qa',
    },
  };

  // Create a dataset
  const result = await datasetManager.createDataset({
    name: 'Example QA Dataset',
    description: 'A synthetic question-answering dataset',
    source: syntheticSource,
    config: {
      name: 'qa-dataset',
      format: 'jsonl',
      source: 'synthetic',
      validation: {
        strict: false,
        checkDuplicates: true,
        checkQuality: true,
        minPromptLength: 10,
        maxPromptLength: 1000,
        minCompletionLength: 10,
        maxCompletionLength: 1000,
        maxTotalTokens: 100000,
      },
      preprocessing: {
        normalizeWhitespace: true,
        removeSpecialChars: false,
        trimStrings: true,
        lowercase: false,
      },
      augmentation: {
        enabled: true,
        techniques: ['paraphrase', 'synonym_replacement'],
        augmentationFactor: 2,
      },
      splitting: {
        train: 0.8,
        validation: 0.1,
        test: 0.1,
        stratified: false,
        shuffle: true,
        seed: 42,
      },
    },
  });

  console.log(`Created dataset: ${result.dataset.name}`);
  console.log(`Total records: ${result.dataset.rowCount}`);
  console.log(`Validation passed: ${result.validation.valid}`);
  console.log(`Statistics:`, result.validation.statistics);

  // Export dataset in different formats
  const jsonlExport = datasetManager.exportDataset(result.dataset.id, 'jsonl');
  console.log(`Exported ${jsonlExport.length} characters as JSONL`);

  // Clone dataset
  const cloned = datasetManager.cloneDataset(result.dataset.id, 'Cloned Dataset');
  console.log(`Cloned dataset with ID: ${cloned?.id}`);
}

// ============================================================================
// Example 2: Training Orchestration
// ============================================================================

async function example2_TrainingOrchestration() {
  console.log('\n=== Example 2: Training Orchestration ===\n');

  // Create training orchestrator
  const orchestrator = new TrainingOrchestrator(4); // max 4 concurrent jobs

  // Submit training job
  const trainingRequest: TrainingRequest = {
    modelId: 'base-model-123',
    datasetId: 'dataset-456',
    hyperparameters: {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 3,
      warmupSteps: 100,
      weightDecay: 0.01,
      gradientAccumulationSteps: 4,
      maxGradNorm: 1.0,
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
      metrics: ['loss', 'accuracy', 'bleu', 'rouge'],
      testSet: true,
    },
    resourceConfig: {
      gpuCount: 4,
      maxRuntime: 24 * 60 * 60 * 1000, // 24 hours
      priority: 'high',
      spotInstance: false,
    },
    notificationConfig: {
      onCompletion: true,
      onFailure: true,
      onMilestone: true,
      webhook: 'https://example.com/webhook',
    },
  };

  const job = await orchestrator.submitTraining(trainingRequest);
  console.log(`Submitted training job: ${job.id}`);
  console.log(`Status: ${job.status}`);

  // Monitor training progress
  setTimeout(() => {
    const progress = orchestrator.getProgress(job.id);
    console.log(`Progress: ${progress?.percentage.toFixed(1)}%`);

    const metrics = orchestrator.getMetrics(job.id);
    console.log(`Current loss: ${metrics?.loss.current.toFixed(4)}`);

    const logs = orchestrator.getLogs(job.id, 10);
    console.log(`Recent logs: ${logs.length} entries`);
  }, 5000);

  // Get system status
  const systemStatus = orchestrator.getSystemStatus();
  console.log(`System status:`, systemStatus);
}

// ============================================================================
// Example 3: Hyperparameter Optimization
// ============================================================================

async function example3_HyperparameterOptimization() {
  console.log('\n=== Example 3: Hyperparameter Optimization ===\n');

  // Define search space
  const searchSpace: SearchSpace = {
    params: [
      {
        name: 'learningRate',
        type: 'continuous',
        bounds: [0.0001, 0.01],
        scale: 'log',
      },
      {
        name: 'batchSize',
        type: 'discrete',
        bounds: [16, 64],
      },
      {
        name: 'epochs',
        type: 'discrete',
        bounds: [1, 10],
      },
      {
        name: 'warmupRatio',
        type: 'continuous',
        bounds: [0.0, 0.1],
      },
    ],
  };

  // Define optimization config
  const optimizationConfig: OptimizationConfig = {
    maxTrials: 20,
    parallelTrials: 4,
    maxDuration: 24 * 60 * 60 * 1000, // 24 hours
    objective: {
      metric: 'loss',
      direction: 'minimize',
      target: 0.3,
    },
    pruning: {
      enabled: true,
      earlyStoppingSteps: 50,
      minSteps: 100,
    },
    constraints: [
      {
        metric: 'accuracy',
        operator: '>=',
        value: 0.85,
      },
    ],
  };

  // Create optimizer
  const optimizer = new HyperparameterOptimizer();

  // Run optimization
  const result = await optimizer.optimize({
    searchSpace,
    method: 'bayesian',
    config: optimizationConfig,
    experimentName: 'lr-tuning-experiment',
    experimentDescription: 'Learning rate tuning experiment',
  });

  console.log(`Best trial ID: ${result.bestTrial.id}`);
  console.log(`Best loss: ${result.bestTrial.metrics.loss.toFixed(4)}`);
  console.log(`Best hyperparameters:`, result.bestTrial.params);
  console.log(`Total trials: ${result.allTrials.length}`);
  console.log(`Improvement: ${result.metrics.improvement.toFixed(2)}%`);

  // Use hyperparameter scheduler
  const scheduler = new HyperparameterScheduler({
    type: 'cosine',
    initialValue: 0.001,
    finalValue: 0.00001,
    totalSteps: 10000,
    warmupSteps: 500,
    warmupValue: 0.0001,
  });

  console.log(`Learning rate at step 100: ${scheduler.getValue(100)}`);
  console.log(`Learning rate at step 5000: ${scheduler.getValue(5000)}`);
}

// ============================================================================
// Example 4: Model Evaluation
// ============================================================================

async function example4_ModelEvaluation() {
  console.log('\n=== Example 4: Model Evaluation ===\n');

  // Create evaluator
  const evaluator = new ModelEvaluator();

  // Evaluate model
  const evaluationReport = await evaluator.evaluate({
    modelId: 'model-123',
    datasetId: 'dataset-456',
    metrics: ['loss', 'accuracy', 'bleu', 'rouge', 'perplexity'],
    benchmarks: ['text-generation-default', 'classification-default'],
    runErrorAnalysis: true,
  });

  console.log(`Overall score: ${evaluationReport.summary.overallScore.toFixed(3)}`);
  console.log(`Strengths:`, evaluationReport.summary.strengths);
  console.log(`Weaknesses:`, evaluationReport.summary.weaknesses);
  console.log(`Recommendations:`, evaluationReport.summary.recommendations);

  // A/B testing
  const abTester = new ABTester();
  const abTest = abTester.createTest({
    name: 'Model A vs Model B',
    description: 'Compare new model with baseline',
    modelA: 'model-a',
    modelB: 'model-b',
    dataset: 'test-dataset',
    metrics: ['accuracy', 'loss', 'bleu'],
    sampleSize: 1000,
    significanceLevel: 0.05,
    minEffectSize: 0.02,
  });

  const abResult = await abTester.runTest(abTest.testId);
  console.log(`A/B test winner: ${abResult.winner}`);
  console.log(`Recommendation: ${abResult.recommendation}`);

  // Error analysis
  const errorAnalysis = ErrorAnalyzer.analyzeErrors(
    ['Prediction 1', 'Prediction 2', 'Prediction 3'],
    ['Reference 1', 'Reference 2', 'Reference 3']
  );

  console.log(`Total errors: ${errorAnalysis.totalErrors}`);
  console.log(`Error types:`, errorAnalysis.errorTypes);
  console.log(`Suggestions:`, errorAnalysis.suggestions);

  // Leaderboard
  const leaderboard = evaluator.getLeaderboard(10);
  console.log(`Top 10 models:`);
  leaderboard.forEach((entry, i) => {
    console.log(`${i + 1}. ${entry.modelName}: ${entry.score.toFixed(3)}`);
  });
}

// ============================================================================
// Example 5: LoRA Training
// ============================================================================

async function example5_LoRATraining() {
  console.log('\n=== Example 5: LoRA Training ===\n');

  // Create LoRA trainer
  const loraTrainer = new LoRATrainer();

  // Get preset configs
  const defaultConfig = LoRAConfigPresets.getDefaultConfig();
  const qloraConfig = LoRAConfigPresets.getQLoRAConfig();
  const memoryEfficientConfig = LoRAConfigPresets.getMemoryEfficientConfig();

  console.log('Default LoRA config:', defaultConfig);
  console.log('QLoRA config:', qloraConfig);
  console.log('Memory efficient config:', memoryEfficientConfig);

  // Train with LoRA
  const trainingConfig = {
    modelId: 'base-model',
    baseModel: 'gpt-3.5-turbo',
    datasetId: 'training-dataset',
    loraConfig: defaultConfig,
    hyperparameters: {
      learningRate: 0.0003,
      batchSize: 32,
      epochs: 3,
    },
    outputDir: '/output/lora-model',
    loggingSteps: 10,
    saveSteps: 100,
    evalSteps: 100,
    maxSteps: 1000,
  };

  const trainingState = await loraTrainer.train(trainingConfig);

  console.log(`Training completed at step ${trainingState.step}`);
  console.log(`Final loss: ${trainingState.loss.toFixed(4)}`);
  console.log(`Checkpoints: ${trainingState.checkpoints.length}`);

  // Get parameter efficiency
  const efficiency = loraTrainer.getParameterEfficiency();
  console.log(`Trainable parameters: ${efficiency.trainable.toLocaleString()}`);
  console.log(`Total parameters: ${efficiency.total.toLocaleString()}`);
  console.log(`Percentage: ${efficiency.percentage.toFixed(2)}%`);

  // Memory optimization
  const memoryProfile = loraTrainer.getMemoryProfile(
    defaultConfig,
    175000000000, // 175B parameters
    32
  );

  console.log(`Memory profile:`, memoryProfile);

  // Multi-adapter management
  const multiAdapterManager = loraTrainer.getMultiAdapterManager();

  // Fuse adapters
  const fused = multiAdapterManager.fuseAdapters({
    adapters: ['adapter1', 'adapter2'],
    fusionType: 'linear',
    weights: [0.6, 0.4],
  });

  console.log(`Fused ${fused.length} adapters`);
}

// ============================================================================
// Example 6: Pipeline Automation
// ============================================================================

async function example6_PipelineAutomation() {
  console.log('\n=== Example 6: Pipeline Automation ===\n');

  // Create pipeline automation
  const automation = new PipelineAutomation();

  // List available templates
  const templates = automation.templateManager.listTemplates();
  console.log(`Available templates: ${templates.length}`);
  templates.forEach(t => {
    console.log(`- ${t.name}: ${t.description}`);
  });

  // Execute pipeline from template
  const execution = await automation.executePipeline(
    'standard-training',
    {
      datasetId: 'dataset-123',
      baseModel: 'gpt-3.5-turbo',
      epochs: 3,
      batchSize: 32,
      learningRate: 0.001,
    },
    [
      {
        type: 'webhook',
        destination: 'https://example.com/webhook',
        events: ['workflow_started', 'workflow_completed', 'workflow_failed'],
      },
    ]
  );

  console.log(`Started workflow execution: ${execution.id}`);
  console.log(`Status: ${execution.status}`);

  // Create scheduled pipeline
  const schedule = automation.createScheduledPipeline(
    'Daily Training',
    'standard-training',
    '0 0 * * *', // Daily at midnight
    {
      datasetId: 'dataset-123',
      baseModel: 'gpt-3.5-turbo',
    }
  );

  console.log(`Created scheduled pipeline: ${schedule.id}`);
  console.log(`Next run: ${new Date(schedule.nextRun!).toISOString()}`);

  // Create trigger-based pipeline
  const trigger = automation.createTriggeredPipeline(
    'On Dataset Update',
    'quick-training',
    'dataset_updated',
    {
      field: 'datasetId',
      operator: 'equals',
      value: 'dataset-123',
    },
    {
      datasetId: 'dataset-123',
      baseModel: 'gpt-3.5-turbo',
    }
  );

  console.log(`Created trigger: ${trigger.id}`);

  // Get system status
  const systemStatus = automation.getSystemStatus();
  console.log(`System status:`, systemStatus);
}

// ============================================================================
// Example 7: Distributed Training
// ============================================================================

async function example7_DistributedTraining() {
  console.log('\n=== Example 7: Distributed Training ===\n');

  // Create distributed coordinator
  const coordinator = new DistributedTrainingCoordinator();

  // Initialize distributed training
  const processGroupId = await coordinator.initialize({
    worldSize: 4, // 4 GPUs
    backend: 'nccl',
    masterAddress: 'localhost',
    masterPort: 29500,
    ddpConfig: {
      bucketSize: 25 * 1024 * 1024,
      findUnusedParameters: false,
      gradientAsBucketView: true,
    },
    faultToleranceConfig: {
      enabled: true,
      maxRetries: 3,
      heartbeatInterval: 10000,
      heartbeatTimeout: 30000,
      autoResume: true,
    },
  });

  console.log(`Initialized process group: ${processGroupId}`);

  // Calculate optimal world size
  const optimalWorldSize = coordinator.calculateOptimalWorldSize(
    8, // available GPUs
    175000000000, // model size
    32 // batch size
  );

  console.log(`Optimal world size: ${optimalWorldSize}`);

  // Estimate speedup
  const speedup = coordinator.estimateSpeedup(optimalWorldSize);
  console.log(`Estimated speedup: ${speedup.toFixed(2)}x`);

  // Get distributed metrics
  const metrics = coordinator.getDistributedMetrics(processGroupId);
  console.log(`Distributed metrics:`, metrics);

  // Cleanup
  await coordinator.cleanup(processGroupId);
  console.log('Cleaned up distributed training');
}

// ============================================================================
// Example 8: GPU Provider Management
// ============================================================================

async function example8_GPUProviderManagement() {
  console.log('\n=== Example 8: GPU Provider Management ===\n');

  // Create provider manager
  const providerManager = new GPUProviderManager({
    aws: {
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
      region: 'us-east-1',
    },
    gcp: {
      projectId: 'your-project-id',
      keyFile: '/path/to/key.json',
      region: 'us-central1',
    },
    lambda: {
      apiKey: 'your-lambda-api-key',
    },
  });

  // Get all available instances
  const allInstances = await providerManager.getAllAvailableInstances();
  console.log('Available instances:');

  for (const [provider, instances] of allInstances) {
    console.log(`\n${provider.toUpperCase()}:`);
    instances.forEach(instance => {
      console.log(
        `  - ${instance.name}: ${instance.gpus[0].model} x${instance.gpus[0].count}, $${instance.pricePerHour}/hr`
      );
    });
  }

  // Provision optimal instance
  const provisioned = await providerManager.provisionOptimalInstance({
    gpus: 4,
    minMemory: 40,
    maxCostPerHour: 5.0,
    region: 'us-east-1',
  });

  console.log(`\nProvisioned instance: ${provisioned.id}`);
  console.log(`Provider: ${provisioned.provider}`);
  console.log(`Type: ${provisioned.type}`);
  console.log(`GPUs: ${provisioned.gpus[0].count}x ${provisioned.gpus[0].model}`);
  console.log(`Estimated cost: $${provisioned.estimatedCost}/hr`);

  // Estimate training cost
  const costEstimates = await providerManager.estimateTrainingCost(
    {
      gpus: 4,
      minMemory: 40,
      region: 'us-east-1',
    },
    24 * 60 * 60 * 1000 // 24 hours
  );

  console.log('\nCost estimates for 24 hours:');
  costEstimates.slice(0, 5).forEach(estimate => {
    console.log(
      `  ${estimate.provider}: ${estimate.instanceType} - $${estimate.cost.toFixed(2)}`
    );
  });

  // Compare costs across providers
  const comparison = await providerManager.compareCosts(
    {
      aws: 'p4d.24xlarge',
      gcp: 'a2-highgpu-8g',
      lambda: 'gpu_8x_a100_sxm4',
    },
    24 * 60 * 60 * 1000
  );

  console.log('\nCost comparison:');
  comparison.forEach(c => {
    console.log(
      `  ${c.provider}: ${c.instanceType} - $${c.cost.toFixed(2)} (${c.gpus}x GPUs)`
    );
  });

  // Release instance
  await providerManager.releaseInstance(provisioned.id);
  console.log('\nReleased instance');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('ClaudeFlare Fine-tuning Package - Usage Examples\n');
  console.log('='.repeat(60));

  try {
    await example1_DatasetManagement();
    await example2_TrainingOrchestration();
    await example3_HyperparameterOptimization();
    await example4_ModelEvaluation();
    await example5_LoRATraining();
    await example6_PipelineAutomation();
    await example7_DistributedTraining();
    await example8_GPUProviderManagement();

    console.log('\n' + '='.repeat(60));
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

// Export examples for external use
export {
  example1_DatasetManagement,
  example2_TrainingOrchestration,
  example3_HyperparameterOptimization,
  example4_ModelEvaluation,
  example5_LoRATraining,
  example6_PipelineAutomation,
  example7_DistributedTraining,
  example8_GPUProviderManagement,
};
