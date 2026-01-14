/**
 * Template management utilities
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { TemplateMetadata } from './generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get available templates
 */
export async function getAvailableTemplates(): Promise<TemplateMetadata[]> {
  const { getAvailableTemplates: generatorGetTemplates } = await import('./generator.js');
  return generatorGetTemplates();
}

/**
 * Load template content
 */
export async function loadTemplate(templateName: string): Promise<Map<string, string>> {
  const templatePath = join(__dirname, '../../templates', templateName);
  const files = new Map<string, string>();

  try {
    await collectFiles(templatePath, '', files);
  } catch (error) {
    throw new Error(`Failed to load template '${templateName}': ${error}`);
  }

  return files;
}

/**
 * Recursively collect template files
 */
async function collectFiles(
  basePath: string,
  relativePath: string,
  files: Map<string, string>
): Promise<void> {
  const fullPath = join(basePath, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(fullPath, entry.name);
    const entryRelative = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(basePath, entryRelative, files);
    } else {
      const content = await fs.readFile(entryPath, 'utf-8');
      files.set(entryRelative, content);
    }
  }
}

/**
 * Validate template structure
 */
export async function validateTemplate(templateName: string): Promise<boolean> {
  const templatePath = join(__dirname, '../../templates', templateName);

  try {
    const stats = await fs.stat(templatePath);
    if (!stats.isDirectory()) {
      return false;
    }

    // Check for required files
    const requiredFiles = ['src/index.ts', 'package.json', 'wrangler.toml'];
    for (const file of requiredFiles) {
      try {
        await fs.access(join(templatePath, file));
      } catch {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
