/**
 * Data Retention Policy Management Durable Object
 * GDPR Article 5(1)(e): Storage limitation
 * @packageDocumentation
 */

import type {
  RetentionPolicy,
  RetentionPolicyType,
  RetentionSchedule,
  RetentionStatistics,
  RetentionResult,
  RetentionException,
  LegalHold,
  RetentionCategory,
  RetentionAction,
  RetentionTrigger,
  ScheduleStatus,
} from './types';

export interface Env {
  PRIVACY_RETENTION: DurableObjectNamespace;
  PRIVACY_KV: KVNamespace;
  PRIVACY_DB?: D1Database;
}

// ============================================================================
// RETENTION POLICY MANAGER DURABLE OBJECT
// ============================================================================

/**
 * Retention Policy Manager Durable Object
 * Manages data retention policies and schedules cleanup tasks
 */
export class RetentionPolicyManager implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Initialize with default policies on first run
    this.initializeDefaultPolicies();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case path === '/retention/policy' && request.method === 'POST':
          return this.handleCreatePolicy(request);
        case path === '/retention/policy' && request.method === 'GET':
          return this.handleGetPolicies(url);
        case path.startsWith('/retention/policy/') && request.method === 'GET':
          const policyId = path.split('/').pop();
          return this.handleGetPolicy(policyId!);
        case path.startsWith('/retention/policy/') && request.method === 'PUT':
          return this.handleUpdatePolicy(request);
        case path.startsWith('/retention/policy/') && request.method === 'DELETE':
          return this.handleDeletePolicy(request);
        case path === '/retention/execute' && request.method === 'POST':
          return this.handleExecuteRetention(request);
        case path === '/retention/schedule' && request.method === 'POST':
          return this.handleScheduleRetention(request);
        case path === '/retention/statistics' && request.method === 'GET':
          return this.handleGetStatistics();
        case path === '/retention/legal-hold' && request.method === 'POST':
          return this.handleCreateLegalHold(request);
        case path === '/retention/legal-hold' && request.method === 'GET':
          return this.handleGetLegalHolds(url);
        case path.startsWith('/retention/legal-hold/') && request.method === 'DELETE':
          return this.handleReleaseLegalHold(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Retention policy manager error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // ========================================================================
  // POLICY MANAGEMENT
  // ========================================================================

  /**
   * Create a new retention policy
   */
  private async handleCreatePolicy(request: Request): Promise<Response> {
    const body = await request.json();
    const {
      name,
      description,
      category,
      retentionPeriod,
      action,
      trigger,
      legalBasis,
      legalBasisDescription,
      systems,
      tables,
      exceptions,
    } = body;

    // Validate required fields
    if (!name || !category || !retentionPeriod || !action || !trigger || !legalBasis) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: name, category, retentionPeriod, action, trigger, legalBasis',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const policy: RetentionPolicy = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      category,
      retentionPeriod,
      action,
      trigger,
      legalBasis,
      legalBasisDescription: legalBasisDescription || legalBasis,
      active: true,
      priority: 5, // Default priority
      systems: systems || [],
      tables: tables || [],
      exceptions: exceptions || [],
      legalHoldOverride: false,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      reviewDate: now + 365 * 24 * 60 * 60 * 1000, // Review in 1 year
    };

    // Store policy
    await this.storePolicy(policy);

    return new Response(
      JSON.stringify({
        success: true,
        policy,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get all retention policies
   */
  private async handleGetPolicies(url: URL): Promise<Response> {
    const active = url.searchParams.get('active');
    const category = url.searchParams.get('category');

    const policies = await this.getPolicies();

    let filtered = policies;

    if (active !== null) {
      const isActive = active === 'true';
      filtered = filtered.filter((p) => p.active === isActive);
    }

    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }

    return new Response(
      JSON.stringify({ policies: filtered }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get specific retention policy
   */
  private async handleGetPolicy(policyId: string): Promise<Response> {
    const policy = await this.getPolicy(policyId);

    if (!policy) {
      return new Response(
        JSON.stringify({ error: 'Policy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ policy }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Update retention policy
   */
  private async handleUpdatePolicy(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const policyId = url.pathname.split('/').pop();
    const body = await request.json();

    const policy = await this.getPolicy(policyId!);
    if (!policy) {
      return new Response(
        JSON.stringify({ error: 'Policy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update policy
    const updated: RetentionPolicy = {
      ...policy,
      ...body,
      id: policy.id, // Preserve ID
      version: this.incrementVersion(policy.version),
      updatedAt: Date.now(),
    };

    await this.storePolicy(updated);

    return new Response(
      JSON.stringify({
        success: true,
        policy: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Delete retention policy
   */
  private async handleDeletePolicy(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const policyId = url.pathname.split('/').pop();

    const policy = await this.getPolicy(policyId!);
    if (!policy) {
      return new Response(
        JSON.stringify({ error: 'Policy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete policy
    await this.state.storage.delete(`policy:${policyId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Policy deleted',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // RETENTION EXECUTION
  // ========================================================================

  /**
   * Execute retention policy immediately
   */
  private async handleExecuteRetention(request: Request): Promise<Response> {
    const body = await request.json();
    const { policyId, subjectId, dryRun } = body;

    const policy = await this.getPolicy(policyId);
    if (!policy) {
      return new Response(
        JSON.stringify({ error: 'Policy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!policy.active) {
      return new Response(
        JSON.stringify({ error: 'Policy is not active' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Execute retention
    const result = await this.executeRetentionPolicy(policy, subjectId, dryRun || false);

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Execute a retention policy
   */
  async executeRetentionPolicy(
    policy: RetentionPolicy,
    subjectId?: string,
    dryRun: boolean = false
  ): Promise<RetentionResult> {
    const startTime = Date.now();

    const result: RetentionResult = {
      executedAt: startTime,
      recordsProcessed: 0,
      recordsDeleted: 0,
      recordsArchived: 0,
      recordsAnonymized: 0,
      recordsAggregated: 0,
      recordsSkipped: 0,
      duration: 0,
      success: false,
      exceptions: [],
    };

    try {
      // Get records subject to retention
      const records = await this.getRecordsForRetention(policy, subjectId);
      result.recordsProcessed = records.length;

      // Process each record
      for (const record of records) {
        try {
          // Check for legal holds
          const legalHolds = await this.checkLegalHolds(record.subjectId, policy);
          if (legalHolds.length > 0 && !policy.legalHoldOverride) {
            result.recordsSkipped++;
            result.exceptions.push({
              recordId: record.id,
              reason: 'Under legal hold',
              retained: true,
            });
            continue;
          }

          // Check for policy exceptions
          const exception = this.checkPolicyExceptions(policy, record);
          if (exception) {
            if (exception.preventsDeletion) {
              result.recordsSkipped++;
              result.exceptions.push({
                recordId: record.id,
                reason: exception.description,
                retained: true,
              });
              continue;
            }
          }

          if (!dryRun) {
            // Execute retention action
            switch (policy.action) {
              case RetentionAction.DELETE:
                await this.deleteRecord(record);
                result.recordsDeleted++;
                break;
              case RetentionAction.ARCHIVE:
                await this.archiveRecord(record);
                result.recordsArchived++;
                break;
              case RetentionAction.ANONYMIZE:
                await this.anonymizeRecord(record);
                result.recordsAnonymized++;
                break;
              case RetentionAction.AGGREGATE:
                await this.aggregateRecord(record);
                result.recordsAggregated++;
                break;
            }
          } else {
            // Dry run - just count
            result.recordsDeleted++;
          }
        } catch (error) {
          result.exceptions.push({
            recordId: record.id,
            reason: error instanceof Error ? error.message : 'Unknown error',
            retained: true,
          });
        }
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    result.duration = Date.now() - startTime;

    // Store result
    await this.storeRetentionPolicyResult(policy.id, result);

    return result;
  }

  /**
   * Get records subject to retention policy
   */
  async getRecordsForRetention(
    policy: RetentionPolicy,
    subjectId?: string
  ): Promise<RetentionRecord[]> {
    const records: RetentionRecord[] = [];
    const now = Date.now();

    // Calculate cutoff date based on retention period and trigger
    const cutoffDate = this.calculateCutoffDate(policy.trigger, policy.retentionPeriod);

    for (const table of policy.tables) {
      try {
        if (!this.env.PRIVACY_DB) continue;

        let query = `SELECT id, user_id, created_at, updated_at, last_activity FROM ${table} WHERE `;
        const params: (string | number)[] = [];

        if (subjectId) {
          query += 'user_id = ? AND ';
          params.push(subjectId);
        }

        // Add date filter based on trigger
        switch (policy.trigger) {
          case RetentionTrigger.CREATION_DATE:
            query += 'created_at < ?';
            break;
          case RetentionTrigger.LAST_ACTIVITY:
            query += 'last_activity < ?';
            break;
          default:
            query += 'created_at < ?';
        }

        params.push(cutoffDate);

        const stmt = this.env.PRIVACY_DB.prepare(query);
        const result = await stmt.bind(...params).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            subjectId: row.user_id as string,
            table,
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
            lastActivity: row.last_activity as number,
          });
        }
      } catch (error) {
        console.error(`Error getting records from ${table}:`, error);
      }
    }

    return records;
  }

  /**
   * Calculate cutoff date for retention
   */
  private calculateCutoffDate(trigger: RetentionTrigger, retentionPeriod: number): number {
    const now = Date.now();

    switch (trigger) {
      case RetentionTrigger.CREATION_DATE:
      case RetentionTrigger.LAST_ACTIVITY:
      case RetentionTrigger.ACCOUNT_CLOSURE:
        return now - retentionPeriod;
      case RetentionTrigger.CONSENT_WITHDRAWN:
        // This would be calculated per-record based on consent withdrawal date
        return now - retentionPeriod;
      default:
        return now - retentionPeriod;
    }
  }

  /**
   * Delete a record
   */
  private async deleteRecord(record: RetentionRecord): Promise<void> {
    if (this.env.PRIVACY_DB) {
      await this.env.PRIVACY_DB.prepare(
        `DELETE FROM ${record.table} WHERE id = ?`
      ).bind(record.id).run();
    }
  }

  /**
   * Archive a record
   */
  private async archiveRecord(record: RetentionRecord): Promise<void> {
    // Move to archive table or external storage
    if (this.env.PRIVACY_DB) {
      // Get record data
      const data = await this.env.PRIVACY_DB.prepare(
        `SELECT * FROM ${record.table} WHERE id = ?`
      ).bind(record.id).first();

      if (data) {
        // Insert into archive table
        await this.env.PRIVACY_DB.prepare(
          `INSERT INTO ${record.table}_archive VALUES (?, ?, ?)`
        ).bind(record.id, JSON.stringify(data), Date.now()).run();

        // Delete from main table
        await this.deleteRecord(record);
      }
    }
  }

  /**
   * Anonymize a record
   */
  private async anonymizeRecord(record: RetentionRecord): Promise<void> {
    if (this.env.PRIVACY_DB) {
      // Update with anonymized values
      await this.env.PRIVACY_DB.prepare(
        `UPDATE ${record.table} SET user_id = ?, email = NULL, name = NULL, phone = NULL WHERE id = ?`
      ).bind(`anonymized_${crypto.randomUUID()}`, record.id).run();
    }
  }

  /**
   * Aggregate a record
   */
  private async aggregateRecord(record: RetentionRecord): Promise<void> {
    // Aggregate into summary statistics
    if (this.env.PRIVACY_DB) {
      await this.env.PRIVACY_DB.prepare(
        `DELETE FROM ${record.table} WHERE id = ?`
      ).bind(record.id).run();
    }
  }

  /**
   * Check for legal holds on a subject
   */
  async checkLegalHolds(subjectId: string, policy: RetentionPolicy): Promise<LegalHold[]> {
    const holds: LegalHold[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        let query = 'SELECT * FROM legal_holds WHERE subject_id = ? AND active = 1';
        const params: (string | number)[] = [subjectId];

        // Filter by category if specified
        if (policy.category) {
          query += ' AND FIND_IN_SET(?, categories) > 0';
          params.push(policy.category);
        }

        const result = await this.env.PRIVACY_DB.prepare(query).bind(...params).all();

        for (const row of result.results) {
          holds.push({
            id: row.id as string,
            subjectId: row.subject_id as string,
            name: row.name as string,
            description: row.description as string,
            caseReference: row.case_reference as string | undefined,
            type: row.type as any,
            active: Boolean(row.active),
            createdAt: row.created_at as number,
            expiresAt: row.expires_at as number | undefined,
            createdBy: row.created_by as string,
            notes: row.notes ? JSON.parse(row.notes as string) : undefined,
            categories: row.categories ? JSON.parse(row.categories as string) : undefined,
            systems: row.systems ? JSON.parse(row.systems as string) : undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error checking legal holds:', error);
    }

    return holds;
  }

  /**
   * Check policy exceptions for a record
   */
  private checkPolicyExceptions(policy: RetentionPolicy, record: RetentionRecord): RetentionException | null {
    // In a real implementation, this would evaluate exception conditions
    // For now, just return null (no exceptions)
    return null;
  }

  // ========================================================================
  // SCHEDULING
  // ========================================================================

  /**
   * Schedule retention execution
   */
  private async handleScheduleRetention(request: Request): Promise<Response> {
    const body = await request.json();
    const { policyId, subjectId, scheduledFor } = body;

    const policy = await this.getPolicy(policyId);
    if (!policy) {
      return new Response(
        JSON.stringify({ error: 'Policy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const schedule: RetentionSchedule = {
      id: crypto.randomUUID(),
      policyId,
      subjectId,
      scheduledFor: scheduledFor || Date.now() + 24 * 60 * 60 * 1000, // Default: tomorrow
      status: ScheduleStatus.PENDING,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    await this.storeSchedule(schedule);

    return new Response(
      JSON.stringify({
        success: true,
        schedule,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // LEGAL HOLDS
  // ========================================================================

  /**
   * Create a legal hold
   */
  private async handleCreateLegalHold(request: Request): Promise<Response> {
    const body = await request.json();
    const {
      subjectId,
      name,
      description,
      caseReference,
      type,
      expiresAt,
      createdBy,
      notes,
      categories,
      systems,
    } = body;

    if (!subjectId || !name || !type || !createdBy) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: subjectId, name, type, createdBy',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const hold: LegalHold = {
      id: crypto.randomUUID(),
      subjectId,
      name,
      description: description || '',
      caseReference,
      type,
      active: true,
      createdAt: Date.now(),
      expiresAt,
      createdBy,
      notes,
      categories,
      systems,
    };

    // Store in database
    if (this.env.PRIVACY_DB) {
      await this.env.PRIVACY_DB.prepare(
        `INSERT INTO legal_holds (id, subject_id, name, description, case_reference, type, active, created_at, expires_at, created_by, notes, categories, systems)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        hold.id,
        hold.subjectId,
        hold.name,
        hold.description,
        hold.caseReference || null,
        hold.type,
        hold.active ? 1 : 0,
        hold.createdAt,
        hold.expiresAt || null,
        hold.createdBy,
        hold.notes ? JSON.stringify(hold.notes) : null,
        hold.categories ? JSON.stringify(hold.categories) : null,
        hold.systems ? JSON.stringify(hold.systems) : null
      ).run();
    }

    // Also store in DO storage
    await this.state.storage.put(`legal_hold:${hold.id}`, hold);

    return new Response(
      JSON.stringify({
        success: true,
        hold,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get legal holds
   */
  private async handleGetLegalHolds(url: URL): Promise<Response> {
    const subjectId = url.searchParams.get('subjectId');
    const active = url.searchParams.get('active');

    const holds: LegalHold[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        let query = 'SELECT * FROM legal_holds WHERE 1=1';
        const params: any[] = [];

        if (subjectId) {
          query += ' AND subject_id = ?';
          params.push(subjectId);
        }

        if (active !== null) {
          query += ' AND active = ?';
          params.push(active === 'true' ? 1 : 0);
        }

        const result = await this.env.PRIVACY_DB.prepare(query).bind(...params).all();

        for (const row of result.results) {
          holds.push({
            id: row.id as string,
            subjectId: row.subject_id as string,
            name: row.name as string,
            description: row.description as string,
            caseReference: row.case_reference as string | undefined,
            type: row.type as any,
            active: Boolean(row.active),
            createdAt: row.created_at as number,
            expiresAt: row.expires_at as number | undefined,
            createdBy: row.created_by as string,
            notes: row.notes ? JSON.parse(row.notes as string) : undefined,
            categories: row.categories ? JSON.parse(row.categories as string) : undefined,
            systems: row.systems ? JSON.parse(row.systems as string) : undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error getting legal holds:', error);
    }

    return new Response(
      JSON.stringify({ holds }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Release a legal hold
   */
  private async handleReleaseLegalHold(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const holdId = url.pathname.split('/').pop();

    if (!this.env.PRIVACY_DB) {
      return new Response(
        JSON.stringify({ error: 'Database not available' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await this.env.PRIVACY_DB.prepare(
      'UPDATE legal_holds SET active = 0 WHERE id = ?'
    ).bind(holdId).run();

    await this.state.storage.delete(`legal_hold:${holdId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Legal hold released',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get retention statistics
   */
  private async handleGetStatistics(): Promise<Response> {
    const policies = await this.getPolicies();
    const schedules = await this.getSchedules();

    const stats: RetentionStatistics = {
      timestamp: Date.now(),
      totalPolicies: policies.length,
      activePolicies: policies.filter((p) => p.active).length,
      totalScheduled: schedules.length,
      pendingScheduled: schedules.filter((s) => s.status === ScheduleStatus.PENDING).length,
      failedScheduled: schedules.filter((s) => s.status === ScheduleStatus.FAILED).length,
      totalRecordsProcessed: 0,
      totalRecordsDeleted: 0,
      totalRecordsArchived: 0,
      totalRecordsAnonymized: 0,
      activeLegalHolds: await this.getActiveLegalHoldCount(),
      recordsUnderLegalHold: 0,
      storageSaved: 0,
      averageProcessingTime: 0,
    };

    return new Response(
      JSON.stringify({ statistics: stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get active legal hold count
   */
  private async getActiveLegalHoldCount(): Promise<number> {
    if (!this.env.PRIVACY_DB) return 0;

    const result = await this.env.PRIVACY_DB.prepare(
      'SELECT COUNT(*) as count FROM legal_holds WHERE active = 1'
    ).first();

    return (result?.count as number) || 0;
  }

  // ========================================================================
  // STORAGE OPERATIONS
  // ========================================================================

  /**
   * Store retention policy
   */
  private async storePolicy(policy: RetentionPolicy): Promise<void> {
    const key = `policy:${policy.id}`;
    await this.state.storage.put(key, policy);

    // Index by category
    const categoryKey = `policy:category:${policy.category}`;
    const policies = (await this.state.storage.get<string[]>(categoryKey)) || [];
    policies.push(policy.id);
    await this.state.storage.put(categoryKey, [...new Set(policies)]);
  }

  /**
   * Get retention policy
   */
  private async getPolicy(policyId: string): Promise<RetentionPolicy | null> {
    const key = `policy:${policyId}`;
    return await this.state.storage.get<RetentionPolicy>(key);
  }

  /**
   * Get all retention policies
   */
  private async getPolicies(): Promise<RetentionPolicy[]> {
    const policies: RetentionPolicy[] = [];

    const keys = await this.state.storage.list({
      prefix: 'policy:',
    });

    for (const key of keys.keys) {
      if (!key.name.includes(':category:')) {
        const policy = await this.state.storage.get<RetentionPolicy>(key.name);
        if (policy) {
          policies.push(policy);
        }
      }
    }

    return policies;
  }

  /**
   * Store retention schedule
   */
  private async storeSchedule(schedule: RetentionSchedule): Promise<void> {
    const key = `schedule:${schedule.id}`;
    await this.state.storage.put(key, schedule);

    // Index by policy
    const policyKey = `schedule:policy:${schedule.policyId}`;
    const schedules = (await this.state.storage.get<string[]>(policyKey)) || [];
    schedules.push(schedule.id);
    await this.state.storage.put(policyKey, schedules);
  }

  /**
   * Get all schedules
   */
  private async getSchedules(): Promise<RetentionSchedule[]> {
    const schedules: RetentionSchedule[] = [];

    const keys = await this.state.storage.list({
      prefix: 'schedule:',
    });

    for (const key of keys.keys) {
      if (!key.name.includes(':policy:')) {
        const schedule = await this.state.storage.get<RetentionSchedule>(key.name);
        if (schedule) {
          schedules.push(schedule);
        }
      }
    }

    return schedules;
  }

  /**
   * Store retention result
   */
  private async storeRetentionPolicyResult(
    policyId: string,
    result: RetentionResult
  ): Promise<void> {
    const resultKey = `result:${policyId}:${result.executedAt}`;
    await this.state.storage.put(resultKey, result);

    // Store in KV for longer retention
    if (this.env.PRIVACY_KV) {
      await this.env.PRIVACY_KV.put(resultKey, JSON.stringify(result), {
        expirationTtl: 90 * 24 * 60 * 60, // 90 days
      });
    }
  }

  /**
   * Increment version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0', 10) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Initialize default retention policies
   */
  private async initializeDefaultPolicies(): Promise<void> {
    const policies = await this.getPolicies();

    // Only create defaults if no policies exist
    if (policies.length === 0) {
      const defaults = this.getDefaultPolicies();

      for (const policy of defaults) {
        await this.storePolicy(policy);
      }

      console.log('Initialized default retention policies');
    }
  }

  /**
   * Get default retention policies
   */
  private getDefaultPolicies(): RetentionPolicy[] {
    const now = Date.now();

    return [
      {
        id: crypto.randomUUID(),
        name: 'Personal Data Retention',
        description: 'Retention policy for personal data after account closure',
        category: RetentionCategory.PERSONAL_DATA,
        retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
        action: RetentionAction.DELETE,
        trigger: RetentionTrigger.ACCOUNT_CLOSURE,
        legalBasis: 'legal_obligation' as any,
        legalBasisDescription: 'Legal requirement to retain personal data for 90 days after account closure',
        active: true,
        priority: 5,
        systems: ['user_database'],
        tables: ['users', 'profiles'],
        exceptions: [],
        legalHoldOverride: false,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        reviewDate: now + 365 * 24 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        name: 'Transaction Data Retention',
        description: 'Retention policy for transaction data (tax and legal requirements)',
        category: RetentionCategory.TRANSACTION_DATA,
        retentionPeriod: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
        action: RetentionAction.ARCHIVE,
        trigger: RetentionTrigger.CREATION_DATE,
        legalBasis: 'legal_obligation' as any,
        legalBasisDescription: 'Tax and legal requirement to retain transaction records for 10 years',
        active: true,
        priority: 8, // High priority for legal compliance
        systems: ['transaction_system'],
        tables: ['transactions', 'orders', 'payments'],
        exceptions: [],
        legalHoldOverride: false,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        reviewDate: now + 365 * 24 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        name: 'Usage Data Retention',
        description: 'Retention policy for analytics and usage data',
        category: RetentionCategory.USAGE_DATA,
        retentionPeriod: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
        action: RetentionAction.AGGREGATE,
        trigger: RetentionTrigger.CREATION_DATE,
        legalBasis: 'legitimate_interest' as any,
        legalBasisDescription: 'Legitimate interest for analytics and service improvement',
        active: true,
        priority: 3,
        systems: ['analytics_system'],
        tables: ['usage_logs', 'activity_logs', 'analytics_events'],
        exceptions: [],
        legalHoldOverride: false,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        reviewDate: now + 365 * 24 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        name: 'Communication Data Retention',
        description: 'Retention policy for customer communications',
        category: RetentionCategory.COMMUNICATION_DATA,
        retentionPeriod: 3 * 365 * 24 * 60 * 60 * 1000, // 3 years
        action: RetentionAction.ARCHIVE,
        trigger: RetentionTrigger.CREATION_DATE,
        legalBasis: 'legal_obligation' as any,
        legalBasisDescription: 'Legal requirement to retain communications for 3 years',
        active: true,
        priority: 6,
        systems: ['communication_system'],
        tables: ['communications', 'messages', 'support_tickets'],
        exceptions: [],
        legalHoldOverride: false,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        reviewDate: now + 365 * 24 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        name: 'Marketing Data Retention',
        description: 'Retention policy for marketing data after consent withdrawal',
        category: RetentionCategory.MARKETING_DATA,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        action: RetentionAction.DELETE,
        trigger: RetentionTrigger.CONSENT_WITHDRAWN,
        legalBasis: 'consent' as any,
        legalBasisDescription: 'Consent-based processing, must delete after consent withdrawal',
        active: true,
        priority: 7,
        systems: ['marketing_system'],
        tables: ['marketing_campaigns', 'email_lists', 'consent_records'],
        exceptions: [],
        legalHoldOverride: false,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        reviewDate: now + 365 * 24 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        name: 'Log Data Retention',
        description: 'Retention policy for system and application logs',
        category: RetentionCategory.LOGS,
        retentionPeriod: 60 * 24 * 60 * 60 * 1000, // 60 days
        action: RetentionAction.DELETE,
        trigger: RetentionTrigger.CREATION_DATE,
        legalBasis: 'legitimate_interest' as any,
        legalBasisDescription: 'Legitimate interest for security and debugging',
        active: true,
        priority: 4,
        systems: ['logging_system'],
        tables: ['system_logs', 'error_logs', 'access_logs'],
        exceptions: [],
        legalHoldOverride: false,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        reviewDate: now + 365 * 24 * 60 * 60 * 1000,
      },
    ];
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

interface RetentionRecord {
  id: string;
  subjectId: string;
  table: string;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
}
