'use client'

import React, { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'

interface ApiRequest {
  endpoint: string
  method: string
  headers: Record<string, string>
  body: any
}

interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
  latency: number
}

interface ApiExplorerProps {
  baseUrl?: string
  defaultApiKey?: string
}

export default function ApiExplorer({
  baseUrl = 'https://api.claudeflare.com/v1',
  defaultApiKey = ''
}: ApiExplorerProps) {
  const [apiKey, setApiKey] = useState(defaultApiKey)
  const [selectedEndpoint, setSelectedEndpoint] = useState('chat')
  const [requestBody, setRequestBody] = useState(`{
  "messages": [
    {
      "role": "user",
      "content": "Hello, ClaudeFlare!"
    }
  ],
  "model": "auto",
  "temperature": 0.7
}`)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const endpoints = [
    {
      id: 'chat',
      name: 'Chat Completion',
      method: 'POST',
      path: '/v1/chat',
      description: 'Generate chat completions with multi-provider routing'
    },
    {
      id: 'stream',
      name: 'Streaming Chat',
      method: 'POST',
      path: '/v1/chat/stream',
      description: 'Generate real-time streaming completions'
    },
    {
      id: 'agents',
      name: 'Agent Orchestration',
      method: 'POST',
      path: '/v1/agents/orchestrate',
      description: 'Execute multi-agent workflows'
    },
    {
      id: 'models',
      name: 'List Models',
      method: 'GET',
      path: '/v1/models',
      description: 'List available AI models'
    },
    {
      id: 'embeddings',
      name: 'Generate Embeddings',
      method: 'POST',
      path: '/v1/embeddings',
      description: 'Generate text embeddings for semantic search'
    }
  ]

  const handleSendRequest = async () => {
    setLoading(true)
    const startTime = Date.now()

    try {
      const endpoint = endpoints.find(e => e.id === selectedEndpoint)!
      const url = `${baseUrl}${endpoint.path.replace('/v1', '')}`

      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey })
        }
      }

      if (endpoint.method === 'POST' && requestBody) {
        options.body = requestBody
      }

      const res = await fetch(url, options)
      const latency = Date.now() - startTime

      const data = await res.json()

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        data,
        latency
      })
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        data: { error: error.message },
        latency: Date.now() - startTime
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="api-explorer">
      <div className="api-explorer-header">
        <h2>API Explorer</h2>
        <p>Test ClaudeFlare APIs directly from your browser</p>
      </div>

      <div className="api-explorer-config">
        <div className="config-item">
          <label>API Key (optional for testing):</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="cf-prod-your-key-here"
          />
        </div>
      </div>

      <div className="api-explorer-endpoints">
        <h3>Select Endpoint</h3>
        <div className="endpoint-list">
          {endpoints.map((endpoint) => (
            <div
              key={endpoint.id}
              className={`endpoint-item ${selectedEndpoint === endpoint.id ? 'active' : ''}`}
              onClick={() => setSelectedEndpoint(endpoint.id)}
            >
              <div className="endpoint-method">{endpoint.method}</div>
              <div className="endpoint-path">{endpoint.path}</div>
              <div className="endpoint-name">{endpoint.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="api-explorer-request">
        <h3>Request</h3>
        {endpoints.find(e => e.id === selectedEndpoint)?.method === 'POST' && (
          <div className="request-body">
            <CodeMirror
              value={requestBody}
              height="200px"
              extensions={[javascript(), json()]}
              onChange={(value) => setRequestBody(value)}
            />
          </div>
        )}
        <button
          onClick={handleSendRequest}
          disabled={loading}
          className="send-request-btn"
        >
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>

      {response && (
        <div className="api-explorer-response">
          <h3>Response</h3>
          <div className="response-meta">
            <span className={`status-badge ${response.status >= 200 && response.status < 300 ? 'success' : 'error'}`}>
              {response.status} {response.statusText}
            </span>
            <span className="latency-badge">
              {response.latency}ms
            </span>
          </div>
          <pre className="response-body">
            {JSON.stringify(response.data, null, 2)}
          </pre>
        </div>
      )}

      <style jsx>{`
        .api-explorer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .api-explorer-header {
          margin-bottom: 30px;
        }

        .api-explorer-header h2 {
          font-size: 2rem;
          margin-bottom: 10px;
        }

        .api-explorer-header p {
          color: #666;
        }

        .api-explorer-config {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .config-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .config-item label {
          font-weight: 600;
        }

        .config-item input {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .api-explorer-endpoints {
          margin-bottom: 30px;
        }

        .endpoint-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 10px;
          margin-top: 15px;
        }

        .endpoint-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .endpoint-item:hover {
          border-color: #0ea5e9;
          box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
        }

        .endpoint-item.active {
          border-color: #0ea5e9;
          background: #f0f9ff;
        }

        .endpoint-method {
          padding: 4px 8px;
          background: #0ea5e9;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .endpoint-path {
          font-family: monospace;
          font-size: 14px;
          color: #666;
        }

        .endpoint-name {
          font-weight: 600;
          margin-left: auto;
        }

        .api-explorer-request {
          margin-bottom: 30px;
        }

        .request-body {
          margin-bottom: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .send-request-btn {
          padding: 12px 24px;
          background: #0ea5e9;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .send-request-btn:hover:not(:disabled) {
          background: #0284c7;
        }

        .send-request-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .api-explorer-response {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
        }

        .response-meta {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 4px;
          font-weight: 600;
        }

        .status-badge.success {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .latency-badge {
          padding: 6px 12px;
          background: #e0f2fe;
          color: #075985;
          border-radius: 4px;
          font-weight: 600;
        }

        .response-body {
          background: #1f2937;
          color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  )
}
