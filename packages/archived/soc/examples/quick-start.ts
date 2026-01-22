/**
 * Quick Start Example - ClaudeFlare SOC
 * Basic usage of the SOC engine
 */

import { SOCFactory } from '../src';

async function main() {
  // Create SOC engine with default configuration
  const soc = SOCFactory.createDefault();

  // Start the SOC engine
  await soc.start();
  console.log('SOC engine started');

  // Example 1: Analyze incoming requests for threats
  const requestAnalysis = soc.analyzeRequest({
    body: { query: "SELECT * FROM users WHERE id = 1 OR 1=1" },
    query: {},
    path: '/api/users',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    ip: '192.168.1.100',
    userId: 'user123'
  });

  console.log('Threat detections:', requestAnalysis);

  // Example 2: Ingest security logs
  const logId = soc.ingestLog({
    message: 'Failed login attempt for user admin',
    level: 'error',
    source: 'authentication',
    details: {
      userId: 'admin',
      attempts: 5,
      ip: '192.168.1.50'
    }
  });

  console.log('Log ingested:', logId);

  // Example 3: Query logs
  const logs = soc.queryLogs({
    level: 'error',
    limit: 10
  });

  console.log('Recent error logs:', logs);

  // Example 4: Scan for vulnerabilities
  const vulnScan = await soc.scanVulnerabilities([
    {
      path: '/app/user.ts',
      content: `
        const query = "SELECT * FROM users WHERE id = " + userInput;
        await db.execute(query);
      `
    }
  ]);

  console.log('Vulnerability scan results:', vulnScan);

  // Example 5: Get security dashboard
  const dashboard = soc.getSecurityDashboard();
  console.log('Security dashboard:', dashboard);

  // Example 6: Execute playbook manually
  const playbookExecution = await soc.executePlaybook(
    'sql_injection_response',
    {
      type: 'manual',
      triggeredBy: 'security_admin'
    },
    {
      source: { ip: '192.168.1.100' }
    }
  );

  console.log('Playbook execution:', playbookExecution);

  // Example 7: Get compliance status
  const complianceStatus = await soc.assessCompliance('SOC2');
  console.log('Compliance status:', complianceStatus);

  // Example 8: Generate compliance report
  const complianceReport = await soc.generateComplianceReport('SOC2', {
    start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    end: Date.now()
  });

  console.log('Compliance report:', complianceReport);

  // Stop the SOC engine
  await soc.stop();
  console.log('SOC engine stopped');
}

// Run the example
main().catch(console.error);
