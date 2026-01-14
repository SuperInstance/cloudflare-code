/**
 * Q&A Service
 * Handles questions, answers, comments, and voting
 */

import { DatabaseConnection, BaseRepository } from '../utils/database';
import { generateUniqueSlug } from '../utils/database';
import {
  Question,
  Answer,
  Comment,
  Vote,
  QuestionStatus,
  UserPublicProfile,
  PaginationMeta,
  PaginatedResponse,
  QuestionView,
  Bounty
} from '../types';
import { extractMentions, NotificationType } from '../utils/helpers';

export class QuestionRepository extends BaseRepository<Question> {
  tableName = 'questions';

  async findBySlug(slug: string): Promise<Question | null> {
    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.slug = ? AND q.deleted_at IS NULL
    `;
    const question = await this.db.queryOne<any>(sql, [slug]);
    return question ? this.mapQuestionToModel(question) : null;
  }

  async findByTag(tag: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
      AND json_extract(tags, '$') LIKE ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [`%"${tag}"%`]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.deleted_at IS NULL
      AND json_extract(tags, '$') LIKE ?
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const questions = await this.db.query<any>(sql, [`%"${tag}"%`, perPage, offset]);

    return {
      data: questions.map(q => this.mapQuestionToModel(q)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByAuthor(authorId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE author_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [authorId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.author_id = ? AND q.deleted_at IS NULL
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const questions = await this.db.query<any>(sql, [authorId, perPage, offset]);

    return {
      data: questions.map(q => this.mapQuestionToModel(q)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findUnanswered(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE deleted_at IS NULL AND answer_count = 0
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.deleted_at IS NULL AND q.answer_count = 0
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const questions = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: questions.map(q => this.mapQuestionToModel(q)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findFeatured(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE deleted_at IS NULL AND is_featured = 1
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.deleted_at IS NULL AND q.is_featured = 1
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const questions = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: questions.map(q => this.mapQuestionToModel(q)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findWithBounty(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE deleted_at IS NULL AND bounty_amount IS NOT NULL
      AND bounty_expires_at > CURRENT_TIMESTAMP
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.deleted_at IS NULL
      AND q.bounty_amount IS NOT NULL
      AND q.bounty_expires_at > CURRENT_TIMESTAMP
      ORDER BY q.bounty_amount DESC, q.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const questions = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: questions.map(q => this.mapQuestionToModel(q)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findSimilar(questionId: string, limit: number = 5): Promise<Question[]> {
    const question = await this.findById(questionId);
    if (!question) return [];

    // Find similar questions based on tags and title
    const tagConditions = question.tags.map(() => '?').join(',');
    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.deleted_at IS NULL
      AND q.id != ?
      AND (
        q.title LIKE ?
        OR EXISTS (
          SELECT 1 FROM json_each(q.tags) WHERE value IN (${tagConditions})
        )
      )
      ORDER BY q.vote_count DESC
      LIMIT ?
    `;

    const titleTerm = question.title.split(/\s+/).slice(0, 3).join(' ');
    const questions = await this.db.query<any>(sql, [
      questionId,
      `%${titleTerm}%`,
      ...question.tags,
      limit
    ]);

    return questions.map(q => this.mapQuestionToModel(q));
  }

  async findDuplicates(title: string, limit: number = 5): Promise<Question[]> {
    const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const searchTerms = words.map(() => '?').join('|');

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.deleted_at IS NULL
      AND LOWER(q.title) REGEXP ?
      ORDER BY q.vote_count DESC
      LIMIT ?
    `;

    const questions = await this.db.query<any>(sql, [searchTerms, limit]);
    return questions.map(q => this.mapQuestionToModel(q));
  }

  async search(query: string, page: number = 1, perPage: number = 20, tags?: string[]): Promise<PaginatedResponse<Question>> {
    const offset = (page - 1) * perPage;
    const searchTerm = `%${query}%`;

    let whereClause = 'q.deleted_at IS NULL AND (q.title LIKE ? OR q.body LIKE ?)';
    const params: any[] = [searchTerm, searchTerm];

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => "json_extract(q.tags, '$') LIKE ?").join(' OR ');
      whereClause += ` OR (${tagConditions})`;
      params.push(...tags.map(t => `%"${t}"%`));
    }

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} q WHERE ${whereClause}`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} q
      LEFT JOIN users u ON q.author_id = u.id
      WHERE ${whereClause}
      ORDER BY q.vote_count DESC, q.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const questions = await this.db.query<any>(sql, [...params, perPage, offset]);

    return {
      data: questions.map(q => this.mapQuestionToModel(q)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async incrementViewCount(questionId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET view_count = view_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [questionId]);
  }

  async incrementAnswerCount(questionId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET answer_count = answer_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [questionId]);
  }

  async updateVoteCount(questionId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET vote_count = (
        SELECT COUNT(*) FROM votes
        WHERE target_id = ? AND target_type = 'question' AND vote_type = 'upvote'
      ) - (
        SELECT COUNT(*) FROM votes
        WHERE target_id = ? AND target_type = 'question' AND vote_type = 'downvote'
      )
      WHERE id = ?
    `;
    await this.db.execute(sql, [questionId, questionId, questionId]);
  }

  async setAcceptedAnswer(questionId: string, answerId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET accepted_answer_id = ?,
          status = 'answered'
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [answerId, questionId]);
    return result.rowsAffected > 0;
  }

  async clearAcceptedAnswer(questionId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET accepted_answer_id = NULL
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [questionId]);
    return result.rowsAffected > 0;
  }

  async recordView(questionId: string, userId?: string, ipAddress?: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO question_views (question_id, user_id, ip_address, viewed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [questionId, userId || null, ipAddress || null]);
  }

  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const sql = `
      SELECT json_each.value as tag, COUNT(*) as count
      FROM ${this.tableName},
           json_each(tags)
      WHERE deleted_at IS NULL
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ?
    `;
    return this.db.query<{ tag: string; count: number }>(sql, [limit]);
  }

  private mapQuestionToModel(question: any): Question {
    return {
      id: question.id,
      title: question.title,
      slug: question.slug,
      body: question.body,
      author_id: question.author_id,
      author: question.username ? {
        id: question.author_id,
        username: question.username,
        display_name: question.display_name,
        avatar_url: question.avatar_url
      } : undefined,
      tags: question.tags ? JSON.parse(question.tags) : [],
      category: question.category,
      view_count: question.view_count || 0,
      vote_count: question.vote_count || 0,
      answer_count: question.answer_count || 0,
      favorite_count: question.favorite_count || 0,
      status: question.status,
      accepted_answer_id: question.accepted_answer_id,
      bounty: question.bounty_amount ? {
        amount: question.bounty_amount,
        expires_at: question.bounty_expires_at,
        awarded_to: question.bounty_awarded_to,
        awarded_at: question.bounty_awarded_at
      } : undefined,
      duplicates: question.duplicates ? JSON.parse(question.duplicates) : [],
      related_questions: question.related_questions ? JSON.parse(question.related_questions) : [],
      last_activity_at: question.last_activity_at,
      is_featured: question.is_featured === 1,
      created_at: question.created_at,
      updated_at: question.updated_at
    };
  }
}

export class AnswerRepository extends BaseRepository<Answer> {
  tableName = 'answers';

  async findByQuestion(questionId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Answer>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE question_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [questionId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT a.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.question_id = ? AND a.deleted_at IS NULL
      ORDER BY a.is_accepted DESC, a.vote_count DESC, a.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const answers = await this.db.query<any>(sql, [questionId, perPage, offset]);

    return {
      data: answers.map(a => this.mapAnswerToModel(a)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByAuthor(authorId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Answer>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE author_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [authorId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT a.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.author_id = ? AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const answers = await this.db.query<any>(sql, [authorId, perPage, offset]);

    return {
      data: answers.map(a => this.mapAnswerToModel(a)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async updateVoteCount(answerId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET vote_count = (
        SELECT COUNT(*) FROM votes
        WHERE target_id = ? AND target_type = 'answer' AND vote_type = 'upvote'
      ) - (
        SELECT COUNT(*) FROM votes
        WHERE target_id = ? AND target_type = 'answer' AND vote_type = 'downvote'
      )
      WHERE id = ?
    `;
    await this.db.execute(sql, [answerId, answerId, answerId]);
  }

  async acceptAnswer(answerId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET is_accepted = 1
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [answerId]);
    return result.rowsAffected > 0;
  }

  async unacceptAnswer(answerId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET is_accepted = 0
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [answerId]);
    return result.rowsAffected > 0;
  }

  async incrementCommentCount(answerId: string): Promise<void> {
    const sql = `UPDATE ${this.tableName} SET comment_count = comment_count + 1 WHERE id = ?`;
    await this.db.execute(sql, [answerId]);
  }

  private mapAnswerToModel(answer: any): Answer {
    return {
      id: answer.id,
      question_id: answer.question_id,
      body: answer.body,
      author_id: answer.author_id,
      author: answer.username ? {
        id: answer.author_id,
        username: answer.username,
        display_name: answer.display_name,
        avatar_url: answer.avatar_url
      } : undefined,
      is_accepted: answer.is_accepted === 1,
      vote_count: answer.vote_count || 0,
      comment_count: answer.comment_count || 0,
      edits: answer.edits || 0,
      edited_at: answer.edited_at,
      created_at: answer.created_at,
      updated_at: answer.updated_at
    };
  }
}

export class CommentRepository extends BaseRepository<Comment> {
  tableName = 'comments';

  async findByQuestion(questionId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Comment>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE parent_type = 'question' AND parent_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [questionId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.parent_type = 'question' AND c.parent_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const comments = await this.db.query<any>(sql, [questionId, perPage, offset]);

    return {
      data: comments.map(c => this.mapCommentToModel(c)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByAnswer(answerId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Comment>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE parent_type = 'answer' AND parent_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [answerId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.parent_type = 'answer' AND c.parent_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const comments = await this.db.query<any>(sql, [answerId, perPage, offset]);

    return {
      data: comments.map(c => this.mapCommentToModel(c)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async updateVoteCount(commentId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET vote_count = (
        SELECT COUNT(*) FROM votes
        WHERE target_id = ? AND target_type = 'comment' AND vote_type = 'upvote'
      ) - (
        SELECT COUNT(*) FROM votes
        WHERE target_id = ? AND target_type = 'comment' AND vote_type = 'downvote'
      )
      WHERE id = ?
    `;
    await this.db.execute(sql, [commentId, commentId, commentId]);
  }

  private mapCommentToModel(comment: any): Comment {
    return {
      id: comment.id,
      parent_type: comment.parent_type,
      parent_id: comment.parent_id,
      content: comment.content,
      author_id: comment.author_id,
      author: comment.username ? {
        id: comment.author_id,
        username: comment.username,
        display_name: comment.display_name,
        avatar_url: comment.avatar_url
      } : undefined,
      vote_count: comment.vote_count || 0,
      edits: comment.edits || 0,
      edited_at: comment.edited_at,
      created_at: comment.created_at,
      updated_at: comment.updated_at
    };
  }
}

export class VoteRepository extends BaseRepository<Vote> {
  tableName = 'votes';

  async findByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Vote>> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE user_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const votes = await this.db.query<Vote>(sql, [userId, perPage, offset]);

    return {
      data: votes,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByTarget(targetType: string, targetId: string): Promise<Vote[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE target_type = ? AND target_id = ?
      ORDER BY created_at DESC
    `;
    return this.db.query<Vote>(sql, [targetType, targetId]);
  }

  async findUserVoteOnTarget(userId: string, targetType: string, targetId: string): Promise<Vote | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ? AND target_type = ? AND target_id = ?
      LIMIT 1
    `;
    return this.db.queryOne<Vote>(sql, [userId, targetType, targetId]);
  }

  async getUserVoteSummary(userId: string): Promise<{
    upvotes_given: number;
    downvotes_given: number;
    upvotes_received: number;
    downvotes_received: number;
  }> {
    const sql = `
      SELECT
        SUM(CASE WHEN vote_type = 'upvote' THEN 1 ELSE 0 END) as upvotes_given,
        SUM(CASE WHEN vote_type = 'downvote' THEN 1 ELSE 0 END) as downvotes_given
      FROM ${this.tableName}
      WHERE user_id = ?
    `;
    const given = await this.db.queryOne<any>(sql, [userId]);

    const receivedSql = `
      SELECT
        SUM(CASE WHEN v.vote_type = 'upvote' THEN 1 ELSE 0 END) as upvotes_received,
        SUM(CASE WHEN v.vote_type = 'downvote' THEN 1 ELSE 0 END) as downvotes_received
      FROM ${this.tableName} v
      JOIN questions q ON v.target_id = q.id AND v.target_type = 'question'
      JOIN answers a ON v.target_id = a.id AND v.target_type = 'answer'
      WHERE q.author_id = ? OR a.author_id = ?
    `;
    const received = await this.db.queryOne<any>(receivedSql, [userId, userId]);

    return {
      upvotes_given: given.upvotes_given || 0,
      downvotes_given: given.downvotes_given || 0,
      upvotes_received: received.upvotes_received || 0,
      downvotes_received: received.downvotes_received || 0
    };
  }
}

export class QAService {
  constructor(
    private db: DatabaseConnection,
    private notificationService: any,
    private reputationService: any
  ) {
    this.questionRepo = new QuestionRepository(db);
    this.answerRepo = new AnswerRepository(db);
    this.commentRepo = new CommentRepository(db);
    this.voteRepo = new VoteRepository(db);
  }

  private questionRepo: QuestionRepository;
  private answerRepo: AnswerRepository;
  private commentRepo: CommentRepository;
  private voteRepo: VoteRepository;

  // Question operations
  async createQuestion(data: {
    title: string;
    body: string;
    author_id: string;
    tags?: string[];
    category?: string;
    bounty?: { amount: number; expires_at: Date };
  }): Promise<Question> {
    const slug = await generateUniqueSlug(data.title, 'questions', this.db);

    const question = await this.questionRepo.create({
      title: data.title,
      slug,
      body: data.body,
      author_id: data.author_id,
      tags: data.tags || [],
      category: data.category,
      view_count: 0,
      vote_count: 0,
      answer_count: 0,
      favorite_count: 0,
      status: QuestionStatus.OPEN,
      duplicates: [],
      related_questions: [],
      last_activity_at: new Date(),
      is_featured: false,
      bounty_amount: data.bounty?.amount,
      bounty_expires_at: data.bounty?.expires_at
    } as any);

    // Check for similar/duplicate questions
    const similar = await this.questionRepo.findDuplicates(data.title, 5);
    if (similar.length > 0) {
      await this.questionRepo.update(question.id, {
        related_questions: similar.map(q => q.id)
      } as any);
    }

    // Notify tagged users
    const mentions = extractMentions(data.body);
    for (const username of mentions) {
      // Find user and create notification
    }

    return question;
  }

  async getQuestion(id: string): Promise<Question | null> {
    return this.questionRepo.findById(id);
  }

  async getQuestionBySlug(slug: string): Promise<Question | null> {
    return this.questionRepo.findBySlug(slug);
  }

  async getQuestionWithAnswers(questionId: string, page: number = 1, perPage: number = 20) {
    const question = await this.questionRepo.findById(questionId);
    if (!question) return null;

    const answers = await this.answerRepo.findByQuestion(questionId, page, perPage);

    return {
      question,
      answers
    };
  }

  async updateQuestion(id: string, data: Partial<Question>): Promise<boolean> {
    return this.questionRepo.update(id, data);
  }

  async deleteQuestion(id: string): Promise<boolean> {
    return this.questionRepo.delete(id);
  }

  async recordQuestionView(questionId: string, userId?: string, ipAddress?: string): Promise<void> {
    await this.questionRepo.recordView(questionId, userId, ipAddress);
    await this.questionRepo.incrementViewCount(questionId);
  }

  // Answer operations
  async createAnswer(data: {
    question_id: string;
    body: string;
    author_id: string;
  }): Promise<Answer> {
    const answer = await this.answerRepo.create({
      ...data,
      is_accepted: false,
      vote_count: 0,
      comment_count: 0,
      edits: 0
    } as any);

    // Update question
    await this.questionRepo.incrementAnswerCount(data.question_id);
    await this.questionRepo.update(data.question_id, {
      last_activity_at: new Date()
    } as any);

    // Get question to notify author
    const question = await this.questionRepo.findById(data.question_id);
    if (question && question.author_id !== data.author_id) {
      await this.notificationService.create({
        recipient_id: question.author_id,
        type: NotificationType.QUESTION_ANSWERED,
        title: 'Your question has an answer',
        body: `Someone answered "${question.title}"`,
        source_type: 'answer',
        source_id: answer.id,
        source_user_id: data.author_id
      });
    }

    // Check for mentions
    const mentions = extractMentions(data.body);
    for (const username of mentions) {
      // Find user and create notification
    }

    return answer;
  }

  async getAnswer(id: string): Promise<Answer | null> {
    return this.answerRepo.findById(id);
  }

  async updateAnswer(id: string, data: Partial<Answer>): Promise<boolean> {
    const updated = await this.answerRepo.update(id, { ...data, edits: 1 } as any);
    if (updated) {
      const answer = await this.answerRepo.findById(id);
      if (answer) {
        await this.answerRepo.update(id, {
          edited_at: new Date()
        } as any);
      }
    }
    return updated;
  }

  async deleteAnswer(id: string): Promise<boolean> {
    return this.answerRepo.delete(id);
  }

  async acceptAnswer(answerId: string, questionId: string, userId: string): Promise<boolean> {
    // Verify user owns the question
    const question = await this.questionRepo.findById(questionId);
    if (!question || question.author_id !== userId) {
      throw new Error('Not authorized to accept this answer');
    }

    // Clear previous accepted answer
    if (question.accepted_answer_id) {
      await this.answerRepo.unacceptAnswer(question.accepted_answer_id);
    }

    // Accept new answer
    await this.answerRepo.acceptAnswer(answerId);
    await this.questionRepo.setAcceptedAnswer(questionId, answerId);

    // Award reputation to answer author
    const answer = await this.answerRepo.findById(answerId);
    if (answer) {
      await this.reputationService.addReputation(
        answer.author_id,
        25,
        'answer_accepted',
        'answer',
        answerId
      );

      // Notify answer author
      await this.notificationService.create({
        recipient_id: answer.author_id,
        type: NotificationType.ANSWER_ACCEPTED,
        title: 'Your answer was accepted',
        body: `Your answer to "${question.title}" was accepted`,
        source_type: 'answer',
        source_id: answerId,
        source_user_id: userId
      });
    }

    return true;
  }

  // Comment operations
  async createComment(data: {
    parent_type: 'question' | 'answer';
    parent_id: string;
    content: string;
    author_id: string;
  }): Promise<Comment> {
    const comment = await this.commentRepo.create({
      ...data,
      vote_count: 0,
      edits: 0
    } as any);

    // Update parent comment count
    if (data.parent_type === 'answer') {
      await this.answerRepo.incrementCommentCount(data.parent_id);
    }

    // Get parent to notify author
    let parentAuthorId: string | undefined;
    if (data.parent_type === 'question') {
      const question = await this.questionRepo.findById(data.parent_id);
      parentAuthorId = question?.author_id;
    } else {
      const answer = await this.answerRepo.findById(data.parent_id);
      parentAuthorId = answer?.author_id;
    }

    if (parentAuthorId && parentAuthorId !== data.author_id) {
      await this.notificationService.create({
        recipient_id: parentAuthorId,
        type: NotificationType.COMMENT_REPLY,
        title: 'New comment on your content',
        body: data.content.substring(0, 100),
        source_type: 'comment',
        source_id: comment.id,
        source_user_id: data.author_id
      });
    }

    // Check for mentions
    const mentions = extractMentions(data.content);
    for (const username of mentions) {
      // Find user and create notification
    }

    return comment;
  }

  async getComment(id: string): Promise<Comment | null> {
    return this.commentRepo.findById(id);
  }

  async updateComment(id: string, content: string): Promise<boolean> {
    return this.commentRepo.update(id, {
      content,
      edited_at: new Date()
    } as any);
  }

  async deleteComment(id: string): Promise<boolean> {
    return this.commentRepo.delete(id);
  }

  // Voting operations
  async vote(userId: string, targetType: 'question' | 'answer' | 'comment', targetId: string, voteType: 'upvote' | 'downvote'): Promise<void> {
    // Check if user already voted
    const existingVote = await this.voteRepo.findUserVoteOnTarget(userId, targetType, targetId);

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote (toggle)
        await this.voteRepo.delete(existingVote.id);
      } else {
        // Change vote type
        await this.voteRepo.update(existingVote.id, { vote_type: voteType } as any);
      }
    } else {
      // Create new vote
      await this.voteRepo.create({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        vote_type: voteType
      } as any);
    }

    // Update vote counts
    if (targetType === 'question') {
      await this.questionRepo.updateVoteCount(targetId);
    } else if (targetType === 'answer') {
      await this.answerRepo.updateVoteCount(targetId);
    } else {
      await this.commentRepo.updateVoteCount(targetId);
    }

    // Award reputation
    const reputationChange = voteType === 'upvote' ? 10 : -2;
    const reason = targetType === 'question' ? 'question_upvoted' : 'answer_upvoted';

    if (voteType === 'upvote') {
      let targetAuthorId: string | undefined;
      if (targetType === 'question') {
        const question = await this.questionRepo.findById(targetId);
        targetAuthorId = question?.author_id;
      } else if (targetType === 'answer') {
        const answer = await this.answerRepo.findById(targetId);
        targetAuthorId = answer?.author_id;
      }

      if (targetAuthorId && targetAuthorId !== userId) {
        await this.reputationService.addReputation(
          targetAuthorId,
          reputationChange,
          reason,
          targetType,
          targetId
        );

        // Notify the author
        await this.notificationService.create({
          recipient_id: targetAuthorId,
          type: targetType === 'question' ? NotificationType.QUESTION_UPVOTED : NotificationType.ANSWER_UPVOTED,
          title: 'Your post was upvoted',
          body: 'Your post received an upvote',
          source_type: targetType,
          source_id: targetId,
          source_user_id: userId
        });
      }
    }
  }

  async getVotesByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Vote>> {
    return this.voteRepo.findByUser(userId, page, perPage);
  }

  // Search and discovery
  async searchQuestions(query: string, page: number = 1, perPage: number = 20, tags?: string[]): Promise<PaginatedResponse<Question>> {
    return this.questionRepo.search(query, page, perPage, tags);
  }

  async getQuestionsByTag(tag: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    return this.questionRepo.findByTag(tag, page, perPage);
  }

  async getUnansweredQuestions(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    return this.questionRepo.findUnanswered(page, perPage);
  }

  async getFeaturedQuestions(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    return this.questionRepo.findFeatured(page, perPage);
  }

  async getQuestionsWithBounty(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Question>> {
    return this.questionRepo.findWithBounty(page, perPage);
  }

  async getSimilarQuestions(questionId: string, limit: number = 5): Promise<Question[]> {
    return this.questionRepo.findSimilar(questionId, limit);
  }

  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    return this.questionRepo.getPopularTags(limit);
  }
}
