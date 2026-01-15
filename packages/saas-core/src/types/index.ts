/**
 * TypeScript types for SaaS platform
 */

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    language: string;
  };
}

// Tenant types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: {
    maxProjects: number;
    maxUsers: number;
    features: {
      visualBuilder: boolean;
      aiAssist: boolean;
      teamCollaboration: boolean;
      auditLogs: boolean;
      customDomains: boolean;
    };
    billing: {
      stripeCustomerId?: string;
      subscriptionId?: string;
      trialEnds?: Date;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

// Project types
export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'saas' | 'api' | 'frontend' | 'backend' | 'fullstack';
  status: 'draft' | 'active' | 'archived';
  config: {
    visualBuilderState?: any;
    requirements?: any;
    architecture?: any;
    costEstimate?: any;
  };
  team: TeamMember[];
  permissions: ProjectPermissions;
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
}

interface TeamMember {
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: Date;
}

interface ProjectPermissions {
  allowExport: boolean;
  allowCollaboration: boolean;
  allowTemplateSharing: boolean;
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Subscription types
export interface Subscription {
  id: string;
  tenantId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnds?: Date;
  features: string[];
  limits: {
    maxProjects: number;
    maxTeamMembers: number;
    maxStorage: number;
    aiCredits: number;
  };
}

// Usage tracking
export interface Usage {
  id: string;
  tenantId: string;
  projectId?: string;
  userId: string;
  action: string;
  resource: string;
  metadata: any;
  timestamp: Date;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: 'project.created' | 'project.updated' | 'user.invited' | 'subscription.changed';
  tenantId: string;
  data: any;
  timestamp: Date;
}

// Cache types
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (c: any) => string;
}

// Security types
export interface SecurityConfig {
  requireMFA: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  ipWhitelist: string[];
  allowedOrigins: string[];
}