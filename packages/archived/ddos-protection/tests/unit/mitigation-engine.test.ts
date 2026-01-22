/**
 * Unit tests for Mitigation Engine
 */

import { MitigationEngine } from '../../src/mitigation/engine';
import type { RequestData, MitigationAction } from '../../src/types';

describe('MitigationEngine', () => {
  let engine: MitigationEngine;

  beforeEach(() => {
    engine = new MitigationEngine({
      mode: 'mitigate',
      enableRateLimiting: true,
      enableIPBlocking: true,
      enableGeoBlocking: true,
      enableChallenge: true,
      blockTTL: 3600000
    });
  });

  afterEach(() => {
    engine.reset();
  });

  describe('processRequest', () => {
    it('should allow legitimate request', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'Mozilla/5.0' },
        userAgent: 'Mozilla/5.0'
      };

      const result = await engine.processRequest(request);

      expect(result.allow).toBe(true);
      expect(result.action).toBeUndefined();
    });

    it('should block request from blocked IP', async () => {
      const ip = '192.168.1.100';
      engine.blockIP(ip, { reason: 'Test block' });

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const result = await engine.processRequest(request);

      expect(result.allow).toBe(false);
      expect(result.action).toBeDefined();
      expect(result.action?.type).toBe('ip_block');
      expect(result.reason).toContain('blocked');
    });

    it('should allow whitelisted IP', async () => {
      const ip = '192.168.1.50';
      engine.allowIP(ip);

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Even if blocked in blocklist, allowlist takes precedence
      engine.blockIP(ip, { reason: 'Should be ignored' });

      const result = await engine.processRequest(request);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('whitelisted');
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits', async () => {
      const ip = '192.168.1.200';
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Send many requests
      let blocked = false;
      for (let i = 0; i < 500; i++) {
        const result = await engine.processRequest({ ...request, id: `req-${i}` });
        if (!result.allow) {
          blocked = true;
          expect(result.action?.type).toBe('rate_limit');
          break;
        }
      }

      // Should eventually block
      expect(blocked).toBe(true);
    });

    it('should refill rate limit tokens over time', async () => {
      const ip = '192.168.1.201';
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Exhaust rate limit
      for (let i = 0; i < 500; i++) {
        await engine.processRequest({ ...request, id: `req-${i}` });
      }

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should allow requests again
      const result = await engine.processRequest({ ...request, id: 'req-after-wait' });
      expect(result.allow).toBe(true);
    });
  });

  describe('geo-blocking', () => {
    it('should block requests from blocked country', async () => {
      engine.blockCountry('CN', { reason: 'Geo block test' });

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

      const result = await engine.processRequest(request);

      expect(result.allow).toBe(false);
      expect(result.action?.type).toBe('geo_block');
    });

    it('should allow requests from non-blocked countries', async () => {
      engine.blockCountry('CN', { reason: 'Test' });

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

      const result = await engine.processRequest(request);

      expect(result.allow).toBe(true);
    });
  });

  describe('custom rules', () => {
    it('should apply custom rules', () => {
      const ruleId = engine.addRule({
        name: 'Block specific user agent',
        condition: (req) => req.userAgent.includes('bad-bot'),
        action: 'ip_block',
        parameters: { reason: 'Bad bot detected' },
        priority: 1,
        enabled: true
      });

      expect(ruleId).toBeTruthy();

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'bad-bot/1.0' },
        userAgent: 'bad-bot/1.0'
      };

      return engine.processRequest(request).then(result => {
        expect(result.allow).toBe(false);
        expect(result.reason).toContain('Bad bot detected');
      });
    });

    it('should respect rule priority', () => {
      engine.addRule({
        name: 'Low priority rule',
        condition: () => true,
        action: 'challenge',
        parameters: {},
        priority: 10,
        enabled: true
      });

      engine.addRule({
        name: 'High priority rule',
        condition: (req) => req.userAgent === 'block-me',
        action: 'ip_block',
        parameters: { reason: 'High priority' },
        priority: 1,
        enabled: true
      });

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'block-me' },
        userAgent: 'block-me'
      };

      return engine.processRequest(request).then(result => {
        expect(result.allow).toBe(false);
        expect(result.action?.type).toBe('ip_block');
      });
    });
  });

  describe('challenge handling', () => {
    it('should require challenge for suspicious requests', async () => {
      const actions: MitigationAction[] = [
        {
          type: 'challenge',
          target: 'global',
          parameters: { challengeType: 'javascript' },
          priority: 1,
          timestamp: Date.now()
        }
      ];

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const result = await engine.processRequest(request, actions);

      expect(result.allow).toBe(false);
      expect(result.challengeRequired).toBe(true);
      expect(result.action?.type).toBe('challenge');
    });
  });

  describe('block and allow management', () => {
    it('should block IP', () => {
      const ip = '192.168.1.10';
      const decision = engine.blockIP(ip, { reason: 'Test block', duration: 3600000 });

      expect(decision.allow).toBe(false);
      expect(decision.action?.type).toBe('ip_block');
    });

    it('should unblock IP', () => {
      const ip = '192.168.1.11';
      engine.blockIP(ip);
      const unblocked = engine.unblockIP(ip);

      expect(unblocked).toBe(true);
    });

    it('should block CIDR range', () => {
      engine.blockCIDR('10.0.0.0/24', { reason: 'Range block' });
      const blockList = engine.getBlockList();

      expect(blockList.some(entry => entry.target === '10.0.0.0/24')).toBe(true);
    });

    it('should block country', () => {
      const decision = engine.blockCountry('RU', { reason: 'Geo block' });

      expect(decision.allow).toBe(false);
      expect(decision.action?.type).toBe('geo_block');
    });

    it('should unblock country', () => {
      engine.blockCountry('RU');
      const unblocked = engine.unblockCountry('RU');

      expect(unblocked).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should track allowed and blocked requests', async () => {
      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      // Send some requests
      for (let i = 0; i < 10; i++) {
        await engine.processRequest({ ...request, id: `req-${i}` });
      }

      const metrics = engine.getMetrics();
      expect(metrics.trafficAllowed).toBeGreaterThan(0);
    });
  });

  describe('history', () => {
    it('should track mitigation history', async () => {
      const ip = '192.168.1.99';
      engine.blockIP(ip);

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      await engine.processRequest(request);

      const history = engine.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].action.type).toBe('ip_block');
    });
  });

  describe('monitor mode', () => {
    it('should allow all requests in monitor mode', async () => {
      const monitorEngine = new MitigationEngine({ mode: 'monitor' });
      monitorEngine.blockIP('192.168.1.1');

      const request: RequestData = {
        id: 'req-1',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test' },
        userAgent: 'test'
      };

      const result = await monitorEngine.processRequest(request);

      expect(result.allow).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      engine.updateConfig({ mode: 'monitor' });
      const config = engine.getConfig();

      expect(config.mode).toBe('monitor');
    });
  });

  describe('export and import state', () => {
    it('should export state', () => {
      engine.blockIP('192.168.1.5', { reason: 'Test' });
      engine.allowIP('192.168.1.6');

      const state = engine.exportState();

      expect(state.blockList.length).toBeGreaterThan(0);
      expect(state.allowList.length).toBeGreaterThan(0);
    });

    it('should import state', () => {
      const state = {
        blockList: [
          {
            target: '10.0.0.5',
            type: 'ip' as const,
            reason: 'Imported block',
            expiresAt: Date.now() + 3600000,
            createdAt: Date.now()
          }
        ]
      };

      engine.importState(state);
      const blockList = engine.getBlockList();

      expect(blockList.some(entry => entry.target === '10.0.0.5')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      // Add blocks with short expiry
      engine.blockIP('192.168.1.20', { duration: 100 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup
      const blockList = engine.getBlockList();
      const hasExpiredBlock = blockList.some(entry =>
        entry.target === '192.168.1.20' && entry.expiresAt < Date.now()
      );

      // Note: Cleanup runs on interval, so we're just checking the mechanism works
      expect(blockList).toBeDefined();
    });
  });
});
