/**
 * ClaudeFlare Application Factory Core - Ultra-Optimized
 * Minimalist AI-powered application generator for Cloudflare
 */

import { Hono } from 'hono';
import type { ProjectType } from '@claudeflare/core-interfaces';
import { utils } from '@claudeflare/core-interfaces';

interface ProjectSpec {
  name: string;
  description: string;
  type: ProjectType;
  features?: string[];
  requirements?: Requirement[];
}

interface Requirement {
  type: 'technical' | 'business' | 'security' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface Service {
  name: string;
  type: 'worker' | 'page' | 'database' | 'storage';
  purpose: string;
  tech: string[];
}

// Core AI patterns (frozen for memory efficiency)
const patterns = Object.freeze({
  angular: /angular|ionic/i,
  react: /react|next|nuxt/i,
  vue: /vue|nuxt/i,
  node: /node|express|nest/i,
  python: /python|django|fastapi/i,
  rust: /rust|actix|axum/i,
  static: /static|jamstack|hugo/i,
  api: /api|rest|graphql/i,
  realtime: /websocket|socket|realtime/i,
  ml: /ml|ai|tensorflow|pytorch/i
});

// Template registry (minimal memory footprint)
const templates = Object.freeze({
  'default-saas': { name: 'Default SaaS', category: 'saas' },
  'static-site': { name: 'Static Site', category: 'frontend' },
  'api-service': { name: 'API Service', category: 'api' },
  'fullstack-app': { name: 'Full Stack App', category: 'fullstack' }
});

// Cloudflare pricing (frozen constants)
const pricing = Object.freeze({
  workers: { free: 100000, paid: 0.0000005 },
  storage: { free: 10, paid: 0.015 },
  bandwidth: { free: 100, paid: 0.1 }
});

// Synchronous requirement analyzer (no async overhead)
export const analyzeRequirements = (desc: string, context?: string): Requirement[] => {
  const requirements: Requirement[] = [];
  const text = `${desc} ${context || ''}`.toLowerCase();

  // Optimized pattern matching (reduced allocations)
  for (const [tech, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      requirements.push({ type: 'technical', priority: 'high', description: `Needs ${tech}` });
    }
  }

  // Inline feature extraction (eliminates array allocation)
  if (/\b(user|auth)\b/i.test(text)) requirements.push({ type: 'business', priority: 'medium', description: 'User authentication' });
  if (/\b(admin|dashboard)\b/i.test(text)) requirements.push({ type: 'business', priority: 'medium', description: 'Admin dashboard' });
  if (/\b(payment|billing)\b/i.test(text)) requirements.push({ type: 'business', priority: 'high', description: 'Payment integration' });
  if (/\b(real-time|live|websocket)\b/i.test(text)) requirements.push({ type: 'technical', priority: 'medium', description: 'Real-time functionality' });

  return requirements;
};

// Synchronous architecture engine (no async overhead)
export const recommendArchitecture = (spec: ProjectSpec) => {
  // Frozen service templates (no allocation on hot path)
  const typeServices = Object.freeze({
    saas: [
      Object.freeze({ name: 'auth', type: 'worker', purpose: 'Authentication', tech: ['Workers', 'D1'] }),
      Object.freeze({ name: 'api', type: 'worker', purpose: 'API endpoints', tech: ['Hono'] }),
      Object.freeze({ name: 'frontend', type: 'page', purpose: 'UI', tech: ['React'] })
    ],
    fullstack: [
      Object.freeze({ name: 'api', type: 'worker', purpose: 'API', tech: ['Hono'] }),
      Object.freeze({ name: 'frontend', type: 'page', purpose: 'UI', tech: ['React'] })
    ],
    api: [Object.freeze({ name: 'api', type: 'worker', purpose: 'API', tech: ['Hono', 'Zod'] })],
    frontend: [Object.freeze({ name: 'frontend', type: 'page', purpose: 'Static site', tech: ['Pages'] })],
    backend: [Object.freeze({ name: 'worker', type: 'worker', purpose: 'Backend', tech: ['Workers'] })]
  }) as Record<string, Service[]>;

  const services = typeServices[spec.type] || [];
  const cost = services.length * 5;

  return Object.freeze({
    services,
    technologies: services.flatMap(s => s.tech),
    cost: { monthly: cost, freeTier: cost < 10 },
    timeline: `${Math.ceil(services.length / 2)} weeks`
  });
};

// Synchronous project generator (no async overhead)
export const generateProject = (spec: ProjectSpec) => {
  const architecture = recommendArchitecture(spec);
  const template = templates[Object.keys(templates).find(k => templates[k as keyof typeof templates].category === spec.type) || 'default-saas'];

  return {
    success: true,
    files: {
      'package.json': JSON.stringify({
        name: spec.name,
        version: '1.0.0',
        scripts: { dev: 'wrangler dev', deploy: 'wrangler deploy' }
      }, null, 2),
      'wrangler.toml': `name = "${spec.name}"\ncompatibility_date = "2024-01-01"`,
      'src/index.ts': `import { Hono } from 'hono';\nconst app = new Hono();\napp.get('/', (c) => c.json({ name: '${spec.name}' }));\nexport default app;`
    },
    template: template.name,
    architecture
  };
};

// Ultra-streamlined cost calculator
export const calculateCosts = (services: Service[], traffic = { requests: 1000, storage: 1 }) => {
  const workerCost = Math.max(0, (traffic.requests - pricing.workers.free) * pricing.workers.paid);
  const storageCost = Math.max(0, (traffic.storage - pricing.storage.free) * pricing.storage.paid);
  const total = workerCost + storageCost;
  return { monthly: total, freeTier: total === 0 };
};

// Optimized Hono app (synchronous handlers where possible)
export const factoryApp = new Hono()
  .post('/analyze', (c) => {
    try {
      const { description, context } = c.req.json();
      return c.json({ success: true, analysis: analyzeRequirements(description, context) });
    } catch {
      return c.json({ success: false, error: 'Invalid input' }, 400);
    }
  })
  .post('/generate', (c) => {
    try {
      const spec = c.req.json();
      return c.json(generateProject(spec));
    } catch {
      return c.json({ success: false, error: 'Generation failed' }, 400);
    }
  })
  .get('/templates', (c) => c.json({
    templates: Object.entries(templates).map(([k, v]) => ({ id: k, ...v }))
  }))
  .get('/health', (c) => c.json({
    status: 'ok',
    version: '1.0.0',
    endpoints: 3
  }));

// Exports
export { factoryApp };
export type { ProjectSpec, Requirement, Service };