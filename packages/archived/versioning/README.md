# @claudeflare/versioning

Comprehensive API versioning and deprecation system for ClaudeFlare distributed AI coding platform.

## Features

- **Semantic Versioning**: Full SemVer support with comparison, validation, and increment operations
- **Multiple Versioning Strategies**: URL path, header, query parameter, and Accept header versioning
- **Deprecation Workflow**: Complete lifecycle management with deprecation notices, sunset dates, and migration support
- **Breaking Change Detection**: Automated analysis of API changes to detect breaking modifications
- **Compatibility Testing**: Comprehensive version compatibility validation and testing framework
- **Migration Tools**: Automated request/response transformation and migration guide generation
- **Hono Integration**: First-class middleware support for Hono framework on Cloudflare Workers

## Installation

```bash
npm install @claudeflare/versioning
```

## Quick Start

### Basic Version Management

```typescript
import { VersionManager, VersionStatus } from '@claudeflare/versioning';

// Initialize version manager
const versionManager = new VersionManager({
  defaultVersion: '1.0.0',
  supportedVersions: ['1.0.0', '1.1.0', '2.0.0'],
});

// Register API versions
versionManager.registerVersion({
  version: '1.0.0',
  semver: { major: 1, minor: 0, patch: 0 },
  status: VersionStatus.STABLE,
  releasedAt: new Date('2024-01-01'),
  description: 'Initial stable release',
  breakingChanges: [],
  features: ['User management', 'Authentication'],
  deprecations: [],
});

versionManager.registerVersion({
  version: '2.0.0',
  semver: { major: 2, minor: 0, patch: 0 },
  status: VersionStatus.STABLE,
  releasedAt: new Date('2024-06-01'),
  description: 'Major update with new features',
  breakingChanges: [
    'Removed legacy endpoints',
    'Changed authentication flow',
  ],
  features: ['Real-time updates', 'Webhooks'],
  deprecations: [],
});

// Resolve version from request
const version = versionManager.resolveVersion(requestContext);
console.log(version.version); // '2.0.0'
```

### Semantic Versioning

```typescript
import { SemanticVersioning } from '@claudeflare/versioning';

// Parse and compare versions
const version = SemanticVersioning.parse('1.2.3');
console.log(version); // { major: 1, minor: 2, patch: 3 }

// Compare versions
console.log(SemanticVersioning.gt('2.0.0', '1.0.0')); // true
console.log(SemanticVersioning.lt('1.0.0', '2.0.0')); // true

// Increment versions
console.log(SemanticVersioning.increment('1.2.3', 'major')); // '2.0.0'
console.log(SemanticVersioning.increment('1.2.3', 'minor')); // '1.3.0'
console.log(SemanticVersioning.increment('1.2.3', 'patch')); // '1.2.4'

// Check version ranges
console.log(SemanticVersioning.satisfies('1.2.3', '^1.2.0')); // true

// Get upgrade recommendations
const versions = ['1.0.0', '1.1.0', '2.0.0'];
const recommendations = SemanticVersioning.getUpgradePath('1.0.0', versions, 'stable');
console.log(recommendations); // ['1.1.0', '2.0.0']
```

### Deprecation Management

```typescript
import { DeprecationManager } from '@claudeflare/versioning';

const deprecationManager = new DeprecationManager({
  minimumNoticePeriod: 90, // days
  warningPeriod: 30, // days
  defaultSunsetPeriod: 180, // days
});

// Deprecate an endpoint
const deprecation = deprecationManager.deprecateEndpoint(
  '/api/v1/users',
  'GET',
  '1.0.0',
  new Date('2024-12-31'),
  {
    successorEndpoint: '/api/v2/users',
    successorVersion: '2.0.0',
    reason: 'Replaced with improved endpoint',
    migrationGuide: 'https://docs.claudeflare.com/migration/v1-to-v2',
  }
);

// Generate deprecation headers
const headers = deprecationManager.generateDeprecationHeaders('/api/v1/users', '1.0.0');
console.log(headers);
// {
//   deprecation: true,
//   sunset: Date('2024-12-31'),
//   link: '</api/v2/users>; rel="successor-version"',
//   warning: '299 - "This endpoint is deprecated..."',
//   'successor-version': '2.0.0'
// }

// Get deprecation warnings
const warnings = deprecationManager.generateWarnings('/api/v1/users', '1.0.0');
console.log(warnings);
// [
//   {
//     type: 'deprecation',
//     severity: 'warning',
//     message: 'Endpoint /api/v1/users is deprecated...',
//     code: 'DEPRECATED_ENDPOINT'
//   }
// ]
```

### Breaking Change Detection

```typescript
import { BreakingChangeDetector } from '@claudeflare/versioning';

const detector = new BreakingChangeDetector();

// Compare two API versions
const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

console.log(analysis.summary);
// {
//   total: 5,
//   breaking: 2,
//   nonBreaking: 3,
//   severity: 'major'
// }

console.log(analysis.breakingChanges);
// [
//   {
//     type: 'ENDPOINT_REMOVED',
//     severity: 'major',
//     category: 'breaking',
//     description: 'Endpoint GET /users was removed',
//     impact: ['Clients using GET /users will fail'],
//     affectedEndpoints: ['GET /users'],
//     migration: [...],
//     automatedFix: false
//   }
// ]

// Get impact score
const impact = detector.getImpactScore(analysis.breakingChanges);
console.log(impact);
// { score: 30, level: 'high' }

// Get recommendations
const recommendations = detector.getRecommendations(analysis.breakingChanges);
console.log(recommendations);
// [
//   'Consider creating a new API version to maintain backward compatibility',
//   'Provide migration guide for breaking changes'
// ]
```

### Compatibility Testing

```typescript
import { CompatibilityTester } from '@claudeflare/versioning';

const tester = new CompatibilityTester();

// Test version compatibility
const test = await tester.testCompatibility(oldContract, newContract);

console.log(test.compatible); // false
console.log(test.breakingChanges); // [...]
console.log(test.recommendations); // [...]

// Test backward compatibility
const backwardTest = await tester.testBackwardCompatibility(v1Contract, v2Contract);

// Test forward compatibility
const forwardTest = await tester.testForwardCompatibility(v2Contract, v1Contract);

// Get compatibility matrix
const matrix = await tester.getCompatibilityMatrix([v1Contract, v2Contract, v3Contract]);
console.log(matrix);
// {
//   '1.0.0': { '1.0.0': true, '2.0.0': false, '3.0.0': false },
//   '2.0.0': { '1.0.0': false, '2.0.0': true, '3.0.0': false },
//   '3.0.0': { '1.0.0': false, '2.0.0': false, '3.0.0': true }
// }
```

### Migration Tools

```typescript
import { MigrationEngine } from '@claudeflare/versioning';

const migration = new MigrationEngine();

// Register transform rules
migration.registerTransform({
  name: 'rename-user-id',
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  transform: 'request_transform',
  priority: 1,
});

// Transform request
const result = migration.transformRequest(
  { userId: '123' },
  '1.0.0',
  '2.0.0'
);
console.log(result);
// {
//   success: true,
//   transformed: { user_id: '123' },
//   warnings: [],
//   errors: [],
//   metadata: { transformsApplied: 1 }
// }

// Transform response
const response = migration.transformResponse(
  { user_id: '123' },
  '2.0.0',
  '1.0.0'
);

// Validate migration
const validation = migration.validateMigration('1.0.0', '2.0.0', requestData);
console.log(validation);
// {
//   valid: true,
//   errors: [],
//   warnings: ['Parameter type conversion may lose precision']
// }
```

### Migration Guide Generation

```typescript
import { GuideGenerator } from '@claudeflare/versioning';

const generator = new GuideGenerator();

// Generate comprehensive migration guide
const guide = generator.generateGuide('1.0.0', '2.0.0', breakingChanges, {
  includeCodeExamples: true,
  includeRollback: true,
  includeTesting: true,
  detailLevel: 'comprehensive',
});

console.log(guide);
// {
//   sourceVersion: '1.0.0',
//   targetVersion: '2.0.0',
//   overview: '# Migration Guide: 1.0.0 → 2.0.0...',
//   estimatedTime: '4 hours',
//   difficulty: 'medium',
//   steps: [...],
//   codeExamples: [...],
//   commonIssues: [...],
//   rollbackInstructions: '...',
//   testingInstructions: '...'
// }
```

### Hono Middleware Integration

```typescript
import { Hono } from 'hono';
import { VersioningMiddleware, createVersioningMiddleware } from '@claudeflare/versioning';

const app = new Hono();

// Create versioning middleware
const versioning = new VersioningMiddleware({
  versionManager,
  deprecationManager,
  defaultVersion: '1.0.0',
  enableDeprecationHeaders: true,
  enableVersionValidation: true,
});

// Apply middleware
app.use('*', versioning.middleware());

// Version-specific routes
app.get('/api/v1/users', (c) => {
  const version = c.get('apiVersion');
  return c.json({ version, users: [] });
});

// Require specific version
app.get('/admin',
  versioning.requireVersion('2.0.0'),
  (c) => c.json({ message: 'Admin area' })
);

// Require minimum version
app.get('/features',
  versioning.requireMinVersion('1.1.0'),
  (c) => c.json({ features: [] })
);

// Deprecate endpoint
app.get('/legacy',
  versioning.deprecateEndpoint('/legacy', new Date('2024-12-31'), {
    successorEndpoint: '/new',
    successorVersion: '2.0.0',
  }),
  (c) => c.json({ message: 'Legacy endpoint' })
);
```

## API Reference

### VersionManager

Main class for managing API versions.

**Methods:**
- `registerVersion(version: APIVersion): void`
- `getVersion(version: string): APIVersion | undefined`
- `resolveVersion(context: VersionContext, strategies?: VersioningStrategy[]): VersionResolution`
- `compareVersions(version1: string, version2: string): VersionComparison`
- `updateVersionStatus(version: string, status: VersionStatus): void`

### SemanticVersioning

Utilities for semantic version operations.

**Methods:**
- `parse(version: string): SemVer`
- `compare(version1: string, version2: string): number`
- `increment(version: string, type: 'major' | 'minor' | 'patch'): string`
- `satisfies(version: string, range: string): boolean`
- `getUpgradePath(currentVersion: string, availableVersions: string[]): string[]`

### DeprecationManager

Manage API deprecation lifecycle.

**Methods:**
- `deprecateEndpoint(endpoint: string, method: string, version: string, sunsetDate: Date): DeprecationRecord`
- `generateDeprecationHeaders(endpoint: string, version: string): DeprecationHeaders`
- `generateWarnings(endpoint: string, version: string): DeprecationWarning[]`
- `getDeprecationStats(): DeprecationStats`

### BreakingChangeDetector

Detect breaking changes between API versions.

**Methods:**
- `compareVersions(oldEndpoints: APIEndpoint[], newEndpoints: APIEndpoint[]): ChangeAnalysis`
- `compareEndpoints(oldEndpoint: APIEndpoint, newEndpoint: APIEndpoint): EndpointComparison`
- `getImpactScore(changes: BreakingChange[]): ImpactScore`
- `getRecommendations(changes: BreakingChange[]): string[]`

### CompatibilityTester

Test API version compatibility.

**Methods:**
- `testCompatibility(sourceContract: APIContract, targetContract: APIContract): Promise<CompatibilityTest>`
- `testBackwardCompatibility(oldContract: APIContract, newContract: APIContract): Promise<CompatibilityTest>`
- `getCompatibilityMatrix(contracts: APIContract[]): Promise<CompatibilityMatrix>`

### MigrationEngine

Handle API version migrations.

**Methods:**
- `transformRequest(request: any, fromVersion: string, toVersion: string): MigrationResult`
- `transformResponse(response: any, fromVersion: string, toVersion: string): MigrationResult`
- `validateMigration(fromVersion: string, toVersion: string, data: any): ValidationResult`

### GuideGenerator

Generate migration documentation.

**Methods:**
- `generateGuide(fromVersion: string, toVersion: string, breakingChanges: BreakingChange[]): MigrationGuide`

## Versioning Strategies

The library supports multiple versioning strategies:

### URL Path Versioning
```
/api/v1/users
/api/v2/users
```

### Header Versioning
```
API-Version: 1
```

### Accept Header Versioning
```
Accept: application/vnd.claudeflare.v1+json
```

### Query Parameter Versioning
```
/api/users?version=1
```

## Deprecation Headers

The library automatically generates standard deprecation headers:

```
Deprecation: true
Sunset: Wed, 01 Jan 2025 00:00:00 GMT
Link: </api/v2/new-endpoint>; rel="successor-version"
Warning: 299 - "This endpoint is deprecated and will be removed on Jan 1, 2025"
API-Version: 1.0.0
Successor-Version: 2.0.0
```

## Breaking Change Types

The detector can identify:

- **Endpoint Changes**: Removed, renamed, HTTP method changed
- **Parameter Changes**: Removed, renamed, type changed, required status changed
- **Response Changes**: Field removed, renamed, type changed, structure changed
- **Authentication Changes**: Scheme changed, requirements changed
- **Rate Limit Changes**: Limits increased or decreased
- **Behavior Changes**: Functional behavior modifications

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
