/**
 * Validation utilities
 */

import Joi from 'joi';
import { Logger } from './logger';
import { IaCConfig, KubernetesManifest } from '../types';

export class Validator {
  private logger: Logger;
  private schemas: Map<string, Joi.Schema>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.schemas = new Map();
    this.initializeSchemas();
  }

  /**
   * Initialize validation schemas
   */
  private initializeSchemas(): void {
    // Kubernetes manifest schema
    const kubernetesManifestSchema = Joi.object({
      apiVersion: Joi.string().required(),
      kind: Joi.string()
        .valid(
          'Pod',
          'Deployment',
          'Service',
          'Ingress',
          'ConfigMap',
          'Secret',
          'StatefulSet',
          'DaemonSet',
          'HorizontalPodAutoscaler'
        )
        .required(),
      metadata: Joi.object({
        name: Joi.string().required(),
        namespace: Joi.string(),
        labels: Joi.object(),
        annotations: Joi.object(),
      }).required(),
      spec: Joi.object(),
    });

    // IaC config schema
    const iaCConfigSchema = Joi.object({
      type: Joi.string()
        .valid('terraform', 'kubernetes', 'cloudflare', 'helm')
        .required(),
      version: Joi.string(),
      backend: Joi.object({
        type: Joi.string().valid('s3', 'gcs', 'azurerm', 'consul', 'local'),
        config: Joi.object(),
      }),
      providers: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          source: Joi.string(),
          version: Joi.string(),
          configuration: Joi.object().required(),
        })
      ),
      variables: Joi.object(),
      outputs: Joi.array().items(Joi.string()),
    });

    this.schemas.set('kubernetesManifest', kubernetesManifestSchema);
    this.schemas.set('iaCConfig', iaCConfigSchema);
  }

  /**
   * Validate a Kubernetes manifest
   */
  async validateManifest(manifest: any): Promise<string[]> {
    const errors: string[] = [];

    try {
      const schema = this.schemas.get('kubernetesManifest');
      if (!schema) {
        throw new Error('Schema not found');
      }

      const { error } = schema.validate(manifest, {
        abortEarly: false,
        allowUnknown: true,
      });

      if (error) {
        errors.push(...error.details.map((d) => d.message));
      }

      // Validate kind-specific requirements
      if (manifest.kind === 'Deployment') {
        const deploymentErrors = this.validateDeployment(manifest);
        errors.push(...deploymentErrors);
      } else if (manifest.kind === 'Service') {
        const serviceErrors = this.validateService(manifest);
        errors.push(...serviceErrors);
      } else if (manifest.kind === 'Ingress') {
        const ingressErrors = this.validateIngress(manifest);
        errors.push(...ingressErrors);
      }

      // Validate resource name
      if (manifest.metadata?.name) {
        const nameErrors = this.validateResourceName(manifest.metadata.name);
        errors.push(...nameErrors);
      }
    } catch (err: any) {
      errors.push(err.message);
    }

    return errors;
  }

  /**
   * Validate IaC configuration
   */
  async validateIaCConfig(config: IaCConfig): Promise<string[]> {
    const errors: string[] = [];

    try {
      const schema = this.schemas.get('iaCConfig');
      if (!schema) {
        throw new Error('Schema not found');
      }

      const { error } = schema.validate(config, {
        abortEarly: false,
        allowUnknown: true,
      });

      if (error) {
        errors.push(...error.details.map((d) => d.message));
      }

      // Type-specific validation
      switch (config.type) {
        case 'terraform':
          const terraformErrors = this.validateTerraformConfig(config);
          errors.push(...terraformErrors);
          break;
        case 'kubernetes':
          const kubernetesErrors = this.validateKubernetesConfig(config);
          errors.push(...kubernetesErrors);
          break;
        case 'cloudflare':
          const cloudflareErrors = this.validateCloudflareConfig(config);
          errors.push(...cloudflareErrors);
          break;
      }
    } catch (err: any) {
      errors.push(err.message);
    }

    return errors;
  }

  /**
   * Validate Deployment manifest
   */
  private validateDeployment(manifest: any): string[] {
    const errors: string[] = [];

    if (!manifest.spec) {
      errors.push('Deployment must have spec');
      return errors;
    }

    if (!manifest.spec.replicas || manifest.spec.replicas < 1) {
      errors.push('Deployment must have at least 1 replica');
    }

    if (!manifest.spec.selector) {
      errors.push('Deployment must have a selector');
    }

    if (!manifest.spec.template) {
      errors.push('Deployment must have a template');
    }

    if (manifest.spec.template?.spec?.containers?.length === 0) {
      errors.push('Deployment must have at least one container');
    }

    return errors;
  }

  /**
   * Validate Service manifest
   */
  private validateService(manifest: any): string[] {
    const errors: string[] = [];

    if (!manifest.spec) {
      errors.push('Service must have spec');
      return errors;
    }

    if (!manifest.spec.selector) {
      errors.push('Service must have a selector');
    }

    if (!manifest.spec.ports || manifest.spec.ports.length === 0) {
      errors.push('Service must have at least one port');
    }

    const validTypes = ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'];
    if (manifest.spec.type && !validTypes.includes(manifest.spec.type)) {
      errors.push(`Service type must be one of: ${validTypes.join(', ')}`);
    }

    return errors;
  }

  /**
   * Validate Ingress manifest
   */
  private validateIngress(manifest: any): string[] {
    const errors: string[] = [];

    if (!manifest.spec) {
      errors.push('Ingress must have spec');
      return errors;
    }

    if (!manifest.spec.rules || manifest.spec.rules.length === 0) {
      errors.push('Ingress must have at least one rule');
    }

    return errors;
  }

  /**
   * Validate resource name
   */
  private validateResourceName(name: string): string[] {
    const errors: string[] = [];

    if (name.length > 253) {
      errors.push('Resource name must be 253 characters or less');
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
      errors.push(
        'Resource name must consist of lowercase alphanumeric characters or \'-\', and must start and end with an alphanumeric character'
      );
    }

    return errors;
  }

  /**
   * Validate Terraform configuration
   */
  private validateTerraformConfig(config: IaCConfig): string[] {
    const errors: string[] = [];

    if (config.backend && !config.backend.type) {
      errors.push('Terraform backend must have a type');
    }

    return errors;
  }

  /**
   * Validate Kubernetes configuration
   */
  private validateKubernetesConfig(config: IaCConfig): string[] {
    const errors: string[] = [];

    if (!config.variables?.namespace) {
      errors.push('Kubernetes configuration must specify a namespace');
    }

    if (!config.variables?.appName) {
      errors.push('Kubernetes configuration must specify an app name');
    }

    return errors;
  }

  /**
   * Validate Cloudflare configuration
   */
  private validateCloudflareConfig(config: IaCConfig): string[] {
    const errors: string[] = [];

    if (!config.variables?.accountId) {
      errors.push('Cloudflare configuration must specify an account ID');
    }

    if (!config.variables?.appName) {
      errors.push('Cloudflare configuration must specify a worker name');
    }

    return errors;
  }
}
