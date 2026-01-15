/**
 * Template Registry for ClaudeFlare Application Factory
 * Manages and provides access to application templates
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Template } from './project-generator';

export class TemplateRegistry {
  private templates: Map<string, Template> = new Map();
  private registryPath: string;

  constructor() {
    this.registryPath = join(process.cwd(), 'templates');
    this.initializeRegistry();
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Get template categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.templates.forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): Template[] {
    return Array.from(this.templates.values()).filter(
      template => template.category === category
    );
  }

  /**
   * Get templates by framework
   */
  getTemplatesByFramework(framework: string): Template[] {
    return Array.from(this.templates.values()).filter(
      template => template.framework === framework
    );
  }

  /**
   * Search templates by keywords
   */
  searchTemplates(query: string): Template[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.features.some(feature => feature.toLowerCase().includes(lowerQuery)) ||
      template.framework.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Add a new template
   */
  addTemplate(template: Template): void {
    this.templates.set(template.id, template);
    this.saveTemplate(template);
  }

  /**
   * Update an existing template
   */
  updateTemplate(id: string, updates: Partial<Template>): boolean {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    const updatedTemplate = { ...template, ...updates };
    this.templates.set(id, updatedTemplate);
    this.saveTemplate(updatedTemplate);
    return true;
  }

  /**
   * Delete a template
   */
  deleteTemplate(id: string): boolean {
    if (!this.templates.has(id)) {
      return false;
    }

    this.templates.delete(id);
    this.deleteTemplateFile(id);
    return true;
  }

  /**
   * Clone a template with modifications
   */
  cloneTemplate(id: string, newId: string, modifications: Partial<Template>): Template | null {
    const template = this.templates.get(id);
    if (!template) {
      return null;
    }

    const clonedTemplate: Template = {
      ...template,
      id: newId,
      name: `${template.name} (Clone)`,
      ...modifications
    };

    this.addTemplate(clonedTemplate);
    return clonedTemplate;
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: Template): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!template.id || template.id.trim().length === 0) {
      errors.push('Template ID is required');
    }

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.description || template.description.trim().length === 0) {
      errors.push('Template description is required');
    }

    if (!template.category || !['saas', 'api', 'frontend', 'backend', 'fullstack'].includes(template.category)) {
      errors.push('Template category must be one of: saas, api, frontend, backend, fullstack');
    }

    if (!template.framework || template.framework.trim().length === 0) {
      errors.push('Template framework is required');
    }

    if (!template.language || template.language.trim().length === 0) {
      errors.push('Template language is required');
    }

    if (!template.features || !Array.isArray(template.features)) {
      errors.push('Template features must be an array');
    }

    if (!template.complexity || !['low', 'medium', 'high', 'very-high'].includes(template.complexity)) {
      errors.push('Template complexity must be one of: low, medium, high, very-high');
    }

    if (!template.files || !Array.isArray(template.files)) {
      errors.push('Template files must be an array');
    }

    if (!template.dependencies || !Array.isArray(template.dependencies)) {
      errors.push('Template dependencies must be an array');
    }

    if (!template.scripts || typeof template.scripts !== 'object') {
      errors.push('Template scripts must be an object');
    }

    // Check for duplicate ID
    const existingTemplate = this.templates.get(template.id);
    if (existingTemplate && existingTemplate !== template) {
      errors.push(`Template with ID "${template.id}" already exists`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Import template from file
   */
  importTemplate(filePath: string): Template | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const template: Template = JSON.parse(content);

      const validation = this.validateTemplate(template);
      if (!validation.valid) {
        console.error(`Template validation failed: ${validation.errors.join(', ')}`);
        return null;
      }

      this.addTemplate(template);
      return template;
    } catch (error) {
      console.error(`Failed to import template from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Export template to file
   */
  exportTemplate(id: string, filePath?: string): string | null {
    const template = this.templates.get(id);
    if (!template) {
      return null;
    }

    const exportPath = filePath || join(this.registryPath, `${id}.json`);
    writeFileSync(exportPath, JSON.stringify(template, null, 2));
    return exportPath;
  }

  /**
   * Get template statistics
   */
  getStatistics(): {
    total: number;
    byCategory: Record<string, number>;
    byFramework: Record<string, number>;
    byComplexity: Record<string, number>;
  } {
    const stats = {
      total: this.templates.size,
      byCategory: {} as Record<string, number>,
      byFramework: {} as Record<string, number>,
      byComplexity: {} as Record<string, number>
    };

    this.templates.forEach(template => {
      // Count by category
      stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;

      // Count by framework
      stats.byFramework[template.framework] = (stats.byFramework[template.framework] || 0) + 1;

      // Count by complexity
      stats.byComplexity[template.complexity] = (stats.byComplexity[template.complexity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Initialize the template registry
   */
  private initializeRegistry(): void {
    // Create registry directory if it doesn't exist
    if (!existsSync(this.registryPath)) {
      mkdirSync(this.registryPath, { recursive: true });
    }

    // Load built-in templates
    this.loadBuiltinTemplates();

    // Load templates from registry directory
    this.loadTemplatesFromDirectory();
  }

  /**
   * Load built-in templates
   */
  private loadBuiltinTemplates(): void {
    const builtinTemplates: Template[] = [
      {
        id: 'ecommerce-saas',
        name: 'E-commerce SaaS',
        description: 'Complete e-commerce platform with cart, payments, and inventory management',
        category: 'saas',
        framework: 'react',
        language: 'typescript',
        database: 'postgres',
        auth: 'jwt',
        features: [
          'auth',
          'product-catalog',
          'shopping-cart',
          'checkout',
          'payments',
          'inventory',
          'orders',
          'dashboard',
          'admin',
          'analytics'
        ],
        complexity: 'very-high',
        files: [],
        dependencies: [
          '@hono/hono',
          '@hono/zod-validator',
          'stripe',
          'bcrypt',
          'jsonwebtoken',
          'react',
          'react-dom'
        ],
        scripts: {
          dev: 'wrangler dev',
          build: 'wrangler build',
          deploy: 'wrangler deploy',
          'stripe:webhooks': 'stripe listen --forward-to localhost:3000/webhooks/stripe',
          'stripe:login': 'stripe login'
        }
      },
      {
        id: 'blog-cms',
        name: 'Blog CMS',
        description: 'Headless CMS for blogs and content management',
        category: 'saas',
        framework: 'next',
        language: 'typescript',
        database: 'postgres',
        auth: 'firebase',
        features: [
          'cms',
          'blog',
          'markdown',
          'content-versioning',
          'media-management',
          'seo',
          'comments',
          'rss',
          'search',
          'analytics'
        ],
        complexity: 'high',
        files: [],
        dependencies: [
          'next',
          'react',
          'react-dom',
          '@hono/hono',
          '@hono/zod-validator',
          'firebase-admin',
          'sqlite3'
        ],
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          export: 'next export',
          deploy: 'wrangler deploy'
        }
      },
      {
        id: 'api-gateway',
        name: 'API Gateway',
        description: 'Microservices API gateway with authentication and rate limiting',
        category: 'api',
        framework: 'express',
        language: 'typescript',
        database: 'postgres',
        auth: 'oauth',
        features: [
          'api-gateway',
          'authentication',
          'rate-limiting',
          'caching',
          'logging',
          'monitoring',
          'swagger',
          'graphql',
          'webhooks',
          'documentation'
        ],
        complexity: 'high',
        files: [],
        dependencies: [
          '@hono/hono',
          '@hono/zod-validator',
          'pg',
          'redis',
          'jsonwebtoken',
          'express-rate-limit',
          'helmet'
        ],
        scripts: {
          dev: 'wrangler dev',
          build: 'wrangler build',
          deploy: 'wrangler deploy',
          'test:api': 'jest tests/api'
        }
      },
      {
        id: 'dashboard-analytics',
        name: 'Dashboard Analytics',
        description: 'Real-time analytics dashboard with charts and metrics',
        category: 'frontend',
        framework: 'vue',
        language: 'typescript',
        database: 'postgres',
        auth: 'jwt',
        features: [
          'real-time-charts',
          'metrics',
          'dashboards',
          'data-visualization',
          'export-reports',
          'user-preferences',
          'dark-mode',
          'responsive',
          'filters',
          'search'
        ],
        complexity: 'high',
        files: [],
        dependencies: [
          'vue',
          'vue-router',
          'pinia',
          'chart.js',
          'vue-chartjs',
          '@hono/hono',
          '@hono/zod-validator'
        ],
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          deploy: 'wrangler deploy'
        }
      },
      {
        id: 'mobile-api',
        name: 'Mobile API',
        description: 'Optimized REST API for mobile applications',
        category: 'api',
        framework: 'fastapi',
        language: 'typescript',
        database: 'redis',
        auth: 'oauth',
        features: [
          'mobile-optimization',
          'push-notifications',
          'offline-sync',
          'geolocation',
          'background-tasks',
          'caching',
          'compression',
          'graphql',
          'websockets',
          'analytics'
        ],
        complexity: 'high',
        files: [],
        dependencies: [
          '@hono/hono',
          '@hono/zod-validator',
          'redis',
          'socket.io',
          'graphql',
          'apollo-server'
        ],
        scripts: {
          dev: 'wrangler dev',
          build: 'wrangler build',
          deploy: 'wrangler deploy',
          'test:mobile': 'jest tests/mobile'
        }
      },
      {
        id: 'portfolio-website',
        name: 'Portfolio Website',
        description: 'Modern portfolio website with project showcase',
        category: 'frontend',
        framework: 'svelte',
        language: 'typescript',
        database: 'kv',
        features: [
          'responsive-design',
          'project-gallery',
          'blog',
          'contact-form',
          'dark-mode',
          'seo',
          'analytics',
          'performance',
          'pwa',
          'offline'
        ],
        complexity: 'low',
        files: [],
        dependencies: [
          'svelte',
          'svelte-kit',
          '@hono/hono',
          '@hono/zod-validator'
        ],
        scripts: {
          dev: 'svelte-kit dev',
          build: 'svelte-kit build',
          preview: 'svelte-kit preview'
        }
      },
      {
        id: 'social-media',
        name: 'Social Media Platform',
        description: 'Full social media platform with real-time features',
        category: 'fullstack',
        framework: 'next',
        language: 'typescript',
        database: 'postgres',
        auth: 'jwt',
        features: [
          'user-profiles',
          'posts',
          'comments',
          'likes',
          'follows',
          'messaging',
          'notifications',
          'stories',
          'groups',
          'search',
          'analytics',
          'moderation',
          'privacy'
        ],
        complexity: 'very-high',
        files: [],
        dependencies: [
          'next',
          'react',
          'react-dom',
          '@hono/hono',
          '@hono/zod-validator',
          'socket.io',
          'prisma',
          '@prisma/client',
          'bcrypt',
          'jsonwebtoken'
        ],
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          deploy: 'wrangler deploy',
          'db:generate': 'prisma generate',
          'db:migrate': 'prisma migrate dev',
          'db:studio': 'prisma studio'
        }
      },
      {
        id: 'iot-dashboard',
        name: 'IoT Dashboard',
        description: 'IoT device monitoring and control dashboard',
        category: 'saas',
        framework: 'react',
        language: 'typescript',
        database: 'influxdb',
        auth: 'oauth',
        features: [
          'device-monitoring',
          'real-time-data',
          'alerts',
          'automation',
          'data-visualization',
          'device-management',
          'user-permissions',
          'export-data',
          'api-integration',
          'machine-learning'
        ],
        complexity: 'very-high',
        files: [],
        dependencies: [
          'react',
          'react-dom',
          '@hono/hono',
          '@hono/zod-validator',
          'influxdb-client',
          'socket.io',
          'recharts'
        ],
        scripts: {
          dev: 'wrangler dev',
          build: 'wrangler build',
          deploy: 'wrangler deploy'
        }
      }
    ];

    builtinTemplates.forEach(template => {
      this.templates.set(template.id, template);
      this.saveTemplate(template);
    });
  }

  /**
   * Load templates from registry directory
   */
  private loadTemplatesFromDirectory(): void {
    if (!existsSync(this.registryPath)) {
      return;
    }

    const files = existsSync(this.registryPath)
      ? require('fs').readdirSync(this.registryPath)
      : [];

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = join(this.registryPath, file);
        this.importTemplate(filePath);
      }
    });
  }

  /**
   * Save template to registry
   */
  private saveTemplate(template: Template): void {
    const filePath = join(this.registryPath, `${template.id}.json`);
    writeFileSync(filePath, JSON.stringify(template, null, 2));
  }

  /**
   * Delete template file
   */
  private deleteTemplateFile(id: string): void {
    const filePath = join(this.registryPath, `${id}.json`);
    if (existsSync(filePath)) {
      require('fs').unlinkSync(filePath);
    }
  }
}

// Export singleton instance
export const templateRegistry = new TemplateRegistry();