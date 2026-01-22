/**
 * Unit tests for Agent Builder
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentBuilder, AgentFactory } from '../../src/agents/builder';
import { AgentCategory, AgentCapability, AgentPermission } from '../../src/types';

describe('AgentBuilder', () => {
  let builder: AgentBuilder;

  beforeEach(() => {
    builder = new AgentBuilder({
      name: 'Test Agent',
      description: 'A test agent',
      category: AgentCategory.CODE_ASSISTANT
    });
  });

  describe('Configuration', () => {
    it('should create builder with initial config', () => {
      expect(builder).toBeDefined();
    });

    it('should set description', () => {
      builder.withDescription('Updated description');
      const agent = builder['createAgent']();
      expect(agent.config.description).toBe('Updated description');
    });

    it('should set version', () => {
      builder.withVersion('2.0.0');
      const agent = builder['createAgent']();
      expect(agent.metadata.version).toBe('2.0.0');
    });

    it('should add capability', () => {
      builder.withCapability(AgentCapability.CODE_GENERATION);
      const agent = builder['createAgent']();
      expect(agent.config.capabilities).toContain(AgentCapability.CODE_GENERATION);
    });

    it('should add capabilities', () => {
      builder.withCapabilities([
        AgentCapability.CODE_GENERATION,
        AgentCapability.TEXT_GENERATION
      ]);
      const agent = builder['createAgent']();
      expect(agent.config.capabilities).toContain(AgentCapability.CODE_GENERATION);
      expect(agent.config.capabilities).toContain(AgentCapability.TEXT_GENERATION);
    });

    it('should add permission', () => {
      builder.withPermission(AgentPermission.READ);
      const agent = builder['createAgent']();
      expect(agent.config.permissions).toContain(AgentPermission.READ);
    });

    it('should add settings', () => {
      builder.withSetting('key', 'value');
      const agent = builder['createAgent']();
      expect(agent.config.settings?.key).toBe('value');
    });
  });

  describe('Tool Management', () => {
    it('should add tool', () => {
      builder.addTool('test-tool', 'Test tool', 'testHandler');
      expect(builder['tools'].length).toBe(1);
      expect(builder['tools'][0].name).toBe('test-tool');
    });

    it('should add multiple tools', () => {
      builder.addTool('tool1', 'Tool 1', 'handler1');
      builder.addTool('tool2', 'Tool 2', 'handler2');
      expect(builder['tools'].length).toBe(2);
    });

    it('should add file tool', () => {
      builder.addFileTool('file-read', true, false);
      const tool = builder['tools'][0];
      expect(tool.name).toBe('file-read');
      expect(tool.permissions).toContain(AgentPermission.READ);
    });

    it('should add API tool', () => {
      builder.addApiTool('api-call', 'https://api.example.com', 'GET');
      const tool = builder['tools'][0];
      expect(tool.name).toBe('api-call');
      expect(tool.permissions).toContain(AgentPermission.NETWORK);
    });
  });

  describe('Prompt Management', () => {
    it('should add prompt', () => {
      builder.withPrompt('custom', {
        system: 'Custom system prompt',
        user: 'Custom user prompt'
      });
      expect(builder['prompts'].custom).toBeDefined();
      expect(builder['prompts'].custom.system).toBe('Custom system prompt');
    });

    it('should add multiple prompts', () => {
      builder.withPrompts({
        prompt1: { system: 'System 1' },
        prompt2: { system: 'System 2' }
      });
      expect(builder['prompts'].prompt1).toBeDefined();
      expect(builder['prompts'].prompt2).toBeDefined();
    });
  });

  describe('Building', () => {
    it('should build agent successfully', async () => {
      const result = await builder.build();
      expect(result.success).toBe(true);
      expect(result.agent).toBeDefined();
      expect(result.agent.config.name).toBe('Test Agent');
    });

    it('should generate code if not provided', async () => {
      const result = await builder.build();
      expect(result.agent.code).toBeDefined();
      expect(result.agent.code).toContain('class');
    });

    it('should use provided code', async () => {
      const customCode = 'export const test = true;';
      builder.withCode(customCode);
      const result = await builder.build();
      expect(result.agent.code).toBe(customCode);
    });

    it('should track build metrics', async () => {
      const result = await builder.build();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.buildTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.dependencies).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate configuration', async () => {
      const result = await builder.build();
      expect(result.success).toBe(true);
    });

    it('should fail without name', async () => {
      const invalidBuilder = new AgentBuilder({
        name: '',
        description: 'Test',
        category: AgentCategory.CUSTOM
      });
      const result = await invalidBuilder.build();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Serialization', () => {
    it('should convert to JSON', () => {
      const json = builder.toJSON();
      expect(json).toHaveProperty('config');
      expect(json).toHaveProperty('tools');
      expect(json).toHaveProperty('prompts');
    });

    it('should create from JSON', () => {
      const json = builder.toJSON();
      const restored = AgentBuilder.fromJSON(json);
      expect(restored).toBeInstanceOf(AgentBuilder);
    });
  });
});

describe('AgentFactory', () => {
  it('should create builder from template', () => {
    const builder = AgentFactory.createFromTemplate('code-assistant-basic', {
      name: 'Custom Agent'
    });
    expect(builder).toBeInstanceOf(AgentBuilder);
  });

  it('should create builder from config', () => {
    const config = {
      name: 'Test',
      description: 'Test agent',
      version: '1.0.0',
      category: AgentCategory.CODE_ASSISTANT,
      capabilities: [AgentCapability.CODE_GENERATION],
      permissions: [AgentPermission.READ],
      tools: [],
      prompts: {},
      settings: {}
    };

    const builder = AgentFactory.createFromConfig(config);
    expect(builder).toBeInstanceOf(AgentBuilder);
  });

  it('should create builder from code', () => {
    const code = 'export const agent = {}';
    const builder = AgentFactory.createFromCode(code);
    expect(builder).toBeInstanceOf(AgentBuilder);
  });
});
