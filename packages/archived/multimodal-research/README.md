# @claudeflare/multimodal-research

Multimodal AI Research Framework for ClaudeFlare - A comprehensive toolkit for vision-language models, audio processing, cross-modal embeddings, and fusion strategies.

## Features

### Vision Models
- **Vision Transformer (ViT)** - State-of-the-art image classification and embeddings
- **Swin Transformer** - Hierarchical vision transformer with shifted windows
- **ConvNeXt** - Modern pure convolutional architecture
- **Object Detection** - COCO-style detection models
- **OCR Pipeline** - Text recognition from images with multiple engine support
- **Code Extraction** - Extract and parse code from screenshots
- **Vision-Language Models** - Image captioning and VQA

### Audio Models
- **Whisper-style Speech Recognition** - State-of-the-art transcription
- **Audio Classification** - AudioSet benchmark support
- **Speaker Identification** - VoxCeleb benchmark support
- **Emotion Recognition** - IEMOCAP benchmark support
- **Advanced Feature Extraction** - MFCC, spectral, prosodic, chroma, tonnetz

### Cross-Modal Embeddings
- **CLIP-style Encoder** - Image-text contrastive learning
- **Universal Embedding Space** - Unified space for all modalities
- **Contrastive Learning** - InfoNCE, triplet loss, and more
- **Multi-Task Learning** - Shared representations across tasks
- **Embedding Alignment** - Procrustes, CCA, neural alignment

### Fusion Strategies
- **Early Fusion** - Concatenate raw features
- **Late Fusion** - Combine predictions
- **Hybrid Fusion** - Mix of early and late
- **Cross-Modal Attention** - Attention-based fusion
- **Transformer Fusion** - Multi-layer transformer fusion
- **Gated Fusion** - Learned gating mechanisms

### Benchmarks
- **Vision**: ImageNet, COCO, VQA v2, COCO Captions, Flickr30k
- **Audio**: LibriSpeech, AudioSet, VoxCeleb, IEMOCAP
- **Cross-Modal**: Image-text retrieval, retrieval metrics

### Experiment Tracking
- **Experiment Management** - Track runs, hyperparameters, metrics
- **Hyperparameter Tuning** - Grid search, random search, Bayesian optimization
- **Model Checkpointing** - Save and load model checkpoints
- **Early Stopping** - Automatic stopping based on metrics
- **Logging** - Comprehensive logging and visualization

## Installation

```bash
npm install @claudeflare/multimodal-research
```

## Quick Start

### Vision Transformer

```typescript
import { createMultimodalResearch } from '@claudeflare/multimodal-research';

// Create research instance
const research = createMultimodalResearch();

// Create vision transformer
const vit = research.createVisionTransformer({
  embeddingSize: 768,
  patchSize: 16,
  numLayers: 12,
  numHeads: 12
});

// Initialize model
await vit.initialize();

// Generate image embedding
const image: ImageInput = {
  data: imageData,
  width: 224,
  height: 224,
  format: 'png'
};

const embedding = await vit.embed(image);
console.log('Embedding shape:', embedding.dimensions);
```

### Speech Recognition

```typescript
import { createMultimodalResearch } from '@claudeflare/multimodal-research';

const research = createMultimodalResearch();
const whisper = research.createSpeechRecognitionModel({
  sampleRate: 16000
});

const audio: AudioInput = {
  data: audioData,
  sampleRate: 16000,
  channels: 1
};

const result = await whisper.transcribe(audio);
console.log('Transcription:', result.text);
console.log('Word timestamps:', result.words);
```

### CLIP-style Image-Text Retrieval

```typescript
import { createMultimodalResearch } from '@claudeflare/multimodal-research';

const research = createMultimodalResearch();
const clip = research.createCLIPEncoder({
  embeddingDim: 512,
  temperature: 0.07
});

// Compute similarity
const image: ImageInput = { data: imageData, width: 224, height: 224 };
const text: TextInput = { text: 'A cat sitting on a couch' };

const similarity = await clip.similarity(image, text);
console.log('Similarity:', similarity);

// Retrieve relevant texts
const texts = [
  { text: 'A cat on a couch' },
  { text: 'A dog playing' },
  { text: 'A bird flying' }
];

const retrieved = await clip.retrieveText(image, texts, 3);
console.log('Top matches:', retrieved);
```

### Multimodal Fusion

```typescript
import { createMultimodalResearch, AttentionFusion } from '@claudeflare/multimodal-research';

const research = createMultimodalResearch();
const fusion = research.createFusionModel('attention', {
  dimensions: 512,
  numLayers: 2,
  numHeads: 8
});

// Prepare embeddings from different modalities
const embeddings = new Map([
  ['image', imageEmbedding],
  ['text', textEmbedding],
  ['audio', audioEmbedding]
]);

// Fuse modalities
const result = await fusion.fuse(embeddings);
console.log('Fused output:', result.output);
console.log('Modality weights:', result.modalityWeights);
```

### Experiment Tracking

```typescript
import { ExperimentTracker, HyperparameterTuner } from '@claudeflare/multimodal-research';

// Create experiment
const tracker = new ExperimentTracker();
const experimentId = tracker.createExperiment({
  id: 'vit-imagenet-1k',
  name: 'ViT on ImageNet-1K',
  dataset: 'imagenet-1k',
  model: {
    architecture: 'vit',
    parameters: { patchSize: 16, numLayers: 12 }
  },
  hyperparameters: { learningRate: 0.001, batchSize: 32 },
  metrics: ['accuracy', 'loss'],
  tracking: {
    tensorboard: true,
    checkpoints: true,
    logging: 'verbose'
  }
});

// Start run
const runId = await tracker.startRun(experimentId);
tracker.logParams({ learningRate: 0.001, batchSize: 32 });

// Training loop
for (let epoch = 0; epoch < 10; epoch++) {
  const metrics = await trainOneEpoch();
  tracker.logMetrics(metrics, epoch);

  if (epoch % 5 === 0) {
    await tracker.saveCheckpoint(`checkpoints/model_epoch_${epoch}.pt`);
  }
}

// End run
await tracker.endRun('completed');

// Get best run
const bestRun = tracker.getBestRun(experimentId, 'accuracy', 'max');
console.log('Best accuracy:', bestRun?.metrics.find(m => m.name === 'accuracy')?.values);
```

### Benchmarks

```typescript
import { ImageNetBenchmark, LibrispeechBenchmark } from '@claudeflare/multimodal-research';

// ImageNet benchmark
const imagenet = new ImageNetBenchmark();
const results = await imagenet.benchmark(
  async (image) => await model.classify(image),
  testImages,
  testLabels
);

console.log('Top-1 Accuracy:', results.metrics.accuracy);
console.log('Top-5 Accuracy:', results.metrics.top5_accuracy);

// LibriSpeech benchmark
const librispeech = new LibrispeechBenchmark();
const asrResults = await librispeech.benchmark(
  async (audio) => await model.transcribe(audio),
  testAudio,
  transcripts
);

console.log('WER:', asrResults.metrics.wer);
console.log('CER:', asrResults.metrics.cer);
```

## Architecture

### Vision Module
```
vision/
├── transformer.ts      # Vision Transformer implementation
├── models.ts           # Swin, ConvNeXt, Detection models
├── processor.ts        # Image preprocessing utilities
├── ocr.ts              # OCR pipeline with multiple engines
└── code-extraction.ts  # Code extraction from screenshots
```

### Audio Module
```
audio/
├── models.ts           # Whisper, Classification, Speaker ID, Emotion
├── features.ts         # MFCC, spectral, prosodic features
└── processor.ts        # Audio preprocessing utilities
```

### Embeddings Module
```
embeddings/
├── models.ts           # CLIP, Universal embeddings, Contrastive learning
├── alignment.ts        # Cross-modal alignment techniques
└── evaluator.ts        # Embedding quality metrics
```

### Fusion Module
```
fusion/
└── strategies.ts       # Early, late, hybrid, attention, transformer, gated
```

### Benchmarks Module
```
benchmarks/
├── vision.ts           # ImageNet, COCO, VQA, Captions, Retrieval
└── audio.ts            # LibriSpeech, AudioSet, VoxCeleb, IEMOCAP
```

### Experiments Module
```
experiments/
└── tracker.ts          # Experiment tracking, hyperparameter tuning
```

### Utils Module
```
utils/
├── math.ts             # Mathematical utilities
├── data.ts             # Data processing and loading
├── image.ts            # Image processing utilities
├── audio.ts            # Audio processing utilities
├── files.ts            # File system utilities
├── validation.ts       # Input validation
└── logger.ts           # Logging utilities
```

## Supported Benchmarks

### Vision
- **ImageNet-1K**: Image classification (1000 classes)
- **COCO**: Object detection, image captions
- **VQA v2**: Visual question answering
- **Flickr30K**: Image-text retrieval
- **MS-COCO Captions**: Image captioning

### Audio
- **LibriSpeech**: Speech recognition (WER/CER)
- **AudioSet**: Audio classification (mAP/AUC)
- **VoxCeleb**: Speaker identification (EER)
- **IEMOCAP**: Emotion recognition (accuracy/UAR)

### Cross-Modal
- **Flickr30K**: Image-text retrieval (Recall@K, mAP, MRR)
- **MS-COCO**: Image-text retrieval

## Model Architectures

### Vision
- **Vision Transformer (ViT)**: Patch-based transformer
- **Swin Transformer**: Hierarchical shifted windows
- **ConvNeXt**: Modern convolutional networks
- **DETR-style**: End-to-end object detection

### Audio
- **Whisper**: Speech recognition transformer
- **Wav2Vec 2.0**: Self-supervised audio representations
- **Conformer**: Convolution-augmented transformer

### Fusion
- **Early Fusion**: Feature concatenation
- **Late Fusion**: Prediction averaging
- **Cross-Modal Attention**: Attention-based fusion
- **Transformer Fusion**: Multi-layer transformer
- **Gated Fusion**: Learned gating mechanisms

## Performance

The framework is optimized for:
- **Cloudflare Workers**: Edge deployment
- **Browser**: WebAssembly support via ONNX Runtime
- **Node.js**: Full model support
- **GPU**: CUDA acceleration (when available)

## Contributing

Contributions are welcome! Please see our contributing guidelines.

## License

MIT

## Credits

Built by the ClaudeFlare Team for distributed AI coding on Cloudflare Workers.

## Related Packages

- `@claudeflare/multimodal` - Basic multimodal capabilities
- `@claudeflare/shared` - Shared utilities
- `@claudeflare/db` - Database operations
