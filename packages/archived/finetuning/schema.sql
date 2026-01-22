-- ClaudeFlare Fine-tuning System Database Schema
-- D1 Database Schema

-- ============================================================================
-- Models Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  base_model TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'available',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  trained_at INTEGER,
  metrics TEXT, -- JSON
  hyperparameters TEXT, -- JSON
  dataset_id TEXT NOT NULL,
  config TEXT NOT NULL, -- JSON
  deployment TEXT, -- JSON
  tags TEXT DEFAULT '[]', -- JSON array
  metadata TEXT DEFAULT '{}', -- JSON object
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_base_model ON models(base_model);
CREATE INDEX IF NOT EXISTS idx_models_dataset_id ON models(dataset_id);
CREATE INDEX IF NOT EXISTS idx_models_created_at ON models(created_at);

-- ============================================================================
-- Datasets Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  path TEXT NOT NULL,
  r2_bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  schema TEXT, -- JSON
  statistics TEXT, -- JSON
  splits TEXT, -- JSON
  tags TEXT DEFAULT '[]', -- JSON array
  metadata TEXT DEFAULT '{}' -- JSON object
);

CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_format ON datasets(format);
CREATE INDEX IF NOT EXISTS idx_datasets_source ON datasets(source);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at);

-- ============================================================================
-- Training Jobs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_jobs (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress TEXT NOT NULL, -- JSON
  config TEXT NOT NULL, -- JSON
  metrics TEXT NOT NULL, -- JSON
  checkpoints TEXT DEFAULT '[]', -- JSON array
  logs TEXT DEFAULT '[]', -- JSON array
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  estimated_completion_at INTEGER,
  error TEXT, -- JSON
  tags TEXT DEFAULT '[]', -- JSON array
  metadata TEXT DEFAULT '{}', -- JSON object
  FOREIGN KEY (model_id) REFERENCES models(id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_model_id ON training_jobs(model_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_dataset_id ON training_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created_at ON training_jobs(created_at);

-- ============================================================================
-- Evaluations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metrics TEXT NOT NULL, -- JSON
  config TEXT NOT NULL, -- JSON
  results TEXT DEFAULT '[]', -- JSON array
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  comparison TEXT, -- JSON
  FOREIGN KEY (model_id) REFERENCES models(id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_model_id ON evaluations(model_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_dataset_id ON evaluations(dataset_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON evaluations(created_at);

-- ============================================================================
-- Pipelines Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stages TEXT NOT NULL, -- JSON array
  config TEXT NOT NULL, -- JSON
  status TEXT NOT NULL DEFAULT 'idle',
  current_stage INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}' -- JSON object
);

CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at);

-- ============================================================================
-- Webhooks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array
  secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_triggered INTEGER
);

CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);

-- ============================================================================
-- Model Registry Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_registry_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE INDEX IF NOT EXISTS idx_model_registry_logs_model_id ON model_registry_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_model_registry_logs_timestamp ON model_registry_logs(timestamp);

-- ============================================================================
-- Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT, -- JSON
  timestamp INTEGER NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

-- ============================================================================
-- Metrics History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS metrics_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES training_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_history_job_id ON metrics_history(job_id);
CREATE INDEX IF NOT EXISTS idx_metrics_history_metric_name ON metrics_history(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_history_timestamp ON metrics_history(timestamp);

-- ============================================================================
-- Checkpoints Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  epoch INTEGER NOT NULL,
  loss REAL NOT NULL,
  metrics TEXT NOT NULL, -- JSON
  path TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_best INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (job_id) REFERENCES training_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_job_id ON checkpoints(job_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_is_best ON checkpoints(is_best);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at ON checkpoints(created_at);

-- ============================================================================
-- System Metrics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  labels TEXT, -- JSON
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);

-- ============================================================================
-- Triggers for Automatic Timestamps
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_models_timestamp
AFTER UPDATE ON models
BEGIN
  UPDATE models SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_datasets_timestamp
AFTER UPDATE ON datasets
BEGIN
  UPDATE datasets SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_pipelines_timestamp
AFTER UPDATE ON pipelines
BEGIN
  UPDATE pipelines SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Active training jobs view
CREATE VIEW IF NOT EXISTS v_active_training_jobs AS
SELECT
  id,
  model_id,
  dataset_id,
  status,
  JSON_EXTRACT(progress, '$.percentage') as progress_percent,
  JSON_EXTRACT(progress, '$.currentStep') as current_step,
  JSON_EXTRACT(progress, '$.totalSteps') as total_steps,
  created_at,
  started_at
FROM training_jobs
WHERE status IN ('queued', 'preparing', 'training');

-- Model deployment summary view
CREATE VIEW IF NOT EXISTS v_model_deployments AS
SELECT
  m.id,
  m.name,
  m.base_model,
  m.status,
  JSON_EXTRACT(m.deployment, '$.status') as deployment_status,
  JSON_EXTRACT(m.deployment, '$.endpoint') as endpoint,
  JSON_EXTRACT(m.deployment, '$.requestCount') as request_count,
  m.created_at
FROM models m
WHERE m.deployment IS NOT NULL;

-- Dataset statistics view
CREATE VIEW IF NOT EXISTS v_dataset_stats AS
SELECT
  d.id,
  d.name,
  d.format,
  d.status,
  d.row_count,
  d.size,
  JSON_EXTRACT(d.statistics, '$.totalTokens') as total_tokens,
  d.created_at
FROM datasets d
WHERE d.status = 'ready';

-- Training job summary view
CREATE VIEW IF NOT EXISTS v_training_job_summary AS
SELECT
  tj.id,
  tj.model_id,
  tj.dataset_id,
  m.name as model_name,
  d.name as dataset_name,
  tj.status,
  JSON_EXTRACT(tj.metrics, '$.loss.current') as current_loss,
  JSON_EXTRACT(tj.progress, '$.percentage') as progress_percent,
  tj.created_at,
  tj.started_at,
  tj.completed_at
FROM training_jobs tj
JOIN models m ON tj.model_id = m.id
JOIN datasets d ON tj.dataset_id = d.id;

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Insert sample datasets
INSERT INTO datasets (id, name, description, format, source, status, created_at, updated_at, size, row_count, checksum, path, r2_bucket, r2_key, tags, metadata)
VALUES
  ('ds-sample-1', 'Sample Training Dataset', 'A sample dataset for testing', 'jsonl', 'upload', 'ready', 1704067200000, 1704067200000, 1024000, 1000, 'abc123', '/datasets/sample.jsonl', 'claudeflare-datasets', 'datasets/ds-sample-1/data.jsonl', '["sample", "test"]', '{"purpose": "testing"}');

-- Insert sample models
INSERT INTO models (id, base_model, name, version, status, created_at, updated_at, dataset_id, config, tags, metadata)
VALUES
  ('model-sample-1', 'gpt-3.5-turbo', 'Sample Fine-tuned Model', '1.0.0', 'available', 1704067200000, 1704067200000, 'ds-sample-1', '{"provider": "openai", "apiKey": "sk-test", "inferenceConfig": {"temperature": 0.7, "maxTokens": 2048}}', '["sample", "test"]', '{"purpose": "testing"}');

-- Insert sample training job
INSERT INTO training_jobs (id, model_id, dataset_id, status, progress, config, metrics, created_at, tags, metadata)
VALUES
  ('job-sample-1', 'model-sample-1', 'ds-sample-1', 'completed', '{"currentStep": 3000, "totalSteps": 3000, "currentEpoch": 3, "totalEpochs": 3, "percentage": 100}', '{"hyperparameters": {"learningRate": 0.0001, "batchSize": 32, "epochs": 3}, "checkpointConfig": {"enabled": true, "interval": 500}, "evaluationConfig": {"enabled": true}}', '{"loss": {"values": [], "current": 0.5234, "best": 0.5234, "average": 0.6123}}', 1704067200000, '["sample"]', '{"test": true}');
