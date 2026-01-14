/**
 * Privacy Policy Generator
 * GDPR-compliant privacy policy generation
 * @packageDocumentation
 */

import type {
  GeneratePolicyRequest,
  GeneratedPolicy,
  PrivacyPolicyTemplate,
  GDPRSection,
  OrganizationInfo,
  PolicyFormat,
  PolicyLanguage,
  DataProcessingActivity,
  CookiePolicy,
  UserRights,
  TemplateVariable,
} from './types';

export interface Env {
  PRIVACY_POLICY: DurableObjectNamespace;
  PRIVACY_KV: KVNamespace;
  PRIVACY_DB?: D1Database;
}

// ============================================================================
// PRIVACY POLICY GENERATOR DURABLE OBJECT
// ============================================================================

/**
 * Privacy Policy Generator Durable Object
 * Generates GDPR-compliant privacy policies
 */
export class PrivacyPolicyGenerator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case path === '/policy/generate' && request.method === 'POST':
          return this.handleGeneratePolicy(request);
        case path === '/policy/templates' && request.method === 'GET':
          return this.handleGetTemplates(url);
        case path.startsWith('/policy/template/') && request.method === 'GET':
          const templateId = path.split('/').pop();
          return this.handleGetTemplate(templateId!);
        case path === '/policy/template' && request.method === 'POST':
          return this.handleCreateTemplate(request);
        case path.startsWith('/policy/') && request.method === 'GET':
          const policyId = path.split('/').pop();
          return this.handleGetPolicy(policyId!);
        case path === '/policy/validate' && request.method === 'POST':
          return this.handleValidatePolicy(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Privacy policy generator error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // ========================================================================
  // POLICY GENERATION
  // ========================================================================

  /**
   * Generate a privacy policy
   */
  private async handleGeneratePolicy(request: Request): Promise<Response> {
    const requestBody: GeneratePolicyRequest = await request.json();

    // Validate request
    if (!requestBody.organization || !requestBody.dataProcessing || !requestBody.userRights) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: organization, dataProcessing, userRights',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate policy
    const policy = await this.generatePolicy(requestBody);

    // Store generated policy
    await this.storePolicy(policy);

    return new Response(
      JSON.stringify({
        success: true,
        policy,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Generate privacy policy
   */
  async generatePolicy(request: GeneratePolicyRequest): Promise<GeneratedPolicy> {
    const template = request.templateId
      ? await this.getTemplate(request.templateId)
      : this.getDefaultTemplate();

    const sections = template
      ? this.buildSections(template.sections, request)
      : this.buildDefaultSections(request);

    const content = this.formatContent(sections, request.format);

    const now = Date.now();
    const effectiveDate = request.effectiveDate || now;

    const policy: GeneratedPolicy = {
      id: crypto.randomUUID(),
      templateId: request.templateId || template?.id || crypto.randomUUID(),
      organization: request.organization,
      format: request.format,
      language: request.language,
      content,
      sections,
      variables: request.variables || {},
      generatedAt: now,
      version: '1.0.0',
      effectiveDate,
      lastReviewDate: now,
      nextReviewDate: now + 365 * 24 * 60 * 60 * 1000, // Review in 1 year
      published: false,
      hash: this.generateHash(content),
    };

    return policy;
  }

  /**
   * Build policy sections
   */
  private buildSections(
    templateSections: GDPRSection[],
    request: GeneratePolicyRequest
  ): GDPRSection[] {
    const sections: GDPRSection[] = [];
    const org = request.organization;

    // Build each section with organization-specific data
    for (const section of templateSections) {
      const content = this.fillVariables(section.content, {
        organization_name: org.name,
        organization_legal_name: org.legalName || org.name,
        contact_email: org.contactEmail,
        contact_phone: org.contactPhone || '',
        website: org.website,
        address: this.formatAddress(org.address),
        dpo_name: org.dpo?.name || '',
        dpo_email: org.dpo?.email || '',
        ...request.variables,
      });

      sections.push({
        ...section,
        content,
        subsections: section.subsections
          ? this.buildSections(section.subsections, request)
          : undefined,
      });
    }

    return sections;
  }

  /**
   * Build default GDPR-compliant sections
   */
  private buildDefaultSections(request: GeneratePolicyRequest): GDPRSection[] {
    const org = request.organization;
    const processing = request.dataProcessing;
    const rights = request.userRights;

    return [
      {
        id: 'introduction',
        title: 'Introduction',
        content: `At ${org.name}, we are committed to protecting your personal data and respecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services, in compliance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.`,
        order: 1,
        required: true,
        gdprArticle: 'Article 13 & 14',
      },
      {
        id: 'data-controller',
        title: 'Data Controller',
        content: this.buildDataControllerSection(org),
        order: 2,
        required: true,
        gdprArticle: 'Article 4(7)',
      },
      {
        id: 'data-collection',
        title: 'Data We Collect',
        content: this.buildDataCollectionSection(processing),
        order: 3,
        required: true,
        gdprArticle: 'Article 6',
      },
      {
        id: 'data-processing',
        title: 'How We Process Your Data',
        content: this.buildDataProcessingSection(processing),
        order: 4,
        required: true,
        gdprArticle: 'Article 5',
      },
      {
        id: 'legal-basis',
        title: 'Legal Basis for Processing',
        content: this.buildLegalBasisSection(processing),
        order: 5,
        required: true,
        gdprArticle: 'Article 6(1)',
      },
      {
        id: 'data-recipients',
        title: 'Data Recipients',
        content: this.buildDataRecipientsSection(processing),
        order: 6,
        required: true,
        gdprArticle: 'Article 15(1)(e)',
      },
      {
        id: 'international-transfers',
        title: 'International Data Transfers',
        content: this.buildInternationalTransfersSection(processing),
        order: 7,
        required: true,
        gdprArticle: 'Chapter V',
      },
      {
        id: 'data-retention',
        title: 'Data Retention',
        content: this.buildDataRetentionSection(processing),
        order: 8,
        required: true,
        gdprArticle: 'Article 5(1)(e)',
      },
      {
        id: 'user-rights',
        title: 'Your Rights',
        content: this.buildUserRightsSection(rights, org),
        order: 9,
        required: true,
        gdprArticle: 'Article 15-22',
      },
      {
        id: 'cookies',
        title: 'Cookie Policy',
        content: this.buildCookieSection(request.cookiePolicy),
        order: 10,
        required: true,
        gdprArticle: 'Article 5(3)',
      },
      {
        id: 'security',
        title: 'Data Security',
        content: `We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage. These measures include encryption, access controls, regular security assessments, and staff training on data protection.`,
        order: 11,
        required: true,
        gdprArticle: 'Article 32',
      },
      {
        id: 'changes',
        title: 'Changes to This Policy',
        content: `We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically to stay informed about how we protect your data.`,
        order: 12,
        required: true,
        gdprArticle: 'Article 13(3)',
      },
      {
        id: 'contact',
        title: 'Contact Us',
        content: this.buildContactSection(org),
        order: 13,
        required: true,
        gdprArticle: 'Article 13(2)(a)',
      },
    ];
  }

  /**
   * Build data controller section
   */
  private buildDataControllerSection(org: OrganizationInfo): string {
    let content = `The Data Controller responsible for your personal data is:\n\n`;
    content += `**${org.legalName || org.name}**\n`;
    content += `${org.address.street}\n`;
    content += `${org.address.city}, ${org.address.state || ''} ${org.address.postalCode}\n`;
    content += `${org.address.country}\n\n`;
    content += `**Contact:**\n`;
    content += `- Email: ${org.contactEmail}\n`;
    if (org.contactPhone) {
      content += `- Phone: ${org.contactPhone}\n`;
    }
    content += `- Website: ${org.website}\n`;

    if (org.dpo) {
      content += `\n**Data Protection Officer:**\n`;
      content += `Our Data Protection Officer is ${org.dpo.name}.\n`;
      content += `You can contact them at: ${org.dpo.email}\n`;
      if (org.dpo.phone) {
        content += `Phone: ${org.dpo.phone}\n`;
      }
    }

    if (org.euRepresentative) {
      content += `\n**EU Representative:**\n`;
      content += `For users in the European Economic Area, our representative is:\n`;
      content += `${org.euRepresentative.name}\n`;
      content += `${this.formatAddress(org.euRepresentative.address)}\n`;
      content += `Email: ${org.euRepresentative.email}\n`;
    }

    return content;
  }

  /**
   * Build data collection section
   */
  private buildDataCollectionSection(processing: DataProcessingActivity[]): string {
    let content = `We collect and process the following categories of personal data:\n\n`;

    const categories = new Set<string>();
    processing.forEach((activity) => {
      activity.dataCategories.forEach((cat) => categories.add(cat));
    });

    categories.forEach((category) => {
      content += `- **${category}**\n`;
    });

    content += `\nWe collect this data directly from you, automatically when you use our services, or from third parties as described in this policy.`;

    return content;
  }

  /**
   * Build data processing section
   */
  private buildDataProcessingSection(processing: DataProcessingActivity[]): string {
    let content = `We process your personal data for the following purposes:\n\n`;

    processing.forEach((activity) => {
      content += `**${activity.name}**\n`;
      content += `${activity.description}\n`;
      content += `- Data: ${activity.dataCategories.join(', ')}\n`;
      content += `- Purpose: ${activity.purpose}\n\n`;
    });

    return content;
  }

  /**
   * Build legal basis section
   */
  private buildLegalBasisSection(processing: DataProcessingActivity[]): string {
    let content = `We process your personal data based on the following legal bases under GDPR Article 6:\n\n`;

    const bases = new Set<string>();
    processing.forEach((activity) => {
      activity.legalBasis.forEach((basis) => bases.add(basis));
    });

    bases.forEach((basis) => {
      content += `- **${basis}**\n`;
    });

    content += `\nFor special categories of data, we rely on your explicit consent as required by GDPR Article 9.`;

    return content;
  }

  /**
   * Build data recipients section
   */
  private buildDataRecipientsSection(processing: DataProcessingActivity[]): string {
    let content = `We may share your personal data with the following categories of recipients:\n\n`;

    const recipients = new Set<string>();
    processing.forEach((activity) => {
      activity.dataRecipients.forEach((recipient) => recipients.add(recipient));
    });

    recipients.forEach((recipient) => {
      content += `- ${recipient}\n`;
    });

    content += `\nWe only share your data when necessary for the purposes described in this policy and with appropriate safeguards in place.`;

    return content;
  }

  /**
   * Build international transfers section
   */
  private buildInternationalTransfersSection(processing: DataProcessingActivity[]): string {
    let content = `Your personal data may be transferred to and processed in countries outside the European Economic Area (EEA). We ensure that such transfers are protected by appropriate safeguards, including:\n\n`;

    const transfers = new Map<string, string[]>();
    processing.forEach((activity) => {
      activity.internationalTransfers.forEach((transfer) => {
        if (!transfers.has(transfer.country)) {
          transfers.set(transfer.country, []);
        }
        transfers.get(transfer.country)!.push(...transfer.safeguards);
      });
    });

    transfers.forEach((safeguards, country) => {
      content += `**${country}**\n`;
      safeguards.forEach((safeguard) => {
        content += `- ${safeguard}\n`;
      });
      content += `\n`;
    });

    return content;
  }

  /**
   * Build data retention section
   */
  private buildDataRetentionSection(processing: DataProcessingActivity[]): string {
    let content = `We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, unless a longer retention period is required or permitted by law.\n\n`;

    processing.forEach((activity) => {
      content += `**${activity.name}**\n`;
      content += `Retention period: ${activity.retentionPeriod}\n\n`;
    });

    content += `When your personal data is no longer needed, we will securely delete or anonymize it.`;

    return content;
  }

  /**
   * Build user rights section
   */
  private buildUserRightsSection(rights: UserRights[], org: OrganizationInfo): string {
    let content = `Under GDPR, you have the following rights regarding your personal data:\n\n`;

    rights.forEach((right) => {
      content += `**${right.name}** (${right.gdprArticle})\n`;
      content += `${right.description}\n`;
      content += `${right.howToExercise}\n\n`;
    });

    content += `To exercise these rights, please contact us at ${org.contactEmail}. We will respond to your request within one month, though this may be extended by two additional months in complex cases.`;

    return content;
  }

  /**
   * Build cookie section
   */
  private buildCookieSection(cookiePolicy?: CookiePolicy): string {
    if (!cookiePolicy || !cookiePolicy.usesCookies) {
      return 'We do not use cookies on our website.';
    }

    let content = `We use cookies and similar technologies to enhance your experience on our website.\n\n`;
    content += `**Types of cookies we use:**\n\n`;

    cookiePolicy.categories.forEach((category) => {
      content += `- **${category}**: ${this.getCookieDescription(category)}\n`;
    });

    content += `\n**How to manage cookies:**\n${cookiePolicy.managementInstructions}`;

    return content;
  }

  /**
   * Get cookie category description
   */
  private getCookieDescription(category: string): string {
    const descriptions: Record<string, string> = {
      essential: 'Strictly necessary cookies for the website to function properly',
      functional: 'Cookies that enable enhanced functionality and personalization',
      analytics: 'Cookies that help us understand how users interact with our website',
      marketing: 'Cookies used to deliver advertisements relevant to you',
      advertising: 'Cookies that track your browsing habits to show relevant ads',
    };

    return descriptions[category] || 'Cookies for this category';
  }

  /**
   * Build contact section
   */
  private buildContactSection(org: OrganizationInfo): string {
    let content = `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\n`;
    content += `**${org.name}**\n`;
    content += `Email: ${org.contactEmail}\n`;

    if (org.contactPhone) {
      content += `Phone: ${org.contactPhone}\n`;
    }

    if (org.dpo) {
      content += `\nYou may also contact our Data Protection Officer:\n`;
      content += `${org.dpo.name}\n`;
      content += `Email: ${org.dpo.email}\n`;
    }

    content += `\nYou have the right to lodge a complaint with a supervisory authority if you believe our processing of your personal data infringes GDPR requirements.`;

    return content;
  }

  /**
   * Format content based on requested format
   */
  private formatContent(sections: GDPRSection[], format: PolicyFormat): string {
    switch (format) {
      case PolicyFormat.HTML:
        return this.formatToHTML(sections);
      case PolicyFormat.MARKDOWN:
        return this.formatToMarkdown(sections);
      case PolicyFormat.PDF:
        return this.formatToPDF(sections);
      case PolicyFormat.TEXT:
        return this.formatToText(sections);
      case PolicyFormat.JSON:
        return JSON.stringify(sections, null, 2);
      default:
        return this.formatToMarkdown(sections);
    }
  }

  /**
   * Format to HTML
   */
  private formatToHTML(sections: GDPRSection[]): string {
    let html = '<!DOCTYPE html>\n<html>\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html += '<title>Privacy Policy</title>\n';
    html += '<style>\n';
    html += 'body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }\n';
    html += 'h1 { color: #333; border-bottom: 2px solid #4CAF50; }\n';
    html += 'h2 { color: #555; margin-top: 30px; }\n';
    html += 'h3 { color: #666; }\n';
    html += 'p { line-height: 1.6; }\n';
    html += 'ul { line-height: 1.6; }\n';
    html += '</style>\n';
    html += '</head>\n<body>\n';

    for (const section of sections) {
      html += `<h${section.order > 1 ? '2' : '1'}>${section.title}</h${section.order > 1 ? '2' : '1'}>\n`;
      html += `<div>${this.markdownToHTML(section.content)}</div>\n`;

      if (section.subsections) {
        for (const subsection of section.subsections) {
          html += `<h3>${subsection.title}</h3>\n`;
          html += `<div>${this.markdownToHTML(subsection.content)}</div>\n`;
        }
      }
    }

    html += '\n</body>\n</html>';

    return html;
  }

  /**
   * Format to Markdown
   */
  private formatToMarkdown(sections: GDPRSection[]): string {
    let md = '# Privacy Policy\n\n';

    for (const section of sections) {
      const level = section.order === 1 ? '#' : '##';
      md += `${level} ${section.title}\n\n`;
      md += `${section.content}\n\n`;

      if (section.subsections) {
        for (const subsection of section.subsections) {
          md += `### ${subsection.title}\n\n`;
          md += `${subsection.content}\n\n`;
        }
      }
    }

    return md;
  }

  /**
   * Format to plain text
   */
  private formatToText(sections: GDPRSection[]): string {
    let text = 'PRIVACY POLICY\n\n';

    for (const section of sections) {
      text += `${section.title}\n`;
      text += '='.repeat(section.title.length) + '\n\n';
      text += `${this.stripMarkdown(section.content)}\n\n`;

      if (section.subsections) {
        for (const subsection of section.subsections) {
          text += `${subsection.title}\n`;
          text += '-'.repeat(subsection.title.length) + '\n\n';
          text += `${this.stripMarkdown(subsection.content)}\n\n`;
        }
      }
    }

    return text;
  }

  /**
   * Format to PDF (returns text, would need PDF library in production)
   */
  private formatToPDF(sections: GDPRSection[]): string {
    // In production, this would use a PDF library like jsPDF or PDFKit
    // For now, return the text content
    return this.formatToText(sections);
  }

  /**
   * Convert Markdown to HTML
   */
  private markdownToHTML(markdown: string): string {
    let html = markdown;

    // Headers
    html = html.replace(/### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');

    // Lists
    html = html.replace(/^- (.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    return html;
  }

  /**
   * Strip Markdown formatting
   */
  private stripMarkdown(text: string): string {
    return text
      .replace(/#{1,3}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/-/g, '');
  }

  /**
   * Fill template variables
   */
  private fillVariables(content: string, variables: Record<string, string>): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Format address
   */
  private formatAddress(address: any): string {
    return `${address.street}, ${address.city}, ${address.state || ''} ${address.postalCode}, ${address.country}`;
  }

  /**
   * Generate hash for integrity verification
   */
  private generateHash(content: string): string {
    // Simple hash implementation (in production, use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // ========================================================================
  // TEMPLATE MANAGEMENT
  // ========================================================================

  /**
   * Get privacy policy templates
   */
  private async handleGetTemplates(url: URL): Promise<Response> {
    const industry = url.searchParams.get('industry');
    const language = url.searchParams.get('language');

    let templates = await this.getTemplates();

    if (industry) {
      templates = templates.filter((t) => t.industry === industry);
    }

    if (language) {
      templates = templates.filter((t) => t.supportedLanguages.includes(language as any));
    }

    return new Response(
      JSON.stringify({ templates }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get specific template
   */
  private async handleGetTemplate(templateId: string): Promise<Response> {
    const template = await this.getTemplate(templateId);

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ template }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Create custom template
   */
  private async handleCreateTemplate(request: Request): Promise<Response> {
    const body = await request.json();

    const template: PrivacyPolicyTemplate = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description,
      version: '1.0.0',
      industry: body.industry,
      sections: body.sections,
      defaultLanguage: body.defaultLanguage,
      supportedLanguages: body.supportedLanguages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: body.variables || [],
    };

    await this.storeTemplate(template);

    return new Response(
      JSON.stringify({
        success: true,
        template,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get generated policy
   */
  private async handleGetPolicy(policyId: string): Promise<Response> {
    const policy = await this.getPolicy(policyId);

    if (!policy) {
      return new Response(
        JSON.stringify({ error: 'Policy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return in requested format
    const format = policy.format;
    const contentType = this.getContentType(format);

    return new Response(policy.content, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  }

  /**
   * Validate policy
   */
  private async handleValidatePolicy(request: Request): Promise<Response> {
    const body = await request.json();
    const { policyContent } = body;

    const validation = await this.validatePolicyContent(policyContent);

    return new Response(
      JSON.stringify({
        validation,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Validate policy content for GDPR compliance
   */
  async validatePolicyContent(content: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    requiredSections: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const requiredSections = [
      'Data Controller',
      'Data We Collect',
      'Legal Basis',
      'User Rights',
      'Data Security',
      'Contact',
    ];

    // Check for required sections
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        errors.push(`Missing required section: ${section}`);
      }
    }

    // Check for GDPR references
    if (!content.toLowerCase().includes('gdpr') && !content.toLowerCase().includes('general data protection regulation')) {
      warnings.push('Policy should mention GDPR compliance');
    }

    // Check for user rights
    const rights = [
      'right to access',
      'right to rectification',
      'right to erasure',
      'right to restrict processing',
      'right to data portability',
      'right to object',
    ];

    for (const right of rights) {
      if (!content.toLowerCase().includes(right)) {
        warnings.push(`Policy should mention: ${right}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiredSections,
    };
  }

  // ========================================================================
  // STORAGE OPERATIONS
  // ========================================================================

  /**
   * Store generated policy
   */
  private async storePolicy(policy: GeneratedPolicy): Promise<void> {
    const key = `policy:${policy.id}`;
    await this.state.storage.put(key, policy);

    // Also store in KV for CDN serving
    if (this.env.PRIVACY_KV) {
      await this.env.PRIVACY_KV.put(key, policy.content, {
        expirationTtl: 365 * 24 * 60 * 60, // 1 year
      });
    }
  }

  /**
   * Get generated policy
   */
  private async getPolicy(policyId: string): Promise<GeneratedPolicy | null> {
    const key = `policy:${policyId}`;
    return await this.state.storage.get<GeneratedPolicy>(key);
  }

  /**
   * Store template
   */
  private async storeTemplate(template: PrivacyPolicyTemplate): Promise<void> {
    const key = `template:${template.id}`;
    await this.state.storage.put(key, template);
  }

  /**
   * Get template
   */
  private async getTemplate(templateId: string): Promise<PrivacyPolicyTemplate | null> {
    const key = `template:${templateId}`;
    return await this.state.storage.get<PrivacyPolicyTemplate>(key);
  }

  /**
   * Get all templates
   */
  private async getTemplates(): Promise<PrivacyPolicyTemplate[]> {
    const templates: PrivacyPolicyTemplate[] = [];

    const keys = await this.state.storage.list({
      prefix: 'template:',
    });

    for (const key of keys.keys) {
      const template = await this.state.storage.get<PrivacyPolicyTemplate>(key.name);
      if (template) {
        templates.push(template);
      }
    }

    return templates.length > 0 ? templates : [this.getDefaultTemplate()];
  }

  /**
   * Get content type for format
   */
  private getContentType(format: PolicyFormat): string {
    switch (format) {
      case PolicyFormat.HTML:
        return 'text/html; charset=utf-8';
      case PolicyFormat.MARKDOWN:
        return 'text/markdown; charset=utf-8';
      case PolicyFormat.PDF:
        return 'application/pdf';
      case PolicyFormat.JSON:
        return 'application/json';
      case PolicyFormat.TEXT:
        return 'text/plain; charset=utf-8';
      default:
        return 'text/plain; charset=utf-8';
    }
  }

  /**
   * Get default GDPR-compliant template
   */
  private getDefaultTemplate(): PrivacyPolicyTemplate {
    const now = Date.now();

    return {
      id: 'default-gdpr-template',
      name: 'GDPR Default Template',
      description: 'Default GDPR-compliant privacy policy template',
      version: '1.0.0',
      industry: 'general',
      sections: [],
      defaultLanguage: PolicyLanguage.EN,
      supportedLanguages: [PolicyLanguage.EN],
      createdAt: now,
      updatedAt: now,
      variables: [],
    };
  }
}
