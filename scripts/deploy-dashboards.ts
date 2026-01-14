#!/usr/bin/env tsx

/**
 * Grafana Dashboard Deployment Script
 *
 * Automates the deployment of ClaudeFlare monitoring dashboards to Grafana.
 * Supports:
 * - Bulk dashboard deployment
 * - Dashboard updates
 * - Dashboard validation
 * - Version control
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Grafana API Configuration
 */
interface GrafanaConfig {
  url: string;
  apiKey: string;
  folder?: string;
  overwrite?: boolean;
}

/**
 * Dashboard metadata
 */
interface DashboardMetadata {
  file: string;
  title: string;
  uid?: string;
  id?: number;
  version?: number;
}

/**
 * Dashboard deployment result
 */
interface DeploymentResult {
  success: boolean;
  file: string;
  dashboardId?: number;
  uid?: string;
  version?: number;
  error?: string;
}

/**
 * Grafana Dashboard Deployer
 */
export class GrafanaDashboardDeployer {
  private config: GrafanaConfig;
  private dashboardDir: string;

  constructor(config: GrafanaConfig, dashboardDir: string = './dashboards') {
    this.config = config;
    this.dashboardDir = dashboardDir;
  }

  /**
   * Deploy all dashboards
   */
  async deployAll(): Promise<DeploymentResult[]> {
    const files = this.getDashboardFiles();
    const results: DeploymentResult[] = [];

    console.log(`Found ${files.length} dashboard(s) to deploy`);

    for (const file of files) {
      const result = await this.deployDashboard(file);
      results.push(result);
      this.logResult(result);
    }

    this.printSummary(results);
    return results;
  }

  /**
   * Deploy a single dashboard
   */
  async deployDashboard(file: string): Promise<DeploymentResult> {
    try {
      const dashboardData = this.loadDashboard(file);
      const dashboard = dashboardData.dashboard;

      console.log(`Deploying dashboard: ${dashboard.title}`);

      // Check if dashboard already exists
      const existing = await this.findDashboard(dashboard.title);

      // Prepare payload
      const payload = {
        dashboard: {
          ...dashboard,
          id: existing?.id || dashboard.id,
          uid: existing?.uid || dashboard.uid,
          version: existing?.version || dashboard.version,
        },
        overwrite: this.config.overwrite ?? true,
        message: 'Deployed by ClaudeFlare dashboard deployer',
        folderId: await this.getFolderId(),
      };

      // Deploy dashboard
      const response = await fetch(`${this.config.url}/api/dashboards/db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Grafana API error: ${error}`);
      }

      const result = await response.json();

      return {
        success: true,
        file,
        dashboardId: result.id,
        uid: result.uid,
        version: result.version,
      };
    } catch (error) {
      return {
        success: false,
        file,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all dashboard files
   */
  private getDashboardFiles(): string[] {
    if (!existsSync(this.dashboardDir)) {
      throw new Error(`Dashboard directory not found: ${this.dashboardDir}`);
    }

    const files = readdirSync(this.dashboardDir)
      .filter((file) => file.endsWith('.json'))
      .sort();

    return files;
  }

  /**
   * Load dashboard from file
   */
  private loadDashboard(file: string): any {
    const filePath = join(this.dashboardDir, file);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Find existing dashboard by title
   */
  private async findDashboard(title: string): Promise<{ id: number; uid: string; version: number } | null> {
    try {
      const response = await fetch(
        `${this.config.url}/api/search?query=${encodeURIComponent(title)}&type=dash-db`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const results = await response.json();
      if (results.length === 0) {
        return null;
      }

      const dashboard = results[0];
      return {
        id: dashboard.id,
        uid: dashboard.uid,
        version: 1, // We'll get the actual version on update
      };
    } catch {
      return null;
    }
  }

  /**
   * Get or create folder
   */
  private async getFolderId(): Promise<number | undefined> {
    if (!this.config.folder) {
      return undefined;
    }

    try {
      // Try to find existing folder
      const searchResponse = await fetch(
        `${this.config.url}/api/search?query=${encodeURIComponent(this.config.folder)}&type=folder`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (searchResponse.ok) {
        const folders = await searchResponse.json();
        if (folders.length > 0) {
          return folders[0].id;
        }
      }

      // Create new folder
      const createResponse = await fetch(`${this.config.url}/api/folders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: this.config.folder,
        }),
      });

      if (createResponse.ok) {
        const folder = await createResponse.json();
        return folder.id;
      }
    } catch (error) {
      console.error('Failed to get/create folder:', error);
    }

    return undefined;
  }

  /**
   * Log deployment result
   */
  private logResult(result: DeploymentResult): void {
    if (result.success) {
      console.log(`✓ ${result.file}: Deployed (ID: ${result.dashboardId}, UID: ${result.uid})`);
    } else {
      console.error(`✗ ${result.file}: ${result.error}`);
    }
  }

  /**
   * Print deployment summary
   */
  private printSummary(results: DeploymentResult[]): void {
    const success = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log('\n' + '='.repeat(50));
    console.log('Deployment Summary');
    console.log('='.repeat(50));
    console.log(`Total: ${results.length}`);
    console.log(`Success: ${success}`);
    console.log(`Failed: ${failed}`);
    console.log('='.repeat(50));
  }

  /**
   * Validate dashboards before deployment
   */
  async validate(): Promise<boolean> {
    const files = this.getDashboardFiles();
    let valid = true;

    console.log('Validating dashboards...\n');

    for (const file of files) {
      try {
        const dashboard = this.loadDashboard(file);

        // Validate structure
        if (!dashboard.dashboard) {
          throw new Error('Missing "dashboard" property');
        }

        const d = dashboard.dashboard;

        // Validate required fields
        if (!d.title) {
          throw new Error('Missing "title" property');
        }

        if (!d.panels || !Array.isArray(d.panels)) {
          throw new Error('Missing or invalid "panels" property');
        }

        // Validate panels
        d.panels.forEach((panel: any, index: number) => {
          if (!panel.id) {
            throw new Error(`Panel ${index}: Missing "id" property`);
          }
          if (!panel.title) {
            throw new Error(`Panel ${index}: Missing "title" property`);
          }
          if (!panel.type) {
            throw new Error(`Panel ${index}: Missing "type" property`);
          }
          if (!panel.targets || !Array.isArray(panel.targets)) {
            throw new Error(`Panel ${index}: Missing or invalid "targets" property`);
          }
        });

        console.log(`✓ ${file}: Valid`);
      } catch (error) {
        console.error(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`);
        valid = false;
      }
    }

    return valid;
  }

  /**
   * Export dashboards from Grafana
   */
  async export(outputDir: string = './exported-dashboards'): Promise<void> {
    console.log('Exporting dashboards from Grafana...\n');

    try {
      const response = await fetch(
        `${this.config.url}/api/search?query=claudeflare&type=dash-db`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search dashboards: ${response.statusText}`);
      }

      const dashboards = await response.json();
      console.log(`Found ${dashboards.length} dashboard(s)\n`);

      for (const dashboard of dashboards) {
        const detailResponse = await fetch(
          `${this.config.url}/api/dashboards/uid/${dashboard.uid}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          }
        );

        if (!detailResponse.ok) {
          console.error(`Failed to export ${dashboard.title}: ${detailResponse.statusText}`);
          continue;
        }

        const detail = await detailResponse.json();
        const filename = `${dashboard.title.toLowerCase().replace(/\s+/g, '-')}.json`;
        const filepath = join(outputDir, filename);

        // Write to file
        const fs = await import('fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(filepath, JSON.stringify(detail, null, 2));

        console.log(`✓ Exported: ${filename}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  /**
   * Delete a dashboard
   */
  async deleteDashboard(uid: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/api/dashboards/uid/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';

  // Load configuration from environment
  const config: GrafanaConfig = {
    url: process.env.GRAFANA_URL || 'http://localhost:3000',
    apiKey: process.env.GRAFANA_API_KEY || '',
    folder: process.env.GRAFANA_FOLDER || 'ClaudeFlare',
    overwrite: process.env.GRAFANA_OVERWRITE !== 'false',
  };

  if (!config.apiKey) {
    console.error('Error: GRAFANA_API_KEY environment variable is required');
    process.exit(1);
  }

  const deployer = new GrafanaDashboardDeployer(config);

  switch (command) {
    case 'deploy':
      await deployer.deployAll();
      break;

    case 'validate':
      const valid = await deployer.validate();
      process.exit(valid ? 0 : 1);
      break;

    case 'export':
      const outputDir = args[1] || './exported-dashboards';
      await deployer.export(outputDir);
      break;

    case 'delete':
      const uid = args[1];
      if (!uid) {
        console.error('Error: Dashboard UID is required for deletion');
        process.exit(1);
      }
      const deleted = await deployer.deleteDashboard(uid);
      console.log(deleted ? `Dashboard ${uid} deleted` : `Failed to delete dashboard ${uid}`);
      break;

    default:
      console.log(`Usage: ${process.argv[1]} [deploy|validate|export|delete]`);
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { GrafanaDashboardDeployer, type GrafanaConfig, type DeploymentResult };
