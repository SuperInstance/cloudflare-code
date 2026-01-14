/**
 * Migration Guide Generator - Generate comprehensive migration guides
 */

import {
  MigrationGuide,
  BreakingChange,
  CodeExample,
  CommonIssue,
  MigrationStep,
  BreakingChangeType,
} from '../types/index.js';
import { BreakingChangeDetector } from '../analysis/BreakingChangeDetector.js';

export interface GuideOptions {
  includeCodeExamples?: boolean;
  includeRollback?: boolean;
  includeTesting?: boolean;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
}

export class GuideGenerator {
  private detector: BreakingChangeDetector;

  constructor() {
    this.detector = new BreakingChangeDetector();
  }

  /**
   * Generate comprehensive migration guide
   */
  generateGuide(
    fromVersion: string,
    toVersion: string,
    breakingChanges: BreakingChange[],
    options: GuideOptions = {}
  ): MigrationGuide {
    const {
      includeCodeExamples = true,
      includeRollback = true,
      includeTesting = true,
      detailLevel = 'detailed',
    } = options;

    const overview = this.generateOverview(fromVersion, toVersion, breakingChanges);
    const steps = this.generateSteps(breakingChanges, detailLevel);
    const codeExamples = includeCodeExamples
      ? this.generateCodeExamples(breakingChanges)
      : [];
    const commonIssues = this.generateCommonIssues(breakingChanges);
    const rollbackInstructions = includeRollback
      ? this.generateRollbackInstructions(fromVersion, toVersion)
      : '';
    const testingInstructions = includeTesting
      ? this.generateTestingInstructions(breakingChanges)
      : '';

    // Determine difficulty
    const difficulty = this.assessDifficulty(breakingChanges);

    // Estimate time
    const estimatedTime = this.estimateTime(steps, difficulty);

    return {
      sourceVersion: fromVersion,
      targetVersion: toVersion,
      overview,
      estimatedTime,
      difficulty,
      steps,
      codeExamples,
      commonIssues,
      rollbackInstructions,
      testingInstructions,
    };
  }

  /**
   * Generate overview
   */
  private generateOverview(
    fromVersion: string,
    toVersion: string,
    breakingChanges: BreakingChange[]
  ): string {
    const lines: string[] = [
      `# Migration Guide: ${fromVersion} → ${toVersion}`,
      '',
      '## Overview',
      `This guide helps you migrate your API integration from version ${fromVersion} to ${toVersion}.`,
      '',
    ];

    if (breakingChanges.length > 0) {
      lines.push(`## Summary of Changes`);
      lines.push('');
      lines.push(`- **Total Breaking Changes**: ${breakingChanges.length}`);
      lines.push(
        `- **Major Changes**: ${breakingChanges.filter(c => c.severity === 'major').length}`
      );
      lines.push(
        `- **Minor Changes**: ${breakingChanges.filter(c => c.severity === 'minor').length}`
      );
      lines.push(
        `- **Automatable**: ${breakingChanges.filter(c => c.automatedFix).length} changes can be automated`
      );
      lines.push('');

      // Categorize changes
      const categorized = this.categorizeChanges(breakingChanges);
      for (const [category, changes] of Object.entries(categorized)) {
        if (changes.length > 0) {
          lines.push(`### ${category}`);
          lines.push('');
          for (const change of changes) {
            lines.push(`- ${change.description}`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate migration steps
   */
  private generateSteps(
    breakingChanges: BreakingChange[],
    detailLevel: string
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];
    let stepNumber = 1;

    // Pre-migration steps
    steps.push({
      step: stepNumber++,
      description: 'Review breaking changes and assess impact',
      action: 'review' as any,
      automated: false,
    });

    steps.push({
      step: stepNumber++,
      description: 'Create backup of current integration',
      action: 'backup' as any,
      automated: false,
    });

    steps.push({
      step: stepNumber++,
      description: 'Set up test environment with new API version',
      action: 'setup' as any,
      automated: false,
    });

    // Breaking change specific steps
    for (const change of breakingChanges) {
      const changeSteps = this.generateStepsForBreakingChange(change, stepNumber, detailLevel);
      steps.push(...changeSteps);
      stepNumber += changeSteps.length;
    }

    // Post-migration steps
    steps.push({
      step: stepNumber++,
      description: 'Run integration tests',
      action: 'test' as any,
      automated: true,
    });

    steps.push({
      step: stepNumber++,
      description: 'Deploy to staging environment',
      action: 'deploy_staging' as any,
      automated: false,
    });

    steps.push({
      step: stepNumber++,
      description: 'Perform thorough testing in staging',
      action: 'test_staging' as any,
      automated: false,
    });

    steps.push({
      step: stepNumber++,
      description: 'Deploy to production',
      action: 'deploy_production' as any,
      automated: false,
    });

    steps.push({
      step: stepNumber++,
      description: 'Monitor for issues and validate functionality',
      action: 'monitor' as any,
      automated: false,
    });

    return steps;
  }

  /**
   * Generate steps for specific breaking change
   */
  private generateStepsForBreakingChange(
    change: BreakingChange,
    startStep: number,
    detailLevel: string
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];
    const baseStep = {
      action: change.migration[0]?.action || 'migrate' as any,
      automated: change.automatedFix || false,
    };

    switch (change.type) {
      case BreakingChangeType.ENDPOINT_REMOVED:
        steps.push({
          step: startStep,
          description: `Update code to use alternative endpoint instead of ${change.affectedEndpoints[0]}`,
          ...baseStep,
          codeExample: this.getEndpointRemovalExample(change),
        });
        if (detailLevel === 'comprehensive') {
          steps.push({
            step: startStep + 1,
            description: 'Verify all references to removed endpoint are updated',
            action: 'verify' as any,
            automated: false,
          });
        }
        break;

      case BreakingChangeType.ENDPOINT_RENAMED:
        steps.push({
          step: startStep,
          description: `Update endpoint path from old to new location`,
          ...baseStep,
          codeExample: this.getEndpointRenameExample(change),
        });
        break;

      case BreakingChangeType.PARAMETER_REMOVED:
        steps.push({
          step: startStep,
          description: `Remove parameter from API calls`,
          ...baseStep,
          codeExample: this.getParameterRemovalExample(change),
        });
        break;

      case BreakingChangeType.PARAMETER_RENAMED:
        steps.push({
          step: startStep,
          description: `Rename parameter in API calls`,
          ...baseStep,
          codeExample: this.getParameterRenameExample(change),
        });
        break;

      case BreakingChangeType.PARAMETER_TYPE_CHANGED:
        steps.push({
          step: startStep,
          description: `Update parameter type conversion`,
          ...baseStep,
          codeExample: this.getParameterTypeChangeExample(change),
        });
        break;

      case BreakingChangeType.RESPONSE_FIELD_REMOVED:
        steps.push({
          step: startStep,
          description: `Update code to handle removed response field`,
          ...baseStep,
          codeExample: this.getResponseFieldRemovalExample(change),
        });
        break;

      case BreakingChangeType.RESPONSE_FIELD_RENAMED:
        steps.push({
          step: startStep,
          description: `Update field names in response handling`,
          ...baseStep,
          codeExample: this.getResponseFieldRenameExample(change),
        });
        break;

      case BreakingChangeType.HTTP_METHOD_CHANGED:
        steps.push({
          step: startStep,
          description: `Update HTTP method for endpoint`,
          ...baseStep,
          codeExample: this.getHTTPMethodChangeExample(change),
        });
        break;

      case BreakingChangeType.AUTHENTICATION_CHANGED:
        steps.push({
          step: startStep,
          description: `Update authentication method`,
          ...baseStep,
          codeExample: this.getAuthenticationChangeExample(change),
        });
        if (detailLevel !== 'basic') {
          steps.push({
            step: startStep + 1,
            description: 'Test authentication with new method',
            action: 'test_auth' as any,
            automated: true,
          });
        }
        break;

      default:
        steps.push({
          step: startStep,
          description: change.description,
          ...baseStep,
          codeExample: change.migration[0]?.codeExample,
        });
    }

    return steps;
  }

  /**
   * Generate code examples
   */
  private generateCodeExamples(breakingChanges: BreakingChange[]): CodeExample[] {
    const examples: CodeExample[] = [];

    for (const change of breakingChanges) {
      const example = this.getCodeExampleForChange(change);
      if (example) {
        examples.push(example);
      }
    }

    return examples;
  }

  /**
   * Get code example for breaking change
   */
  private getCodeExampleForChange(change: BreakingChange): CodeExample | null {
    switch (change.type) {
      case BreakingChangeType.PARAMETER_REMOVED:
        return {
          language: 'typescript',
          description: 'Removing a parameter',
          before: this.getParameterRemovalExample(change).before,
          after: this.getParameterRemovalExample(change).after,
        };

      case BreakingChangeType.PARAMETER_RENAMED:
        return {
          language: 'typescript',
          description: 'Renaming a parameter',
          before: this.getParameterRenameExample(change).before,
          after: this.getParameterRenameExample(change).after,
        };

      case BreakingChangeType.ENDPOINT_REMOVED:
        return {
          language: 'typescript',
          description: 'Replacing removed endpoint',
          before: this.getEndpointRemovalExample(change).before,
          after: this.getEndpointRemovalExample(change).after,
        };

      default:
        return null;
    }
  }

  /**
   * Generate common issues
   */
  private generateCommonIssues(breakingChanges: BreakingChange[]): CommonIssue[] {
    const issues: CommonIssue[] = [];

    // Generic issues
    issues.push({
      issue: 'Type errors after migration',
      solution: 'Ensure all parameter and response type definitions are updated to match new API version',
    });

    issues.push({
      issue: 'Authentication failures',
      solution: 'Verify authentication credentials and method match new API requirements',
    });

    issues.push({
      issue: 'Rate limiting errors',
      solution: 'Check new rate limits and implement appropriate backoff strategies',
    });

    // Change-specific issues
    for (const change of breakingChanges) {
      if (change.type === BreakingChangeType.AUTHENTICATION_CHANGED) {
        issues.push({
          issue: 'Authentication method changed',
          solution: 'Update all API calls to use new authentication method',
        });
      }

      if (change.type === BreakingChangeType.ENDPOINT_REMOVED) {
        issues.push({
          issue: '404 errors for removed endpoints',
          solution: 'Update code to use alternative endpoints',
        });
      }
    }

    return issues;
  }

  /**
   * Generate rollback instructions
   */
  private generateRollbackInstructions(fromVersion: string, toVersion: string): string {
    return `# Rollback Instructions

If you encounter issues after migrating to ${toVersion}, follow these steps to rollback to ${fromVersion}:

## Immediate Rollback
1. **Revert Code Changes**
   \`\`\`bash
   git revert <migration-commit>
   git push origin main
   \`\`\`

2. **Restore Data Backup** (if applicable)
   \`\`\`bash
   # Restore from backup
   pg_restore -d database_name backup.dump
   \`\`\`

3. **Clear Caches**
   \`\`\`bash
   # Clear API response caches
   curl -X POST http://localhost:3000/api/cache/clear
   \`\`\`

4. **Verify System**
   - Run health checks
   - Monitor error logs
   - Test critical functionality

## Rolling Migration Rollback
If you used a rolling migration approach:
1. Route traffic back to ${fromVersion}
2. Scale down ${toVersion} instances
3. Monitor ${fromVersion} for issues
4. Remove ${toVersion} deployment

## Data Migration Rollback
If data was migrated:
1. Stop ${toVersion} services
2. Restore ${fromVersion} database
3. Restart ${fromVersion} services
4. Verify data integrity

## Post-Rollback Checklist
- [ ] System is stable
- [ ] No error spikes
- [ ] All features working
- [ ] Performance is normal
- [ ] Monitoring is clean

## Prevention
To prevent issues in future migrations:
1. Test thoroughly in staging
2. Run integration tests
3. Monitor metrics closely
4. Have rollback plan ready
5. Communicate with team`;
  }

  /**
   * Generate testing instructions
   */
  private generateTestingInstructions(breakingChanges: BreakingChange[]): string {
    return `# Testing Instructions

## Pre-Migration Testing
1. **Set up test environment**
   \`\`\`bash
   npm run test:setup
   \`\`\`

2. **Run existing test suite**
   \`\`\`bash
   npm test
   \`\`\`

3. **Establish baseline metrics**
   - Response times
   - Error rates
   - Throughput

## Migration Testing
1. **Unit Tests**
   \`\`\`bash
   npm run test:unit
   \`\`\`
   - Test individual endpoint changes
   - Verify parameter transformations
   - Validate response handling

2. **Integration Tests**
   \`\`\`bash
   npm run test:integration
   \`\`\`
   - Test full API workflows
   - Verify authentication
   - Test error handling

3. **Contract Tests**
   \`\`\`bash
   npm run test:contract
   \`\`\`
   - Validate API contracts
   - Test backward compatibility
   - Verify data schemas

## Performance Testing
1. **Load Testing**
   \`\`\`bash
   npm run test:load
   \`\`\`
   - Simulate normal traffic
   - Test peak load scenarios
   - Measure response times

2. **Stress Testing**
   \`\`\`bash
   npm run test:stress
   \`\`\`
   - Test failure scenarios
   - Verify graceful degradation
   - Test rate limiting

## Post-Migration Testing
1. **Smoke Tests**
   \`\`\`bash
   npm run test:smoke
   \`\`\`
   - Verify core functionality
   - Test critical paths
   - Check health endpoints

2. **Regression Tests**
   \`\`\`bash
   npm run test:regression
   \`\`\`
   - Ensure no functionality broken
   - Verify all features work
   - Check for side effects

3. **User Acceptance Testing**
   - Manual testing of key workflows
   - Validate user experience
   - Test edge cases

## Monitoring
Monitor these metrics after migration:
- Response times (should be within 10% of baseline)
- Error rates (should be < 0.1%)
- Throughput (should match or exceed baseline)
- Resource utilization (CPU, memory)

## Test Coverage
Ensure you have tests for:
${breakingChanges.map(c => `- ${c.description}`).join('\n')}

## Automated Testing Pipeline
\`\`\`yaml
# .github/workflows/migration-test.yml
name: Migration Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: |
          npm ci
          npm run test:all
\`\`\``;
  }

  /**
   * Categorize breaking changes
   */
  private categorizeChanges(
    breakingChanges: BreakingChange[]
  ): Record<string, BreakingChange[]> {
    const categories: Record<string, BreakingChange[]> = {
      'Endpoint Changes': [],
      'Parameter Changes': [],
      'Response Changes': [],
      'Authentication Changes': [],
      'Other Changes': [],
    };

    for (const change of breakingChanges) {
      switch (change.type) {
        case BreakingChangeType.ENDPOINT_REMOVED:
        case BreakingChangeType.ENDPOINT_RENAMED:
        case BreakingChangeType.HTTP_METHOD_CHANGED:
          categories['Endpoint Changes'].push(change);
          break;

        case BreakingChangeType.PARAMETER_REMOVED:
        case BreakingChangeType.PARAMETER_RENAMED:
        case BreakingChangeType.PARAMETER_TYPE_CHANGED:
        case BreakingChangeType.PARAMETER_REQUIRED_CHANGED:
          categories['Parameter Changes'].push(change);
          break;

        case BreakingChangeType.RESPONSE_FIELD_REMOVED:
        case BreakingChangeType.RESPONSE_FIELD_RENAMED:
        case BreakingChangeType.RESPONSE_FIELD_TYPE_CHANGED:
        case BreakingChangeType.RESPONSE_STRUCTURE_CHANGED:
          categories['Response Changes'].push(change);
          break;

        case BreakingChangeType.AUTHENTICATION_CHANGED:
          categories['Authentication Changes'].push(change);
          break;

        default:
          categories['Other Changes'].push(change);
      }
    }

    return categories;
  }

  /**
   * Assess migration difficulty
   */
  private assessDifficulty(breakingChanges: BreakingChange[]): 'easy' | 'medium' | 'hard' {
    const automatable = breakingChanges.filter(c => c.automatedFix).length;
    const total = breakingChanges.length;

    if (total === 0) return 'easy';
    if (automatable === total) return 'easy';
    if (automatable >= total / 2) return 'medium';
    return 'hard';
  }

  /**
   * Estimate migration time
   */
  private estimateTime(steps: MigrationStep[], difficulty: string): string {
    const baseMinutes = steps.length * 15;
    const multiplier = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const totalMinutes = baseMinutes * multiplier;

    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else if (totalMinutes < 480) {
      return `${Math.ceil(totalMinutes / 60)} hours`;
    } else {
      return `${Math.ceil(totalMinutes / 480)} days`;
    }
  }

  // Code example generators
  private getParameterRemovalExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - with deprecated parameter
const response = await api.call({
  oldParam: 'value',
  deprecatedParam: 'remove this'
});`,
      after: `// After - without deprecated parameter
const response = await api.call({
  oldParam: 'value'
});`,
    };
  }

  private getParameterRenameExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - old parameter name
const response = await api.call({
  oldParamName: 'value'
});`,
      after: `// After - new parameter name
const response = await api.call({
  newParamName: 'value'
});`,
    };
  }

  private getParameterTypeChangeExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - old type
const response = await api.call({
  count: '42'  // string
});`,
      after: `// After - new type
const response = await api.call({
  count: 42  // number
});`,
    };
  }

  private getEndpointRemovalExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - removed endpoint
const data = await api.get('/old/endpoint');`,
      after: `// After - alternative endpoint
const data = await api.get('/new/endpoint');`,
    };
  }

  private getEndpointRenameExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - old endpoint path
const data = await api.get('/old/path');`,
      after: `// After - new endpoint path
const data = await api.get('/new/path');`,
    };
  }

  private getResponseFieldRemovalExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - accessing removed field
const value = response.data.removedField;`,
      after: `// After - handle missing field
const value = response.data.newField || defaultValue;`,
    };
  }

  private getResponseFieldRenameExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - old field name
const value = response.oldFieldName;`,
      after: `// After - new field name
const value = response.newFieldName;`,
    };
  }

  private getHTTPMethodChangeExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - POST request
const response = await api.post('/endpoint', data);`,
      after: `// After - PUT request
const response = await api.put('/endpoint', data);`,
    };
  }

  private getAuthenticationChangeExample(change: BreakingChange): { before: string; after: string } {
    return {
      before: `// Before - old authentication
const api = new ApiClient({
  apiKey: 'key',
  secret: 'secret'
});`,
      after: `// After - new authentication
const api = new ApiClient({
  bearerToken: 'token',
  scopes: ['read', 'write']
});`,
    };
  }
}
