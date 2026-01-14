# Security Dashboard API Reference

## Base URL
```
http://localhost:3000/api/security
```

## Authentication
All API requests require authentication via JWT token:
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## Endpoints

### Security Metrics

#### Get Security Metrics
```http
GET /api/security/metrics
```

**Response:**
```json
{
  "realTime": {
    "threatAttempts": {
      "id": "1",
      "name": "Threat Attempts",
      "value": 1247,
      "unit": "count",
      "trend": "up",
      "change": 12.5,
      "threshold": {
        "warning": 1000,
        "critical": 1500
      },
      "timestamp": "2024-01-13T10:30:00Z"
    },
    "blockedAttacks": { ... },
    "activeSessions": { ... },
    "failedLogins": { ... },
    "apiAbuse": { ... },
    "dataExfiltrationAttempts": { ... },
    "anomalyScore": { ... }
  },
  "historical": {
    "timeline": ["2024-01-13T00:00:00Z", ...],
    "threatAttempts": [800, 850, ...],
    "blockedAttacks": [700, 750, ...],
    "failedLogins": [150, 160, ...],
    "apiAbuse": [50, 55, ...]
  }
}
```

**Cache Duration:** 30 seconds

---

### Threat Intelligence

#### Get Threat Feeds
```http
GET /api/security/threats
```

**Response:**
```json
[
  {
    "id": "cve-feed",
    "name": "CVE Database",
    "type": "cve",
    "updateFrequency": "hourly",
    "lastUpdate": "2024-01-13T10:30:00Z",
    "status": "active",
    "indicators": []
  }
]
```

#### Get Threat Map Data
```http
GET /api/security/threats?type=map
```

**Response:**
```json
[
  {
    "latitude": 40.7128,
    "longitude": -74.006,
    "count": 234,
    "severity": "high",
    "country": "United States",
    "city": "New York"
  }
]
```

#### Get Attack Campaigns
```http
GET /api/security/threats?type=campaigns
```

**Response:**
```json
[
  {
    "id": "1",
    "name": "Operation Dark Cloud",
    "description": "Coordinated DDoS attack targeting financial institutions",
    "status": "active",
    "startDate": "2024-01-06T10:00:00Z",
    "targets": ["api.example.com"],
    "tactics": ["DDoS", "Amplification Attack"],
    "severity": "critical",
    "attribution": "Nation-State Actor"
  }
]
```

---

### Incident Management

#### List Incidents
```http
GET /api/security/incidents?page=1&pageSize=10&severity=critical,high&status=open
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `pageSize` (integer): Items per page (default: 10)
- `severity` (string): Comma-separated severities
- `status` (string): Comma-separated statuses

**Response:**
```json
{
  "data": [
    {
      "id": "1",
      "title": "Suspicious Database Access",
      "description": "Multiple failed login attempts detected...",
      "severity": "high",
      "status": "investigating",
      "priority": 2,
      "assignedTo": "security@claudeflare.com",
      "createdBy": "system",
      "createdAt": "2024-01-13T09:30:00Z",
      "updatedAt": "2024-01-13T10:30:00Z",
      "tags": ["database", "brute-force"],
      "tasks": [...],
      "timeline": [...],
      "affectedAssets": ["prod-db-01"],
      "impact": {
        "usersAffected": 0,
        "systemsAffected": ["prod-db-01"],
        "dataExposed": false
      }
    }
  ],
  "success": true,
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### Get Incident Details
```http
GET /api/security/incidents/:id
```

#### Create Incident
```http
POST /api/security/incidents
Content-Type: application/json

{
  "title": "New Security Incident",
  "description": "Description of the incident",
  "severity": "high",
  "priority": 2,
  "assignedTo": "security@claudeflare.com",
  "tags": ["network", "intrusion"],
  "affectedAssets": ["server-01"],
  "impact": {
    "usersAffected": 0,
    "systemsAffected": ["server-01"],
    "dataExposed": false
  }
}
```

#### Update Incident
```http
PATCH /api/security/incidents/:id
Content-Type: application/json

{
  "status": "contained",
  "resolution": "Threat has been contained and eradicated"
}
```

#### Delete Incident
```http
DELETE /api/security/incidents/:id
```

#### Add Timeline Entry
```http
POST /api/security/incidents/:id/timeline
Content-Type: application/json

{
  "timestamp": "2024-01-13T10:30:00Z",
  "action": "Action Taken",
  "description": "Description of the action",
  "performedBy": "user@claudeflare.com"
}
```

---

### Vulnerability Management

#### List Vulnerabilities
```http
GET /api/security/vulnerabilities?severity=critical,high&status=open
```

**Response:**
```json
[
  {
    "id": "1",
    "cveId": "CVE-2024-1234",
    "title": "Remote Code Execution in Web Framework",
    "description": "A critical RCE vulnerability...",
    "severity": "critical",
    "cvssScore": 9.8,
    "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "affectedComponent": "@claudeflare/framework",
    "affectedVersion": "2.1.0",
    "fixedVersion": "2.1.1",
    "discoveredAt": "2024-01-12T10:00:00Z",
    "status": "open",
    "falsePositive": false,
    "remediation": "Upgrade to version 2.1.1",
    "exploits": true,
    "patches": true
  }
]
```

#### List Vulnerability Scans
```http
GET /api/security/vulnerabilities?type=scans
```

**Response:**
```json
[
  {
    "id": "scan-1",
    "name": "Full Infrastructure Scan",
    "type": "full",
    "status": "completed",
    "startTime": "2024-01-12T10:00:00Z",
    "endTime": "2024-01-12T14:00:00Z",
    "duration": 14400,
    "summary": {
      "total": 234,
      "critical": 3,
      "high": 15,
      "medium": 67,
      "low": 98,
      "info": 51
    },
    "targets": ["production", "staging"],
    "scheduled": true
  }
]
```

#### Get Vulnerability Trend
```http
GET /api/security/vulnerabilities?type=trend&days=30
```

**Response:**
```json
[
  {
    "date": "2024-01-13T00:00:00Z",
    "critical": 3,
    "high": 15,
    "medium": 67,
    "low": 98,
    "info": 51
  }
]
```

#### Create Scan
```http
POST /api/security/vulnerabilities/scans
Content-Type: application/json

{
  "name": "Quick Scan",
  "type": "quick",
  "targets": ["production"],
  "scheduled": false
}
```

#### Update Vulnerability
```http
PATCH /api/security/vulnerabilities/:id
Content-Type: application/json

{
  "status": "resolved",
  "remediation": "Upgraded to version 2.1.1"
}
```

---

### Compliance Management

#### List Compliance Frameworks
```http
GET /api/security/compliance?type=frameworks
```

**Response:**
```json
[
  {
    "id": "soc2",
    "name": "SOC 2 Type II",
    "version": "2017",
    "description": "Service Organization Control 2 compliance...",
    "status": "compliant",
    "lastAudit": "2023-06-01T00:00:00Z",
    "nextAudit": "2024-06-01T00:00:00Z",
    "overallScore": 94
  }
]
```

#### List Compliance Controls
```http
GET /api/security/compliance?type=controls&frameworkId=soc2
```

**Response:**
```json
[
  {
    "id": "soc2-cc1.1",
    "frameworkId": "soc2",
    "name": "Control 1.1",
    "description": "Establishes a security policy...",
    "category": "Governance",
    "status": "compliant",
    "evidence": [],
    "policies": ["policy-1"],
    "owner": "CISO"
  }
]
```

#### List Policies
```http
GET /api/security/compliance?type=policies
```

**Response:**
```json
[
  {
    "id": "policy-1",
    "name": "Information Security Policy",
    "description": "High-level policy governing security...",
    "category": "Governance",
    "version": "3.2",
    "status": "active",
    "content": "This policy establishes...",
    "createdAt": "2023-01-01T00:00:00Z",
    "approvedBy": "CISO"
  }
]
```

#### Upload Evidence
```http
POST /api/security/compliance/evidence?controlId=soc2-cc1.1
Content-Type: multipart/form-data

file: <binary>
metadata: {
  "type": "document",
  "title": "Security Policy Document",
  "description": "Current version of security policy"
}
```

#### Update Control
```http
PATCH /api/security/compliance/controls/:id
Content-Type: application/json

{
  "status": "compliant",
  "lastReviewed": "2024-01-13T10:00:00Z"
}
```

---

### Security Reports

#### List Reports
```http
GET /api/security/reports
```

#### Generate Report
```http
POST /api/security/reports
Content-Type: application/json

{
  "title": "Weekly Security Summary",
  "type": "executive",
  "description": "Executive summary of security posture",
  "period": {
    "start": "2024-01-06T00:00:00Z",
    "end": "2024-01-13T00:00:00Z"
  },
  "format": "pdf"
}
```

#### Download Report
```http
GET /api/security/reports/:id/download
```

---

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common Error Codes:**
- `UNAUTHORIZED`: Invalid or missing authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `INTERNAL_ERROR`: Server error

---

## Rate Limiting

- **Default Limit:** 100 requests per minute per user
- **Burst Limit:** 200 requests per minute
- **Headers:**
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time (Unix timestamp)

---

## Pagination

List endpoints support pagination:

**Request:**
```http
GET /api/security/incidents?page=2&pageSize=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Filtering & Sorting

### Filter Parameters
```http
GET /api/security/incidents?severity=critical,high&status=open,investigating
```

### Sort Parameters
```http
GET /api/security/incidents?sortBy=createdAt&sortOrder=desc
```

---

## Webhook Events

The dashboard can send webhook notifications for security events:

**Event Types:**
- `incident.created`: New incident created
- `incident.updated`: Incident status changed
- `vulnerability.detected`: New vulnerability found
- `threshold.exceeded`: Metric threshold exceeded
- `compliance.gap`: Compliance gap identified

**Webhook Payload:**
```json
{
  "event": "incident.created",
  "timestamp": "2024-01-13T10:30:00Z",
  "data": {
    "id": "1",
    "title": "Security Incident",
    "severity": "high"
  }
}
```

---

## SDK Integration

### TypeScript SDK

```typescript
import { SecurityDashboardClient } from '@claudeflare/security-dashboard-sdk';

const client = new SecurityDashboardClient({
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key'
});

// Fetch metrics
const metrics = await client.security.getMetrics();

// List incidents
const incidents = await client.incidents.list({
  severity: ['critical', 'high'],
  status: ['open']
});

// Create incident
const incident = await client.incidents.create({
  title: 'New Incident',
  severity: 'high',
  description: '...'
});
```

---

## Testing

### Mock API Responses

The development environment includes mock data for all endpoints. No backend required for testing.

### Example cURL Commands

```bash
# Get metrics
curl http://localhost:3000/api/security/metrics

# List incidents
curl http://localhost:3000/api/security/incidents?page=1&pageSize=10

# Create incident
curl -X POST http://localhost:3000/api/security/incidents \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Incident","severity":"high"}'
```

---

## Changelog

### Version 1.0.0 (2024-01-13)
- Initial release
- Security metrics endpoints
- Threat intelligence endpoints
- Incident management endpoints
- Vulnerability management endpoints
- Compliance management endpoints
- Report generation endpoints
