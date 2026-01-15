/**
 * Validator Utility for Security Core
 * Provides comprehensive input validation and sanitization
 */

import { z } from 'zod';

export class Validator {
  private static emailSchema = z.string().email().min(5).max(254);
  private static passwordSchema = z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    try {
      return this.emailSchema.safeParse(email).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): boolean {
    try {
      return this.passwordSchema.safeParse(password).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate strong password (OWASP requirements)
   */
  static isStrongPassword(password: string): boolean {
    try {
      // Additional strength checks
      const hasNumber = /\d/.test(password);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const isLongEnough = password.length >= 12;

      // Check for common weak passwords
      const commonPasswords = [
        'password', '123456', '12345678', '123456789', '1234567890',
        'qwerty', 'abc123', 'letmein', 'monkey', 'password1'
      ];

      const isCommonPassword = commonPasswords.includes(password.toLowerCase());

      return hasNumber && hasSpecial && hasUpperCase && hasLowerCase &&
             isLongEnough && !isCommonPassword;

    } catch {
      return false;
    }
  }

  /**
   * Validate username format
   */
  static isValidUsername(username: string): boolean {
    const usernameSchema = z.string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be less than 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

    try {
      return usernameSchema.safeParse(username).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate name format
   */
  static isValidName(name: string): boolean {
    const nameSchema = z.string()
      .min(1, "Name cannot be empty")
      .max(50, "Name must be less than 50 characters")
      .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes");

    try {
      return nameSchema.safeParse(name).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number format
   */
  static isValidPhone(phone: string): boolean {
    const phoneSchema = z.string()
      .regex(/^\+?[\d\s\-\(\)]+$/, "Invalid phone number format");

    try {
      return phoneSchema.safeParse(phone).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate IP address format
   */
  static isValidIP(ip: string): boolean {
    const ipSchema = z.string()
      .regex(
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        "Invalid IP address format"
      );

    try {
      return ipSchema.safeParse(ip).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate IPv6 address format
   */
  static isValidIPv6(ip: string): boolean {
    const ipv6Schema = z.string()
      .regex(
        /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i,
        "Invalid IPv6 address format"
      );

    try {
      return ipv6Schema.safeParse(ip).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate credit card number (Luhn algorithm)
   */
  static isValidCreditCard(cardNumber: string): boolean {
    const cleanNumber = cardNumber.replace(/\s/g, '');

    // Basic length check
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Validate date format
   */
  static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Validate timestamp format
   */
  static isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.getFullYear() > 1970;
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidSchema = z.string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "Invalid UUID format"
      );

    try {
      return uuidSchema.safeParse(uuid).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate numeric range
   */
  static isValidNumberRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Validate JSON string
   */
  static isValidJSON(jsonString: string): boolean {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  static sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  static sanitizeInput(input: string, type: 'string' | 'number' | 'email' | 'url' = 'string'): string {
    let sanitized = input;

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Replace HTML entities
    sanitized = sanitized.replace(/&/g, '&amp;');
    sanitized = sanitized.replace(/</g, '&lt;');
    sanitized = sanitized.replace(/>/g, '&gt;');
    sanitized = sanitized.replace(/"/g, '&quot;');
    sanitized = sanitized.replace(/'/g, '&#x27;');

    // Type-specific sanitization
    switch (type) {
      case 'number':
        // Only allow digits, decimal point, minus sign, and exponent
        sanitized = sanitized.replace(/[^\d\.\-\+eE]/g, '');
        break;
      case 'email':
        // Basic email sanitization
        sanitized = sanitized.replace(/[^a-zA-Z0-9@._+-]/g, '');
        break;
      case 'url':
        // Allow basic URL characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]/g, '');
        break;
    }

    return sanitized;
  }

  /**
   * Validate backup code format
   */
  static isValidBackupCode(code: string): boolean {
    const backupCodeSchema = z.string()
      .length(12, "Backup code must be 12 digits")
      .regex(/^\d+$/, "Backup code must contain only digits");

    try {
      return backupCodeSchema.safeParse(code).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate password reset token
   */
  static isValidPasswordResetToken(token: string): boolean {
    const tokenSchema = z.string()
      .min(32, "Invalid token format")
      .max(256, "Invalid token format");

    try {
      return tokenSchema.safeParse(token).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate JWT token format
   */
  static isValidJWT(token: string): boolean {
    const jwtSchema = z.string()
      .min(10, "Invalid JWT token")
      .regex(/^\.[^.]+\.[^.]+$/, "Invalid JWT format");

    try {
      return jwtSchema.safeParse(token).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate session ID format
   */
  static isValidSessionId(sessionId: string): boolean {
    const sessionIdSchema = z.string()
      .min(16, "Invalid session ID")
      .max(128, "Invalid session ID")
      .regex(/^[a-zA-Z0-9\-_]+$/, "Invalid session ID format");

    try {
      return sessionIdSchema.safeParse(sessionId).success;
    } catch {
      return false;
    }
  }

  /**
   * Validate file extension
   */
  static isValidFileExtension(filename: string, allowedExtensions: string[]): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedExtensions.includes(extension) : false;
  }

  /**
   * Validate file size
   */
  static isValidFileSize(size: number, maxSizeInBytes: number): boolean {
    return size <= maxSizeInBytes;
  }

  /**
   * Validate MIME type
   */
  static isValidMimeType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate password strength score
   */
  static getPasswordStrengthScore(password: string): number {
    let score = 0;

    // Length
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Common patterns
    if (!/(.)\1{2,}/.test(password)) score += 1; // No consecutive same chars
    if (!/123|abc|qwe/i.test(password)) score += 1; // No common sequences

    return Math.min(score, 10);
  }

  /**
   * Get password strength feedback
   */
  static getPasswordStrengthFeedback(password: string): string[] {
    const feedback: string[] = [];

    if (password.length < 8) {
      feedback.push("Password should be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push("Include uppercase letters");
    }

    if (!/[a-z]/.test(password)) {
      feedback.push("Include lowercase letters");
    }

    if (!/[0-9]/.test(password)) {
      feedback.push("Include numbers");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      feedback.push("Include special characters");
    }

    if (password.length < 12) {
      feedback.push("Consider using 12+ characters for better security");
    }

    return feedback;
  }
}