/**
 * CI/CD Integration Types
 * Provides types and interfaces for CI/CD pipeline integration
 */

export interface CICDConfig {
  // Platform configuration
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'azure-devops' | 'circleci' | 'bitbucket-pipelines';

  // Repository information
  repository: {
    owner: string;
    name: string;
    branch: string;
  };

  // Testing configuration
  testing: {
    // Test command to run
    command: string;

    // Test patterns
    patterns: string[];

    // Test environment variables
    environment: { [key: string]: string };

    // Test parallelization
    parallel: {
      enabled: boolean;
      matrix?: { [key: string]: string[] };
      splitBy: 'file' | 'suite' | 'none';
    };

    // Coverage requirements
    coverage: {
      enabled: boolean;
      thresholds: {
        lines: number;
        branches: number;
        functions: number;
        statements: number;
      };
      minimum: number;
      failBuild: boolean;
    };

    // Performance benchmarks
    benchmarks: {
      enabled: boolean;
      thresholds: { [metric: string]: number };
      failBuild: boolean;
    };

    // Security scanning
    security: {
      enabled: boolean;
      tools: string[];
      failBuild: boolean;
    };

    // Artifacts to upload
    artifacts: {
      reports: boolean;
      screenshots: boolean;
      videos: boolean;
      logs: boolean;
      coverage: boolean;
    };
  };

  // Build configuration
  build: {
    // Build command
    command: string;

    // Build dependencies
    dependencies: {
      install: string;
      build: string;
    };

    // Build matrix
    matrix?: { [key: string]: string[] };

    // Build status
    status: {
      enabled: boolean;
      message: string;
    };
  };

  // Deployment configuration
  deployment: {
    // Enable deployment after tests pass
    enabled: boolean;

    // Environment to deploy to
    environment: 'staging' | 'production' | 'development';

    // Deployment command
    command: string;

    // Pre-deployment checks
    preChecks: {
      enabled: boolean;
      commands: string[];
    };

    // Post-deployment verification
    postVerification: {
      enabled: boolean;
      commands: string[];
      timeout: number;
    };
  };

  // Notifications
  notifications: {
    // Slack notifications
    slack?: {
      enabled: boolean;
      webhook: string;
      channel: string;
      onSuccess: boolean;
      onFailure: boolean;
    };

    // Email notifications
    email?: {
      enabled: boolean;
      recipients: string[];
      onSuccess: boolean;
      onFailure: boolean;
    };

    // Webhook notifications
    webhook?: {
      enabled: boolean;
      url: string;
      method: 'POST' | 'PUT';
      headers: { [key: string]: string };
    };
  };

  // Caching configuration
  caching: {
    // Node modules cache
    nodeModules: {
      enabled: boolean;
      paths: string[];
    };

    // Build cache
    build: {
      enabled: boolean;
      paths: string[];
    };

    // Test cache
    tests: {
      enabled: boolean;
      paths: string[];
    };
  };

  // Secret management
  secrets: {
    // Environment variables
    environment: string[];

    // Files
    files: string[];
  };

  // Timeout configuration
  timeouts: {
    // Build timeout in minutes
    build: number;

    // Test timeout in minutes
    tests: number;

    // Deployment timeout in minutes
    deployment: number;
  };

  // Retries configuration
  retries: {
    // Maximum retry attempts
    max: number;

    // Retry delay in milliseconds
    delay: number;

    // Conditions for retry
    conditions: string[];
  };

  // Quality gates
  qualityGates: {
    // Test success rate
    testSuccessRate: {
      enabled: boolean;
      minimum: number; // percentage
    };

    // Code coverage
    coverage: {
      enabled: boolean;
      minimum: number; // percentage
    };

    // Performance benchmarks
    performance: {
      enabled: boolean;
      thresholds: { [metric: string]: number };
    };

    // Security scan
    security: {
      enabled: boolean;
      maximumVulnerabilities: number;
      allowedLevels: string[];
    };
  };
}

export interface CICDReport {
  // Build information
  build: {
    id: string;
    number: string;
    status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
    startTime: number;
    endTime?: number;
    duration?: number;
    branch: string;
    commit: {
      sha: string;
      message: string;
      author: string;
      timestamp: number;
    };
  };

  // Test results
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    suites: TestSuite[];
  };

  // Coverage results
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
    perFile: { [filePath: string]: CoverageFile };
  };

  // Performance benchmarks
  benchmarks?: {
    [metric: string]: {
      value: number;
      threshold: number;
      status: 'pass' | 'fail';
      unit: string;
    };
  };

  // Security scan results
  security?: {
    vulnerabilities: SecurityVulnerability[];
    tools: string[];
  };

  // Quality gates status
  qualityGates: {
    testSuccessRate: boolean;
    coverage: boolean;
    performance: boolean;
    security: boolean;
    overall: boolean;
  };

  // Artifacts
  artifacts: Artifact[];

  // Notifications
  notifications: {
    sent: string[];
    failed: string[];
  };
}

export interface TestSuite {
  name: string;
  file: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestCase[];
  status: 'pass' | 'fail' | 'skip';
}

export interface TestCase {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'pending';
  duration: number;
  error?: string;
  stack?: string;
  retries?: number;
}

export interface CoverageFile {
  path: string;
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  percentage: number;
}

export interface SecurityVulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  location: string;
  fix: string;
  cve?: string;
  owasp?: string;
}

export interface Artifact {
  name: string;
  path: string;
  size: number;
  type: string;
  url?: string;
  expiresAt?: number;
}

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  startTime?: number;
  endTime?: number;
  duration?: number;
  output?: string;
  artifacts?: Artifact[];
}

export interface PipelineRun {
  id: string;
  number: number;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
  steps: PipelineStep[];
  trigger: {
    type: 'push' | 'pull_request' | 'schedule' | 'manual';
    branch: string;
    commit: string;
    author: string;
  };
  environment?: string;
  createdAt: number;
  updatedAt: number;
}