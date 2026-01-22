/**
 * Cohort Analysis Example
 *
 * This example demonstrates how to analyze experiment performance
 * across different user segments and cohorts.
 */

import {
  ExperimentDesigner,
  CohortAnalyzer,
  type UserAttributes,
  type Assignment,
  type Event
} from '../src/index.js';

async function main() {
  // 1. Create sample experiment
  const designer = new ExperimentDesigner();
  const analyzer = new CohortAnalyzer();

  const experiment = designer.createExperiment({
    id: 'pricing-test',
    name: 'Pricing Page Test',
    description: 'Testing different pricing page layouts',
    hypothesis: designer.createHypothesis({
      title: 'Cleaner pricing page increases conversions',
      description: 'Removing distractions should improve focus',
      expectedOutcome: 'Higher conversion rate',
      rationale: 'Cognitive load theory',
      expectedEffectSize: 0.08
    }),
    variants: [
      designer.createVariant({
        id: 'control',
        name: 'Current Layout',
        description: 'Current pricing page',
        parameters: { layout: 'current' },
        isControl: true
      }),
      designer.createVariant({
        id: 'treatment',
        name: 'Clean Layout',
        description: 'Simplified pricing page',
        parameters: { layout: 'clean' }
      })
    ],
    metrics: [
      designer.createMetric({
        id: 'conversion',
        name: 'Conversion Rate',
        description: 'Users who purchase',
        type: 'binary',
        direction: 'higher_is_better',
        primary: true
      })
    ]
  });

  // 2. Generate sample user attributes
  const users: UserAttributes[] = [];
  const events = new Map<string, Event[]>();

  for (let i = 0; i < 1000; i++) {
    const isMobile = i % 3 === 0;
    const isNewUser = i % 2 === 0;
    const country = i % 4 === 0 ? 'US' : i % 4 === 1 ? 'UK' : i % 4 === 2 ? 'DE' : 'JP';

    const userId = `user-${i}`;

    users.push({
      userId,
      attributes: {
        device: isMobile ? 'mobile' : 'desktop',
        userType: isNewUser ? 'new' : 'returning',
        country,
        firstSeen: isNewUser ? Date.now() : Date.now() - 30 * 24 * 60 * 60 * 1000
      }
    });

    // Create events
    const userEvents: Event[] = [];
    const converted = Math.random() < 0.1;

    userEvents.push({
      type: 'page_view',
      userId,
      experimentId: 'pricing-test',
      variantId: Math.random() < 0.5 ? 'control' : 'treatment',
      metrics: { views: 1 },
      timestamp: Date.now()
    });

    if (converted) {
      userEvents.push({
        type: 'conversion',
        userId,
        experimentId: 'pricing-test',
        variantId: Math.random() < 0.5 ? 'control' : 'treatment',
        metrics: { conversion: 1, revenue: Math.random() * 100 },
        timestamp: Date.now() + 1000
      });
    }

    events.set(userId, userEvents);
  }

  // 3. Create assignments
  const assignments: Assignment[] = users.map(user => ({
    experimentId: 'pricing-test',
    variantId: Math.random() < 0.5 ? 'control' : 'treatment',
    userId: user.userId,
    assignedAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
  }));

  // 4. Create cohorts
  console.log('=== Creating Cohorts ===\n');

  // Geographic cohorts
  const usUsers = users.filter(u => u.attributes.country === 'US');
  const ukUsers = users.filter(u => u.attributes.country === 'UK');

  const usCohort = analyzer.createCohort(
    'US Users',
    usUsers,
    { include: [{ name: 'US', conditions: [{ field: 'country', operator: 'eq', value: 'US' }] }] }
  );

  const ukCohort = analyzer.createCohort(
    'UK Users',
    ukUsers,
    { include: [{ name: 'UK', conditions: [{ field: 'country', operator: 'eq', value: 'UK' }] }] }
  );

  console.log(`US Cohort: ${usCohort.userIds.size} users`);
  console.log(`UK Cohort: ${ukCohort.userIds.size} users`);

  // Device cohorts
  const mobileUsers = users.filter(u => u.attributes.device === 'mobile');
  const desktopUsers = users.filter(u => u.attributes.device === 'desktop');

  const mobileCohort = analyzer.createCohort(
    'Mobile Users',
    mobileUsers,
    { include: [{ name: 'mobile', conditions: [{ field: 'device', operator: 'eq', value: 'mobile' }] }] }
  );

  const desktopCohort = analyzer.createCohort(
    'Desktop Users',
    desktopUsers,
    { include: [{ name: 'desktop', conditions: [{ field: 'device', operator: 'eq', value: 'desktop' }] }] }
  );

  console.log(`Mobile Cohort: ${mobileCohort.userIds.size} users`);
  console.log(`Desktop Cohort: ${desktopCohort.userIds.size} users`);

  // Behavioral cohorts
  const newUsers = users.filter(u => u.attributes.userType === 'new');
  const returningUsers = users.filter(u => u.attributes.userType === 'returning');

  const newUsersCohort = analyzer.createCohort(
    'New Users',
    newUsers,
    { include: [{ name: 'new', conditions: [{ field: 'userType', operator: 'eq', value: 'new' }] }] }
  );

  const returningUsersCohort = analyzer.createCohort(
    'Returning Users',
    returningUsers,
    { include: [{ name: 'returning', conditions: [{ field: 'userType', operator: 'eq', value: 'returning' }] }] }
  );

  console.log(`New Users Cohort: ${newUsersCohort.userIds.size} users`);
  console.log(`Returning Users Cohort: ${returningUsersCohort.userIds.size} users`);

  // 5. Analyze cohorts
  console.log('\n=== Cohort Analysis ===\n');

  const cohorts = [usCohort, ukCohort, mobileCohort, desktopCohort, newUsersCohort, returningUsersCohort];

  const comparisons = analyzer.compareCohorts(cohorts, assignments, Array.from(events.values()).flat(), experiment);

  console.log('Cohort Performance Comparison:\n');
  for (const comparison of comparisons) {
    console.log(`${comparison.cohortName}:`);
    console.log(`  Sample size: ${comparison.sampleSize}`);
    console.log(`  Lift vs baseline: ${(comparison.comparison.lift * 100).toFixed(2)}%`);
    console.log(`  Significant: ${comparison.comparison.significant ? 'YES' : 'NO'}`);
    console.log();
  }

  // 6. Find homogeneous cohorts
  console.log('=== Finding Homogeneous Cohorts ===\n');

  const homogeneousCohorts = analyzer.findHomogeneousCohorts(users, events, 3);

  console.log(`Found ${homogeneousCohorts.length} homogeneous cohorts based on activity level`);

  for (const cohort of homogeneousCohorts) {
    console.log(`  ${cohort.name}: ${cohort.userIds.size} users`);
  }

  // 7. Detect interactions
  console.log('\n=== Detecting Cohort Interactions ===\n');

  const interactions = analyzer.detectInteractions(homogeneousCohorts, assignments, Array.from(events.values()).flat());

  for (const [cohortPair, strength] of interactions.entries()) {
    console.log(`${cohortPair}: ${strength.toFixed(2)}`);
  }

  // 8. Generate report
  console.log('\n=== Cohort Analysis Report ===\n');

  const report = analyzer.generateCohortReport(comparisons);
  console.log(report);
}

// Run example
main().catch(console.error);
