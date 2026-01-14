/**
 * Scaffolding Generator Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import temp from 'temp';
import { generateProject, getAvailableTemplates } from '../../scaffolding/generator.js';

// Track temp directories
const tempDirs = new Set<string>();

describe('Scaffolding Generator', () => {
  beforeEach(() => {
    // Track temp directories for cleanup
    temp.track();
  });

  afterEach(async () => {
    // Clean up temp directories
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    tempDirs.clear();
  });

  describe('getAvailableTemplates', () => {
    it('should return an array of templates', async () => {
      const templates = await getAvailableTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should include required template properties', async () => {
      const templates = await getAvailableTemplates();

      for (const template of templates) {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('path');
        expect(template).toHaveProperty('features');
        expect(Array.isArray(template.features)).toBe(true);
      }
    });

    it('should include expected templates', async () => {
      const templates = await getAvailableTemplates();
      const templateNames = templates.map((t) => t.name);

      expect(templateNames).toContain('minimal');
      expect(templateNames).toContain('standard');
      expect(templateNames).toContain('full');
    });
  });

  describe('generateProject', () => {
    it('should create project directory', async () => {
      const tempDir = temp.mkdirSync();
      tempDirs.add(tempDir);

      await generateProject({
        name: 'test-project',
        description: 'Test project description',
        template: 'minimal',
        directory: join(tempDir, 'test-project'),
        installDeps: false,
        initGit: false,
        createConfig: true,
        features: [],
      });

      const projectDir = join(tempDir, 'test-project');
    const stats = await fs.stat(projectDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should create src directory', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const srcDir = join(tempDir, 'test-project', 'src');
    const stats = await fs.stat(srcDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should create main worker file', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const workerFile = join(tempDir, 'test-project', 'src', 'index.ts');
    const content = await fs.readFile(workerFile, 'utf-8');

    expect(content).toContain('export default');
    expect(content).toContain('fetch');
  });

  it('should create package.json', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const packageJsonPath = join(tempDir, 'test-project', 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    expect(pkg.name).toBe('test-project');
    expect(pkg.description).toBe('Test project description');
    expect(pkg).toHaveProperty('scripts');
    expect(pkg.scripts).toHaveProperty('dev');
    expect(pkg.scripts).toHaveProperty('build');
    expect(pkg.scripts).toHaveProperty('deploy');
  });

  it('should create tsconfig.json', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const tsconfigPath = join(tempDir, 'test-project', 'tsconfig.json');
    const content = await fs.readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);

    expect(tsconfig).toHaveProperty('compilerOptions');
    expect(tsconfig.compilerOptions).toHaveProperty('target');
    expect(tsconfig.compilerOptions).toHaveProperty('module');
  });

  it('should create claudeflare.config.ts', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const configFile = join(tempDir, 'test-project', 'claudeflare.config.ts');
    const content = await fs.readFile(configFile, 'utf-8');

    expect(content).toContain('test-project');
    expect(content).toContain('Test project description');
  });

  it('should create .gitignore', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const gitignorePath = join(tempDir, 'test-project', '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');

    expect(content).toContain('node_modules');
    expect(content).toContain('dist');
    expect(content).toContain('.env');
  });

  it('should create README.md', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const readmePath = join(tempDir, 'test-project', 'README.md');
    const content = await fs.readFile(readmePath, 'utf-8');

    expect(content).toContain('# test-project');
    expect(content).toContain('Test project description');
  });

  it('should create .env.example', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const envExamplePath = join(tempDir, 'test-project', '.env.example');
    const content = await fs.readFile(envExamplePath, 'utf-8');

    expect(content).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(content).toContain('ENVIRONMENT');
  });

  it('should initialize git repository when requested', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: true,
      createConfig: true,
      features: [],
    });

    const gitDir = join(tempDir, 'test-project', '.git');
    const stats = await fs.stat(gitDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should not initialize git repository when not requested', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: [],
    });

    const gitDir = join(tempDir, 'test-project', '.git');

    await expect(fs.stat(gitDir)).rejects.toThrow();
  });

  it('should include routing feature when specified', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: ['routing'],
    });

    const workerFile = join(tempDir, 'test-project', 'src', 'index.ts');
    const content = await fs.readFile(workerFile, 'utf-8');

    expect(content).toContain('Router');
  });

  it('should include AI providers feature when specified', async () => {
    const tempDir = temp.mkdirSync();
    tempDirs.add(tempDir);

    await generateProject({
      name: 'test-project',
      description: 'Test project description',
      template: 'minimal',
      directory: join(tempDir, 'test-project'),
      installDeps: false,
      initGit: false,
      createConfig: true,
      features: ['ai-providers'],
    });

    const workerFile = join(tempDir, 'test-project', 'src', 'index.ts');
    const content = await fs.readFile(workerFile, 'utf-8');

    expect(content).toContain('AIProviderRouter');
  });
});
