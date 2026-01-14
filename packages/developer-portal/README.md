# ClaudeFlare Developer Portal

A comprehensive, world-class developer portal for ClaudeFlare - a distributed AI coding platform on Cloudflare Workers.

## Features

### API Playground
- **Interactive endpoint testing** - Test any ClaudeFlare API endpoint with a visual interface
- **Request builder** - Build complex requests with query parameters, headers, and body
- **Response viewer** - View responses with syntax highlighting and metadata
- **Code generation** - Generate code snippets in 8+ programming languages
- **Save and share** - Save requests for later use and share with your team
- **History tracking** - Automatically track all your API requests
- **Real-time execution** - Send requests and see responses in real-time

### Code Snippet Generator
- **Multi-language support** - Generate code for TypeScript, JavaScript, Python, Go, Rust, Java, PHP, and cURL
- **Copy-paste ready** - All snippets are production-ready
- **Authentication included** - Snippets include proper API key authentication
- **Error handling** - Built-in error handling examples
- **One-click copy** - Easily copy code to clipboard
- **Download support** - Download snippets as files

### Webhook Debugger
- **Real-time webhook receiver** - Receive webhooks in real-time via WebSocket
- **Event logging** - Automatically log all webhook events
- **Payload inspection** - Inspect webhook payloads with syntax highlighting
- **Replay functionality** - Replay webhook events for testing
- **Signature verification** - Verify webhook signatures for security
- **Filter and search** - Filter events by type and search through payloads

### Usage Analytics
- **Request volume charts** - Visualize request volume over time
- **Error rate tracking** - Monitor error rates and identify issues
- **Latency distribution** - View P50, P95, and P99 latency percentiles
- **Provider usage breakdown** - See which AI providers are being used
- **Cost analysis** - Track costs associated with API usage
- **Interactive charts** - Interactive charts powered by Recharts

### Billing & Costs
- **Usage-based billing** - Transparent pricing based on actual usage
- **Cost breakdown** - Detailed cost breakdown by feature and endpoint
- **Cost forecasting** - Predict future costs with machine learning
- **Budget alerts** - Set up alerts to stay within budget
- **Invoice history** - View and download all past invoices
- **Payment management** - Manage payment methods and billing cycles

### Community Features
- **Developer forums** - Connect with other developers
- **Q&A section** - Ask questions and get answers
- **Code sharing** - Share code snippets with the community
- **Plugin showcase** - Discover and install community plugins
- **User-generated content** - Contribute tutorials, examples, and more

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **Charts**: Recharts
- **Code Editor**: Monaco Editor
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Real-time**: Socket.IO
- **Animations**: Framer Motion
- **Date Handling**: date-fns

## Installation

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

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=https://api.claudeflare.dev
NEXT_PUBLIC_WS_URL=wss://ws.claudeflare.dev
```

## Project Structure

```
developer-portal/
├── app/                      # Next.js App Router pages
│   ├── playground/           # API playground page
│   ├── analytics/            # Usage analytics page
│   ├── billing/              # Billing and costs page
│   └── community/            # Community features page
├── components/               # React components
│   ├── playground/           # Playground components
│   │   ├── RequestBuilder.tsx
│   │   ├── ResponseViewer.tsx
│   │   ├── CodeGenerator.tsx
│   │   ├── HistoryPanel.tsx
│   │   ├── SavedRequests.tsx
│   │   └── WebhookDebugger.tsx
│   ├── analytics/            # Analytics components
│   │   ├── UsageChart.tsx
│   │   ├── MetricsCards.tsx
│   │   ├── TopEndpoints.tsx
│   │   ├── LatencyDistribution.tsx
│   │   ├── ProviderBreakdown.tsx
│   │   └── DateRangePicker.tsx
│   ├── billing/              # Billing components
│   │   ├── BillingOverview.tsx
│   │   ├── CostForecast.tsx
│   │   ├── InvoiceHistory.tsx
│   │   └── BudgetAlerts.tsx
│   ├── community/            # Community components
│   │   ├── Forum.tsx
│   │   ├── CodeSharing.tsx
│   │   └── PluginShowcase.tsx
│   ├── ui/                   # UI primitives
│   └── code/                 # Code-related components
├── lib/                      # Utilities and libraries
│   ├── api/                  # API clients
│   │   ├── client.ts
│   │   ├── analytics.ts
│   │   ├── community.ts
│   │   └── webhook.ts
│   ├── hooks/                # Custom React hooks
│   │   ├── usePlayground.ts
│   │   ├── useAnalytics.ts
│   │   ├── useCodeGenerator.ts
│   │   ├── useWebhookDebugger.ts
│   │   └── useLocalStorage.ts
│   └── utils/                # Utility functions
│       ├── cn.ts
│       └── codegen.ts
└── types/                    # TypeScript type definitions
    ├── api.ts
    └── index.ts
```

## Key Features Explained

### API Playground
The API Playground allows developers to:
- Test API endpoints without writing code
- Build complex requests with parameters, headers, and body
- View responses with syntax highlighting
- Generate code in multiple languages
- Save requests for later use
- View request history

### Code Generation
The code generator creates production-ready code snippets:
- Supports 8+ programming languages
- Includes authentication
- Error handling built-in
- Copy or download snippets
- Dependencies listed

### Webhook Debugger
Debug webhooks with a visual interface:
- Real-time event streaming
- Event logging and history
- Payload inspection
- Signature verification
- Replay functionality

### Analytics Dashboard
Monitor your API usage:
- Request volume charts
- Error rate tracking
- Latency distribution (P50, P95, P99)
- Provider usage breakdown
- Cost analysis

### Billing & Costs
Manage your spending:
- Usage-based billing
- Cost breakdown by feature
- Cost forecasting with ML
- Budget alerts
- Invoice history and downloads

### Community
Connect with other developers:
- Discussion forums
- Q&A section
- Code sharing
- Plugin marketplace
- User-generated content

## Development

### Adding New Features

1. **New API Endpoint**:
   - Add to `lib/constants.ts`
   - Update type definitions in `types/api.ts`
   - Add to API client in `lib/api/client.ts`

2. **New Component**:
   - Create in appropriate `components/` directory
   - Follow existing patterns
   - Use TypeScript with proper types
   - Include responsive design

3. **New Page**:
   - Create in `app/` directory
   - Follow Next.js 14 App Router conventions
   - Use Server Components where possible
   - Implement proper error handling

### Code Style

- Use TypeScript for all files
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful comments
- Include JSDoc for functions

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run linter
npm run lint

# Type check
npm run type-check
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker
```bash
# Build image
docker build -t claudeflare/developer-portal .

# Run container
docker run -p 3000:3000 claudeflare/developer-portal
```

### Manual
```bash
# Build
npm run build

# Start
npm start
```

## Performance

- **Server Components** - Use Next.js Server Components by default
- **Code Splitting** - Automatic code splitting with Next.js
- **Image Optimization** - Use Next.js Image component
- **Bundle Analysis** - Analyze bundle size with `npm run analyze`
- **Lazy Loading** - Lazy load heavy components

## Security

- **API Key Protection** - Never expose API keys in client code
- **CORS Configuration** - Configure CORS properly
- **Rate Limiting** - Implement rate limiting on API routes
- **Input Validation** - Validate all user inputs
- **SQL Injection** - Use parameterized queries

## Monitoring

- **Error Tracking** - Integrate with Sentry
- **Analytics** - Use Google Analytics or Plausible
- **Performance** - Monitor with Vercel Analytics
- **Uptime** - Set up uptime monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [docs.claudeflare.dev](https://docs.claudeflare.dev)
- **Community**: [community.claudeflare.dev](https://community.claudeflare.dev)
- **Email**: support@claudeflare.dev
- **Discord**: [discord.gg/claudeflare](https://discord.gg/claudeflare)

## Roadmap

- [ ] Mobile apps (iOS, Android)
- [ ] Desktop apps (Windows, macOS, Linux)
- [ ] Advanced analytics with ML
- [ ] Automated testing suite
- [ ] Performance optimization
- [ ] Internationalization (i18n)
- [ ] Dark mode improvements
- [ ] Offline support
- [ ] PWA capabilities
- [ ] API versioning

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Charts from [Recharts](https://recharts.org/)
- Icons from [Lucide](https://lucide.dev/)
