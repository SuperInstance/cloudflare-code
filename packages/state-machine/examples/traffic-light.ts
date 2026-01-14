/**
 * Traffic Light Controller Example
 * Demonstrates basic state machine with cyclic transitions
 */

import { createStateMachine } from '../src/index.js';

// Define traffic light states
const trafficLightDefinition = {
  initial: 'red',
  states: {
    red: {
      onEntry: () => console.log('🔴 Red light - STOP'),
      transitions: [
        { from: 'red', to: 'yellow', on: 'NEXT' },
      ],
    },
    yellow: {
      onEntry: () => console.log('🟡 Yellow light - CAUTION'),
      transitions: [
        { from: 'yellow', to: 'green', on: 'NEXT' },
      ],
    },
    green: {
      onEntry: () => console.log('🟢 Green light - GO'),
      transitions: [
        { from: 'green', to: 'red', on: 'NEXT' },
      ],
    },
  },
};

// Create the traffic light controller
const trafficLight = createStateMachine(trafficLightDefinition, {
  enableLogging: true,
  enableMetrics: true,
});

// Simulate traffic light cycles
async function runTrafficLight(cycles: number) {
  console.log(`\n🚦 Starting Traffic Light (${cycles} cycles)\n`);

  for (let i = 0; i < cycles; i++) {
    console.log(`\n--- Cycle ${i + 1} ---`);

    await trafficLight.send('NEXT'); // red -> yellow
    await delay(2000);

    await trafficLight.send('NEXT'); // yellow -> green
    await delay(2000);

    await trafficLight.send('NEXT'); // green -> red
    await delay(2000);
  }

  console.log('\n📊 Traffic Light Statistics:');
  const metrics = trafficLight.getTransitionMetrics();
  console.log(`Total transitions: ${metrics.total}`);
  console.log(`Average duration: ${metrics.avgDuration.toFixed(2)}ms`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the traffic light
runTrafficLight(3)
  .then(() => console.log('\n✅ Traffic light simulation complete'))
  .catch(err => console.error('❌ Error:', err));
