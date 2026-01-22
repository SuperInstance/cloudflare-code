/**
 * Complete example of using the versioning system
 */

import {
  VersionManager,
  SemanticVersioning,
  DeprecationManager,
  BreakingChangeDetector,
  CompatibilityTester,
  MigrationEngine,
  GuideGenerator,
  APIValidator,
  VersionUtils,
  VersionStatus,
  BreakingChangeType,
  VersioningStrategy,
} from '../src/index';

// Initialize components
const versionManager = new VersionManager({
  defaultVersion: '1.0.0',
  supportedVersions: ['1.0.0', '1.1.0', '2.0.0'],
  deprecationPolicy: {
    minimumNoticePeriod: 90,
    warningPeriod: 30,
    defaultSunsetPeriod: 180,
    requireSuccessorVersion: true,
    requireMigrationGuide: true,
  },
});

const deprecationManager = new DeprecationManager();
const breakingChangeDetector = new BreakingChangeDetector();
const compatibilityTester = new CompatibilityTester();
const migrationEngine = new MigrationEngine();
const guideGenerator = new GuideGenerator();
const apiValidator = new APIValidator();

// Example 1: Register API versions
console.log('=== Example 1: Register API Versions ===');

versionManager.registerVersion({
  version: '1.0.0',
  semver: SemanticVersioning.parse('1.0.0'),
  status: VersionStatus.STABLE,
  releasedAt: new Date('2024-01-01'),
  description: 'Initial stable release',
  breakingChanges: [],
  features: ['User authentication', 'Resource CRUD operations'],
  deprecations: [],
});

versionManager.registerVersion({
  version: '1.1.0',
  semver: SemanticVersioning.parse('1.1.0'),
  status: VersionStatus.STABLE,
  releasedAt: new Date('2024-03-01'),
  description: 'Feature update with backward compatibility',
  breakingChanges: [],
  features: ['Pagination support', 'Filtering and sorting'],
  deprecations: [],
});

versionManager.registerVersion({
  version: '2.0.0',
  semver: SemanticVersioning.parse('2.0.0'),
  status: VersionStatus.STABLE,
  releasedAt: new Date('2024-06-01'),
  description: 'Major update with breaking changes',
  breakingChanges: [
    'Removed legacy endpoints',
    'Changed authentication flow',
    'Updated response structure',
  ],
  features: ['Real-time updates', 'Webhook support', 'Enhanced security'],
  deprecations: [],
});

console.log('Registered versions:', versionManager.getAllVersions().map(v => v.version));

// Example 2: Semantic versioning operations
console.log('\n=== Example 2: Semantic Versioning ===');

console.log('Parse version:', SemanticVersioning.parse('2.1.3-beta.1+build.456'));
console.log('Compare versions:', SemanticVersioning.compare('1.0.0', '2.0.0'));
console.log('Increment major:', SemanticVersioning.increment('1.2.3', 'major'));
console.log('Satisfies range:', SemanticVersioning.satisfies('1.2.3', '^1.2.0'));

const comparison = SemanticVersioning.compareDetailed('1.0.0', '2.0.0');
console.log('Version comparison:', comparison);

const recommendations = SemanticVersioning.getRecommendations('1.0.0', ['1.1.0', '2.0.0']);
console.log('Version recommendations:', recommendations);

// Example 3: Deprecate an endpoint
console.log('\n=== Example 3: Deprecate Endpoint ===');

const deprecation = deprecationManager.deprecateEndpoint(
  '/api/v1/users',
  'GET',
  '1.0.0',
  new Date('2024-12-31'),
  {
    successorEndpoint: '/api/v2/users',
    successorVersion: '2.0.0',
    reason: 'Replaced with improved endpoint with better performance',
    migrationGuide: 'https://docs.claudeflare.com/migration/v1-to-v2',
  }
);

console.log('Created deprecation:', deprecation.id);

// Generate deprecation headers
const headers = deprecationManager.generateDeprecationHeaders('/api/v1/users', '1.0.0');
console.log('Deprecation headers:', headers);

// Generate deprecation warnings
const warnings = deprecationManager.generateWarnings('/api/v1/users', '1.0.0');
console.log('Deprecation warnings:', warnings);

// Get deprecation statistics
const stats = deprecationManager.getDeprecationStats();
console.log('Deprecation stats:', stats);

// Example 4: Detect breaking changes
console.log('\n=== Example 4: Breaking Change Detection ===');

const oldEndpoints = [
  {
    path: '/api/v1/users',
    method: 'GET',
    version: '1.0.0',
    parameters: [
      {
        name: 'limit',
        in: 'query',
        type: 'number',
        required: false,
      },
    ],
    response: {
      statusCode: 200,
      description: 'Success',
      schema: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
      },
    },
    deprecation: {} as any,
  },
];

const newEndpoints = [
  {
    path: '/api/v2/users',
    method: 'GET',
    version: '2.0.0',
    parameters: [
      {
        name: 'pageSize',
        in: 'query',
        type: 'number',
        required: false,
      },
    ],
    response: {
      statusCode: 200,
      description: 'Success',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                userName: { type: 'string' },
                userEmail: { type: 'string' },
              },
            },
          },
        },
      },
    },
    deprecation: {} as any,
  },
];

const analysis = breakingChangeDetector.compareVersions(oldEndpoints, newEndpoints);
console.log('Breaking changes found:', analysis.summary);
console.log('Breaking change details:', analysis.breakingChanges);

// Get impact score
const impact = breakingChangeDetector.getImpactScore(analysis.breakingChanges);
console.log('Impact score:', impact);

// Get recommendations
const changeRecommendations = breakingChangeDetector.getRecommendations(analysis.breakingChanges);
console.log('Change recommendations:', changeRecommendations);

// Example 5: Compatibility testing
console.log('\n=== Example 5: Compatibility Testing ===');

const v1Contract = {
  version: '1.0.0',
  endpoints: oldEndpoints,
  schemas: {},
  securitySchemes: {
    bearerAuth: {
      type: 'http' as const,
      scheme: 'bearer',
    },
  },
  metadata: {
    title: 'API v1',
    description: 'Version 1 of the API',
    version: '1.0.0',
    baseUrl: 'https://api.claudeflare.com/v1',
  },
};

const v2Contract = {
  version: '2.0.0',
  endpoints: newEndpoints,
  schemas: {},
  securitySchemes: {
    bearerAuth: {
      type: 'http' as const,
      scheme: 'bearer',
    },
  },
  metadata: {
    title: 'API v2',
    description: 'Version 2 of the API',
    version: '2.0.0',
    baseUrl: 'https://api.claudeflare.com/v2',
  },
};

const compatibilityTest = await compatibilityTester.testCompatibility(v1Contract, v2Contract);
console.log('Compatibility test:', compatibilityTest.compatible);
console.log('Breaking changes:', compatibilityTest.breakingChanges.length);
console.log('Recommendations:', compatibilityTest.recommendations);

// Example 6: Migration
console.log('\n=== Example 6: Migration ===');

// Register transform rules
migrationEngine.registerTransform({
  name: 'transform-v1-to-v2-request',
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  transform: 'request_transform' as any,
  priority: 1,
});

// Transform request
const oldRequest = {
  limit: 10,
  filter: 'active',
};

const requestMigration = migrationEngine.transformRequest(oldRequest, '1.0.0', '2.0.0');
console.log('Request migration:', requestMigration);

// Transform response
const newResponse = {
  data: [
    {
      userId: '123',
      userName: 'John Doe',
      userEmail: 'john@example.com',
    },
  ],
};

const responseMigration = migrationEngine.transformResponse(newResponse, '2.0.0', '1.0.0');
console.log('Response migration:', responseMigration);

// Validate migration
const validation = migrationEngine.validateMigration('1.0.0', '2.0.0', oldRequest);
console.log('Migration validation:', validation);

// Example 7: Generate migration guide
console.log('\n=== Example 7: Migration Guide ===');

const migrationGuide = guideGenerator.generateGuide(
  '1.0.0',
  '2.0.0',
  analysis.breakingChanges,
  {
    includeCodeExamples: true,
    includeRollback: true,
    includeTesting: true,
    detailLevel: 'comprehensive',
  }
);

console.log('Migration guide overview:', migrationGuide.overview.substring(0, 200) + '...');
console.log('Estimated time:', migrationGuide.estimatedTime);
console.log('Difficulty:', migrationGuide.difficulty);
console.log('Number of steps:', migrationGuide.steps.length);
console.log('Number of code examples:', migrationGuide.codeExamples.length);

// Example 8: Validation
console.log('\n=== Example 8: Validation ===');

const versionValidation = apiValidator.validateVersion({
  version: '1.0.0',
  semver: SemanticVersioning.parse('1.0.0'),
  status: VersionStatus.STABLE,
  releasedAt: new Date(),
  description: 'Test version',
  breakingChanges: [],
  features: [],
  deprecations: [],
});

console.log('Version validation:', versionValidation.valid);
console.log('Validation errors:', versionValidation.errors);
console.log('Validation warnings:', versionValidation.warnings);

const deprecationValidation = apiValidator.validateDeprecation(deprecation);
console.log('Deprecation validation:', deprecationValidation.valid);

// Example 9: Version utilities
console.log('\n=== Example 9: Version Utilities ===');

console.log('Extract version from path:', VersionUtils.extractVersionFromPath('/api/v1.0.0/users'));
console.log('Inject version into path:', VersionUtils.injectVersionIntoPath('/api/users', '2.0.0'));
console.log('Calculate next version:', VersionUtils.calculateNextVersion('1.0.0', {
  breaking: true,
  features: false,
  fixes: false,
}));

const lifecycle = VersionUtils.getVersionLifecycle({
  version: '1.0.0',
  semver: SemanticVersioning.parse('1.0.0'),
  status: VersionStatus.STABLE,
  releasedAt: new Date('2024-01-01'),
  description: 'Test',
  breakingChanges: [],
  features: [],
  deprecations: [],
});
console.log('Version lifecycle:', lifecycle);

const versionSuggestions = VersionUtils.getVersionSuggestions('1.0.0', ['1.1.0', '2.0.0']);
console.log('Version suggestions:', versionSuggestions);

// Example 10: Version resolution from request context
console.log('\n=== Example 10: Version Resolution ===');

const contexts = [
  {
    request: new Request('https://api.claudeflare.com/api/v1/users'),
    headers: new Headers(),
    query: new URLSearchParams(),
    cookies: {},
  },
  {
    request: new Request('https://api.claudeflare.com/users'),
    headers: new Headers({ 'API-Version': '2.0.0' }),
    query: new URLSearchParams(),
    cookies: {},
  },
  {
    request: new Request('https://api.claudeflare.com/users'),
    headers: new Headers(),
    query: new URLSearchParams('version=1.1.0'),
    cookies: {},
  },
];

for (const context of contexts) {
  const resolution = versionManager.resolveVersion(context);
  console.log(`Resolved version from ${context.request.url}:`, resolution.version);
  console.log(`  Strategy:`, resolution.strategy);
  console.log(`  Confidence:`, resolution.confidence);
}

console.log('\n=== Examples Complete ===');
