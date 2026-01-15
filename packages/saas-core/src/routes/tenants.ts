/**
 * Tenant management API routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { TenantManager } from '../tenant/manager';
import { Tenant } from '../types';
import { billingManager } from '../billing/manager';
import { metrics } from '../monitoring/metrics';

export const tenantRoutes = new Hono();

// Apply authentication middleware where needed
tenantRoutes.get('/tenants/:id', authMiddleware);

// Create a new tenant (no authentication required for signup)
tenantRoutes.post('/tenants', async (c) => {
  try {
    const tenantData: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'> = await c.req.json();
    const adminUserData: any = await c.req.json('adminUser');

    // Validate plan limits
    const planLimits = {
      free: { maxProjects: 3, maxUsers: 5 },
      pro: { maxProjects: 10, maxUsers: 25 },
      enterprise: { maxProjects: 100, maxUsers: 1000 }
    };

    const limits = planLimits[tenantData.plan];
    if (!limits) {
      return c.json({ error: 'Invalid plan' }, 400);
    }

    // Create tenant
    const tenant = await tenantManager.createTenant({
      ...tenantData,
      settings: {
        ...tenantData.settings,
        maxProjects: limits.maxProjects,
        maxUsers: limits.maxUsers,
        features: {
          visualBuilder: tenantData.plan !== 'free',
          aiAssist: tenantData.plan !== 'free',
          teamCollaboration: tenantData.plan !== 'free',
          auditLogs: tenantData.plan === 'enterprise',
          customDomains: tenantData.plan === 'enterprise'
        }
      }
    });

    // Create admin user
    const adminUser = await tenantManager.createUser(tenant.id, {
      email: adminUserData.email,
      name: adminUserData.name,
      role: 'admin',
      tenantId: tenant.id,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en'
      }
    });

    // Create Stripe customer for paid plans
    let stripeCustomerId;
    if (tenantData.plan !== 'free') {
      try {
        stripeCustomerId = await billingManager.createCustomer(
          tenant.id,
          adminUserData.email,
          adminUserData.name
        );

        // Update tenant with Stripe ID
        await tenantManager.updateTenant(tenant.id, {
          settings: {
            ...tenant.settings,
            billing: {
              stripeCustomerId
            }
          }
        });
      } catch (billingError) {
        console.error('Billing setup failed:', billingError);
      }
    }

    metrics.recordTrialConversion(tenantData.plan, tenant.id);
    metrics.recordRequest('POST', '/tenants', 201);

    return c.json({ tenant, adminUser, stripeCustomerId }, 201);
  } catch (error) {
    metrics.recordError('tenant_creation');
    return c.json({ error: 'Failed to create tenant' }, 500);
  }
});

// Get tenant details
tenantRoutes.get('/tenants/:id', async (c) => {
  try {
    const tenantId = c.req.param('id');
    const userId = c.get('userId');

    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    // Check if user belongs to this tenant
    const user = await tenantManager.getUser(userId, tenantId);
    if (!user) {
      return c.json({ error: 'Access denied' }, 403);
    }

    metrics.recordRequest('GET', `/tenants/${tenantId}`, 200, tenantId);

    return c.json(tenant);
  } catch (error) {
    metrics.recordError('tenant_get', c.get('tenantId'));
    return c.json({ error: 'Failed to fetch tenant' }, 500);
  }
});

// Update tenant settings
tenantRoutes.put('/tenants/:id', async (c) => {
  try {
    const tenantId = c.req.param('id');
    const tenantData: Partial<Tenant> = await c.req.json();
    const userId = c.get('userId');

    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    // Check if user has admin permissions
    const user = await tenantManager.getUser(userId, tenantId);
    if (!user || user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const updatedTenant = await tenantManager.updateTenant(tenantId, tenantData);
    metrics.recordRequest('PUT', `/tenants/${tenantId}`, 200, tenantId);

    return c.json(updatedTenant);
  } catch (error) {
    metrics.recordError('tenant_update', c.get('tenantId'));
    return c.json({ error: 'Failed to update tenant' }, 500);
  }
});

// Get tenant usage statistics
tenantRoutes.get('/tenants/:id/usage', async (c) => {
  try {
    const tenantId = c.req.param('id');
    const userId = c.get('userId');

    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    const user = await tenantManager.getUser(userId, tenantId);
    if (!user || user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const usage = await tenantManager.getTenantUsage(tenantId);
    metrics.recordRequest('GET', `/tenants/${tenantId}/usage`, 200, tenantId);

    return c.json(usage);
  } catch (error) {
    metrics.recordError('tenant_usage', c.get('tenantId'));
    return c.json({ error: 'Failed to fetch usage' }, 500);
  }
});

// Change tenant plan
tenantRoutes.post('/tenants/:id/plan-change', async (c) => {
  try {
    const tenantId = c.req.param('id');
    const { newPlan, priceId } = await c.req.json();
    const userId = c.get('userId');

    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    const user = await tenantManager.getUser(userId, tenantId);
    if (!user || user.role !== 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // Get Stripe customer ID
    const stripeCustomerId = tenant.settings.billing?.stripeCustomerId;
    if (!stripeCustomerId && newPlan !== 'free') {
      return c.json({ error: 'Stripe customer not found' }, 400);
    }

    let subscription;
    if (newPlan === 'free') {
      // Cancel subscription
      if (tenant.settings.billing?.subscriptionId) {
        subscription = await billingManager.cancelSubscription(tenant.settings.billing.subscriptionId);
      }
    } else {
      // Create or update subscription
      if (tenant.settings.billing?.subscriptionId) {
        subscription = await billingManager.updateSubscription(tenant.settings.billing.subscriptionId, priceId);
      } else {
        subscription = await billingManager.createSubscription(stripeCustomerId!, priceId);
      }
    }

    // Update tenant plan and settings
    const updatedTenant = await tenantManager.updateTenant(tenantId, {
      plan: newPlan as any,
      settings: {
        ...tenant.settings,
        maxProjects: newPlan === 'free' ? 3 : newPlan === 'pro' ? 10 : 100,
        maxUsers: newPlan === 'free' ? 5 : newPlan === 'pro' ? 25 : 1000,
        features: {
          visualBuilder: newPlan !== 'free',
          aiAssist: newPlan !== 'free',
          teamCollaboration: newPlan !== 'free',
          auditLogs: newPlan === 'enterprise',
          customDomains: newPlan === 'enterprise'
        }
      }
    });

    // Update subscription ID
    if (subscription?.id) {
      await tenantManager.updateTenant(tenantId, {
        settings: {
          ...updatedTenant.settings,
          billing: {
            ...updatedTenant.settings.billing,
            subscriptionId: subscription.id
          }
        }
      });
    }

    metrics.recordTrialConversion(newPlan, tenantId);
    metrics.recordRequest('POST', `/tenants/${tenantId}/plan-change`, 200, tenantId);

    return c.json({ tenant: updatedTenant, subscription });
  } catch (error) {
    metrics.recordError('plan_change', c.get('tenantId'));
    return c.json({ error: 'Failed to change plan' }, 500);
  }
});

export { tenantRoutes };