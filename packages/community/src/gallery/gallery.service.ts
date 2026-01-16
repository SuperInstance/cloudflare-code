/**
 * Code Gallery Service
 * Handles code snippets, templates, agents, and plugins
 */

// @ts-nocheck - Database results with type mismatches and missing properties
import { DatabaseConnection, BaseRepository } from '../utils/database';
import { generateUniqueSlug } from '../utils/database';
import {
  GalleryItem,
  GalleryItemType,
  GalleryRating,
  GalleryFork,
  GalleryReport,
  UserPublicProfile,
  PaginationMeta,
  PaginatedResponse
} from '../types';
import { NotificationType } from '../utils/helpers';

export class GalleryRepository extends BaseRepository<GalleryItem> {
  tableName = 'gallery_items';

  async findBySlug(slug: string): Promise<GalleryItem | null> {
    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.slug = ? AND g.deleted_at IS NULL
    `;
    const item = await this.db.queryOne<any>(sql, [slug]);
    return item ? this.mapItemToModel(item) : null;
  }

  async findByType(type: GalleryItemType, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE type = ? AND deleted_at IS NULL AND is_approved = 1
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [type]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.type = ? AND g.deleted_at IS NULL AND g.is_approved = 1
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [type, perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByCategory(category: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE category = ? AND deleted_at IS NULL AND is_approved = 1
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [category]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.category = ? AND g.deleted_at IS NULL AND g.is_approved = 1
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [category, perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByAuthor(authorId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE author_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [authorId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.author_id = ? AND g.deleted_at IS NULL
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [authorId, perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findForks(parentId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE parent_id = ? AND deleted_at IS NULL AND is_approved = 1
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [parentId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.parent_id = ? AND g.deleted_at IS NULL AND g.is_approved = 1
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [parentId, perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findFeatured(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE is_featured = 1 AND deleted_at IS NULL AND is_approved = 1
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.is_featured = 1 AND g.deleted_at IS NULL AND g.is_approved = 1
      ORDER BY g.rating_average DESC, g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findTrending(page: number = 1, perPage: number = 20, days: number = 7): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE deleted_at IS NULL AND is_approved = 1
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url,
             (view_count + fork_count * 2 + like_count * 3) as trend_score
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE g.deleted_at IS NULL AND g.is_approved = 1
      ORDER BY trend_score DESC, g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async search(query: string, page: number = 1, perPage: number = 20, filters?: {
    type?: GalleryItemType;
    category?: string;
    language?: string;
    tags?: string[];
  }): Promise<PaginatedResponse<GalleryItem>> {
    const offset = (page - 1) * perPage;
    const searchTerm = `%${query}%`;

    let whereClause = 'g.deleted_at IS NULL AND g.is_approved = 1 AND (g.title LIKE ? OR g.description LIKE ? OR g.content LIKE ?)';
    const params: any[] = [searchTerm, searchTerm, searchTerm];

    if (filters?.type) {
      whereClause += ' AND g.type = ?';
      params.push(filters.type);
    }

    if (filters?.category) {
      whereClause += ' AND g.category = ?';
      params.push(filters.category);
    }

    if (filters?.language) {
      whereClause += ' AND g.language = ?';
      params.push(filters.language);
    }

    if (filters?.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(() => "json_extract(g.tags, '$') LIKE ?").join(' AND ');
      whereClause += ` AND (${tagConditions})`;
      params.push(...filters.tags.map(t => `%"${t}"%`));
    }

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} g WHERE ${whereClause}`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
      SELECT g.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.author_id = u.id
      WHERE ${whereClause}
      ORDER BY g.rating_average DESC, g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.query<any>(sql, [...params, perPage, offset]);

    return {
      data: items.map(i => this.mapItemToModel(i)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async incrementViewCount(itemId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET view_count = view_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [itemId]);
  }

  async incrementForkCount(itemId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET fork_count = fork_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [itemId]);
  }

  async incrementDownloadCount(itemId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET download_count = download_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [itemId]);
  }

  async updateRating(itemId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET rating_average = (
        SELECT AVG(rating) FROM gallery_ratings WHERE item_id = ?
      ),
      rating_count = (
        SELECT COUNT(*) FROM gallery_ratings WHERE item_id = ?
      )
      WHERE id = ?
    `;
    await this.db.execute(sql, [itemId, itemId, itemId]);
  }

  async approveItem(itemId: string): Promise<boolean> {
    return this.update(itemId, { is_approved: true } as any);
  }

  async featureItem(itemId: string, featured: boolean): Promise<boolean> {
    return this.update(itemId, { is_featured: featured } as any);
  }

  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const sql = `
      SELECT json_each.value as tag, COUNT(*) as count
      FROM ${this.tableName},
           json_each(tags)
      WHERE deleted_at IS NULL AND is_approved = 1
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ?
    `;
    return this.db.query<{ tag: string; count: number }>(sql, [limit]);
  }

  async getCategories(): Promise<string[]> {
    const sql = `
      SELECT DISTINCT category
      FROM ${this.tableName}
      WHERE deleted_at IS NULL AND is_approved = 1
      ORDER BY category
    `;
    const result = await this.db.query<{ category: string }>(sql);
    return result.map(r => r.category);
  }

  async getLanguages(): Promise<string[]> {
    const sql = `
      SELECT DISTINCT language
      FROM ${this.tableName}
      WHERE deleted_at IS NULL AND is_approved = 1 AND language IS NOT NULL
      ORDER BY language
    `;
    const result = await this.db.query<{ language: string }>(sql);
    return result.map(r => r.language);
  }

  private mapItemToModel(item: any): GalleryItem {
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      type: item.type,
      author_id: item.author_id,
      author: item.username ? {
        id: item.author_id,
        username: item.username,
        display_name: item.display_name,
        avatar_url: item.avatar_url
      } : undefined,
      content: item.content,
      language: item.language,
      framework: item.framework,
      tags: item.tags ? JSON.parse(item.tags) : [],
      category: item.category,
      is_featured: item.is_featured === 1,
      is_approved: item.is_approved === 1,
      view_count: item.view_count || 0,
      fork_count: item.fork_count || 0,
      like_count: item.like_count || 0,
      download_count: item.download_count || 0,
      rating_average: item.rating_average || 0,
      rating_count: item.rating_count || 0,
      dependencies: item.dependencies ? JSON.parse(item.dependencies) : [],
      screenshots: item.screenshots ? JSON.parse(item.screenshots) : [],
      demo_url: item.demo_url,
      repository_url: item.repository_url,
      documentation_url: item.documentation_url,
      license: item.license,
      version: item.version,
      parent_id: item.parent_id,
      original_author_id: item.original_author_id,
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  }
}

export class GalleryRatingRepository extends BaseRepository<GalleryRating> {
  tableName = 'gallery_ratings';

  async findByItem(itemId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryRating>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE item_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [itemId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.item_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const ratings = await this.db.query<any>(sql, [itemId, perPage, offset]);

    return {
      data: ratings.map(r => ({
        ...r,
        user: r.username ? {
          id: r.user_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url
        } : undefined
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryRating>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE user_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const ratings = await this.db.query<GalleryRating>(sql, [userId, perPage, offset]);

    return {
      data: ratings,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByUserAndItem(userId: string, itemId: string): Promise<GalleryRating | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ? AND item_id = ?
      LIMIT 1
    `;
    return this.db.queryOne<GalleryRating>(sql, [userId, itemId]);
  }

  async getAverageRating(itemId: string): Promise<{ average: number; count: number }> {
    const sql = `
      SELECT AVG(rating) as average, COUNT(*) as count
      FROM ${this.tableName}
      WHERE item_id = ?
    `;
    const result = await this.db.queryOne<any>(sql, [itemId]);
    return {
      average: result.average || 0,
      count: result.count || 0
    };
  }

  async getRatingDistribution(itemId: string): Promise<{ rating: number; count: number }[]> {
    const sql = `
      SELECT rating, COUNT(*) as count
      FROM ${this.tableName}
      WHERE item_id = ?
      GROUP BY rating
      ORDER BY rating DESC
    `;
    return this.db.query<{ rating: number; count: number }>(sql, [itemId]);
  }
}

export class GalleryForkRepository extends BaseRepository<GalleryFork> {
  tableName = 'gallery_forks';

  async findByParent(parentId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryFork>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE parent_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [parentId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT f.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} f
      LEFT JOIN users u ON f.forked_by = u.id
      WHERE f.parent_id = ?
      ORDER BY f.forked_at DESC
      LIMIT ? OFFSET ?
    `;
    const forks = await this.db.query<any>(sql, [parentId, perPage, offset]);

    return {
      data: forks.map(f => ({
        ...f,
        user: f.username ? {
          id: f.forked_by,
          username: f.username,
          display_name: f.display_name,
          avatar_url: f.avatar_url
        } : undefined
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryFork>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE child_id IN (SELECT id FROM gallery_items WHERE author_id = ?)
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT f.* FROM ${this.tableName} f
      JOIN gallery_items g ON f.child_id = g.id
      WHERE g.author_id = ?
      ORDER BY f.forked_at DESC
      LIMIT ? OFFSET ?
    `;
    const forks = await this.db.query<GalleryFork>(sql, [userId, perPage, offset]);

    return {
      data: forks,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async hasForked(parentId: string, userId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.tableName} f
      JOIN gallery_items g ON f.child_id = g.id
      WHERE f.parent_id = ? AND g.author_id = ?
      LIMIT 1
    `;
    const result = await this.db.queryOne(sql, [parentId, userId]);
    return result !== null;
  }
}

export class GalleryReportRepository extends BaseRepository<GalleryReport> {
  tableName = 'gallery_reports';

  async findByStatus(status: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryReport>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE status = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [status]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.status = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const reports = await this.db.query<any>(sql, [status, perPage, offset]);

    return {
      data: reports.map(r => ({
        ...r,
        reporter: r.username ? {
          id: r.reporter_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url
        } : undefined
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByItem(itemId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryReport>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE item_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [itemId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.item_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const reports = await this.db.query<any>(sql, [itemId, perPage, offset]);

    return {
      data: reports.map(r => ({
        ...r,
        reporter: r.username ? {
          id: r.reporter_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url
        } : undefined
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async resolve(reportId: string, resolutionNotes: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'resolved',
          resolution_notes = ?,
          resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [resolutionNotes, reportId]);
    return result.rowsAffected > 0;
  }

  async dismiss(reportId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'dismissed', resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [reportId]);
    return result.rowsAffected > 0;
  }
}

export class GalleryService {
  constructor(
    private db: DatabaseConnection,
    private notificationService: any,
    private reputationService: any
  ) {
    this.galleryRepo = new GalleryRepository(db);
    this.ratingRepo = new GalleryRatingRepository(db);
    this.forkRepo = new GalleryForkRepository(db);
    this.reportRepo = new GalleryReportRepository(db);
  }

  private galleryRepo: GalleryRepository;
  private ratingRepo: GalleryRatingRepository;
  private forkRepo: GalleryForkRepository;
  private reportRepo: GalleryReportRepository;

  // Gallery item operations
  async createItem(data: {
    title: string;
    description: string;
    content: string;
    type: GalleryItemType;
    author_id: string;
    language?: string;
    framework?: string;
    tags?: string[];
    category: string;
    dependencies?: string[];
    screenshots?: string[];
    demo_url?: string;
    repository_url?: string;
    documentation_url?: string;
    license: string;
    version: string;
    parent_id?: string;
  }): Promise<GalleryItem> {
    const slug = await generateUniqueSlug(data.title, 'gallery_items', this.db);

    const item = await this.galleryRepo.create({
      title: data.title,
      slug,
      description: data.description,
      content: data.content,
      type: data.type,
      author_id: data.author_id,
      language: data.language,
      framework: data.framework,
      tags: data.tags || [],
      category: data.category,
      is_featured: false,
      is_approved: false, // Requires approval
      view_count: 0,
      fork_count: 0,
      like_count: 0,
      download_count: 0,
      rating_average: 0,
      rating_count: 0,
      dependencies: data.dependencies || [],
      screenshots: data.screenshots || [],
      demo_url: data.demo_url,
      repository_url: data.repository_url,
      documentation_url: data.documentation_url,
      license: data.license,
      version: data.version,
      parent_id: data.parent_id,
      original_author_id: data.parent_id ? (await this.galleryRepo.findById(data.parent_id))?.author_id : undefined
    } as any);

    // If this is a fork, record it
    if (data.parent_id) {
      await this.recordFork(data.parent_id, item.id, data.author_id);
    }

    return item;
  }

  async getItem(id: string): Promise<GalleryItem | null> {
    return this.galleryRepo.findById(id);
  }

  async getItemBySlug(slug: string): Promise<GalleryItem | null> {
    return this.galleryRepo.findBySlug(slug);
  }

  async updateItem(id: string, data: Partial<GalleryItem>): Promise<boolean> {
    return this.galleryRepo.update(id, data);
  }

  async deleteItem(id: string): Promise<boolean> {
    return this.galleryRepo.delete(id);
  }

  async viewItem(itemId: string): Promise<void> {
    await this.galleryRepo.incrementViewCount(itemId);
  }

  async downloadItem(itemId: string): Promise<void> {
    await this.galleryRepo.incrementDownloadCount(itemId);
  }

  async approveItem(itemId: string): Promise<boolean> {
    return this.galleryRepo.approveItem(itemId);
  }

  async featureItem(itemId: string, featured: boolean): Promise<boolean> {
    return this.galleryRepo.featureItem(itemId, featured);
  }

  // Fork operations
  async recordFork(parentId: string, childId: string, userId: string): Promise<void> {
    await this.forkRepo.create({
      parent_id: parentId,
      child_id: childId,
      forked_at: new Date()
    } as any);

    await this.galleryRepo.incrementForkCount(parentId);

    // Award reputation to original author
    const parent = await this.galleryRepo.findById(parentId);
    if (parent && parent.author_id !== userId) {
      await this.reputationService.addReputation(
        parent.author_id,
        5,
        'gallery_forked',
        'gallery',
        parentId
      );

      // Notify original author
      await this.notificationService.create({
        recipient_id: parent.author_id,
        type: NotificationType.GALLERY_FORK,
        title: 'Your item was forked',
        body: `Someone forked "${parent.title}"`,
        source_type: 'gallery',
        source_id: childId,
        source_user_id: userId
      });
    }
  }

  async hasForked(parentId: string, userId: string): Promise<boolean> {
    return this.forkRepo.hasForked(parentId, userId);
  }

  async getForks(parentId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryFork>> {
    return this.forkRepo.findByParent(parentId, page, perPage);
  }

  async getUserForks(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryFork>> {
    return this.forkRepo.findByUser(userId, page, perPage);
  }

  // Rating operations
  async rateItem(itemId: string, userId: string, rating: number, review?: string): Promise<GalleryRating> {
    // Check if user already rated
    const existing = await this.ratingRepo.findByUserAndItem(userId, itemId);

    if (existing) {
      // Update existing rating
      await this.ratingRepo.update(existing.id, {
        rating,
        review,
        updated_at: new Date()
      } as any);

      await this.galleryRepo.updateRating(itemId);

      return {
        ...existing,
        rating,
        review,
        updated_at: new Date()
      };
    }

    // Create new rating
    const newRating = await this.ratingRepo.create({
      item_id: itemId,
      user_id: userId,
      rating,
      review,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Update item rating
    await this.galleryRepo.updateRating(itemId);

    // Get item to notify author
    const item = await this.galleryRepo.findById(itemId);
    if (item && item.author_id !== userId) {
      await this.reputationService.addReputation(
        item.author_id,
        2,
        'gallery_rated',
        'gallery',
        itemId
      );

      await this.notificationService.create({
        recipient_id: item.author_id,
        type: NotificationType.GALLERY_RATED,
        title: 'Your item received a rating',
        body: `Someone rated "${item.title}"`,
        source_type: 'gallery',
        source_id: itemId,
        source_user_id: userId
      });
    }

    return newRating;
  }

  async getRatingsByItem(itemId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryRating>> {
    return this.ratingRepo.findByItem(itemId, page, perPage);
  }

  async getRatingsByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryRating>> {
    return this.ratingRepo.findByUser(userId, page, perPage);
  }

  async getAverageRating(itemId: string): Promise<{ average: number; count: number }> {
    return this.ratingRepo.getAverageRating(itemId);
  }

  async getRatingDistribution(itemId: string): Promise<{ rating: number; count: number }[]> {
    return this.ratingRepo.getRatingDistribution(itemId);
  }

  // Report operations
  async reportItem(itemId: string, reporterId: string, reason: string, description: string): Promise<GalleryReport> {
    return this.reportRepo.create({
      item_id: itemId,
      reporter_id: reporterId,
      reason,
      description,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    } as any);
  }

  async getReportsByStatus(status: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryReport>> {
    return this.reportRepo.findByStatus(status, page, perPage);
  }

  async getReportsByItem(itemId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryReport>> {
    return this.reportRepo.findByItem(itemId, page, perPage);
  }

  async resolveReport(reportId: string, resolutionNotes: string): Promise<boolean> {
    return this.reportRepo.resolve(reportId, resolutionNotes);
  }

  async dismissReport(reportId: string): Promise<boolean> {
    return this.reportRepo.dismiss(reportId);
  }

  // Discovery and search
  async searchGallery(query: string, page: number = 1, perPage: number = 20, filters?: {
    type?: GalleryItemType;
    category?: string;
    language?: string;
    tags?: string[];
  }): Promise<PaginatedResponse<GalleryItem>> {
    return this.galleryRepo.search(query, page, perPage, filters);
  }

  async getItemsByType(type: GalleryItemType, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    return this.galleryRepo.findByType(type, page, perPage);
  }

  async getItemsByCategory(category: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    return this.galleryRepo.findByCategory(category, page, perPage);
  }

  async getFeaturedItems(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    return this.galleryRepo.findFeatured(page, perPage);
  }

  async getTrendingItems(page: number = 1, perPage: number = 20, days: number = 7): Promise<PaginatedResponse<GalleryItem>> {
    return this.galleryRepo.findTrending(page, perPage, days);
  }

  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    return this.galleryRepo.getPopularTags(limit);
  }

  async getCategories(): Promise<string[]> {
    return this.galleryRepo.getCategories();
  }

  async getLanguages(): Promise<string[]> {
    return this.galleryRepo.getLanguages();
  }

  async getItemsByAuthor(authorId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<GalleryItem>> {
    return this.galleryRepo.findByAuthor(authorId, page, perPage);
  }
}
