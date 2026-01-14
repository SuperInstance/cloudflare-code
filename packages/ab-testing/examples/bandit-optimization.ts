/**
 * Multi-Armed Bandit Example
 *
 * This example demonstrates how to use multi-armed bandit algorithms
 * for adaptive experimentation and reward optimization.
 */

import {
  ExperimentDesigner,
  createBandit,
  type ExperimentConfig
} from '../src/index.js';

async function main() {
  // 1. Create experiment with multiple variants
  const designer = new ExperimentDesigner();

  const experiment: ExperimentConfig = designer.createExperiment({
    id: 'headline-optimization',
    name: 'Headline Optimization',
    description: 'Finding the best headline using bandit algorithms',
    hypothesis: designer.createHypothesis({
      title: 'Different headlines will have different conversion rates',
      description: 'Testing 5 different headline variations',
      expectedOutcome: 'One headline will significantly outperform others',
      rationale: 'Copywriting best practices',
      expectedEffectSize: 0.1
    }),
    variants: [
      designer.createVariant({
        id: 'headline-a',
        name: 'Urgent Headline',
        description: 'Limited time offer - Act now!',
        parameters: { headline: 'Limited Time Offer - Act Now!' }
      }),
      designer.createVariant({
        id: 'headline-b',
        name: 'Benefit Headline',
        description: 'Save 50% on your first order',
        parameters: { headline: 'Save 50% on Your First Order' }
      }),
      designer.createVariant({
        id: 'headline-c',
        name: 'Question Headline',
        description: 'Want to save money?',
        parameters: { headline: 'Want to Save Money?' }
      }),
      designer.createVariant({
        id: 'headline-d',
        name: 'How-To Headline',
        description: 'How to save 50% every time',
        parameters: { headline: 'How to Save 50% Every Time' }
      }),
      designer.createVariant({
        id: 'headline-e',
        name: 'Testimonial Headline',
        description: 'Join 10,000+ satisfied customers',
        parameters: { headline: 'Join 10,000+ Satisfied Customers' }
      })
    ],
    metrics: [
      designer.createMetric({
        id: 'conversion',
        name: 'Conversion Rate',
        description: 'Users who convert after seeing headline',
        type: 'binary',
        direction: 'higher_is_better',
        primary: true
      })
    ]
  });

  // 2. Test different bandit algorithms
  console.log('=== Testing Bandit Algorithms ===\n');

  // Epsilon-Greedy
  console.log('--- Epsilon-Greedy (ε=0.1) ---');
  await testBandit(experiment, 'epsilon_greedy', { epsilon: 0.1 });

  // UCB (Upper Confidence Bound)
  console.log('\n--- Upper Confidence Bound ---');
  await testBandit(experiment, 'ucb', { confidence: 2.0 });

  // Thompson Sampling
  console.log('\n--- Thompson Sampling ---');
  await testBandit(experiment, 'thompson_sampling', { alpha: 1, beta: 1 });

  // 3. Compare algorithms
  console.log('\n=== Algorithm Comparison ===');
  console.log('Epsilon-Greedy: Simple, but explores randomly');
  console.log('UCB: Optimistic exploration, good for stationary rewards');
  console.log('Thompson Sampling: Probabilistic, best for non-stationary rewards');
}

async function testBandit(
  experiment: ExperimentConfig,
  algorithm: string,
  params: any
) {
  const bandit = createBandit(experiment, {
    algorithm: algorithm as any,
    ...params
  });

  // Simulate 1000 rounds of selections and updates
  const totalRounds = 1000;
  const trueConversionRates: Record<string, number> = {
    'headline-a': 0.05,
    'headline-b': 0.08,
    'headline-c': 0.06,
    'headline-d': 0.12, // Best headline
    'headline-e': 0.07
  };

  let totalReward = 0;
  let optimalSelections = 0;

  for (let round = 0; round < totalRounds; round++) {
    // Select arm
    const result = bandit.selectArm();

    // Simulate reward (conversion)
    const trueRate = trueConversionRates[result.variantId];
    const reward = Math.random() < trueRate ? 1 : 0;

    // Update arm
    bandit.updateArm(result.variantId, reward);

    totalReward += reward;

    if (result.variantId === 'headline-d') {
      optimalSelections++;
    }

    // Log progress
    if (round === 0 || (round + 1) % 200 === 0) {
      const state = bandit.getState();
      const bestArm = bandit.getBestArm();

      console.log(`\nRound ${round + 1}:`);
      console.log(`  Total reward: ${totalReward} (${(totalReward / (round + 1) * 100).toFixed(2)}% conversion)`);
      console.log(`  Best arm: ${bestArm?.variantId} (${(bestArm?.averageReward ?? 0 * 100).toFixed(2)}%)`);

      // Show arm stats
      for (const [id, arm] of state.arms.entries()) {
        console.log(`    ${id}: ${arm.pulls} pulls, ${(arm.averageReward * 100).toFixed(2)}% avg`);
      }
    }
  }

  // Final statistics
  const state = bandit.getState();
  const regret = bandit.calculateRegret();

  console.log(`\nFinal Statistics:`);
  console.log(`  Total reward: ${totalReward}`);
  console.log(`  Average reward: ${(totalReward / totalRounds * 100).toFixed(2)}%`);
  console.log(`  Optimal selection rate: ${(optimalSelections / totalRounds * 100).toFixed(2)}%`);
  console.log(`  Regret: ${regret.toFixed(2)}`);
  console.log(`  Total pulls: ${state.totalPulls}`);

  // Show final arm statistics
  console.log(`\nFinal Arm Statistics:`);
  for (const [id, arm] of state.arms.entries()) {
    const trueRate = trueConversionRates[id];
    console.log(`  ${id}:`);
    console.log(`    Pulls: ${arm.pulls}`);
    console.log(`    Average reward: ${(arm.averageReward * 100).toFixed(2)}%`);
    console.log(`    True rate: ${(trueRate * 100).toFixed(2)}%`);
    console.log(`    Error: ${Math.abs(arm.averageReward - trueRate).toFixed(4)}`);
  }
}

// Run example
main().catch(console.error);
