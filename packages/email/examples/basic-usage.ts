/**
 * Basic Email Service Usage Examples
 */

import {
  EmailService,
  EmailProvider,
  TemplateType
} from '../src/index';

// ============================================================================
// Example 1: Quick Send
// ============================================================================

async function quickSendExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'your-email@gmail.com',
            pass: 'your-app-password'
          }
        }
      }
    ]
  });

  try {
    const result = await service.send({
      from: { email: 'sender@example.com', name: 'Sender Name' },
      to: [{ email: 'recipient@example.com', name: 'Recipient Name' }],
      subject: 'Hello from Email Service',
      html: '<h1>Welcome!</h1><p>This is a test email.</p>',
      text: 'Welcome!\n\nThis is a test email.'
    });

    console.log('Email sent:', result.messageId);
    console.log('Status:', result.status);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 2: Using Templates
// ============================================================================

async function templateExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      }
    ]
  });

  try {
    const templateEngine = service.getTemplateEngine();

    // Create a welcome template
    const template = templateEngine.createTemplate(
      'welcome-email',
      'Welcome to {{companyName}}!',
      `
        <mjml>
          <mj-body>
            <mj-container>
              <mj-section>
                <mj-column>
                  <mj-text font-size="24px">Welcome {{userName}}!</mj-text>
                  <mj-text>Thank you for joining {{companyName}}.</mj-text>
                  <mj-button href="{{ctaUrl}}">Get Started</mj-button>
                </mj-column>
              </mj-section>
            </mj-container>
          </mj-body>
        </mjml>
      `,
      TemplateType.MJML,
      [
        { name: 'userName', type: 'string', required: true },
        { name: 'companyName', type: 'string', required: true },
        { name: 'ctaUrl', type: 'string', required: true }
      ]
    );

    // Create email from template
    const email = templateEngine.createEmailFromTemplate(
      template.id,
      'user@example.com',
      'noreply@example.com',
      {
        userName: 'John Doe',
        companyName: 'MyApp',
        ctaUrl: 'https://example.com/get-started'
      }
    );

    const result = await service.send(email);
    console.log('Template email sent:', result.messageId);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 3: Batch Sending
// ============================================================================

async function batchSendExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      }
    ]
  });

  try {
    // Prepare batch of emails
    const recipients = [
      { email: 'user1@example.com', name: 'User 1' },
      { email: 'user2@example.com', name: 'User 2' },
      { email: 'user3@example.com', name: 'User 3' }
    ];

    const messages = recipients.map(recipient => ({
      from: { email: 'noreply@example.com', name: 'MyApp' },
      to: [{ email: recipient.email, name: recipient.name }],
      subject: 'Special Offer Just for You!',
      html: `<h1>Hi ${recipient.name}!</h1><p>Check out our special offer.</p>`,
      metadata: { campaign: 'special-offer' }
    }));

    const results = await service.sendBatch(messages);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Batch sent: ${successful} successful, ${failed} failed`);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 4: Multi-Provider with Failover
// ============================================================================

async function multiProviderExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SENDGRID,
        enabled: true,
        priority: 1,
        credentials: {
          apiKey: 'your-sendgrid-api-key'
        }
      },
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 2,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      },
      {
        type: EmailProvider.MAILGUN,
        enabled: true,
        priority: 3,
        credentials: {
          apiKey: 'your-mailgun-api-key',
          domain: 'mg.example.com'
        }
      }
    ]
  });

  try {
    const result = await service.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Multi-Provider Test',
      html: '<p>This will try SendGrid, then SMTP, then Mailgun</p>'
    });

    console.log('Sent via:', result.provider);
    console.log('Message ID:', result.messageId);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 5: Email with Attachments
// ============================================================================

async function attachmentExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      }
    ]
  });

  try {
    const result = await service.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Email with Attachments',
      html: '<p>Please find the attached files.</p>',
      attachments: [
        {
          filename: 'document.pdf',
          content: Buffer.from('PDF content here'),
          contentType: 'application/pdf'
        },
        {
          filename: 'image.png',
          content: Buffer.from('PNG content here'),
          contentType: 'image/png',
          cid: 'image@cid' // For inline images
        },
        {
          filename: 'data.txt',
          content: 'Plain text content'
        }
      ]
    });

    console.log('Email with attachments sent:', result.messageId);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 6: Scheduled Email
// ============================================================================

function scheduledEmailExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      }
    ],
    scheduling: {
      enabled: true,
      checkIntervalMinutes: 1
    }
  });

  const scheduler = service.getScheduler();

  // Schedule email for 1 hour from now
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

  const scheduled = scheduler.scheduleEmail(
    {
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Scheduled Email',
      html: '<p>This email was scheduled in advance.</p>'
    },
    scheduledAt
  );

  console.log('Email scheduled for:', scheduled.scheduledAt);
  console.log('Scheduled email ID:', scheduled.id);

  // Schedule recurring email (daily digest)
  const recurring = scheduler.scheduleEmail(
    {
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Daily Digest',
      html: '<p>Your daily digest is here.</p>'
    },
    new Date(),
    {
      frequency: 'daily',
      interval: 1
    }
  );

  console.log('Recurring email scheduled:', recurring.id);
}

// ============================================================================
// Example 7: List Management
// ============================================================================

async function listManagementExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      }
    ]
  });

  try {
    const listManager = service.getListManager();

    // Create a list
    const list = listManager.createList(
      'Newsletter Subscribers',
      'People who subscribed to our newsletter'
    );

    // Add subscribers
    listManager.addSubscriber(
      list.id,
      'john@example.com',
      'John Doe',
      { location: 'US', interests: ['tech', 'news'] }
    );

    listManager.addSubscriber(
      list.id,
      'jane@example.com',
      'Jane Smith',
      { location: 'UK', interests: ['business'] }
    );

    // Create segment for US subscribers
    const usSegment = listManager.createSegment(
      list.id,
      'US Subscribers',
      [{
        field: 'metadata.location',
        operator: 'equals',
        value: 'US'
      }]
    );

    console.log('List created:', list.name);
    console.log('Total subscribers:', list.subscribers);
    console.log('US segment count:', usSegment.subscriberCount);

    // Send to segment
    const subscribers = listManager.getSegmentSubscribers(usSegment.id);
    const emails = subscribers.map(sub => ({
      from: { email: 'noreply@example.com' },
      to: [{ email: sub.email, name: sub.name || '' }],
      subject: 'US Special Offer',
      html: '<p>Special offer for US subscribers!</p>'
    }));

    await service.sendBatch(emails);
    console.log(`Sent ${emails.length} emails to segment`);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 8: Analytics
// ============================================================================

async function analyticsExample() {
  const service = new EmailService({
    providers: [
      {
        type: EmailProvider.SMTP,
        enabled: true,
        priority: 1,
        credentials: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: 'user', pass: 'pass' }
        }
      }
    ]
  });

  try {
    const analytics = service.getAnalytics();

    // Send some emails and track
    const result = await service.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Analytics Test',
      html: '<p>Test email</p>'
    });

    analytics.trackDelivery(result);

    // Simulate opens and clicks
    analytics.trackOpen(result.messageId, {
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1'
    });

    analytics.trackClick(result.messageId);

    // Get statistics
    const stats = analytics.calculateStatistics();
    console.log('Total emails:', stats.total);
    console.log('Delivery rate:', stats.deliveryRate.toFixed(2) + '%');
    console.log('Open rate:', stats.openRate.toFixed(2) + '%');
    console.log('Click rate:', stats.clickRate.toFixed(2) + '%');

    // Get best send times
    const bestTimes = analytics.getBestSendTimes();
    console.log('Best send times:', bestTimes.slice(0, 3));

    // Generate report
    const report = analytics.generateReport();
    console.log('Report generated at:', report.generatedAt);
  } finally {
    await service.shutdown();
  }
}

// ============================================================================
// Example 9: Bounce Handling
// ============================================================================

function bounceHandlingExample() {
  const service = new EmailService();

  const bounceHandler = service.getBounceHandler();

  // Process bounces
  const bounce1 = bounceHandler.classifyBounce(
    'invalid@example.com',
    'User does not exist',
    EmailProvider.SMTP
  );

  const bounce2 = bounceHandler.classifyBounce(
    'full@example.com',
    'Mailbox full',
    EmailProvider.SMTP
  );

  const bounce3 = bounceHandler.classifyBounce(
    'blocked@example.com',
    'Blocked by spam filter',
    EmailProvider.SMTP
  );

  console.log('Bounce 1 type:', bounce1.type, '- retryable:', bounce1.retryable);
  console.log('Bounce 2 type:', bounce2.type, '- retryable:', bounce2.retryable);
  console.log('Bounce 3 type:', bounce3.type, '- retryable:', bounce3.retryable);

  // Check bounce statistics
  const stats = bounceHandler.getBounceStatistics();
  console.log('Total bounces:', stats.total);
  console.log('Hard bounces:', stats.hard);
  console.log('Soft bounces:', stats.soft);

  // Validate email before sending
  const validation = bounceHandler.validateEmail('invalid@example.com');
  console.log('Can send to invalid@example.com?', validation.canSend);
  console.log('Reason:', validation.reason);
}

// ============================================================================
// Example 10: SPF/DKIM/DMARC Setup
// ============================================================================

function securityExample() {
  const service = new EmailService();

  const securityManager = service.getSecurityManager();

  // Add security configuration
  securityManager.addSecurityConfig({
    domain: 'example.com',
    spf: {
      enabled: true,
      mechanisms: ['ip4:192.168.1.1', 'a', 'mx'],
      includeDomains: ['sendgrid.net', 'mailgun.org'],
      all: '~all'
    },
    dkim: {
      enabled: true,
      selector: 'default',
      privateKey: 'your-private-key'
    },
    dmarc: {
      enabled: true,
      policy: 'reject',
      subdomainPolicy: 'none',
      percentage: 100,
      rua: ['dmarc@example.com'],
      alignment: 'relaxed'
    }
  });

  // Generate DNS records
  const spfRecord = securityManager.generateSPFRecord('example.com');
  console.log('SPF Record:', spfRecord);

  const dkimKeys = securityManager.generateDKIMKeyPair('example.com', 'default');
  console.log('DKIM Record:', dkimKeys.record);

  const dmarcRecord = securityManager.generateDMARCRecord('example.com');
  console.log('DMARC Record:', dmarcRecord);

  // Check domain authentication
  securityManager.checkDomainAuthentication('example.com').then(status => {
    console.log('Overall status:', status.overallStatus);
    console.log('SPF configured:', status.spf.configured);
    console.log('DKIM configured:', status.dkim.configured);
    console.log('DMARC configured:', status.dmarc.configured);
  });

  // Monitor compliance
  const compliance = securityManager.monitorSecurityCompliance('example.com');
  console.log('Compliant:', compliance.compliant);
  console.log('Issues:', compliance.issues.length);
  console.log('Recommendations:', compliance.recommendations);
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  console.log('=== Email Service Examples ===\n');

  console.log('\n1. Quick Send Example');
  // await quickSendExample();

  console.log('\n2. Template Example');
  // await templateExample();

  console.log('\n3. Batch Send Example');
  // await batchSendExample();

  console.log('\n4. Multi-Provider Example');
  // await multiProviderExample();

  console.log('\n5. Attachment Example');
  // await attachmentExample();

  console.log('\n6. Scheduled Email Example');
  // scheduledEmailExample();

  console.log('\n7. List Management Example');
  // await listManagementExample();

  console.log('\n8. Analytics Example');
  // await analyticsExample();

  console.log('\n9. Bounce Handling Example');
  // bounceHandlingExample();

  console.log('\n10. Security Example');
  // securityExample();
}

if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  quickSendExample,
  templateExample,
  batchSendExample,
  multiProviderExample,
  attachmentExample,
  scheduledEmailExample,
  listManagementExample,
  analyticsExample,
  bounceHandlingExample,
  securityExample
};
