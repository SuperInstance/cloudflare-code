/**
 * Cocapn Hybrid IDE - Cloudflare Worker Entry Point
 *
 * This worker serves the Hybrid IDE interface and handles
 * all routing, API calls, and functionality with authentication.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { html } from 'hono/html';
import { authRouter } from './auth-router';
import { stemRouter } from './stem-router';
import { agentManager } from './agents/agent-manager';

// Initialize Hono app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://cocapn.workers.dev', 'https://*.workers.dev', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Date.now(),
  });
});

// Authentication routes
app.route('/auth', authRouter);

// STEM integration routes
app.route('/api', stemRouter);

// Agent management routes
app.get('/api/agents/health', (c) => {
  const health = agentManager.getSystemHealth();
  return c.json(health);
});

app.get('/api/agents/capabilities', (c) => {
  const capabilities = agentManager.getAgentCapabilities();
  return c.json({ capabilities });
});

app.post('/api/agents/execute', async (c) => {
  try {
    const request = await c.req.json();
    const response = await agentManager.executeAgentRequest(request);
    return c.json(response);
  } catch (error) {
    console.error('Agent execution error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/enhance', async (c) => {
  try {
    const params = await c.req.json();
    const response = await agentManager.executeAdvancedFeature('project_enhancement', params);
    return c.json(response);
  } catch (error) {
    console.error('Project enhancement error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/learning-path', async (c) => {
  try {
    const params = await c.req.json();
    const response = await agentManager.executeAdvancedFeature('personalized_learning', params);
    return c.json(response);
  } catch (error) {
    console.error('Learning path error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.get('/api/agents/performance', (c) => {
  const performance = agentManager.getPerformanceSummary();
  return c.json({ performance });
});

app.post('/api/agents/bmad-enhance', async (c) => {
  try {
    const { userId, project, interactionHistory } = await c.req.json();
    const bmadRequest: AgentRequest = {
      agentType: 'bmad',
      action: 'create_enhanced_profile',
      parameters: { userId, project, interactionHistory },
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(bmadRequest);
    return c.json(response);
  } catch (error) {
    console.error('BMAD enhancement error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/advanced-ai', async (c) => {
  try {
    const { action, requestType, request } = await c.req.json();
    const aiRequest: AgentRequest = {
      agentType: 'advanced_ai',
      action,
      parameters: { requestType, request },
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(aiRequest);
    return c.json(response);
  } catch (error) {
    console.error('Advanced AI error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/realtime-collaboration', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const collabRequest: AgentRequest = {
      agentType: 'realtime_collaboration',
      action,
      parameters: params,
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(collabRequest);
    return c.json(response);
  } catch (error) {
    console.error('Realtime collaboration error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/immersive-3d', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const immersiveRequest: AgentRequest = {
      agentType: 'immersive_3d',
      action,
      parameters: params,
      priority: 'medium'
    };
    const response = await agentManager.executeAgentRequest(immersiveRequest);
    return c.json(response);
  } catch (error) {
    console.error('Immersive 3D error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/blockchain', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const blockchainRequest: AgentRequest = {
      agentType: 'blockchain',
      action,
      parameters: params,
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(blockchainRequest);
    return c.json(response);
  } catch (error) {
    console.error('Blockchain error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/ux-design', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const uxRequest: AgentRequest = {
      agentType: 'ux_design',
      action,
      parameters: params,
      priority: 'medium'
    };
    const response = await agentManager.executeAgentRequest(uxRequest);
    return c.json(response);
  } catch (error) {
    console.error('UX design error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/responsive-design', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const responsiveRequest: AgentRequest = {
      agentType: 'responsive_design',
      action,
      parameters: params,
      priority: 'medium'
    };
    const response = await agentManager.executeAgentRequest(responsiveRequest);
    return c.json(response);
  } catch (error) {
    console.error('Responsive design error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/accessibility', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const accessibilityRequest: AgentRequest = {
      agentType: 'accessibility',
      action,
      parameters: params,
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(accessibilityRequest);
    return c.json(response);
  } catch (error) {
    console.error('Accessibility error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/figma-integration', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const figmaRequest: AgentRequest = {
      agentType: 'figma_integration',
      action,
      parameters: params,
      priority: 'medium'
    };
    const response = await agentManager.executeAgentRequest(figmaRequest);
    return c.json(response);
  } catch (error) {
    console.error('Figma integration error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/professional-ui', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const uiRequest: AgentRequest = {
      agentType: 'professional_ui',
      action,
      parameters: params,
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(uiRequest);
    return c.json(response);
  } catch (error) {
    console.error('Professional UI error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/performance-optimization', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const perfRequest: AgentRequest = {
      agentType: 'performance_optimization',
      action,
      parameters: params,
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(perfRequest);
    return c.json(response);
  } catch (error) {
    console.error('Performance optimization error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/enterprise-security', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const securityRequest: AgentRequest = {
      agentType: 'enterprise_security',
      action,
      parameters: params,
      priority: 'critical'
    };
    const response = await agentManager.executeAgentRequest(securityRequest);
    return c.json(response);
  } catch (error) {
    console.error('Enterprise security error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/api/agents/advanced-ai-integration', async (c) => {
  try {
    const { action, ...params } = await c.req.json();
    const aiRequest: AgentRequest = {
      agentType: 'advanced_ai_integration',
      action,
      parameters: params,
      priority: 'high'
    };
    const response = await agentManager.executeAgentRequest(aiRequest);
    return c.json(response);
  } catch (error) {
    console.error('Advanced AI integration error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Enhanced IDE interface with STEM integration
app.get('/', async (c) => {
  return html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cocapn Hybrid IDE</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
        }

        .auth-container {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          max-width: 500px;
          width: 90%;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .auth-header h1 {
          color: #2563eb;
          margin-bottom: 10px;
          font-size: 2rem;
        }

        .auth-header p {
          color: #64748b;
          font-size: 1.1rem;
        }

        .auth-tabs {
          display: flex;
          margin-bottom: 30px;
          border-bottom: 2px solid #e2e8f0;
        }

        .auth-tab {
          flex: 1;
          padding: 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 1rem;
          color: #64748b;
          transition: all 0.3s;
          border-bottom: 2px solid transparent;
        }

        .auth-tab.active {
          color: #2563eb;
          border-bottom-color: #2563eb;
        }

        .auth-form {
          display: none;
        }

        .auth-form.active {
          display: block;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #374151;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.3s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
        }

        .form-error {
          color: #dc2626;
          font-size: 0.875rem;
          margin-top: 5px;
        }

        .form-success {
          color: #16a34a;
          font-size: 0.875rem;
          margin-top: 5px;
        }

        .btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-secondary {
          background: #64748b;
          color: white;
          margin-top: 10px;
        }

        .btn-secondary:hover {
          background: #475569;
        }

        .divider {
          text-align: center;
          margin: 20px 0;
          position: relative;
        }

        .divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: #e2e8f0;
        }

        .divider span {
          background: white;
          padding: 0 10px;
          position: relative;
          color: #64748b;
        }

        .features {
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid #e2e8f0;
        }

        .features h3 {
          color: #1e293b;
          margin-bottom: 15px;
          text-align: center;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 0.9rem;
        }

        .feature-item::before {
          content: "✨";
          font-size: 1.2rem;
        }

        .loading {
          display: none;
          text-align: center;
          color: #64748b;
        }

        .loading.show {
          display: block;
        }

        @media (max-width: 768px) {
          .auth-container {
            padding: 20px;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="auth-header">
          <h1>🚀 Cocapn Hybrid IDE</h1>
          <p>AI-powered development environment</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" onclick="switchTab('login')">Login</button>
          <button class="auth-tab" onclick="switchTab('register')">Register</button>
        </div>

        <!-- Login Form -->
        <form class="auth-form active" id="loginForm" onsubmit="handleLogin(event)">
          <div class="form-group">
            <label for="loginEmail">Email</label>
            <input type="email" id="loginEmail" name="email" required>
          </div>
          <div class="form-group">
            <label for="loginPassword">Password</label>
            <input type="password" id="loginPassword" name="password" required>
          </div>
          <button type="submit" class="btn btn-primary" id="loginBtn">Login</button>
          <div class="loading" id="loginLoading">Signing in...</div>
          <div class="form-error" id="loginError"></div>
          <div class="form-success" id="loginSuccess"></div>
        </form>

        <!-- Register Form -->
        <form class="auth-form" id="registerForm" onsubmit="handleRegister(event)">
          <div class="form-group">
            <label for="registerUsername">Username</label>
            <input type="text" id="registerUsername" name="username" required>
          </div>
          <div class="form-group">
            <label for="registerEmail">Email</label>
            <input type="email" id="registerEmail" name="email" required>
          </div>
          <div class="form-group">
            <label for="registerPassword">Password</label>
            <input type="password" id="registerPassword" name="password" required>
            <small style="color: #64748b; font-size: 0.8rem;">
              Must be 8+ characters with uppercase, lowercase, number, and special character
            </small>
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required>
          </div>
          <button type="submit" class="btn btn-primary" id="registerBtn">Register</button>
          <div class="loading" id="registerLoading">Creating account...</div>
          <div class="form-error" id="registerError"></div>
          <div class="form-success" id="registerSuccess"></div>
        </form>

        <div class="divider">
          <span>OR</span>
        </div>

        <button class="btn btn-secondary" onclick="openIDE()">Continue as Guest</button>

        <div class="features">
          <h3>Features Included</h3>
          <div class="features-grid">
            <div class="feature-item">💬 AI Chat Interface</div>
            <div class="feature-item">📝 Monaco Editor</div>
            <div class="feature-item">📁 File Management</div>
            <div class="feature-item">🌐 Live Preview</div>
            <div class="feature-item">💻 Terminal Access</div>
            <div class="feature-item">🚀 Deployment</div>
          </div>
        </div>
      </div>

      <script>
        // Tab switching
        function switchTab(tab) {
          // Update tabs
          document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          document.querySelector(\`.auth-tab[data-tab="\${tab}"]\`)?.classList.add('active');

          // Update forms
          document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
          document.getElementById(\`\${tab}Form\`).classList.add('active');

          // Clear messages
          clearMessages();
        }

        // Clear all messages
        function clearMessages() {
          document.querySelectorAll('.form-error, .form-success').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
          });
        }

        // Show message
        function showMessage(type, message) {
          const element = document.getElementById(\`\${type}\${message.includes('Success') ? 'Success' : 'Error'}\`);
          element.textContent = message;
          element.style.display = 'block';
        }

        // Handle login
        async function handleLogin(event) {
          event.preventDefault();
          clearMessages();

          const formData = new FormData(event.target);
          const email = formData.get('email');
          const password = formData.get('password');

          // Show loading
          document.getElementById('loginBtn').style.display = 'none';
          document.getElementById('loginLoading').classList.add('show');

          try {
            const response = await fetch('/auth/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
              showMessage('login', data.message);
              // Store token in localStorage
              localStorage.setItem('authToken', data.session.token);
              // Redirect to IDE
              setTimeout(() => {
                window.location.href = '/ide';
              }, 1000);
            } else {
              showMessage('login', data.error);
            }
          } catch (error) {
            showMessage('login', 'Network error. Please try again.');
          } finally {
            document.getElementById('loginBtn').style.display = 'block';
            document.getElementById('loginLoading').classList.remove('show');
          }
        }

        // Handle register
        async function handleRegister(event) {
          event.preventDefault();
          clearMessages();

          const formData = new FormData(event.target);
          const username = formData.get('username');
          const email = formData.get('email');
          const password = formData.get('password');
          const confirmPassword = formData.get('confirmPassword');

          // Validate passwords match
          if (password !== confirmPassword) {
            showMessage('register', 'Passwords do not match');
            return;
          }

          // Show loading
          document.getElementById('registerBtn').style.display = 'none';
          document.getElementById('registerLoading').classList.add('show');

          try {
            const response = await fetch('/auth/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
              showMessage('register', data.message);
              // Switch to login tab
              switchTab('login');
            } else {
              showMessage('register', data.error);
            }
          } catch (error) {
            showMessage('register', 'Network error. Please try again.');
          } finally {
            document.getElementById('registerBtn').style.display = 'block';
            document.getElementById('registerLoading').classList.remove('show');
          }
        }

        // Open IDE as guest
        function openIDE() {
          // Remove any existing auth token
          localStorage.removeItem('authToken');
          // Redirect to IDE
          window.location.href = '/ide';
        }

        // Check for existing token
        window.addEventListener('DOMContentLoaded', () => {
          const token = localStorage.getItem('authToken');
          if (token) {
            // Verify token and redirect
            fetch('/auth/me', {
              headers: {
                'Authorization': \`Bearer \${token}\`
              }
            })
            .then(response => {
              if (response.ok) {
                window.location.href = '/ide';
              } else {
                localStorage.removeItem('authToken');
              }
            })
            .catch(() => {
              localStorage.removeItem('authToken');
            });
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Protected IDE interface
app.get('/ide', async (c) => {
  const token = c.req.header('Authorization') || localStorage.getItem('authToken');

  if (!token) {
    return c.redirect('/');
  }

  // Verify token
  try {
    const response = await fetch('https://cocapn-ide.workers.dev/auth/me', {
      headers: {
        'Authorization': token
      }
    });

    if (!response.ok) {
      localStorage.removeItem('authToken');
      return c.redirect('/');
    }

    const user = await response.json();

    return html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cocapn Hybrid IDE - Welcome ${user.user.username}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            margin: 0;
            padding: 0;
            color: #1e293b;
          }

          .ide-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }

          .ide-header {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .welcome-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 16px;
            margin-bottom: 30px;
            text-align: center;
          }

          .welcome-section h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
          }

          .welcome-section p {
            font-size: 1.2rem;
            opacity: 0.9;
          }

          .user-info {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .user-details {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .user-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #2563eb;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
          }

          .logout-btn {
            background: #dc2626;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.3s;
          }

          .logout-btn:hover {
            background: #b91c1c;
          }

          .component-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
          }

          .component-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
          }

          .component-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 12px rgba(0,0,0,0.1);
          }

          .component-card h3 {
            color: #1e293b;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.3rem;
          }

          .component-card p {
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 15px;
          }

          .feature-list {
            list-style: none;
            margin: 0;
            padding: 0;
          }

          .feature-list li {
            padding: 8px 0;
            color: #475569;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .feature-list li::before {
            content: "✨";
            font-size: 0.8rem;
          }

          @media (max-width: 768px) {
            .ide-header {
              flex-direction: column;
              gap: 15px;
              text-align: center;
            }

            .user-info {
              flex-direction: column;
              gap: 15px;
            }

            .component-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="ide-container">
          <div class="ide-header">
            <div>
              <h1>🚀 Cocapn Hybrid IDE</h1>
              <p>AI-powered development environment</p>
            </div>
          </div>

          <div class="welcome-section">
            <h1>Welcome, ${user.user.username}!</h1>
            <p>Your development environment is ready and waiting.</p>
          </div>

          <div class="user-info">
            <div class="user-details">
              <div class="user-avatar">
                ${user.user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3>${user.user.username}</h3>
                <p style="color: #64748b; margin: 0;">${user.user.email}</p>
                <p style="color: #64748b; margin: 0; font-size: 0.9rem;">Member since ${new Date(user.user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <button class="logout-btn" onclick="handleLogout()">Logout</button>
          </div>

          <div class="component-grid">
            <div class="component-card" onclick="openComponent('chat')">
              <h3>💬 AI Chat Interface</h3>
              <p>Chat with AI assistants for code generation, debugging, and development assistance.</p>
              <ul class="feature-list">
                <li>5 AI providers (Manus, Z.ai, Claude, etc.)</li>
                <li>Real-time collaboration</li>
                <li>File integration</li>
                <li>Code suggestions</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('stem')">
              <h3>🧩 STEM Learning Lab</h3>
              <p>Interactive STEM projects, circuit design, and educational challenges with gamified learning.</p>
              <ul class="feature-list">
                <li>Visual circuit designer</li>
                <li>Component library</li>
                <li>Real-time simulation</li>
                <li>Educational challenges</li>
                <li>Learning progress tracking</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('editor')">
              <h3>📝 Monaco Editor</h3>
              <p>Professional code editing with syntax highlighting, IntelliSense, and multi-file support.</p>
              <ul class="feature-list">
                <li>TypeScript/JavaScript support</li>
                <li>Multi-tab interface</li>
                <li>Auto-save functionality</li>
                <li>Git integration</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('files')">
              <h3>📁 File Management</h3>
              <p>Hierarchical file system with drag-and-drop, search, and collaborative editing features.</p>
              <ul class="feature-list">
                <li>File locking system</li>
                <li>Advanced search</li>
                <li>Context menus</li>
                <li>Real-time updates</li>
                <li>STEM project files</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('preview')">
              <h3>🌐 Live Preview</h3>
              <p>Preview your Cloudflare Workers in real-time with debugging tools and performance metrics.</p>
              <ul class="feature-list">
                <li>Live updates</li>
                <li>Performance monitoring</li>
                <li>Theme switching</li>
                <li>Developer tools</li>
                <li>STEM simulation results</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('terminal')">
              <h3>💻 Terminal Access</h3>
              <p>Full Wrangler CLI integration with command history, auto-completion, and project deployment.</p>
              <ul class="feature-list">
                <li>Command history</li>
                <li>Auto-completion</li>
                <li>ANSI colors</li>
                <li>Deployment tools</li>
                <li>Arduino CLI support</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('learning')">
              <h3>🎓 Learning Assistant</h3>
              <p>AI-powered educational assistant with personalized learning paths and STEM challenges.</p>
              <ul class="feature-list">
                <li>Personalized learning</li>
                <li>Interactive tutorials</li>
                <li>Progress tracking</li>
                <li>Educational AI</li>
                <li>Achievement system</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('settings')">
              <h3>⚙️ Account Settings</h3>
              <p>Manage your profile, preferences, security settings, and API configurations.</p>
              <ul class="feature-list">
                <li>Profile management</li>
                <li>Security settings</li>
                <li>Theme preferences</li>
                <li>API key management</li>
                <li>STEM preferences</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('agents')">
              <h3>🤖 AI Agent Lab</h3>
              <p>Access advanced AI agents for simulation, collaboration, analytics, IoT, and personalized tutoring.</p>
              <ul class="feature-list">
                <li>Advanced circuit simulation</li>
                <li>Real-time collaboration</li>
                <li>Learning analytics</li>
                <li>IoT device deployment</li>
                <li>Adaptive AI tutoring</li>
                <li>Agent orchestration</li>
              </ul>
            </div>

            <div class="component-card" onclick="openComponent('certification')">
              <h3>🎓 Certification System</h3>
              <p>Earn certificates and badges for mastering STEM concepts and completing projects.</p>
              <ul class="feature-list">
                <li>Skills assessment</li>
                <li>Progress tracking</li>
                <li>Achievement badges</li>
                <li>Certification exams</li>
                <li>Skill verification</li>
                <li>Learning portfolios</li>
              </ul>
            </div>
          </div>
        </div>

        <script>
          // Handle logout
          async function handleLogout() {
            const token = localStorage.getItem('authToken');
            if (token) {
              try {
                await fetch('https://cocapn-ide.workers.dev/auth/logout', {
                  method: 'POST',
                  headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                  }
                });
              } catch (error) {
                console.error('Logout error:', error);
              }
            }
            localStorage.removeItem('authToken');
            window.location.href = '/';
          }

          // Open component
          function openComponent(component) {
            switch (component) {
              case 'stem':
                // Open STEM Learning Lab
                window.open('/stem-lab', '_blank');
                break;
              case 'learning':
                // Open Learning Assistant
                window.open('/learning-assistant', '_blank');
                break;
              case 'agents':
                // Open AI Agent Lab
                showAgentLab();
                break;
              case 'certification':
                // Open Certification System
                showCertificationSystem();
                break;
              case 'chat':
              case 'editor':
              case 'files':
              case 'preview':
              case 'terminal':
              case 'settings':
                // In a real implementation, this would open the specific component
                alert(\`\${component.charAt(0).toUpperCase() + component.slice(1)} component would open here.\`);
                break;
              default:
                alert(\`Component not implemented: \${component}\`);
            }
          }

          // Show AI Agent Lab interface
          function showAgentLab() {
            alert('🤖 AI Agent Lab would open here. This would show:\n\n' +
              '• Advanced Simulation Engine\n' +
              '• Collaboration Agents\n' +
              '• Learning Analytics\n' +
              '• IoT Integration\n' +
              '• AI Tutoring System\n' +
              '• Agent Performance Dashboard');
          }

          // Show Certification System interface
          function showCertificationSystem() {
            alert('🎓 Certification System would open here. This would show:\n\n' +
              '• Skills Assessment\n' +
              '• Progress Tracking\n' +
              '• Achievement Badges\n' +
              '• Certification Exams\n' +
              '• Learning Portfolios\n' +
              '• Skill Verification');
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Auth verification error:', error);
    return c.redirect('/');
  }
});

// API endpoints for authenticated users
app.get('/api/providers', (c) => {
  const providers = [
    {
      id: 'manus',
      name: 'Manus',
      description: 'Primary AI provider for code generation',
      icon: '🤖',
      recommended: true,
      features: ['Code generation', 'Asset creation', 'Fast responses']
    },
    {
      id: 'zai',
      name: 'Z.ai',
      description: 'Image generation and visual assets',
      icon: '🎨',
      recommended: false,
      features: ['Image generation', 'Low cost', 'Scalable']
    },
    {
      id: 'minimax',
      name: 'Minimax.ai',
      description: 'Backup image provider',
      icon: '🖼️',
      recommended: false,
      features: ['Image generation', 'Backup', 'Reliable']
    },
    {
      id: 'claude',
      name: 'Claude',
      description: 'Advanced reasoning and complex tasks',
      icon: '🧠',
      recommended: false,
      features: ['Advanced reasoning', 'Large context', 'Helpful']
    },
    {
      id: 'grok',
      name: 'Grok (xAI)',
      description: 'Conversational AI integration',
      icon: '🗣️',
      recommended: false,
      features: ['Conversational', 'Fast responses', 'Context-aware']
    }
  ];

  return c.json(providers);
});

// Protected chat endpoint
app.post('/api/chat', async (c) => {
  try {
    const { message, provider } = await c.req.json();

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Message is required' }, 400);
    }

    const userId = c.get('userId');

    const response = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      role: 'assistant',
      content: `Hello ${userId.substring(0, 8)}! I received your message: "${message}". This is where the AI response would be generated using the ${provider || 'default'} provider.`,
      timestamp: new Date().toISOString(),
      provider: provider || 'manus',
      userId
    };

    return c.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Health check for authentication service
app.get('/auth/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'authentication',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling
app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    path: c.req.path,
    timestamp: new Date().toISOString()
  }, 404);
});

export default app;