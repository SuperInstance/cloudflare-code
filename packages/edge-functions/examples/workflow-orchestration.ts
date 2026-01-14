/**
 * Workflow Orchestration Example
 *
 * Demonstrates advanced workflow orchestration with function chaining,
 * parallel execution, and conditional routing.
 */

import {
  FunctionRuntime,
  OrchestrationEngine,
  createEdgeFunction,
  createWorkflow,
  sequentialStep,
  parallelStep,
  conditionalStep,
  chainSteps,
} from '../src/index';

// ============================================================================
// Create Runtime and Engine
// ============================================================================

const runtime = new FunctionRuntime();

const functions = new Map([
  [
    'fetch-user',
    createEdgeFunction(
      'fetch-user',
      'Fetch User',
      async (input: { userId: number }) => {
        // Simulate API call
        return {
          id: input.userId,
          name: `User ${input.userId}`,
          email: `user${input.userId}@example.com`,
          role: input.userId === 1 ? 'admin' : 'user',
        };
      }
    ),
  ],
  [
    'fetch-posts',
    createEdgeFunction(
      'fetch-posts',
      'Fetch Posts',
      async (input: { userId: number }) => {
        // Simulate API call
        return [
          { id: 1, userId: input.userId, title: 'Post 1' },
          { id: 2, userId: input.userId, title: 'Post 2' },
        ];
      }
    ),
  ],
  [
    'fetch-comments',
    createEdgeFunction(
      'fetch-comments',
      'Fetch Comments',
      async (input: { userId: number }) => {
        // Simulate API call
        return [
          { id: 1, userId: input.userId, text: 'Comment 1' },
          { id: 2, userId: input.userId, text: 'Comment 2' },
        ];
      }
    ),
  ],
  [
    'calculate-stats',
    createEdgeFunction(
      'calculate-stats',
      'Calculate Stats',
      async (input: { posts: any[]; comments: any[] }) => {
        return {
          postsCount: input.posts.length,
          commentsCount: input.comments.length,
          engagement: input.comments.length / (input.posts.length || 1),
        };
      }
    ),
  ],
  [
    'send-notification',
    createEdgeFunction(
      'send-notification',
      'Send Notification',
      async (input: { userId: number; stats: any }) => {
        return {
          sent: true,
          userId: input.userId,
          message: `You have ${input.stats.postsCount} posts and ${input.stats.commentsCount} comments`,
        };
      }
    ),
  ],
  [
    'log-admin',
    createEdgeFunction(
      'log-admin',
      'Log Admin',
      async (input: { user: any }) => {
        return {
          logged: true,
          adminUser: input.user.name,
          timestamp: new Date().toISOString(),
        };
      }
    ),
  ],
]);

const engine = new OrchestrationEngine(functions);

// ============================================================================
// Example 1: Sequential Workflow
// ============================================================================

const sequentialWorkflow = createWorkflow(
  'user-data-sequential',
  'User Data Sequential',
  [
    sequentialStep('fetch-user', 'fetch-user', {
      input: { userId: 1 },
      output: '$.data.user',
    }),
    sequentialStep('fetch-posts', 'fetch-posts', {
      input: { userId: '$.data.user.id' },
      output: '$.data.posts',
    }),
    sequentialStep('fetch-comments', 'fetch-comments', {
      input: { userId: '$.data.user.id' },
      output: '$.data.comments',
    }),
  ]
);

// ============================================================================
// Example 2: Parallel Workflow
// ============================================================================

const parallelWorkflow = createWorkflow(
  'user-data-parallel',
  'User Data Parallel',
  [
    sequentialStep('fetch-user', 'fetch-user', {
      input: { userId: 1 },
      output: '$.data.user',
    }),
    parallelStep('fetch-posts', 'fetch-posts', {
      input: { userId: '$.data.user.id' },
      output: '$.data.posts',
    }),
    parallelStep('fetch-comments', 'fetch-comments', {
      input: { userId: '$.data.user.id' },
      output: '$.data.comments',
    }),
    sequentialStep('calculate-stats', 'calculate-stats', {
      input: {
        posts: '$.data.posts',
        comments: '$.data.comments',
      },
      output: '$.data.stats',
    }),
  ]
);

// ============================================================================
// Example 3: Conditional Workflow
// ============================================================================

const conditionalWorkflow = createWorkflow(
  'user-conditional',
  'User Conditional',
  [
    sequentialStep('fetch-user', 'fetch-user', {
      input: { userId: 1 },
      output: '$.data.user',
    }),
    conditionalStep(
      'log-admin',
      'log-admin',
      (ctx) => (ctx.data.user as any).role === 'admin',
      {
        input: { user: '$.data.user' },
        output: '$.data.adminLog',
      }
    ),
    sequentialStep('send-notification', 'send-notification', {
      input: {
        userId: '$.data.user.id',
        stats: { postsCount: 5, commentsCount: 10 },
      },
      output: '$.data.notification',
    }),
  ]
);

// ============================================================================
// Example 4: Chained Workflow
// ============================================================================

const chainedSteps = chainSteps(
  [
    createEdgeFunction('step1', 'Step 1', async (input: { value: number }) => ({
      result: input.value * 2,
    })),
    createEdgeFunction('step2', 'Step 2', async (input: { result: number }) => ({
      result: input.result + 10,
    })),
    createEdgeFunction('step3', 'Step 3', async (input: { result: number }) => ({
      final: input.result * 3,
    })),
  ],
  { value: 5 }
);

const chainedWorkflow = createWorkflow('chained', 'Chained', chainedSteps);

// ============================================================================
// Execute Workflows
// ============================================================================

async function executeWorkflows() {
  const context = {
    env: {
      KV: {},
      DURABLE: {},
      R2: {},
      DB: {},
      QUEUE: {},
    },
    waitUntil: (promise: Promise<any>) => promise,
  };

  // Register workflows
  engine.registerWorkflow(sequentialWorkflow);
  engine.registerWorkflow(parallelWorkflow);
  engine.registerWorkflow(conditionalWorkflow);
  engine.registerWorkflow(chainedWorkflow);

  // Execute sequential workflow
  console.log('=== Sequential Workflow ===');
  const sequentialResult = await engine.execute('user-data-sequential', {}, context);
  console.log('Status:', sequentialResult.status);
  console.log('Output:', sequentialResult.output);
  console.log('Duration:', sequentialResult.metrics.duration, 'ms');
  console.log('Steps executed:', sequentialResult.metrics.stepsExecuted);

  // Execute parallel workflow
  console.log('\n=== Parallel Workflow ===');
  const parallelResult = await engine.execute('user-data-parallel', {}, context);
  console.log('Status:', parallelResult.status);
  console.log('Output:', parallelResult.output);
  console.log('Duration:', parallelResult.metrics.duration, 'ms');

  // Execute conditional workflow
  console.log('\n=== Conditional Workflow ===');
  const conditionalResult = await engine.execute('user-conditional', {}, context);
  console.log('Status:', conditionalResult.status);
  console.log('Output:', conditionalResult.output);

  // Execute chained workflow
  console.log('\n=== Chained Workflow ===');
  const chainedResult = await engine.execute('chained', { value: 5 }, context);
  console.log('Status:', chainedResult.status);
  console.log('Output:', chainedResult.output);
  console.log('Step results:', chainedResult.steps.map(s => ({ id: s.stepId, output: s.output })));
}

// ============================================================================
// Run Example
// ============================================================================

executeWorkflows().catch(console.error);
