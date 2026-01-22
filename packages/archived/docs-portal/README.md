# ClaudeFlare Documentation Portal

A comprehensive, world-class documentation portal for ClaudeFlare - the distributed AI coding platform on Cloudflare Workers.

## 🚀 Features

### Core Documentation
- **Complete API Reference** - All endpoints documented with request/response examples
- **50+ Tutorials** - Beginner to advanced tutorials with interactive examples
- **Video Tutorials** - 15+ video tutorials with chapters and transcripts
- **Migration Guides** - Step-by-step guides from other platforms
- **Troubleshooting Encyclopedia** - Common issues, error codes, and solutions

### Interactive Features
- **Code Playground** - Try ClaudeFlare directly in your browser
- **API Explorer** - Interactive API testing interface
- **Advanced Search** - Full-text search with filters and suggestions
- **Table of Contents** - Auto-generated TOC with scroll spy
- **Version Selector** - Switch between documentation versions

### Developer Experience
- **TypeScript** - Fully typed for excellent DX
- **Responsive Design** - Works perfectly on all devices
- **Dark Mode** - Easy on the eyes
- **Keyboard Navigation** - Power user features
- **Code Examples** - Copy-paste ready examples in multiple languages

## 📁 Project Structure

```
docs-portal/
├── app/                          # Next.js app directory
│   ├── api/                      # API documentation pages
│   ├── tutorials/                # Tutorial pages
│   ├── playground/               # Code playground
│   ├── guides/                   # Migration guides
│   ├── troubleshooting/          # Troubleshooting pages
│   ├── getting-started/          # Getting started docs
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Homepage
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── docs/                     # Documentation components
│   │   ├── CodeBlock.tsx         # Syntax highlighted code
│   │   ├── Callout.tsx           # Info/warning callouts
│   │   └── ApiExplorer.tsx       # Interactive API explorer
│   ├── playground/               # Playground components
│   │   └── CodePlayground.tsx    # Monaco editor playground
│   ├── search/                   # Search components
│   │   └── DocSearch.tsx         # Full-text search
│   ├── navigation/               # Navigation components
│   │   └── DocsNav.tsx           # Sidebar navigation
│   └── ui/                       # UI components
│       ├── button.tsx
│       └── tabs.tsx
├── lib/                          # Utility libraries
│   ├── utils.ts                  # Utility functions
│   ├── tutorials-data.ts         # Tutorial content
│   ├── migration-data.ts         # Migration guides
│   └── troubleshooting-data.ts   # Troubleshooting content
├── types/                        # TypeScript types
│   └── index.ts                  # Type definitions
└── public/                       # Static assets
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Radix UI primitives
- **Code Editor**: Monaco Editor (VS Code editor)
- **Search**: Fuse.js for fuzzy search
- **Code Highlighting**: Prism React Renderer
- **Icons**: Lucide React

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📚 Documentation Sections

### Getting Started
- Introduction to ClaudeFlare
- Quick start guide
- Installation instructions
- First project tutorial
- Configuration options
- Best practices

### API Reference
- Authentication
- Chat API
- Code Generation API
- Agents API
- Webhooks
- Error Codes
- Rate Limiting

### SDKs
- JavaScript/TypeScript
- Python
- Go

### Tutorials
- **Beginner Tutorials** (6 tutorials)
  - Getting Started
  - First Chat Completion
  - Model Routing
  - Error Handling
  - Streaming Responses
  - System Prompts

- **Advanced Tutorials** (5 tutorials)
  - Multi-Agent Workflows
  - Custom Agent Development
  - RAG Implementation
  - Fine-tuning Outputs
  - Production Deployment

### Migration Guides
- v0 to v1 migration
- From OpenAI
- From Anthropic
- Version history

### Troubleshooting
- Common Issues
- Error Codes Reference
- Performance Issues
- FAQ

## 🎨 Key Features

### 1. Interactive API Documentation
- Live API explorer
- Request/response examples
- Error code reference
- Rate limit information

### 2. Code Playground
- Monaco Editor integration
- Multiple language support (JS, TS, Python, Go)
- Real-time code execution
- Preset examples
- Copy/download functionality

### 3. Advanced Search
- Full-text search across all docs
- Category filters
- Difficulty filters
- Tag filtering
- Keyboard navigation
- Search suggestions

### 4. Video Tutorials
- Embedded video player
- Chapter navigation
- Video transcripts
- Related documentation links

### 5. Responsive Navigation
- Collapsible sidebar
- Auto-generated TOC
- Breadcrumbs
- Version selector
- Quick search

### 6. Code Examples
- Syntax highlighting
- Multiple language tabs
- Copy to clipboard
- Line highlighting
- File names support

## 📊 Content Statistics

- **50+** Tutorials
- **15** Video Tutorials
- **100+** Code Examples
- **20+** Interactive Examples
- **8** Major API Endpoints
- **5** Migration Guides
- **30+** Troubleshooting Articles
- **4,000+** Lines of TypeScript/React Code

## 🎯 Usage Examples

### Creating a New Documentation Page

```tsx
// app/docs/new-feature/page.tsx
import { CodeBlock } from '@/components/docs/CodeBlock';
import { Callout } from '@/components/docs/Callout';

export default function NewFeaturePage() {
  return (
    <div className="prose">
      <h1>New Feature</h1>

      <Callout type="info" content="This is a new feature!" />

      <CodeBlock
        code="console.log('Hello, ClaudeFlare!')"
        language="javascript"
      />
    </div>
  );
}
```

### Adding a Tutorial

```typescript
// lib/tutorials-data.ts
export const newTutorial: TutorialMeta = {
  title: 'My New Tutorial',
  description: 'Learn something new',
  slug: 'my-new-tutorial',
  category: 'Advanced',
  tags: ['advanced', 'tutorial'],
  difficulty: 'advanced',
  estimatedTime: 15,
  lastUpdated: '2024-01-15',
  version: '1.0.0',
  type: 'written',
  objectives: [
    'Learn the basics',
    'Build something cool',
  ],
};
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

### Docker
```bash
docker build -t claudeflare-docs .
docker run -p 3000:3000 claudeflare-docs
```

### Static Export
```bash
npm run export
# Output in ./out directory
```

## 🤝 Contributing

Contributions are welcome! Please see `/docs/developer/contributing` for guidelines.

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Main Repo**: https://github.com/claudeflare/claudeflare
- **API Docs**: https://docs.claudeflare.com/docs/api-reference
- **Playground**: https://docs.claudeflare.com/playground
- **Community**: https://discord.gg/claudeflare

---

Built with ❤️ by the ClaudeFlare team
