/**
 * Agents view provider - displays available AI agents
 */

import * as vscode from 'vscode';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, Event, EventEmitter } from 'vscode';

import { ApiClient } from '../services/apiClient';
import { Logger } from '../utils/logger';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'busy';
  capabilities: string[];
  icon: string;
}

export class AgentsViewProvider implements TreeDataProvider<AgentItem> {
  private logger: Logger;
  private _onDidChangeTreeData = new EventEmitter<AgentItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<AgentItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private agents: Agent[] = [
    {
      id: 'code-analyst',
      name: 'Code Analyst',
      description: 'Analyzes code structure and patterns',
      status: 'idle',
      capabilities: ['code-analysis', 'pattern-detection', 'complexity-analysis'],
      icon: '$(search)'
    },
    {
      id: 'refactor-agent',
      name: 'Refactor Agent',
      description: 'Refactors and optimizes code',
      status: 'idle',
      capabilities: ['refactoring', 'optimization', 'modernization'],
      icon: '$(sync)'
    },
    {
      id: 'test-generator',
      name: 'Test Generator',
      description: 'Generates unit and integration tests',
      status: 'idle',
      capabilities: ['test-generation', 'test-refactoring', 'coverage-analysis'],
      icon: '$(beaker)'
    },
    {
      id: 'debugger',
      name: 'Debug Assistant',
      description: 'Helps debug and fix issues',
      status: 'idle',
      capabilities: ['debugging', 'error-analysis', 'fix-suggestions'],
      icon: '$(bug)'
    },
    {
      id: 'documentation',
      name: 'Documentation Writer',
      description: 'Generates code documentation',
      status: 'idle',
      capabilities: ['documentation', 'comments', 'readme-generation'],
      icon: '$(book)'
    },
    {
      id: 'security',
      name: 'Security Scanner',
      description: 'Identifies security vulnerabilities',
      status: 'idle',
      capabilities: ['security-analysis', 'vulnerability-detection', 'security-fixes'],
      icon: '$(shield)'
    },
    {
      id: 'performance',
      name: 'Performance Optimizer',
      description: 'Optimizes code performance',
      status: 'idle',
      capabilities: ['performance-analysis', 'optimization', 'bottleneck-detection'],
      icon: '$(zap)'
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'Reviews code for quality and best practices',
      status: 'idle',
      capabilities: ['code-review', 'best-practices', 'style-checking'],
      icon: '$(eye)'
    }
  ];

  constructor(
    private context: vscode.ExtensionContext,
    private apiClient: ApiClient
  ) {
    this.logger = new Logger('AgentsView');
  }

  /**
   * Refresh the tree
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: AgentItem): TreeItem {
    return element;
  }

  /**
   * Get children
   */
  getChildren(element?: AgentItem): Thenable<AgentItem[]> {
    if (!element) {
      // Root level - return all agents
      return Promise.resolve(this.agents.map(agent => new AgentItem(agent)));
    }

    // Agent level - return capabilities
    return Promise.resolve(
      agent.capabilities.map(cap => new CapabilityItem(cap))
    );
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: Agent['status']): void {
    const agent = this.agents.find(a => a.id === agentId);
    if (agent) {
      agent.status = status;
      this.refresh();
    }
  }
}

/**
 * Agent tree item
 */
class AgentItem extends TreeItem {
  constructor(private agent: Agent) {
    super(agent.name, TreeItemCollapsibleState.Collapsed);

    this.description = agent.description;
    this.tooltip = `${agent.name}\n${agent.description}\n\nStatus: ${agent.status}`;
    this.iconPath = new vscode.ThemeIcon(agent.icon, this.getStatusColor());
    this.contextValue = 'agent';
    this.command = {
      command: 'claudeflare.selectAgent',
      title: 'Select Agent',
      arguments: [agent.id]
    };
  }

  private getStatusColor(): vscode.ThemeColor {
    switch (this.agent.status) {
      case 'running':
        return new vscode.ThemeColor('terminal.ansiYellow');
      case 'busy':
        return new vscode.ThemeColor('terminal.ansiRed');
      default:
        return new vscode.ThemeColor('terminal.ansiGreen');
    }
  }
}

/**
 * Capability tree item
 */
class CapabilityItem extends TreeItem {
  constructor(capability: string) {
    super(capability, TreeItemCollapsibleState.None);
    this.contextValue = 'capability';
    this.iconPath = new vscode.ThemeIcon('check');
  }
}
