/**
 * Integration tests for IaC generator
 */

import { describe, it, expect } from 'vitest';
import { IaCGenerator } from '../../src/iac/generator';
import { IaCConfig } from '../../src/types';
import { Logger } from '../../src/utils/logger';

describe('IaCGenerator Integration Tests', () => {
  let generator: IaCGenerator;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ service: 'test', level: 'error' });
    generator = new IaCGenerator(logger);
  });

  describe('Terraform generation', () => {
    it('should generate complete Terraform configuration', async () => {
      const config: IaCConfig = {
        type: 'terraform',
        version: '1.0.0',
        backend: {
          type: 's3',
          config: {
            bucket: 'my-terraform-state',
            key: 'claudeflare/terraform.tfstate',
            region: 'us-east-1',
          },
        },
        providers: [
          {
            name: 'aws',
            version: '5.0.0',
            configuration: {
              region: 'us-east-1',
            },
          },
          {
            name: 'cloudflare',
            version: '4.0.0',
            configuration: {
              api_token: 'test-token',
              account_id: 'test-account',
            },
          },
        ],
        variables: {
          environment: 'production',
          project_name: 'claudeflare',
          region: 'us-east-1',
        },
        outputs: ['instance_id', 'instance_ip'],
      };

      const result = await generator.generate({
        config,
        validate: true,
        formatOutput: true,
      });

      expect(result.success).toBe(true);
      expect(result.files).toContain('main.tf');
      expect(result.files).toContain('variables.tf');
      expect(result.files).toContain('outputs.tf');
      expect(result.files).toContain('providers.tf');
      expect(result.files).toContain('terraform.tfvars');
    });

    it('should include cost estimate', async () => {
      const config: IaCConfig = {
        type: 'terraform',
        providers: [
          {
            name: 'aws',
            version: '5.0.0',
            configuration: {
              region: 'us-east-1',
              instance_count: 3,
              s3_storage_gb: 100,
            },
          },
        ],
        variables: {},
        outputs: [],
      };

      const result = await generator.generate({ config });

      expect(result.success).toBe(true);
      expect(result.costEstimate).toBeDefined();
      expect(result.costEstimate?.currency).toBe('USD');
      expect(result.costEstimate?.total).toBeGreaterThan(0);
      expect(result.costEstimate?.breakdown.length).toBeGreaterThan(0);
    });
  });

  describe('Kubernetes generation', () => {
    it('should generate complete Kubernetes manifests', async () => {
      const config: IaCConfig = {
        type: 'kubernetes',
        variables: {
          namespace: 'production',
          appName: 'claudeflare-app',
          replicas: 3,
          image: 'claudeflare/app:latest',
          containerPort: 8080,
          servicePort: 80,
          serviceType: 'LoadBalancer',
          ingressEnabled: true,
          ingressHost: 'app.claudeflare.io',
          tlsEnabled: true,
          enableHpa: true,
          hpaMinReplicas: 2,
          hpaMaxReplicas: 10,
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '500m',
              memory: '512Mi',
            },
          },
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({
        config,
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.files).toContain('namespace.yaml');
      expect(result.files).toContain('deployment.yaml');
      expect(result.files).toContain('service.yaml');
      expect(result.files).toContain('configmap.yaml');
      expect(result.files).toContain('ingress.yaml');
      expect(result.files).toContain('hpa.yaml');
    });

    it('should generate valid YAML manifests', async () => {
      const config: IaCConfig = {
        type: 'kubernetes',
        variables: {
          namespace: 'default',
          appName: 'test-app',
          replicas: 2,
          image: 'nginx:latest',
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({ config });

      expect(result.success).toBe(true);

      // Verify deployment manifest structure
      const deploymentYaml = result.files['deployment.yaml'] || '';
      expect(deploymentYaml).toContain('apiVersion: apps/v1');
      expect(deploymentYaml).toContain('kind: Deployment');
      expect(deploymentYaml).toContain('name: test-app');
    });
  });

  describe('Cloudflare generation', () => {
    it('should generate Cloudflare Worker configuration', async () => {
      const config: IaCConfig = {
        type: 'cloudflare',
        variables: {
          accountId: 'test-account-id',
          appName: 'claudeflare-worker',
          enableAI: true,
          kvNamespaces: ['cache', 'sessions'],
          r2Buckets: ['assets', 'uploads'],
          durableObjects: [
            {
              name: 'counter',
              className: 'CounterDurableObject',
            },
          ],
          triggers: ['*/5 * * * *'],
          env: {
            ENVIRONMENT: 'production',
            API_ENDPOINT: 'https://api.example.com',
          },
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({
        config,
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.files).toContain('wrangler.toml');
      expect(result.files).toContain('worker.js');
      expect(result.files).toContain('deployment.yaml');
    });

    it('should include cost estimate for Cloudflare resources', async () => {
      const config: IaCConfig = {
        type: 'cloudflare',
        variables: {
          accountId: 'test-account',
          appName: 'worker',
          workers_requests: 10000000,
          workers_cpu_ms: 1000000,
          kv_storage_gb: 5,
          r2_storage_gb: 500,
          durable_objects: 10,
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({ config });

      expect(result.success).toBe(true);
      expect(result.costEstimate).toBeDefined();
      expect(result.costEstimate?.breakdown.length).toBeGreaterThan(0);

      const breakdown = result.costEstimate?.breakdown || [];
      expect(breakdown.some((b) => b.resource.includes('Workers'))).toBe(true);
      expect(breakdown.some((b) => b.resource.includes('KV'))).toBe(true);
      expect(breakdown.some((b) => b.resource.includes('R2'))).toBe(true);
    });
  });

  describe('Helm generation', () => {
    it('should generate complete Helm chart', async () => {
      const config: IaCConfig = {
        type: 'helm',
        variables: {
          appName: 'claudeflare',
          chartVersion: '1.0.0',
          appVersion: '1.0.0',
          replicas: 3,
          imageRepository: 'claudeflare/app',
          imageTag: 'latest',
          serviceType: 'ClusterIP',
          servicePort: 80,
          containerPort: 8080,
          ingressEnabled: true,
          ingressHost: 'app.claudeflare.io',
          enableHpa: true,
          hpaMinReplicas: 2,
          hpaMaxReplicas: 10,
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({
        config,
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.files).toContain('Chart.yaml');
      expect(result.files).toContain('values.yaml');
      expect(result.files).toContain('templates/deployment.yaml');
      expect(result.files).toContain('templates/service.yaml');
      expect(result.files).toContain('templates/ingress.yaml');
      expect(result.files).toContain('templates/_helpers.tpl');
    });

    it('should generate valid Chart.yaml', async () => {
      const config: IaCConfig = {
        type: 'helm',
        variables: {
          appName: 'test-app',
          chartVersion: '0.1.0',
          appVersion: '1.0.0',
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({ config });

      expect(result.success).toBe(true);

      const chartYaml = result.files['Chart.yaml'] || '';
      expect(chartYaml).toContain('apiVersion: v2');
      expect(chartYaml).toContain('name: test-app');
      expect(chartYaml).toContain('version: 0.1.0');
    });
  });

  describe('validation', () => {
    it('should validate configuration before generation', async () => {
      const config: IaCConfig = {
        type: 'kubernetes',
        variables: {
          // Missing required namespace
          appName: 'test-app',
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({
        config,
        validate: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('cost estimation', () => {
    it('should estimate costs for different IaC types', async () => {
      const types = ['terraform', 'kubernetes', 'cloudflare'] as const;

      for (const type of types) {
        const config: IaCConfig = {
          type,
          variables: {
            appName: 'test-app',
            namespace: 'default',
            accountId: 'test-account',
          },
          providers: [],
          outputs: [],
        };

        const result = await generator.generate({ config });

        expect(result.success).toBe(true);
        expect(result.costEstimate).toBeDefined();
        expect(result.costEstimate?.currency).toBe('USD');
        expect(result.costEstimate?.total).toBeGreaterThanOrEqual(0);
      }
    });

    it('should provide detailed cost breakdown', async () => {
      const config: IaCConfig = {
        type: 'cloudflare',
        variables: {
          accountId: 'test-account',
          appName: 'worker',
          workers_requests: 1000000,
          kv_storage_gb: 10,
        },
        providers: [],
        outputs: [],
      };

      const result = await generator.generate({ config });

      expect(result.costEstimate?.breakdown).toBeDefined();

      const breakdown = result.costEstimate?.breakdown || [];
      breakdown.forEach((item) => {
        expect(item.resource).toBeDefined();
        expect(item.amount).toBeGreaterThanOrEqual(0);
        expect(item.unit).toBe('USD');
        expect(item.quantity).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
