/**
 * Example: Using the IaC Generator to create infrastructure as code
 */

import {
  IaCGenerator,
  Logger,
} from '../src';
import * as fs from 'fs/promises';
import * as path from 'path';

// Initialize logger
const logger = new Logger({ service: 'iac-example' });

async function generateTerraform() {
  const generator = new IaCGenerator(logger);

  const result = await generator.generate({
    config: {
      type: 'terraform',
      version: '1.5.0',
      backend: {
        type: 's3',
        config: {
          bucket: 'my-terraform-state',
          key: 'claudeflare/terraform.tfstate',
          region: 'us-east-1',
          encrypt: true,
        },
      },
      providers: [
        {
          name: 'aws',
          source: 'hashicorp/aws',
          version: '5.0.0',
          configuration: {
            region: 'us-east-1',
          },
        },
        {
          name: 'cloudflare',
          source: 'cloudflare/cloudflare',
          version: '4.0.0',
          configuration: {
            api_token: '${var.cloudflare_api_token}',
            account_id: '${var.cloudflare_account_id}',
          },
        },
      ],
      variables: {
        environment: 'production',
        project_name: 'claudeflare',
        region: 'us-east-1',
        instance_count: 3,
        instance_type: 't3.medium',
        cloudflare_zone_id: 'abc123',
      },
      outputs: ['instance_id', 'instance_public_ip', 'cloudflare_worker_url'],
    },
    outputPath: './output/terraform',
    includeComments: true,
    formatOutput: true,
    validate: true,
  });

  console.log('Terraform generation result:', result);

  if (result.success && result.costEstimate) {
    console.log('Estimated monthly cost:', result.costEstimate);
  }
}

async function generateKubernetes() {
  const generator = new IaCGenerator(logger);

  const result = await generator.generate({
    config: {
      type: 'kubernetes',
      variables: {
        namespace: 'production',
        appName: 'claudeflare-api',
        replicas: 3,
        image: 'claudeflare/api:latest',
        imageTag: 'v2.0.0',
        containerPort: 8080,
        servicePort: 80,
        serviceType: 'LoadBalancer',
        ingressEnabled: true,
        ingressHost: 'api.claudeflare.io',
        ingressAnnotations: {
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/rate-limit': '100',
        },
        tlsEnabled: true,
        enableHpa: true,
        hpaMinReplicas: 2,
        hpaMaxReplicas: 10,
        hpaMetrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: 80,
              },
            },
          },
        ],
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
        env: [
          { name: 'NODE_ENV', value: 'production' },
          { name: 'LOG_LEVEL', value: 'info' },
        ],
      },
      providers: [],
      outputs: [],
    },
    outputPath: './output/kubernetes',
    validate: true,
  });

  console.log('Kubernetes generation result:', result);
}

async function generateCloudflare() {
  const generator = new IaCGenerator(logger);

  const result = await generator.generate({
    config: {
      type: 'cloudflare',
      variables: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || 'your-account-id',
        appName: 'claudeflare-edge-worker',
        enableAI: true,
        kvNamespaces: ['cache', 'sessions', 'rate-limits'],
        r2Buckets: ['assets', 'uploads', 'backups'],
        durableObjects: [
          {
            name: 'counter',
            className: 'CounterDurableObject',
            scriptName: 'claudeflare-edge-worker',
          },
          {
            name: 'session-store',
            className: 'SessionStoreDurableObject',
          },
        ],
        routes: [
          'https://api.example.com/*',
          'https://app.example.com/api/*',
        ],
        triggers: ['*/5 * * * *', '0 * * * *'],
        env: {
          ENVIRONMENT: 'production',
          API_ENDPOINT: 'https://api.example.com',
          JWT_SECRET: '${{ secrets.JWT_SECRET }}',
        },
        workers_requests: 10000000, // 10M requests/month
        workers_cpu_ms: 1000000,    // 1B CPU time/month
        kv_storage_gb: 10,
        r2_storage_gb: 500,
        bindings: [
          {
            type: 'kv',
            name: 'CACHE',
            properties: {
              namespace_id: 'abc123',
            },
          },
        ],
      },
      providers: [],
      outputs: ['worker_url', 'kv_namespace_ids', 'r2_bucket_urls'],
    },
    outputPath: './output/cloudflare',
    validate: true,
  });

  console.log('Cloudflare generation result:', result);

  if (result.success && result.costEstimate) {
    console.log('Estimated monthly cost:', result.costEstimate);

    // Print detailed breakdown
    console.log('\nCost breakdown:');
    for (const item of result.costEstimate.breakdown) {
      console.log(`  ${item.resource}: $${item.amount.toFixed(2)} (${item.quantity} ${item.unit})`);
    }
  }
}

async function generateHelmChart() {
  const generator = new IaCGenerator(logger);

  const result = await generator.generate({
    config: {
      type: 'helm',
      variables: {
        appName: 'claudeflare',
        chartVersion: '1.0.0',
        appVersion: '2.0.0',
        replicas: 3,
        imageRepository: 'claudeflare/app',
        imageTag: 'latest',
        imagePullPolicy: 'IfNotPresent',
        serviceType: 'LoadBalancer',
        servicePort: 80,
        containerPort: 8080,
        ingressEnabled: true,
        ingressClassName: 'nginx',
        ingressHost: 'app.claudeflare.io',
        tlsEnabled: true,
        enableHpa: true,
        hpaMinReplicas: 2,
        hpaMaxReplicas: 10,
        targetCPUUtilizationPercentage: 80,
        targetMemoryUtilizationPercentage: 80,
        resources: {
          limits: {
            cpu: '500m',
            memory: '512Mi',
          },
          requests: {
            cpu: '100m',
            memory: '128Mi',
          },
        },
        nodeSelector: {},
        tolerations: [],
        affinity: {},
        podAnnotations: {},
      },
      providers: [],
      outputs: [],
    },
    outputPath: './output/helm',
    validate: true,
  });

  console.log('Helm chart generation result:', result);
}

async function main() {
  try {
    // Create output directory
    await fs.mkdir('./output', { recursive: true });

    console.log('Generating Terraform configuration...');
    await generateTerraform();

    console.log('\nGenerating Kubernetes manifests...');
    await generateKubernetes();

    console.log('\nGenerating Cloudflare Worker configuration...');
    await generateCloudflare();

    console.log('\nGenerating Helm chart...');
    await generateHelmChart();

    console.log('\nAll IaC generated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
