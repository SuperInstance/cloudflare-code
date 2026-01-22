// @ts-nocheck
/**
 * Multi-tenant project management
 */

import { Tenant, Project, User } from '../types';
import { db } from '../database/adapter';

export class TenantManager {
  // Tenant operations
  async createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const tenant: Tenant = {
      id: `tenant-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.createTenant(tenant);
    return tenant;
  }

  async getTenant(id: string): Promise<Tenant | null> {
    return await db.getTenant(id);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return await db.getTenantBySlug(slug);
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    return await db.updateTenant(id, updates);
  }

  // User operations
  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      id: `user-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.createUser(user);
    return user;
  }

  async getUser(id: string, tenantId?: string): Promise<User | null> {
    if (tenantId) {
      const users = await db.getUsersByTenant(tenantId);
      return users.find(u => u.id === id) || null;
    }
    return await db.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await db.getUserByEmail(email);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    return await db.updateUser(id, updates);
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db.updateUser(userId, { lastLogin: new Date() });
  }

  async deleteUser(id: string, tenantId?: string): Promise<boolean> {
    if (tenantId) {
      const user = await this.getUser(id, tenantId);
      if (!user) return false;
    }
    return await db.deleteUser(id);
  }

  async getUsersForTenant(tenantId: string, page: number = 1, limit: number = 10): Promise<{ users: User[]; pagination: any }> {
    const users = await db.getUsersByTenant(tenantId);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = users.slice(startIndex, endIndex);

    return {
      users: paginatedUsers.map(u => ({ ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt) })),
      pagination: {
        page,
        limit,
        total: users.length,
        totalPages: Math.ceil(users.length / limit)
      }
    };
  }

  async authenticateUser(email: string, password: string, tenantId: string): Promise<any> {
    // In a real implementation, you would hash passwords and compare
    const user = await this.getUserByEmail(email);
    if (!user || user.tenantId !== tenantId) {
      return null;
    }

    // Mock authentication - replace with actual password verification
    if (password === 'password') {
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        token: `mock-token-${user.id}`
      };
    }

    return null;
  }

  async getUserCount(tenantId: string): Promise<number> {
    const users = await db.getUsersByTenant(tenantId);
    return users.length;
  }

  // Project operations
  async createProject(tenantId: string, data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const project: Project = {
      id: `project-${Date.now()}`,
      tenantId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.createProject(project);
    return project;
  }

  async getProject(id: string, tenantId: string): Promise<Project | null> {
    return await db.getProject(id, tenantId);
  }

  async getProjectsForTenant(tenantId: string, page: number = 1, limit: number = 10): Promise<{ projects: Project[]; pagination: any }> {
    const projects = await db.getProjectsByTenant(tenantId);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProjects = projects.slice(startIndex, endIndex);

    return {
      projects: paginatedProjects.map(p => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })),
      pagination: {
        page,
        limit,
        total: projects.length,
        totalPages: Math.ceil(projects.length / limit)
      }
    };
  }

  async updateProject(id: string, tenantId: string, updates: Partial<Project>): Promise<Project | null> {
    return await db.updateProject(id, tenantId, updates);
  }

  async deleteProject(id: string, tenantId: string): Promise<boolean> {
    return await db.deleteProject(id, tenantId);
  }

  async getProjectCount(tenantId: string): Promise<number> {
    const projects = await db.getProjectsByTenant(tenantId);
    return projects.length;
  }

  async addProjectMember(projectId: string, tenantId: string, userId: string, role: string): Promise<Project> {
    await db.addProjectMember(projectId, tenantId, userId, role);
    const project = await this.getProject(projectId, tenantId);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  async removeProjectMember(projectId: string, tenantId: string, userId: string): Promise<Project> {
    await db.removeProjectMember(projectId, userId);
    const project = await this.getProject(projectId, tenantId);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  async getTenantUsage(tenantId: string): Promise<any> {
    return await db.getTenantUsage(tenantId);
  }

  async generateProjectCode(projectId: string, tenantId: string, options: { framework: string; template: string }): Promise<any> {
    // This would integrate with the factory-core package
    // For now, return mock data
    return {
      framework: options.framework,
      template: options.template,
      generatedAt: new Date(),
      files: [
        {
          path: 'index.js',
          content: `// Generated project for ${options.framework} using ${options.template} template`
        }
      ]
    };
  }
}

export const tenantManager = new TenantManager();