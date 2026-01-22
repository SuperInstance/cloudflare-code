/**
 * Authentication and authorization middleware
 */

import { sign, verify } from 'hono/jwt';
import { User } from '../types';
import { tenantManager } from '../tenant/manager';

export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid token' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verify(token, process.env.JWT_SECRET || 'default-secret');

    // Validate user exists and belongs to tenant
    const user = await tenantManager.getUser(payload.userId);
    if (!user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // If tenantId is specified in request, validate it matches
    const tenantId = c.req.header('X-Tenant-ID');
    if (tenantId && user.tenantId !== tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    c.set('user', user);
    c.set('userId', user.id);
    c.set('tenantId', user.tenantId);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

export const requireRole = (roles: string[]) => {
  return async (c: any, next: any) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    await next();
  };
};

export const requireTenant = () => {
  return async (c: any, next: any) => {
    const tenantId = c.req.header('X-Tenant-ID');

    if (!tenantId) {
      return c.json({ error: 'Tenant ID required' }, 400);
    }

    c.set('tenantId', tenantId);
    await next();
  };
};

export const createToken = async (user: User): Promise<string> => {
  return await sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    process.env.JWT_SECRET || 'default-secret'
  );
};