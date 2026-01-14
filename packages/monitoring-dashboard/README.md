# ClaudeFlare Monitoring Dashboard

An advanced, real-time monitoring dashboard system for the ClaudeFlare platform, featuring comprehensive alerting, incident management, performance insights, and anomaly detection.

## Features

### 📊 Real-Time Dashboard Builder
- **Drag-and-Drop Interface**: Intuitive widget-based dashboard creation
- **Customizable Widgets**: Line charts, bar charts, gauge charts, counters, tables, heatmaps, and status indicators
- **Responsive Layout**: Grid-based layout system with breakpoints for different screen sizes
- **Real-Time Updates**: WebSocket-based live data streaming
- **Dashboard Templates**: Pre-built templates for common use cases
- **Save/Load Dashboards**: Persist and share custom dashboards

### 🚨 Alert Management
- **Multi-Severity Alerts**: Critical, high, medium, low, and info severity levels
- **Alert Types**: Threshold-based, anomaly detection, manual, and composite alerts
- **Alert Workflow**: Open → Acknowledged → Resolved lifecycle
- **Alert Silencing**: Temporary silencing with configurable duration
- **Rich Context**: Labels, annotations, and metadata for comprehensive alert information
- **Bulk Actions**: Mass acknowledge, resolve, or silence operations
- **Alert History**: Complete audit trail of alert lifecycle

### ⚠️ Incident Timeline
- **Visual Timeline**: Chronological view of incident events
- **Status Tracking**: Investigating → Identified → Monitoring → Resolved → Postmortem
- **Impact Assessment**: Critical, high, medium, and low impact levels
- **Related Alerts**: Link alerts to incidents
- **Incident Updates**: Public and private updates with timestamps
- **Postmortem Integration**: Built-in postmortem creation and management
- **Team Assignment**: Assign incidents to team members

### 💡 Performance Insights
- **AI-Powered Analysis**: Automated detection of performance issues
- **Categories**: Performance, availability, capacity, cost, security, reliability, scalability
- **Insight Types**: Bottlenecks, optimizations, trends, anomalies, forecasts, recommendations
- **Confidence Scoring**: Machine learning confidence levels for insights
- **Actionable Recommendations**: Specific, prioritized recommendations with effort estimates
- **Evidence-Based**: Supporting metrics and data for each insight
- **Dismissal Tracking**: Mark insights as dismissed to reduce noise

### 🎯 Anomaly Detection
- **Advanced Algorithms**: Statistical and ML-based anomaly detection
- **Anomaly Types**: Spikes, drops, trend changes, pattern breaks, outliers
- **Root Cause Analysis**: Automated investigation of potential causes
- **Pattern Recognition**: Identifies seasonal, trend, cyclical, and irregular patterns
- **Correlation Analysis**: Finds correlations between related metrics
- **Investigation Workflow**: Structured steps for investigating anomalies
- **Confidence Levels**: Probability scores for anomaly accuracy

### 📈 Widget Types

#### Chart Widgets
- **Line Chart**: Time-series data with multiple series
- **Bar Chart**: Categorical comparisons
- **Area Chart**: Volume and trends
- **Pie Chart**: Proportional data
- **Heatmap**: 2D data visualization with color gradients

#### Metric Widgets
- **Counter**: Single metric display with trends
- **Gauge Chart**: Progress and percentage visualization
- **Status Indicator**: Operational status with history

#### Data Widgets
- **Table**: Sortable, filterable tabular data
- **Log Viewer**: Real-time log streaming

## Architecture

```
monitoring-dashboard/
├── src/
│   ├── widgets/           # Dashboard widgets
│   │   ├── LineChartWidget.tsx
│   │   ├── BarChartWidget.tsx
│   │   ├── GaugeChartWidget.tsx
│   │   ├── CounterWidget.tsx
│   │   ├── TableWidget.tsx
│   │   ├── HeatmapWidget.tsx
│   │   └── StatusIndicatorWidget.tsx
│   ├── builder/           # Dashboard builder
│   │   ├── DashboardBuilder.tsx
│   │   ├── WidgetLibrary.tsx
│   │   ├── SortableWidget.tsx
│   │   └── WidgetConfigPanel.tsx
│   ├── alerts/            # Alert management
│   │   ├── AlertList.tsx
│   │   └── AlertDetails.tsx
│   ├── timeline/          # Incident timeline
│   │   └── IncidentTimeline.tsx
│   ├── insights/          # Performance insights
│   │   └── PerformanceInsights.tsx
│   ├── anomaly/           # Anomaly detection
│   │   └── AnomalyDetection.tsx
│   ├── contexts/          # React contexts
│   │   └── RealTimeContext.tsx
│   ├── hooks/             # Custom hooks
│   │   └── useRealTimeData.ts
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   └── lib/               # Utilities
│       └── utils.ts
├── app/                   # Next.js app
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
└── components/            # Shared UI components
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom components
- **Charts**: Recharts
- **Drag & Drop**: dnd-kit
- **Real-Time**: Socket.IO
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Components**: Radix UI primitives

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# or with yarn
yarn install

# or with pnpm
pnpm install
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Create a `.env.local` file:

```env
# WebSocket server URL
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# API endpoints
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Authentication (optional)
NEXT_PUBLIC_AUTH_TOKEN=your-token-here
```

## Usage

### Creating a Dashboard

1. Navigate to the Dashboard tab
2. Click "Add Widget" or drag widgets from the library
3. Configure widget data sources and display settings
4. Arrange widgets using drag-and-drop
5. Save your dashboard

### Setting Up Alerts

1. Go to the Alerts tab
2. Click "New Alert Rule"
3. Configure alert conditions:
   - Threshold-based alerts
   - Anomaly detection alerts
   - Composite alerts with multiple conditions
4. Set up notification channels
5. Define alert actions and routing

### Managing Incidents

1. View active incidents in the Incidents tab
2. Click on an incident to see details
3. Update incident status and add timeline events
4. Assign team members
5. Create postmortem after resolution

### Investigating Anomalies

1. Navigate to the Anomalies tab
2. Review detected anomalies with severity and confidence scores
3. View patterns and correlations
4. Follow investigation steps
5. Mark as resolved or false positive

## Data Source Configuration

### Metric Data Source
```typescript
{
  type: 'metric';
  metricName: 'cpu_usage';
  filters: { host: 'server-1' };
  aggregations: [{ type: 'avg', field: 'value' }];
}
```

### Query Data Source
```typescript
{
  type: 'query';
  query: 'SELECT * FROM metrics WHERE name = "response_time"';
  queryLanguage: 'SQL';
}
```

### API Data Source
```typescript
{
  type: 'api';
  endpoint: 'https://api.example.com/metrics';
  method: 'GET';
  headers: { Authorization: 'Bearer token' };
}
```

### Stream Data Source
```typescript
{
  type: 'stream';
  streamName: 'live-metrics';
  bufferSize: 100;
}
```

## WebSocket Events

### Client → Server
```typescript
// Subscribe to metric
socket.emit('subscribe', { metric: 'cpu_usage' });

// Unsubscribe from metric
socket.emit('unsubscribe', { metric: 'cpu_usage' });

// Send custom message
socket.emit('message', { type: 'custom', data: {} });
```

### Server → Client
```typescript
// Metric update
socket.on('metric', {
  name: 'cpu_usage',
  value: 75.5,
  timestamp: new Date(),
  labels: { host: 'server-1' }
});

// Alert triggered
socket.on('alert', {
  id: 'alert-123',
  name: 'High CPU',
  severity: 'critical',
  // ... other alert fields
});

// Incident created
socket.on('incident', {
  id: 'incident-456',
  title: 'Database Outage',
  status: 'investigating',
  // ... other incident fields
});
```

## Customization

### Custom Widgets

Create a custom widget by extending the `BaseWidget` type:

```typescript
interface CustomWidget extends BaseWidget {
  type: 'custom';
  config: {
    // Your custom configuration
  };
}
```

### Custom Data Sources

Implement custom data sources by creating a data fetcher:

```typescript
async function fetchCustomData(dataSource: CustomDataSource) {
  const response = await fetch(dataSource.endpoint);
  return await response.json();
}
```

### Custom Alert Actions

Add custom alert actions in the alert configuration:

```typescript
{
  type: 'custom',
  enabled: true,
  config: {
    webhook: 'https://hooks.example.com/alert',
    template: 'custom-alert-template',
  },
}
```

## Performance Optimization

- **Data Caching**: Client-side caching with TanStack Query
- **Lazy Loading**: Widgets load data on demand
- **Debouncing**: Input debouncing for search and filters
- **Virtual Scrolling**: Efficient rendering of large lists
- **WebSocket Reconnection**: Automatic reconnection with backoff
- **Request Throttling**: Rate limiting for API requests

## Security Considerations

- **Input Validation**: All user inputs are validated
- **XSS Prevention**: React's built-in XSS protection
- **Authentication**: Token-based authentication support
- **Authorization**: Role-based access control for widgets and dashboards
- **Secure WebSocket**: WSS for encrypted connections
- **CORS Config**: Proper CORS configuration for API endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/claudeflare/monitoring-dashboard/issues
- Documentation: https://docs.claudeflare.com/monitoring
- Community: https://discord.gg/claudeflare
