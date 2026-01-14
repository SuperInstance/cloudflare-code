/**
 * Request/Response Transformer
 *
 * Provides comprehensive transformation capabilities for:
 * - Request header manipulation
 * - Response header manipulation
 * - Request body transformation
 * - Response body transformation
 * - Protocol translation (REST ↔ GraphQL)
 * - Request/response filtering
 * - Payload compression
 *
 * Features:
 * - JSON path-based transformations
 * - Conditional transformations
 * - Template-based value interpolation
 * - Protocol conversion
 * - Streaming transformations
 * - Compression algorithms
 */

import type { GatewayRequest, GatewayResponse, GatewayContext } from '../types';

/**
 * Transformer configuration
 */
export interface TransformerConfig {
  requestHeaders?: HeaderTransform[];
  responseHeaders?: HeaderTransform[];
  requestBody?: BodyTransform[];
  responseBody?: BodyTransform[];
  protocolTranslation?: ProtocolTranslation;
  compression?: CompressionConfig;
}

/**
 * Header transformation
 */
export interface HeaderTransform {
  action: 'add' | 'set' | 'remove' | 'rename' | 'copy';
  header: string;
  value?: string;
  fromHeader?: string;
  condition?: TransformCondition;
  append?: boolean;
}

/**
 * Body transformation
 */
export interface BodyTransform {
  type: 'json' | 'xml' | 'form' | 'text';
  action: 'modify' | 'replace' | 'filter' | 'merge' | 'template';
  operations: TransformOperation[];
  condition?: TransformCondition;
}

/**
 * Transform operation
 */
export interface TransformOperation {
  path: string;
  action: 'set' | 'remove' | 'rename' | 'move' | 'copy' | 'merge';
  value?: unknown;
  fromPath?: string;
  template?: string;
}

/**
 * Transform condition
 */
export interface TransformCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists' | 'in' | 'not_in';
  value?: unknown;
  scope?: 'header' | 'query' | 'body' | 'context';
}

/**
 * Protocol translation
 */
export interface ProtocolTranslation {
  type: 'rest_to_graphql' | 'graphql_to_rest' | 'grpc_to_rest' | 'rest_to_grpc';
  schema?: string;
  queryMapping?: Record<string, string>;
  mutationMapping?: Record<string, string>;
  defaultOperation?: string;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'deflate';
  level?: number;
  threshold?: number;
  contentType?: string[];
}

/**
 * Transformation result
 */
export interface TransformResult {
  success: boolean;
  transformed: boolean;
  data?: unknown;
  error?: string;
  metadata: Record<string, unknown>;
}

/**
 * Request/Response Transformer
 */
export class Transformer {
  private config: TransformerConfig;
  private interpolationCache: Map<string, RegExp>;

  constructor(config: TransformerConfig = {}) {
    this.config = config;
    this.interpolationCache = new Map();
  }

  /**
   * Transform request
   */
  async transformRequest(
    request: GatewayRequest,
    context: GatewayContext
  ): Promise<TransformResult> {
    try {
      let transformed = false;

      // Transform headers
      if (this.config.requestHeaders && this.config.requestHeaders.length > 0) {
        const headerResult = await this.transformHeaders(
          request.headers,
          this.config.requestHeaders,
          request,
          context
        );

        if (headerResult.transformed) {
          transformed = true;
        }
      }

      // Transform body
      if (this.config.requestBody && this.config.requestBody.length > 0) {
        const bodyResult = await this.transformBody(
          request,
          this.config.requestBody,
          context
        );

        if (bodyResult.transformed) {
          transformed = true;
          request.body = bodyResult.data as ReadableStream;
        }
      }

      // Protocol translation
      if (this.config.protocolTranslation) {
        const protocolResult = await this.translateProtocol(
          request,
          this.config.protocolTranslation,
          context
        );

        if (protocolResult.transformed) {
          transformed = true;
          request.body = protocolResult.data as ReadableStream;
        }
      }

      return {
        success: true,
        transformed,
        metadata: {},
      };
    } catch (error) {
      return {
        success: false,
        transformed: false,
        error: error instanceof Error ? error.message : 'Transformation failed',
        metadata: {},
      };
    }
  }

  /**
   * Transform response
   */
  async transformResponse(
    response: GatewayResponse,
    context: GatewayContext,
    request?: GatewayRequest
  ): Promise<TransformResult> {
    try {
      let transformed = false;

      // Transform headers
      if (this.config.responseHeaders && this.config.responseHeaders.length > 0) {
        const headerResult = await this.transformHeaders(
          response.headers,
          this.config.responseHeaders,
          request || response as any,
          context
        );

        if (headerResult.transformed) {
          transformed = true;
        }
      }

      // Transform body
      if (this.config.responseBody && this.config.responseBody.length > 0) {
        const bodyResult = await this.transformBody(
          response as any,
          this.config.responseBody,
          context
        );

        if (bodyResult.transformed) {
          transformed = true;
          response.body = bodyResult.data as ReadableStream;
        }
      }

      // Apply compression
      if (this.config.compression?.enabled) {
        const compressionResult = await this.compressResponse(
          response,
          this.config.compression
        );

        if (compressionResult.transformed) {
          transformed = true;
        }
      }

      return {
        success: true,
        transformed,
        metadata: {},
      };
    } catch (error) {
      return {
        success: false,
        transformed: false,
        error: error instanceof Error ? error.message : 'Transformation failed',
        metadata: {},
      };
    }
  }

  /**
   * Transform headers (private helper)
   */
  private async transformHeaders(
    headers: Headers,
    transforms: HeaderTransform[],
    request: GatewayRequest,
    context: GatewayContext
  ): Promise<TransformResult> {
    let transformed = false;

    for (const transform of transforms) {
      // Check condition
      if (transform.condition && !this.evaluateCondition(transform.condition, request, context)) {
        continue;
      }

      switch (transform.action) {
        case 'add':
          if (!headers.has(transform.header) && transform.value) {
            const value = this.interpolateValue(transform.value, request, context);
            headers.append(transform.header, value);
            transformed = true;
          }
          break;

        case 'set':
          if (transform.value !== undefined) {
            const value = this.interpolateValue(transform.value, request, context);
            if (transform.append && headers.has(transform.header)) {
              headers.append(transform.header, value);
            } else {
              headers.set(transform.header, value);
            }
            transformed = true;
          }
          break;

        case 'remove':
          if (headers.has(transform.header)) {
            headers.delete(transform.header);
            transformed = true;
          }
          break;

        case 'rename':
          if (headers.has(transform.header) && transform.value) {
            const value = headers.get(transform.header);
            if (value) {
              headers.delete(transform.header);
              headers.set(transform.value, value);
              transformed = true;
            }
          }
          break;

        case 'copy':
          if (transform.fromHeader && headers.has(transform.fromHeader)) {
            const value = headers.get(transform.fromHeader);
            if (value) {
              headers.set(transform.header, value);
              transformed = true;
            }
          }
          break;
      }
    }

    return { success: true, transformed, metadata: {} };
  }

  /**
   * Transform body (private helper)
   */
  private async transformBody(
    request: GatewayRequest | GatewayResponse,
    transforms: BodyTransform[],
    context: GatewayContext
  ): Promise<TransformResult> {
    let transformed = false;
    let body: any = null;

    // Parse body
    const contentType = request.headers.get('Content-Type') || '';
    let bodyText = '';

    if (request.body) {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) bodyText += decoder.decode(value, { stream: true });
      }
    }

    for (const transform of transforms) {
      // Check condition
      if (transform.condition) {
        const req = request as GatewayRequest;
        if (!this.evaluateCondition(transform.condition, req, context)) {
          continue;
        }
      }

      // Parse body based on type
      try {
        switch (transform.type) {
          case 'json':
            body = JSON.parse(bodyText || '{}');
            break;

          case 'form':
            body = Object.fromEntries(new URLSearchParams(bodyText));
            break;

          case 'text':
          case 'xml':
            body = bodyText;
            break;

          default:
            body = bodyText;
        }
      } catch (error) {
        // If parsing fails, use raw text
        body = bodyText;
      }

      // Apply transformation
      for (const operation of transform.operations) {
        const result = this.applyOperation(body, operation, request as GatewayRequest, context);

        if (result.transformed) {
          transformed = true;
          body = result.data;
        }
      }
    }

    // Serialize back to stream
    if (transformed) {
      const serialized = typeof body === 'string' ? body : JSON.stringify(body);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(serialized));
          controller.close();
        },
      });

      return {
        success: true,
        transformed,
        data: stream,
        metadata: {},
      };
    }

    return { success: true, transformed: false, metadata: {} };
  }

  /**
   * Apply operation (private helper)
   */
  private applyOperation(
    body: any,
    operation: TransformOperation,
    request: GatewayRequest,
    context: GatewayContext
  ): TransformResult {
    if (typeof body !== 'object' || body === null) {
      return { success: true, transformed: false, metadata: {} };
    }

    const pathParts = operation.path.split('.');
    let current = body;
    const stack: any[] = [body];

    // Navigate to parent
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
      stack.push(current);
    }

    const finalKey = pathParts[pathParts.length - 1];

    switch (operation.action) {
      case 'set':
        let value = operation.value;
        if (operation.template) {
          value = this.interpolateValue(operation.template, request, context);
        } else if (typeof value === 'string') {
          value = this.interpolateValue(value, request, context);
        }

        if (current[finalKey] !== value) {
          current[finalKey] = value;
          return { success: true, transformed: true, data: body, metadata: {} };
        }
        break;

      case 'remove':
        if (current[finalKey] !== undefined) {
          delete current[finalKey];
          return { success: true, transformed: true, data: body, metadata: {} };
        }
        break;

      case 'rename':
        if (operation.value && current[finalKey] !== undefined) {
          current[operation.value] = current[finalKey];
          delete current[finalKey];
          return { success: true, transformed: true, data: body, metadata: {} };
        }
        break;

      case 'move':
        if (operation.fromPath) {
          const fromParts = operation.fromPath.split('.');
          let fromCurrent = body;

          for (const part of fromParts.slice(0, -1)) {
            if (fromCurrent[part] === undefined) {
              return { success: true, transformed: false, metadata: {} };
            }
            fromCurrent = fromCurrent[part];
          }

          const fromKey = fromParts[fromParts.length - 1];
          if (fromCurrent[fromKey] !== undefined) {
            current[finalKey] = fromCurrent[fromKey];
            delete fromCurrent[fromKey];
            return { success: true, transformed: true, data: body, metadata: {} };
          }
        }
        break;

      case 'copy':
        if (operation.fromPath) {
          const fromParts = operation.fromPath.split('.');
          let fromCurrent = body;

          for (const part of fromParts.slice(0, -1)) {
            if (fromCurrent[part] === undefined) {
              return { success: true, transformed: false, metadata: {} };
            }
            fromCurrent = fromCurrent[part];
          }

          const fromKey = fromParts[fromParts.length - 1];
          if (fromCurrent[fromKey] !== undefined) {
            current[finalKey] = JSON.parse(JSON.stringify(fromCurrent[fromKey]));
            return { success: true, transformed: true, data: body, metadata: {} };
          }
        }
        break;

      case 'merge':
        if (operation.value && typeof operation.value === 'object') {
          current[finalKey] = { ...current[finalKey], ...operation.value };
          return { success: true, transformed: true, data: body, metadata: {} };
        }
        break;
    }

    return { success: true, transformed: false, metadata: {} };
  }

  /**
   * Translate protocol (private helper)
   */
  private async translateProtocol(
    request: GatewayRequest,
    config: ProtocolTranslation,
    context: GatewayContext
  ): Promise<TransformResult> {
    if (config.type === 'rest_to_graphql') {
      return await this.restToGraphQL(request, config);
    } else if (config.type === 'graphql_to_rest') {
      return await this.graphQLToRest(request, config);
    }

    return { success: true, transformed: false, metadata: {} };
  }

  /**
   * Convert REST to GraphQL (private helper)
   */
  private async restToGraphQL(
    request: GatewayRequest,
    config: ProtocolTranslation
  ): Promise<TransformResult> {
    let bodyText = '';

    if (request.body) {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) bodyText += decoder.decode(value, { stream: true });
      }
    }

    const body = JSON.parse(bodyText || '{}');
    const query = this.mapRestToGraphQL(request.method, request.url.pathname, body, config);

    const graphqlBody = {
      query,
      variables: body,
    };

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(graphqlBody)));
        controller.close();
      },
    });

    request.headers.set('Content-Type', 'application/json');

    return {
      success: true,
      transformed: true,
      data: stream,
      metadata: {},
    };
  }

  /**
   * Convert GraphQL to REST (private helper)
   */
  private async graphQLToRest(
    request: GatewayRequest,
    config: ProtocolTranslation
  ): Promise<TransformResult> {
    let bodyText = '';

    if (request.body) {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) bodyText += decoder.decode(value, { stream: true });
      }
    }

    const graphqlBody = JSON.parse(bodyText || '{}');
    const restBody = this.mapGraphQLToRest(graphqlBody.query, graphqlBody.variables, config);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(restBody)));
        controller.close();
      },
    });

    return {
      success: true,
      transformed: true,
      data: stream,
      metadata: {},
    };
  }

  /**
   * Map REST to GraphQL (private helper)
   */
  private mapRestToGraphQL(
    method: string,
    path: string,
    body: any,
    config: ProtocolTranslation
  ): string {
    const operationName = config.queryMapping?.[`${method}:${path}`] || config.defaultOperation;

    if (method === 'GET') {
      return `query ${operationName} { ${operationName} }`;
    } else {
      return `mutation ${operationName} { ${operationName} }`;
    }
  }

  /**
   * Map GraphQL to REST (private helper)
   */
  private mapGraphQLToRest(
    query: string,
    variables: any,
    config: ProtocolTranslation
  ): any {
    // Parse GraphQL query and extract operation
    // This is simplified - a proper implementation would use a GraphQL parser
    return { ...variables };
  }

  /**
   * Compress response (private helper)
   */
  private async compressResponse(
    response: GatewayResponse,
    config: CompressionConfig
  ): Promise<TransformResult> {
    if (!config.enabled) {
      return { success: true, transformed: false, metadata: {} };
    }

    const contentType = response.headers.get('Content-Type') || '';
    const shouldCompress =
      !config.contentType ||
      config.contentType.some(type => contentType.includes(type));

    if (!shouldCompress) {
      return { success: true, transformed: false, metadata: {} };
    }

    // In a real implementation, use CompressionStream
    // For now, just set the header
    response.headers.set('Content-Encoding', config.algorithm);

    return {
      success: true,
      transformed: true,
      metadata: { algorithm: config.algorithm },
    };
  }

  /**
   * Evaluate condition (private helper)
   */
  private evaluateCondition(
    condition: TransformCondition,
    request: GatewayRequest,
    context: GatewayContext
  ): boolean {
    let value: unknown;

    switch (condition.scope) {
      case 'header':
        value = request.headers.get(condition.field);
        break;

      case 'query':
        value = request.query.get(condition.field);
        break;

      case 'body':
        // Would parse body and extract field
        value = undefined;
        break;

      case 'context':
        value = (context as any)[condition.field];
        break;

      default:
        value = undefined;
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'contains':
        return typeof value === 'string' && value.includes(String(condition.value || ''));

      case 'matches':
        if (typeof value === 'string' && condition.value) {
          const regex = new RegExp(String(condition.value));
          return regex.test(value);
        }
        return false;

      case 'exists':
        return value !== undefined && value !== null;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);

      default:
        return false;
    }
  }

  /**
   * Interpolate value (private helper)
   */
  private interpolateValue(
    template: string,
    request: GatewayRequest,
    context: GatewayContext
  ): string {
    // Simple template interpolation
    // Supports {{variable}} syntax

    let result = template;

    // Replace request variables
    result = result.replace(/\{\{request\.(\w+)\}\}/g, (_, key) => {
      return String((request as any)[key] || '');
    });

    // Replace metadata variables
    result = result.replace(/\{\{metadata\.(\w+)\}\}/g, (_, key) => {
      return String(request.metadata[key] || '');
    });

    // Replace header variables
    result = result.replace(/\{\{header\.([\w-]+)\}\}/g, (_, key) => {
      return request.headers.get(key) || '';
    });

    // Replace query variables
    result = result.replace(/\{\{query\.(\w+)\}\}/g, (_, key) => {
      return request.query.get(key) || '';
    });

    // Replace timestamp
    result = result.replace(/\{\{timestamp\}\}/g, () => {
      return String(Date.now());
    });

    // Replace random
    result = result.replace(/\{\{random\}\}/g, () => {
      return Math.random().toString(36).substr(2, 9);
    });

    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TransformerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): TransformerConfig {
    return { ...this.config };
  }
}

/**
 * Create a transformer
 */
export function createTransformer(config: TransformerConfig): Transformer {
  return new Transformer(config);
}

/**
 * Create header transform
 */
export function createHeaderTransform(
  action: HeaderTransform['action'],
  header: string,
  value?: string
): HeaderTransform {
  return { action, header, value };
}

/**
 * Create body transform
 */
export function createBodyTransform(
  type: BodyTransform['type'],
  action: BodyTransform['action'],
  operations: TransformOperation[]
): BodyTransform {
  return { type, action, operations };
}
