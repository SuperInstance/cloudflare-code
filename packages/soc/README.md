# ClaudeFlare SOC (Security Operations Center)

Comprehensive Security Operations Center for the ClaudeFlare distributed AI coding platform on Cloudflare Workers.

## Features

### 🔍 Threat Detection
- **Signature-based Detection**: Detects known attack patterns using regex and pattern matching
- **Anomaly-based Detection**: Identifies unusual behavior using statistical analysis and baselines
- **Behavioral Analysis**: Profiles user and system behavior to detect anomalies
- **Supported Threats**: SQL injection, XSS, CSRF, DDoS, brute force, command injection, path traversal, data exfiltration, malware, phishing, and more

### 📊 SIEM (Security Information and Event Management)
- **Log Collection**: Collect and normalize logs from multiple sources
- **Log Parsing**: Built-in parsers for Apache, Nginx, JSON, Syslog, and custom formats
- **Event Correlation**: Real-time correlation of security events using configurable rules
- **Alert Management**: Automated alert generation and notification
- **Query Interface**: Powerful log querying with filters and search

### 🚨 Incident Response
- **Automated Playbooks**: Pre-built response workflows for common threats
- **Custom Playbooks**: Create custom response automation
- **Execution Engine**: Execute playbooks with approval workflows
- **Response Actions**: Block, allow, quarantine, isolate, alert, and log actions
- **Rollback Support**: Automatic rollback capabilities for response actions

### 🔬 Vulnerability Management
- **Code Scanning**: Static analysis security testing (SAST)
- **Dependency Scanning**: Software composition analysis (SCA)
- **Custom Rules**: Define custom vulnerability detection rules
- **Risk Assessment**: Calculate risk scores with multiple factors
- **Prioritization**: Intelligent vulnerability prioritization
- **Remediation Tracking**: Track vulnerabilities from discovery to resolution

### 📈 Security Analytics
- **Metrics Calculation**: Comprehensive security metrics
- **Trend Analysis**: Identify trends and patterns in security data
- **Behavior Profiling**: Build profiles for entities to detect anomalies
- **Dashboard**: Security dashboard with customizable widgets
- **Threat Intelligence**: Manage threat indicators and intelligence

### ✅ Compliance Monitoring
- **Multiple Frameworks**: SOC 2, ISO 27001, GDPR, PCI DSS, NIST
- **Control Library**: Pre-built controls for each framework
- **Automated Testing**: Automated compliance control testing
- **Reporting**: Generate comprehensive compliance reports
- **Policy Management**: Create and manage security policies
- **Exception Management**: Handle policy exceptions with approval workflows

## Installation

```bash
npm install @claudeflare/soc
```

## Quick Start

```typescript
import { SOCFactory } from '@claudeflare/soc';

// Create SOC engine with default configuration
const soc = SOCFactory.createDefault();

// Start the SOC engine
await soc.start();

// Analyze incoming requests for threats
const detections = soc.analyzeRequest({
  body: { query: "SELECT * FROM users WHERE id = 1 OR 1=1" },
  ip: '192.168.1.100',
  path: '/api/users',
  method: 'GET'
});

console.log('Threats detected:', detections);

// Ingest security logs
const logId = soc.ingestLog({
  message: 'Failed login attempt',
  level: 'error',
  source: 'authentication',
  details: { userId: 'admin', attempts: 5 }
});

// Scan for vulnerabilities
const vulnScan = await soc.scanVulnerabilities([
  {
    path: '/app/user.ts',
    content: "const query = 'SELECT * FROM users WHERE id = ' + input;"
  }
]);

// Get security dashboard
const dashboard = soc.getSecurityDashboard();
console.log('Security metrics:', dashboard.metrics);

// Stop the SOC engine
await soc.stop();
```

## Configuration

```typescript
import { SOCFactory } from '@claudeflare/soc';

const soc = SOCFactory.create({
  // Detection settings
  enableThreatDetection: true,
  detectionMethods: ['signature', 'anomaly', 'behavioral'],
  falsePositiveThreshold: 0.3,

  // SIEM settings
  enableSIEM: true,
  logRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxLogSize: 10000,
  enableRealtimeAlerting: true,

  // Response settings
  enableAutoResponse: true,
  requireApprovalFor: ['isolate'],
  defaultPlaybooks: ['sql_injection_response', 'ddos_mitigation'],

  // Vulnerability scanning
  vulnerabilityScans: {
    enabled: true,
    schedule: 'daily',
    depth: 10
  },

  // Analytics settings
  enableBehavioralAnalysis: true,
  baselinePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  anomalyThreshold: 3,

  // Compliance settings
  frameworks: ['SOC2', 'ISO27001', 'GDPR'],
  assessmentFrequency: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Integrations
  integrations: {
    slack: {
      webhookUrl: 'https://hooks.slack.com/services/...',
      channel: '#security',
      username: 'SOC Bot',
      notifyOn: ['critical', 'high']
    },
    email: {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      username: 'soc@example.com',
      password: '***',
      from: 'soc@example.com',
      to: ['security@example.com']
    }
  }
});
```

## Threat Detection

### Signature-Based Detection

```typescript
const detections = soc.analyzeRequest({
  body: { input: "<script>alert('XSS')</script>" },
  ip: '192.168.1.100'
});

detections.forEach(detection => {
  console.log(`Threat: ${detection.threatType}`);
  console.log(`Severity: ${detection.severity}`);
  console.log(`Confidence: ${detection.confidence}`);
  console.log(`Blocked: ${detection.isBlocked}`);
});
```

### Anomaly Detection

```typescript
const detector = soc['threatDetection'].getAnomalyDetector();

// Build baseline
for (let i = 0; i < 100; i++) {
  detector.recordMetric('requests_per_second', 50 + Math.random() * 10);
}

// Check for anomalies
const anomaly = detector.detectAnomaly('requests_per_second', 500);
if (anomaly) {
  console.log(`Anomaly detected: ${anomaly.severity}`);
  console.log(`Deviation: ${anomaly.deviationScore}`);
}
```

### Behavioral Analysis

```typescript
const analyzer = soc['threatDetection'].getBehavioralAnalyzer();

// Record events
analyzer.analyzeBehavior('user123', 'user', {
  action: 'login',
  resource: '/dashboard',
  timestamp: Date.now(),
  location: 'New York'
});

// Check for anomalies
const analysis = analyzer.analyzeBehavior('user123', 'user', {
  action: 'login',
  resource: '/admin',
  timestamp: Date.now(),
  location: 'Moscow' // Unusual location
});

if (analysis.isAnomalous) {
  console.log(`Anomalous behavior detected (risk score: ${analysis.riskScore})`);
  console.log(`Reasons:`, analysis.reasons);
}
```

## SIEM

### Log Ingestion

```typescript
// Ingest log
const logId = soc.ingestLog({
  message: 'Authentication failure',
  level: 'error',
  source: 'authentication',
  details: {
    userId: 'admin',
    ip: '192.168.1.50',
    attempts: 5
  },
  tags: ['auth', 'failed']
});

// Parse raw log
const parsedLog = soc['logCollector'].parse(
  '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234',
  'apache_access',
  { source: 'web_server' }
);
```

### Log Querying

```typescript
// Query logs
const logs = soc.queryLogs({
  level: 'error',
  startTime: Date.now() - 3600000, // Last hour
  limit: 100
});

console.log(`Found ${logs.total} error logs`);
logs.logs.forEach(log => {
  console.log(`[${log.level}] ${log.message}`);
});
```

### Event Correlation

```typescript
// Add correlation rule
const correlator = soc['eventCorrelator'];

correlator.addRule({
  id: 'multiple_failed_logins',
  name: 'Multiple Failed Login Attempts',
  description: 'Detects brute force attacks',
  conditions: [
    { field: 'level', operator: 'equals', value: 'error' },
    { field: 'message', operator: 'contains', value: 'failed login' }
  ],
  timeWindow: 300000, // 5 minutes
  threshold: 5,
  severity: 'high',
  enabled: true,
  actions: ['alert', 'block']
});

// Get correlated events
const correlations = correlator.getCorrelatedEvents({
  severity: 'high',
  status: 'open'
});
```

## Incident Response

### Execute Playbook

```typescript
// Automatic execution
const execution = await soc.executePlaybook(
  'sql_injection_response',
  {
    type: 'automatic',
    detectionId: 'detection-123'
  },
  {
    source: { ip: '192.168.1.100' },
    threat: { threatType: 'sql_injection' }
  }
);

console.log(`Playbook status: ${execution.status}`);
console.log(`Steps executed: ${execution.steps.length}`);

// Manual execution
const manualExecution = await soc.executePlaybook(
  'ddos_mitigation',
  {
    type: 'manual',
    triggeredBy: 'security_admin'
  },
  {
    attack_ips: ['203.0.113.100', '203.0.113.101']
  }
);
```

### Custom Playbooks

```typescript
const playbookLibrary = soc['playbookLibrary'];

playbookLibrary.addPlaybook({
  id: 'custom_response',
  name: 'Custom Security Response',
  description: 'Custom response playbook',
  threatType: 'sql_injection',
  version: '1.0.0',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  author: 'security_team',
  enabled: true,
  triggerConditions: [
    { field: 'threatType', operator: 'equals', value: 'sql_injection' }
  ],
  steps: [
    {
      id: 'block_ip',
      name: 'Block Source IP',
      description: 'Block the attacking IP',
      order: 1,
      action: 'block',
      target: '${source.ip}',
      automated: true,
      requiresApproval: false,
      timeout: 30000,
      onSuccess: 'notify_team',
      onFailure: 'alert_emergency',
      parameters: { duration: 86400000 }
    }
  ],
  estimatedDuration: 60000,
  requiredPermissions: ['security:block'],
  tags: ['custom', 'sql_injection']
});
```

## Vulnerability Management

### Code Scanning

```typescript
const scan = await soc.scanVulnerabilities([
  {
    path: '/app/user.ts',
    content: `
      const query = "SELECT * FROM users WHERE id = " + userInput;
      await db.execute(query);
    `
  }
]);

console.log(`Vulnerabilities found: ${scan.results.total}`);
console.log(`Critical: ${scan.results.critical}`);
console.log(`High: ${scan.results.high}`);

// View vulnerabilities
scan.vulnerabilities.forEach(vuln => {
  console.log(`[${vuln.severity}] ${vuln.title}`);
  console.log(`  Category: ${vuln.category}`);
  console.log(`  Location: ${vuln.location.path}:${vuln.location.line}`);
  console.log(`  Remediation: ${vuln.remediation.description}`);
});
```

### Dependency Scanning

```typescript
const dependencies = [
  { name: 'lodash', version: '4.17.15', type: 'npm' },
  { name: 'express', version: '4.17.1', type: 'npm' }
];

const vulnDatabase = [
  {
    packageName: 'lodash',
    version: '4.17.15',
    severity: 'high',
    title: 'Prototype Pollution',
    description: 'Lodash is vulnerable to prototype pollution',
    cvss: 7.5,
    patchedIn: ['4.17.21'],
    recommendation: 'Upgrade to version 4.17.21 or later'
  }
];

const scan = await soc['vulnerabilityScanner'].scanDependencies(
  dependencies,
  vulnDatabase
);
```

### Risk Assessment

```typescript
// Calculate risk score
const riskScore = soc.calculateRiskScore(vulnerabilities);
console.log(`Risk score: ${riskScore.score}/100 (${riskScore.level})`);

// Prioritize vulnerabilities
const prioritized = soc.prioritizeVulnerabilities(vulnerabilities);
console.log('Top 5 vulnerabilities:');
prioritized.slice(0, 5).forEach((vuln, index) => {
  console.log(`${index + 1}. [${vuln.severity}] ${vuln.title}`);
});
```

## Security Analytics

### Metrics

```typescript
const metrics = soc.calculateSecurityMetrics({
  start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  end: Date.now()
});

console.log('Detection metrics:', metrics.detection);
console.log('Incident metrics:', metrics.incidents);
console.log('Vulnerability metrics:', metrics.vulnerabilities);
```

### Dashboard

```typescript
const dashboard = soc.getSecurityDashboard();

console.log('Dashboard widgets:');
dashboard.widgets.forEach(widget => {
  console.log(`- ${widget.title}: ${widget.type}`);
  console.log(widget.data);
});
```

### Behavior Profiling

```typescript
const profiler = soc['behaviorProfiler'];

// Record events
profiler.recordEvent('user123', 'login', {
  location: 'New York',
  method: 'password'
});

// Get profile
const profile = profiler.getProfile('user123');
console.log('Risk score:', profile.riskScore);
console.log('Anomalies:', profile.anomalies);
```

## Compliance

### Compliance Assessment

```typescript
// Assess compliance
const assessment = await soc.assessCompliance('SOC2');

console.log('Compliance score:', assessment.complianceScore);
console.log('Controls:', assessment.totalControls);
console.log('Findings:', assessment.findings.length);

// Generate report
const report = await soc.generateComplianceReport('SOC2', {
  start: Date.now() - 90 * 24 * 60 * 60 * 1000,
  end: Date.now()
});

console.log('Report ID:', report.id);
console.log('Summary:', report.summary);
```

### Policy Management

```typescript
// Create policy
const policy = soc.createPolicy({
  name: 'Data Retention Policy',
  description: 'Policy for data retention',
  category: 'Data Protection',
  framework: 'GDPR',
  content: 'All personal data must be retained...',
  owner: 'DPO'
});

// Request exception
const exception = soc['policyManager'].requestException(policy.id, {
  requestedBy: 'user123',
  reason: 'Business requirement',
  justification: 'Need extended retention for legal hold',
  duration: 90 * 24 * 60 * 60 * 1000
});

// Approve exception
soc['policyManager'].approveException(exception.id, 'compliance_officer');
```

## Integrations

### Slack Integration

```typescript
const soc = SOCFactory.create({
  integrations: {
    slack: {
      webhookUrl: 'https://hooks.slack.com/services/...',
      channel: '#security-alerts',
      username: 'SOC Bot',
      notifyOn: ['critical', 'high']
    }
  }
});
```

### Email Integration

```typescript
const soc = SOCFactory.create({
  integrations: {
    email: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      username: 'soc@company.com',
      password: '***',
      from: 'SOC <soc@company.com>',
      to: ['security@company.com'],
      notifyOn: ['critical', 'high', 'medium']
    }
  }
});
```

### Jira Integration

```typescript
const soc = SOCFactory.create({
  integrations: {
    jira: {
      baseUrl: 'https://company.atlassian.net',
      username: 'soc@company.com',
      apiToken: '***',
      projectKey: 'SEC',
      issueType: 'Bug',
      autoCreate: true,
      priorities: {
        critical: 'Highest',
        high: 'High',
        medium: 'Medium',
        low: 'Low'
      }
    }
  }
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ClaudeFlare SOC                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Threat     │  │    SIEM      │  │   Response   │      │
│  │  Detection   │  │   System     │  │  Automation  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Vulnerability│  │  Analytics   │  │  Compliance  │      │
│  │ Management   │  │  & Metrics   │  │  Monitoring  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Alert   │  │  Policy  │  │Behavioral│  │Threat    │  │
│  │ Manager  │  │ Manager  │  │ Profiler │  │ Intel    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Integrations Layer                         │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐ │
│  │ Slack │  │ Email │  │ Jira  │  │ Splunk│  │  S3   │ │
│  └───────┘  └───────┘  └───────┘  └───────┘  └───────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details.

## Support

For issues, questions, or contributions, please visit our GitHub repository.
