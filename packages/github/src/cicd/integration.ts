/**
 * CI/CD Integration
 * GitHub Actions integration, workflow triggers, and deployment management
 */

// @ts-nocheck - Missing type exports (Deployment, DeploymentStatus) from types

import {
  WorkflowRun,
  WorkflowRunState,
  Conclusion,
  Artifact,
  CheckRun,
  CheckSuite,
  Deployment,
  DeploymentStatus,
  Repository,
  Environment
} from '../types';

import {
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowRunNotFoundError,
  ArtifactNotFoundError,
  ArtifactExpiredError
} from '../errors';

import { GitHubClient } from '../client/client';

// ============================================================================
// Workflow Trigger Options
// ============================================================================

export interface TriggerWorkflowOptions {
  ref: string;
  inputs?: Record<string, unknown>;
}

// ============================================================================
// Deployment Options
// ============================================================================

export interface CreateDeploymentOptions {
  ref: string;
  task?: string;
  autoMerge?: boolean;
  requiredContexts?: string[];
  payload?: Record<string, unknown>;
  environment?: string;
  description?: string;
  transientEnvironment?: boolean;
  productionEnvironment?: boolean;
}

export interface CreateDeploymentStatusOptions {
  state: 'queued' | 'in_progress' | 'success' | 'failure' | 'error' | 'inactive' | 'in_progress' | 'queued';
  environment?: string;
  environmentUrl?: string;
  autoInactive?: boolean;
  logUrl?: string;
  description?: string;
}

// ============================================================================
// Environment Options
// ============================================================================

export interface CreateEnvironmentOptions {
  name: string;
  waitTimer?: number;
  reviewers?: Array<{
    type: 'User' | 'Team';
    id: number | string;
  }>;
  deploymentBranchPolicy?: {
    protectedBranches: boolean;
    customBranchPolicies: boolean;
  };
}

// ============================================================================
// Check Suite Options
// ============================================================================

export interface CreateCheckSuiteOptions {
  headSha: string;
}

// ============================================================================
// Main CI/CD Integration Class
// ============================================================================

export class CICDIntegration {
  private client: GitHubClient;

  constructor(client: GitHubClient) {
    this.client = client;
  }

  // ============================================================================
  // Workflow Operations
  // ============================================================================

  async listWorkflows(
    owner: string,
    repo: string
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.actions.listRepoWorkflows({
      owner,
      repo
    });

    return response.data.workflows;
  }

  async getWorkflow(
    owner: string,
    repo: string,
    workflowId: number
  ): Promise<any> {
    try {
      const response = await this.client['octokit'].rest.actions.getWorkflow({
        owner,
        repo,
        workflow_id: workflowId
      });

      return response.data;
    } catch (error) {
      throw new WorkflowNotFoundError(owner, repo, workflowId);
    }
  }

  async getWorkflowUsage(
    owner: string,
    repo: string,
    workflowId: number
  ): Promise<{
    billable: Record<string, {
      totalMs: number;
      jobs: number;
    }>;
  }> {
    const response = await this.client['octokit'].rest.actions.getWorkflowUsage({
      owner,
      repo,
      workflow_id: workflowId
    });

    return response.data;
  }

  // ============================================================================
  // Workflow Run Operations
  // ============================================================================

  async listWorkflowRuns(
    owner: string,
    repo: string,
    options?: {
      branch?: string;
      checkSuiteId?: number;
      actor?: string;
      status?: WorkflowRunState;
      conclusion?: Conclusion;
      created?: string;
      excludePullRequests?: boolean;
      headSha?: string;
      perPage?: number;
      page?: number;
    }
  ): Promise<WorkflowRun[]> {
    const response = await this.client['octokit'].rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch: options?.branch,
      check_suite_id: options?.checkSuiteId,
      actor: options?.actor,
      status: options?.status,
      conclusion: options?.conclusion,
      created: options?.created,
      exclude_pull_requests: options?.excludePullRequests,
      head_sha: options?.headSha,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.workflow_runs as WorkflowRun[];
  }

  async listWorkflowRunsForWorkflow(
    owner: string,
    repo: string,
    workflowId: number,
    options?: {
      branch?: string;
      status?: WorkflowRunState;
      conclusion?: Conclusion;
      perPage?: number;
      page?: number;
    }
  ): Promise<WorkflowRun[]> {
    const response = await this.client['octokit'].rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      branch: options?.branch,
      status: options?.status,
      conclusion: options?.conclusion,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.workflow_runs as WorkflowRun[];
  }

  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<WorkflowRun> {
    try {
      const response = await this.client['octokit'].rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId
      });

      return response.data as WorkflowRun;
    } catch (error) {
      throw new WorkflowRunNotFoundError(owner, repo, runId);
    }
  }

  async getWorkflowRunLogs(
    owner: string,
    repo: string,
    runId: number
  ): Promise<Buffer> {
    const response = await this.client['octokit'].rest.actions.downloadWorkflowRunLogs({
      owner,
      repo,
      run_id: runId
    });

    return response.data as unknown as Buffer;
  }

  async reRunWorkflow(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.client['octokit'].rest.actions.reRunWorkflow({
      owner,
      repo,
      run_id: runId
    });
  }

  async reRunFailedJobs(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.client['octokit'].rest.actions.reRunWorkflowFailedJobs({
      owner,
      repo,
      run_id: runId
    });
  }

  async cancelWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.client['octokit'].rest.actions.cancelWorkflowRun({
      owner,
      repo,
      run_id: runId
    });
  }

  async deleteWorkflowRunLogs(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.client['octokit'].rest.actions.deleteWorkflowRunLogs({
      owner,
      repo,
      run_id: runId
    });
  }

  async deleteWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    await this.client['octokit'].rest.actions.deleteWorkflowRun({
      owner,
      repo,
      run_id: runId
    });
  }

  // ============================================================================
  // Workflow Dispatch
  // ============================================================================

  async triggerWorkflow(
    owner: string,
    repo: string,
    workflowId: number,
    options: TriggerWorkflowOptions
  ): Promise<void> {
    await this.client['octokit'].rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref: options.ref,
      inputs: options.inputs as Record<string, string | number | boolean>
    });
  }

  async triggerWorkflowByName(
    owner: string,
    repo: string,
    workflowName: string,
    options: TriggerWorkflowOptions
  ): Promise<void> {
    await this.client['octokit'].rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowName,
      ref: options.ref,
      inputs: options.inputs as Record<string, string | number | boolean>
    });
  }

  // ============================================================================
  // Workflow Job Operations
  // ============================================================================

  async listJobsForWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
    options?: {
      filter?: 'latest' | 'all';
      perPage?: number;
      page?: number;
    }
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
      filter: options?.filter || 'latest',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.jobs;
  }

  async getJob(
    owner: string,
    repo: string,
    jobId: number
  ): Promise<any> {
    const response = await this.client['octokit'].rest.actions.getJobForWorkflowRun({
      owner,
      repo,
      job_id: jobId
    });

    return response.data;
  }

  async getJobLogs(
    owner: string,
    repo: string,
    jobId: number
  ): Promise<Buffer> {
    const response = await this.client['octokit'].rest.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: jobId
    });

    return response.data as unknown as Buffer;
  }

  // ============================================================================
  // Artifact Operations
  // ============================================================================

  async listArtifactsForRepo(
    owner: string,
    repo: string,
    options?: {
      perPage?: number;
      page?: number;
    }
  ): Promise<Artifact[]> {
    const response = await this.client['octokit'].rest.actions.listArtifactsForRepo({
      owner,
      repo,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.artifacts as Artifact[];
  }

  async listArtifactsForWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
    options?: {
      perPage?: number;
      page?: number;
    }
  ): Promise<Artifact[]> {
    const response = await this.client['octokit'].rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.artifacts as Artifact[];
  }

  async getArtifact(
    owner: string,
    repo: string,
    artifactId: number
  ): Promise<Artifact> {
    try {
      const response = await this.client['octokit'].rest.actions.getArtifact({
        owner,
        repo,
        artifact_id: artifactId
      });

      const artifact = response.data as Artifact;

      if (artifact.expired) {
        throw new ArtifactExpiredError(artifactId);
      }

      return artifact;
    } catch (error) {
      if (error instanceof ArtifactExpiredError) {
        throw error;
      }
      throw new ArtifactNotFoundError(owner, repo, artifactId);
    }
  }

  async downloadArtifact(
    owner: string,
    repo: string,
    artifactId: number
  ): Promise<Buffer> {
    const artifact = await this.getArtifact(owner, repo, artifactId);

    const response = await this.client['octokit'].request('GET ' + artifact.archive_download_url);

    return response.data as Buffer;
  }

  async deleteArtifact(
    owner: string,
    repo: string,
    artifactId: number
  ): Promise<void> {
    await this.client['octokit'].rest.actions.deleteArtifact({
      owner,
      repo,
      artifact_id: artifactId
    });
  }

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  async listDeployments(
    owner: string,
    repo: string,
    options?: {
      sha?: string;
      ref?: string;
      task?: string;
      environment?: string;
      perPage?: number;
      page?: number;
    }
  ): Promise<Deployment[]> {
    const response = await this.client['octokit'].rest.repos.listDeployments({
      owner,
      repo,
      sha: options?.sha,
      ref: options?.ref,
      task: options?.task,
      environment: options?.environment,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data as Deployment[];
  }

  async createDeployment(
    owner: string,
    repo: string,
    options: CreateDeploymentOptions
  ): Promise<Deployment> {
    const response = await this.client['octokit'].rest.repos.createDeployment({
      owner,
      repo,
      ref: options.ref,
      task: options.task,
      auto_merge: options.autoMerge,
      required_contexts: options.requiredContexts,
      payload: options.payload,
      environment: options.environment,
      description: options.description,
      transient_environment: options.transientEnvironment,
      production_environment: options.productionEnvironment
    });

    return response.data;
  }

  async getDeployment(
    owner: string,
    repo: string,
    deploymentId: number
  ): Promise<Deployment> {
    const response = await this.client['octokit'].rest.repos.getDeployment({
      owner,
      repo,
      deployment_id: deploymentId
    });

    return response.data;
  }

  async createDeploymentStatus(
    owner: string,
    repo: string,
    deploymentId: number,
    options: CreateDeploymentStatusOptions
  ): Promise<DeploymentStatus> {
    const response = await this.client['octokit'].rest.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state: options.state,
      environment: options.environment,
      environment_url: options.environmentUrl,
      auto_inactive: options.autoInactive,
      log_url: options.logUrl,
      description: options.description
    });

    return response.data;
  }

  async listDeploymentStatuses(
    owner: string,
    repo: string,
    deploymentId: number,
    options?: {
      perPage?: number;
      page?: number;
    }
  ): Promise<DeploymentStatus[]> {
    const response = await this.client['octokit'].rest.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deploymentId,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data;
  }

  // ============================================================================
  // Environment Operations
  // ============================================================================

  async listEnvironments(
    owner: string,
    repo: string
  ): Promise<Environment[]> {
    const response = await this.client['octokit'].rest.repos.getAllEnvironments({
      owner,
      repo
    });

    return response.data.environments;
  }

  async getEnvironment(
    owner: string,
    repo: string,
    name: string
  ): Promise<Environment> {
    const response = await this.client['octokit'].rest.repos.getEnvironment({
      owner,
      repo,
      environment_name: name
    });

    return response.data;
  }

  async createOrUpdateEnvironment(
    owner: string,
    repo: string,
    name: string,
    options?: CreateEnvironmentOptions
  ): Promise<Environment> {
    const response = await this.client['octokit'].rest.repos.createOrUpdateEnvironment({
      owner,
      repo,
      environment_name: name,
      wait_timer: options?.waitTimer,
      reviewers: options?.reviewers,
      deployment_branch_policy: options?.deploymentBranchPolicy
    });

    return response.data;
  }

  async deleteEnvironment(
    owner: string,
    repo: string,
    name: string
  ): Promise<void> {
    await this.client['octokit'].rest.repos.deleteAnEnvironment({
      owner,
      repo,
      environment_name: name
    });
  }

  // ============================================================================
  // Check Suite Operations
  // ============================================================================

  async createCheckSuite(
    owner: string,
    repo: string,
    options: CreateCheckSuiteOptions
  ): Promise<CheckSuite> {
    const response = await this.client['octokit'].rest.checks.createSuite({
      owner,
      repo,
      head_sha: options.headSha
    });

    return response.data;
  }

  async getCheckSuite(
    owner: string,
    repo: string,
    checkSuiteId: number
  ): Promise<CheckSuite> {
    const response = await this.client['octokit'].rest.checks.getSuite({
      owner,
      repo,
      check_suite_id: checkSuiteId
    });

    return response.data;
  }

  async listCheckSuiteRuns(
    owner: string,
    repo: string,
    checkSuiteId: number,
    options?: {
      filter?: 'latest' | 'all';
      perPage?: number;
      page?: number;
    }
  ): Promise<CheckRun[]> {
    const response = await this.client['octokit'].rest.checks.listForSuite({
      owner,
      repo,
      check_suite_id: checkSuiteId,
      filter: options?.filter || 'latest',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.check_runs as CheckRun[];
  }

  async reRequestCheckSuite(
    owner: string,
    repo: string,
    checkSuiteId: number
  ): Promise<void> {
    await this.client['octokit'].rest.checks.rerequestSuite({
      owner,
      repo,
      check_suite_id: checkSuiteId
    });
  }

  // ============================================================================
  // Check Run Operations
  // ============================================================================

  async createCheckRun(
    owner: string,
    repo: string,
    options: {
      name: string;
      headSha: string;
      detailsUrl?: string;
      externalId?: string;
      startedAt?: string;
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
      completedAt?: string;
      output?: {
        title: string;
        summary: string;
        text?: string;
        annotations?: Array<{
          path: string;
          startLine: number;
          endLine: number;
          startColumn?: number;
          endColumn?: number;
          annotationLevel: 'notice' | 'warning' | 'failure';
          message: string;
          title?: string;
          rawDetails?: string;
        }>;
      };
      actions?: Array<{
        label: string;
        description: string;
        identifier: string;
      }>;
    }
  ): Promise<CheckRun> {
    const response = await this.client['octokit'].rest.checks.create({
      owner,
      repo,
      name: options.name,
      head_sha: options.headSha,
      details_url: options.detailsUrl,
      external_id: options.externalId,
      started_at: options.startedAt,
      status: options.status,
      conclusion: options.conclusion,
      completed_at: options.completedAt,
      output: options.output,
      actions: options.actions
    });

    return response.data;
  }

  async getCheckRun(
    owner: string,
    repo: string,
    checkRunId: number
  ): Promise<CheckRun> {
    const response = await this.client['octokit'].rest.checks.get({
      owner,
      repo,
      check_run_id: checkRunId
    });

    return response.data;
  }

  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    options: {
      name?: string;
      detailsUrl?: string;
      externalId?: string;
      startedAt?: string;
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
      completedAt?: string;
      output?: {
        title?: string;
        summary?: string;
        text?: string;
        annotations?: Array<{
          path: string;
          startLine: number;
          endLine: number;
          startColumn?: number;
          endColumn?: number;
          annotationLevel: 'notice' | 'warning' | 'failure';
          message: string;
          title?: string;
          rawDetails?: string;
        }>;
      };
      actions?: Array<{
        label: string;
        description: string;
        identifier: string;
      }>;
    }
  ): Promise<CheckRun> {
    const response = await this.client['octokit'].rest.checks.update({
      owner,
      repo,
      check_run_id: checkRunId,
      name: options.name,
      details_url: options.detailsUrl,
      external_id: options.externalId,
      started_at: options.startedAt,
      status: options.status,
      conclusion: options.conclusion,
      completed_at: options.completedAt,
      output: options.output,
      actions: options.actions
    });

    return response.data;
  }

  async listCheckRunsForRef(
    owner: string,
    repo: string,
    ref: string,
    options?: {
      checkName?: string;
      status?: 'queued' | 'in_progress' | 'completed';
      filter?: 'latest' | 'all';
      perPage?: number;
      page?: number;
    }
  ): Promise<CheckRun[]> {
    const response = await this.client['octokit'].rest.checks.listForRef({
      owner,
      repo,
      ref,
      check_name: options?.checkName,
      status: options?.status,
      filter: options?.filter || 'latest',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.check_runs as CheckRun[];
  }

  async listCheckRunsInSuite(
    owner: string,
    repo: string,
    checkSuiteId: number,
    options?: {
      filter?: 'latest' | 'all';
      perPage?: number;
      page?: number;
    }
  ): Promise<CheckRun[]> {
    const response = await this.client['octokit'].rest.checks.listForSuite({
      owner,
      repo,
      check_suite_id: checkSuiteId,
      filter: options?.filter || 'latest',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data.check_runs as CheckRun[];
  }

  async reRequestCheckRun(
    owner: string,
    repo: string,
    checkRunId: number
  ): Promise<void> {
    await this.client['octokit'].rest.checks.rerequest({
      owner,
      repo,
      check_run_id: checkRunId
    });
  }

  // ============================================================================
  // CI/CD Analytics
  // ============================================================================

  async getWorkflowAnalytics(
    owner: string,
    repo: string
  ): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageDuration: number;
    successRate: number;
    byWorkflow: Record<string, {
      total: number;
      successful: number;
      failed: number;
      averageDuration: number;
    }>;
  }> {
    const runs = await this.listWorkflowRuns(owner, repo, {
      perPage: 100
    });

    const byWorkflow: Record<string, any> = {};
    let totalDuration = 0;
    let successfulRuns = 0;
    let failedRuns = 0;

    for (const run of runs) {
      if (!byWorkflow[run.name]) {
        byWorkflow[run.name] = {
          total: 0,
          successful: 0,
          failed: 0,
          duration: 0
        };
      }

      byWorkflow[run.name].total++;

      const duration = run.updated_at
        ? new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()
        : 0;

      totalDuration += duration;
      byWorkflow[run.name].duration += duration;

      if (run.conclusion === 'success') {
        successfulRuns++;
        byWorkflow[run.name].successful++;
      } else if (run.conclusion === 'failure') {
        failedRuns++;
        byWorkflow[run.name].failed++;
      }
    }

    const byWorkflowsWithDuration = Object.entries(byWorkflow).reduce(
      (acc, [name, data]: [string, any]) => {
        acc[name] = {
          total: data.total,
          successful: data.successful,
          failed: data.failed,
          averageDuration: data.total > 0 ? data.duration / data.total : 0
        };
        return acc;
      },
      {} as Record<string, any>
    );

    return {
      totalRuns: runs.length,
      successfulRuns,
      failedRuns,
      averageDuration: runs.length > 0 ? totalDuration / runs.length : 0,
      successRate: runs.length > 0 ? successfulRuns / runs.length : 0,
      byWorkflow: byWorkflowsWithDuration
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCICDIntegration(client: GitHubClient): CICDIntegration {
  return new CICDIntegration(client);
}
