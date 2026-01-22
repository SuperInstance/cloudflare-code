# @claudeflare/github

Comprehensive GitHub Integration and Automation for the ClaudeFlare distributed AI coding platform.

## Features

### Core Capabilities

- **GitHub API v3 & v4**: Full REST API and GraphQL API support
- **GitHub Apps**: Complete GitHub App authentication and installation support
- **Webhook Handling**: Signature verification, event parsing, and routing
- **Rate Limiting**: Intelligent rate limit tracking and handling
- **Caching**: In-memory and Redis caching with TTL
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Comprehensive error classes and handling

### PR Automation

- Create, update, and merge pull requests
- Review automation and management
- Label and assignee management
- Status check creation and monitoring
- Auto-merge with custom rules
- Draft PR support

### Issue Management

- Create, update, and close issues
- Issue linking and relationships
- Label and milestone management
- Bulk operations support
- Issue analytics and reporting
- Timeline tracking

### Repository Management

- Repository CRUD operations
- Branch management and protection
- File operations (create, update, delete)
- Release management
- Collaboration management
- Repository analytics

### CI/CD Integration

- GitHub Actions integration
- Workflow triggering and monitoring
- Artifact management
- Deployment management
- Environment management
- Check suite and check run operations
- CI/CD analytics

### Security Integration

- Code scanning alerts
- Secret scanning alerts
- Dependabot integration
- Security advisories
- Vulnerability management
- Security analytics and scoring

## Installation

```bash
npm install @claudeflare/github
```

## Quick Start

### Basic Client Setup

```typescript
import { createGitHubClient, AuthType } from '@claudeflare/github';

const client = createGitHubClient({
  auth: {
    type: AuthType.PersonalAccessToken,
    token: process.env.GITHUB_TOKEN
  },
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    type: 'memory'
  },
  retry: {
    maxRetries: 3,
    retryAfter: 1000,
    factor: 2,
    maxTimeout: 30000,
    retryableStatuses: [408, 413, 429, 500, 502, 503, 504]
  }
});
```

### GitHub App Authentication

```typescript
import { createGitHubClient, AuthType } from '@claudeflare/github';

const client = createGitHubClient({
  auth: {
    type: AuthType.GitHubApp,
    appId: parseInt(process.env.GITHUB_APP_ID),
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET
  }
});

// Authenticate as app
await client.authenticateAsApp();

// Or authenticate as installation
await client.authenticateAsInstallation(installationId);
```

### Using Redis Cache

```typescript
const client = createGitHubClient({
  auth: {
    type: AuthType.PersonalAccessToken,
    token: process.env.GITHUB_TOKEN
  },
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 10000,
    type: 'redis',
    redis: {
      host: 'localhost',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0
    }
  }
});
```

## Usage Examples

### Repository Operations

```typescript
import { createRepositoryManager } from '@claudeflare/github';

const repoManager = createRepositoryManager(client);

// Get repository
const repo = await repoManager.getRepository('octocat', 'Hello-World');

// List repositories
const repos = await repoManager.listRepositories();

// Create repository
const newRepo = await repoManager.createRepository('my-org', {
  name: 'my-new-repo',
  description: 'My new repository',
  private: true,
  autoInit: true,
  gitignoreTemplate: 'TypeScript'
});

// Create branch
const branch = await repoManager.createBranch('octocat', 'Hello-World', 'feature-branch', 'main');

// Update file
await repoManager.createOrUpdateFile('octocat', 'Hello-World', 'README.md', {
  content: '# My Project\n',
  message: 'Update README'
});
```

### Pull Request Automation

```typescript
import { createPRAutomation, PullRequestMergeMethod } from '@claudeflare/github';

const prAutomation = createPRAutomation(client);

// Create pull request
const pr = await prAutomation.createPullRequest('octocat', 'Hello-World', {
  title: 'Add new feature',
  body: 'This PR adds a new feature',
  head: 'feature-branch',
  base: 'main',
  labels: ['enhancement', 'ready-for-review'],
  reviewers: ['octocat']
});

// Update pull request
await prAutomation.updatePullRequest('octocat', 'Hello-World', pr.number, {
  title: 'Add new feature (updated)'
});

// Merge pull request
await prAutomation.mergePullRequest('octocat', 'Hello-World', pr.number, {
  mergeMethod: PullRequestMergeMethod.Squash
});

// Auto-merge with rules
await prAutomation.autoMergePullRequest('octocat', 'Hello-World', pr.number, {
  requiredApprovingReviewCount: 1,
  requireCodeOwnerReviews: true,
  requiredStatusChecks: ['ci/test', 'ci/lint'],
  autoMergeMethod: PullRequestMergeMethod.Merge
});
```

### Issue Management

```typescript
import { createIssueManager } from '@claudeflare/github';

const issueManager = createIssueManager(client);

// Create issue
const issue = await issueManager.createIssue('octocat', 'Hello-World', {
  title: 'Bug: Feature not working',
  body: 'Describe the bug here',
  labels: ['bug', 'high-priority'],
  assignees: ['octocat']
});

// Create issue from template
const templateIssue = await issueManager.createIssueFromTemplate(
  'octocat',
  'Hello-World',
  {
    title: 'Bug Report: {{featureName}}',
    body: '## Bug Description\n{{bugDescription}}\n\n## Steps to Reproduce\n{{steps}}',
    labels: ['bug']
  },
  { featureName: 'Authentication', bugDescription: 'Login fails', steps: '1. Go to login\n2. Enter credentials' }
);

// Get analytics
const analytics = await issueManager.getAnalytics('octocat', 'Hello-World');

console.log(`Total issues: ${analytics.total}`);
console.log(`Open issues: ${analytics.open}`);
console.log(`Average close time: ${analytics.averageCloseTime}ms`);
```

### Webhook Handling

```typescript
import { createWebhookHandler, WebhookEvent, EventFilters } from '@claudeflare/github';

const webhookHandler = createWebhookHandler({
  secret: process.env.GITHUB_WEBHOOK_SECRET,
  path: '/webhook',
  eventFilter: EventFilters.combine(
    EventFilters.byOwner('my-org'),
    EventFilters.not(EventFilters.byAction('deleted'))
  )
});

// Register event handler
webhookHandler.on(WebhookEvent.PullRequest, async (context, event) => {
  if (context.action === 'opened') {
    console.log(`New PR opened: ${event.pull_request.title}`);

    // Add labels
    await prAutomation.addLabels(
      context.repository.owner.login,
      context.repository.name,
      context.payload.number,
      ['needs-review']
    );
  }
});

// Register wildcard handler
webhookHandler.onAny(async (context, event) => {
  console.log(`Received event: ${context.name}`);
});

// Register error handler
webhookHandler.onError(async (error, context) => {
  console.error(`Error handling webhook: ${error.message}`);
});

// Use with Express
app.use('/webhook', (req, res) => webhookHandler.handle(req, res));
```

### CI/CD Integration

```typescript
import { createCICDIntegration } from '@claudeflare/github';

const cicd = createCICDIntegration(client);

// List workflow runs
const runs = await cicd.listWorkflowRuns('octocat', 'Hello-World', {
  status: 'completed',
  conclusion: 'success'
});

// Trigger workflow
await cicd.triggerWorkflow('octocat', 'Hello-World', workflowId, {
  ref: 'main',
  inputs: {
    environment: 'production',
    version: '1.0.0'
  }
});

// Get artifacts
const artifacts = await cicd.listArtifactsForWorkflowRun('octocat', 'Hello-World', runId);

// Download artifact
const artifactBuffer = await cicd.downloadArtifact('octocat', 'Hello-World', artifactId);

// Create deployment
const deployment = await cicd.createDeployment('octocat', 'Hello-World', {
  ref: 'main',
  environment: 'production',
  description: 'Deploy to production'
});

// Create deployment status
await cicd.createDeploymentStatus('octocat', 'Hello-World', deployment.id, {
  state: 'success',
  environmentUrl: 'https://example.com'
});

// Get CI/CD analytics
const analytics = await cicd.getWorkflowAnalytics('octocat', 'Hello-World');

console.log(`Success rate: ${analytics.successRate * 100}%`);
console.log(`Average duration: ${analytics.averageDuration}ms`);
```

### Security Integration

```typescript
import { createSecurityIntegration } from '@claudeflare/github';

const security = createSecurityIntegration(client);

// List code scanning alerts
const alerts = await security.listCodeScanningAlerts('octocat', 'Hello-World', {
  state: 'open',
  securitySeverityLevel: 'high'
});

// Update alert
await security.updateCodeScanningAlert('octocat', 'Hello-World', alertNumber, {
  state: 'dismissed',
  dismissedReason: 'false positive',
  dismissedComment: 'This is a false positive'
});

// List Dependabot alerts
const dependabotAlerts = await security.listDependabotAlerts('octocat', 'Hello-World');

// Get security analytics
const analytics = await security.getSecurityAnalytics('octocat', 'Hello-World');

console.log(`Code scanning alerts: ${analytics.codeScanning.open}`);
console.log(`Secret scanning alerts: ${analytics.secretScanning.open}`);
console.log(`Dependabot alerts: ${analytics.dependabot.open}`);

// Get security score
const score = await security.getSecurityScore('octocat', 'Hello-World');

console.log(`Overall security score: ${score.overall}/100`);
console.log(`Details:`, score.details);
```

## API Reference

### Core Classes

- **GitHubClient**: Main client for API interactions
- **PRAutomation**: Pull request automation
- **IssueManager**: Issue management
- **RepositoryManager**: Repository operations
- **CICDIntegration**: CI/CD integration
- **SecurityIntegration**: Security scanning and alerts
- **WebhookHandler**: Webhook event handling

### Type Definitions

Complete TypeScript type definitions are included for all API responses and options.

## Error Handling

The package includes comprehensive error classes:

```typescript
import {
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  PullRequestError,
  RepositoryError,
  SecurityError
} from '@claudeflare/github';

try {
  const repo = await client.getRepository('owner', 'repo');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Repository not found');
  } else if (error instanceof RateLimitError) {
    console.log('Rate limit exceeded, waiting...');
    await error.getRetryDelay();
  }
}
```

## Rate Limiting

The client automatically tracks and manages rate limits:

```typescript
// Get current rate limits
const limits = client.getRateLimits();

console.log(`Core: ${limits.core.remaining}/${limits.core.limit}`);
console.log(`Search: ${limits.search.remaining}/${limits.search.limit}`);

// Subscribe to rate limit changes
const unsubscribe = client.onRateLimitChange((limits) => {
  console.log('Rate limits updated:', limits);
});

// Wait for rate limit reset
await client['rateLimitTracker'].waitForReset('core');
```

## Caching

### In-Memory Cache (Default)

```typescript
const client = createGitHubClient({
  auth: { ... },
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 1000,
    type: 'memory'
  }
});
```

### Redis Cache

```typescript
const client = createGitHubClient({
  auth: { ... },
  cache: {
    enabled: true,
    ttl: 3600000,
    maxSize: 10000,
    type: 'redis',
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'password',
      db: 0
    }
  }
});
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

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please use the GitHub issue tracker.
