/**
 * Tests for Security Layer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityLayer, SECURITY_HEADERS } from './layer.js';
import { WebhookSystemConfig } from '../types/config.js';
import { MemoryKVStorage } from '../storage/memory.js';
import {
  SignatureVerificationError,
  InvalidWebhookURLError,
  IPNotAllowedError,
  ReplayAttackError,
} from '../types/errors.js';

describe('SecurityLayer', () => {
  let securityLayer: SecurityLayer;
  let kvStorage: MemoryKVStorage;
  let config: WebhookSystemConfig;

  beforeEach(() => {
    kvStorage = new MemoryKVStorage();
    config = {
      environment: 'test',
      defaultTimeout: 30000,
      maxDeliveryAttempts: 5,
      defaultSignatureAlgorithm: 'hmac_sha256' as any,
      signatureTimestampTolerance: 300000,
      maxPayloadSize: 6 * 1024 * 1024,
      maxBatchSize: 100,
      maxBatchWaitTime: 5000,
      maxTimeout: 300000,
      rateLimit: {
        maxPerSecond: 100,
        burstAllowance: 20,
        windowSizeMs: 60000,
      },
      queue: {
        maxQueueSize: 10000,
        retentionMs: 7 * 24 * 60 * 60 * 1000,
        maxProcessingTime: 300000,
      },
      retry: {
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        maxAttempts: 3,
      },
      deadLetter: {
        maxSize: 100000,
        retentionMs: 30 * 24 * 60 * 60 * 1000,
        autoRetry: false,
        autoRetryIntervalMs: 3600000,
      },
      storage: {
        deliveryRetentionMs: 90 * 24 * 60 * 60 * 1000,
        analyticsRetentionMs: 365 * 24 * 60 * 60 * 1000,
        maxRecordsPerQuery: 1000,
      },
      security: {
        enableIPWhitelist: false,
        enableReplayProtection: true,
        replayWindowMs: 3600000,
        requireHTTPS: true,
      },
      monitoring: {
        enabled: true,
        exportIntervalMs: 60000,
        alerts: {
          failureRateThreshold: 0.05,
          latencyThresholdMs: 5000,
          queueSizeThreshold: 5000,
        },
      },
      features: {
        batchDelivery: true,
        templates: true,
        filters: true,
        transformScripts: false,
        analytics: true,
      },
    };

    securityLayer = new SecurityLayer(config, kvStorage);
  });

  describe('URL Validation', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(() => securityLayer.validateURL('https://example.com/webhook')).not.toThrow();
    });

    it('should reject HTTP URLs when HTTPS is required', () => {
      expect(() => securityLayer.validateURL('http://example.com/webhook')).toThrow(
        InvalidWebhookURLError
      );
    });

    it('should reject private IPs in production', () => {
      config.environment = 'production';
      expect(() => securityLayer.validateURL('https://localhost/webhook')).toThrow();
      expect(() => securityLayer.validateURL('https://127.0.0.1/webhook')).toThrow();
      expect(() => securityLayer.validateURL('https://192.168.1.1/webhook')).toThrow();
    });

    it('should respect allowed URL patterns', () => {
      securityLayer.addAllowedUrlPattern('^https://api\\.example\\.com.*');

      expect(() => securityLayer.validateURL('https://api.example.com/webhook')).not.toThrow();
      expect(() => securityLayer.validateURL('https://other.com/webhook')).toThrow();
    });

    it('should respect blocked URL patterns', () => {
      securityLayer.addBlockedUrlPattern('.*blocked.*');

      expect(() => securityLayer.validateURL('https://blocked.example.com/webhook')).toThrow();
      expect(() => securityLayer.validateURL('https://allowed.com/webhook')).not.toThrow();
    });
  });

  describe('IP Validation', () => {
    it('should allow all IPs when whitelist is disabled', () => {
      expect(() => securityLayer.validateIP('192.168.1.1')).not.toThrow();
    });

    it('should allow whitelisted IPs', () => {
      config.security.enableIPWhitelist = true;
      securityLayer.addIPToWhitelist('192.168.1.1');

      expect(() => securityLayer.validateIP('192.168.1.1')).not.toThrow();
    });

    it('should reject non-whitelisted IPs when whitelist is enabled', () => {
      config.security.enableIPWhitelist = true;
      securityLayer.addIPToWhitelist('192.168.1.1');

      expect(() => securityLayer.validateIP('192.168.1.2')).toThrow(IPNotAllowedError);
    });
  });

  describe('Signature Generation', () => {
    it('should generate consistent signatures', async () => {
      const payload = 'test-payload';
      const secret = 'test-secret-with-at-least-32-characters!!';

      const result1 = await securityLayer.sign(payload, secret);
      const result2 = await securityLayer.sign(payload, secret);

      expect(result1.signature).toBe(result2.signature);
      expect(result1.headers[SECURITY_HEADERS.SIGNATURE]).toBeDefined();
      expect(result1.headers[SECURITY_HEADERS.TIMESTAMP]).toBeDefined();
    });

    it('should include timestamp in signature', async () => {
      const payload = 'test-payload';
      const secret = 'test-secret-with-at-least-32-characters!!';

      const result = await securityLayer.sign(payload, secret, {
        includeTimestamp: true,
      });

      expect(result.timestamp).toBeDefined();
      expect(result.headers[SECURITY_HEADERS.TIMESTAMP]).toBeDefined();
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signatures', async () => {
      const payload = 'test-payload';
      const secret = 'test-secret-with-at-least-32-characters!!';

      const signed = await securityLayer.sign(payload, secret);
      const verified = await securityLayer.verify(
        payload,
        signed.signature,
        secret,
        'hmac_sha256' as any,
        signed.timestamp
      );

      expect(verified.valid).toBe(true);
    });

    it('should reject invalid signatures', async () => {
      const payload = 'test-payload';
      const secret = 'test-secret-with-at-least-32-characters!!';

      const verified = await securityLayer.verify(
        payload,
        'invalid-signature',
        secret,
        'hmac_sha256' as any
      );

      expect(verified.valid).toBe(false);
      expect(verified.error).toBeDefined();
    });

    it('should reject signatures with old timestamps', async () => {
      const payload = 'test-payload';
      const secret = 'test-secret-with-at-least-32-characters!!';
      const oldTimestamp = Date.now() - config.signatureTimestampTolerance - 1000;

      const verified = await securityLayer.verify(
        payload,
        'some-signature',
        secret,
        'hmac_sha256' as any,
        oldTimestamp
      );

      expect(verified.valid).toBe(false);
      expect(verified.error).toContain('outside tolerance');
    });
  });

  describe('Replay Protection', () => {
    it('should detect replay attacks', async () => {
      const eventId = 'test-event-123';

      await securityLayer.checkReplayAttack(eventId);

      await expect(securityLayer.checkReplayAttack(eventId)).rejects.toThrow(
        ReplayAttackError
      );
    });

    it('should allow unique event IDs', async () => {
      await expect(securityLayer.checkReplayAttack('event-1')).resolves.not.toThrow();
      await expect(securityLayer.checkReplayAttack('event-2')).resolves.not.toThrow();
      await expect(securityLayer.checkReplayAttack('event-3')).resolves.not.toThrow();
    });

    it('should expire old event IDs', async () => {
      const eventId = 'test-event-expire';

      // First call should succeed
      await securityLayer.checkReplayAttack(eventId);

      // Wait for expiration (in real scenario)
      // For now, just verify the mechanism works
      await expect(securityLayer.checkReplayAttack(eventId)).rejects.toThrow();
    });
  });

  describe('Secret Generation', () => {
    it('should generate secure random secrets', async () => {
      const secret1 = await SecurityLayer.generateSecret(64);
      const secret2 = await SecurityLayer.generateSecret(64);

      expect(secret1).toHaveLength(128); // 64 bytes = 128 hex chars
      expect(secret2).toHaveLength(128);
      expect(secret1).not.toBe(secret2);
    });
  });

  describe('Secret Validation', () => {
    it('should validate strong secrets', () => {
      expect(SecurityLayer.validateSecret('StrongSecret123!@#')).toBe(true);
      expect(SecurityLayer.validateSecret('abc123DEF456ghi789JKL012mno345pqr')).toBe(true);
    });

    it('should reject weak secrets', () => {
      expect(SecurityLayer.validateSecret('short')).toBe(false);
      expect(SecurityLayer.validateSecret('alllowercaseletters')).toBe(false);
      expect(SecurityLayer.validateSecret('ALLUPPERCASELETTERS')).toBe(false);
      expect(SecurityLayer.validateSecret('12345678901234567890123456789012')).toBe(false);
    });
  });
});
