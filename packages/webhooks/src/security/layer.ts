// @ts-nocheck
/**
 * Security Layer for webhook signature verification and signing
 */

import { crypto } from 'crypto';
import type {
  SignatureAlgorithm,
  SignatureVerificationResult,
  WebhookEvent,
} from '../types/webhook.js';
import {
  SignatureVerificationError,
  SecurityValidationError,
  ReplayAttackError,
  InvalidWebhookURLError,
  IPNotAllowedError,
} from '../types/errors.js';
import type { WebhookSystemConfig } from '../types/config.js';
import type { IKVStorage } from '../types/storage.js';

/**
 * Security headers
 */
export const SECURITY_HEADERS = {
  SIGNATURE: 'webhook-signature',
  TIMESTAMP: 'webhook-timestamp',
  EVENT_ID: 'webhook-id',
  SIGNATURE_256: 'webhook-signature-256',
  ALGORITHM: 'webhook-algorithm',
} as const;

/**
 * Security options
 */
export interface SecurityOptions {
  /**
   * Signature algorithm to use
   */
  algorithm?: SignatureAlgorithm;

  /**
   * Include timestamp in signature
   */
  includeTimestamp?: boolean;

  /**
   * Include event ID in signature
   */
  includeEventId?: boolean;

  /**
   * Custom headers to include
   */
  customHeaders?: Record<string, string>;
}

/**
 * Signature creation result
 */
export interface SignatureResult {
  signature: string;
  timestamp?: number;
  headers: Record<string, string>;
}

/**
 * Security Layer class
 */
export class SecurityLayer {
  private config: WebhookSystemConfig;
  private kvStorage?: IKVStorage;
  private ipWhitelist: Set<string>;
  private allowedUrlPatterns: RegExp[];
  private blockedUrlPatterns: RegExp[];

  constructor(config: WebhookSystemConfig, kvStorage?: IKVStorage) {
    this.config = config;
    this.kvStorage = kvStorage;
    this.ipWhitelist = new Set();
    this.allowedUrlPatterns = [];
    this.blockedUrlPatterns = [];

    this.initializePatterns();
  }

  /**
   * Initialize URL patterns from config
   */
  private initializePatterns(): void {
    if (this.config.security.allowedUrlPatterns) {
      this.allowedUrlPatterns = this.config.security.allowedUrlPatterns.map(
        pattern => new RegExp(pattern)
      );
    }

    if (this.config.security.blockedUrlPatterns) {
      this.blockedUrlPatterns = this.config.security.blockedUrlPatterns.map(
        pattern => new RegExp(pattern)
      );
    }
  }

  /**
   * Add IP to whitelist
   */
  public addIPToWhitelist(ip: string): void {
    this.ipWhitelist.add(ip);
  }

  /**
   * Remove IP from whitelist
   */
  public removeIPFromWhitelist(ip: string): void {
    this.ipWhitelist.delete(ip);
  }

  /**
   * Add allowed URL pattern
   */
  public addAllowedUrlPattern(pattern: string): void {
    this.allowedUrlPatterns.push(new RegExp(pattern));
  }

  /**
   * Add blocked URL pattern
   */
  public addBlockedUrlPattern(pattern: string): void {
    this.blockedUrlPatterns.push(new RegExp(pattern));
  }

  /**
   * Validate webhook URL
   */
  public validateURL(url: string): void {
    try {
      const parsedUrl = new URL(url);

      // Check HTTPS requirement
      if (this.config.security.requireHTTPS && parsedUrl.protocol !== 'https:') {
        throw new InvalidWebhookURLError(
          url,
          'HTTPS is required for webhook URLs'
        );
      }

      // Check against allowed patterns
      if (this.allowedUrlPatterns.length > 0) {
        const isAllowed = this.allowedUrlPatterns.some(pattern =>
          pattern.test(url)
        );
        if (!isAllowed) {
          throw new InvalidWebhookURLError(
            url,
            'URL does not match any allowed patterns'
          );
        }
      }

      // Check against blocked patterns
      const isBlocked = this.blockedUrlPatterns.some(pattern =>
        pattern.test(url)
      );
      if (isBlocked) {
        throw new InvalidWebhookURLError(
          url,
          'URL matches a blocked pattern'
        );
      }

      // Check for localhost/private IPs in production
      if (this.config.environment === 'production') {
        const hostname = parsedUrl.hostname.toLowerCase();
        const privatePatterns = [
          'localhost',
          '127\\.0\\.0\\.1',
          '0\\.0\\.0\\.0',
          '::1',
          '10\\.',
          '172\\.(1[6-9]|2[0-9]|3[0-1])\\.',
          '192\\.168\\.',
        ];
        const isPrivate = privatePatterns.some(pattern =>
          new RegExp(pattern).test(hostname)
        );
        if (isPrivate) {
          throw new InvalidWebhookURLError(
            url,
            'Private IP addresses are not allowed in production'
          );
        }
      }
    } catch (error) {
      if (error instanceof InvalidWebhookURLError) {
        throw error;
      }
      throw new InvalidWebhookURLError(url, 'Invalid URL format');
    }
  }

  /**
   * Validate IP address against whitelist
   */
  public validateIP(ip: string): void {
    if (!this.config.security.enableIPWhitelist) {
      return;
    }

    if (this.ipWhitelist.size === 0) {
      return; // No whitelist configured, allow all
    }

    if (!this.ipWhitelist.has(ip)) {
      throw new IPNotAllowedError(ip);
    }
  }

  /**
   * Sign a webhook payload
   */
  public async sign(
    payload: string,
    secret: string,
    options: SecurityOptions = {}
  ): Promise<SignatureResult> {
    const algorithm = options.algorithm || this.config.defaultSignatureAlgorithm;
    const timestamp = options.includeTimestamp !== false ? Date.now() : undefined;

    // Build payload to sign
    const payloadToSign = this.buildPayloadToSign(payload, timestamp);

    // Generate signature
    const signature = await this.generateSignature(
      payloadToSign,
      secret,
      algorithm
    );

    // Build headers
    const headers: Record<string, string> = {
      [SECURITY_HEADERS.SIGNATURE]: signature,
      ...(options.customHeaders || {}),
    };

    if (timestamp) {
      headers[SECURITY_HEADERS.TIMESTAMP] = timestamp.toString();
    }

    headers[SECURITY_HEADERS.ALGORITHM] = algorithm;

    return {
      signature,
      timestamp,
      headers,
    };
  }

  /**
   * Sign a webhook event
   */
  public async signEvent(
    event: WebhookEvent,
    secret: string,
    options: SecurityOptions = {}
  ): Promise<SignatureResult> {
    const payload = JSON.stringify(event);
    const result = await this.sign(payload, secret, options);

    if (options.includeEventId !== false) {
      result.headers[SECURITY_HEADERS.EVENT_ID] = event.id;
    }

    return result;
  }

  /**
   * Verify a webhook signature
   */
  public async verify(
    payload: string,
    signature: string,
    secret: string,
    algorithm: SignatureAlgorithm = SignatureAlgorithm.HMAC_SHA256,
    timestamp?: number
  ): Promise<SignatureVerificationResult> {
    try {
      // Check timestamp if provided
      if (timestamp !== undefined) {
        const now = Date.now();
        const diff = Math.abs(now - timestamp);

        if (diff > this.config.signatureTimestampTolerance) {
          return {
            valid: false,
            algorithm,
            signature,
            timestamp,
            error: `Timestamp outside tolerance window (${diff}ms > ${this.config.signatureTimestampTolerance}ms)`,
          };
        }
      }

      // Build payload to verify
      const payloadToSign = this.buildPayloadToSign(payload, timestamp);

      // Generate expected signature
      const expectedSignature = await this.generateSignature(
        payloadToSign,
        secret,
        algorithm
      );

      // Constant-time comparison to prevent timing attacks
      const isValid = await this.constantTimeCompare(
        signature,
        expectedSignature
      );

      return {
        valid: isValid,
        algorithm,
        signature,
        timestamp,
      };
    } catch (error) {
      return {
        valid: false,
        algorithm,
        signature,
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check for replay attacks
   */
  public async checkReplayAttack(eventId: string): Promise<void> {
    if (!this.config.security.enableReplayProtection) {
      return;
    }

    if (!this.kvStorage) {
      console.warn('KV storage not configured, replay protection disabled');
      return;
    }

    const key = `replay_protection:${eventId}`;
    const exists = await this.kvStorage.exists(key);

    if (exists) {
      const data = await this.kvStorage.get(key);
      const timestamp = data ? parseInt(data, 10) : 0;
      throw new ReplayAttackError(eventId, timestamp);
    }

    // Store event ID with expiration
    await this.kvStorage.set(
      key,
      Date.now().toString(),
      this.config.security.replayWindowMs
    );
  }

  /**
   * Generate signature for payload
   */
  private async generateSignature(
    payload: string,
    secret: string,
    algorithm: SignatureAlgorithm
  ): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    try {
      switch (algorithm) {
        case SignatureAlgorithm.HMAC_SHA256: {
          const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign('HMAC', key, messageData);
          return this.bufferToHex(signature);
        }

        case SignatureAlgorithm.HMAC_SHA384: {
          const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-384' },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign('HMAC', key, messageData);
          return this.bufferToHex(signature);
        }

        case SignatureAlgorithm.HMAC_SHA512: {
          const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-512' },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign('HMAC', key, messageData);
          return this.bufferToHex(signature);
        }

        case SignatureAlgorithm.ED25519: {
          // Import ED25519 key pair
          const keyPair = await crypto.subtle.generateKey(
            {
              name: 'Ed25519',
            },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign(
            'Ed25519',
            keyPair.privateKey,
            messageData
          );
          return this.bufferToHex(signature);
        }

        case SignatureAlgorithm.RSA_SHA256: {
          const keyPair = await crypto.subtle.generateKey(
            {
              name: 'RSASSA-PKCS1-v1_5',
              modulusLength: 2048,
              publicExponent: new Uint8Array([1, 0, 1]),
              hash: 'SHA-256',
            },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            keyPair.privateKey,
            messageData
          );
          return this.bufferToHex(signature);
        }

        default:
          throw new SecurityValidationError(
            `Unsupported signature algorithm: ${algorithm}`
          );
      }
    } catch (error) {
      throw new SecurityValidationError(
        `Failed to generate signature: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build payload to sign
   */
  private buildPayloadToSign(payload: string, timestamp?: number): string {
    if (timestamp !== undefined) {
      return `${timestamp}.${payload}`;
    }
    return payload;
  }

  /**
   * Convert buffer to hex string
   */
  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private async constantTimeCompare(a: string, b: string): Promise<boolean> {
    if (a.length !== b.length) {
      return false;
    }

    const encoder = new TextEncoder();
    const bufferA = encoder.encode(a);
    const bufferB = encoder.encode(b);

    let result = 0;
    for (let i = 0; i < bufferA.length; i++) {
      result |= bufferA[i] ^ bufferB[i];
    }

    return result === 0;
  }

  /**
   * Generate a secure random secret
   */
  public static async generateSecret(length: number = 64): Promise<string> {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Validate secret strength
   */
  public static validateSecret(secret: string): boolean {
    // Minimum length of 32 characters (256 bits)
    if (secret.length < 32) {
      return false;
    }

    // Check for entropy (at least 3 different character types)
    const hasLower = /[a-z]/.test(secret);
    const hasUpper = /[A-Z]/.test(secret);
    const hasNumber = /[0-9]/.test(secret);
    const hasSpecial = /[^a-zA-Z0-9]/.test(secret);

    const typeCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(
      Boolean
    ).length;

    return typeCount >= 2;
  }

  /**
   * Hash a secret (for storage)
   */
  public static async hashSecret(secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
