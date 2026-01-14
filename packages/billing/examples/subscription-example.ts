/**
 * Example: Subscription Management
 *
 * This example demonstrates subscription lifecycle management
 */

import { createSubscriptionManager } from '../src/index.js';
import { PlanType } from '../src/types/index.js';

// Initialize subscription manager
const manager = createSubscriptionManager();

// Create a new subscription with trial
async function createTrialSubscription() {
  const subscription = await manager.createSubscription({
    organizationId: 'org_startup_xyz',
    userId: 'user_john',
    planId: 'plan_pro_monthly',
    trialDays: 14,
    metadata: {
      source: 'website',
      campaign: 'launch_2024',
    },
  });

  console.log('Created trial subscription:', subscription.id);
  console.log('Trial ends:', subscription.trialEnd);
  return subscription;
}

// Upgrade subscription plan
async function upgradeSubscription(subscriptionId: string) {
  const updated = await manager.changePlan({
    subscriptionId,
    newPlanId: 'plan_team_monthly',
    prorate: true,
    effectiveImmediately: true,
    reason: 'Team expanded',
  });

  console.log('Upgraded to team plan');
  return updated;
}

// Cancel subscription
async function cancelSubscription(subscriptionId: string) {
  const canceled = await manager.cancelSubscription(subscriptionId, true);
  console.log('Subscription will cancel at period end:', canceled.currentPeriodEnd);
}

// Extend trial
async function extendTrial(subscriptionId: string) {
  const extended = await manager.extendTrial({
    subscriptionId,
    additionalDays: 7,
    reason: 'Customer requested more time to evaluate',
  });

  console.log('Trial extended to:', extended.trialEnd);
}

// Example workflow
async function main() {
  // 1. Create trial subscription
  const subscription = await createTrialSubscription();

  // 2. After trial, convert to paid
  console.log('Converting to paid subscription...');
  const active = await manager.updateSubscription(subscription.id, {
    status: 'active',
  });

  // 3. Upgrade as team grows
  await upgradeSubscription(active.id);

  // 4. If needed, extend trial
  // await extendTrial(subscription.id);

  // 5. Handle cancellation
  // await cancelSubscription(active.id);

  // Get subscription details
  const current = await manager.getSubscription(active.id);
  console.log('Current subscription:', {
    plan: current?.planId,
    status: current?.status,
    periodEnd: current?.currentPeriodEnd,
  });
}

// Uncomment to run
// main().catch(console.error);
