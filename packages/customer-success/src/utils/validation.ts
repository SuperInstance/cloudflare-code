/**
 * Customer Success Platform - Validation Utilities
 * Input validation and sanitization functions
 */

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
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
 * Validate phone number (basic validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(value: number): boolean {
  return value >= 0 && value <= 100;
}

/**
 * Validate probability (0-1)
 */
export function isValidProbability(value: number): boolean {
  return value >= 0 && value <= 1;
}

/**
 * Validate score (0-100)
 */
export function isValidScore(value: number): boolean {
  return isValidPercentage(value);
}

/**
 * Validate date range
 */
export function isValidDateRange(start: Date, end: Date): boolean {
  return start < end;
}

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(String(field));
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate string length
 */
export function isValidLength(
  value: string,
  min: number,
  max: number
): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * Validate number range
 */
export function isValidNumber(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate customer ID format
 */
export function isValidCustomerId(id: string): boolean {
  // Customer IDs should be alphanumeric with underscores and hyphens
  const idRegex = /^[a-zA-Z0-9_\-]+$/;
  return idRegex.test(id) && id.length >= 3 && id.length <= 50;
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(value: any): number | null {
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  const sanitized = email.trim().toLowerCase();
  return isValidEmail(sanitized) ? sanitized : null;
}

/**
 * Validate configuration object
 */
export function validateConfig(config: any, schema: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if config is an object
  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be an object');
    return { valid: false, errors };
  }

  // Validate against schema
  for (const key in schema) {
    const schemaRule = schema[key];
    const value = config[key];

    if (schemaRule.required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${key}`);
    }

    if (value !== undefined && schemaRule.type) {
      const expectedType = schemaRule.type;
      const actualType = typeof value;

      if (expectedType !== actualType) {
        errors.push(
          `Field ${key} must be of type ${expectedType}, got ${actualType}`
        );
      }
    }

    if (value !== undefined && schemaRule.validate) {
      const validationResult = schemaRule.validate(value);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors.map((e: string) => `${key}: ${e}`));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate onboarding step
 */
export function validateOnboardingStep(step: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!step.name || typeof step.name !== 'string') {
    errors.push('Step name is required and must be a string');
  }

  if (typeof step.order !== 'number' || step.order < 0) {
    errors.push('Step order must be a non-negative number');
  }

  if (step.estimatedDuration !== undefined && step.estimatedDuration < 0) {
    errors.push('Estimated duration must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate health score
 */
export function validateHealthScore(score: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidScore(score)) {
    errors.push('Health score must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate risk level
 */
export function validateRiskLevel(level: string): boolean {
  const validLevels = ['critical', 'high', 'medium', 'low', 'none'];
  return validLevels.includes(level);
}

/**
 * Validate campaign dates
 */
export function validateCampaignDates(
  startDate: Date,
  endDate: Date
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidDateRange(startDate, endDate)) {
    errors.push('Start date must be before end date');
  }

  if (startDate < new Date()) {
    errors.push('Start date cannot be in the past');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate survey response
 */
export function validateSurveyResponse(
  response: any,
  questions: any[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!response.answers || !Array.isArray(response.answers)) {
    errors.push('Response must have answers array');
    return { valid: false, errors };
  }

  for (const answer of response.answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) {
      errors.push(`Invalid question ID: ${answer.questionId}`);
      continue;
    }

    if (question.required && (answer.answer === undefined || answer.answer === null)) {
      errors.push(`Required question not answered: ${question.text}`);
    }

    // Validate answer type based on question type
    switch (question.type) {
      case 'nps':
        if (typeof answer.answer !== 'number' || answer.answer < 0 || answer.answer > 10) {
          errors.push(`Invalid NPS answer for question: ${question.text}`);
        }
        break;
      case 'rating':
      case 'scale':
        if (typeof answer.answer !== 'number' || answer.answer < 1 || answer.answer > 5) {
          errors.push(`Invalid rating answer for question: ${question.text}`);
        }
        break;
      case 'multiple_choice':
        if (!question.options?.find((o: any) => o.id === answer.answer)) {
          errors.push(`Invalid choice for question: ${question.text}`);
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate playbook execution
 */
export function validatePlaybookExecution(execution: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!execution.customerId) {
    errors.push('Customer ID is required');
  }

  if (!execution.playbookId) {
    errors.push('Playbook ID is required');
  }

  if (!execution.assignedTo) {
    errors.push('Assignee is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Batch validate items
 */
export function batchValidate<T>(
  items: T[],
  validator: (item: T) => { valid: boolean; errors: string[] }
): { valid: boolean; errors: Record<number, string[]> } {
  const errors: Record<number, string[]> = {};
  let hasErrors = false;

  items.forEach((item, index) => {
    const result = validator(item);
    if (!result.valid) {
      errors[index] = result.errors;
      hasErrors = true;
    }
  });

  return {
    valid: !hasErrors,
    errors,
  };
}
