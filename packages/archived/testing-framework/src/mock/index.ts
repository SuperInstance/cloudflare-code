/**
 * Mock Services Module
 * Provides comprehensive mock services for testing external dependencies
 */

export * from './types';
export { HttpMockService } from './http-mock';
export { DatabaseMockService } from './database-mock';
export { MockServiceRegistry, mockServiceRegistry } from './service-registry';

import {
  MockServiceConfig,
  MockRequest,
  MockResponse,
  MockRoute,
  MockDatabaseConfig,
  MockScenario
} from './types';
import { HttpMockService } from './http-mock';
import { DatabaseMockService } from './database-mock';
import { mockServiceRegistry } from './service-registry';

// Utility functions for common mock scenarios
export const MockServices = {
  /**
   * Create an HTTP mock service with common endpoints
   */
  createHttpService(config: MockServiceConfig): HttpMockService {
    const service = new HttpMockService(config);
    return service;
  },

  /**
   * Create a REST API mock service
   */
  createRestApiService(baseUrl: string, resources: string[] = []): HttpMockService {
    const config: MockServiceConfig = {
      id: 'rest-api',
      name: 'REST API Mock',
      type: 'http',
      baseUrl
    };

    const service = new HttpMockService(config);

    // Add standard health and info endpoints
    service.addRoute({
      id: 'health',
      method: 'GET',
      path: '/health',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'healthy', service: 'REST API Mock' }
      })
    });

    service.addRoute({
      id: 'info',
      method: 'GET',
      path: '/info',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'REST API Mock', version: '1.0.0', baseUrl }
      })
    });

    // Create CRUD endpoints for each resource
    resources.forEach(resource => {
      service.createCrudResource(resource);
    });

    return service;
  },

  /**
   * Create a mock database service
   */
  createDatabaseService(config: MockDatabaseConfig): DatabaseMockService {
    return new DatabaseMockService(config);
  },

  /**
   * Create a common database setup
   */
  createCommonDatabase(): DatabaseMockService {
    const config: MockDatabaseConfig = {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
      tables: [],
      data: {}
    };

    const database = new DatabaseMockService(config);
    database.createCommonTables();
    database.seedCommonData();

    return database;
  },

  /**
   * Create a mock scenario with common services
   */
  createCommonScenario(scenario: Partial<MockScenario>): MockScenario {
    const defaultScenario: MockScenario = {
      id: `scenario_${Date.now()}`,
      name: 'Common Test Scenario',
      description: 'A test scenario with common mock services',
      services: [],
      setup: async () => {
        // Start common services
        await mockServiceRegistry.startAll();
      },
      teardown: async () => {
        // Stop all services
        await mockServiceRegistry.stopAll();
      }
    };

    return { ...defaultScenario, ...scenario };
  },

  /**
   * Create API authentication mock
   */
  createAuthMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'auth-service',
      name: 'Authentication Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);
    service.createAuthMock();

    return service;
  },

  /**
   * Create webhook mock
   */
  createWebhookMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'webhook-service',
      name: 'Webhook Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);
    service.createWebhookMock();

    return service;
  },

  /**
   * Create pagination mock
   */
  createPaginationMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'pagination-service',
      name: 'Pagination Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);

    // Mock paginated data
    const mockData = Array.from({ length: 100 }, (_, i) => ({
      id: `item_${i}`,
      name: `Item ${i}`,
      value: i * 10,
      category: `Category ${Math.floor(i / 10)}`
    }));

    service.createPaginatedResource('items', mockData);

    return service;
  },

  /**
   * Create file upload mock
   */
  createFileUploadMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'upload-service',
      name: 'File Upload Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);

    // Mock file upload endpoint
    service.addRoute({
      id: 'upload',
      method: 'POST',
      path: '/upload',
      handler: async (request: MockRequest) => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          file: {
            id: `file_${Date.now()}`,
            name: request.body?.name || 'uploaded_file',
            size: request.body?.size || 1024,
            type: request.body?.type || 'application/octet-stream',
            url: `/files/${Date.now()}`
          }
        }
      })
    });

    // Mock file list endpoint
    service.addRoute({
      id: 'files',
      method: 'GET',
      path: '/files',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          files: [],
          total: 0
        }
      })
    });

    return service;
  },

  /**
   * Create payment service mock
   */
  createPaymentMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'payment-service',
      name: 'Payment Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);

    // Mock payment processing
    service.addRoute({
      id: 'process-payment',
      method: 'POST',
      path: '/payments',
      handler: async (request: MockRequest) => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          payment: {
            id: `payment_${Date.now()}`,
            orderId: request.body?.orderId,
            amount: request.body?.amount,
            currency: request.body?.currency || 'USD',
            status: 'completed',
            transactionId: `txn_${Date.now()}`,
            createdAt: new Date().toISOString()
          }
        }
      })
    });

    // Mock payment status
    service.addRoute({
      id: 'payment-status',
      method: 'GET',
      path: '/payments/:id',
      handler: async (request: MockRequest) => {
        const paymentId = request.path.split('/').pop();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            payment: {
              id: paymentId,
              status: 'completed',
              amount: 100.00,
              currency: 'USD',
              createdAt: new Date().toISOString()
            }
          }
        };
      }
    });

    return service;
  },

  /**
   * Create email service mock
   */
  createEmailMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'email-service',
      name: 'Email Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);
    const sentEmails: any[] = [];

    // Mock email sending
    service.addRoute({
      id: 'send-email',
      method: 'POST',
      path: '/emails',
      handler: async (request: MockRequest) => {
        const email = {
          id: `email_${Date.now()}`,
          to: request.body?.to,
          from: request.body?.from,
          subject: request.body?.subject,
          html: request.body?.html,
          text: request.body?.text,
          sentAt: new Date().toISOString(),
          status: 'sent'
        };

        sentEmails.push(email);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: true,
            email
          }
        };
      }
    });

    // Mock email history
    service.addRoute({
      id: 'email-history',
      method: 'GET',
      path: '/emails',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          emails: sentEmails,
          total: sentEmails.length
        }
      })
    });

    return service;
  },

  /**
   * Create notification service mock
   */
  createNotificationMock(): HttpMockService {
    const config: MockServiceConfig = {
      id: 'notification-service',
      name: 'Notification Service Mock',
      type: 'http'
    };

    const service = new HttpMockService(config);
    const notifications: any[] = [];

    // Mock notification sending
    service.addRoute({
      id: 'send-notification',
      method: 'POST',
      path: '/notifications',
      handler: async (request: MockRequest) => {
        const notification = {
          id: `notification_${Date.now()}`,
          userId: request.body?.userId,
          type: request.body?.type,
          title: request.body?.title,
          message: request.body?.message,
          data: request.body?.data,
          sentAt: new Date().toISOString(),
          status: 'sent'
        };

        notifications.push(notification);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: true,
            notification
          }
        };
      }
    });

    // Mock user notifications
    service.addRoute({
      id: 'user-notifications',
      method: 'GET',
      path: '/users/:userId/notifications',
      handler: async (request: MockRequest) => {
        const userId = request.path.split('/').pop();
        const userNotifications = notifications.filter(n => n.userId === userId);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            notifications: userNotifications,
            total: userNotifications.length,
            unread: userNotifications.filter(n => !n.read).length
          }
        };
      }
    });

    return service;
  },

  /**
   * Create external API mock with common patterns
   */
  createExternalApiMock(serviceName: string, baseUrl: string): HttpMockService {
    const config: MockServiceConfig = {
      id: `${serviceName}-api`,
      name: `${serviceName} API Mock`,
      type: 'http',
      baseUrl
    };

    const service = new HttpMockService(config);

    // Add standard API endpoints
    service.addRoute({
      id: 'api-health',
      method: 'GET',
      path: '/health',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'healthy', service: serviceName }
      })
    });

    service.addRoute({
      id: 'api-version',
      method: 'GET',
      path: '/version',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { service: serviceName, version: '1.0.0' }
      })
    });

    return service;
  },

  /**
   * Create a complete mock environment
   */
  createTestEnvironment(services: {
    api?: boolean;
    database?: boolean;
    auth?: boolean;
    payment?: boolean;
    email?: boolean;
    webhook?: boolean;
  }): {
    registry: MockServiceRegistry;
    services: { [key: string]: any };
  } {
    const registry = new MockServiceRegistry();
    const servicesMap: { [key: string]: any } = {};

    // Register HTTP services
    if (services.api) {
      registry.registerService({
        id: 'api-service',
        name: 'API Service',
        type: 'http'
      });
      servicesMap.api = 'api-service';
    }

    if (services.auth) {
      registry.registerService({
        id: 'auth-service',
        name: 'Auth Service',
        type: 'http'
      });
      servicesMap.auth = 'auth-service';
    }

    if (services.payment) {
      registry.registerService({
        id: 'payment-service',
        name: 'Payment Service',
        type: 'http'
      });
      servicesMap.payment = 'payment-service';
    }

    if (services.email) {
      registry.registerService({
        id: 'email-service',
        name: 'Email Service',
        type: 'http'
      });
      servicesMap.email = 'email-service';
    }

    if (services.webhook) {
      registry.registerService({
        id: 'webhook-service',
        name: 'Webhook Service',
        type: 'http'
      });
      servicesMap.webhook = 'webhook-service';
    }

    // Register database service
    if (services.database) {
      registry.registerDatabase({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db'
      });
      servicesMap.database = 'test_db';
    }

    return {
      registry,
      services: servicesMap
    };
  }
};

// Export utility functions for easy use
export const {
  createHttpService,
  createRestApiService,
  createDatabaseService,
  createCommonDatabase,
  createCommonScenario,
  createAuthMock,
  createWebhookMock,
  createPaginationMock,
  createFileUploadMock,
  createPaymentMock,
  createEmailMock,
  createNotificationMock,
  createExternalApiMock,
  createTestEnvironment
} = MockServices;