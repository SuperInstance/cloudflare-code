# GitHub Integration for ClaudeFlare

Comprehensive GitHub integration layer built for Cloudflare Workers, featuring Git operations, Pull Request automation, webhook handling, and monorepo support.

## Features

- **GitHub API Client**: Full-featured client with rate limiting, retries, and error handling
- **Webhook Handling**: Secure webhook signature verification and event routing
- **Git Operations**: Branching, committing, file operations, and more via GitHub API
- **Pull Request Automation**: Create, review, merge, and automate PR workflows
- **Monorepo Detection**: Auto-detect and work with npm, yarn, pnpm, lerna, turborepo, nx, and rush
- **GitHub App Authentication**: JWT-based authentication with installation tokens
- **Rate Limit Management**: Intelligent rate limiting with exponential backoff
- **Storage Integration**: KV/R2 integration for caching and repository state

## Installation

```bash
npm install @claudeflare/github
```

## Quick Start

### 1. Setup GitHub App

Create a GitHub App at https://github.com/settings/apps with:
- **Permissions**: Contents (Read/Write), Pull Requests (Read/Write), Issues (Read/Write)
- **Webhook**: Set webhook URL and secret
- **Note**: Copy App ID, Private Key, and Webhook Secret

### 2. Configure Environment

```typescript
// wrangler.toml
[vars]
GITHUB_APP_ID = "123456"
GITHUB_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET = "your-webhook-secret"
```

### 3. Use the Client

```typescript
import { createGitHubClient } from '@claudeflare/github';

const config = {
  appId: parseInt(GITHUB_APP_ID),
  privateKey: GITHUB_PRIVATE_KEY,
  webhookSecret: GITHUB_WEBHOOK_SECRET,
};

const client = createGitHubClient(config);

// Set installation context
await client.setInstallation(installationId);

// Get repository
const repo = await client.getRepository('owner', 'repo');
console.log(repo.default_branch); // 'main'
```

## Usage

### Repository Operations

```typescript
// Get repository info
const repo = await client.getRepository('owner', 'repo');

// List repositories
const repos = await client.listRepositories();

// Get file content
const file = await client.getFile('owner', 'repo', 'path/to/file.txt');
console.log(file.decodedContent);

// Create or update file
await client.createOrUpdateFile(
  'owner', 'repo', 'path/to/file.txt',
  'New content',
  'Update file',
  'old-sha',
  'main'
);

// Delete file
await client.deleteFile('owner', 'repo', 'path/to/file.txt', 'Delete file', 'sha');
```

### Git Operations

```typescript
import {
  createBranch,
  createCommit,
  readFile,
  writeFile,
} from '@claudeflare/github';

// Create branch
await createBranch(client, {
  owner: 'owner',
  repo: 'repo',
  branch: 'feature-branch',
  fromBranch: 'main',
});

// Make file changes
await writeFile(client, 'owner', 'repo', 'test.txt', 'content', 'commit message', 'feature-branch');

// Create commit
const commit = await createCommit(client, {
  owner: 'owner',
  repo: 'repo',
  branch: 'feature-branch',
  message: 'Add new feature',
  files: [
    { path: 'file1.txt', content: 'content1' },
    { path: 'file2.txt', content: 'content2' },
  ],
});
```

### Pull Request Automation

```typescript
import {
  createPullRequest,
  approvePullRequest,
  mergePullRequest,
  autoMergePullRequest,
  labelPRBySize,
} from '@claudeflare/github';

// Create PR
const pr = await createPullRequest(client, {
  owner: 'owner',
  repo: 'repo',
  title: 'Add new feature',
  body: 'Description of changes',
  head: 'feature-branch',
  base: 'main',
  labels: ['enhancement', 'size:small'],
  assignees: ['username'],
});

// Approve PR
await approvePullRequest(client, 'owner', 'repo', pr.number, 'Looks good!');

// Merge PR
await mergePullRequest(client, {
  owner: 'owner',
  repo: 'repo',
  pullNumber: pr.number,
  mergeMethod: 'squash',
});

// Auto-merge if conditions met
const result = await autoMergePullRequest(client, 'owner', 'repo', pr.number, {
  requireApproval: true,
  approvalCount: 1,
  mergeMethod: 'squash',
});

// Label by size
await labelPRBySize(client, 'owner', 'repo', pr.number);
```

### Webhook Handling

```typescript
import {
  processWebhook,
  createDefaultWebhookRouter,
  webhookMiddleware,
  handlePushEvent,
} from '@claudeflare/github';
import { Hono } from 'hono';

const app = new Hono();
const router = createDefaultWebhookRouter();

// Custom handler
router.on('push', async (context) => {
  console.log('Push to', context.payload.repository?.full_name);
  return { success: true, message: 'Push processed' };
});

// Webhook endpoint
app.post('/webhook', async (c) => {
  const result = await processWebhook(
    c.req.raw,
    GITHUB_WEBHOOK_SECRET,
    router
  );

  return c.json(result);
});

// Or use middleware
app.use('/webhook/*', webhookMiddleware({ secret: GITHUB_WEBHOOK_SECRET }));
```

### Monorepo Detection

```typescript
import {
  detectMonorepo,
  listMonorepoPackages,
  buildDependencyGraph,
  calculateBuildOrder,
} from '@claudeflare/github';

// Detect monorepo
const monorepo = await detectMonorepo(client, 'owner', 'repo', 'main');

if (monorepo) {
  console.log('Monorepo type:', monorepo.type); // 'npm', 'yarn', 'pnpm', 'lerna', etc.
  console.log('Package manager:', monorepo.packageManager);
  console.log('Workspaces:', monorepo.packages);

  // List all packages
  const packages = await listMonorepoPackages(client, 'owner', 'repo', monorepo);

  // Build dependency graph
  const graph = await buildDependencyGraph(client, 'owner', 'repo', packages);

  // Calculate build order for changed packages
  const buildOrder = await calculateBuildOrder(
    changedPackages,
    graph,
    packages
  );

  console.log('Build order:', buildOrder);
}
```

## API Reference

### GitHubClient

Main client for interacting with GitHub API.

#### Constructor

```typescript
const client = createGitHubClient(config, options);
```

**Options:**
- `config`: GitHub App configuration
- `baseUrl`: Custom API base URL (default: `https://api.github.com`)
- `maxRetries`: Maximum retry attempts (default: `5`)
- `retryDelay`: Base retry delay in ms (default: `1000`)
- `timeout`: Request timeout in ms (default: `30000`)

#### Methods

**Repository:**
- `getRepository(owner, repo)` - Get repository info
- `listRepositories(page?, perPage?)` - List installation repositories
- `getFile(owner, repo, path, ref?)` - Get file content
- `createOrUpdateFile(...)` - Create or update file
- `deleteFile(...)` - Delete file

**Git:**
- `getReference(owner, repo, ref)` - Get branch/tag reference
- `createReference(...)` - Create reference
- `updateReference(...)` - Update reference
- `deleteReference(...)` - Delete reference
- `getCommit(owner, repo, sha)` - Get commit
- `listCommits(...)` - List commits
- `createCommit(...)` - Create commit
- `compareCommits(...)` - Compare commits

**Pull Requests:**
- `getPullRequest(owner, repo, number)` - Get PR
- `listPullRequests(...)` - List PRs
- `createPullRequest(...)` - Create PR
- `updatePullRequest(...)` - Update PR
- `mergePullRequest(...)` - Merge PR
- `createPullRequestReview(...)` - Create review
- `createPullRequestComment(...)` - Create comment

**Issues:**
- `getIssue(owner, repo, number)` - Get issue
- `listIssues(...)` - List issues
- `createIssue(...)` - Create issue
- `createIssueComment(...)` - Create comment

**Search:**
- `searchCode(query)` - Search code
- `searchRepositories(query)` - Search repositories
- `searchIssues(query)` - Search issues

**Rate Limiting:**
- `getCurrentRateLimit(resource)` - Get rate limit info
- `isRateLimitExceeded(resource)` - Check if exceeded
- `getTimeUntilReset(resource)` - Get ms until reset

### WebhookRouter

Routes webhook events to handlers.

#### Methods

```typescript
const router = new WebhookRouter();

router.on(event, handler);              // Register handler
router.onMany(handlers);                 // Register multiple handlers
router.onFallback(handler);              // Register fallback handler
await router.route(context);             // Route event
```

### Monorepo Functions

**Detection:**
- `detectMonorepo(client, owner, repo, branch?)` - Detect monorepo config
- `detectPackageManager(client, owner, repo, branch?)` - Detect package manager

**Packages:**
- `listMonorepoPackages(client, owner, repo, config, branch?)` - List packages
- `getPackageInfo(client, owner, repo, packagePath, branch?)` - Get package info

**Dependencies:**
- `buildDependencyGraph(client, owner, repo, packages)` - Build dependency graph
- `getDependents(graph, packageName)` - Get dependents
- `getTransitiveDependencies(graph, packageName)` - Get transitive deps
- `topologicalSort(graph)` - Get build order

**Changes:**
- `detectChangedPackages(client, owner, repo, baseSha, headSha, packages)` - Detect changes
- `calculateBuildOrder(changedPackages, graph, packages)` - Calculate build order

## Architecture

### Components

```
lib/github/
├── types.ts          # Type definitions
├── auth.ts           # GitHub App authentication
├── client.ts         # GitHub API client
├── webhooks.ts       # Webhook handling
├── operations.ts     # Git operations
├── pr.ts             # Pull request automation
├── monorepo.ts       # Monorepo detection
├── index.ts          # Main exports
└── README.md         # This file
```

### Design Patterns

**Rate Limiting:**
- Tracks rate limit from response headers
- Exponential backoff on 429 responses
- Per-resource tracking (core, search, graphql)

**Error Handling:**
- Custom error types (GitHubAPIError, GitHubAuthError, GitHubRateLimitError)
- Automatic retry with exponential backoff
- Graceful degradation on rate limits

**Caching:**
- Installation tokens cached with expiration
- KV storage for persisting cache across requests
- R2 for repository archives

**Security:**
- HMAC-SHA256 signature verification for webhooks
- JWT-based GitHub App authentication
- Secure token storage in Durable Objects

### Performance

- **Cold Start**: <5ms lazy initialization
- **Rate Limiting**: Intelligent backoff prevents throttling
- **Caching**: Token caching reduces auth overhead
- **Bundle Size**: Tree-shaking reduces bundle impact

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- github/client.test
```

## Deployment

### Wrangler Configuration

```toml
# wrangler.toml
name = "claudeflare-github"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
GITHUB_APP_ID = "123456"
GITHUB_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET = "webhook-secret"

[[durable_objects.bindings]]
name = "GITHUB_DO"
class_name = "GitHubDurableObject"

[[kv_namespaces]]
binding = "GITHUB_KV"
id = "..."

[[r2_buckets]]
binding = "GITHUB_R2"
bucket_name = "github-storage"
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_APP_ID` | Yes | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | Yes | GitHub App private key (PEM format) |
| `GITHUB_WEBHOOK_SECRET` | Yes | Webhook secret for signature verification |
| `GITHUB_CLIENT_ID` | No | OAuth App client ID (for OAuth flow) |
| `GITHUB_CLIENT_SECRET` | No | OAuth App client secret (for OAuth flow) |

## Examples

### Create PR from Branch

```typescript
import { createPullRequestFromBranch } from '@claudeflare/github';

const pr = await createPullRequestFromBranch(
  client,
  'owner', 'repo',
  'feature-branch',
  'main',
  'Add new feature',
  'Description of changes'
);
```

### Auto-merge Ready PRs

```typescript
import { autoMergePullRequest } from '@claudeflare/github';

// Automatically merge PR if it has approval
const result = await autoMergePullRequest(client, 'owner', 'repo', 123, {
  requireApproval: true,
  approvalCount: 1,
  mergeMethod: 'squash',
});

if (result.success) {
  console.log('PR merged successfully');
}
```

### Process Webhook Events

```typescript
import { processWebhook, createDefaultWebhookRouter } from '@claudeflare/github';

const router = createDefaultWebhookRouter();

// Custom handler
router.on('push', async (context) => {
  const payload = context.payload as PushWebhookPayload;
  console.log(`Push to ${payload.ref}`);

  // Trigger CI/CD
  await triggerCI(payload.repository.full_name, payload.after);

  return { success: true };
});

// Process webhook
app.post('/webhook', async (c) => {
  const result = await processWebhook(
    c.req.raw,
    GITHUB_WEBHOOK_SECRET,
    router
  );

  return c.json(result);
});
```

### Monorepo Build Order

```typescript
import {
  detectMonorepo,
  listMonorepoPackages,
  buildDependencyGraph,
  calculateBuildOrder,
} from '@claudeflare/github';

// Detect monorepo
const monorepo = await detectMonorepo(client, 'owner', 'repo');
if (!monorepo) return;

// Get packages
const packages = await listMonorepoPackages(client, 'owner', 'repo', monorepo);

// Build dependency graph
const graph = await buildDependencyGraph(client, 'owner', 'repo', packages);

// Calculate build order for changed packages
const changedPackages = ['packages/pkg-a', 'packages/pkg-b'];
const buildOrder = calculateBuildOrder(changedPackages, graph, packages);

console.log('Build order:', buildOrder);
// Output: ['packages/pkg-a', 'packages/pkg-b', 'packages/pkg-c']
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

## Support

- Documentation: https://docs.claudeflare.com
- Issues: https://github.com/claudeflare/claudeflare/issues
- Discord: https://discord.gg/claudeflare
