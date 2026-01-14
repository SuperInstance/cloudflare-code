# @claudeflare/multimodal

Multimodal AI capabilities for ClaudeFlare platform - Vision, OCR, and Code-from-Image extraction.

## Features

### Vision Capabilities
- **Image Understanding**: Screenshot analysis, UI mockup understanding
- **Code Extraction**: Extract code from screenshots, whiteboards, PDFs
- **Diagram Analysis**: Parse architecture diagrams, flowcharts
- **Visual Debugging**: Error screenshot analysis, bug reproduction
- **Accessibility**: UI element detection, accessibility analysis

### OCR Capabilities
- **Text Recognition**: Extract text from images using Tesseract OCR
- **Code Recognition**: Specialized OCR for code snippets
- **Handwriting Recognition**: Convert handwritten code to digital
- **Multi-language Support**: Support for multiple programming languages

### Multimodal RAG
- **Image Embeddings**: Vector embeddings for images
- **Cross-Modal Search**: Search text to find images, search images to find text
- **Visual Context**: Understand visual context in code repositories
- **Multi-Modal Indexing**: Index both code and images

## Installation

```bash
npm install @claudeflare/multimodal
```

## Usage

### Image Analysis

```typescript
import { analyzeImage } from '@claudeflare/multimodal/vision';

const result = await analyzeImage({
  image: imageBuffer,
  type: 'screenshot',
  features: ['ui-elements', 'text', 'code']
});
```

### Code Extraction from Images

```typescript
import { extractCodeFromImage } from '@claudeflare/multimodal/vision';

const code = await extractCodeFromImage({
  image: imageBuffer,
  language: 'typescript'
});
```

### OCR Processing

```typescript
import { recognizeText } from '@claudeflare/multimodal/ocr';

const text = await recognizeText({
  image: imageBuffer,
  options: {
    language: 'eng',
    preprocess: true
  }
});
```

### Diagram Analysis

```typescript
import { analyzeDiagram } from '@claudeflare/multimodal/vision';

const diagram = await analyzeDiagram({
  image: imageBuffer,
  type: 'architecture'
});
```

## API Endpoints

- `POST /api/vision/analyze` - Analyze images
- `POST /api/vision/extract-code` - Extract code from images
- `POST /api/ocr/recognize` - OCR text recognition
- `POST /api/vision/diagram` - Analyze diagrams
- `POST /api/multimodal/search` - Cross-modal search

## Architecture

```
src/
├── vision/           # Vision model integrations
│   ├── analyzers.ts  # Image analysis
│   ├── code-extract.ts # Code extraction
│   └── diagram.ts    # Diagram understanding
├── ocr/              # OCR capabilities
│   └── recognizer.ts # OCR engine
├── multimodal/       # Multimodal RAG
│   └── rag.ts        # Cross-modal search
├── api/              # API routes
│   └── routes.ts     # HTTP endpoints
├── utils/            # Utilities
└── types/            # TypeScript types
```

## License

MIT
