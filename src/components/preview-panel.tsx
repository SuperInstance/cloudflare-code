/**
 * Preview Panel Component
 *
 * Features:
 * - Live Cloudflare Worker preview
 * - Frame-based preview
 * - Reload button
 * - Dev tools integration
 * - Error handling and logging
 * - Ad banners on sides
 */

import { html } from 'hono/html';
import { Hono } from 'hono';

export interface PreviewOptions {
  theme: 'light' | 'dark';
  showDevTools: boolean;
  allowScripts: boolean;
  enableCors: boolean;
  maxHeight: string;
  showErrorLogs: boolean;
}

export interface PreviewStatus {
  status: 'loading' | 'ready' | 'error' | 'offline';
  url?: string;
  lastReload: number;
  error?: string;
  logs: string[];
  metrics: {
    loadTime: number;
    requests: number;
    errors: number;
  };
}

export const PreviewPanel = {
  // Default options
  defaultOptions: {
    theme: 'light',
    showDevTools: true,
    allowScripts: false,
    enableCors: false,
    maxHeight: '500px',
    showErrorLogs: true,
  } as PreviewOptions,

  // Preview status tracking
  status: {
    status: 'loading' as PreviewStatus['status'],
    lastReload: Date.now(),
    logs: [],
    metrics: {
      loadTime: 0,
      requests: 0,
      errors: 0,
    },
  } as PreviewStatus,

  render: (options: PreviewOptions = PreviewPanel.defaultOptions) => {
    return html`
      <div class="preview-container" style="max-height: ${options.maxHeight};">
        <!-- Preview Header -->
        <div class="preview-header">
          <div class="preview-actions">
            <button class="preview-btn" onclick="previewReload()" title="Reload (Ctrl+R)">
              🔄 Reload
            </button>
            <button class="preview-btn" onclick="previewNewTab()" title="Open in New Tab">
              🌐 Open
            </button>
            <button class="preview-btn" onclick="previewDevTools()" title="Dev Tools">
              🛠️ Dev Tools
            </button>
            <button class="preview-btn" onclick="previewClearLogs()" title="Clear Logs">
              🗑️ Clear
            </button>
          </div>

          <div class="preview-info">
            <div class="preview-status">
              <span class="status-indicator ${PreviewPanel.status.status}">
                ${PreviewPanel.getStatusIcon(PreviewPanel.status.status)}
              </span>
              <span class="status-text">
                ${PreviewPanel.getStatusText(PreviewPanel.status.status)}
              </span>
            </div>
            <div class="preview-metrics">
              <span class="metric-item">⏱️ ${PreviewPanel.status.metrics.loadTime}ms</span>
              <span class="metric-item">📥 ${PreviewPanel.status.metrics.requests}</span>
              <span class="metric-item">❌ ${PreviewPanel.status.metrics.errors}</span>
            </div>
          </div>
        </div>

        <!-- Preview Container -->
        <div class="preview-frame-container">
          <iframe
            id="preview-frame"
            class="preview-frame"
            sandbox="${options.allowScripts ? '' : 'allow-same-origin'}"
            allowfullscreen
            src="about:blank"
          ></iframe>
        </div>

        <!-- Theme Selector -->
        <div class="theme-selector">
          <label>Theme:</label>
          <select onchange="changePreviewTheme(this.value)">
            <option value="light" ${options.theme === 'light' ? 'selected' : ''}>🌞 Light</option>
            <option value="dark" ${options.theme === 'dark' ? 'selected' : ''}>🌙 Dark</option>
          </select>
        </div>

        <!-- Preview Logs (if enabled) -->
        ${options.showErrorLogs ? `
          <div class="preview-logs">
            <div class="logs-header">
              <span class="logs-title">📝 Logs</span>
              <button class="logs-clear" onclick="clearLogs()">Clear</button>
            </div>
            <div class="logs-content" id="logs-content">
              ${PreviewPanel.status.logs.slice(-5).map(log => PreviewPanel.renderLog(log)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Dev Tools Modal (hidden by default) -->
        <div id="dev-tools-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <span class="close" onclick="closeDevTools()">&times;</span>
            <h2>Developer Tools</h2>
            <div class="dev-tools-content">
              <div class="dev-tool-section">
                <h3>Network</h3>
                <div id="network-logs" class="tool-logs">
                  Network requests will appear here...
                </div>
              </div>
              <div class="dev-tool-section">
                <h3>Console</h3>
                <div id="console-logs" class="tool-logs">
                  Console output will appear here...
                </div>
              </div>
              <div class="dev-tool-section">
                <h3>Storage</h3>
                <div id="storage-info" class="tool-storage">
                  <div class="storage-item">
                    <span class="storage-label">Cookies:</span>
                    <span class="storage-value" id="cookie-count">0</span>
                  </div>
                  <div class="storage-item">
                    <span class="storage-label">LocalStorage:</span>
                    <span class="storage-value" id="local-storage-count">0</span>
                  </div>
                  <div class="storage-item">
                    <span class="storage-label">SessionStorage:</span>
                    <span class="storage-value" id="session-storage-count">0</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-primary" onclick="applyDevTools()">Apply Changes</button>
              <button class="btn btn-secondary" onclick="closeDevTools()">Close</button>
            </div>
          </div>
        </div>

        <!-- Ad Integration Areas -->
        <div class="ad-banner">
          <div class="ad-content">
            <span class="ad-icon">🚀</span>
            <div class="ad-text">
              <div class="ad-title">Live Preview</div>
              <div class="ad-description">Instantly see your changes with live Worker preview</div>
            </div>
          </div>
        </div>

        <style>
          .preview-container {
            background: #ffffff;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
          }

          .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }

          .preview-actions {
            display: flex;
            gap: 8px;
          }

          .preview-btn {
            padding: 6px 12px;
            border: 1px solid #cbd5e1;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .preview-btn:hover {
            background: #f1f5f9;
            border-color: #94a3b8;
          }

          .preview-btn:active {
            transform: scale(0.95);
          }

          .preview-info {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .preview-status {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background: #f1f5f9;
            border-radius: 4px;
          }

          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }

          .status-indicator.loading {
            background: #f59e0b;
            animation: pulse 1.5s infinite;
        }

          .status-indicator.ready {
            background: #10b981;
          }

          .status-indicator.error {
            background: #ef4444;
          }

          .status-indicator.offline {
            background: #6b7280;
          }

          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

          .status-text {
            font-size: 12px;
            color: #475569;
            font-weight: 500;
          }

          .preview-metrics {
            display: flex;
            gap: 12px;
          }

          .metric-item {
            font-size: 11px;
            color: #64748b;
            padding: 2px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #e2e8f0;
          }

          .preview-frame-container {
            flex: 1;
            position: relative;
            background: #ffffff;
            min-height: 300px;
          }

          .preview-frame {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            transition: filter 0.3s ease;
          }

          .preview-frame.error {
            filter: sepia(20%) saturate(200%) hue-rotate(330deg);
          }

          .preview-frame.offline {
            filter: grayscale(100%);
          }

          .theme-selector {
            padding: 8px 16px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .theme-selector label {
            font-size: 12px;
            color: #475569;
            font-weight: 500;
          }

          .theme-selector select {
            padding: 4px 8px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            background: white;
            font-size: 11px;
            cursor: pointer;
          }

          .preview-logs {
            max-height: 150px;
            border-top: 1px solid #e2e8f0;
            background: #1e293b;
            color: #f1f5f9;
          }

          .logs-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            border-bottom: 1px solid #334155;
            background: #1e293b;
          }

          .logs-title {
            font-weight: 600;
            font-size: 12px;
          }

          .logs-clear {
            background: transparent;
            border: 1px solid #ef4444;
            color: #ef4444;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .logs-clear:hover {
            background: #ef4444;
            color: white;
          }

          .logs-content {
            padding: 8px;
            font-family: monospace;
            font-size: 11px;
            overflow-y: auto;
            max-height: calc(100% - 40px);
          }

          .log-entry {
            margin-bottom: 4px;
            padding: 2px 0;
            border-bottom: 1px solid #334155;
          }

          .log-entry:last-child {
            border-bottom: none;
          }

          .log-time {
            color: #94a3b8;
            margin-right: 8px;
          }

          .log-level {
            font-weight: bold;
            margin-right: 8px;
          }

          .log-level.error {
            color: #ef4444;
          }

          .log-level.warn {
            color: #f59e0b;
          }

          .log-level.info {
            color: #3b82f6;
          }

          .log-level.debug {
            color: #6b7280;
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
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            width: 800px;
            max-width: 90vw;
            max-height: 90vh;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }

          .modal-content h2 {
            margin: 0 0 16px 0;
            color: #1e293b;
            text-align: center;
          }

          .dev-tools-content {
            max-height: 500px;
            overflow-y: auto;
            margin-bottom: 20px;
        }

          .dev-tool-section {
            margin-bottom: 20px;
          }

          .dev-tool-section h3 {
            margin: 0 0 8px 0;
            color: #475569;
            font-size: 14px;
            font-weight: 600;
          }

          .tool-logs {
            background: #1e293b;
            color: #f1f5f9;
            padding: 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            min-height: 100px;
            max-height: 150px;
            overflow-y: auto;
          }

          .tool-storage {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .storage-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
          }

          .storage-label {
            font-weight: 500;
            color: #475569;
            font-size: 12px;
          }

          .storage-value {
            font-weight: 600;
            color: #1e293b;
            font-size: 12px;
          }

          .modal-actions {
            display: flex;
            gap: 8px;
            margin-top: 20px;
          }

          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            flex: 1;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #3b82f6;
            color: white;
          }

          .btn-primary:hover {
            background: #2563eb;
          }

          .btn-secondary {
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
          }

          .btn-secondary:hover {
            background: #e2e8f0;
            color: #475569;
          }

          .modal .close {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 20px;
            cursor: pointer;
            color: #94a3b8;
            border: none;
            background: transparent;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }

          .modal .close:hover {
            background: #f1f5f9;
            color: #334155;
          }

          .ad-banner {
            margin: 8px 16px 8px 16px;
            background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
            color: white;
            padding: 12px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .ad-icon {
            font-size: 24px;
            flex-shrink: 0;
          }

          .ad-text {
            flex: 1;
        }

          .ad-title {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 2px;
          }

          .ad-description {
            font-size: 12px;
            opacity: 0.9;
          }

          @media (max-width: 768px) {
            .preview-container {
              border-radius: 0;
              margin: 0;
              width: 100%;
            }

            .preview-header {
              padding: 8px;
            }

            .preview-actions {
              gap: 4px;
            }

            .preview-btn {
              padding: 4px 8px;
              font-size: 10px;
            }

            .preview-info {
              flex-direction: column;
              gap: 8px;
            }

            .modal-content {
              width: 95vw;
              height: 80vh;
              max-height: none;
            }

            .modal-content h2 {
              font-size: 16px;
            }
          }
        </style>

        <script>
          let currentUrl = '';
          let reloadTimeout;
          let devToolsFrame = null;

          // Initialize preview panel
          function initializePreview() {
            const frame = document.getElementById('preview-frame');
            frame.addEventListener('load', handleFrameLoad);
            frame.addEventListener('error', handleFrameError);
            frame.addEventListener('message', handleMessage);

            // Initialize with about:blank
            updatePreviewStatus('loading');
            frame.src = 'about:blank';

            // Set up keyboard shortcuts
            document.addEventListener('keydown', handlePreviewKeyboard);

            // Start periodic checks
            setInterval(checkPreviewHealth, 30000); // Every 30 seconds
          }

          function handleFrameLoad() {
            const frame = document.getElementById('preview-frame');
            const loadTime = Date.now() - PreviewPanel.status.lastReload;

            // Update metrics
            PreviewPanel.status.metrics.loadTime = loadTime;
            PreviewPanel.status.metrics.requests++;
            PreviewPanel.status.lastReload = Date.now();

            // Check if iframe has errors
            try {
              const content = frame.contentDocument || frame.contentWindow.document;
              if (content.body && content.body.innerHTML.includes('error')) {
                addLog('error', 'Page contains error content');
                PreviewPanel.status.metrics.errors++;
              }
            } catch (e) {
              // Cross-origin frame, can't check content
            }

            updatePreviewStatus('ready');
            addLog('info', 'Preview loaded successfully', { loadTime, url: frame.src });

            // Update metrics display
            updateMetrics();
          }

          function handleFrameError() {
            updatePreviewStatus('error');
            addLog('error', 'Failed to load preview');
            PreviewPanel.status.metrics.errors++;
            updateMetrics();

            // Add error styling to frame
            document.getElementById('preview-frame').classList.add('error');
          }

          function handleMessage(event) {
            // Handle messages from the iframe
            if (event.data.type === 'log') {
              addLog(event.data.level, event.data.message, event.data.data);
            } else if (event.data.type === 'metric') {
              handleMetricUpdate(event.data);
            }
          }

          function updatePreviewStatus(status) {
            PreviewPanel.status.status = status;
            const statusElement = document.querySelector('.status-indicator');
            const statusTextElement = document.querySelector('.status-text');

            statusElement.className = 'status-indicator ' + status;
            statusTextElement.textContent = getStatusText(status);
          }

          function getStatusIcon(status) {
            const icons = {
              loading: '⏳',
              ready: '✅',
              error: '❌',
              offline: '📡',
            };
            return icons[status] || '❓';
          }

          function getStatusText(status) {
            const texts = {
              loading: 'Loading...',
              ready: 'Ready',
              error: 'Error',
              offline: 'Offline',
            };
            return texts[status] || 'Unknown';
          }

          function updateMetrics() {
            const metricsElement = document.querySelector('.preview-metrics');
            const metrics = PreviewPanel.status.metrics;

            metricsElement.innerHTML = `
              <span className="metric-item">⏱️ {metrics.loadTime}ms</span>
              <span class="metric-item">📥 ${metrics.requests}</span>
              <span class="metric-item">❌ ${metrics.errors}</span>
            `;
          }

          function addLog(level, message, data = {}) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = {
              timestamp,
              level,
              message,
              data
            };

            PreviewPanel.status.logs.push(logEntry);

            // Update logs display
            const logsContent = document.getElementById('logs-content');
            if (logsContent) {
              const logDiv = document.createElement('div');
              logDiv.className = 'log-entry';
              logDiv.innerHTML = `
                <span class="log-time">${timestamp}</span>
                <span class="log-level ${level}">${level.toUpperCase()}</span>
                <span>${escapeHtml(message)}</span>
              `;
              logsContent.appendChild(logDiv);
              logsContent.scrollTop = logsContent.scrollHeight;
            }

            // Keep only last 50 logs
            if (PreviewPanel.status.logs.length > 50) {
              PreviewPanel.status.logs = PreviewPanel.status.logs.slice(-50);
            }
          }

          function previewReload() {
            const frame = document.getElementById('preview-frame');
            if (currentUrl) {
              addLog('info', 'Reloading preview...', { url: currentUrl });
              frame.src = currentUrl + '?t=' + Date.now(); // Bypass cache
            } else {
              addLog('warn', 'No URL to reload');
            }
          }

          function previewNewTab() {
            if (currentUrl) {
              window.open(currentUrl, '_blank');
            } else {
              alert('No URL to open');
            }
          }

          function previewDevTools() {
            const modal = document.getElementById('dev-tools-modal');
            modal.style.display = 'block';

            // Initialize dev tools content
            initializeDevTools();
          }

          function closeDevTools() {
            document.getElementById('dev-tools-modal').style.display = 'none';
          }

          function initializeDevTools() {
            // Initialize network logs
            const networkLogs = document.getElementById('network-logs');
            if (networkLogs) {
              networkLogs.textContent = 'Waiting for network requests...';
            }

            // Initialize console logs
            const consoleLogs = document.getElementById('console-logs');
            if (consoleLogs) {
              consoleLogs.textContent = 'Waiting for console output...';
            }

            // Initialize storage info
            updateStorageInfo();
          }

          function updateStorageInfo() {
            // Get cookie count
            const cookieCount = document.cookie ? document.cookie.split(';').length : 0;
            const cookieCountElement = document.getElementById('cookie-count');
            if (cookieCountElement) {
              cookieCountElement.textContent = cookieCount;
            }

            // Get localStorage count
            let localCount = 0;
            try {
              for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) localCount++;
              }
            } catch (e) {
              // Ignore localStorage access errors
            }
            const localCountElement = document.getElementById('local-storage-count');
            if (localCountElement) {
              localCountElement.textContent = localCount;
            }

            // Get sessionStorage count
            let sessionCount = 0;
            try {
              for (let key in sessionStorage) {
                if (sessionStorage.hasOwnProperty(key)) sessionCount++;
              }
            } catch (e) {
              // Ignore sessionStorage access errors
            }
            const sessionCountElement = document.getElementById('session-storage-count');
            if (sessionCountElement) {
              sessionCountElement.textContent = sessionCount;
            }
          }

          function applyDevTools() {
            // Apply dev tools settings
            closeDevTools();
            addLog('info', 'Dev tools settings applied');
          }

          function previewClearLogs() {
            PreviewPanel.status.logs = [];
            addLog('info', 'Logs cleared');
            updateMetrics();
          }

          function clearLogs() {
            const logsContent = document.getElementById('logs-content');
            if (logsContent) {
              logsContent.innerHTML = '';
            }
            previewClearLogs();
          }

          function handlePreviewKeyboard(event) {
            if (event.ctrlKey || event.metaKey) {
              switch (event.key.toLowerCase()) {
                case 'r':
                  event.preventDefault();
                  previewReload();
                  break;
                case 'o':
                  event.preventDefault();
                  previewNewTab();
                  break;
                case 'd':
                  event.preventDefault();
                  previewDevTools();
                  break;
              }
            }
          }

          function changePreviewTheme(theme) {
            addLog('info', 'Preview theme changed to: ' + theme);
            const frame = document.getElementById('preview-frame');
            if (frame && frame.contentDocument) {
              try {
                frame.contentDocument.body.classList.toggle('dark-theme', theme === 'dark');
              } catch (e) {
                // Cross-origin frame, can't modify
              }
            }
          }

          function checkPreviewHealth() {
            const frame = document.getElementById('preview-frame');
            try {
              // Try to access the iframe
              if (frame && frame.contentWindow && frame.contentWindow.document) {
                updatePreviewStatus('ready');
              } else {
                updatePreviewStatus('offline');
                addLog('warn', 'Preview appears to be offline');
              }
            } catch (e) {
              updatePreviewStatus('offline');
              addLog('warn', 'Preview health check failed', { error: e.message });
            }
          }

          function handleMetricUpdate(data) {
            if (data.type === 'performance') {
              PreviewPanel.status.metrics.loadTime = data.loadTime;
            } else if (data.type === 'request') {
              PreviewPanel.status.metrics.requests++;
            }
            updateMetrics();
          }

          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }

          // Set preview URL (called from parent)
          function setPreviewUrl(url) {
            currentUrl = url;
            const frame = document.getElementById('preview-frame');
            if (url) {
              addLog('info', 'Setting preview URL...', { url });
              frame.src = url;
              updatePreviewStatus('loading');
            } else {
              frame.src = 'about:blank';
              currentUrl = '';
            }
          }

          // Initialize on DOM load
          document.addEventListener('DOMContentLoaded', () => {
            initializePreview();

            // Listen for preview URL updates from parent
            window.addEventListener('message', (event) => {
              if (event.data.type === 'setPreviewUrl') {
                setPreviewUrl(event.data.url);
              }
            });
          });

          // Expose functions to global scope
          window.previewReload = previewReload;
          window.previewNewTab = previewNewTab;
          window.previewDevTools = previewDevTools;
          window.closeDevTools = closeDevTools;
          window.previewClearLogs = previewClearLogs;
          window.clearLogs = clearLogs;
          window.changePreviewTheme = changePreviewTheme;
          window.setPreviewUrl = setPreviewUrl;
        </script>
      </div>
    `;
  },
};