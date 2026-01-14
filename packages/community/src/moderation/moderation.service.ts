/**
 * Moderation Service
 * Handles content moderation, reports, and auto-moderation
 */

import { DatabaseConnection, BaseRepository } from '../utils/database';
import {
  Report,
  ReportReason,
  ReportStatus,
  ReportPriority,
  ModerationAction,
  ModerationActionType,
  SpamDetection,
  AutoModerationRule,
  ModerationLog,
  User
} from '../types';
import { calculateSpamScore, getReportPriority, shouldAutoModerate } from '../utils/helpers';

export class ReportRepository extends BaseRepository<Report> {
  tableName = 'reports';

  async findByStatus(status: ReportStatus, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [status]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url as reporter_avatar,
             m.username as moderator_username, m.display_name as moderator_name
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.reporter_id = u.id
      LEFT JOIN users m ON r.assigned_to = m.id
      WHERE r.status = ?
      ORDER BY r.priority DESC, r.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const reports = await this.db.query<any>(sql, [status, perPage, offset]);

    return {
      data: reports.map(r => this.mapReportToModel(r)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByTarget(targetType: string, targetId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE target_type = ? AND target_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [targetType, targetId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url as reporter_avatar
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.target_type = ? AND r.target_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const reports = await this.db.query<any>(sql, [targetType, targetId, perPage, offset]);

    return {
      data: reports.map(r => this.mapReportToModel(r)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByReporter(reporterId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE reporter_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [reporterId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE reporter_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const reports = await this.db.query<Report>(sql, [reporterId, perPage, offset]);

    return {
      data: reports,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByAssignedModerator(moderatorId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE assigned_to = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [moderatorId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url as reporter_avatar
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.assigned_to = ?
      ORDER BY r.created_at ASC
      LIMIT ? OFFSET ?
    `;
    const reports = await this.db.query<any>(sql, [moderatorId, perPage, offset]);

    return {
      data: reports.map(r => this.mapReportToModel(r)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async updateStatus(reportId: string, status: ReportStatus): Promise<boolean> {
    const updates: any = { status };
    if (status === ReportStatus.RESOLVED || status === ReportStatus.DISMISSED) {
      updates.resolved_at = new Date();
    }
    return this.update(reportId, updates);
  }

  async assignModerator(reportId: string, moderatorId: string): Promise<boolean> {
    return this.update(reportId, {
      assigned_to: moderatorId,
      status: ReportStatus.INVESTIGATING
    } as any);
  }

  async resolve(reportId: string, resolutionNotes: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'resolved',
          resolution_notes = ?,
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [resolutionNotes, reportId]);
    return result.rowsAffected > 0;
  }

  async dismiss(reportId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'dismissed',
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [reportId]);
    return result.rowsAffected > 0;
  }

  async escalate(reportId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'escalated',
          priority = 'urgent',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [reportId]);
    return result.rowsAffected > 0;
  }

  async getReportStats(): Promise<{
    total: number;
    pending: number;
    investigating: number;
    resolved: number;
    dismissed: number;
    escalated: number;
  }> {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) as investigating,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated
      FROM ${this.tableName}
    `;
    const result = await this.db.queryOne<any>(sql);
    return result;
  }

  private mapReportToModel(report: any): Report {
    return {
      id: report.id,
      reporter_id: report.reporter_id,
      reporter: report.username ? {
        id: report.reporter_id,
        username: report.username,
        display_name: report.display_name,
        avatar_url: report.reporter_avatar
      } : undefined,
      target_type: report.target_type,
      target_id: report.target_id,
      reason: report.reason,
      description: report.description,
      status: report.status,
      assigned_to: report.assigned_to,
      assigned_moderator: report.moderator_username ? {
        id: report.assigned_to,
        username: report.moderator_username,
        display_name: report.moderator_name
      } : undefined,
      resolution_notes: report.resolution_notes,
      resolved_at: report.resolved_at,
      priority: report.priority,
      evidence: report.evidence ? JSON.parse(report.evidence) : [],
      created_at: report.created_at,
      updated_at: report.updated_at
    };
  }
}

export class ModerationActionRepository extends BaseRepository<ModerationAction> {
  tableName = 'moderation_actions';

  async findByTargetUser(userId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE target_user_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT ma.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} ma
      LEFT JOIN users u ON ma.performed_by = u.id
      WHERE ma.target_user_id = ?
      ORDER BY ma.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const actions = await this.db.query<any>(sql, [userId, perPage, offset]);

    return {
      data: actions.map(a => ({
        ...a,
        performed_by_user: a.username ? {
          id: a.performed_by,
          username: a.username,
          display_name: a.display_name,
          avatar_url: a.avatar_url
        } : undefined
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByModerator(moderatorId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE performed_by = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [moderatorId]);
    const total = countResult?.count || 0;

    const sql = `SELECT * FROM ${this.tableName} WHERE performed_by = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const actions = await this.db.query<ModerationAction>(sql, [moderatorId, perPage, offset]);

    return {
      data: actions,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findActiveActions(targetUserId?: string): Promise<ModerationAction[]> {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE (permanent = 1 OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params: any[] = [];

    if (targetUserId) {
      sql += ' AND target_user_id = ?';
      params.push(targetUserId);
    }

    sql += ' ORDER BY created_at DESC';

    return this.db.query<ModerationAction>(sql, params);
  }

  async isUserMuted(userId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.tableName}
      WHERE target_user_id = ?
      AND action_type = 'mute'
      AND (permanent = 1 OR expires_at > CURRENT_TIMESTAMP)
      LIMIT 1
    `;
    const result = await this.db.queryOne(sql, [userId]);
    return result !== null;
  }

  async isUserBanned(userId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.tableName}
      WHERE target_user_id = ?
      AND action_type = 'ban'
      AND (permanent = 1 OR expires_at > CURRENT_TIMESTAMP)
      LIMIT 1
    `;
    const result = await this.db.queryOne(sql, [userId]);
    return result !== null;
  }

  async expireOldActions(): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'expired'
      WHERE permanent = 0
      AND expires_at <= CURRENT_TIMESTAMP
      AND status != 'expired'
    `;
    await this.db.execute(sql);
  }
}

export class ModerationLogRepository extends BaseRepository<ModerationLog> {
  tableName = 'moderation_logs';

  async findByModerator(moderatorId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE moderator_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [moderatorId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE moderator_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const logs = await this.db.query<ModerationLog>(sql, [moderatorId, perPage, offset]);

    return {
      data: logs,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByTarget(targetType: string, targetId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE target_type = ? AND target_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [targetType, targetId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE target_type = ? AND target_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const logs = await this.db.query<ModerationLog>(sql, [targetType, targetId, perPage, offset]);

    return {
      data: logs,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }
}

export class AutoModerationRuleRepository extends BaseRepository<AutoModerationRule> {
  tableName = 'auto_moderation_rules';

  async findEnabled(): Promise<AutoModerationRule[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE enabled = 1
      ORDER BY priority DESC
    `;
    return this.db.query<AutoModerationRule>(sql);
  }

  async findByPriority(minPriority: number = 0): Promise<AutoModerationRule[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE enabled = 1 AND priority >= ?
      ORDER BY priority DESC
    `;
    return this.db.query<AutoModerationRule>(sql, [minPriority]);
  }

  async toggleRule(ruleId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET enabled = NOT enabled,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [ruleId]);
    return result.rowsAffected > 0;
  }
}

export class SpamDetectionRepository extends BaseRepository<SpamDetection> {
  tableName = 'spam_detections';

  async findByContent(contentType: string, contentId: string): Promise<SpamDetection | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE content_type = ? AND content_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return this.db.queryOne<SpamDetection>(sql, [contentType, contentId]);
  }

  async createDetection(detection: Omit<SpamDetection, 'id' | 'created_at' | 'reviewed' | 'reviewed_by' | 'reviewed_at'>): Promise<SpamDetection> {
    return this.create({
      ...detection,
      reviewed: false,
      created_at: new Date()
    } as any);
  }

  async markAsReviewed(detectionId: string, reviewedBy: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET reviewed = 1,
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [reviewedBy, detectionId]);
    return result.rowsAffected > 0;
  }

  async findUnreviewed(limit: number = 50): Promise<SpamDetection[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE reviewed = 0
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return this.db.query<SpamDetection>(sql, [limit]);
  }

  async getSpamStats(): Promise<{
    total: number;
    spam: number;
    notSpam: number;
    pending: number;
  }> {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_spam = 1 THEN 1 ELSE 0 END) as spam,
        SUM(CASE WHEN is_spam = 0 THEN 1 ELSE 0 END) as not_spam,
        SUM(CASE WHEN reviewed = 0 THEN 1 ELSE 0 END) as pending
      FROM ${this.tableName}
    `;
    const result = await this.db.queryOne<any>(sql);
    return result;
  }
}

export class ModerationService {
  constructor(
    private db: DatabaseConnection,
    private notificationService: any
  ) {
    this.reportRepo = new ReportRepository(db);
    this.actionRepo = new ModerationActionRepository(db);
    this.logRepo = new ModerationLogRepository(db);
    this.autoRuleRepo = new AutoModerationRuleRepository(db);
    this.spamRepo = new SpamDetectionRepository(db);
  }

  private reportRepo: ReportRepository;
  private actionRepo: ModerationActionRepository;
  private logRepo: ModerationLogRepository;
  private autoRuleRepo: AutoModerationRuleRepository;
  private spamRepo: SpamDetectionRepository;

  // Report operations
  async createReport(data: {
    reporter_id: string;
    target_type: string;
    target_id: string;
    reason: ReportReason;
    description: string;
    evidence?: string[];
  }): Promise<Report> {
    const priority = getReportPriority(data.reason);

    const report = await this.reportRepo.create({
      ...data,
      status: ReportStatus.PENDING,
      priority,
      evidence: data.evidence || [],
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Auto-moderate if needed
    if (shouldAutoModerate(report)) {
      await this.autoModerateReport(report);
    }

    return report;
  }

  async getReport(id: string): Promise<Report | null> {
    return this.reportRepo.findById(id);
  }

  async getReportsByStatus(status: ReportStatus, page: number = 1, perPage: number = 20) {
    return this.reportRepo.findByStatus(status, page, perPage);
  }

  async getReportsByTarget(targetType: string, targetId: string, page: number = 1, perPage: number = 20) {
    return this.reportRepo.findByTarget(targetType, targetId, page, perPage);
  }

  async getReportsByModerator(moderatorId: string, page: number = 1, perPage: number = 20) {
    return this.reportRepo.findByAssignedModerator(moderatorId, page, perPage);
  }

  async assignReport(reportId: string, moderatorId: string): Promise<boolean> {
    const result = await this.reportRepo.assignModerator(reportId, moderatorId);

    // Log the assignment
    await this.logAction(moderatorId, 'assign_report', 'report', reportId, {
      assigned_to: moderatorId
    });

    return result;
  }

  async resolveReport(reportId: string, resolutionNotes: string, moderatorId: string): Promise<boolean> {
    const result = await this.reportRepo.resolve(reportId, resolutionNotes);

    // Log the resolution
    await this.logAction(moderatorId, 'resolve_report', 'report', reportId, {
      resolution_notes: resolutionNotes
    });

    return result;
  }

  async dismissReport(reportId: string, moderatorId: string): Promise<boolean> {
    const result = await this.reportRepo.dismiss(reportId);

    // Log the dismissal
    await this.logAction(moderatorId, 'dismiss_report', 'report', reportId);

    return result;
  }

  async escalateReport(reportId: string): Promise<boolean> {
    return this.reportRepo.escalate(reportId);
  }

  async getReportStats() {
    return this.reportRepo.getReportStats();
  }

  // Moderation actions
  async warnUser(targetUserId: string, reason: string, performedBy: string): Promise<ModerationAction> {
    const action = await this.actionRepo.create({
      target_user_id: targetUserId,
      target_type: 'user',
      target_id: targetUserId,
      action_type: ModerationActionType.WARN,
      reason,
      performed_by: performedBy,
      permanent: false,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'warn_user', 'user', targetUserId, { reason });

    // Notify user
    await this.notificationService.create({
      recipient_id: targetUserId,
      type: 'moderation_warning',
      title: 'You have received a warning',
      body: reason,
      source_type: 'moderation',
      source_id: action.id
    });

    return action;
  }

  async muteUser(targetUserId: string, reason: string, performedBy: string, duration?: number, permanent: boolean = false): Promise<ModerationAction> {
    const expiresAt = duration ? new Date(Date.now() + duration * 1000) : undefined;

    const action = await this.actionRepo.create({
      target_user_id: targetUserId,
      target_type: 'user',
      target_id: targetUserId,
      action_type: ModerationActionType.MUTE,
      reason,
      performed_by: performedBy,
      duration,
      permanent,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'mute_user', 'user', targetUserId, {
      reason,
      duration,
      permanent
    });

    // Notify user
    await this.notificationService.create({
      recipient_id: targetUserId,
      type: 'moderation_mute',
      title: 'You have been muted',
      body: `${reason}${permanent ? ' permanently' : ` for ${duration} seconds`}`,
      source_type: 'moderation',
      source_id: action.id
    });

    return action;
  }

  async suspendUser(targetUserId: string, reason: string, performedBy: string, duration?: number, permanent: boolean = false): Promise<ModerationAction> {
    const expiresAt = duration ? new Date(Date.now() + duration * 1000) : undefined;

    const action = await this.actionRepo.create({
      target_user_id: targetUserId,
      target_type: 'user',
      target_id: targetUserId,
      action_type: ModerationActionType.SUSPEND,
      reason,
      performed_by: performedBy,
      duration,
      permanent,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'suspend_user', 'user', targetUserId, {
      reason,
      duration,
      permanent
    });

    // Notify user
    await this.notificationService.create({
      recipient_id: targetUserId,
      type: 'moderation_suspend',
      title: 'Your account has been suspended',
      body: `${reason}${permanent ? ' permanently' : ` for ${duration} seconds`}`,
      source_type: 'moderation',
      source_id: action.id
    });

    return action;
  }

  async banUser(targetUserId: string, reason: string, performedBy: string, duration?: number, permanent: boolean = false): Promise<ModerationAction> {
    const expiresAt = duration ? new Date(Date.now() + duration * 1000) : undefined;

    const action = await this.actionRepo.create({
      target_user_id: targetUserId,
      target_type: 'user',
      target_id: targetUserId,
      action_type: ModerationActionType.BAN,
      reason,
      performed_by: performedBy,
      duration,
      permanent,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'ban_user', 'user', targetUserId, {
      reason,
      duration,
      permanent
    });

    // Notify user
    await this.notificationService.create({
      recipient_id: targetUserId,
      type: 'moderation_ban',
      title: 'Your account has been banned',
      body: `${reason}${permanent ? ' permanently' : ` for ${duration} seconds`}`,
      source_type: 'moderation',
      source_id: action.id
    });

    return action;
  }

  async removeContent(targetType: string, targetId: string, reason: string, performedBy: string): Promise<ModerationAction> {
    const action = await this.actionRepo.create({
      target_type: 'content',
      target_id: targetId,
      action_type: ModerationActionType.CONTENT_REMOVE,
      reason,
      performed_by: performedBy,
      permanent: true,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'remove_content', targetType, targetId, { reason });

    return action;
  }

  async hideContent(targetType: string, targetId: string, reason: string, performedBy: string): Promise<ModerationAction> {
    const action = await this.actionRepo.create({
      target_type: 'content',
      target_id: targetId,
      action_type: ModerationActionType.CONTENT_HIDE,
      reason,
      performed_by: performedBy,
      permanent: false,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'hide_content', targetType, targetId, { reason });

    return action;
  }

  async lockContent(targetType: string, targetId: string, reason: string, performedBy: string): Promise<ModerationAction> {
    const action = await this.actionRepo.create({
      target_type: 'content',
      target_id: targetId,
      action_type: ModerationActionType.CONTENT_LOCK,
      reason,
      performed_by: performedBy,
      permanent: false,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'lock_content', targetType, targetId, { reason });

    return action;
  }

  async featureContent(targetType: string, targetId: string, performedBy: string): Promise<ModerationAction> {
    const action = await this.actionRepo.create({
      target_type: 'content',
      target_id: targetId,
      action_type: ModerationActionType.CONTENT_FEATURE,
      reason: 'Featured by moderator',
      performed_by: performedBy,
      permanent: false,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Log the action
    await this.logAction(performedBy, 'feature_content', targetType, targetId);

    return action;
  }

  async getUserActions(userId: string, page: number = 1, perPage: number = 20) {
    return this.actionRepo.findByTargetUser(userId, page, perPage);
  }

  async getModeratorActions(moderatorId: string, page: number = 1, perPage: number = 20) {
    return this.actionRepo.findByModerator(moderatorId, page, perPage);
  }

  async getActiveActions(userId?: string): Promise<ModerationAction[]> {
    return this.actionRepo.findActiveActions(userId);
  }

  async isUserMuted(userId: string): Promise<boolean> {
    return this.actionRepo.isUserMuted(userId);
  }

  async isUserBanned(userId: string): Promise<boolean> {
    return this.actionRepo.isUserBanned(userId);
  }

  async expireOldActions(): Promise<void> {
    return this.actionRepo.expireOldActions();
  }

  // Logging
  async logAction(moderatorId: string, action: string, targetType: string, targetId: string, details?: any): Promise<void> {
    await this.logRepo.create({
      action,
      moderator_id: moderatorId,
      target_type: targetType,
      target_id: targetId,
      details: details || {},
      created_at: new Date()
    } as any);
  }

  async getModeratorLogs(moderatorId: string, page: number = 1, perPage: number = 20) {
    return this.logRepo.findByModerator(moderatorId, page, perPage);
  }

  async getTargetLogs(targetType: string, targetId: string, page: number = 1, perPage: number = 20) {
    return this.logRepo.findByTarget(targetType, targetId, page, perPage);
  }

  // Auto-moderation
  async createAutoModerationRule(data: {
    name: string;
    description?: string;
    conditions: any[];
    actions: any[];
    priority: number;
    created_by: string;
  }): Promise<AutoModerationRule> {
    return this.autoRuleRepo.create({
      ...data,
      enabled: true,
      created_at: new Date(),
      updated_at: new Date()
    } as any);
  }

  async updateAutoModerationRule(ruleId: string, data: Partial<AutoModerationRule>): Promise<boolean> {
    return this.autoRuleRepo.update(ruleId, {
      ...data,
      updated_at: new Date()
    } as any);
  }

  async deleteAutoModerationRule(ruleId: string): Promise<boolean> {
    return this.autoRuleRepo.delete(ruleId);
  }

  async toggleAutoModerationRule(ruleId: string): Promise<boolean> {
    return this.autoRuleRepo.toggleRule(ruleId);
  }

  async getEnabledAutoModerationRules(): Promise<AutoModerationRule[]> {
    return this.autoRuleRepo.findEnabled();
  }

  async runAutoModeration(contentType: string, contentId: string, content: string, userId?: string): Promise<{
    shouldFlag: boolean;
    shouldHide: boolean;
    shouldBan: boolean;
    reasons: string[];
  }> {
    const rules = await this.getEnabledAutoModerationRules();
    const result = {
      shouldFlag: false,
      shouldHide: false,
      shouldBan: false,
      reasons: [] as string[]
    };

    for (const rule of rules) {
      let matches = true;

      // Check conditions
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, content, userId)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        // Apply actions
        for (const action of rule.actions) {
          switch (action.type) {
            case 'flag':
              result.shouldFlag = true;
              break;
            case 'hide':
              result.shouldHide = true;
              break;
            case 'ban':
              result.shouldBan = true;
              break;
          }
          result.reasons.push(rule.name);
        }
      }
    }

    return result;
  }

  private evaluateCondition(condition: any, content: string, userId?: string): boolean {
    switch (condition.type) {
      case 'keyword':
        if (condition.operator === 'contains') {
          return content.toLowerCase().includes(condition.value.toLowerCase());
        } else if (condition.operator === 'regex') {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(content);
        }
        break;

      case 'spam_score':
        const spamResult = calculateSpamScore(content);
        const score = spamResult.score;
        if (condition.operator === 'greater_than') {
          return score > condition.value;
        } else if (condition.operator === 'less_than') {
          return score < condition.value;
        }
        break;

      case 'link_count':
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
        const urls = content.match(urlRegex) || [];
        const linkCount = urls.length;
        if (condition.operator === 'greater_than') {
          return linkCount > condition.value;
        }
        break;

      case 'new_user':
        // This would check user account age - placeholder implementation
        return false;
    }

    return false;
  }

  private async autoModerateReport(report: Report): Promise<void> {
    // Auto-assign to moderators if urgent
    if (report.priority === ReportPriority.URGENT) {
      // Find available moderators and assign
      // Implementation depends on your moderator availability system
    }

    // Auto-hide content if appropriate
    if (report.reason === ReportReason.SPAM || report.reason === ReportReason.HARASSMENT) {
      await this.hideContent(report.target_type, report.target_id, 'Auto-moderated due to report', 'system');
    }
  }

  // Spam detection
  async detectSpam(contentType: string, contentId: string, content: string, userId?: string): Promise<SpamDetection> {
    const spamScore = calculateSpamScore(content, userId ? { id: userId, created_at: new Date() } as any : undefined);

    const detection = await this.spamRepo.createDetection({
      content_type: contentType,
      content_id: contentId,
      score: spamScore.score,
      is_spam: spamScore.isSpam,
      confidence: spamScore.score / 100,
      reasons: spamScore.reasons
    });

    // Auto-moderate if spam detected
    if (spamScore.isSpam && spamScore.score >= 70) {
      await this.hideContent(contentType, contentId, 'Auto-detected as spam', 'system');
    }

    return detection;
  }

  async getSpamDetections(limit: number = 50): Promise<SpamDetection[]> {
    return this.spamRepo.findUnreviewed(limit);
  }

  async markSpamAsReviewed(detectionId: string, reviewedBy: string): Promise<boolean> {
    return this.spamRepo.markAsReviewed(detectionId, reviewedBy);
  }

  async getSpamStats() {
    return this.spamRepo.getSpamStats();
  }
}
