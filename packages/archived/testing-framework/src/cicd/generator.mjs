/**
 * CI/CD Generator
 * Generates CI/CD configuration files for various platforms
 */

// @ts-nocheck - Complex template literal generation with conditional expressions causes type errors

import {
  CICDConfig,
  CICDReport,
  TestSuite,
  TestCase,
  SecurityVulnerability,
  Artifact
} from './types';
import { Logger } from '../core/logger';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export class CICDGenerator {
  private config: CICDConfig;
  private logger: Logger;

  constructor(config: CICDConfig) {
    this.config = config;
    this.logger = new Logger('CICDGenerator');
  }

  /**
   * Generate CI/CD configuration file
   */
  async generate(outputDir: string): Promise<void> {
    const dirPath = join(process.cwd(), outputDir);

    // Create output directory
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    switch (this.config.platform) {
      case 'github-actions':
        await this.generateGitHubActions(dirPath);
        break;
      case 'gitlab-ci':
        await this.generateGitLabCI(dirPath);
        break;
      case 'jenkins':
        await this.generateJenkins(dirPath);
        break;
      case 'azure-devops':
        await this.generateAzureDevOps(dirPath);
        break;
      case 'circleci':
        await this.generateCircleCI(dirPath);
        break;
      case 'bitbucket-pipelines':
        await this.generateBitbucketPipelines(dirPath);
        break;
      default:
        throw new Error(`Unsupported platform: ${this.config.platform}`);
    }

    this.logger.info(`Generated ${this.config.platform} configuration in ${dirPath}`);
  }

  /**
   * Generate GitHub Actions workflow
   */
  private async generateGitHubActions(dirPath: string): Promise<void> {
    const workflowName = `${this.config.repository.name}-ci`;
    const workflowPath = join(dirPath, `${workflowName}.yml`);

    const workflow = this.generateGitHubActionsWorkflow();
    writeFileSync(workflowPath, workflow);

    // Generate matrix configuration if needed
    if (this.config.build.matrix || this.config.testing.parallel.matrix) {
      await this.generateGitHubMatrix(dirPath);
    }

    // Generate artifact upload scripts
    await this.generateArtifactScripts(dirPath, 'github-actions');
  }

  /**
   * Generate GitHub Actions workflow content
   */
  private generateGitHubActionsWorkflow(): string {
    const {
      repository,
      build,
      testing,
      deployment,
      notifications,
      caching,
      secrets,
      timeouts,
      retries,
      qualityGates
    } = this.config;

    let workflow = `name: ${repository.name} CI

on:
  push:
    branches: [${repository.branch}]
  pull_request:
    branches: [${repository.branch}]
  schedule:
    - cron: '0 6 * * *' # Daily at 6 AM UTC

env:
  NODE_VERSION: '20.x'

jobs:
`;

    // Build matrix if defined
    let matrixDefinition = '';
    if (this.config.build.matrix) {
      matrixDefinition = `
  strategy:
    matrix:
${this.generateMatrixDefinition(this.config.build.matrix)}`;
    }

    workflow += `  build:
    runs-on: ubuntu-latest${matrixDefinition}
    timeout-minutes: ${timeouts.build}
    steps:
`;

    // Checkout code
    workflow += `      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0`;

    // Setup Node.js
    workflow += `
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'`;

    // Cache dependencies
    if (caching.nodeModules.enabled) {
      workflow += `
      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            ~/.npm
          key: \${{ runner.os }}-node-\${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            \${{ runner.os }}-node-`;
    }

    // Install dependencies
    workflow += `
      - name: Install dependencies
        run: ${build.dependencies.install}`;

    // Build
    workflow += `
      - name: Build
        run: ${build.command}`;

    // Cache test results
    if (caching.tests.enabled) {
      workflow += `
      - name: Cache test results
        uses: actions/cache@v4
        with:
          path: test-results
          key: \${{ runner.os }}-test-results-\${{ hashFiles('**/test-results') }}`;
    }

    // Run tests
    workflow += `
      - name: Run tests
        run: ${testing.command}
        env:${this.generateEnvironmentVariables(testing.environment)}`;

    // Upload test results
    if (testing.artifacts.reports) {
      workflow += `
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results/`;
    }

    // Upload coverage
    if (testing.coverage.enabled && testing.artifacts.coverage) {
      workflow += `
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/`;
    }

    // Run security scan
    if (testing.security.enabled) {
      workflow += `
      - name: Security scan
        run: |
          ${testing.security.tools.map(tool => `echo "Running ${tool}..."`).join('\n          ')}
          # TODO: Implement security scanning with tools
        env:${this.generateEnvironmentVariables(testing.environment)}`;
    }

    // Build status
    if (build.status.enabled) {
      workflow += `
      - name: Update build status
        run: echo "Build status: \${{ job.status }}"`;
    }

    // Quality gates
    workflow += `
      - name: Check quality gates
        if: always()
        run: |
          # Test success rate check
          if [ "${qualityGates.testSuccessRate.enabled}" = "true" ]; then
            TOTAL_TESTS=$(cat test-results/summary.json | jq -r '.total // 0')
            PASSED_TESTS=$(cat test-results/summary.json | jq -r '.passed // 0')
            SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
            MIN_SUCCESS_RATE="${qualityGates.testSuccessRate.minimum}"

            if (( $(echo "$SUCCESS_RATE < $MIN_SUCCESS_RATE" | bc -l) )); then
              echo "::error::Test success rate ($SUCCESS_RATE%) is below minimum ($MIN_SUCCESS_RATE%)"
              exit 1
            fi
          fi

          # Coverage check
          if [ "${qualityGates.coverage.enabled}" = "true" ]; then
            COVERAGE=$(cat coverage/summary.json | jq -r '.lines.percentage // 0')
            MIN_COVERAGE="${qualityGates.coverage.minimum}"

            if (( $(echo "$COVERAGE < $MIN_COVERAGE" | bc -l) )); then
              echo "::error::Code coverage ($COVERAGE%) is below minimum ($MIN_COVERAGE%)"
              exit 1
            fi
          fi`;
    }

    // Upload screenshots
    if (testing.artifacts.screenshots) {
      workflow += `
      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: screenshots
          path: screenshots/`;
    }

    // Upload videos
    if (testing.artifacts.videos) {
      workflow += `
      - name: Upload videos
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: videos
          path: videos/`;
    }

    // Upload logs
    if (testing.artifacts.logs) {
      workflow += `
      - name: Upload logs
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: logs
          path: logs/`;
    }

    // Deploy if enabled
    if (deployment.enabled) {
      workflow += `
      - name: Deploy to ${deployment.environment}
        if: github.ref == 'refs/heads/${repository.branch}' && github.event_name == 'push'
        run: ${deployment.command}`;
    }

    // Notifications
    if (notifications.slack?.enabled) {
      workflow += `
      - name: Send Slack notification
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ job.status }}
          channel: '${notifications.slack.channel}'
          webhook_url: \${{ secrets.SLACK_WEBHOOK }}
        env:
          SLACK_WEBHOOK: \${{ secrets.SLACK_WEBHOOK }}`;
    }

    workflow += ``;

    return workflow;
  }

  /**
   * Generate GitLab CI configuration
   */
  private async generateGitLabCI(dirPath: string): Promise<void> {
    const gitlabPath = join(dirPath, '.gitlab-ci.yml');
    const gitlab = this.generateGitLabCIContent();
    writeFileSync(gitlabPath, gitlab);

    // Generate artifact scripts
    await this.generateArtifactScripts(dirPath, 'gitlab-ci');
  }

  /**
   * Generate GitLab CI content
   */
  private generateGitLabCIContent(): string {
    const {
      build,
      testing,
      deployment,
      notifications,
      caching,
      secrets,
      timeouts,
      retries,
      qualityGates
    } = this.config;

    let gitlab = `# GitLab CI/CD Configuration for ${this.config.repository.name}

variables:
  NODE_VERSION: "20"

stages:
  - build
  - test
  - security
  - deploy
  - notify

cache:
  paths:
    - node_modules/
    - .npm/
    - dist/`;

    // Build job
    gitlab += `

build_job:
  stage: build
  image: node:\${NODE_VERSION}
  cache:
    policy: pull-push
  script:
    - npm ci
    - ${build.command}
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
  timeout: ${timeouts.build}m`;

    // Test job
    gitlab += `

test_job:
  stage: test
  image: node:\${NODE_VERSION}
  cache:
    policy: pull
    paths:
      - node_modules/
  script:
    - ${testing.command}
  artifacts:
    reports:
      junit: test-results/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura.xml
    paths:
      - test-results/
      - coverage/
    expire_in: 1 week
  timeout: ${timeouts.tests}m
  needs:
    - job: build_job
      artifacts: true`;

    // Security job
    if (testing.security.enabled) {
      gitlab += `

security_job:
  stage: security
  image: node:\${NODE_VERSION}
  cache:
    policy: pull
    paths:
      - node_modules/
  script:
    - echo "Running security scans..."
    - ${testing.security.tools.join(' && ')}
  artifacts:
    reports:
      sast: security-report.json
    paths:
      - security-report.json
    expire_in: 1 week
  timeout: ${timeouts.tests}m
  needs:
    - job: build_job
      artifacts: true`;
    }

    // Deploy job
    if (deployment.enabled) {
      gitlab += `

deploy_job:
  stage: deploy
  image: node:\${NODE_VERSION}
  script:
    - ${deployment.command}
  environment:
    name: ${deployment.environment}
    url: https://\${CI_PROJECT_NAME}-\${CI_ENVIRONMENT_SLUG}.example.com
  when: manual
  only:
    - ${repository.branch}
  needs:
    - job: test_job
      artifacts: true
    - job: security_job
      artifacts: true`;
    }

    // Notify job
    gitlab += `

notify_job:
  stage: notify
  image: curlimages/curl:latest
  script:
    - echo "Sending notifications...";
  needs:
    - job: test_job
    - job: security_job
    - job: deploy_job`;

    return gitlab;
  }

  /**
   * Generate Jenkins pipeline
   */
  private async generateJenkins(dirPath: string): Promise<void> {
    const jenkinsPath = join(dirPath, 'Jenkinsfile');
    const jenkins = this.generateJenkinsPipeline();
    writeFileSync(jenkinsPath, jenkins);

    // Generate Jenkins helper scripts
    await this.generateArtifactScripts(dirPath, 'jenkins');
  }

  /**
   * Generate Jenkins pipeline content
   */
  private generateJenkinsPipeline(): string {
    const { build, testing, deployment, timeouts, qualityGates } = this.config;

    let jenkins = `pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
    }

    options {
        timeout(time: ${timeouts.build} minutes)
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Build') {
            steps {
                nodejs(nodeJSInstallationName: 'Node \${NODE_VERSION}') {
                    sh '${build.dependencies.install}'
                    sh '${build.command}'
                }
            }
        }

        stage('Test') {
            steps {
                nodejs(nodeJSInstallationName: 'Node \${NODE_VERSION}') {
                    sh '${testing.command}'
                }
                junit 'test-results/**/*.xml'
                cobertura autoHealthUpdate: true,
                         autoUpdateStable: true,
                         conditionalCoverageTargets: '90%',
                         coberturaReportFile: 'coverage/cobertura.xml',
                         failIfNoReports: true,
                         failUnhealthy: false,
                         lineCoverageTargets: '80%',
                         maxNumberOfBuilds: 0,
                        // ... rest of cobertura configuration
            }
        }

        stage('Security') {
            steps {
                nodejs(nodeJSInstallationName: 'Node \${NODE_VERSION}') {
                    sh '${testing.security.tools.join(' && ')}'
                }
            }
        }

        stage('Deploy') {
            when {
                expression { env.BRANCH_NAME == '${this.config.repository.branch}' }
            }
            steps {
                nodejs(nodeJSInstallationName: 'Node \${NODE_VERSION}') {
                    sh '${deployment.command}'
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'test-results/**, coverage/**, screenshots/**, videos/**, logs/**', fingerprint: true
        }
        success {
            echo 'Build successful!'
        }
        failure {
            echo 'Build failed!'
            emailext (
                subject: "Build Failed: \${env.JOB_NAME} #\${env.BUILD_NUMBER}",
                body: """
                Build failed for \${env.JOB_NAME} #\${env.BUILD_NUMBER}

                Check console output at: \${env.BUILD_URL}
                """,
                to: "\${DEFAULT_RECIPIENTS}"
            )
        }
    }
}`;

    return jenkins;
  }

  /**
   * Generate Azure DevOps pipeline
   */
  private async generateAzureDevOps(dirPath: string): Promise<void> {
    const azurePath = join(dirPath, 'azure-pipelines.yml');
    const azure = this.generateAzurePipeline();
    writeFileSync(azurePath, azure);
  }

  /**
   * Generate Azure DevOps pipeline content
   */
  private generateAzurePipeline(): string {
    const { build, testing, deployment, timeouts } = this.config;

    let azure = `# Azure DevOps Pipeline for ${this.config.repository.name}

trigger:
  branches:
    include:
    - ${this.config.repository.branch}

pool:
  vmImage: 'ubuntu-latest'

variables:
  NODE_VERSION: '20.x'

stages:
- stage: Build
  jobs:
  - job: Build
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '$(NODE_VERSION)'
      displayName: 'Install Node.js'

    - script: |
        npm ci
        ${build.command}
      displayName: 'Build application'

- stage: Test
  jobs:
  - job: Test
    steps:
    - script: ${testing.command}
      displayName: 'Run tests'
      env:
        NODE_ENV: test

    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'test-results/*.xml'
        mergeTestResults: true
        testRunTitle: 'Test Results'

    - task: PublishCodeCoverageResults@1
      inputs:
        codeCoverageTool: 'Cobertura'
        summaryFileLocation: 'coverage/cobertura.xml'
        reportDirectory: 'coverage'

- stage: Deploy
  condition: eq(variables['Build.SourceBranch'], 'refs/heads/${this.config.repository.branch}')
  jobs:
  - job: Deploy
    steps:
    - script: ${deployment.command}
      displayName: 'Deploy to ${deployment.environment}'`;

    return azure;
  }

  /**
   * Generate CircleCI configuration
   */
  private async generateCircleCI(dirPath: string): Promise<void> {
    const circlePath = join(dirPath, '.circleci', 'config.yml');
    const circleConfigDir = join(dirPath, '.circleci');

    if (!existsSync(circleConfigDir)) {
      mkdirSync(circleConfigDir, { recursive: true });
    }

    const circle = this.generateCircleCIConfig();
    writeFileSync(circlePath, circle);
  }

  /**
   * Generate CircleCI configuration content
   */
  private generateCircleCIConfig(): string {
    const { build, testing, deployment, timeouts } = this.config;

    let circle = `version: 2.1

orbs:
  node: circleci/node@5.0.2

executors:
  node:
    docker:
      - image: cimg/node:20.0

jobs:
  build:
    executor: node
    steps:
      - checkout
      - node/Cache-Npm
      - run:
          command: ${build.dependencies.install}
          name: Install dependencies
      - run:
          command: ${build.command}
          name: Build application

  test:
    executor: node
    steps:
      - checkout
      - node/Cache-Npm
      - run:
          command: ${testing.command}
          name: Run tests
      - store_test_results:
          path: test-results/

  security:
    executor: node
    steps:
      - checkout
      - node/Cache-Npm
      - run:
          command: ${testing.security.tools.join(' && ')}
          name: Run security scans

workflows:
  build-test-deploy:
    jobs:
      - build
      - test:
          requires:
            - build
      - security:
          requires:
            - build
      - deploy:
          requires:
            - test
            - security
          filters:
            branches:
              only:
                - ${this.config.repository.branch}`;

    return circle;
  }

  /**
   * Generate Bitbucket Pipelines configuration
   */
  private async generateBitbucketPipelines(dirPath: string): Promise<void> {
    const bitbucketPath = join(dirPath, 'bitbucket-pipelines.yml');
    const bitbucket = this.generateBitbucketPipelinesConfig();
    writeFileSync(bitbucketPath, bitbucket);
  }

  /**
   * Generate Bitbucket Pipelines configuration content
   */
  private generateBitbucketPipelinesConfig(): string {
    const { build, testing, deployment } = this.config;

    let bitbucket = `image: node:20

pipelines:
  default:
    - step:
        script:
          - npm ci
          - ${build.command}
          - ${testing.command}
          - npm test

  branches:
    ${this.config.repository.branch}:
      - step:
          script:
            - npm ci
            - ${build.command}
            - ${testing.command}
            - ${deployment.command}`;

    return bitbucket;
  }

  /**
   * Generate matrix definition
   */
  private generateMatrixDefinition(matrix: { [key: string]: string[] }): string {
    let definition = '';
    for (const [key, values] of Object.entries(matrix)) {
      definition += `      ${key}:\n`;
      for (const value of values) {
        definition += `        - ${value}\n`;
      }
    }
    return definition;
  }

  /**
   * Generate environment variables
   */
  private generateEnvironmentVariables(env: { [key: string]: string }): string {
    let variables = '';
    for (const [key, value] of Object.entries(env)) {
      variables += `\n          ${key}: ${value}`;
    }
    return variables;
  }

  /**
   * Generate artifact upload scripts
   */
  private async generateArtifactScripts(dirPath: string, platform: string): Promise<void> {
    const scriptsPath = join(dirPath, 'scripts');
    if (!existsSync(scriptsPath)) {
      mkdirSync(scriptsPath, { recursive: true });
    }

    const scripts = this.generateArtifactUploadScripts(platform);
    writeFileSync(join(scriptsPath, 'upload-artifacts.sh'), scripts);
  }

  /**
   * Generate artifact upload scripts content
   */
  private generateArtifactUploadScripts(platform: string): string {
    return `#!/bin/bash

# Artifact Upload Script for ${platform}

# Upload test results
if [ -d "test-results" ]; then
    echo "Uploading test results..."
    # Platform-specific upload command
    case "${platform}" in
        "github-actions")
            echo "Test results will be uploaded by GitHub Actions"
            ;;
        "gitlab-ci")
            echo "Test results will be uploaded by GitLab CI"
            ;;
        "jenkins")
            echo "Test results will be archived by Jenkins"
            ;;
        *)
            echo "Unknown platform: ${platform}"
            ;;
    esac
fi

# Upload coverage reports
if [ -d "coverage" ]; then
    echo "Uploading coverage reports..."
    # Platform-specific upload command
fi

# Upload screenshots
if [ -d "screenshots" ]; then
    echo "Uploading screenshots..."
    # Platform-specific upload command
fi

# Upload videos
if [ -d "videos" ]; then
    echo "Uploading videos..."
    # Platform-specific upload command
fi

# Upload logs
if [ -d "logs" ]; then
    echo "Uploading logs..."
    # Platform-specific upload command
fi

echo "Artifact upload complete!"
`;
  }

  /**
   * Generate GitHub matrix configuration
   */
  private async generateGitHubMatrix(dirPath: string): Promise<void> {
    const matrixPath = join(dirPath, 'matrix.json');
    const matrix = {
      build: this.config.build.matrix,
      test: this.config.testing.parallel.matrix
    };
    writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!this.config.repository?.owner) {
      errors.push('Repository owner is required');
    }

    if (!this.config.repository?.name) {
      errors.push('Repository name is required');
    }

    if (!this.config.repository?.branch) {
      errors.push('Repository branch is required');
    }

    if (!this.config.build?.command) {
      errors.push('Build command is required');
    }

    if (!this.config.testing?.command) {
      errors.push('Test command is required');
    }

    // Validate timeouts
    if (this.config.timeouts?.build <= 0) {
      errors.push('Build timeout must be greater than 0');
    }

    if (this.config.timeouts?.tests <= 0) {
      errors.push('Test timeout must be greater than 0');
    }

    // Validate quality gates
    if (this.config.qualityGates?.testSuccessRate?.minimum < 0 || this.config.qualityGates?.testSuccessRate?.minimum > 100) {
      errors.push('Test success rate must be between 0 and 100');
    }

    if (this.config.qualityGates?.coverage?.minimum < 0 || this.config.qualityGates?.coverage?.minimum > 100) {
      errors.push('Coverage must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate test summary report
   */
  generateTestReport(results: CICDReport): string {
    const {
      build,
      tests,
      coverage,
      benchmarks,
      security,
      qualityGates,
      artifacts,
      notifications
    } = results;

    let report = `# CI/CD Test Report

## Build Information
- **Build ID**: ${build.id}
- **Build Number**: ${build.number}
- **Status**: ${build.status}
- **Branch**: ${build.branch}
- **Commit**: ${build.commit.sha}
- **Author**: ${build.commit.author}
- **Duration**: ${build.duration}ms
- **Started**: ${new Date(build.startTime).toISOString()}
${build.endTime ? `- **Ended**: ${new Date(build.endTime).toISOString()}` : ''}

## Test Results
- **Total Tests**: ${tests.total}
- **Passed**: ${tests.passed}
- **Failed**: ${tests.failed}
- **Skipped**: ${tests.skipped}
- **Success Rate**: ${((tests.passed / tests.total) * 100).toFixed(2)}%
- **Duration**: ${tests.duration}ms

### Test Suites
${tests.suites.map(suite => `
#### ${suite.name} (${suite.file})
- Total: ${suite.total}
- Passed: ${suite.passed}
- Failed: ${suite.failed}
- Skipped: ${suite.skipped}
- Duration: ${suite.duration}ms
- Status: ${suite.status}
`).join('')}`;

    if (coverage) {
      report += `

## Coverage Results
- **Lines**: ${coverage.lines.toFixed(2)}%
- **Branches**: ${coverage.branches.toFixed(2)}%
- **Functions**: ${coverage.functions.toFixed(2)}%
- **Statements**: ${coverage.statements.toFixed(2)}%`;
    }

    if (benchmarks) {
      report += `

## Benchmarks
${Object.entries(benchmarks).map(([metric, data]) => `
- **${metric}**: ${data.value} ${data.unit} (${data.status === 'pass' ? '✓' : '✗'} - Threshold: ${data.threshold} ${data.unit})
`).join('')}`;
    }

    if (security) {
      report += `

## Security Scan Results
- **Vulnerabilities Found**: ${security.vulnerabilities.length}
- **Tools Used**: ${security.tools.join(', ')}

### Vulnerabilities
${security.vulnerabilities.map(vuln => `
#### ${vuln.title} (${vuln.severity.toUpperCase()})
- **ID**: ${vuln.id}
- **Category**: ${vuln.category}
- **Location**: ${vuln.location}
- **Description**: ${vuln.description}
- **Fix**: ${vuln.fix}
${vuln.cve ? `- **CVE**: ${vuln.cve}` : ''}
${vuln.owasp ? `- **OWASP**: ${vuln.owasp}` : ''}
`).join('')}`;
    }

    report += `

## Quality Gates Status
${Object.entries(qualityGates).map(([gate, passed]) => `
- **${gate}**: ${passed ? '✓' : '✗'}
`).join('')}

**Overall**: ${qualityGates.overall ? '✓' : '✗'}

## Artifacts
${artifacts.map(artifact => `
- **${artifact.name}**: ${artifact.size} bytes
  - Path: ${artifact.path}
  ${artifact.url ? `- URL: ${artifact.url}` : ''}
  ${artifact.expiresAt ? `- Expires: ${new Date(artifact.expiresAt).toISOString()}` : ''}
`).join('')}

## Notifications
- **Sent**: ${notifications.sent.join(', ') || 'None'}
- **Failed**: ${notifications.failed.join(', ') || 'None'}

---
*Report generated at ${new Date().toISOString()}*
`;

    return report;
  }

  /**
   * Generate quality gates check script
   */
  generateQualityGatesCheck(): string {
    const { qualityGates } = this.config;

    return `#!/bin/bash

# Quality Gates Check Script

echo "Running quality gates checks..."

# Test success rate check
if [ "${qualityGates.testSuccessRate.enabled}" = "true" ]; then
    TOTAL_TESTS=$(cat test-results/summary.json | jq -r '.total // 0')
    PASSED_TESTS=$(cat test-results/summary.json | jq -r '.passed // 0')
    SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    MIN_SUCCESS_RATE="${qualityGates.testSuccessRate.minimum}"

    echo "Test Success Rate: $SUCCESS_RATE% (Minimum: $MIN_SUCCESS_RATE%)"

    if (( $(echo "$SUCCESS_RATE < $MIN_SUCCESS_RATE" | bc -l) )); then
        echo "❌ Test success rate ($SUCCESS_RATE%) is below minimum ($MIN_SUCCESS_RATE%)"
        exit 1
    else
        echo "✅ Test success rate check passed"
    fi
fi

# Coverage check
if [ "${qualityGates.coverage.enabled}" = "true" ]; then
    COVERAGE=$(cat coverage/summary.json | jq -r '.lines.percentage // 0')
    MIN_COVERAGE="${qualityGates.coverage.minimum}"

    echo "Code Coverage: $COVERAGE% (Minimum: $MIN_COVERAGE%)"

    if (( $(echo "$COVERAGE < $MIN_COVERAGE" | bc -l) )); then
        echo "❌ Code coverage ($COVERAGE%) is below minimum ($MIN_COVERAGE%)"
        exit 1
    else
        echo "✅ Coverage check passed"
    fi
fi

# Security check
if [ "${qualityGates.security.enabled}" = "true" ]; then
    MAX_VULNERABILITIES="${qualityGates.security.maximumVulnerabilities}"
    VULNERABILITY_COUNT=$(cat security-report.json | jq -r '.vulnerabilities | length // 0')

    echo "Security Vulnerabilities: $VULNERABILITY_COUNT (Maximum: $MAX_VULNERABILITIES)"

    if [ "$VULNERABILITY_COUNT" -gt "$MAX_VULNERABILITIES" ]; then
        echo "❌ Too many security vulnerabilities found"
        exit 1
    else
        echo "✅ Security check passed"
    fi
fi

echo "🎉 All quality gates passed!"
exit 0
`;
  }
}