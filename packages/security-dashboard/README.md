# ClaudeFlare Security Dashboard

An advanced security operations dashboard for ClaudeFlare, providing real-time monitoring, threat intelligence, incident response, vulnerability management, and compliance tracking.

## Features

### Security Metrics
- **Real-time Metrics**: Live monitoring of threat attempts, blocked attacks, active sessions, failed logins, API abuse, data exfiltration attempts, and anomaly scores
- **Historical Trends**: Time-series visualization with line, area, and bar charts
- **Metric Distribution**: Visual breakdown of security metrics
- **Anomaly Detection**: Automated detection of metrics exceeding thresholds
- **Metric Comparison**: Side-by-side comparison with warning and critical thresholds

### Threat Intelligence
- **Global Threat Map**: Interactive world map showing threat sources by geolocation
- **Threat Feeds**: Integration with CVE databases, IOC indicators, zero-day alerts
- **Attack Campaigns**: Tracking of coordinated attack campaigns
- **Threat Analytics**: Source analysis, target analysis, and campaign tracking

### Incident Response
- **Incident Management**: Comprehensive incident tracking and management
- **Task Tracking**: Integrated task management with progress tracking
- **Timeline View**: Complete incident timeline with all activities
- **Response Playbooks**: Predefined response procedures for common incident types
- **Impact Assessment**: Detailed impact analysis including affected users and systems
- **Collaboration**: Team assignment and collaboration features

### Vulnerability Scanner
- **Scan Results**: Comprehensive vulnerability scan results
- **Severity Breakdown**: Critical, high, medium, low, and info severity classification
- **Trend Analysis**: Historical vulnerability trend visualization
- **Remediation Tracking**: Track remediation progress
- **False Positive Management**: Mark and manage false positives
- **Scan Scheduling**: Automated and scheduled vulnerability scans

### Compliance Status
- **Framework Support**: SOC 2 Type II, ISO 27001, GDPR, HIPAA, PCI DSS
- **Control Tracking**: Individual compliance control monitoring
- **Evidence Management**: Upload and verify compliance evidence
- **Policy Management**: Security policy documentation and management
- **Audit Readiness**: Track audit dates and readiness status
- **Gap Analysis**: Identify and address compliance gaps

### Security Reports
- **Report Types**: Executive summary, technical details, compliance reports, incident reports, trend analysis
- **Multiple Formats**: PDF, HTML, JSON, CSV export options
- **Customizable Reports**: Generate reports for specific time periods
- **Automated Generation**: Schedule and automate report generation

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

```bash
npm run build
npm start
```

## Architecture

### Directory Structure

```
packages/security-dashboard/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   └── security/             # Security endpoints
│   │       ├── metrics/          # Security metrics API
│   │       ├── threats/          # Threat intelligence API
│   │       ├── incidents/        # Incident management API
│   │       ├── vulnerabilities/  # Vulnerability scanner API
│   │       ├── compliance/       # Compliance management API
│   │       └── reports/          # Report generation API
│   ├── page.tsx                  # Main dashboard page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── src/
│   ├── components/               # React components
│   │   ├── MetricCard.tsx        # Metric display card
│   │   ├── ThreatMap.tsx         # Global threat map
│   │   ├── IncidentList.tsx      # Incident list component
│   │   ├── IncidentDetail.tsx    # Incident detail view
│   │   ├── VulnerabilityDashboard.tsx  # Vulnerability management
│   │   ├── ComplianceDashboard.tsx     # Compliance tracking
│   │   └── SecurityReports.tsx   # Report generation
│   ├── metrics/                  # Metrics visualization
│   │   └── SecurityMetricsChart.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── useSecurityMetrics.ts
│   │   ├── useThreatIntelligence.ts
│   │   ├── useIncidents.ts
│   │   ├── useVulnerabilities.ts
│   │   └── useCompliance.ts
│   ├── lib/                      # Utility functions
│   │   └── utils.ts
│   └── types/                    # TypeScript types
│       └── index.ts
├── public/                       # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Key Technologies

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Recharts**: Chart library for data visualization
- **Radix UI**: Accessible UI components
- **Zustand**: State management
- **date-fns**: Date manipulation

## API Integration

The dashboard integrates with the following ClaudeFlare services:

- **Security Package**: `/api/security/metrics`
- **Threat Intelligence**: `/api/security/threats`
- **Incident Management**: `/api/security/incidents`
- **Vulnerability Scanner**: `/api/security/vulnerabilities`
- **Compliance Manager**: `/api/security/compliance`
- **Report Generator**: `/api/security/reports`

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8787
```

### Dashboard Configuration

Customize the dashboard by modifying the following:

1. **Refresh Intervals**: Adjust data refresh intervals in hooks
2. **Thresholds**: Configure warning and critical thresholds for metrics
3. **Compliance Frameworks**: Add or modify compliance frameworks
4. **Response Playbooks**: Customize incident response procedures

## Features Overview

### Real-time Monitoring
- Live updates every 30 seconds
- Configurable alert thresholds
- Visual indicators for anomalies
- Historical trend analysis

### Threat Intelligence
- Interactive global threat map
- Real-time threat feed updates
- Attack campaign tracking
- IOC indicator management

### Incident Management
- Comprehensive incident lifecycle
- Task assignment and tracking
- Timeline documentation
- Response playbook integration

### Vulnerability Management
- Automated scanning
- Severity-based prioritization
- Remediation tracking
- False positive management

### Compliance Tracking
- Multi-framework support
- Evidence collection
- Policy documentation
- Audit preparation

## Security Considerations

- All API routes should be protected with authentication
- Implement role-based access control (RBAC)
- Encrypt sensitive data in transit and at rest
- Regular security updates and dependency management
- Audit logging for all security-relevant actions

## Performance

- Server-side rendering for fast initial load
- Optimized bundle size with code splitting
- Efficient data fetching with pagination
- Cached API responses where appropriate

## Contributing

When contributing to the security dashboard:

1. Follow the existing code style and conventions
2. Add TypeScript types for new components
3. Write comprehensive tests
4. Update documentation
5. Ensure accessibility standards are met

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please refer to the main ClaudeFlare repository.
