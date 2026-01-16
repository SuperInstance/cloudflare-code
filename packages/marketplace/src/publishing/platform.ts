// @ts-nocheck
/**
 * Agent Publishing Platform
 * Handles agent publishing, versioning, and lifecycle management
 */

import {
  Agent,
  AgentStatus,
  PublishState,
  PublishManifest,
  PublishResult,
  PublishState as PS,
  ValidationIssue
} from '../types';

// ============================================================================
// Publishing Configuration
// ============================================================================

export interface PublishingOptions {
  validateOnly?: boolean;
  skipTests?: boolean;
  createTag?: boolean;
  notifyFollowers?: boolean;
  releaseNotes?: string;
  deprecationInfo?: {
    deprecatedInVersion: string;
    removedInVersion: string;
    migrationGuide: string;
  };
}

export interface VersionInfo {
  version: string;
  changelog: string;
  breaking: boolean;
  dependencies: Record<string, string>;
  compatibility: {
    platform: string[];
    apiVersion: string[];
  };
}

export interface ReleaseWorkflow {
  stages: Array<{
    name: string;
    validate: () => Promise<boolean>;
    execute: () => Promise<void>;
    rollback?: () => Promise<void>;
  }>;
}

// ============================================================================
// Publishing Manager
// ============================================================================

export class PublishingManager {
  private publishedAgents: Map<string, Agent> = new Map();
  private agentVersions: Map<string, string[]> = new Map();
  private publishQueue: Map<string, PublishState> = new Map();

  // ========================================================================
  // Publishing Workflow
  // ========================================================================

  async publish(
    agent: Agent,
    options: PublishingOptions = {}
  ): Promise<PublishResult> {
    const publishId = `${agent.metadata.id}-${Date.now()}`;
    const manifest = this.createManifest(agent, options);

    this.publishQueue.set(publishId, PS.VALIDATING);

    try {
      // Stage 1: Validation
      this.updatePublishState(publishId, PS.VALIDATING);
      const validation = await this.validateForPublish(agent);
      if (!validation.valid) {
        return this.createFailureResult(agent, validation.issues, publishId);
      }

      if (options.validateOnly) {
        return this.createSuccessResult(agent, manifest, publishId, true);
      }

      // Stage 2: Testing
      this.updatePublishState(publishId, PS.TESTING);
      if (!options.skipTests) {
        const testResult = await this.runTests(agent);
        if (!testResult.passed) {
          return this.createFailureResult(
            agent,
            [{ severity: 'error', code: 'TESTS_FAILED', message: 'Tests failed' }],
            publishId
          );
        }
      }

      // Stage 3: Review
      this.updatePublishState(publishId, PS.REVIEWING);
      const reviewResult = await this.review(agent);
      if (!reviewResult.approved) {
        return this.createFailureResult(
          agent,
          [{ severity: 'error', code: 'REVIEW_FAILED', message: reviewResult.reason }],
          publishId
        );
      }

      // Stage 4: Publishing
      this.updatePublishState(publishId, PS.PUBLISHING);
      await this.executePublish(agent, manifest, options);

      // Stage 5: Post-publish
      this.updatePublishState(publishId, PS.PUBLISHED);
      await this.postPublish(agent, options);

      return this.createSuccessResult(agent, manifest, publishId);

    } catch (error) {
      return this.createFailureResult(
        agent,
        [{
          severity: 'error',
          code: 'PUBLISH_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }],
        publishId
      );
    } finally {
      this.publishQueue.delete(publishId);
    }
  }

  private createManifest(agent: Agent, options: PublishingOptions): PublishManifest {
    return {
      agentId: agent.metadata.id,
      version: agent.metadata.version,
      changelog: options.releaseNotes || '',
      releaseNotes: options.releaseNotes || '',
      dependencies: {},
      compatibility: {
        platform: ['cloudflare'],
        apiVersion: ['1.0.0']
      },
      deprecationInfo: options.deprecationInfo
    };
  }

  private updatePublishState(publishId: string, state: PublishState): void {
    this.publishQueue.set(publishId, state);
  }

  private async validateForPublish(agent: Agent): Promise<{
    valid: boolean;
    issues: ValidationIssue[];
  }> {
    const issues: ValidationIssue[] = [];

    // Check required fields
    if (!agent.config.name) {
      issues.push({ severity: 'error', code: 'MISSING_NAME', message: 'Agent name is required' });
    }

    if (!agent.config.description) {
      issues.push({ severity: 'error', code: 'MISSING_DESC', message: 'Agent description is required' });
    }

    if (!agent.code) {
      issues.push({ severity: 'error', code: 'MISSING_CODE', message: 'Agent code is required' });
    }

    // Check version format
    if (!/^\d+\.\d+\.\d+$/.test(agent.metadata.version)) {
      issues.push({ severity: 'error', code: 'INVALID_VERSION', message: 'Version must be in semver format (x.y.z)' });
    }

    // Check for required capabilities
    if (!agent.config.capabilities || agent.config.capabilities.length === 0) {
      issues.push({ severity: 'warning', code: 'NO_CAPABILITIES', message: 'Agent has no capabilities defined' });
    }

    // Check for security issues
    const securityIssues = await this.checkSecurity(agent);
    issues.push(...securityIssues);

    // Check for best practices
    const practiceIssues = await this.checkBestPractices(agent);
    issues.push(...practiceIssues);

    return {
      valid: !issues.some(i => i.severity === 'error'),
      issues
    };
  }

  private async checkSecurity(agent: Agent): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for dangerous permissions
    if (agent.config.permissions.includes('execute') || agent.config.permissions.includes('network')) {
      if (!agent.config.constraints?.timeout) {
        issues.push({
          severity: 'warning',
          code: 'NO_TIMEOUT',
          message: 'Agent with dangerous permissions should have a timeout constraint'
        });
      }
    }

    // Check for exposed secrets
    const secretPatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(agent.code)) {
        issues.push({
          severity: 'error',
          code: 'EXPOSED_SECRET',
          message: 'Potential secret found in code',
          suggestion: 'Use environment variables for sensitive data'
        });
      }
    }

    return issues;
  }

  private async checkBestPractices(agent: Agent): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for error handling
    if (!agent.code.includes('try') && !agent.code.includes('catch')) {
      issues.push({
        severity: 'warning',
        code: 'NO_ERROR_HANDLING',
        message: 'Agent should include error handling'
      });
    }

    // Check for documentation
    if (!agent.code.includes('/**') && !agent.code.includes('/*')) {
      issues.push({
        severity: 'info',
        code: 'NO_DOCS',
        message: 'Consider adding documentation comments'
      });
    }

    return issues;
  }

  private async runTests(agent: Agent): Promise<{ passed: boolean; results: any[] }> {
    // In a real implementation, this would run the agent's test suite
    // For now, we'll return a mock result
    return {
      passed: true,
      results: []
    };
  }

  private async review(agent: Agent): Promise<{ approved: boolean; reason?: string }> {
    // In a real implementation, this would trigger a review process
    // For now, we'll auto-approve agents with good metadata
    const hasGoodDescription = agent.config.description.length > 50;
    const hasGoodCode = agent.code.length > 100;

    if (hasGoodDescription && hasGoodCode) {
      return { approved: true };
    }

    return {
      approved: false,
      reason: 'Agent needs more detailed description and implementation'
    };
  }

  private async executePublish(
    agent: Agent,
    manifest: PublishManifest,
    options: PublishingOptions
  ): Promise<void> {
    // Store the published agent
    const publishedAgent: Agent = {
      ...agent,
      metadata: {
        ...agent.metadata,
        status: AgentStatus.PUBLISHED,
        publishedAt: new Date()
      }
    };

    this.publishedAgents.set(agent.metadata.id, publishedAgent);

    // Track versions
    if (!this.agentVersions.has(agent.metadata.id)) {
      this.agentVersions.set(agent.metadata.id, []);
    }
    this.agentVersions.get(agent.metadata.id)!.push(agent.metadata.version);
  }

  private async postPublish(agent: Agent, options: PublishingOptions): Promise<void> {
    // Post-publish tasks
    if (options.notifyFollowers) {
      await this.notifyFollowers(agent);
    }

    if (options.createTag) {
      await this.createReleaseTag(agent);
    }
  }

  private async notifyFollowers(agent: Agent): Promise<void> {
    // Notification logic
  }

  private async createReleaseTag(agent: Agent): Promise<void> {
    // Tag creation logic
  }

  private createSuccessResult(
    agent: Agent,
    manifest: PublishManifest,
    publishId: string,
    validateOnly: boolean = false
  ): PublishResult {
    return {
      success: true,
      agent,
      state: PS.PUBLISHED,
      url: `/agents/${agent.metadata.id}`,
      version: agent.metadata.version,
      publishedAt: new Date(),
      errors: [],
      warnings: validateOnly ? ['Validation only - agent not published'] : []
    };
  }

  private createFailureResult(
    agent: Agent,
    issues: ValidationIssue[],
    publishId: string
  ): PublishResult {
    return {
      success: false,
      agent,
      state: PS.FAILED,
      errors: issues
        .filter(i => i.severity === 'error')
        .map(i => i.message),
      warnings: issues
        .filter(i => i.severity !== 'error')
        .map(i => i.message)
    };
  }

  // ========================================================================
  // Version Management
  // ========================================================================

  async createVersion(
    agentId: string,
    versionInfo: VersionInfo
  ): Promise<Agent> {
    const existingAgent = this.publishedAgents.get(agentId);
    if (!existingAgent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Validate version is greater than current
    const versions = this.agentVersions.get(agentId) || [];
    const currentVersion = versions[versions.length - 1];
    if (!this.isNewerVersion(versionInfo.version, currentVersion)) {
      throw new Error(`Version ${versionInfo.version} must be greater than ${currentVersion}`);
    }

    // Create new version
    const newAgent: Agent = {
      ...existingAgent,
      metadata: {
        ...existingAgent.metadata,
        version: versionInfo.version,
        updatedAt: new Date()
      }
    };

    return newAgent;
  }

  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);
    const [curMajor, curMinor, curPatch] = currentVersion.split('.').map(Number);

    if (newMajor > curMajor) return true;
    if (newMajor < curMajor) return false;

    if (newMinor > curMinor) return true;
    if (newMinor < curMinor) return false;

    return newPatch > curPatch;
  }

  async deprecateVersion(
    agentId: string,
    version: string,
    removalVersion: string,
    migrationGuide: string
  ): Promise<void> {
    const agent = this.publishedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Mark version as deprecated
    // In a real implementation, this would update the agent metadata
  }

  async rollbackVersion(agentId: string, targetVersion: string): Promise<Agent> {
    const agent = this.publishedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const versions = this.agentVersions.get(agentId) || [];
    if (!versions.includes(targetVersion)) {
      throw new Error(`Version ${targetVersion} not found for agent ${agentId}`);
    }

    // Create rollback version
    const rollbackAgent: Agent = {
      ...agent,
      metadata: {
        ...agent.metadata,
        version: targetVersion,
        updatedAt: new Date()
      }
    };

    return rollbackAgent;
  }

  // ========================================================================
  // Publishing Status
  // ========================================================================

  getPublishStatus(publishId: string): PublishState | undefined {
    return this.publishQueue.get(publishId);
  }

  listPublishedAgents(): Agent[] {
    return Array.from(this.publishedAgents.values());
  }

  getAgentVersions(agentId: string): string[] {
    return this.agentVersions.get(agentId) || [];
  }

  // ========================================================================
  // Release Workflows
  // ========================================================================

  async createReleaseWorkflow(agent: Agent): Promise<ReleaseWorkflow> {
    return {
      stages: [
        {
          name: 'validate',
          validate: async () => {
            const result = await this.validateForPublish(agent);
            return result.valid;
          },
          execute: async () => {
            // Validation stage
          }
        },
        {
          name: 'test',
          validate: async () => true,
          execute: async () => {
            // Testing stage
          }
        },
        {
          name: 'review',
          validate: async () => true,
          execute: async () => {
            // Review stage
          }
        },
        {
          name: 'publish',
          validate: async () => true,
          execute: async () => {
            // Publishing stage
          },
          rollback: async () => {
            // Rollback logic
          }
        }
      ]
    };
  }

  async executeWorkflow(workflow: ReleaseWorkflow): Promise<{
    success: boolean;
    stage: string;
    error?: string;
  }> {
    for (const stage of workflow.stages) {
      try {
        const valid = await stage.validate();
        if (!valid) {
          return {
            success: false,
            stage: stage.name,
            error: 'Stage validation failed'
          };
        }

        await stage.execute();
      } catch (error) {
        // Attempt rollback
        if (stage.rollback) {
          try {
            await stage.rollback();
          } catch (rollbackError) {
            // Log rollback error
          }
        }

        return {
          success: false,
          stage: stage.name,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return { success: true, stage: 'complete' };
  }
}

// ============================================================================
// Release Manager
// ============================================================================

export class ReleaseManager {
  private releases: Map<string, Array<{
    version: string;
    date: Date;
    notes: string;
    agent: Agent;
  }>> = new Map();

  async createRelease(
    agent: Agent,
    versionInfo: VersionInfo
  ): Promise<{
    release: {
      version: string;
      date: Date;
      notes: string;
      agent: Agent;
    };
    url: string;
  }> {
    const release = {
      version: versionInfo.version,
      date: new Date(),
      notes: versionInfo.changelog,
      agent
    };

    if (!this.releases.has(agent.metadata.id)) {
      this.releases.set(agent.metadata.id, []);
    }

    this.releases.get(agent.metadata.id)!.push(release);

    return {
      release,
      url: `/agents/${agent.metadata.id}/releases/${versionInfo.version}`
    };
  }

  listReleases(agentId: string): Array<{
    version: string;
    date: Date;
    notes: string;
    agent: Agent;
  }> {
    return this.releases.get(agentId) || [];
  }

  getLatestRelease(agentId: string): {
    version: string;
    date: Date;
    notes: string;
    agent: Agent;
  } | undefined {
    const releases = this.releases.get(agentId);
    if (!releases || releases.length === 0) {
      return undefined;
    }
    return releases[releases.length - 1];
  }
}

// ============================================================================
// Semantic Versioning Helper
// ============================================================================

export class SemVerHelper {
  static bumpMajor(version: string): string {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major + 1}.0.0`;
  }

  static bumpMinor(version: string): string {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor + 1}.0`;
  }

  static bumpPatch(version: string): string {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  static compare(v1: string, v2: string): number {
    const [major1, minor1, patch1] = v1.split('.').map(Number);
    const [major2, minor2, patch2] = v2.split('.').map(Number);

    if (major1 !== major2) return major1 - major2;
    if (minor1 !== minor2) return minor1 - minor2;
    return patch1 - patch2;
  }

  static isValid(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  static getSuggestedBump(
    currentVersion: string,
    changes: {
      breaking?: boolean;
      features?: boolean;
      fixes?: boolean;
    }
  ): string {
    if (changes.breaking) {
      return this.bumpMajor(currentVersion);
    }
    if (changes.features) {
      return this.bumpMinor(currentVersion);
    }
    if (changes.fixes) {
      return this.bumpPatch(currentVersion);
    }
    return currentVersion;
  }
}

// ============================================================================
// Changelog Generator
// ============================================================================

export class ChangelogGenerator {
  static generate(
    version: string,
    changes: {
      added?: string[];
      changed?: string[];
      deprecated?: string[];
      removed?: string[];
      fixed?: string[];
      security?: string[];
    }
  ): string {
    const lines: string[] = [
      `## ${version} - ${new Date().toISOString().split('T')[0]}`,
      ''
    ];

    if (changes.added && changes.added.length > 0) {
      lines.push('### Added');
      changes.added.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    if (changes.changed && changes.changed.length > 0) {
      lines.push('### Changed');
      changes.changed.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    if (changes.deprecated && changes.deprecated.length > 0) {
      lines.push('### Deprecated');
      changes.deprecated.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    if (changes.removed && changes.removed.length > 0) {
      lines.push('### Removed');
      changes.removed.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    if (changes.fixed && changes.fixed.length > 0) {
      lines.push('### Fixed');
      changes.fixed.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    if (changes.security && changes.security.length > 0) {
      lines.push('### Security');
      changes.security.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  static parseChanges(commits: Array<{
    message: string;
    type: string;
  }>): {
    added: string[];
    changed: string[];
    deprecated: string[];
    removed: string[];
    fixed: string[];
    security: string[];
  } {
    const changes = {
      added: [] as string[],
      changed: [] as string[],
      deprecated: [] as string[],
      removed: [] as string[],
      fixed: [] as string[],
      security: [] as string[]
    };

    for (const commit of commits) {
      const message = commit.message.replace(/^[a-z]+(\(.+\))?\s*:?\s*/, '');
      switch (commit.type) {
        case 'feat':
          changes.added.push(message);
          break;
        case 'fix':
          changes.fixed.push(message);
          break;
        case 'change':
          changes.changed.push(message);
          break;
        case 'deprecate':
          changes.deprecated.push(message);
          break;
        case 'remove':
          changes.removed.push(message);
          break;
        case 'security':
          changes.security.push(message);
          break;
      }
    }

    return changes;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default PublishingManager;
