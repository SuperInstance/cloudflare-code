/**
 * Integration Registry
 * Central registry for all integration templates
 */

import { IntegrationTemplate } from '../types';

// Import all templates
import { githubTemplate } from './templates/github';
import { gitlabTemplate } from './templates/gitlab';
import { slackTemplate } from './templates/slack';
import { jiraTemplate } from './templates/jira';
import { linearTemplate } from './templates/linear';
import { discordTemplate } from './templates/discord';
import { notionTemplate } from './templates/notion';
import { bitbucketTemplate } from './templates/bitbucket';
import { azureDevOpsTemplate } from './templates/azure-devops';
import { jenkinsTemplate } from './templates/jenkins';
import { circleciTemplate } from './templates/circleci';
import { sonarqubeTemplate } from './templates/sonarqube';
import { confluenceTemplate } from './templates/confluence';
import { teamsTemplate } from './templates/teams';
import { asanaTemplate } from './templates/asana';
import { trelloTemplate } from './templates/trello';
import { mondayTemplate } from './templates/monday';
import { giteaTemplate } from './templates/gitea';
import { mattermostTemplate } from './templates/mattermost';

export class IntegrationRegistry {
  private templates: Map<string, IntegrationTemplate> = new Map();

  constructor() {
    this.registerTemplates();
  }

  /**
   * Register all integration templates
   */
  private registerTemplates(): void {
    // Git Platforms
    this.register(githubTemplate);
    this.register(gitlabTemplate);
    this.register(bitbucketTemplate);
    this.register(giteaTemplate);

    // CI/CD
    this.register(azureDevOpsTemplate);
    this.register(jenkinsTemplate);
    this.register(circleciTemplate);

    // Project Management
    this.register(jiraTemplate);
    this.register(linearTemplate);
    this.register(asanaTemplate);
    this.register(trelloTemplate);
    this.register(mondayTemplate);

    // Communication
    this.register(slackTemplate);
    this.register(discordTemplate);
    this.register(teamsTemplate);
    this.register(mattermostTemplate);

    // Documentation
    this.register(notionTemplate);
    this.register(confluenceTemplate);

    // Code Quality
    this.register(sonarqubeTemplate);
  }

  /**
   * Register a template
   */
  public register(template: IntegrationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get template by ID
   */
  public get(id: string): IntegrationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  public getAll(): IntegrationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  public getByCategory(category: string): IntegrationTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search templates
   */
  public search(query: string): IntegrationTemplate[] {
    const lowerQuery = query.toLowerCase();

    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get featured templates
   */
  public getFeatured(): IntegrationTemplate[] {
    return this.getAll().filter(t => t.id === 'github' || t.id === 'slack' || t.id === 'jira');
  }

  /**
   * Get template count
   */
  public count(): number {
    return this.templates.size;
  }

  /**
   * Get categories
   */
  public getCategories(): string[] {
    const categories = new Set(this.getAll().map(t => t.category));
    return Array.from(categories);
  }

  /**
   * Get category stats
   */
  public getCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const template of this.getAll()) {
      stats[template.category] = (stats[template.category] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
let registryInstance: IntegrationRegistry | undefined;

export function getRegistry(): IntegrationRegistry {
  if (!registryInstance) {
    registryInstance = new IntegrationRegistry();
  }
  return registryInstance;
}

// Export for convenience
export const templates = {
  github: githubTemplate,
  gitlab: gitlabTemplate,
  slack: slackTemplate,
  jira: jiraTemplate,
  linear: linearTemplate,
  discord: discordTemplate,
  notion: notionTemplate,
  bitbucket: bitbucketTemplate,
  azureDevops: azureDevOpsTemplate,
  jenkins: jenkinsTemplate,
  circleci: circleciTemplate,
  sonarqube: sonarqubeTemplate,
  confluence: confluenceTemplate,
  teams: teamsTemplate,
  asana: asanaTemplate,
  trello: trelloTemplate,
  monday: mondayTemplate,
  gitea: giteaTemplate,
  mattermost: mattermostTemplate
};
