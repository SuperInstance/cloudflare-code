# @claudeflare/community

A comprehensive community platform for ClaudeFlare built on Cloudflare Workers, featuring discussion forums, Q&A system, code gallery, events, and reputation system.

## Features

### 🗨️ Discussion Forums
- Multi-category threaded discussions
- Rich text editor with markdown support
- Code highlighting and @mentions
- Reactions and upvotes
- Pinned and featured threads
- Advanced search and filtering

### ❓ Q&A Platform
- Stack Overflow-style questions and answers
- Voting system with reputation rewards
- Accepted answers and bounties
- Duplicate detection
- Comment system for clarification
- Tag-based organization

### 🎨 Code Gallery
- Share code snippets, templates, agents, and plugins
- Fork and improve existing code
- Rating and review system
- Screenshots and demo links
- License and version management

### 👥 User Profiles
- Public profiles with activity history
- Reputation points and levels
- Achievement badges
- Following/followers system
- Customizable preferences

### 🛡️ Moderation Tools
- Content flagging and reporting
- AI-powered spam detection
- Auto-moderation rules
- Moderator dashboard
- Warning, mute, suspend, and ban actions

### 🔔 Notifications
- Real-time in-app notifications
- Email and push notifications
- Daily and weekly digests
- Customizable notification preferences

### 📅 Events
- Community events and webinars
- Office hours and AMAs
- Hackathons and workshops
- Event registration and reminders
- Attendance tracking and feedback

### ⭐ Reputation System
- Points for contributions
- Reputation levels with privileges
- Leaderboards and rankings
- Badges and achievements

## Installation

```bash
npm install @claudeflare/community
```

## Quick Start

```typescript
import { CommunityAPI } from '@claudeflare/community';
import { D1Database } from '@claudeflare/community/utils';

// Initialize with Cloudflare D1 binding
const db = new D1Database(env.DB);
const api = new CommunityAPI({ DB: env.DB });

// Handle incoming requests
export default {
  async fetch(request: Request, env: any, ctx: any) {
    return api.handleRequest(request, { DB: env.DB });
  }
};
```

## API Endpoints

### Forums
- `GET /api/forums/categories` - List all categories
- `GET /api/forums/categories/:id` - Get category details
- `GET /api/forums/threads` - List threads in a category
- `POST /api/forums/threads` - Create a new thread
- `GET /api/forums/threads/:id` - Get thread details
- `POST /api/forums/threads/:id/posts` - Reply to a thread

### Q&A
- `GET /api/qa/questions` - List questions
- `POST /api/qa/questions` - Ask a question
- `GET /api/qa/questions/:id` - Get question details
- `POST /api/qa/questions/:id/answers` - Answer a question
- `POST /api/qa/answers/:id/accept` - Accept an answer
- `POST /api/qa/vote/:type/:id` - Vote on content

### Gallery
- `GET /api/gallery/items` - List gallery items
- `POST /api/gallery/items` - Share code
- `GET /api/gallery/items/:id` - Get item details
- `POST /api/gallery/items/:id/rate` - Rate an item
- `POST /api/gallery/items/:id/fork` - Fork an item

### Users
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update profile
- `GET /api/users/:id` - Get user profile
- `POST /api/users/:id/follow` - Follow a user

### Notifications
- `GET /api/notifications` - List notifications
- `POST /api/notifications/:id/read` - Mark as read
- `POST /api/notifications/read-all` - Mark all as read

### Events
- `GET /api/events` - List events
- `POST /api/events/:id/register` - Register for event
- `POST /api/events/:id/unregister` - Cancel registration

### Reputation
- `GET /api/reputation/:userId` - Get user reputation
- `GET /api/reputation/leaderboard` - Get leaderboard

## Database Schema

The platform uses Cloudflare D1 with the following main tables:

- `users` - User accounts and profiles
- `forum_categories` - Forum categories
- `forum_threads` - Discussion threads
- `forum_posts` - Thread replies
- `questions` - Q&A questions
- `answers` - Question answers
- `comments` - Comments on questions/answers
- `votes` - Upvotes/downvotes
- `gallery_items` - Code gallery items
- `gallery_ratings` - Item ratings
- `event_registrations` - Event registrations
- `notifications` - User notifications
- `reputation_events` - Reputation history
- `reports` - Moderation reports

## Services

### UserService
User management, profiles, authentication.

### ForumService
Discussion forums, threads, and posts.

### QAService
Q&A platform, questions, answers, and voting.

### GalleryService
Code gallery, sharing, rating, and forking.

### ModerationService
Content moderation, spam detection, and reports.

### NotificationService
User notifications, preferences, and digests.

### EventService
Community events, registrations, and reminders.

### ReputationService
Reputation points, levels, and rewards.

## Middleware

### AuthMiddleware
JWT authentication and authorization.

### RateLimitMiddleware
Rate limiting by IP or user.

### CORSMiddleware
Cross-origin resource sharing.

### ValidationMiddleware
Request body validation.

### ErrorHandlerMiddleware
Global error handling.

### LoggingMiddleware
Request/response logging.

### CacheMiddleware
Response caching with Cloudflare CDN.

## Reputation Points

Actions that earn reputation:
- Post created: +5
- Post upvoted: +10
- Answer accepted: +25
- Answer upvoted: +15
- Question upvoted: +10
- Comment upvoted: +5
- Badge earned: +50
- Gallery shared: +10
- Gallery forked: +5 (author)
- Event participated: +20
- Referral: +100

## Badge System

Badges are organized by category and level:
- **Participation**: For engaging with the community
- **Contribution**: For helping others
- **Quality**: For high-quality content
- **Community**: For reputation milestones
- **Special**: For unique achievements

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please visit the ClaudeFlare community forums.
