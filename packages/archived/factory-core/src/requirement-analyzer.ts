/**
 * Requirement Analyzer for ClaudeFlare Application Factory
 * Analyzes natural language descriptions to extract structured requirements
 */

import { z } from 'zod';

export interface AnalysisResult {
  technicalRequirements: TechnicalRequirement[];
  businessRequirements: BusinessRequirement[];
  securityRequirements: SecurityRequirement[];
  performanceRequirements: PerformanceRequirement[];
  technologies: TechnologyRecommendation[];
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very-high';
  estimatedTimeline: string;
  risks: Risk[];
}

export interface TechnicalRequirement {
  id: string;
  category: 'frontend' | 'backend' | 'database' | 'infrastructure' | 'integration';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  acceptance: string[];
  dependencies?: string[];
}

export interface BusinessRequirement {
  id: string;
  goal: string;
  metric?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  stakeholders: string[];
  acceptance: string[];
}

export interface SecurityRequirement {
  id: string;
  domain: 'authentication' | 'authorization' | 'data-protection' | 'compliance' | 'vulnerability';
  description: string;
  standards: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  acceptance: string[];
}

export interface PerformanceRequirement {
  id: string;
  metric: 'response-time' | 'throughput' | 'scalability' | 'availability' | 'latency';
  target: number;
  unit: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  acceptance: string[];
}

export interface TechnologyRecommendation {
  category: 'framework' | 'database' | 'storage' | 'auth' | 'monitoring' | 'deployment';
  name: string;
  reason: string;
  confidence: number;
  alternatives?: string[];
}

export interface Risk {
  id: string;
  category: 'technical' | 'business' | 'security' | 'compliance' | 'resource';
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string[];
}

/**
 * Analyze natural language requirements using AI-powered pattern matching
 */
export async function analyzeRequirements(
  description: string,
  context?: string,
  constraints?: any[]
): Promise<AnalysisResult> {
  // Clean and normalize input
  const cleanDescription = description.trim().toLowerCase();
  const fullContext = context ? `${context}\n${description}` : description;

  // Initialize analysis with structured patterns
  const analysis = initializeAnalysis(cleanDescription);

  // Apply AI-powered analysis patterns
  applyTechnicalPatterns(analysis, cleanDescription);
  applyBusinessPatterns(analysis, cleanDescription);
  applySecurityPatterns(analysis, cleanDescription);
  applyPerformancePatterns(analysis, cleanDescription);
  applyTechnologyPatterns(analysis, cleanDescription);
  applyComplexityAnalysis(analysis, cleanDescription);
  applyRiskAssessment(analysis, cleanDescription);

  // Apply constraints if provided
  if (constraints) {
    applyConstraints(analysis, constraints);
  }

  // Post-process and validate
  validateAnalysis(analysis);
  estimateTimeline(analysis);
  estimateComplexity(analysis);

  return analysis;
}

/**
 * Initialize empty analysis structure
 */
function initializeAnalysis(description: string): AnalysisResult {
  return {
    technicalRequirements: [],
    businessRequirements: [],
    securityRequirements: [],
    performanceRequirements: [],
    technologies: [],
    estimatedComplexity: 'medium',
    estimatedTimeline: '2-4 weeks',
    risks: []
  };
}

/**
 * Apply technical requirement patterns
 */
function applyTechnicalPatterns(analysis: AnalysisResult, description: string): void {
  const patterns = {
    frontend: /website|frontend|ui|user\s+interface|react|vue|angular|spa|single\s+page/i,
    backend: /api|backend|server|node\.js|express|fastapi|django|rails/i,
    database: /database|sql|nosql|mongodb|postgres|mysql|data\s+storage/i,
    infrastructure: /cloud|aws|azure|gcp|deployment|hosting|serverless/i,
    integration: /integration|api\s+connect|webhook|oauth|third\s+party/i
  };

  const categories: Array<keyof typeof patterns> = ['frontend', 'backend', 'database', 'infrastructure', 'integration'];
  const requirements: TechnicalRequirement[] = [];

  categories.forEach(category => {
    if (patterns[category].test(description)) {
      requirements.push({
        id: `tech-${category}-${Date.now()}`,
        category,
        description: generateTechnicalDescription(category, description),
        priority: 'medium',
        acceptance: generateTechnicalAcceptance(category),
        dependencies: getTechnicalDependencies(category)
      });
    }
  });

  analysis.technicalRequirements = requirements;
}

/**
 * Apply business requirement patterns
 */
function applyBusinessPatterns(analysis: AnalysisResult, description: string): void {
  const businessPatterns = {
    ecommerce: /ecommerce|shop|store|buy|sell|cart|payment|checkout/i,
    social: /social|network|connect|share|community|users|profile/i,
    saas: /saas|subscription|service|platform|b2b|software/i,
    content: /cms|blog|content|article|post|publish/i,
    analytics: /analytics|dashboard|metrics|tracking|stats|reports/i
  };

  const goals: Array<keyof typeof businessPatterns> = Object.keys(businessPatterns) as Array<keyof typeof businessPatterns>;
  const businessReqs: BusinessRequirement[] = [];

  goals.forEach(goal => {
    if (businessPatterns[goal].test(description)) {
      businessReqs.push({
        id: `business-${goal}-${Date.now()}`,
        goal: generateBusinessGoal(goal, description),
        priority: 'high',
        stakeholders: ['Product Owner', 'Development Team'],
        acceptance: generateBusinessAcceptance(goal)
      });
    }
  });

  analysis.businessRequirements = businessReqs;
}

/**
 * Apply security requirement patterns
 */
function applySecurityPatterns(analysis: AnalysisResult, description: string): void {
  const securityPatterns = {
    authentication: /login|auth|signin|password|jwt|oauth|session/i,
    authorization: /roles|permissions|access|admin|user|privileges/i,
    dataProtection: /encrypt|privacy|gdpr|ccpa|data\s+security|pii/i,
    compliance: /hipaa|soc2|iso|regulation|compliance|audit/i,
    vulnerability: /security|vulnerability|attack|breach|safe|secure/i
  };

  const domains: Array<keyof typeof securityPatterns> = ['authentication', 'authorization', 'dataProtection', 'compliance', 'vulnerability'];
  const securityReqs: SecurityRequirement[] = [];

  domains.forEach(domain => {
    if (securityPatterns[domain].test(description)) {
      securityReqs.push({
        id: `security-${domain}-${Date.now()}`,
        domain,
        description: generateSecurityDescription(domain, description),
        standards: getSecurityStandards(domain),
        priority: domain === 'vulnerability' ? 'high' : 'medium',
        acceptance: generateSecurityAcceptance(domain)
      });
    }
  });

  analysis.securityRequirements = securityReqs;
}

/**
 * Apply performance requirement patterns
 */
function applyPerformancePatterns(analysis: AnalysisResult, description: string): void {
  const performancePatterns = {
    responseTime: /fast|quick|speed|performance|responsive|realtime/i,
    throughput: /scale|load|concurrent|users|traffic|volume/i,
    scalability: /grow|expand|future|scalable|elastic|horizontal/i,
    availability: /uptime|reliable|always\s+on|99\.9|99\.99|highly\s+available/i,
    latency: /low\s+latency|fast|immediate|instant|realtime/i
  };

  const metrics: Array<keyof typeof performancePatterns> = ['responseTime', 'throughput', 'scalability', 'availability', 'latency'];
  const perfReqs: PerformanceRequirement[] = [];

  metrics.forEach(metric => {
    if (performancePatterns[metric].test(description)) {
      perfReqs.push({
        id: `perf-${metric}-${Date.now()}`,
        metric,
        target: getPerformanceTarget(metric),
        unit: getPerformanceUnit(metric),
        priority: 'medium',
        acceptance: generatePerformanceAcceptance(metric)
      });
    }
  });

  analysis.performanceRequirements = perfReqs;
}

/**
 * Apply technology recommendation patterns
 */
function applyTechnologyPatterns(analysis: AnalysisResult, description: string): void {
  const techPatterns = {
    frameworks: {
      react: /react|routify|next\.js|nuxt/i,
      vue: /vue|nuxt|quasar/i,
      angular: /angular|ionic/i,
      node: /node\.js|express|fastapi|nestjs/i,
      python: /python|django|flask|fastapi/i
    },
    databases: {
      postgres: /postgres|postgresql|sql|relational/i,
      mongodb: /mongodb|nosql|document/i,
      mysql: /mysql|mariadb|sql/i,
      redis: /redis|cache|in-memory/i
    },
    storage: {
      s3: /s3|blob|object\s+storage/i,
      storage: /storage|files|assets|media/i
    },
    auth: {
      auth0: /auth0|oauth|jwt|identity/i,
      firebase: /firebase|google\s+cloud|authentication/i
    }
  };

  const recommendations: TechnologyRecommendation[] = [];

  // Framework recommendations
  Object.entries(techPatterns.frameworks).forEach(([name, pattern]) => {
    if (pattern.test(description)) {
      recommendations.push({
        category: 'framework',
        name: name === 'node' ? 'Node.js' : name.charAt(0).toUpperCase() + name.slice(1),
        reason: `Application description indicates ${name} would be suitable for this project`,
        confidence: 0.8,
        alternatives: name === 'react' ? ['Vue.js', 'Svelte'] : name === 'vue' ? ['React', 'Svelte'] : undefined
      });
    }
  });

  // Database recommendations
  Object.entries(techPatterns.databases).forEach(([name, pattern]) => {
    if (pattern.test(description)) {
      recommendations.push({
        category: 'database',
        name: name.charAt(0).toUpperCase() + name.slice(1),
        reason: `Application requirements suggest ${name} as the primary database`,
        confidence: 0.75,
        alternatives: name === 'postgres' ? ['MySQL', 'CockroachDB'] : name === 'mongodb' ? ['Cassandra', 'DynamoDB'] : undefined
      });
    }
  });

  // Storage recommendations
  Object.entries(techPatterns.storage).forEach(([name, pattern]) => {
    if (pattern.test(description)) {
      recommendations.push({
        category: 'storage',
        name: name === 's3' ? 'Cloudflare R2 / S3-compatible' : 'Cloudflare KV / R2',
        reason: `Application requires ${name} for file/object storage`,
        confidence: 0.7
      });
    }
  });

  // Auth recommendations
  Object.entries(techPatterns.auth).forEach(([name, pattern]) => {
    if (pattern.test(description)) {
      recommendations.push({
        category: 'auth',
        name: name === 'auth0' ? 'Auth0 / Okta' : 'Firebase Auth / Google Cloud Auth',
        reason: `Application needs authentication system using ${name}`,
        confidence: 0.8
      });
    }
  });

  analysis.technologies = recommendations;
}

/**
 * Apply complexity analysis
 */
function applyComplexityAnalysis(analysis: AnalysisResult, description: string): void {
  const complexityIndicators = {
    'very-high': /enterprise|large\s*scale|millions|high\s+traffic|global|distributed|microservices|complex|sophisticated/i,
    high: /scalable|high\s+performance|realtime|mobile|api|integration|payment|security/i,
    medium: /web\s+app|dashboard|cms|blog|portfolio|basic|standard/i,
    low: /simple|basic|static|landing|page|minimal|small/i
  };

  let complexity: 'low' | 'medium' | 'high' | 'very-high' = 'medium';

  Object.entries(complexityIndicators).forEach(([level, pattern]) => {
    if (pattern.test(description)) {
      complexity = level as 'low' | 'medium' | 'high' | 'very-high';
    }
  });

  analysis.estimatedComplexity = complexity;
}

/**
 * Apply risk assessment
 */
function applyRiskAssessment(analysis: AnalysisResult, description: string): void {
  const riskPatterns = {
    technical: /innovative|experimental|cutting|new|unproven|prototype/i,
    business: /market|competitor|revenue|monetization|startup|funding/i,
    security: /sensitive|critical|financial|healthcare|personal/i,
    compliance: /gdpr|hipaa|soc2|regulation|law|compliance/i,
    resource: /tight|deadline|limited|budget|small\s+team|quick/i
  };

  const risks: Risk[] = [];

  Object.entries(riskPatterns).forEach(([category, pattern]) => {
    if (pattern.test(description)) {
      risks.push({
        id: `risk-${category}-${Date.now()}`,
        category: category as Risk['category'],
        description: generateRiskDescription(category as Risk['category'], description),
        likelihood: 'medium',
        impact: 'medium',
        mitigation: generateRiskMitigation(category as Risk['category'])
      });
    }
  });

  analysis.risks = risks;
}

/**
 * Apply constraints to analysis
 */
function applyConstraints(analysis: AnalysisResult, constraints: any[]): void {
  constraints.forEach((constraint, index) => {
    if (constraint.type === 'budget') {
      analysis.estimatedTimeline = adjustTimelineForBudget(analysis.estimatedTimeline, constraint.value);
      analysis.estimatedComplexity = adjustComplexityForBudget(analysis.estimatedComplexity, constraint.value);
    }

    if (constraint.type === 'timeline') {
      analysis.estimatedComplexity = adjustComplexityForTimeline(analysis.estimatedComplexity, constraint.value);
    }

    if (constraint.type === 'compliance') {
      const complianceReq = analysis.securityRequirements.find(req =>
        req.domain === 'compliance' || req.description.toLowerCase().includes('compliance')
      );
      if (complianceReq) {
        complianceReq.priority = 'critical';
      }
    }
  });
}

/**
 * Validation and post-processing
 */
function validateAnalysis(analysis: AnalysisResult): void {
  // Ensure all requirements have unique IDs
  const allIds = new Set();

  [...analysis.technicalRequirements,
   ...analysis.businessRequirements,
   ...analysis.securityRequirements,
   ...analysis.performanceRequirements].forEach(req => {
    if (allIds.has(req.id)) {
      req.id += `-${Date.now()}`;
    }
    allIds.add(req.id);
  });

  // Ensure technologies have confidence scores
  analysis.technologies.forEach(tech => {
    if (!tech.confidence) {
      tech.confidence = 0.5;
    }
  });
}

/**
 * Timeline estimation
 */
function estimateTimeline(analysis: AnalysisResult): void {
  const baseTime = {
    'low': '1-2 weeks',
    'medium': '2-4 weeks',
    'high': '4-8 weeks',
    'very-high': '8-16 weeks'
  };

  const complexityMultiplier = {
    'low': 1,
    'medium': 1,
    'high': 1.5,
    'very-high': 2
  };

  const requirementCount = analysis.technicalRequirements.length +
                          analysis.businessRequirements.length +
                          analysis.securityRequirements.length +
                          analysis.performanceRequirements.length;

  const adjustedTime = requirementCount * 0.1;
  const base = baseTime[analysis.estimatedComplexity];

  // Simple timeline adjustment based on additional requirements
  analysis.estimatedTimeline = adjustedTime > 2 ? '6-12 weeks' : base;
}

/**
 * Complexity estimation
 */
function estimateComplexity(analysis: AnalysisResult): void {
  const requirementScore =
    (analysis.technicalRequirements.length * 2) +
    (analysis.businessRequirements.length * 1.5) +
    (analysis.securityRequirements.length * 3) +
    (analysis.performanceRequirements.length * 2);

  const riskScore = analysis.risks.length * 2;
  const techScore = analysis.technologies.length;

  const totalScore = requirementScore + riskScore + techScore;

  if (totalScore > 20) {
    analysis.estimatedComplexity = 'very-high';
  } else if (totalScore > 15) {
    analysis.estimatedComplexity = 'high';
  } else if (totalScore > 10) {
    analysis.estimatedComplexity = 'medium';
  } else {
    analysis.estimatedComplexity = 'low';
  }
}

// Helper functions for generating descriptions and requirements
function generateTechnicalDescription(category: string, description: string): string {
  const descriptions = {
    frontend: 'Build responsive user interface with modern web technologies',
    backend: 'Develop server-side API and business logic',
    database: 'Implement data storage and retrieval system',
    infrastructure: 'Set up cloud deployment and hosting infrastructure',
    integration: 'Connect with external services and APIs'
  };
  return descriptions[category as keyof typeof descriptions] || `Implement ${category} infrastructure`;
}

function generateTechnicalAcceptance(category: string): string[] {
  const acceptance = {
    frontend: ['All pages load correctly', 'UI is responsive on mobile devices', 'User interactions work as expected'],
    backend: ['API endpoints respond correctly', 'Business logic is implemented', 'Error handling is proper'],
    database: ['Data can be stored and retrieved', 'Database schema is optimized', 'Migrations work correctly'],
    infrastructure: ['Application is deployed successfully', 'Configuration management is in place', 'Monitoring is set up'],
    integration: ['External connections work', 'API authentication is handled', 'Error handling for external services']
  };
  return acceptance[category as keyof typeof acceptance] || ['Requirements are met'];
}

function getTechnicalDependencies(category: string): string[] {
  const dependencies = {
    frontend: ['backend', 'design'],
    backend: ['database', 'infrastructure'],
    database: ['infrastructure'],
    infrastructure: [],
    integration: ['backend', 'authentication']
  };
  return dependencies[category as keyof typeof dependencies] || [];
}

function generateBusinessGoal(goal: string, description: string): string {
  const goals = {
    ecommerce: 'Create an e-commerce platform for online shopping',
    social: 'Build a social networking platform for user interaction',
    saas: 'Develop a software-as-a-service application',
    content: 'Create a content management system',
    analytics: 'Build data analytics and reporting dashboard'
  };
  return goals[goal as keyof typeof goals] || 'Achieve business objectives';
}

function generateBusinessAcceptance(goal: string): string[] {
  const acceptance = {
    ecommerce: ['Users can browse and purchase products', 'Payment processing works', 'Order management is functional'],
    social: ['Users can create profiles and interact', 'Content sharing works', 'Notification system is in place'],
    saas: ['Users can subscribe and access service', 'Billing and payments work', 'User management is functional'],
    content: ['Users can create and manage content', 'Content publishing works', 'User roles are configured'],
    analytics: ['Dashboard displays key metrics', 'Reports can be generated', 'Data visualization is functional']
  };
  return acceptance[goal as keyof typeof acceptance] || ['Business requirements are met'];
}

function generateSecurityDescription(domain: string, description: string): string {
  const descriptions = {
    authentication: 'Implement secure user authentication system',
    authorization: 'Set up role-based access control',
    dataProtection: 'Ensure data encryption and privacy compliance',
    compliance: 'Meet regulatory and compliance requirements',
    vulnerability: 'Protect against security vulnerabilities and attacks'
  };
  return descriptions[domain as keyof typeof descriptions] || `Implement ${domain} security measures`;
}

function getSecurityStandards(domain: string): string[] {
  const standards = {
    authentication: ['OWASP Authentication Cheat Sheet', 'NIST 800-63B'],
    authorization: ['RBAC Best Practices', 'NIST 800-53'],
    dataProtection: ['GDPR', 'CCPA', 'Data Protection Laws'],
    compliance: ['SOC 2', 'ISO 27001', 'HIPAA (if applicable)'],
    vulnerability: ['OWASP Top 10', 'CVE Database', 'Security Scanning']
  };
  return standards[domain as keyof typeof standards] || ['Industry standards'];
}

function generateSecurityAcceptance(domain: string): string[] {
  const acceptance = {
    authentication: ['Users can authenticate securely', 'Session management is proper', 'Password policies are enforced'],
    authorization: ['Users have appropriate permissions', 'Access controls work', 'Admin functions are protected'],
    dataProtection: ['Data is encrypted at rest and in transit', 'Privacy requirements are met', 'Data retention policies are in place'],
    compliance: ['Compliance documentation is available', 'Audits can be passed', 'Regulatory requirements are met'],
    vulnerability: ['Regular security scans are performed', 'Vulnerabilities are patched', 'Security monitoring is in place']
  };
  return acceptance[domain as keyof typeof acceptance] || ['Security requirements are met'];
}

function getPerformanceTarget(metric: string): number {
  const targets = {
    responseTime: 200,
    throughput: 1000,
    scalability: 10000,
    availability: 99.9,
    latency: 50
  };
  return targets[metric as keyof typeof targets] || 100;
}

function getPerformanceUnit(metric: string): string {
  const units = {
    responseTime: 'ms',
    throughput: 'requests/sec',
    scalability: 'users',
    availability: '%',
    latency: 'ms'
  };
  return units[metric as keyof typeof units] || 'units';
}

function generatePerformanceAcceptance(metric: string): string[] {
  const acceptance = {
    responseTime: ['95% of requests respond within target time', 'Slowness is logged and monitored'],
    throughput: ['System handles expected traffic load', 'Load testing passes'],
    scalability: ['System can grow to target size', 'Scaling mechanisms work'],
    availability: ['Uptime meets target', 'Downtime is minimized'],
    latency: ['End-to-end latency is within target', 'Real-time requirements are met']
  };
  return acceptance[metric as keyof typeof acceptance] || ['Performance requirements are met'];
}

function generateRiskDescription(category: Risk['category'], description: string): string {
  const descriptions = {
    technical: 'Project involves innovative or unproven technologies',
    business: 'Market conditions or business model uncertainty',
    security: 'Handling sensitive or critical data',
    compliance: 'Meeting complex regulatory requirements',
    resource: 'Limited time, budget, or team resources'
  };
  return descriptions[category] || `Potential risk in ${category} area`;
}

function generateRiskMitigation(category: Risk['category']): string[] {
  const mitigations = {
    technical: ['Prototype technologies first', 'Choose proven solutions', 'Get technical expertise'],
    business: ['Market research', 'MVP approach', 'Business model validation'],
    security: ['Security assessments', 'Penetration testing', 'Security experts consultation'],
    compliance: ['Legal consultation', 'Regular audits', 'Compliance frameworks'],
    resource: ['Scope management', 'Prioritize features', 'Additional resources']
  };
  return mitigations[category] || ['Risk mitigation strategies'];
}

function adjustTimelineForBudget(timeline: string, budget: string | number): string {
  const budgetLevel = typeof budget === 'string'
    ? budget.toLowerCase().includes('high') ? 'high' :
      budget.toLowerCase().includes('low') ? 'low' : 'medium'
    : budget > 10000 ? 'high' : budget > 5000 ? 'medium' : 'low';

  const adjustments = {
    'high': 0.7,
    'medium': 1,
    'low': 1.5
  };

  // Adjust timeline based on budget
  const adjustment = adjustments[budgetLevel as keyof typeof adjustments];
  if (adjustment < 1) {
    return timeline.replace(/\d+/g, match => Math.floor(parseInt(match) * adjustment).toString());
  } else {
    return timeline.replace(/\d+/g, match => Math.floor(parseInt(match) * adjustment).toString());
  }
}

function adjustComplexityForBudget(complexity: string, budget: string | number): string {
  const budgetLevel = typeof budget === 'string'
    ? budget.toLowerCase().includes('high') ? 'high' :
      budget.toLowerCase().includes('low') ? 'low' : 'medium'
    : budget > 10000 ? 'high' : budget > 5000 ? 'medium' : 'low';

  if (budgetLevel === 'low' && complexity === 'very-high') return 'high';
  if (budgetLevel === 'low' && complexity === 'high') return 'medium';
  if (budgetLevel === 'high' && complexity === 'low') return 'medium';
  if (budgetLevel === 'high' && complexity === 'medium') return 'high';

  return complexity;
}

function adjustComplexityForTimeline(complexity: string, timeline: string): string {
  const timelineLevel = timeline.toLowerCase().includes('week') ?
    (timeline.includes('1') || timeline.includes('2') ? 'fast' :
     timeline.includes('8') || timeline.includes('16') ? 'slow' : 'medium') : 'medium';

  if (timelineLevel === 'fast' && complexity === 'very-high') return 'high';
  if (timelineLevel === 'fast' && complexity === 'high') return 'medium';
  if (timelineLevel === 'slow' && complexity === 'low') return 'medium';
  if (timelineLevel === 'slow' && complexity === 'medium') return 'high';

  return complexity;
}