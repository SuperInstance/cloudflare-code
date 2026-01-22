/**
 * Validation utilities
 *
 * Helper functions for validating user input.
 */

// @ts-nocheck - External React/Next.js dependencies
import { z } from 'zod';

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL validation
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Username validation (alphanumeric, underscore, hyphen)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Password strength check
 */
export function getPasswordStrength(password: string): {
  strength: 'weak' | 'medium' | 'strong';
  score: number;
} {
  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';

  return { strength, score };
}

/**
 * Project name validation
 */
export function isValidProjectName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 50;
}

/**
 * File name validation
 */
export function isValidFileName(name: string): boolean {
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
  const invalidNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  return !invalidChars.test(name) && !invalidNames.test(name) && name.length > 0;
}

/**
 * Zod schemas for common validations
 */
export const schemas = {
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  projectName: z
    .string()
    .min(2, 'Project name must be at least 2 characters')
    .max(50, 'Project name must be at most 50 characters'),
  url: z.string().url('Invalid URL'),
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message is too long'),
};

/**
 * Validate against a schema
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}
