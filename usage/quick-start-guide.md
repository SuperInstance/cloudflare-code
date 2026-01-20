# Cocapn Hybrid IDE - Quick Start Guide

## 🚀 **5-Minute Setup**

### **Step 1: Deploy the Platform**
```bash
# Clone the repository
git clone https://github.com/cocapn/hybrid-ide.git
cd hybrid-ide

# Install dependencies
npm install

# Build the platform
npm run build

# Start the development server
npm run dev
```

**Your platform is now running at:** `http://localhost:3000`

### **Step 2: Access the IDE**
Open your browser and navigate to `http://localhost:3000`

### **Step 3: Create Your First Account**
- Click "Sign Up" in the top right
- Enter your email and create a password
- Verify your email address

### **Step 4: Explore the Interface**
- **Dashboard**: Overview of your projects and activity
- **IDE**: Code editor with AI assistance
- **Agents**: Access to 18 specialized AI agents
- **Collaboration**: Real-time team tools
- **Analytics**: Learning insights

---

## 🎯 **Quick Actions**

### **1. Create a STEM Project**
```javascript
// Use the API to create a physics simulation project
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    name: 'Physics Simulation',
    type: 'physics',
    description: 'Interactive physics simulations',
    technologies: ['javascript', 'p5.js', 'ai-enhanced']
  })
});

const project = await response.json();
console.log('Project created:', project);
```

### **2. Run a Simulation with AI**
```json
// API Call for Circuit Simulation
POST /api/agents/simulation
{
  "action": "run_simulation",
  "parameters": {
    "project": {
      "type": "circuit_simulation",
      "components": ["battery", "resistor", "led"],
      "connections": [
        ["battery_positive", "resistor"],
        ["resistor", "led"],
        ["led", "battery_negative"]
      ],
      "values": {
        "battery_voltage": 9,
        "resistance": 330,
        "led_forward_voltage": 2.1
      }
    },
    "options": {
      "visualization": true,
      "real_time": true
    }
  },
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "simulation_id": "sim_12345",
    "results": {
      "current": 0.0209,
      "power": 0.062,
      "led_state": "on",
      "visualization_url": "https://cocapn.com/sim/sim_12345"
    }
  }
}
```

### **3. Generate Code with AI**
```javascript
// Generate a complete web application
const aiRequest = {
  action: "process_advanced_multimodal_request",
  parameters: {
    request: {
      type: "code",
      content: {
        project_type: "web_app",
        requirements: [
          "User authentication",
          "Task management",
          "Real-time updates",
          "Responsive design"
        ],
        framework: "react"
      }
    }
  }
};

fetch('/api/agents/advanced-ai-integration', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(aiRequest)
})
.then(response => response.json())
.then(result => {
  console.log('AI Generated Code:', result);
  // Use the generated code in your project
});
```

### **4. Collaborate in Real-Time**
```javascript
// Create a collaboration session
const collabRequest = {
  action: "create_session",
  parameters: {
    projectId: "physics_simulation_project",
    creatorId: "user_123",
    options: {
      maxParticipants: 5,
      whiteboard: true,
      codeEditor: true,
      voiceChat: true
    }
  }
};

fetch('/api/agents/collaboration', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(collabRequest)
})
.then(response => response.json())
.then(session => {
  console.log('Collaboration session:', session);
  // Share the session ID with your team
});
```

---

## 🛠️ **Common Use Cases**

### **1. Student Learning STEM**
```javascript
// Track learning progress
async function trackLearning(userId, subject, activity) {
  const response = await fetch('/api/analytics/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      subject,
      activity,
      timestamp: Date.now(),
      metadata: {
        duration: 1800, // 30 minutes
        interactions: 25,
        concepts_learned: ["Ohm's Law", "Circuit Analysis"]
      }
    })
  });

  return await response.json();
}
```

### **2. Teacher Creating Lessons**
```javascript
// Create AI-enhanced lesson plan
const lessonRequest = {
  action: "generate_content",
  parameters: {
    userId: "teacher_456",
    topic: "Electric Circuits",
    level: "high_school",
    duration: 45, // minutes
    ai_enhanced: true,
    interactive_elements: true
  }
};
```

### **3. Developer Building Web Apps**
```javascript
// Generate responsive UI components
const uiRequest = {
  action: "generate_professional_components",
  parameters: {
    framework: "react",
    components: ["dashboard", "forms", "charts"],
    design_system: "material_ui",
    responsive: true
  }
};
```

### **4. Team Collaboration**
```javascript
// Share project updates in real-time
const updateRequest = {
  action: "handle_update",
  parameters: {
    sessionId: "collab_789",
    userId: "user_123",
    update: {
      type: "code_change",
      file: "src/components/Circuit.js",
      changes: ["Added LED simulation logic"],
      timestamp: Date.now()
    }
  }
};
```

---

## 🎨 **Design System Quick Start**

### **Use Generated Components**
```javascript
// Import the generated design system
import { Button, Card, Input, Modal } from '@cocapn/design-system';

// Use in your React app
function CircuitSimulator() {
  return (
    <Card title="Circuit Simulator">
      <Input
        label="Voltage (V)"
        type="number"
        value={voltage}
        onChange={setVoltage}
      />
      <Button
        variant="primary"
        onClick={runSimulation}
        loading={isSimulating}
      >
        Run Simulation
      </Button>
      <Modal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        title="Simulation Results"
      >
        <p>Current: {results.current}A</p>
        <p>Power: {results.power}W</p>
      </Modal>
    </Card>
  );
}
```

### **Apply Design Tokens**
```css
/* Global CSS */
:root {
  /* Generated tokens from Figma integration */
  --color-primary: #3B82F6;
  --color-secondary: #8B5CF6;
  --spacing-md: 1rem;
  --border-radius-md: 0.375rem;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Component styles */
.circuit-component {
  background: white;
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-md);
  transition: all 0.3s ease;
}

.circuit-component:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

---

## 🔧 **Performance Optimization**

### **Quick Performance Audit**
```bash
curl -X POST http://localhost:3000/api/agents/performance-optimization \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_performance_audit",
    "parameters": {
      "url": "http://localhost:3000",
      "options": {
        "mobile": true,
        "desktop": true,
        "comprehensive": true
      }
    }
  }'
```

### **Get Optimization Recommendations**
```javascript
async function getOptimizations() {
  const response = await fetch('/api/agents/performance-optimization', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: "run_performance_audit",
      parameters: {
        url: window.location.origin,
        comprehensive: true
      }
    })
  });

  const audit = await response.json();

  // Apply top 3 recommendations
  audit.data.recommendations.slice(0, 3).forEach(rec => {
    console.log(`Implement: ${rec.description}`);
  });
}
```

---

## 🔒 **Security Setup**

### **Run Security Audit**
```json
POST /api/agents/enterprise-security
{
  "action": "run_security_audit",
  "parameters": {
    "systemScope": "full-system",
    "standards": ["soc2", "iso27001", "gdpr"]
  }
}
```

### **Generate Security Configuration**
```javascript
async function setupSecurity() {
  const response = await fetch('/api/agents/enterprise-security', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: "generate_security_config",
      parameters: {
        environment: "production",
        compliance: ["soc2", "iso27001"]
      }
    })
  });

  const config = await response.json();
  console.log('Security configuration:', config);
}
```

---

## 📱 **Mobile & Desktop Apps**

### **PWA Setup**
```javascript
// Register service worker (add to public/sw.js)
const CACHE_NAME = 'cocapn-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

### **Install Prompt**
```javascript
// Add to your main JavaScript file
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show install button
  const installBtn = document.getElementById('install-btn');
  installBtn.style.display = 'block';

  installBtn.addEventListener('click', () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
    });
  });
});
```

---

## 🎓 **Educational Features**

### **STEM Project Templates**
```javascript
// Create from template
async function createSTEMProject() {
  const response = await fetch('/api/templates/STEM/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      templateId: "circuit_simulator",
      customizations: {
        difficulty: "intermediate",
        components: ["resistor", "capacitor", "inductor"],
        ai_enhanced: true
      }
    })
  });

  return await response.json();
}
```

### **Learning Analytics**
```javascript
// Get learning insights
async function getLearningInsights(userId) {
  const response = await fetch(`/api/analytics/insights/${userId}`);
  const insights = await response.json();

  console.log('Learning Progress:', insights.data.progress);
  console.log('Recommendations:', insights.data.recommendations);
}
```

---

## 🚀 **Next Steps**

### **1. Explore More Agents**
```javascript
// Try different AI agents
const agents = [
  'ux-design',          // Generate design systems
  'responsive-design',   // Create responsive layouts
  'accessibility',      // Ensure WCAG compliance
  'figma-integration',  // Connect to Figma
  'professional-ui'    // Get enterprise components
];

agents.forEach(agent => {
  fetch(`/api/agents/${agent}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: "get_capabilities"
    })
  });
});
```

### **2. Join the Community**
- **Forum**: [forum.cocapn.com](https://forum.cocapn.com)
- **Discord**: [discord.cocapn.com](https://discord.cocapn.com)
- **Twitter**: [@cocapn](https://twitter.com/cocapn)

### **3. Read the Documentation**
- **Full Guide**: [cocapn.com/docs](https://cocapn.com/docs)
- **API Reference**: [cocapn.com/api](https://cocapn.com/api)
- **Examples**: [cocapn.com/examples](https://cocapn.com/examples)

---

## 🎉 **You're Ready!**

You now have everything you need to start using the **Cocapn Hybrid IDE**. Here's what you can do next:

### **Immediate Actions**
1. **Create a Project** - Start with a STEM template
2. **Try AI Agents** - Experiment with different agents
3. **Collaborate** - Invite team members to join
4. **Analyze Performance** - Run a performance audit

### **Advanced Features**
1. **Custom Agents** - Create your own AI agents
2. **PWA Setup** - Enable mobile apps
3. **Security Hardening** - Implement enterprise security
4. **Scale Your Apps** - Deploy to production

### **Get Help**
- **Documentation**: [cocapn.com/docs](https://cocapn.com/docs)
- **Community**: [forum.cocapn.com](https://forum.cocapn.com)
- **Support**: [support.cocapn.com](https://support.cocapn.com)

**Happy building and learning! 🚀**

---

**Remember**: The Cocapn Hybrid IDE is powered by 18 specialized AI agents and designed to make learning, building, and collaborating easier than ever before. Start exploring today!