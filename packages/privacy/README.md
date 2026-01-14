# @claudeflare/privacy

Comprehensive GDPR compliance and data privacy management system for ClaudeFlare platform.

## Features

### 1. Consent Management (GDPR Article 7)
- Granular consent tracking across multiple categories
- Cookie consent management
- Marketing preferences
- Communication preferences
- Consent withdrawal workflows
- Audit trail for all consent changes
- Consent expiration and renewal

### 2. Data Subject Rights (GDPR Articles 15-22)
- **Right to Access (Article 15)**: Export personal data in multiple formats
- **Right to Rectification (Article 16)**: Correct inaccurate data
- **Right to Erasure (Article 17)**: "Right to be forgotten" implementation
- **Right to Restrict Processing (Article 18)**: Limit data processing
- **Right to Data Portability (Article 20)**: Transfer data to other services
- **Right to Object (Article 21)**: Object to processing activities
- Automated verification workflows
- Third-party notification system

### 3. Data Retention Policies (GDPR Article 5)
- Configurable retention periods per data category
- Automated cleanup and archiving
- Legal hold support
- Anonymization and aggregation
- Policy-based scheduling
- Compliance reporting

### 4. Privacy Policy Generation
- GDPR-compliant policy templates
- Multi-format output (HTML, Markdown, PDF, JSON)
- Multi-language support
- Custom section builder
- Automated validation
- Version tracking

### 5. Cookie Consent Management
- Granular cookie category control
- Consent tracking and storage
- Preference management
- GDPR-compliant cookie banners

## Installation

```bash
npm install @claudeflare/privacy
```

## Quick Start

### Consent Management

```typescript
import { ConsentManager } from '@claudeflare/privacy/consent';

// Bind in wrangler.toml
export default {
  async fetch(request, env) {
    const consentManager = env.PRIVACY_CONSENT.get(
      env.PRIVACY_CONSENT.idFromName('consent-manager')
    );

    // Grant consent
    const response = await consentManager.fetch(
      new Request('https://privacy/consent/grant', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-123',
          category: 'analytics',
          purpose: 'Service improvement',
          legalBasis: 'Explicit consent',
          source: 'website',
          policyVersion: '1.0.0',
        }),
      })
    );

    return response;
  },
};
```

### Right to Access (Data Export)

```typescript
import { RightToAccess } from '@claudeflare/privacy/rights';

// Request data export
const accessRequest = await rightToAccess.fetch(
  new Request('https://privacy/access/request', {
    method: 'POST',
    body: JSON.stringify({
      subjectId: 'user-123',
      scope: {
        dataCategories: ['personal_data', 'usage_data'],
        includeThirdParty: true,
        includeArchived: false,
      },
      outputFormat: 'json',
    }),
  })
);
```

### Right to Erasure

```typescript
import { RightToErasure } from '@claudeflare/privacy/rights';

// Request data deletion
const erasureRequest = await rightToErasure.fetch(
  new Request('https://privacy/erasure/request', {
    method: 'POST',
    body: JSON.stringify({
      subjectId: 'user-123',
      grounds: ['consent_withdrawn'],
      notifyThirdParties: true,
    }),
  })
);
```

### Data Retention Policies

```typescript
import { RetentionPolicyManager } from '@claudeflare/privacy/retention';

// Create retention policy
const policy = await retentionManager.fetch(
  new Request('https://privacy/retention/policy', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Personal Data Retention',
      category: 'personal_data',
      retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
      action: 'delete',
      trigger: 'account_closure',
      legalBasis: 'legal_obligation',
      tables: ['users', 'profiles'],
    }),
  })
);
```

### Privacy Policy Generation

```typescript
import { PrivacyPolicyGenerator } from '@claudeflare/privacy/policy';

// Generate GDPR-compliant privacy policy
const policy = await policyGenerator.fetch(
  new Request('https://privacy/policy/generate', {
    method: 'POST',
    body: JSON.stringify({
      organization: {
        name: 'ACME Corp',
        type: 'company',
        contactEmail: 'privacy@acme.com',
        website: 'https://acme.com',
        address: {
          street: '123 Privacy St',
          city: 'San Francisco',
          postalCode: '94105',
          country: 'USA',
        },
      },
      format: 'html',
      language: 'en',
    }),
  })
);
```

## Architecture

### Durable Objects

The privacy system uses Cloudflare Durable Objects for stateful operations:

- **ConsentManager**: Manages user consent records and preferences
- **RightToAccess**: Handles data export requests (Article 15)
- **RightToErasure**: Manages data deletion workflows (Article 17)
- **RetentionPolicyManager**: Enforces data retention policies
- **PrivacyPolicyGenerator**: Generates privacy policies

### Storage

- **Durable Object Storage**: Transactional state management
- **KV Storage**: Long-term archival and CDN caching
- **D1 Database**: Queryable data records

## GDPR Compliance

### Implemented Articles

- **Article 5**: Principles relating to processing of personal data
- **Article 6**: Lawfulness of processing
- **Article 7**: Conditions for consent
- **Article 12**: Transparent information and communication
- **Article 13**: Information to be provided where personal data are collected from data subject
- **Article 14**: Information to be provided where personal data are not obtained from the data subject
- **Article 15**: Right of access by the data subject
- **Article 16**: Right to rectification
- **Article 17**: Right to erasure ("right to be forgotten")
- **Article 18**: Right to restriction of processing
- **Article 20**: Right to data portability
- **Article 21**: Right to object
- **Article 22**: Automated individual decision-making, including profiling
- **Article 30**: Records of processing activities
- **Article 32**: Security of processing
- **Article 45**: Transfers on the basis of an adequacy decision
- **Article 46**: Transfers subject to appropriate safeguards
- **Article 47**: Binding corporate rules

### Data Subject Rights

All 8 GDPR data subject rights are fully implemented:

1. **Right to be Informed**: Privacy policy generation
2. **Right of Access**: Complete data export functionality
3. **Right to Rectification**: Data correction workflows
4. **Right to Erasure**: Full deletion with third-party notification
5. **Right to Restrict Processing**: Data limitation controls
6. **Right to Data Portability**: Standardized data export
7. **Right to Object**: Processing objection handling
8. **Rights in Relation to Automated Decision Making**: Profiling transparency

## API Reference

### Consent Management API

#### POST `/consent/grant`
Grant consent for a data category.

#### POST `/consent/revoke`
Revoke previously granted consent.

#### POST `/consent/batch`
Batch update multiple consents.

#### GET `/consent/validate/:category`
Validate if consent exists and is valid.

#### GET `/consent/profile`
Get complete consent profile for a user.

### Data Subject Rights API

#### POST `/access/request`
Create a data access request.

#### POST `/access/export`
Export personal data.

#### POST `/erasure/request`
Request data deletion.

#### POST `/erasure/execute`
Execute erasure process.

#### GET `/erasure/progress`
Check erasure progress.

### Retention Policy API

#### POST `/retention/policy`
Create retention policy.

#### GET `/retention/policy`
List all policies.

#### POST `/retention/execute`
Execute retention policy.

#### POST `/retention/legal-hold`
Place legal hold on data.

### Privacy Policy API

#### POST `/policy/generate`
Generate privacy policy.

#### GET `/policy/templates`
List available templates.

#### POST `/policy/template`
Create custom template.

## Configuration

### Environment Variables

```toml
# wrangler.toml
[[durable_objects.bindings]]
name = "PRIVACY_CONSENT"
class_name = "ConsentManager"

[[durable_objects.bindings]]
name = "PRIVACY_ACCESS"
class_name = "RightToAccess"

[[durable_objects.bindings]]
name = "PRIVACY_ERASURE"
class_name = "RightToErasure"

[[durable_objects.bindings]]
name = "PRIVACY_RETENTION"
class_name = "RetentionPolicyManager"

[[durable_objects.bindings]]
name = "PRIVACY_POLICY"
class_name = "PrivacyPolicyGenerator"

[[kv_namespaces]]
binding = "PRIVACY_KV"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "PRIVACY_DB"
database_name = "privacy-database"
database_id = "your-database-id"
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For GDPR compliance questions or support, please contact legal@claudeflare.com.
