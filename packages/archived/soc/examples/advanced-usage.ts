/**
 * Advanced Usage Examples - ClaudeFlare SOC
 * Advanced features and integrations
 */

import { SOCFactory, ThreatType } from '../src';

async function advancedThreatDetection() {
  const soc = SOCFactory.createDefault();
  await soc.start();

  // Custom threat detection rules
  const customRequest = {
    body: {
      query: "SELECT * FROM users WHERE email = 'x' OR '1'='1'",
      comment: "<script>alert('XSS')</script>",
      command: "cat /etc/passwd; rm -rf /",
      file: "../../../../../../etc/passwd"
    },
    query: { input: "'; DROP TABLE users; --" },
    path: '/api/admin/delete',
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'X-Forwarded-For': '10.0.0.1'
    },
    ip: '203.0.113.1',
    userId: 'attacker123'
  };

  const detections = soc.analyzeRequest(customRequest);

  console.log('Multiple threat detections:');
  detections.forEach(d => {
    console.log(`- ${d.threatType}: ${d.severity} (${Math.round(d.confidence * 100)}% confidence)`);
  });

  await soc.stop();
}

async function siemIntegration() {
  const soc = SOCFactory.createDefault();
  await soc.start();

  // Ingest various types of logs
  const logs = [
    {
      message: 'Authentication failure',
      level: 'error' as const,
      source: 'authentication',
      details: { userId: 'admin', ip: '192.168.1.50', attempts: 3 },
      tags: ['auth', 'failed']
    },
    {
      message: 'SQL injection attempt blocked',
      level: 'critical' as const,
      source: 'waf',
      details: { ip: '203.0.113.1', payload: '1 OR 1=1' },
      tags: ['waf', 'sql_injection']
    },
    {
      message: 'Unusual data access pattern',
      level: 'warn' as const,
      source: 'application',
      details: { userId: 'user123', records: 5000, duration: 5000 },
      tags: ['data', 'anomaly']
    }
  ];

  const logIds = logs.map(log => soc.ingestLog(log));
  console.log('Ingested logs:', logIds);

  // Query logs with filters
  const errorLogs = soc.queryLogs({ level: 'error', limit: 100 });
  const securityLogs = soc.queryLogs({
    search: 'attack',
    startTime: Date.now() - 3600000
  });

  console.log('Error logs:', errorLogs.total);
  console.log('Security-related logs:', securityLogs.total);

  await soc.stop();
}

async function incidentResponseAutomation() {
  const soc = SOCFactory.create({
    enableAutoResponse: true,
    defaultPlaybooks: [
      'sql_injection_response',
      'ddos_mitigation',
      'malware_response',
      'data_breach_response',
      'phishing_response'
    ]
  });

  await soc.start();

  // Trigger automatic playbook execution
  const detection = soc.analyzeRequest({
    body: { query: "SELECT * FROM users WHERE id = 1; DROP TABLE users; --" },
    ip: '203.0.113.50'
  });

  if (detection.length > 0) {
    console.log('Threat detected, automatic response triggered');

    // Check if playbook was executed
    const executions = soc.getPlaybookExecutions({ playbookId: 'sql_injection_response' });
    console.log('Playbook executions:', executions.length);
  }

  // Manual playbook execution
  const execution = await soc.executePlaybook(
    'ddos_mitigation',
    {
      type: 'manual',
      triggeredBy: 'security_admin'
    },
    {
      attack_ips: ['203.0.113.100', '203.0.113.101'],
      attack_vector: 'HTTP flood'
    }
  );

  console.log('Manual playbook execution:', execution.status);

  await soc.stop();
}

async function vulnerabilityManagement() {
  const soc = SOCFactory.create({
    vulnerabilityScans: {
      enabled: true,
      schedule: 'daily',
      depth: 10
    }
  });

  await soc.start();

  // Scan codebase
  const codeFiles = [
    {
      path: '/src/auth/login.ts',
      content: `
        async function login(username: string, password: string) {
          const query = "SELECT * FROM users WHERE username = '" + username + "'";
          const user = await db.query(query);

          if (user.password === password) {
            return jwt.sign({ userId: user.id }, 'hardcoded_secret_key');
          }
        }
      `
    },
    {
      path: '/src/utils/hash.ts',
      content: `
        import { createHash } from 'crypto';

        function hashPassword(password: string): string {
          return createHash('md5').update(password).digest('hex');
        }
      `
    },
    {
      path: '/src/api/users.ts',
      content: `
        function renderUser(input: string): string {
          return \`<div>\${input}</div>\`;
        }

        function executeCommand(command: string): void {
          const { exec } = require('child_process');
          exec(command, (error, stdout, stderr) => {
            console.log(stdout);
          });
        }
      `
    }
  ];

  const vulnScan = await soc.scanVulnerabilities(codeFiles);

  console.log('Vulnerability scan completed');
  console.log(`Total vulnerabilities: ${vulnScan.results.total}`);
  console.log(`Critical: ${vulnScan.results.critical}`);
  console.log(`High: ${vulnScan.results.high}`);
  console.log(`Medium: ${vulnScan.results.medium}`);
  console.log(`Low: ${vulnScan.results.low}`);

  // Calculate risk score
  const riskScore = soc.calculateRiskScore(vulnScan.vulnerabilities);
  console.log('Risk score:', riskScore.score, `(${riskScore.level})`);

  // Prioritize vulnerabilities
  const prioritized = soc.prioritizeVulnerabilities(vulnScan.vulnerabilities);
  console.log('Top 5 prioritized vulnerabilities:');
  prioritized.slice(0, 5).forEach(vuln => {
    console.log(`- [${vuln.severity}] ${vuln.title}`);
  });

  await soc.stop();
}

async function securityAnalytics() {
  const soc = SOCFactory.create({
    enableBehavioralAnalysis: true,
    baselinePeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  await soc.start();

  // Record behavioral events for profiling
  const userId = 'user123';

  // Normal login pattern
  for (let i = 0; i < 10; i++) {
    soc['behaviorProfiler'].recordEvent(userId, 'login', {
      location: 'New York',
      method: 'password',
      success: true
    });
  }

  // Anomalous event - login from different country
  soc['behaviorProfiler'].recordEvent(userId, 'login', {
    location: 'Moscow',
    method: 'password',
    success: true
  });

  // Get behavior profile
  const profile = soc.getBehaviorProfile(userId);
  console.log('Behavior profile:', {
    riskScore: profile?.riskScore,
    anomalies: profile?.anomalies,
    lastUpdated: profile?.lastUpdated
  });

  // Get security dashboard
  const dashboard = soc.getSecurityDashboard();
  console.log('Security dashboard widgets:', dashboard.widgets.length);

  await soc.stop();
}

async function complianceMonitoring() {
  const soc = SOCFactory.create({
    frameworks: ['SOC2', 'ISO27001', 'GDPR', 'PCI_DSS'],
    assessmentFrequency: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  await soc.start();

  // Assess compliance for multiple frameworks
  const frameworks = ['SOC2', 'ISO27001', 'GDPR'];

  for (const framework of frameworks) {
    const assessment = await soc.assessCompliance(framework);
    console.log(`${framework} compliance:`, assessment.complianceScore.toFixed(1) + '%');
  }

  // Generate compliance report
  const report = await soc.generateComplianceReport('SOC2', {
    start: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days
    end: Date.now()
  });

  console.log('Compliance report generated:', report.id);
  console.log('Total controls:', report.summary.totalControls);
  console.log('Compliant controls:', report.summary.compliantControls);
  console.log('Findings:', report.summary.criticalFindings + ' critical, ' + report.summary.highFindings + ' high');

  // Manage policies
  const policy = soc.createPolicy({
    name: 'Data Retention Policy',
    description: 'Policy for data retention and deletion',
    category: 'Data Protection',
    framework: 'GDPR',
    content: 'All personal data must be retained for no longer than 2 years...',
    owner: 'Data Protection Officer'
  });

  console.log('Policy created:', policy.id);

  await soc.stop();
}

async function threatIntelligence() {
  const soc = SOCFactory.createDefault();
  await soc.start();

  // Add threat indicators
  soc['threatIntelligence'].addIndicator({
    type: 'ip',
    value: '203.0.113.50',
    severity: 'critical',
    description: 'Known botnet C2 server',
    tags: ['botnet', 'c2']
  });

  soc['threatIntelligence'].addIndicator({
    type: 'domain',
    value: 'malicious-domain.example.com',
    severity: 'high',
    description: 'Phishing domain',
    tags: ['phishing']
  });

  soc['threatIntelligence'].addIndicator({
    type: 'hash',
    value: '5d41402abc4b2a76b9719d911017c592',
    severity: 'critical',
    description: 'Known malware hash',
    tags: ['malware']
  });

  // Check indicators
  const ipCheck = soc['threatIntelligence'].checkIndicator('ip', '203.0.113.50');
  console.log('IP threat check:', ipCheck.isThreat, ipCheck.severity);

  const domainCheck = soc['threatIntelligence'].checkIndicator('domain', 'malicious-domain.example.com');
  console.log('Domain threat check:', domainCheck.isThreat);

  // Add threat campaign
  soc['threatIntelligence'].addCampaign({
    name: 'Operation Cloud Attack',
    description: 'Targeted attacks against cloud infrastructure',
    targetIndustries: ['Technology', 'Finance'],
    targetGeographies: ['US', 'EU'],
    tactics: ['Spear phishing', 'Supply chain compromise'],
    techniques: ['DLL side-loading', 'Fileless malware']
  });

  // Get active campaigns
  const campaigns = soc['threatIntelligence'].getActiveCampaigns();
  console.log('Active campaigns:', campaigns.length);

  await soc.stop();
}

// Run examples
async function main() {
  console.log('=== Advanced Threat Detection ===');
  await advancedThreatDetection();

  console.log('\n=== SIEM Integration ===');
  await siemIntegration();

  console.log('\n=== Incident Response Automation ===');
  await incidentResponseAutomation();

  console.log('\n=== Vulnerability Management ===');
  await vulnerabilityManagement();

  console.log('\n=== Security Analytics ===');
  await securityAnalytics();

  console.log('\n=== Compliance Monitoring ===');
  await complianceMonitoring();

  console.log('\n=== Threat Intelligence ===');
  await threatIntelligence();
}

main().catch(console.error);
