/**
 * Migration Engine - Handle API version migrations
 */

import {
  TransformRule,
  Transform,
  TransformConfig,
  RequestTransform,
  ResponseTransform,
  HeaderTransform,
  MigrationStep,
  MigrationAction,
  BreakingChange,
  MigrationGuide,
  MigrationStatus,
} from '../types/index.js';

export interface MigrationResult {
  success: boolean;
  transformed: any;
  warnings: string[];
  errors: string[];
  metadata: Record<string, any>;
}

export class MigrationEngine {
  private transformRules: Map<string, TransformRule[]>;
  private migrationGuides: Map<string, MigrationGuide>;
  private activeMigrations: Map<string, MigrationStatus>;

  constructor() {
    this.transformRules = new Map();
    this.migrationGuides = new Map();
    this.activeMigrations = new Map();
  }

  /**
   * Register a transform rule
   */
  registerTransform(rule: TransformRule): void {
    const key = this.getTransformKey(rule.fromVersion, rule.toVersion);
    const rules = this.transformRules.get(key) || [];
    rules.push(rule);
    this.transformRules.set(key, rules);
  }

  /**
   * Transform request from old version to new version
   */
  transformRequest(
    request: any,
    fromVersion: string,
    toVersion: string
  ): MigrationResult {
    const config = this.getTransformConfig(fromVersion, toVersion);
    if (!config.requestTransforms || config.requestTransforms.length === 0) {
      return {
        success: true,
        transformed: request,
        warnings: [],
        errors: [],
        metadata: { message: 'No request transforms needed' },
      };
    }

    let transformed = { ...request };
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const transform of config.requestTransforms) {
      try {
        const result = this.applyRequestTransform(transformed, transform);
        if (result.success) {
          transformed = result.transformed;
          warnings.push(...result.warnings);
        } else {
          errors.push(...result.errors);
          return {
            success: false,
            transformed: request,
            warnings,
            errors,
            metadata: {},
          };
        }
      } catch (error) {
        errors.push(`Transform failed: ${error}`);
        return {
          success: false,
          transformed: request,
          warnings,
          errors,
          metadata: {},
        };
      }
    }

    return {
      success: true,
      transformed,
      warnings,
      errors,
      metadata: { transformsApplied: config.requestTransforms.length },
    };
  }

  /**
   * Transform response from new version to old version
   */
  transformResponse(
    response: any,
    fromVersion: string,
    toVersion: string
  ): MigrationResult {
    const config = this.getTransformConfig(fromVersion, toVersion);
    if (!config.responseTransforms || config.responseTransforms.length === 0) {
      return {
        success: true,
        transformed: response,
        warnings: [],
        errors: [],
        metadata: { message: 'No response transforms needed' },
      };
    }

    let transformed = { ...response };
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const transform of config.responseTransforms) {
      try {
        const result = this.applyResponseTransform(transformed, transform);
        if (result.success) {
          transformed = result.transformed;
          warnings.push(...result.warnings);
        } else {
          errors.push(...result.errors);
          return {
            success: false,
            transformed: response,
            warnings,
            errors,
            metadata: {},
          };
        }
      } catch (error) {
        errors.push(`Transform failed: ${error}`);
        return {
          success: false,
          transformed: response,
          warnings,
          errors,
          metadata: {},
        };
      }
    }

    return {
      success: true,
      transformed,
      warnings,
      errors,
      metadata: { transformsApplied: config.responseTransforms.length },
    };
  }

  /**
   * Transform headers
   */
  transformHeaders(
    headers: Headers,
    fromVersion: string,
    toVersion: string
  ): { success: boolean; headers: Headers; errors: string[] } {
    const config = this.getTransformConfig(fromVersion, toVersion);
    if (!config.headerTransforms || config.headerTransforms.length === 0) {
      return { success: true, headers, errors: [] };
    }

    const newHeaders = new Headers(headers);
    const errors: string[] = [];

    for (const transform of config.headerTransforms) {
      try {
        this.applyHeaderTransform(newHeaders, transform);
      } catch (error) {
        errors.push(`Header transform failed: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      headers: newHeaders,
      errors,
    };
  }

  /**
   * Generate migration guide
   */
  generateMigrationGuide(
    fromVersion: string,
    toVersion: string,
    breakingChanges: BreakingChange[]
  ): MigrationGuide {
    const steps = this.generateMigrationSteps(breakingChanges);
    const codeExamples = this.generateCodeExamples(breakingChanges);
    const commonIssues = this.generateCommonIssues(breakingChanges);

    // Determine difficulty
    const automatedSteps = steps.filter(s => s.automated).length;
    const difficulty =
      automatedSteps === steps.length ? 'easy' : automatedSteps > steps.length / 2 ? 'medium' : 'hard';

    // Estimate time
    const estimatedTime = this.estimateMigrationTime(steps, difficulty);

    return {
      sourceVersion: fromVersion,
      targetVersion: toVersion,
      overview: `Migrate from ${fromVersion} to ${toVersion}`,
      estimatedTime,
      difficulty,
      steps,
      codeExamples,
      commonIssues,
      rollbackInstructions: this.generateRollbackInstructions(fromVersion),
      testingInstructions: this.generateTestingInstructions(),
    };
  }

  /**
   * Execute migration
   */
  async executeMigration(
    fromVersion: string,
    toVersion: string,
    data: any
  ): Promise<MigrationStatus> {
    const migrationId = this.generateMigrationId();

    const status: MigrationStatus = {
      status: 'in_progress',
      progress: 0,
      currentStep: 0,
      totalSteps: 0,
      errors: [],
      warnings: [],
      startedAt: new Date(),
    };

    this.activeMigrations.set(migrationId, status);

    try {
      const guide = this.migrationGuides.get(`${fromVersion}->${toVersion}`);
      if (!guide) {
        throw new Error('Migration guide not found');
      }

      status.totalSteps = guide.steps.length;

      for (let i = 0; i < guide.steps.length; i++) {
        status.currentStep = i + 1;
        status.progress = ((i + 1) / guide.steps.length) * 100;

        const step = guide.steps[i];
        if (!step.automated) {
          status.warnings.push(`Step ${i + 1} requires manual intervention: ${step.description}`);
        }
      }

      status.status = 'completed';
      status.completedAt = new Date();
    } catch (error) {
      status.status = 'failed';
      status.errors.push(`Migration failed: ${error}`);
    }

    return status;
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(migrationId: string): Promise<MigrationStatus> {
    const status = this.activeMigrations.get(migrationId);
    if (!status) {
      throw new Error('Migration not found');
    }

    status.status = 'rolled_back';

    return status;
  }

  /**
   * Get migration status
   */
  getMigrationStatus(migrationId: string): MigrationStatus | undefined {
    return this.activeMigrations.get(migrationId);
  }

  /**
   * Apply request transform
   */
  private applyRequestTransform(
    data: any,
    transform: RequestTransform
  ): MigrationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    let transformed = { ...data };

    switch (transform.operation) {
      case 'rename':
        transformed = this.renameField(transformed, transform.from, transform.to);
        break;
      case 'remove':
        transformed = this.removeField(transformed, transform.path);
        warnings.push(`Removed field: ${transform.path}`);
        break;
      case 'add':
        transformed = this.addField(transformed, transform.path, transform.to);
        break;
      case 'modify':
        transformed = this.modifyField(transformed, transform.path, transform.to);
        break;
      case 'move':
        transformed = this.moveField(transformed, transform.from, transform.to);
        break;
      default:
        errors.push(`Unknown operation: ${transform.operation}`);
    }

    return {
      success: errors.length === 0,
      transformed,
      warnings,
      errors,
      metadata: {},
    };
  }

  /**
   * Apply response transform
   */
  private applyResponseTransform(
    data: any,
    transform: ResponseTransform
  ): MigrationResult {
    return this.applyRequestTransform(data, transform as any);
  }

  /**
   * Apply header transform
   */
  private applyHeaderTransform(headers: Headers, transform: HeaderTransform): void {
    switch (transform.operation) {
      case 'rename':
        const value = headers.get(transform.header);
        if (value) {
          headers.delete(transform.header);
          headers.set(transform.value, value);
        }
        break;
      case 'remove':
        headers.delete(transform.header);
        break;
      case 'add':
        headers.set(transform.header, transform.value);
        break;
      case 'modify':
        headers.set(transform.header, transform.value);
        break;
    }
  }

  /**
   * Rename field
   */
  private renameField(data: any, oldPath: string, newPath: string): any {
    const value = this.getFieldValue(data, oldPath);
    if (value !== undefined) {
      const updated = this.removeField(data, oldPath);
      return this.addField(updated, newPath, value);
    }
    return data;
  }

  /**
   * Remove field
   */
  private removeField(data: any, path: string): any {
    const parts = path.split('.');
    const result = { ...data };
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]]) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
    }

    if (current && parts[parts.length - 1] in current) {
      delete current[parts[parts.length - 1]];
    }

    return result;
  }

  /**
   * Add field
   */
  private addField(data: any, path: string, value: any): any {
    const parts = path.split('.');
    const result = { ...data };
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current[parts[i]] = { ...current[parts[i]] };
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    return result;
  }

  /**
   * Modify field
   */
  private modifyField(data: any, path: string, value: any): any {
    return this.addField(data, path, value);
  }

  /**
   * Move field
   */
  private moveField(data: any, fromPath: string, toPath: string): any {
    return this.renameField(data, fromPath, toPath);
  }

  /**
   * Get field value
   */
  private getFieldValue(data: any, path: string): any {
    const parts = path.split('.');
    let current = data;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get transform config
   */
  private getTransformConfig(fromVersion: string, toVersion: string): TransformConfig {
    const key = this.getTransformKey(fromVersion, toVersion);
    const rules = this.transformRules.get(key) || [];

    const requestTransforms: RequestTransform[] = [];
    const responseTransforms: ResponseTransform[] = [];
    const headerTransforms: HeaderTransform[] = [];

    for (const rule of rules) {
      if (rule.transform === Transform.REQUEST_TRANSFORM) {
        requestTransforms.push(rule as any);
      } else if (rule.transform === Transform.RESPONSE_TRANSFORM) {
        responseTransforms.push(rule as any);
      } else if (rule.transform === Transform.HEADER_TRANSFORM) {
        headerTransforms.push(rule as any);
      }
    }

    return {
      sourceVersion: fromVersion,
      targetVersion: toVersion,
      requestTransforms,
      responseTransforms,
      headerTransforms,
    };
  }

  /**
   * Generate migration steps
   */
  private generateMigrationSteps(breakingChanges: BreakingChange[]): MigrationStep[] {
    return breakingChanges.map((change, index) => ({
      step: index + 1,
      description: change.description,
      action: change.migration[0]?.action || MigrationAction.CHANGE_ENDPOINT,
      automated: change.automatedFix || false,
      codeExample: change.migration[0]?.codeExample,
    }));
  }

  /**
   * Generate code examples
   */
  private generateCodeExamples(breakingChanges: BreakingChange[]): Array<{
    language: string;
    description: string;
    before: string;
    after: string;
  }> {
    return breakingChanges
      .filter(c => c.migration[0]?.codeExample)
      .map(change => ({
        language: 'typescript',
        description: change.description,
        before: '// Old code',
        after: change.migration[0]?.codeExample || '// New code',
      }));
  }

  /**
   * Generate common issues
   */
  private generateCommonIssues(breakingChanges: BreakingChange[]): Array<{
    issue: string;
    solution: string;
  }> {
    return breakingChanges.map(change => ({
      issue: change.description,
      solution: change.migration[0]?.description || 'Update code accordingly',
    }));
  }

  /**
   * Estimate migration time
   */
  private estimateMigrationTime(steps: MigrationStep[], difficulty: string): string {
    const baseTime = steps.length * 30; // 30 minutes per step
    const multiplier = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 4;
    const totalMinutes = baseTime * multiplier;

    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else {
      const hours = Math.ceil(totalMinutes / 60);
      return `${hours} hours`;
    }
  }

  /**
   * Generate rollback instructions
   */
  private generateRollbackInstructions(version: string): string {
    return `To rollback to ${version}:
1. Revert code changes to use ${version} endpoints
2. Restore data backup if applicable
3. Clear any caches
4. Verify system functionality
5. Monitor for issues`;
  }

  /**
   * Generate testing instructions
   */
  private generateTestingInstructions(): string {
    return `Testing Checklist:
1. Unit tests for all modified endpoints
2. Integration tests for API interactions
3. Load tests for performance verification
4. Backward compatibility tests
5. Data integrity tests
6. User acceptance testing`;
  }

  /**
   * Get transform key
   */
  private getTransformKey(fromVersion: string, toVersion: string): string {
    return `${fromVersion}->${toVersion}`;
  }

  /**
   * Generate migration ID
   */
  private generateMigrationId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save migration guide
   */
  saveMigrationGuide(guide: MigrationGuide): void {
    const key = `${guide.sourceVersion}->${guide.targetVersion}`;
    this.migrationGuides.set(key, guide);
  }

  /**
   * Get migration guide
   */
  getMigrationGuide(fromVersion: string, toVersion: string): MigrationGuide | undefined {
    const key = `${fromVersion}->${toVersion}`;
    return this.migrationGuides.get(key);
  }

  /**
   * Get all migration guides
   */
  getAllMigrationGuides(): MigrationGuide[] {
    return Array.from(this.migrationGuides.values());
  }

  /**
   * Validate migration
   */
  validateMigration(
    fromVersion: string,
    toVersion: string,
    data: any
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const result = this.transformRequest(data, fromVersion, toVersion);
    if (!result.success) {
      errors.push(...result.errors);
    }

    warnings.push(...result.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
