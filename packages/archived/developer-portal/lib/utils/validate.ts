import { ApiRequest } from '@/types';

export function validateRequest(request: ApiRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate endpoint
  if (!request.endpoint || request.endpoint.trim() === '') {
    errors.push('Endpoint is required');
  } else if (!request.endpoint.startsWith('/')) {
    errors.push('Endpoint must start with /');
  }

  // Validate method
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  if (!validMethods.includes(request.method)) {
    errors.push(`Invalid method. Must be one of: ${validMethods.join(', ')}`);
  }

  // Validate body for POST, PUT, PATCH
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    if (!request.body || Object.keys(request.body).length === 0) {
      errors.push('Request body is required for POST, PUT, and PATCH requests');
    }
  }

  // Validate headers
  for (const [key, value] of Object.entries(request.headers)) {
    if (!key || key.trim() === '') {
      errors.push('Header key cannot be empty');
    }
    if (key.includes(' ')) {
      errors.push(`Header key "${key}" cannot contain spaces`);
    }
  }

  // Validate content type
  const validContentTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ];
  if (!validContentTypes.includes(request.contentType)) {
    errors.push(`Invalid content type. Must be one of: ${validContentTypes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateApiKey(apiKey: string): boolean {
  // ClaudeFlare API keys start with 'cf-' followed by 32 alphanumeric characters
  const apiKeyRegex = /^cf-[a-zA-Z0-9]{32}$/;
  return apiKeyRegex.test(apiKey);
}

export function validateWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    // Remove any potentially dangerous headers
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      sanitized[key.trim()] = value.trim();
    }
  }

  return sanitized;
}

export function sanitizeQueryParams(
  params: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key && value) {
      sanitized[key.trim()] = value.trim();
    }
  }

  return sanitized;
}
