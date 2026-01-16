/**
 * Development Portal Routes
 * Protected by username/password authentication
 */

import { Hono } from 'hono';
import type { Bindings } from '../index';

export const devRoutes = new Hono<{ Bindings: Bindings }>();

// Basic auth middleware
const basicAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    c.header('WWW-Authenticate', 'Basic realm="Cocapn Development Portal"');
    return c.html(getAuthRequiredPage(), 401);
  }

  const [type, credentials] = authHeader.split(' ');
  if (type !== 'Basic') {
    return c.html(getAuthRequiredPage(), 401);
  }

  const decoded = atob(credentials);
  const [username, password] = decoded.split(':');

  // Get allowed users from KV
  const allowedUsers = await c.env.CACHE_KV.get('dev_users', { type: 'json' });
  const devPassword = await c.env.CACHE_KV.get('dev_password') || 'admin123';

  const users = allowedUsers || { admin: devPassword };

  if (!users[username] || users[username] !== password) {
    return c.html('<html><body>Invalid username or password</body></html>', 401);
  }

  c.set('user', username);
  await next();
};

function getAuthRequiredPage() {
  return '<!DOCTYPE html><html><head><title>Authentication Required - Cocapn Dev Portal</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}.login-box{background:white;padding:40px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;}h1{color:#333;margin-bottom:10px;}p{color:#666;margin-bottom:30px;}</style></head><body><div class="login-box"><h1>🔐 Cocapn Development Portal</h1><p>Authentication required to access the building agent</p></div></body></html>';
}

devRoutes.use('*', basicAuth);

// Dev portal home
devRoutes.get('/', async (c) => {
  const username = c.get('user');
  return c.html(getDevPortalPage(username));
});

function getDevPortalPage(username: string) {
  return '<!DOCTYPE html><html><head><title>Cocapn Development Portal</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f23;color:#fff;min-height:100vh}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;border-bottom:1px solid rgba(255,255,255,.1)}.header h1{font-size:24px}.header .user{float:right;opacity:.8}.container{max-width:1200px;margin:0 auto;padding:40px 20px}.welcome{background:linear-gradient(135deg,#1e3a5f 0%,#0d1b2a 100%);padding:40px;border-radius:12px;margin-bottom:30px;border:1px solid rgba(102,126,234,.3)}.welcome h2{font-size:32px;margin-bottom:10px}.welcome p{opacity:.8;font-size:18px}.tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:30px}.tool-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:24px;transition:all .3s ease;cursor:pointer}.tool-card:hover{background:rgba(255,255,255,.08);border-color:#667eea;transform:translateY(-2px)}.tool-card h3{font-size:20px;margin-bottom:8px}.tool-card p{opacity:.7;font-size:14px}.status{display:inline-block;padding:4px 12px;background:#10b981;border-radius:20px;font-size:12px;margin-left:10px}</style></head><body><div class="header"><h1>🚀 Cocapn Development Portal</h1><span class="user">Logged in as: ' + username + '</span></div><div class="container"><div class="welcome"><h2>Welcome back, ' + username + '! 👋</h2><p>Ready to build something amazing on Cloudflare Workers?</p><div class="status">System Online</div></div><div class="tools"><div class="tool-card" onclick="location.href=\'/dev/agent\'"><h3>🤖 AI Building Agent</h3><p>Chat with AI to generate Cloudflare Workers code, APIs, and full applications</p></div><div class="tool-card" onclick="location.href=\'/dev/review\'"><h3>🔍 Code Review</h3><p>Get AI-powered code reviews, security analysis, and best practice recommendations</p></div><div class="tool-card" onclick="location.href=\'/dev/test\'"><h3>🧪 Testing</h3><p>Run automated tests, generate test cases, and validate your Workers</p></div><div class="tool-card" onclick="location.href=\'/dev/deploy\'"><h3>📦 Deploy</h3><p>Deploy your Workers to production with one click</p></div><div class="tool-card" onclick="location.href=\'/dev/analytics\'"><h3>📊 Analytics</h3><p>View performance metrics, usage stats, and system health</p></div><div class="tool-card" onclick="location.href=\'/dev/settings\'"><h3>⚙️ Settings</h3><p>Configure your development environment and preferences</p></div></div></div></body></html>';
}

// AI Building Agent interface
devRoutes.get('/agent', async (c) => {
  const username = c.get('user');
  return c.html(getAgentPage(username));
});

function getAgentPage(username: string) {
  return '<!DOCTYPE html><html><head><title>AI Building Agent - Cocapn</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f23;color:#fff;height:100vh;display:flex;flex-direction:column}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:15px 20px;display:flex;justify-content:space-between;align-items:center}.header a{color:white;text-decoration:none}.main{display:flex;flex:1;overflow:hidden}.sidebar{width:300px;background:rgba(255,255,255,.05);border-right:1px solid rgba(255,255,255,.1);padding:20px;overflow-y:auto}.sidebar h3{font-size:14px;opacity:.6;margin-bottom:10px}.chat-container{flex:1;display:flex;flex-direction:column}.messages{flex:1;padding:20px;overflow-y:auto}.message{margin-bottom:20px;padding:15px;border-radius:12px;max-width:80%}.message.user{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);margin-left:auto}.message.assistant{background:rgba(255,255,255,.1)}.input-area{padding:20px;border-top:1px solid rgba(255,255,255,.1)}.input-wrapper{display:flex;gap:10px}textarea{flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:15px;color:white;font-size:14px;font-family:inherit;resize:none;min-height:50px}textarea:focus{outline:0;border-color:#667eea}button{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border:0;border-radius:8px;padding:15px 30px;color:white;font-weight:600;cursor:pointer;transition:opacity .3s}button:hover{opacity:.9}.example{padding:12px;background:rgba(255,255,255,.05);border-radius:8px;margin-bottom:10px;cursor:pointer;font-size:13px;border:1px solid transparent}.example:hover{border-color:#667eea}.placeholder{text-align:center;padding:60px 20px;opacity:.5}</style></head><body><div class="header"><a href="/dev">← Back to Portal</a><h2>🤖 AI Building Agent</h2><span>Logged in as: ' + username + '</span></div><div class="main"><div class="sidebar"><h3>EXAMPLE PROMPTS</h3><div class="example" onclick="setPrompt(\'Create a REST API for user management with CRUD operations\')">Create a REST API for user management</div><div class="example" onclick="setPrompt(\'Build a Cloudflare Worker that proxies requests to multiple backends\')">Build a multi-backend proxy Worker</div><div class="example" onclick="setPrompt(\'Generate a landing page with contact form for cocapn.com\')">Generate a landing page for cocapn.com</div><div class="example" onclick="setPrompt(\'Create a rate limiting middleware for Cloudflare Workers\')">Create rate limiting middleware</div><div class="example" onclick="setPrompt(\'Build a GraphQL API with D1 database integration\')">Build GraphQL API with D1</div><h3 style="margin-top:30px">PROJECTS</h3><div class="example">cocapn.com landing page</div><div class="example">User authentication system</div><div class="example">API gateway</div></div><div class="chat-container"><div class="messages" id="messages"><div class="placeholder"><p>👋 Hi ' + username + '!</p><p>I\'m your AI building agent. Tell me what you\'d like to build on Cloudflare Workers, and I\'ll help you create it.</p><p style="margin-top:20px">Try one of the examples on the left, or describe what you want to build.</p></div></div><div class="input-area"><div class="input-wrapper"><textarea id="prompt" placeholder="Describe what you want to build..." onkeydown="if(event.key===\'Enter\' && !event.shiftKey){event.preventDefault();sendMessage();}"></textarea><button onclick="sendMessage()">Send</button></div></div></div></div><script>function setPrompt(text){document.getElementById("prompt").value=text;document.getElementById("prompt").focus()}async function sendMessage(){const prompt=document.getElementById("prompt").value.trim();if(!prompt)return;const messages=document.getElementById("messages");const placeholder=messages.querySelector(".placeholder");if(placeholder)placeholder.remove();const userMsg=document.createElement("div");userMsg.className="message user";userMsg.textContent=prompt;messages.appendChild(userMsg);document.getElementById("prompt").value="";messages.scrollTop=messages.scrollHeight;const loading=document.createElement("div");loading.className="message assistant";loading.innerHTML="<em>Thinking...</em>";messages.appendChild(loading);messages.scrollTop=messages.scrollHeight;try{const response=await fetch("/dev/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});const data=await response.json();loading.remove();const assistantMsg=document.createElement("div");assistantMsg.className="message assistant";assistantMsg.innerHTML=data.response.replace(/\\n/g,"<br>");messages.appendChild(assistantMsg);messages.scrollTop=messages.scrollHeight}catch(error){loading.remove();const errorMsg=document.createElement("div");errorMsg.className="message assistant";errorMsg.style.color="#ef4444";errorMsg.textContent="Error: "+error.message;messages.appendChild(errorMsg)}}</script></body></html>';
}

// Chat API endpoint
devRoutes.post('/api/chat', async (c) => {
  const { prompt } = await c.req.json();

  const response = `I understand you want to: ${prompt}

I can help you build that!

Let me start generating the code for you...

---
*Note: This is a placeholder response. The AI integration needs to be configured.*`;

  return c.json({ response });
});

// Settings endpoint
devRoutes.get('/settings', async (c) => {
  const username = c.get('user');
  const users = await c.env.CACHE_KV.get('dev_users', { type: 'json' }) || {};

  return c.html(getSettingsPage(username, users));
});

function getSettingsPage(username: string, users: any) {
  return '<!DOCTYPE html><html><head><title>Settings - Cocapn Dev Portal</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f23;color:#fff;padding:40px}h1{margin-bottom:30px}.section{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:24px;margin-bottom:24px}.section h2{font-size:18px;margin-bottom:16px}input{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:10px 14px;color:white;font-size:14px;margin-right:10px}button{background:#667eea;border:0;border-radius:6px;padding:10px 20px;color:white;cursor:pointer}.user-list{margin-top:16px}.user{background:rgba(255,255,255,.05);padding:12px;border-radius:6px;margin-bottom:8px}</style></head><body><h1>⚙️ Settings</h1><div class="section"><h2>Current User: ' + username + '</h2><a href="/dev" style="color:#667eea">← Back to Portal</a></div><div class="section"><h2>Manage Users</h2><p style="opacity:.7;margin-bottom:16px">Add or remove developers who can access the building agent</p><input type="text" id="newUsername" placeholder="Username"><input type="password" id="newPassword" placeholder="Password"><button onclick="addUser()">Add User</button><div id="userList" class="user-list"></div></div><script>const users=' + JSON.stringify(users) + ';function renderUsers(){const list=document.getElementById("userList");list.innerHTML=Object.keys(users).map(u=>\'<div class="user">\'+u+\'</div>\').join("")}async function addUser(){const username=document.getElementById("newUsername").value;const password=document.getElementById("newPassword").value;if(!username||!password){alert("Please enter both username and password");return}await fetch("/dev/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});document.getElementById("newUsername").value="";document.getElementById("newPassword").value="";location.reload()}renderUsers()</script></body></html>';
}

// Add user API
devRoutes.post('/api/users', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const users = await c.env.CACHE_KV.get('dev_users', { type: 'json' }) || {};
  users[username] = password;

  await c.env.CACHE_KV.put('dev_users', JSON.stringify(users));

  return c.json({ success: true, users: Object.keys(users) });
});
