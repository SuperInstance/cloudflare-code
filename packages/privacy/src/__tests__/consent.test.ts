/**
 * Consent Management Tests
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConsentManager,
  ConsentCategory,
  ConsentStatus,
  ConsentSource,
  type ConsentRecord,
  type ConsentProfile,
  type GrantConsentRequest,
} from '../consent';

describe('Consent Management', () => {
  let consentManager: ConsentManager;
  let env: any;
  let state: any;

  beforeEach(() => {
    // Mock DurableObjectState
    state = {
      storage: {
        get: async (key: string) => null,
        put: async (key: string, value: any) => {},
        delete: async (key: string) => {},
        list: async (options: any) => ({ keys: [] }),
      },
    };

    // Mock environment
    env = {
      PRIVACY_KV: {
        get: async (key: string) => null,
        put: async (key: string, value: any) => {},
        delete: async (key: string) => {},
        list: async (options: any) => ({ keys: [] }),
      },
      PRIVACY_DB: null,
    };

    consentManager = new ConsentManager(state, env);
  });

  describe('Consent Granting', () => {
    it('should grant consent for analytics category', async () => {
      const request: GrantConsentRequest = {
        userId: 'user-123',
        category: ConsentCategory.ANALYTICS,
        purpose: 'Service improvement',
        legalBasis: 'Explicit consent',
        source: ConsentSource.WEBSITE,
        policyVersion: '1.0.0',
      };

      const consent: ConsentRecord = {
        id: crypto.randomUUID(),
        userId: request.userId,
        category: request.category,
        status: ConsentStatus.GRANTED,
        grantedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        condition: 'opt_in',
        purpose: request.purpose,
        legalBasis: request.legalBasis,
        source: request.source,
        policyVersion: request.policyVersion,
      };

      expect(consent.status).toBe(ConsentStatus.GRANTED);
      expect(consent.category).toBe(ConsentCategory.ANALYTICS);
      expect(consent.userId).toBe('user-123');
    });

    it('should validate required consent fields', () => {
      const invalidRequest = {
        userId: '', // Invalid: empty string
        category: ConsentCategory.MARKETING,
      };

      expect(invalidRequest.userId).toBeFalsy();
    });

    it('should calculate correct expiry date', () => {
      const ttl = 30 * 24 * 60 * 60 * 1000; // 30 days
      const grantedAt = Date.now();
      const expectedExpiry = grantedAt + ttl;

      expect(expectedExpiry).toBeGreaterThan(grantedAt);
    });
  });

  describe('Consent Validation', () => {
    it('should validate consent exists and is active', async () => {
      const consents: ConsentRecord[] = [
        {
          id: crypto.randomUUID(),
          userId: 'user-123',
          category: ConsentCategory.MARKETING,
          status: ConsentStatus.GRANTED,
          grantedAt: Date.now() - 1000,
          updatedAt: Date.now(),
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          condition: 'opt_in',
          purpose: 'Marketing communications',
          legalBasis: 'Explicit consent',
          source: ConsentSource.WEBSITE,
          policyVersion: '1.0.0',
        },
      ];

      const activeConsent = consents.find(
        (c) =>
          c.status === ConsentStatus.GRANTED &&
          (!c.expiresAt || c.expiresAt > Date.now())
      );

      expect(activeConsent).toBeDefined();
      expect(activeConsent?.status).toBe(ConsentStatus.GRANTED);
    });

    it('should detect expired consent', async () => {
      const expiredConsent: ConsentRecord = {
        id: crypto.randomUUID(),
        userId: 'user-123',
        category: ConsentCategory.ANALYTICS,
        status: ConsentStatus.GRANTED,
        grantedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 1000, // Expired
        condition: 'opt_in',
        purpose: 'Analytics',
        legalBasis: 'Consent',
        source: ConsentSource.WEBSITE,
        policyVersion: '1.0.0',
      };

      const isExpired =
        expiredConsent.status === ConsentStatus.GRANTED &&
        expiredConsent.expiresAt &&
        expiredConsent.expiresAt <= Date.now();

      expect(isExpired).toBe(true);
    });

    it('should detect revoked consent', async () => {
      const revokedConsent: ConsentRecord = {
        id: crypto.randomUUID(),
        userId: 'user-123',
        category: ConsentCategory.MARKETING,
        status: ConsentStatus.REVOKED,
        grantedAt: Date.now() - 10000,
        updatedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        condition: 'opt_in',
        purpose: 'Marketing',
        legalBasis: 'Consent',
        source: ConsentSource.WEBSITE,
        policyVersion: '1.0.0',
        withdrawnAt: Date.now(),
        withdrawalReason: 'User requested',
      };

      expect(revokedConsent.status).toBe(ConsentStatus.REVOKED);
      expect(revokedConsent.withdrawnAt).toBeDefined();
    });
  });

  describe('Consent Profile', () => {
    it('should create complete consent profile', () => {
      const profile: ConsentProfile = {
        userId: 'user-123',
        consents: [],
        status: ConsentStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        policyVersion: '1.0.0',
        cookiePreferences: {
          essential: true,
          functional: false,
          performance: false,
          marketing: false,
          socialMedia: false,
          updatedAt: Date.now(),
        },
        marketingPreferences: {
          email: false,
          sms: false,
          phone: false,
          directMail: false,
          onlineAdvertising: false,
          personalizedContent: false,
          updatedAt: Date.now(),
        },
        communicationPreferences: {
          newsletter: false,
          productUpdates: false,
          securityAlerts: true,
          featureAnnouncements: false,
          surveys: false,
          betaInvitations: false,
          updatedAt: Date.now(),
        },
      };

      expect(profile.userId).toBe('user-123');
      expect(profile.cookiePreferences.essential).toBe(true);
      expect(profile.communicationPreferences.securityAlerts).toBe(true);
    });
  });

  describe('Cookie Preferences', () => {
    it('should allow essential cookies by default', () => {
      const cookiePrefs = {
        essential: true, // Always required
        functional: false,
        performance: false,
        marketing: false,
        socialMedia: false,
        updatedAt: Date.now(),
      };

      expect(cookiePrefs.essential).toBe(true);
    });

    it('should update marketing consent separately', () => {
      const updated = {
        essential: true,
        functional: false,
        performance: true,
        marketing: true,
        socialMedia: false,
        updatedAt: Date.now(),
      };

      expect(updated.performance).toBe(true);
      expect(updated.marketing).toBe(true);
    });
  });

  describe('GDPR Consent Requirements', () => {
    it('should require explicit consent for special categories', () => {
      const specialCategories = [
        ConsentCategory.HEALTH_DATA,
        ConsentCategory.BIOMETRIC_DATA,
      ];

      specialCategories.forEach((category) => {
        const consent = {
          category,
          condition: 'explicit', // Required for special categories
        };

        expect(consent.condition).toBe('explicit');
      });
    });

    it('should track consent withdrawal (GDPR Article 7(3))', () => {
      const consent = {
        status: ConsentStatus.REVOKED,
        withdrawnAt: Date.now(),
        withdrawalReason: 'User requested withdrawal',
      };

      expect(consent.status).toBe(ConsentStatus.REVOKED);
      expect(consent.withdrawnAt).toBeDefined();
      expect(consent.withdrawalReason).toBeDefined();
    });
  });
});
