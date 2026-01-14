import { WebhookEvent } from '@/types';

export class WebhookClient {
  private wsUrl: string;
  private apiKey?: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(event: WebhookEvent) => void>> = new Map();

  constructor(wsUrl: string, apiKey?: string) {
    this.wsUrl = wsUrl;
    this.apiKey = apiKey;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.wsUrl);
        if (this.apiKey) {
          url.searchParams.set('apiKey', this.apiKey);
        }

        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          console.log('Webhook debugger connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const webhookEvent: WebhookEvent = JSON.parse(event.data);
            this.emit('webhook', webhookEvent);
          } catch (error) {
            console.error('Failed to parse webhook event:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Webhook debugger disconnected');
          // Auto-reconnect after 5 seconds
          setTimeout(() => {
            this.connect().catch(console.error);
          }, 5000);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, callback: (event: WebhookEvent) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (event: WebhookEvent) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, data: WebhookEvent): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in webhook event listener:', error);
        }
      });
    }
  }

  async replayEvent(eventId: string): Promise<void> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.claudeflare.dev';

    const response = await fetch(`${apiUrl}/v1/webhooks/replay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({ eventId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to replay event: ${response.statusText}`);
    }
  }

  async verifySignature(
    payload: any,
    signature: string,
    secret: string
  ): Promise<boolean> {
    // Import crypto dynamically
    const crypto = await import('crypto');

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = hmac.digest('hex');

    return signature === expectedSignature;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
}

// Singleton instance
let webhookClientInstance: WebhookClient | null = null;

export function getWebhookClient(): WebhookClient {
  if (!webhookClientInstance) {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || 'wss://api.claudeflare.dev';
    webhookClientInstance = new WebhookClient(wsUrl);
  }
  return webhookClientInstance;
}

export function setWebhookApiKey(apiKey: string) {
  const client = getWebhookClient();
  client.setApiKey(apiKey);
}
