/**
 * Unit tests for validator
 */

import { describe, it, expect } from 'vitest';
import { Validator } from '../../src/utils/validator';
import { Logger } from '../../src/utils/logger';

describe('Validator', () => {
  let validator: Validator;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ service: 'test', level: 'error' });
    validator = new Validator(logger);
  });

  describe('validateManifest', () => {
    it('should validate a valid deployment manifest', async () => {
      const manifest = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default',
        },
        spec: {
          replicas: 3,
          selector: {
            matchLabels: {
              app: 'test',
            },
          },
          template: {
            metadata: {
              labels: {
                app: 'test',
              },
            },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: 'nginx:latest',
                },
              ],
            },
          },
        },
      };

      const errors = await validator.validateManifest(manifest);
      expect(errors).toHaveLength(0);
    });

    it('should reject deployment without required fields', async () => {
      const manifest = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
        },
        spec: {},
      };

      const errors = await validator.validateManifest(manifest);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject deployment with invalid resource name', async () => {
      const manifest = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'Invalid_Name',
          namespace: 'default',
        },
        spec: {
          replicas: 3,
          selector: {
            matchLabels: {
              app: 'test',
            },
          },
          template: {
            metadata: {
              labels: {
                app: 'test',
              },
            },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: 'nginx:latest',
                },
              ],
            },
          },
        },
      };

      const errors = await validator.validateManifest(manifest);
      expect(errors.some((e) => e.includes('lowercase alphanumeric'))).toBe(
        true
      );
    });

    it('should validate a valid service manifest', async () => {
      const manifest = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'test-service',
          namespace: 'default',
        },
        spec: {
          selector: {
            app: 'test',
          },
          ports: [
            {
              port: 80,
              targetPort: 8080,
            },
          ],
        },
      };

      const errors = await validator.validateManifest(manifest);
      expect(errors).toHaveLength(0);
    });

    it('should validate a valid ingress manifest', async () => {
      const manifest = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'test-ingress',
          namespace: 'default',
        },
        spec: {
          rules: [
            {
              host: 'example.com',
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: 'test-service',
                        port: {
                          number: 80,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      const errors = await validator.validateManifest(manifest);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateIaCConfig', () => {
    it('should validate a valid terraform config', async () => {
      const config = {
        type: 'terraform' as const,
        version: '1.0.0',
        backend: {
          type: 's3' as const,
          config: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
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
        ],
        variables: {},
        outputs: [],
      };

      const errors = await validator.validateIaCConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should validate a valid kubernetes config', async () => {
      const config = {
        type: 'kubernetes' as const,
        variables: {
          namespace: 'default',
          appName: 'test-app',
        },
        providers: [],
        outputs: [],
      };

      const errors = await validator.validateIaCConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should reject kubernetes config without namespace', async () => {
      const config = {
        type: 'kubernetes' as const,
        variables: {
          appName: 'test-app',
        },
        providers: [],
        outputs: [],
      };

      const errors = await validator.validateIaCConfig(config);
      expect(errors.some((e) => e.includes('namespace'))).toBe(true);
    });

    it('should validate a valid cloudflare config', async () => {
      const config = {
        type: 'cloudflare' as const,
        variables: {
          accountId: 'test-account-id',
          appName: 'test-worker',
        },
        providers: [],
        outputs: [],
      };

      const errors = await validator.validateIaCConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should reject cloudflare config without account ID', async () => {
      const config = {
        type: 'cloudflare' as const,
        variables: {
          appName: 'test-worker',
        },
        providers: [],
        outputs: [],
      };

      const errors = await validator.validateIaCConfig(config);
      expect(errors.some((e) => e.includes('account ID'))).toBe(true);
    });

    it('should reject invalid IaC type', async () => {
      const config = {
        type: 'invalid' as any,
        variables: {},
        providers: [],
        outputs: [],
      };

      const errors = await validator.validateIaCConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
