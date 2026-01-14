import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'frameworks') {
      // Return compliance frameworks
      const frameworks = [
        {
          id: 'soc2',
          name: 'SOC 2 Type II',
          version: '2017',
          description: 'Service Organization Control 2 Type II compliance for security, availability, and confidentiality',
          status: 'compliant',
          lastAudit: new Date(Date.now() - 15552000000).toISOString(),
          nextAudit: new Date(Date.now() + 7776000000).toISOString(),
          controls: [],
          overallScore: 94,
        },
        {
          id: 'iso27001',
          name: 'ISO 27001',
          version: '2013',
          description: 'Information Security Management System standard',
          status: 'partial',
          lastAudit: new Date(Date.now() - 31104000000).toISOString(),
          nextAudit: new Date(Date.now() + 15552000000).toISOString(),
          controls: [],
          overallScore: 87,
        },
        {
          id: 'gdpr',
          name: 'GDPR',
          version: '2016',
          description: 'General Data Protection Regulation compliance',
          status: 'compliant',
          lastAudit: new Date(Date.now() - 7776000000).toISOString(),
          nextAudit: new Date(Date.now() + 15552000000).toISOString(),
          controls: [],
          overallScore: 92,
        },
        {
          id: 'hipaa',
          name: 'HIPAA',
          version: '2013',
          description: 'Health Insurance Portability and Accountability Act',
          status: 'non-compliant',
          lastAudit: new Date(Date.now() - 43200000000).toISOString(),
          nextAudit: new Date(Date.now() + 2592000000).toISOString(),
          controls: [],
          overallScore: 72,
        },
        {
          id: 'pci-dss',
          name: 'PCI DSS',
          version: '4.0',
          description: 'Payment Card Industry Data Security Standard',
          status: 'compliant',
          lastAudit: new Date(Date.now() - 12960000000).toISOString(),
          nextAudit: new Date(Date.now() + 10368000000).toISOString(),
          controls: [],
          overallScore: 96,
        },
      ];

      return NextResponse.json(frameworks);
    }

    if (type === 'policies') {
      // Return policies
      const policies = [
        {
          id: 'policy-1',
          name: 'Information Security Policy',
          description: 'High-level policy governing information security practices',
          category: 'Governance',
          version: '3.2',
          status: 'active',
          content: 'This policy establishes the framework for ensuring information security...',
          createdAt: new Date(Date.now() - 15552000000).toISOString(),
          updatedAt: new Date(Date.now() - 2592000000).toISOString(),
          reviewedAt: new Date(Date.now() - 2592000000).toISOString(),
          approvedBy: 'CISO',
          controls: ['soc2-cc1.1', 'iso27001-a.5.1'],
        },
        {
          id: 'policy-2',
          name: 'Access Control Policy',
          description: 'Policy governing user access and authentication',
          category: 'Access Control',
          version: '2.1',
          status: 'active',
          content: 'This policy defines requirements for managing user access...',
          createdAt: new Date(Date.now() - 25920000000).toISOString(),
          updatedAt: new Date(Date.now() - 5184000000).toISOString(),
          reviewedAt: new Date(Date.now() - 5184000000).toISOString(),
          approvedBy: 'CISO',
          controls: ['soc2-cc6.1', 'iso27001-a.9.1'],
        },
        {
          id: 'policy-3',
          name: 'Incident Response Policy',
          description: 'Policy for responding to security incidents',
          category: 'Incident Management',
          version: '1.8',
          status: 'active',
          content: 'This policy outlines the procedures for incident response...',
          createdAt: new Date(Date.now() - 31104000000).toISOString(),
          updatedAt: new Date(Date.now() - 7776000000).toISOString(),
          reviewedAt: new Date(Date.now() - 7776000000).toISOString(),
          approvedBy: 'CISO',
          controls: ['soc2-cc7.2', 'iso27001-a.16.1'],
        },
      ];

      return NextResponse.json(policies);
    }

    if (type === 'controls') {
      // Return compliance controls
      const frameworkId = searchParams.get('frameworkId');

      const controls = [
        {
          id: 'soc2-cc1.1',
          frameworkId: 'soc2',
          name: 'Control 1.1 - Security Policy',
          description: 'Establishes a security policy that is approved by management',
          category: 'Governance',
          status: 'compliant',
          evidence: [],
          policies: ['policy-1'],
          lastReviewed: new Date(Date.now() - 2592000000).toISOString(),
          nextReview: new Date(Date.now() + 7776000000).toISOString(),
          owner: 'CISO',
        },
        {
          id: 'soc2-cc6.1',
          frameworkId: 'soc2',
          name: 'Control 6.1 - Access Controls',
          description: 'Implement logical and physical access controls',
          category: 'Access Control',
          status: 'compliant',
          evidence: [],
          policies: ['policy-2'],
          lastReviewed: new Date(Date.now() - 5184000000).toISOString(),
          nextReview: new Date(Date.now() + 5184000000).toISOString(),
          owner: 'Security Lead',
        },
        {
          id: 'soc2-cc7.2',
          frameworkId: 'soc2',
          name: 'Control 7.2 - Incident Response',
          description: 'Establish and maintain incident response procedures',
          category: 'Incident Management',
          status: 'partial',
          evidence: [],
          policies: ['policy-3'],
          lastReviewed: new Date(Date.now() - 7776000000).toISOString(),
          nextReview: new Date(Date.now() + 2592000000).toISOString(),
          owner: 'Incident Response Lead',
          gapAnalysis: {
            current: 'Incident response procedures documented but not tested',
            required: 'Regular testing and updating of incident response procedures',
            gap: 'Procedures need to be tested quarterly',
            priority: 'medium',
          },
        },
      ];

      const filteredControls = frameworkId
        ? controls.filter(c => c.frameworkId === frameworkId)
        : controls;

      return NextResponse.json(filteredControls);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching compliance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}
