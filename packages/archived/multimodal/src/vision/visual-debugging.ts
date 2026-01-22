/**
 * Visual Debugging Features
 * Analyze error screenshots, visual bug reports, and UI issues
 */

// @ts-nocheck - External AI SDK dependencies
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  VisualDebuggingOptions,
  VisualDebuggingResult,
  VisualIssue,
  ReproductionGuide,
  FixSuggestion,
  DebuggingMetadata
} from '../types';

// ============================================================================
// Main Debugging Functions
// ============================================================================

/**
 * Analyze visual issues from screenshot
 */
export async function debugVisualIssue(
  options: VisualDebuggingOptions
): Promise<VisualDebuggingResult> {
  const startTime = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const imageBase64 = typeof options.image === 'string'
    ? options.image
    : options.image.toString('base64');

  const mediaType = options.image instanceof Buffer
    ? getMediaTypeFromBuffer(options.image)
    : 'image/png';

  const prompt = buildDebuggingPrompt(options);

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 4096,
    temperature: 0.3,
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

  const response = message.content[0]?.type === 'text' ? message.content[0].text : '';

  return parseDebuggingResponse(response, options);
}

/**
 * Analyze error screenshot with stack trace
 */
export async function analyzeErrorWithStack(
  image: Buffer | string,
  stackTrace?: string
): Promise<VisualDebuggingResult> {
  return debugVisualIssue({
    image,
    context: stackTrace,
    reproduceSteps: true,
    suggestFixes: true
  });
}

/**
 * Generate reproduction guide from screenshot
 */
export async function generateReproductionGuide(
  image: Buffer | string,
  context?: string
): Promise<ReproductionGuide> {
  const result = await debugVisualIssue({
    image,
    context,
    reproduceSteps: true,
    suggestFixes: false
  });

  return result.reproduction || {
    steps: ['Unable to generate reproduction steps'],
    prerequisites: [],
    environment: {}
  };
}

/**
 * Suggest fixes for visual issues
 */
export async function suggestFixes(
  image: Buffer | string,
  context?: string
): Promise<FixSuggestion[]> {
  const result = await debugVisualIssue({
    image,
    context,
    reproduceSteps: false,
    suggestFixes: true
  });

  return result.fixes || [];
}

/**
 * Analyze UI accessibility issues
 */
export async function debugAccessibility(
  image: Buffer | string
): Promise<VisualDebuggingResult> {
  return debugVisualIssue({
    image,
    reproduceSteps: false,
    suggestFixes: true
  });
}

/**
 * Analyze layout issues
 */
export async function debugLayout(
  image: Buffer | string,
  expectedDescription?: string
): Promise<VisualDebuggingResult> {
  return debugVisualIssue({
    image,
    context: expectedDescription,
    reproduceSteps: false,
    suggestFixes: true
  });
}

/**
 * Compare two screenshots for differences
 */
export async function compareScreenshots(
  image1: Buffer | string,
  image2: Buffer | string,
  description?: string
): Promise<{
  differences: string[];
  similarities: string[];
  severity: 'low' | 'medium' | 'high';
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const image1Base64 = typeof image1 === 'string' ? image1 : image1.toString('base64');
  const image2Base64 = typeof image2 === 'string' ? image2 : image2.toString('base64');

  const prompt = `Compare these two screenshots and identify differences.

${description ? `Context: ${description}` : ''}

Provide your response in JSON format:
{
  "differences": ["difference 1", "difference 2"],
  "similarities": ["similarity 1", "similarity 2"],
  "severity": "low|medium|high"
}`;

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 2048,
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: image1Base64
            }
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: image2Base64
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

  const response = message.content[0]?.type === 'text' ? message.content[0].text : '';

  try {
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                     response.match(/({[\s\S]*})/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch (error) {
    // Parsing failed
  }

  return {
    differences: [response],
    similarities: [],
    severity: 'medium'
  };
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build debugging prompt
 */
function buildDebuggingPrompt(options: VisualDebuggingOptions): string {
  let prompt = `Analyze this screenshot for visual issues, bugs, or errors. `;

  if (options.context) {
    prompt += `\n\nContext: ${options.context}`;
  }

  prompt += `

Please identify:
1. Any visible errors, exceptions, or error messages
2. UI issues such as misalignments, overlapping elements, or broken layouts
3. Accessibility issues like poor contrast, missing labels, or unclear focus states
4. Any unexpected behavior or visual glitches`;

  if (options.reproduceSteps) {
    prompt += `\n\nProvide steps to reproduce any issues found.`;
  }

  if (options.suggestFixes) {
    prompt += `\n\nSuggest specific fixes for each issue identified.`;
  }

  prompt += `

Provide your response in this JSON format:
{
  "issues": [
    {
      "type": "error|warning|info",
      "severity": "error|warning|info",
      "description": "Detailed description",
      "position": {"x": 10, "y": 20, "width": 100, "height": 50},
      "stackTrace": "stack trace if available",
      "expected": "what was expected",
      "actual": "what was actually observed"
    }
  ],
  "reproduction": {
    "steps": ["step 1", "step 2"],
    "prerequisites": ["prereq 1"],
    "environment": {"browser": "Chrome", "version": "120"}
  },
  "fixes": [
    {
      "issue": "issue description",
      "solution": "fix description",
      "code": "code snippet if applicable",
      "confidence": 0.9,
      "priority": "high|medium|low"
    }
  ]
}`;

  return prompt;
}

/**
 * Parse debugging response
 */
function parseDebuggingResponse(
  response: string,
  options: VisualDebuggingOptions
): VisualDebuggingResult {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                     response.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    return {
      issues: parsed.issues || [],
      reproduction: options.reproduceSteps ? parsed.reproduction : undefined,
      fixes: options.suggestFixes ? parsed.fixes : undefined,
      metadata: {
        provider: 'anthropic',
        processingTime: 0,
        confidence: 0.8,
        requiresContext: false
      }
    };
  } catch (error) {
    return {
      issues: [],
      metadata: {
        provider: 'anthropic',
        processingTime: 0,
        confidence: 0,
        requiresContext: true
      }
    };
  }
}

/**
 * Get media type from buffer
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

  return 'image/png';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Categorize issue by type
 */
export function categorizeIssue(issue: VisualIssue): string {
  const errorKeywords = ['error', 'exception', 'failed', 'crash'];
  const warningKeywords = ['warning', 'deprecated', 'outdated'];
  const layoutKeywords = ['alignment', 'spacing', 'overlap', 'position'];
  const accessibilityKeywords = ['contrast', 'aria', 'label', 'focus', 'screen'];

  const description = issue.description.toLowerCase();

  if (errorKeywords.some(k => description.includes(k))) {
    return 'error';
  }

  if (warningKeywords.some(k => description.includes(k))) {
    return 'warning';
  }

  if (layoutKeywords.some(k => description.includes(k))) {
    return 'layout';
  }

  if (accessibilityKeywords.some(k => description.includes(k))) {
    return 'accessibility';
  }

  return 'other';
}

/**
 * Prioritize fixes
 */
export function prioritizeFixes(fixes: FixSuggestion[]): FixSuggestion[] {
  return fixes.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Estimate fix complexity
 */
export function estimateFixComplexity(fix: FixSuggestion): 'simple' | 'moderate' | 'complex' {
  if (fix.code && fix.code.length > 500) {
    return 'complex';
  }

  if (fix.solution.split('.').length > 3) {
    return 'moderate';
  }

  return 'simple';
}
