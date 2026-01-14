import { ComplianceStandard, SeverityLevel, RiskLevel, ComplianceStatus } from '../types';

/**
 * Date utilities
 */
export class DateUtils {
  /**
   * Add days to date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add months to date
   */
  static addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Add years to date
   */
  static addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  /**
   * Get date range for period
   */
  static getDateRange(
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual',
    endDate: Date = new Date()
  ): { start: Date; end: Date } {
    const end = new Date(endDate);
    let start: Date;

    switch (period) {
      case 'daily':
        start = new Date(end);
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(end);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start = new Date(end);
        start.setMonth(start.getMonth() - 3);
        break;
      case 'annual':
        start = new Date(end);
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return { start, end };
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Check if date is in range
   */
  static isInRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  /**
   * Get days between dates
   */
  static daysBetween(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
  }
}

/**
 * Severity utilities
 */
export class SeverityUtils {
  /**
   * Get numeric value for severity
   */
  static getNumericValue(severity: SeverityLevel): number {
    const values = {
      [SeverityLevel.CRITICAL]: 5,
      [SeverityLevel.HIGH]: 4,
      [SeverityLevel.MEDIUM]: 3,
      [SeverityLevel.LOW]: 2,
      [SeverityLevel.INFO]: 1
    };
    return values[severity] || 0;
  }

  /**
   * Get color for severity
   */
  static getColor(severity: SeverityLevel): string {
    const colors = {
      [SeverityLevel.CRITICAL]: '#d32f2f',
      [SeverityLevel.HIGH]: '#f57c00',
      [SeverityLevel.MEDIUM]: '#fbc02d',
      [SeverityLevel.LOW]: '#388e3c',
      [SeverityLevel.INFO]: '#1976d2'
    };
    return colors[severity] || '#757575';
  }

  /**
   * Get icon for severity
   */
  static getIcon(severity: SeverityLevel): string {
    const icons = {
      [SeverityLevel.CRITICAL]: '🔴',
      [SeverityLevel.HIGH]: '🟠',
      [SeverityLevel.MEDIUM]: '🟡',
      [SeverityLevel.LOW]: '🟢',
      [SeverityLevel.INFO]: '🔵'
    };
    return icons[severity] || '⚪';
  }

  /**
   * Compare severities
   */
  static compare(severity1: SeverityLevel, severity2: SeverityLevel): number {
    return this.getNumericValue(severity1) - this.getNumericValue(severity2);
  }

  /**
   * Get highest severity
   */
  static getHighest(severities: SeverityLevel[]): SeverityLevel {
    return severities.reduce((highest, current) =>
      this.compare(current, highest) > 0 ? current : highest,
      SeverityLevel.INFO
    );
  }
}

/**
 * Risk utilities
 */
export class RiskUtils {
  /**
   * Calculate risk score from likelihood and impact
   */
  static calculateRiskScore(likelihood: number, impact: number): number {
    return likelihood * impact;
  }

  /**
   * Get risk level from score
   */
  static getRiskLevel(score: number): RiskLevel {
    if (score >= 20) return RiskLevel.CRITICAL;
    if (score >= 15) return RiskLevel.HIGH;
    if (score >= 8) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Get numeric value for risk level
   */
  static getNumericValue(level: RiskLevel): number {
    const values = {
      [RiskLevel.CRITICAL]: 4,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.LOW]: 1
    };
    return values[level] || 0;
  }

  /**
   * Get color for risk level
   */
  static getColor(level: RiskLevel): string {
    const colors = {
      [RiskLevel.CRITICAL]: '#d32f2f',
      [RiskLevel.HIGH]: '#f57c00',
      [RiskLevel.MEDIUM]: '#fbc02d',
      [RiskLevel.LOW]: '#388e3c'
    };
    return colors[level] || '#757575';
  }
}

/**
 * Compliance utilities
 */
export class ComplianceUtils {
  /**
   * Calculate compliance percentage
   */
  static calculateCompliance(
    compliant: number,
    total: number
  ): number {
    if (total === 0) return 100;
    return Math.round((compliant / total) * 100);
  }

  /**
   * Get compliance status from percentage
   */
  static getComplianceStatus(percentage: number): ComplianceStatus {
    if (percentage >= 95) return ComplianceStatus.COMPLIANT;
    if (percentage >= 80) return ComplianceStatus.PARTIALLY_COMPLIANT;
    return ComplianceStatus.NON_COMPLIANT;
  }

  /**
   * Get color for compliance status
   */
  static getStatusColor(status: ComplianceStatus): string {
    const colors = {
      [ComplianceStatus.COMPLIANT]: '#388e3c',
      [ComplianceStatus.PARTIALLY_COMPLIANT]: '#fbc02d',
      [ComplianceStatus.NON_COMPLIANT]: '#d32f2f',
      [ComplianceStatus.NOT_APPLICABLE]: '#757575',
      [ComplianceStatus.PENDING_REVIEW]: '#1976d2'
    };
    return colors[status] || '#757575';
  }

  /**
   * Get trend
   */
  static getTrend(
    current: number,
    previous: number
  ): 'improving' | 'stable' | 'declining' {
    const diff = current - previous;
    const threshold = 5; // 5% threshold

    if (Math.abs(diff) < threshold) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Get standard display name
   */
  static getStandardName(standard: ComplianceStandard): string {
    const names = {
      [ComplianceStandard.SOC2]: 'SOC 2 Type II',
      [ComplianceStandard.ISO27001]: 'ISO 27001',
      [ComplianceStandard.GDPR]: 'GDPR',
      [ComplianceStandard.HIPAA]: 'HIPAA',
      [ComplianceStandard.PCI_DSS]: 'PCI DSS'
    };
    return names[standard] || standard;
  }

  /**
   * Get standard icon
   */
  static getStandardIcon(standard: ComplianceStandard): string {
    const icons = {
      [ComplianceStandard.SOC2]: '🛡️',
      [ComplianceStandard.ISO27001]: '🔒',
      [ComplianceStandard.GDPR]: '🇪🇺',
      [ComplianceStandard.HIPAA]: '🏥',
      [ComplianceStandard.PCI_DSS]: '💳'
    };
    return icons[standard] || '📋';
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate email
   */
  static isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Validate URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate semantic version
   */
  static isValidVersion(version: string): boolean {
    const regex = /^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/;
    return regex.test(version);
  }

  /**
   * Validate ID format
   */
  static isValidId(id: string): boolean {
    const regex = /^[a-z0-9-]+$/;
    return regex.test(id) && id.length >= 3 && id.length <= 100;
  }

  /**
   * Sanitize string
   */
  static sanitizeString(str: string): string {
    return str.replace(/[^\w\s-]/gi, '').trim();
  }

  /**
   * Generate slug
   */
  static generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

/**
 * ID generation utilities
 */
export class IdUtils {
  /**
   * Generate unique ID
   */
  static generateId(prefix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate hash (simple)
   */
  static generateHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Array utilities
 */
export class ArrayUtils {
  /**
   * Group array by key
   */
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((result, item) => {
      const key = keyFn(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  /**
   * Unique array
   */
  static unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  }

  /**
   * Sort array by key
   */
  static sortBy<T>(array: T[], keyFn: (item: T) => any, order: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = keyFn(a);
      const bVal = keyFn(b);
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Chunk array
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Paginate array
   */
  static paginate<T>(array: T[], page: number, pageSize: number): {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  } {
    const total = array.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = array.slice(start, end);
    const hasMore = page < totalPages;

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasMore
    };
  }
}

/**
 * Object utilities
 */
export class ObjectUtils {
  /**
   * Deep clone object
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Merge objects
   */
  static merge<T extends object>(...objs: Partial<T>[]): T {
    return Object.assign({}, ...objs) as T;
  }

  /**
   * Get nested value
   */
  static get(obj: any, path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current == null) {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Set nested value
   */
  static set(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Remove undefined values
   */
  static removeUndefined<T extends object>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as T;
  }
}
