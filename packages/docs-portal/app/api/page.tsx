'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock, CodeTabs } from '@/components/docs/CodeBlock';
import { Callout } from '@/components/docs/Callout';
import { ApiExplorer } from '@/components/docs/ApiExplorer';
import type { APIEndpoint } from '@/types';

// ============================================================================
// API Endpoints Data
// ============================================================================

const apiEndpoints: APIEndpoint[] = [
  {
    id: 'chat-completions',
    method: 'POST',
    path: '/v1/chat/completions',
    summary: 'Create chat completion',
    description: 'Creates a model response for the given chat conversation.',
    parameters: [],
    requestBody: {
      description: 'Request body for chat completion',
      required: true,
      content: {
        'application/json': {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: {
              type: 'array',
              description: 'A list of messages comprising the conversation',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                  content: { type: 'string' },
                },
                required: ['role', 'content'],
              },
            },
            model: {
              type: 'string',
              description: 'ID of the model to use',
              default: 'auto',
            },
            temperature: {
              type: 'number',
              description: 'Sampling temperature to use',
              minimum: 0,
              maximum: 2,
              default: 0.7,
            },
            max_tokens: {
              type: 'integer',
              description: 'Maximum tokens to generate',
              default: 2048,
            },
            stream: {
              type: 'boolean',
              description: 'Enable streaming',
              default: false,
            },
          },
        },
      },
    },
    responses: [
      {
        statusCode: 200,
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                object: { type: 'string', enum: ['chat.completion'] },
                created: { type: 'integer' },
                model: { type: 'string' },
                choices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'integer' },
                      message: {
                        type: 'object',
                        properties: {
                          role: { type: 'string' },
                          content: { type: 'string' },
                        },
                      },
                      finish_reason: { type: 'string' },
                    },
                  },
                },
                usage: {
                  type: 'object',
                  properties: {
                    prompt_tokens: { type: 'integer' },
                    completion_tokens: { type: 'integer' },
                    total_tokens: { type: 'integer' },
                  },
                },
              },
            },
            example: {
              id: 'chatcmpl-abc123',
              object: 'chat.completion',
              created: 1234567890,
              model: 'llama-2-70b-chat',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: 'Hello! How can I help you today?',
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 9,
                total_tokens: 19,
              },
            },
          },
        },
      },
    ],
    examples: [
      {
        title: 'Basic Request',
        request: {
          method: 'POST',
          url: 'https://api.claudeflare.com/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'your-api-key',
          },
          body: {
            messages: [
              { role: 'user', content: 'Hello, ClaudeFlare!' },
            ],
          },
        },
        response: {
          statusCode: 200,
          body: {
            id: 'chatcmpl-abc123',
            choices: [
              {
                message: { role: 'assistant', content: 'Hello! How can I help you?' },
              },
            ],
          },
        },
      },
    ],
    tags: ['chat', 'core'],
    authentication: true,
    rateLimit: {
      requests: 100,
      per: 'minute',
    },
  },
  {
    id: 'list-models',
    method: 'GET',
    path: '/v1/models',
    summary: 'List available models',
    description: 'Returns a list of available AI models that can be used.',
    parameters: [],
    responses: [
      {
        statusCode: 200,
        description: 'List of models',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                object: { type: 'string', enum: ['list'] },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      object: { type: 'string', enum: ['model'] },
                      created: { type: 'integer' },
                      owned_by: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
    examples: [],
    tags: ['models'],
    authentication: true,
    rateLimit: {
      requests: 60,
      per: 'minute',
    },
  },
];

// ============================================================================
// API Reference Page Component
// ============================================================================

export default function APIReferencePage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint>(apiEndpoints[0]);
  const [activeTab, setActiveTab] = useState<'overview' | 'request' | 'response' | 'examples'>('overview');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Complete reference documentation for the ClaudeFlare REST API
        </p>
      </div>

      {/* Quick Start */}
      <div className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
        <p className="text-muted-foreground mb-4">
          All API requests require your API key to be sent in the <code>X-API-Key</code> header:
        </p>
        <CodeBlock
          code={`curl https://api.claudeflare.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`}
          language="bash"
        />
      </div>

      <Callout type="info" content="The base URL for all API requests is https://api.claudeflare.com" />

      {/* API Endpoints */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div>
            <h3 className="text-2xl font-semibold mb-4">Available Endpoints</h3>
            <div className="space-y-2">
              {apiEndpoints.map((endpoint) => (
                <button
                  key={endpoint.id}
                  onClick={() => setSelectedEndpoint(endpoint)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedEndpoint.id === endpoint.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono font-semibold ${
                        endpoint.method === 'GET'
                          ? 'bg-green-500/10 text-green-500'
                          : endpoint.method === 'POST'
                          ? 'bg-blue-500/10 text-blue-500'
                          : endpoint.method === 'PUT'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : endpoint.method === 'DELETE'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm">{endpoint.path}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {endpoint.summary}
                      </div>
                    </div>
                    {endpoint.rateLimit && (
                      <div className="text-xs text-muted-foreground">
                        {endpoint.rateLimit.requests}/{endpoint.rateLimit.per}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Request Tab */}
        <TabsContent value="request" className="space-y-6 mt-6">
          <div>
            <h3 className="text-2xl font-semibold mb-4">
              {selectedEndpoint.method} {selectedEndpoint.path}
            </h3>
            <p className="text-muted-foreground mb-6">{selectedEndpoint.description}</p>

            {/* Authentication */}
            {selectedEndpoint.authentication && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                <h4 className="font-semibold text-blue-500 mb-2">Authentication Required</h4>
                <p className="text-sm text-muted-foreground">
                  Include your API key in the <code>X-API-Key</code> header
                </p>
                <CodeBlock
                  code={`X-API-Key: your-api-key`}
                  language="http"
                  className="mt-3"
                />
              </div>
            )}

            {/* Request Parameters */}
            {selectedEndpoint.parameters.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Parameters</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">In</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Required</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEndpoint.parameters.map((param, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-4 py-3 text-sm font-mono">{param.name}</td>
                          <td className="px-4 py-3 text-sm">{param.schema.type}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-0.5 rounded bg-muted text-xs">
                              {param.in}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {param.required ? (
                              <span className="text-green-500">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {param.schema.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Request Body */}
            {selectedEndpoint.requestBody && (
              <div>
                <h4 className="font-semibold mb-3">Request Body</h4>
                <div className="mb-4 text-sm text-muted-foreground">
                  {selectedEndpoint.requestBody.description}
                </div>
                <CodeTabs
                  tabs={[
                    {
                      label: 'JSON Schema',
                      code: JSON.stringify(
                        selectedEndpoint.requestBody.content['application/json'],
                        null,
                        2
                      ),
                      language: 'json',
                    },
                    {
                      label: 'Example',
                      code: JSON.stringify(
                        {
                          messages: [
                            {
                              role: 'user',
                              content: 'Hello, ClaudeFlare!',
                            },
                          ],
                          model: 'auto',
                          temperature: 0.7,
                        },
                        null,
                        2
                      ),
                      language: 'json',
                    },
                  ]}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Response Tab */}
        <TabsContent value="response" className="space-y-6 mt-6">
          <div>
            <h3 className="text-2xl font-semibold mb-4">Response</h3>

            {selectedEndpoint.responses.map((response) => (
              <div key={response.statusCode} className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-md text-sm font-mono font-semibold ${
                      response.statusCode >= 200 && response.statusCode < 300
                        ? 'bg-green-500/10 text-green-500'
                        : response.statusCode >= 400 && response.statusCode < 500
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {response.statusCode}
                  </span>
                  <span className="text-muted-foreground">{response.description}</span>
                </div>

                {response.content?.['application/json'] && (
                  <CodeBlock
                    code={JSON.stringify(
                      response.content['application/json'].example || {},
                      null,
                      2
                    )}
                    language="json"
                  />
                )}
              </div>
            ))}

            {/* Error Responses */}
            <div className="mt-8">
              <h4 className="font-semibold mb-3">Error Responses</h4>
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-sm font-mono">
                      401
                    </span>
                    <span className="font-medium">Unauthorized</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Invalid or missing API key
                  </p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        error: {
                          code: 'INVALID_API_KEY',
                          message: 'The API key provided is invalid',
                        },
                      },
                      null,
                      2
                    )}
                    language="json"
                  />
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 text-sm font-mono">
                      429
                    </span>
                    <span className="font-medium">Rate Limited</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Too many requests
                  </p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        error: {
                          code: 'RATE_LIMIT_EXCEEDED',
                          message: 'Rate limit exceeded',
                          retry_after: 60,
                        },
                      },
                      null,
                      2
                    )}
                    language="json"
                  />
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-sm font-mono">
                      500
                    </span>
                    <span className="font-medium">Server Error</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Internal server error
                  </p>
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        error: {
                          code: 'INTERNAL_ERROR',
                          message: 'An internal error occurred',
                        },
                      },
                      null,
                      2
                    )}
                    language="json"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-6 mt-6">
          <div>
            <h3 className="text-2xl font-semibold mb-4">Code Examples</h3>

            <CodeTabs
              tabs={[
                {
                  label: 'JavaScript',
                  code: `import { ClaudeFlare } from '@claudeflare/sdk';

const client = new ClaudeFlare({
  apiKey: process.env.CLAUDEFLARE_API_KEY
});

const response = await client.chat.completions.create({
  messages: [
    { role: 'user', content: 'Hello, ClaudeFlare!' }
  ]
});

console.log(response.choices[0].message.content);`,
                  language: 'javascript',
                },
                {
                  label: 'Python',
                  code: `import claudeflare

client = claudeflare.Client(
    api_key=os.getenv('CLAUDEFLARE_API_KEY')
)

response = client.chat.completions.create(
    messages=[
        {"role": "user", "content": "Hello, ClaudeFlare!"}
    ]
)

print(response.choices[0].message.content)`,
                  language: 'python',
                },
                {
                  label: 'Go',
                  code: `package main

import (
    "context"
    "fmt"
    "github.com/claudeflare/claudeflare-go"
)

func main() {
    client := claudeflare.NewClient("your-api-key")

    resp, err := client.Chat.Create(context.Background(), &claudeflare.ChatRequest{
        Messages: []claudeflare.Message{
            {Role: "user", Content: "Hello, ClaudeFlare!"},
        },
    })

    if err != nil {
        panic(err)
    }

    fmt.Println(resp.Choices[0].Message.Content)
}`,
                  language: 'go',
                },
                {
                  label: 'cURL',
                  code: `curl https://api.claudeflare.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, ClaudeFlare!"}
    ]
  }'`,
                  language: 'bash',
                },
              ]}
            />

            {/* Streaming Example */}
            <div className="mt-8">
              <h4 className="font-semibold mb-3">Streaming Example</h4>
              <CodeTabs
                tabs={[
                  {
                    label: 'JavaScript',
                    code: `const stream = await client.chat.completions.stream({
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}`,
                    language: 'javascript',
                  },
                  {
                    label: 'Python',
                    code: `stream = await client.chat.completions.stream(
    messages=[
        {"role": "user", "content": "Tell me a story"}
    ],
    stream=True
)

async for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end='', flush=True)`,
                    language: 'python',
                  },
                ]}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Interactive API Explorer */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Interactive Explorer</h2>
        <ApiExplorer endpoint={selectedEndpoint} />
      </div>
    </div>
  );
}
