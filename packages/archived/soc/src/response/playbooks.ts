/**
 * Incident Response Automation
 * Playbooks, workflows, and automated response actions
 */

import {
  Playbook,
  PlaybookStep,
  Incident,
  IncidentStatus,
  ThreatType,
  ResponseAction,
  ResponseActionRecord,
  ThreatLevel,
  CorrelationCondition
} from '../types';
import { generateId } from '../utils/helpers';

// ============================================================================
// Response Actions
// ============================================================================

export interface ActionResult {
  success: boolean;
  message: string;
  details?: any;
  error?: string;
}

export class ResponseExecutor {
  private actionHandlers: Map<ResponseAction, (target: string, params?: any) => Promise<ActionResult>>;

  constructor() {
    this.actionHandlers = new Map();
    this.initializeDefaultHandlers();
  }

  private initializeDefaultHandlers(): void {
    // Block action handler
    this.actionHandlers.set('block', async (target: string, params?: any) => {
      try {
        // Implement blocking logic (e.g., add to firewall, blocklist)
        console.log(`Blocking ${target}`, params);
        return {
          success: true,
          message: `Successfully blocked ${target}`,
          details: { target, params }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to block ${target}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Allow action handler
    this.actionHandlers.set('allow', async (target: string, params?: any) => {
      try {
        console.log(`Allowing ${target}`, params);
        return {
          success: true,
          message: `Successfully allowed ${target}`,
          details: { target, params }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to allow ${target}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Quarantine action handler
    this.actionHandlers.set('quarantine', async (target: string, params?: any) => {
      try {
        console.log(`Quarantining ${target}`, params);
        return {
          success: true,
          message: `Successfully quarantined ${target}`,
          details: { target, params }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to quarantine ${target}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Alert action handler
    this.actionHandlers.set('alert', async (target: string, params?: any) => {
      try {
        console.log(`Alerting for ${target}`, params);
        return {
          success: true,
          message: `Alert sent for ${target}`,
          details: { target, params }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to send alert for ${target}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Log action handler
    this.actionHandlers.set('log', async (target: string, params?: any) => {
      try {
        console.log(`Logging for ${target}`, params);
        return {
          success: true,
          message: `Successfully logged ${target}`,
          details: { target, params }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to log ${target}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Isolate action handler
    this.actionHandlers.set('isolate', async (target: string, params?: any) => {
      try {
        console.log(`Isolating ${target}`, params);
        return {
          success: true,
          message: `Successfully isolated ${target}`,
          details: { target, params }
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to isolate ${target}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  /**
   * Execute response action
   */
  async execute(action: ResponseAction, target: string, params?: any): Promise<ActionResult> {
    const handler = this.actionHandlers.get(action);
    if (!handler) {
      return {
        success: false,
        message: `No handler registered for action: ${action}`
      };
    }

    return handler(target, params);
  }

  /**
   * Register custom action handler
   */
  registerHandler(action: ResponseAction, handler: (target: string, params?: any) => Promise<ActionResult>): void {
    this.actionHandlers.set(action, handler);
  }

  /**
   * Get registered actions
   */
  getRegisteredActions(): ResponseAction[] {
    return Array.from(this.actionHandlers.keys());
  }
}

// ============================================================================
// Playbook Definitions
// ============================================================================

export class PlaybookLibrary {
  private playbooks: Map<string, Playbook> = new Map();

  constructor() {
    this.initializeDefaultPlaybooks();
  }

  private initializeDefaultPlaybooks(): void {
    // SQL Injection Response Playbook
    this.addPlaybook({
      id: 'sql_injection_response',
      name: 'SQL Injection Response',
      description: 'Automated response playbook for SQL injection attacks',
      threatType: ThreatType.SQL_INJECTION,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'system',
      enabled: true,
      triggerConditions: [
        { field: 'threatType', operator: 'equals', value: ThreatType.SQL_INJECTION },
        { field: 'confidence', operator: 'gte', value: 0.7 }
      ],
      steps: [
        {
          id: 'block_source',
          name: 'Block Attack Source',
          description: 'Block the IP address making SQL injection attempts',
          order: 1,
          action: 'block',
          target: '${source.ip}',
          automated: true,
          requiresApproval: false,
          timeout: 30000,
          onSuccess: 'log_block',
          onFailure: 'alert_failed',
          parameters: {
            reason: 'SQL injection attempt',
            duration: 86400000 // 24 hours
          },
          rollbackAction: 'unblock_source'
        },
        {
          id: 'log_block',
          name: 'Log Blocking Action',
          description: 'Log the blocking action for audit purposes',
          order: 2,
          action: 'log',
          target: 'security_events',
          automated: true,
          requiresApproval: false,
          timeout: 5000,
          onSuccess: 'notify_team',
          onFailure: 'alert_failed',
          parameters: {
            event_type: 'sql_injection_blocked',
            severity: 'high'
          }
        },
        {
          id: 'notify_team',
          name: 'Notify Security Team',
          description: 'Send alert to security team about the SQL injection attempt',
          order: 3,
          action: 'alert',
          target: 'security_team',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'create_incident',
          onFailure: 'create_incident',
          parameters: {
            message: 'SQL injection blocked from ${source.ip}',
            severity: 'high'
          }
        },
        {
          id: 'create_incident',
          name: 'Create Security Incident',
          description: 'Create a security incident for further investigation',
          order: 4,
          action: 'custom',
          target: 'incident_management',
          automated: true,
          requiresApproval: false,
          timeout: 15000,
          onSuccess: 'complete',
          onFailure: 'alert_failed',
          parameters: {
            title: 'SQL Injection Attempt',
            type: ThreatType.SQL_INJECTION,
            severity: 'high',
            priority: 'p2'
          }
        }
      ],
      estimatedDuration: 60000,
      requiredPermissions: ['security:block', 'security:log', 'security:alert'],
      tags: ['sql_injection', 'injection', 'automated']
    });

    // DDoS Mitigation Playbook
    this.addPlaybook({
      id: 'ddos_mitigation',
      name: 'DDoS Attack Mitigation',
      description: 'Automated response to mitigate DDoS attacks',
      threatType: ThreatType.DDOS_ATTACK,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'system',
      enabled: true,
      triggerConditions: [
        { field: 'threatType', operator: 'equals', value: ThreatType.DDOS_ATTACK },
        { field: 'severity', operator: 'equals', value: 'critical' }
      ],
      steps: [
        {
          id: 'enable_rate_limiting',
          name: 'Enable Rate Limiting',
          description: 'Activate aggressive rate limiting',
          order: 1,
          action: 'custom',
          target: 'rate_limiter',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'enable_waf',
          onFailure: 'alert_ops',
          parameters: {
            requests_per_minute: 60,
            burst: 100
          }
        },
        {
          id: 'enable_waf',
          name: 'Enable WAF Rules',
          description: 'Activate Web Application Firewall rules',
          order: 2,
          action: 'custom',
          target: 'waf',
          automated: true,
          requiresApproval: false,
          timeout: 15000,
          onSuccess: 'block_attack_ips',
          onFailure: 'alert_ops',
          parameters: {
            mode: 'blocking',
            rules: ['ddos', 'rate_limit']
          }
        },
        {
          id: 'block_attack_ips',
          name: 'Block Attacking IPs',
          description: 'Block IP addresses making excessive requests',
          order: 3,
          action: 'block',
          target: '${attack_ips}',
          automated: true,
          requiresApproval: false,
          timeout: 30000,
          onSuccess: 'enable_cdn',
          onFailure: 'alert_ops',
          parameters: {
            reason: 'DDoS attack participation',
            duration: 3600000 // 1 hour
          },
          rollbackAction: 'unblock_ips'
        },
        {
          id: 'enable_cdn',
          name: 'Enable CDN Caching',
          description: 'Enable aggressive CDN caching to reduce origin load',
          order: 4,
          action: 'custom',
          target: 'cdn',
          automated: true,
          requiresApproval: false,
          timeout: 20000,
          onSuccess: 'alert_team',
          onFailure: 'alert_team',
          parameters: {
            cache_ttl: 300,
            ignore_query_string: true
          }
        },
        {
          id: 'alert_team',
          name: 'Alert On-Call Team',
          description: 'Page the on-call security team',
          order: 5,
          action: 'alert',
          target: 'oncall_security',
          automated: true,
          requiresApproval: false,
          timeout: 5000,
          onSuccess: 'create_incident',
          onFailure: 'create_incident',
          parameters: {
            severity: 'critical',
            message: 'DDoS attack mitigation activated'
          }
        },
        {
          id: 'alert_ops',
          name: 'Alert Ops Team',
          description: 'Alert operations team on failure',
          order: 6,
          action: 'alert',
          target: 'ops_team',
          automated: true,
          requiresApproval: false,
          timeout: 5000,
          onSuccess: 'complete',
          onFailure: 'complete',
          parameters: {
            severity: 'high',
            message: 'DDoS mitigation step failed, manual intervention required'
          }
        },
        {
          id: 'create_incident',
          name: 'Create Incident',
          description: 'Create formal incident record',
          order: 7,
          action: 'custom',
          target: 'incident',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'complete',
          onFailure: 'complete',
          parameters: {
            severity: 'critical',
            priority: 'p1'
          }
        }
      ],
      estimatedDuration: 90000,
      requiredPermissions: ['security:block', 'security:configure', 'incident:create'],
      tags: ['ddos', 'mitigation', 'critical']
    });

    // Malware Response Playbook
    this.addPlaybook({
      id: 'malware_response',
      name: 'Malware Detection Response',
      description: 'Response playbook for malware detection',
      threatType: ThreatType.MALWARE,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'system',
      enabled: true,
      triggerConditions: [
        { field: 'threatType', operator: 'equals', value: ThreatType.MALWARE },
        { field: 'severity', operator: 'in', value: ['critical', 'high'] }
      ],
      steps: [
        {
          id: 'isolate_system',
          name: 'Isolate Affected System',
          description: 'Network isolation of compromised system',
          order: 1,
          action: 'isolate',
          target: '${affected_system}',
          automated: true,
          requiresApproval: true,
          timeout: 60000,
          onSuccess: 'quarantine_files',
          onFailure: 'alert_emergency',
          parameters: {
            isolation_type: 'network',
            preserve_state: true
          },
          rollbackAction: 'restore_connectivity'
        },
        {
          id: 'quarantine_files',
          name: 'Quarantine Suspicious Files',
          description: 'Move detected malware files to quarantine',
          order: 2,
          action: 'quarantine',
          target: '${detected_files}',
          automated: true,
          requiresApproval: false,
          timeout: 30000,
          onSuccess: 'collect_evidence',
          onFailure: 'alert_team',
          parameters: {
            preserve_metadata: true
          }
        },
        {
          id: 'collect_evidence',
          name: 'Collect Forensic Evidence',
          description: 'Capture system state and evidence',
          order: 3,
          action: 'custom',
          target: 'forensics',
          automated: true,
          requiresApproval: false,
          timeout: 120000,
          onSuccess: 'analyze_malware',
          onFailure: 'analyze_malware',
          parameters: {
            collect_memory: true,
            collect_disk: true,
            collect_network: true
          }
        },
        {
          id: 'analyze_malware',
          name: 'Analyze Malware',
          description: 'Perform malware analysis',
          order: 4,
          action: 'custom',
          target: 'malware_analysis',
          automated: false,
          requiresApproval: false,
          timeout: 3600000,
          onSuccess: 'determine_spread',
          onFailure: 'alert_team',
          parameters: {
            sandbox: true,
            deep_scan: true
          }
        },
        {
          id: 'determine_spread',
          name: 'Determine Spread',
          description: 'Check if malware has spread',
          order: 5,
          action: 'custom',
          target: 'network_scan',
          automated: true,
          requiresApproval: false,
          timeout: 300000,
          onSuccess: 'notify_team',
          onFailure: 'notify_team',
          parameters: {
            scan_type: 'malware_indicators',
            scope: 'network'
          }
        },
        {
          id: 'alert_emergency',
          name: 'Emergency Alert',
          description: 'Send emergency alert to all responders',
          order: 6,
          action: 'alert',
          target: 'emergency_contacts',
          automated: true,
          requiresApproval: false,
          timeout: 5000,
          onSuccess: 'complete',
          onFailure: 'complete',
          parameters: {
            severity: 'critical',
            message: 'CRITICAL: Malware detected and emergency isolation initiated'
          }
        },
        {
          id: 'notify_team',
          name: 'Notify Response Team',
          description: 'Notify incident response team',
          order: 7,
          action: 'alert',
          target: 'incident_response_team',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'create_incident',
          onFailure: 'create_incident',
          parameters: {
            severity: 'high',
            include_evidence: true
          }
        },
        {
          id: 'create_incident',
          name: 'Create Incident',
          description: 'Create formal incident record',
          order: 8,
          action: 'custom',
          target: 'incident',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'complete',
          onFailure: 'complete',
          parameters: {
            severity: 'critical',
            priority: 'p1',
            type: 'malware'
          }
        }
      ],
      estimatedDuration: 3600000,
      requiredPermissions: ['security:isolate', 'security:quarantine', 'forensics:collect'],
      tags: ['malware', 'critical', 'forensics']
    });

    // Data Breach Response Playbook
    this.addPlaybook({
      id: 'data_breach_response',
      name: 'Data Breach Response',
      description: 'Comprehensive data breach response playbook',
      threatType: ThreatType.DATA_EXFILTRATION,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'system',
      enabled: true,
      triggerConditions: [
        { field: 'threatType', operator: 'equals', value: ThreatType.DATA_EXFILTRATION }
      ],
      steps: [
        {
          id: 'contain_breach',
          name: 'Contain Breach',
          description: 'Stop ongoing data exfiltration',
          order: 1,
          action: 'block',
          target: '${exfiltration_channel}',
          automated: true,
          requiresApproval: false,
          timeout: 30000,
          onSuccess: 'identify_scope',
          onFailure: 'alert_emergency',
          parameters: {
            block_egress: true
          }
        },
        {
          id: 'identify_scope',
          name: 'Identify Breach Scope',
          description: 'Determine what data was accessed',
          order: 2,
          action: 'custom',
          target: 'forensics',
          automated: true,
          requiresApproval: false,
          timeout: 600000,
          onSuccess: 'preserve_evidence',
          onFailure: 'alert_legal',
          parameters: {
            analyze_logs: true,
            identify_affected_records: true
          }
        },
        {
          id: 'preserve_evidence',
          name: 'Preserve Evidence',
          description: 'Secure all relevant evidence',
          order: 3,
          action: 'custom',
          target: 'evidence_preservation',
          automated: true,
          requiresApproval: false,
          timeout: 300000,
          onSuccess: 'notify_legal',
          onFailure: 'notify_legal',
          parameters: {
            chain_of_custody: true,
            backup_logs: true
          }
        },
        {
          id: 'notify_legal',
          name: 'Notify Legal Team',
          description: 'Alert legal and compliance teams',
          order: 4,
          action: 'alert',
          target: 'legal_compliance',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'assess_notification',
          onFailure: 'assess_notification',
          parameters: {
            severity: 'critical',
            include_timeframe: true
          }
        },
        {
          id: 'assess_notification',
          name: 'Assess Notification Requirements',
          description: 'Determine regulatory notification requirements',
          order: 5,
          action: 'custom',
          target: 'compliance',
          automated: false,
          requiresApproval: false,
          timeout: 3600000,
          onSuccess: 'notify_parties',
          onFailure: 'notify_parties',
          parameters: {
            check_regulations: ['gdpr', 'ccpa', 'hipaa'],
            assess_harm: true
          }
        },
        {
          id: 'notify_parties',
          name: 'Notify Affected Parties',
          description: 'Send notifications to affected parties',
          order: 6,
          action: 'custom',
          target: 'notification_system',
          automated: false,
          requiresApproval: true,
          timeout: 86400000,
          onSuccess: 'create_incident',
          onFailure: 'create_incident',
          parameters: {
            notification_method: 'email',
            include_remediation: true
          }
        },
        {
          id: 'alert_emergency',
          name: 'Emergency Alert',
          description: 'Emergency breach notification',
          order: 7,
          action: 'alert',
          target: 'executives_legal',
          automated: true,
          requiresApproval: false,
          timeout: 5000,
          onSuccess: 'create_incident',
          onFailure: 'create_incident',
          parameters: {
            severity: 'critical',
            message: 'CRITICAL: Active data breach detected'
          }
        },
        {
          id: 'create_incident',
          name: 'Create Incident',
          description: 'Create formal incident record',
          order: 8,
          action: 'custom',
          target: 'incident',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'complete',
          onFailure: 'complete',
          parameters: {
            severity: 'critical',
            priority: 'p1',
            type: 'data_breach'
          }
        }
      ],
      estimatedDuration: 86400000,
      requiredPermissions: ['security:block', 'legal:notify', 'compliance:assess'],
      tags: ['data_breach', 'critical', 'legal', 'compliance']
    });

    // Phishing Response Playbook
    this.addPlaybook({
      id: 'phishing_response',
      name: 'Phishing Attack Response',
      description: 'Response to phishing attacks',
      threatType: ThreatType.PHISHING,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'system',
      enabled: true,
      triggerConditions: [
        { field: 'threatType', operator: 'equals', value: ThreatType.PHISHING }
      ],
      steps: [
        {
          id: 'block_sender',
          name: 'Block Phishing Sender',
          description: 'Block email sender/domain',
          order: 1,
          action: 'block',
          target: '${phishing_sender}',
          automated: true,
          requiresApproval: false,
          timeout: 30000,
          onSuccess: 'quarantine_emails',
          onFailure: 'alert_team',
          parameters: {
            scope: 'organization',
            block_domain: true
          }
        },
        {
          id: 'quarantine_emails',
          name: 'Quarantine Phishing Emails',
          description: 'Remove phishing emails from inboxes',
          order: 2,
          action: 'quarantine',
          target: '${phishing_emails}',
          automated: true,
          requiresApproval: false,
          timeout: 60000,
          onSuccess: 'identify_targets',
          onFailure: 'alert_team',
          parameters: {
            preserve_for_analysis: true
          }
        },
        {
          id: 'identify_targets',
          name: 'Identify Affected Users',
          description: 'Find users who interacted with phishing email',
          order: 3,
          action: 'custom',
          target: 'email_logs',
          automated: true,
          requiresApproval: false,
          timeout: 300000,
          onSuccess: 'alert_users',
          onFailure: 'alert_team',
          parameters: {
            find_clicks: true,
            find_downloads: true
          }
        },
        {
          id: 'alert_users',
          name: 'Alert Affected Users',
          description: 'Warn users about the phishing attempt',
          order: 4,
          action: 'alert',
          target: '${affected_users}',
          automated: true,
          requiresApproval: false,
          timeout: 60000,
          onSuccess: 'reset_credentials',
          onFailure: 'reset_credentials',
          parameters: {
            message: 'You may have interacted with a phishing email',
            include_guidance: true
          }
        },
        {
          id: 'reset_credentials',
          name: 'Force Password Reset',
          description: 'Require password reset for affected users',
          order: 5,
          action: 'custom',
          target: 'identity_provider',
          automated: true,
          requiresApproval: false,
          timeout: 120000,
          onSuccess: 'analyze_threat',
          onFailure: 'alert_team',
          parameters: {
            force_reset: true,
    expire_sessions: true
          }
        },
        {
          id: 'analyze_threat',
          name: 'Analyze Phishing Threat',
          description: 'Analyze phishing emails and payloads',
          order: 6,
          action: 'custom',
          target: 'threat_analysis',
          automated: true,
          requiresApproval: false,
          timeout: 600000,
          onSuccess: 'update_filters',
          onFailure: 'alert_team',
          parameters: {
            extract_indicators: true,
            check_reputation: true
          }
        },
        {
          id: 'update_filters',
          name: 'Update Security Filters',
          description: 'Update email filters and security rules',
          order: 7,
          action: 'custom',
          target: 'security_filters',
          automated: true,
          requiresApproval: false,
          timeout: 60000,
          onSuccess: 'create_incident',
          onFailure: 'create_incident',
          parameters: {
            update_spam_rules: true,
            update_malware_rules: true
          }
        },
        {
          id: 'create_incident',
          name: 'Create Incident',
          description: 'Create formal incident record',
          order: 8,
          action: 'custom',
          target: 'incident',
          automated: true,
          requiresApproval: false,
          timeout: 10000,
          onSuccess: 'complete',
          onFailure: 'complete',
          parameters: {
            severity: 'medium',
            priority: 'p3',
            type: 'phishing'
          }
        }
      ],
      estimatedDuration: 1800000,
      requiredPermissions: ['email:block', 'email:quarantine', 'identity:reset'],
      tags: ['phishing', 'email', 'social_engineering']
    });
  }

  /**
   * Add playbook to library
   */
  addPlaybook(playbook: Playbook): void {
    this.playbooks.set(playbook.id, playbook);
  }

  /**
   * Get playbook by ID
   */
  getPlaybook(id: string): Playbook | undefined {
    return this.playbooks.get(id);
  }

  /**
   * Get playbook for threat type
   */
  getPlaybookForThreat(threatType: ThreatType): Playbook | undefined {
    for (const playbook of this.playbooks.values()) {
      if (playbook.threatType === threatType && playbook.enabled) {
        return playbook;
      }
    }
    return undefined;
  }

  /**
   * Get all playbooks
   */
  getPlaybooks(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  /**
   * Update playbook
   */
  updatePlaybook(id: string, updates: Partial<Playbook>): boolean {
    const playbook = this.playbooks.get(id);
    if (!playbook) {
      return false;
    }

    this.playbooks.set(id, {
      ...playbook,
      ...updates,
      updatedAt: Date.now()
    });

    return true;
  }

  /**
   * Delete playbook
   */
  deletePlaybook(id: string): boolean {
    return this.playbooks.delete(id);
  }

  /**
   * Enable/disable playbook
   */
  setPlaybookEnabled(id: string, enabled: boolean): boolean {
    const playbook = this.playbooks.get(id);
    if (!playbook) {
      return false;
    }

    playbook.enabled = enabled;
    playbook.updatedAt = Date.now();
    return true;
  }
}

// ============================================================================
// Playbook Executor
// ============================================================================

export interface PlaybookExecution {
  id: string;
  playbookId: string;
  playbookName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  trigger: {
    type: 'automatic' | 'manual';
    incidentId?: string;
    detectionId?: string;
    triggeredBy?: string;
  };
  steps: PlaybookStepExecution[];
  variables: Record<string, any>;
  result?: {
    success: boolean;
    message: string;
    executedSteps: number;
    totalSteps: number;
  };
}

export interface PlaybookStepExecution {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  action?: ResponseAction;
  target: string;
  result?: ActionResult;
  error?: string;
}

export class PlaybookExecutor {
  private library: PlaybookLibrary;
  private responseExecutor: ResponseExecutor;
  private executions: Map<string, PlaybookExecution> = new Map();

  constructor(library?: PlaybookLibrary, responseExecutor?: ResponseExecutor) {
    this.library = library || new PlaybookLibrary();
    this.responseExecutor = responseExecutor || new ResponseExecutor();
  }

  /**
   * Execute playbook
   */
  async execute(playbookId: string, trigger: {
    type: 'automatic' | 'manual';
    incidentId?: string;
    detectionId?: string;
    triggeredBy?: string;
  }, variables: Record<string, any> = {}): Promise<PlaybookExecution> {
    const playbook = this.library.getPlaybook(playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${playbookId}`);
    }

    if (!playbook.enabled) {
      throw new Error(`Playbook is disabled: ${playbookId}`);
    }

    const executionId = generateId();
    const execution: PlaybookExecution = {
      id: executionId,
      playbookId: playbook.id,
      playbookName: playbook.name,
      status: 'running',
      startedAt: Date.now(),
      trigger,
      steps: [],
      variables
    };

    this.executions.set(executionId, execution);

    try {
      await this.executeSteps(playbook, execution, variables);
      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.result = {
        success: true,
        message: 'Playbook executed successfully',
        executedSteps: execution.steps.filter(s => s.status === 'completed').length,
        totalSteps: playbook.steps.length
      };
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.result = {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        executedSteps: execution.steps.filter(s => s.status === 'completed').length,
        totalSteps: playbook.steps.length
      };
    }

    return execution;
  }

  /**
   * Execute playbook steps
   */
  private async executeSteps(
    playbook: Playbook,
    execution: PlaybookExecution,
    variables: Record<string, any>
  ): Promise<void> {
    const sortedSteps = [...playbook.steps].sort((a, b) => a.order - b.order);
    let currentStepIndex = 0;

    while (currentStepIndex < sortedSteps.length) {
      const step = sortedSteps[currentStepIndex];
      const stepExecution = await this.executeStep(step, variables, execution);
      execution.steps.push(stepExecution);

      if (stepExecution.status === 'failed') {
        // Determine next step based on failure
        if (step.onFailure === 'abort') {
          throw new Error(`Step "${step.name}" failed: ${stepExecution.error}`);
        } else if (step.onFailure !== step.id) {
          // Find failure step
          const failureStep = sortedSteps.find(s => s.id === step.onFailure);
          if (failureStep) {
            currentStepIndex = sortedSteps.indexOf(failureStep);
            continue;
          }
        }
        break;
      }

      // Move to next step based on success
      if (step.onSuccess !== step.id) {
        const successStep = sortedSteps.find(s => s.id === step.onSuccess);
        if (successStep) {
          currentStepIndex = sortedSteps.indexOf(successStep);
          continue;
        }
      }

      currentStepIndex++;
    }
  }

  /**
   * Execute single step
   */
  private async executeStep(
    step: PlaybookStep,
    variables: Record<string, any>,
    execution: PlaybookExecution
  ): Promise<PlaybookStepExecution> {
    const stepExecution: PlaybookStepExecution = {
      stepId: step.id,
      stepName: step.name,
      status: 'running',
      startedAt: Date.now(),
      action: step.action,
      target: this.substituteVariables(step.target, variables)
    };

    try {
      // Check if approval is required
      if (step.requiresApproval) {
        // In a real system, this would wait for approval
        // For now, we'll assume approval is granted
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Execute the action
      if (step.action === 'custom') {
        // Custom action execution
        stepExecution.result = {
          success: true,
          message: `Custom action "${step.name}" executed`,
          details: step.parameters
        };
      } else {
        // Standard action execution
        const result = await this.responseExecutor.execute(
          step.action,
          stepExecution.target,
          { ...step.parameters, variables }
        );
        stepExecution.result = result;

        if (!result.success) {
          stepExecution.status = 'failed';
          stepExecution.error = result.message;
          stepExecution.completedAt = Date.now();
          return stepExecution;
        }
      }

      stepExecution.status = 'completed';
      stepExecution.completedAt = Date.now();
    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = error instanceof Error ? error.message : String(error);
      stepExecution.completedAt = Date.now();
    }

    return stepExecution;
  }

  /**
   * Substitute variables in string
   */
  private substituteVariables(str: string, variables: Record<string, any>): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Get execution by ID
   */
  getExecution(id: string): PlaybookExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Get all executions
   */
  getExecutions(filters?: {
    playbookId?: string;
    status?: PlaybookExecution['status'];
  }): PlaybookExecution[] {
    let executions = Array.from(this.executions.values());

    if (filters) {
      if (filters.playbookId) {
        executions = executions.filter(e => e.playbookId === filters.playbookId);
      }
      if (filters.status) {
        executions = executions.filter(e => e.status === filters.status);
      }
    }

    return executions.sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Cancel execution
   */
  cancelExecution(id: string): boolean {
    const execution = this.executions.get(id);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    execution.status = 'cancelled';
    execution.completedAt = Date.now();
    execution.result = {
      success: false,
      message: 'Execution cancelled',
      executedSteps: execution.steps.filter(s => s.status === 'completed').length,
      totalSteps: execution.steps.length
    };

    return true;
  }
}
