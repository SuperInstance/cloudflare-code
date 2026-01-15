# Security Testing API Documentation

This document describes the Security Testing API endpoints available in the ClaudeFlare Cloudflare Worker.

## Base URL
All API endpoints are available at:
```
/api/v1
```

## Endpoints

### 1. Security Testing

#### POST /api/v1/security-test
Perform a comprehensive security scan on the specified target.

**Request Body:**
```json
{
  "target": "string (required)",
  "targetType": "code | url | api | dependency (optional)",
  "options": {
    "enableSAST": boolean,
    "enableDAST": boolean,
    "enableSCA": boolean,
    "enableCompliance": boolean,
    "frameworks": ["SOC_2", "ISO_27001", ...],
    "severityThreshold": "critical | high | medium | low | info",
    "maxFiles": number,
    "timeout": number
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "scanId": "scan_1234567890",
    "status": "completed",
    "findings": [
      {
        "id": "finding-1",
        "title": "SQL Injection",
        "description": "Potential SQL injection vulnerability found",
        "severity": {
          "level": "high",
          "score": 8,
          "cvss": 9.8
        },
        "type": "SQL_INJECTION",
        "file": "app.js",
        "line": 15,
        "column": 8,
        "remediation": "Use parameterized queries",
        "references": ["https://owasp.org"]
      }
    ],
    "summary": {
      "totalFindings": 5,
      "critical": 1,
      "high": 2,
      "medium": 1,
      "low": 1,
      "info": 0
    },
    "scanTypes": {
      "sast": {...},
      "dast": null,
      "sca": {...}
    },
    "duration": 15000
  }
}
```

#### POST /api/v1/security-test/quick
Quick security test for common use cases. Automatically detects target type.

**Request Body:**
```json
{
  "target": "string (required)"
}
```

#### GET /api/v1/security-test/status/:scanId
Get the status of a specific scan.

#### GET /api/v1/security-test/types
Get all available scan types.

#### GET /api/v1/security-test/compliance-frameworks
Get all available compliance frameworks.

#### GET /api/v1/security-test/stats
Get security testing statistics.

#### GET /api/v1/security-test/vulnerability/:ecosystem/:package/:version
Look up specific vulnerabilities for a package.

### 2. Health Checks

#### GET /api/v1/security-test/health
Check the health of the security testing service.

### 3. Code Review Endpoints (existing)
- POST /api/v1/code-review
- POST /api/v1/code-review/:filePath
- GET /api/v1/code-review/languages
- GET /api/v1/code-review/stats
- GET /api/v1/code-review/health

## Usage Examples

### 1. Scan Code for Security Vulnerabilities
```bash
curl -X POST https://your-worker.workers.dev/api/v1/security-test \
  -H "Content-Type: application/json" \
  -d '{
    "target": "./src",
    "targetType": "code",
    "options": {
      "enableSAST": true,
      "enableSCA": true,
      "severityThreshold": "medium"
    }
  }'
```

### 2. Quick Scan
```bash
curl -X POST https://your-worker.workers.dev/api/v1/security-test/quick \
  -H "Content-Type: application/json" \
  -d '{"target": "https://example.com"}'
```

### 3. Scan Dependencies
```bash
curl -X POST https://your-worker.workers.dev/api/v1/security-test \
  -H "Content-Type: application/json" \
  -d '{
    "target": "./package.json",
    "targetType": "dependency",
    "options": {
      "enableSCA": true,
      "includeDevDependencies": true
    }
  }'
```

### 4. Compliance Scan
```bash
curl -X POST https://your-worker.workers.dev/api/v1/security-test \
  -H "Content-Type: application/json" \
  -d '{
    "target": "./src",
    "targetType": "code",
    "options": {
      "enableCompliance": true,
      "frameworks": ["SOC_2", "ISO_27001"],
      "severityThreshold": "high"
    }
  }'
```

### 5. Vulnerability Lookup
```bash
curl https://your-worker.workers.dev/api/v1/security-test/vulnerability/npm/express/4.18.0
```

## Security Testing Capabilities

### SAST (Static Application Security Testing)
- Analyzes source code for security vulnerabilities
- Detects OWASP Top 10 vulnerabilities
- Supports multiple programming languages
- Custom rule support

### DAST (Dynamic Application Security Testing)
- Tests running web applications
- Crawls and analyzes web pages
- Detects runtime vulnerabilities
- Authentication support

### SCA (Software Composition Analysis)
- Scans dependencies for known vulnerabilities
- License compliance checking
- Transitive dependency analysis
- Multiple package manager support

### Compliance Scanning
- SOC 2
- ISO 27001
- PCI DSS
- GDPR
- HIPAA
- NIST
- CIS
- OWASP

### Vulnerability Database
- Comprehensive CVE database
- Real-time vulnerability updates
- Version-specific vulnerability checks
- Patch version tracking

## Response Codes

- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Error Handling

All endpoints return error objects in the following format:

```json
{
  "success": false,
  "error": "Error message describing the issue"
}
```

## Rate Limiting

The API includes rate limiting to prevent abuse. Limits:
- 100 requests per minute per IP
- 1000 requests per hour per IP

## Authentication

Currently, the API doesn't require authentication. In production, you should implement:
- API key authentication
- JWT tokens
- OAuth 2.0

## Examples in Different Languages

### JavaScript/Node.js
```javascript
async function securityScan(target) {
  const response = await fetch('/api/v1/security-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target,
      options: {
        enableSAST: true,
        enableSCA: true
      }
    })
  });

  return await response.json();
}
```

### Python
```python
import requests

def security_scan(target):
    response = requests.post('/api/v1/security-test', json={
        'target': target,
        'options': {
            'enableSAST': True,
            'enableSCA': True
        }
    })
    return response.json()

# Example usage
result = security_scan('./src')
print(result)
```

### cURL
```bash
# Basic scan
curl -X POST https://your-worker.workers.dev/api/v1/security-test \
  -H "Content-Type: application/json" \
  -d '{"target": "./src"}'

# With options
curl -X POST https://your-worker.workers.dev/api/v1/security-test \
  -H "Content-Type: application/json" \
  -d '{
    "target": "./src",
    "options": {
      "enableSAST": true,
      "enableSCA": true,
      "severityThreshold": "high"
    }
  }'
```

## Webhook Support

Future versions will support webhooks for:
- Scan completion notifications
- Critical vulnerability alerts
- Compliance report generation
- Integration with CI/CD pipelines