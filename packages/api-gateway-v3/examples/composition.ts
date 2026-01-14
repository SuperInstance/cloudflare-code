/**
 * Composition Example - API Composition
 */

import { CompositionEngine, ServiceRegistry } from '../src/composition/engine.js';
import type {
  CompositionRequest,
  CompositionOperation,
  ServiceDefinition,
} from '../src/types/index.js';

// Create service registry
const registry = new ServiceRegistry();

// Register services
async function setupServices() {
  const user Service: ServiceDefinition = {
    id: 'users-service',
    name: 'Users Service',
    version: '1.0.0',
    endpoint: 'https://api.users.example.com',
    timeout: 5000,
    metadata: {
      description: 'User management service',
      tags: ['users'],
    },
  };

  const postsService: ServiceDefinition = {
    id: 'posts-service',
    name: 'Posts Service',
    version: '1.0.0',
    endpoint: 'https://api.posts.example.com',
    timeout: 5000,
    metadata: {
      description: 'Post management service',
      tags: ['posts'],
    },
  };

  const commentsService: ServiceDefinition = {
    id: 'comments-service',
    name: 'Comments Service',
    version: '1.0.0',
    endpoint: 'https://api.comments.example.com',
    timeout: 5000,
    metadata: {
      description: 'Comments service',
      tags: ['comments'],
    },
  };

  await registry.register(usersService);
  await registry.register(postsService);
  await registry.register(commentsService);
}

// Create composition engine
const engine = new CompositionEngine(registry, {
  maxConcurrent: 100,
  timeout: 30000,
  cache: {
    enabled: true,
    ttl: 60000,
    maxSize: 1000,
  },
});

// Example 1: Parallel composition - Fetch user data, posts, and comments simultaneously
export async function getUserFeed(userId: string) {
  const operations: CompositionOperation[] = [
    {
      id: 'user',
      serviceId: 'users-service',
      method: 'GET',
      path: `/users/${userId}`,
      params: {},
    },
    {
      id: 'posts',
      serviceId: 'posts-service',
      method: 'GET',
      path: `/posts`,
      params: { userId },
    },
    {
      id: 'comments',
      serviceId: 'comments-service',
      method: 'GET',
      path: `/comments`,
      params: { userId },
    },
  ];

  const request: CompositionRequest = {
    requestId: `feed_${userId}_${Date.now()}`,
    operations,
    mergeStrategy: 'parallel',
    errorPolicy: 'continue', // Continue even if one operation fails
    timeout: 10000,
  };

  const result = await engine.execute(request);

  return {
    user: result.data.user,
    posts: result.data.posts,
    comments: result.data.comments,
    errors: result.errors,
  };
}

// Example 2: Sequential composition - Posts with their comments
export async function getPostWithComments(postId: string) {
  const operations: CompositionOperation[] = [
    {
      id: 'post',
      serviceId: 'posts-service',
      method: 'GET',
      path: `/posts/${postId}`,
      params: {},
    },
    {
      id: 'comments',
      serviceId: 'comments-service',
      method: 'GET',
      path: `/comments`,
      params: { postId },
      dependencies: ['post'], // Wait for post to be fetched first
    },
  ];

  const request: CompositionRequest = {
    requestId: `post_${postId}_${Date.now()}`,
    operations,
    mergeStrategy: 'sequential',
    errorPolicy: 'fail-fast',
  };

  const result = await engine.execute(request);

  return {
    post: result.data.post,
    comments: result.data.comments,
  };
}

// Example 3: Data merging - Combine user profile with stats
export async function getUserProfile(userId: string) {
  const operations: CompositionOperation[] = [
    {
      id: 'profile',
      serviceId: 'users-service',
      method: 'GET',
      path: `/users/${userId}`,
      params: {},
    },
    {
      id: 'stats',
      serviceId: 'users-service',
      method: 'GET',
      path: `/users/${userId}/stats`,
      params: {},
    },
    {
      id: 'activity',
      serviceId: 'users-service',
      method: 'GET',
      path: `/users/${userId}/activity`,
      params: {},
    },
  ];

  const request: CompositionRequest = {
    requestId: `profile_${userId}_${Date.now()}`,
    operations,
    mergeStrategy: 'parallel',
    errorPolicy: 'continue',
  };

  const result = await engine.execute(request);

  // Merge all user-related data
  return {
    profile: result.data.profile,
    stats: result.data.stats,
    activity: result.data.activity,
  };
}

// Example 4: Batch processing
export async function getUserProfilesBatch(userIds: string[]) {
  const requests: CompositionRequest[] = userIds.map((userId) => ({
    requestId: `batch_user_${userId}`,
    operations: [
      {
        id: 'profile',
        serviceId: 'users-service',
        method: 'GET',
        path: `/users/${userId}`,
        params: {},
      },
    ],
    mergeStrategy: 'parallel',
    errorPolicy: 'continue',
  }));

  const results = await engine.executeBatch(requests);

  return results.map((result, index) => ({
    userId: userIds[index],
    profile: result.data.profile,
    errors: result.errors,
  }));
}

// Example 5: Cached composition
export async function getTrendingTopics() {
  const operations: CompositionOperation[] = [
    {
      id: 'trending',
      serviceId: 'posts-service',
      method: 'GET',
      path: '/trending',
      params: {},
    },
  ];

  const request: CompositionRequest = {
    requestId: `trending_${Date.now()}`,
    operations,
    mergeStrategy: 'parallel',
    errorPolicy: 'continue',
  };

  // This result will be cached for 60 seconds
  const result = await engine.execute(request);

  return result.data.trending;
}

// Example 6: Advanced composition with retry and timeout
export async function getSocialMediaStats(userId: string) {
  const operations: CompositionOperation[] = [
    {
      id: 'twitter',
      serviceId: 'social-service',
      method: 'GET',
      path: `/twitter/${userId}/stats`,
      params: {},
      timeout: 5000,
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        retryableErrors: [500, 502, 503, 504],
      },
    },
    {
      id: 'facebook',
      serviceId: 'social-service',
      method: 'GET',
      path: `/facebook/${userId}/stats`,
      params: {},
      timeout: 5000,
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        retryableErrors: [500, 502, 503, 504],
      },
    },
    {
      id: 'instagram',
      serviceId: 'social-service',
      method: 'GET',
      path: `/instagram/${userId}/stats`,
      params: {},
      timeout: 5000,
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        retryableErrors: [500, 502, 503, 504],
      },
    },
  ];

  const request: CompositionRequest = {
    requestId: `social_${userId}_${Date.now()}`,
    operations,
    mergeStrategy: 'parallel',
    errorPolicy: 'aggregate', // Collect all errors
  };

  const result = await engine.execute(request);

  return {
    twitter: result.data.twitter,
    facebook: result.data.facebook,
    instagram: result.data.instagram,
    errors: result.errors,
    metadata: result.metadata,
  };
}

// Initialize and export
await setupServices();

export { engine, registry };
