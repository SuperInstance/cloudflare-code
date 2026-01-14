# @claudeflare/compliance

Comprehensive compliance automation system for ClaudeFlare, supporting SOC 2 Type II, ISO 27001, GDPR, HIPAA, and PCI DSS standards.

## Features

- **Policy as Code**: Define, validate, and enforce compliance policies programmatically
- **Automated Scanning**: Continuous compliance monitoring across infrastructure, code, and configurations
- **Evidence Collection**: Automated gathering and storage of compliance evidence
- **Risk Assessment**: Comprehensive risk analysis and scoring
- **Reporting**: Multi-standard compliance reports with customizable templates
- **Remediation Workflows**: Automated issue remediation with approval chains

## Supported Standards

### SOC 2 Type II
- Security criteria
- Availability criteria
- Processing integrity
- Confidentiality
- Privacy

### ISO 27001
- Information security policies
- Access control
- Cryptography
- Physical security
- Operations security

### GDPR
- Data protection principles
- Data subject rights
- Consent management
- Breach notification
- DPIAs

### HIPAA
- PHI protection
- Access controls
- Audit controls
- Integrity controls
- Transmission security

### PCI DSS
- Network security
- Data protection
- Vulnerability management
- Access control
- Monitoring and testing

## Installation

```bash
npm install @claudeflare/compliance
```

## Usage

### Define Policies

```typescript
import { PolicyDefinition, PolicyEngine } from '@claudeflare/compliance/policies';

const policy: PolicyDefinition = {
  id: 'password-policy',
  name: 'Password Security Policy',
  standard: 'SOC2',
  category: 'Security',
  rules: [
    {
      id: 'pwd-min-length',
      description: 'Minimum password length',
      condition: 'password.length >= 12',
      severity: 'high'
    }
  ]
};

const engine = new PolicyEngine();
await engine.loadPolicy(policy);
```

### Scan for Compliance

```typescript
import { ComplianceScanner } from '@claudeflare/compliance/scanning';

const scanner = new ComplianceScanner();
const results = await scanner.scan({
  standards: ['SOC2', 'ISO27001'],
  targets: ['infrastructure', 'code', 'database']
});

console.log(results.summary);
```

### Generate Reports

```typescript
import { ReportGenerator } from '@claudeflare/compliance/reporting';

const generator = new ReportGenerator();
const report = await generator.generate({
  standard: 'SOC2',
  period: { start: '2024-01-01', end: '2024-12-31' },
  format: 'pdf'
});
```

### Collect Evidence

```typescript
import { EvidenceCollector } from '@claudeflare/compliance/evidence';

const collector = new EvidenceCollector();
await collector.collect({
  policyId: 'access-control-policy',
  evidenceTypes: ['logs', 'configurations', 'reviews']
});
```

### Assess Risk

```typescript
import { RiskAssessor } from '@claudeflare/compliance/risk';

const assessor = new RiskAssessor();
const risks = await assessor.assess({
  scope: 'organization',
  standards: ['GDPR', 'HIPAA']
});
```

### Remediate Issues

```typescript
import { RemediationEngine } from '@claudeflare/compliance/remediation';

const engine = new RemediationEngine();
await engine.remediate({
  issueId: 'access-control-violation',
  workflow: 'automatic'
});
```

## CLI Commands

```bash
# Scan for compliance issues
npm run scan:compliance

# Generate compliance report
npm run generate:report

# Assess risks
npm run assess:risk

# Collect evidence
npm run collect:evidence
```

## Architecture

```
compliance/
├── policies/          # Policy as code framework
│   ├── definitions/   # Standard policy definitions
│   ├── engine.ts      # Policy evaluation engine
│   └── validator.ts   # Policy validation
├── scanning/          # Automated compliance scanning
│   ├── config.ts      # Configuration scanning
│   ├── code.ts        # Code scanning
│   └── infra.ts       # Infrastructure scanning
├── reporting/         # Compliance reporting
│   ├── generator.ts   # Report generation
│   ├── templates/     # Report templates
│   └── exporters.ts   # Format exporters
├── evidence/          # Evidence collection
│   ├── collector.ts   # Evidence gathering
│   ├── storage.ts     # Evidence storage
│   └── chain.ts       # Chain of custody
├── risk/              # Risk assessment
│   ├── assessor.ts    # Risk analysis
│   ├── scoring.ts     # Risk scoring
│   └── matrix.ts      # Risk matrix
└── remediation/       # Remediation workflows
    ├── engine.ts      # Workflow engine
    ├── actions.ts     # Remediation actions
    └── approvals.ts   # Approval chains
```

## License

MIT
