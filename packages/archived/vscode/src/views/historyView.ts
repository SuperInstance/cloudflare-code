/**
 * History view provider - displays chat and action history
 */

import * as vscode from 'vscode';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, Event, EventEmitter } from 'vscode';

import { TelemetryService } from '../services/telemetry';
import { ChatSession } from '../types';
import { Logger } from '../utils/logger';

interface HistoryItem {
  id: string;
  type: 'chat' | 'refactor' | 'generation' | 'review';
  timestamp: number;
  title: string;
  description: string;
  details?: any;
}

export class HistoryViewProvider implements TreeDataProvider<HistoryTreeItem> {
  private logger: Logger;
  private _onDidChangeTreeData = new EventEmitter<HistoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private history: HistoryItem[] = [];
  private groups: Map<string, HistoryItem[]> = new Map();

  constructor(
    private context: vscode.ExtensionContext,
    private telemetry: TelemetryService
  ) {
    this.logger = new Logger('HistoryView');
    this.loadHistory();
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
  getTreeItem(element: HistoryTreeItem): TreeItem {
    return element;
  }

  /**
   * Get children
   */
  getChildren(element?: HistoryTreeItem): Thenable<HistoryTreeItem[]> {
    if (!element) {
      // Root level - return date groups
      return Promise.resolve(this.getDateGroups());
    }

    if (element instanceof DateGroupItem) {
      // Return items for this date
      return Promise.resolve(
        this.getHistoryItemsForDate(element.date)
      );
    }

    return Promise.resolve([]);
  }

  /**
   * Get date groups
   */
  private getDateGroups(): HistoryTreeItem[] {
    const dates = new Set<string>();

    for (const item of this.history) {
      const date = new Date(item.timestamp).toDateString();
      dates.add(date);
    }

    return Array.from(dates)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => new DateGroupItem(date, this.getCountForDate(date)));
  }

  /**
   * Get history items for date
   */
  private getHistoryItemsForDate(date: string): HistoryTreeItem[] {
    const dateStart = new Date(date).getTime();
    const dateEnd = dateStart + 24 * 60 * 60 * 1000;

    return this.history
      .filter(item => item.timestamp >= dateStart && item.timestamp < dateEnd)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(item => new HistoryEntryItem(item));
  }

  /**
   * Get count for date
   */
  private getCountForDate(date: string): number {
    const dateStart = new Date(date).getTime();
    const dateEnd = dateStart + 24 * 60 * 60 * 1000;

    return this.history.filter(
      item => item.timestamp >= dateStart && item.timestamp < dateEnd
    ).length;
  }

  /**
   * Add history item
   */
  addItem(item: HistoryItem): void {
    this.history.push(item);
    this.saveHistory();
    this.refresh();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.refresh();
  }

  /**
   * Save history to storage
   */
  private saveHistory(): void {
    this.context.globalState.update('claudeflare.history', this.history);
  }

  /**
   * Load history from storage
   */
  private loadHistory(): void {
    const stored = this.context.globalState.get<HistoryItem[]>('claudeflare.history', []);
    this.history = stored;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.saveHistory();
  }
}

/**
 * Date group item
 */
class DateGroupItem extends TreeItem {
  constructor(public date: string, count: number) {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    let label = date;
    if (date === today) {
      label = 'Today';
    } else if (date === yesterday) {
      label = 'Yesterday';
    }

    super(`${label} (${count})`, TreeItemCollapsibleState.Collapsed);

    this.tooltip = date;
    this.iconPath = new vscode.ThemeIcon('calendar');
    this.contextValue = 'dateGroup';
  }
}

/**
 * History entry item
 */
class HistoryEntryItem extends TreeItem {
  constructor(private item: HistoryItem) {
    const time = new Date(item.timestamp).toLocaleTimeString();
    super(`${time} - ${item.title}`, TreeItemCollapsibleState.None);

    this.description = item.description;
    this.tooltip = `${item.title}\n${item.description}\n${new Date(item.timestamp).toLocaleString()}`;
    this.iconPath = new vscode.ThemeIcon(getHistoryIcon(item.type));
    this.contextValue = 'historyEntry';
    this.command = {
      command: 'claudeflare.openHistoryEntry',
      title: 'Open Entry',
      arguments: [item]
    };
  }

  get historyItem(): HistoryItem {
    return this.item;
  }
}

/**
 * Get icon for history type
 */
function getHistoryIcon(type: string): string {
  const icons: Record<string, string> = {
    chat: 'comment-discussion',
    refactor: 'sync',
    generation: 'sparkle',
    review: 'git-pull-request'
  };

  return icons[type] || 'circle-outline';
}
