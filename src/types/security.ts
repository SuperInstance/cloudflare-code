/**
 * Security-related types for authentication and authorization
 */

export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'SecurityError';
    Error.captureStackTrace?.(this, SecurityError);
  }
}

export interface SecurityContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  permissions?: string[];
  apiKey?: string;
  token?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
  token?: AuthToken;
  error?: string;
}
