# ClaudeFlare Fine-tuning System

Enterprise-grade fine-tuning and custom model management system built on Cloudflare Workers.

## Features

- **Model Registry**: Version and manage fine-tuned models with comprehensive metadata
- **Training Pipeline**: Orchestrate complete fine-tuning workflows with Durable Objects
- **Dataset Management**: Upload, validate, preprocess, and store training datasets in R2
- **Training Jobs**: Submit, monitor, and manage training jobs with real-time progress tracking
- **Model Evaluation**: Comprehensive metrics including BLEU, ROUGE, perplexity, and accuracy
- **Monitoring & Alerts**: Real-time monitoring with configurable alerts and webhooks
- **A/B Testing**: Compare models and evaluate performance improvements
- **Multi-Provider Support**: OpenAI, Anthropic, Cohere, and custom endpoints

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Worker)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Models  │ │ Datasets │ │ Training │ │  Eval    │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│              Durable Objects (State Management)             │
│  ┌──────────────────┐ ┌──────────────────┐                 │
│  │ Model Registry   │ │ Training Orch.   │                 │
│  │ DO               │ │ DO               │                 │
│  └──────────────────┘ └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │    R2    │ │    D1    │ │    KV    │                   │
│  │ (Datasets)│ │ (Metadata)│ │  (Cache) │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Cloudflare
npm run deploy
```

## Configuration

### Environment Variables

Set these secrets in your Cloudflare Workers environment:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put COHERE_API_KEY
```

### wrangler.toml

Configure your D1 database, R2 bucket, and Durable Objects in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "claudeflare-finetuning"
database_id = "your-database-id"

[[r2_buckets]]
binding = "R2"
bucket_name = "claudeflare-finetuning-storage"
```

### Database Setup

Initialize the D1 database with the schema:

```bash
wrangler d1 execute claudeflare-finetuning --file=schema.sql
```

## Usage

### Upload a Dataset

```typescript
import { DatasetManager } from '@claudeflare/finetuning';

const manager = new DatasetManager(env);

// Upload from file
const dataset = await manager.uploadDataset(file, {
  name: 'Training Data',
  format: 'jsonl',
  source: 'upload',
  tags: ['nlp', 'classification'],
});

// Import from GitHub
const dataset = await manager.importFromGitHub(
  'org/repo',
  'path/to/dataset.jsonl',
  { name: 'GitHub Dataset', format: 'jsonl', source: 'github' }
);
```

### Create a Training Job

```typescript
import { TrainingPipelineManager } from '@claudeflare/finetuning';

const manager = new TrainingPipelineManager(env);

const job = await manager.createTrainingJob(
  'model-id',
  'dataset-id',
  {
    hyperparameters: {
      learningRate: 0.0001,
      batchSize: 32,
      epochs: 3,
    },
    checkpointConfig: {
      enabled: true,
      interval: 500,
    },
    evaluationConfig: {
      enabled: true,
      metrics: ['loss', 'accuracy'],
    },
  }
);

await manager.startTrainingJob(job.id);
```

### Evaluate a Model

```typescript
import { ModelEvaluator } from '@claudeflare/finetuning';

const evaluator = new ModelEvaluator(env);

const evaluation = await evaluator.evaluateModel({
  modelId: 'model-id',
  datasetId: 'test-dataset-id',
  config: {
    metrics: ['loss', 'accuracy', 'bleu', 'rouge'],
    batchSize: 10,
  },
});
```

### Monitor Training

```typescript
import { JobMonitor } from '@claudeflare/finetuning';

const monitor = new JobMonitor(env);

// Get system metrics
const metrics = await monitor.getSystemMetrics();

// Get dashboard data
const dashboard = await monitor.getDashboardData();

// Get job performance
const summary = await monitor.getJobPerformanceSummary('job-id');
```

## API Endpoints

### Models

- `GET /api/models` - List models
- `GET /api/models/:modelId` - Get model details
- `POST /api/models` - Register new model
- `PUT /api/models/:modelId` - Update model
- `DELETE /api/models/:modelId` - Delete model
- `POST /api/models/:modelId/deploy` - Deploy model
- `POST /api/models/:modelId/undeploy` - Undeploy model
- `POST /api/models/compare` - Compare models

### Datasets

- `GET /api/datasets` - List datasets
- `GET /api/datasets/:datasetId` - Get dataset details
- `POST /api/datasets/upload` - Upload dataset
- `POST /api/datasets/import/url` - Import from URL
- `POST /api/datasets/import/github` - Import from GitHub
- `POST /api/datasets/:datasetId/validate` - Validate dataset
- `POST /api/datasets/:datasetId/preprocess` - Preprocess dataset
- `GET /api/datasets/:datasetId/download` - Download dataset
- `DELETE /api/datasets/:datasetId` - Delete dataset

### Training Jobs

- `GET /api/training/jobs` - List training jobs
- `GET /api/training/jobs/:jobId` - Get job details
- `POST /api/training/jobs` - Create training job
- `POST /api/training/jobs/:jobId/start` - Start training
- `POST /api/training/jobs/:jobId/pause` - Pause training
- `POST /api/training/jobs/:jobId/cancel` - Cancel training
- `GET /api/training/jobs/:jobId/logs` - Get training logs
- `GET /api/training/jobs/:jobId/checkpoints` - Get checkpoints
- `POST /api/training/jobs/:jobId/resume` - Resume from checkpoint

### Evaluation

- `POST /api/evaluations` - Create evaluation
- `GET /api/evaluations/:evaluationId` - Get evaluation
- `GET /api/models/:modelId/evaluations` - List model evaluations
- `POST /api/evaluations/compare` - Compare models

### Monitoring

- `GET /api/monitoring/metrics` - Get system metrics
- `GET /api/monitoring/dashboard` - Get dashboard data
- `GET /api/monitoring/alerts` - Get alerts
- `POST /api/monitoring/alerts/:alertId/acknowledge` - Acknowledge alert
- `GET /api/monitoring/jobs/:jobId/performance` - Get job performance

## Dataset Formats

Supported formats:

- **JSONL** (recommended): One JSON object per line
  ```jsonl
  {"prompt": "What is AI?", "completion": "AI is artificial intelligence."}
  {"prompt": "Explain ML", "completion": "Machine learning is a subset of AI."}
  ```

- **JSON**: Array of objects
  ```json
  [
    {"prompt": "What is AI?", "completion": "AI is artificial intelligence."},
    {"prompt": "Explain ML", "completion": "Machine learning is a subset of AI."}
  ]
  ```

- **CSV**: Comma-separated values with headers
  ```csv
  prompt,completion
  "What is AI?","AI is artificial intelligence."
  "Explain ML","Machine learning is a subset of AI."
  ```

## Hyperparameter Tuning

### Default Hyperparameters

```typescript
{
  learningRate: 0.0001,
  batchSize: 32,
  epochs: 3,
  warmupSteps: 100,
  weightDecay: 0.01,
  gradientAccumulationSteps: 1,
  maxGradNorm: 1.0,
}
```

### Auto-suggestion

The system can suggest hyperparameters based on dataset size:

```typescript
import { HyperparameterUtils } from '@claudeflare/finetuning';

const hyperparams = HyperparameterUtils.suggestForDataset(datasetSize);
```

## Evaluation Metrics

Supported metrics:

- **Loss**: Cross-entropy loss (lower is better)
- **Accuracy**: Exact match accuracy
- **BLEU Score**: Machine translation quality
- **ROUGE Score**: Text summarization quality (ROUGE-1, ROUGE-2, ROUGE-L)
- **Perplexity**: Language model quality
- **F1 Score**: Precision and recall combined
- **Semantic Similarity**: Text similarity score

## Monitoring & Alerts

### System Metrics

- Active training jobs
- Queued jobs
- Completed/failed jobs
- Resource usage (CPU, memory, GPU)
- Throughput (requests/sec, tokens/sec, latency)

### Alerts

Configurable alerts for:

- High failure rate
- Long-running jobs
- Loss spikes
- Training stagnation
- High resource usage
- System errors

### Webhooks

Subscribe to events:

```typescript
await fetch('/api/webhooks', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://your-webhook-url.com',
    events: ['training.started', 'training.completed', 'training.failed'],
  }),
});
```

## Performance Optimization

### Checkpoints

Automatic checkpoint saving at configurable intervals:

```typescript
{
  checkpointConfig: {
    enabled: true,
    interval: 500,  // steps
    maxToKeep: 5,
    saveBest: true,
  },
}
```

### Evaluation

Periodic evaluation during training:

```typescript
{
  evaluationConfig: {
    enabled: true,
    interval: 1000,  // steps
    metrics: ['loss', 'accuracy'],
    testSet: false,
  },
}
```

### Resource Limits

Configure resource allocation:

```typescript
{
  resourceConfig: {
    gpuCount: 1,
    maxRuntime: 86400,  // seconds
    priority: 'normal',  // low, normal, high
    spotInstance: true,
  },
}
```

## Development

```bash
# Install dependencies
npm install

# Run TypeScript compiler in watch mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run typecheck

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines.

## Support

- GitHub Issues: https://github.com/claudeflare/finetuning/issues
- Documentation: https://docs.claudeflare.com
- Discord: https://discord.gg/claudeflare
