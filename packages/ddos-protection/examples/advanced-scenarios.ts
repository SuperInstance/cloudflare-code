/**
 * Advanced Usage Scenarios
 */

import { DDoSProtection } from '../src';
import type { RequestData, DDoSProtectionConfig, AttackType } from '../src';

// Scenario 1: Handling HTTP flood attacks
async function handleHTTPFlood() {
  const ddos = new DDoSProtection({
    mitigationMode: 'aggressive',
    rateLimiting: {
      requestsPerSecond: 100,
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      burstSize: 200,
      windowSize: 60
    }
  });

  // Simulate HTTP flood
  const attackerIP = '192.168.1.100';
  const legitimateIP = '192.168.1.1';

  // Attacker sends many requests
  for (let i = 0; i < 5000; i++) {
    const request: RequestData = {
      id: `attack-${i}`,
      timestamp: Date.now(),
      ip: attackerIP,
      method: 'GET',
      url: '/api/expensive-endpoint',
      headers: { 'user-agent': 'flood-bot/1.0' },
      userAgent: 'flood-bot/1.0'
    };

    const result = await ddos.processRequest(request);

    if (i === 100) {
      console.log('After 100 requests from attacker:', result.allowed ? 'still allowed' : 'blocked');
    }
  }

  // Legitimate user can still access
  const legitimateRequest: RequestData = {
    id: 'legit-1',
    timestamp: Date.now(),
    ip: legitimateIP,
    method: 'GET',
    url: '/api/expensive-endpoint',
    headers: { 'user-agent': 'Mozilla/5.0' },
    userAgent: 'Mozilla/5.0'
  };

  const result = await ddos.processRequest(legitimateRequest);
  console.log('Legitimate request:', result.allowed ? 'allowed' : 'blocked');
}

// Scenario 2: Slowloris attack mitigation
async function handleSlowloris() {
  const ddos = new DDoSProtection({
    mitigationMode: 'aggressive'
  });

  // Slowloris attackers open many connections and send data very slowly
  const slowIPs = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];

  for (const ip of slowIPs) {
    for (let i = 0; i < 100; i++) {
      const request: RequestData = {
        id: `slow-${ip}-${i}`,
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/slow-target',
        headers: {
          'user-agent': 'slowloris-tool',
          'connection': 'keep-alive'
        },
        userAgent: 'slowloris-tool'
      };

      await ddos.processRequest(request);
    }
  }

  // Check active attacks
  const activeAttacks = ddos.getActiveAttacks();
  console.log('Active slowloris attacks:', activeAttacks.filter(a => a.attackType === 'slowloris'));
}

// Scenario 3: Bot detection and challenge
async function detectAndChallengeBots() {
  const ddos = new DDoSProtection({
    challengePlatform: true,
    ipReputation: true
  });

  // Known bad bot
  const botRequest: RequestData = {
    id: 'bot-1',
    timestamp: Date.now(),
    ip: '192.168.1.200',
    method: 'GET',
    url: '/api/data',
    headers: { 'user-agent': 'bad-scraper/1.0' },
    userAgent: 'bad-scraper/1.0'
  };

  // Send multiple bot requests
  for (let i = 0; i < 50; i++) {
    const result = await ddos.processRequest({
      ...botRequest,
      id: `bot-${i}`
    });

    if (result.challenge?.required) {
      console.log('Challenge required for bot:', result.challenge.type);

      // In real scenario, return challenge to client
      // After solving, verify with ddos.verifyChallenge()
    }
  }

  // Check bot reputation
  const reputation = await ddos.getIPReputation(botRequest.ip);
  console.log('Bot reputation score:', reputation.score);
  console.log('Bot category:', reputation.category);
}

// Scenario 4: Geographic blocking
async function geoBlocking() {
  const ddos = new DDoSProtection({
    enableGeoBlocking: true,
    geoBlacklist: ['CN', 'RU', 'KP']
  });

  const requests = [
    { ip: '1.1.1.1', country: 'US', url: '/api/data' },
    { ip: '2.2.2.2', country: 'CN', url: '/api/data' },
    { ip: '3.3.3.3', country: 'GB', url: '/api/data' },
    { ip: '4.4.4.4', country: 'RU', url: '/api/data' }
  ];

  for (const req of requests) {
    const request: RequestData = {
      id: `geo-${req.ip}`,
      timestamp: Date.now(),
      ip: req.ip,
      method: 'GET',
      url: req.url,
      headers: { 'user-agent': 'test' },
      userAgent: 'test',
      geo: { country: req.country }
    };

    const result = await ddos.processRequest(request);
    console.log(`${req.country} (${req.ip}):`, result.allowed ? 'allowed' : 'blocked');
  }
}

// Scenario 5: API rate limiting per endpoint
async function perEndpointRateLimiting() {
  const ddos = new DDoSProtection();

  // Add custom rule for expensive endpoint
  const engine = ddos['mitigationEngine'];

  engine.addRule({
    name: 'Limit /api/search',
    condition: (req) => {
      return req.url.includes('/api/search') &&
             req.headers['x-request-count'] &&
             parseInt(req.headers['x-request-count'] as string, 10) > 10;
    },
    action: 'rate_limit',
    parameters: {
      requestsPerSecond: 5,
      endpoint: '/api/search'
    },
    priority: 3,
    enabled: true
  });

  // Test the rate limit
  for (let i = 0; i < 20; i++) {
    const request: RequestData = {
      id: `search-${i}`,
      timestamp: Date.now(),
      ip: '192.168.1.50',
      method: 'GET',
      url: '/api/search?q=test',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-request-count': i.toString()
      },
      userAgent: 'Mozilla/5.0'
    };

    const result = await ddos.processRequest(request);
    if (!result.allowed && i > 10) {
      console.log(`Request ${i} rate limited as expected`);
      break;
    }
  }
}

// Scenario 6: Whitelist trusted partners
async function whitelistPartners() {
  const config: Partial<DDoSProtectionConfig> = {
    whitelist: [
      '192.168.100.0/24',  // Partner network 1
      '10.20.30.0/24'      // Partner network 2
    ],
    rateLimiting: {
      requestsPerSecond: 100,
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      burstSize: 200,
      windowSize: 60
    }
  };

  const ddos = new DDoSProtection(config);

  // Add individual IPs to whitelist
  ddos.allowIP('192.168.100.10', 86400000); // 24 hours

  // Partner can send many requests
  const partnerIP = '192.168.100.10';
  for (let i = 0; i < 1000; i++) {
    const request: RequestData = {
      id: `partner-${i}`,
      timestamp: Date.now(),
      ip: partnerIP,
      method: 'POST',
      url: '/api/partner-data',
      headers: { 'user-agent': 'PartnerAPI/1.0' },
      userAgent: 'PartnerAPI/1.0'
    };

    const result = await ddos.processRequest(request);
    if (i === 999) {
      console.log('Partner request 999:', result.allowed ? 'still allowed' : 'blocked');
    }
  }
}

// Scenario 7: Adaptive mitigation based on attack type
async function adaptiveMitigation() {
  const ddos = new DDoSProtection();

  const request: RequestData = {
    id: 'req-1',
    timestamp: Date.now(),
    ip: '192.168.1.100',
    method: 'GET',
    url: '/api/target',
    headers: { 'user-agent': 'attack-bot' },
    userAgent: 'attack-bot'
  };

  // Simulate attack
  for (let i = 0; i < 2000; i++) {
    await ddos.processRequest({ ...request, id: `req-${i}` });
  }

  // Check what attack was detected
  const activeAttacks = ddos.getActiveAttacks();
  for (const attack of activeAttacks) {
    console.log('Attack type:', attack.attackType);
    console.log('Severity:', attack.severity);
    console.log('Recommended actions:');

    for (const action of attack.mitigationRecommended) {
      console.log(`  - ${action.type}:`, action.parameters);

      // Apply mitigation based on attack type
      switch (action.type) {
        case 'ip_block':
          ddos.blockIP(action.target, action.parameters);
          break;
        case 'rate_limit':
          console.log('Rate limiting applied');
          break;
        case 'challenge':
          console.log('Challenge will be presented');
          break;
        case 'geo_block':
          ddos.blockCountry(action.target, action.parameters);
          break;
      }
    }
  }
}

// Scenario 8: Real-time monitoring dashboard data
async function dashboardData() {
  const ddos = new DDoSProtection({ analytics: true });

  // Generate some traffic
  const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
  for (const ip of ips) {
    for (let i = 0; i < 100; i++) {
      const request: RequestData = {
        id: `${ip}-${i}`,
        timestamp: Date.now(),
        ip,
        method: 'GET',
        url: '/api/data',
        headers: { 'user-agent': 'Mozilla/5.0' },
        userAgent: 'Mozilla/5.0',
        geo: { country: 'US' }
      };

      await ddos.processRequest(request);
    }
  }

  // Get dashboard data
  const analytics = ddos.getAnalytics('hour');
  const realtime = ddos.getRealtimeMonitoring();
  const mitigation = ddos.getMitigationMetrics();

  console.log('=== Dashboard Data ===');
  console.log('Total requests:', analytics.totalRequests);
  console.log('Current RPS:', realtime.currentRps);
  console.log('System health:', realtime.systemHealth.status);
  console.log('Traffic blocked:', mitigation.trafficBlocked);
  console.log('Traffic allowed:', mitigation.trafficAllowed);
  console.log('Top attack types:', analytics.topAttackTypes);
}

// Scenario 9: Multi-layered defense
async function multiLayeredDefense() {
  const ddos = new DDoSProtection({
    ipReputation: true,
    challengePlatform: true,
    mitigationMode: 'aggressive'
  });

  // Layer 1: IP reputation check
  const suspiciousIP = '192.168.1.100';
  let reputation = await ddos.getIPReputation(suspiciousIP);
  console.log('Initial reputation:', reputation.category);

  // Layer 2: Rate limiting
  for (let i = 0; i < 500; i++) {
    const request: RequestData = {
      id: `req-${i}`,
      timestamp: Date.now(),
      ip: suspiciousIP,
      method: 'GET',
      url: '/api/data',
      headers: { 'user-agent': 'bot' },
      userAgent: 'bot'
    };

    const result = await ddos.processRequest(request);

    if (result.challenge?.required) {
      console.log('Layer 3: Challenge required at request', i);
      break;
    }

    if (!result.allowed) {
      console.log('Layer 2: Rate limited at request', i);
      break;
    }
  }

  // Check updated reputation
  reputation = await ddos.getIPReputation(suspiciousIP);
  console.log('Updated reputation:', reputation.category);
}

// Scenario 10: Graduated response (escalation)
async function graduatedResponse() {
  const ddos = new DDoSProtection({ mitigationMode: 'mitigate' });

  const ip = '192.168.1.100';

  // Level 1: Monitor (first 100 requests)
  console.log('Level 1: Monitoring...');
  for (let i = 0; i < 100; i++) {
    await ddos.processRequest({
      id: `req-${i}`,
      timestamp: Date.now(),
      ip,
      method: 'GET',
      url: '/api/data',
      headers: { 'user-agent': 'test' },
      userAgent: 'test'
    });
  }

  // Level 2: Rate limit (next 500 requests)
  console.log('Level 2: Rate limiting...');
  for (let i = 100; i < 600; i++) {
    const result = await ddos.processRequest({
      id: `req-${i}`,
      timestamp: Date.now(),
      ip,
      method: 'GET',
      url: '/api/data',
      headers: { 'user-agent': 'test' },
      userAgent: 'test'
    });

    if (!result.allow) {
      console.log('Rate limiting activated at request', i);
      break;
    }
  }

  // Level 3: Challenge (if rate limiting doesn't help)
  console.log('Level 3: Challenging...');
  const result = await ddos.processRequest({
    id: 'req-challenge',
    timestamp: Date.now(),
    ip,
    method: 'GET',
    url: '/api/data',
    headers: { 'user-agent': 'bot' },
    userAgent: 'bot'
  });

  if (result.challenge?.required) {
    console.log('Challenge required');
  }

  // Level 4: Block (if challenges fail)
  ddos.blockIP(ip, { reason: 'Escalated to block after multiple violations' });
  console.log('Level 4: Blocked IP');
}

// Scenario 11: DDoS simulation and testing
async function simulateDDoS() {
  const ddos = new DDoSProtection({
    mitigationMode: 'aggressive',
    rateLimiting: {
      requestsPerSecond: 100,
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      burstSize: 200,
      windowSize: 60
    }
  });

  console.log('Starting DDoS simulation...');

  // Simulate volumetric attack from multiple IPs
  const attackIPs = Array.from({ length: 50 }, (_, i) => `10.0.${Math.floor(i / 256)}.${i % 256}`);

  const startTime = Date.now();
  let totalRequests = 0;
  let blockedRequests = 0;

  // Send burst of traffic
  for (let i = 0; i < 10000; i++) {
    const ip = attackIPs[i % attackIPs.length];
    const request: RequestData = {
      id: `attack-${i}`,
      timestamp: Date.now(),
      ip,
      method: 'GET',
      url: '/api/target',
      headers: { 'user-agent': 'ddos-bot' },
      userAgent: 'ddos-bot'
    };

    const result = await ddos.processRequest(request);
    totalRequests++;

    if (!result.allowed) {
      blockedRequests++;
    }

    if (i % 1000 === 0) {
      console.log(`Processed ${i} requests, ${blockedRequests} blocked`);
    }
  }

  const duration = Date.now() - startTime;
  console.log('\n=== Simulation Results ===');
  console.log('Total requests:', totalRequests);
  console.log('Blocked requests:', blockedRequests);
  console.log('Block rate:', ((blockedRequests / totalRequests) * 100).toFixed(2) + '%');
  console.log('Duration:', duration, 'ms');
  console.log('Requests per second:', (totalRequests / (duration / 1000)).toFixed(2));

  // Check attack detection
  const activeAttacks = ddos.getActiveAttacks();
  console.log('Attacks detected:', activeAttacks.length);
}

export {
  handleHTTPFlood,
  handleSlowloris,
  detectAndChallengeBots,
  geoBlocking,
  perEndpointRateLimiting,
  whitelistPartners,
  adaptiveMitigation,
  dashboardData,
  multiLayeredDefense,
  graduatedResponse,
  simulateDDoS
};
