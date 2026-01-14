# @claudeflare/nas

Neural Architecture Search (NAS) system for AI optimization on ClaudeFlare platform.

## Features

### Search Strategies

- **Evolutionary Algorithms**: Genetic algorithms with mutation, crossover, and selection
- **Reinforcement Learning**: RNN controller with policy gradient (REINFORCE)
- **Bayesian Optimization**: Gaussian process-based optimization
- **Random Search**: Baseline random sampling
- **Grid Search**: Systematic grid exploration

### Model Compression

- **Pruning**:
  - Magnitude-based pruning
  - Gradient-based pruning
  - Structured pruning (filter/channel)
  - Taylor expansion pruning
  - Lottery ticket hypothesis

- **Quantization**:
  - Post-training quantization
  - Quantization-aware training
  - Dynamic quantization
  - Mixed precision quantization
  - KL divergence calibration

- **Knowledge Distillation**: Teacher-student training

### Architecture Evaluation

- **Accuracy Metrics**: Top-1, Top-5, precision, recall, F1
- **Efficiency Metrics**: FLOPs, parameters, memory, latency, energy
- **Multi-fidelity Evaluation**: Low-fidelity proxies for fast evaluation
- **Hardware Profiling**: Device-specific performance estimation

### Search Space Definition

- **DSL for Search Spaces**: Fluent API for defining architecture spaces
- **Predefined Spaces**: CNN, ResNet, EfficientNet, Transformer, Mobile
- **Flexible Encoding**: Direct, cell-based, path-based representations
- **Constraints**: Layer count, parameters, FLOPs, latency, memory

### Architecture Ranking

- **Multi-objective Ranking**: Weighted sum, Pareto, TOPSIS, AHP
- **Diversity Maintenance**: Novelty, distance, entropy-based
- **Pareto Front Calculation**: Non-dominated sorting
- **Hypervolume Metrics**: Quality assessment

## Installation

```bash
npm install @claudeflare/nas
```

## Quick Start

### Basic Usage

```typescript
import { quickStartNAS } from '@claudeflare/nas';

// Run evolutionary NAS with default settings
const result = await quickStartNAS();

console.log('Best architecture:', result.bestArchitecture);
console.log('Pareto front size:', result.paretoFront.length);
console.log('Total evaluated:', result.statistics.totalEvaluated);
```

### Custom Search Space

```typescript
import { createSearchSpace, ArchitectureDSL } from '@claudeflare/nas';

// Define custom search space
const searchSpace = createSearchSpace('my-cnn', (dsl) => {
  return dsl
    .setType('cell-based')
    .allOperations()
    .filters([32, 64, 128, 256])
    .kernelSize([3, 5, 7])
    .strides([1, 2])
    .dropoutRate([0.0, 0.5])
    .maxLayers(15)
    .minLayers(5)
    .maxParameters(5000000);
});

// Run search
const result = await quickStartNAS(searchSpace, 100);
```

### Evolutionary Search

```typescript
import { createEvolutionaryConfig, runNAS } from '@claudeflare/nas';

const config = createEvolutionaryConfig({
  maxIterations: 100,
  populationSize: 50,
  mutation: {
    rate: 0.1,
    operators: ['layer-add', 'layer-remove', 'layer-modify'],
    strength: 2,
  },
  crossover: {
    rate: 0.8,
    type: 'single-point',
  },
  selection: {
    method: 'tournament',
    tournamentSize: 3,
  },
});

const result = await runNAS({ strategy: config });
```

### Reinforcement Learning Search

```typescript
import { createRLConfig, runNAS } from '@claudeflare/nas';

const config = createRLConfig({
  controller: {
    type: 'lstm',
    hiddenSize: [128, 64],
    attention: true,
  },
  reward: {
    type: 'multi-objective',
    metrics: ['accuracy', 'flops', 'latency'],
    weights: [1.0, 0.5, 0.3],
  },
  training: {
    epochs: 100,
    episodeLength: 10,
    discount: 0.99,
  },
});

const result = await runNAS({ strategy: config });
```

### Bayesian Optimization

```typescript
import { createBayesianConfig, runNAS } from '@claudeflare/nas';

const config = createBayesianConfig({
  kernel: {
    type: 'matern',
    lengthScale: 1.0,
    nu: 1.5,
  },
  acquisition: {
    function: 'ei',
    samples: 1000,
  },
  exploration: {
    initialSamples: 20,
    randomFraction: 0.1,
  },
});

const result = await runNAS({ strategy: config });
```

### Model Compression

```typescript
import {
  createPruningConfig,
  PrunerFactory,
  createQuantizationConfig,
  QuantizerFactory
} from '@claudeflare/nas';

// Prune architecture
const pruningConfig = createPruningConfig({
  method: 'magnitude',
  schedule: {
    type: 'gradual',
    targetSparsity: 0.5,
    steps: 10,
  },
  fineTuning: {
    enabled: true,
    epochs: 10,
  },
});

const pruner = PrunerFactory.create('magnitude', pruningConfig, architecture);
const pruningResult = await pruner.prune();

console.log('Sparsity:', pruningResult.sparsity);
console.log('Compression ratio:', pruningResult.compressionRatio);
console.log('Speedup:', pruningResult.speedup);

// Quantize architecture
const quantizationConfig = createQuantizationConfig({
  mode: 'post-training',
  precision: {
    weights: 8,
    activations: 8,
  },
  method: 'kl-divergence',
});

const quantizer = QuantizerFactory.create('post-training', quantizationConfig, architecture);
const quantizationResult = await quantizer.quantize();

console.log('Bit width:', quantizationResult.precision.weights);
console.log('Compression ratio:', quantizationResult.compressionRatio);
```

### Architecture Ranking

```typescript
import { ArchitectureRanker, createRankingConfig } from '@claudeflare/nas';

const config = createRankingConfig({
  method: 'pareto',
  criteria: [
    { name: 'accuracy', weight: 1.0, direction: 'maximize' },
    { name: 'flops', weight: 0.5, direction: 'minimize' },
    { name: 'latency', weight: 0.3, direction: 'minimize' },
  ],
  diversity: {
    enabled: true,
    method: 'distance',
    weight: 0.1,
  },
});

const ranker = new ArchitectureRanker(config);
const result = await ranker.rank(architectures);

console.log('Top architecture:', result.architectures[0]);
console.log('Pareto front:', result.paretoFront);
```

## Architecture DSL

### Predefined Search Spaces

```typescript
import { ArchitectureDSL } from '@claudeflare/nas';

// CNN search space
const cnnSpace = ArchitectureDSL.cnn('my-cnn');

// ResNet-style search space
const resnetSpace = ArchitectureDSL.resnet('my-resnet');

// EfficientNet-style search space
const efficientnetSpace = ArchitectureDSL.efficientnet('my-efficientnet');

// Transformer search space
const transformerSpace = ArchitectureDSL.transformer('my-transformer');

// Mobile search space (for edge devices)
const mobileSpace = ArchitectureDSL.mobile('my-mobile');
```

### Custom DSL

```typescript
import { ArchitectureDSL } from '@claudeflare/nas';

const dsl = new ArchitectureDSL('custom-arch')
  .setType('cell-based')
  .convOperations()
  .poolOperations()
  .filters([16, 32, 64, 128, 256])
  .kernelSize([3, 5, 7])
  .strides([1, 2])
  .dropoutRate([0.0, 0.2, 0.5])
  .constraints({
    maxLayers: 20,
    minLayers: 5,
    maxParameters: 10000000,
    maxFLOPs: 500000000,
  });

const searchSpace = dsl.build();
```

## Architecture Evaluation

```typescript
import { ArchitectureEvaluator, createEvaluationConfig } from '@claudeflare/nas';

const config = createEvaluationConfig({
  metrics: [
    { name: 'accuracy', type: 'accuracy', priority: 1.0 },
    { name: 'flops', type: 'flops', priority: 0.5 },
    { name: 'latency', type: 'latency', priority: 0.3 },
  ],
  fidelity: {
    type: 'multi-fidelity',
    epochs: 50,
    subsetRatio: 0.5,
  },
  hardware: {
    device: 'gpu',
    cores: 8,
    frequency: 2.5e9,
    memory: 16,
  },
});

const evaluator = new ArchitectureEvaluator(config);
const evaluated = await evaluator.evaluate(architecture);
```

## API Reference

### Main Classes

- `NASSearchEngine`: Main orchestrator for NAS
- `EvolutionarySearch`: Evolutionary algorithm search
- `ReinforcementLearningSearch`: RL-based search
- `BayesianOptimizationSearch`: Bayesian optimization search
- `ArchitectureDSL`: Domain-specific language for search spaces
- `ArchitectureEvaluator`: Architecture evaluation framework
- `PrunerFactory`: Factory for creating pruning algorithms
- `QuantizerFactory`: Factory for creating quantization algorithms
- `ArchitectureRanker`: Multi-objective ranking system

### Configuration Types

- `NASConfig`: Main configuration for NAS
- `EvolutionaryConfig`: Configuration for evolutionary search
- `RLConfig`: Configuration for RL-based search
- `BayesianConfig`: Configuration for Bayesian optimization
- `PruningConfig`: Configuration for pruning
- `QuantizationConfig`: Configuration for quantization
- `RankingConfig`: Configuration for ranking

## Performance

### Benchmarks

- **Evolutionary**: 50-100 architectures/iteration
- **RL**: 10-20 architectures/iteration
- **Bayesian**: 5-10 architectures/iteration
- **Evaluation**: 0.1-10 seconds/architecture (depends on fidelity)

### Optimization Targets

- **Accuracy**: 70-95% (dataset dependent)
- **FLOPs**: 10M - 10B
- **Parameters**: 100K - 100M
- **Latency**: 1-100ms
- **Memory**: 1-1000MB

## Use Cases

1. **AutoML**: Automated model architecture design
2. **Model Compression**: Optimize existing models
3. **Edge Deployment**: Find architectures for resource-constrained devices
4. **Research**: Explore novel architecture combinations
5. **Production**: Optimize for specific hardware constraints

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE for details.
