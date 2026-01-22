// @ts-nocheck - Unused imports and external dependencies
/**
 * Invoice generation system
 */

import {
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  InvoiceItem,
  Subscription,
  BillingError,
  BillingErrorCode,
} from '../types/index.js';
import { pricingManager } from '../pricing/index.js';

/**
 * Invoice generator for creating and managing invoices
 */
export class InvoiceGenerator {
  private invoices: Map<string, Invoice>;
  private stripe: any; // Stripe client

  constructor(stripeSecretKey?: string) {
    this.invoices = new Map();
    // In production, initialize Stripe client
  }

  /**
   * Generate invoice for subscription
   */
  async generateSubscriptionInvoice(subscription: Subscription): Promise<Invoice> {
    const plan = pricingManager.getTier(subscription.planId);
    if (!plan) {
      throw new BillingError(
        BillingErrorCode.INVALID_PLAN,
        `Plan ${subscription.planId} not found`
      );
    }

    // Calculate prorated amount if needed
    const proratedAmount = this.calculateProratedAmount(subscription, plan);

    // Create line items
    const lineItems: InvoiceLineItem[] = [
      {
        id: this.generateId(),
        invoiceId: '', // Will be set after invoice creation
        description: `${plan.name} Plan (${plan.interval})`,
        quantity: 1,
        unitPrice: plan.price,
        amount: plan.price + proratedAmount,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      },
    ];

    // Create invoice
    const invoice: Invoice = {
      id: this.generateId(),
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      userId: subscription.userId,
      status: InvoiceStatus.DRAFT,
      amountDue: plan.price + proratedAmount,
      amountPaid: 0,
      amountRemaining: plan.price + proratedAmount,
      currency: plan.currency,
      dueDate: this.calculateDueDate(),
      lineItems,
      metadata: subscription.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Update line items with invoice ID
    lineItems.forEach((item) => {
      item.invoiceId = invoice.id;
    });

    this.invoices.set(invoice.id, invoice);

    // In production, create Stripe invoice
    // if (subscription.stripeCustomerId) {
    //   const stripeInvoice = await this.stripe.invoices.create({
    //     customer: subscription.stripeCustomerId,
    //     subscription: subscription.stripeSubscriptionId,
    //     auto_advance: true,
    //   });
    //   invoice.stripeInvoiceId = stripeInvoice.id;
    // }

    return invoice;
  }

  /**
   * Generate usage-based invoice
   */
  async generateUsageInvoice(params: {
    organizationId: string;
    userId: string;
    subscriptionId: string;
    usageItems: Array<{
      metricType: string;
      quantity: number;
      unitPrice: number;
      description: string;
    }>;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<Invoice> {
    const { organizationId, userId, subscriptionId, usageItems, periodStart, periodEnd } = params;

    // Create line items from usage
    const lineItems: InvoiceLineItem[] = usageItems.map((item) => ({
      id: this.generateId(),
      invoiceId: '', // Will be set after invoice creation
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
      periodStart,
      periodEnd,
    }));

    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Create invoice
    const invoice: Invoice = {
      id: this.generateId(),
      subscriptionId,
      organizationId,
      userId,
      status: InvoiceStatus.DRAFT,
      amountDue: totalAmount,
      amountPaid: 0,
      amountRemaining: totalAmount,
      currency: 'USD',
      dueDate: this.calculateDueDate(),
      lineItems,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Update line items with invoice ID
    lineItems.forEach((item) => {
      item.invoiceId = invoice.id;
    });

    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  /**
   * Add line item to existing invoice
   */
  async addLineItem(
    invoiceId: string,
    item: InvoiceItem
  ): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        `Invoice ${invoiceId} not found`
      );
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        'Can only add line items to draft invoices'
      );
    }

    const lineItem: InvoiceLineItem = {
      id: this.generateId(),
      invoiceId,
      description: item.description,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || item.amount / (item.quantity || 1),
      amount: item.amount,
      periodStart: new Date(),
      periodEnd: new Date(),
      metadata: item.metadata,
    };

    invoice.lineItems.push(lineItem);
    invoice.amountDue += item.amount;
    invoice.amountRemaining += item.amount;
    invoice.updatedAt = new Date();

    return invoice;
  }

  /**
   * Finalize invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        `Invoice ${invoiceId} not found`
      );
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        'Invoice is not in draft status'
      );
    }

    invoice.status = InvoiceStatus.OPEN;
    invoice.updatedAt = new Date();

    // In production, finalize Stripe invoice
    // if (invoice.stripeInvoiceId) {
    //   await this.stripe.invoices.finalizeInvoice(invoice.stripeInvoiceId);
    // }

    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(invoiceId: string, amount?: number): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        `Invoice ${invoiceId} not found`
      );
    }

    const paymentAmount = amount ?? invoice.amountRemaining;
    invoice.amountPaid += paymentAmount;
    invoice.amountRemaining -= paymentAmount;

    if (invoice.amountRemaining <= 0) {
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
    }

    invoice.updatedAt = new Date();
    return invoice;
  }

  /**
   * Void invoice
   */
  async voidInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        `Invoice ${invoiceId} not found`
      );
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        'Cannot void paid invoice'
      );
    }

    invoice.status = InvoiceStatus.VOID;
    invoice.updatedAt = new Date();

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  /**
   * Get invoices for subscription
   */
  async getSubscriptionInvoices(subscriptionId: string): Promise<Invoice[]> {
    const invoices = Array.from(this.invoices.values());
    return invoices.filter((i) => i.subscriptionId === subscriptionId);
  }

  /**
   * Get invoices for organization
   */
  async getOrganizationInvoices(organizationId: string): Promise<Invoice[]> {
    const invoices = Array.from(this.invoices.values());
    return invoices.filter((i) => i.organizationId === organizationId);
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    const invoices = Array.from(this.invoices.values());
    return invoices.filter(
      (i) =>
        i.status === InvoiceStatus.OPEN &&
        i.dueDate < now &&
        i.amountRemaining > 0
    );
  }

  /**
   * Get invoice summary
   */
  async getInvoiceSummary(organizationId: string): Promise<{
    totalDue: number;
    totalPaid: number;
    totalOverdue: number;
    invoiceCount: number;
  }> {
    const invoices = await this.getOrganizationInvoices(organizationId);

    const totalDue = invoices
      .filter((i) => i.status === InvoiceStatus.OPEN)
      .reduce((sum, i) => sum + i.amountRemaining, 0);

    const totalPaid = invoices
      .filter((i) => i.status === InvoiceStatus.PAID)
      .reduce((sum, i) => sum + i.amountPaid, 0);

    const now = new Date();
    const totalOverdue = invoices
      .filter((i) => i.status === InvoiceStatus.OPEN && i.dueDate < now)
      .reduce((sum, i) => sum + i.amountRemaining, 0);

    return {
      totalDue,
      totalPaid,
      totalOverdue,
      invoiceCount: invoices.length,
    };
  }

  /**
   * Calculate prorated amount
   */
  private calculateProratedAmount(subscription: Subscription, plan: any): number {
    // Calculate prorated amount if subscription changed mid-period
    const prorationAmount = subscription.metadata?.prorationAmount || 0;
    return prorationAmount;
  }

  /**
   * Calculate due date (default: 30 days from now)
   */
  private calculateDueDate(days: number = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate invoice number for display
   */
  generateInvoiceNumber(invoice: Invoice): string {
    const year = invoice.createdAt.getFullYear();
    const month = String(invoice.createdAt.getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Get invoice as data for PDF generation
   */
  async getInvoiceDataForPDF(invoiceId: string): Promise<{
    invoice: Invoice;
    invoiceNumber: string;
    subtotal: number;
    taxAmount: number;
    total: number;
  }> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new BillingError(
        BillingErrorCode.INVOICE_NOT_FOUND,
        `Invoice ${invoiceId} not found`
      );
    }

    const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = 0.1; // 10% tax (would be configurable in production)
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return {
      invoice,
      invoiceNumber: this.generateInvoiceNumber(invoice),
      subtotal,
      taxAmount,
      total,
    };
  }
}

/**
 * Create an invoice generator
 */
export function createInvoiceGenerator(stripeSecretKey?: string): InvoiceGenerator {
  return new InvoiceGenerator(stripeSecretKey);
}
