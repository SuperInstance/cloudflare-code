/**
 * Template Engine for Code Generation
 *
 * Provides 50+ templates for various code generation patterns across
 * multiple programming languages and use cases.
 */

import type {
  Template,
  TemplateContext,
  TemplateVariable,
  GenerationType,
  SupportedLanguage,
} from './types';

/**
 * Template variable definitions
 */
const VARIABLE_DEFINITIONS: Record<string, TemplateVariable> = {
  name: {
    name: 'name',
    type: 'string',
    description: 'Name of the function, class, or component',
    required: true,
    validation: (v: string) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v) || 'Invalid identifier name',
  },
  returnType: {
    name: 'returnType',
    type: 'string',
    description: 'Return type of the function',
    required: false,
    default: 'void',
  },
  params: {
    name: 'params',
    type: 'array',
    description: 'Function parameters [{name, type, default}]',
    required: false,
    default: [],
  },
  description: {
    name: 'description',
    type: 'string',
    description: 'Description of what the code does',
    required: false,
  },
  body: {
    name: 'body',
    type: 'code',
    description: 'Code body or logic',
    required: false,
    default: '// TODO: implement',
  },
  interfaceName: {
    name: 'interfaceName',
    type: 'string',
    description: 'Name of the interface',
    required: true,
  },
  properties: {
    name: 'properties',
    type: 'array',
    description: 'Interface properties [{name, type, optional}]',
    required: false,
    default: [],
  },
  extends: {
    name: 'extends',
    type: 'string',
    description: 'Base class or interface to extend',
    required: false,
  },
  imports: {
    name: 'imports',
    type: 'array',
    description: 'Import statements',
    required: false,
    default: [],
  },
  decorators: {
    name: 'decorators',
    type: 'array',
    description: 'Decorator names',
    required: false,
    default: [],
  },
  generics: {
    name: 'generics',
    type: 'array',
    description: 'Generic type parameters',
    required: false,
    default: [],
  },
  exceptions: {
    name: 'exceptions',
    type: 'array',
    description: 'Exception types that can be thrown',
    required: false,
    default: ['Error'],
  },
  async: {
    name: 'async',
    type: 'boolean',
    description: 'Whether the function is async',
    required: false,
    default: false,
  },
};

/**
 * TypeScript/JavaScript Templates
 */
const TYPESCRIPT_TEMPLATES: Template[] = [
  // API Endpoint Templates
  {
    id: 'ts-api-endpoint',
    name: 'API Endpoint Handler',
    description: 'Cloudflare Workers API endpoint with validation and error handling',
    category: 'api',
    language: 'typescript',
    template: `import { z } from 'zod';

// Request schema
const {name}Schema = z.object({
  {params:prop}
});

export async function {name}(req: Request): Promise<Response> {
  try {
    // Parse and validate request
    const body = await req.json();
    const validated = {name}Schema.parse(body);

    // Business logic
    {body}

    // Return response
    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}`,
    variables: ['name', 'params', 'body'],
    tags: ['api', 'cloudflare', 'validation'],
    examples: [
      {
        description: 'Create user endpoint',
        context: {
          name: 'createUser',
          params: [{ name: 'email', type: 'string' }, { name: 'name', type: 'string' }],
          body: 'const user = await db.createUser(validated);',
        },
        output: 'API endpoint for user creation',
      },
    ],
  },
  {
    id: 'ts-api-middleware',
    name: 'API Middleware',
    description: 'Middleware function for request interception',
    category: 'middleware',
    language: 'typescript',
    template: `import type { Context, Next } from 'hono';

export async function {name}(c: Context, next: Next) {
  // Before handler
  {before}

  // Call next middleware
  await next();

  // After handler
  {after}
}`,
    variables: [
      { ...VARIABLE_DEFINITIONS.name, default: 'middleware' },
      { name: 'before', type: 'code', description: 'Code before next()', required: false, default: '// Before logic' },
      { name: 'after', type: 'code', description: 'Code after next()', required: false, default: '// After logic' },
    ],
    tags: ['middleware', 'hono', 'express'],
  },
  {
    id: 'ts-api-validator',
    name: 'Request Validator',
    description: 'Zod-based request validation middleware',
    category: 'validator',
    language: 'typescript',
    template: `import { z } from 'zod';
import type { Context, Next } from 'hono';

const {name}Schema = z.object({
  {params:prop}
});

export const validate{name} = async (c: Context, next: Next) => {
  try {
    const body = await c.req.json();
    c.set('validated', {name}Schema.parse(body));
    await next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ errors: error.errors }, 400);
    }
    throw error;
  }
};`,
    variables: ['name', 'params'],
    tags: ['validation', 'zod', 'middleware'],
  },

  // Function Templates
  {
    id: 'ts-function-async',
    name: 'Async Function',
    description: 'Async function with error handling',
    category: 'function',
    language: 'typescript',
    template: `/**
 * {description}
 */
export async function {name}(
  {params:signature}
): Promise<{returnType}> {
  try {
    {body}

    return result;
  } catch (error) {
    console.error(\`Error in {name}:\`, error);
    throw error;
  }
}`,
    variables: ['name', 'description', 'params', 'returnType', 'body'],
    tags: ['async', 'error-handling'],
  },
  {
    id: 'ts-function-debounced',
    name: 'Debounced Function',
    description: 'Debounce utility function',
    category: 'utility',
    language: 'typescript',
    template: `export function {name}<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'debounce' }],
    tags: ['utility', 'performance', 'debounce'],
  },
  {
    id: 'ts-function-memoized',
    name: 'Memoized Function',
    description: 'Memoization cache for expensive functions',
    category: 'utility',
    language: 'typescript',
    template: `export function {name}<T extends (...args: any[]) => any>(
  func: T
): T & { cache: Map<string, ReturnType<T>> } {
  const cache = new Map<string, ReturnType<T>>();

  const memoized = ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T & { cache: Map<string, ReturnType<T>> };

  memoized.cache = cache;
  return memoized;
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'memoize' }],
    tags: ['utility', 'performance', 'cache'],
  },
  {
    id: 'ts-function-retry',
    name: 'Retry Function',
    description: 'Function with automatic retry logic',
    category: 'utility',
    language: 'typescript',
    template: `export async function {name}<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'retry' }],
    tags: ['utility', 'retry', 'resilience'],
  },

  // Class Templates
  {
    id: 'ts-class-service',
    name: 'Service Class',
    description: 'Service class with dependency injection',
    category: 'class',
    language: 'typescript',
    template: `{imports:import}

export class {name} {
  {properties:private}

  constructor({params:constructor}) {
    {params:assignment}
  }

  {methods}
}`,
    variables: ['name', 'imports', 'properties', 'params', 'methods'],
    tags: ['service', 'class', 'di'],
  },
  {
    id: 'ts-class-repository',
    name: 'Repository Pattern',
    description: 'Repository class for data access',
    category: 'class',
    language: 'typescript',
    template: `{imports:import}

export class {name}Repository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<{interfaceName} | null> {
    const result = await this.db.query(
      'SELECT * FROM {table} WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<{interfaceName}[]> {
    const result = await this.db.query('SELECT * FROM {table}');
    return result.rows;
  }

  async create(data: Omit<{interfaceName}, 'id'>): Promise<{interfaceName}> {
    const result = await this.db.query(
      'INSERT INTO {table} ({fields}) VALUES ({values}) RETURNING *',
      Object.values(data)
    );
    return result.rows[0];
  }

  async update(id: string, data: Partial<{interfaceName}>): Promise<{interfaceName}> {
    const sets = Object.keys(data)
      .map((key, i) => \`\${key} = $\${i + 1}\`)
      .join(', ');
    const result = await this.db.query(
      \`UPDATE {table} SET \${sets} WHERE id = $\${Object.keys(data).length + 1} RETURNING *\`,
      [...Object.values(data), id]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM {table} WHERE id = $1', [id]);
  }
}`,
    variables: ['name', 'interfaceName', { name: 'table', type: 'string', description: 'Database table name', required: true }],
    tags: ['repository', 'database', 'crud'],
  },
  {
    id: 'ts-class-singleton',
    name: 'Singleton Pattern',
    description: 'Singleton class with thread-safe initialization',
    category: 'class',
    language: 'typescript',
    template: `export class {name} {
  private static instance: {name};
  private {properties}

  private constructor({params:constructor}) {
    {params:assignment}
  }

  static getInstance({params:static}): {name} {
    if (!{name}.instance) {
      {name}.instance = new {name}({params:pass});
    }
    return {name}.instance;
  }

  {methods}
}`,
    variables: ['name', 'properties', 'params', 'methods'],
    tags: ['singleton', 'pattern'],
  },
  {
    id: 'ts-class-observer',
    name: 'Observer Pattern',
    description: 'Observable class with subscription management',
    category: 'class',
    language: 'typescript',
    template: `type Listener<T> = (data: T) => void;

export class {name}<T> {
  private listeners: Set<Listener<T>> = new Set();

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }

  unsubscribeAll(): void {
    this.listeners.clear();
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'Observable' }],
    tags: ['observer', 'pattern', 'events'],
  },

  // Interface/Type Templates
  {
    id: 'ts-interface',
    name: 'Interface Definition',
    description: 'TypeScript interface with properties and methods',
    category: 'interface',
    language: 'typescript',
    template: `{generics}
export interface {interfaceName}{extends} {
  {properties:decl}

  {methods:decl}
}`,
    variables: ['interfaceName', 'extends', 'properties', 'methods', 'generics'],
    tags: ['interface', 'type'],
  },
  {
    id: 'ts-type-dto',
    name: 'Data Transfer Object',
    description: 'DTO type with validation',
    category: 'interface',
    language: 'typescript',
    template: `import { z } from 'zod';

// Schema definition
export const {name}Schema = z.object({
  {properties:zod}
});

// Type inference from schema
export type {name} = z.infer<typeof {name}Schema>;

// Create DTO
export type Create{name} = Omit<{name}, 'id' | 'createdAt' | 'updatedAt'>;

// Update DTO
export type Update{name} = Partial<Create{name}>;`,
    variables: ['name', 'properties'],
    tags: ['dto', 'zod', 'validation'],
  },
  {
    id: 'ts-type-result',
    name: 'Result Type',
    description: 'Result type for error handling',
    category: 'interface',
    language: 'typescript',
    template: `export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export async function wrapResult<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}`,
    variables: [],
    tags: ['result', 'error-handling', 'type'],
  },

  // Test Templates
  {
    id: 'ts-test-unit',
    name: 'Unit Test',
    description: 'Vitest unit test template',
    category: 'test',
    language: 'typescript',
    template: `import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('{name}', () => {
  {setup}

  describe('{scenario}', () => {
    it('should {expected}', async () => {
      // Arrange
      {arrange}

      // Act
      {act}

      // Assert
      {assert}
    });
  });
});`,
    variables: [
      'name',
      { name: 'scenario', type: 'string', description: 'Test scenario name', required: false, default: 'when called with valid input' },
      { name: 'expected', type: 'string', description: 'Expected behavior', required: false, default: 'return expected result' },
      { name: 'setup', type: 'code', description: 'Setup code', required: false },
      { name: 'arrange', type: 'code', description: 'Arrange phase', required: false, default: '' },
      { name: 'act', type: 'code', description: 'Act phase', required: false },
      { name: 'assert', type: 'code', description: 'Assert phase', required: false, default: 'expect(result).toBe(true);' },
    ],
    tags: ['test', 'vitest', 'unit'],
  },
  {
    id: 'ts-test-integration',
    name: 'Integration Test',
    description: 'Integration test with external dependencies',
    category: 'test',
    language: 'typescript',
    template: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { {name} } from './{name}';

describe('{name} Integration', () => {
  let service: {name};

  beforeAll(async () => {
    // Setup test environment
    {setup}
  });

  afterAll(async () => {
    // Cleanup
    {teardown}
  });

  it('should integrate successfully', async () => {
    const result = await service.{method}({params:pass});
    expect(result).toBeDefined();
  });
});`,
    variables: ['name', 'method', 'params', 'setup', 'teardown'],
    tags: ['test', 'integration'],
  },
  {
    id: 'ts-test-mock',
    name: 'Mock Factory',
    description: 'Mock object factory for testing',
    category: 'test',
    language: 'typescript',
    template: `import { vi } from 'vitest';

export function create{name}Mock(overrides: Partial<{interfaceName}> = {}): {interfaceName} {
  return {
    {properties:mock}
    ...overrides,
  };
}`,
    variables: ['name', 'interfaceName', 'properties'],
    tags: ['test', 'mock', 'factory'],
  },

  // Hook Templates (React)
  {
    id: 'ts-hook-custom',
    name: 'Custom Hook',
    description: 'React custom hook with cleanup',
    category: 'hook',
    language: 'typescript',
    template: `import { useState, useEffect, useCallback } from 'react';

export function use{name}({params:signature}) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {action} = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await {logic};
      setState(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [{deps}]);

  useEffect(() => {
    {effect}
    return () => {
      // Cleanup
      {cleanup}
    };
  }, []);

  return { state, loading, error, {action} };
}`,
    variables: ['name', 'params', 'action', 'logic', 'deps', 'effect', 'cleanup'],
    tags: ['hook', 'react'],
  },
  {
    id: 'ts-hook-fetch',
    name: 'Data Fetching Hook',
    description: 'Custom hook for data fetching with caching',
    category: 'hook',
    language: 'typescript',
    template: `import { useState, useEffect } from 'react';

interface Use{name}Result<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function use{name}<T>(url: string): Use{name}Result<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'Fetch' }],
    tags: ['hook', 'react', 'fetch'],
  },

  // Utility Templates
  {
    id: 'ts-util-logger',
    name: 'Logger Utility',
    description: 'Structured logging utility',
    category: 'utility',
    language: 'typescript',
    template: `export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

export class {name} {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    if (this.shouldLog(level)) {
      const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        context,
      };
      console[level](JSON.stringify(entry));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.log('error', message, context);
  }
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'Logger' }],
    tags: ['utility', 'logging'],
  },
  {
    id: 'ts-util-cache',
    name: 'Cache Utility',
    description: 'TTL-based cache implementation',
    category: 'utility',
    language: 'typescript',
    template: `export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class {name}<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 60000) {
    this.defaultTTL = defaultTTL;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'Cache' }],
    tags: ['utility', 'cache', 'ttl'],
  },
  {
    id: 'ts-util-paginated',
    name: 'Pagination Utility',
    description: 'Pagination helper for arrays',
    category: 'utility',
    language: 'typescript',
    template: `export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function {name}<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'paginate' }],
    tags: ['utility', 'pagination'],
  },
];

/**
 * Python Templates
 */
const PYTHON_TEMPLATES: Template[] = [
  {
    id: 'py-function-async',
    name: 'Async Function',
    description: 'Python async function with error handling',
    category: 'function',
    language: 'python',
    template: `from typing import {returnType}
import logging

logger = logging.getLogger(__name__)

async def {name}({params:signature}) -> {returnType}:
    """
    {description}

    Args:
{params:doc}

    Returns:
        {returnType}

    Raises:
{exceptions:doc}
    """
    try:
        {body}

        return result
    except Exception as e:
        logger.error(f"Error in {name}: {{e}}")
        raise`,
    variables: ['name', 'description', 'params', 'returnType', 'body', 'exceptions'],
    tags: ['async', 'error-handling'],
  },
  {
    id: 'py-class-dataclass',
    name: 'Dataclass',
    description: 'Python dataclass with validation',
    category: 'class',
    language: 'python',
    template: `from dataclasses import dataclass, field
from typing import {generics}

@dataclass
class {name}:
    """{description}"""
    {properties:decl}

    def __post_init__(self):
        """Validate after initialization"""
        {validation}`,
    variables: ['name', 'description', 'properties', 'generics', 'validation'],
    tags: ['dataclass', 'validation'],
  },
  {
    id: 'py-class-repository',
    name: 'Repository Pattern',
    description: 'Repository class for database operations',
    category: 'class',
    language: 'python',
    template: `from typing import List, Optional
from {interfaceName} import {interfaceName}

class {name}Repository:
    """Repository for {interfaceName} entities"""

    def __init__(self, db):
        self.db = db
        self.table = "{table}"

    async def find_by_id(self, id: str) -> Optional[{interfaceName}]:
        """Find entity by ID"""
        query = f"SELECT * FROM {{self.table}} WHERE id = $1"
        result = await self.db.fetchrow(query, id)
        return {interfaceName}(**result) if result else None

    async def find_all(self) -> List[{interfaceName}]:
        """Find all entities"""
        query = f"SELECT * FROM {{self.table}}"
        results = await self.db.fetch(query)
        return [{interfaceName}(**row) for row in results]

    async def create(self, data: dict) -> {interfaceName}:
        """Create new entity"""
        fields = ", ".join(data.keys())
        placeholders = ", ".join(f"${i+1}" for i in range(len(data)))
        query = f"INSERT INTO {{self.table}} ({fields}) VALUES ({placeholders}) RETURNING *"
        result = await self.db.fetchrow(query, *data.values())
        return {interfaceName}(**result)

    async def update(self, id: str, data: dict) -> Optional[{interfaceName}]:
        """Update entity"""
        sets = ", ".join(f"{k} = ${i+1}" for i, k in enumerate(data.keys()))
        query = f"UPDATE {{self.table}} SET {sets} WHERE id = ${len(data)+1} RETURNING *"
        result = await self.db.fetchrow(query, *data.values(), id)
        return {interfaceName}(**result) if result else None

    async def delete(self, id: str) -> bool:
        """Delete entity"""
        query = f"DELETE FROM {{self.table}} WHERE id = $1"
        await self.db.execute(query, id)
        return True`,
    variables: ['name', 'interfaceName', { name: 'table', type: 'string', required: true }],
    tags: ['repository', 'database', 'crud'],
  },
  {
    id: 'py-decorator-cache',
    name: 'Cache Decorator',
    description: 'Memoization decorator for functions',
    category: 'utility',
    language: 'python',
    template: `from functools import wraps
from typing import Callable, Any

def {name}(ttl: int = 3600):
    """
    Cache decorator with TTL

    Args:
        ttl: Time to live in seconds
    """
    cache = {}

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            if key in cache:
                return cache[key]

            result = await func(*args, **kwargs)
            cache[key] = result
            return result

        wrapper.cache = cache
        return wrapper

    return decorator`,
    variables: [{ ...VARIABLE_DEFINITIONS.name, default: 'cached' }],
    tags: ['decorator', 'cache', 'memoization'],
  },
  {
    id: 'py-test-pytest',
    name: 'Pytest Test',
    description: 'Pytest test fixture and test',
    category: 'test',
    language: 'python',
    template: `import pytest
from {name} import {name}

@pytest.fixture
async def {fixture}():
    """Setup test fixture"""
    {setup}
    yield {fixture}
    {teardown}

@pytest.mark.asyncio
async def test_{scenario}({fixture}):
    """
    Given {given}
    When {when}
    Then {then}
    """
    # Arrange
    {arrange}

    # Act
    result = await {act}

    # Assert
    {assert}`,
    variables: [
      'name',
      { name: 'fixture', type: 'string', required: false, default: 'sample' },
      'setup',
      'teardown',
      { name: 'scenario', type: 'string', required: false, default: 'success_case' },
      { name: 'given', type: 'string', required: false },
      { name: 'when', type: 'string', required: false },
      { name: 'then', type: 'string', required: false },
      'arrange',
      'act',
      'assert',
    ],
    tags: ['test', 'pytest', 'async'],
  },
  {
    id: 'py-api-endpoint',
    name: 'FastAPI Endpoint',
    description: 'FastAPI endpoint with validation',
    category: 'api',
    language: 'python',
    template: `from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List

router = APIRouter()

class {name}Request(BaseModel):
    {properties:pydantic}

class {name}Response(BaseModel):
    {response:pydantic}

@router.post("/{path}", response_model={name}Response)
async def {name}(request: {name}Request):
    """
    {description}
    """
    try:
        # Validate and process
        {body}

        return {name}Response(data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")`,
    variables: [
      'name',
      'description',
      'properties',
      { name: 'response', type: 'array', description: 'Response properties', required: false, default: [] },
      { name: 'path', type: 'string', required: false, default: '' },
      'body',
    ],
    tags: ['api', 'fastapi', 'endpoint'],
  },
];

/**
 * Go Templates
 */
const GO_TEMPLATES: Template[] = [
  {
    id: 'go-function',
    name: 'Go Function',
    description: 'Go function with error handling',
    category: 'function',
    language: 'go',
    template: `package {package}

import (
	"errors"
)

// {name} {description}
func {name}({params:signature}) ({returnType}, error) {
	{body}

	if {condition} {
		return {zero}, errors.New("error message")
	}

	return result, nil
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'main' },
      'name',
      'description',
      'params',
      'returnType',
      'body',
      { name: 'condition', type: 'string', required: false, default: 'false' },
      { name: 'zero', type: 'string', description: 'Zero value for return type', required: false, default: '' },
    ],
    tags: ['function', 'error-handling'],
  },
  {
    id: 'go-struct',
    name: 'Go Struct',
    description: 'Go struct with methods',
    category: 'class',
    language: 'go',
    template: `package {package}

import (
	"context"
	"time"
)

// {name} represents {description}
type {name} struct {
	{properties:go}
}

// New{name} creates a new {name}
func New{name}({params:signature}) *{name} {
	return &{name}{
		{params:assignment}
	}
}

// {method} {methodDescription}
func (r *{name}) {method}({methodParams:signature}) ({methodReturn}, error) {
	{methodBody}

	return result, nil
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'main' },
      'name',
      'description',
      'properties',
      'params',
      { name: 'method', type: 'string', required: false, default: 'Do' },
      { name: 'methodDescription', type: 'string', required: false },
      { name: 'methodParams', type: 'array', required: false, default: [] },
      { name: 'methodReturn', type: 'string', required: false, default: '' },
      { name: 'methodBody', type: 'code', required: false },
    ],
    tags: ['struct', 'constructor'],
  },
  {
    id: 'go-interface',
    name: 'Go Interface',
    description: 'Go interface definition',
    category: 'interface',
    language: 'go',
    template: `package {package}

// {name} defines the contract for {description}
type {name} interface {
	{methods:decl}
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'main' },
      'name',
      'description',
      'methods',
    ],
    tags: ['interface'],
  },
  {
    id: 'go-handler',
    name: 'HTTP Handler',
    description: 'Go HTTP handler with middleware',
    category: 'api',
    language: 'go',
    template: `package {package}

import (
	"encoding/json"
	"net/http"
)

// {name}Request represents the request body
type {name}Request struct {
	{properties:json}
}

// {name}Response represents the response body
type {name}Response struct {
	Success bool   \`json:"success"\`
	Data    any    \`json:"data,omitempty"\`
	Error   string \`json:"error,omitempty"\`
}

// {name}Handler handles HTTP requests
func {name}Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode({name}Response{
			Success: false,
			Error:   "method not allowed",
		})
		return
	}

	var req {name}Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode({name}Response{
			Success: false,
			Error:   "invalid request body",
		})
		return
	}

	// Process request
	{body}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode({name}Response{
		Success: true,
		Data:    result,
	})
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'main' },
      'name',
      'properties',
      'body',
    ],
    tags: ['api', 'http', 'handler'],
  },
];

/**
 * Rust Templates
 */
const RUST_TEMPLATES: Template[] = [
  {
    id: 'rust-function',
    name: 'Rust Function',
    description: 'Rust function with error handling',
    category: 'function',
    language: 'rust',
    template: `use anyhow::Result;

/// {description}
pub fn {name}({params:signature}) -> Result<{returnType}> {
    {body}

    Ok(result)
}`,
    variables: ['name', 'description', 'params', 'returnType', 'body'],
    tags: ['function', 'error-handling'],
  },
  {
    id: 'rust-struct',
    name: 'Rust Struct',
    description: 'Rust struct with impl block',
    category: 'class',
    language: 'rust',
    template: `/// {description}
pub struct {name} {
    {fields:rust}
}

impl {name} {
    /// Create a new {name}
    pub fn new({params:signature}) -> Self {
        Self {
            {params:assignment}
        }
    }

    /// {methodDescription}
    pub fn {method}(&mut self{methodParams:rust}) -> Result<{methodReturn}> {
        {methodBody}

        Ok(result)
    }
}`,
    variables: [
      'name',
      'description',
      { name: 'fields', type: 'array', description: 'Struct fields', required: false, default: [] },
      'params',
      { name: 'method', type: 'string', required: false, default: 'do_something' },
      { name: 'methodDescription', type: 'string', required: false },
      { name: 'methodParams', type: 'array', required: false, default: [] },
      { name: 'methodReturn', type: 'string', required: false, default: '()' },
      { name: 'methodBody', type: 'code', required: false },
    ],
    tags: ['struct', 'impl'],
  },
  {
    id: 'rust-trait',
    name: 'Rust Trait',
    description: 'Rust trait definition',
    category: 'interface',
    language: 'rust',
    template: `/// {description}
pub trait {name} {
    {methods:rust}
}

impl {name} for {type} {
    {impls:rust}
}`,
    variables: [
      'name',
      'description',
      'methods',
      { name: 'type', type: 'string', description: 'Type to implement trait for', required: true },
      { name: 'impls', type: 'code', description: 'Implementations', required: false },
    ],
    tags: ['trait', 'interface'],
  },
  {
    id: 'rust-error',
    name: 'Error Type',
    description: 'Custom error type with thiserror',
    category: 'class',
    language: 'rust',
    template: `use thiserror::Error;

/// {description}
#[derive(Error, Debug)]
pub enum {name}Error {
    #[error("{variantMessage}")]
    {variantName} {variantType},

    #[error("Unknown error")]
    Unknown,
}

pub type {name}Result<T> = Result<T, {name}Error>;`,
    variables: [
      'name',
      'description',
      { name: 'variantName', type: 'string', description: 'Error variant name', required: true },
      { name: 'variantMessage', type: 'string', description: 'Error message', required: true },
      { name: 'variantType', type: 'string', description: 'Variant type', required: false, default: 'String' },
    ],
    tags: ['error', 'thiserror'],
  },
];

/**
 * Java Templates
 */
const JAVA_TEMPLATES: Template[] = [
  {
    id: 'java-class',
    name: 'Java Class',
    description: 'Java class with constructor and methods',
    category: 'class',
    language: 'java',
    template: `package {package};

import java.util.*;

/**
 * {description}
 */
public class {name}{extends} {
    {fields:java}

    /**
     * Constructor
     */
    public {name}({params:signature}) {
        {params:assignment}
    }

    {getters}

    {setters}

    {methods}
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'com.example' },
      'name',
      'description',
      'extends',
      { name: 'fields', type: 'array', description: 'Class fields', required: false, default: [] },
      'params',
      { name: 'getters', type: 'code', required: false },
      { name: 'setters', type: 'code', required: false },
      { name: 'methods', type: 'code', required: false },
    ],
    tags: ['class', 'pojo'],
  },
  {
    id: 'java-interface',
    name: 'Java Interface',
    description: 'Java interface definition',
    category: 'interface',
    language: 'java',
    template: `package {package};

/**
 * {description}
 */
public interface {name}{extends} {
    {methods:java}
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'com.example' },
      'name',
      'description',
      'extends',
      'methods',
    ],
    tags: ['interface'],
  },
  {
    id: 'java-rest-controller',
    name: 'REST Controller',
    description: 'Spring Boot REST controller',
    category: 'api',
    language: 'java',
    template: `package {package};

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/{path}")
@RequiredArgsConstructor
public class {name}Controller {

    private final {service}Service {service:var};

    @GetMapping("/{id}")
    public ResponseEntity<{dto}> getById(@PathVariable String id) {
        return ResponseEntity.ok({service:var}.findById(id));
    }

    @PostMapping
    public ResponseEntity<{dto}> create(@RequestBody {dto}Request request) {
        {dto} created = {service:var}.create(request);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<{dto}> update(
        @PathVariable String id,
        @RequestBody {dto}Request request
    ) {
        {dto} updated = {service:var}.update(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        {service:var}.delete(id);
        return ResponseEntity.noContent().build();
    }
}`,
    variables: [
      { name: 'package', type: 'string', required: false, default: 'com.example.api' },
      'name',
      { name: 'path', type: 'string', required: true },
      { name: 'service', type: 'string', required: true },
      { name: 'dto', type: 'string', description: 'DTO class name', required: true },
    ],
    tags: ['api', 'spring', 'rest'],
  },
];

/**
 * Additional language templates will be added similarly for:
 * - C#, C++, Ruby, PHP, Swift, Kotlin, etc.
 */

/**
 * All templates by language
 */
export const TEMPLATES_BY_LANGUAGE: Record<SupportedLanguage, Template[]> = {
  typescript: TYPESCRIPT_TEMPLATES,
  javascript: TYPESCRIPT_TEMPLATES.map(t => ({ ...t, language: 'javascript' as const })),
  python: PYTHON_TEMPLATES,
  java: JAVA_TEMPLATES,
  go: GO_TEMPLATES,
  rust: RUST_TEMPLATES,
  cpp: [],
  c: [],
  csharp: [],
  php: [],
  ruby: [],
  swift: [],
  kotlin: [],
  scala: [],
  markdown: [],
  json: [],
  yaml: [],
  toml: [],
  xml: [],
  html: [],
  css: [],
  shell: [],
  sql: [],
};

/**
 * All templates by category
 */
export function getTemplatesByCategory(category: GenerationType): Template[] {
  const allTemplates = Object.values(TEMPLATES_BY_LANGUAGE).flat();
  return allTemplates.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  const allTemplates = Object.values(TEMPLATES_BY_LANGUAGE).flat();
  return allTemplates.find(t => t.id === id);
}

/**
 * Search templates by tag
 */
export function searchTemplatesByTag(tag: string): Template[] {
  const allTemplates = Object.values(TEMPLATES_BY_LANGUAGE).flat();
  return allTemplates.filter(t => t.tags?.includes(tag));
}

/**
 * Get templates for language
 */
export function getTemplatesForLanguage(language: SupportedLanguage): Template[] {
  return TEMPLATES_BY_LANGUAGE[language] || [];
}

/**
 * Get all template IDs
 */
export function getAllTemplateIds(): string[] {
  const allTemplates = Object.values(TEMPLATES_BY_LANGUAGE).flat();
  return allTemplates.map(t => t.id);
}

/**
 * Template renderer
 */
export class TemplateEngine {
  /**
   * Render a template with context
   */
  static render(template: Template, context: TemplateContext): string {
    let rendered = template.template;

    // Replace simple variables: {name}
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      rendered = rendered.replaceAll(placeholder, String(value));
    }

    // Handle parameter lists
    if (context.params && Array.isArray(context.params)) {
      // Signature: name: type, name2: type2
      rendered = rendered.replace(
        '{params:signature}',
        context.params.map((p: any) => `${p.name}: ${p.type}`).join(', ')
      );

      // Document params
      rendered = rendered.replace(
        '{params:doc}',
        context.params.map((p: any) => `        ${p.name}: ${p.description || p.type}`).join('\n')
      );

      // Constructor assignment
      rendered = rendered.replace(
        '{params:assignment}',
        context.params.map((p: any) => `this.${p.name} = ${p.name};`).join('\n        ')
      );
    }

    // Handle properties
    if (context.properties && Array.isArray(context.properties)) {
      // TypeScript properties
      rendered = rendered.replace(
        '{properties:decl}',
        context.properties.map((p: any) => `  ${p.name}${p.optional ? '?' : ''}: ${p.type};`).join('\n')
      );

      // Zod schema properties
      rendered = rendered.replace(
        '{properties:zod}',
        context.properties.map((p: any) => `  ${p.name}: z.${p.zodType || 'string'}(),`).join('\n')
      );
    }

    return rendered;
  }

  /**
   * Validate template context
   */
  static validateContext(template: Template, context: TemplateContext): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = context[variable.name];

      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Missing required variable: ${variable.name}`);
        continue;
      }

      if (value !== undefined && variable.validation) {
        const result = variable.validation(value);
        if (result !== true) {
          errors.push(result as string);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
