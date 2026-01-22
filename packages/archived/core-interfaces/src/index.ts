/**
 * ClaudeFlare Core Interfaces - Ultra-Optimized
 * Unified types for all packages
 */

// Core type definitions
export type ProjectType = 'saas' | 'api' | 'frontend' | 'backend' | 'fullstack';
export type UserRole = 'admin' | 'user' | 'viewer';
export type Plan = 'free' | 'pro' | 'enterprise';

// Minimal interfaces
export interface Project {
  id: string;
  name: string;
  type: ProjectType;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
}

// Result type for error handling
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Streamlined utilities
export const utils = {
  generateId: (prefix = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  formatCurrency: (amount: number): string => `$${amount.toFixed(2)}`,
  validateEmail: (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  slugify: (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
};

// Essential middleware
export const middleware = {
  auth: (token: string) => !!token,
  validate: (input: string) => input.length > 0
};

// Error helpers
export const errors = {
  unauthorized: () => ({ success: false, error: 'Unauthorized' as const }),
  notFound: () => ({ success: false, error: 'Not found' as const }),
  invalid: () => ({ success: false, error: 'Invalid input' as const }),
  forbidden: () => ({ success: false, error: 'Forbidden' as const })
};