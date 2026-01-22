// API Types
export interface ApiEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  summary: string;
  description: string;
  tags: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<number, ApiResponse>;
  authentication: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description: string;
  required: boolean;
  type: string;
  schema?: any;
  example?: any;
}

export interface ApiRequestBody {
  contentType: string;
  schema: any;
  example?: any;
  required: boolean;
}

export interface ApiResponse {
  description: string;
  schema?: any;
  example?: any;
  headers?: Record<string, { description: string; schema: any }>;
}

export interface ApiRequest {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  pathParams: Record<string, string>;
  body?: any;
  contentType: string;
}

export interface ApiResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  duration: number;
  size: number;
}

export interface SavedRequest {
  id: string;
  name: string;
  request: ApiRequest;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface RequestHistory {
  id: string;
  request: ApiRequest;
  response: ApiResponseData;
  timestamp: Date;
  successful: boolean;
}

export interface CodeSnippet {
  language: string;
  code: string;
  dependencies?: string[];
}

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  signature?: string;
  headers: Record<string, string>;
  processed: boolean;
  retryCount: number;
}

export interface UsageMetrics {
  timestamp: Date;
  requests: number;
  errors: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  cost: number;
}

export interface UsageAnalytics {
  totalRequests: number;
  totalErrors: number;
  avgLatency: number;
  errorRate: number;
  topEndpoints: Array<{
    path: string;
    requests: number;
    avgLatency: number;
  }>;
  providerBreakdown: Array<{
    provider: string;
    requests: number;
    cost: number;
  }>;
  timeSeriesData: UsageMetrics[];
}

export interface BillingInfo {
  currentBalance: number;
  currentUsage: number;
  billingCycle: {
    start: Date;
    end: Date;
  };
  plan: {
    name: string;
    tier: string;
    limits: {
      requests: number;
      storage: number;
    };
  };
  usageBreakdown: Array<{
    category: string;
    usage: number;
    cost: number;
  }>;
  invoiceHistory: Invoice[];
}

export interface Invoice {
  id: string;
  date: Date;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl: string;
}

export interface CostForecast {
  period: string;
  predictedCost: number;
  confidence: number;
  factors: Array<{
    name: string;
    impact: number;
  }>;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  replies: CommunityReply[];
  views: number;
}

export interface CommunityReply {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  createdAt: Date;
  likes: number;
}

export interface CodeShare {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  tags: string[];
  createdAt: Date;
  likes: number;
  forks: number;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  downloads: number;
  rating: number;
  tags: string[];
  repository?: string;
  installed: boolean;
}
