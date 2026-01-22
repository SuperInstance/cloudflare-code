# @claudeflare/enterprise

Enterprise SSO and identity management for ClaudeFlare platform.

## Features

### SAML 2.0 Integration
- SP-initiated and IdP-initiated SSO
- Single Logout (SLO)
- SAML assertion validation
- Signature verification
- Encryption/decryption
- Metadata generation
- IdP integration (Okta, Azure AD, OneLogin, etc.)

### LDAP/Active Directory Integration
- LDAP protocol client
- Active Directory support
- User authentication
- Group lookup
- User search and synchronization
- SSL/TLS support
- Connection pooling

### SCIM 2.0 Provisioning
- User provisioning
- Group provisioning
- Bulk operations
- Attribute mapping
- Webhook notifications
- Automatic synchronization

### Just-in-Time (JIT) Provisioning
- Automatic user creation
- Attribute mapping
- Group assignment
- Role assignment
- License management
- Domain restrictions
- Approval workflows

### Group and Role Mapping
- External-to-internal group mapping
- Role mapping with conditions
- Automatic synchronization
- Membership tracking
- Expiration support

### Audit Logging
- Identity event logging
- Comprehensive audit trail
- Sensitive data masking
- Alert notifications
- Report generation
- Query and filtering

## Installation

```bash
npm install @claudeflare/enterprise
```

## Quick Start

### SAML 2.0 SSO

```typescript
import { SAMLService } from '@claudeflare/enterprise/saml';

const config = {
  entityId: 'https://your-app.com/metadata',
  ssoUrl: 'https://idp.example.com/sso',
  sloUrl: 'https://idp.example.com/slo',
  certificate: 'MIIDp...',
  privateKey: 'MIIEv...',
  assertionConsumerServiceUrl: 'https://your-app.com/acs',
  wantAssertionsSigned: true,
};

const saml = new SAMLService(config);

// Create authentication request
const { requestUrl, requestId } = saml.createAuthnRequest({
  forceAuthn: false,
  relayState: 'state-123',
});

// Process SAML response
const result = await saml.processResponse(encodedResponse, relayState);

if (result.success) {
  console.log('User authenticated:', result.attributes);
}
```

### LDAP/Active Directory

```typescript
import { LDAPClient } from '@claudeflare/enterprise/ldap';

const config = {
  url: 'ldap://ldap.example.com:389',
  bindDN: 'cn=admin,dc=example,dc=com',
  bindCredentials: 'password',
  searchBase: 'dc=example,dc=com',
  searchFilter: '(uid={username})',
  searchAttributes: ['*', 'memberOf'],
};

const ldap = new LDAPClient(config);

// Authenticate user
const result = await ldap.authenticate('username', 'password');

if (result.success) {
  console.log('User:', result.user);
}

// Get user groups
const groups = await ldap.getUserGroups('username');
```

### Active Directory

```typescript
import { ADClient } from '@claudeflare/enterprise/ldap';

const adConfig = {
  url: 'ldap://ad.example.com:389',
  bindDN: 'cn=admin,cn=users,dc=example,dc=com',
  bindCredentials: 'password',
  searchBase: 'cn=users,dc=example,dc=com',
  searchFilter: '(sAMAccountName={username})',
  domain: 'EXAMPLE',
  domainController: 'dc01.example.com',
};

const ad = new ADClient(adConfig);

// Authenticate with AD
const result = await ad.authenticate('username', 'password');

// Check if user is disabled
const isDisabled = await ad.isUserDisabled('username');

// Get nested group memberships
const memberships = await ad.getNestedGroupMemberships('username');
```

### SCIM 2.0 Provisioning

```typescript
import { SCIMService } from '@claudeflare/enterprise/scim';

const config = {
  baseUrl: 'https://scim.example.com',
  authenticationToken: 'your-token',
  authenticationScheme: 'Bearer',
};

const scim = new SCIMService(config);

// Create user
const user = await scim.createUser({
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
  userName: 'user@example.com',
  name: {
    givenName: 'John',
    familyName: 'Doe',
  },
  emails: [{
    value: 'user@example.com',
    type: 'work',
    primary: true,
  }],
  active: true,
});

// List users with filtering
const users = await scim.listUsers({
  filter: 'userName eq "user@example.com"',
  count: 10,
});
```

### JIT Provisioning

```typescript
import { JITProvisioningService } from '@claudeflare/enterprise/jit';

const config = {
  enabled: true,
  autoCreateUsers: true,
  autoUpdateUsers: true,
  defaultRoles: ['User'],
  defaultGroups: ['Users'],
  attributeMapping: {
    userId: 'NameID',
    email: 'email',
    firstName: 'firstName',
    lastName: 'lastName',
  },
  groupMapping: {
    enabled: true,
    sourceAttribute: 'groups',
    groupMapping: {
      'Admins': 'Administrators',
    },
  },
  domainRestrictions: ['example.com'],
};

const jit = new JITProvisioningService(config);

// Provision user from SAML
const result = await jit.provisionFromSAML({
  NameID: ['user123'],
  email: ['user@example.com'],
  firstName: ['John'],
  lastName: ['Doe'],
});

if (result.success) {
  console.log('User provisioned:', result.userId);
  console.log('Groups:', result.groups);
  console.log('Roles:', result.roles);
}
```

### Group and Role Mapping

```typescript
import { GroupMappingService } from '@claudeflare/enterprise/groups';

const config = {
  enabled: true,
  syncMode: 'automatic',
  source: 'saml',
  mappings: [
    {
      sourceGroup: 'Admins',
      targetGroup: 'Administrators',
      roleMappings: [
        {
          sourceRole: 'admin',
          targetRole: 'Administrator',
        },
      ],
    },
  ],
  autoCreateGroups: true,
};

const mapping = new GroupMappingService(config);

// Map external group to internal
const targetGroup = mapping.mapGroup('Admins'); // 'Administrators'

// Assign role to user
mapping.assignRoleToUser('user123', 'Administrator', {
  source: 'saml',
  sourceId: 'Admins',
});

// Check if user has role
const hasRole = mapping.userHasRole('user123', 'Administrator');
```

### Audit Logging

```typescript
import { AuditService } from '@claudeflare/enterprise/audit';

const config = {
  enabled: true,
  logLevel: 'info',
  storage: {
    type: 'database',
    encryptionEnabled: true,
  },
  events: {
    includeSuccessfulEvents: true,
    includeFailedEvents: true,
    eventTypes: ['user.login', 'user.provisioned', 'saml.sso_completed'],
  },
  masking: {
    enabled: true,
    fieldsToMask: ['password', 'token'],
    maskingPattern: '***',
  },
};

const audit = new AuditService(config);

// Log authentication event
await audit.logAuthentication(
  'login',
  'user123',
  'success',
  {
    userId: 'user123',
    ipAddress: '192.168.1.1',
  }
);

// Log SAML event
await audit.logSAMLEvent(
  'sso_completed',
  'user123',
  'success',
  {
    userId: 'user123',
  }
);

// Query audit events
const events = await audit.getEventsByUserId('user123', {
  limit: 100,
});

// Generate report
const report = await audit.generateReport({
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
});
```

## Configuration

### SAML Configuration

```typescript
interface SAMLConfig {
  entityId: string;                      // Your SP entity ID
  ssoUrl: string;                        // IdP SSO URL
  sloUrl?: string;                       // IdP SLO URL
  certificate: string;                   // IdP certificate
  privateKey?: string;                   // Your private key
  nameIdFormat?: string;                 // NameID format
  assertionConsumerServiceUrl: string;   // Your ACS URL
  wantAssertionsSigned?: boolean;        // Require signed assertions
  wantAssertionsEncrypted?: boolean;     // Require encrypted assertions
  signingAlgorithm?: string;             // Signature algorithm
}
```

### LDAP Configuration

```typescript
interface LDAPConfig {
  url: string;                           // LDAP server URL
  bindDN: string;                        // Bind DN
  bindCredentials: string;               // Bind password
  searchBase: string;                    // Search base DN
  searchFilter?: string;                 // Search filter
  searchScope?: 'base' | 'one' | 'sub';  // Search scope
  searchAttributes?: string[];           // Attributes to return
  groupSearchBase?: string;              // Group search base
  groupSearchFilter?: string;            // Group search filter
  tlsOptions?: {                         // TLS options
    ca?: string | string[];
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  };
}
```

### SCIM Configuration

```typescript
interface SCIMConfig {
  baseUrl: string;                       // SCIM base URL
  authenticationToken: string;           // Auth token
  authenticationScheme?: 'Bearer' | 'Basic' | 'OAuth';
  maxResults?: number;                   // Max results per page
  bulkMaxOperations?: number;            // Max bulk operations
}
```

### JIT Configuration

```typescript
interface JITConfig {
  enabled: boolean;                      // Enable JIT
  autoCreateUsers: boolean;              // Auto-create users
  autoUpdateUsers: boolean;              // Auto-update users
  defaultRoles?: string[];               // Default roles
  defaultGroups?: string[];              // Default groups
  attributeMapping: {                    // Attribute mapping
    userId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    // ... more mappings
  };
  groupMapping?: {                       // Group mapping
    enabled: boolean;
    sourceAttribute: string;
    groupMapping?: Record<string, string>;
  };
  roleMapping?: {                        // Role mapping
    enabled: boolean;
    sourceAttribute: string;
    roleMapping?: Record<string, string>;
  };
  domainRestrictions?: string[];         // Allowed domains
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## License

MIT

## Support

For support and documentation, visit [ClaudeFlare Documentation](https://docs.claudeflare.dev).
