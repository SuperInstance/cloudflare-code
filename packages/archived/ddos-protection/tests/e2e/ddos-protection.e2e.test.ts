/**
 * End-to-End Tests for DDoS Protection
 */

import { DDoSProtection } from '../../src';
import type { RequestData, DDoSProtectionConfig } from '../../src';

describe('DDoS Protection E2E Tests', () => {
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

  describe('Complete DDoS attack lifecycle', () => {
    it('should detect, mitigate, and recover from volumetric attack', async () => {
      const attackerIP = '192.168.100.1';
      const legitimateIP = '192.168.1.10';

      // Phase 1: Normal traffic baseline
      console.log('\n=== Phase 1: Baseline ===');
      for (let i = 0; i < 50; i++) {
        const request: RequestData = {
          id: `baseline-${i}`,
          timestamp: Date.now(),
          ip: legitimateIP,
          method: 'GET',
          url: '/api/data',
          headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
          userAgent: 'Mozilla/5.0',
          geo: { country: 'US' }
        };

        const result = await protection.processRequest(request);
        expect(result.allowed).toBe(true);
      }

      // Phase 2: Attack begins
      console.log('\n=== Phase 2: Attack Start ===');
      let attackDetected = false;
      for (let i = 0; i < 2000; i++) {
        const request: RequestData = {
          id: `attack-${i}`,
          timestamp: Date.now(),
          ip: attackerIP,
          method: 'GET',
          url: '/api/expensive',
          headers: { 'user-agent': 'attack-bot/1.0', 'status': '200', 'x-response-time': '50' },
          userAgent: 'attack-bot/1.0',
          geo: { country: 'CN' }
        };

        const result = await protection.processRequest(request);

        if (result.attack?.isAttack && !attackDetected) {
          console.log('Attack detected at request', i);
          attackDetected = true;
        }

        if (!result.allowed) {
          console.log('Mitigation activated at request', i);
          break;
        }
      }

      expect(attackDetected).toBe(true);

      // Phase 3: Verify mitigation is working
      console.log('\n=== Phase 3: Mitigation Active ===');
      const blockedRequests = [];
      for (let i = 0; i < 100; i++) {
        const request: RequestData = {
          id: `during-attack-${i}`,
          timestamp: Date.now(),
          ip: attackerIP,
          method: 'GET',
          url: '/api/expensive',
          headers: { 'user-agent': 'attack-bot/1.0', 'status': '200', 'x-response-time': '50' },
          userAgent: 'attack-bot/1.0'
        };

        const result = await protection.processRequest(request);
        if (!result.allowed) {
          blockedRequests.push(result);
        }
      }

      console.log('Blocked requests:', blockedRequests.length, 'out of 100');
      expect(blockedRequests.length).toBeGreaterThan(50);

      // Phase 4: Legitimate traffic still allowed
      console.log('\n=== Phase 4: Legitimate Traffic ===');
      let legitimateAllowed = 0;
      for (let i = 0; i < 50; i++) {
        const request: RequestData = {
          id: `legit-${i}`,
          timestamp: Date.now(),
          ip: legitimateIP,
          method: 'GET',
          url: '/api/data',
          headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
          userAgent: 'Mozilla/5.0',
          geo: { country: 'US' }
        };

        const result = await protection.processRequest(request);
        if (result.allowed) {
          legitimateAllowed++;
        }
      }

      console.log('Legitimate requests allowed:', legitimateAllowed, 'out of 50');
      expect(legitimateAllowed).toBeGreaterThan(40); // At least 80% allowed

      // Phase 5: Check analytics
      console.log('\n=== Phase 5: Analytics ===');
      const analytics = protection.getAnalytics('hour');
      console.log('Total requests:', analytics.totalRequests);
      console.log('Blocked requests:', analytics.blockedRequests);
      console.log('Attacks detected:', analytics.attacksDetected);
      console.log('Attacks mitigated:', analytics.attacksMitigated);

      expect(analytics.attacksDetected).toBeGreaterThan(0);
      expect(analytics.blockedRequests).toBeGreaterThan(0);
    });
  });

  describe('Multi-vector attack simulation', () => {
    it('should handle simultaneous attack vectors', async () => {
      const attackers = [
        { ip: '10.0.0.1', type: 'volumetric' as const },
        { ip: '10.0.0.2', type: 'application' as const },
        { ip: '10.0.0.3', type: 'bot' as const }
      ];

      console.log('\n=== Multi-Vector Attack ===');

      // Launch all attacks simultaneously
      const attackPromises = attackers.map(attacker =>
        simulateAttack(attacker.ip, attacker.type, 500)
      );

      await Promise.all(attackPromises);

      // Check detection
      const activeAttacks = protection.getActiveAttacks();
      console.log('Active attacks detected:', activeAttacks.length);

      expect(activeAttacks.length).toBeGreaterThan(0);

      // Verify system is still responsive
      const legitRequest: RequestData = {
        id: 'legit-check',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/health',
        headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '50' },
        userAgent: 'Mozilla/5.0',
        geo: { country: 'US' }
      };

      const result = await protection.processRequest(legitRequest);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Challenge flow', () => {
    it('should complete full challenge lifecycle', async () => {
      const suspiciousIP = '192.168.50.1';

      // Trigger suspicious behavior
      console.log('\n=== Triggering Challenge ===');
      for (let i = 0; i < 200; i++) {
        const request: RequestData = {
          id: `suspicious-${i}`,
          timestamp: Date.now(),
          ip: suspiciousIP,
          method: 'GET',
          url: '/api/protected',
          headers: { 'user-agent': 'suspicious-bot' },
          userAgent: 'suspicious-bot'
        };

        const result = await protection.processRequest(request);

        if (result.challenge?.required) {
          console.log('Challenge required at request', i);
          console.log('Challenge type:', result.challenge.type);
          console.log('Challenge token:', result.challenge.token);

          // Simulate client solving challenge
          const verifyResult = await protection.verifyChallenge(
            result.challenge.token,
            'solution-would-go-here'
          );

          console.log('Challenge verification:', verifyResult.passed);
          break;
        }
      }

      // Check reputation after challenge
      const reputation = await protection.getIPReputation(suspiciousIP);
      console.log('IP reputation after challenge:', reputation.score, reputation.category);
    });
  });

  describe('IP reputation evolution', () => {
    it('should track reputation changes over time', async () => {
      const ip = '192.168.200.1';

      // Start with good behavior
      console.log('\n=== Phase 1: Good Behavior ===');
      for (let i = 0; i < 100; i++) {
        const request: RequestData = {
          id: `good-${i}`,
          timestamp: Date.now(),
          ip,
          method: 'GET',
          url: '/api/data',
          headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
          userAgent: 'Mozilla/5.0'
        };

        await protection.processRequest(request);
      }

      let reputation = await protection.getIPReputation(ip);
      console.log('Reputation after good behavior:', reputation.score, reputation.category);
      expect(reputation.score).toBeGreaterThan(0.5);

      // Transition to bad behavior
      console.log('\n=== Phase 2: Bad Behavior ===');
      for (let i = 0; i < 500; i++) {
        const request: RequestData = {
          id: `bad-${i}`,
          timestamp: Date.now(),
          ip,
          method: 'GET',
          url: '/admin',
          headers: { 'user-agent': 'malicious-bot' },
          userAgent: 'malicious-bot'
        };

        await protection.processRequest(request);
      }

      reputation = await protection.getIPReputation(ip);
      console.log('Reputation after bad behavior:', reputation.score, reputation.category);
      expect(reputation.score).toBeLessThan(0.5);

      // Check history
      const history = protection['reputationManager'].getHistory(ip);
      console.log('Reputation history entries:', history.length);
    });
  });

  describe('Geo-blocking effectiveness', () => {
    it('should effectively block geographic attacks', async () => {
      // Block China
      protection.blockCountry('CN', { reason: 'Geo policy test' });

      const results = {
        allowed: 0,
        blocked: 0
      };

      // Try from China
      for (let i = 0; i < 100; i++) {
        const request: RequestData = {
          id: `cn-${i}`,
          timestamp: Date.now(),
          ip: '1.2.3.4',
          method: 'GET',
          url: '/api/data',
          headers: { 'user-agent': 'test' },
          userAgent: 'test',
          geo: { country: 'CN' }
        };

        const result = await protection.processRequest(request);
        if (result.allowed) {
          results.allowed++;
        } else {
          results.blocked++;
        }
      }

      console.log('CN requests - Allowed:', results.allowed, 'Blocked:', results.blocked);
      expect(results.blocked).toBe(100);

      // Try from US
      results.allowed = 0;
      results.blocked = 0;

      for (let i = 0; i < 100; i++) {
        const request: RequestData = {
          id: `us-${i}`,
          timestamp: Date.now(),
          ip: '5.6.7.8',
          method: 'GET',
          url: '/api/data',
          headers: { 'user-agent': 'test' },
          userAgent: 'test',
          geo: { country: 'US' }
        };

        const result = await protection.processRequest(request);
        if (result.allowed) {
          results.allowed++;
        } else {
          results.blocked++;
        }
      }

      console.log('US requests - Allowed:', results.allowed, 'Blocked:', results.blocked);
      expect(results.allowed).toBeGreaterThan(90);
    });
  });

  describe('Performance under load', () => {
    it('should maintain performance under high load', async () => {
      const requestCount = 5000;
      const processingTimes: number[] = [];

      console.log(`\n=== Processing ${requestCount} requests ===`);

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        const request: RequestData = {
          id: `load-${i}`,
          timestamp: Date.now(),
          ip: `192.168.${Math.floor(i / 256)}.${i % 256}`,
          method: 'GET',
          url: '/api/data',
          headers: { 'user-agent': 'test', 'status': '200', 'x-response-time': '50' },
          userAgent: 'test'
        };

        const start = Date.now();
        await protection.processRequest(request);
        const duration = Date.now() - start;
        processingTimes.push(duration);

        if (i > 0 && i % 1000 === 0) {
          console.log(`Processed ${i} requests...`);
        }
      }

      const totalTime = Date.now() - startTime;
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);
      const requestsPerSecond = (requestCount / (totalTime / 1000)).toFixed(2);

      console.log('\n=== Performance Results ===');
      console.log('Total time:', totalTime, 'ms');
      console.log('Average processing time:', avgProcessingTime.toFixed(2), 'ms');
      console.log('Max processing time:', maxProcessingTime, 'ms');
      console.log('Requests per second:', requestsPerSecond);

      // Verify performance requirements
      expect(avgProcessingTime).toBeLessThan(100); // Sub-100ms average
      expect(parseFloat(requestsPerSecond)).toBeGreaterThan(100); // At least 100 RPS
    });
  });

  describe('Recovery after attack', () => {
    it('should recover properly after attack subsides', async () => {
      const attackerIP = '192.168.100.1';

      // Launch attack
      console.log('\n=== Launching Attack ===');
      for (let i = 0; i < 3000; i++) {
        await protection.processRequest({
          id: `attack-${i}`,
          timestamp: Date.now(),
          ip: attackerIP,
          method: 'GET',
          url: '/api/target',
          headers: { 'user-agent': 'attack-bot' },
          userAgent: 'attack-bot'
        });
      }

      const duringAttack = await protection.processRequest({
        id: 'during-attack',
        timestamp: Date.now(),
        ip: attackerIP,
        method: 'GET',
        url: '/api/target',
        headers: { 'user-agent': 'attack-bot' },
        userAgent: 'attack-bot'
      });

      console.log('During attack - allowed:', duringAttack.allowed);

      // Wait for attack to subside
      console.log('\n=== Attack Subsiding ===');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if system recovers
      const legitimateRequest: RequestData = {
        id: 'recovery-test',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/data',
        headers: { 'user-agent': 'Mozilla/5.0', 'status': '200', 'x-response-time': '100' },
        userAgent: 'Mozilla/5.0',
        geo: { country: 'US' }
      };

      const afterRecovery = await protection.processRequest(legitimateRequest);
      console.log('After recovery - allowed:', afterRecovery.allowed);

      expect(afterRecovery.allowed).toBe(true);
    });
  });
});

// Helper function to simulate different attack types
async function simulateAttack(ip: string, type: string, count: number): Promise<void> {
  const protection = new DDoSProtection();

  for (let i = 0; i < count; i++) {
    let url = '/api/data';
    let userAgent = 'bot';

    switch (type) {
      case 'volumetric':
        url = '/api/expensive';
        userAgent = 'volumetric-bot';
        break;
      case 'application':
        url = '/admin/login';
        userAgent = 'sql-inject-bot';
        break;
      case 'bot':
        url = '/api/scrape';
        userAgent = 'scraper-bot';
        break;
    }

    await protection.processRequest({
      id: `${type}-${i}`,
      timestamp: Date.now(),
      ip,
      method: 'GET',
      url,
      headers: { 'user-agent': userAgent },
      userAgent
    });
  }
}
