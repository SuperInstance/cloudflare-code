/**
 * ClaudeFlare GitHub Integration - Usage Examples
 * This file demonstrates common usage patterns for the GitHub integration package
 */

import {
  createGitHubClient,
  AuthType,
  createPRAutomation,
  createIssueManager,
  createRepositoryManager,
  createCICDIntegration,
  createSecurityIntegration,
  createWebhookHandler,
  EventFilters,
  WebhookEvent,
  PullRequestMergeMethod
} from '../src';

// ============================================================================
// Client Setup Examples
// ============================================================================

/**
 * Example 1: Basic PAT Authentication
 */
async function example1_PATAuthentication() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: {
      enabled: true,
      ttl: 300000,
      maxSize: 1000,
      type: 'memory'
    }
  });

  const user = await client.getAuthenticatedUser();
  console.log('Authenticated as:', user.login);
}

/**
 * Example 2: GitHub App Authentication
 */
async function example2_GitHubAppAuthentication() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.GitHubApp,
      appId: parseInt(process.env.GITHUB_APP_ID!),
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      clientId: process.env.GITHUB_APP_CLIENT_ID!,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!
    },
    cache: {
      enabled: true,
      ttl: 300000,
      maxSize: 1000,
      type: 'memory'
    }
  });

  // Authenticate as app
  await client.authenticateAsApp();

  // Or authenticate as installation
  await client.authenticateAsInstallation(12345);
}

/**
 * Example 3: Using Redis Cache
 */
async function example3_RedisCache() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: {
      enabled: true,
      ttl: 3600000,
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
}

// ============================================================================
// Repository Management Examples
// ============================================================================

/**
 * Example 4: Repository Operations
 */
async function example4_RepositoryOperations() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const repoManager = createRepositoryManager(client);

  // Get repository
  const repo = await repoManager.getRepository('octocat', 'Hello-World');
  console.log('Repository:', repo.name);

  // List repositories
  const repos = await repoManager.listRepositories();
  console.log('Total repositories:', repos.length);

  // Create repository
  const newRepo = await repoManager.createRepositoryForAuthenticatedUser({
    name: 'my-new-repo',
    description: 'My new repository',
    private: true,
    autoInit: true,
    gitignoreTemplate: 'TypeScript'
  });

  // Create branch
  const branch = await repoManager.createBranch('octocat', 'Hello-World', 'feature-branch', 'main');
  console.log('Created branch:', branch.name);

  // Update file
  const file = await repoManager.createOrUpdateFile('octocat', 'Hello-World', 'README.md', {
    content: '# My Project\n',
    message: 'Update README'
  });

  // Get repository analytics
  const analytics = await repoManager.getRepositoryAnalytics('octocat', 'Hello-World');
  console.log('Stars:', analytics.stars);
  console.log('Forks:', analytics.forks);
}

/**
 * Example 5: Branch Protection
 */
async function example5_BranchProtection() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const repoManager = createRepositoryManager(client);

  // Set branch protection
  await repoManager.setBranchProtection('octocat', 'Hello-World', 'main', {
    requiredApprovingReviewCount: 1,
    requireCodeOwnerReviews: true,
    dismissStaleReviews: true,
    requiredStatusChecks: {
      strict: true,
      contexts: ['ci/test', 'ci/lint']
    },
    enforceAdmins: true,
    allowDeletions: false,
    requireLinearHistory: true
  });

  // Get branch protection
  const protection = await repoManager.getBranchProtection('octocat', 'Hello-World', 'main');
  console.log('Branch protection:', protection);
}

// ============================================================================
// Pull Request Examples
// ============================================================================

/**
 * Example 6: PR Creation and Management
 */
async function example6_PRManagement() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const prAutomation = createPRAutomation(client);

  // Create PR
  const pr = await prAutomation.createPullRequest('octocat', 'Hello-World', {
    title: 'Add new feature',
    body: 'This PR adds a new feature',
    head: 'feature-branch',
    base: 'main',
    labels: ['enhancement'],
    assignees: ['octocat'],
    reviewers: ['octocat']
  });

  // Update PR
  await prAutomation.updatePullRequest('octocat', 'Hello-World', pr.number, {
    title: 'Add new feature (updated)'
  });

  // Add labels
  await prAutomation.addLabels('octocat', 'Hello-World', pr.number, ['ready-for-review']);

  // Request review
  await prAutomation.requestReviewers('octocat', 'Hello-World', pr.number, {
    reviewers: ['reviewer1', 'reviewer2']
  });

  // Merge PR
  await prAutomation.mergePullRequest('octocat', 'Hello-World', pr.number, {
    mergeMethod: PullRequestMergeMethod.Squash
  });
}

/**
 * Example 7: Auto-Merge with Rules
 */
async function example7_AutoMerge() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const prAutomation = createPRAutomation(client);

  await prAutomation.autoMergePullRequest('octocat', 'Hello-World', 123, {
    requiredApprovingReviewCount: 1,
    requireCodeOwnerReviews: true,
    dismissStaleReviews: true,
    requiredStatusChecks: ['ci/test', 'ci/lint'],
    requireUpToDateBranch: true,
    autoMergeMethod: PullRequestMergeMethod.Merge,
    deleteBranchAfterMerge: true
  });
}

// ============================================================================
// Issue Management Examples
// ============================================================================

/**
 * Example 8: Issue Operations
 */
async function example8_IssueManagement() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const issueManager = createIssueManager(client);

  // Create issue
  const issue = await issueManager.createIssue('octocat', 'Hello-World', {
    title: 'Bug: Feature not working',
    body: 'Describe the bug here',
    labels: ['bug', 'high-priority'],
    assignees: ['octocat']
  });

  // Add comment
  await issueManager.createComment('octocat', 'Hello-World', issue.number, 'Working on this');

  // Set labels
  await issueManager.setLabels('octocat', 'Hello-World', issue.number, ['bug', 'in-progress']);

  // Close issue
  await issueManager.closeIssue('octocat', 'Hello-World', issue.number);

  // Get analytics
  const analytics = await issueManager.getAnalytics('octocat', 'Hello-World');
  console.log('Total issues:', analytics.total);
  console.log('Average close time:', analytics.averageCloseTime);
}

/**
 * Example 9: Bulk Operations
 */
async function example9_BulkOperations() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const issueManager = createIssueManager(client);

  // Create multiple issues
  const issues = await issueManager.createBatchIssues('octocat', 'Hello-World', [
    { title: 'Issue 1', body: 'First issue' },
    { title: 'Issue 2', body: 'Second issue' },
    { title: 'Issue 3', body: 'Third issue' }
  ]);

  // Bulk add labels
  await issueManager.bulkAddLabels(
    'octocat',
    'Hello-World',
    issues.map(i => i.number),
    ['batch']
  );

  // Bulk close
  await issueManager.bulkClose(
    'octocat',
    'Hello-World',
    issues.map(i => i.number)
  );
}

// ============================================================================
// CI/CD Examples
// ============================================================================

/**
 * Example 10: CI/CD Integration
 */
async function example10_CICDIntegration() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const cicd = createCICDIntegration(client);

  // Trigger workflow
  await cicd.triggerWorkflow('octocat', 'Hello-World', 12345, {
    ref: 'main',
    inputs: {
      environment: 'production',
      version: '1.0.0'
    }
  });

  // List workflow runs
  const runs = await cicd.listWorkflowRuns('octocat', 'Hello-World', {
    status: 'completed'
  });

  // Get artifacts
  const artifacts = await cicd.listArtifactsForWorkflowRun('octocat', 'Hello-World', runs[0].id);

  // Create deployment
  const deployment = await cicd.createDeployment('octocat', 'Hello-World', {
    ref: 'main',
    environment: 'production'
  });

  // Create deployment status
  await cicd.createDeploymentStatus('octocat', 'Hello-World', deployment.id, {
    state: 'success',
    environmentUrl: 'https://example.com'
  });

  // Get CI/CD analytics
  const analytics = await cicd.getWorkflowAnalytics('octocat', 'Hello-World');
  console.log('Success rate:', analytics.successRate);
}

// ============================================================================
// Security Examples
// ============================================================================

/**
 * Example 11: Security Integration
 */
async function example11_SecurityIntegration() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  const security = createSecurityIntegration(client);

  // List code scanning alerts
  const alerts = await security.listCodeScanningAlerts('octocat', 'Hello-World', {
    state: 'open',
    securitySeverityLevel: 'high'
  });

  // Update alert
  await security.updateCodeScanningAlert('octocat', 'Hello-World', alerts[0].number, {
    state: 'dismissed',
    dismissedReason: 'false positive'
  });

  // List Dependabot alerts
  const dependabotAlerts = await security.listDependabotAlerts('octocat', 'Hello-World');

  // Get security analytics
  const analytics = await security.getSecurityAnalytics('octocat', 'Hello-World');
  console.log('Code scanning alerts:', analytics.codeScanning.open);

  // Get security score
  const score = await security.getSecurityScore('octocat', 'Hello-World');
  console.log('Security score:', score.overall);
}

// ============================================================================
// Webhook Examples
// ============================================================================

/**
 * Example 12: Webhook Handler
 */
async function example12_WebhookHandler() {
  const webhookHandler = createWebhookHandler({
    secret: process.env.GITHUB_WEBHOOK_SECRET!,
    path: '/webhook',
    eventFilter: EventFilters.combine(
      EventFilters.byOwner('my-org'),
      EventFilters.not(EventFilters.byAction('deleted'))
    )
  });

  // Register PR handler
  webhookHandler.on(WebhookEvent.PullRequest, async (context, event) => {
    if (context.action === 'opened') {
      console.log(`New PR: ${event.pull_request.title}`);

      // Add labels
      const client = createGitHubClient({
        auth: { type: AuthType.PersonalAccessToken, token: process.env.GITHUB_TOKEN! },
        cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
      });

      const prAutomation = createPRAutomation(client);
      await prAutomation.addLabels(
        context.repository.owner.login,
        context.repository.name,
        context.payload.number,
        ['needs-review']
      );
    }
  });

  // Register issue handler
  webhookHandler.on(WebhookEvent.Issues, async (context, event) => {
    if (context.action === 'opened') {
      console.log(`New issue: ${event.issue.title}`);
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
}

// ============================================================================
// Rate Limiting Examples
// ============================================================================

/**
 * Example 13: Rate Limit Management
 */
async function example13_RateLimitManagement() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  // Get current rate limits
  const limits = client.getRateLimits();
  console.log('Core remaining:', limits.core.remaining);
  console.log('Search remaining:', limits.search.remaining);

  // Subscribe to rate limit changes
  const unsubscribe = client.onRateLimitChange((newLimits) => {
    console.log('Rate limits updated:', newLimits);
  });

  // Make requests...

  // Unsubscribe when done
  unsubscribe();
}

// ============================================================================
// GraphQL Examples
// ============================================================================

/**
 * Example 14: GraphQL Queries
 */
async function example14_GraphQLQueries() {
  const client = createGitHubClient({
    auth: {
      type: AuthType.PersonalAccessToken,
      token: process.env.GITHUB_TOKEN!
    },
    cache: { enabled: true, ttl: 300000, maxSize: 1000, type: 'memory' }
  });

  // Simple query
  const query = `
    query {
      viewer {
        login
        name
        email
      }
    }
  `;

  const result = await client.graphql(query);
  console.log('User:', result.viewer);

  // Query with variables
  const query2 = `
    query($login: String!) {
      user(login: $login) {
        repositories(first: 10) {
          nodes {
            name
            stargazerCount
          }
        }
      }
    }
  `;

  const result2 = await client.graphql(query2, { login: 'octocat' });
  console.log('Repositories:', result2.user.repositories);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('ClaudeFlare GitHub Integration - Usage Examples\n');

  // Run examples (commented out to avoid actual execution)
  // await example1_PATAuthentication();
  // await example2_GitHubAppAuthentication();
  // await example3_RedisCache();
  // await example4_RepositoryOperations();
  // await example5_BranchProtection();
  // await example6_PRManagement();
  // await example7_AutoMerge();
  // await example8_IssueManagement();
  // await example9_BulkOperations();
  // await example10_CICDIntegration();
  // await example11_SecurityIntegration();
  // await example12_WebhookHandler();
  // await example13_RateLimitManagement();
  // await example14_GraphQLQueries();

  console.log('Examples complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_PATAuthentication,
  example2_GitHubAppAuthentication,
  example3_RedisCache,
  example4_RepositoryOperations,
  example5_BranchProtection,
  example6_PRManagement,
  example7_AutoMerge,
  example8_IssueManagement,
  example9_BulkOperations,
  example10_CICDIntegration,
  example11_SecurityIntegration,
  example12_WebhookHandler,
  example13_RateLimitManagement,
  example14_GraphQLQueries
};
