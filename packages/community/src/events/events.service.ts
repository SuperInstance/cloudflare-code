/**
 * Events Service
 * Handles community events, registrations, and reminders
 */

import { DatabaseConnection, BaseRepository } from '../utils/database';
import { generateUniqueSlug } from '../utils/database';
import {
  CommunityEvent,
  EventType,
  EventStatus,
  RegistrationStatus,
  EventRegistration,
  EventAgendaItem,
  EventReminder,
  EventFeedback,
  PaginationMeta,
  PaginatedResponse
} from '../types';

export class EventRepository extends BaseRepository<CommunityEvent> {
  tableName = 'community_events';

  async findBySlug(slug: string): Promise<CommunityEvent | null> {
    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.slug = ? AND e.deleted_at IS NULL
    `;
    const event = await this.db.queryOne<any>(sql, [slug]);
    return event ? this.mapEventToModel(event) : null;
  }

  async findByType(type: EventType, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE type = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [type]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.type = ? AND e.deleted_at IS NULL
      ORDER BY e.start_time DESC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [type, perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByStatus(status: EventStatus, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE status = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [status]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.status = ? AND e.deleted_at IS NULL
      ORDER BY e.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [status, perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findUpcoming(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE start_time > CURRENT_TIMESTAMP AND deleted_at IS NULL
      AND status IN ('published', 'registration_open')
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.start_time > CURRENT_TIMESTAMP AND e.deleted_at IS NULL
      AND e.status IN ('published', 'registration_open')
      ORDER BY e.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findPast(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE end_time < CURRENT_TIMESTAMP AND deleted_at IS NULL
      AND status = 'completed'
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.end_time < CURRENT_TIMESTAMP AND e.deleted_at IS NULL
      AND e.status = 'completed'
      ORDER BY e.start_time DESC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findFeatured(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE is_featured = 1 AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.is_featured = 1 AND e.deleted_at IS NULL
      ORDER BY e.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByHost(hostId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE host_id = ? AND deleted_at IS NULL
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [hostId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.host_id = ? AND e.deleted_at IS NULL
      ORDER BY e.start_time DESC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [hostId, perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async updateStatus(eventId: string, status: EventStatus): Promise<boolean> {
    return this.update(eventId, { status } as any);
  }

  async incrementAttendeeCount(eventId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET current_attendees = current_attendees + 1
      WHERE id = ?
    `;
    await this.db.execute(sql, [eventId]);
  }

  async decrementAttendeeCount(eventId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET current_attendees = CASE WHEN current_attendees > 0 THEN current_attendees - 1 ELSE 0 END
      WHERE id = ?
    `;
    await this.db.execute(sql, [eventId]);
  }

  async search(query: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    const offset = (page - 1) * perPage;
    const searchTerm = `%${query}%`;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE deleted_at IS NULL AND (title LIKE ? OR description LIKE ?)
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [searchTerm, searchTerm]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT e.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.deleted_at IS NULL AND (e.title LIKE ? OR e.description LIKE ?)
      ORDER BY e.start_time DESC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<any>(sql, [searchTerm, searchTerm, perPage, offset]);

    return {
      data: events.map(e => this.mapEventToModel(e)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  private mapEventToModel(event: any): CommunityEvent {
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      type: event.type,
      host_id: event.host_id,
      host: event.username ? {
        id: event.host_id,
        username: event.username,
        display_name: event.display_name,
        avatar_url: event.avatar_url
      } : undefined,
      start_time: event.start_time,
      end_time: event.end_time,
      timezone: event.timezone,
      location: event.location,
      is_virtual: event.is_virtual === 1,
      meeting_url: event.meeting_url,
      max_attendees: event.max_attendees,
      current_attendees: event.current_attendees || 0,
      status: event.status,
      cover_image: event.cover_image,
      tags: event.tags ? JSON.parse(event.tags) : [],
      agenda: event.agenda ? JSON.parse(event.agenda) : [],
      requirements: event.requirements ? JSON.parse(event.requirements) : [],
      is_featured: event.is_featured === 1,
      registration_deadline: event.registration_deadline,
      created_at: event.created_at,
      updated_at: event.updated_at
    };
  }
}

export class EventRegistrationRepository extends BaseRepository<EventRegistration> {
  tableName = 'event_registrations';

  async findByEvent(eventId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<EventRegistration>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE event_id = ? AND status != 'cancelled'
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [eventId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ? AND r.status != 'cancelled'
      ORDER BY r.registered_at ASC
      LIMIT ? OFFSET ?
    `;
    const registrations = await this.db.query<any>(sql, [eventId, perPage, offset]);

    return {
      data: registrations.map(r => this.mapRegistrationToModel(r)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<EventRegistration>> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE user_id = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT r.*, e.title, e.slug, e.start_time, e.end_time
      FROM ${this.tableName} r
      LEFT JOIN community_events e ON r.event_id = e.id
      WHERE r.user_id = ?
      ORDER BY r.registered_at DESC
      LIMIT ? OFFSET ?
    `;
    const registrations = await this.db.query<any>(sql, [userId, perPage, offset]);

    return {
      data: registrations.map(r => this.mapRegistrationToModel(r)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<EventRegistration | null> {
    const sql = `
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ? AND r.user_id = ?
      LIMIT 1
    `;
    const registration = await this.db.queryOne<any>(sql, [eventId, userId]);
    return registration ? this.mapRegistrationToModel(registration) : null;
  }

  async updateStatus(registrationId: string, status: RegistrationStatus): Promise<boolean> {
    return this.update(registrationId, { status } as any);
  }

  async markAsAttended(registrationId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET attended = 1, attended_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [registrationId]);
    return result.rowsAffected > 0;
  }

  async submitFeedback(registrationId: string, feedback: Omit<EventFeedback, 'submitted_at'>): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET feedback = ?, feedback_submitted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [
      JSON.stringify({
        rating: feedback.rating,
        comments: feedback.comments,
        submitted_at: new Date()
      }),
      registrationId
    ]);
    return result.rowsAffected > 0;
  }

  async getAttendeeCount(eventId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE event_id = ? AND status IN ('registered', 'confirmed') AND attended = 1
    `;
    const result = await this.db.queryOne<{ count: number }>(sql, [eventId]);
    return result?.count || 0;
  }

  async getRegistrationCount(eventId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE event_id = ? AND status IN ('registered', 'confirmed')
    `;
    const result = await this.db.queryOne<{ count: number }>(sql, [eventId]);
    return result?.count || 0;
  }

  private mapRegistrationToModel(registration: any): EventRegistration {
    return {
      id: registration.id,
      event_id: registration.event_id,
      user_id: registration.user_id,
      user: registration.username ? {
        id: registration.user_id,
        username: registration.username,
        display_name: registration.display_name,
        avatar_url: registration.avatar_url
      } : undefined,
      status: registration.status,
      registered_at: registration.registered_at,
      reminder_sent: registration.reminder_sent === 1,
      attended: registration.attended === 1,
      attended_at: registration.attended_at,
      feedback: registration.feedback ? JSON.parse(registration.feedback) : undefined
    };
  }
}

export class EventReminderRepository extends BaseRepository<EventReminder> {
  tableName = 'event_reminders';

  async findByEvent(eventId: string): Promise<EventReminder[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE event_id = ?
      ORDER BY remind_before DESC
    `;
    return this.db.query<EventReminder>(sql, [eventId]);
  }

  async findByUser(userId: string): Promise<EventReminder[]> {
    const sql = `
      SELECT r.*, e.title, e.start_time
      FROM ${this.tableName} r
      LEFT JOIN community_events e ON r.event_id = e.id
      WHERE r.user_id = ? AND r.sent = 0
      ORDER BY e.start_time ASC
    `;
    return this.db.query<EventReminder>(sql, [userId]);
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<EventReminder | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE event_id = ? AND user_id = ?
      LIMIT 1
    `;
    return this.db.queryOne<EventReminder>(sql, [eventId, userId]);
  }

  async markAsSent(reminderId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET sent = 1, sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [reminderId]);
    return result.rowsAffected > 0;
  }

  async findPendingReminders(): Promise<EventReminder[]> {
    const sql = `
      SELECT r.*, e.title, e.start_time, u.email, u.username
      FROM ${this.tableName} r
      LEFT JOIN community_events e ON r.event_id = e.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.sent = 0
      AND datetime(e.start_time, '-' || r.remind_before || ' minutes') <= CURRENT_TIMESTAMP
      ORDER BY e.start_time ASC
    `;
    return this.db.query<any>(sql);
  }
}

export class EventService {
  constructor(
    private db: DatabaseConnection,
    private notificationService: any
  ) {
    this.eventRepo = new EventRepository(db);
    this.registrationRepo = new EventRegistrationRepository(db);
    this.reminderRepo = new EventReminderRepository(db);
  }

  private eventRepo: EventRepository;
  private registrationRepo: EventRegistrationRepository;
  private reminderRepo: EventReminderRepository;

  // Event operations
  async createEvent(data: {
    title: string;
    description: string;
    type: EventType;
    host_id: string;
    start_time: Date;
    end_time: Date;
    timezone: string;
    location?: string;
    is_virtual: boolean;
    meeting_url?: string;
    max_attendees?: number;
    cover_image?: string;
    tags?: string[];
    agenda?: EventAgendaItem[];
    requirements?: string[];
    registration_deadline?: Date;
  }): Promise<CommunityEvent> {
    const slug = await generateUniqueSlug(data.title, 'community_events', this.db);

    const event = await this.eventRepo.create({
      title: data.title,
      slug,
      description: data.description,
      type: data.type,
      host_id: data.host_id,
      start_time: data.start_time,
      end_time: data.end_time,
      timezone: data.timezone,
      location: data.location,
      is_virtual: data.is_virtual,
      meeting_url: data.meeting_url,
      max_attendees: data.max_attendees,
      current_attendees: 0,
      status: EventStatus.DRAFT,
      cover_image: data.cover_image,
      tags: data.tags || [],
      agenda: data.agenda || [],
      requirements: data.requirements || [],
      is_featured: false,
      registration_deadline: data.registration_deadline
    } as any);

    return event;
  }

  async getEvent(id: string): Promise<CommunityEvent | null> {
    return this.eventRepo.findById(id);
  }

  async getEventBySlug(slug: string): Promise<CommunityEvent | null> {
    return this.eventRepo.findBySlug(slug);
  }

  async updateEvent(id: string, data: Partial<CommunityEvent>): Promise<boolean> {
    return this.eventRepo.update(id, data);
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.eventRepo.delete(id);
  }

  async publishEvent(eventId: string): Promise<boolean> {
    return this.eventRepo.updateStatus(eventId, EventStatus.PUBLISHED);
  }

  async cancelEvent(eventId: string): Promise<boolean> {
    return this.eventRepo.updateStatus(eventId, EventStatus.CANCELLED);
  }

  async featureEvent(eventId: string, featured: boolean): Promise<boolean> {
    return this.eventRepo.update(eventId, { is_featured: featured } as any);
  }

  async getEventsByType(type: EventType, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.findByType(type, page, perPage);
  }

  async getEventsByStatus(status: EventStatus, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.findByStatus(status, page, perPage);
  }

  async getUpcomingEvents(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.findUpcoming(page, perPage);
  }

  async getPastEvents(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.findPast(page, perPage);
  }

  async getFeaturedEvents(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.findFeatured(page, perPage);
  }

  async getEventsByHost(hostId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.findByHost(hostId, page, perPage);
  }

  async searchEvents(query: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<CommunityEvent>> {
    return this.eventRepo.search(query, page, perPage);
  }

  // Registration operations
  async registerForEvent(eventId: string, userId: string): Promise<EventRegistration> {
    // Check if event exists and is open for registration
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.REGISTRATION_OPEN) {
      throw new Error('Event is not open for registration');
    }

    if (event.max_attendees && event.current_attendees >= event.max_attendees) {
      throw new Error('Event is full');
    }

    if (event.registration_deadline && new Date() > event.registration_deadline) {
      throw new Error('Registration deadline has passed');
    }

    // Check if already registered
    const existing = await this.registrationRepo.findByEventAndUser(eventId, userId);
    if (existing) {
      throw new Error('Already registered for this event');
    }

    // Create registration
    const registration = await this.registrationRepo.create({
      event_id: eventId,
      user_id: userId,
      status: RegistrationStatus.REGISTERED,
      registered_at: new Date(),
      reminder_sent: false,
      attended: false
    } as any);

    // Update event attendee count
    await this.eventRepo.incrementAttendeeCount(eventId);

    // Notify host
    await this.notificationService.create({
      recipient_id: event.host_id,
      type: 'event_registration',
      title: 'New event registration',
      body: `Someone registered for "${event.title}"`,
      source_type: 'event',
      source_id: eventId,
      source_user_id: userId
    });

    return registration;
  }

  async unregisterFromEvent(eventId: string, userId: string): Promise<boolean> {
    const registration = await this.registrationRepo.findByEventAndUser(eventId, userId);
    if (!registration) {
      return false;
    }

    await this.registrationRepo.update(registration.id, {
      status: RegistrationStatus.CANCELLED
    } as any);

    // Update event attendee count
    await this.eventRepo.decrementAttendeeCount(eventId);

    return true;
  }

  async confirmRegistration(registrationId: string): Promise<boolean> {
    return this.registrationRepo.updateStatus(registrationId, RegistrationStatus.CONFIRMED);
  }

  async markAttended(registrationId: string): Promise<boolean> {
    const registration = await this.registrationRepo.findById(registrationId);
    if (!registration) return false;

    const result = await this.registrationRepo.markAsAttended(registrationId);

    if (result) {
      // Award reputation for attending
      // await this.reputationService.addReputation(registration.user_id, 20, 'event_participated', 'event', registration.event_id);
    }

    return result;
  }

  async getRegistrationsByEvent(eventId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<EventRegistration>> {
    return this.registrationRepo.findByEvent(eventId, page, perPage);
  }

  async getRegistrationsByUser(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<EventRegistration>> {
    return this.registrationRepo.findByUser(userId, page, perPage);
  }

  async submitFeedback(registrationId: string, feedback: { rating: number; comments?: string }): Promise<boolean> {
    return this.registrationRepo.submitFeedback(registrationId, feedback);
  }

  // Reminder operations
  async setReminder(eventId: string, userId: string, remindBefore: number): Promise<EventReminder> {
    // Check if already exists
    const existing = await this.reminderRepo.findByEventAndUser(eventId, userId);
    if (existing) {
      await this.reminderRepo.update(existing.id, { remind_before: remindBefore } as any);
      return { ...existing, remind_before: remindBefore };
    }

    return this.reminderRepo.create({
      event_id: eventId,
      user_id: userId,
      remind_before: remindBefore,
      sent: false
    } as any);
  }

  async removeReminder(eventId: string, userId: string): Promise<boolean> {
    const reminder = await this.reminderRepo.findByEventAndUser(eventId, userId);
    if (!reminder) return false;

    return this.reminderRepo.delete(reminder.id);
  }

  async getRemindersByUser(userId: string): Promise<EventReminder[]> {
    return this.reminderRepo.findByUser(userId);
  }

  async sendPendingReminders(): Promise<number> {
    const pendingReminders = await this.reminderRepo.findPendingReminders();
    let sent = 0;

    for (const reminder of pendingReminders) {
      try {
        await this.notificationService.create({
          recipient_id: reminder.user_id,
          type: 'event_reminder',
          title: `Reminder: ${reminder.title}`,
          body: `This event starts in ${Math.floor(reminder.remind_before / 60)} hours`,
          source_type: 'event',
          source_id: reminder.event_id
        });

        await this.reminderRepo.markAsSent(reminder.id);
        sent++;
      } catch (error) {
        console.error('Failed to send reminder:', error);
      }
    }

    return sent;
  }

  // Event status management
  async startEvent(eventId: string): Promise<boolean> {
    return this.eventRepo.updateStatus(eventId, EventStatus.IN_PROGRESS);
  }

  async completeEvent(eventId: string): Promise<boolean> {
    return this.eventRepo.updateStatus(eventId, EventStatus.COMPLETED);
  }

  async openRegistration(eventId: string): Promise<boolean> {
    return this.eventRepo.updateStatus(eventId, EventStatus.REGISTRATION_OPEN);
  }

  async closeRegistration(eventId: string): Promise<boolean> {
    return this.eventRepo.updateStatus(eventId, EventStatus.REGISTRATION_CLOSED);
  }

  // Statistics
  async getEventStats(eventId: string): Promise<{
    totalRegistrations: number;
    confirmedRegistrations: number;
    attendees: number;
    cancellations: number;
    averageRating?: number;
  }> {
    const total = await this.registrationRepo.getRegistrationCount(eventId);
    const attendees = await this.registrationRepo.getAttendeeCount(eventId);

    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        AVG(CAST(json_extract(feedback, '$.rating') AS REAL)) as avg_rating
      FROM ${this.registrationRepo.tableName}
      WHERE event_id = ?
    `;
    const result = await this.db.queryOne<any>(sql, [eventId]);

    return {
      totalRegistrations: total,
      confirmedRegistrations: result.confirmed || 0,
      attendees,
      cancellations: result.cancelled || 0,
      averageRating: result.avg_rating || undefined
    };
  }
}
