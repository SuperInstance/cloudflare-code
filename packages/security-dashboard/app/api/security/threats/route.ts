import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'map') {
      // Return threat map data
      const mapData = [
        {
          latitude: 40.7128,
          longitude: -74.006,
          count: Math.floor(Math.random() * 200) + 100,
          severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
          country: 'United States',
          city: 'New York',
        },
        {
          latitude: 51.5074,
          longitude: -0.1278,
          count: Math.floor(Math.random() * 150) + 80,
          severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
          country: 'United Kingdom',
          city: 'London',
        },
        {
          latitude: 52.5200,
          longitude: 13.4050,
          count: Math.floor(Math.random() * 120) + 60,
          severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
          country: 'Germany',
          city: 'Berlin',
        },
        {
          latitude: 35.6762,
          longitude: 139.6503,
          count: Math.floor(Math.random() * 100) + 50,
          severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
          country: 'Japan',
          city: 'Tokyo',
        },
        {
          latitude: -33.8688,
          longitude: 151.2093,
          count: Math.floor(Math.random() * 80) + 40,
          severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
          country: 'Australia',
          city: 'Sydney',
        },
      ];

      return NextResponse.json(mapData);
    }

    if (type === 'campaigns') {
      // Return attack campaigns
      const campaigns = [
        {
          id: '1',
          name: 'Operation Dark Cloud',
          description: 'Coordinated DDoS attack targeting financial institutions',
          status: 'active',
          startDate: new Date(Date.now() - 604800000).toISOString(),
          targets: ['api.example.com', 'app.example.com'],
          tactics: ['DDoS', 'Amplification Attack'],
          severity: 'critical',
          indicators: [],
        },
        {
          id: '2',
          name: 'APT-28 Campaign',
          description: 'Advanced persistent threat targeting government systems',
          status: 'mitigated',
          startDate: new Date(Date.now() - 2592000000).toISOString(),
          endDate: new Date(Date.now() - 864000000).toISOString(),
          targets: ['gov-system.example.com'],
          tactics: ['Spear Phishing', 'Credential Stuffing', 'Lateral Movement'],
          severity: 'high',
          attribution: 'Nation-State Actor',
          indicators: [],
        },
        {
          id: '3',
          name: 'Cryptojacking Ring',
          description: 'Cryptocurrency mining malware campaign',
          status: 'active',
          startDate: new Date(Date.now() - 1209600000).toISOString(),
          targets: ['server-cluster.example.com'],
          tactics: ['Resource Exploitation', 'Privilege Escalation'],
          severity: 'medium',
          indicators: [],
        },
      ];

      return NextResponse.json(campaigns);
    }

    // Return threat feeds by default
    const feeds = [
      {
        id: 'cve-feed',
        name: 'CVE Database',
        type: 'cve',
        updateFrequency: 'hourly',
        lastUpdate: new Date().toISOString(),
        status: 'active',
        indicators: [],
      },
      {
        id: 'ioc-feed',
        name: 'IOC Indicators',
        type: 'ioc',
        updateFrequency: 'daily',
        lastUpdate: new Date(Date.now() - 3600000).toISOString(),
        status: 'active',
        indicators: [],
      },
      {
        id: 'zero-day-feed',
        name: 'Zero-Day Alerts',
        type: 'zero-day',
        updateFrequency: 'real-time',
        lastUpdate: new Date().toISOString(),
        status: 'active',
        indicators: [],
      },
    ];

    return NextResponse.json(feeds);
  } catch (error) {
    console.error('Error fetching threat intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threat intelligence' },
      { status: 500 }
    );
  }
}
