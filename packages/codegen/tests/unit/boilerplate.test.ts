/**
 * Unit tests for Boilerplate Generator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoilerplateGenerator } from '../../src/boilerplate/generator';
import { Language } from '../../src/types/index';
import { readFile } from 'fs/promises';

// Mock file manager
vi.mock('../../src/utils/file-manager', () => ({
  FileManager: class {
    async ensureDir() {}
    async writeFile() {}
    dirname(path: string) { return path; }
  }
}));

describe('BoilerplateGenerator', () => {
  let generator: BoilerplateGenerator;

  beforeEach(() => {
    generator = new BoilerplateGenerator();
  });

  describe('generate', () => {
    it('should generate Express TypeScript project', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp',
        config: {
          gitInit: false,
          installDeps: false,
          createReadme: true,
          createLicense: false
        }
      });

      expect(result.projectName).toBe('test-project');
      expect(result.filesCreated).toBeDefined();
      expect(result.filesCreated.length).toBeGreaterThan(0);
      expect(result.commands).toBeDefined();
      expect(result.nextSteps).toBeDefined();
    });

    it('should generate React TypeScript project', async () => {
      const result = await generator.generate({
        name: 'react-app',
        template: 'react-ts',
        outputPath: '/tmp',
        config: {
          gitInit: false,
          createReadme: true
        }
      });

      expect(result.projectName).toBe('react-app');
      expect(result.filesCreated.length).toBeGreaterThan(0);
    });

    it('should generate Python FastAPI project', async () => {
      const result = await generator.generate({
        name: 'fastapi-server',
        template: 'python-fastapi',
        outputPath: '/tmp',
        config: {
          gitInit: false,
          createReadme: true
        }
      });

      expect(result.projectName).toBe('fastapi-server');
      expect(result.filesCreated.length).toBeGreaterThan(0);
    });

    it('should generate Go service project', async () => {
      const result = await generator.generate({
        name: 'go-service',
        template: 'go-service',
        outputPath: '/tmp',
        config: {
          gitInit: false,
          createReadme: true
        }
      });

      expect(result.projectName).toBe('go-service');
      expect(result.filesCreated.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid template', async () => {
      await expect(generator.generate({
        name: 'test',
        template: 'invalid-template',
        outputPath: '/tmp'
      })).rejects.toThrow();
    });
  });

  describe('template loading', () => {
    it('should load all available templates', () => {
      const templates = generator['getAvailableTemplates']();

      expect(templates).toHaveProperty('express-ts');
      expect(templates).toHaveProperty('react-ts');
      expect(templates).toHaveProperty('python-fastapi');
      expect(templates).toHaveProperty('go-service');
    });

    it('should have correct template structure', () => {
      const templates = generator['getAvailableTemplates']();
      const expressTemplate = templates['express-ts'];

      expect(expressTemplate.name).toBeDefined();
      expect(expressTemplate.description).toBeDefined();
      expect(expressTemplate.type).toBeDefined();
      expect(expressTemplate.language).toBe(Language.TypeScript);
      expect(expressTemplate.files).toBeInstanceOf(Array);
      expect(expressTemplate.dependencies).toBeDefined();
      expect(expressTemplate.scripts).toBeDefined();
    });
  });

  describe('file generation', () => {
    it('should generate package.json for Node.js projects', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp'
      });

      const packageJsonFile = result.filesCreated.find(f => f.endsWith('package.json'));
      expect(packageJsonFile).toBeDefined();
    });

    it('should generate README when requested', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp',
        config: {
          createReadme: true
        }
      });

      const readmeFile = result.filesCreated.find(f => f.endsWith('README.md'));
      expect(readmeFile).toBeDefined();
    });

    it('should generate LICENSE when requested', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp',
        config: {
          createLicense: true
        }
      });

      const licenseFile = result.filesCreated.find(f => f.endsWith('LICENSE'));
      expect(licenseFile).toBeDefined();
    });
  });

  describe('setup commands', () => {
    it('should generate npm commands for Node.js projects', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp'
      });

      expect(result.commands).toContain('cd test-project');
      expect(result.commands.some(c => c.includes('npm'))).toBe(true);
    });

    it('should generate Python commands for Python projects', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'python-fastapi',
        outputPath: '/tmp'
      });

      expect(result.commands).toContain('cd test-project');
      expect(result.commands.some(c => c.includes('venv'))).toBe(true);
    });

    it('should generate Go commands for Go projects', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'go-service',
        outputPath: '/tmp'
      });

      expect(result.commands).toContain('cd test-project');
      expect(result.commands.some(c => c.includes('go'))).toBe(true);
    });
  });

  describe('next steps', () => {
    it('should provide helpful next steps', async () => {
      const result = await generator.generate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp'
      });

      expect(result.nextSteps).toBeDefined();
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('cd test-project');
    });
  });
});
