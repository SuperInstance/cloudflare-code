/**
 * Diagram Analysis and Code Generation
 * Analyze architecture diagrams, flowcharts, and generate code from visual representations
 */

// @ts-nocheck - External AI SDK dependencies
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  DiagramAnalysisOptions,
  DiagramAnalysisResult,
  DiagramType,
  DiagramComponent,
  DiagramConnection,
  DiagramLayer,
  GeneratedCode,
  CodeLanguage,
  CodeFile,
  DiagramMetadata
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

const DIAGRAM_PATTERNS = {
  architecture: ['service', 'database', 'api', 'microservice', 'component', 'layer', 'tier'],
  flowchart: ['decision', 'process', 'start', 'end', 'connector', 'arrow'],
  'sequence-diagram': ['actor', 'participant', 'message', 'lifeline', 'activation'],
  'entity-relationship': ['entity', 'relationship', 'attribute', 'cardinality'],
  'class-diagram': ['class', 'method', 'property', 'inheritance', 'interface'],
  'state-machine': ['state', 'transition', 'event', 'action', 'initial', 'final'],
  'network-topology': ['server', 'router', 'switch', 'firewall', 'load-balancer', 'network'],
  'data-flow': ['process', 'data-store', 'external-entity', 'data-flow'],
  'component-diagram': ['component', 'port', 'interface', 'connector']
};

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Analyze diagram and extract structured information
 */
export async function analyzeDiagram(
  options: DiagramAnalysisOptions
): Promise<DiagramAnalysisResult> {
  const startTime = Date.now();

  // Detect diagram type if not specified
  const diagramType = options.type || await detectDiagramType(options.image);

  // Extract components and connections
  const result = await extractDiagramStructure(options.image, diagramType);

  // Generate code if requested
  if (options.generateCode) {
    result.code = await generateCodeFromDiagram(
      result,
      options.targetLanguage || 'typescript'
    );
  }

  // Add metadata
  result.metadata = {
    confidence: calculateDiagramConfidence(result),
    processingTime: Date.now() - startTime,
    provider: 'anthropic',
    complexity: calculateComplexity(result)
  };

  return result;
}

/**
 * Generate code from diagram
 */
export async function generateCodeFromDiagram(
  diagram: DiagramAnalysisResult,
  targetLanguage: CodeLanguage
): Promise<GeneratedCode> {
  const prompt = buildCodeGenerationPrompt(diagram, targetLanguage);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 8192,
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ]
  });

  return parseCodeGenerationResponse(
    message.content[0]?.type === 'text' ? message.content[0].text : '',
    targetLanguage
  );
}

/**
 * Analyze architecture diagram specifically
 */
export async function analyzeArchitectureDiagram(
  image: Buffer | string
): Promise<DiagramAnalysisResult> {
  return analyzeDiagram({
    image,
    type: 'architecture',
    extractComponents: true,
    generateCode: true
  });
}

/**
 * Analyze flowchart and generate code
 */
export async function analyzeFlowchart(
  image: Buffer | string,
  targetLanguage?: CodeLanguage
): Promise<DiagramAnalysisResult> {
  return analyzeDiagram({
    image,
    type: 'flowchart',
    extractComponents: true,
    generateCode: true,
    targetLanguage
  });
}

/**
 * Analyze sequence diagram
 */
export async function analyzeSequenceDiagram(
  image: Buffer | string
): Promise<DiagramAnalysisResult> {
  return analyzeDiagram({
    image,
    type: 'sequence-diagram',
    extractComponents: true
  });
}

/**
 * Analyze ER diagram
 */
export async function analyzeERDiagram(
  image: Buffer | string
): Promise<DiagramAnalysisResult> {
  return analyzeDiagram({
    image,
    type: 'entity-relationship',
    extractComponents: true,
    generateCode: true,
    targetLanguage: 'typescript'
  });
}

// ============================================================================
// Diagram Structure Extraction
// ============================================================================

/**
 * Extract structured information from diagram
 */
async function extractDiagramStructure(
  image: Buffer | string,
  diagramType: DiagramType
): Promise<DiagramAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const imageBase64 = typeof image === 'string'
    ? image
    : image.toString('base64');

  const mediaType = image instanceof Buffer
    ? getMediaTypeFromBuffer(image)
    : 'image/png';

  const prompt = buildDiagramAnalysisPrompt(diagramType);

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 4096,
    temperature: 0.2,
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

  return parseDiagramResponse(
    message.content[0]?.type === 'text' ? message.content[0].text : '',
    diagramType
  );
}

/**
 * Build prompt for diagram analysis
 */
function buildDiagramAnalysisPrompt(diagramType: DiagramType): string {
  const instructions = getDiagramTypeInstructions(diagramType);

  return `Analyze this ${diagramType} diagram and extract its structure.

${instructions}

Provide your response in this JSON format:
{
  "type": "${diagramType}",
  "title": "Diagram title if present",
  "description": "Overall description",
  "components": [
    {
      "id": "unique-id",
      "type": "service/database/etc",
      "label": "Display name",
      "position": {"x": 10, "y": 20, "width": 100, "height": 50},
      "properties": {},
      "technologies": ["tech1", "tech2"]
    }
  ],
  "connections": [
    {
      "from": "component-id-1",
      "to": "component-id-2",
      "type": "arrow/line/dashed",
      "label": "connection label",
      "properties": {}
    }
  ],
  "layers": [
    {
      "name": "layer-name",
      "components": ["component-id-1", "component-id-2"],
      "dependencies": ["other-layer-id"]
    }
  ]
}`;
}

/**
 * Get instructions specific to diagram type
 */
function getDiagramTypeInstructions(diagramType: DiagramType): string {
  const instructions: Record<DiagramType, string> = {
    architecture: 'Identify services, databases, APIs, load balancers, and other architectural components. Note the relationships, data flow, and technologies used.',
    flowchart: 'Identify start/end points, processes, decisions, connectors, and the flow logic. Extract decision conditions and process descriptions.',
    'sequence-diagram': 'Identify actors/participants, messages, lifelines, and the sequence of interactions. Note message types and parameters.',
    'entity-relationship': 'Identify entities, their attributes, relationships, and cardinalities. Note primary and foreign keys.',
    'class-diagram': 'Identify classes, their methods, properties, visibility modifiers, inheritance relationships, and interfaces.',
    'state-machine': 'Identify states, transitions, events, actions, and the initial/final states.',
    'network-topology': 'Identify servers, routers, switches, firewalls, load balancers, and network connections. Note IP addresses and protocols.',
    'data-flow': 'Identify processes, data stores, external entities, and data flows between them.',
    'component-diagram': 'Identify components, ports, interfaces, and connectors between components.'
  };

  return instructions[diagramType] || 'Extract all components and their relationships.';
}

/**
 * Parse diagram analysis response
 */
function parseDiagramResponse(
  response: string,
  diagramType: DiagramType
): DiagramAnalysisResult {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                     response.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    return {
      type: diagramType,
      title: parsed.title,
      description: parsed.description || '',
      components: parsed.components || [],
      connections: parsed.connections || [],
      layers: parsed.layers,
      metadata: {} as DiagramMetadata
    };
  } catch (error) {
    // Return minimal result on error
    return {
      type: diagramType,
      description: response,
      components: [],
      connections: [],
      metadata: {} as DiagramMetadata
    };
  }
}

// ============================================================================
// Code Generation
// ============================================================================

/**
 * Build prompt for code generation from diagram
 */
function buildCodeGenerationPrompt(
  diagram: DiagramAnalysisResult,
  targetLanguage: CodeLanguage
): string {
  let prompt = `Generate ${targetLanguage} code based on this ${diagram.type} diagram:\n\n`;
  prompt += `Description: ${diagram.description}\n\n`;
  prompt += `Components:\n`;
  prompt += JSON.stringify(diagram.components, null, 2);
  prompt += `\n\nConnections:\n`;
  prompt += JSON.stringify(diagram.connections, null, 2);

  if (diagram.layers && diagram.layers.length > 0) {
    prompt += `\n\nLayers:\n`;
    prompt += JSON.stringify(diagram.layers, null, 2);
  }

  prompt += `\n\nProvide your response in this JSON format:
{
  "language": "${targetLanguage}",
  "code": "main implementation code",
  "framework": "framework name if applicable",
  "dependencies": ["dependency1", "dependency2"],
  "files": [
    {
      "path": "file/path",
      "content": "file content",
      "language": "typescript"
    }
  ]
}`;

  return prompt;
}

/**
 * Parse code generation response
 */
function parseCodeGenerationResponse(
  response: string,
  targetLanguage: CodeLanguage
): GeneratedCode {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                     response.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      // Fallback: treat entire response as code
      return {
        language: targetLanguage,
        code: response,
        dependencies: [],
        files: []
      };
    }

    const parsed = JSON.parse(jsonMatch[1]);

    return {
      language: parsed.language || targetLanguage,
      code: parsed.code || '',
      framework: parsed.framework,
      dependencies: parsed.dependencies || [],
      files: parsed.files || []
    };
  } catch (error) {
    return {
      language: targetLanguage,
      code: response,
      dependencies: [],
      files: []
    };
  }
}

// ============================================================================
// Diagram Type Detection
// ============================================================================

/**
 * Detect diagram type from image
 */
async function detectDiagramType(image: Buffer | string): Promise<DiagramType> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const imageBase64 = typeof image === 'string'
    ? image
    : image.toString('base64');

  const mediaType = image instanceof Buffer
    ? getMediaTypeFromBuffer(image)
    : 'image/png';

  const message = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 500,
    temperature: 0.2,
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
            text: `Identify the type of diagram from this image. Options: architecture, flowchart, sequence-diagram, entity-relationship, class-diagram, state-machine, network-topology, data-flow, component-diagram.

Respond with just the diagram type name.`
          }
        ]
      }
    ]
  });

  const response = message.content[0]?.type === 'text' ? message.content[0].text : '';
  const detected = response.toLowerCase().trim().replace(/\s+/g, '-') as DiagramType;

  // Validate detected type
  const validTypes: DiagramType[] = ['architecture', 'flowchart', 'sequence-diagram', 'entity-relationship', 'class-diagram', 'state-machine', 'network-topology', 'data-flow', 'component-diagram'];

  return validTypes.includes(detected) ? detected : 'architecture';
}

// ============================================================================
// Analysis Utilities
// ============================================================================

/**
 * Calculate confidence score for diagram analysis
 */
function calculateDiagramConfidence(result: DiagramAnalysisResult): number {
  if (result.components.length === 0) return 0.3;

  let confidence = 0.5;

  // Increase confidence based on component count
  if (result.components.length >= 3) confidence += 0.1;
  if (result.components.length >= 5) confidence += 0.1;

  // Increase confidence based on connection count
  if (result.connections.length >= 2) confidence += 0.1;
  if (result.connections.length >= 4) confidence += 0.1;

  // Check if all components have valid positions
  const validPositions = result.components.filter(c =>
    c.position &&
    typeof c.position.x === 'number' &&
    typeof c.position.y === 'number'
  ).length;

  if (validPositions === result.components.length) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

/**
 * Calculate complexity of diagram
 */
function calculateComplexity(result: DiagramAnalysisResult): 'low' | 'medium' | 'high' {
  const complexityScore = result.components.length + result.connections.length;

  if (complexityScore < 5) return 'low';
  if (complexityScore < 15) return 'medium';
  return 'high';
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
// Export Functions
// ============================================================================

/**
 * Export diagram to Mermaid format
 */
export function exportToMermaid(result: DiagramAnalysisResult): string {
  let mermaid = '';

  switch (result.type) {
    case 'flowchart':
      mermaid = 'flowchart TD\n';
      for (const conn of result.connections) {
        mermaid += `  ${conn.from} ${conn.type === 'dashed' ? '-.->' : '-->'} ${conn.to}`;
        if (conn.label) mermaid += `|${conn.label}|`;
        mermaid += '\n';
      }
      break;

    case 'sequence-diagram':
      mermaid = 'sequenceDiagram\n';
      for (const conn of result.connections) {
        mermaid += `  ${conn.from}->>${conn.to}: ${conn.label || ''}\n`;
      }
      break;

    case 'architecture':
      mermaid = 'graph TD\n';
      for (const comp of result.components) {
        mermaid += `  ${comp.id}[${comp.label}]\n`;
      }
      for (const conn of result.connections) {
        mermaid += `  ${conn.from} --> ${conn.to}\n`;
      }
      break;

    default:
      mermaid = `// ${result.type} diagram\n// Export not yet implemented`;
  }

  return mermaid;
}

/**
 * Export diagram to PlantUML format
 */
export function exportToPlantUML(result: DiagramAnalysisResult): string {
  let plantuml = '@startuml\n';

  switch (result.type) {
    case 'architecture':
      for (const comp of result.components) {
        plantuml += `component "${comp.label}" as ${comp.id}\n`;
      }
      for (const conn of result.connections) {
        plantuml += `${conn.from} --> ${conn.to}`;
        if (conn.label) plantuml += ` : ${conn.label}`;
        plantuml += '\n';
      }
      break;

    case 'sequence-diagram':
      for (const comp of result.components) {
        plantuml += `actor "${comp.label}" as ${comp.id}\n`;
      }
      for (const conn of result.connections) {
        plantuml += `${conn.from} -> ${conn.to}`;
        if (conn.label) plantuml += ` : ${conn.label}`;
        plantuml += '\n';
      }
      break;

    default:
      plantuml += `' ${result.type} diagram\n' Export not yet implemented`;
  }

  plantuml += '@enduml';
  return plantuml;
}
