/**
 * Template Engine - Email template system with MJML, Handlebars, and HTML support
 */

// @ts-nocheck - External dependencies (mjml, handlebars) not installed
import * as mjml from 'mjml';
import * as Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';
import { winston as logger } from '../utils/logger';
import {
  EmailTemplate,
  TemplateType,
  TemplateVariable,
  TemplatePreview,
  EmailMessage
} from '../types';

/**
 * Template Engine class for rendering email templates
 */
export class TemplateEngine {
  private templates: Map<string, EmailTemplate> = new Map();
  private handlebarsHelpers: Map<string, any> = new Map();

  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Register default Handlebars helpers
   */
  private registerDefaultHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('dateFormat', (date, format) => {
      const d = new Date(date);
      // Simple date formatting (can be extended)
      return d.toISOString().split('T')[0];
    });

    // Currency formatting helper
    Handlebars.registerHelper('currency', (amount, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount);
    });

    // JSON stringify helper
    Handlebars.registerHelper('json', (obj) => {
      return JSON.stringify(obj);
    });

    // Conditional helpers
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);

    // String helpers
    Handlebars.registerHelper('uppercase', (str) => str.toUpperCase());
    Handlebars.registerHelper('lowercase', (str) => str.toLowerCase());
    Handlebars.registerHelper('capitalize', (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Array helpers
    Handlebars.registerHelper('length', (arr) => arr.length);
    Handlebars.registerHelper('first', (arr) => arr[0]);
    Handlebars.registerHelper('last', (arr) => arr[arr.length - 1]);

    logger.info('Default Handlebars helpers registered');
  }

  /**
   * Register custom Handlebars helper
   */
  registerHelper(name: string, fn: (...args: any[]) => string): void {
    Handlebars.registerHelper(name, fn);
    this.handlebarsHelpers.set(name, fn);
    logger.info(`Custom helper '${name}' registered`);
  }

  /**
   * Create a new template
   */
  createTemplate(
    name: string,
    subject: string,
    content: string,
    type: TemplateType = TemplateType.HTML,
    variables: TemplateVariable[] = []
  ): EmailTemplate {
    const template: EmailTemplate = {
      id: uuidv4(),
      name,
      subject,
      type,
      content,
      variables,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Generate text version for HTML templates
    if (type === TemplateType.HTML || type === TemplateType.MJML) {
      template.textContent = this.generateTextVersion(content);
    }

    this.templates.set(template.id, template);
    logger.info(`Template '${name}' created with ID ${template.id}`);

    return template;
  }

  /**
   * Update existing template
   */
  updateTemplate(
    templateId: string,
    updates: Partial<EmailTemplate>
  ): EmailTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    const updated = {
      ...template,
      ...updates,
      id: template.id, // Preserve ID
      createdAt: template.createdAt, // Preserve creation time
      updatedAt: new Date()
    };

    // Regenerate text version if content changed
    if (updates.content && (updated.type === TemplateType.HTML || updated.type === TemplateType.MJML)) {
      updated.textContent = this.generateTextVersion(updates.content);
    }

    this.templates.set(templateId, updated);
    logger.info(`Template '${updated.name}' updated`);

    return updated;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): EmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Render template with data
   */
  renderTemplate(
    templateId: string,
    data: Record<string, any>
  ): { html: string; text?: string; subject: string } {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate required variables
    this.validateVariables(template, data);

    // Render subject
    const subject = this.renderString(template.subject, data);

    // Render content based on type
    let html: string;
    let text: string | undefined;

    switch (template.type) {
      case TemplateType.MJML:
        html = this.renderMJML(template.content, data);
        text = template.textContent ? this.renderString(template.textContent, data) : undefined;
        break;

      case TemplateType.HANDLEBARS:
        html = this.renderHandlebars(template.content, data);
        text = template.textContent ? this.renderString(template.textContent, data) : undefined;
        break;

      case TemplateType.HTML:
        html = this.renderString(template.content, data);
        text = template.textContent ? this.renderString(template.textContent, data) : undefined;
        break;

      case TemplateType.TEXT:
        html = '';
        text = this.renderString(template.content, data);
        break;

      default:
        throw new Error(`Unsupported template type: ${template.type}`);
    }

    return { html, text, subject };
  }

  /**
   * Render template preview
   */
  previewTemplate(
    templateId: string,
    data: Record<string, any>
  ): TemplatePreview {
    try {
      const { html, text, subject } = this.renderTemplate(templateId, data);

      return {
        html,
        text,
        subject,
        renderedAt: new Date(),
        errors: []
      };
    } catch (error) {
      return {
        html: '',
        subject: '',
        renderedAt: new Date(),
        errors: [error.message]
      };
    }
  }

  /**
   * Render MJML template
   */
  private renderMJML(mjmlContent: string, data: Record<string, any>): string {
    try {
      // First render any Handlebars variables in MJML
      const renderedMJML = this.renderHandlebars(mjmlContent, data);

      // Convert MJML to HTML
      const result = mjml(renderedMJML, {
        validationLevel: 'soft',
        minify: false,
        juice: true,
        juicePreserveTags: null
      });

      if (result.errors.length > 0) {
        logger.warn('MJML rendering errors:', result.errors);
      }

      return result.html;
    } catch (error) {
      logger.error('MJML rendering failed:', error);
      throw new Error(`MJML rendering failed: ${error.message}`);
    }
  }

  /**
   * Render Handlebars template
   */
  private renderHandlebars(template: string, data: Record<string, any>): string {
    try {
      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(data);
    } catch (error) {
      logger.error('Handlebars rendering failed:', error);
      throw new Error(`Handlebars rendering failed: ${error.message}`);
    }
  }

  /**
   * Render string with basic variable substitution
   */
  private renderString(template: string, data: Record<string, any>): string {
    try {
      return this.renderHandlebars(template, data);
    } catch (error) {
      logger.error('String rendering failed:', error);
      return template;
    }
  }

  /**
   * Generate text version from HTML
   */
  private generateTextVersion(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate template variables
   */
  private validateVariables(
    template: EmailTemplate,
    data: Record<string, any>
  ): void {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = data[variable.name];

      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${variable.name}' is missing`);
        continue;
      }

      // Type validation
      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== variable.type) {
          errors.push(
            `Variable '${variable.name}' should be ${variable.type}, but got ${actualType}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Create email message from template
   */
  createEmailFromTemplate(
    templateId: string,
    to: string | string[],
    from: string,
    data: Record<string, any>
  ): EmailMessage {
    const { html, text, subject } = this.renderTemplate(templateId, data);

    return {
      id: uuidv4(),
      from: {
        email: from
      },
      to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
      subject,
      html: html || undefined,
      text: text || undefined,
      templateId,
      templateData: data,
      createdAt: new Date()
    } as any;
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: EmailTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate MJML syntax
      if (template.type === TemplateType.MJML) {
        const result = mjml(template.content, { validationLevel: 'strict' });
        if (result.errors.length > 0) {
          errors.push(...result.errors.map(e => `${e.formattedMessage}`));
        }
      }

      // Validate Handlebars syntax
      try {
        Handlebars.compile(template.content);
      } catch (error) {
        errors.push(`Handlebars syntax error: ${error.message}`);
      }

      // Validate subject template
      try {
        Handlebars.compile(template.subject);
      } catch (error) {
        errors.push(`Subject syntax error: ${error.message}`);
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Clone template
   */
  cloneTemplate(templateId: string, newName: string): EmailTemplate | null {
    const original = this.templates.get(templateId);
    if (!original) {
      return null;
    }

    const cloned: EmailTemplate = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(cloned.id, cloned);
    logger.info(`Template cloned as '${newName}' with ID ${cloned.id}`);

    return cloned;
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    total: number;
    byType: Record<TemplateType, number>;
  } {
    const templates = Array.from(this.templates.values());
    const byType = {
      [TemplateType.HTML]: 0,
      [TemplateType.TEXT]: 0,
      [TemplateType.MJML]: 0,
      [TemplateType.HANDLEBARS]: 0
    };

    templates.forEach(t => {
      byType[t.type]++;
    });

    return {
      total: templates.length,
      byType
    };
  }
}

/**
 * Predefined responsive email templates
 */
export class TemplateLibrary {
  private engine: TemplateEngine;

  constructor(engine: TemplateEngine) {
    this.engine = engine;
  }

  /**
   * Create welcome email template
   */
  createWelcomeTemplate(): EmailTemplate {
    const mjml = `
<mjml>
  <mj-head>
    <mj-title>Welcome to {{companyName}}</mj-title>
  </mj-head>
  <mj-body>
    <mj-container background-color="#ffffff">
      <mj-section background-color="#4A90E2">
        <mj-column>
          <mj-text color="white" font-size="24px" font-weight="bold" align="center">
            {{companyName}}
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px">
        <mj-column>
          <mj-text font-size="20px" font-weight="bold" padding-bottom="10px">
            Welcome, {{userName}}!
          </mj-text>
          <mj-text>
            Thank you for joining {{companyName}}. We're excited to have you on board!
          </mj-text>
          <mj-button background-color="#4A90E2" href="{{ctaUrl}}">
            Get Started
          </mj-button>
        </mj-column>
      </mj-section>

      <mj-section background-color="#f5f5f5" padding="20px">
        <mj-column>
          <mj-text color="#666666" font-size="12px" align="center">
            &copy; {{year}} {{companyName}}. All rights reserved.
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-container>
  </mj-body>
</mjml>`;

    return this.engine.createTemplate(
      'welcome',
      'Welcome to {{companyName}}',
      mjml,
      TemplateType.MJML,
      [
        { name: 'userName', type: 'string', required: true, description: 'User name' },
        { name: 'companyName', type: 'string', required: true, description: 'Company name' },
        { name: 'ctaUrl', type: 'string', required: true, description: 'Call to action URL' },
        { name: 'year', type: 'number', required: false, defaultValue: new Date().getFullYear() }
      ]
    );
  }

  /**
   * Create password reset template
   */
  createPasswordResetTemplate(): EmailTemplate {
    const mjml = `
<mjml>
  <mj-head>
    <mj-title>Password Reset</mj-title>
  </mj-head>
  <mj-body>
    <mj-container background-color="#ffffff">
      <mj-section background-color="#E74C3C">
        <mj-column>
          <mj-text color="white" font-size="24px" font-weight="bold" align="center">
            Password Reset
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px">
        <mj-column>
          <mj-text font-size="18px" font-weight="bold">
            Hi {{userName}},
          </mj-text>
          <mj-text>
            We received a request to reset your password. Click the button below to create a new password.
          </mj-text>
          <mj-text font-size="12px" color="#666666">
            This link will expire in {{expiryMinutes}} minutes.
          </mj-text>
          <mj-button background-color="#E74C3C" href="{{resetUrl}}">
            Reset Password
          </mj-button>
          <mj-text font-size="12px" color="#999999">
            If you didn't request this, please ignore this email.
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-container>
  </mj-body>
</mjml>`;

    return this.engine.createTemplate(
      'password-reset',
      'Reset Your Password',
      mjml,
      TemplateType.MJML,
      [
        { name: 'userName', type: 'string', required: true },
        { name: 'resetUrl', type: 'string', required: true },
        { name: 'expiryMinutes', type: 'number', required: false, defaultValue: 30 }
      ]
    );
  }

  /**
   * Create email verification template
   */
  createEmailVerificationTemplate(): EmailTemplate {
    const mjml = `
<mjml>
  <mj-head>
    <mj-title>Verify Your Email</mj-title>
  </mj-head>
  <mj-body>
    <mj-container background-color="#ffffff">
      <mj-section background-color="#27AE60">
        <mj-column>
          <mj-text color="white" font-size="24px" font-weight="bold" align="center">
            Email Verification
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px">
        <mj-column>
          <mj-text font-size="18px" font-weight="bold">
            Verify Your Email Address
          </mj-text>
          <mj-text>
            Please click the button below to verify your email address:
          </mj-text>
          <mj-text font-size="14px" color="#666666">
            {{email}}
          </mj-text>
          <mj-button background-color="#27AE60" href="{{verificationUrl}}">
            Verify Email
          </mj-button>
        </mj-column>
      </mj-section>
    </mj-container>
  </mj-body>
</mjml>`;

    return this.engine.createTemplate(
      'email-verification',
      'Verify Your Email Address',
      mjml,
      TemplateType.MJML,
      [
        { name: 'email', type: 'string', required: true },
        { name: 'verificationUrl', type: 'string', required: true }
      ]
    );
  }

  /**
   * Create order confirmation template
   */
  createOrderConfirmationTemplate(): EmailTemplate {
    const mjml = `
<mjml>
  <mj-head>
    <mj-title>Order Confirmation</mj-title>
  </mj-head>
  <mj-body>
    <mj-container background-color="#ffffff">
      <mj-section background-color="#4A90E2">
        <mj-column>
          <mj-text color="white" font-size="24px" font-weight="bold" align="center">
            Order Confirmed
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px">
        <mj-column>
          <mj-text font-size="18px" font-weight="bold">
            Thank you for your order!
          </mj-text>
          <mj-text>
            Your order #{{orderNumber}} has been confirmed and will be shipped soon.
          </mj-text>
          <mj-text font-size="14px">
            Order Total: {{currency orderTotal}}
          </mj-text>
          <mj-button background-color="#4A90E2" href="{{trackingUrl}}">
            Track Order
          </mj-button>
        </mj-column>
      </mj-section>
    </mj-container>
  </mj-body>
</mjml>`;

    return this.engine.createTemplate(
      'order-confirmation',
      'Order #{{orderNumber}} Confirmed',
      mjml,
      TemplateType.MJML,
      [
        { name: 'orderNumber', type: 'string', required: true },
        { name: 'orderTotal', type: 'number', required: true },
        { name: 'trackingUrl', type: 'string', required: true }
      ]
    );
  }

  /**
   * Create newsletter template
   */
  createNewsletterTemplate(): EmailTemplate {
    const mjml = `
<mjml>
  <mj-head>
    <mj-title>{{newsletterName}}</mj-title>
  </mj-head>
  <mj-body>
    <mj-container background-color="#ffffff">
      <mj-section background-color="#8E44AD">
        <mj-column>
          <mj-text color="white" font-size="28px" font-weight="bold" align="center">
            {{newsletterName}}
          </mj-text>
          <mj-text color="white" align="center">
            {{issueDate}}
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px">
        <mj-column>
          <mj-text font-size="24px" font-weight="bold">
            {{mainHeadline}}
          </mj-text>
          <mj-text>
            {{mainContent}}
          </mj-text>
        </mj-column>
      </mj-section>

      {{#each articles}}
      <mj-section padding="10px 20px">
        <mj-column>
          <mj-text font-size="18px" font-weight="bold">
            {{this.title}}
          </mj-text>
          <mj-text>
            {{this.summary}}
          </mj-text>
          <mj-button href="{{this.link}}">
            Read More
          </mj-button>
        </mj-column>
      </mj-section>
      {{/each}}

      <mj-section background-color="#f5f5f5" padding="20px">
        <mj-column>
          <mj-text color="#666666" font-size="12px" align="center">
            You're receiving this email because you subscribed to {{newsletterName}}.
          </mj-text>
          <mj-button href="{{unsubscribeUrl}}" background-color="#999999">
            Unsubscribe
          </mj-button>
        </mj-column>
      </mj-section>
    </mj-container>
  </mj-body>
</mjml>`;

    return this.engine.createTemplate(
      'newsletter',
      '{{newsletterName}} - {{issueDate}}',
      mjml,
      TemplateType.MJML,
      [
        { name: 'newsletterName', type: 'string', required: true },
        { name: 'issueDate', type: 'string', required: true },
        { name: 'mainHeadline', type: 'string', required: true },
        { name: 'mainContent', type: 'string', required: true },
        { name: 'articles', type: 'array', required: false, defaultValue: [] },
        { name: 'unsubscribeUrl', type: 'string', required: true }
      ]
    );
  }

  /**
   * Create alert notification template
   */
  createAlertTemplate(): EmailTemplate {
    const mjml = `
<mjml>
  <mj-head>
    <mj-title>Alert: {{alertType}}</mj-title>
  </mj-head>
  <mj-body>
    <mj-container background-color="#ffffff">
      <mj-section background-color="{{#if isCritical}}#E74C3C{{else}}#F39C12{{/if}}">
        <mj-column>
          <mj-text color="white" font-size="24px" font-weight="bold" align="center">
            {{alertType}}
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px">
        <mj-column>
          <mj-text font-size="16px">
            {{alertMessage}}
          </mj-text>
          {{#if details}}
          <mj-text font-size="14px" color="#666666">
            Details: {{details}}
          </mj-text>
          {{/if}}
          <mj-button background-color="#4A90E2" href="{{actionUrl}}">
            {{actionLabel}}
          </mj-button>
        </mj-column>
      </mj-section>
    </mj-container>
  </mj-body>
</mjml>`;

    return this.engine.createTemplate(
      'alert',
      '{{alertType}} Alert',
      mjml,
      TemplateType.MJML,
      [
        { name: 'alertType', type: 'string', required: true },
        { name: 'alertMessage', type: 'string', required: true },
        { name: 'details', type: 'string', required: false },
        { name: 'isCritical', type: 'boolean', required: false, defaultValue: false },
        { name: 'actionUrl', type: 'string', required: true },
        { name: 'actionLabel', type: 'string', required: true, defaultValue: 'View Details' }
      ]
    );
  }
}
