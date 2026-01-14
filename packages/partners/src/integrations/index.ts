/**
 * Integrations Module
 */

export { IntegrationRegistry, getRegistry, templates } from './registry';
export { IntegrationManager } from './manager';

// Re-export templates
export { githubTemplate } from './templates/github';
export { gitlabTemplate } from './templates/gitlab';
export { slackTemplate } from './templates/slack';
export { jiraTemplate } from './templates/jira';
export { linearTemplate } from './templates/linear';
export { discordTemplate } from './templates/discord';
export { notionTemplate } from './templates/notion';
export { bitbucketTemplate } from './templates/bitbucket';
export { azureDevOpsTemplate } from './templates/azure-devops';
export { jenkinsTemplate } from './templates/jenkins';
export { circleciTemplate } from './templates/circleci';
export { sonarqubeTemplate } from './templates/sonarqube';
export { confluenceTemplate } from './templates/confluence';
export { teamsTemplate } from './templates/teams';
export { asanaTemplate } from './templates/asana';
export { trelloTemplate } from './templates/trello';
export { mondayTemplate } from './templates/monday';
export { giteaTemplate } from './templates/gitea';
export { mattermostTemplate } from './templates/mattermost';

export type {
  IntegrationTemplate,
  TemplateAction,
  TemplateTrigger,
  TemplateConfiguration,
  TemplatePermission,
  TemplateExample,
  ValidationRule,
  IntegrationInstance
} from '../types';

export type { IntegrationInstance } from './manager';
