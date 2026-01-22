/**
 * TypeScript types for the Visual Builder
 */

import { Template, ArchitectureRecommendation } from '@claudeflare/factory-core';

// Service node types
export interface ServiceNode {
  id: string;
  type: 'worker' | 'page' | 'worker-pages' | 'database' | 'storage' | 'queue' | 'cache' | 'auth';
  name: string;
  description: string;
  position: { x: number; y: number };
  config: ServiceConfig;
  status: 'idle' | 'deploying' | 'running' | 'error';
  metadata: {
    icon: string;
    color: string;
    category: string;
    technologies: string[];
    resources: ServiceResources;
  };
}

export interface ServiceConfig {
  runtime: string;
  environment: string[];
  environmentVariables: Record<string, string>;
  secrets: string[];
  resources: {
    cpu: string;
    memory: string;
    storage: string;
    bandwidth: string;
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    autoScaling: boolean;
  };
}

export interface ServiceResources {
  cpu: {
    min: number;
    max: number;
    default: number;
    unit: string;
  };
  memory: {
    min: number;
    max: number;
    default: number;
    unit: string;
  };
  storage: {
    min: number;
    max: number;
    default: number;
    unit: string;
  };
  bandwidth: {
    min: number;
    max: number;
    default: number;
    unit: string;
  };
}

// Connection types
export interface Connection {
  id: string;
  source: string;
  target: string;
  type: 'data' | 'api' | 'auth' | 'cache';
  label?: string;
  status: 'active' | 'inactive' | 'error';
}

// Requirement types
export interface Requirement {
  id: string;
  type: 'technical' | 'business' | 'security' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  acceptance: string[];
  validation?: {
    type: 'text' | 'number' | 'boolean' | 'select';
    options?: string[];
    regex?: string;
  };
}

// Template types
export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'saas' | 'api' | 'frontend' | 'backend' | 'fullstack';
  icon: string;
  preview?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  features: TemplateFeature[];
  technologies: string[];
  services: {
    type: ServiceNode['type'];
    name: string;
    required: boolean;
    config: Partial<ServiceConfig>;
  }[];
  dependencies: string[];
  customSections?: TemplateSection[];
}

export interface TemplateFeature {
  name: string;
  description: string;
  icon: string;
  included: boolean;
}

export interface TemplateSection {
  id: string;
  title: string;
  type: 'form' | 'code' | 'markdown' | 'image';
  content: string;
  required?: boolean;
  validation?: any;
}

// Architecture types
export interface Architecture {
  id: string;
  name: string;
  description: string;
  services: ServiceNode[];
  connections: Connection[];
  patterns: string[];
  technologies: {
    name: string;
    category: string;
    version: string;
    reason: string;
  }[];
  estimatedCost: {
    monthly: number;
    yearly: number;
    currency: string;
    breakdown: Record<string, number>;
  };
  estimatedTimeline: string;
  risks: {
    id: string;
    category: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    probability: number;
    mitigation: string;
  }[];
}

// Cost breakdown types
export interface CostBreakdown {
  compute: {
    base: number;
    variable: number;
    total: number;
    unit: string;
  };
  storage: {
    base: number;
    variable: number;
    total: number;
    unit: string;
  };
  bandwidth: {
    base: number;
    variable: number;
    total: number;
    unit: string;
  };
  database: {
    base: number;
    variable: number;
    total: number;
    unit: string;
  };
  total: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  scenarios: {
    name: string;
    monthly: number;
    yearly: number;
    description: string;
  }[];
  optimization: {
    potentialSavings: number;
    recommendations: {
      area: string;
      description: string;
      impact: string;
      estimatedSavings: number;
    }[];
  };
}

// UI types
export interface TreeNode {
  id: string;
  label: string;
  type: 'service' | 'template' | 'category';
  icon: string;
  children?: TreeNode[];
  data?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExportOptions {
  format: 'json' | 'yaml' | 'docker' | 'terraform' | 'code';
  include: {
    services: boolean;
    connections: boolean;
    requirements: boolean;
    architecture: boolean;
    costs: boolean;
  };
  outputDirectory?: string;
  template?: string;
}

// Drag and drop types
export interface DragItem {
  type: 'service' | 'node' | 'connection';
  id?: string;
  data?: any;
}

export interface DropResult {
  overId?: string;
  clientOffset?: { x: number; y: number };
  clientOffsetBefore?: { x: number; y: number };
}

// WebSocket types for real-time collaboration
export interface CollaborationEvent {
  type: 'joined' | 'left' | 'move' | 'select' | 'edit' | 'connection';
  userId: string;
  userName: string;
  timestamp: number;
  data: any;
}

export interface UserPresence {
  userId: string;
  userName: string;
  avatar?: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  lastSeen: number;
}

// Analytics types
export interface AnalyticsEvent {
  type: 'service_added' | 'connection_made' | 'requirement_added' | 'template_selected';
  timestamp: number;
  userId?: string;
  sessionId: string;
  metadata: {
    serviceType?: string;
    connectionType?: string;
    requirementType?: string;
    templateId?: string;
    duration?: number;
  };
}

// Error types
export interface BuilderError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Theme types
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
  };
  spacing: {
    unit: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
}

// Built-in themes
export const LIGHT_THEME: Theme = {
  name: 'Light',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  spacing: {
    unit: 4,
    xs: 0.25,
    sm: 0.5,
    md: 1,
    lg: 1.5,
    xl: 2,
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
};

export const DARK_THEME: Theme = {
  name: 'Dark',
  colors: {
    primary: '#818cf8',
    secondary: '#a78bfa',
    accent: '#22d3ee',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    muted: '#94a3b8',
    border: '#334155',
  },
  spacing: LIGHT_THEME.spacing,
  borderRadius: LIGHT_THEME.borderRadius,
  typography: LIGHT_THEME.typography,
};