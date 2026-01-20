/**
 * STEM Builder Integration Types
 *
 * Types for integrating STEM functionality into Cocapn Hybrid IDE
 */

export interface STEMProject {
  id: string;
  cocapnProjectId: string;
  name: string;
  description?: string;
  type: 'circuit' | 'robotics' | 'iot' | 'automation' | 'game';
  complexity: 1 | 2 | 3 | 4 | 5; // 1=Beginner, 5=Expert
  educationalGoals: string[];
  components: STEMComponent[];
  wiringData: WiringConnection[];
  codeSnippets: CodeSnippet[];
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  completed: boolean;
  progress: number; // 0-100
}

export interface STEMComponent {
  id: string;
  name: string;
  category: 'electronic' | 'mechanical' | 'software' | 'sensor' | 'actuator' | 'control';
  type: string;
  description: string;
  properties: Record<string, any>;
  pins: PinDefinition[];
  imageUrl?: string;
  isCustom: boolean;
  complexity: number;
  tags: string[];
  educationalValue: string[];
}

export interface PinDefinition {
  name: string;
  type: 'input' | 'output' | 'power' | 'ground' | 'bidirectional';
  description: string;
  voltage?: number;
  current?: number;
  color?: string;
}

export interface WiringConnection {
  id: string;
  fromComponent: string;
  fromPin: string;
  toComponent: string;
  toPin: string;
  wireType: 'digital' | 'analog' | 'power' | 'ground';
  color?: string;
  thickness?: number;
}

export interface CodeSnippet {
  id: string;
  componentId: string;
  language: 'typescript' | 'javascript' | 'python' | 'arduino' | 'microbit';
  code: string;
  explanation: string;
  difficulty: number;
  generatedBy: 'ai' | 'manual';
  timestamp: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetAudience: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
  prerequisites: string[];
  learningObjectives: string[];
  projects: string[]; // project IDs
  resources: LearningResource[];
}

export interface LearningResource {
  type: 'video' | 'article' | 'tutorial' | 'documentation' | 'example';
  title: string;
  url?: string;
  content?: string;
  duration?: number;
}

export interface STEMExplanation {
  concept: string;
  explanation: string;
  examples: string[];
  codeExample?: string;
  visualAid?: string;
  difficulty: number;
  relatedConcepts: string[];
}

export interface SimulationResult {
  success: boolean;
  output: any;
  errors?: string[];
  warnings?: string[];
  performanceMetrics?: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  educationalInsights?: string[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  type: 'circuit' | 'code' | 'debug' | 'design';
  instructions: string[];
  expectedOutcome: string;
  hints: string[];
  solution?: string;
  learningOutcomes: string[];
  points: number;
}