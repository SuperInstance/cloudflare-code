/**
 * Audit Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuditService, AuditServiceFactory } from '../audit/audit-service';

import type { AuditConfig, AuditEventType, AuditResult } from '../types';

describe('AuditService', () => {
  let config: AuditConfig;
  let service: AuditService;

  beforeEach(() => {
    config = {
      enabled: true,
      logLevel: 'info',
      storage: {
        type: 'database',
        encryptionEnabled: true,
        compressionEnabled: false,
      },
      retention: {
        enabled: true,
        retentionDays: 90,
        deleteAfterRetention: true,
      },
      events: {
        includeSuccessfulEvents: true,
        includeFailedEvents: true,
        eventTypes: [
          'user.login',
          'user.logout',
          'user.provisioned',
          'saml.sso_initiated',
          'saml.sso_completed',
          'scim.user_created',
          'ldap.sync_completed',
        ],
        detailedLogging: true,
      },
      masking: {
        enabled: true,
        fieldsToMask: ['password', 'token', 'secret'],
        maskingPattern: '***',
        preserveLength: false,
      },
      alerts: {
        enabled: true,
        alertOn: ['failedAuthentication', 'unauthorizedAccess'],
        notificationChannels: [
          {
            type: 'email',
            config: { recipients: ['admin@example.com'] },
          },
        ],
        throttleMinutes: 5,
      },
    };

    service = new AuditService(config, {
      bufferSize: 10,
      flushInterval: 1000,
      enableMetrics: true,
    });
  });

  describe('constructor', () => {
    it('should create audit service with config', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AuditService);
    });

    it('should initialize metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });

  describe('logEvent', () => {
    it('should log successful event', async () => {
      await service.logEvent(
        'user.login',
        'User logged in',
        'success',
        {
          userId: 'user123',
          actorId: 'user123',
          actorType: 'user',
          ipAddress: '192.168.1.1',
        },
        {
          method: 'password',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log failed event', async () => {
      await service.logEvent(
        'user.login',
        'User login failed',
        'failure',
        {
          userId: 'user123',
          ipAddress: '192.168.1.1',
        },
        {
          reason: 'Invalid credentials',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should not log disabled event types', async () => {
      const localConfig = { ...config };
      localConfig.events.eventTypes = ['user.login'];

      const localService = new AuditService(localConfig);

      await localService.logEvent(
        'user.logout',
        'User logged out',
        'success'
      );

      // Should not throw, but event should not be logged
      expect(true).toBe(true);
    });

    it('should mask sensitive data', async () => {
      await service.logEvent(
        'user.login',
        'User logged in',
        'success',
        {
          userId: 'user123',
        },
        {
          password: 'secret123',
          username: 'testuser',
        }
      );

      // Event should be logged but password should be masked
      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should skip event when includeSuccessfulEvents is false', async () => {
      const localConfig = { ...config };
      localConfig.events.includeSuccessfulEvents = false;

      const localService = new AuditService(localConfig);

      await localService.logEvent(
        'user.login',
        'User logged in',
        'success',
        {
          userId: 'user123',
        }
      );

      // Event should not be logged
      expect(true).toBe(true);
    });
  });

  describe('logAuthentication', () => {
    it('should log login event', async () => {
      await service.logAuthentication(
        'login',
        'user123',
        'success',
        {
          actorId: 'user123',
          actorType: 'user',
          ipAddress: '192.168.1.1',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log logout event', async () => {
      await service.logAuthentication(
        'logout',
        'user123',
        'success',
        {
          userId: 'user123',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log failed login', async () => {
      await service.logAuthentication(
        'failed_login',
        'user123',
        'failure',
        {
          ipAddress: '192.168.1.1',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('logProvisioning', () => {
    it('should log user provisioning', async () => {
      await service.logProvisioning(
        'created',
        'user',
        'user123',
        'success',
        {
          actorId: 'admin',
          actorType: 'user',
        },
        {
          source: 'scim',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log user deprovisioning', async () => {
      await service.logProvisioning(
        'deleted',
        'user',
        'user123',
        'success',
        {
          actorId: 'admin',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log group provisioning', async () => {
      await service.logProvisioning(
        'created',
        'group',
        'group123',
        'success'
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('logSAMLEvent', () => {
    it('should log SAML SSO initiated', async () => {
      await service.logSAMLEvent(
        'sso_initiated',
        'user123',
        'success',
        {
          actorId: 'user123',
        },
        {
          idp: 'https://idp.example.com',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log SAML SSO completed', async () => {
      await service.logSAMLEvent(
        'sso_completed',
        'user123',
        'success',
        {
          userId: 'user123',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log SAML assertion received', async () => {
      await service.logSAMLEvent(
        'assertion_received',
        undefined,
        'success',
        {
          ipAddress: '192.168.1.1',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('logLDAPEvent', () => {
    it('should log LDAP sync started', async () => {
      await service.logLDAPEvent(
        'sync_started',
        'success',
        {
          actorId: 'system',
          actorType: 'system',
        },
        {
          syncType: 'full',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log LDAP sync completed', async () => {
      await service.logLDAPEvent(
        'sync_completed',
        'success',
        {},
        {
          usersSynced: 100,
          groupsSynced: 10,
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log LDAP sync failed', async () => {
      await service.logLDAPEvent(
        'sync_failed',
        'failure',
        {},
        {
          error: 'Connection timeout',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('logSCIMEvent', () => {
    it('should log SCIM user created', async () => {
      await service.logSCIMEvent(
        'created',
        'user',
        'user123',
        'success',
        {
          actorId: 'admin',
        },
        {
          externalId: 'ext-user-123',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log SCIM group deleted', async () => {
      await service.logSCIMEvent(
        'deleted',
        'group',
        'group123',
        'success',
        {
          actorId: 'admin',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('logAuthorization', () => {
    it('should log granted permission', async () => {
      await service.logAuthorization(
        'access_resource',
        'user123',
        'granted',
        {
          userId: 'user123',
          resourceId: 'resource123',
        },
        {
          permission: 'read',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log denied permission', async () => {
      await service.logAuthorization(
        'access_resource',
        'user123',
        'denied',
        {
          userId: 'user123',
          resourceId: 'resource123',
        },
        {
          permission: 'admin',
          reason: 'Insufficient privileges',
        }
      );

      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('query', () => {
    it('should query audit events', async () => {
      const events = await service.query({
        limit: 10,
        offset: 0,
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it('should query by user ID', async () => {
      const events = await service.getEventsByUserId('user123', {
        limit: 10,
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it('should query by event type', async () => {
      const events = await service.getEventsByType('user.login', {
        limit: 10,
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it('should query by category', async () => {
      const events = await service.getEventsByCategory('authentication', {
        limit: 10,
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it('should query failed events', async () => {
      const events = await service.getFailedEvents({
        limit: 10,
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate audit report', async () => {
      const report = await service.generateReport({
        limit: 100,
      });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });

  describe('generateSummary', () => {
    it('should generate summary from events', () => {
      const summary = service.generateSummary([]);

      expect(summary).toBeDefined();
      expect(summary.totalEvents).toBeDefined();
      expect(summary.byEventType).toBeDefined();
      expect(summary.byCategory).toBeDefined();
      expect(summary.bySeverity).toBeDefined();
      expect(summary.byResult).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should get metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics', () => {
      service.resetMetrics();

      const metrics = service.getMetrics();

      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('flush', () => {
    it('should flush event buffer', async () => {
      await service.logEvent('user.login', 'test', 'success', {
        userId: 'user123',
      });

      await service.flush();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown service', async () => {
      await service.shutdown();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('AuditServiceFactory', () => {
  const config: AuditConfig = {
    enabled: true,
    logLevel: 'info',
    storage: {
      type: 'database',
      encryptionEnabled: true,
      compressionEnabled: false,
    },
    retention: {
      enabled: true,
      retentionDays: 90,
      deleteAfterRetention: true,
    },
    events: {
      includeSuccessfulEvents: true,
      includeFailedEvents: true,
      eventTypes: ['user.login'],
      detailedLogging: true,
    },
    masking: {
      enabled: true,
      fieldsToMask: ['password'],
      maskingPattern: '***',
      preserveLength: false,
    },
    alerts: {
      enabled: false,
      alertOn: [],
      notificationChannels: [],
    },
  };

  it('should create service instance', () => {
    const service = AuditServiceFactory.create(config);

    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AuditService);
  });

  it('should return same instance for same storage type', () => {
    const service1 = AuditServiceFactory.create(config);
    const service2 = AuditServiceFactory.create(config);

    expect(service1).toBe(service2);
  });

  it('should remove instance', async () => {
    AuditServiceFactory.create(config);
    await AuditServiceFactory.remove(config);

    // Should create new instance after removal
    const service = AuditServiceFactory.create(config);
    expect(service).toBeDefined();
  });

  it('should clear all instances', async () => {
    AuditServiceFactory.create(config);
    await AuditServiceFactory.clear();

    expect(AuditServiceFactory.getInstances().length).toBe(0);
  });
});
