/**
 * Chat Completions Example
 *
 * Demonstrates basic and advanced usage of the chat completions API
 */

import { ClaudeFlare } from '../src/index.js';

// Initialize client
const client = new ClaudeFlare({
  apiKey: process.env.CLAUDEFLARE_API_KEY || 'your-api-key',
  baseURL: 'http://localhost:8787', // Use local development server
  debug: true,
});

// Example 1: Simple chat completion
async function simpleChat() {
  console.log('\n=== Simple Chat ===\n');

  const response = await client.chat.completions.create({
    messages: [
      { role: 'user', content: 'What is Cloudflare Workers?' },
    ],
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 1000,
  });

  console.log('Response:', response.content);
  console.log('Usage:', response.usage);
}

// Example 2: Multi-turn conversation
async function multiTurnConversation() {
  console.log('\n=== Multi-turn Conversation ===\n');

  const messages = [
    { role: 'system' as const, content: 'You are a helpful coding assistant.' },
    { role: 'user' as const, content: 'What is TypeScript?' },
  ];

  // First turn
  const response1 = await client.chat.completions.create({
    messages,
    temperature: 0.7,
  });

  console.log('Assistant:', response1.content);

  // Add assistant response to conversation
  messages.push({ role: 'assistant' as const, content: response1.content });

  // Second turn
  messages.push({ role: 'user' as const, content: 'Can you show me an example?' });

  const response2 = await client.chat.completions.create({
    messages,
    temperature: 0.7,
  });

  console.log('Assistant:', response2.content);
}

// Example 3: Streaming chat completion
async function streamingChat() {
  console.log('\n=== Streaming Chat ===\n');

  let fullResponse = '';

  await client.chat.completions.createStream(
    {
      messages: [
        { role: 'user', content: 'Explain quantum computing in simple terms' },
      ],
      stream: true,
      temperature: 0.7,
    },
    (event) => {
      if (event.type === 'content' && event.content) {
        process.stdout.write(event.content);
        fullResponse += event.content;
      }

      if (event.type === 'done') {
        console.log('\n\nStream complete!');
      }
    }
  );
}

// Example 4: Using ReadableStream
async function readableStreamChat() {
  console.log('\n=== ReadableStream Chat ===\n');

  const stream = client.chat.completions.stream({
    messages: [
      { role: 'user', content: 'Tell me a short story about AI' },
    ],
    stream: true,
    temperature: 0.8,
  });

  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    if (value.type === 'content' && value.content) {
      process.stdout.write(value.content);
    }
  }

  console.log('\n\nStory complete!');
}

// Example 5: Using different providers
async function differentProviders() {
  console.log('\n=== Different Providers ===\n');

  const providers = ['anthropic', 'openai', 'groq'] as const;

  for (const provider of providers) {
    console.log(`\n--- Using ${provider} ---\n`);

    try {
      const response = await client.chat.completions.create({
        messages: [
          { role: 'user', content: 'Say hello from ' + provider },
        ],
        provider,
        temperature: 0.7,
      });

      console.log(response.content);
    } catch (error) {
      console.error(`Error with ${provider}:`, error);
    }
  }
}

// Example 6: Function calling (when available)
async function functionCalling() {
  console.log('\n=== Function Calling ===\n');

  const response = await client.chat.completions.create({
    messages: [
      { role: 'user', content: 'What is the weather in San Francisco?' },
    ],
    tools: [
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
      },
    ],
    toolChoice: 'auto',
  });

  console.log('Response:', response.content);

  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log('\nTool Calls:', response.toolCalls);
  }
}

// Example 7: Error handling
async function errorHandling() {
  console.log('\n=== Error Handling ===\n');

  try {
    const response = await client.chat.completions.create({
      messages: [
        { role: 'user', content: 'Hello' },
      ],
      model: 'non-existent-model',
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      console.error('Model not found:', error.message);
    } else if (error.name === 'AuthenticationError') {
      console.error('Authentication failed:', error.message);
    } else if (error.name === 'RateLimitError') {
      console.error('Rate limit exceeded:', error.message);
      console.error('Retry after:', error.retryAfter);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Run all examples
async function main() {
  try {
    await simpleChat();
    await multiTurnConversation();
    await streamingChat();
    await readableStreamChat();
    await differentProviders();
    await functionCalling();
    await errorHandling();
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  simpleChat,
  multiTurnConversation,
  streamingChat,
  readableStreamChat,
  differentProviders,
  functionCalling,
  errorHandling,
};
