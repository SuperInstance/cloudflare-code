/**
 * Audit System - Optimized
 */

import { IAuditCollector, createAuditCollector } from './collector';
import { ImmutableAuditLogStorage, createAuditLogStorage } from './storage';
import { ComplianceReportGenerator } from './reports';
import { AuditLogSearchEngine } from './search';
import { AuditEventStream } from './streams';
import { ChangeTrackingSystem } from './tracking';

export interface AuditSystemConfig {
  collector?: any;
  storage?: any;
  reports?: any;
  search?: any;
  streams?: any;
}

export class AuditSystem {
  private collector: IAuditCollector;
  private storage: ImmutableAuditLogStorage;
  private reports: ComplianceReportGenerator;
  private search: AuditLogSearchEngine;
  private streams: AuditEventStream;
  private tracking: ChangeTrackingSystem;

  constructor(config: AuditSystemConfig = {}) {
    this.collector = createAuditCollector(config.collector || {});
    this.storage = createAuditLogStorage(config.storage || {});
    this.reports = new ComplianceReportGenerator(config.reports || {});
    this.search = new AuditLogSearchEngine(config.search || {});
    this.streams = new AuditEventStream(config.streams || {});
    this.tracking = new ChangeTrackingSystem();
  }

  async log(event: any): Promise<void> {
    await this.collector.collect(event);
    await this.storage.store(event);
    this.streams.broadcast(event);
  }

  async generateReport(type: string): Promise<any> {
    const events = await this.storage.query({ type });
    return this.reports.generate(type, events);
  }

  getStats(): any {
    return {
      collector: this.collector.getStats(),
      storage: this.storage.getStats(),
      streams: this.streams.getStats()
    };
  }
}

export function createAuditSystem(config: AuditSystemConfig = {}): AuditSystem {
  return new AuditSystem(config);
}
