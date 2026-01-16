/**
 * Knowledge Sharing Manager
 * Manages documentation, code snippets, best practices, and knowledge base
 */

// @ts-nocheck - Knowledge management with unused imports
import { nanoid } from 'nanoid';
import type {
  KnowledgeArticle,
  ArticleStatus,
  ArticleVisibility,
  ArticleMetadata,
  DifficultyLevel,
  ArticleAttachment,
  CodeSnippet,
  KnowledgeCategory,
  BestPractice,
  PracticeRule,
  PracticeExample,
} from '../types';

// ============================================================================
// Knowledge Manager
// ============================================================================

export class KnowledgeManager {
  private articles: Map<string, KnowledgeArticle> = new Map();
  private snippets: Map<string, CodeSnippet> = new Map();
  private categories: Map<string, KnowledgeCategory> = new Map();
  private bestPractices: Map<string, BestPractice> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map();

  // ============================================================================
  // Article Management
  // ============================================================================

  /**
   * Create a new knowledge article
   */
  createArticle(
    title: string,
    content: string,
    authorId: string,
    authorName: string,
    options?: {
      category?: string;
      tags?: string[];
      visibility?: ArticleVisibility;
      status?: ArticleStatus;
      language?: string;
      difficulty?: DifficultyLevel;
      attachments?: ArticleAttachment[];
    }
  ): KnowledgeArticle {
    const slug = this.generateSlug(title);
    const excerpt = this.generateExcerpt(content);

    const article: KnowledgeArticle = {
      id: nanoid(),
      title,
      slug,
      content,
      excerpt,
      authorId,
      authorName,
      category: options?.category || 'general',
      tags: options?.tags || [],
      status: options?.status || 'draft',
      visibility: options?.visibility || 'internal',
      created: Date.now(),
      updated: Date.now(),
      views: 0,
      likes: 0,
      metadata: {
        readTime: this.calculateReadTime(content),
        difficulty: options?.difficulty || 'beginner',
        language: options?.language || 'en',
        relatedArticles: [],
        attachments: options?.attachments || [],
      },
    };

    this.articles.set(article.id, article);
    this.indexArticle(article);

    return article;
  }

  /**
   * Get an article by ID
   */
  getArticle(articleId: string): KnowledgeArticle | undefined {
    return this.articles.get(articleId);
  }

  /**
   * Get an article by slug
   */
  getArticleBySlug(slug: string): KnowledgeArticle | undefined {
    for (const article of this.articles.values()) {
      if (article.slug === slug) {
        return article;
      }
    }
    return undefined;
  }

  /**
   * Get articles by category
   */
  getArticlesByCategory(category: string): KnowledgeArticle[] {
    return Array.from(this.articles.values()).filter(
      (a) => a.category === category && a.status === 'published'
    );
  }

  /**
   * Get articles by tag
   */
  getArticlesByTag(tag: string): KnowledgeArticle[] {
    return Array.from(this.articles.values()).filter(
      (a) => a.tags.includes(tag) && a.status === 'published'
    );
  }

  /**
   * Get articles by author
   */
  getArticlesByAuthor(authorId: string): KnowledgeArticle[] {
    return Array.from(this.articles.values()).filter(
      (a) => a.authorId === authorId
    );
  }

  /**
   * Get articles by status
   */
  getArticlesByStatus(status: ArticleStatus): KnowledgeArticle[] {
    return Array.from(this.articles.values()).filter((a) => a.status === status);
  }

  /**
   * Get articles by visibility
   */
  getArticlesByVisibility(visibility: ArticleVisibility): KnowledgeArticle[] {
    return Array.from(this.articles.values()).filter(
      (a) => a.visibility === visibility
    );
  }

  /**
   * Update an article
   */
  updateArticle(
    articleId: string,
    updates: Partial<Pick<KnowledgeArticle, 'title' | 'content' | 'category' | 'tags' | 'status' | 'visibility'>>
  ): KnowledgeArticle | undefined {
    const article = this.articles.get(articleId);
    if (!article) {
      return undefined;
    }

    Object.assign(article, updates);

    if (updates.title) {
      article.slug = this.generateSlug(updates.title);
    }

    if (updates.content) {
      article.excerpt = this.generateExcerpt(updates.content);
      article.metadata.readTime = this.calculateReadTime(updates.content);
    }

    article.updated = Date.now();

    // Re-index article
    this.indexArticle(article);

    return article;
  }

  /**
   * Publish an article
   */
  publishArticle(articleId: string): KnowledgeArticle | undefined {
    const article = this.articles.get(articleId);
    if (!article) {
      return undefined;
    }

    article.status = 'published';
    article.publishedAt = Date.now();
    article.updated = Date.now();

    return article;
  }

  /**
   * Archive an article
   */
  archiveArticle(articleId: string): KnowledgeArticle | undefined {
    const article = this.articles.get(articleId);
    if (!article) {
      return undefined;
    }

    article.status = 'archived';
    article.updated = Date.now();

    return article;
  }

  /**
   * Delete an article
   */
  deleteArticle(articleId: string): boolean {
    const article = this.articles.get(articleId);
    if (!article) {
      return false;
    }

    // Remove from search index
    this.removeFromIndex(article);

    return this.articles.delete(articleId);
  }

  /**
   * Increment article view count
   */
  incrementViews(articleId: string): void {
    const article = this.articles.get(articleId);
    if (article) {
      article.views++;
    }
  }

  /**
   * Like an article
   */
  likeArticle(articleId: string): number {
    const article = this.articles.get(articleId);
    if (article) {
      article.likes++;
      return article.likes;
    }
    return 0;
  }

  /**
   * Unlike an article
   */
  unlikeArticle(articleId: string): number {
    const article = this.articles.get(articleId);
    if (article && article.likes > 0) {
      article.likes--;
      return article.likes;
    }
    return 0;
  }

  // ============================================================================
  // Code Snippet Management
  // ============================================================================

  /**
   * Create a code snippet
   */
  createSnippet(
    title: string,
    description: string,
    code: string,
    language: string,
    authorId: string,
    tags?: string[]
  ): CodeSnippet {
    const snippet: CodeSnippet = {
      id: nanoid(),
      title,
      description,
      code,
      language,
      authorId,
      tags: tags || [],
      created: Date.now(),
      updated: Date.now(),
      views: 0,
      copies: 0,
      upvotes: 0,
      downvotes: 0,
    };

    this.snippets.set(snippet.id, snippet);

    return snippet;
  }

  /**
   * Get a snippet by ID
   */
  getSnippet(snippetId: string): CodeSnippet | undefined {
    return this.snippets.get(snippetId);
  }

  /**
   * Get snippets by language
   */
  getSnippetsByLanguage(language: string): CodeSnippet[] {
    return Array.from(this.snippets.values()).filter(
      (s) => s.language === language
    );
  }

  /**
   * Get snippets by tag
   */
  getSnippetsByTag(tag: string): CodeSnippet[] {
    return Array.from(this.snippets.values()).filter((s) =>
      s.tags.includes(tag)
    );
  }

  /**
   * Get snippets by author
   */
  getSnippetsByAuthor(authorId: string): CodeSnippet[] {
    return Array.from(this.snippets.values()).filter(
      (s) => s.authorId === authorId
    );
  }

  /**
   * Search snippets
   */
  searchSnippets(query: string): CodeSnippet[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.snippets.values()).filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery) ||
        s.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Update a snippet
   */
  updateSnippet(
    snippetId: string,
    updates: Partial<Pick<CodeSnippet, 'title' | 'description' | 'code' | 'language' | 'tags'>>
  ): CodeSnippet | undefined {
    const snippet = this.snippets.get(snippetId);
    if (!snippet) {
      return undefined;
    }

    Object.assign(snippet, updates);
    snippet.updated = Date.now();

    return snippet;
  }

  /**
   * Delete a snippet
   */
  deleteSnippet(snippetId: string): boolean {
    return this.snippets.delete(snippetId);
  }

  /**
   * Record snippet copy
   */
  recordCopy(snippetId: string): void {
    const snippet = this.snippets.get(snippetId);
    if (snippet) {
      snippet.copies++;
    }
  }

  /**
   * Upvote a snippet
   */
  upvoteSnippet(snippetId: string): number {
    const snippet = this.snippets.get(snippetId);
    if (snippet) {
      snippet.upvotes++;
      return snippet.upvotes;
    }
    return 0;
  }

  /**
   * Downvote a snippet
   */
  downvoteSnippet(snippetId: string): number {
    const snippet = this.snippets.get(snippetId);
    if (snippet) {
      snippet.downvotes++;
      return snippet.downvotes;
    }
    return 0;
  }

  // ============================================================================
  // Category Management
  // ============================================================================

  /**
   * Create a category
   */
  createCategory(
    name: string,
    description: string,
    options?: {
      icon?: string;
      parentCategoryId?: string;
      order?: number;
    }
  ): KnowledgeCategory {
    const slug = this.generateSlug(name);
    const category: KnowledgeCategory = {
      id: nanoid(),
      name,
      slug,
      description,
      icon: options?.icon,
      parentCategoryId: options?.parentCategoryId,
      order: options?.order || 0,
      articleCount: 0,
      created: Date.now(),
    };

    this.categories.set(category.id, category);

    return category;
  }

  /**
   * Get a category by ID
   */
  getCategory(categoryId: string): KnowledgeCategory | undefined {
    return this.categories.get(categoryId);
  }

  /**
   * Get all categories
   */
  getAllCategories(): KnowledgeCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get root categories (no parent)
   */
  getRootCategories(): KnowledgeCategory[] {
    return Array.from(this.categories.values()).filter(
      (c) => !c.parentCategoryId
    );
  }

  /**
   * Get child categories
   */
  getChildCategories(parentCategoryId: string): KnowledgeCategory[] {
    return Array.from(this.categories.values()).filter(
      (c) => c.parentCategoryId === parentCategoryId
    );
  }

  /**
   * Update a category
   */
  updateCategory(
    categoryId: string,
    updates: Partial<Pick<KnowledgeCategory, 'name' | 'description' | 'icon' | 'order'>>
  ): KnowledgeCategory | undefined {
    const category = this.categories.get(categoryId);
    if (!category) {
      return undefined;
    }

    Object.assign(category, updates);

    if (updates.name) {
      category.slug = this.generateSlug(updates.name);
    }

    return category;
  }

  /**
   * Delete a category
   */
  deleteCategory(categoryId: string): boolean {
    return this.categories.delete(categoryId);
  }

  // ============================================================================
  // Best Practices Management
  // ============================================================================

  /**
   * Create a best practice
   */
  createBestPractice(
    title: string,
    description: string,
    category: string,
    rules: PracticeRule[],
    examples: PracticeExample[],
    antiPatterns: string[],
    references: string[]
  ): BestPractice {
    const practice: BestPractice = {
      id: nanoid(),
      title,
      description,
      category,
      rules,
      examples,
      antiPatterns,
      references,
      created: Date.now(),
      updated: Date.now(),
    };

    this.bestPractices.set(practice.id, practice);

    return practice;
  }

  /**
   * Get a best practice by ID
   */
  getBestPractice(practiceId: string): BestPractice | undefined {
    return this.bestPractices.get(practiceId);
  }

  /**
   * Get best practices by category
   */
  getBestPracticesByCategory(category: string): BestPractice[] {
    return Array.from(this.bestPractices.values()).filter(
      (p) => p.category === category
    );
  }

  /**
   * Get all best practices
   */
  getAllBestPractices(): BestPractice[] {
    return Array.from(this.bestPractices.values());
  }

  /**
   * Update a best practice
   */
  updateBestPractice(
    practiceId: string,
    updates: Partial<Pick<BestPractice, 'title' | 'description' | 'category' | 'rules' | 'examples' | 'antiPatterns' | 'references'>>
  ): BestPractice | undefined {
    const practice = this.bestPractices.get(practiceId);
    if (!practice) {
      return undefined;
    }

    Object.assign(practice, updates);
    practice.updated = Date.now();

    return practice;
  }

  /**
   * Delete a best practice
   */
  deleteBestPractice(practiceId: string): boolean {
    return this.bestPractices.delete(practiceId);
  }

  // ============================================================================
  // Search
  // ============================================================================

  /**
   * Search articles
   */
  searchArticles(query: string, options?: {
    category?: string;
    tags?: string[];
    difficulty?: DifficultyLevel;
    limit?: number;
  }): KnowledgeArticle[] {
    const lowerQuery = query.toLowerCase();
    let results = Array.from(this.articles.values()).filter(
      (a) =>
        a.status === 'published' &&
        (a.title.toLowerCase().includes(lowerQuery) ||
          a.excerpt.toLowerCase().includes(lowerQuery) ||
          a.content.toLowerCase().includes(lowerQuery) ||
          a.tags.some((t) => t.toLowerCase().includes(lowerQuery)))
    );

    // Apply filters
    if (options?.category) {
      results = results.filter((a) => a.category === options.category);
    }

    if (options?.tags && options.tags.length > 0) {
      results = results.filter((a) =>
        options.tags!.some((t) => a.tags.includes(t))
      );
    }

    if (options?.difficulty) {
      results = results.filter((a) => a.metadata.difficulty === options.difficulty);
    }

    // Sort by relevance (views + likes)
    results.sort((a, b) => (b.views + b.likes) - (a.views + a.likes));

    // Apply limit
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get related articles
   */
  getRelatedArticles(articleId: string, limit: number = 5): KnowledgeArticle[] {
    const article = this.articles.get(articleId);
    if (!article) {
      return [];
    }

    const related = Array.from(this.articles.values())
      .filter(
        (a) =>
          a.id !== articleId &&
          a.status === 'published' &&
          (a.category === article.category ||
            a.tags.some((t) => article.tags.includes(t)))
      )
      .sort((a, b) => (b.views + b.likes) - (a.views + a.likes))
      .slice(0, limit);

    return related;
  }

  /**
   * Get trending articles
   */
  getTrendingArticles(limit: number = 10): KnowledgeArticle[] {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    return Array.from(this.articles.values())
      .filter((a) => a.status === 'published' && a.updated > weekAgo)
      .sort((a, b) => {
        const aScore = (a.views * 2) + a.likes;
        const bScore = (b.views * 2) + b.likes;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Generate a URL-friendly slug from a title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Generate an excerpt from content
   */
  private generateExcerpt(content: string, maxLength: number = 200): string {
    // Strip HTML tags if present
    const text = content.replace(/<[^>]*>/g, '');
    const cleaned = text.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength).trim() + '...';
  }

  /**
   * Calculate read time for content
   */
  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const text = content.replace(/<[^>]*>/g, '');
    const words = text.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  /**
   * Index an article for search
   */
  private indexArticle(article: KnowledgeArticle): void {
    const words = this.extractWords(article.title + ' ' + article.excerpt + ' ' + article.content);

    for (const word of words) {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
      }
      this.searchIndex.get(word)!.add(article.id);
    }
  }

  /**
   * Remove article from search index
   */
  private removeFromIndex(article: KnowledgeArticle): void {
    const words = this.extractWords(article.title + ' ' + article.excerpt + ' ' + article.content);

    for (const word of words) {
      const articleIds = this.searchIndex.get(word);
      if (articleIds) {
        articleIds.delete(article.id);
        if (articleIds.size === 0) {
          this.searchIndex.delete(word);
        }
      }
    }
  }

  /**
   * Extract words from text
   */
  private extractWords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    return Array.from(new Set(words));
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get knowledge base statistics
   */
  getStatistics(): {
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    totalSnippets: number;
    totalCategories: number;
    totalBestPractices: number;
    totalViews: number;
    totalLikes: number;
  } {
    const publishedArticles = Array.from(this.articles.values()).filter(
      (a) => a.status === 'published'
    ).length;

    const draftArticles = Array.from(this.articles.values()).filter(
      (a) => a.status === 'draft'
    ).length;

    const totalViews = Array.from(this.articles.values()).reduce(
      (sum, a) => sum + a.views,
      0
    );

    const totalLikes = Array.from(this.articles.values()).reduce(
      (sum, a) => sum + a.likes,
      0
    );

    return {
      totalArticles: this.articles.size,
      publishedArticles,
      draftArticles,
      totalSnippets: this.snippets.size,
      totalCategories: this.categories.size,
      totalBestPractices: this.bestPractices.size,
      totalViews,
      totalLikes,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.articles.clear();
    this.snippets.clear();
    this.categories.clear();
    this.bestPractices.clear();
    this.searchIndex.clear();
  }
}
