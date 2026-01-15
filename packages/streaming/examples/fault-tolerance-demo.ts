import {
  StreamingPlatform,
  FaultToleranceStrategy,
  Event,
  ProcessingConfig
} from '../src/index';

async function faultToleranceDemo() {
  console.log('🛡️ Fault Tolerance Demo');
  console.log('=======================\n');

  const platform = StreamingPlatform;

  const processingConfig: ProcessingConfig = {
    concurrency: 2,
    batchSize: 50,
    maxRetries: 3,
    timeout: 3000,
    backpressure: {
      enabled: true,
      threshold: 100,
      strategy: 'buffer'
    }
  };

  console.log('🔧 Setting up different fault tolerance strategies...');

  const atLeastOnceConfig = FaultToleranceStrategy.atLeastOnce({
    checkpointing: {
      interval: 3000,
      maxSnapshots: 5
    }
  });

  const exactlyOnceConfig = FaultToleranceStrategy.exactlyOnce({
    checkpointing: {
      interval: 2000,
      maxSnapshots: 10
    }
  });

  const faultToleranceManager = platform.createFaultToleranceManager(
    exactlyOnceConfig,
    processingConfig
  );

  faultToleranceManager.onCheckpoint((checkpoint) => {
    console.log(`✅ Checkpoint created: ${checkpoint.id}`);
    console.log(`   Timestamp: ${new Date(checkpoint.timestamp).toISOString()}`);
    console.log(`   Sequence: ${checkpoint.sequence}`);
  });

  faultToleranceManager.onRecovery((error, event, context) => {
    console.log(`⚠️ Recovery attempted for event ${event.id}`);
    console.log(`   Attempt: ${context.retryCount}`);
    console.log(`   Error: ${error.message}`);
  });

  const processor = platform.createProcessor(processingConfig, exactlyOnceConfig);

  let processingCount = 0;
  let failureCount = 0;

  processor.addState('processed', 0, async (key, state, event) => {
    processingCount++;

    if (processingCount % 10 === 0) {
      failureCount++;
      throw new Error(`Simulated failure on event ${event.id}`);
    }

    return state + 1;
  });

  processor.on('error', (error) => {
    console.log(`🔥 Error: ${error.message}`);
  });

  console.log('🚀 Starting processing with simulated failures...');

  const testEvents = Array.from({ length: 50 }, (_, i) => ({
    id: `event-${i}`,
    timestamp: Date.now() + i * 100,
    data: { value: i, sequence: i },
    sequence: i
  }));

  for (const event of testEvents) {
    try {
      await faultToleranceManager.processEvent(event);
      console.log(`✅ Processed event ${event.id} successfully`);
    } catch (error) {
      console.log(`❌ Failed to process event ${event.id}: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📊 Fault Tolerance Metrics:');
  const status = faultToleranceManager.getStatus();

  console.log(`   Strategy: ${status.faultTolerance.recoveryContext.lastCheckpoint?.strategy || 'none'}`);
  console.log(`   Total Events Processed: ${processingCount}`);
  console.log(`   Failures Encountered: ${failureCount}`);
  console.log(`   Recovery Attempts: ${status.faultTolerance.recoveryContext.retryCount}`);
  console.log(`   Checkpoints Created: ${status.checkpoints.history.length}`);
  console.log(`   Idempotency Entries: ${status.idempotency.count}`);

  console.log('\n📋 Checkpoint History:');
  status.checkpoints.history.forEach((checkpoint, index) => {
    console.log(`   ${index + 1}. ${checkpoint.id} - ${new Date(checkpoint.timestamp).toISOString()}`);
  });

  console.log('\n🔄 Demonstrating recovery...');

  const recoveryEvent: Event = {
    id: 'recovery-test',
    timestamp: Date.now(),
    data: { value: 999, sequence: 999 },
    sequence: 999
  };

  try {
    const recoveredState = await faultToleranceManager.processEvent(recoveryEvent);
    console.log('✅ Recovery successful!');
    console.log(`   Recovered state: ${recoveredState}`);
  } catch (error) {
    console.log('❌ Recovery failed:', error.message);
  }

  faultToleranceManager.cleanup();
}

faultToleranceDemo().catch(console.error);