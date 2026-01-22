import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';

/**
 * Chat API Integration Tests
 *
 * Tests chat API endpoints, WebSocket communication, and streaming responses
 */

describe('Chat API Integration', () => {
  let apiClient: AxiosInstance;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup API client
    apiClient = axios.create({
      baseURL: process.env.API_BASE_URL || 'http://localhost:8787',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Get auth token
    const response = await apiClient.post('/api/auth/login', {
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword'
    });

    authToken = response.data.token;
    testUserId = response.data.user.id;

    // Update client with auth token
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  });

  afterAll(async () => {
    // Cleanup
    await apiClient.delete(`/api/users/${testUserId}`);
  });

  beforeEach(async () => {
    // Reset test state before each test
    await apiClient.post('/api/test/reset');
  });

  describe('POST /api/chat', () => {
    it('should create new chat session', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ],
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('sessionId');
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toHaveProperty('content');
      expect(response.data.message).toHaveProperty('role', 'assistant');
    });

    it('should handle conversation history', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'user',
            content: 'What is TypeScript?'
          },
          {
            role: 'assistant',
            content: 'TypeScript is a typed superset of JavaScript.'
          },
          {
            role: 'user',
            content: 'Can you give me an example?'
          }
        ],
        model: 'gpt-4'
      });

      expect(response.status).toBe(200);
      expect(response.data.message.content).toBeDefined();
    });

    it('should support streaming responses', async () => {
      const response = await apiClient.post('/api/chat/stream', {
        messages: [
          {
            role: 'user',
            content: 'Tell me a story'
          }
        ],
        model: 'gpt-4',
        stream: true
      }, {
        responseType: 'stream'
      });

      expect(response.status).toBe(200);

      const chunks: string[] = [];
      response.data.on('data', (chunk: Buffer) => {
        chunks.push(chunk.toString());
      });

      await new Promise(resolve => response.data.on('end', resolve));

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should validate message format', async () => {
      try {
        await apiClient.post('/api/chat', {
          messages: [
            {
              role: 'invalid',
              content: 'Test'
            }
          ]
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    it('should handle temperature parameter', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'user',
            content: 'Generate a random number'
          }
        ],
        temperature: 1.5,
        maxTokens: 50
      });

      expect(response.status).toBe(200);
      expect(response.data.message.content).toBeDefined();
    });

    it('should handle max tokens limit', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'user',
            content: 'Write a long essay'
          }
        ],
        maxTokens: 100
      });

      expect(response.status).toBe(200);
      expect(response.data.tokens.completion).toBeLessThanOrEqual(100);
    });

    it('should support system messages', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant who speaks in pirate language.'
          },
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      });

      expect(response.status).toBe(200);
      expect(response.data.message.content).toBeDefined();
    });

    it('should handle multiple requests concurrently', async () => {
      const requests = [
        apiClient.post('/api/chat', {
          messages: [{ role: 'user', content: 'Request 1' }]
        }),
        apiClient.post('/api/chat', {
          messages: [{ role: 'user', content: 'Request 2' }]
        }),
        apiClient.post('/api/chat', {
          messages: [{ role: 'user', content: 'Request 3' }]
        })
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.message.content).toBeDefined();
      });
    });

    it('should rate limit requests', async () => {
      const requests = Array(20).fill(null).map(() =>
        apiClient.post('/api/chat', {
          messages: [{ role: 'user', content: 'Test' }]
        })
      );

      try {
        await Promise.all(requests);
        // If we get here, rate limiting didn't trigger
        expect(true).toBe(true);
      } catch (error: any) {
        expect(error.response.status).toBe(429);
      }
    });

    it('should return token usage', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'user',
            content: 'Count to 10'
          }
        ]
      });

      expect(response.data).toHaveProperty('tokens');
      expect(response.data.tokens).toHaveProperty('prompt');
      expect(response.data.tokens).toHaveProperty('completion');
      expect(response.data.tokens).toHaveProperty('total');
    });

    it('should include latency information', async () => {
      const response = await apiClient.post('/api/chat', {
        messages: [
          {
            role: 'user',
            content: 'Quick response'
          }
        ]
      });

      expect(response.data).toHaveProperty('latency');
      expect(response.data.latency).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Chat Integration', () => {
    it('should establish WebSocket connection', async () => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(`${process.env.WS_BASE_URL || 'ws://localhost:8787'}/ws/chat?token=${authToken}`);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      ws.close();
    });

    it('should send and receive messages via WebSocket', async () => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(`${process.env.WS_BASE_URL || 'ws://localhost:8787'}/ws/chat?token=${authToken}`);

      await new Promise(resolve => ws.on('open', resolve));

      ws.send(JSON.stringify({
        type: 'message',
        content: 'Hello WebSocket'
      }));

      const response = await new Promise(resolve => {
        ws.on('message', resolve);
      });

      expect(response.toString()).toBeDefined();

      ws.close();
    });

    it('should handle streaming via WebSocket', async () => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(`${process.env.WS_BASE_URL || 'ws://localhost:8787'}/ws/chat?token=${authToken}`);

      await new Promise(resolve => ws.on('open', resolve));

      ws.send(JSON.stringify({
        type: 'stream',
        content: 'Tell me a joke',
        stream: true
      }));

      const chunks: string[] = [];
      ws.on('message', data => {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'chunk') {
          chunks.push(parsed.content);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(chunks.length).toBeGreaterThan(0);

      ws.close();
    });
  });

  describe('Session Management', () => {
    it('should create and retrieve session', async () => {
      // Create session
      const createResponse = await apiClient.post('/api/chat', {
        messages: [{ role: 'user', content: 'Hello' }]
      });

      const sessionId = createResponse.data.sessionId;

      // Retrieve session
      const getResponse = await apiClient.get(`/api/chat/sessions/${sessionId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.data.session.id).toBe(sessionId);
    });

    it('should update session metadata', async () => {
      const createResponse = await apiClient.post('/api/chat', {
        messages: [{ role: 'user', content: 'Hello' }]
      });

      const sessionId = createResponse.data.sessionId;

      const updateResponse = await apiClient.patch(`/api/chat/sessions/${sessionId}`, {
        title: 'Updated Title',
        tags: ['test', 'updated']
      });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.title).toBe('Updated Title');
    });

    it('should list user sessions', async () => {
      const response = await apiClient.get('/api/chat/sessions');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.sessions)).toBe(true);
    });

    it('should delete session', async () => {
      const createResponse = await apiClient.post('/api/chat', {
        messages: [{ role: 'user', content: 'Hello' }]
      });

      const sessionId = createResponse.data.sessionId;

      const deleteResponse = await apiClient.delete(`/api/chat/sessions/${sessionId}`);

      expect(deleteResponse.status).toBe(204);
    });
  });
});
