// @ts-nocheck
/**
 * Cloudflare D1 database adapter
 */

import { env } from 'hono';

export class DatabaseAdapter {
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  // Execute query
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const { results } = await this.env.DB.prepare(sql).bind(...params).all();
      return results;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Execute single query
  async queryFirst(sql: string, params: any[] = []): Promise<any> {
    try {
      const { results } = await this.env.DB.prepare(sql).bind(...params).first();
      return results;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Execute write operation
  async execute(sql: string, params: any[] = []): Promise<{ success: boolean; results?: any[] }> {
    try {
      const { success, results } = await this.env.DB.prepare(sql).bind(...params).run();
      return { success, results };
    } catch (error) {
      console.error('Database execute error:', error);
      throw error;
    }
  }

  // Start transaction
  async beginTransaction(): Promise<{ commit: () => Promise<void>; rollback: () => Promise<void> }> {
    const txId = `tx-${Date.now()}`;

    return {
      commit: async () => {
        await this.query(`COMMIT TRANSACTION ${txId}`);
      },
      rollback: async () => {
        await this.query(`ROLLBACK TRANSACTION ${txId}`);
      }
    };
  }

  // Create tables if they don't exist
  async initializeSchema(): Promise<void> {
    const tables = [
      {
        name: 'tenants',
        sql: `
          CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            plan TEXT NOT NULL CHECK(plan IN ('free', 'pro', 'enterprise')),
            settings TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'viewer')),
            tenant_id TEXT NOT NULL,
            preferences TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'projects',
        sql: `
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL CHECK(type IN ('saas', 'api', 'frontend', 'backend', 'fullstack')),
            status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'archived')),
            config TEXT NOT NULL,
            permissions TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed DATETIME,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'project_members',
        sql: `
          CREATE TABLE IF NOT EXISTS project_members (
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, user_id),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'usage',
        sql: `
          CREATE TABLE IF NOT EXISTS usage (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            project_id TEXT,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            resource TEXT NOT NULL,
            metadata TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'webhooks',
        sql: `
          CREATE TABLE IF NOT EXISTS webhooks (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            type TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            secret TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_triggered DATETIME,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          )
        `
      }
    ];

    for (const table of tables) {
      try {
        await this.execute(table.sql);
        console.log(`Table ${table.name} created or already exists`);
      } catch (error) {
        console.error(`Failed to create table ${table.name}:`, error);
        throw error;
      }
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tenant_users ON users(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_tenant ON projects(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_tenant_slug ON tenants(slug)'
    ];

    for (const index of indexes) {
      try {
        await this.execute(index);
      } catch (error) {
        console.warn('Index creation failed:', error);
      }
    }
  }

  // Tenant operations
  async createTenant(tenant: any): Promise<any> {
    const sql = `
      INSERT INTO tenants (id, name, slug, description, plan, settings)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const { success } = await this.execute(sql, [
      tenant.id,
      tenant.name,
      tenant.slug,
      tenant.description,
      tenant.plan,
      JSON.stringify(tenant.settings)
    ]);

    if (success) {
      return tenant;
    }
    throw new Error('Failed to create tenant');
  }

  async getTenant(id: string): Promise<any> {
    const sql = 'SELECT * FROM tenants WHERE id = ?';
    const result = await this.queryFirst(sql, [id]);

    if (result) {
      result.settings = JSON.parse(result.settings);
    }

    return result;
  }

  async getTenantBySlug(slug: string): Promise<any> {
    const sql = 'SELECT * FROM tenants WHERE slug = ?';
    const result = await this.queryFirst(sql, [slug]);

    if (result) {
      result.settings = JSON.parse(result.settings);
    }

    return result;
  }

  async updateTenant(id: string, updates: any): Promise<any> {
    const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`);
    const values = Object.values(updates).filter((_, index) => Object.keys(updates)[index] !== 'id');

    sql = `UPDATE tenants SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    values.push(id);

    const { success } = await this.execute(sql, values);

    if (success) {
      return await this.getTenant(id);
    }
    throw new Error('Failed to update tenant');
  }

  // User operations
  async createUser(user: any): Promise<any> {
    const sql = `
      INSERT INTO users (id, email, name, role, tenant_id, preferences)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const { success } = await this.execute(sql, [
      user.id,
      user.email,
      user.name,
      user.role,
      user.tenantId,
      JSON.stringify(user.preferences)
    ]);

    if (success) {
      return user;
    }
    throw new Error('Failed to create user');
  }

  async getUser(id: string): Promise<any> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const result = await this.queryFirst(sql, [id]);

    if (result) {
      result.preferences = JSON.parse(result.preferences);
      result.tenantId = result.tenant_id;
      delete result.tenant_id;
    }

    return result;
  }

  async getUserByEmail(email: string): Promise<any> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const result = await this.queryFirst(sql, [email]);

    if (result) {
      result.preferences = JSON.parse(result.preferences);
      result.tenantId = result.tenant_id;
      delete result.tenant_id;
    }

    return result;
  }

  async getUsersByTenant(tenantId: string): Promise<any[]> {
    const sql = 'SELECT * FROM users WHERE tenant_id = ?';
    const results = await this.query(sql, [tenantId]);

    return results.map(user => {
      const { tenant_id, ...rest } = user;
      return {
        ...rest,
        preferences: JSON.parse(user.preferences),
        tenantId
      };
    });
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const fields = Object.keys(updates).map(key => `${key} = ?`);
    const values = Object.values(updates);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    values.push(id);

    const { success } = await this.execute(sql, values);

    if (success) {
      return await this.getUser(id);
    }
    throw new Error('Failed to update user');
  }

  async deleteUser(id: string): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = ?';
    const { success } = await this.execute(sql, [id]);
    return success;
  }

  // Project operations
  async createProject(project: any): Promise<any> {
    const sql = `
      INSERT INTO projects (id, tenant_id, name, description, type, status, config, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const { success } = await this.execute(sql, [
      project.id,
      project.tenantId,
      project.name,
      project.description,
      project.type,
      project.status,
      JSON.stringify(project.config),
      JSON.stringify(project.permissions)
    ]);

    // Add project members
    for (const member of project.team) {
      await this.addProjectMember(project.id, project.tenantId, member.userId, member.role);
    }

    if (success) {
      return await this.getProject(project.id, project.tenantId);
    }
    throw new Error('Failed to create project');
  }

  async getProject(id: string, tenantId: string): Promise<any> {
    const sql = 'SELECT * FROM projects WHERE id = ? AND tenant_id = ?';
    const result = await this.queryFirst(sql, [id, tenantId]);

    if (result) {
      result.config = JSON.parse(result.config);
      result.permissions = JSON.parse(result.permissions);
      result.tenantId = result.tenant_id;
      delete result.tenant_id;

      // Get team members
      const team = await this.getProjectMembers(id);
      result.team = team;
    }

    return result;
  }

  async getProjectsByTenant(tenantId: string): Promise<any[]> {
    const sql = 'SELECT * FROM projects WHERE tenant_id = ?';
    const results = await this.query(sql, [tenantId]);

    return Promise.all(results.map(async project => {
      project.config = JSON.parse(project.config);
      project.permissions = JSON.parse(project.permissions);
      project.tenantId = project.tenant_id;
      delete project.tenant_id;

      const team = await this.getProjectMembers(project.id);
      project.team = team;

      return project;
    }));
  }

  async updateProject(id: string, tenantId: string, updates: any): Promise<any> {
    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'tenantId').map(key => `${key} = ?`);
    const values = Object.values(updates).filter((_, index) => Object.keys(updates)[index] !== 'id' && Object.keys(updates)[index] !== 'tenantId');

    const sql = `UPDATE projects SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`;
    values.push(id, tenantId);

    const { success } = await this.execute(sql, values);

    if (success) {
      return await this.getProject(id, tenantId);
    }
    throw new Error('Failed to update project');
  }

  async deleteProject(id: string, tenantId: string): Promise<boolean> {
    const sql = 'DELETE FROM projects WHERE id = ? AND tenant_id = ?';
    const { success } = await this.execute(sql, [id, tenantId]);
    return success;
  }

  // Project member operations
  async addProjectMember(projectId: string, tenantId: string, userId: string, role: string): Promise<void> {
    const sql = 'INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)';
    await this.execute(sql, [projectId, userId, role]);
  }

  async getProjectMembers(projectId: string): Promise<any[]> {
    const sql = `
      SELECT pm.role, u.id, u.email, u.name, u.preferences, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `;

    const results = await this.query(sql, [projectId]);

    return results.map(member => ({
      userId: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      preferences: JSON.parse(member.preferences),
      joinedAt: new Date(member.joined_at)
    }));
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    const sql = 'DELETE FROM project_members WHERE project_id = ? AND user_id = ?';
    const { success } = await this.execute(sql, [projectId, userId]);
    return success;
  }

  // Usage tracking
  async recordUsage(usage: any): Promise<void> {
    const sql = `
      INSERT INTO usage (id, tenant_id, project_id, user_id, action, resource, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.execute(sql, [
      usage.id,
      usage.tenantId,
      usage.projectId,
      usage.userId,
      usage.action,
      usage.resource,
      JSON.stringify(usage.metadata || {})
    ]);
  }

  async getTenantUsage(tenantId: string, days: number = 30): Promise<any> {
    const sql = `
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as actions,
        COUNT(DISTINCT user_id) as unique_users,
        action,
        resource
      FROM usage
      WHERE tenant_id = ? AND timestamp >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(timestamp), action, resource
      ORDER BY date DESC
    `;

    const results = await this.query(sql, [tenantId, days]);

    // Aggregate by date
    const usageByDate = {};
    for (const row of results) {
      if (!usageByDate[row.date]) {
        usageByDate[row.date] = {
          date: row.date,
          totalActions: 0,
          uniqueUsers: new Set(),
          actions: {}
        };
      }

      usageByDate[row.date].totalActions += row.actions;
      usageByDate[row.date].uniqueUsers.add(row.unique_users);

      if (!usageByDate[row.date].actions[row.action]) {
        usageByDate[row.date].actions[row.action] = 0;
      }
      usageByDate[row.date].actions[row.action] += row.actions;
    }

    return Object.values(usageByDate);
  }
}

export const db = new DatabaseAdapter(env);