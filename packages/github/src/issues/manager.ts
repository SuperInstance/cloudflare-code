/**
 * Issue Management
 * Comprehensive issue creation, updates, linking, assignment, and analytics
 */

import {
  Issue,
  IssueState,
  Label,
  Milestone,
  User,
  IssueComment,
  Repository
} from '../types';

import {
  IssueError,
  IssueNotFoundError,
  IssueLockedError,
  CommentNotFoundError
} from '../errors';

import { GitHubClient } from '../client/client';

// ============================================================================
// Issue Creation Options
// ============================================================================

export interface CreateIssueOptions {
  title: string;
  body?: string;
  assignees?: string[];
  labels?: string[];
  milestone?: number;
}

// ============================================================================
// Issue Update Options
// ============================================================================

export interface UpdateIssueOptions {
  title?: string;
  body?: string;
  state?: IssueState;
  assignees?: string[];
  milestone?: number | null;
  labels?: string[];
}

// ============================================================================
// Issue Search Options
// ============================================================================

export interface SearchIssuesOptions {
  query: string;
  sort?: 'comments' | 'created' | 'updated';
  order?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

// ============================================================================
// Issue Link Options
// ============================================================================

export interface LinkIssuesOptions {
  type: 'relates_to' | 'blocks' | 'blocked_by' | 'causes' | 'caused_by' | 'is_duplicate_of' | 'duplicate_of';
}

// ============================================================================
// Issue Analytics
// ============================================================================

export interface IssueAnalytics {
  total: number;
  open: number;
  closed: number;
  byLabel: Record<string, number>;
  byAssignee: Record<string, number>;
  byMilestone: Record<string, number>;
  averageCloseTime: number;
  averageResponseTime: number;
}

export interface IssueTimeline {
  opened: Date;
  firstResponse?: Date;
  closed?: Date;
  labels: Array<{ label: string; added: Date }>;
  assignees: Array<{ assignee: string; added: Date }>;
  milestones: Array<{ milestone: string; added: Date }>;
}

// ============================================================================
// Main Issue Manager Class
// ============================================================================

export class IssueManager {
  private client: GitHubClient;

  constructor(client: GitHubClient) {
    this.client = client;
  }

  // ============================================================================
  // Issue Creation
  // ============================================================================

  async createIssue(
    owner: string,
    repo: string,
    options: CreateIssueOptions
  ): Promise<Issue> {
    const response = await this.client['octokit'].rest.issues.create({
      owner,
      repo,
      title: options.title,
      body: options.body,
      assignees: options.assignees,
      labels: options.labels,
      milestone: options.milestone
    });

    return response.data as Issue;
  }

  async createIssueFromTemplate(
    owner: string,
    repo: string,
    template: {
      title: string;
      body: string;
      labels?: string[];
    },
    variables?: Record<string, string>
  ): Promise<Issue> {
    let body = template.body;

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    return this.createIssue(owner, repo, {
      title: template.title,
      body,
      labels: template.labels
    });
  }

  async createBatchIssues(
    owner: string,
    repo: string,
    issues: CreateIssueOptions[]
  ): Promise<Issue[]> {
    const results = await Promise.allSettled(
      issues.map(options => this.createIssue(owner, repo, options))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<Issue> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // ============================================================================
  // Issue Updates
  // ============================================================================

  async updateIssue(
    owner: string,
    repo: string,
    number: number,
    options: UpdateIssueOptions
  ): Promise<Issue> {
    const response = await this.client['octokit'].rest.issues.update({
      owner,
      repo,
      issue_number: number,
      title: options.title,
      body: options.body,
      state: options.state,
      assignees: options.assignees,
      milestone: options.milestone,
      labels: options.labels
    });

    return response.data as Issue;
  }

  async closeIssue(owner: string, repo: string, number: number): Promise<Issue> {
    return this.updateIssue(owner, repo, number, {
      state: IssueState.Closed
    });
  }

  async reopenIssue(owner: string, repo: string, number: number): Promise<Issue> {
    return this.updateIssue(owner, repo, number, {
      state: IssueState.Open
    });
  }

  async lockIssue(
    owner: string,
    repo: string,
    number: number,
    lockReason?: 'off-topic' | 'too heated' | 'resolved' | 'spam'
  ): Promise<void> {
    await this.client['octokit'].rest.issues.lock({
      owner,
      repo,
      issue_number: number,
      lock_reason: lockReason
    });
  }

  async unlockIssue(owner: string, repo: string, number: number): Promise<void> {
    await this.client['octokit'].rest.issues.unlock({
      owner,
      repo,
      issue_number: number
    });
  }

  // ============================================================================
  // Issue Retrieval
  // ============================================================================

  async getIssue(owner: string, repo: string, number: number): Promise<Issue> {
    return this.client.getIssue(owner, repo, number);
  }

  async listIssues(
    owner: string,
    repo: string,
    options?: {
      state?: IssueState;
      milestone?: string | number;
      assignee?: string;
      creator?: string;
      mentioned?: string;
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      since?: string;
      perPage?: number;
      page?: number;
    }
  ): Promise<Issue[]> {
    return this.client.listIssues(owner, repo, options);
  }

  async searchIssues(
    query: string,
    options?: SearchIssuesOptions
  ): Promise<Issue[]> {
    const response = await this.client['octokit'].rest.search.issuesAndPullRequests({
      q: query,
      sort: options?.sort || 'created',
      order: options?.order || 'desc',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.items.filter(i => !('pull_request' in i)) as Issue[];
  }

  // ============================================================================
  // Issue Comments
  // ============================================================================

  async createComment(
    owner: string,
    repo: string,
    number: number,
    body: string
  ): Promise<IssueComment> {
    const response = await this.client['octokit'].rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body
    });

    return response.data as IssueComment;
  }

  async updateComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<IssueComment> {
    const response = await this.client['octokit'].rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body
    });

    return response.data as IssueComment;
  }

  async deleteComment(owner: string, repo: string, commentId: number): Promise<void> {
    await this.client['octokit'].rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId
    });
  }

  async listComments(
    owner: string,
    repo: string,
    number: number
  ): Promise<IssueComment[]> {
    const response = await this.client['octokit'].rest.issues.listComments({
      owner,
      repo,
      issue_number: number
    });

    return response.data as IssueComment[];
  }

  async getComment(
    owner: string,
    repo: string,
    commentId: number
  ): Promise<IssueComment> {
    const response = await this.client['octokit'].rest.issues.getComment({
      owner,
      repo,
      comment_id: commentId
    });

    return response.data as IssueComment;
  }

  // ============================================================================
  // Issue Labels
  // ============================================================================

  async addLabels(
    owner: string,
    repo: string,
    number: number,
    labels: string[]
  ): Promise<Label[]> {
    const response = await this.client['octokit'].rest.issues.addLabels({
      owner,
      repo,
      issue_number: number,
      labels
    });

    return response.data;
  }

  async setLabels(
    owner: string,
    repo: string,
    number: number,
    labels: string[]
  ): Promise<Label[]> {
    const existing = await this.listLabels(owner, repo, number);
    const existingNames = existing.map(l => l.name);

    const toRemove = existingNames.filter(n => !labels.includes(n));
    const toAdd = labels.filter(l => !existingNames.includes(l));

    if (toRemove.length > 0) {
      await this.removeLabels(owner, repo, number, toRemove);
    }

    if (toAdd.length > 0) {
      await this.addLabels(owner, repo, number, toAdd);
    }

    return this.listLabels(owner, repo, number);
  }

  async removeLabel(
    owner: string,
    repo: string,
    number: number,
    name: string
  ): Promise<void> {
    await this.client['octokit'].rest.issues.removeLabel({
      owner,
      repo,
      issue_number: number,
      name
    });
  }

  async removeLabels(
    owner: string,
    repo: string,
    number: number,
    names: string[]
  ): Promise<void> {
    await Promise.all(
      names.map(name => this.removeLabel(owner, repo, number, name))
    );
  }

  async listLabels(
    owner: string,
    repo: string,
    number: number
  ): Promise<Label[]> {
    const issue = await this.getIssue(owner, repo, number);
    return issue.labels;
  }

  async createLabel(
    owner: string,
    repo: string,
    name: string,
    color: string,
    description?: string
  ): Promise<Label> {
    const response = await this.client['octokit'].rest.issues.createLabel({
      owner,
      repo,
      name,
      color,
      description
    });

    return response.data;
  }

  async updateLabel(
    owner: string,
    repo: string,
    name: string,
    options: {
      newName?: string;
      color?: string;
      description?: string;
    }
  ): Promise<Label> {
    const response = await this.client['octokit'].rest.issues.updateLabel({
      owner,
      repo,
      name,
      new_name: options.newName,
      color: options.color,
      description: options.description
    });

    return response.data;
  }

  async deleteLabel(owner: string, repo: string, name: string): Promise<void> {
    await this.client['octokit'].rest.issues.deleteLabel({
      owner,
      repo,
      name
    });
  }

  async listAllLabels(owner: string, repo: string): Promise<Label[]> {
    const response = await this.client['octokit'].rest.issues.listLabelsForRepo({
      owner,
      repo
    });

    return response.data;
  }

  // ============================================================================
  // Issue Assignees
  // ============================================================================

  async addAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    const issue = await this.getIssue(owner, repo, number);
    const existing = issue.assignees.map(a => a.login);
    const all = [...new Set([...existing, ...assignees])];

    await this.client['octokit'].rest.issues.addAssignees({
      owner,
      repo,
      issue_number: number,
      assignees: all
    });
  }

  async setAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    await this.client['octokit'].rest.issues.addAssignees({
      owner,
      repo,
      issue_number: number,
      assignees
    });
  }

  async removeAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    const issue = await this.getIssue(owner, repo, number);
    const existing = issue.assignees.map(a => a.login);
    const remaining = existing.filter(a => !assignees.includes(a));

    await this.setAssignees(owner, repo, number, remaining);
  }

  // ============================================================================
  // Issue Milestones
  // ============================================================================

  async setMilestone(
    owner: string,
    repo: string,
    number: number,
    milestone: number
  ): Promise<Issue> {
    return this.updateIssue(owner, repo, number, { milestone });
  }

  async removeMilestone(
    owner: string,
    repo: string,
    number: number
  ): Promise<Issue> {
    return this.updateIssue(owner, repo, number, { milestone: null });
  }

  async createMilestone(
    owner: string,
    repo: string,
    title: string,
    options?: {
      state?: 'open' | 'closed';
      description?: string;
      dueOn?: string;
    }
  ): Promise<Milestone> {
    const response = await this.client['octokit'].rest.issues.createMilestone({
      owner,
      repo,
      title,
      state: options?.state || 'open',
      description: options?.description,
      due_on: options?.dueOn
    });

    return response.data;
  }

  async updateMilestone(
    owner: string,
    repo: string,
    number: number,
    options: {
      title?: string;
      state?: 'open' | 'closed';
      description?: string;
      dueOn?: string;
    }
  ): Promise<Milestone> {
    const response = await this.client['octokit'].rest.issues.updateMilestone({
      owner,
      repo,
      milestone_number: number,
      title: options.title,
      state: options.state,
      description: options.description,
      due_on: options.dueOn
    });

    return response.data;
  }

  async deleteMilestone(
    owner: string,
    repo: string,
    number: number
  ): Promise<void> {
    await this.client['octokit'].rest.issues.deleteMilestone({
      owner,
      repo,
      milestone_number: number
    });
  }

  async listMilestones(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'due_on' | 'completeness';
      direction?: 'asc' | 'desc';
      perPage?: number;
      page?: number;
    }
  ): Promise<Milestone[]> {
    const response = await this.client['octokit'].rest.issues.listMilestones({
      owner,
      repo,
      state: options?.state || 'open',
      sort: options?.sort || 'due_on',
      direction: options?.direction || 'asc',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data;
  }

  async getMilestoneIssues(
    owner: string,
    repo: string,
    milestone: number
  ): Promise<Issue[]> {
    return this.listIssues(owner, repo, {
      milestone,
      state: IssueState.All
    });
  }

  // ============================================================================
  // Issue Linking
  // ============================================================================

  async linkIssues(
    owner: string,
    repo: string,
    sourceIssue: number,
    targetIssue: number,
    options: LinkIssuesOptions
  ): Promise<void> {
    const commentBody = this.createLinkComment(targetIssue, options.type);

    await this.createComment(owner, repo, sourceIssue, commentBody);
  }

  private createLinkComment(targetIssue: number, type: string): string {
    const phrases: Record<string, string> = {
      relates_to: 'Relates to',
      blocks: 'Blocks',
      blocked_by: 'Blocked by',
      causes: 'Causes',
      caused_by: 'Caused by',
      is_duplicate_of: 'Is duplicate of',
      duplicate_of: 'Duplicate of'
    };

    return `${phrases[type] || type} #${targetIssue}`;
  }

  // ============================================================================
  // Issue Analytics
  // ============================================================================

  async getAnalytics(owner: string, repo: string): Promise<IssueAnalytics> {
    const allIssues = await this.listIssues(owner, repo, {
      state: IssueState.All,
      perPage: 100
    });

    const open = allIssues.filter(i => i.state === IssueState.Open);
    const closed = allIssues.filter(i => i.state === IssueState.Closed);

    const byLabel: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};
    const byMilestone: Record<string, number> = {};

    for (const issue of allIssues) {
      for (const label of issue.labels) {
        byLabel[label.name] = (byLabel[label.name] || 0) + 1;
      }

      for (const assignee of issue.assignees) {
        byAssignee[assignee.login] = (byAssignee[assignee.login] || 0) + 1;
      }

      if (issue.milestone) {
        byMilestone[issue.milestone.title] = (byMilestone[issue.milestone.title] || 0) + 1;
      }
    }

    const closedIssues = allIssues.filter(i => i.closed_at);
    const averageCloseTime = closedIssues.length > 0
      ? closedIssues.reduce((sum, i) => {
          const created = new Date(i.created_at).getTime();
          const closed = new Date(i.closed_at!).getTime();
          return sum + (closed - created);
        }, 0) / closedIssues.length
      : 0;

    const averageResponseTime = await this.calculateAverageResponseTime(owner, repo, allIssues);

    return {
      total: allIssues.length,
      open: open.length,
      closed: closed.length,
      byLabel,
      byAssignee,
      byMilestone,
      averageCloseTime,
      averageResponseTime
    };
  }

  private async calculateAverageResponseTime(
    owner: string,
    repo: string,
    issues: Issue[]
  ): Promise<number> {
    let totalTime = 0;
    let count = 0;

    for (const issue of issues) {
      const comments = await this.listComments(owner, repo, issue.number);
      if (comments.length > 0) {
        const created = new Date(issue.created_at).getTime();
        const firstComment = new Date(comments[0].created_at).getTime();
        totalTime += firstComment - created;
        count++;
      }
    }

    return count > 0 ? totalTime / count : 0;
  }

  async getTimeline(
    owner: string,
    repo: string,
    number: number
  ): Promise<IssueTimeline> {
    const issue = await this.getIssue(owner, repo, number);
    const comments = await this.listComments(owner, repo, number);

    const timeline: IssueTimeline = {
      opened: new Date(issue.created_at)
    };

    if (comments.length > 0) {
      timeline.firstResponse = new Date(comments[0].created_at);
    }

    if (issue.closed_at) {
      timeline.closed = new Date(issue.closed_at);
    }

    const events = await this.client['octokit'].rest.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: number
    });

    timeline.labels = events.data
      .filter(e => e.event === 'labeled')
      .map(e => ({
        label: (e as any).label.name,
        added: new Date(e.created_at)
      }));

    timeline.assignees = events.data
      .filter(e => e.event === 'assigned')
      .map(e => ({
        assignee: (e as any).assignee.login,
        added: new Date(e.created_at)
      }));

    timeline.milestones = events.data
      .filter(e => e.event === 'milestoned')
      .map(e => ({
        milestone: (e as any).milestone.title,
        added: new Date(e.created_at)
      }));

    return timeline;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async bulkUpdate(
    owner: string,
    repo: string,
    numbers: number[],
    options: UpdateIssueOptions
  ): Promise<Issue[]> {
    const results = await Promise.allSettled(
      numbers.map(number => this.updateIssue(owner, repo, number, options))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<Issue> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async bulkClose(
    owner: string,
    repo: string,
    numbers: number[]
  ): Promise<Issue[]> {
    return this.bulkUpdate(owner, repo, numbers, {
      state: IssueState.Closed
    });
  }

  async bulkAddLabels(
    owner: string,
    repo: string,
    numbers: number[],
    labels: string[]
  ): Promise<void> {
    await Promise.all(
      numbers.map(number => this.addLabels(owner, repo, number, labels))
    );
  }

  async bulkSetLabels(
    owner: string,
    repo: string,
    numbers: number[],
    labels: string[]
  ): Promise<void> {
    await Promise.all(
      numbers.map(number => this.setLabels(owner, repo, number, labels))
    );
  }

  async bulkSetAssignees(
    owner: string,
    repo: string,
    numbers: number[],
    assignees: string[]
  ): Promise<void> {
    await Promise.all(
      numbers.map(number => this.setAssignees(owner, repo, number, assignees))
    );
  }

  async bulkSetMilestone(
    owner: string,
    repo: string,
    numbers: number[],
    milestone: number
  ): Promise<Issue[]> {
    const results = await Promise.allSettled(
      numbers.map(number => this.setMilestone(owner, repo, number, milestone))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<Issue> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createIssueManager(client: GitHubClient): IssueManager {
  return new IssueManager(client);
}
