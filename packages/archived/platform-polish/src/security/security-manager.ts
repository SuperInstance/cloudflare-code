// @ts-nocheck
import { EventEmitter } from 'events';
import { SecurityConfig } from '../types';
import { Logger } from '../utils/logger';
import { RateLimiter } from '../utils/rate-limiter';

export class SecurityManager extends EventEmitter {
  private logger: Logger;
  private securityConfigs: Map<string, SecurityConfig> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private isRunning = false;

  constructor() {
    super();
    this.logger = new Logger('SecurityManager');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Security Manager is already running');
    }

    this.logger.info('Starting Security Manager...');

    try {
      this.isRunning = true;
      this.logger.info('Security Manager started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Security Manager', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Security Manager...');

    try {
      this.securityConfigs.clear();
      this.rateLimiters.clear();

      this.isRunning = false;
      this.logger.info('Security Manager stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Security Manager shutdown', { error });
      throw error;
    }
  }

  configureSecurity(serviceId: string, config: SecurityConfig): void {
    this.securityConfigs.set(serviceId, config);

    // Initialize rate limiter if enabled
    if (config.rateLimiting.enabled) {
      const rateLimiter = new RateLimiter(
        config.rateLimiting.requestsPerMinute,
        config.rateLimiting.burst
      );
      this.rateLimiters.set(serviceId, rateLimiter);
    }

    this.logger.debug(`Security configured for service: ${serviceId}`, config);
  }

  async authorizeRequest(request: any): Promise<boolean> {
    const serviceId = request.serviceId || 'default';
    const config = this.securityConfigs.get(serviceId);

    if (!config) {
      this.logger.warn(`No security config found for service: ${serviceId}`);
      return true; // Allow by default
    }

    try {
      // Apply rate limiting
      if (config.rateLimiting.enabled) {
        const rateLimiter = this.rateLimiters.get(serviceId);
        if (rateLimiter) {
          const allowed = await rateLimiter.tryAcquire(request.clientId || request.ip);
          if (!allowed) {
            throw new Error('Rate limit exceeded');
          }
        }
      }

      // Apply CORS
      if (config.cors.enabled) {
        this.validateCors(request, config.cors);
      }

      // Apply authentication
      if (config.auth.enabled) {
        await this.authenticate(request, config.auth);
      }

      // Apply encryption
      if (config.encryption.enabled) {
        this.validateEncryption(request, config.encryption);
      }

      return true;
    } catch (error) {
      this.logger.error('Security authorization failed', {
        serviceId,
        error: error.message,
        request: {
          method: request.method,
          url: request.url,
          ip: request.ip
        }
      });

      this.emit('securityEvent', {
        type: 'authorization_failed',
        serviceId,
        error: error.message,
        timestamp: new Date(),
        request
      });

      throw error;
    }
  }

  private validateCors(request: any, corsConfig: SecurityConfig['cors']): void {
    const origin = request.headers.origin;
    if (!origin || !corsConfig.origins.includes('*') && !corsConfig.origins.includes(origin)) {
      throw new Error(`CORS origin not allowed: ${origin}`);
    }

    const method = request.method;
    if (!corsConfig.methods.includes(method)) {
      throw new Error(`CORS method not allowed: ${method}`);
    }

    const headers = request.headers['access-control-request-headers'];
    if (headers) {
      const requestedHeaders = headers.split(',').map(h => h.trim());
      const allowedHeaders = corsConfig.headers;

      if (!requestedHeaders.every(h => allowedHeaders.includes('*') || allowedHeaders.includes(h))) {
        throw new Error(`CORS headers not allowed`);
      }
    }
  }

  private async authenticate(request: any, authConfig: SecurityConfig['auth']): Promise<void> {
    const token = request.headers.authorization?.replace('Bearer ', '') ||
                  request.headers['x-api-key'] ||
                  request.query.api_key;

    if (!token) {
      throw new Error('Authentication token required');
    }

    try {
      switch (authConfig.type) {
        case 'jwt':
          await this.validateJWT(token);
          break;
        case 'api-key':
          await this.validateAPIKey(token);
          break;
        case 'oauth':
          await this.validateOAuth(token, authConfig.provider);
          break;
        case 'basic':
          await this.validateBasicAuth(request.headers.authorization);
          break;
        default:
          throw new Error(`Unsupported authentication type: ${authConfig.type}`);
      }

      request.authenticated = true;
      request.authToken = token;
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private async validateJWT(token: string): Promise<void> {
    // Implementation would use a JWT library
    this.logger.debug('Validating JWT token');

    // Mock validation - in real implementation, verify signature, expiration, etc.
    if (token.length < 10) {
      throw new Error('Invalid JWT token');
    }
  }

  private async validateAPIKey(apiKey: string): Promise<void> {
    // Implementation would validate against a database or cache
    this.logger.debug('Validating API key');

    // Mock validation
    if (apiKey.length < 16) {
      throw new Error('Invalid API key');
    }
  }

  private async validateOAuth(token: string, provider?: string): Promise<void> {
    // Implementation would validate against OAuth provider
    this.logger.debug('Validating OAuth token', { provider });

    // Mock validation
    if (token.length < 10) {
      throw new Error('Invalid OAuth token');
    }
  }

  private async validateBasicAuth(authHeader: string): Promise<void> {
    // Implementation would decode and validate credentials
    this.logger.debug('Validating Basic Auth');

    // Mock validation
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new Error('Invalid Basic Auth header');
    }
  }

  private validateEncryption(request: any, encryptionConfig: SecurityConfig['encryption']): void {
    // Check if data is properly encrypted
    if (encryptionConfig.algorithm === 'AES-256-GCM') {
      const encryptedData = request.body;
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Data must be encrypted');
      }
    }
  }

  async getSecurityStats(): Promise<any> {
    const stats = {
      totalConfiguredServices: this.securityConfigs.size,
      rateLimiters: {} as Record<string, any>,
      configs: {} as Record<string, any>
    };

    for (const [serviceId, rateLimiter] of this.rateLimiters) {
      stats.rateLimiters[serviceId] = rateLimiter.getStats();
    }

    for (const [serviceId, config] of this.securityConfigs) {
      stats.configs[serviceId] = {
        auth: {
          type: config.auth.type,
          provider: config.auth.provider
        },
        rateLimiting: config.rateLimiting.enabled,
        cors: config.cors.enabled,
        encryption: config.encryption.enabled
      };
    }

    return stats;
  }

  async resetRateLimit(serviceId: string): Promise<void> {
    const rateLimiter = this.rateLimiters.get(serviceId);
    if (rateLimiter) {
      rateLimiter.reset();
      this.logger.info(`Rate limit reset for service: ${serviceId}`);
    }
  }

  async simulateSecurityEvent(eventType: string, serviceId: string, details: any): Promise<void> {
    this.emit('securityEvent', {
      type: eventType,
      serviceId,
      details,
      timestamp: new Date()
    });
  }
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private burst: number;
  private limit: number;
  private windowMs: number;

  constructor(requestsPerMinute: number, burst: number) {
    this.limit = requestsPerMinute;
    this.burst = burst;
    this.windowMs = 60 * 1000; // 1 minute window
  }

  async tryAcquire(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    let requests = this.requests.get(identifier)!;

    // Remove old requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    this.requests.set(identifier, requests);

    // Check if limit exceeded
    if (requests.length >= this.limit) {
      return false;
    }

    // Add current request
    requests.push(now);
    this.requests.set(identifier, requests);

    return true;
  }

  reset(): void {
    this.requests.clear();
  }

  getStats(): any {
    let totalRequests = 0;
    let maxRequests = 0;

    for (const requests of this.requests.values()) {
      totalRequests += requests.length;
      maxRequests = Math.max(maxRequests, requests.length);
    }

    return {
      totalIdentifiers: this.requests.size,
      totalRequests,
      maxRequests,
      limit: this.limit,
      burst: this.burst
    };
  }
}

// Event emitter interface
export interface SecurityManagerEvents {
  securityEvent: (event: { type: string; serviceId: string; error?: string; timestamp: Date; request?: any }) => void;
  started: () => void;
  stopped: () => void;
}

// Extend SecurityManager with EventEmitter functionality
export interface SecurityManager extends NodeJS.EventEmitter {
  on(event: 'securityEvent', listener: (event: { type: string; serviceId: string; error?: string; timestamp: Date; request?: any }) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'securityEvent', event: { type: string; serviceId: string; error?: string; timestamp: Date; request?: any }): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}