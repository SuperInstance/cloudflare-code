/**
 * Community API Routes
 * RESTful API endpoints for the community platform
 */

import { Request, Response } from '@cloudflare/workers-types';
import { ForumService } from '../forums/forums.service';
import { QAService } from '../qa/qa.service';
import { GalleryService } from '../gallery/gallery.service';
import { UserService } from '../users/users.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationService } from '../notifications/notifications.service';
import { EventService } from '../events/events.service';
import { ReputationService } from '../reputation/reputation.service';
import { D1Database } from '../utils/database';

export interface CommunityContext {
  DB: D1DatabaseBinding;
  USER?: {
    id: string;
    username: string;
    role: string;
  };
}

// ==========================================
// API Router
// ==========================================

export class CommunityAPI {
  private forumService: ForumService;
  private qaService: QAService;
  private galleryService: GalleryService;
  private userService: UserService;
  private moderationService: ModerationService;
  private notificationService: NotificationService;
  private eventService: EventService;
  private reputationService: ReputationService;

  constructor(ctx: CommunityContext) {
    const db = new D1Database(ctx.DB);

    this.notificationService = new NotificationService(db);
    this.reputationService = new ReputationService(db, this.notificationService);

    this.forumService = new ForumService(db, this.notificationService);
    this.qaService = new QAService(db, this.notificationService, this.reputationService);
    this.galleryService = new GalleryService(db, this.notificationService, this.reputationService);
    this.userService = new UserService(db);
    this.moderationService = new ModerationService(db, this.notificationService);
    this.eventService = new EventService(db, this.notificationService);
  }

  async handleRequest(request: Request, ctx: CommunityContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Route request to appropriate handler
      if (path.startsWith('/api/forums')) {
        return this.handleForumsAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/qa')) {
        return this.handleQAAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/gallery')) {
        return this.handleGalleryAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/users')) {
        return this.handleUsersAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/moderation')) {
        return this.handleModerationAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/notifications')) {
        return this.handleNotificationsAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/events')) {
        return this.handleEventsAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/reputation')) {
        return this.handleReputationAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/search')) {
        return this.handleSearchAPI(request, path, method, ctx);
      } else if (path.startsWith('/api/stats')) {
        return this.handleStatsAPI(request, path, method, ctx);
      }

      return this.errorResponse('Not found', 404);
    } catch (error) {
      console.error('API Error:', error);
      return this.errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
    }
  }

  // ==========================================
  // Forums API
  // ==========================================

  private async handleForumsAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    // Categories
    if (path === '/api/forums/categories' && method === 'GET') {
      const categories = await this.forumService.getAllCategories();
      return this.jsonResponse(categories);
    }

    if (path.match(/^\/api\/forums\/categories\/[^/]+$/) && method === 'GET') {
      const categoryId = path.split('/').pop();
      const category = await this.forumService.getCategory(categoryId!);
      return category ? this.jsonResponse(category) : this.errorResponse('Category not found', 404);
    }

    // Threads
    if (path === '/api/forums/threads' && method === 'GET') {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');
      const category = url.searchParams.get('category');

      if (category) {
        const threads = await this.forumService.getThreadsByCategory(category, page, perPage);
        return this.jsonResponse(threads);
      }

      return this.errorResponse('Category required', 400);
    }

    if (path === '/api/forums/threads' && method === 'POST' && userId) {
      const data = await request.json();
      const thread = await this.forumService.createThread({
        ...data,
        author_id: userId
      });
      return this.jsonResponse(thread, 201);
    }

    if (path.match(/^\/api\/forums\/threads\/[^/]+$/) && method === 'GET') {
      const threadId = path.split('/').pop();
      const thread = await this.forumService.getThread(threadId!);
      return thread ? this.jsonResponse(thread) : this.errorResponse('Thread not found', 404);
    }

    if (path.match(/^\/api\/forums\/threads\/[^/]+\/posts$/) && method === 'GET') {
      const threadId = path.split('/')[4];
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');

      const result = await this.forumService.getThreadWithPosts(threadId, page, perPage);
      return this.jsonResponse(result);
    }

    if (path.match(/^\/api\/forums\/threads\/[^/]+\/posts$/) && method === 'POST' && userId) {
      const threadId = path.split('/')[4];
      const data = await request.json();
      const post = await this.forumService.createPost({
        ...data,
        thread_id: threadId,
        author_id: userId
      });
      return this.jsonResponse(post, 201);
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Q&A API
  // ==========================================

  private async handleQAAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    // Questions
    if (path === '/api/qa/questions' && method === 'GET') {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');
      const tag = url.searchParams.get('tag');
      const sort = url.searchParams.get('sort');

      if (tag) {
        const questions = await this.qaService.getQuestionsByTag(tag, page, perPage);
        return this.jsonResponse(questions);
      }

      if (sort === 'unanswered') {
        const questions = await this.qaService.getUnansweredQuestions(page, perPage);
        return this.jsonResponse(questions);
      }

      return this.errorResponse('Invalid parameters', 400);
    }

    if (path === '/api/qa/questions' && method === 'POST' && userId) {
      const data = await request.json();
      const question = await this.qaService.createQuestion({
        ...data,
        author_id: userId
      });
      return this.jsonResponse(question, 201);
    }

    if (path.match(/^\/api\/qa\/questions\/[^/]+$/) && method === 'GET') {
      const questionId = path.split('/').pop();
      const question = await this.qaService.getQuestion(questionId!);
      return question ? this.jsonResponse(question) : this.errorResponse('Question not found', 404);
    }

    if (path.match(/^\/api\/qa\/questions\/[^/]+\/answers$/) && method === 'POST' && userId) {
      const questionId = path.split('/')[4];
      const data = await request.json();
      const answer = await this.qaService.createAnswer({
        ...data,
        question_id: questionId,
        author_id: userId
      });
      return this.jsonResponse(answer, 201);
    }

    if (path.match(/^\/api\/qa\/answers\/[^/]+\/accept$/) && method === 'POST' && userId) {
      const answerId = path.split('/')[4];
      const data = await request.json();
      const result = await this.qaService.acceptAnswer(answerId, data.questionId, userId);
      return this.jsonResponse({ success: result });
    }

    if (path.match(/^\/api\/qa\/questions\/[^/]+\/comments$/) && method === 'POST' && userId) {
      const questionId = path.split('/')[4];
      const data = await request.json();
      const comment = await this.qaService.createComment({
        ...data,
        parent_type: 'question',
        parent_id: questionId,
        author_id: userId
      });
      return this.jsonResponse(comment, 201);
    }

    // Voting
    if (path.match(/^\/api\/qa\/vote\/[^/]+\/[^/]+$/) && method === 'POST' && userId) {
      const parts = path.split('/');
      const targetType = parts[4];
      const targetId = parts[5];
      const data = await request.json();
      await this.qaService.vote(userId, targetType, targetId, data.voteType);
      return this.jsonResponse({ success: true });
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Gallery API
  // ==========================================

  private async handleGalleryAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    if (path === '/api/gallery/items' && method === 'GET') {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');
      const type = url.searchParams.get('type');
      const category = url.searchParams.get('category');

      if (type) {
        const items = await this.galleryService.getItemsByType(type as any, page, perPage);
        return this.jsonResponse(items);
      }

      if (category) {
        const items = await this.galleryService.getItemsByCategory(category, page, perPage);
        return this.jsonResponse(items);
      }

      return this.errorResponse('Invalid parameters', 400);
    }

    if (path === '/api/gallery/items' && method === 'POST' && userId) {
      const data = await request.json();
      const item = await this.galleryService.createItem({
        ...data,
        author_id: userId
      });
      return this.jsonResponse(item, 201);
    }

    if (path.match(/^\/api\/gallery\/items\/[^/]+$/) && method === 'GET') {
      const itemId = path.split('/').pop();
      const item = await this.galleryService.getItem(itemId!);
      return item ? this.jsonResponse(item) : this.errorResponse('Item not found', 404);
    }

    if (path.match(/^\/api\/gallery\/items\/[^/]+\/rate$/) && method === 'POST' && userId) {
      const itemId = path.split('/')[4];
      const data = await request.json();
      const rating = await this.galleryService.rateItem(itemId, userId, data.rating, data.review);
      return this.jsonResponse(rating);
    }

    if (path.match(/^\/api\/gallery\/items\/[^/]+\/report$/) && method === 'POST' && userId) {
      const itemId = path.split('/')[4];
      const data = await request.json();
      const report = await this.galleryService.reportItem(itemId, userId, data.reason, data.description);
      return this.jsonResponse(report, 201);
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Users API
  // ==========================================

  private async handleUsersAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    if (path === '/api/users/me' && method === 'GET' && userId) {
      const user = await this.userService.getUserById(userId);
      return user ? this.jsonResponse(user) : this.errorResponse('User not found', 404);
    }

    if (path === '/api/users/me' && method === 'PATCH' && userId) {
      const data = await request.json();
      const user = await this.userService.updateUser(userId, data);
      return this.jsonResponse(user);
    }

    if (path.match(/^\/api\/users\/[^/]+$/) && method === 'GET') {
      const usernameOrId = path.split('/').pop();
      const user = await this.userService.getPublicProfile(usernameOrId!);
      return user ? this.jsonResponse(user) : this.errorResponse('User not found', 404);
    }

    if (path.match(/^\/api\/users\/[^/]+\/follow$/) && method === 'POST' && userId) {
      const targetUserId = path.split('/')[4];
      const result = await this.userService.followUser(userId, targetUserId);
      return this.jsonResponse({ success: result });
    }

    if (path.match(/^\/api\/users\/[^/]+\/unfollow$/) && method === 'POST' && userId) {
      const targetUserId = path.split('/')[4];
      const result = await this.userService.unfollowUser(userId, targetUserId);
      return this.jsonResponse({ success: result });
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Moderation API
  // ==========================================

  private async handleModerationAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;
    const isModerator = ctx.USER?.role === 'moderator' || ctx.USER?.role === 'admin';

    if (!isModerator) {
      return this.errorResponse('Forbidden', 403);
    }

    if (path === '/api/moderation/reports' && method === 'GET') {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');
      const status = url.searchParams.get('status') || 'pending';

      const reports = await this.moderationService.getReportsByStatus(status as any, page, perPage);
      return this.jsonResponse(reports);
    }

    if (path === '/api/moderation/reports' && method === 'POST') {
      const data = await request.json();
      const report = await this.moderationService.createReport({
        ...data,
        reporter_id: userId!
      });
      return this.jsonResponse(report, 201);
    }

    if (path.match(/^\/api\/moderation\/reports\/[^/]+\/resolve$/) && method === 'POST') {
      const reportId = path.split('/')[4];
      const data = await request.json();
      const result = await this.moderationService.resolveReport(reportId, data.resolutionNotes, userId!);
      return this.jsonResponse({ success: result });
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Notifications API
  // ==========================================

  private async handleNotificationsAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    if (!userId) {
      return this.errorResponse('Unauthorized', 401);
    }

    if (path === '/api/notifications' && method === 'GET') {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');
      const unreadOnly = url.searchParams.get('unread') === 'true';

      const notifications = await this.notificationService.getNotifications(userId, page, perPage, unreadOnly);
      return this.jsonResponse(notifications);
    }

    if (path === '/api/notifications/unread-count' && method === 'GET') {
      const count = await this.notificationService.getUnreadCount(userId);
      return this.jsonResponse({ count });
    }

    if (path.match(/^\/api\/notifications\/[^/]+\/read$/) && method === 'POST') {
      const notificationId = path.split('/')[3];
      const result = await this.notificationService.markAsRead(notificationId);
      return this.jsonResponse({ success: result });
    }

    if (path === '/api/notifications/read-all' && method === 'POST') {
      const result = await this.notificationService.markAllAsRead(userId);
      return this.jsonResponse({ success: result });
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Events API
  // ==========================================

  private async handleEventsAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    if (path === '/api/events' && method === 'GET') {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');
      const status = url.searchParams.get('status');

      if (status === 'upcoming') {
        const events = await this.eventService.getUpcomingEvents(page, perPage);
        return this.jsonResponse(events);
      }

      if (status === 'past') {
        const events = await this.eventService.getPastEvents(page, perPage);
        return this.jsonResponse(events);
      }

      return this.errorResponse('Invalid parameters', 400);
    }

    if (path.match(/^\/api\/events\/[^/]+\/register$/) && method === 'POST' && userId) {
      const eventId = path.split('/')[3];
      const registration = await this.eventService.registerForEvent(eventId, userId);
      return this.jsonResponse(registration, 201);
    }

    if (path.match(/^\/api\/events\/[^/]+\/unregister$/) && method === 'POST' && userId) {
      const eventId = path.split('/')[3];
      const result = await this.eventService.unregisterFromEvent(eventId, userId);
      return this.jsonResponse({ success: result });
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Reputation API
  // ==========================================

  private async handleReputationAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    const userId = ctx.USER?.id;

    if (path.match(/^\/api\/reputation\/[^/]+$/) && method === 'GET') {
      const targetUserId = path.split('/')[3];
      const reputation = await this.reputationService.getUserReputation(targetUserId);
      return this.jsonResponse({ reputation });
    }

    if (path.match(/^\/api\/reputation\/[^/]+\/history$/) && method === 'GET') {
      const targetUserId = path.split('/')[4];
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');

      const history = await this.reputationService.getReputationHistory(targetUserId, page, perPage);
      return this.jsonResponse(history);
    }

    if (path === '/api/reputation/leaderboard' && method === 'GET') {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const period = url.searchParams.get('period') as any;

      const leaderboard = await this.reputationService.getLeaderboard(limit, period);
      return this.jsonResponse(leaderboard);
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Search API
  // ==========================================

  private async handleSearchAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    if (path === '/api/search' && method === 'GET') {
      const url = new URL(request.url);
      const query = url.searchParams.get('q');
      const type = url.searchParams.get('type');
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '20');

      if (!query) {
        return this.errorResponse('Query required', 400);
      }

      if (type === 'threads') {
        const results = await this.forumService.searchThreads(query, page, perPage);
        return this.jsonResponse(results);
      }

      if (type === 'questions') {
        const results = await this.qaService.searchQuestions(query, page, perPage);
        return this.jsonResponse(results);
      }

      if (type === 'gallery') {
        const results = await this.galleryService.searchGallery(query, page, perPage);
        return this.jsonResponse(results);
      }

      if (type === 'events') {
        const results = await this.eventService.searchEvents(query, page, perPage);
        return this.jsonResponse(results);
      }

      return this.errorResponse('Invalid type', 400);
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Stats API
  // ==========================================

  private async handleStatsAPI(request: Request, path: string, method: string, ctx: CommunityContext): Promise<Response> {
    if (path === '/api/stats/community' && method === 'GET') {
      const stats = await this.getCommunityStats();
      return this.jsonResponse(stats);
    }

    return this.errorResponse('Not found', 404);
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  private errorResponse(message: string, status: number = 400): Response {
    return this.jsonResponse({ error: message }, status);
  }

  private async getCommunityStats(): Promise<any> {
    // Implementation would aggregate stats from all services
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalThreads: 0,
      totalQuestions: 0,
      totalAnswers: 0,
      totalGalleryItems: 0,
      totalEvents: 0
    };
  }
}

// ==========================================
// Export for Cloudflare Workers
// ==========================================

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const communityCtx: CommunityContext = {
      DB: env.DB,
      USER: ctx.user // Would be set by authentication middleware
    };

    const api = new CommunityAPI(communityCtx);
    return api.handleRequest(request, communityCtx);
  }
};
