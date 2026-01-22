/**
 * Configuration Schema
 *
 * Predefined configuration schemas for ClaudeFlare platform services.
 */

import type { ConfigSchema } from '../types/config';

/**
 * Platform configuration schemas
 */
export const ConfigSchemas = {
  /**
   * AI Provider configuration
   */
  aiProvider: {
    type: 'object',
    properties: {
      provider: { type: 'string', enum: ['openai', 'anthropic', 'cohere'] },
      apiKey: { type: 'string' },
      baseURL: { type: 'string' },
      model: { type: 'string' },
      temperature: { type: 'number', minimum: 0, maximum: 2 },
      maxTokens: { type: 'number', minimum: 1 },
      timeout: { type: 'number', minimum: 1000 },
    },
    required: ['provider', 'apiKey', 'model'],
  } as ConfigSchema,

  /**
   * Agent orchestration configuration
   */
  agentOrchestrator: {
    type: 'object',
    properties: {
      maxConcurrentAgents: { type: 'number', minimum: 1 },
      agentTimeout: { type: 'number', minimum: 1000 },
      retryAttempts: { type: 'number', minimum: 0 },
      retryDelay: { type: 'number', minimum: 0 },
      enabledAgentTypes: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['maxConcurrentAgents', 'agentTimeout'],
  } as ConfigSchema,

  /**
   * Storage configuration
   */
  storage: {
    type: 'object',
    properties: {
      kv: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          ttl: { type: 'number', minimum: 0 },
        },
      },
      r2: {
        type: 'object',
        properties: {
          bucket: { type: 'string' },
          maxSize: { type: 'number', minimum: 1 },
        },
      },
      d1: {
        type: 'object',
        properties: {
          database: { type: 'string' },
          poolSize: { type: 'number', minimum: 1 },
        },
      },
    },
  } as ConfigSchema,

  /**
   * Cache configuration
   */
  cache: {
    type: 'object',
    properties: {
      l1: {
        type: 'object',
        properties: {
          maxSize: { type: 'number', minimum: 1 },
          ttl: { type: 'number', minimum: 0 },
        },
      },
      l2: {
        type: 'object',
        properties: {
          maxSize: { type: 'number', minimum: 1 },
          ttl: { type: 'number', minimum: 0 },
        },
      },
      strategy: {
        type: 'string',
        enum: ['write-through', 'write-back', 'write-around'],
      },
    },
  } as ConfigSchema,

  /**
   * Security configuration
   */
  security: {
    type: 'object',
    properties: {
      authentication: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['jwt', 'api-key', 'oauth'],
          },
          jwtSecret: { type: 'string' },
          tokenExpiry: { type: 'number', minimum: 60 },
        },
      },
      authorization: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: ['rbac', 'abac'],
          },
          defaultPolicy: { type: 'string' },
        },
      },
      encryption: {
        type: 'object',
        properties: {
          algorithm: {
            type: 'string',
            enum: ['aes-256-gcm', 'chacha20-poly1305'],
          },
          keyRotation: { type: 'boolean' },
        },
      },
    },
  } as ConfigSchema,

  /**
   * Monitoring configuration
   */
  monitoring: {
    type: 'object',
    properties: {
      metrics: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          exportInterval: { type: 'number', minimum: 1000 },
          sampleRate: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      tracing: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          samplingRate: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      logging: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['debug', 'info', 'warn', 'error'],
          },
          format: {
            type: 'string',
            enum: ['json', 'text'],
          },
        },
      },
    },
  } as ConfigSchema,

  /**
   * Load balancer configuration
   */
  loadBalancer: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['round-robin', 'least-connections', 'weighted', 'random'],
      },
      healthCheck: {
        type: 'object',
        properties: {
          interval: { type: 'number', minimum: 1000 },
          timeout: { type: 'number', minimum: 100 },
          retries: { type: 'number', minimum: 1 },
        },
      },
      circuitBreaker: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          threshold: { type: 'number', minimum: 1 },
          resetTimeout: { type: 'number', minimum: 1000 },
        },
      },
    },
  } as ConfigSchema,

  /**
   * Platform configuration
   */
  platform: {
    type: 'object',
    properties: {
      environment: {
        type: 'string',
        enum: ['development', 'staging', 'production'],
      },
      region: { type: 'string' },
      debug: { type: 'boolean' },
      tracing: { type: 'boolean' },
      features: {
        type: 'object',
        properties: {
          enableAI: { type: 'boolean' },
          enableAgents: { type: 'boolean' },
          enableRAG: { type: 'boolean' },
          enableMonitoring: { type: 'boolean' },
        },
      },
      limits: {
        type: 'object',
        properties: {
          maxConcurrentRequests: { type: 'number', minimum: 1 },
          maxServiceInstances: { type: 'number', minimum: 1 },
          cacheSize: { type: 'number', minimum: 1 },
          timeout: { type: 'number', minimum: 1000 },
        },
      },
    },
    required: ['environment'],
  } as ConfigSchema,
};

/**
 * Default configuration values
 */
export const DefaultConfig = {
  platform: {
    environment: 'development',
    debug: true,
    tracing: false,
    features: {
      enableAI: true,
      enableAgents: true,
      enableRAG: true,
      enableMonitoring: true,
    },
    limits: {
      maxConcurrentRequests: 100,
      maxServiceInstances: 50,
      cacheSize: 1000000,
      timeout: 30000,
    },
  },

  ai: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    timeout: 30000,
  },

  agentOrchestrator: {
    maxConcurrentAgents: 10,
    agentTimeout: 60000,
    retryAttempts: 3,
    retryDelay: 1000,
    enabledAgentTypes: ['chat', 'code', 'analysis'],
  },

  cache: {
    l1: {
      maxSize: 10000,
      ttl: 60000,
    },
    l2: {
      maxSize: 100000,
      ttl: 3600000,
    },
    strategy: 'write-through',
  },

  monitoring: {
    metrics: {
      enabled: true,
      exportInterval: 60000,
      sampleRate: 1.0,
    },
    tracing: {
      enabled: false,
      samplingRate: 0.1,
    },
    logging: {
      level: 'info',
      format: 'json',
    },
  },

  loadBalancer: {
    strategy: 'round-robin',
    healthCheck: {
      interval: 30000,
      timeout: 5000,
      retries: 3,
    },
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      resetTimeout: 60000,
    },
  },
};

/**
 * Get schema by key
 */
export function getSchema(key: string): ConfigSchema | undefined {
  const keys = key.split('.');

  if (keys.length === 1) {
    return ConfigSchemas[keys[0] as keyof typeof ConfigSchemas];
  }

  const rootKey = keys[0] as keyof typeof ConfigSchemas;
  const schema = ConfigSchemas[rootKey];

  if (!schema || schema.type !== 'object') {
    return undefined;
  }

  return getNestedSchema(schema, keys.slice(1));
}

/**
 * Get default value by key
 */
export function getDefault(key: string): unknown {
  const keys = key.split('.');

  let value: unknown = DefaultConfig;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Get nested schema
 */
function getNestedSchema(
  schema: ConfigSchema,
  keys: string[]
): ConfigSchema | undefined {
  if (keys.length === 0) {
    return schema;
  }

  const [key, ...rest] = keys;

  if (!schema.properties || !(key in schema.properties)) {
    return undefined;
  }

  return getNestedSchema(
    schema.properties[key] as ConfigSchema,
    rest
  );
}

/**
 * Validate configuration against schema
 */
export function validateConfig(
  key: string,
  value: unknown
): { valid: boolean; errors: string[] } {
  const schema = getSchema(key);

  if (!schema) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  // Type validation
  if (schema.type && !validateType(schema.type, value)) {
    errors.push(`Expected type ${schema.type}, got ${typeof value}`);
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value as never)) {
    errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
  }

  // Range validation for numbers
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`Value must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`Value must be <= ${schema.maximum}`);
    }
  }

  // Length validation for strings
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`String length must be >= ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`String length must be <= ${schema.maxLength}`);
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push(`String does not match pattern: ${schema.pattern}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate type
 */
function validateType(
  type: ConfigSchema['type'],
  value: unknown
): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}
