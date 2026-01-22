# ClaudeFlare Mobile PWA

Progressive Web App for ClaudeFlare - Mobile-optimized interface with offline support and push notifications.

## Features

### Core Functionality
- 📱 **Mobile-Optimized UI**: Touch-friendly interface with bottom navigation
- 💬 **Real-time Chat**: Streaming chat interface with AI assistance
- 📁 **Project Management**: View and manage projects on the go
- 🔍 **Code Review**: Review pull requests directly from mobile
- 🔔 **Push Notifications**: Stay updated with real-time alerts
- 📴 **Offline Support**: Continue working without internet connection

### PWA Features
- ✅ **Installable**: Add to home screen on iOS and Android
- 📴 **Offline-First**: Service worker caching for offline access
- 🔄 **Background Sync**: Queue actions when offline, sync when online
- 🔔 **Push Notifications**: Native push notification support
- 🚀 **App Shortcuts**: Quick access to key features
- 🎨 **Splash Screens**: Native app-like experience

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **PWA**: next-pwa, workbox
- **Offline**: IndexedDB, Service Workers
- **Push**: Web Push API

## Project Structure

```
packages/mobile/
├── app/                    # Next.js app directory
│   ├── chat/              # Chat pages
│   ├── projects/          # Project pages
│   ├── review/            # Code review pages
│   ├── settings/          # Settings pages
│   └── offline/           # Offline page
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── chat/             # Chat components
│   ├── project/          # Project components
│   ├── review/           # Review components
│   └── notification/     # Notification components
├── lib/                   # Utilities
│   ├── pwa/              # PWA utilities
│   ├── api/              # API client
│   ├── hooks/            # Custom hooks
│   └── utils/            # Helper functions
├── public/               # Static assets
│   ├── icons/           # PWA icons
│   ├── images/          # Images
│   ├── manifest.json    # PWA manifest
│   └── sw.js           # Service worker
└── styles/              # Global styles
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

### Serve Static Build

```bash
npm run export
npm run serve
```

## Key Components

### PWA Utilities

- **registerSW**: Service worker registration and updates
- **offlineDb**: IndexedDB wrapper for offline storage
- **networkManager**: Network status monitoring
- **pwaInstall**: Install prompt handling

### UI Components

- **Button**: Touch-friendly button with loading states
- **Input**: Mobile-optimized input with validation
- **Card**: Card component with touch feedback
- **Modal**: Modal with slide-up animation
- **BottomNav**: Bottom navigation bar
- **Loading**: Various loading states

### Feature Components

- **ChatMessage**: Message with markdown and code highlighting
- **ProjectCard**: Project card with quick actions
- **PullRequestCard**: PR card with review actions
- **NotificationItem**: Notification with swipe actions

## API Integration

The app integrates with the ClaudeFlare API:

```typescript
import { api } from '@/lib/api/client';

// Chat
await api.streamMessage(conversationId, content);

// Projects
await api.getProjects();

// Code Review
await api.getPullRequests();

// Notifications
await api.getNotifications();
```

## Offline Support

The app works offline using:

1. **Service Worker**: Caches static assets and API responses
2. **IndexedDB**: Stores messages, projects, and cache
3. **Background Sync**: Queues actions when offline
4. **Network Manager**: Monitors connectivity

## Push Notifications

1. Request permission on first visit
2. Subscribe to push server
3. Receive notifications for:
   - New messages
   - PR updates
   - Project changes
   - System alerts

## Mobile Optimization

- Touch targets ≥ 44x44px
- Safe area insets for notched devices
- Pull-to-refresh support
- Bottom navigation for easy reach
- Swipe gestures for actions
- Haptic feedback where supported
- Optimized for one-handed use

## Performance

- Code splitting by route
- Image optimization
- Lazy loading components
- Service worker caching
- IndexedDB for offline data
- Minimal bundle size

## Deployment

### Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy out
```

### Deploy to Vercel

```bash
npm run build
vercel --prod
```

### Deploy to Netlify

```bash
npm run build
netlify deploy --prod --dir=out
```

## Testing

```bash
npm run test
```

## Lighthouse Score

Target scores:
- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 100
- PWA: 100

## Browser Support

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Samsung Internet 14+
- iOS Safari 14.5+

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md)

## License

MIT
