/**
 * Basic A/B Testing Example
 *
 * This example demonstrates how to set up and run a simple A/B test
 * comparing two button colors on a website.
 */

import {
  ExperimentDesigner,
  AllocationEngine,
  StatisticalEngine,
  createBandit
} from '../src/index.js';

async function main() {
  // 1. Create experiment designer
  const designer = new ExperimentDesigner({
    defaultAlpha: 0.05,
    defaultPower: 0.8
  });

  // 2. Design experiment
  const experiment = designer.createExperiment({
    id: 'button-color-test',
    name: 'Button Color A/B Test',
    description: 'Testing whether red buttons increase conversions',
    hypothesis: designer.createHypothesis({
      title: 'Red buttons increase click-through rate',
      description: 'We believe red buttons will attract more attention',
      expectedOutcome: 'Higher click-through rate',
      rationale: 'Color psychology research suggests red increases urgency',
      expectedEffectSize: 0.05, // 5% increase
      riskAssessment: 'Low - easily reversible'
    }),
    variants: [
      designer.createVariant({
        id: 'control',
        name: 'Blue Button',
        description: 'Current blue button color',
        parameters: { color: '#0066cc', text: 'Click Me' },
        isControl: true
      }),
      designer.createVariant({
        id: 'treatment',
        name: 'Red Button',
        description: 'New red button color',
        parameters: { color: '#cc0000', text: 'Click Me' }
      })
    ],
    metrics: [
      designer.createMetric({
        id: 'click_through',
        name: 'Click-Through Rate',
        description: 'Percentage of users who click the button',
        type: 'binary',
        direction: 'higher_is_better',
        primary: true
      }),
      designer.createMetric({
        id: 'revenue',
        name: 'Revenue per User',
        description: 'Average revenue generated per user',
        type: 'continuous',
        direction: 'higher_is_better',
        primary: false
      })
    ],
    tags: ['ui', 'button', 'color']
  });

  // 3. Validate experiment design
  const validation = designer.validateExperiment(experiment);
  console.log('Experiment validation:', validation.valid ? 'PASSED' : 'FAILED');

  if (!validation.valid) {
    console.log('Errors:', validation.errors);
    return;
  }

  // 4. Get design summary
  const summary = designer.generateDesignSummary(experiment);
  console.log('\n=== Experiment Design Summary ===');
  console.log('Required sample size:', summary.sampleSizeRequirements.perVariant, 'per variant');
  console.log('Total participants needed:', summary.sampleSizeRequirements.total);
  console.log('Considerations:');
  summary.considerations.forEach(c => console.log(' -', c));

  // 5. Initialize allocation engine
  const allocator = new AllocationEngine({
    cacheTTL: 3600000, // 1 hour
    enableConsistentHashing: true
  });

  // 6. Simulate user assignments
  console.log('\n=== Simulating User Assignments ===');
  const userIds = Array.from({ length: 1000 }, (_, i) => `user-${i}`);

  for (const userId of userIds) {
    const result = await allocator.allocate(userId, experiment);

    if (parseInt(userId.split('-')[1]) % 100 === 0) {
      console.log(`User ${userId} assigned to ${result.variant.name}`);
      console.log(`  Allocation time: ${result.metadata.duration}μs`);
    }
  }

  // 7. Simulate tracking events
  console.log('\n=== Simulating Events ===');

  // Get assignments
  const assignments = allocator.getAssignment('user-0', 'button-color-test');
  console.log('User-0 assignment:', assignments?.variantId);

  // 8. Analyze results (using simulated data)
  const stats = new StatisticalEngine();

  // Simulated results: control has 10% conversion, treatment has 10.5% conversion
  const controlConversions = 100;
  const controlTotal = 1000;
  const treatmentConversions = 105;
  const treatmentTotal = 1000;

  console.log('\n=== Statistical Analysis ===');
  console.log(`Control: ${controlConversions}/${controlTotal} (${(controlConversions/controlTotal*100).toFixed(1)}%)`);
  console.log(`Treatment: ${treatmentConversions}/${treatmentTotal} (${(treatmentConversions/treatmentTotal*100).toFixed(1)}%)`);

  const testResult = stats.zTestProportions(
    controlConversions,
    controlTotal,
    treatmentConversions,
    treatmentTotal,
    0.05
  );

  console.log('\nTest Results:');
  console.log('  P-value:', testResult.pValue.toFixed(4));
  console.log('  Significant:', testResult.significant ? 'YES' : 'NO');
  console.log('  Effect size:', (testResult.effectSize * 100).toFixed(2) + '%');
  console.log('  Confidence interval:', `[${(testResult.confidenceInterval[0]*100).toFixed(2)}%, ${(testResult.confidenceInterval[1]*100).toFixed(2)}%]`);
  console.log('  Power:', (testResult.power * 100).toFixed(1) + '%');
  console.log('  Interpretation:', testResult.interpretation);

  // 9. Bayesian analysis
  const bayesianResult = stats.bayesianAnalysis(
    controlConversions,
    controlTotal,
    treatmentConversions,
    treatmentTotal
  );

  console.log('\nBayesian Analysis:');
  console.log('  Probability treatment is better:', (bayesianResult.probability * 100).toFixed(1) + '%');
  console.log('  Expected loss:', bayesianResult.expectedLoss.toFixed(6));
  console.log('  Credible interval:', `[${(bayesianResult.credibleInterval[0]*100).toFixed(2)}%, ${(bayesianResult.credibleInterval[1]*100).toFixed(2)}%]`);
  console.log('  Recommendation:', bayesianResult.recommendation);

  // 10. Calculate lift
  const lift = stats.calculateLift(
    controlConversions / controlTotal,
    treatmentConversions / treatmentTotal
  );

  console.log('\nLift Analysis:');
  console.log('  Relative lift:', (lift * 100).toFixed(2) + '%');
  console.log('  Absolute lift:', ((treatmentConversions/treatmentTotal) - (controlConversions/controlTotal) * 100).toFixed(2) + '%');
}

// Run example
main().catch(console.error);
