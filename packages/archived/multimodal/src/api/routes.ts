/**
 * API Routes for Multimodal AI Features
 * HTTP endpoints for vision, OCR, and multimodal search
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { analyzeImage, analyzeScreenshot, analyzeErrorScreenshot, analyzeUIMockup, analyzeAccessibility } from '../vision/analyzers';
import { extractCodeFromImage, extractCodeFromWhiteboard, extractCodeFromPDF, extractCodeWithValidation } from '../vision/code-extract';
import { analyzeDiagram, analyzeArchitectureDiagram, analyzeFlowchart, analyzeSequenceDiagram, analyzeERDiagram } from '../vision/diagram';
import { recognizeText, recognizeTextByLines, recognizeCode, validateOCRQuality, exportOCRResult } from '../ocr/recognizer';
import { search, searchByText, searchByImage, hybridSearch, storeDocument, storeDocumentsBatch, getSimilarDocuments } from '../multimodal/rag';

// ============================================================================
// Types and Schemas
// ============================================================================

type Bindings = {
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
  ENV: {
    ANTHROPIC_API_KEY: string;
    OPENAI_API_KEY: string;
  };
};

const app = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// Vision Routes
// ============================================================================

/**
 * POST /api/vision/analyze
 * Analyze image with specified features
 */
app.post('/api/vision/analyze', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const features = (body.features as string)?.split(',') || [];
    const type = body.type as string | undefined;
    const provider = body.provider as string | undefined;

    const result = await analyzeImage({
      image: imageBuffer,
      type: type as any,
      features: features as any[],
      provider: provider as any
    });

    return c.json({
      success: true,
      data: result,
      metadata: {
        processingTime: result.metadata.processingTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/screenshot
 * Analyze screenshot specifically
 */
app.post('/api/vision/screenshot', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeScreenshot(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'SCREENSHOT_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/error
 * Analyze error screenshot for debugging
 */
app.post('/api/vision/error', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const context = body.context as string | undefined;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeErrorScreenshot(imageBuffer, context);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'ERROR_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/ui-mockup
 * Analyze UI mockup
 */
app.post('/api/vision/ui-mockup', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeUIMockup(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'UI_MOCKUP_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/accessibility
 * Analyze accessibility of UI
 */
app.post('/api/vision/accessibility', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeAccessibility(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'ACCESSIBILITY_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// ============================================================================
// Code Extraction Routes
// ============================================================================

/**
 * POST /api/vision/extract-code
 * Extract code from image
 */
app.post('/api/vision/extract-code', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const language = body.language as string | undefined;
    const includeLineNumbers = body.includeLineNumbers === 'true';
    const preserveFormatting = body.preserveFormatting === 'true';
    const ocrEnhancement = body.ocrEnhancement === 'true';
    const syntaxValidation = body.syntaxValidation === 'true';

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    let result;
    if (syntaxValidation) {
      result = await extractCodeWithValidation({
        image: imageBuffer,
        language: language as any,
        includeLineNumbers,
        preserveFormatting,
        ocrEnhancement,
        syntaxValidation
      });
    } else {
      result = await extractCodeFromImage({
        image: imageBuffer,
        language: language as any,
        includeLineNumbers,
        preserveFormatting,
        ocrEnhancement
      });
    }

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'CODE_EXTRACTION_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/whiteboard
 * Extract code from whiteboard photo
 */
app.post('/api/vision/whiteboard', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await extractCodeFromWhiteboard(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'WHITEBOARD_CODE_EXTRACTION_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/pdf
 * Extract code from PDF page image
 */
app.post('/api/vision/pdf', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const language = body.language as string | undefined;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await extractCodeFromPDF(imageBuffer, language as any);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'PDF_CODE_EXTRACTION_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// ============================================================================
// Diagram Routes
// ============================================================================

/**
 * POST /api/vision/diagram
 * Analyze diagram
 */
app.post('/api/vision/diagram', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const type = body.type as string | undefined;
    const extractComponents = body.extractComponents !== 'false';
    const generateCode = body.generateCode === 'true';
    const targetLanguage = body.targetLanguage as string | undefined;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeDiagram({
      image: imageBuffer,
      type: type as any,
      extractComponents,
      generateCode,
      targetLanguage: targetLanguage as any
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'DIAGRAM_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/architecture
 * Analyze architecture diagram
 */
app.post('/api/vision/architecture', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeArchitectureDiagram(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'ARCHITECTURE_DIAGRAM_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/flowchart
 * Analyze flowchart and generate code
 */
app.post('/api/vision/flowchart', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const targetLanguage = body.targetLanguage as string | undefined;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeFlowchart(imageBuffer, targetLanguage as any);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'FLOWCHART_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/sequence-diagram
 * Analyze sequence diagram
 */
app.post('/api/vision/sequence-diagram', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeSequenceDiagram(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'SEQUENCE_DIAGRAM_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/vision/er-diagram
 * Analyze entity-relationship diagram
 */
app.post('/api/vision/er-diagram', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeERDiagram(imageBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'ER_DIAGRAM_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// ============================================================================
// OCR Routes
// ============================================================================

/**
 * POST /api/ocr/recognize
 * Recognize text from image
 */
app.post('/api/ocr/recognize', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const language = body.language as string | undefined;
    const preprocess = body.preprocess !== 'false';
    const preserveLayout = body.preserveLayout === 'true';
    const segmentByLines = body.segmentByLines !== 'false';

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await recognizeText({
      image: imageBuffer,
      language: language as any,
      preprocess,
      preserveLayout,
      segmentByLines
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'OCR_RECOGNITION_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/ocr/lines
 * Recognize text by lines
 */
app.post('/api/ocr/lines', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const language = body.language as string | undefined;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await recognizeTextByLines(imageBuffer, language as any);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'OCR_LINES_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/ocr/code
 * Recognize code from image
 */
app.post('/api/ocr/code', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const language = body.language as string | undefined;

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await recognizeCode(imageBuffer, language as any);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'OCR_CODE_RECOGNITION_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/ocr/validate
 * Validate OCR result quality
 */
app.post('/api/ocr/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { result } = body;

    if (!result) {
      return c.json({ error: 'No OCR result provided' }, 400);
    }

    const validation = validateOCRQuality(result);

    return c.json({ success: true, data: validation });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'OCR_VALIDATION_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/ocr/export
 * Export OCR result in specified format
 */
app.post('/api/ocr/export', async (c) => {
  try {
    const body = await c.req.json();
    const { result, format } = body;

    if (!result) {
      return c.json({ error: 'No OCR result provided' }, 400);
    }

    const exported = exportOCRResult(result, format || 'json');

    return c.json({ success: true, data: exported });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'OCR_EXPORT_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// ============================================================================
// Multimodal RAG Routes
// ============================================================================

/**
 * POST /api/multimodal/search
 * Search across multimodal documents
 */
app.post('/api/multimodal/search', async (c) => {
  try {
    const body = await c.req.json();
    const { query, mediaTypes, limit, threshold, filters } = body;

    if (!query) {
      return c.json({ error: 'No query provided' }, 400);
    }

    const result = await search({
      query,
      mediaTypes,
      limit,
      threshold,
      filters
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'MULTIMODAL_SEARCH_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/multimodal/search/text
 * Search by text query
 */
app.post('/api/multimodal/search/text', async (c) => {
  try {
    const body = await c.req.json();
    const { query, options } = body;

    if (!query) {
      return c.json({ error: 'No query provided' }, 400);
    }

    const result = await searchByText(query, options);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'TEXT_SEARCH_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/multimodal/search/image
 * Search by image query
 */
app.post('/api/multimodal/search/image', async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body.image as File;
    const options = JSON.parse(body.options as string || '{}');

    if (!imageFile) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await searchByImage(imageBuffer, options);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'IMAGE_SEARCH_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/multimodal/search/hybrid
 * Hybrid search with text and image
 */
app.post('/api/multimodal/search/hybrid', async (c) => {
  try {
    const body = await c.req.parseBody();
    const textQuery = body.textQuery as string;
    const imageFile = body.image as File;
    const options = JSON.parse(body.options as string || '{}');

    if (!textQuery && !imageFile) {
      return c.json({ error: 'No query provided' }, 400);
    }

    let imageBuffer: Buffer | undefined;
    if (imageFile) {
      imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    }

    const result = await hybridSearch(textQuery, imageBuffer, options);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'HYBRID_SEARCH_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/multimodal/documents
 * Store a multimodal document
 */
app.post('/api/multimodal/documents', async (c) => {
  try {
    const body = await c.req.json();
    const { id, type, content, metadata } = body;

    if (!type || !content) {
      return c.json({ error: 'Type and content are required' }, 400);
    }

    const result = await storeDocument({
      id,
      type,
      content,
      metadata: metadata || {}
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'DOCUMENT_STORAGE_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * POST /api/multimodal/documents/batch
 * Store multiple documents
 */
app.post('/api/multimodal/documents/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { documents } = body;

    if (!documents || !Array.isArray(documents)) {
      return c.json({ error: 'Documents array is required' }, 400);
    }

    const result = await storeDocumentsBatch(documents);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'BATCH_STORAGE_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

/**
 * GET /api/multimodal/documents/:id/similar
 * Get similar documents
 */
app.get('/api/multimodal/documents/:id/similar', async (c) => {
  try {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '5');

    const result = await getSimilarDocuments(id, limit);

    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'SIMILAR_DOCUMENTS_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'multimodal',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Export
// ============================================================================

export default app;
