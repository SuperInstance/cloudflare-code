'use client';

import React, { useState } from 'react';
import { Search, Book, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const API_ENDPOINTS = [
  {
    category: 'Completions',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/completions',
        description: 'Create a completion',
        authentication: true,
      },
      {
        method: 'POST',
        path: '/v1/chat/completions',
        description: 'Create a chat completion',
        authentication: true,
      },
    ],
  },
  {
    category: 'Embeddings',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/embeddings',
        description: 'Create an embedding',
        authentication: true,
      },
    ],
  },
  {
    category: 'Models',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/models',
        description: 'List available models',
        authentication: true,
      },
      {
        method: 'GET',
        path: '/v1/models/{model_id}',
        description: 'Get model information',
        authentication: true,
      },
    ],
  },
  {
    category: 'Files',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/files',
        description: 'List files',
        authentication: true,
      },
      {
        method: 'POST',
        path: '/v1/files',
        description: 'Upload a file',
        authentication: true,
      },
      {
        method: 'DELETE',
        path: '/v1/files/{file_id}',
        description: 'Delete a file',
        authentication: true,
      },
    ],
  },
  {
    category: 'Fine-tuning',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/fine_tuning/jobs',
        description: 'Create a fine-tuning job',
        authentication: true,
      },
      {
        method: 'GET',
        path: '/v1/fine_tuning/jobs',
        description: 'List fine-tuning jobs',
        authentication: true,
      },
      {
        method: 'GET',
        path: '/v1/fine_tuning/jobs/{job_id}',
        description: 'Get fine-tuning job',
        authentication: true,
      },
    ],
  },
];

export default function ApiReferencePage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEndpoints = API_ENDPOINTS.map((category) => ({
    ...category,
    endpoints: category.endpoints.filter(
      (endpoint) =>
        endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.endpoints.length > 0);

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500';
      case 'POST':
        return 'bg-blue-500';
      case 'PUT':
        return 'bg-yellow-500';
      case 'PATCH':
        return 'bg-purple-500';
      case 'DELETE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">API Reference</h1>
            <p className="text-sm text-muted-foreground">
              Complete API documentation for ClaudeFlare
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="space-y-6">
          {filteredEndpoints.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  {category.category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.endpoints.map((endpoint) => (
                    <AccordionItem key={endpoint.path} value={endpoint.path}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <Badge
                            className={`${getMethodColor(endpoint.method)} text-white`}
                          >
                            {endpoint.method}
                          </Badge>
                          <code className="text-sm font-mono">
                            {endpoint.path}
                          </code>
                          <span className="text-sm text-muted-foreground">
                            {endpoint.description}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Description</h4>
                            <p className="text-sm text-muted-foreground">
                              {endpoint.description}
                            </p>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Authentication</h4>
                            {endpoint.authentication ? (
                              <Badge variant="default">Required</Badge>
                            ) : (
                              <Badge variant="outline">Not Required</Badge>
                            )}
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Try it out</h4>
                            <a
                              href={`/playground?method=${endpoint.method}&endpoint=${encodeURIComponent(endpoint.path)}`}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              Open in Playground
                              <ChevronRight className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
