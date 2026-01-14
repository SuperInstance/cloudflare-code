import { ApiRequest, CodeSnippet } from '@/types';

export const LANGUAGE_CONFIGS = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    icon: '📘',
    extension: 'ts',
    template: 'typescript',
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    icon: '📒',
    extension: 'js',
    template: 'javascript',
  },
  python: {
    id: 'python',
    name: 'Python',
    icon: '🐍',
    extension: 'py',
    template: 'python',
    dependencies: ['requests'],
  },
  go: {
    id: 'go',
    name: 'Go',
    icon: '🐹',
    extension: 'go',
    template: 'go',
  },
  curl: {
    id: 'curl',
    name: 'cURL',
    icon: '🔧',
    extension: 'sh',
    template: 'curl',
  },
  java: {
    id: 'java',
    name: 'Java',
    icon: '☕',
    extension: 'java',
    template: 'java',
  },
  rust: {
    id: 'rust',
    name: 'Rust',
    icon: '🦀',
    extension: 'rs',
    template: 'rust',
  },
  php: {
    id: 'php',
    name: 'PHP',
    icon: '🐘',
    extension: 'php',
    template: 'php',
  },
};

export function generateCodeSnippet(
  request: ApiRequest,
  language: string
): CodeSnippet {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.claudeflare.dev';
  const fullUrl = `${baseUrl}${request.endpoint}`;

  switch (language) {
    case 'typescript':
      return generateTypeScript(request, fullUrl);
    case 'javascript':
      return generateJavaScript(request, fullUrl);
    case 'python':
      return generatePython(request, fullUrl);
    case 'go':
      return generateGo(request, fullUrl);
    case 'curl':
      return generateCurl(request, fullUrl);
    case 'java':
      return generateJava(request, fullUrl);
    case 'rust':
      return generateRust(request, fullUrl);
    case 'php':
      return generatePHP(request, fullUrl);
    default:
      return generateTypeScript(request, fullUrl);
  }
}

function generateTypeScript(request: ApiRequest, url: string): CodeSnippet {
  let code = `import axios from 'axios';

const API_KEY = process.env.CLAUDEFLARE_API_KEY;

interface Response {
  // Define your response type here
  data: any;
}

async function ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}() {
  try {
    const response = await axios<Response>({
      method: '${request.method}',
      url: '${url}'${buildQueryString(request.queryParams)},
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': '${request.contentType}',
${buildHeaders(request.headers)}
      },${buildBody(request.body, request.method)}
    });

    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
}

// Usage
${request.method.toLowerCase()}${getEndpointName(request.endpoint)}()
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Failed:', error));
`;

  return {
    language: 'typescript',
    code: code.trim(),
    dependencies: ['axios@^1.6.0'],
  };
}

function generateJavaScript(request: ApiRequest, url: string): CodeSnippet {
  let code = `const API_KEY = process.env.CLAUDEFLARE_API_KEY;

async function ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}() {
  try {
    const response = await fetch('${url}'${buildQueryStringJS(request.queryParams)}, {
      method: '${request.method}',
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': '${request.contentType}',
${buildHeaders(request.headers)}
      },${buildBodyJS(request.body, request.method)}
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    const data = await response.json();
    console.log('Response:', data);
    return data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Usage
${request.method.toLowerCase()}${getEndpointName(request.endpoint)}()
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Failed:', error));
`;

  return {
    language: 'javascript',
    code: code.trim(),
  };
}

function generatePython(request: ApiRequest, url: string): CodeSnippet {
  let code = `import os
import requests
from typing import Any, Dict

API_KEY = os.getenv('CLAUDEFLARE_API_KEY')

def ${request.method.lower()}_${getEndpointName(request.endpoint).toLowerCase()}() -> Dict[str, Any]:
    """Make a ${request.method} request to ${request.endpoint}"""

    url = "${url}"${buildQueryStringPython(request.queryParams)}

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "${request.contentType}",
${buildHeadersPython(request.headers)}
    }${buildBodyPython(request.body, request.method)}

    try:
        response = requests.${request.method.lower()}(
            url,
            headers=headers,
            timeout=30
        )

        response.raise_for_status()

        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        return response.json()

    except requests.exceptions.HTTPError as error:
        print(f"HTTP Error: {error}")
        print(f"Response: {error.response.json()}")
        raise
    except requests.exceptions.RequestException as error:
        print(f"Request Error: {error}")
        raise

# Usage
if __name__ == "__main__":
    try:
        data = ${request.method.lower()}_${getEndpointName(requestendpoint).toLowerCase()}()
        print(f"Success: {data}")
    except Exception as error:
        print(f"Failed: {error}")
`;

  return {
    language: 'python',
    code: code.trim(),
    dependencies: ['requests>=2.31.0'],
  };
}

function generateGo(request: ApiRequest, url: string): CodeSnippet {
  let code = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type Response struct {
	// Define your response type here
	Data interface{} \`json:"data"\`
}

func ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}() (*Response, error) {
	apiKey := os.Getenv("CLAUDEFLARE_API_KEY")

	url := "${url}"${buildQueryStringGo(request.queryParams)}

${buildBodyGo(request.body, request.method)}

	req, err := http.NewRequest("${request.method}", url, body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer " + apiKey)
	req.Header.Set("Content-Type", "${request.contentType}")
${buildHeadersGo(request.headers)}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode, string(body))
	}

	var response Response
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &response, nil
}

func main() {
	response, err := ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}()
	if err != nil {
		fmt.Printf("Error: %v\\n", err)
		os.Exit(1)
	}

	fmt.Printf("Success: %+v\\n", response)
}
`;

  return {
    language: 'go',
    code: code.trim(),
  };
}

function generateCurl(request: ApiRequest, url: string): CodeSnippet {
  let parts = [`curl -X ${request.method} \\`];
  parts.push(`  "${url}${buildQueryStringCurl(request.queryParams)}" \\`);
  parts.push(`  -H "Authorization: Bearer $CLAUDEFLARE_API_KEY" \\`);
  parts.push(`  -H "Content-Type: ${request.contentType}" \\`);

  Object.entries(request.headers).forEach(([key, value]) => {
    if (key.toLowerCase() !== 'authorization' && key.toLowerCase() !== 'content-type') {
      parts.push(`  -H "${key}: ${value}" \\`);
    }
  });

  if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const bodyStr = JSON.stringify(request.body, null, 2);
    parts.push(`  -d '${bodyStr}' \\`);
  }

  parts.push(`  -v`);

  return {
    language: 'bash',
    code: parts.join('\n'),
  };
}

function generateJava(request: ApiRequest, url: string): CodeSnippet {
  let code = `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

public class ${getEndpointName(request.endpoint)}Client {

    private static final String API_KEY = System.getenv("CLAUDEFLARE_API_KEY");
    private static final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    public static String ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}() throws Exception {
        String url = "${url}"${buildQueryStringJava(request.queryParams)};

        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + API_KEY)
            .header("Content-Type", "${request.contentType}");
${buildHeadersJava(request.headers)}
${buildBodyJava(request.body, request.method)}
        HttpRequest request = builder.build();

        HttpResponse<String> response = client.send(
            request,
            HttpResponse.BodyHandlers.ofString()
        );

        if (response.statusCode() != 200) {
            throw new RuntimeException("Request failed: " + response.body());
        }

        System.out.println("Response: " + response.body());
        return response.body();
    }

    public static void main(String[] args) {
        try {
            String result = ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}();
            System.out.println("Success: " + result);
        } catch (Exception e) {
            System.err.println("Failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
`;

  return {
    language: 'java',
    code: code.trim(),
  };
}

function generateRust(request: ApiRequest, url: string): CodeSnippet {
  let code = `use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
struct Response {
    // Define your response type here
    data: serde_json::Value,
}

#[tokio::main]
async fn ${request.method.toLowerCase()}_${getEndpointName(request.endpoint).toLowerCase()}() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = env::var("CLAUDEFLARE_API_KEY")?;
    let client = Client::new();

    let url = "${url}";

${buildBodyRust(request.body, request.method)}

    let response = client
        .${request.method.toLowerCase()}(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "${request.contentType}")
${buildHeadersRust(request.headers)}
${buildBodyRustSend(request.body)}
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(format!("Request failed: {} - {}", status, error_text).into());
    }

    let response_data: Response = response.json().await?;
    println!("Response: {:?}", response_data);

    Ok(())
}

fn main() {
    if let Err(e) = ${request.method.toLowerCase()}_${getEndpointName(request.endpoint).toLowerCase()}() {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
`;

  return {
    language: 'rust',
    code: code.trim(),
    dependencies: ['reqwest = { version = "0.11", features = ["json"] }', 'tokio = { version = "1", features = ["full"] }', 'serde = { version = "1.0", features = ["derive"] }'],
  };
}

function generatePHP(request: ApiRequest, url: string): CodeSnippet {
  let code = `<?php

class ClaudeFlareClient {
    private string $baseUrl;
    private string $apiKey;

    public function __construct(string $apiKey, string $baseUrl = 'https://api.claudeflare.dev') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }

    public function ${request.method.toLowerCase()}${getEndpointName(request.endpoint)}() {
        $url = $this->baseUrl . '${request.endpoint}'${buildQueryStringPHP(request.queryParams)};

        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: ${request.contentType}',
${buildHeadersPHP(request.headers)}
        ];

        $context = stream_context_create([
            'http' => [
                'method' => '${request.method}',
                'header' => implode("\\r\\n", $headers),
${buildBodyPHP(request.body, request.method)}
                'ignore_errors' => true,
                'timeout' => 30,
            ],
        ]);

        $response = file_get_contents($url, false, $context);

        if ($response === false) {
            throw new Exception('Request failed');
        }

        $data = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response');
        }

        return $data;
    }
}

// Usage
try {
    $apiKey = getenv('CLAUDEFLARE_API_KEY');
    $client = new ClaudeFlareClient($apiKey);
    $result = $client->${request.method.toLowerCase()}${getEndpointName(request.endpoint)}();
    print_r($result);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\\n";
}
?>
`;

  return {
    language: 'php',
    code: code.trim(),
  };
}

// Helper functions
function getEndpointName(endpoint: string): string {
  return endpoint
    .split('/')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function buildQueryString(params: Record<string, string>): string {
  const queryParams = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return queryParams ? `?${queryParams}` : '';
}

function buildQueryStringJS(params: Record<string, string>): string {
  const queryParams = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return queryParams ? ` + '?${queryParams}'` : '';
}

function buildQueryStringPython(params: Record<string, string>): string {
  if (!Object.keys(params).length) return '';

  const queryParams = Object.entries(params)
    .map(([key, value]) => `"${key}": "${value}"`)
    .join(', ');

  return `\n    params = {\n        ${queryParams}\n    }\n    url = url + "?" + "&".join(f"{k}={v}" for k, v in params.items())`;
}

function buildQueryStringGo(params: Record<string, string>): string {
  if (!Object.keys(params).length) return '';

  const queryParams = Object.entries(params)
    .map(([key, value]) => `("${key}", "${value}")`)
    .join(', ');

  return `\n\tqueryParams := []string{${queryParams}}\n\tif len(queryParams) > 0 {\n\t\turl += "?" + strings.Join(queryParams, "&")\n\t}`;
}

function buildQueryStringCurl(params: Record<string, string>): string {
  const queryParams = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return queryParams ? `?${queryParams}` : '';
}

function buildQueryStringJava(params: record<string, string>): string {
  if (!Object.keys(params).length) return '';

  const queryParams = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return ` + "?${queryParams}"`;
}

function buildQueryStringPHP(params: record<string, string>): string {
  if (!Object.keys(params).length) return '';

  const queryParams = Object.entries(params)
    .map(([key, value]) => `'${key}' => '${value}'`)
    .join(', ');

  return `\n        $params = [${queryParams}];\n        $url .= '?' . http_build_query($params);`;
}

function buildHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => !['authorization', 'content-type'].includes(key.toLowerCase()))
    .map(([key, value]) => `        '${key}': '${value}',`)
    .join('\n');
}

function buildHeadersPython(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => !['authorization', 'content-type'].includes(key.toLowerCase()))
    .map(([key, value]) => `        "${key}": "${value}",`)
    .join('\n');
}

function buildBodyGo(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '\tvar body io.Reader = nil';
  }

  return `\tjsonData, _ := json.Marshal(${JSON.stringify(body)})
\tvar body io.Reader = bytes.NewBuffer(jsonData)`;
}

function buildBodyJava(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '\t        .${request.method.toLowerCase()}()';
  }

  const bodyStr = JSON.stringify(body, null, 6);
  return `\t        String requestBody = ${bodyStr};
        .${request.method.toLowerCase()}(HttpRequest.BodyPublishers.ofString(requestBody))`;
}

function buildBodyRust(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '';
  }

  return `    let request_body = ${JSON.stringify(body)};`;
}

function buildBodyRustSend(body: any): string {
  if (!body) return '';
  return `        .json(&request_body)`;
}

function buildBodyPHP(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '';
  }

  const bodyStr = JSON.stringify(body);
  return `                'content' => json_encode(${bodyStr}),`;
}

function buildBody(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '';
  }

  return `\n      data: ${JSON.stringify(body, null, 6)},`;
}

function buildBodyJS(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '';
  }

  return `,\n      body: JSON.stringify(${JSON.stringify(body)}),`;
}

function buildBodyPython(body: any, method: string): string {
  if (!body || !['POST', 'PUT', 'PATCH'].includes(method)) {
    return '';
  }

  return `\n    \n    body = ${JSON.stringify(body, null, 4)}
    \n    headers["Content-Length"] = str(len(body))\n    \n    return requests.${method.toLowerCase()}(url, headers=headers, data=body, timeout=30)`;
}

function buildHeadersGo(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => !['authorization', 'content-type'].includes(key.toLowerCase()))
    .map(([key, value]) => `\treq.Header.Set("${key}", "${value}")`)
    .join('\n');
}

function buildHeadersJava(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => !['authorization', 'content-type'].includes(key.toLowerCase()))
    .map(([key, value]) => `            .header("${key}", "${value}")`)
    .join('\n');
}

function buildHeadersRust(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => !['authorization', 'content-type'].includes(key.toLowerCase()))
    .map(([key, value]) => `        .header("${key}", "${value}")`)
    .join('\n');
}

function buildHeadersPHP(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => !['authorization', 'content-type'].includes(key.toLowerCase()))
    .map(([key, value]) => `            '${key}: ${value}',`)
    .join('\n');
}
