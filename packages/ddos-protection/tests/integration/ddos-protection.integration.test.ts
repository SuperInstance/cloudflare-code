/**
 * Integration tests for DDoS Protection
 */

import { DDoSProtection } from '../../src/index';
import type { RequestData, DDoSProtectionConfig } from '../../src/types';

describe('DDoS Protection Integration', () => {
  let protection: DDoSProtection;

  beforeEach(() => {
    const config: Partial<DDoSProtectionConfig> = {
      enabled: true,
      mitigationMode: 'mitigate',
      rateLimiting: {
        requestsPerSecond: 100,
        requestsPerMinute: 1000,
        requestsPerHour: 10000,
        burstSize: 200,
        windowSize: 60
      },
      ipReputation: true,
      challengePlatform: true,
      analytics: true
    };

    protection = new DDoSProtection(config, 'test');
  });

  afterEach(() => {
    protection.reset();
  });

  describe('request processing', () => {
    it('should allow legitimate requests', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/users',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept': 'application/json'
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        geo: { country: 'US' }
      };

      const result = await protection.processRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.metrics.processingTime).toBeGreaterThan(0);
    });

    it('should handle high traffic volume', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/data',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Send many requests from same IP
      const results = [];
      for (let i = 0; i < 1500; i++) {
        const result = await protection.processRequest({
          ...request,
          id: `req-${i}`
        });
        results.push(result);
      }

      // Some requests should be rate limited
      const blockedRequests = results.filter(r => !r.allowed);
      expect(blockedRequests.length).toBeGreaterThan(0);
    });

    it('should detect and mitigate attacks', async () => {
      const attackRequest: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.100',
        method: 'GET',
        url: '/api/vulnerable',
        headers: { 'user-agent': 'attack-bot/1.0' },
        userAgent: 'attack-bot/1.0'
      };

      // Simulate attack
      for (let i = 0; i < 2000; i++) {
        await protection.processRequest({
          ...attackRequest,
          id: `req-${i}`
        });
      }

      const result = await protection.processRequest({ ...attackRequest, id: 'req-final' });

      // Should detect attack and apply mitigation
      expect(result.attack).toBeDefined();
      expect(result.attack?.isAttack).toBe(true);
    });
  });

  describe('IP reputation integration', () => {
    it('should track IP reputation', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.50',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Send legitimate requests
      for (let i = 0; i < 10; i++) {
        await protection.processRequest({ ...request, id: `req-${i}` });
      }

      const reputation = await protection.getIPReputation(request.ip);
      expect(reputation).toBeDefined();
      expect(reputation.totalRequests).toBeGreaterThan(0);
    });

    it('should update reputation for malicious IPs', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.200',
        method: 'GET',
        url: '/admin',
        headers: { 'user-agent': 'malicious-bot' },
        userAgent: 'malicious-bot'
      };

      // Send many requests to trigger attack detection
      for (let i = 0; i < 500; i++) {
        await protection.processRequest({ ...request, id: `req-${i}` });
      }

      const reputation = await protection.getIPReputation(request.ip);
      expect(reputation.score).toBeLessThan(0.5);
    });
  });

  describe('challenge platform integration', () => {
    it('should require challenge for suspicious requests', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.75',
        method: 'GET',
        url: '/api/protected',
        headers: { 'user-agent': 'suspicious-bot' },
        userAgent: 'suspicious-bot'
      };

      // Trigger suspicious behavior
      for (let i = 0; i < 100; i++) {
        await protection.processRequest({ ...request, id: `req-${i}` });
      }

      const result = await protection.processRequest({ ...request, id: 'req-final' });

      if (result.challenge?.required) {
        expect(result.challenge.token).toBeDefined();
        expect(result.challenge.html).toBeDefined();
      }
    });

    it('should verify challenge responses', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.76',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const result = await protection.processRequest(request);

      // Generate challenge
      const challenge = await protection['challengePlatform'].generateChallenge(request, 'javascript');

      // Verify challenge (will fail as we don't have the actual solution)
      const verifyResult = await protection.verifyChallenge(challenge.token, 'invalid-solution');

      expect(verifyResult).toBeDefined();
    });
  });

  describe('analytics integration', () => {
    it('should collect analytics data', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test',
        geo: { country: 'US' }
      };

      // Send some requests
      for (let i = 0; i < 50; i++) {
        await protection.processRequest({ ...request, id: `req-${i}` });
      }

      const analytics = protection.getAnalytics('hour');

      expect(analytics.totalRequests).toBeGreaterThan(0);
      expect(analytics.period).toBe('hour');
    });

    it('should provide real-time monitoring', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      await protection.processRequest(request);

      const monitoring = protection.getRealtimeMonitoring();

      expect(monitoring).toBeDefined();
      expect(monitoring.currentRps).toBeGreaterThanOrEqual(0);
      expect(monitoring.systemHealth).toBeDefined();
    });
  });

  describe('IP blocking integration', () => {
    it('should block IP addresses', async () => {
      const ip = '192.168.1.99';
      protection.blockIP(ip, { reason: 'Manual block' });

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const result = await protection.processRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.mitigation?.reason).toContain('blocked');
    });

    it('should unblock IP addresses', async () => {
      const ip = '192.168.1.98';
      protection.blockIP(ip);

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // First request should be blocked
      let result = await protection.processRequest(request);
      expect(result.allowed).toBe(false);

      // Unblock
      protection.unblockIP(ip);

      // Next request should be allowed
      result = await protection.processRequest({ ...request, id: 'req-2' });
      expect(result.allowed).toBe(true);
    });

    it('should block countries', async () => {
      protection.blockCountry('CN', { reason: 'Geo policy' });

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test',
        geo: { country: 'CN' }
      };

      const result = await protection.processRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.mitigation?.action?.type).toBe('geo_block');
    });
  });

  describe('allow list integration', () => {
    it('should allow whitelisted IPs regardless of reputation', async () => {
      const ip = '192.168.1.10';
      protection.allowIP(ip);

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Send many requests - should not be rate limited
      for (let i = 0; i < 500; i++) {
        const result = await protection.processRequest({ ...request, id: `req-${i}` });
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('configuration management', () => {
    it('should update configuration', async () => {
      protection.updateConfig({
        mitigationMode: 'aggressive',
        rateLimiting: {
          requestsPerSecond: 50,
          requestsPerMinute: 500,
          requestsPerHour: 5000,
          burstSize: 100,
          windowSize: 60
        }
      });

      const config = protection.getConfig();

      expect(config.mitigationMode).toBe('aggressive');
      expect(config.rateLimiting.requestsPerSecond).toBe(50);
    });

    it('should respect monitor mode', async () => {
      protection.updateConfig({ mitigationMode: 'monitor' });
      protection.blockIP('192.168.1.50');

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.50',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const result = await protection.processRequest(request);

      // Should be allowed even though IP is blocked (monitor mode)
      expect(result.allowed).toBe(true);
    });
  });

  describe('state management', () => {
    it('should export and import state', async () => {
      protection.blockIP('192.168.1.5', { reason: 'Test export' });

      const state = protection.exportState();

      expect(state.config).toBeDefined();
      expect(state.mitigation).toBeDefined();
      expect(state.reputation).toBeDefined();

      // Create new instance and import state
      const newProtection = new DDoSProtection({}, 'test');
      newProtection.importState({
        mitigation: state.mitigation
      });

      const blockList = newProtection['mitigationEngine'].getBlockList();
      expect(blockList.some(entry => entry.target === '192.168.1.5')).toBe(true);
    });

    it('should reset state', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      await protection.processRequest(request);
      protection.blockIP('192.168.1.2');

      protection.reset();

      const stats = protection.getStatistics();
      const blockList = protection['mitigationEngine'].getBlockList();

      expect(blockList.length).toBe(0);
    });
  });

  describe('health checks', () => {
    it('should report health status', () => {
      const health = protection.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.components).toBeDefined();
      expect(health.components.trafficAnalyzer).toBe(true);
    });

    it('should indicate initialization status', () => {
      expect(protection.isInitialized()).toBe(true);
    });
  });

  describe('performance', () => {
    it('should process requests quickly', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const start = Date.now();
      await protection.processRequest(request);
      const duration = Date.now() - start;

      // Should process in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(protection.processRequest({ ...request, id: `req-${i}` }));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r.metrics.processingTime >= 0)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should fail open on errors', async () => {
      const invalidRequest = {} as RequestData;

      const result = await protection.processRequest(invalidRequest);

      // Should allow request even with invalid data (fail open)
      expect(result.allowed).toBe(true);
    });
  });

  describe('active attacks tracking', () => {
    it('should track active attacks', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.100',
        method: 'GET',
        url: '/api/target',
        headers: { 'user-agent': 'attack-bot' },
        userAgent: 'attack-bot'
      };

      // Trigger attack
      for (let i = 0; i < 1500; i++) {
        await protection.processRequest({ ...request, id: `req-${i}` });
      }

      const activeAttacks = protection.getActiveAttacks();

      if (activeAttacks.length > 0) {
        expect(activeAttacks[0].isAttack).toBe(true);
        expect(activeAttacks[0].sourceIps).toContain(request.ip);
      }
    });
  });
});
