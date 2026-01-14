/**
 * Edge Deployer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EdgeDeployer } from '../../src/edge/deployer.js';
import type { IDeploymentConfig, IEdgeFunction } from '../../src/types/index.js';

describe('EdgeDeployer', () => {
  let deployer: EdgeDeployer;

  beforeEach(() => {
    deployer = new EdgeDeployer({
      dryRun: true,
      skipTests: true,
      verbose: false
    });
  });

  describe('Configuration', () => {
    it('should configure Cloudflare', () => {
      deployer.configureCloudflare({
        apiKey: 'test-key',
        email: 'test@example.com',
        accountId: 'test-account',
        zoneId: 'test-zone'
      });

      expect(deployer['cloudflareAPI']).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate deployment config', () => {
      const config: IDeploymentConfig = {
        id: 'test-deployment',
        version: '1.0.0',
        functions: [{
          name: 'test-function',
          content: 'export default { fetch() {} }',
          type: 'worker',
          routes: ['/test'],
          environment: {},
          bindings: [],
          enabled: true
        }],
        assets: [{
          path: '/test.txt',
          content: 'test',
          contentType: 'text/plain'
        }],
        routes: [{
          pattern: '/test',
          functionName: 'test-function'
        }],
        environment: {},
        strategy: 'rolling'
      };

      const result = deployer.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing function names', () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [{
          name: '',
          content: 'code',
          type: 'worker',
          routes: [],
          environment: {},
          bindings: [],
          enabled: true
        }],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      const result = deployer.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should detect missing function content', () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [{
          name: 'test',
          content: '',
          type: 'worker',
          routes: [],
          environment: {},
          bindings: [],
          enabled: true
        }],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      const result = deployer.validateConfig(config);

      expect(result.valid).toBe(false);
    });

    it('should detect invalid rate limits', () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [],
        assets: [],
        routes: [{
          pattern: '/test',
          rateLimit: -1
        }],
        environment: {},
        strategy: 'rolling'
      };

      const result = deployer.validateConfig(config);

      expect(result.valid).toBe(false);
    });
  });

  describe('Deployment', () => {
    it('should deploy in dry run mode', async () => {
      const config: IDeploymentConfig = {
        id: 'test-deployment',
        version: '1.0.0',
        functions: [{
          name: 'test-function',
          content: 'export default { fetch() { return new Response("Hello"); } }',
          type: 'worker',
          routes: ['/test'],
          environment: {},
          bindings: [],
          enabled: true
        }],
        assets: [],
        routes: [{
          pattern: '/test',
          functionName: 'test-function'
        }],
        environment: {},
        strategy: 'rolling'
      };

      const result = await deployer.deploy(config);

      expect(result.deploymentId).toBeDefined();
      expect(result.functions).toBe(1);
    });

    it('should handle deployment with multiple functions', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [
          {
            name: 'func1',
            content: 'code1',
            type: 'worker',
            routes: ['/func1'],
            environment: {},
            bindings: [],
            enabled: true
          },
          {
            name: 'func2',
            content: 'code2',
            type: 'worker',
            routes: ['/func2'],
            environment: {},
            bindings: [],
            enabled: true
          }
        ],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      const result = await deployer.deploy(config);

      expect(result.functions).toBe(2);
    });

    it('should handle deployment with assets', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [],
        assets: [
          {
            path: '/style.css',
            content: 'body { margin: 0; }',
            contentType: 'text/css'
          },
          {
            path: '/app.js',
            content: 'console.log("test");',
            contentType: 'application/javascript'
          }
        ],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      const result = await deployer.deploy(config);

      expect(result.assets).toBe(2);
    });
  });

  describe('Deployment Status', () => {
    it('should track deployment status', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [{
          name: 'test',
          content: 'code',
          type: 'worker',
          routes: [],
          environment: {},
          bindings: [],
          enabled: true
        }],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      const result = await deployer.deploy(config);
      const status = deployer.getDeploymentStatus(result.deploymentId);

      expect(status).toBeDefined();
    });

    it('should get deployment by ID', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      const result = await deployer.deploy(config);
      const deployment = deployer.getDeployment(result.deploymentId);

      expect(deployment).toBeDefined();
      expect(deployment?.deploymentId).toBe(result.deploymentId);
    });

    it('should list deployments', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      await deployer.deploy(config);

      const deployments = deployer.listDeployments();

      expect(deployments.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should provide deployment statistics', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      await deployer.deploy(config);

      const stats = deployer.getStatistics();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('success');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('avgDuration');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old deployments', async () => {
      const config: IDeploymentConfig = {
        id: 'test',
        version: '1.0.0',
        functions: [],
        assets: [],
        routes: [],
        environment: {},
        strategy: 'rolling'
      };

      await deployer.deploy(config);

      const cleaned = await deployer.cleanup(0); // Clean all

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
});
