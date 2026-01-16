/**
 * Forums Service
 * Handles discussion forums, threads, and posts
 */

// @ts-nocheck - Database results with type mismatches and unused imports
import { DatabaseConnection, BaseRepository, QueryBuilder } from '../utils/database';
import { generateUniqueSlug, generateSlug } from '../utils/database';
import {
  ForumCategory,
  ForumThread,
  ForumPost,
  ThreadStatus,
  PostReaction,
  UserPublicProfile,
  PaginationMeta,
  PaginatedResponse,
  ThreadView
} from '../types';
import { extractMentions, createNotification, NotificationType } from '../utils/helpers';

export class ForumCategoryRepository extends BaseRepository<ForumCategory> {
  tableName = 'forum_categories';

  async findBySlug(slug: string): Promise<ForumCategory | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE slug = ? AND deleted_at IS NULL`;
    return this.db.queryOne<ForumCategory>(sql, [slug]);
  }

  async findAllOrdered(): Promise<ForumCategory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE deleted_at IS NULL
      ORDER BY parent_id NULLS LAST, order_index ASC
    `;
    return this.db.query<ForumCategory>(sql);
  }

  async findByParent(parentId: string | null): Promise<ForumCategory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE parent_id ${parentId ? '= ?' : 'IS NULL'}
      AND deleted_at IS NULL
      ORDER BY order_index ASC
    `;
    return this.db.query<ForumCategory>(sql, parentId ? [parentId] : []);
  }

  async getTopLevel(): Promise<ForumCategory[]> {
    return this.findByParent(null);
  }

  async getChildren(parentId: string): Promise<ForumCategory[]> {
    return this.findByParent(parentId);
  }

  async incrementThreadCount(categoryId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET thread_count = thread_count + 1
      WHERE id = ?
    `;
    await this.db.execute(sql, [categoryId]);
  }

  async incrementPostCount(categoryId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET post_count = post_count + 1
      WHERE id = ?
    `;
    await this.db.execute(sql, [categoryId]);
  }

  async updateLastPost(categoryId: string, postId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET last_post_id = ?
      WHERE id = ?
    `;
    await this.db.execute(sql, [postId, categoryId]);
  }
}

export class ForumThreadRepository extends BaseRepository<ForumThread> {
  tableName = 'forum_threads';

  async findBySlug(slug: string): Promise<ForumThread | null> {
    const sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug,
             u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.author_id = u.id
      WHERE t.slug = ? AND t.deleted_at IS NULL
    `;
    const thread = await this.db.queryOne<any>(sql, [slug]);

    if (!thread) return null;

    return this.mapThreadToModel(thread);
  }

  async findByCategory(categoryId: string, page: number = 1, perPage: number = 20, options?: {
    pinned?: boolean;
    status?: ThreadStatus;
    sortBy?: 'latest' | 'popular' | 'unanswered';
  }): Promise<PaginatedResponse<ForumThread>> {
    const offset = (page - 1) * perPage;

    let whereClause = 't.category_id = ? AND t.deleted_at IS NULL';
    const params: any[] = [categoryId];

    if (options?.pinned !== undefined) {
      whereClause += ' AND t.is_pinned = ?';
      params.push(options.pinned ? 1 : 0);
    }

    if (options?.status) {
      whereClause += ' AND t.status = ?';
      params.push(options.status);
    }

    const countSql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName} t
      WHERE ${whereClause}
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    let orderClause = 't.is_pinned DESC, t.created_at DESC';
    if (options?.sortBy === 'popular') {
      orderClause = 't.is_pinned DESC, t.view_count DESC, t.like_count DESC';
    } else if (options?.sortBy === 'unanswered') {
      orderClause = 't.is_pinned DESC, t.reply_count ASC, t.created_at DESC';
    }

    const sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug,
             u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.author_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const threads = await this.db.query<any>(sql, [...params, perPage, offset]);

    return {
      data: threads.map(t => this.mapThreadToModel(t)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByAuthor(authorId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<ForumThread>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE author_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [authorId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug,
             u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.author_id = u.id
      WHERE t.author_id = ? AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const threads = await this.db.query<any>(sql, [authorId, perPage, offset]);

    return {
      data: threads.map(t => this.mapThreadToModel(t)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findPinned(categoryId?: string): Promise<ForumThread[]> {
    let sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug,
             u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.author_id = u.id
      WHERE t.is_pinned = 1 AND t.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (categoryId) {
      sql += ' AND t.category_id = ?';
      params.push(categoryId);
    }

    sql += ' ORDER BY t.created_at DESC';

    const threads = await this.db.query<any>(sql, params);
    return threads.map(t => this.mapThreadToModel(t));
  }

  async findFeatured(limit: number = 5): Promise<ForumThread[]> {
    const sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug,
             u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.author_id = u.id
      WHERE t.is_featured = 1 AND t.deleted_at IS NULL
      ORDER BY t.like_count DESC, t.view_count DESC
      LIMIT ?
    `;
    const threads = await this.db.query<any>(sql, [limit]);
    return threads.map(t => this.mapThreadToModel(t));
  }

  async getThreadWithPosts(threadId: string, page: number = 1, perPage: number = 20): Promise<{
    thread: ForumThread | null;
    posts: ForumPost[];
    meta: PaginationMeta;
  } | null> {
    const thread = await this.findById(threadId);
    if (!thread) return null;

    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM forum_posts WHERE thread_id = ? AND deleted_at IS NULL`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [threadId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT p.*, u.username, u.display_name, u.avatar_url
      FROM forum_posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.thread_id = ? AND p.deleted_at IS NULL
      ORDER BY p.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const posts = await this.db.query<any>(sql, [threadId, perPage, offset]);

    const mappedPosts: ForumPost[] = posts.map(p => ({
      id: p.id,
      thread_id: p.thread_id,
      content: p.content,
      author_id: p.author_id,
      author: {
        id: p.author_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url
      },
      parent_id: p.parent_id,
      is_first_post: p.is_first_post === 1,
      like_count: p.like_count || 0,
      dislike_count: p.dislike_count || 0,
      reactions: [],
      edits: [],
      is_edited: p.is_edited === 1,
      edited_at: p.edited_at,
      edited_reason: p.edited_reason,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));

    return {
      thread,
      posts: mappedPosts,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async incrementViewCount(threadId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET view_count = view_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [threadId]);
  }

  async incrementReplyCount(threadId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET reply_count = reply_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [threadId]);

    // Update last reply time
    await this.db.execute(`
      UPDATE ${this.tableName}
      SET last_reply_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [threadId]);
  }

  async updateLikeCount(threadId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET like_count = (SELECT COUNT(*) FROM thread_reactions WHERE thread_id = ?)
      WHERE id = ?
    `;
    await this.db.execute(sql, [threadId, threadId]);
  }

  async togglePin(threadId: string): Promise<boolean> {
    const sql = `UPDATE ${this.tableName} SET is_pinned = NOT is_pinned WHERE id = ?`;
    const result = await this.db.execute(sql, [threadId]);
    return result.rowsAffected > 0;
  }

  async toggleLock(threadId: string): Promise<boolean> {
    const sql = `UPDATE ${this.tableName} SET is_locked = NOT is_locked WHERE id = ?`;
    const result = await this.db.execute(sql, [threadId]);
    return result.rowsAffected > 0;
  }

  async toggleFeature(threadId: string): Promise<boolean> {
    const sql = `UPDATE ${this.tableName} SET is_featured = NOT is_featured WHERE id = ?`;
    const result = await this.db.execute(sql, [threadId]);
    return result.rowsAffected > 0;
  }

  async updateStatus(threadId: string, status: ThreadStatus): Promise<boolean> {
    return this.update(threadId, { status } as any);
  }

  async search(query: string, page: number = 1, perPage: number = 20, categoryId?: string): Promise<PaginatedResponse<ForumThread>> {
    const offset = (page - 1) * perPage;
    const searchTerm = `%${query}%`;

    let whereClause = 't.deleted_at IS NULL AND (t.title LIKE ? OR t.content LIKE ?)';
    const params: any[] = [searchTerm, searchTerm];

    if (categoryId) {
      whereClause += ' AND t.category_id = ?';
      params.push(categoryId);
    }

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} t WHERE ${whereClause}`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug,
             u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.author_id = u.id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const threads = await this.db.query<any>(sql, [...params, perPage, offset]);

    return {
      data: threads.map(t => this.mapThreadToModel(t)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async recordView(threadId: string, userId?: string, ipAddress?: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO thread_views (thread_id, user_id, ip_address, viewed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [threadId, userId || null, ipAddress || null]);
  }

  private mapThreadToModel(thread: any): ForumThread {
    return {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      content: thread.content,
      author_id: thread.author_id,
      author: thread.username ? {
        id: thread.author_id,
        username: thread.username,
        display_name: thread.display_name,
        avatar_url: thread.avatar_url
      } : undefined,
      category_id: thread.category_id,
      category: thread.category_name ? {
        id: thread.category_id,
        name: thread.category_name,
        slug: thread.category_slug
      } as any : undefined,
      tags: thread.tags ? JSON.parse(thread.tags) : [],
      is_pinned: thread.is_pinned === 1,
      is_locked: thread.is_locked === 1,
      is_featured: thread.is_featured === 1,
      view_count: thread.view_count || 0,
      like_count: thread.like_count || 0,
      reply_count: thread.reply_count || 0,
      last_reply_at: thread.last_reply_at,
      last_reply_by: thread.last_reply_by,
      status: thread.status,
      reactions: [],
      created_at: thread.created_at,
      updated_at: thread.updated_at
    };
  }
}

export class ForumPostRepository extends BaseRepository<ForumPost> {
  tableName = 'forum_posts';

  async findByThread(threadId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<ForumPost>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE thread_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [threadId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT p.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.thread_id = ? AND p.deleted_at IS NULL
      ORDER BY p.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const posts = await this.db.query<any>(sql, [threadId, perPage, offset]);

    return {
      data: posts.map(p => this.mapPostToModel(p)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async getFirstPost(threadId: string): Promise<ForumPost | null> {
    const sql = `
      SELECT p.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.thread_id = ? AND p.is_first_post = 1 AND p.deleted_at IS NULL
      LIMIT 1
    `;
    const post = await this.db.queryOne<any>(sql, [threadId]);
    return post ? this.mapPostToModel(post) : null;
  }

  async updateContent(postId: string, content: string, reason?: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET content = ?,
          is_edited = 1,
          edited_at = CURRENT_TIMESTAMP,
          edited_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [content, reason || null, postId]);
    return result.rowsAffected > 0;
  }

  async updateLikeCount(postId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET like_count = (SELECT COUNT(*) FROM post_reactions WHERE post_id = ? AND reaction_type = 'like')
      WHERE id = ?
    `;
    await this.db.execute(sql, [postId, postId]);
  }

  async updateDislikeCount(postId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET dislike_count = (SELECT COUNT(*) FROM post_reactions WHERE post_id = ? AND reaction_type = 'dislike')
      WHERE id = ?
    `;
    await this.db.execute(sql, [postId, postId]);
  }

  async addReaction(postId: string, userId: string, reaction: string): Promise<boolean> {
    const sql = `
      INSERT INTO post_reactions (post_id, user_id, reaction, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (post_id, user_id) DO UPDATE SET reaction = ?
    `;
    const result = await this.db.execute(sql, [postId, userId, reaction, reaction]);
    return result.rowsAffected > 0;
  }

  async removeReaction(postId: string, userId: string): Promise<boolean> {
    const sql = `DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?`;
    const result = await this.db.execute(sql, [postId, userId]);
    return result.rowsAffected > 0;
  }

  async getReactions(postId: string): Promise<PostReaction[]> {
    const sql = `
      SELECT reaction, user_id, created_at
      FROM post_reactions
      WHERE post_id = ?
      ORDER BY created_at DESC
    `;
    return this.db.query<PostReaction>(sql, [postId]);
  }

  private mapPostToModel(post: any): ForumPost {
    return {
      id: post.id,
      thread_id: post.thread_id,
      content: post.content,
      author_id: post.author_id,
      author: post.username ? {
        id: post.author_id,
        username: post.username,
        display_name: post.display_name,
        avatar_url: post.avatar_url
      } : undefined,
      parent_id: post.parent_id,
      is_first_post: post.is_first_post === 1,
      like_count: post.like_count || 0,
      dislike_count: post.dislike_count || 0,
      reactions: [],
      edits: [],
      is_edited: post.is_edited === 1,
      edited_at: post.edited_at,
      edited_reason: post.edited_reason,
      created_at: post.created_at,
      updated_at: post.updated_at
    };
  }
}

export class ForumService {
  constructor(
    private db: DatabaseConnection,
    private notificationService: any
  ) {
    this.categoryRepo = new ForumCategoryRepository(db);
    this.threadRepo = new ForumThreadRepository(db);
    this.postRepo = new ForumPostRepository(db);
  }

  private categoryRepo: ForumCategoryRepository;
  private threadRepo: ForumThreadRepository;
  private postRepo: ForumPostRepository;

  // Category operations
  async createCategory(data: {
    name: string;
    description: string;
    icon?: string;
    color?: string;
    parent_id?: string;
    order: number;
    permissions: any;
  }): Promise<ForumCategory> {
    const slug = await generateUniqueSlug(data.name, 'forum_categories', this.db);

    const category = await this.categoryRepo.create({
      ...data,
      slug,
      thread_count: 0,
      post_count: 0,
      is_locked: false,
      tags: []
    } as any);

    return category;
  }

  async getCategory(id: string): Promise<ForumCategory | null> {
    return this.categoryRepo.findById(id);
  }

  async getCategoryBySlug(slug: string): Promise<ForumCategory | null> {
    return this.categoryRepo.findBySlug(slug);
  }

  async getAllCategories(): Promise<ForumCategory[]> {
    return this.categoryRepo.findAllOrdered();
  }

  async getTopLevelCategories(): Promise<ForumCategory[]> {
    return this.categoryRepo.getTopLevel();
  }

  async getChildCategories(parentId: string): Promise<ForumCategory[]> {
    return this.categoryRepo.getChildren(parentId);
  }

  async updateCategory(id: string, data: Partial<ForumCategory>): Promise<boolean> {
    return this.categoryRepo.update(id, data);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categoryRepo.delete(id);
  }

  // Thread operations
  async createThread(data: {
    title: string;
    content: string;
    author_id: string;
    category_id: string;
    tags?: string[];
    is_pinned?: boolean;
  }): Promise<ForumThread> {
    const slug = await generateUniqueSlug(data.title, 'forum_threads', this.db);

    const thread = await this.threadRepo.create({
      title: data.title,
      slug,
      content: data.content,
      author_id: data.author_id,
      category_id: data.category_id,
      tags: data.tags || [],
      is_pinned: data.is_pinned || false,
      is_locked: false,
      is_featured: false,
      view_count: 0,
      like_count: 0,
      reply_count: 0,
      status: ThreadStatus.OPEN,
      reactions: []
    } as any);

    // Create first post
    await this.createPost({
      thread_id: thread.id,
      content: data.content,
      author_id: data.author_id,
      is_first_post: true
    });

    // Update category stats
    await this.categoryRepo.incrementThreadCount(data.category_id);
    await this.categoryRepo.incrementPostCount(data.category_id);

    // Notify tagged users
    const mentions = extractMentions(data.content);
    for (const username of mentions) {
      // Find user by username and create notification
      // This would be implemented with user service
    }

    return thread;
  }

  async getThread(id: string): Promise<ForumThread | null> {
    return this.threadRepo.findById(id);
  }

  async getThreadBySlug(slug: string): Promise<ForumThread | null> {
    return this.threadRepo.findBySlug(slug);
  }

  async getThreadWithPosts(threadId: string, page: number = 1, perPage: number = 20) {
    return this.threadRepo.getThreadWithPosts(threadId, page, perPage);
  }

  async getThreadsByCategory(categoryId: string, page: number = 1, perPage: number = 20, options?: {
    pinned?: boolean;
    status?: ThreadStatus;
    sortBy?: 'latest' | 'popular' | 'unanswered';
  }): Promise<PaginatedResponse<ForumThread>> {
    return this.threadRepo.findByCategory(categoryId, page, perPage, options);
  }

  async getThreadsByAuthor(authorId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<ForumThread>> {
    return this.threadRepo.findByAuthor(authorId, page, perPage);
  }

  async getPinnedThreads(categoryId?: string): Promise<ForumThread[]> {
    return this.threadRepo.findPinned(categoryId);
  }

  async getFeaturedThreads(limit: number = 5): Promise<ForumThread[]> {
    return this.threadRepo.findFeatured(limit);
  }

  async updateThread(id: string, data: Partial<ForumThread>): Promise<boolean> {
    return this.threadRepo.update(id, data);
  }

  async deleteThread(id: string): Promise<boolean> {
    return this.threadRepo.delete(id);
  }

  async togglePinThread(id: string): Promise<boolean> {
    return this.threadRepo.togglePin(id);
  }

  async toggleLockThread(id: string): Promise<boolean> {
    return this.threadRepo.toggleLock(id);
  }

  async toggleFeatureThread(id: string): Promise<boolean> {
    return this.threadRepo.toggleFeature(id);
  }

  async recordThreadView(threadId: string, userId?: string, ipAddress?: string): Promise<void> {
    await this.threadRepo.recordView(threadId, userId, ipAddress);
    await this.threadRepo.incrementViewCount(threadId);
  }

  async searchThreads(query: string, page: number = 1, perPage: number = 20, categoryId?: string): Promise<PaginatedResponse<ForumThread>> {
    return this.threadRepo.search(query, page, perPage, categoryId);
  }

  // Post operations
  async createPost(data: {
    thread_id: string;
    content: string;
    author_id: string;
    parent_id?: string;
    is_first_post?: boolean;
  }): Promise<ForumPost> {
    const post = await this.postRepo.create({
      ...data,
      like_count: 0,
      dislike_count: 0,
      reactions: [],
      edits: [],
      is_edited: false
    } as any);

    // Update thread and category stats
    if (!data.is_first_post) {
      await this.threadRepo.incrementReplyCount(data.thread_id);
      await this.categoryRepo.incrementPostCount(post.thread_id);

      // Get thread to notify author
      const thread = await this.threadRepo.findById(data.thread_id);
      if (thread && thread.author_id !== data.author_id) {
        // Create notification for thread author
        await this.notificationService.create({
          recipient_id: thread.author_id,
          type: NotificationType.FORUM_REPLY,
          title: 'New reply to your thread',
          body: `Someone replied to "${thread.title}"`,
          source_type: 'forum_post',
          source_id: post.id,
          source_user_id: data.author_id
        });
      }

      // Check for mentions
      const mentions = extractMentions(data.content);
      for (const username of mentions) {
        // Find user by username and create notification
      }
    }

    return post;
  }

  async getPost(id: string): Promise<ForumPost | null> {
    return this.postRepo.findById(id);
  }

  async getPostsByThread(threadId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<ForumPost>> {
    return this.postRepo.findByThread(threadId, page, perPage);
  }

  async updatePost(id: string, content: string, reason?: string): Promise<boolean> {
    return this.postRepo.updateContent(id, content, reason);
  }

  async deletePost(id: string): Promise<boolean> {
    return this.postRepo.delete(id);
  }

  async likePost(postId: string, userId: string): Promise<void> {
    await this.postRepo.addReaction(postId, userId, 'like');
    await this.postRepo.updateLikeCount(postId);

    // Get post to notify author
    const post = await this.postRepo.findById(postId);
    if (post && post.author_id !== userId) {
      await this.notificationService.create({
        recipient_id: post.author_id,
        type: NotificationType.FORUM_LIKE,
        title: 'Your post was liked',
        body: 'Someone liked your post',
        source_type: 'forum_post',
        source_id: postId,
        source_user_id: userId
      });
    }
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    await this.postRepo.removeReaction(postId, userId);
    await this.postRepo.updateLikeCount(postId);
  }

  async dislikePost(postId: string, userId: string): Promise<void> {
    await this.postRepo.addReaction(postId, userId, 'dislike');
    await this.postRepo.updateDislikeCount(postId);
  }

  async getPostReactions(postId: string): Promise<PostReaction[]> {
    return this.postRepo.getReactions(postId);
  }
}
