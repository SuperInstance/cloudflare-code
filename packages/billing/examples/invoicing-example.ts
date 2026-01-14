/**
 * Example: Invoice Generation and Payment Processing
 *
 * This example demonstrates how to generate invoices and process payments
 */

import {
  createInvoiceGenerator,
  createPaymentProcessor,
} from '../src/index.js';

// Initialize services
const invoiceGenerator = createInvoiceGenerator();
const paymentProcessor = createPaymentProcessor();

// Generate invoice for subscription
async function generateSubscriptionInvoice(subscriptionId: string) {
  // In a real application, you would fetch the subscription from the database
  const subscription = {
    id: subscriptionId,
    organizationId: 'org_123',
    userId: 'user_456',
    planId: 'plan_pro_monthly',
  };

  const invoice = await invoiceGenerator.generateSubscriptionInvoice(subscription as any);

  console.log('Generated invoice:', invoice.id);
  console.log('Amount due:', invoice.amountDue, invoice.currency);
  console.log('Due date:', invoice.dueDate);

  return invoice;
}

// Add payment method
async function addPaymentMethod(organizationId: string, userId: string) {
  const paymentMethod = await paymentProcessor.addPaymentMethod({
    organizationId,
    userId,
    type: 'card',
    cardDetails: {
      lastFour: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2025,
    },
    isDefault: true,
    metadata: {
      name: 'John Doe',
    },
  });

  console.log('Added payment method:', paymentMethod.id);
  console.log('Card ending in:', paymentMethod.lastFour);

  return paymentMethod;
}

// Process payment for invoice
async function processInvoicePayment(
  invoiceId: string,
  subscriptionId: string,
  paymentMethodId: string
) {
  const payment = await paymentProcessor.createPaymentIntent({
    invoiceId,
    subscriptionId,
    organizationId: 'org_123',
    userId: 'user_456',
    amount: 29, // Pro plan price
    currency: 'USD',
    paymentMethodId,
  });

  console.log('Created payment intent:', payment.id);
  console.log('Status:', payment.status);

  // Confirm payment
  const confirmed = await paymentProcessor.confirmPayment(payment.id);
  console.log('Payment confirmed:', confirmed.status);

  // Mark invoice as paid
  const paidInvoice = await invoiceGenerator.markAsPaid(invoiceId);
  console.log('Invoice paid:', paidInvoice.status);

  return confirmed;
}

// Generate usage-based invoice
async function generateUsageInvoice() {
  const invoice = await invoiceGenerator.generateUsageInvoice({
    organizationId: 'org_123',
    userId: 'user_456',
    subscriptionId: 'sub_789',
    usageItems: [
      {
        metricType: 'requests',
        quantity: 5000,
        unitPrice: 0.0001,
        description: 'API Requests overage',
      },
      {
        metricType: 'tokens',
        quantity: 1000000,
        unitPrice: 0.000001,
        description: 'Token usage overage',
      },
      {
        metricType: 'storage',
        quantity: 50,
        unitPrice: 0.1,
        description: 'Additional storage (GB)',
      },
    ],
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-31'),
  });

  console.log('Usage invoice total:', invoice.amountDue);
  return invoice;
}

// Get invoice summary
async function getInvoiceSummary(organizationId: string) {
  const summary = await invoiceGenerator.getInvoiceSummary(organizationId);

  console.log('Invoice Summary:');
  console.log('  Total due:', summary.totalDue);
  console.log('  Total paid:', summary.totalPaid);
  console.log('  Total overdue:', summary.totalOverdue);
  console.log('  Invoice count:', summary.invoiceCount);

  return summary;
}

// Handle refund
async function processRefund(paymentId: string) {
  const refund = await paymentProcessor.createRefund({
    paymentId,
    amount: 10,
    reason: 'Customer requested refund',
  });

  console.log('Refund processed:', refund.id);
  console.log('Refund amount:', refund.amount);

  return refund;
}

// Complete billing workflow
async function main() {
  const organizationId = 'org_123';
  const userId = 'user_456';
  const subscriptionId = 'sub_789';

  // 1. Add payment method
  const paymentMethod = await addPaymentMethod(organizationId, userId);

  // 2. Generate invoice
  const invoice = await generateSubscriptionInvoice(subscriptionId);

  // 3. Finalize invoice
  const finalized = await invoiceGenerator.finalizeInvoice(invoice.id);
  console.log('Invoice status:', finalized.status);

  // 4. Process payment
  await processInvoicePayment(invoice.id, subscriptionId, paymentMethod.id);

  // 5. Get summary
  await getInvoiceSummary(organizationId);

  // 6. Generate usage-based invoice
  await generateUsageInvoice();

  // 7. Handle refund if needed
  // await processRefund(paymentId);
}

// Uncomment to run
// main().catch(console.error);
