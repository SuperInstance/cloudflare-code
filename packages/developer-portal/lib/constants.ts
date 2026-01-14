// API Endpoints
export const API_ENDPOINTS = {
  // Completions
  COMPLETIONS: '/v1/completions',
  CHAT: '/v1/chat/completions',

  // Embeddings
  EMBEDDINGS: '/v1/embeddings',

  // Models
  MODELS: '/v1/models',
  MODEL_INFO: (modelId: string) => `/v1/models/${modelId}`,

  // Files
  FILES: '/v1/files',
  FILE_UPLOAD: '/v1/files/upload',
  FILE_DELETE: (fileId: string) => `/v1/files/${fileId}`,

  // Fine-tuning
  FINE_TUNING: '/v1/fine-tuning',
  FINE_TUNING_JOB: (jobId: string) => `/v1/fine-tuning/jobs/${jobId}`,

  // Batch
  BATCH: '/v1/batch',
  BATCH_JOB: (jobId: string) => `/v1/batch/jobs/${jobId}`,

  // Analytics
  ANALYTICS_USAGE: '/v1/analytics/usage',
  ANALYTICS_METRICS: '/v1/analytics/metrics',
  ANALYTICS_TOP_ENDPOINTS: '/v1/analytics/top-endpoints',
  ANALYTICS_PROVIDERS: '/v1/analytics/providers',

  // Billing
  BILLING: '/v1/billing',
  BILLING_FORECAST: '/v1/billing/forecast',
  BILLING_INVOICES: '/v1/billing/invoices',
  BILLING_INVOICE_DOWNLOAD: (invoiceId: string) =>
    `/v1/billing/invoices/${invoiceId}/download`,
  BILLING_BUDGET_ALERT: '/v1/billing/budget-alert',

  // Webhooks
  WEBHOOKS: '/v1/webhooks',
  WEBHOOK_REPLAY: '/v1/webhooks/replay',
  WEBHOOK_VERIFY: '/v1/webhooks/verify',

  // Community
  COMMUNITY_POSTS: '/v1/community/posts',
  COMMUNITY_POST: (postId: string) => `/v1/community/posts/${postId}`,
  COMMUNITY_CODE: '/v1/community/code',
  COMMUNITY_CODE_SNIPPET: (snippetId: string) =>
    `/v1/community/code/${snippetId}`,
  COMMUNITY_PLUGINS: '/v1/community/plugins',
  COMMUNITY_PLUGIN: (pluginId: string) =>
    `/v1/community/plugins/${pluginId}`,
} as const;

// HTTP Methods
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

// Content Types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  FORM_DATA: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  XML: 'application/xml',
} as const;

// Status Codes
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Rate Limits
export const RATE_LIMITS = {
  FREE: {
    requests: 1000,
    window: '24h',
  },
  PRO: {
    requests: 10000,
    window: '24h',
  },
  ENTERPRISE: {
    requests: 100000,
    window: '24h',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred',
  TIMEOUT: 'Request timeout',
  UNAUTHORIZED: 'Unauthorized access',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  SERVER_ERROR: 'Internal server error',
  INVALID_REQUEST: 'Invalid request',
} as const;

// Supported Languages for Code Generation
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'go',
  'curl',
  'java',
  'rust',
  'php',
] as const;

// Chart Time Ranges
export const TIME_RANGES = {
  HOUR: '1h',
  DAY: '24h',
  WEEK: '7d',
  MONTH: '30d',
  QUARTER: '90d',
  YEAR: '365d',
} as const;

// Granularity Options
export const GRANULARITY = ['hour', 'day', 'week', 'month'] as const;

// Billing Cycle Types
export const BILLING_CYCLES = ['monthly', 'quarterly', 'annual'] as const;

// Invoice Statuses
export const INVOICE_STATUSES = ['paid', 'pending', 'failed'] as const;

// Post Categories
export const POST_CATEGORIES = [
  'general',
  'api',
  'integrations',
  'bug-reports',
  'feature-requests',
] as const;

// Plugin Tags
export const PLUGIN_TAGS = [
  'vscode',
  'cli',
  'react',
  'python',
  'go',
  'typescript',
  'monitoring',
  'testing',
  'deployment',
  'productivity',
] as const;
