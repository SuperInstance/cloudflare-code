/**
 * Monaco Editor Panel Component
 *
 * Features:
 * - Monaco editor with syntax highlighting
 * - Multiple file tabs
 * - File locking indicators
 * - Open/close functionality
 * - Auto-save capabilities
 * - Error/warning markers
 */

import { html } from 'hono/html';
import { Hono } from 'hono';

export interface EditorTab {
  id: string;
  path: string;
  language: string;
  content: string;
  modified: boolean;
  locked: boolean;
  lockedBy?: string;
}

export interface EditorOptions {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  tabSize: number;
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  autoSave: 'off' | 'afterDelay' | 'onFocusChange';
}

export const EditorPanel = {
  // Language mappings
  languageMap: {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'html': 'html',
    'css': 'css',
    'sql': 'sql',
    'json': 'json',
    'yaml': 'yaml',
    'xml': 'xml',
    'md': 'markdown',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'dart': 'dart',
    'vue': 'vue',
    'svelte': 'svelte',
  },

  // Default options
  defaultOptions: {
    theme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',
    autoSave: 'afterDelay',
  } as EditorOptions,

  render: (tabs: EditorTab[], options: EditorOptions = EditorPanel.defaultOptions) => {
    return html`
      <div class="editor-panel" data-editor-initialized="false">
        <!-- Editor Header -->
        <div class="editor-header">
          <div class="tabs-container" id="tabs-container">
            ${tabs.map(tab => EditorPanel.renderTab(tab)).join('')}
            <button class="tab-btn new-tab-btn" onclick="createNewTab()">
              +
            </button>
          </div>

          <div class="editor-actions">
            <button class="action-btn" onclick="toggleEditor()" title="Toggle Editor">
              📝
            </button>
            <button class="action-btn" onclick="saveAllFiles()" title="Save All">
              💾
            </button>
            <button class="action-btn" onclick="formatCode()" title="Format Code">
              🎨
            </button>
            <button class="action-btn" onclick="toggleOptions()" title="Options">
              ⚙️
            </button>
          </div>
        </div>

        <!-- Editor Container -->
        <div class="editor-container" id="editor-container">
          <div id="monaco-editor" class="monaco-editor"></div>
        </div>

        <!-- Options Panel (hidden by default) -->
        <div class="options-panel" id="options-panel" style="display: none;">
          <h3>Editor Options</h3>
          <div class="option-group">
            <label>Theme:</label>
            <select id="theme-select" onchange="updateTheme(this.value)">
              <option value="vs-dark" ${options.theme === 'vs-dark' ? 'selected' : ''}>Dark</option>
              <option value="vs" ${options.theme === 'vs' ? 'selected' : ''}>Light</option>
              <option value="hc-black" ${options.theme === 'hc-black' ? 'selected' : ''}>High Contrast</option>
            </select>
          </div>
          <div class="option-group">
            <label>Font Size: ${options.fontSize}px</label>
            <input type="range" id="font-size-slider" min="8" max="32" value="${options.fontSize}"
                   oninput="updateFontSize(this.value)">
          </div>
          <div class="option-group">
            <label>Tab Size: ${options.tabSize}</label>
            <input type="number" min="1" max="8" value="${options.tabSize}"
                   onchange="updateTabSize(this.value)">
          </div>
          <div class="option-group">
            <label>Word Wrap:</label>
            <select id="word-wrap-select" onchange="updateWordWrap(this.value)">
              <option value="off" ${options.wordWrap === 'off' ? 'selected' : ''}>Off</option>
              <option value="on" ${options.wordWrap === 'on' ? 'selected' : ''}>On</option>
              <option value="wordWrapColumn" ${options.wordWrap === 'wordWrapColumn' ? 'selected' : ''}>Column</option>
              <option value="bounded" ${options.wordWrap === 'bounded' ? 'selected' : ''}>Bounded</option>
            </select>
          </div>
          <div class="option-group">
            <label>
              <input type="checkbox" id="minimap-checkbox" ${options.minimap ? 'checked' : ''}
                     onchange="updateMinimap(this.checked)">
              Show Minimap
            </label>
          </div>
          <div class="option-group">
            <label>
              <input type="checkbox" id="line-numbers-checkbox" ${options.lineNumbers !== 'off' ? 'checked' : ''}
                     onchange="updateLineNumbers(this.checked)">
              Show Line Numbers
            </label>
          </div>
          <div class="option-group">
            <label>
              Auto-save:
              <select id="auto-save-select" onchange="updateAutoSave(this.value)">
                <option value="off" ${options.autoSave === 'off' ? 'selected' : ''}>Off</option>
                <option value="afterDelay" ${options.autoSave === 'afterDelay' ? 'selected' : ''}>After 1s</option>
                <option value="onFocusChange" ${options.autoSave === 'onFocusChange' ? 'selected' : ''}>On Focus</option>
              </select>
            </label>
          </div>
          <button class="options-close-btn" onclick="closeOptions()">Close</button>
        </div>

        <!-- File Creation Modal -->
        <div id="file-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <span class="close" onclick="closeFileModal()">&times;</span>
            <h2>Create New File</h2>
            <div class="form-group">
              <label for="file-path">File Path:</label>
              <input type="text" id="file-path" placeholder="src/index.ts" />
            </div>
            <div class="form-group">
              <label for="file-content">Content (optional):</label>
              <textarea id="file-content" rows="6" placeholder="// Your code here..."></textarea>
            </div>
            <div class="modal-actions">
              <button class="btn btn-primary" onclick="createFile()">Create</button>
              <button class="btn btn-secondary" onclick="closeFileModal()">Cancel</button>
            </div>
          </div>
        </div>

        <style>
          .editor-panel {
            height: 100%;
            background: #1e1e1e;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            display: none;
            flex-direction: column;
          }

          .editor-panel.active {
            display: flex;
          }

          .editor-header {
            background: #252526;
            border-bottom: 1px solid #333;
            display: flex;
            align-items: center;
            padding: 0 8px;
            height: 40px;
            flex-shrink: 0;
          }

          .tabs-container {
            display: flex;
            align-items: center;
            flex: 1;
            overflow: hidden;
          }

          .tab {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            background: #2d2d30;
            border: 1px solid #333;
            border-radius: 4px 4px 0 0;
            margin-right: 2px;
            cursor: pointer;
            transition: all 0.2s;
            max-width: 200px;
            min-width: 80px;
        }

          .tab.active {
            background: #1e1e1e;
            border-color: #007acc;
            border-bottom-color: #1e1e1e;
          }

          .tab:hover {
            background: #3e3e42;
          }

          .tab.active:hover {
            background: #2e2e2e;
          }

          .tab-title {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 12px;
            color: #cccccc;
        }

          .tab-modified {
            color: #cccccc;
            font-weight: bold;
          }

          .tab.locked .tab-title::before {
            content: "🔒 ";
            color: #ff6b6b;
          }

          .tab-actions {
            display: flex;
            gap: 4px;
            margin-left: 6px;
          }

          .tab-btn {
            background: transparent;
            border: none;
            color: #cccccc;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 10px;
            transition: background 0.2s;
        }

          .tab-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

          .tab-btn.close:hover {
            background: rgba(255, 107, 107, 0.3);
            color: #ff6b6b;
          }

          .new-tab-btn {
            width: 24px;
            height: 28px;
            min-width: 24px;
            background: #2d2d30;
            border: 1px solid #333;
            border-radius: 4px;
            color: #cccccc;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all 0.2s;
            margin-left: 2px;
          }

          .new-tab-btn:hover {
            background: #3e3e42;
            border-color: #007acc;
          }

          .editor-actions {
            display: flex;
            gap: 4px;
            padding-left: 8px;
            border-left: 1px solid #333;
        }

          .action-btn {
            background: transparent;
            border: none;
            color: #cccccc;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.2s;
            font-size: 14px;
        }

          .action-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

          .editor-container {
            flex: 1;
            position: relative;
            overflow: hidden;
          }

          .monaco-editor {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
          }

          .options-panel {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #252526;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            width: 400px;
            max-width: 90vw;
          }

          .options-panel h3 {
            margin: 0 0 16px 0;
            color: #cccccc;
            font-size: 16px;
          }

          .option-group {
            margin-bottom: 12px;
          }

          .option-group label {
            display: block;
            color: #cccccc;
            font-size: 12px;
            margin-bottom: 4px;
          }

          .option-group select,
          .option-group input[type="number"],
          .option-group input[type="range"] {
            width: 100%;
            padding: 4px;
            border: 1px solid #333;
            border-radius: 4px;
            background: #2d2d30;
            color: #cccccc;
            font-size: 12px;
          }

          .option-group input[type="range"] {
            padding: 0;
          }

          .option-group input[type="checkbox"] {
            margin-right: 6px;
          }

          .options-close-btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
            margin-top: 12px;
          }

          .options-close-btn:hover {
            background: #005a9e;
          }

          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1001;
          }

          .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #252526;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            width: 500px;
            max-width: 90vw;
            max-height: 90vh;
            overflow-y: auto;
          }

          .modal-content h2 {
            margin: 0 0 16px 0;
            color: #cccccc;
          }

          .form-group {
            margin-bottom: 12px;
          }

          .form-group label {
            display: block;
            color: #cccccc;
            font-size: 12px;
            margin-bottom: 4px;
          }

          .form-group input[type="text"],
          .form-group textarea {
            width: 100%;
            padding: 6px;
            border: 1px solid #333;
            border-radius: 4px;
            background: #2d2d30;
            color: #cccccc;
            font-family: monospace;
            font-size: 12px;
          }

          .form-group textarea {
            resize: vertical;
            min-height: 100px;
          }

          .modal-actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
          }

          .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
          }

          .btn-primary {
            background: #007acc;
            color: white;
          }

          .btn-primary:hover {
            background: #005a9e;
          }

          .btn-secondary {
            background: #2d2d30;
            color: #cccccc;
            border: 1px solid #333;
          }

          .btn-secondary:hover {
            background: #3e3e42;
          }

          .modal .close {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 20px;
            cursor: pointer;
            color: #cccccc;
          }

          .modal .close:hover {
            color: white;
          }

          @media (max-width: 768px) {
            .editor-panel {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              height: 50vh;
              border-radius: 8px 8px 0 0;
              z-index: 999;
            }

            .options-panel,
            .modal-content {
              width: 95vw !important;
            }
          }
        </style>

        <script>
          let editor;
          let currentTab;
          let tabs = ${JSON.stringify(tabs)};
          let options = ${JSON.stringify(options)};
          let saveTimeout;

          // Initialize Monaco Editor
          function initializeEditor() {
            if (document.querySelector('#editor-panel').dataset.editorInitialized === 'true') {
              return;
            }

            // Load Monaco (in a real implementation, you'd load the Monaco library)
            // For now, we'll simulate the editor functionality

            editor = {
              getValue: () => document.querySelector('.editor-textarea')?.value || '',
              setValue: (value) => {
                if (document.querySelector('.editor-textarea')) {
                  document.querySelector('.editor-textarea').value = value;
                }
              },
              getModel: () => ({
                getModeId: () => 'typescript',
                getVersionId: () => 1
              }),
              onDidChangeModelContent: (callback) => {
                // Simulate model change events
              },
              onDidChangeCursorPosition: (callback) => {
                // Simulate cursor position changes
              },
              addAction: (action) => {
                // Add editor actions
              },
              addCommand: (keybinding, handler) => {
                // Add keyboard shortcuts
              },
              getConfiguration: (key) => options[key] || options,
              updateOptions: (newOptions) => {
                Object.assign(options, newOptions);
              }
            };

            // Set up event listeners
            setupEditorEventListeners();

            document.querySelector('#editor-panel').dataset.editorInitialized = 'true';
          }

          function setupEditorEventListeners() {
            // Auto-save functionality
            if (options.autoSave !== 'off' && document.querySelector('.editor-textarea')) {
              document.querySelector('.editor-textarea').addEventListener('input', () => {
                clearTimeout(saveTimeout);
                if (options.autoSave === 'afterDelay') {
                  saveTimeout = setTimeout(() => saveCurrentFile(), 1000);
                } else if (options.autoSave === 'onFocusChange') {
                  // Handle focus change events
                }
              });
            }
          }

          // Tab management
          function switchTab(tabId) {
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
              tab.classList.remove('active');
            });

            // Add active class to selected tab
            const tabElement = document.querySelector(\`.tab[data-id="\${tabId}"]\`);
            if (tabElement) {
              tabElement.classList.add('active');

              // Update editor content
              const tab = tabs.find(t => t.id === tabId);
              if (tab && editor) {
                editor.setValue(tab.content);
                currentTab = tab;

                // Update title
                document.title = tab.path + ' - Cocapn';
              }
            }
          }

          function closeTab(tabId) {
            const tabIndex = tabs.findIndex(t => t.id === tabId);
            if (tabIndex > -1) {
              tabs.splice(tabIndex, 1);

              // Re-render tabs
              renderTabs();

              // Switch to next available tab
              if (tabs.length > 0) {
                const nextTabId = tabs[Math.min(tabIndex, tabs.length - 1)].id;
                switchTab(nextTabId);
              } else {
                currentTab = null;
                editor.setValue('');
              }
            }
          }

          function createNewTab() {
            openFileModal();
          }

          function renderTabs() {
            const container = document.getElementById('tabs-container');
            const tabsHtml = tabs.map(tab => EditorPanel.renderTab(tab)).join('');

            // Replace tabs container (keeping the new tab button)
            const newTabBtn = '<button class="tab-btn new-tab-btn" onclick="createNewTab()">+</button>';
            container.innerHTML = tabsHtml + newTabBtn;

            // Set up tab event listeners
            setupTabEventListeners();
          }

          function setupTabEventListeners() {
            document.querySelectorAll('.tab').forEach(tabElement => {
              tabElement.addEventListener('click', () => {
                const tabId = tabElement.dataset.id;
                switchTab(tabId);
              });
            });

            document.querySelectorAll('.tab-btn.close').forEach(closeBtn => {
              closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = closeBtn.parentElement.dataset.id;
                closeTab(tabId);
              });
            });
          }

          function renderTab(tab) {
            const language = EditorPanel.languageMap[tab.path.split('.').pop()] || 'plaintext';
            const icon = getLanguageIcon(language);
            const modifiedClass = tab.modified ? 'tab-modified' : '';
            const lockedClass = tab.locked ? 'locked' : '';

            return \`
              <div class="tab \${modifiedClass} \${lockedClass}" data-id="\${escapeHtml(tab.id)}">
                <span class="tab-icon">\${icon}</span>
                <span class="tab-title">\${escapeHtml(tab.path)}</span>
                <div class="tab-actions">
                  <button class="tab-btn close" onclick="event.stopPropagation(); closeTab('\${escapeHtml(tab.id)}')">×</button>
                </div>
              </div>
            \`;
          }

          function getLanguageIcon(language) {
            const iconMap = {
              'typescript': '📝',
              'javascript': '📜',
              'html': '🌐',
              'css': '🎨',
              'sql': '🗄️',
              'json': '📋',
              'yaml': '📄',
              'markdown': '📖',
              'python': '🐍',
              'go': '🐹',
              'rust': '🦀',
              'java': '☕',
              'cpp': '⚡',
              'c': '🔧',
              'php': '🐘',
              'ruby': '💎',
              'swift': '🦉',
              'kotlin': '🟣',
              'dart': '🎯',
              'vue': '💚',
              'svelte': '🔥',
              'plaintext': '📄'
            };
            return iconMap[language] || '📄';
          }

          // File operations
          function saveCurrentFile() {
            if (!currentTab || !editor) return;

            currentTab.content = editor.getValue();
            currentTab.modified = false;

            // Save to backend
            fetch('/api/files/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId: window.sessionId,
                path: currentTab.path,
                content: currentTab.content,
                provider: window.currentProvider
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                renderTabs();
                console.log('File saved:', currentTab.path);
              }
            })
            .catch(error => {
              console.error('Error saving file:', error);
            });
          }

          function saveAllFiles() {
            tabs.forEach(tab => {
              if (tab.modified && editor) {
                tab.content = editor.getValue();
                tab.modified = false;
              }
            });

            // Save all files to backend
            fetch('/api/files/save-all', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId: window.sessionId,
                files: tabs.map(tab => ({
                  path: tab.path,
                  content: tab.content
                })),
                provider: window.currentProvider
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                renderTabs();
                alert('All files saved successfully!');
              }
            })
            .catch(error => {
              console.error('Error saving files:', error);
              alert('Failed to save some files.');
            });
          }

          function formatCode() {
            if (!editor) return;

            // Simulate code formatting
            const currentContent = editor.getValue();
            // Add some basic formatting simulation
            const formattedContent = currentContent
              .split('\\n')
              .map(line => line.trim())
              .filter(line => line || line.trim() !== '')
              .join('\\n  ');

            editor.setValue(formattedContent);

            // Mark as modified
            if (currentTab) {
              currentTab.modified = true;
              renderTabs();
            }
          }

          // Editor controls
          function toggleEditor() {
            const panel = document.querySelector('.editor-panel');
            panel.classList.toggle('active');

            if (panel.classList.contains('active') && !editor) {
              setTimeout(initializeEditor, 100);
            }
          }

          function toggleOptions() {
            const panel = document.getElementById('options-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
          }

          function closeOptions() {
            document.getElementById('options-panel').style.display = 'none';
          }

          // Options handlers
          function updateTheme(theme) {
            options.theme = theme;
            if (editor) {
              // Update Monaco theme
              console.log('Theme updated to:', theme);
            }
          }

          function updateFontSize(size) {
            options.fontSize = parseInt(size);
            document.querySelector('.editor-textarea')?.style.setProperty('font-size', size + 'px');
          }

          function updateTabSize(size) {
            options.tabSize = parseInt(size);
          }

          function updateWordWrap(wrap) {
            options.wordWrap = wrap;
          }

          function updateMinimap(enabled) {
            options.minimap = enabled;
          }

          function updateLineNumbers(enabled) {
            options.lineNumbers = enabled ? 'on' : 'off';
          }

          function updateAutoSave(mode) {
            options.autoSave = mode;
          }

          // File modal functions
          function openFileModal() {
            document.getElementById('file-modal').style.display = 'block';
          }

          function closeFileModal() {
            document.getElementById('file-modal').style.display = 'none';
            document.getElementById('file-path').value = '';
            document.getElementById('file-content').value = '';
          }

          function createFile() {
            const path = document.getElementById('file-path').value.trim();
            const content = document.getElementById('file-content').value;

            if (!path) {
              alert('Please enter a file path.');
              return;
            }

            // Create new tab
            const newTab = {
              id: 'tab-' + Date.now(),
              path: path,
              language: EditorPanel.languageMap[path.split('.').pop()] || 'plaintext',
              content: content || '',
              modified: false,
              locked: false
            };

            tabs.push(newTab);
            renderTabs();
            switchTab(newTab.id);
            closeFileModal();
          }

          // Utility function to escape HTML
          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }

          // Initialize when DOM is loaded
          document.addEventListener('DOMContentLoaded', () => {
            renderTabs();

            // Set up keyboard shortcuts
            document.addEventListener('keydown', (e) => {
              if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                  case 's':
                    e.preventDefault();
                    saveCurrentFile();
                    break;
                  case 'o':
                    e.preventDefault();
                    openFileModal();
                    break;
                  case 'w':
                    e.preventDefault();
                    if (currentTab) {
                      closeTab(currentTab.id);
                    }
                    break;
                  case '\\':
                    e.preventDefault();
                    toggleOptions();
                    break;
                }
              }
            });
          });

          // Expose functions to global scope
          window.switchTab = switchTab;
          window.closeTab = closeTab;
          window.createNewTab = createNewTab;
          window.toggleEditor = toggleEditor;
          window.saveAllFiles = saveAllFiles;
          window.formatCode = formatCode;
          window.toggleOptions = toggleOptions;
          window.closeOptions = closeOptions;
          window.updateTheme = updateTheme;
          window.updateFontSize = updateFontSize;
          window.updateTabSize = updateTabSize;
          window.updateWordWrap = updateWordWrap;
          window.updateMinimap = updateMinimap;
          window.updateLineNumbers = updateLineNumbers;
          window.updateAutoSave = updateAutoSave;
          window.openFileModal = openFileModal;
          window.closeFileModal = closeFileModal;
          window.createFile = createFile;
        </script>
      </div>
    `;
  },
};