/**
 * Diagram Generator - Create architecture and class diagrams
 */

import { Logger } from '../utils/logger.js';
import { DocumentContent } from '../types/index.js';

export class DiagramGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DiagramGenerator');
  }

  /**
   * Generate class diagram from document
   */
  async generateClassDiagram(doc: DocumentContent): Promise<string | null> {
    try {
      const diagram = this.buildClassDiagram(doc);
      return this.renderMermaid(diagram);
    } catch (error) {
      this.logger.warn('Failed to generate class diagram', error);
      return null;
    }
  }

  /**
   * Generate architecture diagram
   */
  async generateArchitectureDiagram(docs: DocumentContent[]): Promise<string | null> {
    try {
      const diagram = this.buildArchitectureDiagram(docs);
      return this.renderMermaid(diagram);
    } catch (error) {
      this.logger.warn('Failed to generate architecture diagram', error);
      return null;
    }
  }

  /**
   * Build class diagram
   */
  private buildClassDiagram(doc: DocumentContent): string {
    let diagram = 'classDiagram\n';

    // Extract classes from content
    const classRegex = /class\s+(\w+)/g;
    const classes = new Set<string>();
    let match;
    while ((match = classRegex.exec(doc.content)) !== null) {
      classes.add(match[1]);
    }

    // Add class definitions
    for (const cls of classes) {
      diagram += `  class ${cls} {\n`;
      diagram += `    +${cls}Method()\n`;
      diagram += `  }\n`;
    }

    // Add relationships
    const extendsRegex = /(\w+)\s+extends\s+(\w+)/g;
    while ((match = extendsRegex.exec(doc.content)) !== null) {
      diagram += `  ${match[1]} --|> ${match[2]}\n`;
    }

    return diagram;
  }

  /**
   * Build architecture diagram
   */
  private buildArchitectureDiagram(docs: DocumentContent[]): string {
    let diagram = 'graph TD\n';

    // Group by category
    const byCategory = new Map<string, DocumentContent[]>();
    for (const doc of docs) {
      const cat = doc.metadata.category || 'general';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(doc);
    }

    // Add nodes
    let id = 0;
    for (const [category, documents] of byCategory.entries()) {
      diagram += `  subgraph ${category}\n`;
      for (const doc of documents) {
        const nodeId = `node${id++}`;
        diagram += `    ${nodeId}[${doc.metadata.title}]\n`;
      }
      diagram += `  end\n`;
    }

    return diagram;
  }

  /**
   * Render Mermaid diagram
   */
  private renderMermaid(diagram: string): string {
    return `
<div class="mermaid">
${diagram}
</div>
    `.trim();
  }
}
