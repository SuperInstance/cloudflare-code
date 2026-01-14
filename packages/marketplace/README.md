# @claudeflare/marketplace

A comprehensive AI Agent Marketplace for ClaudeFlare - enabling the discovery, creation, testing, and sharing of AI agents.

## Features

### 🎨 Agent Templates
- **Pre-built Templates**: Ready-to-use templates for common agent types
- **Custom Scaffolding**: Generate agent code structure from templates
- **Template Customization**: Personalize templates with your own settings
- **Template Categories**: Code assistants, data analysts, writing assistants, automation agents, and more

### 🔧 Agent Builder
- **Visual Builder**: Create agents through an intuitive interface
- **Code-Based Builder**: Build agents programmatically
- **Tool Integration**: Add custom tools and capabilities
- **Prompt Management**: Define and customize agent prompts
- **Performance Profiling**: Monitor agent performance during development

### 🚀 Publishing Platform
- **Semantic Versioning**: Proper version management for agents
- **Release Management**: Create and manage agent releases
- **Changelog Generation**: Automatic changelog creation
- **Deprecation Workflows**: Handle agent deprecation gracefully
- **Publishing Pipeline**: Validation → Testing → Review → Publishing

### 🔍 Discovery and Search
- **Full-Text Search**: Search agents by name, description, tags
- **Advanced Filtering**: Filter by category, capability, permissions, rating
- **Fuzzy Search**: Find agents even with typos
- **Recommendations**: Get personalized agent recommendations
- **Trending Agents**: Discover what's popular and new

### ✅ Validation and Testing
- **Code Validation**: Syntax, semantics, security checks
- **Best Practices**: Ensure your agents follow best practices
- **Automated Testing**: Run test suites on your agents
- **Benchmarking**: Measure agent performance
- **Quality Metrics**: Get comprehensive quality scores

### 👥 Community Features
- **Social Sharing**: Share agents on Twitter, GitHub, LinkedIn
- **Comments and Discussions**: Engage with the community
- **Reviews and Ratings**: Rate and review agents
- **Forking**: Fork and customize existing agents
- **Collections**: Organize agents into collections
- **User Profiles**: Showcase your published agents

## Installation

```bash
npm install @claudeflare/marketplace
```

## Quick Start

### Creating Your First Agent

```typescript
import { createAgentBuilder, AgentCategory } from '@claudeflare/marketplace';

// Create a builder
const builder = createAgentBuilder({
  name: 'My Code Assistant',
  description: 'An AI assistant that helps with coding tasks',
  category: AgentCategory.CODE_ASSISTANT
});

// Customize the agent
builder
  .withVersion('1.0.0')
  .withCapability(AgentCapability.CODE_GENERATION)
  .withPermission(AgentPermission.READ)
  .addTool('syntax-check', 'Checks code syntax', 'syntaxChecker')
  .withPrompt('default', {
    system: 'You are a helpful coding assistant.',
    user: 'How can I help with your code today?'
  });

// Build the agent
const result = await builder.build();

if (result.success) {
  console.log('Agent built successfully!');
  console.log(result.agent);
}
```

### Using Templates

```typescript
import { createTemplateManager } from '@claudeflare/marketplace';

const templateManager = createTemplateManager();

// List available templates
const templates = templateManager.listTemplates();
console.log('Available templates:', templates);

// Scaffold from a template
const agent = templateManager.generateAgentFromTemplate(
  'code-assistant-basic',
  {
    language: 'typescript',
    expertise: 'advanced'
  }
);

console.log('Generated agent:', agent);
```

### Publishing an Agent

```typescript
import { ClaudeFlareMarketplace } from '@claudeflare/marketplace';

const marketplace = new ClaudeFlareMarketplace();

// Publish your agent
const result = await marketplace.publishAgent(agent, {
  releaseNotes: 'Initial release of my awesome agent',
  notifyFollowers: true,
  createTag: true
});

if (result.success) {
  console.log('Agent published at:', result.url);
}
```

### Searching for Agents

```typescript
import { ClaudeFlareMarketplace } from '@claudeflare/marketplace';

const marketplace = new ClaudeFlareMarketplace();

// Search for agents
const results = await marketplace.searchAgents({
  query: 'code assistant',
  filters: {
    category: AgentCategory.CODE_ASSISTANT,
    rating: { min: 4.0 }
  },
  sort: {
    field: 'rating',
    order: 'desc'
  },
  pagination: {
    page: 1,
    limit: 20
  }
});

console.log('Found agents:', results.items);
console.log('Total:', results.total);
```

### Getting Recommendations

```typescript
// Get similar agents
const recommendations = await marketplace.recommendAgents('agent-id', {
  weights: {
    category: 10,
    capability: 5,
    rating: 2
  },
  boostPopular: true,
  boostRated: true
});

recommendations.forEach(rec => {
  console.log(`${rec.agent.config.name}: ${rec.score}`);
  console.log('Reasons:', rec.reasons);
});
```

### Validating an Agent

```typescript
import { createValidator } from '@claudeflare/marketplace';

const validator = createValidator();

const report = await validator.validate(agent, {
  checkSyntax: true,
  checkSecurity: true,
  checkPerformance: true,
  checkBestPractices: true
});

if (report.valid) {
  console.log('Agent is valid!');
} else {
  console.log('Issues found:');
  report.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
  });
}

console.log('Quality metrics:', report.metrics);
```

### Community Features

```typescript
// Share an agent
const shareResult = await marketplace.shareAgent(agent, {
  platform: 'twitter',
  message: 'Check out my new AI agent!'
});

// Fork an agent
const fork = await marketplace.forkAgent(
  'agent-id',
  'user-id',
  ['Added new features', 'Improved performance']
);

// Add a comment
const comment = await marketplace.addComment(
  'agent-id',
  'user-id',
  'Great agent! Very helpful.'
);

// Add a review
const review = await marketplace.addReview(
  'agent-id',
  'user-id',
  5,
  'Excellent!',
  'This agent helped me a lot with my tasks.'
);

// Create a collection
const collection = await marketplace['collectionService'].createCollection(
  'user-id',
  'My Favorite Agents',
  'A collection of agents I use regularly'
);
```

## API Reference

### Core Classes

#### `ClaudeFlareMarketplace`
Main marketplace class that provides access to all marketplace features.

**Methods:**
- `getTemplateManager()`: Get the template manager
- `getSearchEngine()`: Get the search engine
- `getPublishingManager()`: Get the publishing manager
- `getValidator()`: Get the validator
- `searchAgents(options)`: Search for agents
- `publishAgent(agent, options)`: Publish an agent
- `validateAgent(agent, options)`: Validate an agent

#### `AgentTemplateManager`
Manages agent templates.

**Methods:**
- `listTemplates()`: List all templates
- `getTemplate(id)`: Get a specific template
- `generateAgentFromTemplate(id, customizations)`: Generate agent from template
- `scaffoldFromTemplate(id, path, customizations)`: Scaffold project from template

#### `AgentBuilder`
Build custom agents programmatically.

**Methods:**
- `withDescription(description)`: Set agent description
- `withVersion(version)`: Set agent version
- `withCapability(capability)`: Add capability
- `withPermission(permission)`: Add permission
- `addTool(name, description, handler)`: Add tool
- `withPrompt(name, prompt)`: Add prompt
- `build()`: Build the agent

#### `AgentSearchEngine`
Search and discover agents.

**Methods:**
- `search(options)`: Search agents
- `recommend(agentId, options)`: Get recommendations
- `getTrending(limit)`: Get trending agents
- `getPopular(limit)`: Get popular agents
- `getTopRated(limit, minRating)`: Get top-rated agents

#### `AgentValidator`
Validate and test agents.

**Methods:**
- `validate(agent, options)`: Validate agent
- `runTest(agent, testCase)`: Run a test
- `runSuite(agent, testSuite)`: Run test suite

### Types

#### `Agent`
Represents an AI agent with metadata, configuration, and code.

#### `AgentConfig`
Configuration for an agent including name, description, capabilities, tools, etc.

#### `SearchOptions`
Options for searching agents.

#### `ValidationOptions`
Options for validating agents.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT

## Support

- GitHub Issues: [https://github.com/claudeflare/marketplace/issues](https://github.com/claudeflare/marketplace/issues)
- Documentation: [https://docs.claudeflare.com/marketplace](https://docs.claudeflare.com/marketplace)
- Discord: [https://discord.gg/claudeflare](https://discord.gg/claudeflare)
