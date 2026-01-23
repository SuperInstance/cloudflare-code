/**
 * Central type definitions for Cocapn platform
 */

export * from './security';
export * from './code-review';

// Additional type definitions will be added here as needed
export interface Bindings {
  // Cloudflare Workers bindings
  KV?: KVNamespace;
  D1?: D1Database;
  R2?: R2Bucket;
  // Add more as needed
}

export interface Env {
  // Environment variables
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  API_KEYS?: string;
  JWT_SECRET?: string;
  // Add more as needed
}

export interface RequestContext {
  userId?: string;
  sessionId?: string;
  timestamp: number;
  path: string;
  method: string;
}

export interface ResponseContext {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  duration: number;
}
