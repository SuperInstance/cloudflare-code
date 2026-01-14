/**
 * Security Integration
 * Code scanning, secret scanning, Dependabot, and vulnerability management
 */

import {
  CodeScanningAlert,
  SecretScanningAlert,
  DependabotAlert,
  SecurityAdvisory,
  Repository
} from '../types';

import {
  SecurityError,
  CodeScanningAlertNotFoundError,
  SecretScanningAlertNotFoundError,
  DependabotAlertNotFoundError
} from '../errors';

import { GitHubClient } from '../client/client';

// ============================================================================
// Code Scanning Options
// ============================================================================

export interface CodeScanningOptions {
  severity?: 'none' | 'note' | 'warning' | 'error';
  securitySeverityLevel?: 'low' | 'medium' | 'high' | 'critical';
  state?: 'open' | 'dismissed' | 'fixed';
  tool?: string;
  ruleId?: string;
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

export interface UpdateCodeScanningAlertOptions {
  state?: 'dismissed' | 'open';
  dismissedReason?: 'false positive' | 'won\'t fix' | 'used in tests';
  dismissedComment?: string;
}

export interface CodeScanningAnalysis {
  sarif: string;
  commitSha: string;
  ref?: string;
}

// ============================================================================
// Secret Scanning Options
// ============================================================================

export interface SecretScanningOptions {
  state?: 'open' | 'resolved' | 'dismissed';
  secretType?: string;
  resolution?: string;
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

export interface UpdateSecretScanningAlertOptions {
  state?: 'open' | 'resolved' | 'dismissed';
  resolution?: 'false_positive' | 'wont_fix' | 'revoked';
  resolutionComment?: string;
}

// ============================================================================
// Dependabot Options
// ============================================================================

export interface DependabotOptions {
  state?: 'auto_dismissed' | 'dismissed' | 'fixed' | 'open';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  ecosystem?: string;
  package?: string;
  scope?: string;
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

export interface UpdateDependabotAlertOptions {
  state?: 'dismissed' | 'open';
  dismissedReason?: 'fix_started' | 'inaccurate' | 'no_bandwidth' | 'not_used' | 'tolerable_risk';
  dismissedComment?: string;
}

export interface DependabotConfiguration {
  version: number;
  updates: Array<{
    'package-ecosystem': string;
    directory: string;
    schedule: {
      interval: 'daily' | 'weekly' | 'monthly';
    };
    openPullRequestsLimit?: number;
    targetBranch?: string;
    labels?: string[];
    reviewers?: string[];
    assignees?: string[];
    milestone?: number;
    commitMessage?: string;
  }>;
}

// ============================================================================
// Security Advisory Options
// ============================================================================

export interface SecurityAdvisoryOptions {
  state?: 'published' | 'withdrawn';
  modifiedSince?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  cwe?: string;
  ecosystem?: string;
  perPage?: number;
  page?: number;
}

// ============================================================================
// Main Security Integration Class
// ============================================================================

export class SecurityIntegration {
  private client: GitHubClient;

  constructor(client: GitHubClient) {
    this.client = client;
  }

  // ============================================================================
  // Code Scanning
  // ============================================================================

  async listCodeScanningAlerts(
    owner: string,
    repo: string,
    options?: CodeScanningOptions
  ): Promise<CodeScanningAlert[]> {
    const response = await this.client['octokit'].rest.codeScanning.listAlertsForRepo({
      owner,
      repo,
      state: options?.state,
      severity: options?.severity,
      security_severity_level: options?.securitySeverityLevel,
      tool: options?.tool,
      rule_id: options?.ruleId,
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data as CodeScanningAlert[];
  }

  async getCodeScanningAlert(
    owner: string,
    repo: string,
    alertNumber: number
  ): Promise<CodeScanningAlert> {
    try {
      const response = await this.client['octokit'].rest.codeScanning.getAlert({
        owner,
        repo,
        alert_number: alertNumber
      });

      return response.data as CodeScanningAlert;
    } catch (error) {
      throw new CodeScanningAlertNotFoundError(owner, repo, alertNumber);
    }
  }

  async updateCodeScanningAlert(
    owner: string,
    repo: string,
    alertNumber: number,
    options: UpdateCodeScanningAlertOptions
  ): Promise<CodeScanningAlert> {
    const response = await this.client['octokit'].rest.codeScanning.updateAlert({
      owner,
      repo,
      alert_number: alertNumber,
      state: options.state,
      dismissed_reason: options.dismissedReason,
      dismissed_comment: options.dismissedComment
    });

    return response.data as CodeScanningAlert;
  }

  async uploadCodeScanningAnalysis(
    owner: string,
    repo: string,
    analysis: CodeScanningAnalysis
  ): Promise<void> {
    const sarifBase64 = Buffer.from(analysis.sarif).toString('base64');

    await this.client['octokit'].request('POST /repos/{owner}/{repo}/code-scanning/analyses', {
      owner,
      repo,
      commit_sha: analysis.commitSha,
      ref: analysis.ref,
      sarif: sarifBase64
    });
  }

  async listCodeScanningAnalyses(
    owner: string,
    repo: string,
    options?: {
      ref?: string;
      sarifId?: string;
      perPage?: number;
      page?: number;
    }
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.codeScanning.listAnalysesForRepo({
      owner,
      repo,
      ref: options?.ref,
      sarif_id: options?.sarifId,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data;
  }

  async getCodeScanningAnalysis(
    owner: string,
    repo: string,
    analysisId: number
  ): Promise<any> {
    const response = await this.client['octokit'].rest.codeScanning.getAnalysis({
      owner,
      repo,
      analysis_id: analysisId
    });

    return response.data;
  }

  async deleteCodeScanningAnalysis(
    owner: string,
    repo: string,
    analysisId: number
  ): Promise<void> {
    await this.client['octokit'].rest.codeScanning.deleteAnalysis({
      owner,
      repo,
      analysis_id: analysisId
    });
  }

  async getCodeScanningSarif(
    owner: string,
    repo: string,
    analysisId: number
  ): Promise<string> {
    const response = await this.client['octokit'].rest.codeScanning.getAnalysis({
      owner,
      repo,
      analysis_id: analysisId
    });

    const sarifUrl = response.data.url + '/sarif';
    const sarifResponse = await this.client['octokit'].request('GET ' + sarifUrl);

    return JSON.stringify(sarifResponse.data);
  }

  // ============================================================================
  // Secret Scanning
  // ============================================================================

  async listSecretScanningAlerts(
    owner: string,
    repo: string,
    options?: SecretScanningOptions
  ): Promise<SecretScanningAlert[]> {
    const response = await this.client['octokit'].rest.secretScanning.listAlertsForRepo({
      owner,
      repo,
      state: options?.state,
      secret_type: options?.secretType,
      resolution: options?.resolution,
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data as SecretScanningAlert[];
  }

  async getSecretScanningAlert(
    owner: string,
    repo: string,
    alertNumber: number
  ): Promise<SecretScanningAlert> {
    try {
      const response = await this.client['octokit'].rest.secretScanning.getAlert({
        owner,
        repo,
        alert_number: alertNumber
      });

      return response.data as SecretScanningAlert;
    } catch (error) {
      throw new SecretScanningAlertNotFoundError(owner, repo, alertNumber);
    }
  }

  async updateSecretScanningAlert(
    owner: string,
    repo: string,
    alertNumber: number,
    options: UpdateSecretScanningAlertOptions
  ): Promise<SecretScanningAlert> {
    const response = await this.client['octokit'].rest.secretScanning.updateAlert({
      owner,
      repo,
      alert_number: alertNumber,
      state: options.state,
      resolution: options.resolution,
      resolution_comment: options.resolutionComment
    });

    return response.data as SecretScanningAlert;
  }

  async listSecretScanningLocations(
    owner: string,
    repo: string,
    alertNumber: number
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.secretScanning.listLocationsForAlert({
      owner,
      repo,
      alert_number: alertNumber
    });

    return response.data;
  }

  // ============================================================================
  // Dependabot
  // ============================================================================

  async listDependabotAlerts(
    owner: string,
    repo: string,
    options?: DependabotOptions
  ): Promise<DependabotAlert[]> {
    const response = await this.client['octokit'].rest.dependabot.listAlertsForRepo({
      owner,
      repo,
      state: options?.state,
      severity: options?.severity,
      ecosystem: options?.ecosystem,
      package: options?.package,
      scope: options?.scope,
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data as DependabotAlert[];
  }

  async getDependabotAlert(
    owner: string,
    repo: string,
    alertId: number
  ): Promise<DependabotAlert> {
    try {
      const response = await this.client['octokit'].rest.dependabot.getAlert({
        owner,
        repo,
        alert_id: alertId
      });

      return response.data as DependabotAlert;
    } catch (error) {
      throw new DependabotAlertNotFoundError(owner, repo, alertId);
    }
  }

  async updateDependabotAlert(
    owner: string,
    repo: string,
    alertId: number,
    options: UpdateDependabotAlertOptions
  ): Promise<DependabotAlert> {
    const response = await this.client['octokit'].rest.dependabot.updateAlert({
      owner,
      repo,
      alert_id: alertId,
      state: options.state,
      dismissed_reason: options.dismissedReason,
      dismissed_comment: options.dismissedComment
    });

    return response.data as DependabotAlert;
  }

  async getDependabotConfiguration(
    owner: string,
    repo: string
  ): Promise<DependabotConfiguration | null> {
    try {
      const response = await this.client['octokit'].request(
        'GET /repos/{owner}/{repo}/contents/.github/dependabot.yml',
        {
          owner,
          repo
        }
      );

      if (response.data.type !== 'file') {
        return null;
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return JSON.parse(content) as DependabotConfiguration;
    } catch (error) {
      return null;
    }
  }

  async updateDependabotConfiguration(
    owner: string,
    repo: string,
    config: DependabotConfiguration
  ): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    const contentBase64 = Buffer.from(content).toString('base64');

    try {
      const existing = await this.getDependabotConfiguration(owner, repo);

      if (existing) {
        await this.client['octokit'].request(
          'PUT /repos/{owner}/{repo}/contents/.github/dependabot.yml',
          {
            owner,
            repo,
            message: 'Update Dependabot configuration',
            content: contentBase64,
            sha: existing.sha
          }
        );
      } else {
        await this.client['octokit'].request(
          'PUT /repos/{owner}/{repo}/contents/.github/dependabot.yml',
          {
            owner,
            repo,
            message: 'Create Dependabot configuration',
            content: contentBase64
          }
        );
      }
    } catch (error) {
      throw new SecurityError('Failed to update Dependabot configuration');
    }
  }

  async enableDependabot(
    owner: string,
    repo: string
  ): Promise<void> {
    await this.client['octokit'].rest.repos.enableAutomatedSecurityFixes({
      owner,
      repo
    });
  }

  async disableDependabot(
    owner: string,
    repo: string
  ): Promise<void> {
    await this.client['octokit'].rest.repos.disableAutomatedSecurityFixes({
      owner,
      repo
    });
  }

  // ============================================================================
  // Security Advisories
  // ============================================================================

  async listSecurityAdvisories(
    options?: SecurityAdvisoryOptions
  ): Promise<SecurityAdvisory[]> {
    const response = await this.client['octokit'].rest.securityAdvisories.list({
      state: options?.state,
      modified_since: options?.modifiedSince,
      severity: options?.severity,
      cwe: options?.cwe,
      ecosystem: options?.ecosystem,
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data;
  }

  async getSecurityAdvisory(
    ghsaId: string
  ): Promise<SecurityAdvisory> {
    const response = await this.client['octokit'].rest.securityAdvisories.get({
      ghsa_id: ghsaId
    });

    return response.data;
  }

  async listSecurityAdvisoriesForRepository(
    owner: string,
    repo: string,
    options?: {
      perPage?: number;
      page?: number;
    }
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.dependabot.listAlertsForRepo({
      owner,
      repo,
      state: 'open',
      per_page: options?.perPage || 30,
      page: options?.page || 1
    });

    return response.data;
  }

  // ============================================================================
  // Security Features Management
  // ============================================================================

  async enableCodeScanning(
    owner: string,
    repo: string,
    options?: {
      query?: string;
      languages?: string[];
      packageNames?: string[];
    }
  ): Promise<void> {
    await this.uploadCodeScanningAnalysis(owner, repo, {
      sarif: JSON.stringify({
        version: '2.1.0',
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        runs: [{
          tool: {
            driver: {
              name: 'ClaudeFlare Security Scanner',
              version: '1.0.0',
              informationUri: 'https://github.com/claudeflare/security'
            }
          },
          results: []
        }]
      }),
      commitSha: (await this.client.getRepository(owner, repo)).default_branch
    });
  }

  async enableSecretScanning(
    owner: string,
    repo: string
  ): Promise<void> {
    await this.client['octokit'].request('PUT /repos/{owner}/{repo}/secret-scanning/alerts', {
      owner,
      repo
    });
  }

  async getSecurityFeatures(
    owner: string,
    repo: string
  ): Promise<{
    advancedSecurity: boolean;
    secretScanning: boolean;
    secretScanningPushProtection: boolean;
    dependabotSecurityUpdates: boolean;
    dependabotAlerts: boolean;
    codeScanning: boolean;
    codeScanningDefaultSetup: boolean;
  }> {
    const repository = await this.client.getRepository(owner, repo);

    return {
      advancedSecurity: repository.security_and_analysis?.advanced_security?.status === 'enabled',
      secretScanning: repository.security_and_analysis?.secret_scanning?.status === 'enabled',
      secretScanningPushProtection: repository.security_and_analysis?.secret_scanning_push_protection?.status === 'enabled',
      dependabotSecurityUpdates: repository.security_and_analysis?.dependabot_security_updates?.status === 'enabled',
      dependabotAlerts: repository.security_and_analysis?.dependabot_alerts?.status === 'enabled',
      codeScanning: repository.security_and_analysis?.code_scanning_default_setup?.status === 'enabled',
      codeScanningDefaultSetup: repository.security_and_analysis?.code_scanning_default_setup?.status === 'enabled'
    };
  }

  // ============================================================================
  // Security Analytics
  // ============================================================================

  async getSecurityAnalytics(
    owner: string,
    repo: string
  ): Promise<{
    codeScanning: {
      total: number;
      open: number;
      dismissed: number;
      fixed: number;
      bySeverity: Record<string, number>;
      byTool: Record<string, number>;
    };
    secretScanning: {
      total: number;
      open: number;
      resolved: number;
      dismissed: number;
      byType: Record<string, number>;
    };
    dependabot: {
      total: number;
      open: number;
      dismissed: number;
      fixed: number;
      bySeverity: Record<string, number>;
      byEcosystem: Record<string, number>;
    };
  }> {
    const [codeScanningAlerts, secretScanningAlerts, dependabotAlerts] = await Promise.all([
      this.listCodeScanningAlerts(owner, repo),
      this.listSecretScanningAlerts(owner, repo),
      this.listDependabotAlerts(owner, repo)
    ]);

    const codeScanning = {
      total: codeScanningAlerts.length,
      open: codeScanningAlerts.filter(a => a.state === 'open').length,
      dismissed: codeScanningAlerts.filter(a => a.state === 'dismissed').length,
      fixed: codeScanningAlerts.filter(a => a.state === 'fixed').length,
      bySeverity: {} as Record<string, number>,
      byTool: {} as Record<string, number>
    };

    for (const alert of codeScanningAlerts) {
      const severity = alert.rule.security_severity_level || 'unknown';
      codeScanning.bySeverity[severity] = (codeScanning.bySeverity[severity] || 0) + 1;

      const tool = alert.tool.name;
      codeScanning.byTool[tool] = (codeScanning.byTool[tool] || 0) + 1;
    }

    const secretScanning = {
      total: secretScanningAlerts.length,
      open: secretScanningAlerts.filter(a => a.state === 'open').length,
      resolved: secretScanningAlerts.filter(a => a.state === 'resolved').length,
      dismissed: secretScanningAlerts.filter(a => a.state === 'dismissed').length,
      byType: {} as Record<string, number>
    };

    for (const alert of secretScanningAlerts) {
      const type = alert.secret_type_display_name;
      secretScanning.byType[type] = (secretScanning.byType[type] || 0) + 1;
    }

    const dependabot = {
      total: dependabotAlerts.length,
      open: dependabotAlerts.filter(a => a.state === 'open').length,
      dismissed: dependabotAlerts.filter(a => a.state === 'dismissed').length,
      fixed: dependabotAlerts.filter(a => a.state === 'fixed').length,
      bySeverity: {} as Record<string, number>,
      byEcosystem: {} as Record<string, number>
    };

    for (const alert of dependabotAlerts) {
      const severity = alert.security_advisory.severity;
      dependabot.bySeverity[severity] = (dependabot.bySeverity[severity] || 0) + 1;

      const ecosystem = alert.dependency.package.ecosystem;
      dependabot.byEcosystem[ecosystem] = (dependabot.byEcosystem[ecosystem] || 0) + 1;
    }

    return {
      codeScanning,
      secretScanning,
      dependabot
    };
  }

  async getSecurityScore(
    owner: string,
    repo: string
  ): Promise<{
    overall: number;
    codeScanning: number;
    secretScanning: number;
    dependabot: number;
    details: string[];
  }> {
    const analytics = await this.getSecurityAnalytics(owner, repo);
    const details: string[] = [];

    let codeScanningScore = 100;
    if (analytics.codeScanning.open > 0) {
      const criticalCount = analytics.codeScanning.bySeverity['critical'] || 0;
      const highCount = analytics.codeScanning.bySeverity['high'] || 0;
      codeScanningScore -= criticalCount * 10 + highCount * 5;
      details.push(`Code scanning: ${analytics.codeScanning.open} open alerts`);
    }

    let secretScanningScore = 100;
    if (analytics.secretScanning.open > 0) {
      secretScanningScore -= analytics.secretScanning.open * 20;
      details.push(`Secret scanning: ${analytics.secretScanning.open} open alerts`);
    }

    let dependabotScore = 100;
    if (analytics.dependabot.open > 0) {
      const criticalCount = analytics.dependabot.bySeverity['critical'] || 0;
      const highCount = analytics.dependabot.bySeverity['high'] || 0;
      dependabotScore -= criticalCount * 10 + highCount * 5;
      details.push(`Dependabot: ${analytics.dependabot.open} open alerts`);
    }

    const overall = Math.round(
      (codeScanningScore + secretScanningScore + dependabotScore) / 3
    );

    return {
      overall: Math.max(0, overall),
      codeScanning: Math.max(0, codeScanningScore),
      secretScanning: Math.max(0, secretScanningScore),
      dependabot: Math.max(0, dependabotScore),
      details
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSecurityIntegration(client: GitHubClient): SecurityIntegration {
  return new SecurityIntegration(client);
}
