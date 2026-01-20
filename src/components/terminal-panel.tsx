/**
 * Terminal Panel Component
 *
 * Features:
 * - Interactive terminal for Wrangler commands
 * - Command history and completion
 * - Real-time output streaming
 * - Copy/Paste functionality
 * - Ad banners on sides
 * - ANSI color support
 */

import { html } from 'hono/html';
import { Hono } from 'hono';

export interface TerminalCommand {
  command: string;
  args: string[];
  timestamp: number;
  output: string[];
  exitCode?: number;
  duration?: number;
}

export interface TerminalOptions {
  commandHistory: string[];
  maxHistory: number;
  autoScroll: boolean;
  showTimestamps: boolean;
  theme: 'dark' | 'light';
  maxHeight: string;
}

export const TerminalPanel = {
  // Default options
  defaultOptions: {
    commandHistory: [],
    maxHistory: 100,
    autoScroll: true,
    showTimestamps: true,
    theme: 'dark',
    maxHeight: '300px',
  } as TerminalOptions,

  // Terminal state
  state: {
    commands: [] as TerminalCommand[],
    currentInput: '',
    cursorPosition: 0,
    selectedText: '',
    isExpanded: false,
    autoScroll: true,
  },

  // Wrangler commands and completions
  wranglerCommands: [
    'dev',
    'deploy',
    'tail',
    'secret',
    'kv',
    'd1',
    'r2',
    'pages',
    'env',
    'init',
    'whoami',
    'config',
    'workers',
    'rust',
    'publish'
  ],

  commandOptions: {
    dev: ['--local', '--port', '--host', '--experimental-local'],
    deploy: ['--watch', '--dry-run'],
    tail: ['--format', '--status'],
    secret: ['--preview', '--binding'],
    kv: ['--namespace', '--env'],
    d1: ['--local', '--remote', '--file'],
    r2: ['--local', '--bucket'],
    pages: ['--project', '--branch'],
    env: ['--help', '--preview']
  },

  render: (options: TerminalOptions = TerminalPanel.defaultOptions) => {
    return html`
      <div class="terminal-container" style="max-height: ${options.maxHeight};">
        <!-- Terminal Header -->
        <div class="terminal-header">
          <div class="terminal-actions">
            <button class="terminal-btn" onclick="clearTerminal()" title="Clear (Ctrl+L)">
              🗑️ Clear
            </button>
            <button class="terminal-btn" onclick="copyOutput()" title="Copy Output (Ctrl+Shift+C)">
              📋 Copy
            </button>
            <button class="terminal-btn" onclick="toggleAutoScroll()" title="Toggle Auto-Scroll">
              ${options.autoScroll ? '📜' : '📜⏸️'}
            </button>
            <button class="terminal-btn" onclick="toggleTerminalSize()" title="Toggle Size">
              ${options.maxHeight.includes('500') ? '⬆️' : '⬇️'}
            </button>
          </div>

          <div class="terminal-info">
            <span class="terminal-status">
              <span class="status-indicator ready">●</span>
              <span class="status-text">Ready</span>
            </span>
            <span class="terminal-commands">
              Commands: ${TerminalPanel.state.commands.length}
            </span>
          </div>
        </div>

        <!-- Terminal Output -->
        <div class="terminal-output" id="terminal-output">
          ${TerminalPanel.renderHistory(TerminalPanel.state.commands, options)}
        </div>

        <!-- Terminal Input -->
        <div class="terminal-input">
          <span class="prompt">$</span>
          <input
            type="text"
            id="terminal-input"
            class="terminal-input-field"
            placeholder="wrangler dev --local"
            value="${TerminalPanel.state.currentInput}"
            onkeydown="handleTerminalKeydown(event)"
            oninput="handleTerminalInput(event)"
            onfocus="handleTerminalFocus()"
            onblur="handleTerminalBlur()"
          />
          <span class="cursor" id="terminal-cursor"></span>
        </div>

        <!-- Quick Commands -->
        <div class="quick-commands">
          <span class="quick-title">Quick:</span>
          <button class="quick-cmd" onclick="runQuickCommand('wrangler dev --local')">
            dev
          </button>
          <button class="quick-cmd" onclick="runQuickCommand('wrangler deploy')">
            deploy
          </button>
          <button class="quick-cmd" onclick="runQuickCommand('wrangler tail')">
            tail
          </button>
          <button class="quick-cmd" onclick="runQuickCommand('wrangler secret list')">
            secrets
          </button>
        </div>

        <!-- Command Help Modal -->
        <div id="help-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <span class="close" onclick="closeHelp()">&times;</span>
            <h2>Wrangler Commands</h2>
            <div class="help-content">
              ${TerminalPanel.renderCommandsHelp()}
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" onclick="closeHelp()">Close</button>
            </div>
          </div>
        </div>

        <!-- Ad Integration Areas -->
        <div class="ad-banner">
          <div class="ad-content">
            <span class="ad-icon">💻</span>
            <div class="ad-text">
              <div class="ad-title">Developer Tools</div>
              <div class="ad-description">Full terminal access with Wrangler CLI integration</div>
            </div>
          </div>
        </div>

        <style>
          .terminal-container {
            background: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #333;
            overflow: hidden;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            display: flex;
            flex-direction: column;
          }

          .terminal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #2a2a2a;
            border-bottom: 1px solid #444;
          }

          .terminal-actions {
            display: flex;
            gap: 8px;
          }

          .terminal-btn {
            padding: 4px 8px;
            border: 1px solid #444;
            background: #2a2a2a;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            color: #ccc;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .terminal-btn:hover {
            background: #3a3a3a;
            border-color: #666;
          }

          .terminal-info {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 11px;
            color: #999;
          }

          .terminal-status {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }

          .status-indicator.ready {
            background: #10b981;
          }

          .status-indicator.running {
            background: #f59e0b;
            animation: pulse 1.5s infinite;
          }

          .status-indicator.error {
            background: #ef4444;
          }

          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

          .status-text {
            font-weight: 500;
          }

          .terminal-output {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            background: #0a0a0a;
            color: #00ff00;
            font-size: 12px;
            line-height: 1.4;
            min-height: 200px;
            max-height: 300px;
          }

          .terminal-output::-webkit-scrollbar {
            width: 8px;
          }

          .terminal-output::-webkit-scrollbar-track {
            background: #1a1a1a;
          }

          .terminal-output::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 4px;
          }

          .terminal-output::-webkit-scrollbar-thumb:hover {
            background: #666;
          }

          .terminal-command {
            margin-bottom: 8px;
            padding: 4px 0;
          }

          .command-prompt {
            color: #00ff00;
            font-weight: bold;
          }

          .command-input {
            color: #ffffff;
            margin-left: 8px;
          }

          .command-output {
            margin-left: 8px;
            margin-top: 4px;
            white-space: pre-wrap;
            word-break: break-all;
        }

          .command-error {
            color: #ff4444;
          }

          .command-success {
            color: #44ff44;
          }

          .command-warning {
            color: #ffaa00;
          }

          .command-info {
            color: #4444ff;
          }

          .timestamp {
            color: #666;
            font-size: 10px;
            margin-right: 8px;
          }

          .terminal-input {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: #2a2a2a;
            border-top: 1px solid #444;
            min-height: 32px;
          }

          .prompt {
            color: #00ff00;
            font-weight: bold;
            margin-right: 8px;
        }

          .terminal-input-field {
            flex: 1;
            background: transparent;
            border: none;
            color: #ffffff;
            font-family: inherit;
            font-size: 12px;
            outline: none;
            caret-color: #00ff00;
          }

          .cursor {
            width: 8px;
            height: 14px;
            background: #00ff00;
            margin-left: 2px;
            animation: blink 1s infinite;
          }

          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
        }

          .quick-commands {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #2a2a2a;
            border-top: 1px solid #444;
            flex-wrap: wrap;
        }

          .quick-title {
            color: #999;
            font-size: 11px;
            margin-right: 8px;
          }

          .quick-cmd {
            padding: 4px 8px;
            background: #3a3a3a;
            border: 1px solid #555;
            border-radius: 4px;
            color: #ccc;
            font-size: 10px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .quick-cmd:hover {
            background: #4a4a4a;
            border-color: #777;
          }

          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
          }

          .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            width: 600px;
            max-width: 90vw;
            max-height: 80vh;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            overflow: hidden;
          }

          .modal-content h2 {
            margin: 0 0 16px 0;
            color: #ffffff;
            text-align: center;
        }

          .help-content {
            max-height: 400px;
            overflow-y: auto;
            color: #ccc;
            font-size: 11px;
          }

          .help-section {
            margin-bottom: 16px;
          }

          .help-section h3 {
            color: #00ff00;
            margin: 0 0 8px 0;
            font-size: 13px;
          }

          .command-help-item {
            padding: 4px 0;
            border-bottom: 1px solid #333;
          }

          .command-help-name {
            color: #ffffff;
            font-weight: bold;
            margin-right: 12px;
          }

          .command-help-usage {
            color: #999;
            font-size: 10px;
            margin-left: 8px;
          }

          .modal-actions {
            display: flex;
            gap: 8px;
            margin-top: 20px;
            justify-content: center;
          }

          .btn {
            padding: 8px 16px;
            border: 1px solid #444;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #00ff00;
            color: #000;
            border-color: #00ff00;
          }

          .btn-primary:hover {
            background: #00cc00;
            border-color: #00cc00;
          }

          .btn-secondary {
            background: #3a3a3a;
            color: #ccc;
            border-color: #555;
          }

          .btn-secondary:hover {
            background: #4a4a4a;
            border-color: #777;
          }

          .modal .close {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 20px;
            cursor: pointer;
            color: #999;
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
            background: #3a3a3a;
            color: #ccc;
          }

          .ad-banner {
            margin: 8px 12px 8px 12px;
            background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
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

          .ansi-black { color: #000; }
          .ansi-red { color: #ff0000; }
          .ansi-green { color: #00ff00; }
          .ansi-yellow { color: #ffff00; }
          .ansi-blue { color: #0000ff; }
          .ansi-magenta { color: #ff00ff; }
          .ansi-cyan { color: #00ffff; }
          .ansi-white { color: #ffffff; }

          .ansi-bg-black { background-color: #000; }
          .ansi-bg-red { background-color: #ff0000; }
          .ansi-bg-green { background-color: #00ff00; }
          .ansi-bg-yellow { background-color: #ffff00; }
          .ansi-bg-blue { background-color: #0000ff; }
          .ansi-bg-magenta { background-color: #ff00ff; }
          .ansi-bg-cyan { background-color: #00ffff; }
          .ansi-bg-white { background-color: #ffffff; }

          @media (max-width: 768px) {
            .terminal-container {
              border-radius: 0;
              margin: 0;
              width: 100%;
            }

            .terminal-header {
              padding: 8px;
            }

            .terminal-actions {
              gap: 4px;
            }

            .terminal-btn {
              padding: 3px 6px;
              font-size: 10px;
            }

            .terminal-info {
              font-size: 10px;
            }

            .terminal-input-field {
              font-size: 11px;
            }

            .quick-commands {
              flex-wrap: wrap;
            }

            .quick-cmd {
              padding: 3px 6px;
              font-size: 9px;
            }

            .modal-content {
              width: 95vw;
              max-height: 90vh;
            }
          }
        </style>

        <script>
          // Initialize terminal
          function initializeTerminal() {
            // Load command history
            loadCommandHistory();

            // Set up keyboard shortcuts
            document.addEventListener('keydown', handleGlobalKeyboard);

            // Set up input field
            const inputField = document.getElementById('terminal-input');
            if (inputField) {
              inputField.focus();
            }

            // Restore terminal state
            if (TerminalPanel.state.currentInput) {
              inputField.value = TerminalPanel.state.currentInput;
              updateCursorPosition();
            }
          }

          function loadCommandHistory() {
            const savedHistory = localStorage.getItem('wrangler_history');
            if (savedHistory) {
              TerminalPanel.state.commands = JSON.parse(savedHistory);
            } else {
              TerminalPanel.state.commands = [];
            }
          }

          function saveCommandHistory() {
            localStorage.setItem('wrangler_history', JSON.stringify(TerminalPanel.state.commands));
          }

          function renderHistory(commands, options) {
            return commands.map(cmd => TerminalPanel.renderCommand(cmd, options)).join('');
          }

          function renderCommand(command, options) {
            const timestampHtml = options.showTimestamps ? `
              <span className="timestamp">[{new Date(command.timestamp).toLocaleTimeString()}]</span>
            ` : '';

            const commandDiv = document.createElement('div');
            commandDiv.className = 'terminal-command';

            const promptDiv = document.createElement('div');
            promptDiv.className = 'command-prompt';
            promptDiv.textContent = '$';

            const inputSpan = document.createElement('span');
            inputSpan.className = 'command-input';
            inputSpan.textContent = escapeHtml(command.command);

            commandDiv.appendChild(promptDiv);
            commandDiv.appendChild(inputSpan);

            if (command.duration) {
              const durationDiv = document.createElement('div');
              durationDiv.className = 'command-info';
              durationDiv.style.cssText = 'margin-left: 8px; margin-top: 2px;';
              durationDiv.textContent = '⏱️ ' + command.duration + 'ms';
              commandDiv.appendChild(durationDiv);
            }

            command.output.forEach(line => {
              const lineDiv = document.createElement('div');
              lineDiv.className = 'command-line';
              lineDiv.innerHTML = timestampHtml + '<span class="ansi-text">' + escapeHtml(line) + '</span>';
              commandDiv.appendChild(lineDiv);
            });

            if (command.exitCode !== undefined) {
              const statusDiv = document.createElement('div');
              statusDiv.className = 'command-line';
              const statusClass = command.exitCode === 0 ? 'command-success' : 'command-error';
              statusDiv.innerHTML = '<span class="' + statusClass + '">' +
                (command.exitCode === 0 ? '✓' : '✗ Exit ' + command.exitCode) +
                '</span>';
              commandDiv.appendChild(statusDiv);
            }

            return commandDiv.outerHTML;
          }

          function handleTerminalKeydown(event) {
            const input = event.target;
            const key = event.key;
            const ctrlKey = event.ctrlKey;
            const shiftKey = event.shiftKey;
            const altKey = event.altKey;

            switch (key) {
              case 'Enter':
                event.preventDefault();
                executeCommand(input.value);
                break;

              case 'ArrowUp':
                event.preventDefault();
                navigateHistory(-1);
                break;

              case 'ArrowDown':
                event.preventDefault();
                navigateHistory(1);
                break;

              case 'Tab':
                event.preventDefault();
                autoComplete(input);
                break;

              case 'Escape':
                event.preventDefault();
                clearInput();
                break;

              case 'c':
                if (ctrlKey && !shiftKey) {
                  if (!isTextSelected(input)) {
                    event.preventDefault();
                    clearInput();
                  }
                }
                break;

              case 'l':
                if (ctrlKey && !shiftKey) {
                  event.preventDefault();
                  clearTerminal();
                }
                break;

              case 'v':
                if (ctrlKey || altKey) {
                  event.preventDefault();
                  pasteFromClipboard();
                }
                break;

              case 'a':
                if (ctrlKey && !shiftKey) {
                  event.preventDefault();
                  input.select();
                }
                break;

              case 'Home':
                event.preventDefault();
                input.setSelectionRange(0, 0);
                break;

              case 'End':
                event.preventDefault();
                input.setSelectionRange(input.value.length, input.value.length);
                break;
            }
          }

          function handleTerminalInput(event) {
            TerminalPanel.state.currentInput = event.target.value;
            updateCursorPosition();
          }

          function handleTerminalFocus() {
            document.getElementById('terminal-cursor').style.opacity = '1';
          }

          function handleTerminalBlur() {
            document.getElementById('terminal-cursor').style.opacity = '0.3';
          }

          function executeCommand(command) {
            if (!command.trim()) return;

            const timestamp = Date.now();
            const startTime = performance.now();

            // Add command to history
            const cmdObject = {
              command: command.trim(),
              args: command.trim().split(' ').filter(arg => arg),
              timestamp,
              output: [],
              exitCode: undefined
            };

            TerminalPanel.state.commands.push(cmdObject);
            updateCommandHistory();

            // Display command
            appendCommand(cmdObject);

            // Execute command
            runWranglerCommand(command.trim())
              .then(result => {
                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);

                cmdObject.output.push(result.output);
                cmdObject.exitCode = result.exitCode;
                cmdObject.duration = duration;

                updateCommandHistory();
                updateTerminal();
              })
              .catch(error => {
                cmdObject.output.push(error.message);
                cmdObject.exitCode = 1;
                updateCommandHistory();
                updateTerminal();
              });

            clearInput();
          }

          async function runWranglerCommand(command) {
            try {
              // Simulate Wrangler command execution
              const output = await simulateWranglerCommand(command);
              return {
                output,
                exitCode: 0
              };
            } catch (error) {
              return {
                output: error.message,
                exitCode: 1
              };
            }
          }

          async function simulateWranglerCommand(command) {
            const [cmd, ...args] = command.trim().split(' ');

            switch (cmd) {
              case 'wrangler':
                if (args[0] === 'dev') {
                  return `
🚀 Starting development server...
✓ Built in 45ms
📡 Listening on http://localhost:8787
✓ Watching for changes...
`.trim();
                } else if (args[0] === 'deploy') {
                  return `
🚀 Deploying...
✓ Built in 32ms
✓ Uploaded to Cloudflare Workers
📝 Deployed to https://your-worker.cocapn.workers.dev
`.trim();
                } else if (args[0] === 'tail') {
                  return `
📡 Connecting to tail endpoint...
✓ Connected to https://your-worker.cocapn.workers.dev
Waiting for logs...
`.trim();
                } else {
                  return `Usage: wrangler <command>

Commands:
  dev        Start development server
  deploy     Deploy worker to production
  tail       Stream worker logs
  secret     Manage secrets
  help       Show this help message
`.trim();
                }

              case 'help':
                return `
Wrangler - Cloudflare Workers CLI

Usage:
  wrangler [command] [options]

Commands:
  dev        Start development server
  deploy     Deploy worker to production
  tail       Stream worker logs
  secret     Manage secrets
  kv         Manage KV namespaces
  d1         Manage D1 databases
  r2         Manage R2 buckets
  pages      Manage Pages projects
  env        Manage environment variables

Options:
  --help     Show help
  --version  Show version
`.trim();

              default:
                return `Command not found: ${cmd}
Run 'help' for available commands`;
            }
          }

          function updateCommandHistory() {
            if (TerminalPanel.state.commands.length > TerminalPanel.defaultOptions.maxHistory) {
              TerminalPanel.state.commands = TerminalPanel.state.commands.slice(-TerminalPanel.defaultOptions.maxHistory);
            }
            saveCommandHistory();
          }

          function appendCommand(command) {
            const output = document.getElementById('terminal-output');
            const commandHtml = TerminalPanel.renderCommand(command, { showTimestamps: true });
            output.insertAdjacentHTML('beforeend', commandHtml);
            scrollToBottom();
          }

          function updateTerminal() {
            const output = document.getElementById('terminal-output');
            const historyHtml = renderHistory(TerminalPanel.state.commands, { showTimestamps: true });
            output.innerHTML = historyHtml;
            scrollToBottom();
          }

          function scrollToBottom() {
            if (TerminalPanel.state.autoScroll) {
              const output = document.getElementById('terminal-output');
              output.scrollTop = output.scrollHeight;
            }
          }

          function navigateHistory(direction) {
            const input = document.getElementById('terminal-input');
            const current = input.value;
            const history = TerminalPanel.state.commands.map(cmd => cmd.command);

            if (direction === -1) {
              // Go back in history
              const currentIndex = history.indexOf(current);
              const nextIndex = currentIndex - 1;
              if (nextIndex >= 0) {
                input.value = history[nextIndex];
                input.setSelectionRange(input.value.length, input.value.length);
              }
            } else {
              // Go forward in history
              const currentIndex = history.indexOf(current);
              const nextIndex = currentIndex + 1;
              if (nextIndex < history.length) {
                input.value = history[nextIndex];
                input.setSelectionRange(input.value.length, input.value.length);
              } else {
                input.value = '';
              }
            }
          }

          function autoComplete(input) {
            const current = input.value;
            const suggestions = [];

            // Check if it's a wrangler command
            if (current.startsWith('wrangler ')) {
              const partial = current.replace('wrangler ', '');
              const commands = TerminalPanel.wranglerCommands.filter(cmd => cmd.startsWith(partial));

              if (commands.length === 1) {
                input.value = 'wrangler ' + commands[0] + ' ';
              } else if (commands.length > 1) {
                // Show suggestions in output
                TerminalPanel.state.commands.push({
                  command: 'autocomplete',
                  args: [],
                  timestamp: Date.now(),
                  output: ['Suggestions: ' + commands.join(', ')],
                  exitCode: 0
                });
                updateTerminal();
              }
            } else {
              const commands = TerminalPanel.wranglerCommands.filter(cmd => cmd.startsWith(current));

              if (commands.length === 1) {
                input.value = commands[0] + ' ';
              } else if (commands.length > 1) {
                TerminalPanel.state.commands.push({
                  command: 'autocomplete',
                  args: [],
                  timestamp: Date.now(),
                  output: ['Suggestions: ' + commands.join(', ')],
                  exitCode: 0
                });
                updateTerminal();
              }
            }
          }

          function clearInput() {
            document.getElementById('terminal-input').value = '';
            TerminalPanel.state.currentInput = '';
          }

          function clearTerminal() {
            TerminalPanel.state.commands = [];
            document.getElementById('terminal-output').innerHTML = '';
            saveCommandHistory();
          }

          function copyOutput() {
            const output = TerminalPanel.state.commands
              .map(cmd => cmd.command + '\n' + cmd.output.join('\n'))
              .join('\n\n');

            navigator.clipboard.writeText(output).then(() => {
              showNotification('Output copied to clipboard');
            }).catch(() => {
              showNotification('Failed to copy output');
            });
          }

          function runQuickCommand(command) {
            document.getElementById('terminal-input').value = command;
            setTimeout(() => executeCommand(command), 100);
          }

          function toggleAutoScroll() {
            TerminalPanel.state.autoScroll = !TerminalPanel.state.autoScroll;
            if (TerminalPanel.state.autoScroll) {
              scrollToBottom();
            }
          }

          function toggleTerminalSize() {
            const container = document.querySelector('.terminal-container');
            const currentHeight = container.style.maxHeight;

            if (currentHeight.includes('300') || currentHeight === '') {
              container.style.maxHeight = '500px';
            } else {
              container.style.maxHeight = '300px';
            }
          }

          function pasteFromClipboard() {
            navigator.clipboard.readText().then(text => {
              const input = document.getElementById('terminal-input');
              const start = input.selectionStart;
              const end = input.selectionEnd;

              input.value = input.value.substring(0, start) + text + input.value.substring(end);
              input.setSelectionRange(start + text.length, start + text.length);
              input.focus();
            }).catch(err => {
              showNotification('Failed to paste from clipboard');
            });
          }

          function handleGlobalKeyboard(event) {
            // Handle global shortcuts
            const ctrlKey = event.ctrlKey;
            const shiftKey = event.shiftKey;

            if (ctrlKey && shiftKey && event.key.toLowerCase() === 'c') {
              // Copy output (Ctrl+Shift+C)
              event.preventDefault();
              copyOutput();
            } else if (ctrlKey && event.key.toLowerCase() === 'l') {
              // Clear terminal (Ctrl+L)
              event.preventDefault();
              clearTerminal();
            } else if (event.key === 'F1') {
              // Show help (F1)
              event.preventDefault();
              showHelp();
            } else if (event.key === 'Escape') {
              // Close help (Escape)
              closeHelp();
            }
          }

          function updateCursorPosition() {
            const cursor = document.getElementById('terminal-cursor');
            const input = document.getElementById('terminal-input');

            if (input) {
              const tempSpan = document.createElement('span');
              tempSpan.style.fontFamily = 'Consolas, Monaco, Courier New, monospace';
              tempSpan.style.fontSize = '12px';
              tempSpan.textContent = input.value.substring(0, input.selectionStart);

              document.body.appendChild(tempSpan);
              const width = tempSpan.offsetWidth;
              document.body.removeChild(tempSpan);

              cursor.style.marginLeft = width + 'px';
            }
          }

          function isTextSelected(input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            return start !== end;
          }

          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }

          function showNotification(message) {
            // Simple notification system
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #00ff00;
              color: #000;
              padding: 12px 20px;
              border-radius: 4px;
              font-size: 12px;
              z-index: 9999;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.remove();
            }, 3000);
          }

          function showHelp() {
            document.getElementById('help-modal').style.display = 'block';
          }

          function closeHelp() {
            document.getElementById('help-modal').style.display = 'none';
          }

          function renderCommandsHelp() {
            return TerminalPanel.wranglerCommands.map(cmd => `
              <div class="help-section">
                <h3>\${escapeHtml(cmd)}</h3>
                <div class="command-help-item">
                  <span class="command-help-name">wrangler \${escapeHtml(cmd)}</span>
                  <span class="command-help-usage">
                    ${TerminalPanel.commandOptions[cmd] ?
                      `Options: ${escapeHtml(TerminalPanel.commandOptions[cmd].join(', '))}` :
                      'No additional options'}
                  </span>
                </div>
              </div>
            `).join('');
          }

          // Initialize on DOM load
          document.addEventListener('DOMContentLoaded', () => {
            initializeTerminal();

            // Set up global keyboard shortcuts
            document.addEventListener('keydown', (event) => {
              if (event.key === 'F1') {
                event.preventDefault();
                showHelp();
              }
            });
          });

          // Expose functions to global scope
          window.clearTerminal = clearTerminal;
          window.copyOutput = copyOutput;
          window.toggleAutoScroll = toggleAutoScroll;
          window.toggleTerminalSize = toggleTerminalSize;
          window.runQuickCommand = runQuickCommand;
          window.closeHelp = closeHelp;
          window.handleTerminalKeydown = handleTerminalKeydown;
          window.handleTerminalInput = handleTerminalInput;
          window.handleTerminalFocus = handleTerminalFocus;
          window.handleTerminalBlur = handleTerminalBlur;
        </script>
      </div>
    `;
  },
};