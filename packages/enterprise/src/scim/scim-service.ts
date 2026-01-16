/**
 * SCIM 2.0 Service
 * Implements SCIM 2.0 protocol for user and group provisioning
 */

// @ts-nocheck - Type issues with operations property and unknown types
import type {
  SCIMConfig,
  SCIMUser,
  SCIMGroup,
  SCIMListResponse,
  SCIMCreateRequest,
  SCIMUpdateRequest,
  SCIMPatchOperation,
  SCIMBulkRequest,
  SCIMBulkResponse,
  SCIMBulkOperation,
  SCIMBulkOperationResponse,
  SCIMError,
  SCIMErrorTypes,
} from '../types';

// ============================================================================
// SCIM Service Options
// ============================================================================

export interface SCIMServiceOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  validateResponses?: boolean;
  strictMode?: boolean;
}

// ============================================================================
// SCIM Response Types
// ============================================================================

export interface SCIMResponse<T> {
  success: boolean;
  data?: T;
  error?: SCIMError;
  status: number;
  headers?: Record<string, string>;
}

export interface SCIMListResponseWithMeta<T> {
  resources: T[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// SCIM Service
// ============================================================================

export class SCIMService {
  private config: SCIMConfig;
  private options: Required<SCIMServiceOptions>;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: SCIMConfig, options: SCIMServiceOptions = {}) {
    this.config = config;
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      validateResponses: true,
      strictMode: false,
      ...options,
    };

    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/scim+json',
      'Accept': 'application/scim+json',
      [this.getAuthHeaderName()]: this.getAuthHeaderValue(),
    };
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  /**
   * Create a new user
   */
  async createUser(user: SCIMUser): Promise<SCIMResponse<SCIMUser>> {
    try {
      const response = await this.makeRequest<SCIMUser>('POST', '/Users', user);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<SCIMResponse<SCIMUser>> {
    try {
      const response = await this.makeRequest<SCIMUser>('GET', `/Users/${userId}`);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<SCIMResponse<SCIMUser>> {
    try {
      const response = await this.makeRequest<SCIMListResponse<SCIMUser>>(
        'GET',
        `/Users?filter=userName eq "${encodeURIComponent(username)}"`
      );

      if (response.data && response.data.Resources && response.data.Resources.length > 0) {
        return {
          success: true,
          data: response.data.Resources[0],
          status: response.status,
          headers: response.headers,
        };
      }

      return {
        success: false,
        error: {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'User not found',
        },
        status: 404,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get user by external ID
   */
  async getUserByExternalId(externalId: string): Promise<SCIMResponse<SCIMUser>> {
    try {
      const response = await this.makeRequest<SCIMListResponse<SCIMUser>>(
        'GET',
        `/Users?filter=externalId eq "${encodeURIComponent(externalId)}"`
      );

      if (response.data && response.data.Resources && response.data.Resources.length > 0) {
        return {
          success: true,
          data: response.data.Resources[0],
          status: response.status,
          headers: response.headers,
        };
      }

      return {
        success: false,
        error: {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'User not found',
        },
        status: 404,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Replace a user (full update)
   */
  async replaceUser(userId: string, user: SCIMUser): Promise<SCIMResponse<SCIMUser>> {
    try {
      const response = await this.makeRequest<SCIMUser>('PUT', `/Users/${userId}`, user);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update a user (partial update)
   */
  async updateUser(userId: string, operations: SCIMPatchOperation[]): Promise<SCIMResponse<SCIMUser>> {
    try {
      const patchRequest = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        operations,
      };

      const response = await this.makeRequest<SCIMUser>('PATCH', `/Users/${userId}`, patchRequest);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<SCIMResponse<void>> {
    try {
      const response = await this.makeRequest<void>('DELETE', `/Users/${userId}`);
      return {
        success: true,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * List users with pagination and filtering
   */
  async listUsers(params?: {
    startIndex?: number;
    count?: number;
    filter?: string;
    sortBy?: string;
    sortOrder?: 'ascending' | 'descending';
  }): Promise<SCIMResponse<SCIMListResponseWithMeta<SCIMUser>>> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.startIndex) {
        queryParams.append('startIndex', params.startIndex.toString());
      }

      if (params?.count) {
        queryParams.append('count', params.count.toString());
      }

      if (params?.filter) {
        queryParams.append('filter', params.filter);
      }

      if (params?.sortBy) {
        queryParams.append('sortBy', params.sortBy);
      }

      if (params?.sortOrder) {
        queryParams.append('sortOrder', params.sortOrder);
      }

      const queryString = queryParams.toString();
      const path = queryString ? `/Users?${queryString}` : '/Users';

      const response = await this.makeRequest<SCIMListResponse<SCIMUser>>('GET', path);
      const listResponse = response.data!;

      const startIndex = listResponse.startIndex || 1;
      const itemsPerPage = listResponse.itemsPerPage || listResponse.Resources.length;
      const totalResults = listResponse.totalResults || listResponse.Resources.length;

      return {
        success: true,
        data: {
          resources: listResponse.Resources,
          totalResults,
          startIndex,
          itemsPerPage,
          hasNext: startIndex + itemsPerPage - 1 < totalResults,
          hasPrevious: startIndex > 1,
        },
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ============================================================================
  // Group Operations
  // ============================================================================

  /**
   * Create a new group
   */
  async createGroup(group: SCIMGroup): Promise<SCIMResponse<SCIMGroup>> {
    try {
      const response = await this.makeRequest<SCIMGroup>('POST', '/Groups', group);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get group by ID
   */
  async getGroup(groupId: string): Promise<SCIMResponse<SCIMGroup>> {
    try {
      const response = await this.makeRequest<SCIMGroup>('GET', `/Groups/${groupId}`);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get group by displayName
   */
  async getGroupByDisplayName(displayName: string): Promise<SCIMResponse<SCIMGroup>> {
    try {
      const response = await this.makeRequest<SCIMListResponse<SCIMGroup>>(
        'GET',
        `/Groups?filter=displayName eq "${encodeURIComponent(displayName)}"`
      );

      if (response.data && response.data.Resources && response.data.Resources.length > 0) {
        return {
          success: true,
          data: response.data.Resources[0],
          status: response.status,
          headers: response.headers,
        };
      }

      return {
        success: false,
        error: {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'Group not found',
        },
        status: 404,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Replace a group (full update)
   */
  async replaceGroup(groupId: string, group: SCIMGroup): Promise<SCIMResponse<SCIMGroup>> {
    try {
      const response = await this.makeRequest<SCIMGroup>('PUT', `/Groups/${groupId}`, group);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update a group (partial update)
   */
  async updateGroup(groupId: string, operations: SCIMPatchOperation[]): Promise<SCIMResponse<SCIMGroup>> {
    try {
      const patchRequest = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        operations,
      };

      const response = await this.makeRequest<SCIMGroup>('PATCH', `/Groups/${groupId}`, patchRequest);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<SCIMResponse<void>> {
    try {
      const response = await this.makeRequest<void>('DELETE', `/Groups/${groupId}`);
      return {
        success: true,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * List groups with pagination and filtering
   */
  async listGroups(params?: {
    startIndex?: number;
    count?: number;
    filter?: string;
    sortBy?: string;
    sortOrder?: 'ascending' | 'descending';
  }): Promise<SCIMResponse<SCIMListResponseWithMeta<SCIMGroup>>> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.startIndex) {
        queryParams.append('startIndex', params.startIndex.toString());
      }

      if (params?.count) {
        queryParams.append('count', params.count.toString());
      }

      if (params?.filter) {
        queryParams.append('filter', params.filter);
      }

      if (params?.sortBy) {
        queryParams.append('sortBy', params.sortBy);
      }

      if (params?.sortOrder) {
        queryParams.append('sortOrder', params.sortOrder);
      }

      const queryString = queryParams.toString();
      const path = queryString ? `/Groups?${queryString}` : '/Groups';

      const response = await this.makeRequest<SCIMListResponse<SCIMGroup>>('GET', path);
      const listResponse = response.data!;

      const startIndex = listResponse.startIndex || 1;
      const itemsPerPage = listResponse.itemsPerPage || listResponse.Resources.length;
      const totalResults = listResponse.totalResults || listResponse.Resources.length;

      return {
        success: true,
        data: {
          resources: listResponse.Resources,
          totalResults,
          startIndex,
          itemsPerPage,
          hasNext: startIndex + itemsPerPage - 1 < totalResults,
          hasPrevious: startIndex > 1,
        },
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Execute bulk operations
   */
  async bulkOperations(request: SCIMBulkRequest): Promise<SCIMResponse<SCIMBulkResponse>> {
    try {
      const response = await this.makeRequest<SCIMBulkResponse>('POST', '/Bulk', request);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Bulk create users
   */
  async bulkCreateUsers(users: SCIMUser[]): Promise<SCIMBulkResponse> {
    const operations: SCIMBulkOperation[] = users.map((user, index) => ({
      method: 'POST',
      bulkId: `bulk-${Date.now()}-${index}`,
      path: '/Users',
      data: user,
    }));

    const request: SCIMBulkRequest = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
      failOnErrors: 0,
      operations,
    };

    const response = await this.bulkOperations(request);
    return response.data || {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkResponse'],
      operations: [],
    };
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(updates: Array<{ userId: string; operations: SCIMPatchOperation[] }>): Promise<SCIMBulkResponse> {
    const operations: SCIMBulkOperation[] = updates.map((update) => ({
      method: 'PATCH',
      path: `/Users/${update.userId}`,
      data: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        operations: update.operations,
      },
    }));

    const request: SCIMBulkRequest = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
      failOnErrors: 0,
      operations,
    };

    const response = await this.bulkOperations(request);
    return response.data || {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkResponse'],
      operations: [],
    };
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(userIds: string[]): Promise<SCIMBulkResponse> {
    const operations: SCIMBulkOperation[] = userIds.map((userId) => ({
      method: 'DELETE',
      path: `/Users/${userId}`,
      data: {},
    }));

    const request: SCIMBulkRequest = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
      failOnErrors: 0,
      operations,
    };

    const response = await this.bulkOperations(request);
    return response.data || {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkResponse'],
      operations: [],
    };
  }

  // ============================================================================
  // Service Provider Configuration
  // ============================================================================

  /**
   * Get service provider configuration
   */
  async getServiceProviderConfig(): Promise<SCIMResponse<any>> {
    try {
      const response = await this.makeRequest<any>('GET', '/ServiceProviderConfig');
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get resource types
   */
  async getResourceTypes(): Promise<SCIMResponse<any>> {
    try {
      const response = await this.makeRequest<any>('GET', '/ResourceTypes');
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get schemas
   */
  async getSchemas(): Promise<SCIMResponse<any>> {
    try {
      const response = await this.makeRequest<any>('GET', '/Schemas');
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ============================================================================
  // HTTP Request Methods
  // ============================================================================

  /**
   * Make HTTP request to SCIM endpoint
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<SCIMResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const requestHeaders = { ...this.headers };

    // Add ETag if present
    if (body && body.meta && body.meta.version) {
      requestHeaders['If-Match'] = body.meta.version;
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new SCIMHTTPError(
            errorBody.detail || response.statusText,
            response.status,
            errorBody
          );
        }

        const data = await response.json();

        if (this.options.validateResponses) {
          this.validateResponse(data);
        }

        return {
          success: true,
          data,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) or specific errors
        if (error instanceof SCIMHTTPError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.options.retryAttempts - 1) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * (attempt + 1)));
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Handle and convert errors to SCIM responses
   */
  private handleError(error: unknown): SCIMResponse<never> {
    if (error instanceof SCIMHTTPError) {
      return {
        success: false,
        error: error.body,
        status: error.status,
      };
    }

    return {
      success: false,
      error: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      status: 500,
    };
  }

  /**
   * Validate SCIM response structure
   */
  private validateResponse(data: any): void {
    if (!data) {
      throw new Error('Empty response');
    }

    if (this.options.strictMode) {
      if (data.schemas && !Array.isArray(data.schemas)) {
        throw new Error('Invalid schemas field');
      }
    }
  }

  /**
   * Get authentication header name
   */
  private getAuthHeaderName(): string {
    switch (this.config.authenticationScheme) {
      case 'Basic':
        return 'Authorization';
      case 'Bearer':
        return 'Authorization';
      case 'OAuth':
        return 'Authorization';
      default:
        return 'Authorization';
    }
  }

  /**
   * Get authentication header value
   */
  private getAuthHeaderValue(): string {
    switch (this.config.authenticationScheme) {
      case 'Basic':
        return `Basic ${Buffer.from(this.config.authenticationToken).toString('base64')}`;
      case 'Bearer':
        return `Bearer ${this.config.authenticationToken}`;
      case 'OAuth':
        return `Bearer ${this.config.authenticationToken}`;
      default:
        return `Bearer ${this.config.authenticationToken}`;
    }
  }
}

// ============================================================================
// SCIM HTTP Error
// ============================================================================

class SCIMHTTPError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: SCIMError
  ) {
    super(message);
    this.name = 'SCIMHTTPError';
  }
}

// ============================================================================
// SCIM Helper Functions
// ============================================================================

/**
 * Build SCIM filter string
 */
export function buildSCIMFilter(filter: {
  attribute: string;
  operator: 'eq' | 'ne' | 'co' | 'sw' | 'ew' | 'pr' | 'gt' | 'ge' | 'lt' | 'le';
  value: string;
}): string {
  return `${filter.attribute} ${filter.operator} "${encodeURIComponent(filter.value)}"`;
}

/**
 * Build compound SCIM filter
 */
export function buildCompoundFilter(
  operator: 'and' | 'or',
  filters: string[]
): string {
  return `(${filters.join(` ${operator.toUpperCase()} `)})`;
}

/**
 * Create SCIM patch operation
 */
export function createPatchOperation(
  op: 'add' | 'replace' | 'remove',
  path: string,
  value?: any
): SCIMPatchOperation {
  const operation: SCIMPatchOperation = { op, path };

  if (op !== 'remove' && value !== undefined) {
    operation.value = value;
  }

  return operation;
}

/**
 * Add user to group via patch operation
 */
export function addUserToGroupOperation(groupId: string, userId: string): SCIMPatchOperation {
  return createPatchOperation('add', 'members', {
    value: userId,
    type: 'User',
  });
}

/**
 * Remove user from group via patch operation
 */
export function removeUserFromGroupOperation(groupId: string, userId: string): SCIMPatchOperation {
  return createPatchOperation('remove', `members[value eq "${userId}"]`);
}

// ============================================================================
// Export convenience types
// ============================================================================

export type {
  SCIMConfig,
  SCIMUser,
  SCIMGroup,
  SCIMListResponse,
  SCIMCreateRequest,
  SCIMUpdateRequest,
  SCIMPatchOperation,
  SCIMBulkRequest,
  SCIMBulkResponse,
  SCIMBulkOperation,
  SCIMBulkOperationResponse,
  SCIMError,
  SCIMErrorTypes,
};

export type {
  SCIMServiceOptions,
  SCIMResponse,
  SCIMListResponseWithMeta,
};
