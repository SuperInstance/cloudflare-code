/**
 * API Agent - Generates RESTful APIs, OpenAPI specs, and WebSocket handlers
 *
 * Features:
 * - RESTful API generation with proper HTTP methods
 * - OpenAPI 3.0/3.1 specification generation
 * - Request/response validation with Zod
 * - Authentication middleware (JWT, API Key, Basic Auth, OAuth2)
 * - WebSocket handlers for real-time communication
 * - Integration with Cloudflare Workers and Hono
 * - Progress reporting to coordinator
 * - File locking for parallel coordination
 */

import type { AgentState, ProjectFile } from '../types';
import type { Bindings } from '../index';

// API Agent Configuration
interface APIAgentConfig {
  sessionId: string;
  agentId: string;
  provider: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
  stateManager: any; // ProjectStateManager
  coordinatorUrl: string;
}

// Field type definitions
type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'json' | 'file';

// Field definition
interface APIField {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  description?: string;
  example?: any;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

// Resource definition for CRUD operations
interface APIResource {
  name: string;
  tableName: string;
  fields: APIField[];
  operations: ('list' | 'get' | 'create' | 'update' | 'delete')[];
  description?: string;
  tags?: string[];
  pagination?: boolean;
  search?: boolean;
  filtering?: boolean;
  sorting?: boolean;
}

// Custom API endpoint definition
interface APIEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  tags?: string[];
  authentication?: boolean;
  parameters?: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    type: FieldType;
    required: boolean;
    description?: string;
    example?: any;
    schema?: any;
  }>;
  requestBody?: {
    content: {
      'application/json': {
        schema: any;
      };
    };
    required?: boolean;
  };
  responses?: Record<string, {
    description?: string;
    content?: {
      'application/json': {
        schema: any;
      };
    };
  }>;
}

// Authentication configuration
interface AuthConfig {
  type: 'jwt' | 'api-key' | 'basic' | 'oauth2' | 'custom';
  jwt?: {
    secret: string;
    algorithm?: string;
    expiresIn?: number;
    issuer?: string;
    audience?: string;
  };
  apiKey?: {
    headerName?: string;
    paramName?: string;
    location?: 'header' | 'query' | 'cookie';
  };
  basic?: {
    usernameField?: string;
    passwordField?: string;
  };
  oauth2?: {
    providers?: {
      google?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
      };
      github?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
      };
    };
  };
}

// WebSocket configuration
interface WebSocketConfig {
  path: string;
  events: Array<{
    name: string;
    direction: 'client-to-server' | 'server-to-client' | 'bidirectional';
    schema?: any;
    description?: string;
  }>;
  authentication?: boolean;
  heartbeat?: boolean;
  heartbeatInterval?: number;
}

// API generation request
interface APIGenerationRequest {
  type: 'rest' | 'websocket' | 'openapi';
  resources?: APIResource[];
  endpoints?: APIEndpoint[];
  websockets?: WebSocketConfig[];
  auth?: AuthConfig;
  outputDirectory: string;
  generateTests: boolean;
  generateDocs: boolean;
  openAPIVersion: '3.0' | '3.1';
  importFrom?: string; // OpenAPI file to import from
}

// Response types
interface GenerationResult {
  success: boolean;
  files: ProjectFile[];
  errors?: string[];
  metadata: {
    generatedAt: number;
    provider: string;
    tokens?: number;
  };
}

class APIAgent {
  private config: APIAgentConfig;
  private state: AgentState;
  private lockedFiles: Set<string>;

  constructor(config: APIAgentConfig) {
    this.config = config;
    this.state = {
      agentId: config.agentId,
      sessionId: config.sessionId,
      agentType: 'api',
      status: 'idle',
      progress: 0,
      currentTask: undefined,
    };
    this.lockedFiles = new Set();
  }

  /**
   * Main entry point for API generation tasks
   */
  async generate(request: APIGenerationRequest): Promise<GenerationResult> {
    await this.updateState('working', 0, 'Starting API generation');

    try {
      if (request.type === 'rest') {
        return await this.generateRESTAPI(request);
      } else if (request.type === 'websocket') {
        return await this.generateWebSocketAPI(request);
      } else if (request.type === 'openapi') {
        return await this.generateFromOpenAPI(request);
      }
    } catch (error) {
      await this.updateState('error', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      await this.releaseAllLocks();
    }
  }

  /**
   * Generate REST API
   */
  async generateRESTAPI(request: APIGenerationRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Generating REST API');

    const files: ProjectFile[] = [];

    // Generate OpenAPI specification
    const openapiFile = await this.generateOpenAPISpec(request);
    files.push(openapiFile);

    // Generate validation schemas
    const validationFiles = await this.generateValidationSchemas(request);
    files.push(...validationFiles);

    // Generate authentication middleware
    const authFiles = await this.generateAuthMiddleware(request);
    files.push(...authFiles);

    // Generate DTOs
    const dtoFiles = await this.generateDTOs(request);
    files.push(...dtoFiles);

    // Generate endpoints
    const routeFiles = await this.generateEndpoints(request);
    files.push(...routeFiles);

    // Generate handlers
    const handlerFiles = await this.generateHandlers(request);
    files.push(...handlerFiles);

    // Generate error handlers
    const errorFiles = await this.generateErrorHandlers();
    files.push(...errorFiles);

    // Generate main router
    const routerFile = await this.generateMainRouter(request);
    files.push(routerFile);

    // Generate tests if requested
    if (request.generateTests) {
      const testFiles = await this.generateAPITests(request);
      files.push(...testFiles);
    }

    // Generate documentation
    if (request.generateDocs) {
      const docFile = await this.generateAPIDocs(request);
      files.push(docFile);
    }

    await this.updateState('completed', 100, 'REST API generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate WebSocket API
   */
  async generateWebSocketAPI(request: APIGenerationRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Generating WebSocket API');

    const files: ProjectFile[] = [];

    // Generate WebSocket manager
    const managerFile = await this.generateWebSocketManager(request);
    files.push(managerFile);

    // Generate specific WebSocket handlers
    const handlerFiles = await this.generateWebSocketHandlers(request);
    files.push(...handlerFiles);

    // Generate authentication middleware
    if (request.auth) {
      const authFiles = await this.generateWebSocketAuth(request);
      files.push(...authFiles);
    }

    await this.updateState('completed', 100, 'WebSocket API generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate from existing OpenAPI specification
   */
  async generateFromOpenAPI(request: APIGenerationRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Importing OpenAPI specification');

    if (!request.importFrom) {
      throw new Error('OpenAPI import path is required');
    }

    const files: ProjectFile[] = [];

    // Parse OpenAPI specification
    const openapiContent = await this.parseOpenAPIFile(request.importFrom);

    // Generate types
    const typeFiles = await this.generateOpenAPITypes(openapiContent);
    files.push(...typeFiles);

    // Generate validation schemas
    const validationFiles = await this.generateOpenAPIValidation(openapiContent);
    files.push(...validationFiles);

    // Generate route handlers
    const routeFiles = await this.generateOpenAPIRoutes(openapiContent);
    files.push(...routeFiles);

    await this.updateState('completed', 100, 'OpenAPI import complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate OpenAPI specification
   */
  private async generateOpenAPISpec(request: APIGenerationRequest): Promise<ProjectFile> {
    const spec = this.generateOpenAPIDefinition(request);

    return {
      path: `${request.outputDirectory}/openapi.yaml`,
      content: spec,
      language: 'json',
      hash: this.generateHash(spec),
    };
  }

  /**
   * Generate OpenAPI definition
   */
  private generateOpenAPIDefinition(request: APIGenerationRequest): string {
    const version = request.openAPIVersion === '3.1' ? '3.1.0' : '3.0.0';
    const resources = request.resources || [];
    const endpoints = request.endpoints || [];

    const paths: any = {};
    const components: any = {
      schemas: {},
      securitySchemes: {},
    };

    // Generate paths for resources
    resources.forEach(resource => {
      if (resource.operations.includes('list')) {
        paths[`/${resource.name.toLowerCase()}`] = {
          get: {
            summary: `Get all ${resource.name}`,
            tags: [resource.name.toLowerCase()],
            operationId: `get${resource.name}List`,
            responses: {
              '200': {
                description: 'List of resources',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        $ref: `#/components/schemas/${resource.name}`,
                      },
                    },
                  },
                },
              },
            },
          },
        };
      }

      if (resource.operations.includes('get')) {
        paths[`/${resource.name.toLowerCase()}/{id}`] = {
          get: {
            summary: `Get ${resource.name} by ID`,
            tags: [resource.name.toLowerCase()],
            operationId: `get${resource.name}ById`,
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Resource',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${resource.name}`,
                    },
                  },
                },
              },
              '404': {
                description: 'Not found',
              },
            },
          },
        };
      }
    });

    // Add custom endpoints
    endpoints.forEach(endpoint => {
      const path = endpoint.path;
      if (!paths[path]) paths[path] = {};

      paths[path][endpoint.method.toLowerCase()] = {
        summary: endpoint.description,
        tags: endpoint.tags || ['custom'],
        operationId: endpoint.name,
        parameters: endpoint.parameters || [],
        requestBody: endpoint.requestBody,
        responses: endpoint.responses || {
          '200': {
            description: 'Success',
          },
        },
      };
    });

    // Generate schemas for resources
    resources.forEach(resource => {
      components.schemas[resource.name] = {
        type: 'object',
        properties: {},
        required: [],
      };

      resource.fields.forEach(field => {
        const schema: any = { type: field.type };

        if (field.validation) {
          if (field.validation.min !== undefined) schema.minimum = field.validation.min;
          if (field.validation.max !== undefined) schema.maximum = field.validation.max;
          if (field.validation.pattern !== undefined) schema.pattern = field.validation.pattern;
          if (field.validation.enum !== undefined) schema.enum = field.validation.enum;
        }

        components.schemas[resource.name].properties[field.name] = schema;

        if (field.required) {
          components.schemas[resource.name].required!.push(field.name);
        }
      });
    });

    // Generate security schemes
    if (request.auth) {
      components.securitySchemes = this.generateSecuritySchemes(request.auth);
    }

    return `openapi: ${version}
info:
  title: Generated API
  description: API generated by Cocapn
  version: 1.0.0
servers:
  - url: https://api.example.com
    description: Production server
paths:
${this.yamlPaths(paths)}
components:
  ${this.yamlComponents(components)}`;
  }

  /**
   * Generate validation schemas
   */
  private async generateValidationSchemas(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    // Generate common validation types
    const commonSchema: ProjectFile = {
      path: `${request.outputDirectory}/validation.ts`,
      content: this.generateValidationSchemasFile(request),
      language: 'typescript',
      hash: this.generateHash(this.generateValidationSchemasFile(request)),
    };
    files.push(commonSchema);

    return files;
  }

  /**
   * Generate validation schemas file
   */
  private generateValidationSchemasFile(request: APIGenerationRequest): string {
    return `// Validation Schemas
// Generated by Cocapn API Agent

import { z } from 'zod';

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

// Sorting schema
export const SortingSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Filtering schema
export const FilteringSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.boolean().default(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

// Success response schema
export const SuccessResponseSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.boolean().default(true),
    data,
    metadata: z.object({
      timestamp: z.string(),
      requestId: z.string().optional(),
    }),
  }).transform((data) => ({
    ...data,
    metadata: {
      ...data.metadata,
      timestamp: new Date().toISOString(),
    },
  }));`;
  }

  /**
   * Generate DTO files
   */
  private async generateDTOs(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    const resources = request.resources || [];

    resources.forEach(resource => {
      const dtoContent = this.generateDTOFile(resource);

      files.push({
        path: `${request.outputDirectory}/dto/${resource.name.toLowerCase()}.dto.ts`,
        content: dtoContent,
        language: 'typescript',
        hash: this.generateHash(dtoContent),
      });
    });

    return files;
  }

  /**
   * Generate DTO file
   */
  private generateDTOFile(resource: APIResource): string {
    const fields = resource.fields.map(field => {
      let type = this.mapFieldType(field.type);
      if (!field.required) type = `${type} | null`;
      return `  ${field.name}: ${type};`;
    }).join('\n');

    const createFields = resource.fields
      .filter(f => !f.unique)
      .map(field => {
        let type = this.mapFieldType(field.type);
        if (!field.required) type = `${type} | null | undefined`;
        return `  ${field.name}?: ${type};`;
      }).join('\n');

    return `// ${resource.name} DTO
// Generated by Cocapn API Agent

export interface ${resource.name} {
${fields}
}

export interface Create${resource.name} {
${createFields}
}

export interface Update${resource.name} {
${createFields}
}

export interface ${resource.name}List extends Array<${resource.name}> {}`;
  }

  /**
   * Generate authentication middleware
   */
  private async generateAuthMiddleware(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    if (request.auth) {
      switch (request.auth.type) {
        case 'jwt':
          const jwtFile: ProjectFile = {
            path: `${request.outputDirectory}/middleware/jwt-auth.ts`,
            content: this.generateJWTMiddleware(request.auth),
            language: 'typescript',
            hash: this.generateHash(this.generateJWTMiddleware(request.auth)),
          };
          files.push(jwtFile);
          break;

        case 'api-key':
          const apiKeyFile: ProjectFile = {
            path: `${request.outputDirectory}/middleware/api-key-auth.ts`,
            content: this.generateAPIKeyMiddleware(request.auth),
            language: 'typescript',
            hash: this.generateHash(this.generateAPIKeyMiddleware(request.auth)),
          };
          files.push(apiKeyFile);
          break;

        case 'basic':
          const basicFile: ProjectFile = {
            path: `${request.outputDirectory}/middleware/basic-auth.ts`,
            content: this.generateBasicAuthMiddleware(request.auth),
            language: 'typescript',
            hash: this.generateHash(this.generateBasicAuthMiddleware(request.auth)),
          };
          files.push(basicFile);
          break;
      }
    }

    // Generate error handler middleware
    const errorFile: ProjectFile = {
      path: `${request.outputDirectory}/middleware/error-handler.ts`,
      content: this.generateErrorHandler(),
      language: 'typescript',
      hash: this.generateHash(this.generateErrorHandler()),
    };
    files.push(errorFile);

    // Generate custom errors
    const errorsFile: ProjectFile = {
      path: `${request.outputDirectory}/utils/errors.ts`,
      content: this.generateCustomErrors(),
      language: 'typescript',
      hash: this.generateHash(this.generateCustomErrors()),
    };
    files.push(errorsFile);

    return files;
  }

  /**
   * Generate JWT middleware
   */
  private generateJWTMiddleware(auth: AuthConfig): string {
    const jwt = auth.jwt!;

    return `// JWT Authentication Middleware
// Generated by Cocapn API Agent

import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';

export interface JWTPayload {
  sub: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: any;
}

export function jwtAuth(secret: string, options?: {
  algorithm?: string;
  issuer?: string;
  audience?: string;
}): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Authorization token required' });
    }

    const token = authHeader.substring(7);

    try {
      // In a real implementation, you would use a JWT library like 'jsonwebtoken'
      // For now, we'll simulate token verification
      const payload = decodeJWT(token, secret);

      // Validate payload
      if (!payload.sub) {
        throw new HTTPException(401, { message: 'Invalid token' });
      }

      // Add payload to context
      c.set('jwtPayload', payload);

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(401, { message: 'Invalid token' });
    }
  }
}

function decodeJWT(token: string, secret: string): JWTPayload {
  // This is a simplified implementation
  // In production, use a proper JWT library
  try {
    // Base64 decode the payload
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));

    // Verify signature (simplified)
    const verify = require('crypto').createHmac('sha256', secret).update(token).digest('base64');
    if (verify !== token.split('.')[2]) {
      throw new Error('Invalid signature');
    }

    return decoded;
  } catch {
    throw new Error('Invalid token');
  }
}`;
  }

  /**
   * Generate API Key middleware
   */
  private generateAPIKeyMiddleware(auth: AuthConfig): string {
    const config = auth.apiKey || {};
    const headerName = config.headerName || 'X-API-Key';

    return `// API Key Authentication Middleware
// Generated by Cocapn API Agent

import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';

export function apiKeyAuth(validator: (key: string) => boolean): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = c.req.header(headerName);

    if (!apiKey) {
      throw new HTTPException(401, { message: 'API key required' });
    }

    if (!validator(apiKey)) {
      throw new HTTPException(401, { message: 'Invalid API key' });
    }

    await next();
  }
}

// Example validator - in production, store and validate against a database
const validAPIKeys = new Set(['your-api-key-1', 'your-api-key-2']);`;
  }

  /**
   * Generate Basic Auth middleware
   */
  private generateBasicAuthMiddleware(auth: AuthConfig): string {
    return `// Basic Authentication Middleware
// Generated by Cocapn API Agent

import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';
import { createHash } from 'crypto';

export function basicAuth(validator: (username: string, password: string) => boolean): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new HTTPException(401, {
        message: 'Basic authentication required',
        headers: { 'WWW-Authenticate': 'Basic realm="API"' }
      });
    }

    const encoded = authHeader.substring(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    if (!username || !password) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }

    if (!validator(username, password)) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }

    await next();
  }
}

// Example validator - in production, use proper user authentication
const validUsers = {
  'admin': createHash('sha256').update('admin-password').digest('hex'),
  'user': createHash('sha256').update('user-password').digest('hex')
};

function validateCredentials(username: string, password: string): boolean {
  const hashedPassword = createHash('sha256').update(password).digest('hex');
  return validUsers[username] === hashedPassword;
}`;
  }

  /**
   * Generate error handler middleware
   */
  private generateErrorHandler(): string {
    return `// Error Handler Middleware
// Generated by Cocapn API Agent

import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';
import { ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, ServerError } from '../utils/errors';

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('API Error:', error);

    if (error instanceof HTTPException) {
      return c.json({
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message: error.message,
          status: error.status,
        },
      }, error.status);
    }

    if (error instanceof ValidationError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details,
        },
      }, 400);
    }

    if (error instanceof AuthenticationError) {
      return c.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: error.message,
        },
      }, 401);
    }

    if (error instanceof AuthorizationError) {
      return c.json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: error.message,
        },
      }, 403);
    }

    if (error instanceof NotFoundError) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      }, 404);
    }

    if (error instanceof ConflictError) {
      return c.json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      }, 409);
    }

    // Default server error
    return c.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
      },
    }, 500);
  }
};`;
  }

  /**
   * Generate custom errors
   */
  private generateCustomErrors(): string {
    return `// Custom Error Classes
// Generated by Cocapn API Agent

export class APIError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', 401, message);
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', 403, message);
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found') {
    super('NOT_FOUND', 404, message);
  }
}

export class ConflictError extends APIError {
  constructor(message: string = 'Resource conflict') {
    super('CONFLICT', 409, message);
  }
}

export class ServerError extends APIError {
  constructor(message: string = 'Internal server error', details?: any) {
    super('SERVER_ERROR', 500, message, details);
  }
}`;
  }

  /**
   * Generate route files
   */
  private async generateEndpoints(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const resources = request.resources || [];

    resources.forEach(resource => {
      const routeContent = this.generateRouteFile(resource);

      files.push({
        path: `${request.outputDirectory}/routes/${resource.name.toLowerCase()}.routes.ts`,
        content: routeContent,
        language: 'typescript',
        hash: this.generateHash(routeContent),
      });
    });

    // Generate custom endpoints
    const endpoints = request.endpoints || [];
    if (endpoints.length > 0) {
      const customRoutesFile: ProjectFile = {
        path: `${request.outputDirectory}/routes/custom.routes.ts`,
        content: this.generateCustomRoutes(endpoints),
        language: 'typescript',
        hash: this.generateHash(this.generateCustomRoutes(endpoints)),
      };
      files.push(customRoutesFile);
    }

    return files;
  }

  /**
   * Generate route file
   */
  private generateRouteFile(resource: APIResource): string {
    const routerName = resource.name.toLowerCase();
    const importStatement = `import { ${resource.name}, Create${resource.name}, Update${resource.name} } from '../dto/${routerName}.dto';`;

    let routes = '';

    if (resource.operations.includes('list')) {
      routes += `  app.get('/${routerName}', c => {
    // TODO: Implement list operation
    return c.json({ message: 'List operation not implemented' });
  });
`;
    }

    if (resource.operations.includes('get')) {
      routes += `  app.get('/${routerName}/:id', c => {
    const id = c.req.param('id');
    // TODO: Implement get operation
    return c.json({ message: 'Get operation not implemented', id });
  });
`;
    }

    if (resource.operations.includes('create')) {
      routes += `  app.post('/${routerName}', async c => {
    try {
      const data = await c.req.json() as Create${resource.name};
      // TODO: Implement create operation
      return c.json({ message: 'Create operation not implemented', data });
    } catch (error) {
      throw new ValidationError('Invalid request body');
    }
  });
`;
    }

    if (resource.operations.includes('update')) {
      routes += `  app.put('/${routerName}/:id', async c => {
    try {
      const id = c.req.param('id');
      const data = await c.req.json() as Update${resource.name};
      // TODO: Implement update operation
      return c.json({ message: 'Update operation not implemented', id, data });
    } catch (error) {
      throw new ValidationError('Invalid request body');
    }
  });
`;
    }

    if (resource.operations.includes('delete')) {
      routes += `  app.delete('/${routerName}/:id', c => {
    const id = c.req.param('id');
    // TODO: Implement delete operation
    return c.json({ message: 'Delete operation not implemented', id });
  });
`;
    }

    return `// ${resource.name} Routes
// Generated by Cocapn API Agent

import { Hono } from 'hono';
${importStatement}

export const ${resource.name}Routes = new Hono();

${routes}`;
  }

  /**
   * Generate custom routes
   */
  private generateCustomRoutes(endpoints: APIEndpoint[]): string {
    let imports = '';
    let routes = '';

    endpoints.forEach((endpoint, index) => {
      const handlerName = `handle${endpoint.name}${index}`;
      imports += `import type { ${handlerName} } from '../handlers/custom';\n`;

      routes += `  app.${endpoint.method.toLowerCase()}('${endpoint.path}', ${handlerName});
`;
    });

    return `// Custom Routes
// Generated by Cocapn API Agent

import { Hono } from 'hono';
${imports}

const customRoutes = new Hono();

${routes}

export default customRoutes;`;
  }

  /**
   * Generate handler files
   */
  private async generateHandlers(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const resources = request.resources || [];

    resources.forEach(resource => {
      const handlerContent = this.generateHandlerFile(resource);

      files.push({
        path: `${request.outputDirectory}/handlers/${resource.name.toLowerCase()}.handler.ts`,
        content: handlerContent,
        language: 'typescript',
        hash: this.generateHash(handlerContent),
      });
    });

    return files;
  }

  /**
   * Generate handler file
   */
  private generateHandlerFile(resource: APIResource): string {
    return `// ${resource.name} Handler
// Generated by Cocapn API Agent

import type { ${resource.name}, Create${resource.name}, Update${resource.name} } from '../dto/${resource.name.toLowerCase()}.dto';
import { NotFoundError } from '../utils/errors';

// Mock database - replace with actual D1 operations
const mockDatabase = {
  async findMany() {
    // TODO: Implement database query
    return [];
  },
  async findById(id: string) {
    // TODO: Implement database query
    return null;
  },
  async create(data: Create${resource.name}) {
    // TODO: Implement database insert
    return { id: 'generated-id', ...data } as ${resource.name};
  },
  async update(id: string, data: Update${resource.name}) {
    // TODO: Implement database update
    return { id, ...data } as ${resource.name};
  },
  async delete(id: string) {
    // TODO: Implement database delete
    return true;
  }
};

export class ${resource.name}Handler {
  async findAll(): Promise<${resource.name}[]> {
    return await mockDatabase.findMany();
  }

  async findById(id: string): Promise<${resource.name}> {
    const result = await mockDatabase.findById(id);
    if (!result) {
      throw new NotFoundError('${resource.name} not found');
    }
    return result;
  }

  async create(data: Create${resource.name}): Promise<${resource.name}> {
    return await mockDatabase.create(data);
  }

  async update(id: string, data: Update${resource.name}): Promise<${resource.name}> {
    const result = await mockDatabase.update(id, data);
    if (!result) {
      throw new NotFoundError('${resource.name} not found');
    }
    return result;
  }

  async delete(id: string): Promise<void> {
    const deleted = await mockDatabase.delete(id);
    if (!deleted) {
      throw new NotFoundError('${resource.name} not found');
    }
  }
}`;
  }

  /**
   * Generate main router
   */
  private async generateMainRouter(request: APIGenerationRequest): Promise<ProjectFile> {
    const imports = request.resources?.map(r =>
      `import ${r.name}Routes from './routes/${r.name.toLowerCase()}.routes';`
    ).join('\n') || '';

    const resourceRoutes = request.resources?.map(r =>
      `    .use('/${r.name.toLowerCase()}', ${r.name}Routes)`
    ).join('\n') || '';

    return {
      path: `${request.outputDirectory}/index.ts`,
      content: `// Main API Router
// Generated by Cocapn API Agent

import { Hono } from 'hono';
${imports}

// Import middleware
import { errorHandler } from './middleware/error-handler';

// Import custom routes
${request.endpoints && request.endpoints.length > 0 ? 'import customRoutes from \'./routes/custom.routes\';' : ''}

// Import WebSocket manager
${request.websockets && request.websockets.length > 0 ? 'import { WebSocketManager } from \'./websockets/manager\';' : ''}

const app = new Hono();

// Global middleware
app.onError(errorHandler);

// API routes
${resourceRoutes}

// Custom routes
${request.endpoints && request.endpoints.length > 0 ? 'app.use(\'/custom\', customRoutes);' : ''}

export default app;

// WebSocket manager initialization
${request.websockets && request.websockets.length > 0 ? 'const wsManager = new WebSocketManager();
export { wsManager };' : ''}`,
      language: 'typescript',
      hash: this.generateHash(this.generateMainRouterContent(request)),
    };
  }

  /**
   * Generate main router content
   */
  private generateMainRouterContent(request: APIGenerationRequest): string {
    return `// Main API Router
// Generated by Cocapn API Agent

import { Hono } from 'hono';

import errorHandler from './middleware/error-handler';

const app = new Hono();

// Global middleware
app.onError(errorHandler);

export default app;`;
  }

  /**
   * Generate WebSocket manager
   */
  private async generateWebSocketManager(request: APIGenerationRequest): Promise<ProjectFile> {
    return {
      path: `${request.outputDirectory}/websockets/manager.ts`,
      content: `// WebSocket Manager
// Generated by Cocapn API Agent

import type { WebSocket } from 'ws';

export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private handlers: Map<string, (data: any) => void> = new Map();

  addConnection(id: string, ws: WebSocket): void {
    this.connections.set(id, ws);
    console.log('WebSocket connected:', id);

    ws.on('close', () => {
      this.connections.delete(id);
      console.log('WebSocket disconnected:', id);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.connections.delete(id);
    });
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  broadcast(event: string, data: any, excludeId?: string): void {
    const message = JSON.stringify({ event, data });

    this.connections.forEach((ws, id) => {
      if (id !== excludeId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  sendTo(id: string, event: string, data: any): void {
    const ws = this.connections.get(id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ event, data });
      ws.send(message);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  setHandler(event: string, handler: (data: any) => void): void {
    this.handlers.set(event, handler);
  }

  handleEvent(id: string, event: string, data: any): void {
    const handler = this.handlers.get(event);
    if (handler) {
      handler({ id, data });
    }
  }
}

export default WebSocketManager;`,
      language: 'typescript',
      hash: this.generateHash(`// WebSocket Manager
// Generated by Cocapn API Agent

export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();

  addConnection(id: string, ws: WebSocket): void {
    this.connections.set(id, ws);
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  broadcast(event: string, data: any): void {
    // Implementation
  }
}`),
    };
  }

  /**
   * Generate WebSocket handlers
   */
  private async generateWebSocketHandlers(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const websockets = request.websockets || [];

    websockets.forEach(ws => {
      const handlerContent = this.generateWebSocketHandler(ws);

      files.push({
        path: `${request.outputDirectory}/websockets/${ws.path}.ws.ts`,
        content: handlerContent,
        language: 'typescript',
        hash: this.generateHash(handlerContent),
      });
    });

    return files;
  }

  /**
   * Generate WebSocket handler
   */
  private generateWebSocketHandler(ws: WebSocketConfig): string {
    const eventHandlers = ws.events.map(event => {
      if (event.direction === 'client-to-server' || event.direction === 'bidirectional') {
        return `  // Handle ${event.name} event
  wsManager.setHandler('${event.name}', ({ id, data }) => {
    console.log('${event.name} event from', id, ':', data);
    // TODO: Implement business logic
    wsManager.sendTo(id, '${event.name}-ack', { received: true });
  });`;
      }
      return '';
    }).join('\n');

    return `// ${ws.path} WebSocket Handler
// Generated by Cocapn API Agent

import { WebSocketManager } from './manager';

export function setup${ws.path.charAt(0).toUpperCase() + ws.path.slice(1)}WebSocket(wsManager: WebSocketManager) {
${eventHandlers}

  // Handle connection
  wsManager.setHandler('connection', ({ id }) => {
    console.log('New connection:', id);
    wsManager.sendTo(id, 'welcome', { message: 'Connected successfully' });
  });

  // Handle disconnection
  wsManager.setHandler('disconnection', ({ id }) => {
    console.log('Disconnected:', id);
  });

  // Handle ping (for heartbeat)
  wsManager.setHandler('ping', ({ id }) => {
    wsManager.sendTo(id, 'pong', { timestamp: Date.now() });
  });

  // Handle pong (for heartbeat)
  wsManager.setHandler('pong', ({ id }) => {
    console.log('Heartbeat from', id);
  });
}`;
  }

  /**
   * Generate WebSocket authentication
   */
  private async generateWebSocketAuth(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    if (request.auth && request.auth.type === 'jwt') {
      const authFile: ProjectFile = {
        path: `${request.outputDirectory}/websockets/auth.ts`,
        content: this.generateWebSocketJWTAuth(),
        language: 'typescript',
        hash: this.generateHash(this.generateWebSocketJWTAuth()),
      };
      files.push(authFile);
    }

    return files;
  }

  /**
   * Generate WebSocket JWT authentication
   */
  private generateWebSocketJWTAuth(): string {
    return `// WebSocket JWT Authentication
// Generated by Cocapn API Agent

import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import type { WebSocket } from 'ws';

export function authenticateWebSocketJWT(token: string, secret: string): any {
  try {
    return jwt.verify(token, secret);
  } catch {
    throw new HTTPException(401, { message: 'Invalid token' });
  }
}

export function extractTokenFromWebSocket(req: Request): string {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    throw new HTTPException(401, { message: 'Token required' });
  }

  return token;
}`;
  }

  /**
   * Generate API tests
   */
  private async generateAPITests(request: APIGenerationRequest): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const resources = request.resources || [];

    resources.forEach(resource => {
      const testContent = this.generateAPITest(resource);

      files.push({
        path: `tests/api/${resource.name.toLowerCase()}.test.ts`,
        content: testContent,
        language: 'typescript',
        hash: this.generateHash(testContent),
      });
    });

    return files;
  }

  /**
   * Generate API test
   */
  private generateAPITest(resource: APIResource): string {
    const routerName = resource.name.toLowerCase();

    return `// ${resource.name} API Tests
// Generated by Cocapn API Agent

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import ${resource.name}Routes from '../src/api/routes/${routerName}.routes';
import { ${resource.name}Handler } from '../src/api/handlers/${routerName}.handler';

// Mock the handler
vi.mock('../src/api/handlers/${routerName}.handler', () => ({
  ${resource.name}Handler: vi.fn().mockImplementation(() => ({
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('${resource.name} API', () => {
  let app: Hono;
  let handler: any;

  beforeEach(() => {
    app = new Hono();
    app.use('/${routerName}', ${resource.name}Routes);
    handler = new (${resource.name}Handler as any)();
  });

  it('should list resources', async () => {
    const mockData = [];
    handler.findAll.mockResolvedValue(mockData);

    const res = await app.request('/${routerName}');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'List operation not implemented' });
  });

  it('should get resource by ID', async () => {
    const res = await app.request('/${routerName}/1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Get operation not implemented', id: '1' });
  });

  it('should create resource', async () => {
    const testData = { name: 'Test', email: 'test@example.com' };
    const res = await app.request('/${routerName}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Create operation not implemented', data: testData });
  });
});`;
  }

  /**
   * Generate API documentation
   */
  private async generateAPIDocs(request: APIGenerationRequest): Promise<ProjectFile> {
    const docs = this.generateAPIDocsContent(request);

    return {
      path: `${request.outputDirectory}/README.md`,
      content: docs,
      language: 'markdown',
      hash: this.generateHash(docs),
    };
  }

  /**
   * Generate API documentation content
   */
  private generateAPIDocsContent(request: APIGenerationRequest): string {
    const resources = request.resources || [];
    const endpoints = request.endpoints || [];

    return `# API Documentation

Generated by Cocapn API Agent
Date: ${new Date().toISOString()}

## Overview

This API is automatically generated by the Cocapn platform and includes ${resources.length} resource${resources.length !== 1 ? 's' : ''} and ${endpoints.length} custom endpoint${endpoints.length !== 1 ? 's' : ''}.

## Authentication

${request.auth ? `The API uses ${request.auth.type} authentication.

### ${request.auth.type.charAt(0).toUpperCase() + request.auth.type.slice(1)} Authentication

${this.generateAuthDocs(request.auth)}
` : 'No authentication configured.'}

## Resources

${resources.map(resource => this.generateResourceDocs(resource)).join('\n\n')}

## Endpoints

${endpoints.map(endpoint => this.generateEndpointDocs(endpoint)).join('\n\n')}

## Error Handling

The API uses standard HTTP status codes and returns JSON error objects:

- \`400\` - Bad Request (validation errors)
- \`401\` - Unauthorized (authentication required)
- \`403\` - Forbidden (insufficient permissions)
- \`404\` - Not Found (resource does not exist)
- \`409\` - Conflict (resource already exists)
- \`500\` - Internal Server Error

## Example Usage

\`\`\`javascript
// Fetch all resources
const response = await fetch('/api/resources');
const data = await response.json();

// Create new resource
const response = await fetch('/api/resources', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token',
  },
  body: JSON.stringify({ name: 'New Resource' }),
});
\`\`\`

## WebSocket Support

${request.websockets && request.websockets.length > 0 ?
  'WebSocket endpoints are available for real-time communication.' :
  'No WebSocket endpoints configured.'}`;
  }

  /**
   * Generate resource documentation
   */
  private generateResourceDocs(resource: APIResource): string {
    const routerName = resource.name.toLowerCase();

    let operations = '';
    if (resource.operations.includes('list')) operations += `\n- \`GET /${routerName}\` - List all ${resource.name}`;
    if (resource.operations.includes('get')) operations += `\n- \`GET /${routerName}/{id}\` - Get ${resource.name} by ID`;
    if (resource.operations.includes('create')) operations += `\n- \`POST /${routerName}\` - Create new ${resource.name}`;
    if (resource.operations.includes('update')) operations += `\n- \`PUT /${routerName}/{id}\` - Update ${resource.name}`;
    if (resource.operations.includes('delete')) operations += `\n- \`DELETE /${routerName}/{id}\` - Delete ${resource_name}`;

    return `### ${resource.name}

**Description**: ${resource.description || 'Resource for ' + resource.name}

**Fields**:
${resource.fields.map(field => `- \`${field.name}\` (${field.type})${field.required ? ' **required**' : ''}`).join('\n')}

**Operations**:${operations}

**Tags**: ${resource.tags?.join(', ') || 'default'}`;
  }

  /**
   * Generate endpoint documentation
   */
  private generateEndpointDocs(endpoint: APIEndpoint): string {
    return `### ${endpoint.name}

**Method**: ${endpoint.method}
**Path**: ${endpoint.path}
**Description**: ${endpoint.description}
**Tags**: ${endpoint.tags?.join(', ') || 'default'}

${endpoint.parameters?.map(param =>
  `- \`${param.name}\` (${param.in}): ${param.description || 'No description'}`
).join('\n') || 'No parameters'}`;
  }

  /**
   * Generate authentication documentation
   */
  private generateAuthDocs(auth: AuthConfig): string {
    switch (auth.type) {
      case 'jwt':
        return 'Include JWT token in Authorization header: `Authorization: Bearer <token>`';
      case 'api-key':
        return 'Include API key in header: `X-API-Key: <key>`';
      case 'basic':
        return 'Include credentials in Authorization header: `Authorization: Basic <encoded-credentials>`';
      default:
        return 'Authentication configuration not documented';
    }
  }

  /**
   * Parse OpenAPI file
   */
  private async parseOpenAPIFile(path: string): Promise<any> {
    // This would read and parse an actual OpenAPI file
    // For now, return a mock structure
    return {
      openapi: '3.0.0',
      info: {
        title: 'Mock API',
        version: '1.0.0',
      },
      paths: {},
    };
  }

  /**
   * Generate types from OpenAPI
   */
  private async generateOpenAPITypes(openapi: any): Promise<ProjectFile[]> {
    // Implementation would parse OpenAPI schemas and generate TypeScript types
    return [];
  }

  /**
   * Generate validation from OpenAPI
   */
  private async generateOpenAPIValidation(openapi: any): Promise<ProjectFile[]> {
    // Implementation would generate Zod schemas from OpenAPI
    return [];
  }

  /**
   * Generate routes from OpenAPI
   */
  private async generateOpenAPIRoutes(openapi: any): Promise<ProjectFile[]> {
    // Implementation would generate route handlers from OpenAPI paths
    return [];
  }

  // State management methods

  private async updateState(
    status: AgentState['status'],
    progress: number,
    currentTask?: string
  ): Promise<void> {
    this.state.status = status;
    this.state.progress = progress;
    this.state.currentTask = currentTask;

    await this.config.stateManager.updateAgent(this.config.sessionId, this.state);
    await this.reportProgress();
  }

  private async reportProgress(): Promise<void> {
    await fetch(`${this.config.coordinatorUrl}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.config.sessionId,
        agentId: this.config.agentId,
        state: this.state,
      }),
    });
  }

  // File locking methods

  private async acquireLock(filePath: string): Promise<boolean> {
    const acquired = await this.config.stateManager.acquireLock(
      this.config.sessionId,
      filePath,
      this.config.agentId
    );

    if (acquired) {
      this.lockedFiles.add(filePath);
    }

    return acquired;
  }

  private async releaseLock(filePath: string): Promise<void> {
    await this.config.stateManager.releaseLock(this.config.sessionId, filePath);
    this.lockedFiles.delete(filePath);
  }

  private async releaseAllLocks(): Promise<void> {
    for (const filePath of this.lockedFiles) {
      await this.releaseLock(filePath);
    }
  }

  // Utility methods

  private mapFieldType(type: FieldType): string {
    const typeMap = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      date: 'string',
      datetime: 'string',
      json: 'any',
      file: 'File',
    };
    return typeMap[type] || 'string';
  }

  private generateSecuritySchemes(auth: AuthConfig): any {
    const schemes: any = {};

    switch (auth.type) {
      case 'jwt':
        schemes.jwt = {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        };
        break;

      case 'api-key':
        schemes.apiKey = {
          type: 'apiKey',
          in: 'header',
          name: auth.apiKey?.headerName || 'X-API-Key',
        };
        break;

      case 'basic':
        schemes.basic = {
          type: 'http',
          scheme: 'basic',
        };
        break;
    }

    return schemes;
  }

  private yamlPaths(paths: any): string {
    return Object.entries(paths)
      .map(([path, methods]) => {
        const methodsYaml = Object.entries(methods)
          .map(([method, details]) => `        ${method}:
          ${this.yamlMethod(details)}`)
          .join('\n');
        return `  ${path}:
${methodsYaml}`;
      })
      .join('\n\n');
  }

  private yamlMethod(method: any): string {
    const lines = [
      `            summary: ${method.summary ? `"${method.summary}"` : ''}`,
      ...Object.entries(method.parameters || {}).map(([key, param]) =>
        `            parameters: ${this.yamlParameter(param)}`
      ),
      ...Object.entries(method.requestBody || {}).map(([key, body]) =>
        `            requestBody: ${this.yamlRequestBody(body)}`
      ),
      ...Object.entries(method.responses || {}).map(([code, response]) =>
        `            responses: ${this.yamlResponse(code, response)}`
      ),
    ];

    return lines
      .filter(line => line.trim())
      .map(line => line.replace(/summary: ""/, 'summary: '))
      .join('\n          ');
  }

  private yamlParameter(param: any): string {
    return `[
      {
        name: "${param.name}",
        in: "${param.in}",
        required: ${param.required},
        description: "${param.description || ''}"
      }
    ]`;
  }

  private yamlRequestBody(body: any): string {
    return `{
      content: {
        'application/json': {
          schema: ${JSON.stringify(body.content?.['application/json']?.schema, null, 2)}
        }
      }
    }`;
  }

  private yamlResponse(code: string, response: any): string {
    return `{
      "${code}": {
        description: "${response.description || ''}"
      }
    }`;
  }

  private yamlComponents(components: any): string {
    const parts = [];

    if (components.schemas && Object.keys(components.schemas).length > 0) {
      parts.push(`schemas:
${Object.entries(components.schemas)
  .map(([name, schema]) =>
    `    ${name}: ${JSON.stringify(schema, null, 2)}`)
  .join('\n\n')}`);
    }

    if (components.securitySchemes && Object.keys(components.securitySchemes).length > 0) {
      parts.push(`securitySchemes:
${Object.entries(components.securitySchemes)
  .map(([name, scheme]) =>
    `    ${name}: ${JSON.stringify(scheme, null, 2)}`)
  .join('\n')}`);
    }

    return parts.join('\n\n');
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get current agent state
   */
  async getState(): Promise<AgentState> {
    return { ...this.state };
  }

  /**
   * Complete current task
   */
  async markDone(): Promise<void> {
    await this.updateState('idle', 100, undefined);
  }
}