/**
 * Integration tests for Email Service
 */

import { EmailService } from '../../src/index';
import { EmailProvider } from '../../src/types';

describe('Email Service Integration', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService({
      providers: [
        {
          type: EmailProvider.SMTP,
          enabled: true,
          priority: 1,
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
      ],
      scheduling: {
        enabled: false // Disable for tests
      }
    });
  });

  afterEach(async () => {
    await emailService.shutdown();
  });

  describe('email sending integration', () => {
    test('should send simple email', async () => {
      const message = {
        from: { email: 'from@example.com', name: 'Test Sender' },
        to: [{ email: 'to@example.com', name: 'Test Recipient' }],
        subject: 'Integration Test Email',
        html: '<h1>Test</h1><p>This is a test email</p>',
        text: 'Test\nThis is a test email'
      };

      const result = await emailService.send(message);

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    test('should send email with attachments', async () => {
      const message = {
        from: { email: 'from@example.com' },
        to: [{ email: 'to@example.com' }],
        subject: 'Email with Attachment',
        html: '<p>Please find attached file</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: Buffer.from('This is a test attachment')
          }
        ]
      };

      const result = await emailService.send(message);

      expect(result).toBeDefined();
    });

    test('should send batch emails', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        from: { email: 'from@example.com' },
        to: [{ email: `user${i}@example.com` }],
        subject: `Batch Email ${i}`,
        html: `<p>Email number ${i}</p>`
      }));

      const results = await emailService.sendBatch(messages);

      expect(results.length).toBe(5);
    });
  });

  describe('template integration', () => {
    test('should send templated email', async () => {
      const templateEngine = emailService.getTemplateEngine();

      templateEngine.createTemplate(
        'welcome',
        'Welcome {{name}}!',
        '<h1>Welcome {{name}}!</h1><p>We are excited to have you.</p>',
        'html' as any,
        [{ name: 'name', type: 'string', required: true }]
      );

      const email = templateEngine.createEmailFromTemplate(
        'welcome',
        'user@example.com',
        'noreply@example.com',
        { name: 'John' }
      );

      const result = await emailService.send(email);

      expect(result).toBeDefined();
      expect(email.subject).toBe('Welcome John!');
      expect(email.html).toContain('Welcome John!');
    });
  });

  describe('analytics integration', () => {
    test('should track email delivery', async () => {
      const analytics = emailService.getAnalytics();
      const message = {
        from: { email: 'from@example.com' },
        to: [{ email: 'to@example.com' }],
        subject: 'Analytics Test',
        html: '<p>Test</p>'
      };

      const result = await emailService.send(message);
      analytics.trackDelivery(result);
      analytics.trackOpen(result.messageId);

      const stats = analytics.calculateStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('list management integration', () => {
    test('should create list and send to subscribers', async () => {
      const listManager = emailService.getListManager();

      const list = listManager.createList('Test List');
      listManager.addSubscriber(list.id, 'user1@example.com', 'User 1');
      listManager.addSubscriber(list.id, 'user2@example.com', 'User 2');

      const subscribers = listManager.getSubscribers(list.id);
      expect(subscribers.length).toBe(2);

      // Send to list
      const messages = subscribers.map(sub => ({
        from: { email: 'from@example.com' },
        to: [{ email: sub.email, name: sub.name }],
        subject: 'List Email',
        html: `<p>Hello ${sub.name}</p>`
      }));

      await emailService.sendBatch(messages);
    });
  });

  describe('scheduling integration', () => {
    test('should schedule email for future delivery', () => {
      const scheduler = emailService.getScheduler();

      const message = {
        from: { email: 'from@example.com' },
        to: [{ email: 'to@example.com' }],
        subject: 'Scheduled Email',
        html: '<p>This will be sent later</p>'
      };

      const scheduledAt = new Date(Date.now() + 60000); // 1 minute from now
      const scheduled = scheduler.scheduleEmail(message, scheduledAt);

      expect(scheduled).toBeDefined();
      expect(scheduled.status).toBe('pending' as any);
    });

    test('should validate scheduled time', () => {
      const scheduler = emailService.getScheduler();

      const past = new Date(Date.now() - 1000);
      const validation = scheduler.validateScheduledTime(past);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('bounce handling integration', () => {
    test('should process bounce and update list', () => {
      const bounceHandler = emailService.getBounceHandler();
      const listManager = emailService.getListManager();

      const list = listManager.createList('Test List');
      const subscriber = listManager.addSubscriber(
        list.id,
        'bounced@example.com'
      );

      const bounce = bounceHandler.classifyBounce(
        'bounced@example.com',
        'User does not exist',
        EmailProvider.SMTP
      );

      listManager.processBounce(bounce);

      const updated = listManager.getSubscriber(subscriber.id);
      expect(updated!.status).toBe('bounced' as any);
    });
  });

  describe('security integration', () => {
    test('should generate SPF record', () => {
      const securityManager = emailService.getSecurityManager();

      securityManager.addSecurityConfig({
        domain: 'example.com',
        spf: {
          enabled: true,
          mechanisms: ['ip4:192.168.1.1'],
          all: '~all'
        }
      });

      const spfRecord = securityManager.generateSPFRecord('example.com');

      expect(spfRecord).toContain('v=spf1');
      expect(spfRecord).toContain('~all');
    });

    test('should generate DKIM keys', () => {
      const securityManager = emailService.getSecurityManager();

      const keys = securityManager.generateDKIMKeyPair('example.com', 'default');

      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toBeDefined();
      expect(keys.record).toContain('v=DKIM1');
    });

    test('should generate DMARC record', () => {
      const securityManager = emailService.getSecurityManager();

      securityManager.addSecurityConfig({
        domain: 'example.com',
        dmarc: {
          enabled: true,
          policy: 'reject'
        }
      });

      const dmarcRecord = securityManager.generateDMARCRecord('example.com');

      expect(dmarcRecord).toContain('v=DMARC1');
      expect(dmarcRecord).toContain('p=reject');
    });
  });

  describe('health check integration', () => {
    test('should get service health status', async () => {
      const health = await emailService.getHealthStatus();

      expect(health.sender).toBeDefined();
      expect(health.scheduler).toBeDefined();
      expect(health.config).toBeDefined();
    });
  });
});

describe('End-to-End Workflow', () => {
  test('should complete full email campaign workflow', async () => {
    const emailService = new EmailService({
      providers: [
        {
          type: EmailProvider.SMTP,
          enabled: true,
          priority: 1,
          credentials: {
            host: 'localhost',
            port: 1025,
            secure: false,
            auth: { user: 'test', pass: 'test' }
          }
        }
      ],
      scheduling: { enabled: false }
    });

    try {
      // 1. Create template
      const templateEngine = emailService.getTemplateEngine();
      const template = templateEngine.createTemplate(
        'newsletter',
        'Newsletter {{issue}}',
        '<h1>Newsletter {{issue}}</h1><p>{{content}}</p>',
        'html' as any
      );

      // 2. Create list and subscribers
      const listManager = emailService.getListManager();
      const list = listManager.createList('Newsletter Subscribers');
      listManager.addSubscriber(list.id, 'user1@example.com');
      listManager.addSubscriber(list.id, 'user2@example.com');

      // 3. Create segment
      const segment = listManager.createSegment(
        list.id,
        'All Subscribers',
        [{
          field: 'status',
          operator: 'equals',
          value: 'active'
        }]
      );

      // 4. Prepare emails
      const subscribers = listManager.getSegmentSubscribers(segment.id);
      const messages = subscribers.map(sub => {
        const email = templateEngine.createEmailFromTemplate(
          template.id,
          sub.email,
          'noreply@example.com',
          { issue: 'January 2026', content: 'Latest updates' }
        );
        return email;
      });

      // 5. Send emails
      const results = await emailService.sendBatch(messages);

      // 6. Track delivery
      const analytics = emailService.getAnalytics();
      results.forEach(result => {
        analytics.trackDelivery(result);
      });

      // 7. Get statistics
      const stats = analytics.calculateStatistics();

      expect(results.length).toBe(2);
      expect(stats.total).toBe(2);

    } finally {
      await emailService.shutdown();
    }
  });
});
