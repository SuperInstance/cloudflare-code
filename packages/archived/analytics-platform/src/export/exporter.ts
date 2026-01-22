/**
 * Data Export System
 * Export analytics data in various formats
 */

import type {
  ExportConfig,
  ExportFormat,
  ExportDestination,
  ExportResult,
} from '../types/index.js';

export interface ExporterConfig {
  maxExportSize: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  supportedFormats: ExportFormat[];
}

/**
 * Data Exporter
 */
export class DataExporter {
  private config: ExporterConfig;
  private exports: Map<string, ExportResult> = new Map();

  constructor(config: Partial<ExporterConfig> = {}) {
    this.config = {
      maxExportSize: 10000000, // 10MB
      enableCompression: true,
      enableEncryption: false,
      supportedFormats: [
        'csv',
        'json',
        'parquet',
        'excel',
        'pdf',
        'html',
        'xml',
        'sql',
      ],
      ...config,
    };
  }

  /**
   * Export data
   */
  async export(data: any[], config: ExportConfig): Promise<ExportResult> {
    const exportId = this.generateExportId();
    const startTime = Date.now();

    try {
      // Validate format
      if (!this.config.supportedFormats.includes(config.format)) {
        throw new Error(`Unsupported format: ${config.format}`);
      }

      // Filter data
      let filteredData = data;
      if (config.filters) {
        filteredData = this.applyFilters(data, config.filters);
      }

      // Select fields
      if (config.fields) {
        filteredData = this.selectFields(filteredData, config.fields);
      }

      // Format data
      let formattedData: string | Buffer = await this.formatData(
        filteredData,
        config.format
      );

      // Compress if enabled
      if (config.compression && this.config.enableCompression) {
        formattedData = await this.compressData(formattedData);
      }

      // Encrypt if enabled
      if (config.encryption && this.config.enableEncryption) {
        formattedData = await this.encryptData(formattedData);
      }

      // Calculate size
      const size = Buffer.byteLength(formattedData.toString());

      if (size > this.config.maxExportSize) {
        throw new Error(`Export size exceeds maximum allowed size of ${this.config.maxExportSize} bytes`);
      }

      // Export to destination
      let url: string | undefined;
      let expiresAt: number | undefined;

      if (config.destination) {
        const destinationResult = await this.exportToDestination(
          formattedData,
          config.destination,
          exportId,
          config.format
        );
        url = destinationResult.url;
        expiresAt = destinationResult.expiresAt;
      }

      const result: ExportResult = {
        id: exportId,
        status: 'completed',
        format: config.format,
        size,
        rows: filteredData.length,
        url,
        expiresAt,
        createdAt: startTime,
        completedAt: Date.now(),
      };

      this.exports.set(exportId, result);
      return result;
    } catch (error) {
      const result: ExportResult = {
        id: exportId,
        status: 'failed',
        format: config.format,
        size: 0,
        rows: 0,
        createdAt: startTime,
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };

      this.exports.set(exportId, result);
      return result;
    }
  }

  /**
   * Export to CSV
   */
  private async exportToCSV(data: any[]): Promise<string> {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if contains comma or quote
          const escaped = value.replace(/"/g, '""');
          if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
            return `"${escaped}"`;
          }
          return escaped;
        }
        return String(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Export to JSON
   */
  private async exportToJSON(data: any[]): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export to HTML
   */
  private async exportToHTML(data: any[]): Promise<string> {
    if (data.length === 0) return '<html><body>No data</body></html>';

    const headers = Object.keys(data[0]);

    let html = '<!DOCTYPE html>\n';
    html += '<html>\n';
    html += '<head>\n';
    html += '<title>Export Report</title>\n';
    html += '<style>\n';
    html += 'table { border-collapse: collapse; width: 100%; }\n';
    html += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n';
    html += 'th { background-color: #4CAF50; color: white; }\n';
    html += 'tr:nth-child(even) { background-color: #f2f2f2; }\n';
    html += '</style>\n';
    html += '</head>\n';
    html += '<body>\n';
    html += '<h1>Export Report</h1>\n';
    html += '<p>Generated: ' + new Date().toISOString() + '</p>\n';
    html += '<table>\n';

    // Header row
    html += '<tr>\n';
    for (const header of headers) {
      html += `<th>${this.escapeHtml(header)}</th>\n`;
    }
    html += '</tr>\n';

    // Data rows
    for (const row of data) {
      html += '<tr>\n';
      for (const header of headers) {
        html += `<td>${this.escapeHtml(String(row[header] ?? ''))}</td>\n`;
      }
      html += '</tr>\n';
    }

    html += '</table>\n';
    html += '</body>\n';
    html += '</html>';

    return html;
  }

  /**
   * Export to XML
   */
  private async exportToXML(data: any[]): Promise<string> {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<root>\n';

    for (const row of data) {
      xml += '  <item>\n';
      for (const [key, value] of Object.entries(row)) {
        xml += `    <${key}>${this.escapeXml(String(value ?? ''))}</${key}>\n`;
      }
      xml += '  </item>\n';
    }

    xml += '</root>';
    return xml;
  }

  /**
   * Export to SQL
   */
  private async exportToSQL(data: any[], tableName = 'export_data'): Promise<string> {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    let sql = `-- Export data for table ${tableName}\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;

    // Create table statement
    sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    sql += columns.map((col) => `  ${col} TEXT`).join(',\n');
    sql += '\n);\n\n';

    // Insert statements
    for (const row of data) {
      const values = columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'boolean') return value ? '1' : '0';
        return `'${String(value).replace(/'/g, "''")}'`;
      });

      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }

    return sql;
  }

  /**
   * Format data according to format
   */
  private async formatData(data: any[], format: ExportFormat): Promise<string> {
    switch (format) {
      case 'csv':
        return this.exportToCSV(data);
      case 'json':
        return this.exportToJSON(data);
      case 'html':
        return this.exportToHTML(data);
      case 'xml':
        return this.exportToXML(data);
      case 'sql':
        return this.exportToSQL(data);
      case 'parquet':
        // Placeholder - would use a parquet library
        return JSON.stringify(data);
      case 'excel':
        // Placeholder - would use an Excel library
        return JSON.stringify(data);
      case 'pdf':
        // Placeholder - would use a PDF library
        return this.exportToHTML(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Apply filters to data
   */
  private applyFilters(data: any[], filters: any[]): any[] {
    return data.filter((item) => {
      return filters.every((filter) => {
        const value = this.getNestedValue(item, filter.field);

        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'not_equals':
            return value !== filter.value;
          case 'contains':
            return typeof value === 'string' && value.includes(filter.value);
          case 'not_contains':
            return typeof value === 'string' && !value.includes(filter.value);
          case 'greater_than':
            return typeof value === 'number' && value > filter.value;
          case 'less_than':
            return typeof value === 'number' && value < filter.value;
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'not_in':
            return Array.isArray(filter.value) && !filter.value.includes(value);
          case 'is_null':
            return value === null || value === undefined;
          case 'is_not_null':
            return value !== null && value !== undefined;
          default:
            return true;
        }
      });
    });
  }

  /**
   * Select specific fields from data
   */
  private selectFields(data: any[], fields: string[]): any[] {
    return data.map((item) => {
      const selected: any = {};
      for (const field of fields) {
        selected[field] = this.getNestedValue(item, field);
      }
      return selected;
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Compress data
   */
  private async compressData(data: string | Buffer): Promise<Buffer> {
    // Placeholder - would use compression library
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }

  /**
   * Encrypt data
   */
  private async encryptData(data: string | Buffer): Promise<Buffer> {
    // Placeholder - would use encryption library
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }

  /**
   * Export to destination
   */
  private async exportToDestination(
    data: string | Buffer,
    destination: ExportDestination,
    exportId: string,
    format: ExportFormat
  ): Promise<{ url: string; expiresAt: number }> {
    const filename = `export_${exportId}.${format}`;

    switch (destination.type) {
      case 's3':
        return this.exportToS3(data, destination.config, filename);
      case 'gcs':
        return this.exportToGCS(data, destination.config, filename);
      case 'azure':
        return this.exportToAzure(data, destination.config, filename);
      case 'local':
        return this.exportToLocal(data, destination.config, filename);
      case 'url':
        return { url: destination.config.url, expiresAt: Date.now() + 86400000 };
      case 'email':
        return this.exportToEmail(data, destination.config, filename);
      case 'webhook':
        return this.exportToWebhook(data, destination.config);
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }

  /**
   * Export to S3
   */
  private async exportToS3(
    data: string | Buffer,
    config: any,
    filename: string
  ): Promise<{ url: string; expiresAt: number }> {
    // Placeholder - would use AWS SDK
    const url = `https://${config.bucket}.s3.amazonaws.com/${filename}`;
    const expiresAt = Date.now() + 86400000; // 24 hours
    return { url, expiresAt };
  }

  /**
   * Export to GCS
   */
  private async exportToGCS(
    data: string | Buffer,
    config: any,
    filename: string
  ): Promise<{ url: string; expiresAt: number }> {
    // Placeholder - would use GCS SDK
    const url = `https://storage.googleapis.com/${config.bucket}/${filename}`;
    const expiresAt = Date.now() + 86400000;
    return { url, expiresAt };
  }

  /**
   * Export to Azure
   */
  private async exportToAzure(
    data: string | Buffer,
    config: any,
    filename: string
  ): Promise<{ url: string; expiresAt: number }> {
    // Placeholder - would use Azure SDK
    const url = `https://${config.account}.blob.core.windows.net/${config.container}/${filename}`;
    const expiresAt = Date.now() + 86400000;
    return { url, expiresAt };
  }

  /**
   * Export to local storage
   */
  private async exportToLocal(
    data: string | Buffer,
    config: any,
    filename: string
  ): Promise<{ url: string; expiresAt: number }> {
    // Placeholder - would write to filesystem
    const url = `file://${config.path}/${filename}`;
    const expiresAt = Date.now() + 86400000 * 30; // 30 days
    return { url, expiresAt };
  }

  /**
   * Export via email
   */
  private async exportToEmail(
    data: string | Buffer,
    config: any,
    filename: string
  ): Promise<{ url: string; expiresAt: number }> {
    // Placeholder - would send email
    console.log(`Sending export ${filename} to ${config.to}`);
    return { url: `mailto:${config.to}`, expiresAt: Date.now() + 86400000 };
  }

  /**
   * Export via webhook
   */
  private async exportToWebhook(
    data: string | Buffer,
    config: any
  ): Promise<{ url: string; expiresAt: number }> {
    // Placeholder - would send webhook
    console.log(`Sending export to webhook ${config.url}`);
    return { url: config.url, expiresAt: Date.now() + 86400000 };
  }

  /**
   * Get export status
   */
  getExport(exportId: string): ExportResult | undefined {
    return this.exports.get(exportId);
  }

  /**
   * List all exports
   */
  listExports(): ExportResult[] {
    return Array.from(this.exports.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  /**
   * Delete export
   */
  deleteExport(exportId: string): boolean {
    return this.exports.delete(exportId);
  }

  /**
   * Clean up expired exports
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, exportResult] of this.exports.entries()) {
      if (exportResult.expiresAt && exportResult.expiresAt < now) {
        this.exports.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate export ID
   */
  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Escape XML
   */
  private escapeXml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
