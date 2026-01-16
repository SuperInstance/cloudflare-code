// @ts-nocheck
/**
 * User management API routes
 */

import { Hono } from 'hono';
import { authMiddleware, requireTenant } from '../auth/middleware';
import { TenantManager } from '../tenant/manager';
import { User } from '../types';
import { metrics } from '../monitoring/metrics';

export const userRoutes = new Hono();

// Apply authentication middleware
userRoutes.use('*', authMiddleware);

// Create a new user in a tenant
userRoutes.post('/users', async (c) => {
  try {
    const user: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = await c.req.json();
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    // Check if user has permission to create users
    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant || (user.role !== 'admin' && userId !== user.tenantId)) {
      metrics.recordError('forbidden', tenantId);
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const newUser = await tenantManager.createUser(tenantId, user);
    metrics.recordActiveUsers(tenantId, await tenantManager.getUserCount(tenantId));

    return c.json(newUser, 201);
  } catch (error) {
    metrics.recordError('user_creation', c.get('tenantId'));
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Get users for a tenant
userRoutes.get('/users', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');

    const { users, pagination } = await tenantManager.getUsersForTenant(tenantId, page, limit);
    metrics.recordRequest('GET', '/users', 200, tenantId);

    return c.json({
      data: users,
      pagination
    });
  } catch (error) {
    metrics.recordError('user_list', c.get('tenantId'));
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Get a specific user
userRoutes.get('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    const tenantId = c.get('tenantId');

    const user = await tenantManager.getUser(userId, tenantId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    metrics.recordRequest('GET', `/users/${userId}`, 200, tenantId);
    return c.json(user);
  } catch (error) {
    metrics.recordError('user_get', c.get('tenantId'));
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Update a user
userRoutes.put('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    const userData: Partial<User> = await c.req.json();
    const tenantId = c.get('tenantId');
    const requestingUserId = c.get('userId');

    const user = await tenantManager.getUser(userId, tenantId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check permissions
    if (requestingUserId !== userId && userData.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const updatedUser = await tenantManager.updateUser(userId, tenantId, userData);
    metrics.recordRequest('PUT', `/users/${userId}`, 200, tenantId);

    return c.json(updatedUser);
  } catch (error) {
    metrics.recordError('user_update', c.get('tenantId'));
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Delete a user
userRoutes.delete('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    const tenantId = c.get('tenantId');
    const requestingUserId = c.get('userId');

    // Don't allow deleting yourself
    if (requestingUserId === userId) {
      return c.json({ error: 'Cannot delete yourself' }, 400);
    }

    const success = await tenantManager.deleteUser(userId, tenantId);
    if (!success) {
      return c.json({ error: 'User not found' }, 404);
    }

    metrics.recordRequest('DELETE', `/users/${userId}`, 200, tenantId);
    metrics.recordActiveUsers(tenantId, await tenantManager.getUserCount(tenantId));

    return c.json({ success: true });
  } catch (error) {
    metrics.recordError('user_delete', c.get('tenantId'));
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// User login
userRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const tenantId = c.req.header('X-Tenant-ID');

    if (!email || !password || !tenantId) {
      return c.json({ error: 'Email, password and tenant ID required' }, 400);
    }

    const result = await tenantManager.authenticateUser(email, password, tenantId);
    if (!result) {
      metrics.recordRateLimitHit(tenantId, '/login');
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Update last login
    await tenantManager.updateUserLastLogin(result.userId);

    metrics.recordRequest('POST', '/login', 200, tenantId);
    return c.json(result);
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500);
  }
});

export { userRoutes };