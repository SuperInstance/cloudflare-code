/**
 * Chat Interface Component
 *
 * Features:
 * - Provider selection dropdown
 * - Message display with syntax highlighting
 * - File insertion buttons
 * - Deploy button
 * - Ad banners on sides
 * - Open editor functionality
 */

import { html } from 'hono/html';
import { Hono } from 'hono';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
  files?: Array<{
    path: string;
    action: 'created' | 'modified' | 'deleted';
  }>;
}

export interface ProviderOption {
  id: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
  name: string;
  description: string;
  icon: string;
  recommended: boolean;
  features: string[];
}

export const ChatInterface = {
  // Provider options
  providers: [
    {
      id: 'manus',
      name: 'Manus',
      description: 'Default provider for code generation',
      icon: '🤖',
      recommended: true,
      features: ['Code generation', 'Asset creation', 'Fast responses'],
    },
    {
      id: 'zai',
      name: 'Z.ai',
      description: 'Cost-effective image generation',
      icon: '🎨',
      recommended: false,
      features: ['Image generation', 'Low cost', 'Scalable'],
    },
    {
      id: 'minimax',
      name: 'Minimax.ai',
      description: 'Backup image provider',
      icon: '🖼️',
      recommended: false,
      features: ['Image generation', 'Backup provider', 'Reliable'],
    },
    {
      id: 'claude',
      name: 'Claude',
      description: 'Advanced reasoning capabilities',
      icon: '🧠',
      recommended: false,
      features: ['Advanced reasoning', 'Large context', 'Helpful'],
    },
    {
      id: 'grok',
      name: 'Grok (xAI)',
      description: 'Conversational AI via xAPI',
      icon: '🗣️',
      recommended: false,
      features: ['Conversational', 'Fast responses', 'Context-aware'],
    },
  ],

  render: (sessionId: string, messages: ChatMessage[], isTyping: boolean = false) => {
    return html`
      <div class="chat-container" data-session-id="${sessionId}">
        <!-- Provider Selection Header -->
        <div class="provider-header">
          <div class="provider-selector">
            <label for="provider-select" class="provider-label">AI Provider:</label>
            <select id="provider-select" class="provider-select">
              ${ChatInterface.providers.map(provider => `
                <option value="${provider.id}" ${provider.recommended ? 'selected' : ''}>
                  ${provider.icon} ${provider.name} ${provider.recommended ? '⭐' : ''}
                </option>
              `).join('')}
            </select>
            <div class="provider-description" id="provider-description">
              ${ChatInterface.providers.find(p => p.recommended)?.description || 'Select a provider'}
            </div>
          </div>

          <div class="provider-features">
            ${ChatInterface.providers.find(p => p.recommended)?.features
              .map(feature => `<span class="feature-tag">${feature}</span>`)
              .join('') || ''}
          </div>
        </div>

        <!-- Messages Container -->
        <div class="messages-container" id="messages-container">
          ${messages.map(message => ChatInterface.renderMessage(message)).join('')}

          ${isTyping ? ChatInterface.renderTypingIndicator() : ''}
        </div>

        <!-- Input Area -->
        <div class="input-container">
          <div class="file-actions">
            <button class="action-btn" onclick="openFileModal()" title="Insert File">
              📁 Insert File
            </button>
            <button class="action-btn" onclick="openEditor()" title="Open Editor">
              📝 Open Editor
            </button>
            <button class="action-btn deploy-btn" onclick="deployProject()" title="Deploy Project">
              🚀 Deploy
            </button>
          </div>

          <div class="input-wrapper">
            <textarea
              id="chat-input"
              class="chat-input"
              placeholder="Describe what you want to build..."
              rows="2"
              onkeydown="handleChatKeydown(event)"
            ></textarea>
            <button class="send-btn" onclick="sendMessage()" title="Send (Ctrl+Enter)">
              ➤
            </button>
          </div>
        </div>

        <!-- Provider Info Modal (hidden by default) -->
        <div id="provider-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <span class="close" onclick="closeProviderModal()">&times;</span>
            <h2 id="modal-provider-name"></h2>
            <p id="modal-provider-description"></p>
            <h3>Features:</h3>
            <ul id="modal-features-list"></ul>
          </div>
        </div>
      </div>

      <style>
        .chat-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
          border-radius: 8px;
          overflow: hidden;
        }

        .provider-header {
          background: #ffffff;
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .provider-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .provider-label {
          font-weight: 600;
          color: #334155;
          font-size: 14px;
        }

        .provider-select {
          padding: 8px 12px;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          font-size: 14px;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .provider-select:hover {
          border-color: #94a3b8;
        }

        .provider-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .provider-description {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .provider-features {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .feature-tag {
          background: #eff6ff;
          color: #1e40af;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          scroll-behavior: smooth;
        }

        .message {
          margin-bottom: 16px;
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
          display: flex;
          justify-content: flex-end;
        }

        .message.assistant {
          display: flex;
          justify-content: flex-start;
        }

        .message-content {
          max-width: 70%;
          background: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          position: relative;
        }

        .message.user .message-content {
          background: #3b82f6;
          color: white;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
          color: #64748b;
        }

        .message.user .message-header {
          color: rgba(255, 255, 255, 0.8);
        }

        .message-files {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
        }

        .message.user .message-files {
          border-top-color: rgba(255, 255, 255, 0.2);
        }

        .file-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          margin-right: 8px;
          margin-bottom: 4px;
        }

        .message.user .file-item {
          background: rgba(255, 255, 255, 0.2);
        }

        .file-action {
          font-weight: 600;
          color: #3b82f6;
        }

        .message.user .file-action {
          color: #dbeafe;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          background: #64748b;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }

        .input-container {
          background: white;
          padding: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .file-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .action-btn {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .action-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .deploy-btn {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        .deploy-btn:hover {
          background: #059669;
          border-color: #059669;
        }

        .input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .chat-input {
          flex: 1;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chat-input:focus {
          border-color: #3b82f6;
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .send-btn:hover {
          background: #2563eb;
        }

        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }

        .modal-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 24px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .close {
          position: absolute;
          top: 16px;
          right: 16px;
          font-size: 24px;
          cursor: pointer;
          color: #64748b;
        }

        .close:hover {
          color: #334155;
        }

        #modal-provider-name {
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        #modal-provider-description {
          color: #64748b;
          margin-bottom: 16px;
        }

        #modal-features-list {
          list-style: none;
          padding: 0;
        }

        #modal-features-list li {
          padding: 4px 0;
          color: #475569;
        }

        #modal-features-list li:before {
          content: "✓ ";
          color: #10b981;
          font-weight: bold;
        }

        @media (max-width: 768px) {
          .message-content {
            max-width: 85%;
          }

          .file-actions {
            flex-wrap: wrap;
          }

          .provider-selector {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      </style>

      <script>
        // Initialize chat functionality
        let sessionId = '${sessionId}';
        let currentProvider = '${ChatInterface.providers.find(p => p.recommended)?.id || 'manus'}';

        // Provider selection
        document.getElementById('provider-select').addEventListener('change', function(e) {
          currentProvider = e.target.value;
          updateProviderInfo(currentProvider);
        });

        function updateProviderInfo(providerId) {
          const provider = ChatInterface.providers.find(p => p.id === providerId);
          if (provider) {
            document.getElementById('provider-description').textContent = provider.description;
          }
        }

        // Message handling
        function sendMessage() {
          const input = document.getElementById('chat-input');
          const message = input.value.trim();

          if (!message) return;

          // Add user message
          addMessage({
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: Date.now(),
            provider: currentProvider
          });

          // Clear input
          input.value = '';

          // Show typing indicator
          showTypingIndicator();

          // Send to backend
          fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId,
              message,
              provider: currentProvider
            })
          })
          .then(response => response.json())
          .then(data => {
            hideTypingIndicator();
            addMessage(data.message);
          })
          .catch(error => {
            console.error('Error sending message:', error);
            hideTypingIndicator();
            alert('Failed to send message. Please try again.');
          });
        }

        function addMessage(message) {
          const messagesContainer = document.getElementById('messages-container');
          const messageElement = createMessageElement(message);

          messagesContainer.insertAdjacentHTML('beforeend', messageElement);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function createMessageElement(message) {
          const filesHtml = message.files ? `
            <div className="message-files">
              ${message.files.map(file => `
                <span class="file-item">
                  <span class="file-action">${file.action}</span>
                  <span>${file.path}</span>
                </span>
              `).join('')}
            </div>
          ` : '';

          return `
            <div class="message ${message.role}">
              <div class="message-content">
                <div class="message-header">
                  <span>${message.provider || 'Unknown'}</span>
                  <span>${new Date(message.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="message-text">${escapeHtml(message.content)}</div>
                ${filesHtml}
              </div>
            </div>
          `;
        }

        function showTypingIndicator() {
          const messagesContainer = document.getElementById('messages-container');
          const typingHtml = `
            <div class="message assistant">
              <div class="typing-indicator">
                <span>AI is thinking</span>
                <div class="typing-dots">
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                </div>
              </div>
            </div>
          `;
          messagesContainer.insertAdjacentHTML('beforeend', typingHtml);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function hideTypingIndicator() {
          const typingIndicator = document.querySelector('.typing-indicator');
          if (typingIndicator) {
            typingIndicator.parentElement.remove();
          }
        }

        function renderMessage(message) {
          return createMessageElement(message);
        }

        function renderTypingIndicator() {
          return `
            <div class="message assistant">
              <div class="typing-indicator">
                <span>AI is thinking</span>
                <div class="typing-dots">
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                  <div class="typing-dot"></div>
                </div>
              </div>
            </div>
          `;
        }

        // Keyboard shortcuts
        function handleChatKeydown(event) {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            sendMessage();
          }
        }

        // File actions
        function openFileModal() {
          // TODO: Implement file selection modal
          console.log('Open file selection modal');
        }

        function openEditor() {
          // TODO: Implement editor opening
          console.log('Open editor');
        }

        function deployProject() {
          if (confirm('Are you ready to deploy your project to Cloudflare Workers?')) {
            fetch('/api/deploy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId,
                provider: currentProvider
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                alert('Deployment successful! Your app is now live at: ' + data.url);
                window.open(data.url, '_blank');
              } else {
                alert('Deployment failed: ' + (data.errors || ['Unknown error'])[0]);
              }
            })
            .catch(error => {
              console.error('Error deploying:', error);
              alert('Failed to deploy. Please try again.');
            });
          }
        }

        // Modal functions
        function closeProviderModal() {
          document.getElementById('provider-modal').style.display = 'none';
        }

        // Initialize provider info
        updateProviderInfo(currentProvider);
      </script>
    `;
  },
};