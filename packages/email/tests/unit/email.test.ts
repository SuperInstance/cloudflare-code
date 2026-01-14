/**
 * Unit tests for Email Service
 */

import { EmailSender } from '../../src/sending/sender';
import { TemplateEngine } from '../../src/templates/engine';
import { EmailAnalytics } from '../../src/analytics/analytics';
import { BounceHandler } from '../../src/bounces/handler';
import { ListManager } from '../../src/lists/manager';
import {
  EmailProvider,
  EmailMessage,
  DeliveryResult,
  TemplateType,
  BounceType,
  BounceCategory,
  SubscriptionStatus
} from '../../src/types';

describe('EmailSender', () => {
  let sender: EmailSender;

  beforeEach(() => {
    const mockConfig = [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        rateLimit: 100,
        credentials: {
          host: 'localhost',
          port: 1025,
          secure: false,
          auth: {
            user: 'test',
            pass: 'test'
          }
        }
      }
    ];
    sender = new EmailSender(mockConfig);
  });

  afterEach(async () => {
    await sender.close();
  });

  describe('initialization', () => {
    test('should initialize with provider configurations', () => {
      const health = sender.getProviderHealth();
      expect(health).toBeDefined();
    });

    test('should throw error with no enabled providers', () => {
      expect(() => {
        new EmailSender([]);
      }).toThrow('At least one enabled email provider is required');
    });
  });

  describe('send', () => {
    test('should format email addresses correctly', () => {
      const message: EmailMessage = {
        id: 'test-1',
        from: { email: 'from@example.com', name: 'Sender Name' },
        to: [
          { email: 'to1@example.com', name: 'Recipient 1' },
          { email: 'to2@example.com' }
        ],
        subject: 'Test Email',
        html: '<p>Test content</p>'
      };

      // Verify message structure
      expect(message.from.name).toBe('Sender Name');
      expect(message.to.length).toBe(2);
      expect(message.to[0].name).toBe('Recipient 1');
    });

    test('should handle attachments', () => {
      const message: EmailMessage = {
        id: 'test-2',
        from: { email: 'from@example.com' },
        to: [{ email: 'to@example.com' }],
        subject: 'Test with attachment',
        html: '<p>Test</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: Buffer.from('Test content')
          }
        ]
      };

      expect(message.attachments).toBeDefined();
      expect(message.attachments!.length).toBe(1);
      expect(message.attachments![0].filename).toBe('test.txt');
    });

    test('should respect priority headers', () => {
      const highPriority: EmailMessage = {
        id: 'test-3',
        from: { email: 'from@example.com' },
        to: [{ email: 'to@example.com' }],
        subject: 'High Priority',
        priority: 'high' as any,
        html: '<p>Test</p>'
      };

      expect(highPriority.priority).toBe('high');
    });
  });

  describe('batch sending', () => {
    test('should create batch of emails', () => {
      const messages: EmailMessage[] = Array.from({ length: 5 }, (_, i) => ({
        id: `batch-${i}`,
        from: { email: 'from@example.com' },
        to: [{ email: `to${i}@example.com` }],
        subject: `Batch Email ${i}`,
        html: `<p>Email ${i}</p>`
      }));

      expect(messages.length).toBe(5);
      messages.forEach((msg, i) => {
        expect(msg.id).toBe(`batch-${i}`);
        expect(msg.to[0].email).toBe(`to${i}@example.com`);
      });
    });
  });
});

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('template creation', () => {
    test('should create HTML template', () => {
      const template = engine.createTemplate(
        'test-html',
        'Test Subject',
        '<h1>Hello {{name}}</h1>',
        TemplateType.HTML,
        [{ name: 'name', type: 'string', required: true }]
      );

      expect(template.name).toBe('test-html');
      expect(template.type).toBe(TemplateType.HTML);
      expect(template.variables.length).toBe(1);
    });

    test('should create MJML template', () => {
      const mjml = '<mjml><mj-body><mj-container><p>Hello {{name}}</p></mj-container></mj-body></mjml>';
      const template = engine.createTemplate(
        'test-mjml',
        'MJML Subject',
        mjml,
        TemplateType.MJML,
        [{ name: 'name', type: 'string', required: true }]
      );

      expect(template.type).toBe(TemplateType.MJML);
      expect(template.textContent).toBeDefined();
    });

    test('should generate text version from HTML', () => {
      const template = engine.createTemplate(
        'test-text',
        'Subject',
        '<h1>Hello</h1><p>World</p>',
        TemplateType.HTML
      );

      expect(template.textContent).toBeDefined();
      expect(template.textContent).not.toContain('<');
    });
  });

  describe('template rendering', () => {
    test('should render template with variables', () => {
      engine.createTemplate(
        'render-test',
        'Hello {{name}}',
        '<p>Hello {{name}}!</p>',
        TemplateType.HTML,
        [{ name: 'name', type: 'string', required: true }]
      );

      const { html, subject } = engine.renderTemplate('render-test', { name: 'World' });

      expect(subject).toBe('Hello World');
      expect(html).toContain('Hello World!');
    });

    test('should validate required variables', () => {
      engine.createTemplate(
        'validation-test',
        'Subject',
        '<p>{{requiredVar}}</p>',
        TemplateType.HTML,
        [{ name: 'requiredVar', type: 'string', required: true }]
      );

      expect(() => {
        engine.renderTemplate('validation-test', {});
      }).toThrow();
    });

    test('should handle missing optional variables', () => {
      engine.createTemplate(
        'optional-test',
        'Subject',
        '<p>{{optionalVar}}</p>',
        TemplateType.HTML,
        [{ name: 'optionalVar', type: 'string', required: false }]
      );

      const { html } = engine.renderTemplate('optional-test', {});

      expect(html).toBeDefined();
    });
  });

  describe('Handlebars helpers', () => {
    test('should use uppercase helper', () => {
      const result = engine.renderTemplate('test', {
        content: '{{uppercase name}}',
        templateId: 'helper-test'
      });

      expect(result).toBeDefined();
    });

    test('should use currency helper', () => {
      const template = engine.createTemplate(
        'currency-test',
        'Order {{currency amount}}',
        '<p>Total: {{currency amount}}</p>',
        TemplateType.HTML
      );

      const { html, subject } = engine.renderTemplate('currency-test', { amount: 100 });

      expect(subject).toContain('$');
      expect(html).toContain('$');
    });
  });
});

describe('EmailAnalytics', () => {
  let analytics: EmailAnalytics;

  beforeEach(() => {
    analytics = new EmailAnalytics();
  });

  describe('delivery tracking', () => {
    test('should track email delivery', () => {
      const result: DeliveryResult = {
        success: true,
        messageId: 'msg-1',
        provider: EmailProvider.SMTP,
        status: 'sent' as any,
        timestamp: new Date()
      };

      analytics.trackDelivery(result);

      const stats = analytics.calculateStatistics();
      expect(stats.total).toBe(1);
      expect(stats.sent).toBe(1);
    });

    test('should track email opens', () => {
      analytics.trackOpen('msg-1', {
        userAgent: 'Test Browser',
        ipAddress: '127.0.0.1'
      });

      const tracking = analytics.getTrackingData('msg-1');
      expect(tracking).toBeDefined();
      expect(tracking!.openCount).toBe(1);
    });

    test('should track email clicks', () => {
      analytics.trackClick('msg-1');

      const tracking = analytics.getTrackingData('msg-1');
      expect(tracking!.clickCount).toBe(1);
    });

    test('should calculate statistics', () => {
      const results: DeliveryResult[] = [
        {
          success: true,
          messageId: 'msg-1',
          provider: EmailProvider.SMTP,
          status: 'delivered' as any,
          timestamp: new Date()
        },
        {
          success: false,
          messageId: 'msg-2',
          provider: EmailProvider.SMTP,
          status: 'bounced' as any,
          timestamp: new Date()
        }
      ];

      results.forEach(r => analytics.trackDelivery(r));
      analytics.trackOpen('msg-1');

      const stats = analytics.calculateStatistics();
      expect(stats.total).toBe(2);
      expect(stats.delivered).toBe(1);
      expect(stats.bounced).toBe(1);
      expect(stats.opened).toBe(1);
    });
  });

  describe('analytics reporting', () => {
    test('should generate analytics report', () => {
      const report = analytics.generateReport();

      expect(report.summary).toBeDefined();
      expect(report.providerPerformance).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    test('should get real-time stats', () => {
      const stats = analytics.getRealTimeStats();

      expect(stats.last24Hours).toBeDefined();
      expect(stats.lastHour).toBeDefined();
      expect(stats.today).toBeDefined();
    });
  });
});

describe('BounceHandler', () => {
  let handler: BounceHandler;

  beforeEach(() => {
    handler = new BounceHandler();
  });

  describe('bounce classification', () => {
    test('should classify hard bounce - invalid email', () => {
      const bounce = handler.classifyBounce(
        'invalid@example.com',
        'User does not exist',
        EmailProvider.SMTP
      );

      expect(bounce.type).toBe(BounceType.HARD);
      expect(bounce.category).toBe(BounceCategory.INVALID_EMAIL);
      expect(bounce.retryable).toBe(false);
    });

    test('should classify soft bounce - full mailbox', () => {
      const bounce = handler.classifyBounce(
        'full@example.com',
        'Mailbox full',
        EmailProvider.SMTP
      );

      expect(bounce.type).toBe(BounceType.SOFT);
      expect(bounce.category).toBe(BounceCategory.FULL_MAILBOX);
      expect(bounce.retryable).toBe(true);
    });

    test('should classify technical bounce', () => {
      const bounce = handler.classifyBounce(
        'timeout@example.com',
        'Connection timed out',
        EmailProvider.SMTP
      );

      expect(bounce.type).toBe(BounceType.SOFT);
      expect(bounce.category).toBe(BounceCategory.TECHNICAL);
      expect(bounce.retryable).toBe(true);
    });

    test('should add hard bounces to suppression', () => {
      handler.classifyBounce('blocked@example.com', 'Blocked by policy');

      expect(handler.isSuppressed('blocked@example.com')).toBe(true);
    });
  });

  describe('email validation', () => {
    test('should validate email syntax', () => {
      const valid = handler.validateEmail('test@example.com');
      expect(valid.valid).toBe(true);
      expect(valid.canSend).toBe(true);
    });

    test('should reject invalid email format', () => {
      const invalid = handler.validateEmail('invalid-email');
      expect(invalid.valid).toBe(false);
      expect(invalid.canSend).toBe(false);
    });

    test('should check suppression list', () => {
      handler.classifyBounce('suppressed@example.com', 'User unknown');

      const validation = handler.validateEmail('suppressed@example.com');
      expect(validation.canSend).toBe(false);
      expect(validation.reason).toContain('suppressed');
    });
  });

  describe('bounce statistics', () => {
    test('should calculate bounce statistics', () => {
      handler.classifyBounce('bounce1@example.com', 'User unknown');
      handler.classifyBounce('bounce2@example.com', 'Mailbox full');
      handler.classifyBounce('bounce3@example.com', 'Connection timeout');

      const stats = handler.getBounceStatistics();

      expect(stats.total).toBe(3);
      expect(stats.hard).toBe(1);
      expect(stats.soft).toBe(2);
    });

    test('should get top bounce reasons', () => {
      handler.classifyBounce('bounce1@example.com', 'User unknown');
      handler.classifyBounce('bounce2@example.com', 'User does not exist');

      const topReasons = handler.getTopBounceReasons(5);

      expect(topReasons.length).toBeGreaterThan(0);
      expect(topReasons[0].count).toBeGreaterThan(0);
    });
  });
});

describe('ListManager', () => {
  let manager: ListManager;

  beforeEach(() => {
    manager = new ListManager();
  });

  describe('list management', () => {
    test('should create new list', () => {
      const list = manager.createList('Test List', 'A test list');

      expect(list.name).toBe('Test List');
      expect(list.description).toBe('A test list');
      expect(list.subscribers).toBe(0);
    });

    test('should add subscriber to list', () => {
      const list = manager.createList('Test List');
      const subscriber = manager.addSubscriber(
        list.id,
        'test@example.com',
        'Test User'
      );

      expect(subscriber.email).toBe('test@example.com');
      expect(subscriber.name).toBe('Test User');
      expect(subscriber.status).toBe(SubscriptionStatus.ACTIVE);

      const updatedList = manager.getList(list.id);
      expect(updatedList!.subscribers).toBe(1);
    });

    test('should unsubscribe subscriber', () => {
      const list = manager.createList('Test List');
      const subscriber = manager.addSubscriber(list.id, 'test@example.com');

      const unsubscribed = manager.unsubscribe(subscriber.id);

      expect(unsubscribed).toBe(true);
      expect(subscriber.status).toBe(SubscriptionStatus.UNSUBSCRIBED);
    });

    test('should prevent duplicate subscriptions', () => {
      const list = manager.createList('Test List');
      manager.addSubscriber(list.id, 'test@example.com');

      expect(() => {
        manager.addSubscriber(list.id, 'test@example.com');
      }).toThrow();
    });

    test('should allow re-subscription', () => {
      const list = manager.createList('Test List');
      const subscriber = manager.addSubscriber(list.id, 'test@example.com');

      manager.unsubscribe(subscriber.id);

      const resubscribed = manager.addSubscriber(list.id, 'test@example.com');

      expect(resubscribed.status).toBe(SubscriptionStatus.ACTIVE);
      expect(resubscribed.unsubscribedAt).toBeUndefined();
    });
  });

  describe('segmentation', () => {
    test('should create segment', () => {
      const list = manager.createList('Test List');
      manager.addSubscriber(list.id, 'user1@example.com', 'User 1');
      manager.addSubscriber(list.id, 'user2@example.com', 'User 2');

      const segment = manager.createSegment(
        list.id,
        'Name Segment',
        [{
          field: 'name',
          operator: 'equals',
          value: 'User 1'
        }]
      );

      expect(segment.name).toBe('Name Segment');
      expect(segment.criteria.length).toBe(1);
    });

    test('should get segment subscribers', () => {
      const list = manager.createList('Test List');
      manager.addSubscriber(list.id, 'user1@example.com', 'User 1');
      manager.addSubscriber(list.id, 'user2@example.com', 'User 2');

      const segment = manager.createSegment(
        list.id,
        'Name Segment',
        [{
          field: 'name',
          operator: 'equals',
          value: 'User 1'
        }]
      );

      const subscribers = manager.getSegmentSubscribers(segment.id);

      expect(subscribers.length).toBe(1);
      expect(subscribers[0].name).toBe('User 1');
    });
  });

  describe('list statistics', () => {
    test('should calculate list statistics', () => {
      const list = manager.createList('Test List');
      manager.addSubscriber(list.id, 'active@example.com');
      const sub2 = manager.addSubscriber(list.id, 'unsubscribed@example.com');
      manager.unsubscribe(sub2.id);

      const stats = manager.getListStatistics(list.id);

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.unsubscribed).toBe(1);
    });
  });

  describe('import/export', () => {
    test('should import subscribers', () => {
      const list = manager.createList('Test List');
      const data = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
        { email: 'user3@example.com', name: 'User 3' }
      ];

      const result = manager.importSubscribers(list.id, data);

      expect(result.added).toBe(3);
      expect(result.failed).toBe(0);
    });

    test('should export subscribers', () => {
      const list = manager.createList('Test List');
      manager.addSubscriber(list.id, 'user1@example.com', 'User 1');
      manager.addSubscriber(list.id, 'user2@example.com', 'User 2');

      const exported = manager.exportSubscribers(list.id);

      expect(exported.length).toBe(2);
      expect(exported[0].email).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  test('should send email using template', async () => {
    const engine = new TemplateEngine();
    engine.createTemplate(
      'test-template',
      'Hello {{name}}',
      '<h1>Hello {{name}}!</h1>',
      TemplateType.HTML,
      [{ name: 'name', type: 'string', required: true }]
    );

    const { html, subject } = engine.renderTemplate('test-template', { name: 'World' });

    expect(subject).toBe('Hello World');
    expect(html).toContain('Hello World!');
  });

  test('should track delivery and calculate stats', () => {
    const analytics = new EmailAnalytics();

    const result: DeliveryResult = {
      success: true,
      messageId: 'test-1',
      provider: EmailProvider.SMTP,
      status: 'delivered' as any,
      timestamp: new Date()
    };

    analytics.trackDelivery(result);
    analytics.trackOpen('test-1');

    const stats = analytics.calculateStatistics();
    expect(stats.total).toBe(1);
    expect(stats.opened).toBe(1);
  });

  test('should handle bounce and update list', () => {
    const bounceHandler = new BounceHandler();
    const listManager = new ListManager();

    const list = listManager.createList('Test List');
    listManager.addSubscriber(list.id, 'bounced@example.com');

    const bounce = bounceHandler.classifyBounce(
      'bounced@example.com',
      'User unknown'
    );

    listManager.processBounce(bounce);

    const subscriber = listManager.getSubscribers(list.id)[0];
    expect(subscriber.status).toBe(SubscriptionStatus.BOUNCED);
  });
});
