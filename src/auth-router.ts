import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  AuthDatabase,
  AuthUtils,
  requireAuth,
  rateLimit
} from './auth';

// Create auth router
export const authRouter = new Hono();

// Auth middleware
authRouter.use('*', cors({
  origin: ['https://cocapn.workers.dev', 'https://*.workers.dev', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
authRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'authentication',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Register endpoint
authRouter.post('/register', rateLimit(5, 60 * 1000), async (c) => {
  try {
    const { email, username, password } = await c.req.json();

    // Validate input
    if (!email || !username || !password) {
      return c.json({ error: 'Email, username, and password are required' }, 400);
    }

    // Validate format
    if (!AuthUtils.isValidEmail(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    if (!AuthUtils.isValidUsername(username)) {
      return c.json({
        error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
      }, 400);
    }

    const passwordStrength = AuthUtils.isStrongPassword(password);
    if (!passwordStrength.valid) {
      return c.json({
        error: 'Password does not meet security requirements',
        details: passwordStrength.errors
      }, 400);
    }

    // Check if user already exists
    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    const usernameExists = await db.getUserByUsername(username);
    if (usernameExists) {
      return c.json({ error: 'Username already taken' }, 409);
    }

    // Create user
    const passwordHash = await AuthUtils.hashPassword(password);
    const user = await db.createUser({
      email,
      username,
      passwordHash
    });

    // Create session
    const session = await db.createSession(user.id);

    return c.json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt
      }
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Login endpoint
authRouter.post('/login', rateLimit(10, 60 * 1000), async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Check if login is blocked
    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    const isBlocked = await db.isLoginBlocked(email);

    if (isBlocked) {
      return c.json({ error: 'Too many login attempts. Please try again later.' }, 429);
    }

    // Find user
    const user = await db.getUserByEmail(email);
    if (!user) {
      // Increment attempts for non-existent user to prevent enumeration
      await db.incrementLoginAttempts(email);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const isValid = await AuthUtils.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await db.incrementLoginAttempts(email);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Reset login attempts on successful login
    await db.resetLoginAttempts(email);

    // Update last login
    await db.updateUser(user.id, { lastLogin: Date.now() });

    // Create session
    const session = await db.createSession(user.id);

    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        lastLogin: user.lastLogin
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Logout endpoint
authRouter.post('/logout', requireAuth(), async (c) => {
  try {
    const token = c.get('authToken');
    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    await db.deleteSession(token);

    return c.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user
authRouter.get('/me', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    const user = await db.getUserById(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Remove sensitive data
    const { passwordHash, ...safeUser } = user;

    return c.json({
      user: safeUser
    });

  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user profile
authRouter.put('/profile', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const { name, avatar, preferences } = await c.req.json();

    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    const updates: Partial<User> = {};

    if (name !== undefined) {
      updates.profile = { ...(updates.profile || {}), name };
    }

    if (avatar !== undefined) {
      updates.profile = { ...(updates.profile || {}), avatar };
    }

    if (preferences !== undefined) {
      updates.profile = { ...(updates.profile || {}), preferences };
    }

    const updatedUser = await db.updateUser(userId, updates);
    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const { passwordHash, ...safeUser } = updatedUser;

    return c.json({
      message: 'Profile updated successfully',
      user: safeUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Change password
authRouter.put('/password', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400);
    }

    // Validate new password strength
    const passwordStrength = AuthUtils.isStrongPassword(newPassword);
    if (!passwordStrength.valid) {
      return c.json({
        error: 'New password does not meet security requirements',
        details: passwordStrength.errors
      }, 400);
    }

    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    const user = await db.getUserById(userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify current password
    const isValid = await AuthUtils.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }

    // Update password
    const passwordHash = await AuthUtils.hashPassword(newPassword);
    await db.updateUser(userId, { passwordHash });

    // Logout all sessions (security)
    const sessionKey = `session:user:${userId}`;
    const sessionToken = await kv.get(sessionKey);
    if (sessionToken) {
      await db.deleteSession(sessionToken);
    }

    return c.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete account
authRouter.delete('/account', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const { password } = await c.req.json();

    if (!password) {
      return c.json({ error: 'Password is required to delete account' }, 400);
    }

    const kv = c.env.KV_AUTH_NAMESPACE;
    const config = {
      kvNamespace: kv,
      jwtSecret: (globalThis as any).JWT_SECRET || 'your-secret-key-change-in-production',
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5
    };
    const db = new AuthDatabase(kv, config);

    const user = await db.getUserById(userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify password
    const isValid = await AuthUtils.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Password is incorrect' }, 400);
    }

    // Delete user data
    await kv.delete(`user:${userId}`);
    await kv.delete(`user:email:${user.email}`);
    await kv.delete(`user:username:${user.username}`);

    // Delete sessions
    const sessionKey = `session:user:${userId}`;
    const sessionToken = await kv.get(sessionKey);
    if (sessionToken) {
      await db.deleteSession(sessionToken);
    }

    return c.json({ message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default authRouter;