/**
 * Basic Usage Examples
 */

import { DDoSProtection, createDDoSProtectionMiddleware } from '../src';
import type { RequestData, DDoSProtectionConfig } from '../src';

// Example 1: Basic setup
async function basicSetup() {
  const ddos = new DDoSProtection({
    enabled: true,
    mitigationMode: 'mitigate',
    rateLimiting: {
      requestsPerSecond: 100,
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      burstSize: 200,
      windowSize: 60
    }
  });

  const request: RequestData = {
    id: 'req-123',
    timestamp: Date.now(),
    ip: '192.168.1.1',
    method: 'GET',
    url: '/api/users',
    headers: {
      'user-agent': 'Mozilla/5.0',
      'accept': 'application/json'
    },
    userAgent: 'Mozilla/5.0',
    geo: { country: 'US' }
  };

  const result = await ddos.processRequest(request);

  if (result.allowed) {
    console.log('Request allowed');
    // Process request normally
  } else {
    console.log('Request blocked:', result.mitigation?.reason);
    // Return error or challenge
  }
}

// Example 2: Using with Express.js
import express from 'express';

function expressIntegration() {
  const app = express();

  const ddosProtection = new DDoSProtection({
    enabled: true,
    mitigationMode: 'mitigate',
    analytics: true
  });

  // Add DDoS protection middleware
  app.use(createDDoSProtectionMiddleware(ddosProtection) as any);

  app.get('/api/data', (req, res) => {
    res.json({ data: 'protected' });
  });

  app.listen(3000);
}

// Example 3: IP management
async function ipManagement() {
  const ddos = new DDoSProtection();

  // Block an IP
  ddos.blockIP('192.168.1.100', {
    reason: 'Manual block - suspicious activity',
    duration: 3600000 // 1 hour
  });

  // Allow (whitelist) an IP
  ddos.allowIP('192.168.1.50', 86400000); // 24 hours

  // Block a country
  ddos.blockCountry('CN', {
    reason: 'Geo policy'
  });

  // Unblock when needed
  ddos.unblockIP('192.168.1.100');
  ddos.unblockCountry('CN');
}

// Example 4: Monitoring and analytics
async function monitoring() {
  const ddos = new DDoSProtection({ analytics: true });

  // Process some requests...

  // Get analytics
  const analytics = ddos.getAnalytics('hour');
  console.log('Total requests:', analytics.totalRequests);
  console.log('Blocked requests:', analytics.blockedRequests);
  console.log('Attacks detected:', analytics.attacksDetected);

  // Get real-time monitoring
  const realtime = ddos.getRealtimeMonitoring();
  console.log('Current RPS:', realtime.currentRps);
  console.log('System health:', realtime.systemHealth);

  // Get active attacks
  const activeAttacks = ddos.getActiveAttacks();
  console.log('Active attacks:', activeAttacks.length);
}

// Example 5: Challenge handling
async function challenges() {
  const ddos = new DDoSProtection({ challengePlatform: true });

  const request: RequestData = {
    id: 'req-1',
    timestamp: Date.now(),
    ip: '192.168.1.1',
    method: 'GET',
    url: '/api/protected',
    headers: { 'user-agent': 'suspicious-bot' },
    userAgent: 'suspicious-bot'
  };

  const result = await ddos.processRequest(request);

  if (result.challenge?.required) {
    // Return challenge HTML to client
    console.log('Challenge required:', result.challenge.html);

    // Later, verify the challenge response
    const verifyResult = await ddos.verifyChallenge(
      result.challenge.token,
      'solution-from-client'
    );

    if (verifyResult.passed) {
      console.log('Challenge passed - allow request');
    }
  }
}

// Example 6: IP reputation
async function reputation() {
  const ddos = new DDoSProtection({ ipReputation: true });

  // Get IP reputation
  const reputation = await ddos.getIPReputation('192.168.1.1');

  console.log('Score:', reputation.score);
  console.log('Category:', reputation.category);
  console.log('Is TOR:', reputation.isTor);
  console.log('Is VPN:', reputation.isVpn);
  console.log('Abuse score:', reputation.abuseScore);
}

// Example 7: Custom configuration
async function customConfig() {
  const config: Partial<DDoSProtectionConfig> = {
    enabled: true,
    mitigationMode: 'aggressive',
    rateLimiting: {
      requestsPerSecond: 50,
      requestsPerMinute: 500,
      requestsPerHour: 5000,
      burstSize: 100,
      windowSize: 60
    },
    ipReputation: true,
    challengePlatform: true,
    analytics: true,
    whitelist: ['192.168.1.10', '192.168.1.20'],
    blacklist: ['10.0.0.50'],
    geoWhitelist: ['US', 'GB', 'CA'],
    geoBlacklist: ['CN', 'RU'],
    thresholds: {
      requestsPerSecond: 500,
      errorRate: 0.3,
      responseTime: 3000,
      anomalyScore: 0.5,
      riskScore: 0.6
    },
    notifications: {
      enabled: true,
      webhook: 'https://hooks.example.com/ddos-alerts',
      email: ['admin@example.com'],
      thresholds: {
        warning: 0.3,
        critical: 0.7
      }
    }
  };

  const ddos = new DDoSProtection(config, 'production');
}

// Example 8: Environment-specific configurations
async function environmentConfigs() {
  // Development - relaxed settings
  const devDdos = new DDoSProtection({
    mitigationMode: 'monitor',
    rateLimiting: {
      requestsPerSecond: 1000
    }
  }, 'development');

  // Production - strict settings
  const prodDdos = new DDoSProtection({
    mitigationMode: 'aggressive',
    rateLimiting: {
      requestsPerSecond: 100
    }
  }, 'production');
}

// Example 9: Cloudflare Workers integration
import { CloudflareDDoSProtection } from '../src';

async function cloudflareWorkers() {
  const ddos = new CloudflareDDoSProtection({
    enabled: true,
    mitigationMode: 'mitigate'
  });

  // In your Cloudflare Worker
  /*
  export default {
    async fetch(request: Request) {
      const result = await ddos.handleRequest(request);

      if (result) {
        return result; // Request was blocked/challenged
      }

      // Continue with normal request processing
      return fetch(request);
    }
  };
  */
}

// Example 10: State export/import
async function stateManagement() {
  const ddos = new DDoSProtection();

  // Add some blocks...
  ddos.blockIP('192.168.1.100');
  ddos.blockCountry('CN');

  // Export state for backup
  const state = ddos.exportState();
  console.log('Exported state:', JSON.stringify(state, null, 2));

  // Import state (e.g., after restart)
  const newDdos = new DDoSProtection();
  newDdos.importState({
    mitigation: state.mitigation
  });
}

// Example 11: Mitigation metrics
async function mitigationMetrics() {
  const ddos = new DDoSProtection();

  // Process some requests...

  const metrics = ddos.getMitigationMetrics();
  console.log('Traffic blocked:', metrics.trafficBlocked);
  console.log('Traffic allowed:', metrics.trafficAllowed);
  console.log('Average latency:', metrics.averageLatency);
}

// Example 12: Handling attacks
async function attackHandling() {
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

  const result = await ddos.processRequest(request);

  if (result.attack?.isAttack) {
    console.log('Attack detected!');
    console.log('Attack type:', result.attack.attackType);
    console.log('Severity:', result.attack.severity);
    console.log('Source IPs:', result.attack.sourceIps);
    console.log('Recommended actions:', result.attack.mitigationRecommended);

    // Automatically apply recommended mitigations
    for (const action of result.attack.mitigationRecommended) {
      if (action.type === 'ip_block') {
        ddos.blockIP(action.target, action.parameters);
      }
    }
  }
}

// Example 13: Health checks
function healthCheck(ddos: DDoSProtection) {
  const health = ddos.getHealth();

  if (health.status === 'healthy') {
    console.log('DDoS protection is healthy');
  } else {
    console.log('DDoS protection has issues:', health.components);
  }

  // Check initialization
  if (ddos.isInitialized()) {
    console.log('DDoS protection is ready');
  }
}

// Example 14: Performance monitoring
async function performanceMonitoring() {
  const ddos = new DDoSProtection();

  const request: RequestData = {
    id: 'req-1',
    timestamp: Date.now(),
    ip: '192.168.1.1',
    method: 'GET',
    url: '/api/test',
    headers: { 'user-agent': 'test' },
    userAgent: 'test'
  };

  const result = await ddos.processRequest(request);

  console.log('Processing time:', result.metrics.processingTime, 'ms');
  console.log('Timestamp:', new Date(result.metrics.timestamp).toISOString());
}

// Example 15: Custom mitigation rules
async function customRules() {
  const ddos = new DDoSProtection();

  // Add custom rule to block specific user agent
  const engine = ddos['mitigationEngine'];
  const ruleId = engine.addRule({
    name: 'Block curl requests',
    condition: (req) => req.userAgent.includes('curl'),
    action: 'ip_block',
    parameters: { reason: 'CLI tool not allowed' },
    priority: 5,
    enabled: true
  });

  // Disable rule if needed
  engine.toggleRule(ruleId, false);

  // Remove rule
  engine.removeRule(ruleId);
}

export {
  basicSetup,
  expressIntegration,
  ipManagement,
  monitoring,
  challenges,
  reputation,
  customConfig,
  environmentConfigs,
  cloudflareWorkers,
  stateManagement,
  mitigationMetrics,
  attackHandling,
  healthCheck,
  performanceMonitoring,
  customRules
};
