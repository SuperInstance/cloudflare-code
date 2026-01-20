# Cocapn Hybrid IDE - API Reference

## 📡 **Base URL**
```
https://api.cocapn.com/v1
```

## 🔐 **Authentication**
All API requests require authentication using Bearer tokens.

### **Get Authentication Token**
```bash
curl -X POST https://api.cocapn.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "expires_at": "2024-12-31T23:59:59Z"
  }
}
```

### **Authorization Header**
```javascript
const headers = {
  'Authorization': 'Bearer YOUR_TOKEN',
  'Content-Type': 'application/json'
};
```

---

## 🎯 **Core API Endpoints**

### **Projects API**
```javascript
// Create Project
POST /api/projects
{
  "name": "My Physics Simulation",
  "type": "physics",
  "description": "Interactive circuit simulator",
  "technologies": ["javascript", "p5.js"],
  "ai_enhanced": true
}

// List Projects
GET /api/projects

// Get Project
GET /api/projects/{projectId}

// Update Project
PUT /api/projects/{projectId}

// Delete Project
DELETE /api/projects/{projectId}
```

### **Files API**
```javascript
// Create File
POST /api/projects/{projectId}/files
{
  "path": "src/components/Circuit.js",
  "content": "export function Circuit() { ... }",
  "type": "text/javascript"
}

// Read File
GET /api/projects/{projectId}/files/{filePath}

// Update File
PUT /api/projects/{projectId}/files/{filePath}

// Delete File
DELETE /api/projects/{projectId}/files/{filePath}

// List Files
GET /api/projects/{projectId}/files
```

---

## 🤖 **AI Agents API**

### **1. Simulation Agent**
**Endpoint:** `/api/agents/simulation`

#### **Run Simulation**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/simulation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_simulation",
    "parameters": {
      "project": {
        "type": "circuit_simulation",
        "components": ["battery", "resistor", "led"],
        "connections": [
          ["battery_positive", "resistor"],
          ["resistor", "led"]
        ],
        "values": {
          "battery_voltage": 9,
          "resistance": 330
        }
      },
      "options": {
        "visualization": true,
        "real_time": true,
        "export_results": true
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "simulation_id": "sim_12345",
    "status": "completed",
    "results": {
      "current": 0.0209,
      "voltage_drop": 6.897,
      "power": 0.144,
      "led_state": "on",
      "efficiency": 76.3
    },
    "visualization_url": "https://cocapn.com/sim/sim_12345",
    "export_url": "https://cocapn.com/sim/sim_12345/results.csv"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### **Export Simulation Results**
```bash
curl -X GET "https://api.cocapn.com/v1/api/agents/simulation/export/{simulationId}?format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **2. Collaboration Agent**
**Endpoint:** `/api/agents/collaboration`

#### **Create Session**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/collaboration \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_session",
    "parameters": {
      "projectId": "project_123",
      "creatorId": "user_456",
      "options": {
        "maxParticipants": 10,
        "whiteboard": true,
        "codeEditor": true,
        "voiceChat": true,
        "screenShare": true,
        "recording": false
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "collab_789",
    "roomId": "room_abc",
    "joinUrl": "https://cocapn.com/collab/room_abc",
    "inviteCode": "XYZ123",
    "settings": {
      "maxParticipants": 10,
      "whiteboard": true,
      "codeEditor": true,
      "voiceChat": true,
      "screenShare": true
    },
    "participants": []
  }
}
```

#### **Join Session**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/collaboration/join \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "join_session",
    "parameters": {
      "sessionId": "collab_789",
      "userId": "user_456",
      "inviteCode": "XYZ123"
    }
  }'
```

#### **Send Message**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/collaboration/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "handle_chat",
    "parameters": {
      "sessionId": "collab_789",
      "userId": "user_456",
      "message": "Can someone help me with this circuit?",
      "messageType": "text",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

### **3. Analytics Agent**
**Endpoint:** `/api/agents/analytics`

#### **Track Session**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/analytics \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "track_session",
    "parameters": {
      "userId": "user_456",
      "sessionId": "session_789",
      "sessionData": {
        "duration": 3600,
        "interactions": 45,
        "projects_completed": 2,
        "skills_practiced": ["circuit_design", "physics"],
        "achievements": ["circuit_master", "physics_expert"]
      }
    }
  }'
```

#### **Generate Insights**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/analytics \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_insights",
    "parameters": {
      "userId": "user_456",
      "timeframe": "30d"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "learning_progress": {
      "overall_score": 85,
      "subjects": {
        "physics": 92,
        "mathematics": 78,
        "engineering": 88
      }
    },
    "recommendations": [
      {
        "type": "skill_gap",
        "description": "Focus on advanced circuit analysis",
        "priority": "high"
      },
      {
        "type": "learning_path",
        "description": "Continue with electromagnetic theory",
        "priority": "medium"
      }
    ],
    "achievements": ["circuit_master", "quick_learner"],
    "next_milestones": ["physics_expert", "engineering_phd"]
  }
}
```

### **4. UX Design Agent**
**Endpoint:** `/api/agents/ux-design`

#### **Generate Design System**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/ux-design \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_design_system",
    "parameters": {
      "options": {
        "theme": "light",
        "density": "comfortable",
        "primaryColor": "#3B82F6",
        "styleguide": true
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "design_tokens": {
      "colors": {
        "primary": "#3B82F6",
        "secondary": "#8B5CF6",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444"
      },
      "typography": {
        "heading": "32px",
        "body": "16px",
        "caption": "12px"
      },
      "spacing": {
        "small": "8px",
        "medium": "16px",
        "large": "24px"
      }
    },
    "components": ["button", "input", "card", "modal"],
    "export_url": "https://cocapn.com/design/system-123/export"
  }
}
```

#### **Generate User Journey**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/ux-design \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_user_journey",
    "parameters": {
      "persona": "student"
    }
  }'
```

### **5. Performance Optimization Agent**
**Endpoint:** `/api/agents/performance-optimization`

#### **Run Performance Audit**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/performance-optimization \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_performance_audit",
    "parameters": {
      "url": "https://your-app.com",
      "options": {
        "mobile": true,
        "desktop": true,
        "location": "us-east-1",
        "throttling": true,
        "comprehensive": true
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall_score": 85,
    "scores": {
      "loadTime": 78,
      "renderTime": 92,
      "bundleSize": 85,
      "resourceOptimization": 80,
      "cachingEfficiency": 90,
      "seo": 88
    },
    "recommendations": [
      {
        "id": "rec-1",
        "type": "high",
        "category": "bundle",
        "description": "Implement code splitting",
        "estimatedImprovement": 35
      }
    ],
    "bottlenecks": [
      {
        "type": "resource",
        "name": "Large JavaScript Bundle",
        "impact": "high",
        "loadTime": 1200
      }
    ]
  }
}
```

### **6. Enterprise Security Agent**
**Endpoint:** `/api/agents/enterprise-security`

#### **Run Security Audit**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/enterprise-security \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_security_audit",
    "parameters": {
      "systemScope": "full-system",
      "standards": ["soc2", "iso27001", "gdpr"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall_score": 92,
    "categories": {
      "authentication": 95,
      "authorization": 90,
      "encryption": 88,
      "monitoring": 95,
      "compliance": 90,
      "protection": 93
    },
    "vulnerabilities": [
      {
        "id": "vuln-1",
        "severity": "medium",
        "category": "web",
        "title": "Insufficient Input Validation",
        "remediation": "Implement strict input validation"
      }
    ],
    "compliance": {
      "soc2": true,
      "iso27001": true,
      "gdpr": true,
      "hipaa": true
    }
  }
}
```

#### **Generate Security Configuration**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/enterprise-security \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_security_config",
    "parameters": {
      "environment": "production",
      "compliance": ["soc2", "iso27001"]
    }
  }'
```

### **7. Advanced AI Integration Agent**
**Endpoint:** `/api/agents/advanced-ai-integration`

#### **Process Multimodal Request**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/advanced-ai-integration \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "process_advanced_multimodal_request",
    "parameters": {
      "request": {
        "type": "multimodal",
        "content": {
          "text": "Analyze this circuit design",
          "image": "base64_encoded_image_here",
          "audio": "base64_encoded_audio_here"
        }
      },
      "options": {
        "pipeline_id": "multimodal-analysis",
        "provider": "openai",
        "optimization": true
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ai_request_123",
    "input_type": "multimodal",
    "confidence": 0.92,
    "latency": 2450,
    "cost": 0.15,
    "results": {
      "text": "This circuit shows a series configuration with...",
      "analysis": {
        "components": ["resistor", "capacitor", "battery"],
        "voltage_analysis": "9V across the circuit",
        "current_analysis": "0.027A through the loop"
      }
    }
  }
}
```

#### **Optimize AI Costs**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/advanced-ai-integration \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "optimize_costs",
    "parameters": {}
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_cost": 150.75,
    "potential_savings": 52.76,
    "optimization_plan": [
      "Switch from gpt-4 to gpt-3.5 for routine tasks",
      "Implement result caching for common queries",
      "Use batch processing for multiple requests"
    ]
  }
}
```

### **8. Responsive Design Agent**
**Endpoint:** `/api/agents/responsive-design`

#### **Generate Responsive CSS**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/responsive-design \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_responsive_css",
    "parameters": {
      "componentName": "navigation-header",
      "structure": {
        "mobile": { display: "none" },
        "tablet": { display: "block" },
        "desktop": { display: "block" }
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "css": "/* Generated responsive CSS */\n.navigation-header {\n  display: block;\n}\n\n@media (max-width: 768px) {\n  .navigation-header {\n    display: none;\n  }\n}",
    "breakpoints": {
      "mobile": "max-width: 767px",
      "tablet": "min-width: 768px and max-width: 1023px",
      "desktop": "min-width: 1024px"
    }
  }
}
```

### **9. Accessibility Agent**
**Endpoint:** `/api/agents/accessibility`

#### **Run Accessibility Audit**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/accessibility \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_accessibility_audit",
    "parameters": {
      "content": {
        "html": "<div>Sample content</div>",
        "css": "styles",
        "components": ["button", "input"]
      },
      "options": {
        "tools": ["axe", "lighthouse"],
        "standard": "WCAG_2_1",
        "level": "AA"
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall_score": 87,
    "violations": [
      {
        "id": "color-contrast",
        "severity": "critical",
        "description": "Insufficient color contrast",
        "recommendation": "Increase contrast ratio to 4.5:1"
      }
    ],
    "recommendations": [
      "Add alternative text for images",
      "Ensure keyboard accessibility",
      "Improve color contrast ratios"
    ],
    "compliance": {
      "wcag": "AA",
      "section508": "Compliant",
      "ada": "Compliant"
    }
  }
}
```

### **10. Figma Integration Agent**
**Endpoint:** `/api/agents/figma-integration`

#### **Connect to Figma**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/figma-integration \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "connect_to_figma",
    "parameters": {
      "fileId": "YOUR_FIGMA_FILE_ID"
    }
  }'
```

#### **Extract Design Tokens**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/figma-integration \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "extract_design_tokens",
    "parameters": {
      "fileId": "YOUR_FIGMA_FILE_ID"
    }
  }'
```

### **11. Professional UI Agent**
**Endpoint:** `/api/agents/professional-ui`

#### **Generate Professional Components**
```bash
curl -X POST https://api.cocapn.com/v1/api/agents/professional-ui \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_professional_components",
    "parameters": {
      "config": {
        "theme": "light",
        "exportFormat": "react"
      }
    }
  }'
```

---

## 🔌 **WebSocket API**

### **Real-time Updates**
**URL:** `wss://api.cocapn.com/v1/ws/{userId}`

**Connection:**
```javascript
const ws = new WebSocket('wss://api.cocapn.com/v1/ws/user_123');

ws.onopen = () => {
  console.log('Connected to Cocapn WebSocket');
  // Subscribe to notifications
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['collaboration', 'notifications', 'project_updates']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'collaboration':
      handleCollaborationMessage(message.data);
      break;
    case 'notification':
      showNotification(message.data);
      break;
    case 'project_update':
      updateProject(message.data);
      break;
  }
};

ws.onclose = () => {
  console.log('Disconnected from Cocapn WebSocket');
};
```

---

## 📊 **Error Handling**

### **Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### **Common Error Codes**
| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Invalid request parameters |
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT` | Rate limit exceeded |
| `INTERNAL_ERROR` | Internal server error |

### **Retry Strategy**
```javascript
async function withRetry(requestFn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (error.code === 'RATE_LIMIT') {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}
```

---

## 📝 **Webhooks**

### **Subscribe to Webhooks**
```bash
curl -X POST https://api.cocapn.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks",
    "events": ["project_created", "user_joined", "simulation_completed"],
    "secret": "your_webhook_secret"
  }'
```

### **Webhook Payload Example**
```json
{
  "event": "project_created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "projectId": "project_123",
    "projectName": "Physics Simulation",
    "userId": "user_456",
    "trigger": "user_action"
  },
  "signature": "sha256=your_signature_here"
}
```

---

## 🔄 **Rate Limiting**

### **Rate Limits**
- **Requests per minute**: 60
- **Concurrent requests**: 10
- **Webhook events per minute**: 100

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1642313400
X-RateLimit-Reset-Time: "2022-01-15T10:30:00Z"
```

### **Handle Rate Limiting**
```javascript
async function handleRateLimit(response) {
  if (response.status === 429) {
    const resetTime = new Date(response.headers.get('X-RateLimit-Reset-Time') * 1000);
    const waitTime = resetTime - Date.now();

    console.log(`Rate limited. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    return retryRequest();
  }
}
```

---

## 📋 **Webhook Events**

### **Available Events**
| Event | Description |
|-------|-------------|
| `project_created` | New project created |
| `project_updated` | Project modified |
| `project_deleted` | Project removed |
| `user_joined` | User joined collaboration |
| `simulation_completed` | Simulation finished |
| `user_achievement` | User earned achievement |
| `system_alert` | System alert or maintenance |

### **Webhook Verification**
```javascript
function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${digest}`)
  );
}
```

---

## 🛠️ **SDK Examples**

### **JavaScript SDK**
```javascript
import CocapnSDK from '@cocapn/sdk';

const cocapn = new CocapnSDK({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.cocapn.com/v1'
});

// Create project
const project = await cocapn.projects.create({
  name: 'My Physics Project',
  type: 'physics'
});

// Run simulation
const simulation = await cocapn.agents.simulation.run({
  project: project.data,
  options: { visualization: true }
});

// Handle real-time updates
cocapn.on('collaboration_message', (message) => {
  console.log('Collaboration message:', message);
});
```

### **Python SDK**
```python
from cocapn_sdk import CocapnClient

client = CocapnClient(api_key='YOUR_API_KEY')

# Create project
project = client.projects.create({
    'name': 'My Physics Project',
    'type': 'physics'
})

# Run simulation
simulation = client.agents.simulation.run({
    'project': project.data,
    'options': {'visualization': True}
})

# Stream collaboration updates
for message in client.stream_collaboration():
    print(f"Message: {message}")
```

---

## 📞 **Support**

### **API Documentation**
- **Full Documentation**: [cocapn.com/docs/api](https://cocapn.com/docs/api)
- **Postman Collection**: [cocapn.com/postman](https://cocapn.com/postman)
- **Interactive Playground**: [cocapn.com/playground](https://cocapn.com/playground)

### **Community Support**
- **API Forum**: [forum.cocapn.com/api](https://forum.cocapn.com/api)
- **Discord**: [discord.cocapn.com](https://discord.cocapn.com)
- **GitHub Issues**: [github.com/cocapn/api-issues](https://github.com/cocapn/api-issues)

### **Enterprise Support**
For enterprise customers, contact:
- **Email**: enterprise-support@cocapn.com
- **Phone**: +1 (555) 123-4567
- **SLA**: 24/7 support with 1-hour response time

---

## 🎉 **You're All Set!**

This API reference covers all the endpoints and functionality available in the Cocapn Hybrid IDE. You now have everything you need to integrate with our platform, build amazing applications, and leverage our 18 specialized AI agents.

**Next Steps:**
1. **Try the Examples** - Copy and paste the examples to get started
2. **Explore the Playground** - Test API calls in our interactive playground
3. **Join the Community** - Connect with other developers
4. **Build Something Amazing** - The possibilities are endless!

**Happy coding! 🚀**