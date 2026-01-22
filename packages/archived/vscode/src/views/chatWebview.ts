/**
 * Chat webview provider for ClaudeFlare
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

import { ApiClient } from '../services/apiClient';
import { TelemetryService } from '../services/telemetry';
import { ChatMessage, ChatSession } from '../types';
import { Logger } from '../utils/logger';

export class ChatWebviewProvider {
  private logger: Logger;
  private webview: vscode.Webview | undefined;
  private currentSession: ChatSession | undefined;
  private sessions: Map<string, ChatSession> = new Map();
  private streamingMessage: string = '';

  constructor(
    private context: vscode.ExtensionContext,
    private apiClient: ApiClient,
    private telemetry: TelemetryService
  ) {
    this.logger = new Logger('ChatWebview');

    // Load sessions from storage
    this.loadSessions();

    // Create or get current session
    if (this.sessions.size === 0) {
      this.createSession();
    } else {
      // Get the most recent session
      const recentSession = Array.from(this.sessions.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      this.currentSession = recentSession;
    }
  }

  /**
   * Resolve webview view
   */
  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.logger.info('Resolving chat webview');

    this.webview = webviewView.webview;
    this.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'resources')]
    };

    // Set up message handler
    this.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    // Initial HTML
    this.updateWebviewHtml();

    // Track telemetry
    await this.telemetry.trackFeatureUsage('chat_opened');
  }

  /**
   * Handle message from webview
   */
  private async handleMessage(message: any): Promise<void> {
    this.logger.debug('Received message from webview', message);

    switch (message.type) {
      case 'sendMessage':
        await this.sendMessage(message.text, message.context);
        break;
      case 'newChat':
        this.createSession();
        this.updateWebviewHtml();
        break;
      case 'loadSession':
        this.loadSession(message.sessionId);
        break;
      case 'deleteSession':
        this.deleteSession(message.sessionId);
        break;
      case 'clearHistory':
        this.clearHistory();
        break;
      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage('Copied to clipboard');
        break;
      case 'insertCode':
        await this.insertCode(message.code);
        break;
      case 'openFile':
        await this.openFile(message.filePath);
        break;
      case 'applyRefactoring':
        await this.applyRefactoring(message.refactoring);
        break;
      default:
        this.logger.warn('Unknown message type', message.type);
    }
  }

  /**
   * Send user message
   */
  private async sendMessage(text: string, context?: any): Promise<void> {
    if (!this.currentSession) {
      this.createSession();
    }

    if (!this.webview || !this.currentSession) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      metadata: context
    };

    this.currentSession.messages.push(userMessage);
    this.currentSession.updatedAt = Date.now();
    this.saveSessions();

    // Update webview with user message
    this.postMessage({
      type: 'messageAdded',
      message: userMessage
    });

    // Track telemetry
    await this.telemetry.trackChatMessage({
      messageLength: text.length,
      hasContext: !!context,
      hasSelection: !!context?.selection
    });

    // Add placeholder assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    this.currentSession.messages.push(assistantMessage);

    // Stream response
    this.streamingMessage = '';

    try {
      await this.apiClient.streamChatMessage(
        this.currentSession.id,
        text,
        this.currentSession.messages.slice(0, -1), // Exclude the placeholder
        context,
        (chunk, done) => {
          this.streamingMessage += chunk;

          // Update webview with streaming content
          this.postMessage({
            type: 'messageStreaming',
            messageId: assistantMessage.id,
            content: this.streamingMessage
          });

          if (done) {
            // Finalize the message
            assistantMessage.content = this.streamingMessage;
            this.currentSession!.updatedAt = Date.now();
            this.saveSessions();

            this.postMessage({
              type: 'messageCompleted',
              message: assistantMessage
            });

            this.streamingMessage = '';
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to send message', error);

      // Remove the assistant message on error
      this.currentSession.messages.pop();

      this.postMessage({
        type: 'messageError',
        error: error instanceof Error ? error.message : 'Failed to send message'
      });

      await this.telemetry.trackError(error as Error, {
        sessionId: this.currentSession.id
      });
    }
  }

  /**
   * Create new session
   */
  private createSession(): void {
    const session: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;
    this.saveSessions();
  }

  /**
   * Load session
   */
  private loadSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.currentSession = session;
      this.updateWebviewHtml();
    }
  }

  /**
   * Delete session
   */
  private deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);

    if (this.currentSession?.id === sessionId) {
      if (this.sessions.size > 0) {
        const recentSession = Array.from(this.sessions.values())
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        this.currentSession = recentSession;
      } else {
        this.createSession();
      }
    }

    this.saveSessions();
    this.updateWebviewHtml();
  }

  /**
   * Clear history
   */
  private clearHistory(): void {
    if (this.currentSession) {
      this.currentSession.messages = [];
      this.currentSession.updatedAt = Date.now();
      this.saveSessions();
      this.updateWebviewHtml();
    }
  }

  /**
   * Insert code into editor
   */
  private async insertCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const position = editor.selection.active;

    await editor.edit(editBuilder => {
      editBuilder.insert(position, code);
    });
  }

  /**
   * Open file
   */
  private async openFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    await vscode.window.showTextDocument(uri);
  }

  /**
   * Apply refactoring
   */
  private async applyRefactoring(refactoring: any): Promise<void> {
    // Implementation for applying refactoring
    this.logger.info('Apply refactoring', refactoring);
  }

  /**
   * Post message to webview
   */
  private postMessage(message: any): void {
    if (this.webview) {
      this.webview.postMessage(message);
    }
  }

  /**
   * Update webview HTML
   */
  private updateWebviewHtml(): void {
    if (!this.webview) {
      return;
    }

    this.webview.html = this.getWebviewContent();
  }

  /**
   * Get webview content
   */
  private getWebviewContent(): string {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const currentMessages = this.currentSession?.messages || [];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaudeFlare Chat</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background);
      --fg-color: var(--vscode-editor-foreground);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --border-color: var(--vscode-panel-border);
      --accent-color: var(--vscode-button-background);
      --user-msg-bg: var(--vscode-textBlockQuote-background);
      --assistant-msg-bg: var(--vscode-editor-inactiveSelectionBackground);
    }

    body {
      font-family: var(--vscode-font-family);
      background-color: var(--bg-color);
      color: var(--fg-color);
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .header {
      padding: 10px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h1 {
      margin: 0;
      font-size: 16px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .button {
      background-color: var(--accent-color);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      border-radius: 2px;
    }

    .button:hover {
      opacity: 0.9;
    }

    .button.secondary {
      background-color: transparent;
      border: 1px solid var(--border-color);
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .message {
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 4px;
    }

    .message.user {
      background-color: var(--user-msg-bg);
    }

    .message.assistant {
      background-color: var(--assistant-msg-bg);
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      opacity: 0.7;
    }

    .message-content {
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .message-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }

    .message-actions button {
      background: none;
      border: none;
      color: var(--fg-color);
      cursor: pointer;
      font-size: 12px;
      opacity: 0.7;
    }

    .message-actions button:hover {
      opacity: 1;
    }

    .input-container {
      padding: 12px;
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 8px;
    }

    .input-field {
      flex: 1;
      background-color: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--border-color);
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: none;
    }

    .input-field:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .send-button {
      background-color: var(--accent-color);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .typing-indicator {
      display: none;
      padding: 12px;
      opacity: 0.7;
    }

    .typing-indicator.active {
      display: block;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      opacity: 0.5;
    }

    code {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 2px;
      font-family: var(--vscode-editor-font-family);
    }

    pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }

    pre code {
      background: none;
      padding: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ClaudeFlare Chat</h1>
    <div class="header-actions">
      <button class="button secondary" id="newChat">New Chat</button>
      <button class="button secondary" id="clearHistory">Clear History</button>
    </div>
  </div>

  <div class="chat-container" id="chatContainer">
    <div class="empty-state" id="emptyState">
      <p>Start a conversation with ClaudeFlare</p>
      <p>Ask questions about your code, request refactoring, or get help with debugging.</p>
    </div>
    <div id="messages"></div>
  </div>

  <div class="typing-indicator" id="typingIndicator">
    ClaudeFlare is typing...
  </div>

  <div class="input-container">
    <textarea
      class="input-field"
      id="messageInput"
      placeholder="Ask ClaudeFlare anything..."
      rows="3"
    ></textarea>
    <button class="send-button" id="sendButton">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const messagesContainer = document.getElementById('messages');
    const emptyState = document.getElementById('emptyState');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const typingIndicator = document.getElementById('typingIndicator');

    // Initial messages
    const initialMessages = ${JSON.stringify(currentMessages)};
    initialMessages.forEach(msg => addMessage(msg));

    updateEmptyState();

    // Event listeners
    document.getElementById('newChat').addEventListener('click', () => {
      vscode.postMessage({ type: 'newChat' });
    });

    document.getElementById('clearHistory').addEventListener('click', () => {
      vscode.postMessage({ type: 'clearHistory' });
    });

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text) return;

      vscode.postMessage({
        type: 'sendMessage',
        text: text,
        context: getContext()
      });

      messageInput.value = '';
      typingIndicator.classList.add('active');
    }

    function addMessage(message) {
      const messageEl = document.createElement('div');
      messageEl.className = \`message \${message.role}\`;
      messageEl.dataset.messageId = message.id;

      messageEl.innerHTML = \`
        <div class="message-header">
          <span>\${message.role === 'user' ? 'You' : 'ClaudeFlare'}</span>
          <span>\${new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="message-content">\${formatContent(message.content)}</div>
        \${message.role === 'assistant' ? \`
          <div class="message-actions">
            <button onclick="copyMessage('\${message.id}')">Copy</button>
            <button onclick="insertCode('\${message.id}')">Insert Code</button>
          </div>
        \` : ''}
      \`;

      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      updateEmptyState();
    }

    function updateMessage(messageId, content) {
      const messageEl = messagesContainer.querySelector(\`[data-message-id="\${messageId}"]\`);
      if (messageEl) {
        const contentEl = messageEl.querySelector('.message-content');
        if (contentEl) {
          contentEl.innerHTML = formatContent(content);
        }
      }
    }

    function formatContent(content) {
      if (!content) return '';

      // Simple markdown formatting
      return content
        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\\n/g, '<br>');
    }

    function updateEmptyState() {
      const hasMessages = messagesContainer.children.length > 0;
      emptyState.style.display = hasMessages ? 'none' : 'block';
    }

    function getContext() {
      // Get editor context if available
      return {
        selection: '', // Would be populated from VS Code
        filePath: '', // Would be populated from VS Code
        language: '' // Would be populated from VS Code
      };
    }

    function copyMessage(messageId) {
      const messageEl = messagesContainer.querySelector(\`[data-message-id="\${messageId}"]\`);
      if (messageEl) {
        const content = messageEl.querySelector('.message-content')?.textContent;
        if (content) {
          vscode.postMessage({ type: 'copyToClipboard', text: content });
        }
      }
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'messageAdded':
          addMessage(message.message);
          break;
        case 'messageStreaming':
          updateMessage(message.messageId, message.content);
          break;
        case 'messageCompleted':
          typingIndicator.classList.remove('active');
          updateMessage(message.messageId, message.message.content);
          break;
        case 'messageError':
          typingIndicator.classList.remove('active');
          console.error('Message error:', message.error);
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Save sessions to storage
   */
  private saveSessions(): void {
    const sessionsArray = Array.from(this.sessions.values());
    this.context.globalState.update('claudeflare.chatSessions', sessionsArray);
  }

  /**
   * Load sessions from storage
   */
  private loadSessions(): void {
    const sessionsData = this.context.globalState.get<ChatSession[]>('claudeflare.chatSessions', []);
    this.sessions = new Map(sessionsData.map(s => [s.id, s]));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.saveSessions();
  }
}
