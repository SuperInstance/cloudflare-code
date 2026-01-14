# ClaudeFlare Dashboard

A modern, comprehensive web dashboard for the ClaudeFlare distributed AI coding platform.

## Features

- **Dashboard Overview**: Real-time stats and activity monitoring
- **Project Management**: Create, manage, and collaborate on projects
- **Code Editor**: Full-featured Monaco editor with file tree and tabs
- **AI Chat Interface**: Streaming chat with Claude and other AI models
- **Analytics**: Detailed metrics, costs, and usage insights
- **Settings**: Comprehensive user and organization settings
- **Real-time Updates**: WebSocket integration for live collaboration
- **Dark Mode**: Full dark mode support with theme switching
- **Responsive Design**: Works seamlessly on desktop and mobile

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Charts**: Recharts
- **Code Editor**: Monaco Editor
- **Real-time**: WebSocket

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

### Start Production Server

```bash
npm run start
```

## Project Structure

```
packages/dashboard/
├── app/                    # Next.js app router pages
│   ├── dashboard/          # Dashboard overview
│   ├── projects/           # Project management
│   ├── code/               # Code editor
│   ├── chat/               # AI chat interface
│   ├── analytics/          # Analytics and metrics
│   ├── settings/           # User settings
│   └── auth/               # Authentication pages
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   ├── dashboard/          # Dashboard-specific components
│   ├── projects/           # Project components
│   ├── code/               # Code editor components
│   ├── chat/               # Chat components
│   ├── analytics/          # Analytics components
│   └── settings/           # Settings components
├── lib/                    # Utilities and API clients
│   ├── api-client.ts       # API client
│   ├── store.ts            # Zustand stores
│   ├── utils.ts            # Utility functions
│   └── websocket.ts        # WebSocket hooks
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript type definitions
└── styles/                 # Global styles
```

## Key Pages

### `/dashboard`
Overview of platform activity, stats, and quick actions.

### `/projects`
Manage projects, create new ones, and browse existing projects.

### `/code`
Full-featured code editor with:
- Monaco editor integration
- File tree browser
- Multiple file tabs
- Real-time collaboration
- Auto-save

### `/chat`
AI chat interface with:
- Streaming responses
- Multiple model support
- Chat history
- Customizable settings

### `/analytics`
Detailed analytics with:
- Request metrics
- Cost tracking
- Token usage
- Provider performance
- Visual charts and graphs

### `/settings`
User settings for:
- Profile management
- Editor preferences
- API keys
- Billing information

## Component Library

This dashboard uses shadcn/ui components, which are built on Radix UI primitives. Available components include:

- Button
- Card
- Input
- Label
- Select
- Textarea
- Dialog
- Toast
- Tabs
- And many more...

See the `components/ui/` directory for all available components.

## State Management

State is managed using Zustand with the following stores:

- `useDashboardStore`: Global app state (user, projects, theme, etc.)
- `useChatStore`: Chat messages and streaming state
- `useEditorStore`: Open files and editor state
- `useCollabStore`: Real-time collaboration state

## API Integration

The dashboard communicates with the ClaudeFlare backend via:

- REST API for CRUD operations
- WebSocket for real-time updates
- Streaming API for AI responses

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_WS_URL=ws://localhost:8787
```

## Contributing

1. Follow the existing code style
2. Use TypeScript for all new code
3. Add proper error handling
4. Write clear component names
5. Use the established component library

## License

MIT
