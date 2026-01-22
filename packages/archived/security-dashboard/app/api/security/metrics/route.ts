import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Generate mock security metrics
    const now = new Date();
    const timeline = Array.from({ length: 24 }, (_, i) => {
      const date = new Date(now);
      date.setHours(date.getHours() - (23 - i));
      return date;
    });

    const metrics = {
      realTime: {
        threatAttempts: {
          id: '1',
          name: 'Threat Attempts',
          value: Math.floor(Math.random() * 500) + 1000,
          unit: 'count',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 30 - 10).toFixed(1)),
          threshold: { warning: 1000, critical: 1500 },
          timestamp: now,
        },
        blockedAttacks: {
          id: '2',
          name: 'Blocked Attacks',
          value: Math.floor(Math.random() * 400) + 800,
          unit: 'count',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 25 - 5).toFixed(1)),
          threshold: { warning: 900, critical: 1200 },
          timestamp: now,
        },
        activeSessions: {
          id: '3',
          name: 'Active Sessions',
          value: Math.floor(Math.random() * 1000) + 3000,
          unit: 'sessions',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 10 - 3).toFixed(1)),
          threshold: { warning: 4000, critical: 5000 },
          timestamp: now,
        },
        failedLogins: {
          id: '4',
          name: 'Failed Logins',
          value: Math.floor(Math.random() * 200) + 100,
          unit: 'attempts',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 20 - 10).toFixed(1)),
          threshold: { warning: 300, critical: 500 },
          timestamp: now,
        },
        apiAbuse: {
          id: '5',
          name: 'API Abuse Attempts',
          value: Math.floor(Math.random() * 100) + 50,
          unit: 'attempts',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 40 - 15).toFixed(1)),
          threshold: { warning: 100, critical: 200 },
          timestamp: now,
        },
        dataExfiltrationAttempts: {
          id: '6',
          name: 'Data Exfiltration Attempts',
          value: Math.floor(Math.random() * 20) + 5,
          unit: 'attempts',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 10 - 5).toFixed(1)),
          threshold: { warning: 20, critical: 50 },
          timestamp: now,
        },
        anomalyScore: {
          id: '7',
          name: 'Anomaly Score',
          value: Math.floor(Math.random() * 50) + 10,
          unit: 'score',
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          change: parseFloat((Math.random() * 15 - 5).toFixed(1)),
          threshold: { warning: 50, critical: 75 },
          timestamp: now,
        },
      },
      historical: {
        timeline,
        threatAttempts: timeline.map(() => Math.floor(Math.random() * 500) + 800),
        blockedAttacks: timeline.map(() => Math.floor(Math.random() * 400) + 700),
        failedLogins: timeline.map(() => Math.floor(Math.random() * 100) + 150),
        apiAbuse: timeline.map(() => Math.floor(Math.random() * 50) + 50),
      },
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security metrics' },
      { status: 500 }
    );
  }
}
