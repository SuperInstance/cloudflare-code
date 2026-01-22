import { UsageAnalytics, UsageMetrics, BillingInfo, CostForecast } from '@/types';

export class AnalyticsClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  async getUsageAnalytics(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UsageAnalytics> {
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      granularity,
    });

    const response = await fetch(
      `${this.baseUrl}/v1/analytics/usage?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch usage analytics: ${response.statusText}`);
    }

    return response.json();
  }

  async getMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<UsageMetrics[]> {
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    const response = await fetch(
      `${this.baseUrl}/v1/analytics/metrics?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    return response.json();
  }

  async getTopEndpoints(
    startDate: Date,
    endDate: Date,
    limit = 10
  ): Promise<Array<{ path: string; requests: number; avgLatency: number }>> {
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      limit: limit.toString(),
    });

    const response = await fetch(
      `${this.baseUrl}/v1/analytics/top-endpoints?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch top endpoints: ${response.statusText}`);
    }

    return response.json();
  }

  async getProviderBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ provider: string; requests: number; cost: number }>> {
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    const response = await fetch(
      `${this.baseUrl}/v1/analytics/providers?${params}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch provider breakdown: ${response.statusText}`);
    }

    return response.json();
  }

  async getBillingInfo(): Promise<BillingInfo> {
    const response = await fetch(`${this.baseUrl}/v1/billing`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch billing info: ${response.statusText}`);
    }

    return response.json();
  }

  async getCostForecast(
    period: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<CostForecast> {
    const response = await fetch(
      `${this.baseUrl}/v1/billing/forecast?period=${period}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch cost forecast: ${response.statusText}`);
    }

    return response.json();
  }

  async getInvoices(limit = 12): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/v1/billing/invoices?limit=${limit}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch invoices: ${response.statusText}`);
    }

    return response.json();
  }

  async downloadInvoice(invoiceId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/v1/billing/invoices/${invoiceId}/download`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download invoice: ${response.statusText}`);
    }

    return response.blob();
  }

  async updateBudgetAlert(amount: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/billing/budget-alert`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amount }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update budget alert: ${response.statusText}`);
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
}

// Singleton instance
let analyticsClientInstance: AnalyticsClient | null = null;

export function getAnalyticsClient(): AnalyticsClient {
  if (!analyticsClientInstance) {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://api.claudeflare.dev';
    analyticsClientInstance = new AnalyticsClient(baseUrl);
  }
  return analyticsClientInstance;
}

export function setAnalyticsApiKey(apiKey: string) {
  const client = getAnalyticsClient();
  client.setApiKey(apiKey);
}
