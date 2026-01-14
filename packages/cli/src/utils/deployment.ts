/**
 * Deployment history and utilities
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { DeploymentResult } from '../types/index.js';

const HISTORY_FILE = join(process.cwd(), '.claudeflare', 'deployment-history.json');

/**
 * Save deployment to history
 */
export async function saveDeploymentHistory(
  deployment: DeploymentResult
): Promise<void> {
  try {
    await fs.mkdir(join(HISTORY_FILE, '..'), { recursive: true });

    const history = await getDeploymentHistory();
    history.unshift({
      ...deployment,
      timestamp: Date.now(),
    });

    // Keep only last 100 deployments
    const trimmed = history.slice(0, 100);

    await fs.writeFile(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
  } catch (error) {
    // Non-critical, just log and continue
    console.warn('Failed to save deployment history:', error);
  }
}

/**
 * Get deployment history
 */
export async function getDeploymentHistory(): Promise<Array<DeploymentResult & { timestamp: number }>> {
  try {
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Get latest deployment for environment
 */
export async function getLatestDeployment(
  environment: string
): Promise<DeploymentResult | null> {
  const history = await getDeploymentHistory();
  return (
    history.find((d) => d.environment === environment && d.success) || null
  );
}

/**
 * Clear deployment history
 */
export async function clearDeploymentHistory(): Promise<void> {
  try {
    await fs.unlink(HISTORY_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}
