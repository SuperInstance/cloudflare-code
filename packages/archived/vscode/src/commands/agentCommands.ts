/**
 * Multi-agent orchestration commands
 */

import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

import { ExtensionState } from '../extension';
import { AgentOrchestrationRequest } from '../types';
import { Logger } from '../utils/logger';

export function registerAgentCommands(context: ExtensionContext, state: ExtensionState): void {
  const logger = new Logger('AgentCommands');

  // Multi-agent orchestration
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.multiAgentOrchestrate', async () => {
      logger.info('Starting multi-agent orchestration');

      const task = await vscode.window.showInputBox({
        prompt: 'Describe the task you want agents to work on',
        placeHolder: 'e.g., Review and optimize the authentication module',
        ignoreFocusOut: true
      });

      if (!task) {
        return;
      }

      // Select agents to use
      const availableAgents = [
        { label: 'Code Analyst', picked: true, value: 'code-analyst' },
        { label: 'Refactor Agent', picked: true, value: 'refactor-agent' },
        { label: 'Test Generator', picked: false, value: 'test-generator' },
        { label: 'Debug Assistant', picked: false, value: 'debugger' },
        { label: 'Documentation Writer', picked: false, value: 'documentation' },
        { label: 'Security Scanner', picked: false, value: 'security' },
        { label: 'Performance Optimizer', picked: false, value: 'performance' },
        { label: 'Code Reviewer', picked: true, value: 'code-reviewer' }
      ];

      const selectedAgents = await vscode.window.showQuickPick(availableAgents, {
        placeHolder: 'Select agents to orchestrate',
        canPickMany: true,
        ignoreFocusOut: true
      });

      if (!selectedAgents || selectedAgents.length === 0) {
        return;
      }

      // Select execution mode
      const executionMode = await vscode.window.showQuickPick(
        [
          { label: 'Parallel', description: 'Run all agents simultaneously', value: true },
          { label: 'Sequential', description: 'Run agents one after another', value: false }
        ],
        { placeHolder: 'Select execution mode' }
      );

      if (!executionMode) {
        return;
      }

      // Show agent orchestration panel
      await showAgentOrchestrationPanel(state, task, selectedAgents.map(a => a.value), executionMode.value);
    })
  );

  // Select agent
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.selectAgent', async (agentId: string) => {
      logger.info('Selecting agent', agentId);

      vscode.window.showInformationMessage(
        `Selected agent: ${agentId}`,
        'Configure'
      ).then(selection => {
        if (selection === 'Configure') {
          // Show agent configuration
          vscode.window.showInformationMessage(`Agent configuration coming soon for ${agentId}`);
        }
      });
    })
  );

  // Analyze project context
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.contextAnalyze', async () => {
      logger.info('Analyzing project context');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ClaudeFlare: Analyzing project...',
          cancellable: true
        },
        async (progress, token) => {
          try {
            await state.projectContext.refresh();
            vscode.window.showInformationMessage('Project context analyzed successfully!');

            // Show context view
            await vscode.commands.executeCommand('claudeflare.contextView.focus');
          } catch (error) {
            logger.error('Project analysis failed', error);
            vscode.window.showErrorMessage(
              `Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    })
  );

  // Open context file
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeflare.openContextFile', async (filePath: string) => {
      logger.info('Opening context file', filePath);

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      await vscode.window.showTextDocument(fullPath);
    })
  );
}

/**
 * Show agent orchestration panel
 */
async function showAgentOrchestrationPanel(
  state: ExtensionState,
  task: string,
  agents: string[],
  parallel: boolean
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'claudeflare.agentOrchestration',
    'Agent Orchestration',
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = getAgentOrchestrationWebview(task, agents, parallel);

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case 'start':
        await startAgentOrchestration(state, panel, task, agents, parallel);
        break;
      case 'cancel':
        panel.dispose();
        break;
    }
  });
}

/**
 * Start agent orchestration
 */
async function startAgentOrchestration(
  state: ExtensionState,
  panel: vscode.WebviewPanel,
  task: string,
  agents: string[],
  parallel: boolean
): Promise<void> {
  const logger = new Logger('AgentOrchestration');

  try {
    const contexts = state.projectContext.getAllContexts();
    const context = contexts[0]; // Use first available context

    if (!context) {
      vscode.window.showWarningMessage('No project context available. Please analyze the project first.');
      return;
    }

    const request: AgentOrchestrationRequest = {
      task,
      agents,
      context,
      parallel,
      maxDuration: 60000
    };

    // Update panel to show running state
    panel.webview.postMessage({
      type: 'status',
      status: 'running',
      message: 'Orchestrating agents...'
    });

    const startTime = Date.now();

    // Send updates to panel
    const updateProgress = (agentId: string, status: string, output?: string) => {
      panel.webview.postMessage({
        type: 'agentUpdate',
        agentId,
        status,
        output
      });
    };

    // Call the API
    const response = await state.apiClient.orchestrateAgents(request);

    const duration = Date.now() - startTime;

    // Show final result
    panel.webview.postMessage({
      type: 'complete',
      result: response.result,
      duration
    });

    // Track telemetry
    state.telemetry.trackAgentOrchestration({
      agentCount: agents.length,
      taskType: task.split(' ')[0] || 'general',
      duration,
      success: response.result.success
    });

    // Show summary
    if (response.result.success) {
      vscode.window.showInformationMessage(
        `Agent orchestration completed in ${Math.round(duration / 1000)}s`,
        'View Results'
      ).then(selection => {
        if (selection === 'View Results') {
          panel.reveal();
        }
      });
    }
  } catch (error) {
    logger.error('Agent orchestration failed', error);

    panel.webview.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Orchestration failed'
    });

    vscode.window.showErrorMessage(
      `Agent orchestration failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get agent orchestration webview HTML
 */
function getAgentOrchestrationWebview(task: string, agents: string[], parallel: boolean): string {
  const executionMode = parallel ? 'Parallel' : 'Sequential';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Orchestration</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }
    h1, h2 { margin-top: 0; }
    .task {
      background: var(--vscode-textBlockQuote-background);
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .agent-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .agent {
      background: var(--vscode-button-secondaryBackground);
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 12px;
    }
    .status {
      padding: 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .agent-status {
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .agent-status.running { border-color: var(--vscode-editorWarning-foreground); }
    .agent-status.completed { border-color: var(--vscode-terminal-ansiGreen); }
    .agent-status.failed { border-color: var(--vscode-errorForeground); }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 20px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
    }
    button:hover { opacity: 0.9; }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .output {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      margin-top: 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <h1>Agent Orchestration</h1>

  <div class="task">
    <strong>Task:</strong> ${escapeHtml(task)}
  </div>

  <div>
    <strong>Execution Mode:</strong> ${executionMode}
  </div>

  <h2>Agents</h2>
  <div class="agent-list">
    ${agents.map(agent => `<span class="agent">${agent}</span>`).join('')}
  </div>

  <div id="status" class="status">
    Ready to start
  </div>

  <div id="agentsContainer"></div>

  <div class="actions">
    <button id="startBtn">Start Orchestration</button>
    <button id="cancelBtn" class="secondary">Cancel</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const agents = ${JSON.stringify(agents)};
    const agentsContainer = document.getElementById('agentsContainer');
    const statusDiv = document.getElementById('status');

    document.getElementById('startBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'start' });
      document.getElementById('startBtn').disabled = true;
      statusDiv.textContent = 'Starting orchestration...';
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'cancel' });
    });

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'status':
          statusDiv.textContent = message.status;
          if (message.status === 'running') {
            // Create agent status elements
            agents.forEach(agent => {
              const agentDiv = document.createElement('div');
              agentDiv.className = 'agent-status';
              agentDiv.id = \`agent-\${agent}\`;
              agentDiv.innerHTML = \`
                <strong>\${agent}</strong>
                <div class="status-text">Pending...</div>
              \`;
              agentsContainer.appendChild(agentDiv);
            });
          }
          break;

        case 'agentUpdate':
          const agentDiv = document.getElementById(\`agent-\${message.agentId}\`);
          if (agentDiv) {
            agentDiv.className = \`agent-status \${message.status}\`;
            const statusText = agentDiv.querySelector('.status-text');

            if (message.status === 'running') {
              statusText.textContent = 'Running...';
            } else if (message.status === 'completed') {
              statusText.textContent = 'Completed';
              if (message.output) {
                const outputDiv = document.createElement('div');
                outputDiv.className = 'output';
                outputDiv.textContent = message.output;
                agentDiv.appendChild(outputDiv);
              }
            } else if (message.status === 'failed') {
              statusText.textContent = 'Failed';
            }
          }
          break;

        case 'complete':
          statusDiv.textContent = \`Completed in \${Math.round(message.duration / 1000)}s\`;
          document.getElementById('startBtn').disabled = false;
          break;

        case 'error':
          statusDiv.textContent = 'Error: ' + message.error;
          document.getElementById('startBtn').disabled = false;
          break;
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
