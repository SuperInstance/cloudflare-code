/**
 * Payment processing system with Stripe integration
 */

import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentMethodType,
  Refund,
  Invoice,
  BillingError,
  BillingErrorCode,
} from '../types/index.js';

/**
 * Payment processor for handling payments and refunds
 */
export class PaymentProcessor {
  private payments: Map<string, Payment>;
  private paymentMethods: Map<string, PaymentMethod>;
  private refunds: Map<string, Refund>;
  private stripe: any; // Stripe client

  constructor(stripeSecretKey?: string) {
    this.payments = new Map();
    this.paymentMethods = new Map();
    this.refunds = new Map();
    // In production, initialize Stripe client
    // this.stripe = new Stripe(stripeSecretKey);
  }

  /**
   * Create payment intent for invoice
   */
  async createPaymentIntent(params: {
    invoiceId: string;
    subscriptionId: string;
    organizationId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    metadata?: Record<string, any>;
  }): Promise<Payment> {
    const {
      invoiceId,
      subscriptionId,
      organizationId,
      userId,
      amount,
      currency,
      paymentMethodId,
      metadata,
    } = params;

    // Verify payment method exists
    const paymentMethod = this.paymentMethods.get(paymentMethodId);
    if (!paymentMethod) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        `Payment method ${paymentMethodId} not found`
      );
    }

    // Create payment record
    const payment: Payment = {
      id: this.generateId(),
      invoiceId,
      subscriptionId,
      organizationId,
      userId,
      amount,
      currency,
      status: PaymentStatus.PENDING,
      paymentMethodId,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.payments.set(payment.id, payment);

    // In production, create Stripe payment intent
    // try {
    //   const paymentIntent = await this.stripe.paymentIntents.create({
    //     amount: Math.round(amount * 100), // Convert to cents
    //     currency: currency.toLowerCase(),
    //     customer: paymentMethod.metadata?.stripeCustomerId,
    //     payment_method: paymentMethod.stripePaymentMethodId,
    //     metadata: {
    //       invoiceId,
    //       subscriptionId,
    //       organizationId,
    //       ...metadata,
    //     },
    //   });
    //   payment.stripePaymentIntentId = paymentIntent.id;
    //   payment.status = this.mapStripeStatus(paymentIntent.status);
    // } catch (error) {
    //   payment.status = PaymentStatus.FAILED;
    //   payment.failureCode = error.code;
    //   payment.failureMessage = error.message;
    //   throw error;
    // }

    return payment;
  }

  /**
   * Confirm payment
   */
  async confirmPayment(paymentId: string): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        `Payment ${paymentId} not found`
      );
    }

    // In production, confirm with Stripe
    // const paymentIntent = await this.stripe.paymentIntents.confirm(
    //   payment.stripePaymentIntentId
    // );
    // payment.status = this.mapStripeStatus(paymentIntent.status);

    // For demo, mark as succeeded
    payment.status = PaymentStatus.SUCCEEDED;
    payment.updatedAt = new Date();

    return payment;
  }

  /**
   * Process payment for invoice
   */
  async processInvoicePayment(
    invoiceId: string,
    paymentMethodId: string
  ): Promise<Payment> {
    // Get invoice
    // const invoice = await this.invoiceGenerator.getInvoice(invoiceId);

    // Create and process payment
    const payment = await this.createPaymentIntent({
      invoiceId,
      subscriptionId: '', // Would come from invoice
      organizationId: '',
      userId: '',
      amount: 100, // Would come from invoice
      currency: 'USD',
      paymentMethodId,
    });

    return this.confirmPayment(payment.id);
  }

  /**
   * Add payment method for organization
   */
  async addPaymentMethod(params: {
    organizationId: string;
    userId: string;
    type: PaymentMethodType;
    stripePaymentMethodId?: string;
    cardDetails?: {
      lastFour: string;
      brand: string;
      expiryMonth: number;
      expiryYear: number;
    };
    isDefault?: boolean;
    metadata?: Record<string, any>;
  }): Promise<PaymentMethod> {
    const {
      organizationId,
      userId,
      type,
      stripePaymentMethodId,
      cardDetails,
      isDefault,
      metadata,
    } = params;

    // If setting as default, unset other defaults
    if (isDefault) {
      const existingMethods = await this.getPaymentMethods(organizationId);
      for (const method of existingMethods) {
        method.isDefault = false;
      }
    }

    const paymentMethod: PaymentMethod = {
      id: this.generateId(),
      organizationId,
      userId,
      type,
      isDefault: isDefault || false,
      lastFour: cardDetails?.lastFour,
      brand: cardDetails?.brand,
      expiryMonth: cardDetails?.expiryMonth,
      expiryYear: cardDetails?.expiryYear,
      stripePaymentMethodId,
      metadata: {
        ...metadata,
        stripeCustomerId: metadata?.stripeCustomerId,
      },
      createdAt: new Date(),
    };

    this.paymentMethods.set(paymentMethod.id, paymentMethod);
    return paymentMethod;
  }

  /**
   * Get payment method by ID
   */
  async getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
    return this.paymentMethods.get(id);
  }

  /**
   * Get payment methods for organization
   */
  async getPaymentMethods(organizationId: string): Promise<PaymentMethod[]> {
    const methods = Array.from(this.paymentMethods.values());
    return methods.filter((m) => m.organizationId === organizationId);
  }

  /**
   * Get default payment method
   */
  async getDefaultPaymentMethod(
    organizationId: string
  ): Promise<PaymentMethod | undefined> {
    const methods = await this.getPaymentMethods(organizationId);
    return methods.find((m) => m.isDefault);
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(
    organizationId: string,
    paymentMethodId: string
  ): Promise<PaymentMethod> {
    const methods = await this.getPaymentMethods(organizationId);
    const newDefault = methods.find((m) => m.id === paymentMethodId);

    if (!newDefault) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        `Payment method ${paymentMethodId} not found`
      );
    }

    // Unset other defaults
    for (const method of methods) {
      method.isDefault = false;
    }

    newDefault.isDefault = true;
    return newDefault;
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<boolean> {
    const method = this.paymentMethods.get(paymentMethodId);
    if (!method) return false;

    if (method.isDefault) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        'Cannot remove default payment method'
      );
    }

    this.paymentMethods.delete(paymentMethodId);
    return true;
  }

  /**
   * Get payment by ID
   */
  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  /**
   * Get payments for invoice
   */
  async getInvoicePayments(invoiceId: string): Promise<Payment[]> {
    const payments = Array.from(this.payments.values());
    return payments.filter((p) => p.invoiceId === invoiceId);
  }

  /**
   * Get payments for organization
   */
  async getOrganizationPayments(organizationId: string): Promise<Payment[]> {
    const payments = Array.from(this.payments.values());
    return payments.filter((p) => p.organizationId === organizationId);
  }

  /**
   * Create refund
   */
  async createRefund(params: {
    paymentId: string;
    amount?: number;
    reason: string;
    metadata?: Record<string, any>;
  }): Promise<Refund> {
    const { paymentId, amount, reason, metadata } = params;

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        `Payment ${paymentId} not found`
      );
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BillingError(
        BillingErrorCode.REFUND_FAILED,
        'Can only refund successful payments'
      );
    }

    const refundAmount = amount ?? payment.amount;
    if (refundAmount > payment.amount) {
      throw new BillingError(
        BillingErrorCode.REFUND_FAILED,
        'Refund amount exceeds payment amount'
      );
    }

    // Create refund record
    const refund: Refund = {
      id: this.generateId(),
      paymentId,
      amount: refundAmount,
      reason,
      status: PaymentStatus.SUCCEEDED,
      metadata,
      createdAt: new Date(),
    };

    this.refunds.set(refund.id, refund);

    // Update payment status
    if (refundAmount === payment.amount) {
      payment.status = PaymentStatus.REFUNDED;
    } else {
      payment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }
    payment.updatedAt = new Date();

    // In production, create Stripe refund
    // try {
    //   const stripeRefund = await this.stripe.refunds.create({
    //     payment_intent: payment.stripePaymentIntentId,
    //     amount: Math.round(refundAmount * 100),
    //     reason: this.mapRefundReason(reason),
    //     metadata,
    //   });
    //   refund.stripeRefundId = stripeRefund.id;
    // } catch (error) {
    //   refund.status = PaymentStatus.FAILED;
    //   throw error;
    // }

    return refund;
  }

  /**
   * Get refund by ID
   */
  async getRefund(id: string): Promise<Refund | undefined> {
    return this.refunds.get(id);
  }

  /**
   * Get refunds for payment
   */
  async getPaymentRefunds(paymentId: string): Promise<Refund[]> {
    const refunds = Array.from(this.refunds.values());
    return refunds.filter((r) => r.paymentId === paymentId);
  }

  /**
   * Retry failed payment
   */
  async retryPayment(paymentId: string): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        `Payment ${paymentId} not found`
      );
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_FAILED,
        'Can only retry failed payments'
      );
    }

    // In production, retry with Stripe
    // const paymentIntent = await this.stripe.paymentIntents.confirm(
    //   payment.stripePaymentIntentId
    // );

    // For demo, mark as succeeded
    payment.status = PaymentStatus.SUCCEEDED;
    payment.updatedAt = new Date();

    return payment;
  }

  /**
   * Process dunning for failed payments
   */
  async processDunning(paymentId: string, attempt: number): Promise<{
    shouldRetry: boolean;
    nextRetryDate?: Date;
  }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new BillingError(
        BillingErrorCode.PAYMENT_METHOD_NOT_FOUND,
        `Payment ${paymentId} not found`
      );
    }

    // Define retry schedule (days)
    const retrySchedule = [1, 3, 7, 14];

    if (attempt >= retrySchedule.length) {
      // Max retry attempts reached
      return { shouldRetry: false };
    }

    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + retrySchedule[attempt]);

    return {
      shouldRetry: true,
      nextRetryDate,
    };
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(organizationId: string): Promise<{
    totalPaid: number;
    totalPending: number;
    totalFailed: number;
    paymentCount: number;
    successRate: number;
  }> {
    const payments = await this.getOrganizationPayments(organizationId);

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.SUCCEEDED)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = payments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalFailed = payments
      .filter((p) => p.status === PaymentStatus.FAILED)
      .reduce((sum, p) => sum + p.amount, 0);

    const successCount = payments.filter(
      (p) => p.status === PaymentStatus.SUCCEEDED
    ).length;
    const successRate = payments.length > 0 ? successCount / payments.length : 0;

    return {
      totalPaid,
      totalPending,
      totalFailed,
      paymentCount: payments.length,
      successRate,
    };
  }

  /**
   * Map Stripe payment intent status to our status
   */
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      succeeded: PaymentStatus.SUCCEEDED,
      processing: PaymentStatus.PENDING,
      requires_payment_method: PaymentStatus.FAILED,
      requires_confirmation: PaymentStatus.PENDING,
      requires_action: PaymentStatus.PENDING,
      canceled: PaymentStatus.FAILED,
    };
    return statusMap[stripeStatus] || PaymentStatus.PENDING;
  }

  /**
   * Map refund reason to Stripe reason
   */
  private mapRefundReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      duplicate: 'duplicate',
      fraudulent: 'fraudulent',
      requested_by_customer: 'requested_by_customer',
    };
    return reasonMap[reason] || 'requested_by_customer';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a payment processor
 */
export function createPaymentProcessor(stripeSecretKey?: string): PaymentProcessor {
  return new PaymentProcessor(stripeSecretKey);
}
