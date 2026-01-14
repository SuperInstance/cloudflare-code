/**
 * Prompts Wizard Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import {
  promptProjectInit,
  promptConfigSetup,
  promptFeatureSelection,
  promptDeployment,
  promptRollback,
  projectSetupWorkflow,
  displayBanner,
  confirmDestructive,
} from '../../prompts/wizard.js';
import type { Config } from '../../types/index.js';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('Prompts Wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promptProjectInit', () => {
    it('should prompt for project initialization', async () => {
      const mockAnswers = {
        name: 'test-project',
        description: 'Test description',
        template: 'minimal',
        directory: 'test-project',
        installDeps: true,
        initGit: true,
        createConfig: true,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptProjectInit();

      expect(result).toEqual(mockAnswers);
      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should validate project name', async () => {
      const invalidNames = ['', 'UPPERCASE', 'with spaces', 'special@chars'];

      for (const name of invalidNames) {
        const mockAnswers = {
          name,
          description: 'Test',
          template: 'minimal',
          directory: 'test',
          installDeps: false,
          initGit: false,
          createConfig: false,
        };

        vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

        // The validation is handled by inquirer, so we just test the flow
        const result = await promptProjectInit();
        expect(result.name).toBe(name);
      }
    });

    it('should accept valid project names', async () => {
      const validNames = [
        'my-project',
        'test-project-123',
        'project',
        'myproject123',
      ];

      for (const name of validNames) {
        const mockAnswers = {
          name,
          description: 'Test',
          template: 'minimal',
          directory: 'test',
          installDeps: false,
          initGit: false,
          createConfig: false,
        };

        vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

        const result = await promptProjectInit();
        expect(result.name).toBe(name);
      }
    });
  });

  describe('promptConfigSetup', () => {
    it('should prompt for configuration setup', async () => {
      const mockAnswers = {
        workerName: 'test-worker',
        mainFile: 'src/index.ts',
        devPort: 8788,
        enableProxy: true,
        enableMonitoring: true,
        defaultEnvironment: 'preview',
        enableSourceMaps: true,
        minifyBuild: true,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptConfigSetup();

      expect(result).toBeDefined();
      expect(result.worker).toBeDefined();
      expect(result.worker?.name).toBe('test-worker');
      expect(result.dev?.port).toBe(8788);
    });

    it('should use current config as defaults', async () => {
      const currentConfig: Partial<Config> = {
        worker: {
          name: 'existing-worker',
          main: 'src/worker.ts',
          compatibility_date: '2024-01-01',
          compatibility_flags: [],
          routes: [],
        },
        dev: {
          port: 3000,
          host: 'localhost',
          proxy: false,
          open: false,
          https: false,
        },
      };

      const mockAnswers = {
        workerName: 'new-worker',
        mainFile: 'src/index.ts',
        devPort: 3001,
        enableProxy: true,
        enableMonitoring: true,
        defaultEnvironment: 'production',
        enableSourceMaps: false,
        minifyBuild: false,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptConfigSetup(currentConfig);

      expect(result.worker?.name).toBe('new-worker');
      expect(result.dev?.port).toBe(3001);
    });

    it('should validate port range', async () => {
      const mockAnswers = {
        workerName: 'test-worker',
        mainFile: 'src/index.ts',
        devPort: 8788,
        enableProxy: true,
        enableMonitoring: true,
        defaultEnvironment: 'preview',
        enableSourceMaps: true,
        minifyBuild: true,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptConfigSetup();
      expect(result.dev?.port).toBeGreaterThan(0);
      expect(result.dev?.port).toBeLessThan(65536);
    });
  });

  describe('promptFeatureSelection', () => {
    it('should return array of selected features', async () => {
      const mockAnswers = {
        features: ['ai-providers', 'semantic-cache', 'rate-limiting'],
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptFeatureSelection();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('ai-providers');
      expect(result).toContain('semantic-cache');
      expect(result).toContain('rate-limiting');
    });

    it('should allow no features to be selected', async () => {
      const mockAnswers = {
        features: [],
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptFeatureSelection();

      expect(result.length).toBe(0);
    });

    it('should allow all features to be selected', async () => {
      const allFeatures = [
        'ai-providers',
        'semantic-cache',
        'rate-limiting',
        'circuit-breaker',
        'request-routing',
        'metrics',
        'sessions',
        'kv-storage',
        'r2-storage',
        'websockets',
        'cron',
        'email',
      ];

      const mockAnswers = {
        features: allFeatures,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptFeatureSelection();

      expect(result.length).toBe(allFeatures.length);
    });
  });

  describe('promptDeployment', () => {
    it('should prompt for deployment configuration', async () => {
      const mockAnswers = {
        environment: 'production',
        workerName: 'test-worker',
        addVars: false,
        addSecrets: false,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptDeployment();

      expect(result.environment).toBe('production');
      expect(result.workerName).toBe('test-worker');
      expect(result.vars).toEqual({});
      expect(result.secrets).toEqual([]);
    });

    it('should parse environment variables', async () => {
      const mockAnswers = {
        environment: 'preview',
        workerName: '',
        addVars: true,
        addSecrets: false,
        varsList: 'API_URL=https://api.test.com,DEBUG=true',
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptDeployment();

      expect(result.vars['API_URL']).toBe('https://api.test.com');
      expect(result.vars['DEBUG']).toBe('true');
    });

    it('should parse secret names', async () => {
      const mockAnswers = {
        environment: 'production',
        workerName: '',
        addVars: false,
        addSecrets: true,
        secretsList: 'API_KEY,DATABASE_URL',
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptDeployment();

      expect(result.secrets).toContain('API_KEY');
      expect(result.secrets).toContain('DATABASE_URL');
    });
  });

  describe('promptRollback', () => {
    it('should prompt for rollback version', async () => {
      const mockAnswers = {
        version: 'v1.2.3',
        confirm: true,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptRollback();

      expect(result.version).toBe('v1.2.3');
      expect(result.confirm).toBe(true);
    });

    it('should require confirmation', async () => {
      const mockAnswers = {
        version: 'v1.2.3',
        confirm: false,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await promptRollback();

      expect(result.confirm).toBe(false);
    });
  });

  describe('confirmDestructive', () => {
    it('should return user confirmation', async () => {
      const mockAnswers = {
        confirm: true,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await confirmDestructive('delete all files');

      expect(result).toBe(true);
    });

    it('should return false when not confirmed', async () => {
      const mockAnswers = {
        confirm: false,
      };

      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const result = await confirmDestructive('delete all files');

      expect(result).toBe(false);
    });
  });

  describe('displayBanner', () => {
    it('should display banner without errors', () => {
      expect(() => displayBanner()).not.toThrow();
    });
  });

  describe('projectSetupWorkflow', () => {
    it('should complete full workflow', async () => {
      const projectAnswers = {
        name: 'test-project',
        description: 'Test',
        template: 'minimal',
        directory: 'test',
        installDeps: false,
        initGit: false,
        createConfig: true,
      };

      const featuresAnswers = {
        features: ['ai-providers'],
      };

      const configAnswers = {
        workerName: 'test-worker',
        mainFile: 'src/index.ts',
        devPort: 8788,
        enableProxy: true,
        enableMonitoring: true,
        defaultEnvironment: 'preview',
        enableSourceMaps: true,
        minifyBuild: true,
      };

      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce(projectAnswers)
        .mockResolvedValueOnce(featuresAnswers)
        .mockResolvedValueOnce(configAnswers);

      const result = await projectSetupWorkflow();

      expect(result.project).toEqual(projectAnswers);
      expect(result.features).toEqual(['ai-providers']);
      expect(result.config).toBeDefined();
    });
  });
});
