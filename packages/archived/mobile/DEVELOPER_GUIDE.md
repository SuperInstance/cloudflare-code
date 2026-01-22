# ClaudeFlare Mobile PWA - Developer Guide

## Getting Started

### Prerequisites

- Node.js 18+
- npm 10+
- Git
- Code editor (VS Code recommended)

### Setup

```bash
# Clone repository
git clone https://github.com/claudeflare/claudeflare.git
cd claudeflare/packages/mobile

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000

## Project Structure

```
packages/mobile/
├── app/                    # Next.js 14 App Router
│   ├── chat/              # Chat feature pages
│   ├── projects/          # Project management pages
│   ├── review/            # Code review pages
│   ├── settings/          # Settings pages
│   └── offline/           # Offline page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── chat/             # Chat-specific components
│   ├── project/          # Project-specific components
│   ├── review/           # Review-specific components
│   └── notification/     # Notification components
├── lib/                   # Utilities and libraries
│   ├── pwa/              # PWA utilities
│   ├── api/              # API client
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Helper functions
├── public/               # Static assets
│   ├── icons/           # PWA icons
│   ├── images/          # Images
│   ├── manifest.json    # PWA manifest
│   └── sw.js           # Service worker
└── styles/              # Global styles
```

## Component Development

### Creating a New Component

1. **Create component file**

```tsx
// components/ui/MyComponent.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface MyComponentProps {
  title: string;
  className?: string;
}

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <div className={cn('p-4 bg-white rounded-lg', className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
```

2. **Export from index**

```tsx
// components/ui/index.ts
export { MyComponent } from './MyComponent';
```

3. **Use in page**

```tsx
import { MyComponent } from '@/components/ui';

export default function Page() {
  return <MyComponent title="Hello" />;
}
```

### Component Guidelines

- **Mobile-first**: Design for mobile screens first
- **Touch-friendly**: Minimum 44x44px touch targets
- **Accessibility**: Use semantic HTML and ARIA labels
- **Performance**: Lazy load heavy components
- **TypeScript**: Use proper typing for props

## State Management

### Using Zustand for Global State

```tsx
// lib/store/chatStore.ts
import { create } from 'zustand';

interface ChatStore {
  messages: Message[];
  addMessage: (message: Message) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
}));
```

### Using Custom Hooks

```tsx
// lib/hooks/useChat.ts
export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  // Hook logic here

  return { messages, sendMessage };
}
```

## API Integration

### API Client Usage

```tsx
import { api } from '@/lib/api/client';

// GET request
const projects = await api.getProjects();

// POST request
const newProject = await api.createProject({ name: 'My Project' });

// Streaming request
for await (const chunk of api.streamMessage(conversationId, content)) {
  console.log(chunk);
}
```

### Adding New Endpoints

```tsx
// lib/api/client.ts
export const api = {
  // Existing endpoints...

  // New endpoint
  myNewEndpoint: async (param: string) => {
    return apiClient.get(`/my-endpoint/${param}`);
  },
};
```

## PWA Features

### Service Worker

The service worker is in `public/sw.js`. To modify:

1. Edit the TypeScript source: `lib/pwa/service-worker-registration.ts`
2. Build and copy to `public/sw.js`

### Offline Support

```tsx
import { offlineDb } from '@/lib/pwa/offline-db';

// Store data offline
await offlineDb.put('cache', {
  url: '/api/data',
  data: myData,
  timestamp: Date.now(),
  expires: Date.now() + 60000,
});

// Retrieve cached data
const cached = await offlineDb.getCachedResponse('/api/data');
```

### Push Notifications

```tsx
import { swManager } from '@/lib/pwa/registerSW';

// Request permission
const granted = await swManager.requestNotificationPermission();

// Subscribe to push
const subscription = await swManager.subscribeToPush();

// Send subscription to server
await api.subscribeToPush(subscription);
```

## Testing

### Unit Tests

```tsx
// __tests__/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/ui/MyComponent';

describe('MyComponent', () => {
  it('renders title', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Run Tests

```bash
npm test
```

## Styling

### Tailwind CSS

```tsx
// Utility classes
<div className="flex items-center gap-2 p-4 bg-white rounded-lg">

// Responsive design
<div className="text-sm md:text-base lg:text-lg">

// Dark mode
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

### Custom Styles

```css
/* styles/custom.css */
.my-custom-class {
  /* Custom styles */
}
```

## Performance Optimization

### Code Splitting

```tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
});
```

### Image Optimization

```tsx
import Image from 'next/image';

<Image
  src="/hero.png"
  alt="Hero"
  width={800}
  height={600}
  priority
/>
```

### Lazy Loading

```tsx
import { useInView } from 'react-intersection-observer';

function LazyComponent() {
  const { ref, inView } = useInView();

  return (
    <div ref={ref}>
      {inView && <HeavyComponent />}
    </div>
  );
}
```

## Debugging

### React DevTools

Install React DevTools browser extension for component inspection.

### Service Worker Debugging

```javascript
// In browser console
navigator.serviceWorker.addEventListener('controllerchange', () => {
  console.log('Service worker changed');
});

// Check caches
caches.keys().then(keys => console.log(keys));
```

### Network Debugging

```tsx
import { useNetworkStatus } from '@/lib/pwa/network-manager';

function Component() {
  const { isOnline, isSlow } = useNetworkStatus();

  return (
    <div>
      Status: {isOnline ? 'Online' : 'Offline'}
      {isSlow && ' (Slow connection)'}
    </div>
  );
}
```

## Common Patterns

### Form Handling

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    await api.createProject(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Data Fetching

```tsx
import { useQuery } from '@tanstack/react-query';

function ProjectsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Error message={error.message} />;

  return <ProjectList projects={data} />;
}
```

### Error Handling

```tsx
import { apiClient, ApiError } from '@/lib/api/client';

try {
  const data = await api.getProjects();
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Unauthorized - redirect to login
    } else if (error.status >= 500) {
      // Server error - show error message
    }
  }
}
```

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Write tests**
5. **Submit a pull request**

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [MDN Web Docs](https://developer.mozilla.org/)

## Getting Help

- GitHub Issues: https://github.com/claudeflare/claudeflare/issues
- Discord: https://discord.gg/claudeflare
- Documentation: https://docs.claudeflare.com
