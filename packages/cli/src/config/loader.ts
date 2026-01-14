/**
 * Configuration loader and validator
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cwd } from 'process';
import { ConfigSchema, type Config, type RawConfig } from '../types/index.js';
import { ConfigError, DependencyError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find config file in project directory
 */
export async function findConfigFile(projectDir: string = cwd()): Promise<string | null> {
  const possiblePaths = [
    resolve(projectDir, 'claudeflare.config.ts'),
    resolve(projectDir, 'claudeflare.config.js'),
    resolve(projectDir, 'claudeflare.config.mjs'),
    resolve(projectDir, '.claudeflarerc'),
    resolve(projectDir, '.claudeflarerc.json'),
    resolve(projectDir, '.claudeflarerc.ts'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Load config from file
 */
export async function loadConfigFromFile(
  configPath: string
): Promise<RawConfig> {
  try {
    // Clear require cache to ensure fresh load
    const modulePath = resolve(configPath);
    const configModule = await import(`file://${modulePath}?t=${Date.now()}`);

    const config = configModule.default ?? configModule;

    if (typeof config === 'function') {
      return await config();
    }

    return config as RawConfig;
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigError(
        `Failed to load config from ${configPath}: ${error.message}`,
        [
          'Check that the config file exports a default object or function',
          'Verify all required dependencies are installed',
          'Run: npm install',
        ]
      );
    }
    throw error;
  }
}

/**
 * Load environment variables
 */
export function loadEnvironment(environment?: string): Record<string, string> {
  const env = environment ?? process.env.NODE_ENV ?? 'development';

  // Load from .env files if dotenv is available
  try {
    // Check for .env.{environment} first
    const envPath = resolve(cwd(), `.env.${env}`);
    const defaultEnvPath = resolve(cwd(), '.env');

    // Try to load dotenv if available
    let dotenv: any;
    try {
      dotenv = await import('dotenv');
    } catch {
      // dotenv not available, just use process.env
      return process.env as Record<string, string>;
    }

    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
    } else if (existsSync(defaultEnvPath)) {
      dotenv.config({ path: defaultEnvPath });
    }
  } catch (error) {
    // Silently ignore dotenv errors
  }

  return process.env as Record<string, string>;
}

/**
 * Normalize and validate config
 */
export function normalizeConfig(raw: RawConfig): Config {
  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.errors;
    const formattedErrors = errors.map((e) => {
      const path = e.path.join('.');
      return `  - ${path}: ${e.message}`;
    }).join('\n');

    throw new ConfigError(
      `Configuration validation failed:\n${formattedErrors}`,
      [
        'Check your claudeflare.config.ts file',
        'Ensure all required fields are present',
        'Verify field types match the schema',
      ]
    );
  }

  return result.data as Config;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Partial<RawConfig> {
  return {
    name: 'claudeflare-app',
    version: '0.1.0',
    description: 'A ClaudeFlare application',

    worker: {
      name: 'claudeflare-worker',
      main: 'src/index.ts',
      compatibility_date: '2024-01-01',
    },

    build: {
      input: 'src/index.ts',
      output: 'dist/worker.js',
      minify: true,
      sourcemap: true,
    },

    dev: {
      port: 8788,
      host: 'localhost',
      proxy: true,
      open: false,
    },

    deploy: {
      environment: 'preview',
      workers: {
        name: 'claudeflare-worker',
      },
    },

    cli: {
      debug: false,
      verbose: false,
      colors: true,
      progress: true,
    },
  };
}

/**
 * Main config loader class
 */
export class ConfigLoader {
  private projectDir: string;
  private configPath?: string;
  private loadedConfig?: Config;
  private environment?: string;

  constructor(projectDir: string = cwd()) {
    this.projectDir = projectDir;
  }

  /**
   * Load and validate configuration
   */
  async load(environment?: string): Promise<Config> {
    if (this.loadedConfig) {
      return this.loadedConfig;
    }

    this.environment = environment;

    // Find config file
    const configPath = await findConfigFile(this.projectDir);

    if (!configPath) {
      throw new ConfigError(
        'No configuration file found',
        [
          'Create a claudeflare.config.ts file in your project root',
          'Run: claudeflare init',
        ]
      );
    }

    this.configPath = configPath;

    // Load raw config
    let rawConfig: RawConfig;

    try {
      rawConfig = await loadConfigFromFile(configPath);
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Merge with defaults
    const defaults = getDefaultConfig();
    const merged = {
      ...defaults,
      ...rawConfig,
      worker: { ...defaults.worker, ...rawConfig.worker },
      build: { ...defaults.build, ...rawConfig.build },
      env: {
        development: { ...defaults.env?.development, ...rawConfig.env?.development },
        production: { ...defaults.env?.production, ...rawConfig.env?.production },
        preview: { ...defaults.env?.preview, ...rawConfig.env?.preview },
      },
      dev: { ...defaults.dev, ...rawConfig.dev },
      deploy: { ...defaults.deploy, ...rawConfig.deploy },
      test: { ...defaults.test, ...rawConfig.test },
      monitoring: { ...defaults.monitoring, ...rawConfig.monitoring },
      cli: { ...defaults.cli, ...rawConfig.cli },
    } as RawConfig;

    // Load environment variables
    const envVars = loadEnvironment(environment);

    // Apply environment-specific overrides
    const env = environment ?? process.env.NODE_ENV ?? 'development';
    const envConfig = merged.env?.[env as keyof typeof merged.env];

    if (envConfig) {
      merged.deploy = {
        ...merged.deploy,
        vars: {
          ...merged.deploy?.vars,
          ...envConfig,
        },
      };
    }

    // Validate and normalize
    this.loadedConfig = normalizeConfig(merged);

    return this.loadedConfig;
  }

  /**
   * Reload configuration
   */
  async reload(environment?: string): Promise<Config> {
    this.loadedConfig = undefined;
    return this.load(environment);
  }

  /**
   * Get loaded config without loading
   */
  getConfig(): Config | undefined {
    return this.loadedConfig;
  }

  /**
   * Get project directory
   */
  getProjectDir(): string {
    return this.projectDir;
  }

  /**
   * Get config file path
   */
  getConfigPath(): string | undefined {
    return this.configPath;
  }
}

/**
 * Load config helper function
 */
export async function loadConfig(
  projectDir?: string,
  environment?: string
): Promise<Config> {
  const loader = new ConfigLoader(projectDir);
  return loader.load(environment);
}

/**
 * Verify config file exists
 */
export function verifyConfigFile(projectDir: string = cwd()): void {
  const configPath = resolve(projectDir, 'claudeflare.config.ts');

  if (!existsSync(configPath)) {
    throw new ConfigError(
      'Configuration file not found',
      [
        `Expected: ${configPath}`,
        'Run: claudeflare init',
      ]
    );
  }
}
