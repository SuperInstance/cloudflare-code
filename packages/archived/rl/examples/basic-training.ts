/**
 * Example: Basic DQN Training on Code Completion
 */

import { DQNFactory, ReplayBuffer } from '../src/agents/dqn.js';
import { TrainingFactory } from '../src/training/orchestrator.js';
import { CodeCompletionEnv, CodeSnippet } from '../src/envs/code-generation.js';

async function main() {
  console.log('=== DQN Training Example ===\n');

  // Create vocabulary
  const vocab = [
    'function', 'if', 'else', 'return', 'const', 'let', 'var',
    'for', 'while', 'class', 'import', 'export', 'async', 'await',
    'try', 'catch', 'throw', 'new', 'this', 'super', 'extends',
  ];

  // Create dataset
  const dataset: CodeSnippet[] = [
    {
      prefix: 'function add(',
      target: 'a, b) { return a + b; }',
      metadata: { language: 'javascript', difficulty: 'easy' },
    },
    {
      prefix: 'const result = ',
      target: 'arr.map(x => x * 2);',
      metadata: { language: 'javascript', difficulty: 'medium' },
    },
    {
      prefix: 'class Person ',
      target: '{ constructor(name) { this.name = name; } }',
      metadata: { language: 'javascript', difficulty: 'medium' },
    },
  ];

  // Create environments
  const env = new CodeCompletionEnv(vocab, dataset, {
    maxLength: 512,
    contextWindowSize: 128,
  });

  const evalEnv = new CodeCompletionEnv(vocab, dataset, {
    maxLength: 512,
    contextWindowSize: 128,
  });

  // Create DQN agent
  const config = DQNFactory.getDefaultConfig(vocab.length, vocab.length);
  config.learningRate = 0.001;
  config.batchSize = 32;
  config.bufferSize = 10000;
  config.targetUpdateFrequency = 100;

  const agent = DQNFactory.createDQN(config);

  console.log(`State size: ${config.stateSize}`);
  console.log(`Action size: ${config.actionSize}`);
  console.log(`Vocabulary size: ${vocab.length}\n`);

  // Create replay buffer
  const replayBuffer = new ReplayBuffer(config.bufferSize);

  // Create training orchestrator
  const trainingConfig = TrainingFactory.getDefaultConfig('./checkpoints/dqn');
  trainingConfig.totalTimesteps = 10000;
  trainingConfig.evaluationFrequency = 1000;
  trainingConfig.checkpointFrequency = 5000;
  trainingConfig.logFrequency = 100;

  const orchestrator = TrainingFactory.createOrchestrator(
    trainingConfig,
    agent,
    env,
    evalEnv,
    replayBuffer
  );

  // Train
  console.log('Starting training...\n');
  const metrics = await orchestrator.train();

  // Print final results
  const finalMetrics = metrics[metrics.length - 1];
  console.log('\n=== Training Complete ===');
  console.log(`Final episode reward: ${finalMetrics.episodeReward.toFixed(2)}`);
  console.log(`Average FPS: ${finalMetrics.fps.toFixed(2)}`);

  // Save agent
  await agent.save('./models/dqn_code_completion');
  console.log('\nModel saved!');
}

main().catch(console.error);
