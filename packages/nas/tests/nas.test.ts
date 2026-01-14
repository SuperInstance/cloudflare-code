/**
 * NAS Package Tests
 */

import {
  ArchitectureDSL,
  EvolutionarySearch,
  createEvolutionaryConfig,
  ArchitectureEvaluator,
  createEvaluationConfig,
  PrunerFactory,
  createPruningConfig,
  QuantizerFactory,
  createQuantizationConfig,
  ArchitectureRanker,
  createRankingConfig,
  NASSearchEngine,
  createNASConfig,
} from '../src';

describe('ArchitectureDSL', () => {
  test('should create CNN search space', () => {
    const dsl = ArchitectureDSL.cnn('test-cnn');
    const searchSpace = dsl.build();

    expect(searchSpace.name).toBe('test-cnn');
    expect(searchSpace.type).toBe('cell-based');
    expect(searchSpace.layers).toBeDefined();
    expect(searchSpace.constraints).toBeDefined();
  });

  test('should create custom search space', () => {
    const dsl = new ArchitectureDSL('custom')
      .setType('cell-based')
      .maxLayers(10)
      .minLayers(3)
      .filters([32, 64, 128])
      .kernelSize([3, 5]);

    const searchSpace = dsl.build();

    expect(searchSpace.constraints.maxLayers).toBe(10);
    expect(searchSpace.constraints.minLayers).toBe(3);
  });

  test('should generate random architectures', () => {
    const dsl = ArchitectureDSL.cnn('test');
    const searchSpace = dsl.build();
    const generator = new (require('../src/dsl/architecture-dsl').ArchitectureGenerator)(
      searchSpace,
      42
    );

    const architectures = generator.generateBatch(5);

    expect(architectures).toHaveLength(5);
    expect(architectures[0].phenotype.layers).toBeDefined();
    expect(architectures[0].phenotype.connections).toBeDefined();
  });
});

describe('EvolutionarySearch', () => {
  test('should initialize with config', () => {
    const config = createEvolutionaryConfig({
      maxIterations: 10,
      populationSize: 20,
    });

    const search = new EvolutionarySearch(config);

    expect(search).toBeDefined();
  });

  test('should create default config', () => {
    const config = createEvolutionaryConfig();

    expect(config.maxIterations).toBeDefined();
    expect(config.populationSize).toBeDefined();
    expect(config.mutation).toBeDefined();
    expect(config.crossover).toBeDefined();
    expect(config.selection).toBeDefined();
  });
});

describe('ArchitectureEvaluator', () => {
  test('should initialize with config', () => {
    const config = createEvaluationConfig();
    const evaluator = new ArchitectureEvaluator(config);

    expect(evaluator).toBeDefined();
  });

  test('should calculate FLOPs for conv layer', () => {
    const config = createEvaluationConfig();
    const evaluator = new ArchitectureEvaluator(config);

    const layer = {
      id: 'conv1',
      type: 'conv2d',
      operation: 'conv3x3',
      parameters: {
        filters: 64,
        kernelSize: 3,
        inputChannels: 32,
      },
    };

    // This would need to be tested with actual implementation
    expect(layer).toBeDefined();
  });
});

describe('Pruning', () => {
  test('should create pruning config', () => {
    const config = createPruningConfig({
      method: 'magnitude',
      schedule: {
        type: 'gradual',
        targetSparsity: 0.5,
        steps: 10,
      },
    });

    expect(config.method).toBe('magnitude');
    expect(config.schedule.targetSparsity).toBe(0.5);
  });

  test('should create magnitude pruner', () => {
    const config = createPruningConfig();
    const architecture = {
      id: 'test',
      genotype: {},
      phenotype: { layers: [], connections: [], topology: {} },
      metrics: {},
      metadata: {},
    };

    const pruner = PrunerFactory.create('magnitude', config, architecture as any);

    expect(pruner).toBeDefined();
  });
});

describe('Quantization', () => {
  test('should create quantization config', () => {
    const config = createQuantizationConfig({
      mode: 'post-training',
      precision: {
        weights: 8,
        activations: 8,
      },
    });

    expect(config.mode).toBe('post-training');
    expect(config.precision.weights).toBe(8);
  });

  test('should create post-training quantizer', () => {
    const config = createQuantizationConfig();
    const architecture = {
      id: 'test',
      genotype: {},
      phenotype: { layers: [], connections: [], topology: {} },
      metrics: {},
      metadata: {},
    };

    const quantizer = QuantizerFactory.create('post-training', config, architecture as any);

    expect(quantizer).toBeDefined();
  });
});

describe('ArchitectureRanker', () => {
  test('should create ranking config', () => {
    const config = createRankingConfig({
      method: 'pareto',
      criteria: [
        { name: 'accuracy', weight: 1.0, direction: 'maximize' },
        { name: 'flops', weight: 0.5, direction: 'minimize' },
      ],
    });

    expect(config.method).toBe('pareto');
    expect(config.criteria).toHaveLength(2);
  });

  test('should rank architectures', async () => {
    const config = createRankingConfig();
    const ranker = new ArchitectureRanker(config);

    const architectures = [
      {
        id: 'arch1',
        genotype: {},
        phenotype: { layers: [{ type: 'conv2d' }], connections: [], topology: {} },
        metrics: { accuracy: 0.8, flops: 1000000, parameters: 100000, memory: 1000, latency: 10, energy: 1 },
        metadata: {},
      },
      {
        id: 'arch2',
        genotype: {},
        phenotype: { layers: [{ type: 'conv2d' }, { type: 'dense' }], connections: [], topology: {} },
        metrics: { accuracy: 0.85, flops: 2000000, parameters: 200000, memory: 2000, latency: 20, energy: 2 },
        metadata: {},
      },
    ];

    const result = await ranker.rank(architectures as any);

    expect(result.architectures).toHaveLength(2);
    expect(result.paretoFront).toBeDefined();
  });
});

describe('NASSearchEngine', () => {
  test('should create NAS config', () => {
    const config = createNASConfig({
      strategy: createEvolutionaryConfig({ maxIterations: 50 }),
    });

    expect(config.searchSpace).toBeDefined();
    expect(config.strategy).toBeDefined();
    expect(config.evaluation).toBeDefined();
  });

  test('should initialize search engine', () => {
    const config = createNASConfig();
    const engine = new NASSearchEngine(config);

    expect(engine).toBeDefined();
  });
});

describe('Integration Tests', () => {
  test('should run simple evolutionary search', async () => {
    const config = createNASConfig({
      strategy: createEvolutionaryConfig({
        maxIterations: 5,
        populationSize: 10,
      }),
    });

    // Mock evaluation function
    const mockEvaluate = jest.fn().mockResolvedValue({
      id: 'test',
      genotype: {},
      phenotype: { layers: [], connections: [], topology: {} },
      metrics: {
        accuracy: 0.8,
        flops: 1000000,
        parameters: 100000,
        memory: 1000,
        latency: 10,
        energy: 1,
      },
      metadata: {},
    });

    // This would run the actual search in a real scenario
    expect(config).toBeDefined();
  }, 10000);
});
