// @ts-nocheck
/**
 * Marketplace API Routes
 * REST API endpoints for the agent marketplace
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  Agent,
  SearchOptions,
  SearchFilters,
  AgentCategory,
  PublishState
} from '../types';

// ============================================================================
// API Types
// ============================================================================

export interface ApiContext {
  env: {
    DB: D1Database;
    KV: KVNamespace;
    R2: R2Bucket;
  };
  userId?: string;
}

// ============================================================================
// Request/Response Schemas
// ============================================================================

const SearchQuerySchema = z.object({
  query: z.string().optional(),
  category: z.nativeEnum(AgentCategory).optional(),
  limit: z.number().min(1).max(100).optional(),
  page: z.number().min(1).optional(),
  sort: z.enum(['relevance', 'rating', 'installs', 'updated', 'created']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

const AgentCreateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(50).max(500),
  category: z.nativeEnum(AgentCategory),
  code: z.string(),
  config: z.any().optional()
});

const AgentUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().min(50).max(500).optional(),
  code: z.string().optional(),
  config: z.any().optional()
});

const ReviewCreateSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(100),
  content: z.string().min(10).max(1000)
});

const CommentCreateSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional()
});

// ============================================================================
// Marketplace API
// ============================================================================

export class MarketplaceAPI {
  private app: Hono<ApiContext>;

  constructor() {
    this.app = new Hono<ApiContext>();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Agent routes
    this.app.get('/api/agents', this.listAgents.bind(this));
    this.app.post('/api/agents', this.createAgent.bind(this));
    this.app.get('/api/agents/:id', this.getAgent.bind(this));
    this.app.put('/api/agents/:id', this.updateAgent.bind(this));
    this.app.delete('/api/agents/:id', this.deleteAgent.bind(this));

    // Agent versions
    this.app.get('/api/agents/:id/versions', this.listVersions.bind(this));
    this.app.post('/api/agents/:id/versions', this.createVersion.bind(this));

    // Agent publishing
    this.app.post('/api/agents/:id/publish', this.publishAgent.bind(this));
    this.app.post('/api/agents/:id/unpublish', this.unpublishAgent.bind(this));

    // Search and discovery
    this.app.get('/api/search', this.searchAgents.bind(this));
    this.app.get('/api/trending', this.getTrending.bind(this));
    this.app.get('/api/popular', this.getPopular.bind(this));
    this.app.get('/api/newest', this.getNewest.bind(this));

    // Categories
    this.app.get('/api/categories', this.listCategories.bind(this));
    this.app.get('/api/categories/:category', this.getCategoryAgents.bind(this));

    // Templates
    this.app.get('/api/templates', this.listTemplates.bind(this));
    this.app.get('/api/templates/:id', this.getTemplate.bind(this));
    this.app.post('/api/templates/:id/scaffold', this.scaffoldTemplate.bind(this));

    // Reviews
    this.app.get('/api/agents/:id/reviews', this.listReviews.bind(this));
    this.app.post('/api/agents/:id/reviews', this.createReview.bind(this));
    this.app.put('/api/agents/:id/reviews/:reviewId/helpful', this.markReviewHelpful.bind(this));

    // Comments
    this.app.get('/api/agents/:id/comments', this.listComments.bind(this));
    this.app.post('/api/agents/:id/comments', this.createComment.bind(this));
    this.app.delete('/api/agents/:id/comments/:commentId', this.deleteComment.bind(this));

    // Reactions
    this.app.post('/api/agents/:id/comments/:commentId/reactions', this.addReaction.bind(this));
    this.app.delete('/api/agents/:id/comments/:commentId/reactions/:emoji', this.removeReaction.bind(this));

    // Forks
    this.app.get('/api/agents/:id/forks', this.listForks.bind(this));
    this.app.post('/api/agents/:id/forks', this.forkAgent.bind(this));

    // Collections
    this.app.get('/api/collections', this.listCollections.bind(this));
    this.app.post('/api/collections', this.createCollection.bind(this));
    this.app.get('/api/collections/:id', this.getCollection.bind(this));
    this.app.put('/api/collections/:id', this.updateCollection.bind(this));
    this.app.delete('/api/collections/:id', this.deleteCollection.bind(this));
    this.app.post('/api/collections/:id/agents', this.addAgentToCollection.bind(this));
    this.app.delete('/api/collections/:id/agents/:agentId', this.removeAgentFromCollection.bind(this));

    // User profiles
    this.app.get('/api/users/:id', this.getUserProfile.bind(this));
    this.app.put('/api/users/:id', this.updateUserProfile.bind(this));
    this.app.get('/api/users/:id/agents', this.getUserAgents.bind(this));
    this.app.get('/api/users/:id/collections', this.getUserCollections.bind(this));

    // Sharing
    this.app.post('/api/agents/:id/share', this.shareAgent.bind(this));
    this.app.get('/api/agents/:id/embed', this.getEmbedCode.bind(this));

    // Analytics
    this.app.get('/api/agents/:id/analytics', this.getAgentAnalytics.bind(this));
    this.app.get('/api/stats', this.getMarketplaceStats.bind(this));

    // Validation
    this.app.post('/api/agents/validate', this.validateAgent.bind(this));

    // Testing
    this.app.post('/api/agents/:id/test', this.testAgent.bind(this));
  }

  // ========================================================================
  // Agent Routes
  // ========================================================================

  private async listAgents(c: any) {
    const { page = 1, limit = 20, category, sort, order } = c.req.query();

    // Query agents from database
    const agents = await c.env.DB.prepare(`
      SELECT * FROM agents
      WHERE status = 'published'
      ${category ? 'AND category = ?' : ''}
      ORDER BY ${sort || 'created_at'} ${order || 'DESC'}
      LIMIT ? OFFSET ?
    `)
      .bind(...(category ? [category] : []), limit, (page - 1) * limit)
      .all();

    const total = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM agents WHERE status = 'published'
      ${category ? 'AND category = ?' : ''}
    `)
      .bind(...(category ? [category] : []))
      .first();

    return c.json({
      items: agents.results,
      total: total?.count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  }

  private async createAgent(c: any) {
    const body = await c.req.json();
    const validated = AgentCreateSchema.parse(body);

    const agent = await c.env.DB.prepare(`
      INSERT INTO agents (id, name, description, category, code, config, author_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
      .bind(
        crypto.randomUUID(),
        validated.name,
        validated.description,
        validated.category,
        validated.code,
        JSON.stringify(validated.config || {}),
        c.req.userId
      )
      .run();

    return c.json({ success: true, id: agent.meta.last_row_id }, 201);
  }

  private async getAgent(c: any) {
    const { id } = c.req.param();

    const agent = await c.env.DB.prepare(`
      SELECT * FROM agents WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Track view
    await c.env.DB.prepare(`
      INSERT INTO agent_views (agent_id, viewed_at) VALUES (?, datetime('now'))
    `)
      .bind(id)
      .run();

    return c.json(agent);
  }

  private async updateAgent(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();
    const validated = AgentUpdateSchema.parse(body);

    // Check ownership
    const agent = await c.env.DB.prepare(`
      SELECT author_id FROM agents WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!agent || agent.author_id !== c.req.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update agent
    const updates: string[] = [];
    const values: any[] = [];

    if (validated.name) {
      updates.push('name = ?');
      values.push(validated.name);
    }
    if (validated.description) {
      updates.push('description = ?');
      values.push(validated.description);
    }
    if (validated.code) {
      updates.push('code = ?');
      values.push(validated.code);
    }
    if (validated.config) {
      updates.push('config = ?');
      values.push(JSON.stringify(validated.config));
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(id);

    await c.env.DB.prepare(`
      UPDATE agents SET ${updates.join(', ')} WHERE id = ?
    `)
      .bind(...values)
      .run();

    return c.json({ success: true });
  }

  private async deleteAgent(c: any) {
    const { id } = c.req.param();

    // Check ownership
    const agent = await c.env.DB.prepare(`
      SELECT author_id FROM agents WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!agent || agent.author_id !== c.req.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await c.env.DB.prepare(`
      DELETE FROM agents WHERE id = ?
    `)
      .bind(id)
      .run();

    return c.json({ success: true });
  }

  // ========================================================================
  // Version Routes
  // ========================================================================

  private async listVersions(c: any) {
    const { id } = c.req.param();

    const versions = await c.env.DB.prepare(`
      SELECT version, changelog, created_at FROM agent_versions
      WHERE agent_id = ?
      ORDER BY created_at DESC
    `)
      .bind(id)
      .all();

    return c.json({ items: versions.results });
  }

  private async createVersion(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();

    const { version, changelog } = body;

    await c.env.DB.prepare(`
      INSERT INTO agent_versions (agent_id, version, changelog, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `)
      .bind(id, version, changelog)
      .run();

    return c.json({ success: true }, 201);
  }

  // ========================================================================
  // Publishing Routes
  // ========================================================================

  private async publishAgent(c: any) {
    const { id } = c.req.param();

    await c.env.DB.prepare(`
      UPDATE agents SET status = 'published', published_at = datetime('now')
      WHERE id = ? AND author_id = ?
    `)
      .bind(id, c.req.userId)
      .run();

    return c.json({ success: true });
  }

  private async unpublishAgent(c: any) {
    const { id } = c.req.param();

    await c.env.DB.prepare(`
      UPDATE agents SET status = 'draft'
      WHERE id = ? AND author_id = ?
    `)
      .bind(id, c.req.userId)
      .run();

    return c.json({ success: true });
  }

  // ========================================================================
  // Search and Discovery
  // ========================================================================

  private async searchAgents(c: any) {
    const { query, category, limit = 20, page = 1, sort = 'relevance', order = 'desc' } = c.req.query();

    // Build search query
    const conditions: string[] = ["status = 'published'"];
    const values: any[] = [];

    if (query) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      values.push(`%${query}%`, `%${query}%`);
    }

    if (category) {
      conditions.push('category = ?');
      values.push(category);
    }

    const agents = await c.env.DB.prepare(`
      SELECT * FROM agents
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
    `)
      .bind(...values, parseInt(limit), (parseInt(page) - 1) * parseInt(limit))
      .all();

    return c.json({
      items: agents.results,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  }

  private async getTrending(c: any) {
    const { limit = 10 } = c.req.query();

    const agents = await c.env.DB.prepare(`
      SELECT a.*, COUNT(v.id) as view_count
      FROM agents a
      LEFT JOIN agent_views v ON a.id = v.agent_id
      WHERE a.status = 'published'
      AND v.viewed_at >= datetime('now', '-7 days')
      GROUP BY a.id
      ORDER BY view_count DESC
      LIMIT ?
    `)
      .bind(parseInt(limit))
      .all();

    return c.json({ items: agents.results });
  }

  private async getPopular(c: any) {
    const { limit = 10 } = c.req.query();

    const agents = await c.env.DB.prepare(`
      SELECT * FROM agents
      WHERE status = 'published'
      ORDER BY installs DESC
      LIMIT ?
    `)
      .bind(parseInt(limit))
      .all();

    return c.json({ items: agents.results });
  }

  private async getNewest(c: any) {
    const { limit = 10 } = c.req.query();

    const agents = await c.env.DB.prepare(`
      SELECT * FROM agents
      WHERE status = 'published'
      ORDER BY created_at DESC
      LIMIT ?
    `)
      .bind(parseInt(limit))
      .all();

    return c.json({ items: agents.results });
  }

  // ========================================================================
  // Category Routes
  // ========================================================================

  private async listCategories(c: any) {
    const categories = await c.env.DB.prepare(`
      SELECT category, COUNT(*) as count
      FROM agents
      WHERE status = 'published'
      GROUP BY category
      ORDER BY count DESC
    `)
      .all();

    return c.json({ items: categories.results });
  }

  private async getCategoryAgents(c: any) {
    const { category } = c.req.param();
    const { limit = 20, page = 1 } = c.req.query();

    const agents = await c.env.DB.prepare(`
      SELECT * FROM agents
      WHERE status = 'published' AND category = ?
      ORDER BY rating DESC
      LIMIT ? OFFSET ?
    `)
      .bind(category, parseInt(limit), (parseInt(page) - 1) * parseInt(limit))
      .all();

    return c.json({ items: agents.results });
  }

  // ========================================================================
  // Template Routes
  // ========================================================================

  private async listTemplates(c: any) {
    const { category } = c.req.query();

    const templates = await c.env.DB.prepare(`
      SELECT * FROM agent_templates
      ${category ? 'WHERE category = ?' : ''}
      ORDER BY name ASC
    `)
      .bind(...(category ? [category] : []))
      .all();

    return c.json({ items: templates.results });
  }

  private async getTemplate(c: any) {
    const { id } = c.req.param();

    const template = await c.env.DB.prepare(`
      SELECT * FROM agent_templates WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json(template);
  }

  private async scaffoldTemplate(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();

    // Return scaffolded files
    return c.json({
      files: {},
      structure: []
    });
  }

  // ========================================================================
  // Review Routes
  // ========================================================================

  private async listReviews(c: any) {
    const { id } = c.req.param();
    const { limit = 20, page = 1 } = c.req.query();

    const reviews = await c.env.DB.prepare(`
      SELECT * FROM agent_reviews
      WHERE agent_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
      .bind(id, parseInt(limit), (parseInt(page) - 1) * parseInt(limit))
      .all();

    return c.json({ items: reviews.results });
  }

  private async createReview(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();
    const validated = ReviewCreateSchema.parse(body);

    await c.env.DB.prepare(`
      INSERT INTO agent_reviews (id, agent_id, user_id, rating, title, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
      .bind(crypto.randomUUID(), id, c.req.userId, validated.rating, validated.title, validated.content)
      .run();

    // Update agent rating
    await c.env.DB.prepare(`
      UPDATE agents SET
        rating = (SELECT AVG(rating) FROM agent_reviews WHERE agent_id = ?),
        rating_count = (SELECT COUNT(*) FROM agent_reviews WHERE agent_id = ?)
      WHERE id = ?
    `)
      .bind(id, id, id)
      .run();

    return c.json({ success: true }, 201);
  }

  private async markReviewHelpful(c: any) {
    const { id, reviewId } = c.req.param();

    await c.env.DB.prepare(`
      UPDATE agent_reviews SET helpful = helpful + 1 WHERE id = ?
    `)
      .bind(reviewId)
      .run();

    return c.json({ success: true });
  }

  // ========================================================================
  // Comment Routes
  // ========================================================================

  private async listComments(c: any) {
    const { id } = c.req.param();

    const comments = await c.env.DB.prepare(`
      SELECT * FROM agent_comments
      WHERE agent_id = ? AND parent_id IS NULL
      ORDER BY created_at DESC
    `)
      .bind(id)
      .all();

    return c.json({ items: comments.results });
  }

  private async createComment(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();
    const validated = CommentCreateSchema.parse(body);

    await c.env.DB.prepare(`
      INSERT INTO agent_comments (id, agent_id, user_id, content, parent_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `)
      .bind(
        crypto.randomUUID(),
        id,
        c.req.userId,
        validated.content,
        validated.parentId || null
      )
      .run();

    return c.json({ success: true }, 201);
  }

  private async deleteComment(c: any) {
    const { id, commentId } = c.req.param();

    // Check ownership
    const comment = await c.env.DB.prepare(`
      SELECT user_id FROM agent_comments WHERE id = ?
    `)
      .bind(commentId)
      .first();

    if (!comment || comment.user_id !== c.req.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await c.env.DB.prepare(`
      DELETE FROM agent_comments WHERE id = ?
    `)
      .bind(commentId)
      .run();

    return c.json({ success: true });
  }

  // ========================================================================
  // Reaction Routes
  // ========================================================================

  private async addReaction(c: any) {
    const { id, commentId } = c.req.param();
    const { emoji } = await c.req.json();

    await c.env.DB.prepare(`
      INSERT INTO comment_reactions (comment_id, user_id, emoji, created_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT (comment_id, user_id, emoji) DO NOTHING
    `)
      .bind(commentId, c.req.userId, emoji)
      .run();

    return c.json({ success: true });
  }

  private async removeReaction(c: any) {
    const { id, commentId, emoji } = c.req.param();

    await c.env.DB.prepare(`
      DELETE FROM comment_reactions
      WHERE comment_id = ? AND user_id = ? AND emoji = ?
    `)
      .bind(commentId, c.req.userId, emoji)
      .run();

    return c.json({ success: true });
  }

  // ========================================================================
  // Fork Routes
  // ========================================================================

  private async listForks(c: any) {
    const { id } = c.req.param();

    const forks = await c.env.DB.prepare(`
      SELECT * FROM agent_forks
      WHERE original_agent_id = ?
      ORDER BY created_at DESC
    `)
      .bind(id)
      .all();

    return c.json({ items: forks.results });
  }

  private async forkAgent(c: any) {
    const { id } = c.req.param();

    // Create fork
    const forkId = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO agent_forks (id, original_agent_id, forked_agent_id, user_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `)
      .bind(forkId, id, forkId, c.req.userId)
      .run();

    return c.json({ success: true, forkId }, 201);
  }

  // ========================================================================
  // Collection Routes
  // ========================================================================

  private async listCollections(c: any) {
    const { userId } = c.req.query();

    const collections = await c.env.DB.prepare(`
      SELECT * FROM agent_collections
      WHERE visibility = 'public' ${userId ? 'OR user_id = ?' : ''}
      ORDER BY followers DESC
    `)
      .bind(...(userId ? [userId] : []))
      .all();

    return c.json({ items: collections.results });
  }

  private async createCollection(c: any) {
    const body = await c.req.json();

    await c.env.DB.prepare(`
      INSERT INTO agent_collections (id, name, description, user_id, visibility, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `)
      .bind(
        crypto.randomUUID(),
        body.name,
        body.description,
        c.req.userId,
        body.visibility || 'private'
      )
      .run();

    return c.json({ success: true }, 201);
  }

  private async getCollection(c: any) {
    const { id } = c.req.param();

    const collection = await c.env.DB.prepare(`
      SELECT * FROM agent_collections WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404);
    }

    return c.json(collection);
  }

  private async updateCollection(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();

    await c.env.DB.prepare(`
      UPDATE agent_collections SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        visibility = COALESCE(?, visibility),
        updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `)
      .bind(body.name, body.description, body.visibility, id, c.req.userId)
      .run();

    return c.json({ success: true });
  }

  private async deleteCollection(c: any) {
    const { id } = c.req.param();

    await c.env.DB.prepare(`
      DELETE FROM agent_collections WHERE id = ? AND user_id = ?
    `)
      .bind(id, c.req.userId)
      .run();

    return c.json({ success: true });
  }

  private async addAgentToCollection(c: any) {
    const { id } = c.req.param();
    const { agentId } = await c.req.json();

    await c.env.DB.prepare(`
      INSERT INTO collection_agents (collection_id, agent_id, added_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT (collection_id, agent_id) DO NOTHING
    `)
      .bind(id, agentId)
      .run();

    return c.json({ success: true });
  }

  private async removeAgentFromCollection(c: any) {
    const { id, agentId } = c.req.param();

    await c.env.DB.prepare(`
      DELETE FROM collection_agents WHERE collection_id = ? AND agent_id = ?
    `)
      .bind(id, agentId)
      .run();

    return c.json({ success: true });
  }

  // ========================================================================
  // User Profile Routes
  // ========================================================================

  private async getUserProfile(c: any) {
    const { id } = c.req.param();

    const profile = await c.env.DB.prepare(`
      SELECT * FROM user_profiles WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!profile) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(profile);
  }

  private async updateUserProfile(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();

    if (id !== c.req.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await c.env.DB.prepare(`
      UPDATE user_profiles SET
        display_name = COALESCE(?, display_name),
        bio = COALESCE(?, bio),
        location = COALESCE(?, location),
        website = COALESCE(?, website)
      WHERE id = ?
    `)
      .bind(body.displayName, body.bio, body.location, body.website, id)
      .run();

    return c.json({ success: true });
  }

  private async getUserAgents(c: any) {
    const { id } = c.req.param();

    const agents = await c.env.DB.prepare(`
      SELECT * FROM agents WHERE author_id = ?
      ORDER BY updated_at DESC
    `)
      .bind(id)
      .all();

    return c.json({ items: agents.results });
  }

  private async getUserCollections(c: any) {
    const { id } = c.req.param();

    const collections = await c.env.DB.prepare(`
      SELECT * FROM agent_collections WHERE user_id = ?
      ORDER BY updated_at DESC
    `)
      .bind(id)
      .all();

    return c.json({ items: collections.results });
  }

  // ========================================================================
  // Sharing Routes
  // ========================================================================

  private async shareAgent(c: any) {
    const { id } = c.req.param();
    const { platform, message } = await c.req.json();

    // Generate share URL
    const shareUrl = `https://claudeflare.market/agents/${id}`;

    return c.json({
      success: true,
      url: shareUrl,
      platform
    });
  }

  private async getEmbedCode(c: any) {
    const { id } = c.req.param();
    const { width, height, theme } = c.req.query();

    const embedCode = `<iframe
  src="https://claudeflare.market/embed/agents/${id}?theme=${theme || 'light'}"
  width="${width || 600}"
  height="${height || 400}"
  frameborder="0"
  allowfullscreen>
</iframe>`;

    return c.json({ embedCode });
  }

  // ========================================================================
  // Analytics Routes
  // ========================================================================

  private async getAgentAnalytics(c: any) {
    const { id } = c.req.param();

    const analytics = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT v.id) as views,
        COUNT(DISTINCT r.id) as reviews,
        AVG(r.rating) as avg_rating,
        COUNT(DISTINCT f.id) as forks
      FROM agents a
      LEFT JOIN agent_views v ON a.id = v.agent_id
      LEFT JOIN agent_reviews r ON a.id = r.agent_id
      LEFT JOIN agent_forks f ON a.id = f.original_agent_id
      WHERE a.id = ?
    `)
      .bind(id)
      .first();

    return c.json(analytics);
  }

  private async getMarketplaceStats(c: any) {
    const stats = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT a.id) as total_agents,
        COUNT(DISTINCT a.author_id) as total_users,
        SUM(a.installs) as total_installs,
        AVG(a.rating) as avg_rating
      FROM agents a
      WHERE a.status = 'published'
    `)
      .first();

    return c.json(stats);
  }

  // ========================================================================
  // Validation and Testing Routes
  // ========================================================================

  private async validateAgent(c: any) {
    const body = await c.req.json();

    // Validation logic would go here
    return c.json({
      valid: true,
      issues: [],
      metrics: {
        complexity: 5,
        maintainability: 85,
        security: 90,
        performance: 80
      }
    });
  }

  private async testAgent(c: any) {
    const { id } = c.req.param();
    const body = await c.req.json();

    // Test execution would go here
    return c.json({
      passed: true,
      results: []
    });
  }

  // ========================================================================
  // Export
  // ========================================================================

  export() {
    return this.app;
  }
}

// ============================================================================
// Middleware
// ============================================================================

export function authMiddleware() {
  return async (c: any, next: any) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify token and set user context
    // c.req.userId = verifyToken(token);

    await next();
  };
}

export function rateLimitMiddleware() {
  return async (c: any, next: any) => {
    const clientId = c.req.header('CF-Connecting-IP') || 'unknown';

    // Check rate limit
    // const limited = await checkRateLimit(clientId);
    // if (limited) {
    //   return c.json({ error: 'Rate limit exceeded' }, 429);
    // }

    await next();
  };
}

export function corsMiddleware() {
  return async (c: any, next: any) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }

    await next();
  };
}

// ============================================================================
// Exports
// ============================================================================

export default MarketplaceAPI;
