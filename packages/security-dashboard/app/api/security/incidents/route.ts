import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');

    // Generate mock incidents
    const incidents = [
      {
        id: '1',
        title: 'Suspicious Database Access',
        description: 'Multiple failed login attempts detected from unusual IP addresses targeting the production database.',
        severity: 'high',
        status: 'investigating',
        priority: 2,
        assignedTo: 'security@claudeflare.com',
        createdBy: 'system',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['database', 'brute-force', 'external'],
        tasks: [
          {
            id: 't1',
            title: 'Identify source IP addresses',
            description: 'Analyze logs to identify all attacking IPs',
            status: 'completed',
            assignedTo: 'analyst1@claudeflare.com',
            completedAt: new Date(Date.now() - 1800000).toISOString(),
            order: 1,
          },
          {
            id: 't2',
            title: 'Block malicious IPs',
            description: 'Add IP addresses to firewall blocklist',
            status: 'in-progress',
            assignedTo: 'analyst2@claudeflare.com',
            order: 2,
          },
          {
            id: 't3',
            title: 'Audit affected accounts',
            description: 'Review all accounts that were targeted',
            status: 'pending',
            order: 3,
          },
        ],
        timeline: [
          {
            id: 'tl1',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            action: 'Incident Created',
            description: 'Incident automatically created by security system',
            performedBy: 'system',
          },
          {
            id: 'tl2',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            action: 'Task Completed',
            description: 'Source IPs identified',
            performedBy: 'analyst1@claudeflare.com',
          },
        ],
        affectedAssets: ['prod-db-01', 'prod-db-02'],
        indicators: [],
        impact: {
          usersAffected: 0,
          systemsAffected: ['prod-db-01', 'prod-db-02'],
          dataExposed: false,
        },
      },
      {
        id: '2',
        title: 'Malware Detected on Employee Workstation',
        description: 'Endpoint protection detected suspicious activity on workstation WS-0234.',
        severity: 'critical',
        status: 'contained',
        priority: 1,
        assignedTo: 'security@claudeflare.com',
        createdBy: 'system',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: new Date(Date.now() - 3600000).toISOString(),
        tags: ['malware', 'endpoint', 'employee'],
        tasks: [
          {
            id: 't4',
            title: 'Isolate affected workstation',
            description: 'Disconnect from network to prevent spread',
            status: 'completed',
            completedAt: new Date(Date.now() - 82800000).toISOString(),
            order: 1,
          },
          {
            id: 't5',
            title: 'Scan for malware',
            description: 'Run full system scan',
            status: 'completed',
            completedAt: new Date(Date.now() - 72000000).toISOString(),
            order: 2,
          },
        ],
        timeline: [],
        affectedAssets: ['WS-0234'],
        indicators: [],
        resolution: 'Malware removed, system restored from clean backup',
        impact: {
          usersAffected: 1,
          systemsAffected: ['WS-0234'],
          dataExposed: false,
        },
      },
      {
        id: '3',
        title: 'Potential Data Exfiltration',
        description: 'Unusually large data transfer detected from internal network to external IP.',
        severity: 'high',
        status: 'open',
        priority: 1,
        assignedTo: 'security@claudeflare.com',
        createdBy: 'system',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['data-exfiltration', 'network', 'internal'],
        tasks: [],
        timeline: [],
        affectedAssets: ['file-server-01'],
        indicators: [],
        impact: {
          usersAffected: 0,
          systemsAffected: ['file-server-01'],
          dataExposed: true,
          estimatedLoss: 50000,
        },
      },
      {
        id: '4',
        title: 'Phishing Campaign Detected',
        description: 'Multiple employees reported receiving suspicious emails.',
        severity: 'medium',
        status: 'resolved',
        priority: 3,
        assignedTo: 'security@claudeflare.com',
        createdBy: 'user',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: new Date(Date.now() - 86400000).toISOString(),
        tags: ['phishing', 'email', 'social-engineering'],
        tasks: [],
        timeline: [],
        affectedAssets: ['email-gateway'],
        indicators: [],
        resolution: 'Emails blocked, users notified, awareness training scheduled',
        impact: {
          usersAffected: 15,
          systemsAffected: [],
          dataExposed: false,
        },
      },
      {
        id: '5',
        title: 'API Rate Limit Exceeded',
        description: 'Unusual API traffic pattern detected from multiple IP addresses.',
        severity: 'medium',
        status: 'investigating',
        priority: 3,
        createdBy: 'system',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['api', 'rate-limit', 'traffic'],
        tasks: [],
        timeline: [],
        affectedAssets: ['api-gateway'],
        indicators: [],
        impact: {
          usersAffected: 0,
          systemsAffected: ['api-gateway'],
          dataExposed: false,
        },
      },
    ];

    // Filter incidents
    let filteredIncidents = incidents;
    if (severity) {
      filteredIncidents = filteredIncidents.filter(i => i.severity === severity);
    }
    if (status) {
      filteredIncidents = filteredIncidents.filter(i => i.status === status);
    }

    // Paginate
    const start = (page - 1) * pageSize;
    const paginatedIncidents = filteredIncidents.slice(start, start + pageSize);

    return NextResponse.json({
      data: paginatedIncidents,
      success: true,
      pagination: {
        page,
        pageSize,
        total: filteredIncidents.length,
        totalPages: Math.ceil(filteredIncidents.length / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
