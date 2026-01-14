/**
 * Complete NAS Pipeline Example
 * Demonstrates full workflow from search space definition to model deployment
 */

import {
  ArchitectureDSL,
  createNASConfig,
  NASSearchEngine,
  createEvolutionaryConfig,
  createPruningConfig,
  PrunerFactory,
  createQuantizationConfig,
  QuantizerFactory,
  ArchitectureRanker,
  createRankingConfig,
  exportResult,
} from '../src';

// ============================================================================
// Step 1: Define Search Space
// ============================================================================

console.log('=== Step 1: Defining Search Space ===');

// Method 1: Use predefined search space
const mobileSearchSpace = ArchitectureDSL.mobile('edge-device');

// Method 2: Create custom search space
const customSearchSpace = new ArchitectureDSL('custom-cnn')
  .setType('cell-based')
  .allOperations()
  .filters([16, 32, 64, 128])
  .kernelSize([3, 5])
  .strides([1, 2])
  .dropoutRate([0.0, 0.2, 0.4])
  .maxLayers(15)
  .minLayers(5)
  .maxParameters(2000000)  // 2M parameters for mobile
  .maxFLOPs(300000000)     // 300M FLOPs
  .build();

console.log('Search space defined:');
console.log(`  - Name: ${customSearchSpace.name}`);
console.log(`  - Type: ${customSearchSpace.type}`);
console.log(`  - Max layers: ${customSearchSpace.constraints.maxLayers}`);
console.log(`  - Max parameters: ${customSearchSpace.constraints.maxParameters}`);

// ============================================================================
// Step 2: Configure Search Strategy
// ============================================================================

console.log('\n=== Step 2: Configuring Search Strategy ===');

const searchConfig = createEvolutionaryConfig({
  maxIterations: 50,
  populationSize: 30,
  parallelism: 4,

  mutation: {
    rate: 0.15,
    operators: ['layer-add', 'layer-remove', 'layer-modify', 'parameter-mutate'],
    strength: 2,
  },

  crossover: {
    rate: 0.8,
    type: 'uniform',
  },

  selection: {
    method: 'tournament',
    pressure: 2,
    tournamentSize: 3,
    elitism: 2,
  },

  objectives: [
    { name: 'accuracy', metric: 'accuracy', direction: 'maximize', weight: 1.0 },
    { name: 'flops', metric: 'flops', direction: 'minimize', weight: 0.5 },
    { name: 'latency', metric: 'latency', direction: 'minimize', weight: 0.3 },
  ],

  earlyStopping: {
    enabled: true,
    patience: 15,
    minDelta: 0.001,
    metric: 'accuracy',
  },
});

console.log('Evolutionary search configured:');
console.log(`  - Iterations: ${searchConfig.maxIterations}`);
console.log(`  - Population size: ${searchConfig.populationSize}`);
console.log(`  - Mutation rate: ${searchConfig.mutation.rate}`);
console.log(`  - Crossover rate: ${searchConfig.crossover.rate}`);

// ============================================================================
// Step 3: Run Neural Architecture Search
// ============================================================================

console.log('\n=== Step 3: Running Neural Architecture Search ===');

async function runNAS() {
  const nasConfig = createNASConfig({
    searchSpace: customSearchSpace,
    strategy: searchConfig,
    evaluation: {
      metrics: [
        { name: 'accuracy', type: 'accuracy', priority: 1.0 },
        { name: 'flops', type: 'flops', priority: 0.5 },
        { name: 'latency', type: 'latency', priority: 0.3 },
        { name: 'memory', type: 'memory', priority: 0.2 },
      ],
      dataset: {
        name: 'imagenet',
        split: 'train',
        preprocessing: ['normalize', 'resize'],
        augmentation: ['flip', 'rotate'],
      },
      training: {
        epochs: 50,
        batchSize: 32,
        optimizer: { type: 'adam', learningRate: 0.001 },
      },
      validation: {
        method: 'holdout',
        splitRatio: 0.2,
      },
      hardware: {
        device: 'gpu',
        cores: 8,
        frequency: 2.5e9,
        memory: 16,
      },
      fidelity: {
        type: 'multi-fidelity',
        epochs: 30,
        subsetRatio: 0.5,
        proxy: true,
      },
    },
    ranking: createRankingConfig({
      method: 'pareto',
      criteria: [
        { name: 'accuracy', weight: 1.0, direction: 'maximize' },
        { name: 'flops', weight: 0.5, direction: 'minimize' },
        { name: 'latency', weight: 0.3, direction: 'minimize' },
      ],
    }),
    compression: {
      method: 'hybrid',
      target: { metric: 'parameters', ratio: 0.5, tolerance: 0.1 },
      constraints: {
        accuracyDrop: 0.02,
        latencyBudget: 20,
        memoryBudget: 500,
        energyBudget: 1,
      },
      schedule: {
        type: 'gradual',
        phases: [],
      },
    },
    export: {
      format: 'json',
      includeMetrics: true,
      includeHistory: true,
      pretty: true,
    },
  });

  const engine = new NASSearchEngine(nasConfig);

  console.log('Starting NAS search...');
  const result = await engine.search();

  console.log('\nSearch completed!');
  console.log(`  - Best architecture: ${result.bestArchitecture.id}`);
  console.log(`  - Best accuracy: ${(result.bestArchitecture.metrics.accuracy || 0).toFixed(4)}`);
  console.log(`  - Best FLOPs: ${(result.bestArchitecture.metrics.flops / 1e6).toFixed(2)}M`);
  console.log(`  - Pareto front size: ${result.paretoFront.length}`);
  console.log(`  - Total evaluated: ${result.statistics.totalEvaluated}`);
  console.log(`  - Duration: ${(result.duration / 1000).toFixed(2)}s`);

  return result;
}

// ============================================================================
// Step 4: Apply Model Compression
// ============================================================================

console.log('\n=== Step 4: Applying Model Compression ===');

async function compressModel(architecture: any) {
  // Step 4a: Apply Pruning
  console.log('\n4a. Applying Pruning...');

  const pruningConfig = createPruningConfig({
    method: 'magnitude',
    granularity: 'filter',
    schedule: {
      type: 'gradual',
      initialSparsity: 0.0,
      targetSparsity: 0.5,
      frequency: 1,
      steps: 10,
    },
    fineTuning: {
      enabled: true,
      epochs: 15,
      learningRate: 0.0001,
      schedule: 'cosine',
    },
  });

  const pruner = PrunerFactory.create('magnitude', pruningConfig, architecture);
  const pruningResult = await pruner.prune();

  console.log('Pruning completed:');
  console.log(`  - Sparsity: ${(pruningResult.sparsity * 100).toFixed(1)}%`);
  console.log(`  - Compression ratio: ${pruningResult.compressionRatio.toFixed(2)}x`);
  console.log(`  - Speedup: ${pruningResult.speedup.toFixed(2)}x`);

  // Step 4b: Apply Quantization
  console.log('\n4b. Applying Quantization...');

  const quantizationConfig = createQuantizationConfig({
    mode: 'post-training',
    precision: {
      weights: 8,
      activations: 8,
      mixed: false,
    },
    method: 'kl-divergence',
    calibration: {
      dataset: 'imagenet',
      samples: 100,
      batchSize: 32,
      method: 'min-max',
    },
  });

  const quantizer = QuantizerFactory.create(
    'post-training',
    quantizationConfig,
    pruningResult.prunedArchitecture
  );
  const quantizationResult = await quantizer.quantize();

  console.log('Quantization completed:');
  console.log(`  - Weight precision: ${quantizationResult.precision.weights}-bit`);
  console.log(`  - Activation precision: ${quantizationResult.precision.activations}-bit`);
  console.log(`  - Compression ratio: ${quantizationResult.compressionRatio.toFixed(2)}x`);
  console.log(`  - Speedup: ${quantizationResult.speedup.toFixed(2)}x`);

  return {
    pruned: pruningResult,
    quantized: quantizationResult,
    finalArchitecture: quantizationResult.quantizedArchitecture,
  };
}

// ============================================================================
// Step 5: Rank and Select Best Architecture
// ============================================================================

console.log('\n=== Step 5: Ranking Architectures ===');

async function rankArchitectures(architectures: any[]) {
  const config = createRankingConfig({
    method: 'pareto',
    criteria: [
      { name: 'accuracy', weight: 1.0, direction: 'maximize' },
      { name: 'flops', weight: 0.5, direction: 'minimize' },
      { name: 'latency', weight: 0.3, direction: 'minimize' },
      { name: 'memory', weight: 0.2, direction: 'minimize' },
    ],
    aggregation: 'weighted-sum',
    normalization: 'min-max',
    diversity: {
      enabled: true,
      method: 'distance',
      weight: 0.1,
      threshold: 5,
    },
  });

  const ranker = new ArchitectureRanker(config);
  const result = await ranker.rank(architectures);

  console.log('Ranking completed:');
  console.log(`  - Total architectures: ${result.architectures.length}`);
  console.log(`  - Pareto front size: ${result.paretoFront.length}`);
  console.log(`  - Top 3 architectures:`);

  for (let i = 0; i < Math.min(3, result.architectures.length); i++) {
    const arch = result.architectures[i];
    console.log(`    ${i + 1}. ${arch.id}`);
    console.log(`       - Accuracy: ${((arch.metrics as any).accuracy || 0).toFixed(4)}`);
    console.log(`       - FLOPs: ${((arch.metrics as any).flops / 1e6).toFixed(2)}M`);
    console.log(`       - Score: ${arch.score.toFixed(4)}`);
  }

  return result;
}

// ============================================================================
// Step 6: Export and Deploy
// ============================================================================

console.log('\n=== Step 6: Exporting Results ===');

function exportResults(result: any) {
  // Export to JSON
  const jsonExport = exportResult(result, 'json');

  console.log('\nExport completed:');
  console.log(`  - Format: JSON`);
  console.log(`  - Size: ${jsonExport.length} characters`);

  // In practice, would save to file
  // fs.writeFileSync('nas-results.json', jsonExport);

  return jsonExport;
}

// ============================================================================
// Complete Pipeline
// ============================================================================

async function runCompletePipeline() {
  try {
    // Run search
    const searchResult = await runNAS();

    // Apply compression
    const compressionResult = await compressModel(searchResult.bestArchitecture);

    // Rank architectures
    const rankingResult = await rankArchitectures(searchResult.history);

    // Export results
    const exportData = exportResults({
      search: searchResult,
      compression: compressionResult,
      ranking: rankingResult,
    });

    console.log('\n=== Pipeline Completed Successfully ===');
    console.log('\nSummary:');
    console.log(`  - Best architecture ID: ${searchResult.bestArchitecture.id}`);
    console.log(`  - Accuracy: ${((searchResult.bestArchitecture.metrics as any).accuracy || 0).toFixed(4)}`);
    console.log(`  - Final sparsity: ${(compressionResult.pruned.sparsity * 100).toFixed(1)}%`);
    console.log(`  - Final precision: ${compressionResult.quantized.precision.weights}-bit`);
    console.log(`  - Total compression: ${(compressionResult.pruned.compressionRatio * compressionResult.quantized.compressionRatio).toFixed(2)}x`);

    return {
      searchResult,
      compressionResult,
      rankingResult,
      exportData,
    };
  } catch (error) {
    console.error('Pipeline failed:', error);
    throw error;
  }
}

// ============================================================================
// Example Usage
// ============================================================================

// Run the complete pipeline
if (require.main === module) {
  console.log('=== Starting Complete NAS Pipeline ===\n');

  runCompletePipeline()
    .then(() => {
      console.log('\n=== Pipeline Finished ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n=== Pipeline Failed ===');
      console.error(error);
      process.exit(1);
    });
}

// ============================================================================
// Individual Examples
// ============================================================================

export {
  runNAS,
  compressModel,
  rankArchitectures,
  exportResults,
  runCompletePipeline,
};
