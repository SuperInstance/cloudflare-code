/**
 * Billing and subscription management
 */

import { Hono } from 'hono';
import { Client } from 'stripe';

export class BillingManager {
  private stripe: Client;

  constructor() {
    this.stripe = new Client(process.env.STRIPE_SECRET_KEY!);
  }

  async createCustomer(tenantId: string, email: string, name: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { tenantId },
    });

    return customer.id;
  }

  async createSubscription(customerId: string, priceId: string): Promise<any> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return subscription;
  }

  async cancelSubscription(subscriptionId: string): Promise<any> {
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    return subscription;
  }

  async updateSubscription(subscriptionId: string, priceId: string): Promise<any> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const itemId = subscription.items.data[0].id;

    const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    return updatedSubscription;
  }

  async createPortalSession(customerId: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.PORTAL_RETURN_URL || `${process.env.BASE_URL}/dashboard`,
    });

    return session.url;
  }

  async getInvoice(invoiceId: string): Promise<any> {
    return await this.stripe.invoices.retrieve(invoiceId);
  }

  async listInvoices(customerId: string): Promise<any[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });

    return invoices.data;
  }

  async createUsageRecord(subscriptionItemId: string, quantity: number, timestamp: number): Promise<any> {
    return await this.stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp,
        action: 'set',
      }
    );
  }
}

export const billingManager = new BillingManager();