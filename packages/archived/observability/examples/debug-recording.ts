/**
 * Debug recording example
 */

import { DebugRecorder, StepAction } from '@claudeflare/observability';

async function main() {
  const recorder = new DebugRecorder({
    maxSessionDuration: 60000, // 1 minute
    maxFramesPerSession: 1000,
    autoRecordOnError: true,
    captureVariables: true,
    captureCallStack: true,
  });

  console.log('Starting debug session...');

  // Start a session
  const sessionId = recorder.startSession('debugging-user-service');

  try {
    // Simulate processing with recording
    await processUserRequest(recorder);

  } catch (error) {
    console.error('Error during processing:', error);
  } finally {
    // Stop the session
    recorder.stopSession(sessionId);
  }

  // Get the recording
  const recording = recorder.getRecording(sessionId);
  if (recording) {
    console.log(`\nRecording captured ${recording.frames.length} frames`);
    console.log(`Duration: ${recording.metadata.recordingDuration}ms`);

    // Export the recording
    const exported = recorder.exportRecording(sessionId);
    console.log(`Exported recording (${exported?.length} bytes)`);
  }

  // Get statistics
  const stats = recorder.getStatistics();
  console.log('\nRecorder Statistics:', stats);
}

async function processUserRequest(recorder: DebugRecorder): Promise<void> {
  // Record initial frame
  recorder.recordFrame(
    StepAction.STEP_OVER,
    'user-service.ts',
    10,
    { userId: 'user-123', action: 'get-profile' }
  );

  // Simulate user lookup
  await simulateUserLookup(recorder);

  // Record after lookup
  recorder.recordFrame(
    StepAction.STEP_OVER,
    'user-service.ts',
    15,
    { userFound: true, username: 'johndoe' }
  );

  // Simulate permission check
  await simulatePermissionCheck(recorder);

  // Record after permission check
  recorder.recordFrame(
    StepAction.STEP_OVER,
    'user-service.ts',
    20,
    { hasPermission: true, resource: 'profile' }
  );
}

async function simulateUserLookup(recorder: DebugRecorder): Promise<void> {
  recorder.recordFrame(
    StepAction.STEP_IN,
    'database.ts',
    50,
    { query: 'SELECT * FROM users WHERE id = $1', params: ['user-123'] }
  );

  await new Promise((resolve) => setTimeout(resolve, 50));

  recorder.recordFrame(
    StepAction.STEP_OUT,
    'database.ts',
    55,
    { result: { id: 'user-123', username: 'johndoe' } }
  );
}

async function simulatePermissionCheck(recorder: DebugRecorder): Promise<void> {
  recorder.recordFrame(
    StepAction.STEP_IN,
    'auth-service.ts',
    100,
    { userId: 'user-123', resource: 'profile', action: 'read' }
  );

  await new Promise((resolve) => setTimeout(resolve, 25));

  recorder.recordFrame(
    StepAction.STEP_OUT,
    'auth-service.ts',
    105,
    { allowed: true }
  );
}

main().catch(console.error);
