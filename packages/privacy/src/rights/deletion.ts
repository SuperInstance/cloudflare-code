/**
 * Right to Erasure Implementation (GDPR Article 17)
 * @packageDocumentation
 */

import type {
  RightToErasureRequest,
  DataErasureResult,
  ErasureException,
  ErasureExceptionReason,
  DataCategory,
  RequestScope,
} from './types';

export interface Env {
  PRIVACY_ERASURE: DurableObjectNamespace;
  PRIVACY_KV: KVNamespace;
  PRIVACY_DB?: D1Database;
}

// ============================================================================
// RIGHT TO ERASURE DURABLE OBJECT
// ============================================================================

/**
 * Right to Erasure Durable Object
 * Implements GDPR Article 17: Right to erasure ("right to be forgotten")
 */
export class RightToErasure implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case path === '/erasure/request' && request.method === 'POST':
          return this.handleCreateRequest(request);
        case path.startsWith('/erasure/request/') && request.method === 'GET':
          const requestId = path.split('/').pop();
          return this.handleGetRequest(requestId!);
        case path === '/erasure/execute' && request.method === 'POST':
          return this.handleExecuteErasure(request);
        case path === '/erasure/verify' && request.method === 'POST':
          return this.handleVerifyIdentity(request);
        case path === '/erasure/progress' && request.method === 'GET':
          return this.handleGetProgress(url);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Right to erasure error:', error);
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
  // REQUEST CREATION
  // ========================================================================

  /**
   * Create a right to erasure request
   * GDPR Article 17(1): Data subject has right to obtain erasure of personal data
   */
  private async handleCreateRequest(request: Request): Promise<Response> {
    const body = await request.json();
    const { subjectId, scope, grounds, reason, options } = body;

    // Validate required fields
    if (!subjectId || !scope || !grounds || !Array.isArray(grounds)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: subjectId, scope, grounds' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create request
    const now = Date.now();
    const erasureRequest: RightToErasureRequest = {
      id: crypto.randomUUID(),
      subjectId,
      rightType: 'right_to_erasure' as any,
      status: 'awaiting_verification' as any,
      createdAt: now,
      updatedAt: now,
      priority: 'high' as any, // Erasure requests are high priority
      reason,
      details: options?.details,
      scope,
      verification: {
        verified: false,
        method: options?.verificationMethod || 'email' as any,
        attempts: 0,
        maxAttempts: 3,
      },
      stepsCompleted: [],
      stepsRemaining: [
        'verify_identity',
        'check_legal_holds',
        'identify_data_locations',
        'backup_data',
        'erase_primary_data',
        'erase_backup_data',
        'erase_third_party_data',
        'verify_erasure',
        'generate_certificate',
      ],
      estimatedCompletion: now + 30 * 24 * 60 * 60 * 1000, // 30 days (GDPR requirement)
      metadata: options?.metadata,
      grounds,
      legalHoldOverride: options?.legalHoldOverride || false,
      notifyThirdParties: options?.notifyThirdParties ?? true,
      searchEngineRemoval: options?.searchEngineRemoval || false,
    };

    // Store request
    await this.storeRequest(erasureRequest);

    // Initiate verification
    await this.initiateVerification(erasureRequest);

    return new Response(
      JSON.stringify({
        success: true,
        request: {
          id: erasureRequest.id,
          status: erasureRequest.status,
          estimatedCompletion: erasureRequest.estimatedCompletion,
          verificationToken: erasureRequest.verification.verificationToken,
        },
        message: 'Erasure request created. Please verify your identity to proceed.',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get request details
   */
  private async handleGetRequest(requestId: string): Promise<Response> {
    const request = await this.getRequest(requestId);

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ request }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // ERASURE EXECUTION
  // ========================================================================

  /**
   * Execute data erasure
   * GDPR Article 17(1): Controller must erase personal data without undue delay
   */
  private async handleExecuteErasure(request: Request): Promise<Response> {
    const body = await request.json();
    const { requestId, verificationToken } = body;

    // Get request
    const erasureRequest = await this.getRequest(requestId);
    if (!erasureRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify identity
    if (!erasureRequest.verification.verified) {
      return new Response(
        JSON.stringify({ error: 'Identity not verified' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already completed
    if (erasureRequest.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Erasure already completed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    erasureRequest.status = 'processing' as any;
    erasureRequest.updatedAt = Date.now();
    await this.storeRequest(erasureRequest);

    // Execute erasure in background
    const erasureResult = await this.executeErasure(erasureRequest);

    return new Response(
      JSON.stringify({
        success: true,
        result: erasureResult,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Execute erasure process
   */
  async executeErasure(request: RightToErasureRequest): Promise<DataErasureResult> {
    const results: DataErasureResult = {
      requestId: request.id,
      subjectId: request.subjectId,
      erasedAt: Date.now(),
      recordsDeleted: 0,
      recordsAnonymized: 0,
      dataCategories: request.scope.dataCategories,
      systems: [],
      thirdPartiesNotified: [],
      exceptions: [],
    };

    // Step 1: Check legal holds
    request.stepsCompleted.push('check_legal_holds');
    const legalHolds = await this.checkLegalHolds(request.subjectId);
    if (legalHolds.length > 0 && !request.legalHoldOverride) {
      // Cannot delete due to legal holds
      for (const hold of legalHolds) {
        results.exceptions.push({
          recordId: hold.recordId,
          reason: 'legal_hold' as any,
          legalBasis: hold.reason,
          deletableAfter: hold.expiresAt,
        });
      }

      request.status = 'partially_completed' as any;
      await this.storeRequest(request);
      return results;
    }

    // Step 2: Identify data locations
    request.stepsCompleted.push('identify_data_locations');
    const dataLocations = await this.identifyDataLocations(request.subjectId, request.scope);

    // Step 3: Backup data (before deletion)
    request.stepsCompleted.push('backup_data');
    await this.backupData(request.subjectId, dataLocations);

    // Step 4: Erase primary data
    request.stepsCompleted.push('erase_primary_data');
    for (const location of dataLocations) {
      const deletionResult = await this.eraseData(location);
      results.recordsDeleted += deletionResult.deleted;
      results.recordsAnonymized += deletionResult.anonymized;
      if (!results.systems.includes(location.system)) {
        results.systems.push(location.system);
      }
    }

    // Step 5: Erase backup data
    request.stepsCompleted.push('erase_backup_data');
    const backupResult = await this.eraseBackupData(request.subjectId);
    results.recordsDeleted += backupResult.deleted;

    // Step 6: Notify third parties
    request.stepsCompleted.push('erase_third_party_data');
    if (request.notifyThirdParties) {
      const notified = await this.notifyThirdParties(request);
      results.thirdPartiesNotified = notified;
    }

    // Step 7: Verify erasure
    request.stepsCompleted.push('verify_erasure');
    const verificationResult = await this.verifyErasure(request.subjectId, request.scope);
    results.exceptions.push(...verificationResult.exceptions);

    // Step 8: Generate certificate
    request.stepsCompleted.push('generate_certificate');
    await this.generateErasureCertificate(results);

    // Update request status
    request.status = 'completed' as any;
    request.completedAt = Date.now();
    request.updatedAt = Date.now();
    request.stepsRemaining = [];
    await this.storeRequest(request);

    return results;
  }

  /**
   * Check for legal holds on data
   * GDPR Article 17(3): Erasure not required for legal obligations
   */
  async checkLegalHolds(subjectId: string): Promise<LegalHold[]> {
    const holds: LegalHold[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, reason, expires_at FROM legal_holds WHERE subject_id = ? AND active = 1'
        ).bind(subjectId).all();

        for (const row of result.results) {
          holds.push({
            recordId: row.id as string,
            reason: row.reason as string,
            expiresAt: row.expires_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error checking legal holds:', error);
    }

    return holds;
  }

  /**
   * Identify all locations where data is stored
   */
  async identifyDataLocations(subjectId: string, scope: RequestScope): Promise<DataLocation[]> {
    const locations: DataLocation[] = [];

    // Check database
    if (this.env.PRIVACY_DB) {
      for (const category of scope.dataCategories) {
        const tables = this.getTablesForCategory(category);
        for (const table of tables) {
          locations.push({
            system: 'database',
            location: `table:${table}`,
            category,
            subjectId,
          });
        }
      }
    }

    // Check KV storage
    try {
      const keys = await this.env.PRIVACY_KV.list({
        prefix: `user:${subjectId}:`,
      });

      for (const key of keys.keys) {
        locations.push({
          system: 'kv_storage',
          location: key.name,
          category: DataCategory.TECHNICAL_DATA,
          subjectId,
        });
      }
    } catch (error) {
      console.error('Error identifying KV locations:', error);
    }

    // Check Durable Objects
    locations.push({
      system: 'durable_object',
      location: `consent_manager:${subjectId}`,
      category: DataCategory.PERSONAL_DATA,
      subjectId,
    });

    return locations;
  }

  /**
   * Get database tables for a data category
   */
  private getTablesForCategory(category: DataCategory): string[] {
    const tableMap: Record<DataCategory, string[]> = {
      [DataCategory.PERSONAL_DATA]: ['users', 'profiles'],
      [DataCategory.IDENTIFICATION_DATA]: ['identification'],
      [DataCategory.CONTACT_DATA]: ['contacts'],
      [DataCategory.FINANCIAL_DATA]: ['financial_data', 'transactions', 'payments'],
      [DataCategory.TECHNICAL_DATA]: ['sessions', 'devices'],
      [DataCategory.PROFILE_DATA]: ['profiles', 'preferences'],
      [DataCategory.USAGE_DATA]: ['usage_logs', 'activity_logs'],
      [DataCategory.LOCATION_DATA]: ['location_data', 'geolocation'],
      [DataCategory.HEALTH_DATA]: ['health_data'],
      [DataCategory.BIOMETRIC_DATA]: ['biometrics'],
      [DataCategory.COMMUNICATION_DATA]: ['communications', 'messages'],
      [DataCategory.TRANSACTION_DATA]: ['transactions', 'orders'],
      [DataCategory.BEHAVIORAL_DATA]: ['behavioral_data', 'analytics_events'],
      [DataCategory.DERIVED_DATA]: ['derived_data', 'profiles_computed'],
      [DataCategory.SOCIAL_DATA]: ['social_connections', 'social_profiles'],
      [DataCategory.EMPLOYMENT_DATA]: ['employment_data'],
      [DataCategory.EDUCATION_DATA]: ['education_data'],
    };

    return tableMap[category] || [];
  }

  /**
   * Backup data before deletion
   */
  async backupData(subjectId: string, locations: DataLocation[]): Promise<void> {
    const backupId = crypto.randomUUID();

    for (const location of locations) {
      try {
        let data: any = null;

        if (location.system === 'database') {
          if (this.env.PRIVACY_DB) {
            const table = location.location.replace('table:', '');
            const result = await this.env.PRIVACY_DB.prepare(
              `SELECT * FROM ${table} WHERE user_id = ?`
            ).bind(subjectId).all();

            data = result.results;
          }
        } else if (location.system === 'kv_storage') {
          data = await this.env.PRIVACY_KV.get(location.location, 'json');
        }

        if (data) {
          // Store backup
          const backupKey = `backup:${backupId}:${location.system}:${location.location}`;
          await this.state.storage.put(backupKey, {
            location,
            data,
            backedUpAt: Date.now(),
          });
        }
      } catch (error) {
        console.error(`Error backing up ${location.location}:`, error);
      }
    }

    // Store backup metadata
    await this.state.storage.put(`backup:${backupId}:metadata`, {
      subjectId,
      locations,
      backupId,
      createdAt: Date.now(),
    });
  }

  /**
   * Erase data from a specific location
   */
  async eraseData(location: DataLocation): Promise<{ deleted: number; anonymized: number }> {
    let deleted = 0;
    let anonymized = 0;

    try {
      if (location.system === 'database') {
        if (this.env.PRIVACY_DB) {
          const table = location.location.replace('table:', '');

          // Try to delete first
          try {
            const result = await this.env.PRIVACY_DB.prepare(
              `DELETE FROM ${table} WHERE user_id = ?`
            ).bind(location.subjectId).run();

            deleted = result.meta.changes || 0;
          } catch (error) {
            // If deletion fails (e.g., foreign key constraints), anonymize instead
            console.log(`Could not delete from ${table}, anonymizing instead`);
            const anonymizeResult = await this.anonymizeData(location);
            deleted = anonymizeResult.deleted;
            anonymized = anonymizeResult.anonymized;
          }
        }
      } else if (location.system === 'kv_storage') {
        await this.env.PRIVACY_KV.delete(location.location);
        deleted = 1;
      } else if (location.system === 'durable_object') {
        // For DOs, we need to send a delete request
        // This would be implemented via DO-to-DO communication
        deleted = 1;
      }
    } catch (error) {
      console.error(`Error erasing from ${location.location}:`, error);
    }

    return { deleted, anonymized };
  }

  /**
   * Anonymize data when deletion is not possible
   * GDPR Recital 26: Principles relating to personal data should not apply to anonymous data
   */
  async anonymizeData(location: DataLocation): Promise<{ deleted: number; anonymized: number }> {
    let anonymized = 0;

    try {
      if (location.system === 'database' && this.env.PRIVACY_DB) {
        const table = location.location.replace('table:', '');
        const fields = this.getAnonymizeFields(table);

        for (const field of fields) {
          const result = await this.env.PRIVACY_DB.prepare(
            `UPDATE ${table} SET ${field} = ? WHERE user_id = ?`
          ).bind(this.getAnonymizedValue(field), location.subjectId).run();

          anonymized += result.meta.changes || 0;
        }
      }
    } catch (error) {
      console.error(`Error anonymizing ${location.location}:`, error);
    }

    return { deleted: 0, anonymized };
  }

  /**
   * Get fields to anonymize for a table
   */
  private getAnonymizeFields(table: string): string[] {
    const fieldMap: Record<string, string[]> = {
      users: ['name', 'email', 'phone'],
      profiles: ['display_name', 'bio', 'avatar_url'],
      contacts: ['email', 'phone', 'address', 'city', 'postal_code'],
      identification: ['government_id', 'passport_number'],
    };

    return fieldMap[table] || [];
  }

  /**
   * Get anonymized value for a field
   */
  private getAnonymizedValue(field: string): string {
    if (field.includes('email')) {
      return `deleted-${crypto.randomUUID()}@deleted.local`;
    } else if (field.includes('phone')) {
      return '+0000000000';
    } else if (field.includes('name')) {
      return '[DELETED]';
    } else if (field.includes('id')) {
      return 'DELETED';
    } else {
      return '[ANONYMIZED]';
    }
  }

  /**
   * Erase backup data
   */
  async eraseBackupData(subjectId: string): Promise<{ deleted: number }> {
    let deleted = 0;

    // Get all backups for this subject
    const backups = await this.state.storage.list({
      prefix: `backup:`,
    });

    for (const key of backups.keys) {
      const backup = await this.state.storage.get<any>(key.name);
      if (backup && backup.subjectId === subjectId) {
        await this.state.storage.delete(key.name);
        deleted++;
      }
    }

    return { deleted };
  }

  /**
   * Notify third parties of erasure request
   * GDPR Article 17(2): Controller must communicate erasure to third parties
   */
  async notifyThirdParties(request: RightToErasureRequest): Promise<string[]> {
    const notified: string[] = [];

    // Identify third parties
    const thirdParties = await this.identifyThirdParties(request.subjectId, request.scope);

    // Notify each third party
    for (const thirdParty of thirdParties) {
      try {
        await this.sendErasureNotification(thirdParty, request);
        notified.push(thirdParty.name);
      } catch (error) {
        console.error(`Error notifying ${thirdParty.name}:`, error);
      }
    }

    return notified;
  }

  /**
   * Identify third parties that have received data
   */
  async identifyThirdParties(
    subjectId: string,
    scope: RequestScope
  ): Promise<ThirdParty[]> {
    const thirdParties: ThirdParty[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT DISTINCT third_party_name, third_party_contact, data_transferred_at FROM data_sharing_log WHERE subject_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          thirdParties.push({
            name: row.third_party_name as string,
            contact: row.third_party_contact as string,
            dataTransferredAt: row.data_transferred_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error identifying third parties:', error);
    }

    return thirdParties;
  }

  /**
   * Send erasure notification to third party
   */
  async sendErasureNotification(
    thirdParty: ThirdParty,
    request: RightToErasureRequest
  ): Promise<void> {
    // In real implementation, this would send an email, API call, etc.
    const notification = {
      thirdParty: thirdParty.name,
      contact: thirdParty.contact,
      subjectId: request.subjectId,
      requestId: request.id,
      grounds: request.grounds,
      dateRange: request.scope.dateRange,
      dataCategories: request.scope.dataCategories,
      sentAt: Date.now(),
    };

    console.log('Erasure notification:', notification);

    // Log the notification
    await this.state.storage.put(
      `notification:${request.id}:${thirdParty.name}`,
      notification
    );
  }

  /**
   * Verify that erasure was successful
   */
  async verifyErasure(
    subjectId: string,
    scope: RequestScope
  ): Promise<{ exceptions: ErasureException[] }> {
    const exceptions: ErasureException[] = [];

    // Check each data category
    for (const category of scope.dataCategories) {
      const remaining = await this.checkRemainingData(subjectId, category);

      if (remaining > 0) {
        exceptions.push({
          recordId: `${category}_verification`,
          reason: 'data_still_present' as any,
          legalBasis: 'Data could not be completely erased, verification required',
        });
      }
    }

    return { exceptions };
  }

  /**
   * Check if any data remains for a category
   */
  async checkRemainingData(subjectId: string, category: DataCategory): Promise<number> {
    const tables = this.getTablesForCategory(category);
    let count = 0;

    if (this.env.PRIVACY_DB) {
      for (const table of tables) {
        try {
          const result = await this.env.PRIVACY_DB.prepare(
            `SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`
          ).bind(subjectId).first();

          if (result) {
            count += result.count as number;
          }
        } catch (error) {
          console.error(`Error checking ${table}:`, error);
        }
      }
    }

    return count;
  }

  /**
   * Generate erasure certificate
   * GDPR Recital 66: Data subject should be informed of erasure
   */
  async generateErasureCertificate(result: DataErasureResult): Promise<void> {
    const certificate = {
      certificateId: crypto.randomUUID(),
      requestId: result.requestId,
      subjectId: result.subjectId,
      erasedAt: result.erasedAt,
      recordsDeleted: result.recordsDeleted,
      recordsAnonymized: result.recordsAnonymized,
      dataCategories: result.dataCategories,
      systems: result.systems,
      thirdPartiesNotified: result.thirdPartiesNotified,
      exceptions: result.exceptions,
      generatedAt: Date.now(),
    };

    // Store certificate
    await this.state.storage.put(`certificate:${result.requestId}`, certificate);

    // In real implementation, send certificate to data subject
    console.log('Erasure certificate generated:', certificate);
  }

  // ========================================================================
  // VERIFICATION
  // ========================================================================

  /**
   * Initiate identity verification
   */
  private async initiateVerification(request: RightToErasureRequest): Promise<void> {
    const token = crypto.randomUUID();

    request.verification.verificationToken = token;

    await this.storeRequest(request);

    // In real implementation, send verification email/SMS/etc.
    console.log(`Verification token for ${request.subjectId}: ${token}`);
  }

  /**
   * Verify identity
   */
  private async handleVerifyIdentity(request: Request): Promise<Response> {
    const body = await request.json();
    const { requestId, verificationToken } = body;

    const erasureRequest = await this.getRequest(requestId);
    if (!erasureRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check token
    if (erasureRequest.verification.verificationToken !== verificationToken) {
      erasureRequest.verification.attempts += 1;

      if (erasureRequest.verification.attempts >= erasureRequest.verification.maxAttempts) {
        erasureRequest.status = 'rejected' as any;
        await this.storeRequest(erasureRequest);

        return new Response(
          JSON.stringify({ error: 'Too many verification attempts' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await this.storeRequest(erasureRequest);

      return new Response(
        JSON.stringify({ error: 'Invalid verification token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    erasureRequest.verification.verified = true;
    erasureRequest.verification.verifiedAt = Date.now();
    erasureRequest.status = 'processing' as any;
    erasureRequest.updatedAt = Date.now();

    await this.storeRequest(erasureRequest);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Identity verified successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get erasure progress
   */
  private async handleGetProgress(url: URL): Promise<Response> {
    const requestId = url.searchParams.get('requestId');
    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const request = await this.getRequest(requestId);

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const progress = {
      status: request.status,
      stepsCompleted: request.stepsCompleted,
      stepsRemaining: request.stepsRemaining,
      progressPercent: Math.round(
        (request.stepsCompleted.length /
          (request.stepsCompleted.length + request.stepsRemaining.length)) *
          100
      ),
    };

    return new Response(
      JSON.stringify({ progress }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // STORAGE OPERATIONS
  // ========================================================================

  /**
   * Store request
   */
  private async storeRequest(request: RightToErasureRequest): Promise<void> {
    const key = `request:${request.id}`;
    await this.state.storage.put(key, request);

    // Index by subject
    const subjectKey = `subject:${request.subjectId}:requests`;
    const requests = (await this.state.storage.get<string[]>(subjectKey)) || [];
    requests.push(request.id);
    await this.state.storage.put(subjectKey, requests);
  }

  /**
   * Get request
   */
  private async getRequest(requestId: string): Promise<RightToErasureRequest | null> {
    const key = `request:${requestId}`;
    return await this.state.storage.get<RightToErasureRequest>(key);
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

interface LegalHold {
  recordId: string;
  reason: string;
  expiresAt: number;
}

interface DataLocation {
  system: string;
  location: string;
  category: DataCategory;
  subjectId: string;
}

interface ThirdParty {
  name: string;
  contact: string;
  dataTransferredAt: number;
}
