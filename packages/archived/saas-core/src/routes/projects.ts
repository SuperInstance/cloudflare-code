// @ts-nocheck
/**
 * Project management API routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { TenantManager } from '../tenant/manager';
import { Project } from '../types';
import { metrics } from '../monitoring/metrics';

export const projectRoutes = new Hono();

// Apply authentication middleware
projectRoutes.use('*', authMiddleware);

// Create a new project
projectRoutes.post('/projects', async (c) => {
  try {
    const projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = await c.req.json();
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    // Check user's project limit
    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    const userProjects = await tenantManager.getProjectsForTenant(tenantId);
    const userProjectCount = userProjects.filter(p => p.team.some(tm => tm.userId === userId)).length;

    if (userProjectCount >= tenant.settings.maxProjects) {
      metrics.recordError('project_limit_exceeded', tenantId);
      return c.json({ error: 'Project limit reached' }, 403);
    }

    // Validate user role
    const user = await tenantManager.getUser(userId, tenantId);
    if (!user || user.role === 'viewer') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const project = await tenantManager.createProject(tenantId, {
      ...projectData,
      team: [{
        userId,
        role: 'owner',
        joinedAt: new Date()
      }],
      permissions: {
        allowExport: user.role === 'admin',
        allowCollaboration: user.role !== 'viewer',
        allowTemplateSharing: user.role === 'admin'
      }
    });

    metrics.recordActiveProjects(tenantId, userProjects.length + 1);
    metrics.recordRequest('POST', '/projects', 201, tenantId);

    return c.json(project, 201);
  } catch (error) {
    metrics.recordError('project_creation', c.get('tenantId'));
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

// Get projects for a tenant
projectRoutes.get('/projects', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');

    const { projects, pagination } = await tenantManager.getProjectsForTenant(tenantId, page, limit);

    // Filter projects based on user permissions
    const accessibleProjects = projects.filter(project => {
      return project.team.some(member => member.userId === userId);
    });

    metrics.recordRequest('GET', '/projects', 200, tenantId);

    return c.json({
      data: accessibleProjects,
      pagination
    });
  } catch (error) {
    metrics.recordError('project_list', c.get('tenantId'));
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

// Get a specific project
projectRoutes.get('/projects/:id', async (c) => {
  try {
    const projectId = c.req.param('id');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    const project = await tenantManager.getProject(projectId, tenantId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check if user has access to this project
    const hasAccess = project.team.some(member => member.userId === userId);
    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }

    metrics.recordRequest('GET', `/projects/${projectId}`, 200, tenantId);

    return c.json(project);
  } catch (error) {
    metrics.recordError('project_get', c.get('tenantId'));
    return c.json({ error: 'Failed to fetch project' }, 500);
  }
});

// Update a project
projectRoutes.put('/projects/:id', async (c) => {
  try {
    const projectId = c.req.param('id');
    const projectData: Partial<Project> = await c.req.json();
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    const project = await tenantManager.getProject(projectId, tenantId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check permissions
    const userRole = project.team.find(member => member.userId === userId)?.role;
    if (!userRole || (userRole === 'viewer' && Object.keys(projectData).length > 0)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const updatedProject = await tenantManager.updateProject(projectId, tenantId, projectData);
    metrics.recordRequest('PUT', `/projects/${projectId}`, 200, tenantId);

    return c.json(updatedProject);
  } catch (error) {
    metrics.recordError('project_update', c.get('tenantId'));
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

// Delete a project
projectRoutes.delete('/projects/:id', async (c) => {
  try {
    const projectId = c.req.param('id');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    const project = await tenantManager.getProject(projectId, tenantId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Only project owners or admins can delete
    const userRole = project.team.find(member => member.userId === userId)?.role;
    if (!userRole || userRole === 'viewer') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const success = await tenantManager.deleteProject(projectId, tenantId);
    if (!success) {
      return c.json({ error: 'Failed to delete project' }, 500);
    }

    metrics.recordRequest('DELETE', `/projects/${projectId}`, 200, tenantId);
    metrics.recordActiveProjects(tenantId, await tenantManager.getProjectCount(tenantId));

    return c.json({ success: true });
  } catch (error) {
    metrics.recordError('project_delete', c.get('tenantId'));
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

// Add team member to project
projectRoutes.post('/projects/:id/members', async (c) => {
  try {
    const projectId = c.req.param('id');
    const { userId: newUserId, role } = await c.req.json();
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    const project = await tenantManager.getProject(projectId, tenantId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check if current user can add members
    const userRole = project.team.find(member => member.userId === userId)?.role;
    if (!userRole || userRole === 'editor' || userRole === 'viewer') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // Check if user exists and belongs to tenant
    const newUserData = await tenantManager.getUser(newUserId, tenantId);
    if (!newUserData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if user is already in the project
    const existingMember = project.team.find(member => member.userId === newUserId);
    if (existingMember) {
      return c.json({ error: 'User already in project' }, 400);
    }

    // Add user to project
    const updatedProject = await tenantManager.addProjectMember(
      projectId,
      tenantId,
      newUserId,
      role
    );

    metrics.recordRequest('POST', `/projects/${projectId}/members`, 200, tenantId);

    return c.json(updatedProject);
  } catch (error) {
    metrics.recordError('project_member_add', c.get('tenantId'));
    return c.json({ error: 'Failed to add member' }, 500);
  }
});

// Remove team member from project
projectRoutes.delete('/projects/:id/members/:userId', async (c) => {
  try {
    const projectId = c.req.param('id');
    const userIdToRemove = c.req.param('userId');
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    const project = await tenantManager.getProject(projectId, tenantId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check permissions
    const userRole = project.team.find(member => member.userId === userId)?.role;
    const isRemovingSelf = userId === userIdToRemove;

    if (!userRole ||
        (userRole === 'editor' && !isRemovingSelf) ||
        (userRole === 'viewer' && !isRemovingSelf)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const updatedProject = await tenantManager.removeProjectMember(
      projectId,
      tenantId,
      userIdToRemove
    );

    metrics.recordRequest('DELETE', `/projects/${projectId}/members/${userIdToRemove}`, 200, tenantId);

    return c.json(updatedProject);
  } catch (error) {
    metrics.recordError('project_member_remove', c.get('tenantId'));
    return c.json({ error: 'Failed to remove member' }, 500);
  }
});

// Generate project code
projectRoutes.post('/projects/:id/generate', async (c) => {
  try {
    const projectId = c.req.param('id');
    const { framework, template } = await c.req.json();
    const userId = c.get('userId');
    const tenantId = c.get('tenantId');

    const project = await tenantManager.getProject(projectId, tenantId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check if user can generate code
    const userRole = project.team.find(member => member.userId === userId)?.role;
    if (!userRole || userRole === 'viewer') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // Check tenant feature access
    const tenant = await tenantManager.getTenant(tenantId);
    if (!tenant.settings.features.visualBuilder && tenant.plan === 'free') {
      return c.json({ error: 'Feature not available in free plan' }, 403);
    }

    // Generate project code
    const generatedCode = await tenantManager.generateProjectCode(projectId, tenantId, {
      framework,
      template
    });

    metrics.recordRequest('POST', `/projects/${projectId}/generate`, 200, tenantId);

    return c.json({ generatedCode });
  } catch (error) {
    metrics.recordError('project_generation', c.get('tenantId'));
    return c.json({ error: 'Failed to generate project' }, 500);
  }
});

export { projectRoutes };