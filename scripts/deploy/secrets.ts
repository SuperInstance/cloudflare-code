/**
 * Secret Management Script for ClaudeFlare
 * Handles secure secret provisioning and rotation for Cloudflare Workers
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentEvent,
  SecretConfig,
  Environment,
} from './types.js';

/**
 * Secret manager class
 */
export class SecretManager {
  private config: DeploymentConfig;
  private context: DeploymentContext;
  private encryptionKey: Buffer;

  constructor(config: DeploymentConfig, context: DeploymentContext) {
    this.config = config;
    this.context = context;

    // Get encryption key from environment
    const key = process.env.SECRET_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('SECRET_ENCRYPTION_KEY environment variable is required');
    }

    // Use first 32 bytes as encryption key
    this.encryptionKey = Buffer.from(key.slice(0, 32), 'hex');
  }

  /**
   * Provision all secrets for an environment
   */
  async provisionSecrets(secrets: SecretConfig[]): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Provisioning ${secrets.length} secrets for ${this.config.environment}...`,
      timestamp: new Date(),
    });

    const environmentSecrets = secrets.filter(s => s.environment === this.config.environment);
    const requiredSecrets = environmentSecrets.filter(s => s.required);

    // Check required secrets
    const missingSecrets = requiredSecrets.filter(s => {
      return !process.env[s.name] && !s.value;
    });

    if (missingSecrets.length > 0) {
      throw new Error(
        `Missing required secrets: ${missingSecrets.map(s => s.name).join(', ')}`
      );
    }

    // Provision each secret
    for (const secret of environmentSecrets) {
      await this.provisionSecret(secret);
    }

    this.emitEvent({
      type: 'success',
      message: `All secrets provisioned for ${this.config.environment}`,
      timestamp: new Date(),
    });
  }

  /**
   * Provision a single secret
   */
  async provisionSecret(secret: SecretConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Provisioning secret: ${secret.name}...`,
      timestamp: new Date(),
    });

    try {
      // Get secret value
      const value = process.env[secret.name] || secret.value;
      if (!value) {
        throw new Error(`Secret value not found for ${secret.name}`);
      }

      // Encrypt if required
      const finalValue = secret.encrypted ? await this.encrypt(value) : value;

      // Deploy secret to Cloudflare
      await this.deploySecret(secret.name, finalValue);

      this.emitEvent({
        type: 'success',
        message: `Secret ${secret.name} provisioned successfully`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to provision secret ${secret.name}`,
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });

      if (secret.required) {
        throw error;
      }
    }
  }

  /**
   * Deploy secret to Cloudflare Workers
   */
  private async deploySecret(name: string, value: string): Promise<void> {
    const envFlag = this.config.environment !== 'development'
      ? `--env ${this.config.environment}`
      : '';

    const command = `echo "${value}" | wrangler secret put ${name} ${envFlag}`;

    try {
      execSync(command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        input: value,
      });
    } catch (error) {
      throw new Error(`Failed to deploy secret ${name}: ${error}`);
    }
  }

  /**
   * Encrypt a secret value
   */
  private async encrypt(value: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a secret value
   */
  private async decrypt(encryptedValue: string): Promise<string> {
    const parts = encryptedValue.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(secret: SecretConfig, newValue: string): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Rotating secret: ${secret.name}...`,
      timestamp: new Date(),
    });

    try {
      // Backup old value
      const oldValue = process.env[secret.name];
      if (oldValue) {
        await this.backupSecret(secret.name, oldValue);
      }

      // Deploy new value
      const finalValue = secret.encrypted ? await this.encrypt(newValue) : newValue;
      await this.deploySecret(secret.name, finalValue);

      // Verify rotation
      await this.verifySecret(secret.name);

      this.emitEvent({
        type: 'success',
        message: `Secret ${secret.name} rotated successfully`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to rotate secret ${secret.name}`,
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Backup a secret
   */
  private async backupSecret(name: string, value: string): Promise<void> {
    const backupPath = resolve(process.cwd(), '.secrets', `${name}.backup`);

    try {
      const encrypted = await this.encrypt(value);
      writeFileSync(backupPath, encrypted, 'utf-8');

      this.emitEvent({
        type: 'info',
        message: `Secret ${name} backed up to ${backupPath}`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.context.logger.warn(`Failed to backup secret ${name}: ${error}`);
    }
  }

  /**
   * Restore a secret from backup
   */
  async restoreSecret(name: string): Promise<void> {
    const backupPath = resolve(process.cwd(), '.secrets', `${name}.backup`);

    if (!existsSync(backupPath)) {
      throw new Error(`No backup found for secret ${name}`);
    }

    this.emitEvent({
      type: 'info',
      message: `Restoring secret ${name} from backup...`,
      timestamp: new Date(),
    });

    try {
      const encrypted = readFileSync(backupPath, 'utf-8');
      const decrypted = await this.decrypt(encrypted);

      await this.deploySecret(name, decrypted);

      this.emitEvent({
        type: 'success',
        message: `Secret ${name} restored from backup`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to restore secret ${name}`,
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Verify a secret is deployed correctly
   */
  private async verifySecret(name: string): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Verifying secret ${name}...`,
      timestamp: new Date(),
    });

    try {
      const envFlag = this.config.environment !== 'development'
        ? `--env ${this.config.environment}`
        : '';

      const command = `wrangler secret list ${envFlag}`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      // Parse output to check if secret exists
      const secretExists = output.includes(name);

      if (!secretExists) {
        throw new Error(`Secret ${name} not found in deployment`);
      }

      this.emitEvent({
        type: 'success',
        message: `Secret ${name} verified`,
        timestamp: new Date(),
      });
    } catch (error) {
      throw new Error(`Failed to verify secret ${name}: ${error}`);
    }
  }

  /**
   * List all deployed secrets
   */
  async listSecrets(): Promise<string[]> {
    const envFlag = this.config.environment !== 'development'
      ? `--env ${this.config.environment}`
      : '';

    try {
      const command = `wrangler secret list ${envFlag}`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      // Parse output to extract secret names
      const lines = output.split('\n');
      const secrets = lines
        .filter(line => line.includes('│') && !line.includes('─'))
        .map(line => {
          const match = line.match(/│\s*([^│]+)\s*│/);
          return match ? match[1].trim() : null;
        })
        .filter(Boolean) as string[];

      return secrets;
    } catch (error) {
      this.context.logger.warn(`Failed to list secrets: ${error}`);
      return [];
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string): Promise<void> {
    this.emitEvent({
      type: 'warning',
      message: `Deleting secret: ${name}...`,
      timestamp: new Date(),
    });

    try {
      const envFlag = this.config.environment !== 'development'
        ? `--env ${this.config.environment}`
        : '';

      const command = `wrangler secret delete ${name} ${envFlag} --force`;

      execSync(command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
      });

      this.emitEvent({
        type: 'success',
        message: `Secret ${name} deleted`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to delete secret ${name}`,
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Generate a random secret
   */
  generateSecret(length: number = 32): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * Validate secret configuration
   */
  async validateSecrets(secrets: SecretConfig[]): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const secret of secrets) {
      // Check name format
      if (!/^[A-Z_][A-Z0-9_]*$/.test(secret.name)) {
        errors.push(
          `Invalid secret name "${secret.name}": must be uppercase with underscores`
        );
      }

      // Check if secret is in environment
      if (!process.env[secret.name] && !secret.value) {
        if (secret.required) {
          errors.push(`Required secret "${secret.name}" is missing`);
        } else {
          warnings.push(`Optional secret "${secret.name}" is missing`);
        }
      }

      // Check secret strength
      const value = process.env[secret.name] || secret.value;
      if (value && value.length < 16) {
        warnings.push(`Secret "${secret.name}" is weak (less than 16 characters)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export secrets (encrypted)
   */
  async exportSecrets(outputPath: string): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Exporting secrets (encrypted)...',
      timestamp: new Date(),
    });

    try {
      const secrets = await this.listSecrets();
      const exportData: Record<string, string> = {};

      for (const secretName of secrets) {
        const value = process.env[secretName];
        if (value) {
          exportData[secretName] = await this.encrypt(value);
        }
      }

      writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

      this.emitEvent({
        type: 'success',
        message: `Secrets exported to ${outputPath}`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: 'Failed to export secrets',
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Import secrets (encrypted)
   */
  async importSecrets(inputPath: string): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Importing secrets (encrypted)...',
      timestamp: new Date(),
    });

    try {
      if (!existsSync(inputPath)) {
        throw new Error(`Import file not found: ${inputPath}`);
      }

      const content = readFileSync(inputPath, 'utf-8');
      const secrets = JSON.parse(content);

      for (const [name, encryptedValue] of Object.entries(secrets)) {
        const decrypted = await this.decrypt(encryptedValue as string);
        await this.deploySecret(name, decrypted);
      }

      this.emitEvent({
        type: 'success',
        message: 'Secrets imported successfully',
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: 'Failed to import secrets',
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Emit deployment event
   */
  private emitEvent(event: DeploymentEvent): void {
    this.context.events.push(event);
    this.context.logger.info(`[${event.type.toUpperCase()}] ${event.message}`);
  }
}

/**
 * Create a new secret manager instance
 */
export function createSecretManager(
  config: DeploymentConfig,
  context: DeploymentContext
): SecretManager {
  return new SecretManager(config, context);
}

/**
 * Default secret configurations for ClaudeFlare
 */
export const DEFAULT_SECRETS: SecretConfig[] = [
  // Common secrets
  {
    name: 'CLOUDFLARE_API_TOKEN',
    value: '',
    environment: 'development',
    required: true,
    encrypted: false,
  },
  {
    name: 'CLOUDFLARE_ACCOUNT_ID',
    value: '',
    environment: 'development',
    required: true,
    encrypted: false,
  },

  // API keys
  {
    name: 'OPENAI_API_KEY',
    value: '',
    environment: 'development',
    required: true,
    encrypted: true,
  },
  {
    name: 'ANTHROPIC_API_KEY',
    value: '',
    environment: 'development',
    required: true,
    encrypted: true,
  },

  // Database
  {
    name: 'DATABASE_URL',
    value: '',
    environment: 'development',
    required: false,
    encrypted: true,
  },
  {
    name: 'DATABASE_ENCRYPTION_KEY',
    value: '',
    environment: 'development',
    required: false,
    encrypted: true,
  },

  // Authentication
  {
    name: 'JWT_SECRET',
    value: '',
    environment: 'development',
    required: true,
    encrypted: true,
  },
  {
    name: 'SESSION_SECRET',
    value: '',
    environment: 'development',
    required: true,
    encrypted: true,
  },

  // Staging environment
  {
    name: 'STAGING_API_KEY',
    value: '',
    environment: 'staging',
    required: true,
    encrypted: true,
  },
  {
    name: 'STAGING_DATABASE_URL',
    value: '',
    environment: 'staging',
    required: true,
    encrypted: true,
  },

  // Production environment
  {
    name: 'PRODUCTION_API_KEY',
    value: '',
    environment: 'production',
    required: true,
    encrypted: true,
  },
  {
    name: 'PRODUCTION_DATABASE_URL',
    value: '',
    environment: 'production',
    required: true,
    encrypted: true,
  },
  {
    name: 'PRODUCTION_ENCRYPTION_KEY',
    value: '',
    environment: 'production',
    required: true,
    encrypted: true,
  },
];
