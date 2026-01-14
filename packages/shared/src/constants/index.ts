/**
 * Shared constants for ClaudeFlare
 */

// ============================================================================
// Environment
// ============================================================================

export const ENVIRONMENT = {
  DEVELOPMENT: 'development' as const,
  STAGING: 'staging' as const,
  PRODUCTION: 'production' as const,
} as const;

// ============================================================================
// AI Providers
// ============================================================================

export const AI_PROVIDERS = {
  ANTHROPIC: 'anthropic' as const,
  OPENAI: 'openai' as const,
  COHERE: 'cohere' as const,
  MISTRAL: 'mistral' as const,
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE_CONFIG = {
  DEFAULT_TTL: 3600000, // 1 hour in milliseconds
  MAX_CACHE_SIZE: 10000,
  CACHE_KEY_PREFIX: 'cf:',
} as const;

// ============================================================================
// Rate Limiting
// ============================================================================

export const RATE_LIMITS = {
  FREE_TIER: {
    REQUESTS_PER_MINUTE: 60,
    REQUESTS_PER_HOUR: 1000,
    REQUESTS_PER_DAY: 10000,
  },
  PRO_TIER: {
    REQUESTS_PER_MINUTE: 600,
    REQUESTS_PER_HOUR: 10000,
    REQUESTS_PER_DAY: 100000,
  },
} as const;

// ============================================================================
// WebRTC Configuration
// ============================================================================

export const WEBRTC_CONFIG = {
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  DATA_CHANNEL_LABEL: 'claudeflare-rpc',
} as const;

// ============================================================================
// API Configuration
// ============================================================================

export const API_CONFIG = {
  VERSION: 'v1',
  BASE_PATH: '/api',
  TIMEOUT: 30000, // 30 seconds
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  RATE_LIMITED: 'Rate limit exceeded',
  INVALID_REQUEST: 'Invalid request format',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  INTERNAL_ERROR: 'Internal server error',
} as const;

// ============================================================================
// Log Levels
// ============================================================================

export const LOG_LEVELS = {
  DEBUG: 'debug' as const,
  INFO: 'info' as const,
  WARN: 'warn' as const,
  ERROR: 'error' as const,
} as const;

// ============================================================================
// Bundle Size Limits
// ============================================================================

export const BUNDLE_LIMITS = {
  WORKERS_FREE_TIER: 3 * 1024 * 1024, // 3MB
  WARNING_THRESHOLD: 2.5 * 1024 * 1024, // 2.5MB
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const FEATURES = {
  AI_COST_ANALYTICS: 'ai-cost-analytics',
  WEBRTC_SIGNALING: 'webrtc-signaling',
  SEMANTIC_CACHE: 'semantic-cache',
  RAG_RETRIEVAL: 'rag-retrieval',
  MULTI_PROVIDER_ROUTING: 'multi-provider-routing',
  AGENT_ORCHESTRATION: 'agent-orchestration',
} as const;
