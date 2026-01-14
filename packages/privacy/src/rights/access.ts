/**
 * Right to Access Implementation (GDPR Article 15)
 * @packageDocumentation
 */

import type {
  RightToAccessRequest,
  DataAccessResult,
  DataSummary,
  DataRecipient,
  RetentionPeriod,
  AutomatedDecisionInfo,
  DataSource,
  DataCategory,
  OutputFormat,
  RequestScope,
} from './types';

export interface Env {
  PRIVACY_ACCESS: DurableObjectNamespace;
  PRIVACY_KV: KVNamespace;
  PRIVACY_DB?: D1Database;
}

// ============================================================================
// RIGHT TO ACCESS DURABLE OBJECT
// ============================================================================

/**
 * Right to Access Durable Object
 * Implements GDPR Article 15: Right of access by the data subject
 */
export class RightToAccess implements DurableObject {
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
        case path === '/access/request' && request.method === 'POST':
          return this.handleCreateRequest(request);
        case path.startsWith('/access/request/') && request.method === 'GET':
          const requestId = path.split('/').pop();
          return this.handleGetRequest(requestId!);
        case path === '/access/export' && request.method === 'POST':
          return this.handleExportData(request);
        case path === '/access/verify' && request.method === 'POST':
          return this.handleVerifyIdentity(request);
        case path === '/access/status' && request.method === 'GET':
          return this.handleGetStatus(url);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Right to access error:', error);
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
   * Create a right to access request
   * GDPR Article 15(1): Data subject has right to obtain confirmation
   */
  private async handleCreateRequest(request: Request): Promise<Response> {
    const body = await request.json();
    const { subjectId, scope, reason, outputFormat, options } = body;

    // Validate required fields
    if (!subjectId || !scope) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: subjectId, scope' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create request
    const now = Date.now();
    const accessRequest: RightToAccessRequest = {
      id: crypto.randomUUID(),
      subjectId,
      rightType: 'right_of_access' as any,
      status: 'awaiting_verification' as any,
      createdAt: now,
      updatedAt: now,
      priority: 'normal' as any,
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
        'collect_data',
        'compile_export',
        'review_data',
        'deliver_to_subject',
      ],
      estimatedCompletion: now + 30 * 24 * 60 * 60 * 1000, // 30 days (GDPR requirement)
      metadata: options?.metadata,
      includeCopies: options?.includeCopies ?? true,
      outputFormat: outputFormat || OutputFormat.JSON,
      includeMetadata: options?.includeMetadata ?? true,
      includePurposes: options?.includePurposes ?? true,
      includeRecipients: options?.includeRecipients ?? true,
      includeRetentionPeriod: options?.includeRetentionPeriod ?? true,
      includeRights: options?.includeRights ?? true,
      includeSources: options?.includeSources ?? true,
      includeAutomatedDecisionMaking: options?.includeAutomatedDecisionMaking ?? true,
    };

    // Store request
    await this.storeRequest(accessRequest);

    // Initiate verification
    await this.initiateVerification(accessRequest);

    return new Response(
      JSON.stringify({
        success: true,
        request: {
          id: accessRequest.id,
          status: accessRequest.status,
          estimatedCompletion: accessRequest.estimatedCompletion,
          verificationToken: accessRequest.verification.verificationToken,
        },
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
  // DATA EXPORT
  // ========================================================================

  /**
   * Export data for data subject
   * GDPR Article 15(1): Right to obtain copy of personal data
   */
  private async handleExportData(request: Request): Promise<Response> {
    const body = await request.json();
    const { requestId, verificationToken } = body;

    // Get request
    const accessRequest = await this.getRequest(requestId);
    if (!accessRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify identity
    if (!accessRequest.verification.verified) {
      return new Response(
        JSON.stringify({ error: 'Identity not verified' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Collect data from all systems
    const dataCollection = await this.collectData(accessRequest.subjectId, accessRequest.scope);

    // Compile export
    const exportResult = await this.compileExport(accessRequest, dataCollection);

    return new Response(
      JSON.stringify({
        success: true,
        export: exportResult,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Collect data from all systems for a data subject
   */
  async collectData(subjectId: string, scope: RequestScope): Promise<CollectedData> {
    const data: CollectedData = {
      subjectId,
      categories: {},
      totalRecords: 0,
      totalSize: 0,
      systems: [],
      dateRange: { earliest: Infinity, latest: 0 },
    };

    // Collect data based on requested categories
    for (const category of scope.dataCategories) {
      const categoryData = await this.collectDataByCategory(subjectId, category, scope);
      data.categories[category] = categoryData;
      data.totalRecords += categoryData.records;
      data.totalSize += categoryData.size;

      if (categoryData.dateRange) {
        data.dateRange.earliest = Math.min(data.dateRange.earliest, categoryData.dateRange.earliest);
        data.dateRange.latest = Math.max(data.dateRange.latest, categoryData.dateRange.latest);
      }

      if (categoryData.systems) {
        data.systems.push(...categoryData.systems);
      }
    }

    data.systems = [...new Set(data.systems)]; // Remove duplicates

    return data;
  }

  /**
   * Collect data by category
   */
  async collectDataByCategory(
    subjectId: string,
    category: DataCategory,
    scope: RequestScope
  ): Promise<CategoryData> {
    const data: CategoryData = {
      category,
      records: [],
      count: 0,
      size: 0,
      systems: [],
    };

    // Switch based on data category
    switch (category) {
      case DataCategory.PERSONAL_DATA:
        return await this.collectPersonalData(subjectId, scope);
      case DataCategory.IDENTIFICATION_DATA:
        return await this.collectIdentificationData(subjectId, scope);
      case DataCategory.CONTACT_DATA:
        return await this.collectContactData(subjectId, scope);
      case DataCategory.FINANCIAL_DATA:
        return await this.collectFinancialData(subjectId, scope);
      case DataCategory.TECHNICAL_DATA:
        return await this.collectTechnicalData(subjectId, scope);
      case DataCategory.PROFILE_DATA:
        return await this.collectProfileData(subjectId, scope);
      case DataCategory.USAGE_DATA:
        return await this.collectUsageData(subjectId, scope);
      case DataCategory.LOCATION_DATA:
        return await this.collectLocationData(subjectId, scope);
      case DataCategory.TRANSACTION_DATA:
        return await this.collectTransactionData(subjectId, scope);
      case DataCategory.COMMUNICATION_DATA:
        return await this.collectCommunicationData(subjectId, scope);
      case DataCategory.BEHAVIORAL_DATA:
        return await this.collectBehavioralData(subjectId, scope);
      default:
        return data;
    }
  }

  /**
   * Collect personal data
   */
  async collectPersonalData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    // In real implementation, query databases, KV, DOs, etc.
    const records: DataRecord[] = [];

    // Example: Query user profile
    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT * FROM users WHERE id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.PERSONAL_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting personal data:', error);
    }

    return {
      category: DataCategory.PERSONAL_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['user_database'],
    };
  }

  /**
   * Collect identification data
   */
  async collectIdentificationData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, name, date_of_birth, government_id FROM identification WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.IDENTIFICATION_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting identification data:', error);
    }

    return {
      category: DataCategory.IDENTIFICATION_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['identification_system'],
    };
  }

  /**
   * Collect contact data
   */
  async collectContactData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, email, phone, address, city, country, postal_code FROM contacts WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.CONTACT_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting contact data:', error);
    }

    return {
      category: DataCategory.CONTACT_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['contact_database'],
    };
  }

  /**
   * Collect financial data
   */
  async collectFinancialData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, payment_method, billing_address, transaction_history FROM financial_data WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.FINANCIAL_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting financial data:', error);
    }

    return {
      category: DataCategory.FINANCIAL_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['payment_system'],
    };
  }

  /**
   * Collect technical data
   */
  async collectTechnicalData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      // Get from KV storage
      const keys = await this.env.PRIVACY_KV.list({
        prefix: `user:${subjectId}:technical:`,
      });

      for (const key of keys.keys) {
        const data = await this.env.PRIVACY_KV.get(key.name, 'json');
        if (data) {
          records.push({
            id: key.name,
            category: DataCategory.TECHNICAL_DATA,
            data,
            source: 'kv_storage',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Error collecting technical data:', error);
    }

    return {
      category: DataCategory.TECHNICAL_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['kv_storage'],
    };
  }

  /**
   * Collect profile data
   */
  async collectProfileData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, preferences, settings, avatar, bio FROM profiles WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.PROFILE_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting profile data:', error);
    }

    return {
      category: DataCategory.PROFILE_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['profile_system'],
    };
  }

  /**
   * Collect usage data
   */
  async collectUsageData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        let query = 'SELECT id, action, page, timestamp FROM usage_logs WHERE user_id = ?';
        const params: (string | number)[] = [subjectId];

        if (scope.dateRange) {
          query += ' AND timestamp BETWEEN ? AND ?';
          params.push(scope.dateRange.from, scope.dateRange.to);
        }

        query += ' LIMIT 1000'; // Limit to 1000 records

        const stmt = this.env.PRIVACY_DB.prepare(query);
        const result = await stmt.bind(...params).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.USAGE_DATA,
            data: row,
            source: 'database',
            createdAt: row.timestamp as number,
            updatedAt: row.timestamp as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting usage data:', error);
    }

    return {
      category: DataCategory.USAGE_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['analytics_system'],
      dateRange: scope.dateRange,
    };
  }

  /**
   * Collect location data
   */
  async collectLocationData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        let query = 'SELECT id, latitude, longitude, city, country, timestamp FROM location_data WHERE user_id = ?';
        const params: (string | number)[] = [subjectId];

        if (scope.dateRange) {
          query += ' AND timestamp BETWEEN ? AND ?';
          params.push(scope.dateRange.from, scope.dateRange.to);
        }

        const stmt = this.env.PRIVACY_DB.prepare(query);
        const result = await stmt.bind(...params).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.LOCATION_DATA,
            data: row,
            source: 'database',
            createdAt: row.timestamp as number,
            updatedAt: row.timestamp as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting location data:', error);
    }

    return {
      category: DataCategory.LOCATION_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['location_system'],
    };
  }

  /**
   * Collect transaction data
   */
  async collectTransactionData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, amount, currency, items, status, created_at FROM transactions WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.TRANSACTION_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting transaction data:', error);
    }

    return {
      category: DataCategory.TRANSACTION_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['transaction_system'],
    };
  }

  /**
   * Collect communication data
   */
  async collectCommunicationData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, type, subject, content, direction, created_at FROM communications WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.COMMUNICATION_DATA,
            data: row,
            source: 'database',
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting communication data:', error);
    }

    return {
      category: DataCategory.COMMUNICATION_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['communication_system'],
    };
  }

  /**
   * Collect behavioral data
   */
  async collectBehavioralData(subjectId: string, scope: RequestScope): Promise<CategoryData> {
    const records: DataRecord[] = [];

    try {
      if (this.env.PRIVACY_DB) {
        const result = await this.env.PRIVACY_DB.prepare(
          'SELECT id, event_type, page, referrer, device, browser, timestamp FROM behavioral_data WHERE user_id = ?'
        ).bind(subjectId).all();

        for (const row of result.results) {
          records.push({
            id: row.id as string,
            category: DataCategory.BEHAVIORAL_DATA,
            data: row,
            source: 'database',
            createdAt: row.timestamp as number,
            updatedAt: row.timestamp as number,
          });
        }
      }
    } catch (error) {
      console.error('Error collecting behavioral data:', error);
    }

    return {
      category: DataCategory.BEHAVIORAL_DATA,
      records,
      count: records.length,
      size: JSON.stringify(records).length,
      systems: ['analytics_system'],
    };
  }

  /**
   * Compile export from collected data
   */
  async compileExport(request: RightToAccessRequest, data: CollectedData): Promise<DataAccessResult> {
    const now = Date.now();

    // Build summary
    const summary: DataSummary = {
      totalRecords: data.totalRecords,
      recordsByCategory: {} as any,
      dateRange: {
        earliest: data.dateRange.earliest === Infinity ? now : data.dateRange.earliest,
        latest: data.dateRange.latest,
      },
      totalSize: data.totalSize,
      systems: data.systems,
    };

    for (const [category, categoryData] of Object.entries(data.categories)) {
      summary.recordsByCategory[category as DataCategory] = categoryData.count;
    }

    // Get additional information if requested
    const purposes = request.includePurposes ? await this.getPurposes(request.subjectId) : undefined;
    const recipients = request.includeRecipients ? await this.getRecipients(request.subjectId) : undefined;
    const retentionPeriods = request.includeRetentionPeriod ? await this.getRetentionPeriods() : undefined;
    const automatedDecisionMaking = request.includeAutomatedDecisionMaking
      ? await this.getAutomatedDecisionInfo()
      : undefined;
    const sources = request.includeSources ? await this.getSources(request.subjectId) : undefined;

    // Format data based on requested format
    const formattedData = this.formatData(data, request.outputFormat);

    // Store export
    const exportId = crypto.randomUUID();
    await this.storeExport(exportId, formattedData);

    const result: DataAccessResult = {
      requestId: request.id,
      subjectId: request.subjectId,
      exportedAt: now,
      format: request.outputFormat,
      fileUrl: `/exports/${exportId}`,
      fileSize: formattedData.length,
      recordCount: data.totalRecords,
      dataCategories: request.scope.dataCategories,
      summary,
      purposes,
      recipients,
      retentionPeriods,
      automatedDecisionMaking,
      sources,
    };

    // Update request status
    request.status = 'completed' as any;
    request.completedAt = now;
    request.updatedAt = now;
    await this.storeRequest(request);

    return result;
  }

  /**
   * Format data according to requested output format
   */
  private formatData(data: CollectedData, format: OutputFormat): string {
    switch (format) {
      case OutputFormat.JSON:
        return JSON.stringify(data, null, 2);

      case OutputFormat.CSV:
        return this.convertToCSV(data);

      case OutputFormat.XML:
        return this.convertToXML(data);

      case OutputFormat.HTML:
        return this.convertToHTML(data);

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: CollectedData): string {
    const lines: string[] = ['Category,RecordID,Data'];

    for (const [category, categoryData] of Object.entries(data.categories)) {
      for (const record of categoryData.records) {
        lines.push(`${category},"${record.id}","${JSON.stringify(record.data).replace(/"/g, '""')}"`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert data to XML format
   */
  private convertToXML(data: CollectedData): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data_export>\n';
    xml += `  <subject_id>${data.subjectId}</subject_id>\n`;
    xml += `  <total_records>${data.totalRecords}</total_records>\n`;
    xml += '  <categories>\n';

    for (const [category, categoryData] of Object.entries(data.categories)) {
      xml += `    <category name="${category}">\n`;
      xml += `      <count>${categoryData.count}</count>\n`;
      xml += '      <records>\n';

      for (const record of categoryData.records) {
        xml += `        <record id="${record.id}">\n`;
        xml += `          <data>${this.escapeXML(JSON.stringify(record.data))}</data>\n`;
        xml += '        </record>\n';
      }

      xml += '      </records>\n';
      xml += '    </category>\n';
    }

    xml += '  </categories>\n';
    xml += '</data_export>';

    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert data to HTML format
   */
  private convertToHTML(data: CollectedData): string {
    let html = '<!DOCTYPE html>\n<html>\n<head>\n';
    html += '<title>Data Export</title>\n';
    html += '<style>body{font-family:Arial,sans-serif;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;} th{background-color:#4CAF50;color:white;}</style>\n';
    html += '</head>\n<body>\n';
    html += `<h1>Data Export for Subject: ${data.subjectId}</h1>\n`;
    html += `<p>Total Records: ${data.totalRecords}</p>\n`;
    html += '<h2>Data by Category</h2>\n';

    for (const [category, categoryData] of Object.entries(data.categories)) {
      html += `<h3>${category}</h3>\n`;
      html += `<p>Records: ${categoryData.count}</p>\n`;
      html += '<table>\n<thead>\n<tr><th>ID</th><th>Data</th></tr>\n</thead>\n<tbody>\n';

      for (const record of categoryData.records.slice(0, 100)) {
        html += `<tr>\n<td>${record.id}</td>\n<td>${JSON.stringify(record.data)}</td>\n</tr>\n`;
      }

      html += '</tbody>\n</table>\n';
    }

    html += '</body>\n</html>';

    return html;
  }

  // ========================================================================
  // VERIFICATION
  // ========================================================================

  /**
   * Initiate identity verification
   */
  private async initiateVerification(request: RightToAccessRequest): Promise<void> {
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

    const accessRequest = await this.getRequest(requestId);
    if (!accessRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check token
    if (accessRequest.verification.verificationToken !== verificationToken) {
      accessRequest.verification.attempts += 1;

      if (accessRequest.verification.attempts >= accessRequest.verification.maxAttempts) {
        accessRequest.status = 'rejected' as any;
        await this.storeRequest(accessRequest);

        return new Response(
          JSON.stringify({ error: 'Too many verification attempts' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await this.storeRequest(accessRequest);

      return new Response(
        JSON.stringify({ error: 'Invalid verification token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    accessRequest.verification.verified = true;
    accessRequest.verification.verifiedAt = Date.now();
    accessRequest.status = 'processing' as any;
    accessRequest.updatedAt = Date.now();

    await this.storeRequest(accessRequest);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Identity verified successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // STORAGE OPERATIONS
  // ========================================================================

  /**
   * Store request
   */
  private async storeRequest(request: RightToAccessRequest): Promise<void> {
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
  private async getRequest(requestId: string): Promise<RightToAccessRequest | null> {
    const key = `request:${requestId}`;
    return await this.state.storage.get<RightToAccessRequest>(key);
  }

  /**
   * Store export
   */
  private async storeExport(exportId: string, data: string): Promise<void> {
    const key = `export:${exportId}`;
    await this.state.storage.put(key, data);

    // Also store in KV if available
    if (this.env.PRIVACY_KV) {
      await this.env.PRIVACY_KV.put(key, data, {
        expirationTtl: 7 * 24 * 60 * 60, // 7 days
      });
    }
  }

  // ========================================================================
  // GETTERS FOR ADDITIONAL INFORMATION
  // ========================================================================

  /**
   * Get processing purposes
   */
  private async getPurposes(subjectId: string): Promise<string[]> {
    return [
      'Service provision',
      'Account management',
      'Order processing',
      'Customer support',
      'Analytics and improvement',
      'Marketing communications',
    ];
  }

  /**
   * Get data recipients
   */
  private async getRecipients(subjectId: string): Promise<DataRecipient[]> {
    return [
      {
        name: 'Payment Processor',
        category: 'processor' as any,
        dataCategories: [DataCategory.FINANCIAL_DATA],
        purpose: 'Payment processing',
        outsideEU: false,
        safeguards: 'GDPR compliant, data processing agreement in place',
      },
    ];
  }

  /**
   * Get retention periods
   */
  private async getRetentionPeriods(): Promise<RetentionPeriod[]> {
    return [
      {
        category: DataCategory.PERSONAL_DATA,
        period: 'While account is active plus 7 years after closure',
        rationale: 'Legal and accounting requirements',
      },
      {
        category: DataCategory.USAGE_DATA,
        period: '2 years',
        rationale: 'Analytics and service improvement',
      },
      {
        category: DataCategory.TRANSACTION_DATA,
        period: '10 years',
        rationale: 'Tax and legal requirements',
      },
    ];
  }

  /**
   * Get automated decision making information
   */
  private async getAutomatedDecisionInfo(): Promise<AutomatedDecisionInfo> {
    return {
      usesAutomatedDecisionMaking: false,
      logic: undefined,
      significance: undefined,
      safeguards: undefined,
      rightToIntervention: true,
      rightToOpinion: true,
    };
  }

  /**
   * Get data sources
   */
  private async getSources(subjectId: string): Promise<DataSource[]> {
    return [
      {
        name: 'Direct Input',
        type: 'direct' as any,
        dataCategories: [
          DataCategory.PERSONAL_DATA,
          DataCategory.CONTACT_DATA,
          DataCategory.PROFILE_DATA,
        ],
        method: 'Data provided directly by user during registration and profile updates',
      },
      {
        name: 'Technical Collection',
        type: 'automatic' as any,
        dataCategories: [
          DataCategory.TECHNICAL_DATA,
          DataCategory.USAGE_DATA,
          DataCategory.BEHAVIORAL_DATA,
        ],
        method: 'Automatically collected during service usage',
      },
    ];
  }

  /**
   * Get request status
   */
  private async handleGetStatus(url: URL): Promise<Response> {
    const subjectId = url.searchParams.get('subjectId');
    if (!subjectId) {
      return new Response(
        JSON.stringify({ error: 'Subject ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subjectKey = `subject:${subjectId}:requests`;
    const requestIds = (await this.state.storage.get<string[]>(subjectKey)) || [];

    const requests: RightToAccessRequest[] = [];
    for (const id of requestIds) {
      const request = await this.getRequest(id);
      if (request) {
        requests.push(request);
      }
    }

    return new Response(
      JSON.stringify({ requests }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

interface CollectedData {
  subjectId: string;
  categories: Record<string, CategoryData>;
  totalRecords: number;
  totalSize: number;
  systems: string[];
  dateRange: {
    earliest: number;
    latest: number;
  };
}

interface CategoryData {
  category: DataCategory;
  records: DataRecord[];
  count: number;
  size: number;
  systems: string[];
  dateRange?: {
    earliest: number;
    latest: number;
  };
}

interface DataRecord {
  id: string;
  category: DataCategory;
  data: any;
  source: string;
  createdAt: number;
  updatedAt: number;
}
