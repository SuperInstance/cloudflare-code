/**
 * Code review types for static analysis
 */

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'unknown';

export interface Issue {
  id: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  category: 'quality' | 'security' | 'performance' | 'style' | 'practices';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: {
    description: string;
    replacement?: string;
  };
}

export interface QualityMetrics {
  complexity: number;
  maintainability: number;
  testCoverage: number;
  documentation: number;
  duplication: number;
}

export interface SecurityScan {
  vulnerabilities: Issue[];
  score: number;
  recommendations: string[];
}

export interface PerformanceAnalysis {
  bottlenecks: Issue[];
  optimizations: string[];
  score: number;
}

export interface StyleIssues {
  inconsistencies: Issue[];
  formattingIssues: Issue[];
  namingIssues: Issue[];
}

export interface BestPractices {
  violations: Issue[];
  suggestions: string[];
  compliance: number;
}

export interface AnalysisResult {
  language: Language;
  quality?: QualityMetrics;
  security?: SecurityScan;
  performance?: PerformanceAnalysis;
  style?: StyleIssues;
  practices?: BestPractices;
  issues: Issue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    score: number;
  };
  timestamp: number;
  duration: number;
}
