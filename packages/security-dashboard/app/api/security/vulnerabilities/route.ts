import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'scans') {
      // Return vulnerability scans
      const scans = [
        {
          id: 'scan-1',
          name: 'Full Infrastructure Scan',
          type: 'full',
          status: 'completed',
          startTime: new Date(Date.now() - 86400000).toISOString(),
          endTime: new Date(Date.now() - 72000000).toISOString(),
          duration: 14400,
          vulnerabilities: [],
          summary: {
            total: 234,
            critical: 3,
            high: 15,
            medium: 67,
            low: 98,
            info: 51,
          },
          targets: ['production', 'staging', 'development'],
          scheduled: true,
          nextRun: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          id: 'scan-2',
          name: 'Quick Scan - Production',
          type: 'quick',
          status: 'completed',
          startTime: new Date(Date.now() - 43200000).toISOString(),
          endTime: new Date(Date.now() - 39600000).toISOString(),
          duration: 3600,
          vulnerabilities: [],
          summary: {
            total: 45,
            critical: 1,
            high: 3,
            medium: 12,
            low: 20,
            info: 9,
          },
          targets: ['production'],
          scheduled: false,
        },
        {
          id: 'scan-3',
          name: 'Compliance Scan - SOC 2',
          type: 'compliance',
          status: 'running',
          startTime: new Date(Date.now() - 1800000).toISOString(),
          targets: ['production', 'staging'],
          scheduled: true,
          vulnerabilities: [],
          summary: {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
          },
        },
      ];

      return NextResponse.json(scans);
    }

    if (type === 'trend') {
      // Return vulnerability trend data
      const days = parseInt(searchParams.get('days') || '30');
      const trend = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        return {
          date: date.toISOString(),
          critical: Math.floor(Math.random() * 5),
          high: Math.floor(Math.random() * 15) + 5,
          medium: Math.floor(Math.random() * 30) + 20,
          low: Math.floor(Math.random() * 40) + 30,
          info: Math.floor(Math.random() * 50) + 40,
        };
      });

      return NextResponse.json(trend);
    }

    // Return vulnerabilities by default
    const vulnerabilities = [
      {
        id: '1',
        cveId: 'CVE-2024-1234',
        title: 'Remote Code Execution in Web Application Framework',
        description: 'A critical RCE vulnerability exists in the framework that could allow attackers to execute arbitrary code.',
        severity: 'critical',
        cvssScore: 9.8,
        cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
        affectedComponent: '@claudeflare/framework',
        affectedVersion: '2.1.0',
        fixedVersion: '2.1.1',
        discoveredAt: new Date(Date.now() - 86400000).toISOString(),
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        status: 'open',
        falsePositive: false,
        remediation: 'Upgrade to version 2.1.1 or later',
        references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-1234'],
        exploits: true,
        exploitsAvailable: 2,
        patches: true,
      },
      {
        id: '2',
        cveId: 'CVE-2024-5678',
        title: 'SQL Injection in Authentication Module',
        description: 'SQL injection vulnerability in the login form that could allow bypassing authentication.',
        severity: 'high',
        cvssScore: 8.6,
        cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affectedComponent: 'auth-service',
        affectedVersion: '1.5.0',
        fixedVersion: '1.5.2',
        discoveredAt: new Date(Date.now() - 172800000).toISOString(),
        publishedAt: new Date(Date.now() - 259200000).toISOString(),
        status: 'in-progress',
        falsePositive: false,
        remediation: 'Apply patch 1.5.2 or implement parameterized queries',
        references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-5678'],
        exploits: false,
        patches: true,
      },
      {
        id: '3',
        cveId: 'CVE-2024-9012',
        title: 'Information Disclosure in API Response',
        description: 'Sensitive information may be exposed in API error responses.',
        severity: 'medium',
        cvssScore: 5.3,
        cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
        affectedComponent: 'api-gateway',
        affectedVersion: '3.0.0',
        fixedVersion: '3.0.1',
        discoveredAt: new Date(Date.now() - 259200000).toISOString(),
        publishedAt: new Date(Date.now() - 345600000).toISOString(),
        status: 'open',
        falsePositive: false,
        remediation: 'Update to version 3.0.1 or implement error response sanitization',
        references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-9012'],
        exploits: false,
        patches: true,
      },
      {
        id: '4',
        title: 'Outdated JavaScript Dependency',
        description: 'lodash version 4.17.15 contains known vulnerabilities',
        severity: 'low',
        cvssScore: 3.1,
        cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N',
        affectedComponent: 'lodash',
        affectedVersion: '4.17.15',
        fixedVersion: '4.17.21',
        discoveredAt: new Date(Date.now() - 432000000).toISOString(),
        status: 'open',
        falsePositive: false,
        remediation: 'Update lodash to version 4.17.21 or later',
        references: [],
        exploits: false,
        patches: true,
      },
      {
        id: '5',
        cveId: 'CVE-2024-3456',
        title: 'Cross-Site Scripting in Dashboard',
        description: 'Reflected XSS vulnerability in the search functionality.',
        severity: 'medium',
        cvssScore: 6.1,
        cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
        affectedComponent: 'dashboard-ui',
        affectedVersion: '1.2.0',
        fixedVersion: '1.2.1',
        discoveredAt: new Date(Date.now() - 518400000).toISOString(),
        status: 'resolved',
        falsePositive: false,
        remediation: 'Resolved - Input validation added',
        references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-3456'],
        exploits: false,
        patches: true,
      },
    ];

    return NextResponse.json(vulnerabilities);
  } catch (error) {
    console.error('Error fetching vulnerabilities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vulnerabilities' },
      { status: 500 }
    );
  }
}
