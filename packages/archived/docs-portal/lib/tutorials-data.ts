// ============================================================================
// Tutorial Data
// ============================================================================

import type { TutorialMeta, VideoTutorial } from '@/types';

// ============================================================================
// Beginner Tutorials
// ============================================================================

export const beginnerTutorials: TutorialMeta[] = [
  {
    title: 'Getting Started with ClaudeFlare',
    description: 'Learn the basics of ClaudeFlare and set up your first project',
    slug: 'getting-started',
    category: 'Getting Started',
    tags: ['beginner', 'setup', 'introduction'],
    difficulty: 'beginner',
    estimatedTime: 10,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Understand what ClaudeFlare is',
      'Set up your development environment',
      'Create your first ClaudeFlare project',
      'Make your first API call',
    ],
  },
  {
    title: 'Your First Chat Completion',
    description: 'Create a simple chat application using the Chat API',
    slug: 'first-chat-completion',
    category: 'Getting Started',
    tags: ['beginner', 'chat', 'api'],
    difficulty: 'beginner',
    estimatedTime: 15,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Set up API authentication',
      'Make a chat completion request',
      'Handle the response',
      'Add conversation history',
    ],
    prerequisites: ['getting-started'],
  },
  {
    title: 'Understanding AI Model Routing',
    description: 'Learn how ClaudeFlare intelligently routes requests to different AI providers',
    slug: 'model-routing',
    category: 'Getting Started',
    tags: ['beginner', 'routing', 'models'],
    difficulty: 'beginner',
    estimatedTime: 12,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Understand multi-provider routing',
      'Configure routing strategies',
      'Monitor routing performance',
      'Optimize for cost or speed',
    ],
  },
  {
    title: 'Error Handling Best Practices',
    description: 'Learn how to handle errors and implement retry logic',
    slug: 'error-handling',
    category: 'Getting Started',
    tags: ['beginner', 'errors', 'reliability'],
    difficulty: 'beginner',
    estimatedTime: 10,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Understand common error types',
      'Implement retry logic',
      'Handle rate limits gracefully',
      'Log errors for debugging',
    ],
  },
  {
    title: 'Streaming Responses',
    description: 'Implement streaming responses for real-time AI interactions',
    slug: 'streaming-responses',
    category: 'Getting Started',
    tags: ['beginner', 'streaming', 'realtime'],
    difficulty: 'beginner',
    estimatedTime: 15,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Enable streaming in API requests',
      'Handle Server-Sent Events',
      'Display streaming responses',
      'Cancel ongoing streams',
    ],
  },
  {
    title: 'Working with System Prompts',
    description: 'Master the art of crafting effective system prompts',
    slug: 'system-prompts',
    category: 'Getting Started',
    tags: ['beginner', 'prompts', 'best-practices'],
    difficulty: 'beginner',
    estimatedTime: 12,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Understand system prompt role',
      'Craft effective prompts',
      'Use prompt templates',
      'Test and iterate on prompts',
    ],
  },
];

// ============================================================================
// Advanced Tutorials
// ============================================================================

export const advancedTutorials: TutorialMeta[] = [
  {
    title: 'Building Multi-Agent Workflows',
    description: 'Create sophisticated AI systems with multiple specialized agents',
    slug: 'multi-agent-workflows',
    category: 'Advanced',
    tags: ['advanced', 'agents', 'workflows'],
    difficulty: 'advanced',
    estimatedTime: 30,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Design multi-agent architectures',
      'Implement agent communication',
      'Coordinate agent tasks',
      'Handle agent failures',
    ],
    prerequisites: ['getting-started', 'first-chat-completion'],
  },
  {
    title: 'Custom Agent Development',
    description: 'Create custom agents with specialized capabilities',
    slug: 'custom-agents',
    category: 'Advanced',
    tags: ['advanced', 'agents', 'custom'],
    difficulty: 'advanced',
    estimatedTime: 25,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Define agent capabilities',
      'Implement agent logic',
      'Register custom agents',
      'Test agent behavior',
    ],
  },
  {
    title: 'Implementing RAG with ClaudeFlare',
    description: 'Build Retrieval-Augmented Generation systems',
    slug: 'rag-implementation',
    category: 'Advanced',
    tags: ['advanced', 'rag', 'vector-search'],
    difficulty: 'advanced',
    estimatedTime: 35,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Understand RAG architecture',
      'Implement vector embeddings',
      'Build semantic search',
      'Combine retrieval with generation',
    ],
  },
  {
    title: 'Fine-tuning Model Outputs',
    description: 'Techniques for controlling and improving model outputs',
    slug: 'fine-tuning-outputs',
    category: 'Advanced',
    tags: ['advanced', 'optimization', 'quality'],
    difficulty: 'advanced',
    estimatedTime: 20,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Use temperature effectively',
      'Control token usage',
      'Implement content filtering',
      'Optimize for quality',
    ],
  },
  {
    title: 'Building Production-Ready Applications',
    description: 'Best practices for deploying ClaudeFlare in production',
    slug: 'production-deployment',
    category: 'Advanced',
    tags: ['advanced', 'production', 'deployment'],
    difficulty: 'advanced',
    estimatedTime: 25,
    lastUpdated: '2024-01-15',
    version: '1.0.0',
    type: 'written',
    objectives: [
      'Implement proper error handling',
      'Set up monitoring and logging',
      'Optimize for performance',
      'Secure your API keys',
    ],
  },
];

// ============================================================================
// Video Tutorials
// ============================================================================

export const videoTutorials: VideoTutorial[] = [
  {
    id: 'intro-to-claudeflare',
    title: 'Introduction to ClaudeFlare',
    description: 'Get an overview of ClaudeFlare and its capabilities',
    thumbnail: '/videos/thumbnails/intro.jpg',
    duration: 600,
    youtubeId: 'claudeflare-intro',
    tags: ['introduction', 'overview'],
    category: 'Getting Started',
    difficulty: 'beginner',
    relatedDocs: ['/docs/getting-started/introduction'],
    chapters: [
      { title: 'What is ClaudeFlare', timestamp: 0 },
      { title: 'Key Features', timestamp: 60 },
      { title: 'Architecture Overview', timestamp: 180 },
      { title: 'Quick Start Demo', timestamp: 300 },
      { title: 'Next Steps', timestamp: 540 },
    ],
  },
  {
    id: 'chat-api-tutorial',
    title: 'Using the Chat API',
    description: 'Learn how to use the Chat API effectively',
    thumbnail: '/videos/thumbnails/chat-api.jpg',
    duration: 900,
    youtubeId: 'claudeflare-chat-api',
    tags: ['api', 'chat', 'tutorial'],
    category: 'API Reference',
    difficulty: 'beginner',
    relatedDocs: ['/docs/api-reference/chat-api'],
    chapters: [
      { title: 'API Basics', timestamp: 0 },
      { title: 'Authentication', timestamp: 120 },
      { title: 'Making Requests', timestamp: 240 },
      { title: 'Streaming Responses', timestamp: 480 },
      { title: 'Best Practices', timestamp: 720 },
    ],
  },
  {
    id: 'multi-agent-systems',
    title: 'Building Multi-Agent Systems',
    description: 'Advanced tutorial on creating multi-agent workflows',
    thumbnail: '/videos/thumbnails/multi-agent.jpg',
    duration: 1200,
    youtubeId: 'claudeflare-multi-agent',
    tags: ['advanced', 'agents', 'workflows'],
    category: 'Advanced',
    difficulty: 'advanced',
    relatedDocs: ['/docs/guides/multi-agent-workflows'],
    chapters: [
      { title: 'Agent Concepts', timestamp: 0 },
      { title: 'Design Patterns', timestamp: 180 },
      { title: 'Implementation', timestamp: 360 },
      { title: 'Real-world Example', timestamp: 600 },
      { title: 'Testing & Debugging', timestamp: 900 },
      { title: 'Performance Tips', timestamp: 1080 },
    ],
  },
];

// ============================================================================
// Interactive Examples
// ============================================================================

export const interactiveExamples = [
  {
    id: 'hello-world',
    title: 'Hello World',
    description: 'Your first ClaudeFlare API call',
    category: 'Getting Started',
    template: `// Your first ClaudeFlare API call
const response = await client.chat.completions.create({
  messages: [
    { role: 'user', content: 'Hello, ClaudeFlare!' }
  ]
});

console.log(response.choices[0].message.content);`,
    defaultCode: `// Your first ClaudeFlare API call
const response = await client.chat.completions.create({
  messages: [
    { role: 'user', content: 'Hello, ClaudeFlare!' }
  ]
});

console.log(response.choices[0].message.content);`,
    expectedOutput: 'Hello! How can I help you today?',
    hints: [
      'Make sure you have initialized the client with your API key',
      'The response contains a choices array with the AI response',
      'Access the message content using response.choices[0].message.content',
    ],
    tests: [
      {
        name: 'Response contains message',
        input: {},
        expectedOutput: { hasMessage: true },
        description: 'Check if the response contains a message',
      },
    ],
    difficulty: 'beginner',
  },
  {
    id: 'conversation-history',
    title: 'Conversation History',
    description: 'Maintain context across multiple messages',
    category: 'Getting Started',
    template: `// Maintain conversation history
const conversation = [
  { role: 'user', content: 'My name is Alice' },
  { role: 'assistant', content: 'Nice to meet you, Alice!' },
  { role: 'user', content: 'What is my name?' }
];

const response = await client.chat.completions.create({
  messages: conversation
});

console.log(response.choices[0].message.content);`,
    defaultCode: `// Maintain conversation history
const conversation = [
  { role: 'user', content: 'My name is Alice' },
  { role: 'assistant', content: 'Nice to meet you, Alice!' },
  { role: 'user', content: 'What is my name?' }
];

const response = await client.chat.completions.create({
  messages: conversation
});

console.log(response.choices[0].message.content);`,
    expectedOutput: 'Your name is Alice!',
    hints: [
      'Include previous messages in the conversation array',
      'Maintain the order: user -> assistant -> user',
      'The AI uses the conversation history to maintain context',
    ],
    tests: [],
    difficulty: 'beginner',
  },
  {
    id: 'streaming-example',
    title: 'Streaming Responses',
    description: 'Handle real-time streaming responses',
    category: 'Advanced',
    template: `// Stream responses in real-time
const stream = await client.chat.completions.stream({
  messages: [
    { role: 'user', content: 'Tell me a short story' }
  ],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}`,
    defaultCode: `// Stream responses in real-time
const stream = await client.chat.completions.stream({
  messages: [
    { role: 'user', content: 'Tell me a short story' }
  ],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}`,
    expectedOutput: 'Once upon a time...',
    hints: [
      'Set stream: true in the request',
      'Use for await...of to iterate over chunks',
      'Access delta.content for each chunk of text',
    ],
    tests: [],
    difficulty: 'intermediate',
  },
];

// ============================================================================
// Tutorial Categories
// ============================================================================

export const tutorialCategories = [
  { id: 'getting-started', title: 'Getting Started', icon: 'BookOpen', count: 6 },
  { id: 'api', title: 'API Reference', icon: 'Code', count: 8 },
  { id: 'guides', title: 'Guides', icon: 'Compass', count: 5 },
  { id: 'advanced', title: 'Advanced', icon: 'Zap', count: 5 },
  { id: 'videos', title: 'Video Tutorials', icon: 'Video', count: 15 },
  { id: 'interactive', title: 'Interactive Examples', icon: 'Play', count: 20 },
];

// ============================================================================
// Learning Paths
// ============================================================================

export const learningPaths = [
  {
    id: 'beginner-path',
    title: 'Beginner Path',
    description: 'Start your journey with ClaudeFlare',
    duration: 90,
    tutorials: [
      'getting-started',
      'first-chat-completion',
      'model-routing',
      'error-handling',
      'streaming-responses',
      'system-prompts',
    ],
  },
  {
    id: 'advanced-path',
    title: 'Advanced Path',
    description: 'Master advanced ClaudeFlare concepts',
    duration: 120,
    tutorials: [
      'multi-agent-workflows',
      'custom-agents',
      'rag-implementation',
      'fine-tuning-outputs',
      'production-deployment',
    ],
  },
];
