/**
 * Image Analysis using Vision Models
 * Supports Anthropic Claude and OpenAI GPT-4V for comprehensive image understanding
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  ImageAnalysisOptions,
  ImageAnalysisResult,
  UIElement,
  AnalysisFeature,
  VisionProvider,
  BoundingBox,
  LayoutInfo,
  ColorInfo,
  AccessibilityInfo,
  ErrorInfo,
  AnalysisMetadata
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  maxTokens: 4096,
  temperature: 0.3,
  detail: 'high' as const,
  defaultProvider: 'anthropic' as VisionProvider
};

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Main entry point for image analysis
 * Analyzes images based on specified features and returns comprehensive results
 */
export async function analyzeImage(
  options: ImageAnalysisOptions
): Promise<ImageAnalysisResult> {
  const startTime = Date.now();
  const provider = options.provider || DEFAULT_CONFIG.defaultProvider;

  // Prepare the analysis prompt based on requested features
  const prompt = buildAnalysisPrompt(options.features || ['ui-elements', 'text']);

  try {
    let result: ImageAnalysisResult;

    switch (provider) {
      case 'anthropic':
      case 'claude':
        result = await analyzeWithAnthropic(options, prompt);
        break;
      case 'openai':
      case 'gpt-4v':
        result = await analyzeWithOpenAI(options, prompt);
        break;
      default:
        throw new Error(`Unsupported vision provider: ${provider}`);
    }

    // Add metadata
    result.metadata = {
      provider,
      model: provider === 'anthropic' ? 'claude-3-opus' : 'gpt-4-vision-preview',
      processingTime: Date.now() - startTime,
      confidence: calculateOverallConfidence(result),
      timestamp: new Date()
    };

    return result;
  } catch (error) {
    throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze screenshot for UI elements and components
 */
export async function analyzeScreenshot(
  image: Buffer | string
): Promise<ImageAnalysisResult> {
  return analyzeImage({
    image,
    type: 'screenshot',
    features: ['ui-elements', 'layout', 'text', 'colors', 'accessibility']
  });
}

/**
 * Analyze error screenshot for debugging
 */
export async function analyzeErrorScreenshot(
  image: Buffer | string,
  context?: string
): Promise<ImageAnalysisResult> {
  const result = await analyzeImage({
    image,
    type: 'error-screenshot',
    features: ['text', 'errors']
  });

  // If context is provided, add it to the analysis
  if (context && result.errors) {
    result.errors = result.errors.map(error => ({
      ...error,
      suggestions: [
        ...error.suggestions || [],
        `Context: ${context}`
      ]
    }));
  }

  return result;
}

/**
 * Analyze UI mockup for component extraction
 */
export async function analyzeUIMockup(
  image: Buffer | string
): Promise<ImageAnalysisResult> {
  return analyzeImage({
    image,
    type: 'ui-mockup',
    features: ['ui-elements', 'layout', 'colors', 'components']
  });
}

/**
 * Analyze accessibility of UI
 */
export async function analyzeAccessibility(
  image: Buffer | string
): Promise<AccessibilityInfo> {
  const result = await analyzeImage({
    image,
    features: ['accessibility']
  });

  return result.accessibility || {
    score: 0,
    issues: [],
    suggestions: ['Could not analyze accessibility']
  };
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Analyze image using Anthropic Claude
 */
async function analyzeWithAnthropic(
  options: ImageAnalysisOptions,
  prompt: string
): Promise<ImageAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  // Convert image to base64 if it's a buffer
  const imageBase64 = typeof options.image === 'string'
    ? options.image
    : options.image.toString('base64');

  const mediaType = options.image instanceof Buffer
    ? getMediaTypeFromBuffer(options.image)
    : 'image/png';

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: options.maxTokens || DEFAULT_CONFIG.maxTokens,
    temperature: options.temperature || DEFAULT_CONFIG.temperature,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ]
  });

  return parseAnalysisResponse(
    message.content[0]?.type === 'text' ? message.content[0].text : '',
    options
  );
}

/**
 * Analyze image using OpenAI GPT-4V
 */
async function analyzeWithOpenAI(
  options: ImageAnalysisOptions,
  prompt: string
): Promise<ImageAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const client = new OpenAI({ apiKey });

  // Convert image to base64 if it's a buffer
  const imageBase64 = typeof options.image === 'string'
    ? options.image
    : options.image.toString('base64');

  const mediaType = options.image instanceof Buffer
    ? getMediaTypeFromBuffer(options.image)
    : 'image/png';

  const response = await client.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${imageBase64}`,
              detail: options.detail || DEFAULT_CONFIG.detail
            }
          }
        ]
      }
    ],
    max_tokens: options.maxTokens || DEFAULT_CONFIG.maxTokens,
    temperature: options.temperature || DEFAULT_CONFIG.temperature
  });

  return parseAnalysisResponse(
    response.choices[0]?.message?.content || '',
    options
  );
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build analysis prompt based on requested features
 */
function buildAnalysisPrompt(features: AnalysisFeature[]): string {
  const basePrompt = `Analyze this image and provide a comprehensive analysis. `;

  const featurePrompts: Record<AnalysisFeature, string> = {
    'ui-elements': 'Identify all UI elements (buttons, inputs, navigation, cards, modals, etc.) with their positions and labels. Estimate bounding boxes as percentages (x, y, width, height where x and y are top-left coordinates).',
    'text': 'Extract all visible text from the image, maintaining structure and hierarchy.',
    'code': 'Identify and extract any code snippets, specifying the programming language.',
    'layout': 'Describe the overall layout structure, including hierarchy, spacing, and responsive design patterns.',
    'colors': 'Identify the primary, secondary, and accent colors used. Provide hex codes if possible.',
    'accessibility': 'Evaluate accessibility issues, including contrast ratios, alt text presence, focus indicators, and ARIA label usage. Score from 0-100 and list specific WCAG violations.',
    'errors': 'Identify any error messages, warnings, or exception text. Extract stack traces if present.',
    'components': 'Break down the UI into reusable components, suggesting component names and props.',
    'structure': 'Analyze the document structure, including semantic HTML elements and information hierarchy.'
  };

  const selectedFeatures = features
    .map(f => featurePrompts[f])
    .filter(Boolean)
    .join('\n\n');

  const outputFormat = `
Provide your response in the following JSON structure:
{
  "description": "Overall description of the image",
  "uiElements": [{"type": "button", "label": "Submit", "position": {"x": 10, "y": 20, "width": 30, "height": 10}, "confidence": 0.95}],
  "text": "Extracted text content",
  "code": [{"code": "function example() {}", "language": "javascript", "confidence": 0.9}],
  "layout": {"structure": "grid", "hierarchy": [...], "responsiveness": "responsive"},
  "colors": {"primary": ["#3B82F6"], "secondary": ["#6B7280"], "accent": ["#10B981"]},
  "accessibility": {"score": 85, "issues": [...], "suggestions": [...]},
  "errors": [{"type": "TypeError", "message": "...", "position": {...}, "suggestions": [...]}]
}`;

  return basePrompt + selectedFeatures + '\n\n' + outputFormat;
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse analysis response from vision model
 */
function parseAnalysisResponse(
  response: string,
  options: ImageAnalysisOptions
): ImageAnalysisResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                     response.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    return {
      description: parsed.description || '',
      uiElements: parsed.uiElements || [],
      text: parsed.text,
      code: parsed.code,
      layout: parsed.layout,
      colors: parsed.colors,
      accessibility: parsed.accessibility,
      errors: parsed.errors,
      metadata: {} as AnalysisMetadata // Will be added by caller
    };
  } catch (error) {
    // Fallback to basic analysis if JSON parsing fails
    return {
      description: response,
      uiElements: [],
      metadata: {} as AnalysisMetadata
    };
  }
}

/**
 * Calculate overall confidence from result
 */
function calculateOverallConfidence(result: ImageAnalysisResult): number {
  const confidences: number[] = [];

  if (result.uiElements && result.uiElements.length > 0) {
    const avgUIConfidence = result.uiElements.reduce((sum, el) => sum + el.confidence, 0) / result.uiElements.length;
    confidences.push(avgUIConfidence);
  }

  if (result.code && result.code.length > 0) {
    const avgCodeConfidence = result.code.reduce((sum, c) => sum + (c as any).confidence, 0) / result.code.length;
    confidences.push(avgCodeConfidence);
  }

  if (result.accessibility) {
    confidences.push(result.accessibility.score / 100);
  }

  return confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0.5;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect media type from buffer
 */
function getMediaTypeFromBuffer(buffer: Buffer): string {
  const signatures: Record<string, string> = {
    'PNG': 'image/png',
    'JFIF': 'image/jpeg',
    'JPEG': 'image/jpeg',
    'GIF': 'image/gif',
    'WEBP': 'image/webp',
    'BM': 'image/bmp'
  };

  for (const [signature, mediaType] of Object.entries(signatures)) {
    if (buffer.indexOf(signature) === 0) {
      return mediaType;
    }
  }

  return 'image/png'; // Default
}

/**
 * Validate image buffer
 */
export function validateImageBuffer(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  // Check for common image signatures
  const validSignatures = ['PNG', 'JFIF', 'JPEG', 'GIF', 'WEBP', 'BM'];
  return validSignatures.some(sig => buffer.indexOf(sig) === 0);
}

/**
 * Extract UI elements from image
 */
export async function extractUIElements(
  image: Buffer | string
): Promise<UIElement[]> {
  const result = await analyzeImage({
    image,
    features: ['ui-elements']
  });

  return result.uiElements || [];
}

/**
 * Extract text from image
 */
export async function extractText(
  image: Buffer | string
): Promise<string> {
  const result = await analyzeImage({
    image,
    features: ['text']
  });

  return result.text || '';
}

/**
 * Extract colors from image
 */
export async function extractColors(
  image: Buffer | string
): Promise<ColorInfo> {
  const result = await analyzeImage({
    image,
    features: ['colors']
  });

  return result.colors || {
    primary: [],
    secondary: [],
    accent: [],
    palette: []
  };
}

/**
 * Extract layout information from image
 */
export async function extractLayout(
  image: Buffer | string
): Promise<LayoutInfo> {
  const result = await analyzeImage({
    image,
    features: ['layout']
  });

  return result.layout || {
    structure: '',
    hierarchy: []
  };
}

/**
 * Extract errors from image
 */
export async function extractErrors(
  image: Buffer | string
): Promise<ErrorInfo[]> {
  const result = await analyzeImage({
    image,
    features: ['errors']
  });

  return result.errors || [];
}
