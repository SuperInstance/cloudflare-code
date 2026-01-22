# @claudeflare/collaboration

Advanced collaboration features for ClaudeFlare platform.

## Features

### Real-time Collaboration
- **CRDT Implementation**: Conflict-free replicated data types using Yjs
- **WebSocket Management**: Real-time updates with automatic reconnection
- **Presence Detection**: Track online/offline status, cursors, and selections
- **Multi-user Editing**: Concurrent text editing with conflict resolution

### Pair Programming
- **Driver/Navigator Roles**: Role-based permissions and automatic switching
- **WebRTC Integration**: Voice chat, video chat, and screen sharing
- **Terminal Sharing**: Collaborative terminal sessions
- **Session Analytics**: Track performance and collaboration metrics

### Code Review
- **Review Workflow**: Complete code review lifecycle management
- **Inline Comments**: Threaded discussions with reactions
- **Review Analytics**: Track review velocity and bottlenecks
- **Suggested Changes**: Apply code suggestions directly

### Knowledge Sharing
- **Documentation Wiki**: Create and manage knowledge articles
- **Code Snippets**: Reusable code library with voting
- **Best Practices**: Curated guidelines and examples
- **Knowledge Graph**: Related content discovery

### Team Management
- **Team Organization**: Hierarchical team structure
- **Role-based Permissions**: Granular access control
- **Member Management**: Invites, roles, and statistics
- **Project Association**: Link projects to teams

### Activity & Notifications
- **Activity Feeds**: Real-time activity streams
- **Notifications**: Multi-channel notifications (in-app, email, push)
- **Activity Digests**: Scheduled summaries
- **Analytics**: Activity trends and insights

## Installation

```bash
npm install @claudeflare/collaboration
```

## Quick Start

### Real-time Collaboration

```typescript
import { CollaborationManager } from '@claudeflare/collaboration';

// Create collaboration manager
const collab = new CollaborationManager(
  'user-123',
  'John Doe',
  { url: 'wss://api.claudeflare.com/collaborate' }
);

// Connect to server
await collab.connect();

// Join a document session
const session = await collab.joinDocument('doc-456', {
  canEdit: true,
  canComment: true,
  canView: true,
  canShare: false,
  canDelete: false,
});

// Update cursor position
collab.updateCursor('doc-456', { line: 10, column: 5 });

// Listen for events
collab.on('user-joined', (user) => {
  console.log(`${user.userName} joined the session`);
});

collab.on('cursor-updated', ({ userId, cursor }) => {
  console.log(`User ${userId} moved cursor to`, cursor);
});
```

### Pair Programming

```typescript
import { PairProgrammingManager } from '@claudeflare/pair';

const pairManager = new PairProgrammingManager(collabManager);

// Create a pair session
const session = pairManager.createSession(
  'project-789',
  'user-123',
  'Alice',
  'user-456',
  'Bob',
  {
    allowVoiceChat: true,
    allowVideoChat: true,
    allowScreenShare: true,
    autoSwitchInterval: 1800000, // 30 minutes
  }
);

// Start voice chat
const webrtc = pairManager.startWebRTCSession(
  session.sessionId,
  'voice',
  'user-123'
);

await webrtc.start();

// Switch roles
pairManager.switchRoles(session.sessionId, 'user-123');
```

### Code Review

```typescript
import { CodeReviewManager } from '@claudeflare/review';

const reviewManager = new CodeReviewManager();

// Create a review
const review = reviewManager.createReview(
  'project-789',
  'pr-123',
  'Fix authentication bug',
  'This PR fixes the authentication issue reported in ticket #456',
  'user-123',
  ['user-456', 'user-789'],
  {
    priority: 'high',
    dueDate: Date.now() + 86400000 * 3, // 3 days
    settings: {
      minApprovals: 2,
      requireAllApprovals: false,
    },
  }
);

// Add a comment
const comment = reviewManager.addComment(
  review.id,
  'user-456',
  'Bob',
  'Consider using async/await here for better readability',
  {
    filePath: 'src/auth.js',
    line: 42,
    type: 'suggestion',
  }
);

// Approve the review
reviewManager.updateAssignmentStatus(review.id, 'user-456', 'completed');
```

### Knowledge Sharing

```typescript
import { KnowledgeManager } from '@claudeflare/knowledge';

const knowledgeManager = new KnowledgeManager();

// Create an article
const article = knowledgeManager.createArticle(
  'Getting Started with TypeScript',
  'A comprehensive guide to TypeScript fundamentals...',
  'user-123',
  'Alice',
  {
    category: 'typescript',
    tags: ['typescript', 'tutorial', 'beginner'],
    difficulty: 'beginner',
    language: 'en',
  }
);

// Publish the article
knowledgeManager.publishArticle(article.id);

// Search for articles
const results = knowledgeManager.searchArticles('typescript', {
  category: 'typescript',
  difficulty: 'beginner',
  limit: 10,
});
```

### Team Management

```typescript
import { TeamManager } from '@claudeflare/teams';

const teamManager = new TeamManager();

// Create a team
const team = teamManager.createTeam(
  'Engineering Team',
  'user-123',
  'Alice',
  {
    description: 'Main engineering team',
    settings: {
      allowMemberInvite: true,
      requireApproval: true,
      defaultRole: 'member',
    },
  }
);

// Invite members
const invite = teamManager.createInvite(
  team.id,
  'user-123',
  'bob@example.com',
  'member'
);

// Add member (when invite accepted)
teamManager.addMember(team.id, 'user-456', 'Bob', 'member');
```

### Activity & Notifications

```typescript
import { ActivityManager } from '@claudeflare/activity';

const activityManager = new ActivityManager();

// Create an activity
const activity = activityManager.createActivity(
  'collaboration',
  'user-123',
  'Alice',
  'created',
  {
    type: 'document',
    id: 'doc-456',
    name: 'Authentication Module',
    url: '/docs/doc-456',
  },
  {
    metadata: {
      projectId: 'project-789',
    },
  }
);

// Get user activities
const activities = activityManager.getActivitiesForUser('user-123', {
  limit: 20,
  types: ['collaboration', 'code_review'],
});

// Get notifications
const notifications = activityManager.getNotifications('user-123', {
  unreadOnly: true,
  limit: 10,
});
```

## API Reference

### CollaborationManager

Main class for managing real-time collaboration sessions.

#### Methods

- `connect()`: Connect to collaboration server
- `disconnect()`: Disconnect from server
- `joinDocument(documentId, permissions)`: Join a collaborative document
- `leaveDocument(documentId)`: Leave a document session
- `updateCursor(documentId, cursor)`: Update cursor position
- `updateSelection(documentId, selection)`: Update text selection
- `getPresenceState(documentId)`: Get presence state for document

#### Events

- `user-joined`: User joined the session
- `user-left`: User left the session
- `cursor-updated`: User cursor moved
- `selection-updated`: User selection changed
- `text-updated`: Document content changed

### PairProgrammingManager

Manages pair programming sessions and WebRTC connections.

#### Methods

- `createSession(projectId, driverUserId, driverUserName, navigatorUserId, navigatorUserName, settings)`: Create pair session
- `switchRoles(sessionId, requestedBy)`: Switch driver/navigator roles
- `startWebRTCSession(sessionId, type, localUserId)`: Start WebRTC session
- `canWrite(sessionId, userId)`: Check if user can write
- `getStatistics(sessionId)`: Get session statistics

### CodeReviewManager

Manages code reviews and comments.

#### Methods

- `createReview(projectId, pullRequestId, title, description, authorId, reviewerIds, options)`: Create review
- `addComment(reviewId, authorId, authorName, content, options)`: Add comment
- `resolveComment(reviewId, commentId, resolvedBy)`: Resolve comment
- `updateAssignmentStatus(reviewId, reviewerId, status)`: Update assignment status
- `getAnalytics(reviewId)`: Get review analytics

### KnowledgeManager

Manages knowledge base articles and code snippets.

#### Methods

- `createArticle(title, content, authorId, authorName, options)`: Create article
- `publishArticle(articleId)`: Publish article
- `searchArticles(query, options)`: Search articles
- `createSnippet(title, description, code, language, authorId, tags)`: Create code snippet
- `getTrendingArticles(limit)`: Get trending articles

### TeamManager

Manages teams, members, and permissions.

#### Methods

- `createTeam(name, ownerId, ownerName, options)`: Create team
- `addMember(teamId, userId, userName, role, options)`: Add member
- `createInvite(teamId, invitedBy, invitedEmail, role)`: Create invite
- `hasPermission(teamId, userId, permission)`: Check permission
- `getTeamStatistics(teamId)`: Get team statistics

### ActivityManager

Manages activity feeds and notifications.

#### Methods

- `createActivity(type, actorId, actorName, action, target, options)`: Create activity
- `getActivitiesForUser(userId, options)`: Get user activities
- `createNotification(userId, type, title, message, options)`: Create notification
- `markAsRead(userId, notificationId)`: Mark notification as read
- `generateDigest(userId, period, startDate, endDate)`: Generate activity digest

## Types

See `src/types/index.ts` for complete type definitions.

## Utilities

The package includes utility functions for:

- ID generation
- Color generation
- Text processing
- Date/time formatting
- Validation
- String manipulation
- Array operations
- Statistics calculation
- Promise handling
- And more...

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
