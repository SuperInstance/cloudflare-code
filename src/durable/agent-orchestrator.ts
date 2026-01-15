/**
 * Agent Orchestrator Durable Object
 * Manages agent sessions and coordination
 */
export class AgentOrchestrator {
  private counter = 0;
  private sessions = new Map<string, any>();
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
    // Load state from storage
    this.storage.get<number>('counter').then((savedCounter) => {
      if (savedCounter !== undefined) {
        this.counter = savedCounter;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle WebSocket connections
    if (request.headers.get('Upgrade') === 'websocket') {
      return await this.handleWebSocket(request);
    }

    // REST API endpoints
    switch (pathname) {
      case '/counter':
        return this.handleCounter(request);
      case '/sessions':
        return this.handleSessions(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleWebSocket(_request: Request): Promise<Response> {
    // Mock WebSocket implementation for testing
    const pair = Object.values(new WebSocketPair());
    const client = pair[0] as WebSocket;
    const server = pair[1] as WebSocket;

    server.accept();
    server.send(JSON.stringify({ type: 'connected', counter: this.counter }));

    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'increment') {
          this.counter++;
          server.send(JSON.stringify({ type: 'counter', value: this.counter }));
        }
      } catch (error) {
        server.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleCounter(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'get':
        return Response.json({ value: this.counter });
      case 'increment':
        this.counter++;
        await this.storage.put('counter', this.counter);
        return Response.json({ value: this.counter });
      case 'reset':
        this.counter = 0;
        await this.storage.put('counter', this.counter);
        return Response.json({ value: this.counter });
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  }

  private handleSessions(request: Request): Response {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'list':
        return Response.json({ sessions: Array.from(this.sessions.keys()) });
      case 'create':
        const sessionId = Math.random().toString(36).substr(2, 9);
        this.sessions.set(sessionId, { created: Date.now() });
        return Response.json({ sessionId });
      case 'delete':
        const key = url.searchParams.get('key');
        if (key && this.sessions.has(key)) {
          this.sessions.delete(key);
          return Response.json({ success: true });
        }
        return Response.json({ error: 'Session not found' }, { status: 404 });
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  }
}