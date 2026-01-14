/**
 * Tutorial Generator - Create interactive tutorials and learning materials
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  Tutorial,
  TutorialMetadata,
  TutorialSection,
  TutorialResource,
  TutorialAssessment,
  TutorialProgress,
  QuizQuestion,
  ExerciseData,
  VideoData,
  DocumentContent
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

export interface TutorialGeneratorOptions {
  outputPath: string;
  includeExercises?: boolean;
  includeQuizzes?: boolean;
  includeVideos?: boolean;
  languages?: string[];
}

export interface TutorialTemplate {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  sections: TutorialSectionTemplate[];
}

export interface TutorialSectionTemplate {
  title: string;
  type: 'text' | 'exercise' | 'quiz' | 'video' | 'interactive';
  content: string;
  duration?: number;
  exercises?: ExerciseTemplate[];
  quizzes?: QuizTemplate[];
  videos?: VideoTemplate[];
}

export interface ExerciseTemplate {
  instructions: string;
  startingCode: string;
  solution: string;
  hints: string[];
  tests: Array<{
    name: string;
    input?: any;
    expected: any;
  }>;
}

export interface QuizTemplate {
  questions: Array<{
    question: string;
    type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'code';
    options?: string[];
    correctAnswer: string | string[];
    explanation?: string;
    points: number;
  }>;
  passingScore: number;
}

export interface VideoTemplate {
  url: string;
  duration: number;
  thumbnail?: string;
  transcript?: string;
}

export class TutorialGenerator {
  private logger: Logger;
  private templates: Map<string, TutorialTemplate>;

  constructor(private options: TutorialGeneratorOptions) {
    this.logger = new Logger('TutorialGenerator');
    this.templates = new Map();
    this.loadTemplates();
  }

  /**
   * Generate tutorial from documentation
   */
  async generateFromDocs(docs: DocumentContent[]): Promise<Tutorial[]> {
    this.logger.info(`Generating tutorials from ${docs.length} documents`);

    const tutorials: Tutorial[] = [];

    // Group by category
    const byCategory = this.groupByCategory(docs);

    for (const [category, documents] of byCategory.entries()) {
      const tutorial = await this.createTutorial(category, documents);
      if (tutorial) {
        tutorials.push(tutorial);
      }
    }

    this.logger.info(`Generated ${tutorials.length} tutorials`);
    return tutorials;
  }

  /**
   * Create tutorial from documents
   */
  private async createTutorial(
    category: string,
    docs: DocumentContent[]
  ): Promise<Tutorial | null> {
    const difficulty = this.determineDifficulty(docs);
    const duration = this.estimateDuration(docs);

    const metadata: TutorialMetadata = {
      title: `${this.formatTitle(category)} Tutorial`,
      description: this.generateDescription(docs),
      duration,
      difficulty,
      category,
      tags: this.extractTags(docs),
      prerequisites: this.determinePrerequisites(docs),
      learningObjectives: this.generateLearningObjectives(docs),
      language: 'en',
      version: '1.0.0',
      updatedAt: new Date()
    };

    const sections = await this.createSections(docs);

    const resources = this.createResources(docs);

    const assessment = this.options.includeQuizzes
      ? this.createAssessment(docs)
      : undefined;

    return {
      id: this.generateId(category),
      metadata,
      sections,
      resources,
      assessment
    };
  }

  /**
   * Create tutorial sections
   */
  private async createSections(docs: DocumentContent[]): Promise<TutorialSection[]> {
    const sections: TutorialSection[] = [];
    let order = 1;

    // Introduction
    sections.push({
      id: 'intro',
      title: 'Introduction',
      content: this.generateIntroduction(docs),
      type: 'text',
      order,
      duration: 5
    });
    order++;

    // Core concepts
    for (const doc of docs) {
      // Text section
      sections.push({
        id: this.generateId(`${doc.metadata.id}-text`),
        title: doc.metadata.title,
        content: doc.content,
        type: 'text',
        order: order++,
        duration: this.estimateSectionDuration(doc)
      });

      // Exercise section
      if (this.options.includeExercises && doc.examples && doc.examples.length > 0) {
        sections.push({
          id: this.generateId(`${doc.metadata.id}-exercise`),
          title: `Exercise: ${doc.metadata.title}`,
          content: '',
          type: 'exercise',
          order: order++,
          duration: 10,
          contentData: this.createExercise(doc)
        });
      }

      // Quiz section
      if (this.options.includeQuizzes) {
        sections.push({
          id: this.generateId(`${doc.metadata.id}-quiz`),
          title: `Quiz: ${doc.metadata.title}`,
          content: '',
          type: 'quiz',
          order: order++,
          duration: 5,
          contentData: this.createQuiz(doc)
        });
      }
    }

    // Summary
    sections.push({
      id: 'summary',
      title: 'Summary',
      content: this.generateSummary(docs),
      type: 'text',
      order: order++,
      duration: 5
    });

    return sections;
  }

  /**
   * Create exercise from document
   */
  private createExercise(doc: DocumentContent): ExerciseData {
    const example = doc.examples?.[0];

    return {
      instructions: `Complete the following exercise based on ${doc.metadata.title}:\n\n${doc.metadata.description}`,
      startingCode: example?.code || '// Write your code here',
      solution: example?.code || '// Solution will be provided',
      hints: [
        'Read the documentation carefully',
        'Check the examples provided',
        'Break down the problem into smaller steps'
      ],
      tests: example?.expectedOutput
        ? [{
            name: 'Test output',
            input: undefined,
            expected: example.expectedOutput
          }]
        : [],
      allowRun: true,
      showSolution: false
    };
  }

  /**
   * Create quiz from document
   */
  private createQuiz(doc: DocumentContent): QuizData {
    const questions: QuizQuestion[] = [];

    // Add comprehension question
    questions.push({
      id: this.generateId('q1'),
      type: 'multiple-choice',
      question: `What is the main purpose of ${doc.metadata.title}?`,
      options: this.generateQuizOptions(doc),
      correctAnswer: 'a',
      explanation: `Based on the documentation: ${doc.metadata.description}`,
      points: 10
    });

    // Add true/false question
    questions.push({
      id: this.generateId('q2'),
      type: 'true-false',
      question: `Is ${doc.metadata.title} used for ${doc.metadata.category} operations?`,
      correctAnswer: doc.metadata.category === 'utility' ? 'false' : 'true',
      explanation: `${doc.metadata.title} is a ${doc.metadata.category} module.`,
      points: 5
    });

    return {
      questions,
      passingScore: 70,
      randomize: true
    };
  }

  /**
   * Create assessment
   */
  private createAssessment(docs: DocumentContent[]): TutorialAssessment {
    const questions: QuizQuestion[] = [];

    for (const doc of docs) {
      const quiz = this.createQuiz(doc);
      questions.push(...quiz.questions);
    }

    return {
      id: this.generateId('assessment'),
      questions,
      passingScore: 75,
      timeLimit: questions.length * 2, // 2 minutes per question
      randomize: true,
      showAnswers: true,
      retakeAllowed: true
    };
  }

  /**
   * Create resources
   */
  private createResources(docs: DocumentContent[]): TutorialResource[] {
    const resources: TutorialResource[] = [];
    let order = 1;

    // Add reference links
    for (const doc of docs) {
      resources.push({
        id: this.generateId(`resource-${doc.metadata.id}`),
        type: 'reference',
        title: doc.metadata.title,
        content: doc.content.substring(0, 500) + '...',
        order: order++
      });
    }

    // Add glossary
    resources.push({
      id: this.generateId('glossary'),
      type: 'glossary',
      title: 'Glossary',
      content: this.generateGlossary(docs),
      order: order++
    });

    return resources;
  }

  /**
   * Generate glossary
   */
  private generateGlossary(docs: DocumentContent[]): string {
    const terms = new Map<string, string>();

    for (const doc of docs) {
      // Extract key terms from documentation
      const termRegex = /`([^`]+)`/g;
      let match;
      while ((match = termRegex.exec(doc.content)) !== null) {
        const term = match[1];
        if (!terms.has(term)) {
          terms.set(term, `Technical term from ${doc.metadata.title}`);
        }
      }
    }

    let glossary = '# Glossary\n\n';
    for (const [term, definition] of terms.entries()) {
      glossary += `**${term}**: ${definition}\n\n`;
    }

    return glossary;
  }

  /**
   * Generate introduction
   */
  private generateIntroduction(docs: DocumentContent[]): string {
    return `
# Welcome to this Tutorial

This tutorial will guide you through the following topics:

${docs.map(doc => `- ${doc.metadata.title}`).join('\n')}

## Learning Objectives

By the end of this tutorial, you will:

- Understand the core concepts
- Learn how to use the APIs effectively
- Practice with hands-on exercises
- Test your knowledge with quizzes

Let's get started!
    `.trim();
  }

  /**
   * Generate summary
   */
  private generateSummary(docs: DocumentContent[]): string {
    return `
# Summary

Congratulations! You've completed this tutorial. Let's review what we've covered:

## Key Takeaways

${docs.map(doc => `- **${doc.metadata.title}**: ${doc.metadata.description}`).join('\n')}

## Next Steps

- Practice what you've learned
- Explore the related documentation
- Try building your own projects

## Additional Resources

- API Reference
- Code Examples
- Community Forums

Keep learning and building!
    `.trim();
  }

  /**
   * Generate description
   */
  private generateDescription(docs: DocumentContent[]): string {
    const topics = docs.map(d => d.metadata.title).join(', ');
    return `Learn about ${topics} in this comprehensive tutorial.`;
  }

  /**
   * Determine difficulty level
   */
  private determineDifficulty(docs: DocumentContent[]): 'beginner' | 'intermediate' | 'advanced' {
    const avgComplexity = docs.reduce((sum, doc) => {
      return sum + (doc.examples?.length || 0);
    }, 0) / docs.length;

    if (avgComplexity < 2) return 'beginner';
    if (avgComplexity < 4) return 'intermediate';
    return 'advanced';
  }

  /**
   * Estimate tutorial duration
   */
  private estimateDuration(docs: DocumentContent[]): number {
    let duration = 0;

    for (const doc of docs) {
      duration += this.estimateSectionDuration(doc);
      if (doc.examples && doc.examples.length > 0) {
        duration += 10; // Exercise time
      }
    }

    return duration;
  }

  /**
   * Estimate section duration
   */
  private estimateSectionDuration(doc: DocumentContent): number {
    const wordCount = doc.content.split(/\s+/).length;
    return Math.ceil(wordCount / 200) + 2; // 2 minutes base + reading time
  }

  /**
   * Determine prerequisites
   */
  private determinePrerequisites(docs: DocumentContent[]): string[] {
    const prerequisites = new Set<string>();

    for (const doc of docs) {
      // Extract prerequisites from content
      const prereqRegex = /prerequisite[:\s]+([^\n]+)/gi;
      let match;
      while ((match = prereqRegex.exec(doc.content)) !== null) {
        prerequisites.add(match[1].trim());
      }
    }

    return Array.from(prerequisites);
  }

  /**
   * Generate learning objectives
   */
  private generateLearningObjectives(docs: DocumentContent[]): string[] {
    const objectives: string[] = [];

    for (const doc of docs) {
      objectives.push(`Understand ${doc.metadata.title}`);
      objectives.push(`Use ${doc.metadata.title} in your projects`);
    }

    return objectives;
  }

  /**
   * Extract tags
   */
  private extractTags(docs: DocumentContent[]): string[] {
    const tags = new Set<string>();

    for (const doc of docs) {
      for (const tag of doc.metadata.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags);
  }

  /**
   * Group documents by category
   */
  private groupByCategory(docs: DocumentContent[]): Map<string, DocumentContent[]> {
    const groups = new Map<string, DocumentContent[]>();

    for (const doc of docs) {
      const category = doc.metadata.category || 'general';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(doc);
    }

    return groups;
  }

  /**
   * Format title
   */
  private formatTitle(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate quiz options
   */
  private generateQuizOptions(doc: DocumentContent): string[] {
    return [
      doc.metadata.description.substring(0, 50) + '...',
      'None of the above',
      'All of the above',
      'This option is incorrect'
    ];
  }

  /**
   * Load tutorial templates
   */
  private loadTemplates(): void {
    // Default templates would be loaded here
    this.templates.set('getting-started', {
      title: 'Getting Started',
      description: 'Introduction to the basics',
      difficulty: 'beginner',
      category: 'tutorial',
      tags: ['basics', 'introduction'],
      sections: []
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Save tutorial to file
   */
  async saveTutorial(tutorial: Tutorial): Promise<void> {
    const filePath = join(this.options.outputPath, `${tutorial.id}.json`);
    const dir = join(filePath, '..');

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify(tutorial, null, 2), 'utf-8');

    this.logger.info(`Tutorial saved: ${filePath}`);
  }

  /**
   * Generate tutorial progress report
   */
  generateProgressReport(
    tutorial: Tutorial,
    progress: TutorialProgress
  ): string {
    const completedSections = progress.completedSections.length;
    const totalSections = tutorial.sections.length;
    const percentage = (completedSections / totalSections) * 100;

    return `
# Progress Report: ${tutorial.metadata.title}

## Completion Status
${completedSections}/${totalSections} sections completed (${percentage.toFixed(1)}%)

## Completed Sections
${progress.completedSections.map(id => {
  const section = tutorial.sections.find(s => s.id === id);
  return `- ${section?.title || id}`;
}).join('\n')}

## Quiz Scores
${Object.entries(progress.quizScores).map(([quizId, score]) => {
  return `- ${quizId}: ${score}%`;
}).join('\n')}

## Time Spent
Started: ${progress.startedAt.toLocaleString()}
Last Accessed: ${progress.lastAccessedAt.toLocaleString()}
${progress.completedAt ? `Completed: ${progress.completedAt.toLocaleString()}` : ''}

Keep up the good work!
    `.trim();
  }
}

/**
 * Tutorial Player - Execute and track tutorial progress
 */
export class TutorialPlayer {
  private logger: Logger;
  private progress: Map<string, TutorialProgress>;

  constructor() {
    this.logger = new Logger('TutorialPlayer');
    this.progress = new Map();
  }

  /**
   * Start tutorial
   */
  async startTutorial(tutorial: Tutorial, userId: string): Promise<TutorialProgress> {
    const progress: TutorialProgress = {
      userId,
      tutorialId: tutorial.id,
      completedSections: [],
      currentSection: tutorial.sections[0]?.id,
      quizScores: {},
      startedAt: new Date(),
      lastAccessedAt: new Date()
    };

    this.progress.set(`${userId}:${tutorial.id}`, progress);

    this.logger.info(`User ${userId} started tutorial ${tutorial.id}`);
    return progress;
  }

  /**
   * Complete section
   */
  async completeSection(
    tutorial: Tutorial,
    userId: string,
    sectionId: string,
    answers?: Record<string, any>
  ): Promise<TutorialProgress> {
    const key = `${userId}:${tutorial.id}`;
    const progress = this.progress.get(key);

    if (!progress) {
      throw new Error('Tutorial not started');
    }

    // Mark section as completed
    if (!progress.completedSections.includes(sectionId)) {
      progress.completedSections.push(sectionId);
    }

    // Process quiz answers if provided
    if (answers) {
      const section = tutorial.sections.find(s => s.id === sectionId);
      if (section?.type === 'quiz' && section.contentData) {
        const quiz = section.contentData as QuizData;
        const score = this.calculateQuizScore(quiz, answers);
        progress.quizScores[sectionId] = score;
      }
    }

    // Move to next section
    const currentIndex = tutorial.sections.findIndex(s => s.id === sectionId);
    if (currentIndex < tutorial.sections.length - 1) {
      progress.currentSection = tutorial.sections[currentIndex + 1].id;
    } else {
      // Tutorial completed
      progress.completedAt = new Date();
      progress.currentSection = undefined;
    }

    progress.lastAccessedAt = new Date();

    this.logger.info(`User ${userId} completed section ${sectionId}`);
    return progress;
  }

  /**
   * Get progress
   */
  getProgress(tutorialId: string, userId: string): TutorialProgress | undefined {
    return this.progress.get(`${userId}:${tutorialId}`);
  }

  /**
   * Calculate quiz score
   */
  private calculateQuizScore(quiz: QuizData, answers: Record<string, any>): number {
    let correct = 0;
    let totalPoints = 0;

    for (const question of quiz.questions) {
      totalPoints += question.points;

      const userAnswer = answers[question.id];
      const correctAnswer = question.correctAnswer;

      if (Array.isArray(correctAnswer)) {
        if (Array.isArray(userAnswer) &&
            userAnswer.every(a => correctAnswer.includes(a))) {
          correct += question.points;
        }
      } else if (userAnswer === correctAnswer) {
        correct += question.points;
      }
    }

    return totalPoints > 0 ? (correct / totalPoints) * 100 : 0;
  }

  /**
   * Reset progress
   */
  resetProgress(tutorialId: string, userId: string): void {
    const key = `${userId}:${tutorialId}`;
    this.progress.delete(key);

    this.logger.info(`User ${userId} reset progress for tutorial ${tutorialId}`);
  }
}
